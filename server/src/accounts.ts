// Optional sign-in (docs/accounts.md): a passkey, no email or password, keeps a player's yōkai cards
// and the scores of the games they finish. Signing in is never needed to join a room or open the stage.
//
// One service for both runtimes. It speaks web Requests and Responses: the Node server wraps it,
// and on Cloudflare it runs inside the one AccountsObject (cloudflare/accountsObject.ts), so every
// change to an account happens one at a time.

import { createHash, randomBytes } from 'node:crypto';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { cleanName } from '../../shared/src/game.js';
import { isUtterance, utteranceReading } from '../../shared/src/japanese/kana.js';
import { MISSION_BY_ID, checkReading, pickMission, type MissionWord } from '../../shared/src/missions.js';
import { addGame, addSoloSay, bests, dueCards, duePhrases, emptyProgress, frameStats, reviewCard, reviewPhrase, rightSound, type AccountView, type PhraseCard, type Progress } from '../../shared/src/progress.js';
import { toRomaji } from '../../shared/src/japanese/romaji.js';
import { markPath, pathStatus } from '../../shared/src/path.js';
import type { AccountResult } from './room.js';

/** Where accounts live: a Map in Node, the AccountsObject's storage on Cloudflare. */
export interface AccountStorage {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
}

/** Kept in memory: `npm start` forgets accounts when it stops (fine for a local party). */
export class MemoryAccountStorage implements AccountStorage {
  private readonly map = new Map<string, string>();
  async get<T>(key: string): Promise<T | undefined> {
    const v = this.map.get(key);
    return v === undefined ? undefined : (JSON.parse(v) as T);
  }
  async put(key: string, value: unknown): Promise<void> {
    this.map.set(key, JSON.stringify(value));
  }
  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }
}

export interface StoredCredential {
  userId: string;
  /** base64url COSE public key. */
  publicKey: string;
  counter: number;
  transports?: string[];
}

/** The passkey ceremony, behind an interface so tests can stand in for a phone's authenticator. */
export interface Passkeys {
  registrationOptions(o: { rpId: string; userId: string; name: string; challenge: string }): Promise<unknown>;
  verifyRegistration(o: { response: unknown; origin: string; rpId: string; challenge: string }): Promise<{ id: string; publicKey: string; counter: number; transports?: string[] } | null>;
  authenticationOptions(o: { rpId: string; challenge: string }): Promise<unknown>;
  verifyAuthentication(o: { response: unknown; origin: string; rpId: string; challenge: string; credential: StoredCredential & { id: string } }): Promise<{ counter: number } | null>;
}

const RP_NAME = 'Kotoba Party';
const CHALLENGE_MS = 5 * 60_000;
const MAX_CHALLENGES = 500;
const SESSION_MS = 365 * 86_400_000;
const MAX_SESSIONS = 20;
/** Games shown on the scores page. */
const RECENT_GAMES = 30;
/** Saved phrases sent to the phone's Phrasebook tab, and to the stage per player. */
const PHONE_PHRASES = 200;
const STAGE_PHRASES = 40;

/** One signed-in player's saved phrases, as the stage shows them. */
export interface SavedPhrasebook {
  playerId: string;
  name: string;
  phrases: Pick<PhraseCard, 'itemId' | 'text' | 'kana' | 'en' | 'mode'>[];
}

const recentPhrases = (p: Progress, n: number): PhraseCard[] =>
  Object.values(p.phrases ?? {})
    .sort((a, b) => b.lastAt - a.lastAt)
    .slice(0, n);

/** A copy on its own ArrayBuffer, as SimpleWebAuthn's types want. */
function bytes(b: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(b.length);
  out.set(b);
  return out;
}

/** SimpleWebAuthn (MIT). No attestation: we only need a key that's the same next time, not who made it. */
export const webAuthnPasskeys: Passkeys = {
  registrationOptions: ({ rpId, userId, name, challenge }) =>
    generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: rpId,
      userName: name,
      userDisplayName: name,
      userID: bytes(Buffer.from(userId)),
      challenge: bytes(Buffer.from(challenge, 'base64url')),
      attestationType: 'none',
      // A discoverable passkey: next time the phone offers it without asking for a name.
      authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
    }),
  async verifyRegistration({ response, origin, rpId, challenge }) {
    const v = await verifyRegistrationResponse({ response: response as RegistrationResponseJSON, expectedChallenge: challenge, expectedOrigin: origin, expectedRPID: rpId, requireUserVerification: false });
    if (!v.verified) return null;
    const c = v.registrationInfo.credential;
    return { id: c.id, publicKey: Buffer.from(c.publicKey).toString('base64url'), counter: c.counter, transports: c.transports };
  },
  authenticationOptions: ({ rpId, challenge }) => generateAuthenticationOptions({ rpID: rpId, challenge: bytes(Buffer.from(challenge, 'base64url')), userVerification: 'preferred' }),
  async verifyAuthentication({ response, origin, rpId, challenge, credential }) {
    const v = await verifyAuthenticationResponse({
      response: response as AuthenticationResponseJSON,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpId,
      credential: { id: credential.id, publicKey: bytes(Buffer.from(credential.publicKey, 'base64url')), counter: credential.counter, transports: credential.transports },
      requireUserVerification: false,
    });
    return v.verified ? { counter: v.authenticationInfo.newCounter } : null;
  },
};

interface User {
  id: string;
  name: string;
  createdAt: number;
  /** The phone's UTC offset in minutes, for which day a review falls on. */
  tz: number;
  credentials: string[];
  /** Hashes of this account's sign-in sessions. */
  sessions: string[];
  progress: Progress;
}

interface Challenge {
  purpose: 'register' | 'login';
  exp: number;
  userId?: string;
  name?: string;
}

const hash = (token: string): string => createHash('sha256').update(token).digest('base64url');
const newSecret = (bytes: number): string => randomBytes(bytes).toString('base64url');
const isTz = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && Math.abs(v) <= 14 * 60;

export class Accounts {
  constructor(
    private readonly storage: AccountStorage,
    private readonly passkeys: Passkeys = webAuthnPasskeys,
    private readonly now: () => number = Date.now,
  ) {}

  /**
   * `/api/account/<action>`. `origin` is the page's own origin as the server sees it (the passkey's
   * site); the passkey is tied to its host name.
   */
  async handle(req: Request, action: string, origin: string, opts: { speech?: boolean } = {}): Promise<Response> {
    const rpId = new URL(origin).hostname;
    const body = req.method === 'POST' ? await readBody(req) : {};
    if (!body) return json(400, { error: 'bad-request' });

    switch (action) {
      case 'register/options': {
        if (req.method !== 'POST') break;
        const name = cleanName(body.name);
        if (!name) return json(400, { error: 'bad-name' });
        const userId = newSecret(12);
        const challenge = await this.issue({ purpose: 'register', userId, name });
        return json(200, { options: await this.passkeys.registrationOptions({ rpId, userId, name, challenge }) });
      }
      case 'register/verify': {
        if (req.method !== 'POST') break;
        const ch = await this.take(body.response, 'register');
        if (!ch?.userId || !ch.name) return json(400, { error: 'expired' });
        const cred = await this.passkeys.verifyRegistration({ response: body.response, origin, rpId, challenge: ch.challenge }).catch(() => null);
        if (!cred || (await this.storage.get(`cred:${cred.id}`))) return json(400, { error: 'not-verified' });
        const user: User = { id: ch.userId, name: ch.name, createdAt: this.now(), tz: isTz(body.tz) ? body.tz : 0, credentials: [cred.id], sessions: [], progress: emptyProgress() };
        await this.storage.put(`cred:${cred.id}`, { userId: user.id, publicKey: cred.publicKey, counter: cred.counter, transports: cred.transports } satisfies StoredCredential);
        const token = await this.newSession(user);
        return json(200, { token, account: this.view(user) });
      }
      case 'login/options': {
        if (req.method !== 'POST') break;
        const challenge = await this.issue({ purpose: 'login' });
        return json(200, { options: await this.passkeys.authenticationOptions({ rpId, challenge }) });
      }
      case 'login/verify': {
        if (req.method !== 'POST') break;
        const ch = await this.take(body.response, 'login');
        if (!ch) return json(400, { error: 'expired' });
        const credId = (body.response as { id?: unknown } | undefined)?.id;
        const cred = typeof credId === 'string' ? await this.storage.get<StoredCredential>(`cred:${credId}`) : undefined;
        const user = cred ? await this.storage.get<User>(`user:${cred.userId}`) : undefined;
        // A passkey for an account that was deleted: the phone still offers it. The page tells it to forget it.
        if (!cred || !user) return json(404, { error: 'unknown-passkey' });
        const ok = await this.passkeys.verifyAuthentication({ response: body.response, origin, rpId, challenge: ch.challenge, credential: { ...cred, id: credId as string } }).catch(() => null);
        if (!ok) return json(400, { error: 'not-verified' });
        await this.storage.put(`cred:${credId}`, { ...cred, counter: ok.counter });
        if (isTz(body.tz)) user.tz = body.tz;
        const token = await this.newSession(user);
        return json(200, { token, account: this.view(user) });
      }
      case 'me': {
        const user = await this.userFor(req);
        if (!user) return json(401, { error: 'signed-out' });
        const tz = Number(new URL(req.url).searchParams.get('tz'));
        if (isTz(tz) && tz !== user.tz) {
          user.tz = tz;
          await this.storage.put(`user:${user.id}`, user);
        }
        return json(200, { account: this.view(user) });
      }
      case 'review': {
        if (req.method !== 'POST') break;
        const user = await this.userFor(req);
        if (!user) return json(401, { error: 'signed-out' });
        const itemId = typeof body.itemId === 'string' ? body.itemId : '';
        if (body.kind === 'phrase') {
          // Said out loud, then marked by the player (see reviewPhrase).
          const phrase = reviewPhrase(user.progress, itemId, body.knew === true, this.now(), user.tz);
          if (phrase) markPath(user.progress, this.now(), user.tz);
          if (!phrase) return json(404, { error: 'no-card' });
          await this.storage.put(`user:${user.id}`, user);
          return json(200, { phrase });
        }
        const card = user.progress.cards[itemId];
        if (!card) return json(404, { error: 'no-card' });
        const right = typeof body.answer === 'string' && rightSound(card, body.answer);
        const caughtBefore = card.caughtAt !== null;
        reviewCard(user.progress, itemId, right, this.now(), user.tz);
        markPath(user.progress, this.now(), user.tz);
        await this.storage.put(`user:${user.id}`, user);
        return json(200, { right, expected: toRomaji(card.hear), card, caught: !caughtBefore && card.caughtAt !== null });
      }
      case 'mission': {
        // A solo mission (shared/src/missions.ts): tonight's signs, without their readings (reading them is the task).
        if (req.method !== 'POST') break;
        const user = await this.userFor(req);
        if (!user) return json(401, { error: 'signed-out' });
        const mission = MISSION_BY_ID[typeof body.mission === 'string' ? body.mission : ''];
        if (!mission) return json(404, { error: 'no-mission' });
        const words = pickMission(user.progress, mission, this.now(), user.tz);
        return json(200, { mission: { id: mission.id, goal: mission.goal, words: words.map((w) => ({ itemId: w.itemId, sign: w.sign })) }, speech: opts.speech === true });
      }
      case 'mission/answer': {
        // One sign: an answer the server checks (said or typed), or "show me the reading". Only a right reading
        // before the reading showed counts from memory; a wrong one isn't saved, so the phone can let them try again.
        if (req.method !== 'POST') break;
        const user = await this.userFor(req);
        if (!user) return json(401, { error: 'signed-out' });
        const mission = MISSION_BY_ID[typeof body.mission === 'string' ? body.mission : ''];
        const word = mission?.words.find((w) => w.itemId === body.itemId);
        if (!mission || !word) return json(404, { error: 'no-sign' });
        const at = this.now();
        const entry = (outcome: 'said' | 'missed', memory: boolean) => ({ itemId: word.itemId, text: word.text, kana: word.kana, en: word.en, outcome, recall: memory ? ('memory' as const) : ('read' as const) });
        if (body.giveUp === true) {
          addSoloSay(user.progress, entry('missed', false), at, user.tz);
          await this.storage.put(`user:${user.id}`, user);
          return json(200, { right: false, counted: false, reveal: reveal(word) });
        }
        if (!isUtterance(body.answer)) return json(400, { error: 'bad-answer' });
        const check = checkReading(word, body.answer);
        if (!check.right) return json(200, { right: false, why: check.why, heard: utteranceReading(body.answer) });
        const counted = body.peeked !== true;
        addSoloSay(user.progress, entry('said', counted), at, user.tz);
        markPath(user.progress, at, user.tz);
        await this.storage.put(`user:${user.id}`, user);
        return json(200, { right: true, counted, reveal: reveal(word) });
      }
      case 'settings': {
        // The learning path's switch (docs/progressive-learning.md). Only what's sent changes.
        if (req.method !== 'POST') break;
        const user = await this.userFor(req);
        if (!user) return json(401, { error: 'signed-out' });
        if (typeof body.path !== 'boolean') return json(400, { error: 'bad-settings' });
        user.progress.path = body.path;
        await this.storage.put(`user:${user.id}`, user);
        return json(200, { account: this.view(user) });
      }
      case 'signout': {
        if (req.method !== 'POST') break;
        const token = bearer(req);
        const user = await this.userFor(req);
        if (user && token) {
          await this.storage.delete(`session:${hash(token)}`);
          user.sessions = user.sessions.filter((s) => s !== hash(token));
          await this.storage.put(`user:${user.id}`, user);
        }
        return json(200, { ok: true });
      }
      case 'delete': {
        if (req.method !== 'POST') break;
        const user = await this.userFor(req);
        if (!user) return json(401, { error: 'signed-out' });
        for (const s of user.sessions) await this.storage.delete(`session:${s}`);
        for (const c of user.credentials) await this.storage.delete(`cred:${c}`);
        await this.storage.delete(`user:${user.id}`);
        return json(200, { ok: true, credentials: user.credentials });
      }
    }
    return json(404, { error: 'not-found' });
  }

  /** A room's finished game: saved for each player who joined signed in. Unknown or expired sessions are skipped. */
  async recordResults(results: AccountResult[]): Promise<void> {
    for (const { account, result } of results) {
      const user = await this.userForToken(account);
      if (!user) continue;
      addGame(user.progress, result, user.tz);
      markPath(user.progress, this.now(), user.tz);
      await this.storage.put(`user:${user.id}`, user);
    }
  }

  /**
   * The saved phrasebooks of the signed-in players in a room, for the stage's Phrasebook: each
   * player's most recently met phrases (no misses or boxes: the TV is for the whole room).
   */
  async phrasebooks(accounts: { playerId: string; account: string }[]): Promise<SavedPhrasebook[]> {
    const out: SavedPhrasebook[] = [];
    for (const { playerId, account } of accounts) {
      const user = await this.userForToken(account);
      if (!user) continue;
      const phrases = recentPhrases(user.progress, STAGE_PHRASES).map(({ itemId, text, kana, en, mode }) => ({ itemId, text, kana, en, mode }));
      out.push({ playerId, name: user.name, phrases });
    }
    return out;
  }

  private view(user: User): AccountView {
    const now = this.now();
    return {
      name: user.name,
      cards: Object.values(user.progress.cards),
      due: dueCards(user.progress, now),
      games: user.progress.games.slice(0, RECENT_GAMES),
      bests: bests(user.progress),
      phrases: recentPhrases(user.progress, PHONE_PHRASES),
      duePhrases: duePhrases(user.progress, now),
      path: user.progress.path === true,
      frames: frameStats(user.progress),
      pathStatus: pathStatus(user.progress, now, user.tz),
    };
  }

  private async newSession(user: User): Promise<string> {
    const token = newSecret(32);
    const h = hash(token);
    await this.storage.put(`session:${h}`, { userId: user.id, exp: this.now() + SESSION_MS });
    user.sessions = [...user.sessions, h];
    // The oldest sign-ins past the cap end.
    while (user.sessions.length > MAX_SESSIONS) await this.storage.delete(`session:${user.sessions.shift()!}`);
    await this.storage.put(`user:${user.id}`, user);
    return token;
  }

  /** Whether a sign-in token is live (the account speech check, for a solo mission outside a room). */
  async signedIn(token: string): Promise<boolean> {
    return !!(await this.userForToken(token));
  }

  private userFor(req: Request): Promise<User | undefined> {
    return this.userForToken(bearer(req) ?? '');
  }

  private async userForToken(token: string): Promise<User | undefined> {
    if (!token) return undefined;
    const s = await this.storage.get<{ userId: string; exp: number }>(`session:${hash(token)}`);
    if (!s || s.exp < this.now()) return undefined;
    return this.storage.get<User>(`user:${s.userId}`);
  }

  /** A one-use challenge for the next passkey step, good for 5 minutes. */
  private async issue(c: Omit<Challenge, 'exp'>): Promise<string> {
    const all = await this.challenges();
    const challenge = newSecret(32);
    all[challenge] = { ...c, exp: this.now() + CHALLENGE_MS };
    const keys = Object.keys(all);
    for (const k of keys.slice(0, Math.max(0, keys.length - MAX_CHALLENGES))) delete all[k];
    await this.storage.put('challenges', all);
    return challenge;
  }

  /** Uses up the challenge the passkey signed (it's in the response's client data). */
  private async take(response: unknown, purpose: Challenge['purpose']): Promise<(Challenge & { challenge: string }) | null> {
    const challenge = challengeOf(response);
    if (!challenge) return null;
    const all = await this.challenges();
    const c = all[challenge];
    if (!c) return null;
    delete all[challenge];
    await this.storage.put('challenges', all);
    return c.purpose === purpose ? { ...c, challenge } : null;
  }

  private async challenges(): Promise<Record<string, Challenge>> {
    const all = (await this.storage.get<Record<string, Challenge>>('challenges')) ?? {};
    const now = this.now();
    for (const [k, c] of Object.entries(all)) if (c.exp < now) delete all[k];
    return all;
  }
}

/** A sign's answer, shown once it's read or given up. */
function reveal(w: MissionWord): { text: string; kana: string; romaji: string; en: string; kanji: MissionWord['kanji'] } {
  return { text: w.text, kana: w.kana, romaji: toRomaji(w.kana), en: w.en, kanji: w.kanji };
}

/** The challenge inside a passkey response's clientDataJSON. */
function challengeOf(response: unknown): string | null {
  try {
    const data = (response as { response?: { clientDataJSON?: unknown } }).response?.clientDataJSON;
    if (typeof data !== 'string') return null;
    const challenge = (JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as { challenge?: unknown }).challenge;
    return typeof challenge === 'string' ? challenge : null;
  } catch {
    return null;
  }
}

async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  const text = await req.text();
  if (text.length > 16 * 1024) return null;
  if (!text) return {};
  try {
    const v = JSON.parse(text) as unknown;
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function bearer(req: Request): string | null {
  const h = req.headers.get('authorization');
  return h?.startsWith('Bearer ') ? h.slice(7) : null;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}
