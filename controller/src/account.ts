// Optional sign-in on the phone (docs/accounts.md). A passkey keeps a player's yōkai cards and the
// scores of the games they finish; nobody needs one to join a room. The join screen shows the panel
// under Join; My progress and the card review are their own screens.

import { browserSupportsWebAuthn, sendSignal, startAuthentication, startRegistration, WebAuthnError } from '@simplewebauthn/browser';
import { h, mount } from '../../shared/src/dom.js';
import { MAX_NAME_LENGTH } from '../../shared/src/constants.js';
import { toRomaji } from '../../shared/src/japanese/romaji.js';
import { MODES } from '../../shared/src/modes/registry.js';
import { CATCH_DAYS, type AccountView, type Card, type PhraseCard } from '../../shared/src/progress.js';
import { hearButton } from './components/voice.js';
import { pathTab, setPathView } from './path.js';
import type { Level } from '../../shared/src/protocol.js';

/** What this phone keeps after signing in. The token is the only key to the account. */
interface SavedAccount {
  token: string;
  name: string;
}

const KEY = 'kotoba:account';
const base = location.origin;
const tz = (): number => new Date().getTimezoneOffset();

export function savedAccount(): SavedAccount | null {
  try {
    const a = JSON.parse(localStorage.getItem(KEY) ?? 'null') as SavedAccount | null;
    return a && typeof a.token === 'string' && typeof a.name === 'string' ? a : null;
  } catch {
    return null;
  }
}

function saveAccount(a: SavedAccount | null): void {
  try {
    if (a) localStorage.setItem(KEY, JSON.stringify(a));
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode: signed in until the page closes */
  }
  memory = a;
}
// For browsers that refuse storage: the sign-in still lasts while the page is open.
let memory: SavedAccount | null = null;
export const account = (): SavedAccount | null => savedAccount() ?? memory;

/** Passkeys need a secure page (https, or localhost) and a browser that has them. */
const passkeysWork = (): boolean => window.isSecureContext && browserSupportsWebAuthn();

async function api<T>(path: string, body?: unknown): Promise<{ status: number; data: T & { error?: string } }> {
  const a = account();
  const res = await fetch(`${base}/api/account/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', ...(a ? { authorization: `Bearer ${a.token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({ error: 'network' }))) as T & { error?: string };
  return { status: res.status, data };
}

// ---- the join screen's panel ----

/**
 * Under Join: two quiet chips side by side, the save (a way in when signed out, who is saving when
 * signed in) and `host` when there is one, with one status line under them for notices and "Not Aki?".
 * `screens` opens the full-screen pages; `nameInput` lends its name to a new save.
 */
export function accountPanel(nameInput: HTMLInputElement, screens: { back: () => void; app: HTMLElement }, host: HTMLElement | null = null): HTMLElement {
  const a = account();
  const said = notice;
  notice = '';
  const status = h('p', { class: `acct-status-line${a ? '' : ' bad'}`, role: 'status' }, said);
  let chip: HTMLElement;
  if (!a) {
    chip = h(
      'button',
      { type: 'button', class: 'join-chip', 'aria-label': 'Sign in to save your progress (optional)', onclick: () => showSignIn(screens, nameInput.value) },
      h('span', { class: 'acct-key', 'aria-hidden': 'true' }),
      h('span', { class: 'join-chip-text' }, 'Sign in to save'),
    );
  } else {
    chip = h(
      'button',
      { type: 'button', class: `join-chip in${said ? ' just' : ''}`, 'aria-label': `Saving as ${a.name}. Open my progress`, onclick: () => void showProgress(screens) },
      h('span', { class: 'join-chip-dot', 'aria-hidden': 'true' }),
      h('span', { class: 'join-chip-text' }, h('span', { class: 'join-chip-name' }, a.name), ' · Progress'),
    );
    // A phone passed around the party: someone else joining on it can step out of the save first.
    const other = h('button', { type: 'button', class: 'acct-link acct-notme', onclick: () => void signOut(screens.back) }, `Not ${a.name}? Sign out`);
    const sync = () => (other.hidden = !nameInput.value.trim() || nameInput.value.trim().toLowerCase() === a.name.toLowerCase());
    nameInput.addEventListener('input', sync);
    sync();
    status.append(other);
  }
  return h('section', { class: `join-extras${host ? '' : ' solo'}`, 'aria-label': 'More' }, h('div', { class: 'join-chips' }, chip, host), status);
}

/** A line for the join screen's panel the next time it shows (signed in, or signed out by the server). */
let notice = '';

async function signOut(back: () => void): Promise<void> {
  await api('signout', {}).catch(() => null);
  saveAccount(null);
  back();
}

// ---- sign in ----

function backBar(onBack: () => void, label = 'Back'): HTMLElement {
  return h('button', { type: 'button', class: 'acct-back', onclick: onBack }, h('span', { 'aria-hidden': 'true' }, '‹ '), label);
}

function focusHeading(root: HTMLElement): void {
  const head = root.querySelector('h2');
  if (head) {
    head.setAttribute('tabindex', '-1');
    head.focus();
  }
}

function showSignIn(screens: { back: () => void; app: HTMLElement }, suggestedName: string): void {
  const ok = passkeysWork();
  const status = h('p', { class: 'acct-status', role: 'status', 'aria-live': 'polite' });
  const nameInput = h('input', { id: 'acct-name', autocomplete: 'nickname', maxlength: MAX_NAME_LENGTH, placeholder: 'Your name', value: suggestedName.trim(), enterkeyhint: 'go' }) as HTMLInputElement;
  // New players are the common case, so creating comes first; a phone with a passkey offers it either way.
  const create = h('button', { type: 'submit', class: 'primary', disabled: !ok }, 'Create a passkey') as HTMLButtonElement;
  const signIn = h('button', { type: 'button', class: 'secondary acct-wide', disabled: !ok }, 'Sign in with my passkey') as HTMLButtonElement;
  const labels = new Map([[create, create.textContent!], [signIn, signIn.textContent!]]);
  const busy = (on: boolean, text = '', which?: HTMLButtonElement) => {
    signIn.disabled = create.disabled = on || !ok;
    for (const [b, label] of labels) b.textContent = on && b === which ? 'Check your phone…' : label;
    status.className = 'acct-status';
    status.textContent = text;
  };
  const fail = (text: string) => {
    busy(false);
    status.className = 'acct-status bad';
    status.textContent = text;
  };
  const done = (token: string, view: AccountView) => {
    saveAccount({ token, name: view.name });
    notice = `✓ Signed in as ${view.name}. Now join a room.`;
    screens.back();
  };

  signIn.onclick = async () => {
    busy(true, 'Your phone will ask for your face, fingerprint or PIN.', signIn);
    try {
      const { data } = await api<{ options: Parameters<typeof startAuthentication>[0]['optionsJSON'] }>('login/options', {});
      if (!data.options) return fail('Could not reach the server. Try again.');
      const response = await startAuthentication({ optionsJSON: data.options });
      const res = await api<{ token: string; account: AccountView }>('login/verify', { response, tz: tz() });
      if (res.status === 404) {
        // Its save was deleted: tell the phone to stop offering it.
        void sendSignal({ signalName: 'unknownCredential', rpID: location.hostname, credentialID: response.id }).catch(() => {});
        return fail('That passkey’s save was deleted. Create a new one above.');
      }
      if (!res.data.token) return fail('That didn’t work. Try again.');
      done(res.data.token, res.data.account);
    } catch (err) {
      fail(passkeyError(err, 'No passkey found? Create one above.'));
    }
  };

  const form = h(
    'form',
    {
      class: 'acct-new',
      onsubmit: async (e: Event) => {
        e.preventDefault();
        const name = nameInput.value.trim();
        if (!name) {
          nameInput.focus();
          return fail('Type a name for your save first.');
        }
        busy(true, 'Your phone will ask for your face, fingerprint or PIN.', create);
        try {
          const { data } = await api<{ options: Parameters<typeof startRegistration>[0]['optionsJSON'] }>('register/options', { name });
          if (!data.options) return fail(data.error === 'bad-name' ? `Pick a name of 1 to ${MAX_NAME_LENGTH} characters.` : 'Could not reach the server. Try again.');
          const response = await startRegistration({ optionsJSON: data.options });
          const res = await api<{ token: string; account: AccountView }>('register/verify', { response, tz: tz() });
          if (!res.data.token) return fail('That didn’t work. Try again.');
          done(res.data.token, res.data.account);
        } catch (err) {
          fail(passkeyError(err, 'Cancelled. Nothing was saved.'));
        }
      },
    },
    h('label', { for: 'acct-name' }, 'Name for your save', nameInput),
    create,
    h('p', { class: 'acct-note' }, 'Your phone will ask for your face, fingerprint or PIN. That’s the passkey.'),
  );

  const page = h(
    'div',
    { class: 'acct-page' },
    backBar(screens.back),
    h('h2', {}, 'Save your progress'),
    h('p', { class: 'acct-lede' }, 'Keep your yōkai cards and scores, and pick them up on any phone. You can always play without signing in.'),
    ok ? null : h('p', { class: 'acct-status bad' }, window.isSecureContext ? 'This browser can’t use passkeys. Try a newer browser.' : 'Sign-in needs the game’s https address. Playing works without it.'),
    h('div', { class: 'acct-block' }, h('h3', {}, 'New here?'), form),
    h('div', { class: 'acct-block' }, h('h3', {}, 'Saved before, on this or another phone?'), signIn),
    status,
    h(
      'p',
      { class: 'acct-fine' },
      'A passkey uses your phone’s lock (face, fingerprint or PIN): no email, no password. We keep your save name, your scores and which kana you’ve practised. Nothing else, and you can delete it any time.',
    ),
  );
  mount(screens.app, page);
  focusHeading(page);
}

/** Words for a passkey that didn't happen. Cancelling is normal, so it reads calm. */
function passkeyError(err: unknown, cancelled: string): string {
  if (err instanceof WebAuthnError) {
    if (err.code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED') return 'This phone already has a passkey here. Use Sign in instead.';
    if (err.code === 'ERROR_INVALID_DOMAIN' || err.code === 'ERROR_INVALID_RP_ID') return 'Sign-in needs the game’s https address.';
  }
  if (err instanceof Error && (err.name === 'NotAllowedError' || err.name === 'AbortError')) return cancelled;
  return 'Something went wrong. Try again.';
}

// ---- my progress ----

type Tab = 'path' | 'cards' | 'phrases' | 'scores';
let tab: Tab | null = null;

/** The level this phone last picked in a lobby (main.ts keeps it), for the path's steps. */
function phoneLevel(): Level {
  try {
    const l = JSON.parse(localStorage.getItem('kotoba:level') ?? 'null') as unknown;
    return l === 'kana' || l === 'n5' || l === 'n4' ? l : 'n5';
  } catch {
    return 'n5';
  }
}

/** The save, for the lobby's path card: null when signed out or the sign-in ran out. */
export async function fetchMe(): Promise<AccountView | null> {
  if (!account()) return null;
  const res = await api<{ account: AccountView }>(`me?tz=${tz()}`);
  if (res.status !== 200) return null;
  return res.data.account;
}

async function showProgress(screens: { back: () => void; app: HTMLElement }): Promise<void> {
  mount(screens.app, h('div', { class: 'acct-page' }, backBar(screens.back), h('p', { class: 'center', role: 'status' }, 'Loading your progress…')));
  let res;
  try {
    res = await api<{ account: AccountView }>(`me?tz=${tz()}`);
  } catch {
    mount(
      screens.app,
      h('div', { class: 'acct-page' }, backBar(screens.back), h('p', { class: 'acct-status bad' }, 'Could not reach the server.'), h('button', { type: 'button', class: 'secondary acct-wide', onclick: () => void showProgress(screens) }, 'Try again')),
    );
    return;
  }
  if (res.status === 401) {
    // The save was deleted on another phone, or the sign-in ran out.
    saveAccount(null);
    notice = 'You were signed out on this phone. Sign in again to keep saving.';
    screens.back();
    return;
  }
  renderProgress(screens, res.data.account);
}

/** The Path tab's switch: saved on the account, so it follows the player to any phone. */
let switching = false;
async function setPath(screens: { back: () => void; app: HTMLElement }, view: AccountView, on: boolean): Promise<void> {
  switching = true;
  renderProgress(screens, view);
  try {
    const res = await api<{ account: AccountView }>('settings', { path: on });
    switching = false;
    renderProgress(screens, res.status === 200 ? res.data.account : view);
  } catch {
    switching = false;
    renderProgress(screens, view);
  }
}

function renderProgress(screens: { back: () => void; app: HTMLElement }, view: AccountView): void {
  const a = account();
  if (view.name !== a?.name && a) saveAccount({ ...a, name: view.name });
  setPathView(view);
  // Opens on the path when it's on, else on the yōkai cards as before.
  const current: Tab = (tab ??= view.path ? 'path' : 'cards');
  const tabButton = (id: Tab, label: string) =>
    h('button', { type: 'button', role: 'tab', id: `acct-tab-${id}`, 'aria-selected': current === id ? 'true' : 'false', 'aria-controls': 'acct-tabpanel', tabindex: current === id ? '0' : '-1', class: 'acct-tab', onclick: () => ((tab = id), renderProgress(screens, view)) }, label);
  // Tabs pattern: arrow keys move between them.
  const onKey = (e: KeyboardEvent) => {
    const order: Tab[] = ['path', 'cards', 'phrases', 'scores'];
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    tab = order[(order.indexOf(current) + step + order.length) % order.length]!;
    renderProgress(screens, view);
  };
  const page = h(
    'div',
    { class: 'acct-page' },
    backBar(screens.back),
    h('h2', {}, `${view.name}’s progress`),
    h('div', { class: 'acct-tabs', role: 'tablist', onkeydown: onKey as EventListener }, tabButton('path', 'Path'), tabButton('cards', 'Yōkai cards'), tabButton('phrases', 'Phrasebook'), tabButton('scores', 'Scores')),
    h(
      'div',
      { id: 'acct-tabpanel', role: 'tabpanel', 'aria-labelledby': `acct-tab-${current}` },
      current === 'path' ? pathTab(view, phoneLevel(), (on) => void setPath(screens, view, on), switching) : current === 'cards' ? cardsTab(screens, view) : current === 'phrases' ? phrasesTab(screens, view) : scoresTab(view),
    ),
    accountFooter(screens),
  );
  mount(screens.app, page);
  page.querySelector<HTMLElement>(`#acct-tab-${current}`)?.focus();
}

function cardsTab(screens: { back: () => void; app: HTMLElement }, view: AccountView): HTMLElement {
  if (!view.cards.length)
    return h('div', { class: 'acct-empty' }, h('p', {}, 'No yōkai yet.'), h('p', { class: 'acct-note' }, 'Play Kana Yōkai Raid while signed in: every kana you meet becomes a card here.'));
  const caught = view.cards.filter((c) => c.caughtAt !== null);
  const sorted = [...view.cards].sort((x, y) => (y.caughtAt !== null ? 1 : 0) - (x.caughtAt !== null ? 1 : 0) || y.days.length - x.days.length || x.char.localeCompare(y.char, 'ja'));
  return h(
    'div',
    { class: 'acct-cards' },
    view.due.length
      ? h(
          'div',
          { class: 'acct-review' },
          h('p', {}, h('strong', {}, `${view.due.length} yōkai to review`), h('small', {}, 'About 3 minutes. Typed answers count towards catching.')),
          h('button', { type: 'button', class: 'primary', onclick: () => review(screens, view.due) }, 'Review now'),
        )
      : h('p', { class: 'acct-review done' }, 'All caught up. More cards come due tomorrow.'),
    h('p', { class: 'acct-tally' }, h('strong', {}, `${caught.length} caught`), ` · ${view.cards.length} met`),
    h('p', { class: 'acct-note' }, `A yōkai is caught when you get it right from memory on ${CATCH_DAYS} different days.`),
    h('ul', { class: 'acct-book' }, sorted.map((c) => bookCard(c))),
  );
}

/** The yōkai book's cast: the Raid's four, and ten more drawn for the book (stage/assets/yokai/book/). */
const SPRITES = [
  'yokai-blob',
  'yokai-lantern',
  'yokai-umbrella',
  'yokai-scroll',
  ...['daruma', 'dobin', 'hitodama', 'kappa', 'kitsunebi', 'kodama', 'nekomata', 'tsurube', 'bakezori', 'toro'].map((n) => `book/yokai-${n}`),
];
/** Each kana keeps the same yōkai (stable by id). */
function spriteFor(id: string): string {
  let n = 0;
  for (const ch of id) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  return SPRITES[n % SPRITES.length]!;
}

function bookCard(c: Card): HTMLElement {
  const isCaught = c.caughtAt !== null;
  const romaji = toRomaji(c.hear);
  const days = Math.min(c.days.length, CATCH_DAYS);
  return h(
    'li',
    { class: `acct-card${isCaught ? ' caught' : days ? ' near' : ''}`, 'aria-label': `${c.char} (${script(c)}), ${romaji}: ${isCaught ? 'caught' : `${days} of ${CATCH_DAYS} days`}` },
    spriteWindow(c.itemId),
    h('span', { class: 'acct-kana', lang: 'ja' }, c.char),
    h('span', { class: 'acct-romaji' }, romaji, h('small', { lang: 'ja' }, script(c) === 'katakana' ? ' カタカナ' : script(c) === 'hiragana' ? ' ひらがな' : '')),
    isCaught
      ? h('span', { class: 'acct-caught-tag' }, 'Caught')
      : h('span', { class: 'acct-pips', 'aria-hidden': 'true' }, Array.from({ length: CATCH_DAYS }, (_, i) => h('i', { class: i < days ? 'on' : '' }))),
    isCaught ? hanko() : null,
  );
}

/** Kana Raid's kana ids start h- (hiragana) or k- (katakana): あ and ア both read "a". */
const script = (c: Pick<Card, 'itemId'>): string => (c.itemId.startsWith('h-') ? 'hiragana' : c.itemId.startsWith('k-') ? 'katakana' : 'kana');

/** The 封印 seal a caught yōkai gets, like an ofuda sealing it into the book. */
const hanko = (cls = ''): HTMLElement => h('span', { class: `acct-stamp ${cls}`, lang: 'ja', 'aria-hidden': 'true' }, h('span', {}, '封'), h('span', {}, '印'));

/** The yōkai in a little dark window, so the pale sprites read on the paper card. */
function spriteWindow(itemId: string, size: 'small' | 'big' = 'small'): HTMLElement {
  const sprite = spriteFor(itemId);
  return h(
    'span',
    { class: `acct-window ${size}`, 'aria-hidden': 'true' },
    h('img', { class: `acct-sprite s-${sprite.replace('book/', '')}`, src: `/stage/assets/yokai/${sprite}.png`, alt: '', width: 128, height: 128, loading: 'lazy', onerror: (e: Event) => (e.target as HTMLElement).remove() }),
  );
}

const dateFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const ORDINAL = ['', '1st', '2nd', '3rd'];

const OUTCOME: Record<PhraseCard['last'], string> = { said: 'Said it', retry: 'Second try', missed: 'Missed', seen: 'Seen' };

function phrasesTab(screens: { back: () => void; app: HTMLElement }, view: AccountView): HTMLElement {
  const phrases = view.phrases ?? [];
  if (!phrases.length)
    return h('div', { class: 'acct-empty' }, h('p', {}, 'No phrases yet.'), h('p', { class: 'acct-note' }, 'Every game you finish signed in adds what you said, retried and missed.'));
  const due = view.duePhrases ?? [];
  return h(
    'div',
    { class: 'acct-cards' },
    due.length
      ? h(
          'div',
          { class: 'acct-review' },
          h('p', {}, h('strong', {}, `${due.length} ${due.length === 1 ? 'phrase' : 'phrases'} to practise`), h('small', {}, 'See the English, say it out loud in Japanese, then check.')),
          h('button', { type: 'button', class: 'primary', onclick: () => practise(screens, due) }, 'Practise now'),
        )
      : h('p', { class: 'acct-review done' }, 'All caught up. More phrases come due tomorrow.'),
    h('p', { class: 'acct-tally' }, h('strong', {}, `${phrases.filter((p) => p.box >= 2).length} sticking`), ` · ${phrases.length} saved`),
    h(
      'ul',
      { class: 'acct-phrases' },
      phrases.map((p) =>
        h(
          'li',
          { class: `acct-phrase pb-${p.last}` },
          h('span', { class: 'acct-ph-jp', lang: 'ja' }, p.text),
          p.kana !== p.text ? h('span', { class: 'acct-ph-kana', lang: 'ja' }, p.kana) : null,
          h('span', { class: 'acct-ph-romaji' }, toRomaji(p.kana)),
          p.en ? h('span', { class: 'acct-ph-en' }, p.en) : null,
          h('span', { class: 'acct-ph-meta' }, `${OUTCOME[p.last]} · ${MODES[p.mode]?.info.title ?? p.mode}`),
        ),
      ),
    ),
  );
}

function scoresTab(view: AccountView): HTMLElement {
  if (!view.games.length) return h('div', { class: 'acct-empty' }, h('p', {}, 'No games yet.'), h('p', { class: 'acct-note' }, 'Join a game while signed in and your scores land here.'));
  return h(
    'div',
    { class: 'acct-scores' },
    h('h3', {}, 'Best by game'),
    h(
      'ul',
      { class: 'acct-bests' },
      view.bests.map((b) =>
        h(
          'li',
          {},
          h('span', { class: 'acct-mode' }, MODES[b.mode]?.info.title ?? b.mode),
          h('span', { class: 'acct-best' }, `${b.best}`),
          h('small', {}, `${b.played} ${b.played === 1 ? 'game' : 'games'}${b.wins ? ` · ${b.wins} ${b.wins === 1 ? 'win' : 'wins'}` : ''}`),
        ),
      ),
    ),
    h('h3', {}, 'Recent games'),
    h(
      'ol',
      { class: 'acct-games' },
      view.games.map((g) =>
        h(
          'li',
          {},
          h('span', { class: 'acct-when' }, dateFmt.format(g.at)),
          h('span', { class: 'acct-mode' }, MODES[g.mode]?.info.title ?? g.mode, g.awards.map((aw) => h('small', { class: 'acct-award' }, h('span', { class: 'acct-trophy', 'aria-hidden': 'true' }), h('span', { lang: 'ja' }, aw.title), ` · ${aw.en}`))),
          h('span', { class: 'acct-place' }, g.coop ? 'team' : g.place ? `${ORDINAL[g.place] ?? `${g.place}th`} of ${g.players}` : '–'),
          h('span', { class: 'acct-best' }, `${g.score}`),
        ),
      ),
    ),
  );
}

function accountFooter(screens: { back: () => void; app: HTMLElement }): HTMLElement {
  const confirm = h('div', { class: 'acct-confirm', hidden: true, role: 'alertdialog', 'aria-labelledby': 'acct-del-q' });
  const status = h('p', { class: 'acct-status bad', role: 'status', 'aria-live': 'polite' });
  const del = async () => {
    try {
      const res = await api<{ ok: boolean; credentials?: string[] }>('delete', {});
      if (!res.data.ok) throw new Error('not deleted');
      // The passkeys stay on the phone; ask it to forget them where it can.
      for (const id of res.data.credentials ?? []) void sendSignal({ signalName: 'unknownCredential', rpID: location.hostname, credentialID: id }).catch(() => {});
      saveAccount(null);
      screens.back();
    } catch {
      status.textContent = 'Could not delete it. Try again.';
    }
  };
  mount(
    confirm,
    h('p', { id: 'acct-del-q' }, h('strong', {}, 'Delete your saved progress?'), ' Your yōkai cards and scores go for good. This can’t be undone.'),
    // Keeping is the safe, filled default; deleting is the outlined one.
    h('div', { class: 'acct-row' }, h('button', { type: 'button', class: 'secondary acct-danger', onclick: () => void del() }, 'Delete everything'), h('button', { type: 'button', class: 'primary acct-keep', onclick: () => ((confirm.hidden = true), ask.focus()) }, 'Keep it')),
  );
  const ask = h(
    'button',
    {
      type: 'button',
      class: 'acct-link danger',
      onclick: () => {
        confirm.hidden = false;
        confirm.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        confirm.querySelector<HTMLElement>('.acct-keep')?.focus();
      },
    },
    'Delete my saved progress',
  );
  return h(
    'footer',
    { class: 'acct-footer' },
    h(
      'button',
      {
        type: 'button',
        class: 'acct-link',
        onclick: () => void signOut(screens.back),
      },
      'Sign out on this phone',
    ),
    ask,
    confirm,
    status,
  );
}

// ---- phrase practice ----

/** Due phrases: the English first; the player says it, checks, and marks it themselves. */
function practise(screens: { back: () => void; app: HTMLElement }, phrases: PhraseCard[]): void {
  let i = 0;
  let knew = 0;
  const toProgress = () => void showProgress(screens);
  const ask = () => {
    const p = phrases[i]!;
    const answer = h('div', { class: 'acct-reveal', hidden: true, role: 'status', 'aria-live': 'polite' });
    const marks = h('div', { class: 'acct-row', hidden: true });
    const status = h('p', { class: 'acct-status bad', role: 'status' });
    const show = h('button', { type: 'button', class: 'primary' }, 'Show the Japanese') as HTMLButtonElement;
    const mark = async (yes: boolean) => {
      for (const b of marks.querySelectorAll('button')) (b as HTMLButtonElement).disabled = true;
      const res = await api('review', { kind: 'phrase', itemId: p.itemId, knew: yes }).catch(() => null);
      if (!res || res.status !== 200) {
        for (const b of marks.querySelectorAll('button')) (b as HTMLButtonElement).disabled = false;
        status.textContent = 'Could not save that. Try again.';
        return;
      }
      if (yes) knew += 1;
      if (i === phrases.length - 1) finish();
      else {
        i += 1;
        ask();
      }
    };
    mount(
      answer,
      h('p', { class: 'acct-ph-jp big', lang: 'ja' }, p.text),
      p.kana !== p.text ? h('p', { class: 'acct-ph-kana', lang: 'ja' }, p.kana) : null,
      h('p', { class: 'acct-ph-romaji' }, toRomaji(p.kana)),
      hearButton(p.kana, 'Hear it', 'raid-hear acct-hear'),
    );
    mount(marks, h('button', { type: 'button', class: 'secondary acct-wide', onclick: () => void mark(false) }, 'Not yet'), h('button', { type: 'button', class: 'primary', onclick: () => void mark(true) }, 'I said it'));
    show.onclick = () => {
      answer.hidden = false;
      marks.hidden = false;
      show.remove();
      marks.querySelector<HTMLElement>('.primary')?.focus();
    };
    const page = h(
      'div',
      { class: 'acct-page' },
      backBar(toProgress, 'Stop'),
      h('h2', { class: 'acct-count' }, `Phrase ${i + 1} of ${phrases.length}`),
      h('div', { class: 'acct-face acct-ph-face' }, h('p', { class: 'acct-ph-prompt' }, p.en || p.kana), h('small', {}, `From ${MODES[p.mode]?.info.title ?? p.mode} · say it out loud`)),
      answer,
      show,
      marks,
      status,
    );
    mount(screens.app, page);
    show.focus();
  };
  const finish = () => {
    const page = h(
      'div',
      { class: 'acct-page acct-done' },
      h('h2', {}, 'Practice done!'),
      h('p', { class: 'big' }, `${knew} of ${phrases.length} said`),
      h('p', { class: 'acct-note' }, 'The ones you said wait longer before they come back; the rest return tomorrow.'),
      h('button', { type: 'button', class: 'primary', onclick: toProgress }, 'Back to my progress'),
    );
    mount(screens.app, page);
    focusHeading(page);
  };
  ask();
}

// ---- review ----

/** One sitting of due cards: type each one's sound from memory. */
function review(screens: { back: () => void; app: HTMLElement }, cards: Card[]): void {
  let i = 0;
  let right = 0;
  const caught: string[] = [];
  const toProgress = () => void showProgress(screens);

  const ask = () => {
    const card = cards[i]!;
    const face = h('div', { class: 'acct-face', lang: 'ja' }, spriteWindow(card.itemId, 'big'), h('span', { class: 'acct-kana' }, card.char));
    const input = h('input', { id: 'acct-answer', inputmode: 'latin', autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false', enterkeyhint: 'done', placeholder: 'e.g. ka' }) as HTMLInputElement;
    const check = h('button', { type: 'submit', class: 'primary' }, 'Check') as HTMLButtonElement;
    const feedback = h('div', { class: 'acct-feedback', role: 'status', 'aria-live': 'polite' });
    const skip = h('button', { type: 'button', class: 'secondary acct-wide' }, 'I don’t know') as HTMLButtonElement;
    let answered = false;
    const answer = async (typed: string) => {
      if (answered) return;
      answered = true;
      check.disabled = skip.disabled = input.disabled = true;
      let res;
      try {
        res = await api<{ right: boolean; expected: string; caught: boolean }>('review', { itemId: card.itemId, answer: typed });
      } catch {
        res = null;
      }
      if (!res || res.status !== 200) {
        answered = false;
        check.disabled = skip.disabled = input.disabled = false;
        feedback.className = 'acct-feedback bad';
        feedback.textContent = 'Could not save that answer. Try again.';
        return;
      }
      if (res.data.right) right += 1;
      if (res.data.caught) caught.push(card.char);
      // The card reacts: the yōkai hops when you're right and drifts off when you're not; a catch
      // stamps 封印 on it with a buzz.
      face.classList.add(res.data.right ? 'is-right' : 'is-wrong');
      face.append(h('span', { class: 'acct-face-romaji' }, res.data.expected));
      if (res.data.caught) {
        face.append(hanko('big'));
        navigator.vibrate?.(60);
      }
      const last = i === cards.length - 1;
      const next = h('button', { type: 'button', class: 'primary', onclick: () => (last ? finish() : (i++, ask())) }, last ? 'Finish' : 'Next yōkai') as HTMLButtonElement;
      mount(
        feedback,
        h('p', { class: res.data.right ? 'acct-right' : 'acct-wrong' }, res.data.right ? `✓ Right! ${card.char} is “${res.data.expected}”.` : `${card.char} is “${res.data.expected}”. It’ll come back tomorrow.`),
        res.data.caught ? h('p', { class: 'acct-caught' }, h('span', { lang: 'ja' }, 'つかまえた！'), ` Caught! ${card.char} is sealed in your yōkai book.`) : null,
        hearButton(card.hear, 'Hear it', 'raid-hear acct-hear'),
      );
      feedback.className = 'acct-feedback';
      form.replaceChildren(next);
      next.focus();
    };
    const form = h(
      'form',
      {
        class: 'acct-answer',
        onsubmit: (e: Event) => {
          e.preventDefault();
          if (!input.value.trim()) {
            input.focus();
            return;
          }
          void answer(input.value);
        },
      },
      h('label', { for: 'acct-answer' }, 'Type its sound in romaji', input),
      check,
      skip,
    );
    skip.onclick = () => void answer('');
    const page = h(
      'div',
      { class: 'acct-page' },
      backBar(toProgress, 'Stop'),
      h('h2', { class: 'acct-count' }, `Yōkai ${i + 1} of ${cards.length}`),
      face,
      feedback,
      form,
    );
    mount(screens.app, page);
    input.focus();
  };

  const finish = () => {
    const page = h(
      'div',
      { class: 'acct-page acct-done' },
      h('h2', {}, 'Review done!'),
      h('p', { class: 'big' }, `${right} of ${cards.length} right`),
      caught.length ? h('p', { class: 'acct-caught' }, 'Caught today: ', h('span', { lang: 'ja' }, caught.join(' '))) : null,
      h('p', { class: 'acct-note' }, 'Misses come back tomorrow; the ones you knew wait a little longer each time.'),
      h('button', { type: 'button', class: 'primary', onclick: toProgress }, 'Back to my progress'),
    );
    mount(screens.app, page);
    focusHeading(page);
  };

  ask();
}
