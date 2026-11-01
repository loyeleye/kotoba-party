// Late Again! on the phone. Your role is on the band every beat (📞 late, 👀 witness, 🎀 chief, 🍿 gallery),
// with a "Next:" line under the main card. The one thing to tap sits in a dock at the bottom (.la-dock), under
// the thumb, however long the screen above it grows.
//
//   Scene    your role card, and your leaves. Late (N5/N4): the witness's three causes already, so the plan
//            starts early. Nothing is ticked until you tap one.
//   Plan     late: tap a cause to blame; then your mission, a hint behind a tap, and I'm ready. Kana: tap up to
//            three tiles (ごめんなさい！, a cause, たぬき！), say them out loud. The mic pass sits at the top,
//            away from the dock, and asks twice. Quiet mode or a dead mic: type it from here on.
//            witness: what did you "see"? Three causes and the curveball. gallery: bet on the cause.
//            chief: the leaves in the room, live.
//   Record   late: one button, Plan → Recording → Sent (tap to start, tap to stop, it sends itself at the
//            limit), with the seconds left. Typing: the draft sends itself just before the deadline.
//            Everyone's picks are locked in.
//   Play     N4: the listening check. Kana and N5: tap each word you hear. Late: your excuse is on (or on this
//            phone, when the room's clip memory was full: turn it up).
//   Gist     the gist at your level; your check's answer, privately.
//   Vote     voters: give a leaf (Safe) or keep it; no leaf, nothing to tap. chief: how many can say Safe, big,
//            then ◯ セーフ (sky blue) or ✕ アウト (vermilion), full width, one above the other. Two players: the
//            chief only names the cause.
//   Ruling   your points, by reason; the chief's read of the room; the latecomer's private note (what you
//            said, Pon's way, from memory or with a hint). The booth's tag at your level.

import { h } from '../../../shared/src/dom.js';
import { UPLOAD_MS, type LateMe, type LateView, type TileView } from '../../../shared/src/modes/lateAgain/lateAgain.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import { MicClip, recordReady, uploadClip } from '../components/mic.js';
import { isQuiet } from '../components/speak.js';
import { jpView } from '../components/jp.js';
import { waiting } from '../components/ui.js';
import type { PhoneContext, PhoneMode } from './types.js';
import { boothTag } from '../../../shared/src/level.js';

type Ctx = PhoneContext<LateView>;
type Send = (move: Record<string, unknown>) => void;

const nameOf = (view: RoomView, id: string | null | undefined): string => view.players.find((p) => p.id === id)?.name ?? '';
const ART = (picture: string): string => `/stage/assets/late/${picture}.png`;
const LEAF = '/stage/assets/late/leaf.png';
/** Taps on the record button this soon after it appears are the tail of a double tap on Ready. */
const REC_GUARD_MS = 600;
/** A typed draft goes in this long before the record beat's deadline. */
const TYPED_EARLY_MS = 800;

const buzz = (ms = 60) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // no vibration here
  }
};

// ---- local state, kept across redraws ----

let local = 0;
const bump = (ctx: Ctx) => {
  local++;
  ctx.redraw();
};
/** The round the per-round state below belongs to. */
let roundSeen = 0;
/** 0 closed; N5 opens the sentence frame first (1), then Pon's version (2). Other levels go straight to 2. */
let hint = { round: 0, step: 0 };
/** started: when the mic opened; ms: how long this take may run (the level's limit, capped by the deadline). */
let rec: { round: number; clip: MicClip; started: number | null; ms: number; timer: ReturnType<typeof setTimeout> | null } | null = null;
let sending = false;
let problem = '';
/** The typed excuse in progress (quiet mode, or a dead mic). */
let typed = '';
/** The mic failed to open this game: type instead, until the player asks to try it again. */
let micDead = false;
/** The mic pass was tapped once this round and is asking to be sure. */
let passAsk = false;
/** When the record button first showed this round, for the double-tap guard. */
let recShownAt = 0;
let ticker: ReturnType<typeof setTimeout> | null = null;
let autoSend: ReturnType<typeof setTimeout> | null = null;
/** Kept takes by round, so a phone that plays its own clip can. */
const kept = new Map<number, string>();
let playedKey = '';
let player: HTMLAudioElement | null = null;
/** The browser refused to autoplay this phone's own clip: it needs a tap. */
let playBlocked = false;

function newRound(round: number): void {
  if (round === roundSeen) return;
  roundSeen = round;
  problem = '';
  typed = '';
  passAsk = false;
  recShownAt = 0;
  playBlocked = false;
}

/** Typing replaces the mic: quiet mode, no mic or room speech, or a mic that wouldn't open. */
const typing = (): boolean => isQuiet() || !recordReady() || micDead;

function startRecording(ctx: Ctx, me: LateMe): void {
  if (rec || sending) return;
  problem = '';
  const round = ctx.game.round;
  const clip = new MicClip({ raw: true });
  rec = { round, clip, started: null, ms: me.limitMs, timer: null };
  bump(ctx);
  // The take starts when the mic is open, never before: the first syllable would be lost.
  void clip.ready.then((ok) => {
    if (rec?.clip !== clip) return;
    if (!ok) {
      rec = null;
      // No mic, no game: the typed box takes over.
      micDead = true;
      problem = clip.blocked ? 'The microphone is blocked. Type your excuse instead, or let Pon say it.' : 'Couldn’t open the microphone. Type your excuse instead, or let Pon say it.';
      return bump(ctx);
    }
    buzz(40);
    // The phase holds the limit, a grace and the upload: the take must stop in time to upload. A slow mic
    // (a first-time permission prompt) eats into the take, not into the upload.
    const left = ctx.remainingMs();
    rec.ms = Math.max(500, Math.min(me.limitMs, left === null ? me.limitMs : left - UPLOAD_MS));
    rec.started = Date.now();
    rec.timer = setTimeout(() => void stopAndSend(ctx), rec.ms);
    bump(ctx);
  });
}

async function stopAndSend(ctx: Ctx): Promise<void> {
  const r = rec;
  if (!r) return;
  rec = null;
  if (r.timer) clearTimeout(r.timer);
  const wav = r.clip.stop();
  if (!wav || wav.length <= 44 || r.started === null) {
    problem = 'Didn’t hear anything. Tap and talk!';
    return bump(ctx);
  }
  sending = true;
  bump(ctx);
  let res = await uploadClip(wav, true);
  let mine = false;
  // The room's clip memory is full: this phone plays it instead.
  if (!res.ok && res.why === 'full') {
    res = await uploadClip(wav, false);
    mine = true;
  }
  sending = false;
  if (!res.ok) {
    problem = 'Couldn’t send that. Try again?';
    return bump(ctx);
  }
  if (mine || !res.clipId) kept.set(r.round, URL.createObjectURL(new Blob([wav], { type: 'audio/wav' })));
  const ok = await ctx.send({ kind: 'excuse', type: 'clip', clipId: res.clipId, local: mine || !res.clipId, durMs: res.durMs || Math.round(((wav.length - 44) / 32_000) * 1000), heard: res.heard, checked: res.checked, round: r.round });
  if (ok) buzz(80);
  bump(ctx);
}

/** While a take runs, redraw on each second so the countdown moves. */
function tickWhileLive(ctx: Ctx): void {
  if (ticker || !rec || rec.started === null) return;
  const into = (Date.now() - rec.started) % 1000;
  ticker = setTimeout(() => {
    ticker = null;
    if (rec?.started != null) bump(ctx);
  }, 1000 - into + 10);
}

function sendTyped(ctx: Ctx, round: number): void {
  const text = typed.trim();
  if (!text) return;
  void ctx.send({ kind: 'excuse', type: 'typed', text, round }).then((ok) => ok && buzz(80));
}

/** A typed draft goes in by itself just before the record beat ends; an empty one leaves it to Pon. */
function armTypedSend(ctx: Ctx): void {
  if (autoSend) clearTimeout(autoSend);
  autoSend = null;
  const { view, game } = ctx;
  const me = game.me;
  const left = ctx.remainingMs();
  if (view.phase !== 'answer' || left === null || !me?.canType || me.sent || !typing()) return;
  const round = game.round;
  autoSend = setTimeout(
    () => {
      autoSend = null;
      if (ctx.game.round === round && !ctx.game.me?.sent) sendTyped(ctx, round);
    },
    Math.max(0, left - TYPED_EARLY_MS),
  );
}

function playMine(ctx: Ctx, round: number, again = false): void {
  const key = `late:${round}`;
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
      bump(ctx);
    },
    () => {
      // iOS and others refuse audio that a tap didn't start: offer the tap.
      playBlocked = true;
      bump(ctx);
    },
  );
}

// ---- pieces ----

const ROLE: Record<NonNullable<LateMe['role']>, { icon: string; label: string }> = {
  latecomer: { icon: '📞', label: 'You’re late!' },
  witness: { icon: '👀', label: 'Witness' },
  chief: { icon: '🎀', label: 'Acting chief' },
  gallery: { icon: '🍿', label: 'Gallery' },
};

const WHY: Record<LateMe['breakdown'][number]['why'], string> = {
  leaf: 'Leaves',
  alibi: 'Alibi matched',
  chief: 'Read the room',
  bet: 'Right bet',
  check: 'Listening',
  catch: 'Listening',
  coop: 'Team',
  spoke: 'Spoke it',
  stake: 'Gave a leaf to a Safe',
  curve: 'Curveball',
};

function band(me: LateMe, next: string): HTMLElement {
  const role = me.role ? ROLE[me.role] : null;
  return h(
    'div',
    { class: 'la-band' },
    role ? h('span', { class: 'la-role-chip' }, role.icon, ' ', role.label) : null,
    h('span', { class: 'la-band-leaves', 'aria-label': `${me.leaves} leaves` }, ...Array.from({ length: me.leaves }, () => h('img', { class: 'la-leaf', src: LEAF, alt: '' }))),
    h('p', { class: 'la-next' }, 'Next: ', next),
  );
}

/** The bottom dock: the screen's main action, under the thumb. */
const dock = (...children: (HTMLElement | null)[]): HTMLElement => h('div', { class: 'la-dock' }, ...children);

function pic(t: TileView): HTMLElement {
  if (t.picture === 'sorry' || t.picture === 'sound') return h('span', { class: 'la-pic la-emoji', 'aria-hidden': 'true' }, t.emoji);
  return h('img', { class: 'la-pic', src: ART(t.picture), alt: '', draggable: 'false' });
}

function tileButton(t: TileView, on: boolean, onclick: (() => void) | null, extra = ''): HTMLElement {
  // A long word shrinks to fit its tile on one line, so 「！」 never wraps alone.
  const n = [...t.word.text].length;
  return h(
    'button',
    { type: 'button', class: `la-tile${on ? ' on' : ''} ${extra}`, disabled: !onclick, onclick: onclick ?? undefined, 'aria-pressed': on ? 'true' : 'false' },
    pic(t),
    h('span', { class: `la-tile-ja${n >= 5 ? ' fit' : ''}`, lang: 'ja', style: n >= 5 ? `--n: ${n}` : null }, t.word.text),
    t.romaji ? h('span', { class: 'la-tile-ro' }, t.romaji) : null,
    h('span', { class: 'la-tile-en' }, t.word.en),
  );
}

function gistCard(me: LateMe, who: string): HTMLElement | null {
  if (!me.gist) return null;
  return h('div', { class: 'la-gist' }, h('p', { class: 'la-label' }, `The gist of ${who}’s excuse`), jpView(me.gist, me.level, { cls: 'la-gist-line' }));
}

const problemLine = (): HTMLElement | null => (problem ? h('p', { class: 'la-problem', role: 'alert' }, problem) : null);

/** The once-a-game mic pass: at the top of the screen, far from the dock, and it asks before it spends. */
function passButton(ctx: Ctx, me: LateMe, send: Send): HTMLElement | null {
  if (!me.micPassLeft) return null;
  if (me.level !== 'kana' && !me.cause) return null;
  if (!passAsk)
    return h('button', { type: 'button', class: 'la-pass', onclick: () => ((passAsk = true), buzz(20), bump(ctx)) }, '🦝 Stuck? Pon can say it for you (once a game)');
  return h(
    'div',
    { class: 'la-pass-ask' },
    h('button', { type: 'button', class: 'la-pass ask', onclick: () => ((passAsk = false), send({ kind: 'micPass' })) }, '🦝 Tap again to let Pon say it'),
    h('button', { type: 'button', class: 'la-pass', onclick: () => ((passAsk = false), bump(ctx)) }, 'Keep going: I’ll say it'),
  );
}

// ---- screens ----

function sceneScreen(ctx: Ctx, me: LateMe): HTMLElement {
  const { view, game } = ctx;
  const late = nameOf(view, game.cast?.latecomer);
  const what: Record<NonNullable<LateMe['role']>, string> = {
    latecomer: `You’re ${game.scene?.late.en ?? 'very'} late for ${game.scene?.place.en ?? 'work'}. Phone the boss with an excuse!`,
    witness: `${late} is late. Back their story up: you “saw” what happened.`,
    chief: game.coop ? `${late} is phoning you. Listen to the excuse, then say what they blamed.` : `You wear Pon’s sash today. Listen to ${late}’s excuse, then rule Safe or Out.`,
    gallery: `${late} is late. Bet on what they’ll blame, then spend your leaf if you like the excuse.`,
  };
  return h(
    'div',
    { class: 'screen la-screen' },
    band(me, 'the plan'),
    h('p', { class: 'big' }, me.role ? `${ROLE[me.role].icon} ${ROLE[me.role].label}` : 'Look at the TV!'),
    me.role ? h('p', {}, what[me.role]) : null,
    me.role === 'latecomer' && me.mission ? h('p', { class: 'la-mission' }, me.mission.text) : null,
  );
}

/** The latecomer's phone while their clip plays on it, when the room's clip memory was full. */
function playingHere(ctx: Ctx): HTMLElement | null {
  const { view, game } = ctx;
  if (view.phase !== 'reveal' || game.step !== 'play' || !game.play?.local) return null;
  playMine(ctx, game.round);
  return h(
    'div',
    { class: 'la-local' },
    h('p', { class: 'la-mission' }, '🔊 Your phone plays it: turn it up and hold it up!'),
    playBlocked && kept.has(game.round) ? h('button', { type: 'button', class: 'primary la-play', onclick: () => playMine(ctx, game.round, true) }, '▶ Play it') : null,
  );
}

function recordButton(ctx: Ctx, me: LateMe): HTMLElement {
  const { game } = ctx;
  if (!recShownAt) recShownAt = Date.now();
  const on = rec?.round === game.round;
  const live = on && rec!.started !== null;
  const elapsed = live ? Date.now() - rec!.started! : 0;
  const ms = live ? rec!.ms : me.limitMs;
  const secs = Math.max(0, Math.ceil((ms - elapsed) / 1000));
  if (live) tickWhileLive(ctx);
  const label = sending ? 'Sending…' : live ? '■ Stop and send' : on ? 'Opening the mic…' : '● Tap to record';
  return h(
    'button',
    {
      type: 'button',
      class: `la-rec-btn${live ? ' live' : ''}${on && !live ? ' opening' : ''}`,
      disabled: sending || (on && !live),
      'aria-live': 'polite',
      // The fill restarts from the real elapsed time if the button is ever drawn again (the delay is sticky
      // across morphs, see shared/src/dom.ts syncStyle, so a redraw never pushes it forward).
      style: live ? `--ms: ${ms}ms; --la-rec-delay: -${elapsed}ms` : null,
      onclick: () => {
        if (on) return void stopAndSend(ctx);
        if (Date.now() - recShownAt < REC_GUARD_MS) return;
        startRecording(ctx, me);
      },
    },
    h('span', { class: 'la-rec-ring', 'aria-hidden': 'true' }),
    h('span', { class: 'la-rec-label' }, label),
    live ? h('span', { class: 'la-rec-secs' }, `${secs} s left`) : !on && !sending ? h('span', { class: 'la-rec-secs' }, 'tap again to stop') : null,
  );
}

function typedBox(ctx: Ctx): HTMLElement {
  const record = ctx.view.phase === 'answer';
  const retry = micDead && !isQuiet() && recordReady();
  return h(
    'div',
    { class: 'la-typed' },
    h('p', { class: 'la-label' }, isQuiet() ? 'Quiet mode: type your excuse.' : 'Type your excuse.', record ? ' It sends itself just before time runs out.' : ' Start now: it sends itself when the call ends.'),
    h('input', { type: 'text', maxlength: '80', lang: 'ja', enterkeyhint: 'send', placeholder: 'Type your excuse in Japanese', value: typed, oninput: (e: Event) => (typed = (e.target as HTMLInputElement).value) }),
    retry ? h('button', { type: 'button', class: 'la-pass', onclick: () => ((micDead = false), (problem = ''), bump(ctx)) }, '🎤 Try the mic again') : null,
  );
}

function lateScreen(ctx: Ctx, me: LateMe): HTMLElement {
  const { game, view } = ctx;
  if (me.sent) {
    return h('div', { class: 'screen la-screen' }, band(me, 'the room rules on it'), h('p', { class: 'big' }, 'Sent ✓'), playingHere(ctx) ?? h('p', { class: 'hint' }, 'Watch the TV!'));
  }
  const send: Send = (move) => void ctx.send({ ...move, round: game.round });
  const scene = game.step === 'scene';
  const record = view.phase === 'answer';

  if (me.level === 'kana') {
    const draft = me.draft;
    const toggle = (id: string) => {
      const next = draft.includes(id) ? draft.filter((t) => t !== id) : draft.length < 3 ? [...draft, id] : draft;
      send({ kind: 'tiles', tiles: next });
      buzz(20);
    };
    return h(
      'div',
      { class: 'screen la-screen' },
      band(me, record ? 'it sends itself when time runs out' : 'tap your excuse'),
      passButton(ctx, me, send),
      h('p', { class: 'la-mission' }, me.mission?.text ?? ''),
      h('div', { class: 'la-tiles' }, ...me.tiles.map((t) => tileButton(t, draft.includes(t.id), () => toggle(t.id), t.id === 'tanuki' ? 'la-curve' : ''))),
      h('p', { class: 'la-built', lang: 'ja' }, draft.length ? draft.map((id) => me.tiles.find((t) => t.id === id)?.word.text ?? '').join(' ') : '…'),
      h('p', { class: 'hint' }, '🗣 Say it out loud to the room too!'),
      problemLine(),
      dock(h('button', { type: 'button', class: 'primary la-send', disabled: !draft.length, onclick: () => send({ kind: 'excuse', type: 'tiles', tiles: draft }) }, 'Send ✓')),
    );
  }

  const options = me.canPick
    ? h('div', { class: 'la-tiles la-tiles-3' }, ...game.options.map((t) => tileButton(t, me.cause === t.id, () => (send({ kind: 'cause', causeId: t.id }), buzz(20)))))
    : me.cause
      ? h('div', { class: 'la-tiles la-tiles-1' }, ...game.options.filter((t) => t.id === me.cause).map((t) => tileButton(t, true, null)))
      : null;
  const step = hint.round === game.round ? hint.step : 0;
  const frame = me.mission?.frame;
  const open = (n: number) => () => {
    hint = { round: game.round, step: n };
    // Opening the hint makes this excuse "read" for the learning path, not said from memory.
    send({ kind: 'hint' });
    bump(ctx);
  };
  const hintBox = me.mission
    ? h(
        'div',
        { class: 'la-hint' },
        step === 0 ? h('button', { type: 'button', class: 'ghost', onclick: open(frame ? 1 : 2) }, 'Need a hint?') : null,
        step === 0 ? h('p', { class: 'la-hint-cost' }, 'Peeking counts it as read, not said from memory.') : null,
        step >= 1 && frame ? h('div', { class: 'la-frame' }, h('p', { class: 'la-label' }, 'Fill the gap:'), jpView(frame, me.level, { cls: 'la-model' })) : null,
        step === 1 ? h('button', { type: 'button', class: 'ghost', onclick: open(2) }, 'Still stuck? See Pon’s version') : null,
        step >= 2 ? h('div', {}, h('p', { class: 'la-label' }, 'Pon’s version:'), jpView(me.mission.model, me.level, { cls: 'la-model' })) : null,
      )
    : null;

  const typingNow = typing() && me.canType;
  let action: HTMLElement | null;
  if (scene) {
    action = null;
  } else if (!record) {
    action = me.ready ? h('p', { class: 'hint la-ready-done' }, 'Ready ✓ The call opens in a moment.') : h('button', { type: 'button', class: 'primary', onclick: () => send({ kind: 'ready' }) }, 'I’m ready');
  } else if (typing()) {
    action = h('button', { type: 'button', class: 'primary la-send', disabled: !me.canType, onclick: () => sendTyped(ctx, game.round) }, 'Send ✓');
  } else {
    action = recordButton(ctx, me);
  }
  // Nothing is ticked until the latecomer taps: the mission waits for the pick.
  const label = !me.canPick ? h('p', { class: 'la-label' }, 'You’re blaming:') : me.cause ? h('p', { class: 'la-label' }, 'You’re blaming this. Tap another to change:') : h('p', { class: 'la-mission' }, 'Pick what to blame', h('span', { class: 'la-sub' }, 'The witness has the same three.'));
  return h(
    'div',
    { class: 'screen la-screen' },
    band(me, scene ? 'the plan' : record ? `up to ${Math.round(me.limitMs / 1000)} s, then the TV plays it` : 'record your excuse'),
    scene ? h('p', {}, `You’re ${game.scene?.late.en ?? 'very'} late for ${game.scene?.place.en ?? 'work'}. Phone the boss with an excuse!`) : passButton(ctx, me, send),
    label,
    options,
    me.mission ? h('p', { class: 'la-mission' }, me.mission.text) : null,
    hintBox,
    typingNow ? typedBox(ctx) : null,
    problemLine(),
    action ? dock(action) : null,
  );
}

function witnessScreen(ctx: Ctx, me: LateMe): HTMLElement {
  const late = nameOf(ctx.view, ctx.game.cast?.latecomer);
  const locked = me.lockedIn;
  const pick = (id: string) => () => void ctx.send({ kind: 'alibi', tileId: id, round: ctx.game.round });
  return h(
    'div',
    { class: 'screen la-screen' },
    band(me, 'listen to the excuse'),
    h('p', { class: 'la-mission' }, `What did you “see” make ${late} late? Pick the one they’ll blame. Or swear it was a tanuki (once a game).`),
    h('div', { class: 'la-tiles' }, ...me.alibiTiles.map((t) => tileButton(t, me.alibi === t.id, locked ? null : pick(t.id), t.id === 'tanuki' ? 'la-curve' : ''))),
    me.alibi ? h('p', { class: 'hint' }, locked ? 'Locked in ✓ Listen to the excuse.' : 'Locked in when the call starts. You can still change it.') : locked ? h('p', { class: 'hint' }, 'Locked: no alibi this round.') : null,
  );
}

function galleryScreen(ctx: Ctx, me: LateMe): HTMLElement {
  const late = nameOf(ctx.view, ctx.game.cast?.latecomer);
  const locked = me.lockedIn;
  const bet = (id: string) => () => void ctx.send({ kind: 'bet', causeId: id, round: ctx.game.round });
  return h(
    'div',
    { class: 'screen la-screen' },
    band(me, 'listen to the excuse'),
    h('p', { class: 'la-mission' }, `Bet: what will ${late} blame? (+20)`),
    h('div', { class: 'la-tiles la-tiles-3' }, ...ctx.game.options.map((t) => tileButton(t, me.bet === t.id, locked ? null : bet(t.id)))),
    me.bet ? h('p', { class: 'hint' }, locked ? 'Bet in ✓ Listen for the excuse.' : 'Bet in ✓ Locked in when the call starts.') : locked ? h('p', { class: 'hint' }, 'Bets are locked. Listen!') : null,
  );
}

/** The room's leaves, for the chief to read (they're on the TV too, but small). */
function roomLine(ctx: Ctx): HTMLElement | null {
  const voters = ctx.game.voters;
  if (!voters.length) return null;
  const leaves = voters.reduce((n, v) => n + v.leaves, 0);
  return h('p', { class: 'la-room' }, h('img', { class: 'la-leaf', src: LEAF, alt: '' }), ` × ${leaves} in the room · ${ctx.game.holders} of ${voters.length} can say Safe`);
}

function chiefWait(ctx: Ctx, me: LateMe): HTMLElement {
  const late = nameOf(ctx.view, ctx.game.cast?.latecomer);
  if (ctx.game.coop)
    return h('div', { class: 'screen la-screen' }, band(me, 'what did they blame?'), h('p', { class: 'big' }, '🎀 Acting chief'), h('p', {}, `${late} is phoning you. Listen to the excuse: then say what they blamed.`));
  return h(
    'div',
    { class: 'screen la-screen' },
    band(me, 'listen, then rule'),
    h('p', { class: 'big' }, '🎀 Acting chief'),
    h('p', {}, `${late} is phoning you. Listen to the excuse. Then: will the room say Safe or Out?`),
    roomLine(ctx),
    h('p', { class: 'hint' }, 'Match the room = +100. Who can still say Safe?'),
  );
}

function listenScreen(ctx: Ctx, me: LateMe): HTMLElement {
  const { game, view } = ctx;
  const late = nameOf(view, game.cast?.latecomer);
  if (me.role === 'latecomer') return lateScreen(ctx, me);
  const send: Send = (move) => void ctx.send({ ...move, round: game.round });
  const parts: (HTMLElement | null)[] = [band(me, 'the gist, then the vote'), h('p', { class: 'la-label' }, `🔊 ${late}’s excuse is playing on the TV`)];
  const gisting = game.step !== 'play';
  if (me.check) {
    const c = me.check;
    parts.push(
      h('p', { class: 'la-mission' }, c.q, gisting ? '' : ' (+30)'),
      h(
        'div',
        { class: 'la-choices' },
        ...c.options.map((o, i) =>
          h(
            'button',
            { type: 'button', class: `la-choice${c.picked === i ? ' on' : ''}${c.right === i ? ' right' : ''}`, disabled: c.picked !== null || gisting, onclick: () => send({ kind: 'check', option: i }) },
            o,
            c.right === i ? ' ✓' : c.right !== null && c.picked === i ? ' ✗' : '',
          ),
        ),
      ),
    );
  }
  if (me.catchTiles.length) {
    parts.push(
      h('p', { class: 'la-mission' }, gisting ? 'Words you caught:' : 'Tap the words you hear: +10 each, a wrong tap costs 10.'),
      h('div', { class: 'la-tiles la-tiles-4' }, ...me.catchTiles.map((t) => tileButton(t, t.tapped, gisting || t.tapped ? null : () => send({ kind: 'catch', wordId: t.id })))),
    );
  }
  if (gisting) parts.push(gistCard(me, late));
  if (!me.check && !me.catchTiles.length && !gisting) parts.push(h('p', { class: 'hint' }, 'Listen!'));
  return h('div', { class: 'screen la-screen' }, ...parts);
}

function voteScreen(ctx: Ctx, me: LateMe): HTMLElement {
  const { game, view } = ctx;
  const late = nameOf(view, game.cast?.latecomer);
  const send: Send = (move) => void ctx.send({ ...move, round: game.round });
  if (me.role === 'chief') {
    // Two players: the chief names the cause, and that's their turn. Pon rules.
    if (game.coop) {
      if (!me.coopPick)
        return h(
          'div',
          { class: 'screen la-screen' },
          band(me, 'Pon’s ruling'),
          h('p', { class: 'la-mission' }, `What did ${late} blame? (+100 for the team)`),
          h('div', { class: 'la-tiles la-tiles-3' }, ...game.options.map((t) => tileButton(t, false, () => (send({ kind: 'pick', causeId: t.id }), buzz(20))))),
        );
      const picked = game.options.find((t) => t.id === me.coopPick);
      return h(
        'div',
        { class: 'screen la-screen' },
        band(me, 'Pon’s ruling'),
        h('p', { class: 'la-label' }, 'You said they blamed:'),
        picked ? h('div', { class: 'la-tiles la-tiles-1' }, tileButton(picked, true, null)) : null,
        gistCard(me, late),
        h('p', { class: 'hint' }, 'Watch the TV!'),
      );
    }
    return h(
      'div',
      { class: 'screen la-screen' },
      band(me, 'the ruling'),
      h('p', { class: 'la-holders' }, h('b', {}, String(game.holders)), ` of ${game.voters.length} can say Safe`),
      gistCard(me, late),
      h('p', { class: 'la-mission' }, 'Will the room forgive them? Rule:'),
      h('p', { class: 'hint' }, '🗣 Say it out loud as you tap!'),
      dock(
        h('button', { type: 'button', class: `la-call la-safe${me.call === 'safe' ? ' on' : ''}`, lang: 'ja', onclick: () => send({ kind: 'rule', call: 'safe' }) }, h('span', { class: 'la-mark la-mark-safe', 'aria-hidden': 'true' }), 'セーフ！', h('small', { lang: 'en' }, 'Safe')),
        h('button', { type: 'button', class: `la-call la-out${me.call === 'out' ? ' on' : ''}`, lang: 'ja', onclick: () => send({ kind: 'rule', call: 'out' }) }, h('span', { class: 'la-mark la-mark-out', 'aria-hidden': 'true' }), 'アウト！', h('small', { lang: 'en' }, 'Out')),
      ),
    );
  }
  if (me.noLeaf)
    return h(
      'div',
      { class: 'screen la-screen' },
      band(me, 'the ruling'),
      gistCard(me, late),
      h('p', { class: 'la-mission' }, 'No leaf to give this round'),
      h('p', { class: 'hint' }, 'A new leaf comes every other round. Watch the TV!'),
    );
  if (me.canVote) {
    return h(
      'div',
      { class: 'screen la-screen' },
      band(me, 'the ruling'),
      gistCard(me, late),
      h('p', { class: 'la-mission' }, `Forgive ${late}? A leaf is a Safe vote (+100 to them).`),
      h('p', { class: 'hint' }, 'Leaves are scarce: one more comes every other round, and you can hold two.'),
      dock(
        h('button', { type: 'button', class: `la-call la-give${me.gave === true ? ' on' : ''}`, onclick: () => send({ kind: 'leaf', give: true }) }, h('img', { class: 'la-leaf big', src: LEAF, alt: '' }), 'Give a leaf'),
        h('button', { type: 'button', class: `la-call la-keep${me.gave === false ? ' on' : ''}`, onclick: () => send({ kind: 'leaf', give: false }) }, '✋ Keep it'),
      ),
    );
  }
  return h('div', { class: 'screen la-screen' }, band(me, 'the ruling'), h('p', { class: 'big' }, me.role === 'latecomer' ? '🙏 The room is deciding…' : 'Look at the TV!'));
}

function noteCard(me: LateMe): HTMLElement | null {
  const n = me.note;
  if (!n) return null;
  const mark = n.fromMemory ? h('span', { class: 'la-mark-chip memory' }, 'From memory ✓') : n.hinted ? h('span', { class: 'la-mark-chip' }, 'With a hint') : null;
  // What was heard is the player's own text: put in as text, never as markup or furigana.
  const said = n.said !== null ? h('p', { class: 'la-said', lang: 'ja' }) : null;
  if (said) said.textContent = n.said;
  return h(
    'div',
    { class: 'la-note' },
    mark,
    n.used ? h('p', { class: 'la-label' }, 'Nice: you used it!') : null,
    said ? h('div', { class: 'la-note-side' }, h('p', { class: 'la-label' }, 'You said'), said) : null,
    h('div', { class: 'la-note-side' }, h('p', { class: 'la-label' }, 'Pon’s way'), jpView(n.model, me.level, { cls: 'la-model' })),
  );
}

function scoreScreen(ctx: Ctx, me: LateMe): HTMLElement {
  const { game } = ctx;
  const b = game.booth;
  // Late Again!'s chunks are Express Line (N4) frames.
  const tag = b?.tag ? h('p', { class: 'la-tag' }, '🚃 ', boothTag(me.level, 'n4', b.tag)) : null;
  const room = me.readRoom === null ? null : h('p', { class: `la-readroom ${me.readRoom ? 'yes' : 'no'}` }, me.readRoom ? 'Read the room ✓' : 'Read the room ✗');
  const lines = me.breakdown.filter((x) => x.points !== 0);
  const breakdown = lines.length
    ? h('ul', { class: 'la-breakdown' }, ...lines.map((x) => h('li', {}, h('span', {}, WHY[x.why] ?? x.why), h('b', {}, `${x.points > 0 ? '+' : ''}${x.points}`))))
    : null;
  return h('div', { class: 'screen la-screen' }, band(me, game.round < game.totalRounds ? 'the next latecomer' : 'the results'), h('p', { class: 'big la-points' }, `+${me.points ?? 0}`), room, breakdown, noteCard(me), tag);
}

export const lateAgainPhone: PhoneMode<LateView> = {
  key: (view, game) =>
    [
      view.phaseSeq,
      game.step,
      game.round,
      JSON.stringify(game.me),
      local,
      game.booth ? 'b' : '',
      game.play?.local ? 'l' : '',
      game.options.map((o) => o.id).join(),
      game.holders,
      game.voters.map((v) => v.leaves).join(),
      game.coop ? 'c' : '',
    ].join('|'),

  render(ctx) {
    const { view, game } = ctx;
    const me = game.me;
    newRound(game.round);
    // A recording left running when the phase moves on is sent as it is.
    if (rec && (view.phase !== 'answer' || rec.round !== game.round)) void stopAndSend(ctx);
    armTypedSend(ctx);
    switch (view.phase) {
      case 'intro':
        return h(
          'div',
          { class: 'screen la-screen' },
          h('p', { class: 'big', lang: 'ja' }, 'また ちこく！'),
          h('p', {}, '📞 Each round one of you is late (again) and phones the boss with an excuse.'),
          h('p', {}, '👀 The witness backs the story up, without hearing it.'),
          h('p', {}, h('img', { class: 'la-leaf', src: LEAF, alt: '' }), ' Everyone else spends Pon’s leaves on “Safe”. The acting chief 🎀 calls Safe or Out.'),
          h('p', { class: 'hint' }, 'Your voice goes to the TV for this round only, and isn’t kept.'),
        );
      case 'prompt':
      case 'answer': {
        if (!me?.role) return waiting('Look at the TV!');
        // The latecomer plans from the scene beat on: the causes are theirs to pick as soon as they're dealt.
        if (me.role === 'latecomer' && (game.step !== 'scene' || (me.level !== 'kana' && me.canPick))) return lateScreen(ctx, me);
        if (game.step === 'scene') return sceneScreen(ctx, me);
        if (me.role === 'latecomer') return lateScreen(ctx, me);
        if (me.role === 'witness') return witnessScreen(ctx, me);
        if (me.role === 'gallery') return galleryScreen(ctx, me);
        return chiefWait(ctx, me);
      }
      case 'reveal':
        return me ? listenScreen(ctx, me) : waiting('Look at the TV!');
      case 'encore':
        return me ? voteScreen(ctx, me) : waiting('Look at the TV!');
      case 'score':
        return me ? scoreScreen(ctx, me) : waiting('Look at the TV!');
      default:
        return waiting('Look at the TV!');
    }
  },
};
