// Phrase Bingo Theater (フレーズビンゴ劇場): improv scenes where each actor secretly slips in
// assigned phrases, and the audience plays bingo trying to catch them. Host: Pon.
// See docs/modes/phrase-bingo.md for the rules in prose.
//
// Each scene (one round):
//   prompt  the scene card: setting, cast and roles; actors study their 2–3 secret phrases,
//           the audience gets a 3×3 bingo card of phrases (every secret plus decoys)
//   answer  ACTION! The cast improvises aloud in the room. An actor scores a phrase by saying
//           it into their phone mid-scene (hold-to-talk, checked leniently). The stage ticker
//           shows who just slipped one in, never which. The audience buzzes cell + actor.
//   reveal  secrets revealed: each phrase said, caught, or smooth (said and never caught)
//   encore  shout it back: Pon calls the scene's smoothest phrase, the whole room says it
//   score   bingo lines (cards daubed with every phrase that was said) and the scene's points

import type { JpText, Level, TopicPack } from '../../../../content/src/types.js';
import { isUtterance, type Utterance } from '../../japanese/kana.js';
import type { Phase, Viewer } from '../../protocol.js';
import { firstMora } from '../lastTrain/check.js';
import { toRomaji } from '../../japanese/romaji.js';
import { cleanText, isObject, moveError, MOVE_OK, shuffled, type Award, type Mode, type ModeContext, type ModePlayer } from '../mode.js';
import { phraseKey, phraseScore, saidPhrase } from './check.js';
import { ALL_SCENES, GREEN_CAR_SCENES, SCENES, scenesFor, type Scene, type ScenePhrase } from './scenes.js';
import { FRAME_BY_ID, framesHeard, type FrameId } from '../../japanese/frames.js';
import { aimPick, aimWeight } from '../aim.js';

// ---- tuning ----

export const TOTAL_SCENES = 4;
/** Saying a secret phrase in the scene. */
export const SLIP_POINTS = 100;
/** A said phrase nobody caught: slipped in so naturally the audience missed it. */
export const SMOOTH_POINTS = 100;
/** Each correct catch, for the catcher. */
export const CATCH_POINTS = 100;
/** A bingo line on your card (once per card). */
export const BINGO_POINTS = 50;
/** Said without peeking at the phrase during the scene (spoken / typed). From the bonus pool. */
export const MEMORY_BONUS = { speech: 40, typed: 20 } as const;
/** Shouting the scene's phrase back in the encore (spoken / typed). From the bonus pool. */
export const ECHO_BONUS = { speech: 20, typed: 10 } as const;
/** Every speaking bonus comes from one pool: at most 30% of the points a player had at stake. */
export const BONUS_POOL_SHARE = 0.3;
const COMEBACK = 1.5;
/** How long Pon's reactions may wait for an AI-written line (reveal 14 s, bingo 9 s; the AI gives up at 6 s). */
export const REACT_WAIT_MS = 6_000;
/** Buzzes per audience member per scene. A wrong buzz costs nothing but a buzz. */
export const BUZZES = 3;
/** A buzz counts if the phrase reached the server no later than this after the buzz (recogniser lag). */
export const GRACE_MS = 5_000;
export const ECHO_TRIES = 2;
export const CARD_CELLS = 9;
const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const;

export const DURATIONS = {
  intro: 16_000,
  prompt: 18_000,
  promptKana: 24_000,
  sceneBase: 60_000,
  scenePerActor: 10_000,
  reveal: 14_000,
  encore: 10_000,
  score: 9_000,
} as const;

// ---- state ----

export interface Phrase {
  id: string;
  jp: JpText;
  level: Level;
  accepted?: string[];
  /** Green Car lines: the frames the line carries; the first is the card's label. */
  frames?: readonly string[];
}

export interface Secret {
  phraseId: string;
  /** Looked at the Japanese during the scene (no memory bonus). */
  peeked: boolean;
  said: { at: number; via: Utterance['via']; memory: boolean; heard: string; frames?: FrameId[] } | null;
  caughtBy: string[];
  /** Green Car: an N3 line dealt to an N4 actor as an optional stretch (tagged N3; unsaid costs nothing). */
  stretch?: true;
}

export interface Actor {
  playerId: string;
  role: JpText;
  ready: boolean;
  secrets: Secret[];
  last: { heard: string; matched: string | null } | null;
}

export interface Buzz {
  playerId: string;
  phraseId: string;
  actorId: string;
  at: number;
  result: 'caught' | 'miss' | null;
}

export interface Card {
  cells: string[];
  /** The first bingo line, as cell indices, once scored. */
  line: number[] | null;
}

export interface Echo {
  tries: number;
  ok: boolean;
  heard: string;
}

export interface PlayerStats {
  slipped: number;
  smooth: number;
  catches: number;
  bingos: number;
  memory: number;
  echoes: number;
}

export interface PhraseBingoState {
  packId: string | null;
  order: string[];
  round: number;
  totalRounds: number;
  scene: Scene | null;
  cast: Actor[];
  cards: Record<string, Card>;
  /** Every phrase in play this scene (secrets and decoys), by id. */
  pool: Record<string, Phrase>;
  buzzes: Buzz[];
  /** Said phrases in the order they were said. */
  slips: { actorId: string; phraseId: string; at: number }[];
  sceneStart: number;
  resolved: boolean;
  highlight: string | null;
  echoes: Record<string, Echo>;
  /** Points each player made this scene, and the bonus pool they have used. */
  scenePoints: Record<string, number>;
  bonusUsed: Record<string, number>;
  bonusCap: Record<string, number>;
  acted: Record<string, number>;
  lastCast: string[];
  stats: Record<string, PlayerStats>;
  phaseAt: number;
  /** In the Green Car (shared/src/greenCar.ts): Green Car scenes, frame lines, frame cards. */
  greenCar?: true;
  /** Green Car: each player's frames said this game, for aiming the next deal (shared/src/modes/aim.ts). */
  saidFrames?: Record<string, Record<string, number>>;
}

export type PhraseBingoMove =
  | { kind: 'ready' }
  | { kind: 'peek'; phraseId: string }
  | { kind: 'say'; utterance: Utterance }
  | { kind: 'buzz'; phraseId: string; actorId: string }
  | { kind: 'echo'; utterance: Utterance };

// ---- view ----

export interface PhraseCard {
  id: string;
  text: string;
  kana: string;
  en: string;
  furigana?: JpText['furigana'];
  /** Kana level only. */
  romaji?: string;
  /** Green Car: the frame the card shows instead of the sentence (＿て もらえますか), and the line's level tag. */
  frame?: { id: string; ja: string; en: string };
  tag?: 'N4' | 'N3';
}

export interface ResultPhrase extends PhraseCard {
  said: boolean;
  smooth: boolean;
  memory: boolean;
  caughtBy: string[];
  /** Seconds into the scene it was said. */
  atSec: number | null;
}

export interface ActorView {
  playerId: string;
  role: JpText;
  ready: boolean;
  /** Phrases said so far (the number only, during the scene). */
  said: number;
  total: number;
  /** The secrets, once the scene is over. */
  phrases: ResultPhrase[] | null;
}

/** A line on the stage ticker, with its reading so the stage can put furigana over the kanji. */
export type TickerPhrase = Pick<JpText, 'text' | 'kana' | 'en' | 'furigana'>;

export interface TickerItem {
  kind: 'slip' | 'buzz';
  playerId: string;
  atSec: number;
  /** The phrase, once the scene is over (slips only). */
  phrase?: TickerPhrase;
  /** Who the buzz named and whether it was right, once the scene is over. */
  buzz?: { actorId: string; ok: boolean; phrase: TickerPhrase | null };
}

export interface SecretView {
  id: string;
  en: string;
  /** First sound of the phrase (with romaji at the Kana level). */
  hint: string;
  said: boolean;
  peeked: boolean;
  /** The Japanese: while studying, once peeked or said, and after the scene. */
  jp: PhraseCard | null;
  smooth?: boolean;
  caughtBy?: string[];
  /** Green Car: an optional N3 stretch line for an N4 actor. */
  stretch?: true;
}

export interface CellView extends PhraseCard {
  /** Someone said it (after the scene). */
  daubed: boolean;
  /** This viewer's buzz on the cell. */
  buzz: { actorId: string; result: 'caught' | 'miss' | null } | null;
}

export interface PhraseBingoView {
  mode: 'phrase-bingo';
  round: number;
  totalRounds: number;
  multiplier: number;
  phaseAt: number;
  scene: { id: string; emoji: string; setting: JpText; twist: string } | null;
  cast: ActorView[];
  audience: string[];
  ticker: TickerItem[];
  /** Bingo lines this scene (score phase). */
  bingos: string[];
  /** The phrase to shout back (encore and score). */
  highlight: PhraseCard | null;
  echoed: string[];
  /** Points each player made this scene (reveal and after). */
  scenePoints: { playerId: string; points: number }[] | null;
  me: {
    level: Level;
    part: 'actor' | 'audience';
    actor: { role: JpText; ready: boolean; secrets: SecretView[]; last: Actor['last'] } | null;
    card: { cells: CellView[]; buzzesLeft: number; line: number[] | null } | null;
    echo: { canEcho: boolean; ok: boolean; triesLeft: number; heard: string } | null;
    points: number | null;
  } | null;
}

// ---- helpers ----

const blankStats = (): PlayerStats => ({ slipped: 0, smooth: 0, catches: 0, bingos: 0, memory: 0, echoes: 0 });
const stats = (s: PhraseBingoState, id: string) => (s.stats[id] ??= blankStats());
const multiplierFor = (s: PhraseBingoState) => (s.round === s.totalRounds ? 2 : 1);
const actorOf = (s: PhraseBingoState, id: string) => s.cast.find((a) => a.playerId === id);

/** How many actors a scene has for this many players: at least one in the audience. */
export function castSize(players: number): number {
  const n = players <= 4 ? 2 : players <= 7 ? 3 : 4;
  return Math.max(1, Math.min(n, players - 1));
}

/**
 * Secret phrases per actor: 3 in a two-actor scene, else 2 (and 2 at the Kana level), so the
 * 3×3 card holds every secret with room for decoys: three actors with 3 lines each would fill
 * all nine cells, and every card would hit bingo once the lines were said.
 */
export function secretsFor(level: Level, cast: number): number {
  return cast >= 3 || level === 'kana' ? 2 : 3;
}

/** The scene phrase, with the topic pack's text when the pack has the phrase it copies. */
function resolve(p: ScenePhrase, packs: readonly TopicPack[]): Phrase {
  const fromPack = p.from ? packs.flatMap((x) => x.phrases).find((x) => x.id === p.from) : undefined;
  const jp = fromPack ? fromPack.jp : p.jp;
  return { id: p.id, jp, level: p.level, ...(p.accepted ? { accepted: p.accepted } : {}), ...(p.frames ? { frames: p.frames } : {}) };
}

/** Level bands an actor's phrases are drawn from, best first (N4 uses N5 where N4 runs out). */
const BANDS: Record<Level, Level[]> = { kana: ['kana'], n5: ['n5', 'kana'], n4: ['n4', 'n5', 'kana'], n3: ['n3', 'n4', 'n5', 'kana'] };

function pay(s: PhraseBingoState, ctx: ModeContext, playerId: string, points: number): void {
  const p = Math.round(points);
  if (!p || !ctx.player(playerId)) return;
  ctx.award(playerId, p);
  s.scenePoints[playerId] = (s.scenePoints[playerId] ?? 0) + p;
}

/** Pays a speaking bonus from the player's capped pool (comebacks raise it, never past the cap). */
function payBonus(s: PhraseBingoState, ctx: ModeContext, playerId: string, points: number, mean: number): number {
  const player = ctx.player(playerId);
  if (!player) return 0;
  const raised = player.score < mean ? points * COMEBACK : points;
  const room = Math.max(0, (s.bonusCap[playerId] ?? 0) - (s.bonusUsed[playerId] ?? 0));
  const paid = Math.min(room, Math.round(raised / 5) * 5);
  if (paid <= 0) return 0;
  s.bonusUsed[playerId] = (s.bonusUsed[playerId] ?? 0) + paid;
  pay(s, ctx, playerId, paid);
  return paid;
}

const meanScore = (ctx: ModeContext) => {
  const scores = ctx.players().map((p) => p.score);
  return scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length);
};

function phraseCard(p: Phrase, romaji: boolean): PhraseCard {
  const f = p.frames?.[0] ? FRAME_BY_ID[p.frames[0] as FrameId] : undefined;
  return {
    id: p.id,
    text: p.jp.text,
    kana: p.jp.kana,
    en: p.jp.en,
    ...(p.jp.furigana ? { furigana: p.jp.furigana } : {}),
    ...(romaji ? { romaji: toRomaji(p.jp.kana) } : {}),
    ...(f ? { frame: { id: f.id, ja: f.ja, en: f.en }, tag: p.level === 'n3' ? ('N3' as const) : ('N4' as const) } : {}),
  };
}

/** Green Car bingo cell: the frame, not the sentence, so the audience listens for the grammar. */
function frameCell(p: Phrase, romaji: boolean): PhraseCard {
  const c = phraseCard(p, romaji);
  if (!c.frame) return c;
  const { furigana: _furigana, romaji: _romaji, ...rest } = c;
  return { ...rest, text: c.frame.ja, kana: c.frame.ja, en: c.frame.en };
}

function tickerPhrase(p: Phrase): TickerPhrase {
  return { text: p.jp.text, kana: p.jp.kana, en: p.jp.en, ...(p.jp.furigana ? { furigana: p.jp.furigana } : {}) };
}

function hintFor(p: Phrase, romaji: boolean): string {
  const mora = firstMora(p.jp.kana);
  return romaji ? `${mora}… (${toRomaji(mora)}…)` : `${mora}…`;
}

/**
 * Picks the scene's cast: who has acted least, avoiding last scene's actors, connected first. Players with
 * their mic off stay in the audience (catching lines) while two others can act.
 */
function pickCast(s: PhraseBingoState, ctx: ModeContext): ModePlayer[] {
  const all = ctx.players();
  const here = all.filter((p) => p.connected);
  const room = here.length >= 2 ? here : all;
  const speaking = room.filter((p) => p.mic !== 'quiet');
  const pool = speaking.length >= 2 ? speaking : room;
  const size = Math.min(castSize(room.length), pool.length);
  const jitter = new Map(pool.map((p) => [p.id, ctx.random()]));
  return [...pool]
    .sort(
      (a, b) =>
        (s.acted[a.id] ?? 0) - (s.acted[b.id] ?? 0) ||
        Number(s.lastCast.includes(a.id)) - Number(s.lastCast.includes(b.id)) ||
        jitter.get(a.id)! - jitter.get(b.id)!,
    )
    .slice(0, size)
    .sort((a, b) => a.seat - b.seat);
}

/** Two phrases clash when one sound key contains the other: a catch or a check could confuse them. */
function clashes(key: string, taken: readonly string[]): boolean {
  return taken.some((k) => k === key || k.includes(key) || key.includes(k));
}

function startScene(s: PhraseBingoState, ctx: ModeContext): void {
  s.round += 1;
  const scenes = s.greenCar ? GREEN_CAR_SCENES : SCENES;
  const scene = ALL_SCENES.find((x) => x.id === s.order[(s.round - 1) % s.order.length]) ?? scenes[0]!;
  s.scene = scene;
  s.cast = [];
  s.cards = {};
  s.pool = {};
  s.buzzes = [];
  s.slips = [];
  s.echoes = {};
  s.highlight = null;
  s.resolved = false;
  s.scenePoints = {};
  s.bonusUsed = {};
  s.bonusCap = {};
  const random = () => ctx.random();
  const packs = ctx.content.packs;
  const here = shuffled(scene.phrases, random).map((p) => resolve(p, packs));
  // In the Green Car the rest come only from this room's own Green Car scenes (a Kids room never sees a Cheeky line).
  const elsewhere = shuffled(
    (s.greenCar ? scenes.filter((x) => s.order.includes(x.id)) : scenes).filter((x) => x.id !== scene.id).flatMap((x) => x.phrases),
    random,
  ).map((p) => resolve(p, packs));
  if (s.greenCar) return dealGreenCar(s, ctx, scene, here, elsewhere);
  const takenKeys: string[] = [];
  const takenIds = new Set<string>();
  const take = (p: Phrase) => {
    takenKeys.push(phraseKey(p.jp.kana));
    takenIds.add(p.id);
    s.pool[p.id] = p;
  };
  const free = (p: Phrase) => !takenIds.has(p.id) && !clashes(phraseKey(p.jp.kana), takenKeys);

  const cast = pickCast(s, ctx);
  const roles = shuffled(scene.roles, random);
  cast.forEach((player, i) => {
    const want = secretsFor(player.level, cast.length);
    const secrets: Secret[] = [];
    for (const source of [here, elsewhere]) {
      for (const band of BANDS[player.level]) {
        for (const p of source) {
          if (secrets.length >= want) break;
          if (p.level !== band || !free(p)) continue;
          take(p);
          secrets.push({ phraseId: p.id, peeked: false, said: null, caughtBy: [] });
        }
      }
    }
    s.cast.push({ playerId: player.id, role: roles[i % roles.length]!, ready: false, secrets, last: null });
    s.acted[player.id] = (s.acted[player.id] ?? 0) + 1;
  });
  s.lastCast = cast.map((p) => p.id);

  // The card: every secret, plus decoys from the same scene (then any scene) to fill 9 cells.
  const cells = Object.keys(s.pool);
  for (const source of [here, elsewhere]) {
    for (const p of source) {
      if (cells.length >= CARD_CELLS) break;
      if (!free(p)) continue;
      take(p);
      cells.push(p.id);
    }
  }
  dealCards(s, ctx, cells);
}

/** Every audience member gets the cells in their own order; everyone's bonus pool is set for the scene. */
function dealCards(s: PhraseBingoState, ctx: ModeContext, cells: string[]): void {
  const castIds = new Set(s.cast.map((a) => a.playerId));
  const mult = multiplierFor(s);
  for (const p of ctx.players()) {
    if (!castIds.has(p.id)) {
      s.cards[p.id] = { cells: shuffled(cells, () => ctx.random()), line: null };
      s.bonusCap[p.id] = BONUS_POOL_SHARE * CATCH_POINTS * BUZZES * mult;
    }
  }
  for (const a of s.cast) s.bonusCap[a.playerId] = BONUS_POOL_SHARE * (SLIP_POINTS + SMOOTH_POINTS) * a.secrets.filter((x) => !x.stretch).length * mult;
}

/**
 * The Green Car deal (docs/modes/phrase-bingo.md, "Green Car"). Every line carries one frame and no two lines in play
 * share a frame, since the card shows the frame. Slots per actor as in a mixed room (secretsFor):
 *  - an N3 actor's slots alternate N3 and N4 (which comes first is drawn per actor), so about half are N3;
 *  - an N4 actor's slots are N4, plus one optional N3 stretch line (tag N3) while the card still has a decoy cell
 *    (two actors, or three: up to eight secrets; four actors: none);
 *  - when this scene has no unused line of the wanted level, another Green Car scene of this room's; then the other
 *    level (an N3 line in an N4 actor's slot is a stretch).
 * Within a level, the line whose frame the actor needs most (aimWeight: path goals' required frames, said least
 * tonight and this game), ties broken by the shuffled order. Then decoys fill the card to nine cells.
 */
export function dealGreenCar(s: PhraseBingoState, ctx: ModeContext, scene: Scene, here: Phrase[], elsewhere: Phrase[]): void {
  const random = () => ctx.random();
  const takenFrames = new Set<string>();
  const takenKeys: string[] = [];
  const frameOf = (p: Phrase) => p.frames?.[0] ?? p.id;
  const free = (p: Phrase) => !s.pool[p.id] && !takenFrames.has(frameOf(p)) && !clashes(phraseKey(p.jp.kana), takenKeys);
  const take = (p: Phrase) => {
    takenFrames.add(frameOf(p));
    takenKeys.push(phraseKey(p.jp.kana));
    s.pool[p.id] = p;
  };
  const cast = pickCast(s, ctx);
  const roles = shuffled(scene.roles, random);
  const base = cast.reduce((n, p) => n + secretsFor(p.level, cast.length), 0);
  let stretches = Math.max(0, CARD_CELLS - 1 - base);
  const saidFrames = (s.saidFrames ??= {});
  cast.forEach((player, i) => {
    const want = secretsFor(player.level, cast.length);
    const n3 = player.level === 'n3';
    const first = random() < 0.5;
    const slots: { level: 'n4' | 'n3'; stretch: boolean }[] = [];
    for (let k = 0; k < want; k++) slots.push({ level: n3 && (k % 2 === 0) === first ? 'n3' : 'n4', stretch: false });
    if (!n3 && stretches > 0) {
      slots.push({ level: 'n3', stretch: true });
      stretches -= 1;
    }
    const secrets: Secret[] = [];
    for (const slot of slots) {
      const other = slot.level === 'n3' ? 'n4' : 'n3';
      const tries: [Phrase[], string][] = [
        [here, slot.level],
        [elsewhere, slot.level],
        [here, other],
        [elsewhere, other],
      ];
      let pick: Phrase | undefined;
      for (const [source, level] of tries) {
        pick = aimPick(
          source.filter((p) => p.level === level && free(p)),
          (p) => aimWeight(ctx, player.id, p.frames ?? [], saidFrames[player.id]),
        );
        if (pick) break;
      }
      if (!pick) continue;
      take(pick);
      const stretch = slot.stretch || (!n3 && pick.level === 'n3');
      secrets.push({ phraseId: pick.id, peeked: false, said: null, caughtBy: [], ...(stretch ? { stretch: true as const } : {}) });
    }
    s.cast.push({ playerId: player.id, role: roles[i % roles.length]!, ready: false, secrets, last: null });
    s.acted[player.id] = (s.acted[player.id] ?? 0) + 1;
  });
  s.lastCast = cast.map((p) => p.id);
  const cells = Object.keys(s.pool);
  for (const p of [...here, ...elsewhere]) {
    if (cells.length >= CARD_CELLS) break;
    if (!free(p)) continue;
    take(p);
    cells.push(p.id);
  }
  dealCards(s, ctx, cells);
}

/** Scores the scene: catches, slips, smooth bonuses, bingo lines and the phrasebook. */
function resolveScene(s: PhraseBingoState, ctx: ModeContext): void {
  if (s.resolved || !s.scene) return;
  s.resolved = true;
  const mult = multiplierFor(s);
  const mean = meanScore(ctx);

  for (const b of [...s.buzzes].sort((x, y) => x.at - y.at)) {
    const secret = actorOf(s, b.actorId)?.secrets.find((x) => x.phraseId === b.phraseId);
    const ok = !!secret?.said && secret.said.at <= b.at + GRACE_MS;
    b.result = ok ? 'caught' : 'miss';
    if (ok && !secret!.caughtBy.includes(b.playerId)) {
      secret!.caughtBy.push(b.playerId);
      pay(s, ctx, b.playerId, CATCH_POINTS * mult);
      stats(s, b.playerId).catches += 1;
      const p = s.pool[b.phraseId]!;
      ctx.phrase(b.playerId, { itemId: p.id, text: p.jp.text, kana: p.jp.kana, en: p.jp.en, outcome: 'seen' });
    }
  }

  for (const a of s.cast) {
    for (const secret of a.secrets) {
      const p = s.pool[secret.phraseId]!;
      const entry = { itemId: p.id, text: p.jp.text, kana: p.jp.kana, en: p.jp.en };
      if (!secret.said) {
        // An unsaid Green Car stretch line was only a dare: seen, not missed.
        ctx.phrase(a.playerId, { ...entry, outcome: secret.stretch ? 'seen' : 'missed' });
        continue;
      }
      const st = stats(s, a.playerId);
      st.slipped += 1;
      pay(s, ctx, a.playerId, SLIP_POINTS * mult);
      if (!secret.caughtBy.length) {
        pay(s, ctx, a.playerId, SMOOTH_POINTS * mult);
        st.smooth += 1;
      }
      if (secret.said.memory) {
        st.memory += 1;
        payBonus(s, ctx, a.playerId, MEMORY_BONUS[secret.said.via === 'speech' ? 'speech' : 'typed'] * mult, mean);
      }
      const fromMemory = secret.said.memory && secret.said.via === 'speech';
      if (s.greenCar) {
        // Green Car: a line counts for the frames heard in the actor's own words (not a peeked one's).
        const heard = fromMemory ? (secret.said.frames ?? []) : [];
        const said = (s.saidFrames ??= {})[a.playerId] ??= {};
        for (const f of heard) said[f] = (said[f] ?? 0) + 1;
        ctx.phrase(a.playerId, { ...entry, outcome: secret.said.memory ? 'said' : 'retry', recall: fromMemory ? 'memory' : 'read', frames: heard });
        continue;
      }
      ctx.phrase(a.playerId, { ...entry, outcome: secret.said.memory ? 'said' : 'retry', recall: fromMemory ? 'memory' : 'read' });
    }
  }

  const daubed = new Set(s.slips.map((x) => x.phraseId));
  for (const [playerId, card] of Object.entries(s.cards)) {
    const line = LINES.find((l) => l.every((i) => daubed.has(card.cells[i]!)));
    if (!line) continue;
    card.line = [...line];
    pay(s, ctx, playerId, BINGO_POINTS * mult);
    stats(s, playerId).bingos += 1;
  }

  // The phrase to shout back: the first smooth one, else the first said, else the first dealt.
  const said = s.slips.map((x) => actorOf(s, x.actorId)!.secrets.find((y) => y.phraseId === x.phraseId)!);
  s.highlight = (said.find((x) => !x.caughtBy.length) ?? said[0] ?? s.cast[0]?.secrets[0])?.phraseId ?? null;

  const all = s.cast.flatMap((a) => a.secrets);
  const smooth = all.filter((x) => x.said && !x.caughtBy.length).length;
  const tier = !s.slips.length ? 'flop' : smooth === all.length ? 'ippon' : 'good';
  const shown = s.slips.map((x) => s.pool[x.phraseId]!.jp);
  ctx.cue({
    host: 'pon',
    event: 'reveal_react',
    tier,
    prompt: { text: s.scene.setting.text, kana: s.scene.setting.kana, en: s.scene.setting.en },
    answer: shown.map((x) => x.text).join(' / ') || undefined,
    answerEn: shown.map((x) => x.en).join(' / ') || undefined,
    context: 'Phrase Bingo Theater: improv scene; actors slipped in secret phrases, the audience tried to catch them.',
    // The secrets stay up for the whole reveal, so Pon can take the time to write a real reaction.
    waitMs: REACT_WAIT_MS,
  });
}

const secSince = (s: PhraseBingoState, at: number) => Math.max(0, Math.round((at - s.sceneStart) / 1000));
const nameOf = (ctx: ModeContext, id: string) => ctx.player(id)?.name ?? '';

// ---- the mode ----

export const phraseBingoMode: Mode<PhraseBingoState, PhraseBingoView> = {
  info: {
    id: 'phrase-bingo',
    title: 'Phrase Bingo Theater',
    titleJa: 'フレーズビンゴ劇場',
    titleKana: 'フレーズビンゴげきじょう',
    blurb: 'Act out a scene and secretly slip in your phrases. The audience plays bingo to catch them.',
    host: 'pon',
    minPlayers: 3,
    // Singing, presenting or acting needs a mic: mic-off players watch, react and vote (docs/sound-off.md).
    minSpeakers: 2,
    maxPlayers: 8,
    roundChoices: [TOTAL_SCENES, 6, 3],
    usesPack: true,
    phrasebookTitle: 'Your lines',
    phaseLabels: { prompt: 'Scene card', answer: 'Action!', reveal: 'Secrets revealed', encore: 'Shout it back', score: 'Bingo' },
  },

  setup(ctx, opts) {
    const random = () => ctx.random();
    const packIds = [...new Set((ctx.greenCar ? GREEN_CAR_SCENES : SCENES).map((x) => x.packId))] as string[];
    const packId = opts.packId && packIds.includes(opts.packId) ? opts.packId : packIds[Math.floor(random() * packIds.length)]!;
    // The pack's scenes first, then the rest; a Kids or Cheeky room plays its own scenes before the family ones.
    const order = (scenes: Scene[]) => [
      ...shuffled(
        scenes.filter((x) => x.packId === packId),
        random,
      ),
      ...shuffled(
        scenes.filter((x) => x.packId !== packId),
        random,
      ),
    ];
    const { own, fill } = scenesFor(ctx.audience ?? 'family', !!ctx.greenCar);
    const statsAll: Record<string, PlayerStats> = {};
    for (const p of ctx.players()) statsAll[p.id] = blankStats();
    return {
      packId,
      order: [...order(own), ...order(fill)].map((x) => x.id),
      round: 0,
      totalRounds: Math.max(1, Math.min(20, opts.rounds ?? TOTAL_SCENES)),
      scene: null,
      cast: [],
      cards: {},
      pool: {},
      buzzes: [],
      slips: [],
      sceneStart: ctx.now,
      resolved: false,
      highlight: null,
      echoes: {},
      scenePoints: {},
      bonusUsed: {},
      bonusCap: {},
      acted: {},
      lastCast: [],
      stats: statsAll,
      phaseAt: ctx.now,
      ...(ctx.greenCar ? { greenCar: true as const, saidFrames: {} } : {}),
    };
  },

  next(s, from) {
    switch (from) {
      case 'intro':
        return 'prompt';
      case 'prompt':
        return 'answer';
      case 'answer':
        return 'reveal';
      case 'reveal':
        return 'encore';
      case 'encore':
        return 'score';
      case 'score':
        return s.round < s.totalRounds ? 'prompt' : 'recap';
      default:
        return 'recap';
    }
  },

  enter(s, phase, ctx) {
    s.phaseAt = ctx.now;
    switch (phase) {
      case 'intro':
        ctx.cue({ host: 'pon', event: 'intro', context: 'Phrase Bingo Theater: improv scenes with secret phrases; the audience plays bingo.' });
        break;
      case 'prompt': {
        startScene(s, ctx);
        const set = s.scene!.setting;
        ctx.cue({ host: 'pon', event: 'prompt_read', prompt: { text: set.text, kana: set.kana, en: set.en } });
        break;
      }
      case 'answer':
        s.sceneStart = ctx.now;
        break;
      case 'reveal':
        resolveScene(s, ctx);
        break;
      case 'encore': {
        const p = s.highlight ? s.pool[s.highlight] : undefined;
        if (p) ctx.cue({ host: 'pon', event: 'kakegoe_call', prompt: { text: p.jp.text, kana: p.jp.kana, en: p.jp.en } });
        break;
      }
      case 'score': {
        const p = s.highlight ? s.pool[s.highlight] : undefined;
        if (p) for (const player of ctx.players()) if (!s.echoes[player.id]?.ok) ctx.phrase(player.id, { itemId: p.id, text: p.jp.text, kana: p.jp.kana, en: p.jp.en, outcome: 'seen' });
        const bingo = Object.entries(s.cards).find(([, c]) => c.line)?.[0];
        if (bingo) ctx.cue({ host: 'pon', event: 'reveal_react', tier: 'ippon', slots: { name: nameOf(ctx, bingo) }, waitMs: REACT_WAIT_MS });
        break;
      }
    }
  },

  leave(s, phase, ctx) {
    if (phase === 'answer') resolveScene(s, ctx);
  },

  duration(s, phase, ctx) {
    switch (phase) {
      case 'intro':
        return DURATIONS.intro;
      case 'prompt':
        return s.cast.some((a) => ctx.player(a.playerId)?.level === 'kana') ? DURATIONS.promptKana : DURATIONS.prompt;
      case 'answer':
        return DURATIONS.sceneBase + DURATIONS.scenePerActor * s.cast.length;
      case 'reveal':
        return DURATIONS.reveal;
      case 'encore':
        return DURATIONS.encore;
      case 'score':
        return DURATIONS.score;
      default:
        return 0;
    }
  },

  done(s, phase, ctx) {
    const here = ctx.connected();
    if (!here.length) return false;
    const actors = new Set(s.cast.map((a) => a.playerId));
    const hereActors = s.cast.filter((a) => ctx.player(a.playerId)?.connected);
    if (phase === 'prompt') return hereActors.length > 0 && hereActors.every((a) => a.ready);
    if (phase === 'answer') {
      const allSaid = hereActors.every((a) => a.secrets.every((x) => x.said || x.stretch));
      const audience = here.filter((p) => !actors.has(p.id) && s.cards[p.id]);
      const allBuzzed = audience.every((p) => s.buzzes.filter((b) => b.playerId === p.id).length >= BUZZES);
      return allSaid && allBuzzed;
    }
    if (phase === 'encore') return !!s.highlight && here.every((p) => s.echoes[p.id]?.ok || (s.echoes[p.id]?.tries ?? 0) >= ECHO_TRIES);
    return false;
  },

  move(s, phase, playerId, raw, ctx) {
    if (!isObject(raw)) return moveError('bad-move');
    if (raw.round !== undefined && raw.round !== s.round) return moveError('wrong-phase');
    const actor = actorOf(s, playerId);
    const player = ctx.player(playerId)!;
    switch (raw.kind) {
      case 'ready': {
        if (phase !== 'prompt') return moveError('wrong-phase');
        if (!actor) return moveError('not-eligible');
        actor.ready = true;
        return MOVE_OK;
      }
      case 'peek': {
        if (phase !== 'answer') return moveError('wrong-phase');
        if (!actor) return moveError('not-eligible');
        const secret = actor.secrets.find((x) => x.phraseId === raw.phraseId);
        if (!secret) return moveError('bad-move');
        if (!secret.said) secret.peeked = true;
        return MOVE_OK;
      }
      case 'say': {
        if (phase !== 'answer') return moveError('wrong-phase');
        if (!actor) return moveError('not-eligible');
        if (!isUtterance(raw.utterance)) return moveError('bad-utterance');
        const u = raw.utterance;
        const heard = cleanText(u.text, 120);
        if (!heard) return moveError('empty-answer');
        let best: { secret: Secret; score: number } | null = null;
        for (const secret of actor.secrets) {
          if (secret.said) continue;
          const p = s.pool[secret.phraseId]!;
          const score = phraseScore(u, p.jp.kana, p.accepted, player.level);
          if (score !== null && (!best || score < best.score)) best = { secret, score };
        }
        actor.last = { heard, matched: best?.secret.phraseId ?? null };
        if (best) {
          const p = s.pool[best.secret.phraseId]!;
          const frames = s.greenCar ? framesHeard(p.jp, { text: heard, kana: u.reading ?? heard }, u.tokens) : undefined;
          best.secret.said = { at: ctx.now, via: u.via, memory: !best.secret.peeked, heard, ...(frames ? { frames } : {}) };
          s.slips.push({ actorId: playerId, phraseId: best.secret.phraseId, at: ctx.now });
        }
        return MOVE_OK;
      }
      case 'buzz': {
        if (phase !== 'answer') return moveError('wrong-phase');
        const card = s.cards[playerId];
        if (actor || !card) return moveError('not-eligible');
        if (typeof raw.phraseId !== 'string' || !card.cells.includes(raw.phraseId)) return moveError('bad-cell');
        if (typeof raw.actorId !== 'string' || !actorOf(s, raw.actorId)) return moveError('bad-actor');
        const mine = s.buzzes.filter((b) => b.playerId === playerId);
        if (mine.some((b) => b.phraseId === raw.phraseId)) return moveError('already-guessed');
        if (mine.length >= BUZZES) return moveError('no-tries-left');
        s.buzzes.push({ playerId, phraseId: raw.phraseId, actorId: raw.actorId, at: ctx.now, result: null });
        return MOVE_OK;
      }
      case 'echo': {
        if (phase !== 'encore') return moveError('wrong-phase');
        const p = s.highlight ? s.pool[s.highlight] : undefined;
        if (!p) return moveError('wrong-phase');
        if (!isUtterance(raw.utterance)) return moveError('bad-utterance');
        const heard = cleanText(raw.utterance.text, 120);
        if (!heard) return moveError('empty-answer');
        const echo = (s.echoes[playerId] ??= { tries: 0, ok: false, heard: '' });
        if (echo.ok) return MOVE_OK;
        if (echo.tries >= ECHO_TRIES) return moveError('no-tries-left');
        echo.tries += 1;
        echo.heard = heard;
        if (!saidPhrase(raw.utterance, p.jp.kana, p.accepted, player.level)) return MOVE_OK;
        echo.ok = true;
        const spoken = raw.utterance.via === 'speech';
        stats(s, playerId).echoes += 1;
        payBonus(s, ctx, playerId, ECHO_BONUS[spoken ? 'speech' : 'typed'] * multiplierFor(s), meanScore(ctx));
        // An echo repeats the line just heard: said, but not from memory.
        ctx.phrase(playerId, { itemId: p.id, text: p.jp.text, kana: p.jp.kana, en: p.jp.en, outcome: spoken ? 'said' : 'seen', recall: 'read' });
        return MOVE_OK;
      }
      default:
        return moveError('bad-move');
    }
  },

  release(s, playerId) {
    delete s.cards[playerId];
    delete s.echoes[playerId];
    s.buzzes = s.buzzes.filter((b) => b.playerId !== playerId || b.result !== null);
  },

  progress(s) {
    return { round: s.round, totalRounds: s.totalRounds };
  },

  view(s, phase, viewer: Viewer, ctx) {
    const over = s.resolved;
    const studying = phase === 'prompt';
    const me = viewer.kind === 'player' ? ctx.player(viewer.playerId) : undefined;
    const romaji = me?.level === 'kana';

    const cast: ActorView[] = s.cast.map((a) => ({
      playerId: a.playerId,
      role: a.role,
      ready: a.ready,
      said: a.secrets.filter((x) => x.said).length,
      total: a.secrets.length,
      phrases: over
        ? a.secrets.map((x) => ({
            ...phraseCard(s.pool[x.phraseId]!, romaji),
            said: !!x.said,
            smooth: !!x.said && !x.caughtBy.length,
            memory: !!x.said?.memory,
            caughtBy: [...x.caughtBy],
            atSec: x.said ? secSince(s, x.said.at) : null,
          }))
        : null,
    }));
    const castIds = new Set(s.cast.map((a) => a.playerId));

    const ticker: TickerItem[] =
      phase === 'answer' || over
        ? [
            ...s.slips.map((x): TickerItem => {
              const p = s.pool[x.phraseId]!;
              return { kind: 'slip', playerId: x.actorId, atSec: secSince(s, x.at), ...(over ? { phrase: tickerPhrase(p) } : {}) };
            }),
            ...s.buzzes.map((b): TickerItem => ({
              kind: 'buzz',
              playerId: b.playerId,
              atSec: secSince(s, b.at),
              ...(over ? { buzz: { actorId: b.actorId, ok: b.result === 'caught', phrase: s.pool[b.phraseId] ? tickerPhrase(s.pool[b.phraseId]!) : null } } : {}),
            })),
          ].sort((a, b) => a.atSec - b.atSec || (a.kind === b.kind ? 0 : a.kind === 'slip' ? -1 : 1))
        : [];

    const highlight = (phase === 'encore' || phase === 'score') && s.highlight ? phraseCard(s.pool[s.highlight]!, romaji) : null;
    const scenePoints = over ? ctx.players().map((p) => ({ playerId: p.id, points: s.scenePoints[p.id] ?? 0 })) : null;

    let mine: PhraseBingoView['me'] = null;
    if (me) {
      const actor = actorOf(s, me.id);
      const card = s.cards[me.id];
      const daubed = new Set(over ? s.slips.map((x) => x.phraseId) : []);
      const myBuzzes = s.buzzes.filter((b) => b.playerId === me.id);
      const echo = s.echoes[me.id];
      mine = {
        level: me.level,
        part: actor ? 'actor' : 'audience',
        actor: actor
          ? {
              role: actor.role,
              ready: actor.ready,
              last: phase === 'answer' ? actor.last : null,
              secrets: actor.secrets.map((x): SecretView => {
                const p = s.pool[x.phraseId]!;
                const show = studying || over || x.peeked || !!x.said;
                return {
                  id: x.phraseId,
                  en: p.jp.en,
                  hint: hintFor(p, romaji),
                  said: !!x.said,
                  peeked: x.peeked,
                  jp: show ? phraseCard(p, romaji) : null,
                  ...(over ? { smooth: !!x.said && !x.caughtBy.length, caughtBy: [...x.caughtBy] } : {}),
                  ...(x.stretch ? { stretch: true as const } : {}),
                };
              }),
            }
          : null,
        card: card
          ? {
              cells: card.cells.map((id): CellView => {
                const b = myBuzzes.find((x) => x.phraseId === id);
                return { ...(s.greenCar ? frameCell : phraseCard)(s.pool[id]!, romaji), daubed: daubed.has(id), buzz: b ? { actorId: b.actorId, result: over ? b.result : null } : null };
              }),
              buzzesLeft: Math.max(0, BUZZES - myBuzzes.length),
              line: phase === 'score' ? card.line : null,
            }
          : null,
        echo:
          phase === 'encore' && s.highlight
            ? { canEcho: !echo?.ok && (echo?.tries ?? 0) < ECHO_TRIES, ok: !!echo?.ok, triesLeft: ECHO_TRIES - (echo?.tries ?? 0), heard: echo?.heard ?? '' }
            : null,
        points: over ? (s.scenePoints[me.id] ?? 0) : null,
      };
    }

    return {
      mode: 'phrase-bingo',
      round: s.round,
      totalRounds: s.totalRounds,
      multiplier: multiplierFor(s),
      phaseAt: s.phaseAt,
      scene: s.scene && phase !== 'intro' ? { id: s.scene.id, emoji: s.scene.emoji, setting: s.scene.setting, twist: s.scene.twist } : null,
      cast,
      audience: ctx
        .players()
        .filter((p) => !castIds.has(p.id))
        .map((p) => p.id),
      ticker,
      bingos: phase === 'score' ? Object.entries(s.cards).filter(([, c]) => c.line).map(([id]) => id) : [],
      highlight,
      echoed: phase === 'encore' || phase === 'score' ? Object.entries(s.echoes).filter(([, e]) => e.ok).map(([id]) => id) : [],
      scenePoints,
      me: mine,
    };
  },

  awards(s, ctx) {
    const out: Award[] = [];
    const players = ctx.players();
    const best = (key: keyof PlayerStats): ModePlayer | undefined => {
      let top: ModePlayer | undefined;
      for (const p of players) if ((s.stats[p.id]?.[key] ?? 0) > (top ? (s.stats[top.id]?.[key] ?? 0) : 0)) top = p;
      return top;
    };
    const add = (p: ModePlayer | undefined, title: string, en: string) => p && out.push({ playerId: p.id, name: p.name, title, en });
    add(best('slipped'), 'だいめいゆう', 'Star Actor: most secret phrases slipped in');
    add(best('smooth'), 'さりげない賞', 'Smooth Operator: most phrases nobody caught');
    add(best('catches'), 'じごくみみ', 'Sharp Ears: most phrases caught');
    add(best('bingos'), 'ビンゴ キング', 'Bingo King: most bingo lines');
    return out;
  },
};
