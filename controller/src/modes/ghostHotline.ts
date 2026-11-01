// Ghost Advice Hotline (おばけの おなやみ相談室) on the phone. Your role is on the band every beat (📞 caller,
// 💡 adviser, 🍿 gallery), with a "Next:" line. The one thing to tap sits in a dock at the bottom (.gh-dock),
// under the thumb, however long the screen above it grows.
//
//   Ring     caller: the secret card (only they see it) and their line at their level: Say it (+50 for
//            trying) or let Nobiko-san say it. Kana: the line is a tile; a tap sends it, and with
//            "🎤 Say it too" on, the tap records first. Everyone else: the Listening card and the gist.
//   Plan     speaking adviser: the gist, the mission, "Need a hint?" (N5: the frame first, then Nobiko's way),
//            I'm ready. Quiet mode or no mic: type it. Mic blocked: said at the start of the plan, with a free
//            read. Mic pass "1 left", asks twice. Kana adviser: four tiles, one per row, the curveball with a
//            leaf; the pick sends when the plan ends. Gallery: four bet pictures (+20).
//   Record   speaking adviser: one button, Plan → Recording → Sent (tap to start, tap to stop, it sends itself
//            at the cap), with the seconds left. Typing: the draft sends itself just before the deadline.
//            Caller: what's happening, and the three reactions to practise.
//   Reveal   everyone but the speaker: the Listening card (who, a live bar, then the picture and the words
//            once the caller reacts). Caller: ちがう ✗ / おしい ≈ / それだ ◎, fixed places, Change my pick until
//            it locks. Secret: the caller's card is on the TV; the gallery sees its bet result.
//   Vote     picture buttons, never yourself; tap another to change.
//   Score    "Watch the TV" until the tally lands, then your points by reason and the speaker's private note;
//            in the booth, your level's tag.

import { h, seatShape } from '../../../shared/src/dom.js';
import { REACT_MS, UPLOAD_MS, type AdviceKind, type AdviceRow, type HotlineMe, type HotlineView, type Reaction, type TileView } from '../../../shared/src/modes/ghostHotline/hotline.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import { MicClip, recordReady, uploadClip } from '../components/mic.js';
import { isQuiet } from '../components/speak.js';
import { jpView } from '../components/jp.js';
import { waiting } from '../components/ui.js';
import type { PhoneContext, PhoneMode } from './types.js';

type Ctx = PhoneContext<HotlineView>;
type Send = (move: Record<string, unknown>) => void;
type Level = HotlineMe['level'];

const ART = (picture: string): string => `/stage/assets/hotline/${picture}.png`;
const LEAF = '/stage/assets/late/leaf.png';
/** Taps on the record button this soon after it appears are the tail of a double tap on Ready. */
const REC_GUARD_MS = 600;
/** A typed draft goes in this long before the record beat's deadline. */
const TYPED_EARLY_MS = 800;
/** The caller's own take of the problem line. */
const SAY_MS = 8_000;
/** The TV's tally and top laugh run this long before the points land (storyboard frame 08). */
const POINTS_LAND_MS = 2_400;
/** A failed upload tries again this often while the record beat lasts. */
const RETRY_MS = 2_000;

const buzz = (ms = 60) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // no vibration here
  }
};

// ---- local state, kept across redraws ----

let local = 0;
/** The context of the latest draw: timers read the room from here, never from a stale one. */
let latest: Ctx | null = null;
const bump = () => {
  local++;
  latest?.redraw();
};
const timers = new Map<string, ReturnType<typeof setTimeout>>();
function later(name: string, ms: number, fn: () => void): void {
  const old = timers.get(name);
  if (old) clearTimeout(old);
  timers.set(
    name,
    setTimeout(() => {
      timers.delete(name);
      fn();
    }, Math.max(0, ms)),
  );
}
function cancel(name: string): void {
  const old = timers.get(name);
  if (old) clearTimeout(old);
  timers.delete(name);
}

/** The round the per-round state below belongs to. */
let roundSeen = 0;
/** 0 closed; N5 opens the sentence frame first (1), then Nobiko-san's way (2). Other levels go straight to 2. */
let hintStep = 0;
type Purpose = 'say' | 'advice';
/** started: when the mic opened; ms: how long this take may run (the limit, capped by the deadline). */
let rec: { round: number; purpose: Purpose; clip: MicClip; started: number | null; ms: number; timer: ReturnType<typeof setTimeout> | null } | null = null;
let sending: Purpose | null = null;
let problem = '';
/** The typed advice in progress (quiet mode, or no mic). */
let typed = '';
/** The mic failed to open this game (not blocked): type instead, until the player tries it again. */
let micDead = false;
/** The browser refuses the mic (the Permissions API says so at the start of the plan, or an open failed). */
let micBlocked = false;
let permAsked = false;
/** The mic pass was tapped once this round and is asking to be sure. */
let passAsk = false;
/** When the record button first showed this round, for the double-tap guard. */
let recShownAt = 0;
/** Kana caller: the tile tap records a take first. */
let sayToo = true;
/** The caller left the line to Nobiko-san this round. */
let nobikoSays = false;
/** The caller tapped Change my pick for this advice (`round:index`). */
let changing = '';
/** The caller is trying the reactions out while the advice is recorded. */
let practice: Reaction | null = null;
/** The advice playing last, so the react beat still knows who spoke. */
let lastPlay: { round: number; index: number; total: number; playerId: string; kind: AdviceKind } | null = null;
/** A take that couldn't reach the room: it tries again until the record beat ends. */
let pending: { round: number; wav: Uint8Array<ArrayBuffer>; durMs: number } | null = null;
/** The round whose take never made it. */
let lostRound = 0;
/** Kept takes by round, so a phone that plays its own clip can. */
const kept = new Map<number, string>();
let playedKey = '';
let player: HTMLAudioElement | null = null;
/** The browser refused to autoplay this phone's own clip: it needs a tap. */
let playBlocked = false;
/** Pictures that failed to load: the emoji stands in. */
const failedPics = new Set<string>();
/** Advice this VIP just hid (`round:playerId`), until the view says so. */
const hiddenByMe = new Set<string>();

function newRound(round: number): void {
  if (round === roundSeen) return;
  roundSeen = round;
  hintStep = 0;
  problem = '';
  typed = '';
  passAsk = false;
  recShownAt = 0;
  nobikoSays = false;
  changing = '';
  practice = null;
  playBlocked = false;
  sayToo = true;
  if (pending && pending.round !== round) pending = null;
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => retryPending());
}

/** No mic at all, or the browser refuses it: a free read, never the once-a-game pass. */
const micOff = (): boolean => micBlocked || !recordReady();
/** Typing replaces the mic: quiet mode, no mic, a blocked mic, or one that wouldn't open. */
const typing = (): boolean => isQuiet() || micOff() || micDead;

/** The server's clock now, from the phase deadline (falls back to this phone's clock). */
function serverNow(ctx: Ctx): number {
  const left = ctx.remainingMs();
  return ctx.view.deadline !== null && left !== null && left > 0 ? ctx.view.deadline - left : Date.now();
}

/** Asks the browser, without a prompt, whether the mic is refused, so the plan can say so up front. */
function checkMic(): void {
  if (permAsked) return;
  permAsked = true;
  try {
    void navigator.permissions
      ?.query({ name: 'microphone' as PermissionName })
      .then((st) => {
        const update = () => {
          const was = micBlocked;
          micBlocked = st.state === 'denied';
          if (!micBlocked) micDead = false;
          if (was !== micBlocked) bump();
        };
        update();
        st.onchange = update;
      })
      .catch(() => {});
  } catch {
    // no Permissions API: the first tap on record finds out
  }
}

/** Opens the mic from a tap, so the browser can ask again ("Turn on the mic"). */
function tryMic(): void {
  const clip = new MicClip({ raw: true });
  problem = '';
  bump();
  void clip.ready.then((ok) => {
    clip.stop();
    if (ok) {
      micBlocked = false;
      micDead = false;
      problem = '';
    } else {
      micBlocked = clip.blocked || micBlocked;
      problem = clip.blocked ? 'Still off. Allow the microphone for this page in your browser’s settings, then try again.' : 'Couldn’t open the microphone. Type your advice, or let Nobiko-san read it.';
    }
    bump();
  });
}

function startRecording(ctx: Ctx, purpose: Purpose, limitMs: number): void {
  if (rec || sending) return;
  problem = '';
  const round = ctx.game.round;
  const clip = new MicClip({ raw: true });
  rec = { round, purpose, clip, started: null, ms: limitMs, timer: null };
  bump();
  // The take starts when the mic is open, never before: the first syllable would be lost.
  void clip.ready.then((ok) => {
    if (rec?.clip !== clip) return;
    if (!ok) {
      rec = null;
      if (clip.blocked) micBlocked = true;
      else micDead = true;
      if (purpose === 'say') {
        // A try counts: the tap still sends the line.
        problem = clip.blocked ? 'Your mic is off, so the line went without your voice. Say it out loud anyway!' : 'Couldn’t open the microphone. Your line went in: say it out loud anyway!';
        sendSay(latest ?? ctx, round, null);
      } else {
        problem = clip.blocked ? 'Your mic is off. Type your advice, or let Nobiko-san read it for free.' : 'Couldn’t open the microphone. Type your advice, or let Nobiko-san read it.';
      }
      return bump();
    }
    buzz(40);
    // The record beat holds the limit, a grace and the upload: the take must stop in time to upload. A slow
    // mic (a first-time permission prompt) eats into the take, not into the upload.
    const now = latest ?? ctx;
    const left = now.remainingMs();
    const capped = purpose === 'advice' || now.view.phase === 'answer';
    const reserve = purpose === 'advice' ? UPLOAD_MS : 1_500;
    rec.ms = Math.max(500, Math.min(limitMs, !capped || left === null ? limitMs : left - reserve));
    rec.started = Date.now();
    rec.timer = setTimeout(() => void stopAndSend(), rec.ms);
    bump();
  });
}

async function stopAndSend(): Promise<void> {
  const r = rec;
  const ctx = latest;
  if (!r || !ctx) return;
  rec = null;
  if (r.timer) clearTimeout(r.timer);
  const wav = r.clip.stop();
  if (!wav || wav.length <= 44 || r.started === null) {
    problem = 'Didn’t hear anything. Tap and talk!';
    return bump();
  }
  const durMs = Math.round(((wav.length - 44) / 32_000) * 1000);
  if (r.purpose === 'say') {
    sending = 'say';
    bump();
    // Only the speech check sees the caller's take: the room hears the caller in person.
    const res = await uploadClip(wav, false);
    sending = null;
    sendSay(latest ?? ctx, r.round, res.ok ? res : null);
    return bump();
  }
  await sendAdvice(r.round, wav, durMs);
}

function sendSay(ctx: Ctx, round: number, res: { heard: unknown; checked: boolean } | null): void {
  void ctx.send({ kind: 'say', round, clipId: null, local: !!res, heard: res?.heard ?? null, checked: res?.checked ?? false }).then((ok) => ok && buzz(80));
}

async function sendAdvice(round: number, wav: Uint8Array<ArrayBuffer>, durMs: number): Promise<void> {
  sending = 'advice';
  bump();
  let res = await uploadClip(wav, true);
  let mine = false;
  // The room's clip memory is full: this phone plays it instead.
  if (!res.ok && res.why === 'full') {
    res = await uploadClip(wav, false);
    mine = true;
  }
  sending = null;
  const ctx = latest;
  if (!res.ok || !ctx) {
    // The phone dropped: keep the take and try again while the record beat lasts.
    pending = { round, wav, durMs };
    later('retry', RETRY_MS, retryPending);
    return bump();
  }
  pending = null;
  if (mine || !res.clipId) kept.set(round, URL.createObjectURL(new Blob([wav], { type: 'audio/wav' })));
  const ok = await ctx.send({ kind: 'advice', type: 'clip', round, clipId: res.clipId, local: mine || !res.clipId, durMs: res.durMs || durMs, heard: res.heard, checked: res.checked });
  if (ok) buzz(80);
  bump();
}

function retryPending(): void {
  const p = pending;
  const ctx = latest;
  if (!p || !ctx || sending) return;
  if (ctx.game.round !== p.round || ctx.view.phase !== 'answer' || ctx.game.me?.sent) {
    if (!ctx.game.me?.sent) lostRound = p.round;
    pending = null;
    return bump();
  }
  void sendAdvice(p.round, p.wav, p.durMs);
}

/** While a take runs, redraw on each second so the countdown moves. */
function tickWhileLive(): void {
  if (!rec || rec.started === null) return;
  const into = (Date.now() - rec.started) % 1000;
  later('tick', 1000 - into + 10, () => {
    if (rec?.started != null) bump();
  });
}

function sendTyped(ctx: Ctx, round: number): void {
  const text = typed.trim();
  if (!text) {
    problem = 'Type your advice first.';
    return bump();
  }
  void ctx.send({ kind: 'advice', type: 'typed', text, round }).then((ok) => ok && buzz(80));
}

/** A typed draft goes in by itself just before the record beat ends; an empty one sends nothing. */
function armTypedSend(ctx: Ctx): void {
  cancel('typed');
  const me = ctx.game.me;
  const left = ctx.remainingMs();
  if (ctx.view.phase !== 'answer' || left === null || !me?.canType || me.sent || !typing()) return;
  const round = ctx.game.round;
  later('typed', left - TYPED_EARLY_MS, () => {
    const now = latest;
    if (now && now.game.round === round && !now.game.me?.sent && typed.trim()) sendTyped(now, round);
  });
}

function playMine(round: number, again = false): void {
  const key = `hotline:${round}`;
  if (key === playedKey && !again) return;
  playedKey = key;
  const url = kept.get(round);
  if (!url) return;
  player?.pause();
  player = new Audio(url);
  void player.play().then(
    () => {
      if (!playBlocked) return;
      playBlocked = false;
      bump();
    },
    () => {
      // iOS and others refuse audio that a tap didn't start: offer the tap.
      playBlocked = true;
      bump();
    },
  );
}

// ---- pieces ----

const nameOf = (view: RoomView, id: string | null | undefined): string => view.players.find((p) => p.id === id)?.name ?? '';
const seatOf = (view: RoomView, id: string | null | undefined): number => view.players.find((p) => p.id === id)?.seat ?? 0;

/** Player text (what was heard, what was typed): always plain text, never markup. */
function plain(tag: string, cls: string, text: string, lang = 'ja'): HTMLElement {
  const el = h(tag, { class: cls, lang });
  el.textContent = text;
  return el;
}

function seatChip(view: RoomView, id: string): HTMLElement | null {
  const seat = seatOf(view, id);
  return seat ? h('span', { class: `seat-badge seat-${seat} gh-seat`, 'aria-hidden': 'true' }, `${seatShape(seat)}${seat}`) : null;
}

/** Who is calling: a player's name, or the scripted yōkai's. */
function callerName(ctx: Ctx): string {
  const call = ctx.game.call;
  if (!call) return 'The caller';
  return call.caller ? nameOf(ctx.view, call.caller) : call.who.name.en;
}

/** A picture, with the emoji standing in until the art exists. */
function pic(t: { picture: string; emoji: string }, cls = 'gh-pic'): HTMLElement {
  const emoji = () => h('span', { class: `${cls} gh-emoji`, 'aria-hidden': 'true' }, t.emoji);
  if (failedPics.has(t.picture)) return emoji();
  return h('img', {
    class: cls,
    src: ART(t.picture),
    alt: '',
    draggable: 'false',
    onerror: (e: Event) => {
      failedPics.add(t.picture);
      (e.target as HTMLElement).replaceWith(emoji());
    },
  });
}

/** The curveball tile. The view doesn't flag it yet: see the report. */
const isCurve = (t: TileView): boolean => (t as TileView & { curve?: boolean }).curve === true;

const ROLE: Record<NonNullable<HotlineMe['role']>, { icon: string; label: string }> = {
  caller: { icon: '📞', label: 'You: caller' },
  adviser: { icon: '💡', label: 'You: adviser' },
  gallery: { icon: '🍿', label: 'You: gallery' },
};

const REACT: Record<Reaction, { ja: string; en: string }> = {
  chigau: { ja: 'ちがう！', en: 'nope' },
  oshii: { ja: 'おしい！', en: 'so close' },
  soreda: { ja: 'それだ！', en: 'that’s it' },
};
/** Fixed places: ちがう on the left, それだ on the right, always. */
const REACTIONS: Reaction[] = ['chigau', 'oshii', 'soreda'];

const WHY: Record<HotlineMe['breakdown'][number]['why'], string> = {
  soreda: 'それだ！',
  oshii: 'おしい！',
  laugh: 'Laughs',
  sweep: '大ウケ！',
  bet: 'Right bet',
  line: 'Said the problem',
};

function band(me: HotlineMe, next: string): HTMLElement {
  const role = me.role ? ROLE[me.role] : null;
  return h('div', { class: 'gh-band' }, role ? h('span', { class: 'gh-role-chip' }, role.icon, ' ', role.label) : null, next ? h('p', { class: 'gh-next' }, h('b', {}, '▶ Next: '), next) : null);
}

/** The bottom dock: the screen's main action, under the thumb. */
const dock = (...children: (HTMLElement | null)[]): HTMLElement => h('div', { class: 'gh-dock' }, ...children);

const screen = (...children: (HTMLElement | null)[]): HTMLElement => h('div', { class: 'screen gh-screen' }, ...children);

const problemLine = (): HTMLElement | null => (problem ? h('p', { class: 'gh-problem', role: 'alert' }, problem) : null);

function mark(r: Reaction): HTMLElement {
  return h('span', { class: `gh-mark gh-mark-${r}`, 'aria-hidden': 'true' }, r === 'oshii' ? [h('span', { class: 'gh-wave' }), h('span', { class: 'gh-wave' })] : null);
}

function reactionChip(r: Reaction, extra = ''): HTMLElement {
  return h('span', { class: `gh-chip gh-r-${r}` }, mark(r), h('span', { lang: 'ja' }, REACT[r].ja), extra ? h('small', {}, extra) : null);
}

/** The three reactions, side by side in fixed places. `picked` dims the others; no `onPick`, no taps. */
function reactionTiles(picked: Reaction | null, onPick: ((r: Reaction) => void) | null, dim: boolean): HTMLElement {
  return h(
    'div',
    { class: 'gh-reacts', role: 'group', 'aria-label': 'Your reaction' },
    ...REACTIONS.map((r) =>
      h(
        'button',
        {
          type: 'button',
          class: `gh-react gh-r-${r}${picked === r ? ' on' : ''}${dim && picked && picked !== r ? ' dim' : ''}`,
          disabled: !onPick,
          'aria-pressed': picked === r ? 'true' : 'false',
          onclick: onPick ? () => onPick(r) : undefined,
        },
        mark(r),
        h('span', { class: 'gh-react-ja', lang: 'ja' }, REACT[r].ja),
        h('small', { lang: 'en' }, REACT[r].en),
      ),
    ),
  );
}

/** The word on a tile, at the player's level: kana for Kana players, the written form for the rest. */
const tileWord = (t: TileView, level: Level): string => (level === 'kana' ? t.word.kana || t.word.text : t.word.text);

/** A Kana adviser's tile: one per row, picture left, one line of kana, never broken inside a word. */
function adviceTile(t: TileView, level: Level, on: boolean, onclick: (() => void) | null): HTMLElement {
  const curve = isCurve(t);
  return h(
    'button',
    { type: 'button', class: `gh-tile${on ? ' on' : ''}${curve ? ' gh-curve' : ''}`, disabled: !onclick, 'aria-pressed': on ? 'true' : 'false', onclick: onclick ?? undefined },
    pic(t),
    h(
      'span',
      { class: 'gh-tile-words' },
      h('span', { class: 'gh-tile-ja', lang: 'ja' }, tileWord(t, level)),
      t.romaji ? h('span', { class: 'gh-tile-ro' }, t.romaji) : null,
      h('span', { class: 'gh-tile-en' }, t.word.en, curve ? ' · curveball' : ''),
    ),
    curve ? leafBadge() : null,
  );
}

function leafBadge(): HTMLElement {
  if (failedPics.has('leaf')) return h('span', { class: 'gh-leaf gh-emoji', 'aria-hidden': 'true' }, '🍃');
  return h('img', {
    class: 'gh-leaf',
    src: LEAF,
    alt: '',
    onerror: (e: Event) => {
      failedPics.add('leaf');
      (e.target as HTMLElement).replaceWith(h('span', { class: 'gh-leaf gh-emoji', 'aria-hidden': 'true' }, '🍃'));
    },
  });
}

/** A picture button for bets and votes: the picture is the button. */
function pictureButton(opts: { cls?: string; on: boolean; onclick: (() => void) | null; picture: HTMLElement; word: HTMLElement | null; en: string | null; who?: HTMLElement | null; seat?: HTMLElement | null; mine?: boolean }): HTMLElement {
  return h(
    'button',
    {
      type: 'button',
      class: `gh-card${opts.on ? ' on' : ''}${opts.mine ? ' mine' : ''} ${opts.cls ?? ''}`,
      disabled: !opts.onclick,
      'aria-pressed': opts.on ? 'true' : 'false',
      onclick: opts.onclick ?? undefined,
    },
    opts.seat ?? null,
    opts.picture,
    opts.word,
    opts.en ? h('span', { class: 'gh-card-en' }, opts.en) : null,
    opts.who ?? null,
  );
}

function liveBar(): HTMLElement {
  return h('span', { class: 'gh-live', 'aria-hidden': 'true' }, ...Array.from({ length: 6 }, (_, i) => h('span', { style: `--i: ${i}` })));
}

function gistCard(ctx: Ctx, me: HotlineMe, compact = false): HTMLElement | null {
  if (!me.gist) return null;
  const who = ctx.game.call?.who;
  return h(
    'div',
    { class: `gh-gist${compact ? ' compact' : ''}` },
    who && !compact ? pic(who, 'gh-pic gh-who') : null,
    h('div', { class: 'gh-gist-body' }, h('p', { class: 'gh-label' }, `Gist of ${callerName(ctx)}’s call`), jpView(me.gist, me.level, { cls: 'gh-gist-line' })),
  );
}

function secretCard(me: HotlineMe, compact = false): HTMLElement | null {
  if (!me.secret) return null;
  return h(
    'div',
    { class: `gh-secret${compact ? ' compact' : ''}` },
    h('p', { class: 'gh-secret-label' }, compact ? '🤫 Your secret' : '🤫 Your secret · only you see this'),
    jpView(me.secret, me.level, { cls: 'gh-secret-line', en: !compact }),
    compact ? null : h('p', { class: 'gh-hint' }, 'React それだ！ to the advice that would really help.'),
  );
}

/** The Listening card while the caller rings in: who is calling, a live bar, and the gist. */
function callingCard(ctx: Ctx, me: HotlineMe): HTMLElement {
  const id = ctx.game.call?.caller;
  return h(
    'div',
    { class: 'gh-listen' },
    h('p', { class: 'gh-listen-head' }, id ? seatChip(ctx.view, id) : null, h('b', {}, callerName(ctx)), ' is calling', liveBar()),
    gistCard(ctx, me),
  );
}

interface NowPlaying {
  playerId: string;
  index: number;
  total: number;
  kind: AdviceKind;
  tile: TileView | null;
  playing: boolean;
  local: boolean;
}

/** The advice on the TV now (playing, or waiting on the caller's reaction). */
function nowPlaying(ctx: Ctx, me: HotlineMe): NowPlaying | null {
  const g = ctx.game;
  if (ctx.view.phase !== 'reveal') return null;
  if (g.play) {
    lastPlay = { round: g.round, index: g.play.index, total: g.play.total, playerId: g.play.playerId, kind: g.play.kind };
    return { ...lastPlay, tile: g.play.tile, playing: !g.play.reacting, local: g.play.local };
  }
  if (g.step !== 'react') return null;
  const last = lastPlay && lastPlay.round === g.round ? lastPlay : null;
  if (me.react) return { playerId: me.react.playerId, index: me.react.index, total: last?.total ?? Math.max(g.rows.length, me.react.index + 1), kind: last?.playerId === me.react.playerId ? last.kind : 'clip', tile: null, playing: false, local: false };
  return last ? { ...last, tile: null, playing: false, local: false } : null;
}

/** The words and the picture of one played advice, once the caller has reacted. */
function rowBody(ctx: Ctx, me: HotlineMe, row: AdviceRow): HTMLElement {
  const name = row.playerId === ctx.me.id ? 'your' : `${nameOf(ctx.view, row.playerId)}’s`;
  if (row.hidden) return h('div', { class: 'gh-box' }, h('p', { class: 'gh-hint' }, 'The VIP took this one off the TV.'));
  return h(
    'div',
    { class: 'gh-gist gh-advice' },
    row.tile ? pic(row.tile, 'gh-pic gh-who') : null,
    h(
      'div',
      { class: 'gh-gist-body' },
      h('p', { class: 'gh-label' }, row.kind === 'nobiko' ? `Nobiko-san read ${name} line` : `Gist of ${name} advice`),
      row.subtitle ? plain('p', 'gh-said', row.subtitle) : row.tile ? h('p', { class: 'gh-said', lang: 'ja' }, tileWord(row.tile, me.level)) : h('p', { class: 'gh-hint' }, 'No words came through for this one.'),
      row.tile?.romaji ? h('p', { class: 'gh-tile-ro' }, row.tile.romaji) : null,
      row.tile ? h('p', { class: 'gh-card-en' }, row.tile.word.en) : null,
    ),
    row.reaction ? reactionChip(row.reaction, row.auto ? 'marked by the game' : '') : null,
  );
}

/** The Listening card during the reveal: who is speaking and a live bar; the words wait for the caller. */
function adviceCard(ctx: Ctx, me: HotlineMe): HTMLElement | null {
  const now = nowPlaying(ctx, me);
  if (!now) return null;
  const view = ctx.view;
  const name = nameOf(view, now.playerId);
  const row = ctx.game.rows.find((r) => r.playerId === now.playerId && r.reaction) ?? null;
  const caller = callerName(ctx);
  let body: HTMLElement;
  if (row) body = rowBody(ctx, me, row);
  else if (now.tile)
    body = h(
      'div',
      { class: 'gh-gist gh-advice' },
      pic(now.tile, 'gh-pic gh-who'),
      h('div', { class: 'gh-gist-body' }, h('p', { class: 'gh-label' }, `${name}’s tile`), h('p', { class: 'gh-said', lang: 'ja' }, tileWord(now.tile, me.level)), now.tile.romaji ? h('p', { class: 'gh-tile-ro' }, now.tile.romaji) : null, h('p', { class: 'gh-card-en' }, now.tile.word.en)),
    );
  else
    body = h(
      'div',
      { class: 'gh-gist gh-advice gh-getting' },
      h('span', { class: 'gh-pic gh-dots', 'aria-hidden': 'true' }, '⋯'),
      h('div', { class: 'gh-gist-body' }, h('p', { class: 'gh-label' }, 'Getting the gist…'), h('p', {}, now.kind === 'nobiko' ? `Nobiko-san reads ${name}’s advice.` : `Listen to ${name}.`, ` The words and the picture show once ${caller === 'The caller' ? 'the caller' : caller} reacts.`)),
    );
  const verb = now.playing ? (now.kind === 'nobiko' ? ': Nobiko-san reads it' : ' is speaking') : ' stopped';
  return h(
    'div',
    { class: 'gh-listen' },
    h('p', { class: 'gh-listen-head' }, seatChip(view, now.playerId), h('b', {}, name), verb, now.playing ? liveBar() : null, h('span', { class: 'gh-count' }, `${now.index + 1}/${now.total}`)),
    body,
  );
}

/** The once-a-game mic pass, or the free read when the mic is off. Both ask before they spend. */
function passBlock(ctx: Ctx, me: HotlineMe, send: Send): HTMLElement | null {
  if (me.sent || rec || sending) return null;
  if (micOff())
    return h(
      'div',
      { class: 'gh-pass-wrap' },
      h('button', { type: 'button', class: 'gh-pass free', onclick: () => send({ kind: 'pass', free: true }) }, 'Let Nobiko-san read it · free'),
      h('p', { class: 'gh-hint center' }, 'This doesn’t use your pass the mic.'),
    );
  if (!me.micPassLeft) return h('button', { type: 'button', class: 'gh-pass', disabled: true }, 'Pass the mic · 0 left');
  if (!passAsk)
    return h('button', { type: 'button', class: 'gh-pass', onclick: () => ((passAsk = true), buzz(20), bump()) }, '🎙 Pass the mic · ', h('b', {}, '1 left'));
  return h(
    'div',
    { class: 'gh-pass-wrap' },
    h('button', { type: 'button', class: 'gh-pass ask', onclick: () => ((passAsk = false), send({ kind: 'pass' })) }, '🎙 Tap again: Nobiko-san reads it (half points)'),
    h('button', { type: 'button', class: 'gh-pass', onclick: () => ((passAsk = false), bump()) }, 'Keep it: I’ll say it'),
  );
}

function recordButton(ctx: Ctx, me: HotlineMe, purpose: Purpose, limitMs: number, labels: { idle: string; stop: string }): HTMLElement {
  const round = ctx.game.round;
  if (!recShownAt) recShownAt = Date.now();
  const on = rec?.round === round && rec.purpose === purpose;
  const live = on && rec!.started !== null;
  const elapsed = live ? Date.now() - rec!.started! : 0;
  const ms = live ? rec!.ms : limitMs;
  const secs = Math.max(0, Math.ceil((ms - elapsed) / 1000));
  if (live) tickWhileLive();
  const busy = sending === purpose;
  const label = busy ? 'Sending…' : live ? labels.stop : on ? 'Opening the mic…' : labels.idle;
  return h(
    'button',
    {
      type: 'button',
      class: `gh-rec-btn${live ? ' live' : ''}${on && !live ? ' opening' : ''}`,
      disabled: busy || (on && !live) || !!(rec && !on),
      'aria-live': 'polite',
      // The fill restarts from the real elapsed time whenever the button is drawn again.
      style: live ? `--ms: ${ms}ms; --gh-rec-delay: -${elapsed}ms` : null,
      onclick: () => {
        if (on) return void stopAndSend();
        if (Date.now() - recShownAt < REC_GUARD_MS) return;
        startRecording(ctx, purpose, limitMs);
      },
    },
    h('span', { class: 'gh-rec-ring', 'aria-hidden': 'true' }),
    live ? h('span', { class: 'gh-rec-secs' }, String(secs), h('small', {}, 'REC')) : null,
    h('span', { class: 'gh-rec-label' }, label, live ? h('small', {}, 'We hear you · it sends by itself at 0') : !on && !busy ? h('small', {}, 'tap again to stop') : null),
  );
}

function typedBox(ctx: Ctx): HTMLElement {
  const record = ctx.view.phase === 'answer';
  const retry = (micDead || micBlocked) && !isQuiet() && recordReady();
  return h(
    'div',
    { class: 'gh-typed' },
    h('p', { class: 'gh-label' }, isQuiet() ? 'Quiet mode: type your advice.' : 'Type your advice.', record ? ' It sends itself just before time runs out.' : ' Send it when it’s ready.'),
    h('input', { type: 'text', maxlength: '80', lang: 'ja', enterkeyhint: 'send', placeholder: 'Type your advice in Japanese', value: typed, oninput: (e: Event) => (typed = (e.target as HTMLInputElement).value) }),
    retry && !micBlocked ? h('button', { type: 'button', class: 'gh-pass', onclick: () => ((micDead = false), (problem = ''), bump()) }, '🎤 Try the mic again') : null,
  );
}

/** Mic denied: said at the start of the plan, not when the player presses record (storyboard frame 10). */
function micOffCard(): HTMLElement {
  return h(
    'div',
    { class: 'gh-micoff', role: 'status' },
    h('p', { class: 'gh-micoff-icon', 'aria-hidden': 'true' }, '🔇'),
    h('p', { class: 'gh-micoff-title' }, 'Your mic is off'),
    h('p', {}, 'The game can’t hear you. Your turn still counts: type your advice, or let Nobiko-san read it.'),
    recordReady() ? h('button', { type: 'button', class: 'secondary gh-mic-on', onclick: () => tryMic() }, 'Turn on the mic') : null,
    recordReady() ? h('p', { class: 'gh-hint center' }, 'Then tap “Allow” in the pop-up.') : null,
  );
}

function hintBox(ctx: Ctx, me: HotlineMe, send: Send): HTMLElement | null {
  const m = me.mission;
  if (!m) return null;
  const open = (n: number) => () => {
    hintStep = n;
    // Opening the hint makes this advice "read" for the learning path, not said from memory.
    send({ kind: 'hint' });
    bump();
  };
  return h(
    'div',
    { class: 'gh-hintbox' },
    hintStep === 0 ? h('button', { type: 'button', class: 'ghost', onclick: open(m.frame ? 1 : 2) }, 'Need a hint?') : null,
    hintStep === 0 ? h('p', { class: 'gh-hint' }, 'Peeking counts it as read, not said from memory.') : null,
    hintStep >= 1 && m.frame ? h('div', { class: 'gh-frame' }, h('p', { class: 'gh-label' }, 'Fill the gap:'), jpView(m.frame, me.level, { cls: 'gh-model' })) : null,
    hintStep === 1 ? h('button', { type: 'button', class: 'ghost', onclick: open(2) }, 'Still stuck? See Nobiko-san’s way') : null,
    hintStep >= 2 ? h('div', {}, h('p', { class: 'gh-label' }, 'Nobiko-san’s way:'), jpView(m.model, me.level, { cls: 'gh-model' })) : null,
  );
}

/** The adviser's own clip, played on this phone when the room's clip memory was full. */
function playingHere(ctx: Ctx, now: NowPlaying | null): HTMLElement | null {
  if (!now?.playing || !now.local || now.playerId !== ctx.me.id) return null;
  playMine(ctx.game.round);
  return h(
    'div',
    { class: 'gh-local' },
    h('p', { class: 'gh-mission-text' }, '🔊 Your phone plays it: turn it up and hold it up!'),
    playBlocked && kept.has(ctx.game.round) ? h('button', { type: 'button', class: 'primary', onclick: () => playMine(ctx.game.round, true) }, '▶ Play it') : null,
  );
}

/** "Sent ✓ Watch the TV", for an adviser whose advice is in. */
function sentCard(sub: string): HTMLElement {
  return h('div', { class: 'gh-sent' }, h('p', { class: 'gh-stamp' }, 'Sent ✓'), h('p', { class: 'gh-watch' }, '📺 Watch the TV'), sub ? h('p', { class: 'gh-hint center' }, sub) : null);
}

function watchCard(title: string, sub = ''): HTMLElement {
  return h('div', { class: 'gh-sent' }, h('p', { class: 'gh-watch' }, '📺 ', title), sub ? h('p', { class: 'gh-hint center' }, sub) : null);
}

/** A reconnecting take: kept on the phone, and sent when the room is back. */
function reconnectCard(): HTMLElement | null {
  if (!pending) return null;
  const secs = Math.max(1, Math.round(pending.durMs / 1000));
  return h(
    'div',
    { class: 'gh-micoff', role: 'status' },
    h('p', { class: 'gh-micoff-icon', 'aria-hidden': 'true' }, '📶'),
    h('p', { class: 'gh-micoff-title' }, 'Reconnecting…'),
    h('p', {}, `Keep this page open. Your clip so far (${secs} s) is saved.`),
    h('p', { class: 'gh-box' }, 'Back in time: it sends by itself. If not, the clips play without yours this call.'),
  );
}

// ---- screens ----

function introScreen(ctx: Ctx): HTMLElement {
  return screen(
    h('p', { class: 'big', lang: 'ja' }, 'おばけの おなやみ相談室'),
    h('p', {}, '📞 Each call, a yōkai phones Nobiko-san’s advice line. Only the caller sees what would really help.'),
    h('p', {}, '💡 Up to three advisers record their advice at the same time. The caller answers each one: ', h('span', { lang: 'ja' }, 'ちがう！ おしい！ それだ！')),
    ctx.game.scripted ? h('p', {}, '👻 Two of you: a yōkai calls, and you both advise.') : h('p', {}, '😂 Then everyone votes for the advice that made them laugh.'),
    h('p', { class: 'hint' }, 'Your voice goes to the TV for this call only, and isn’t kept.'),
  );
}

/** The caller's line: Kana taps a tile (and may record first); N5 and N4 say it, or leave it to Nobiko-san. */
function callerLine(ctx: Ctx, me: HotlineMe): HTMLElement[] {
  const line = me.callerLine;
  if (!line) return [];
  const round = ctx.game.round;
  const said = me.said;
  const canRec = !typing() && recordReady();
  if (me.level === 'kana') {
    const on = rec?.round === round && rec.purpose === 'say';
    const live = on && rec!.started !== null;
    const tap = () => {
      if (on) return void stopAndSend();
      if (sayToo && canRec) return startRecording(ctx, 'say', SAY_MS);
      sendSay(ctx, round, null);
    };
    return [
      h('p', { class: 'gh-label' }, said ? 'Your problem is in.' : 'Say your problem. The tile sends when you tap it.'),
      canRec && !said
        ? h(
            'label',
            { class: 'gh-toggle' },
            h('input', { type: 'checkbox', checked: sayToo, disabled: on, onchange: (e: Event) => ((sayToo = (e.target as HTMLInputElement).checked), bump()) }),
            '🎤 Say it too: ',
            h('b', {}, '+50'),
          )
        : null,
      h(
        'button',
        { type: 'button', class: `gh-tile gh-line${said ? ' on' : ''}${live ? ' live' : ''}`, disabled: said || sending === 'say' || (on && !live), onclick: said ? undefined : tap },
        ctx.game.call ? pic(ctx.game.call.who) : null,
        h('span', { class: 'gh-tile-words' }, jpView(line, me.level, { as: 'tile', cls: 'gh-line-jp' })),
        said ? h('span', { class: 'gh-sent-chip' }, '✓ sent') : null,
      ),
      live ? h('p', { class: 'gh-hint center' }, '● Recording… tap the tile again to send') : on ? h('p', { class: 'gh-hint center' }, 'Opening the mic…') : sending === 'say' ? h('p', { class: 'gh-hint center' }, 'Sending…') : null,
    ].filter((x): x is HTMLElement => !!x);
  }
  return [h('p', { class: 'gh-label' }, said ? 'Your problem is in ✓' : nobikoSays ? 'Nobiko-san reads your problem for you.' : 'Say your problem out loud (+50 for trying):'), jpView(line, me.level, { cls: 'gh-model' })];
}

/** The caller's dock while the line can still be said. */
function callerSayDock(ctx: Ctx, me: HotlineMe): HTMLElement | null {
  if (me.level === 'kana' || me.said || !me.canSay || nobikoSays) return null;
  if (typing()) {
    // No mic here: the line still counts when it's said out loud in the room.
    if (isQuiet()) return null;
    return dock(h('button', { type: 'button', class: 'primary', onclick: () => sendSay(ctx, ctx.game.round, null) }, '✓ I said it out loud'), h('button', { type: 'button', class: 'gh-pass', onclick: () => ((nobikoSays = true), bump()) }, 'Let Nobiko-san say it'));
  }
  const on = rec?.purpose === 'say';
  return dock(
    recordButton(ctx, me, 'say', SAY_MS, { idle: '● Say it: +50', stop: '■ Done: send' }),
    on ? null : h('button', { type: 'button', class: 'gh-pass', onclick: () => ((nobikoSays = true), bump()) }, 'Let Nobiko-san say it'),
  );
}

/** What the advisers are doing, for the phones that wait on them. */
function workingBox(ctx: Ctx): HTMLElement {
  const { game, view } = ctx;
  const advisers = game.cast?.advisers ?? [];
  const n = advisers.length;
  const s = (k: number) => `${k} adviser${k === 1 ? ' is' : 's are'}`;
  if (view.phase === 'prompt')
    return h('div', { class: 'gh-box' }, h('p', { class: 'gh-strong' }, `${s(n)} planning.`), h('p', { class: 'gh-hint' }, 'Nobody sees anyone’s advice until all of it is in.'));
  const left = advisers.filter((id) => !game.locked.sent.includes(id)).length;
  return h(
    'div',
    { class: 'gh-box' },
    h('p', { class: 'gh-strong' }, left ? `${s(left)} recording.` : 'All the advice is in.'),
    h('p', { class: 'gh-hint' }, 'Nobody can hear it yet.'),
  );
}

function callerScreen(ctx: Ctx, me: HotlineMe): HTMLElement {
  const { game, view } = ctx;
  const ring = view.phase === 'prompt' && game.step === 'ring';
  checkMic();
  const status = ring ? null : workingBox(ctx);
  const practise = ring
    ? null
    : h(
        'div',
        { class: 'gh-practice' },
        h('p', { class: 'gh-label' }, 'While you wait, try each one:'),
        reactionTiles(practice, (r) => ((practice = r), buzz(20), bump()), false),
        h('p', { class: 'gh-hint' }, practice ? `${REACT[practice].ja} = “${REACT[practice].en}”. Your real reaction comes after each clip.` : 'Your real reaction comes after each clip.'),
      );
  const sayLater = !ring && me.canSay && !me.said;
  return screen(
    band(me, ring ? 'advisers plan. Then react to each piece of advice.' : 'after each clip, tap one reaction.'),
    secretCard(me, !ring && !sayLater),
    ...(ring || sayLater ? callerLine(ctx, me) : []),
    status,
    practise,
    problemLine(),
    callerSayDock(ctx, me),
  );
}

function kanaAdviserScreen(ctx: Ctx, me: HotlineMe, send: Send): HTMLElement {
  const { view, game } = ctx;
  if (view.phase === 'answer' || me.sent) {
    const t = me.tiles.find((x) => x.id === me.pick);
    return screen(
      band(me, game.scripted ? 'the advice plays in a random order.' : 'the advice plays in a random order. Then vote for the funniest (not your own).'),
      t ? sentCard('Your tile plays on the TV soon.') : watchCard('Watch the TV', 'No tile went in this call. Listen to the others!'),
      t ? adviceTile(t, me.level, true, null) : null,
    );
  }
  return screen(
    band(me, 'listen to each piece of advice.'),
    gistCard(ctx, me, true),
    h('p', { class: 'gh-label' }, 'Pick your advice. The cure is always one of these.'),
    h('div', { class: 'gh-tiles' }, ...me.tiles.map((t) => adviceTile(t, me.level, me.pick === t.id, () => (send({ kind: 'pick', tileId: t.id }), buzz(20))))),
    h('p', { class: 'gh-hint' }, me.pick ? '✓ Sends when the plan ends · tap another to change.' : 'It sends when the plan ends · tap another to change.'),
    h('p', { class: 'gh-hint' }, '🗣 Say it out loud too!'),
  );
}

function speakerPlanScreen(ctx: Ctx, me: HotlineMe, send: Send): HTMLElement {
  const { view, game } = ctx;
  checkMic();
  const record = view.phase === 'answer';
  const typingNow = typing() && me.canType;
  let action: HTMLElement | null;
  if (!record) {
    if (typingNow) action = h('button', { type: 'button', class: 'primary', onclick: () => sendTyped(ctx, game.round) }, 'Send ✓');
    else if (me.ready) action = h('p', { class: 'hint gh-ready-done' }, 'Ready ✓ Recording opens when the plan ends.');
    else if (micOff()) action = null;
    else action = h('button', { type: 'button', class: 'primary', onclick: () => ((recShownAt = Date.now()), send({ kind: 'ready' })) }, '● I’m ready');
  } else if (typingNow) {
    action = h('button', { type: 'button', class: 'primary', onclick: () => sendTyped(ctx, game.round) }, 'Send ✓');
  } else if (pending) {
    action = null;
  } else {
    action = recordButton(ctx, me, 'advice', me.limitMs, { idle: '● Tap to record', stop: '■ Done: send' });
  }
  const live = !!rec && rec.purpose === 'advice';
  return screen(
    band(me, record ? `up to ${Math.round(me.limitMs / 1000)} s, then the clips play in a random order.` : 'record your advice when the plan ends.'),
    micOff() && !record ? micOffCard() : null,
    reconnectCard(),
    record ? null : gistCard(ctx, me, true),
    me.mission ? h('div', { class: 'gh-mission' }, h('p', { class: 'gh-mission-label' }, 'Your mission'), h('p', { class: 'gh-mission-text' }, me.mission.text)) : null,
    live || pending ? null : hintBox(ctx, me, send),
    typingNow ? typedBox(ctx) : null,
    micOff() && record && !typingNow ? micOffCard() : null,
    problemLine(),
    dock(action, passBlock(ctx, me, send)),
  );
}

function adviserScreen(ctx: Ctx, me: HotlineMe): HTMLElement {
  const { game, view } = ctx;
  const send: Send = (move) => void ctx.send({ ...move, round: game.round });
  if (view.phase === 'prompt' && game.step === 'ring')
    return screen(band(me, me.level === 'kana' ? 'pick your advice. The cure is always one of your tiles.' : 'plan your advice.'), callingCard(ctx, me));
  if (me.level === 'kana') return kanaAdviserScreen(ctx, me, send);
  if (me.sent)
    return screen(
      band(me, game.scripted ? 'the clips play in a random order.' : 'the clips play in a random order. Then you vote for the funniest advice (not your own).'),
      sentCard('Your advice plays on the TV soon.'),
    );
  return speakerPlanScreen(ctx, me, send);
}

function betTile(t: TileView, me: HotlineMe, on: boolean, onclick: (() => void) | null): HTMLElement {
  return pictureButton({ cls: 'gh-bet', on, onclick, picture: pic(t), word: h('span', { class: 'gh-card-ja', lang: 'ja' }, tileWord(t, me.level)), en: t.romaji ? `${t.romaji} · ${t.word.en}` : t.word.en });
}

function galleryScreen(ctx: Ctx, me: HotlineMe): HTMLElement {
  const { game, view } = ctx;
  if (view.phase === 'prompt' && game.step === 'ring') return screen(band(me, 'bet on the cure while the advisers plan (+20).'), callingCard(ctx, me));
  const locked = me.lockedIn;
  const bet = (id: string) => () => (void ctx.send({ kind: 'bet', tileId: id, round: game.round }), buzz(20));
  const picked = me.betTiles.find((t) => t.id === me.bet);
  if (locked) {
    return screen(
      band(me, 'listen to each adviser.'),
      workingBox(ctx),
      picked ? h('p', { class: 'gh-label' }, 'Your bet (locked):') : h('p', { class: 'gh-hint' }, 'No bet this call. Listen!'),
      picked ? h('div', { class: 'gh-cards one' }, betTile(picked, me, true, null)) : null,
      gistCard(ctx, me, true),
    );
  }
  return screen(
    band(me, 'listen to each adviser.'),
    h('div', { class: 'gh-box' }, h('p', { class: 'gh-strong' }, `Bet: what will cure ${callerName(ctx)}?`), h('p', { class: 'gh-hint' }, 'Right bet +20. Nobody sees your bet.')),
    h('div', { class: 'gh-cards' }, ...me.betTiles.map((t) => betTile(t, me, me.bet === t.id, bet(t.id)))),
    h('p', { class: 'gh-hint' }, me.bet ? '✓ Bet placed · tap another to change.' : 'It locks when the recording starts.'),
    gistCard(ctx, me, true),
  );
}

/** What one adviser's own advice got, once it's on the TV. */
function ownRow(ctx: Ctx): HTMLElement | null {
  const rows = ctx.game.rows;
  const i = rows.findIndex((r) => r.playerId === ctx.me.id);
  const row = i >= 0 ? rows[i] : null;
  if (!row?.reaction) return null;
  const caller = callerName(ctx);
  const total = ctx.game.play?.total ?? lastPlay?.total ?? rows.length;
  const say: Record<Reaction, string> = {
    chigau: ctx.game.scripted ? `${caller} said nope.` : `${caller} said nope. You can still win the laugh vote.`,
    oshii: `${caller} said so close!`,
    soreda: `${caller} said that’s it!`,
  };
  return h(
    'div',
    { class: 'gh-box gh-own' },
    h('p', {}, `Your advice (${i + 1}/${total}): `, reactionChip(row.reaction)),
    h('p', { class: 'gh-hint' }, row.auto ? 'The game marked it.' : say[row.reaction], ' Points come at the end of the call.'),
  );
}

function revealScreen(ctx: Ctx, me: HotlineMe): HTMLElement {
  const { game } = ctx;
  const send: Send = (move) => void ctx.send({ ...move, round: game.round });
  const nextVote = game.scripted ? 'the secret, then the points.' : 'the secret, then the laugh vote.';
  if (game.step === 'secret') {
    if (me.role === 'caller') return screen(band(me, game.scripted ? 'the points.' : 'vote for the advice that made you laugh.'), watchCard('Your secret is on the TV'), secretCard(me));
    if (me.role === 'gallery') {
      const t = me.betTiles.find((x) => x.id === me.bet);
      const right = !!t && game.secret?.cure.id === t.id;
      const cure = game.secret?.cure;
      return screen(
        band(me, game.scripted ? 'the points.' : 'the laugh vote.'),
        watchCard('The secret is on the TV'),
        h(
          'div',
          { class: 'gh-result' },
          h('p', { class: 'gh-label' }, 'Your bet'),
          t ? h('div', { class: 'gh-cards one' }, betTile(t, me, right, null)) : h('p', { class: 'gh-hint' }, 'No bet this call.'),
          t ? h('p', { class: `gh-verdict ${right ? 'yes' : 'no'}` }, right ? 'Right! +20' : 'Not this time.') : null,
          right ? h('p', { class: 'gh-hint' }, 'Added to your score when the points land.') : cure ? h('p', { class: 'gh-hint' }, 'The cure: ', h('span', { lang: 'ja' }, tileWord(cure, me.level)), ` (${cure.word.en})`) : null,
        ),
      );
    }
    return screen(band(me, game.scripted ? 'the points.' : 'the laugh vote.'), watchCard('The secret is on the TV'), ownRow(ctx));
  }
  const now = nowPlaying(ctx, me);
  if (me.role === 'caller') {
    const r = me.react;
    let tiles: HTMLElement | null = null;
    let note: HTMLElement | null = null;
    let change: HTMLElement | null = null;
    if (r && !r.canReact) {
      note = h('p', { class: 'gh-hint center' }, 'The game marks this one.');
      tiles = reactionTiles(r.picked, null, true);
    } else if (r) {
      const key = `${game.round}:${r.index}`;
      const open = !r.picked || changing === key;
      tiles = reactionTiles(
        r.picked,
        open
          ? (x) => {
              changing = '';
              send({ kind: 'react', index: r.index, reaction: x });
              buzz(40);
              bump();
            }
          : null,
        !open,
      );
      if (!r.picked) note = h('p', { class: 'gh-hint center' }, 'React any time. It locks 3 s after they stop.');
      else if (open) note = h('p', { class: 'gh-hint center' }, 'Tap your new pick.');
      else {
        note = h('p', { class: 'gh-locked center' }, '✓ Locked in · on the TV now');
        let secs = '';
        if (game.step === 'react') {
          const left = game.stepAt + REACT_MS - serverNow(ctx);
          if (left > 0) {
            secs = ` · ${Math.ceil(left / 1000)} s`;
            later('react', (left % 1000) + 20, bump);
          }
        }
        change = h('button', { type: 'button', class: 'gh-pass', onclick: () => ((changing = key), buzz(20), bump()) }, `Change my pick${secs}`);
      }
    }
    return screen(band(me, 'react to each piece of advice.'), secretCard(me, true), adviceCard(ctx, me) ?? watchCard('Watch the TV'), tiles ? dock(note, tiles, change) : null);
  }
  // The adviser whose advice is on: their TV moment.
  if (now && now.playerId === ctx.me.id) {
    const row = game.rows.find((x) => x.playerId === ctx.me.id && x.reaction);
    return screen(
      band(me, `Nobiko-san shows the caller’s secret. Points come after ${game.scripted ? 'that' : 'the laugh vote'}.`),
      playingHere(ctx, now) ?? sentCard(now.playing ? 'Your advice is on the TV now.' : ''),
      row?.reaction ? h('div', { class: 'gh-box' }, h('p', {}, `${callerName(ctx)} said `, reactionChip(row.reaction, row.auto ? 'marked by the game' : ''))) : null,
    );
  }
  const lost = me.role === 'adviser' && !me.sent && lostRound === game.round ? h('p', { class: 'gh-hint' }, 'Your clip didn’t reach the room in time, so the clips play without yours this call.') : null;
  return screen(band(me, nextVote), adviceCard(ctx, me) ?? watchCard('Watch the TV'), ownRow(ctx), lost);
}

function voteScreen(ctx: Ctx, me: HotlineMe): HTMLElement {
  const { game, view } = ctx;
  if (!me.canVote) return screen(band(me, 'the points.'), watchCard('Watch the TV'), ownRow(ctx));
  const send = (id: string) => () => (void ctx.send({ kind: 'vote', playerId: id, round: game.round }), buzz(20));
  const card = (o: HotlineMe['voteOptions'][number], on: boolean, onclick: (() => void) | null, mine = false) =>
    pictureButton({
      cls: 'gh-vote',
      on,
      onclick,
      mine,
      seat: seatChip(view, o.playerId),
      picture: o.tile ? pic(o.tile) : h('span', { class: 'gh-pic gh-emoji', 'aria-hidden': 'true' }, '💬'),
      word: o.subtitle ? plain('span', 'gh-card-ja', o.subtitle) : o.tile ? h('span', { class: 'gh-card-ja', lang: 'ja' }, tileWord(o.tile, me.level)) : null,
      en: o.tile ? o.tile.word.en : null,
      who: h('span', { class: 'gh-card-who' }, mine ? 'You · can’t vote' : nameOf(view, o.playerId)),
    });
  // Your own advice shows greyed, so the room's choices look the same on every phone.
  const own = game.rows.find((r) => r.playerId === ctx.me.id);
  const mineCard = own ? card({ playerId: own.playerId, tile: own.tile, subtitle: own.subtitle }, false, null, true) : null;
  const left = Math.max(0, game.voters - game.locked.votes.length);
  return screen(
    band(me, 'the points.'),
    h('div', { class: 'gh-box' }, h('p', { class: 'gh-strong' }, 'Which advice made you laugh?'), h('p', { class: 'gh-hint' }, own ? 'Not your own. You can change it until the timer ends.' : 'One vote. You can change it until the timer ends.')),
    me.vote ? h('p', { class: 'gh-locked' }, '✓ Vote in', left ? ` · waiting for ${left} more vote${left === 1 ? '' : 's'}…` : '') : null,
    h('div', { class: 'gh-cards' }, ...me.voteOptions.map((o) => card(o, me.vote === o.playerId, send(o.playerId))), mineCard),
    h('p', { class: 'gh-hint' }, me.vote ? 'Sending… tap another to change.' : 'The picture is the button.'),
  );
}

function noteCard(me: HotlineMe): HTMLElement | null {
  const n = me.note;
  if (!n) return null;
  const chip = n.hinted ? h('span', { class: 'gh-mark-chip' }, 'With a hint') : n.said !== null ? h('span', { class: 'gh-mark-chip memory' }, 'From memory ✓') : null;
  return h(
    'div',
    { class: 'gh-note' },
    h('p', { class: 'gh-label' }, '🔒 Private note'),
    chip,
    n.chunk ? h('p', { class: 'gh-used' }, '✓ Skill used: ', plain('span', '', n.chunk)) : null,
    n.said !== null ? h('div', { class: 'gh-note-side' }, h('p', { class: 'gh-label' }, 'You said'), plain('p', 'gh-said', n.said)) : null,
    h('div', { class: 'gh-note-side' }, h('p', { class: 'gh-label' }, 'Nobiko-san’s way'), jpView(n.model, me.level, { cls: 'gh-model' })),
    h('p', { class: 'gh-hint' }, 'Path credit only. Not on the scoreboard.'),
  );
}

function boothCard(ctx: Ctx, me: HotlineMe): HTMLElement | null {
  const b = ctx.game.booth;
  if (!b) return null;
  const mine = b.playerId === ctx.me.id;
  // The line is the player's own words: plain text, with the chunk lit where it appears.
  const line = h('p', { class: 'gh-said', lang: 'ja' });
  const at = b.chunk ? b.line.indexOf(b.chunk) : -1;
  if (at >= 0) {
    const lit = document.createElement('mark');
    lit.className = 'gh-lit';
    lit.textContent = b.chunk;
    line.append(b.line.slice(0, at), lit, b.line.slice(at + b.chunk.length));
  } else line.textContent = b.line;
  return h(
    'div',
    { class: 'gh-note' },
    h('p', { class: 'gh-label' }, mine ? '✓ Skill used' : `Replay · ${nameOf(ctx.view, b.playerId)}`),
    mine ? plain('p', 'gh-chunk', b.chunk) : line,
    h('p', {}, b.note),
    b.tag ? h('p', { class: 'gh-tag' }, '🚃 ', me.level === 'n4' ? `You’re on this line: ${b.tag}` : `Coming up on your map: ${b.tag}`) : null,
  );
}

function scoreScreen(ctx: Ctx, me: HotlineMe): HTMLElement {
  const { game } = ctx;
  const next = game.round < game.totalRounds ? 'the next call.' : 'the results.';
  // The TV runs the tally and the top laugh first: phones flip to their own points as the TV's land.
  if (game.step === 'points') {
    const left = game.stepAt + POINTS_LAND_MS - serverNow(ctx);
    if (left > 0) {
      later('points', left + 20, bump);
      return screen(band(me, next), watchCard('Watch the TV', 'Your points come in a moment.'));
    }
  }
  const lines = me.breakdown.filter((x) => x.points !== 0);
  return screen(
    band(me, next),
    h('p', { class: 'gh-label center' }, 'This call'),
    h('p', { class: 'gh-points' }, `+${me.points ?? 0}`),
    lines.length ? h('ul', { class: 'gh-breakdown' }, ...lines.map((x) => h('li', {}, h('span', { lang: x.why === 'soreda' || x.why === 'oshii' || x.why === 'sweep' ? 'ja' : 'en' }, WHY[x.why] ?? x.why), h('b', {}, `${x.points > 0 ? '+' : ''}${x.points}`)))) : null,
    noteCard(me),
    boothCard(ctx, me),
  );
}

/** The VIP can take a piece of advice off the TV (it earns nothing). */
function vipFold(ctx: Ctx): HTMLElement | null {
  const { game, view } = ctx;
  if (!ctx.isVip || (view.phase !== 'reveal' && view.phase !== 'encore')) return null;
  const ids: { id: string; text: string | null }[] = [];
  for (const r of game.rows) if (r.kind !== 'nobiko' && !r.hidden) ids.push({ id: r.playerId, text: r.subtitle });
  if (game.play && game.play.kind !== 'nobiko' && !game.play.hidden && !ids.some((x) => x.id === game.play!.playerId)) ids.push({ id: game.play.playerId, text: null });
  const shown = ids.filter((x) => !hiddenByMe.has(`${game.round}:${x.id}`));
  if (!shown.length) return null;
  return h(
    'details',
    { class: 'gh-vip' },
    h('summary', {}, 'VIP: hide a piece of advice'),
    ...shown.map((x) =>
      h(
        'button',
        {
          type: 'button',
          class: 'vip-hide',
          onclick: () => {
            hiddenByMe.add(`${game.round}:${x.id}`);
            void ctx.send({ kind: 'hide', playerId: x.id, round: game.round });
            bump();
          },
        },
        `🚫 Hide ${nameOf(view, x.id)}’s advice `,
        x.text ? plain('span', '', `“${x.text}”`) : null,
      ),
    ),
  );
}

export const ghostHotlinePhone: PhoneMode<HotlineView> = {
  key: (view, game) =>
    [
      view.phaseSeq,
      game.step,
      game.stepAt,
      game.round,
      JSON.stringify(game.me),
      local,
      JSON.stringify(game.play),
      JSON.stringify(game.rows),
      JSON.stringify(game.locked),
      game.secret?.cure.id ?? '',
      game.booth ? JSON.stringify(game.booth) : '',
      game.call?.said ? 's' : '',
      game.scripted ? 'c' : '',
    ].join('|'),

  render(ctx) {
    latest = ctx;
    const { view, game } = ctx;
    const me = game.me;
    newRound(game.round);
    // A take left running when the record beat ends is sent as it is (the caller's line may run on).
    if (rec && (rec.round !== game.round || (rec.purpose === 'advice' && view.phase !== 'answer') || (rec.purpose === 'say' && view.phase !== 'prompt' && view.phase !== 'answer'))) void stopAndSend();
    if (pending && (view.phase !== 'answer' || pending.round !== game.round)) retryPending();
    if (view.phase !== 'reveal') cancel('react');
    if (view.phase !== 'score') cancel('points');
    armTypedSend(ctx);
    let out: HTMLElement;
    switch (view.phase) {
      case 'intro':
        out = introScreen(ctx);
        break;
      case 'prompt':
      case 'answer':
        if (!me?.role) out = waiting('Look at the TV!');
        else if (me.role === 'caller') out = callerScreen(ctx, me);
        else if (me.role === 'adviser') out = adviserScreen(ctx, me);
        else out = galleryScreen(ctx, me);
        break;
      case 'reveal':
        out = me ? revealScreen(ctx, me) : waiting('Look at the TV!');
        break;
      case 'encore':
        out = me ? voteScreen(ctx, me) : waiting('Look at the TV!');
        break;
      case 'score':
        out = me ? scoreScreen(ctx, me) : waiting('Look at the TV!');
        break;
      default:
        out = waiting('Look at the TV!');
    }
    // The VIP's fold sits above the dock, so the dock stays the last thing under the thumb.
    const fold = vipFold(ctx);
    if (fold) {
      const d = out.querySelector(':scope > .gh-dock');
      if (d) d.before(fold);
      else out.append(fold);
    }
    return out;
  },
};
