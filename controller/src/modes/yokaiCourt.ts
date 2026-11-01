// Yōkai Court (妖怪裁判) on the phone. Your role is on the band every beat (pixel icons: a sealed scroll for the
// prosecution, a sunflower badge for the defence, an eye for the witness, a scale for judges) with a "Next:" line. The one thing to tap sits in a dock at the bottom (.yc-dock),
// under the thumb, however long the screen above it grows.
//
//   Case      everyone: their role card (who they argue against, how they score). Judges: the case.
//   Testimony witness: Fude-san's question and four tiles (the curveball with a leaf), then "Say it out loud
//             too". Lawyers: their mission and private evidence arrive with the answer. Judges: what the
//             witness said, and a private hunch (no points).
//   Plan      speaking lawyer: mission, evidence, "Need a hint?", I'm ready. Quiet mode or no mic: type it.
//             Mic pass "1 left", asks twice; a blocked mic gets a free read. Kana lawyer: three tiles, pick
//             one or two. Judges: the hunch.
//   Record    speaking lawyer: one button, tap to start, tap to stop, it sends itself at the cap. Kana
//             lawyer: say your tiles, or let Fude-san read them. Judges: the hunch, then waiting.
//   Hear      judges: the Listening card (who, a live bar, the main claim at their level). Never the detail
//             the check asks about. Then the check: three pictures, +100 if right; a wrong one never voids
//             the vote.
//   Vote      both sides' gists side by side, prosecution left, defence right. One vote, change it until
//             the timer ends. Lawyers don't vote in their own case.
//   Verdict   "Watch the TV" until the points land, then your points by reason, a judge's result, and a
//             speaking lawyer's private note; in the booth, the chunk and your level's tag.

import { h, LEVEL_LABELS, ruby, seatShape } from '../../../shared/src/dom.js';
import { POINTS, POINTS_AT_MS, UPLOAD_MS, type ArgView, type CourtMe, type CourtView, type Role, type ThingView } from '../../../shared/src/modes/yokaiCourt/court.js';
import type { Side } from '../../../shared/src/modes/yokaiCourt/cases.js';
import type { Level } from '../../../content/src/types.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import { MicClip, recordReady, uploadClip } from '../components/mic.js';
import { isQuiet } from '../components/speak.js';
import { jpView, type JpLike } from '../components/jp.js';
import { waiting } from '../components/ui.js';
import type { PhoneContext, PhoneMode } from './types.js';

type Ctx = PhoneContext<CourtView>;
type Send = (move: Record<string, unknown>) => void;

const ART = (picture: string): string => `/stage/assets/${picture}.png`;
const LEAF = '/stage/assets/late/leaf.png';
/** Taps on the record button this soon after it appears are the tail of a double tap on Ready. */
const REC_GUARD_MS = 600;
/** A typed draft goes in this long before the record beat's deadline. */
const TYPED_EARLY_MS = 800;
/** The witness's own take of their answer (path credit only). */
const SAY_MS = 5_000;
/** A failed upload tries again this often while the record beat lasts. */
const RETRY_MS = 2_000;

const levelLabel = (l: string): string => LEVEL_LABELS[l] ?? l.toUpperCase();
const jpv = (t: JpLike, l: Level, cls = 'yc-line') => jpView(t, l, { cls });

const buzz = (ms = 60) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // no vibration here
  }
};

// ---- local state, kept across redraws ----

let local = 0;
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

let roundSeen = 0;
/** The model line is open (Need a hint?). */
let hintOpen = false;
type Purpose = 'say' | 'argue';
let rec: { round: number; purpose: Purpose; clip: MicClip; started: number | null; ms: number; timer: ReturnType<typeof setTimeout> | null } | null = null;
let sending: Purpose | null = null;
let problem = '';
let typed = '';
let micDead = false;
let micBlocked = false;
let permAsked = false;
let passAsk = false;
let recShownAt = 0;
/** The witness said their answer out loud this round. */
let saidIt = false;
let pending: { round: number; wav: Uint8Array<ArrayBuffer>; durMs: number } | null = null;
const kept = new Map<number, string>();
let playedKey = '';
let player: HTMLAudioElement | null = null;
let playBlocked = false;
const failedPics = new Set<string>();
const hiddenByMe = new Set<string>();

function newRound(round: number): void {
  if (round === roundSeen) return;
  roundSeen = round;
  hintOpen = false;
  problem = '';
  typed = '';
  passAsk = false;
  recShownAt = 0;
  saidIt = false;
  playBlocked = false;
  if (pending && pending.round !== round) pending = null;
}

if (typeof window !== 'undefined') window.addEventListener('online', () => retryPending());

const micOff = (): boolean => micBlocked || !recordReady();
const typing = (): boolean => isQuiet() || micOff() || micDead;

function serverNow(ctx: Ctx): number {
  const left = ctx.remainingMs();
  return ctx.view.deadline !== null && left !== null && left > 0 ? ctx.view.deadline - left : Date.now();
}

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

function tryMic(): void {
  const clip = new MicClip({ raw: true });
  problem = '';
  bump();
  void clip.ready.then((ok) => {
    clip.stop();
    if (ok) {
      micBlocked = false;
      micDead = false;
    } else {
      micBlocked = clip.blocked || micBlocked;
      problem = clip.blocked ? 'Still off. Allow the microphone for this page in your browser’s settings, then try again.' : 'Couldn’t open the microphone. Type your argument, or pass the mic to Fude-san.';
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
  void clip.ready.then((ok) => {
    if (rec?.clip !== clip) return;
    if (!ok) {
      rec = null;
      if (clip.blocked) micBlocked = true;
      else micDead = true;
      problem =
        purpose === 'say'
          ? 'Your mic is off. Your answer still counts: say it out loud anyway!'
          : ctx.game.me?.level === 'kana'
            ? 'Your mic is off. Fude-san can read your tiles for you.'
            : clip.blocked
              ? 'Your mic is off. Type your argument, or let Fude-san read it for free.'
              : 'Couldn’t open the microphone. Type your argument, or pass the mic to Fude-san.';
      return bump();
    }
    buzz(40);
    const now = latest ?? ctx;
    const left = now.remainingMs();
    const reserve = purpose === 'argue' ? UPLOAD_MS : 1_000;
    rec.ms = Math.max(500, Math.min(limitMs, left === null ? limitMs : left - reserve));
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
    // Only the speech check hears the witness's take: the room hears them in person.
    const res = await uploadClip(wav, false);
    sending = null;
    saidIt = true;
    const now = latest ?? ctx;
    void now.send({ kind: 'said', round: r.round, heard: res.ok ? res.heard : null, checked: res.ok ? res.checked : false }).then((ok) => ok && buzz(80));
    return bump();
  }
  await sendArgument(r.round, wav, durMs);
}

async function sendArgument(round: number, wav: Uint8Array<ArrayBuffer>, durMs: number): Promise<void> {
  sending = 'argue';
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
    pending = { round, wav, durMs };
    later('retry', RETRY_MS, retryPending);
    return bump();
  }
  pending = null;
  if (mine || !res.clipId) kept.set(round, URL.createObjectURL(new Blob([wav], { type: 'audio/wav' })));
  const ok = await ctx.send({ kind: 'argue', type: 'clip', round, clipId: res.clipId, local: mine || !res.clipId, durMs: res.durMs || durMs, heard: res.heard, checked: res.checked });
  if (ok) buzz(80);
  bump();
}

function retryPending(): void {
  const p = pending;
  const ctx = latest;
  if (!p || !ctx || sending) return;
  if (ctx.game.round !== p.round || ctx.view.phase !== 'answer' || ctx.game.me?.sent) {
    pending = null;
    return bump();
  }
  void sendArgument(p.round, p.wav, p.durMs);
}

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
    problem = 'Type your argument first.';
    return bump();
  }
  void ctx.send({ kind: 'argue', type: 'typed', text: { via: 'typed', text }, round }).then((ok) => ok && buzz(80));
}

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
  const key = `court:${round}`;
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
      playBlocked = true;
      bump();
    },
  );
}

// ---- pieces ----

const nameOf = (view: RoomView, id: string | null | undefined): string => view.players.find((p) => p.id === id)?.name ?? '';
const seatOf = (view: RoomView, id: string | null | undefined): number => view.players.find((p) => p.id === id)?.seat ?? 0;

function plain(tag: string, cls: string, text: string, lang = 'ja'): HTMLElement {
  const el = h(tag, { class: cls, lang });
  el.textContent = text;
  return el;
}

function seatChip(view: RoomView, id: string): HTMLElement | null {
  const seat = seatOf(view, id);
  return seat ? h('span', { class: `seat-badge seat-${seat} yc-seat`, 'aria-hidden': 'true' }, `${seatShape(seat)}${seat}`) : null;
}

function pic(t: { picture: string; emoji: string }, cls = 'yc-pic'): HTMLElement {
  const emoji = () => h('span', { class: `${cls} yc-emoji`, 'aria-hidden': 'true' }, t.emoji);
  if (!t.picture || failedPics.has(t.picture)) return emoji();
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

const SIDE: Record<Side, { icon: string; label: string; verdict: { text: string; kana: string }; en: string }> = {
  pros: { icon: '📜', label: 'Prosecution', verdict: { text: '有罪', kana: 'ゆうざい' }, en: 'guilty' },
  def: { icon: '🌻', label: 'Defence', verdict: { text: '無罪', kana: 'むざい' }, en: 'not guilty' },
};

const ROLE: Record<Role, { icon: string; label: string }> = {
  pros: { icon: '📜', label: 'You prosecute' },
  def: { icon: '🌻', label: 'You defend' },
  witness: { icon: '👁️', label: 'You’re the witness' },
  judge: { icon: '⚖️', label: 'You judge' },
};

/** A role's pixel icon (the emoji if the picture is missing): a sealed scroll, a sunflower badge, a scale, an eye. */
function icon(role: Role, cls = 'yc-role-icon'): HTMLElement {
  const key = `role:${role}`;
  const emoji = () => h('span', { class: cls, 'aria-hidden': 'true' }, ROLE[role].icon);
  if (failedPics.has(key)) return emoji();
  return h('img', {
    class: cls,
    src: ART(`court/role-${role}`),
    alt: '',
    draggable: 'false',
    onerror: (e: Event) => {
      failedPics.add(key);
      (e.target as HTMLElement).replaceWith(emoji());
    },
  });
}

const WHY: Record<CourtMe['breakdown'][number]['why'], string> = {
  win: 'Won the case',
  vote: 'Votes for your side',
  majority: 'Voted with the majority',
  check: 'Check right',
  heard: 'Judges heard your evidence',
};

/** What a judge can score: the majority line only shows when three or more people vote. */
const judgePoints = (ctx: Ctx): HTMLElement =>
  h(
    'ul',
    { class: 'yc-breakdown' },
    h('li', {}, h('span', {}, 'Check right'), h('b', {}, `+${POINTS.check}`)),
    ctx.view.players.length - 2 >= 3 ? h('li', {}, h('span', {}, 'Vote with the majority (3+ voters)'), h('b', {}, `+${POINTS.majority}`)) : null,
  );

function band(ctx: Ctx, me: CourtMe, next: string): HTMLElement {
  const r = me.role ? ROLE[me.role] : null;
  const side = me.role === 'pros' || me.role === 'def' ? me.role : null;
  return h(
    'div',
    { class: `yc-band${side ? ` yc-side-${side}` : ''}` },
    h('p', { class: 'yc-band-top' }, r ? h('span', { class: 'yc-role-chip' }, icon(me.role!), ` ${r.label}`) : null, h('span', { class: 'yc-caseno' }, `Case ${ctx.game.round} of ${ctx.game.totalRounds}`)),
    h('p', { class: 'yc-next' }, h('b', {}, 'Next: '), next),
    beatBar(ctx),
  );
}

/** Beats with a clock: a thin bar under the band that runs out as the TV's does (the record button has its own). */
const TIMED = new Set(['case', 'ask', 'testify', 'plan', 'check', 'gist', 'vote']);
function beatBar(ctx: Ctx): HTMLElement | null {
  const { game, view } = ctx;
  const end = game.stepEndsAt ?? view.deadline;
  if (!game.step || !TIMED.has(game.step) || !end || end <= game.stepAt) return null;
  const ms = end - game.stepAt;
  const gone = Math.min(ms, Math.max(0, serverNow(ctx) - game.stepAt));
  return h('div', { class: 'yc-beat-bar', 'aria-hidden': 'true' }, h('span', { style: `--ms: ${ms}ms; --yc-beat-delay: -${gone}ms` }));
}

const dock = (...children: (HTMLElement | null)[]): HTMLElement => h('div', { class: 'yc-dock' }, ...children);
const screen = (...children: (HTMLElement | null)[]): HTMLElement => h('div', { class: 'screen yc-screen' }, ...children);
const problemLine = (): HTMLElement | null => (problem ? h('p', { class: 'yc-problem', role: 'alert' }, problem) : null);

function liveBar(): HTMLElement {
  return h('span', { class: 'yc-live', 'aria-hidden': 'true' }, ...Array.from({ length: 6 }, (_, i) => h('span', { style: `--i: ${i}` })));
}

function caseCard(ctx: Ctx, compact = false): HTMLElement | null {
  const c = ctx.game.case;
  if (!c) return null;
  return h(
    'div',
    { class: `yc-case${compact ? ' compact' : ''}` },
    h('p', { class: 'yc-label' }, 'The case'),
    h('p', { class: 'yc-case-title', lang: 'ja' }, ruby(c.title)),
    h('p', { class: 'yc-case-en' }, c.title.en),
    compact ? null : h('div', { class: 'yc-case-row' }, pic(c.accused), h('p', {}, h('span', { class: 'yc-label' }, 'Accused '), h('b', { lang: 'ja' }, c.accused.word.kana), ` · ${c.accused.word.en}`)),
    compact ? null : h('p', { class: 'yc-hint' }, `Evidence: ${c.evidence}`),
  );
}

function testimonyCard(ctx: Ctx, me: CourtMe): HTMLElement | null {
  const t = ctx.game.testimony;
  if (!t) return null;
  const witness = ctx.game.cast?.witness;
  return h(
    'div',
    { class: 'yc-testimony' },
    h('p', { class: 'yc-label' }, t.auto ? 'No answer in time: the witness saw nothing' : `What ${witness ? nameOf(ctx.view, witness) : 'the witness'} said`),
    jpv(t.line, me.level),
    h('p', { class: 'yc-hint' }, t.note),
    t.suspect ? h('p', { class: 'yc-suspect' }, pic(t.suspect, 'yc-pic yc-pic-small'), h('span', {}, t.kind === 'curve' ? 'A second suspect: ' : 'Blamed: ', h('b', { lang: 'ja' }, t.suspect.word.kana), ` · ${t.suspect.word.en}`)) : null,
  );
}

function evidenceCard(me: CourtMe): HTMLElement | null {
  const m = me.mission;
  if (!m) return null;
  return h(
    'div',
    { class: `yc-mission yc-side-${m.side}` },
    h('p', { class: 'yc-mission-label' }, icon(m.side), ' Your mission · only you see this'),
    h('p', { class: 'yc-mission-text' }, m.text),
    h('div', { class: 'yc-evidence' }, pic(m.evidence), h('div', {}, h('p', { class: 'yc-label' }, 'Your evidence'), jpv(me.level === 'n5' ? { ...m.evidence.word, text: m.evidence.word.kana } : m.evidence.word, me.level, 'yc-ev-word'))),
  );
}

function hintBox(me: CourtMe, send: Send): HTMLElement | null {
  const m = me.mission;
  if (!m) return null;
  if (!hintOpen)
    return h(
      'div',
      { class: 'yc-hintbox' },
      h(
        'button',
        {
          type: 'button',
          class: 'ghost',
          onclick: () => {
            hintOpen = true;
            // Peeking makes the argument "read" for the learning path, not said from memory.
            send({ kind: 'hint' });
            bump();
          },
        },
        'Need a hint?',
      ),
      h('p', { class: 'yc-hint' }, 'Peeking counts it as read, not said from memory.'),
    );
  return h('div', { class: 'yc-hintbox' }, h('p', { class: 'yc-label' }, 'Fude-san’s way:'), jpv(m.model, me.level, 'yc-model'));
}

function passBlock(me: CourtMe, send: Send): HTMLElement | null {
  if (me.sent || rec || sending) return null;
  if (micOff())
    return h(
      'div',
      { class: 'yc-pass-wrap' },
      h('button', { type: 'button', class: 'yc-pass free', onclick: () => send({ kind: 'pass', free: true }) }, 'Fude-san reads it · no points'),
      h('p', { class: 'yc-hint center' }, 'Your mic pass stays unused. Typing your argument scores in full.'),
    );
  if (!me.micPassLeft) return h('button', { type: 'button', class: 'yc-pass', disabled: true }, 'Pass the mic · 0 left');
  if (!passAsk) return h('button', { type: 'button', class: 'yc-pass', onclick: () => ((passAsk = true), buzz(20), bump()) }, '🎙 Pass the mic · ', h('b', {}, '1 left'));
  return h(
    'div',
    { class: 'yc-pass-wrap' },
    h('button', { type: 'button', class: 'yc-pass ask', onclick: () => ((passAsk = false), send({ kind: 'pass' })) }, '🎙 Tap again: Fude-san reads it (half points)'),
    h('button', { type: 'button', class: 'yc-pass', onclick: () => ((passAsk = false), bump()) }, 'Keep it: I’ll say it'),
  );
}

function recordButton(ctx: Ctx, purpose: Purpose, limitMs: number, labels: { idle: string; stop: string }): HTMLElement {
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
      class: `yc-rec-btn${live ? ' live' : ''}${on && !live ? ' opening' : ''}`,
      disabled: busy || (on && !live) || !!(rec && !on),
      'aria-live': 'polite',
      style: live ? `--ms: ${ms}ms; --yc-rec-delay: -${elapsed}ms` : null,
      onclick: () => {
        if (on) return void stopAndSend();
        if (Date.now() - recShownAt < REC_GUARD_MS) return;
        startRecording(ctx, purpose, limitMs);
      },
    },
    h('span', { class: 'yc-rec-ring', 'aria-hidden': 'true' }),
    live ? h('span', { class: 'yc-rec-secs' }, String(secs), h('small', {}, 'REC')) : null,
    h('span', { class: 'yc-rec-label' }, label, live ? h('small', {}, 'We hear you · it sends by itself at 0') : !on && !busy ? h('small', {}, 'Tap, talk, tap again to send') : null),
  );
}

function typedBox(ctx: Ctx, sendBtn: HTMLElement | null): HTMLElement {
  const record = ctx.view.phase === 'answer';
  const retry = (micDead || micBlocked) && !isQuiet() && recordReady();
  return h(
    'div',
    { class: 'yc-typed' },
    h('p', { class: 'yc-label' }, isQuiet() ? 'Quiet mode: type your argument.' : 'Type your argument.', record ? ' It sends itself just before time runs out.' : ' Send it when it’s ready.'),
    h(
      'div',
      { class: 'yc-typed-row' },
      h('input', { type: 'text', maxlength: '120', lang: 'ja', enterkeyhint: 'send', placeholder: 'Type it in Japanese', value: typed, oninput: (e: Event) => (typed = (e.target as HTMLInputElement).value) }),
      sendBtn,
    ),
    retry && !micBlocked ? h('button', { type: 'button', class: 'yc-pass', onclick: () => ((micDead = false), (problem = ''), bump()) }, '🎤 Try the mic again') : null,
  );
}

function micOffCard(): HTMLElement {
  return h(
    'div',
    { class: 'yc-micoff', role: 'status' },
    h('p', { class: 'yc-micoff-icon', 'aria-hidden': 'true' }, '🔇'),
    h('p', { class: 'yc-micoff-title' }, 'Your mic is off'),
    h('p', {}, 'The game can’t hear you. Your case still counts: type your argument, or let Fude-san read it.'),
    recordReady() ? h('button', { type: 'button', class: 'secondary yc-mic-on', onclick: () => tryMic() }, 'Turn on the mic') : null,
  );
}

function reconnectCard(): HTMLElement | null {
  if (!pending) return null;
  const secs = Math.max(1, Math.round(pending.durMs / 1000));
  return h(
    'div',
    { class: 'yc-micoff', role: 'status' },
    h('p', { class: 'yc-micoff-icon', 'aria-hidden': 'true' }, '📶'),
    h('p', { class: 'yc-micoff-title' }, 'Reconnecting…'),
    h('p', {}, `Keep this page open. Your argument (${secs} s) is saved.`),
    h('p', { class: 'yc-box' }, 'Back in time: it sends by itself. If not, Fude-san stands in for you this case.'),
  );
}

const sentCard = (sub: string): HTMLElement => h('div', { class: 'yc-sent' }, h('p', { class: 'yc-stamp' }, 'Sent ✓'), h('p', { class: 'yc-watch' }, '📺 Watch the TV'), sub ? h('p', { class: 'yc-hint center' }, sub) : null);
const watchCard = (title: string, sub = ''): HTMLElement => h('div', { class: 'yc-sent' }, h('p', { class: 'yc-watch' }, '📺 ', title), sub ? h('p', { class: 'yc-hint center' }, sub) : null);

/** A picture button: hunches, the check, the vote. */
function pictureButton(t: ThingView, level: Level, on: boolean, onclick: (() => void) | null, cls = ''): HTMLElement {
  return h(
    'button',
    { type: 'button', class: `yc-card ${cls}${on ? ' on' : ''}`, 'aria-pressed': on ? 'true' : 'false', disabled: !onclick, onclick: onclick ?? undefined },
    pic(t),
    h('span', { class: 'yc-card-ja', lang: 'ja' }, level === 'kana' || level === 'n5' ? t.word.kana : ruby(t.word)),
    level === 'kana' && t.word.romaji ? h('span', { class: 'yc-card-ro' }, t.word.romaji) : null,
    h('span', { class: 'yc-card-en' }, t.word.en),
  );
}

function hunchBox(ctx: Ctx, me: CourtMe): HTMLElement | null {
  if (!me.hunchOptions.length) return null;
  const open = ctx.view.phase === 'prompt' || ctx.view.phase === 'answer';
  return h(
    'div',
    { class: 'yc-box' },
    h('p', { class: 'yc-strong' }, 'Your hunch: who did it?'),
    h('p', { class: 'yc-hint' }, 'Private, no points. You’ll see it again at the verdict.'),
    h(
      'div',
      { class: 'yc-cards' },
      ...me.hunchOptions.map((t) =>
        pictureButton(t, me.level, me.hunch === t.id, open ? () => void ctx.send({ kind: 'hunch', round: ctx.game.round, yokaiId: t.id }).then((ok) => ok && buzz(20)) : null),
      ),
    ),
  );
}

/** A Kana lawyer's three tiles: tap one or two, in order. */
function tilesBox(ctx: Ctx, me: CourtMe, editable: boolean): HTMLElement {
  const toggle = (id: string) => {
    const now = me.picks.includes(id) ? me.picks.filter((x) => x !== id) : [...me.picks, id].slice(-2);
    void ctx.send({ kind: 'pick', round: ctx.game.round, tiles: now }).then((ok) => ok && buzz(20));
  };
  return h(
    'div',
    { class: 'yc-tiles' },
    h('p', { class: 'yc-label' }, editable ? 'Pick one or two tiles. Fude-san reads them in the order you tap.' : 'Your tiles'),
    ...me.tiles.map((t) => {
      const n = me.picks.indexOf(t.id);
      return h(
        'button',
        { type: 'button', class: `yc-tile${n >= 0 ? ' on' : ''}`, disabled: !editable, 'aria-pressed': n >= 0 ? 'true' : 'false', onclick: editable ? () => toggle(t.id) : undefined },
        n >= 0 ? h('span', { class: 'yc-tile-n' }, String(n + 1)) : null,
        jpView(t.word, 'kana', { as: 'tile', cls: 'yc-tile-words' }),
        t.evidence ? h('span', { class: 'yc-tile-ev' }, '🔎 evidence') : null,
      );
    }),
  );
}

// ---- screens ----

function introScreen(): HTMLElement {
  return screen(
    h('p', { class: 'big', lang: 'ja' }, ruby({ text: '妖怪裁判', kana: 'ようかいさいばん' })),
    h('p', {}, icon('judge'), ' A studio mystery goes to trial. Fude-san presides.'),
    h('p', {}, icon('witness'), ' A witness answers one question. ', icon('pros'), ' ', icon('def'), ' Two lawyers, paired by level, argue at the same time.'),
    h('p', {}, '🗳 Everyone else listens, answers one question, and votes: who won you over? A tie is not guilty.'),
    h('p', { class: 'hint' }, 'Your voice goes to the TV for this case only, and isn’t kept.'),
  );
}

function roleCard(ctx: Ctx, me: CourtMe): HTMLElement {
  const cast = ctx.game.cast;
  const r = me.role;
  if (r === 'pros' || r === 'def') {
    const other = r === 'pros' ? cast?.def : cast?.pros;
    const otherLevel = ctx.view.players.find((p) => p.id === other)?.level ?? '';
    return h(
      'div',
      { class: `yc-rolecard yc-side-${r}` },
      h('p', { class: 'yc-role-big' }, icon(r, 'yc-role-icon big'), ` ${r === 'pros' ? 'You prosecute' : 'You defend'}`),
      h('p', {}, `Against ${nameOf(ctx.view, other)}${otherLevel ? ` (${levelLabel(otherLevel)})` : ''}. Lawyers are paired by the closest level, so the better idea wins, not the bigger vocabulary.`),
      h('ul', { class: 'yc-breakdown' }, h('li', {}, h('span', {}, 'Win the vote (a tie splits it)'), h('b', {}, `+${POINTS.win}`)), h('li', {}, h('span', {}, 'Each judge’s vote'), h('b', {}, `+${POINTS.vote}`)), h('li', {}, h('span', {}, 'Each judge who hears your evidence'), h('b', {}, `+${POINTS.heard}`))),
    );
  }
  if (r === 'witness')
    return h(
      'div',
      { class: 'yc-rolecard' },
      h('p', { class: 'yc-role-big' }, icon('witness', 'yc-role-icon big'), ' You’re the witness'),
      h('p', {}, 'Fude-san asks you one question. Answer with a tile. You can add a curveball. Then you judge with everyone else.'),
      judgePoints(ctx),
    );
  return h(
    'div',
    { class: 'yc-rolecard' },
    h('p', { class: 'yc-role-big' }, icon('judge', 'yc-role-icon big'), ' You judge'),
    h('p', {}, 'Listen to the witness, then two lawyers. Answer one question about their arguments, then vote: who won you over?'),
    judgePoints(ctx),
  );
}

function witnessScreen(ctx: Ctx, me: CourtMe): HTMLElement {
  const { game } = ctx;
  if (game.step === 'case') return screen(band(ctx, me, 'Fude-san’s question.'), roleCard(ctx, me), caseCard(ctx, true));
  if (game.step === 'ask' && me.canTestify) {
    return screen(
      band(ctx, me, 'listen to the lawyers. Then you judge.'),
      h('div', { class: 'yc-question' }, h('p', { class: 'yc-label' }, 'Fude-san asks:'), game.question ? jpv(game.question, me.level) : null),
      h(
        'div',
        { class: 'yc-tiles' },
        ...me.witnessTiles.map((t) =>
          h(
            'button',
            {
              type: 'button',
              class: `yc-tile${t.curve ? ' yc-curve' : ''}`,
              onclick: () => void ctx.send({ kind: 'testify', round: game.round, testimony: t.id }).then((ok) => ok && buzz(60)),
            },
            jpView(t.word, me.level, { as: 'tile', cls: 'yc-tile-words' }),
            t.curve ? h('img', { class: 'yc-leaf', src: LEAF, alt: 'curveball', draggable: 'false' }) : null,
          ),
        ),
      ),
      h('p', { class: 'yc-hint' }, '🍃 The curveball adds a second suspect. It scores nothing: it changes the case.'),
    );
  }
  // Answered: say it out loud too (path credit), and the hunch.
  const sayOpen = ctx.view.phase === 'prompt' && !!me.testified && !saidIt && !isQuiet() && !micOff() && !micDead;
  return screen(
    band(ctx, me, 'listen to the lawyers. Then you judge: who won you over?'),
    me.testified ? h('p', { class: 'yc-locked' }, '✓ Answer sent') : h('p', { class: 'yc-hint' }, 'Time’s up: Fude-san took “I didn’t see anything.”'),
    testimonyCard(ctx, me),
    problemLine(),
    hunchBox(ctx, me),
    sayOpen || rec?.purpose === 'say' ? dock(recordButton(ctx, 'say', SAY_MS, { idle: '🎤 Say it out loud too', stop: 'Tap to stop' })) : saidIt ? h('p', { class: 'yc-locked center' }, '🎤 Said it ✓') : null,
  );
}

function judgePromptScreen(ctx: Ctx, me: CourtMe): HTMLElement {
  const { game } = ctx;
  if (game.step === 'case') return screen(band(ctx, me, 'the witness, then two lawyers. Then you vote.'), roleCard(ctx, me), caseCard(ctx));
  if (game.step === 'ask') return screen(band(ctx, me, 'the witness answers.'), caseCard(ctx, true), h('div', { class: 'yc-question' }, h('p', { class: 'yc-label' }, `Fude-san asks ${nameOf(ctx.view, game.cast?.witness) || 'the witness'}:`), game.question ? jpv(game.question, me.level) : null));
  return screen(band(ctx, me, 'two lawyers argue. Then one question and your vote.'), testimonyCard(ctx, me), hunchBox(ctx, me), ctx.view.phase === 'answer' ? h('p', { class: 'yc-hint center' }, '● Both lawyers are recording.') : null);
}

function kanaLawyerScreen(ctx: Ctx, me: CourtMe, send: Send): HTMLElement {
  const { game, view } = ctx;
  if (view.phase === 'prompt' && (game.step === 'case' || game.step === 'ask')) return screen(band(ctx, me, 'listen to the witness. Your tiles arrive with the answer.'), roleCard(ctx, me), caseCard(ctx, true));
  if (view.phase === 'prompt')
    return screen(
      band(ctx, me, 'say your tiles, or let Fude-san read them.'),
      testimonyCard(ctx, me),
      evidenceCard(me),
      tilesBox(ctx, me, true),
      !me.picks.length
        ? h('p', { class: 'yc-hint' }, 'Pick at least one. No pick: Fude-san stands in, and you score nothing this case.')
        : me.ready
          ? h('p', { class: 'yc-locked' }, '✓ Done. You can still change your tiles until the plan ends.')
          : dock(h('button', { type: 'button', class: 'primary', onclick: () => send({ kind: 'ready' }) }, `✓ Done: ${me.picks.length === 1 ? 'one tile' : 'two tiles'}`)),
    );
  // Record.
  if (me.sent) return screen(band(ctx, me, 'both arguments play. Then the judges vote.'), sentCard('Prosecution plays first, then defence. You don’t vote in your own case.'));
  const canMic = !isQuiet() && !micOff() && !micDead;
  return screen(
    band(ctx, me, 'both arguments play.'),
    tilesBox(ctx, me, false),
    problemLine(),
    reconnectCard(),
    dock(
      canMic && me.canRecord ? recordButton(ctx, 'argue', me.limitMs, { idle: '🎤 Say your tiles', stop: 'Tap to send' }) : null,
      rec ? null : h('button', { type: 'button', class: canMic ? 'yc-pass' : 'primary', onclick: () => send({ kind: 'fude' }) }, '🖌 Let Fude-san read them · full points'),
    ),
  );
}

function speakerScreen(ctx: Ctx, me: CourtMe, send: Send): HTMLElement {
  const { game, view } = ctx;
  if (view.phase === 'prompt' && (game.step === 'case' || game.step === 'ask')) return screen(band(ctx, me, 'listen to the witness. Your mission arrives with the answer.'), roleCard(ctx, me), caseCard(ctx, true));
  if (me.sent) return screen(band(ctx, me, 'both arguments play. Then the judges vote.'), sentCard('Prosecution plays first, then defence. You don’t vote in your own case.'));
  checkMic();
  const typeIt = typing();
  const typedSend = typeIt && me.canType ? h('button', { type: 'button', class: 'primary yc-typed-send', onclick: () => sendTyped(ctx, game.round) }, 'Send') : null;
  if (view.phase === 'prompt') {
    if (game.step === 'testify')
      return screen(band(ctx, me, '8 s to plan, then you both record at the same time.'), testimonyCard(ctx, me), evidenceCard(me));
    return screen(
      band(ctx, me, 'at 0, tap ● and argue.'),
      testimonyCard(ctx, me),
      evidenceCard(me),
      hintBox(me, send),
      micOff() && !isQuiet() ? micOffCard() : null,
      problemLine(),
      dock(
        typeIt ? typedBox(ctx, typedSend) : me.ready ? h('p', { class: 'yc-locked yc-ready-done' }, '✓ Ready. At 0, tap ● and talk.') : h('button', { type: 'button', class: 'primary', onclick: () => send({ kind: 'ready' }) }, '● I’m ready: record'),
        passBlock(me, send),
      ),
    );
  }
  // Record.
  return screen(
    band(ctx, me, 'both arguments play.'),
    evidenceCard(me),
    hintOpen ? hintBox(me, send) : null,
    problemLine(),
    reconnectCard(),
    dock(typeIt ? typedBox(ctx, typedSend) : me.canRecord ? recordButton(ctx, 'argue', me.limitMs, { idle: '● Record your argument', stop: 'Tap to send' }) : null, passBlock(me, send)),
  );
}

function listenCard(ctx: Ctx, me: CourtMe): HTMLElement | null {
  const l = me.listen;
  if (!l) return null;
  return h(
    'div',
    { class: `yc-listen yc-side-${l.side}` },
    h('p', { class: 'yc-listen-head' }, seatChip(ctx.view, l.playerId), h('b', {}, nameOf(ctx.view, l.playerId)), ' · ', icon(l.side), ` ${SIDE[l.side].label.toLowerCase()} is arguing`, liveBar()),
    h('p', { class: 'yc-label' }, 'The main claim'),
    jpv(l.gist, me.level),
    h('p', { class: 'yc-hint' }, `Listen for the detail: one question comes next (+${POINTS.check}).`),
  );
}

function revealScreen(ctx: Ctx, me: CourtMe): HTMLElement {
  const { game } = ctx;
  const side = me.role === 'pros' || me.role === 'def' ? me.role : null;
  if (game.step === 'play') {
    const p = game.play;
    if (side) {
      const mine = p?.playerId === ctx.me.id;
      if (mine && p?.local) playMine(game.round);
      return screen(
        band(ctx, me, 'the judges get one question, then they vote.'),
        mine ? watchCard('Your argument is playing') : watchCard(`${nameOf(ctx.view, p?.playerId)} is arguing`),
        mine && p?.local ? h('p', { class: 'yc-hint center' }, '🔊 Your phone plays it: turn it up and hold it up!') : null,
        mine && p?.local && playBlocked ? h('button', { type: 'button', class: 'primary', onclick: () => playMine(game.round, true) }, '▶ Play it') : null,
      );
    }
    return screen(band(ctx, me, `one question about the arguments (+${POINTS.check}), then your vote.`), listenCard(ctx, me) ?? watchCard('Listen'));
  }
  // The check.
  if (side) return screen(band(ctx, me, 'the judges vote. You don’t vote in your own case.'), watchCard('The judges answer one question'));
  const ch = me.check;
  if (!ch) return screen(band(ctx, me, 'the vote.'), watchCard('Watch the TV'));
  return screen(
    band(ctx, me, 'both arguments side by side, and your vote.'),
    h('div', { class: 'yc-question' }, jpv(ch.question, me.level), h('p', { class: 'yc-hint' }, ch.en)),
    h('div', { class: 'yc-cards three' }, ...ch.options.map((t) => pictureButton(t, me.level, ch.picked === t.id, ch.open ? () => void ctx.send({ kind: 'check', round: game.round, thingId: t.id }).then((ok) => ok && buzz(20)) : null))),
    h('p', { class: 'yc-hint center' }, ch.picked ? '✓ Locked in. Tap another to change it. Your result comes after the verdict.' : `+${POINTS.check} if right. A wrong answer never cancels your vote. Only you see the result.`),
  );
}

function argCard(ctx: Ctx, me: CourtMe, a: ArgView, onclick: (() => void) | null): HTMLElement {
  const s = SIDE[a.side];
  return h(
    'button',
    { type: 'button', class: `yc-arg yc-side-${a.side}${me.vote === a.side ? ' on' : ''}`, 'aria-pressed': me.vote === a.side ? 'true' : 'false', disabled: !onclick, onclick: onclick ?? undefined },
    h('span', { class: 'yc-arg-who' }, seatChip(ctx.view, a.playerId), h('b', {}, nameOf(ctx.view, a.playerId))),
    h('span', { class: 'yc-arg-pics' }, ...a.pics.map((t) => pic(t, 'yc-pic yc-pic-small'))),
    a.hidden ? h('span', { class: 'yc-hint' }, 'Taken off the TV') : jpView(a.gist, me.level, { as: 'tile', cls: 'yc-arg-gist' }),
    a.subtitle ? plain('span', 'yc-arg-said', `「${a.subtitle}」`) : null,
    a.pass || a.free ? h('span', { class: 'yc-hint' }, a.free ? '🖌 Fude-san stood in' : '🎙 Fude-san read it') : null,
    h('span', { class: 'yc-arg-verdict' }, icon(a.side), ' ', h('span', { lang: 'ja' }, ruby(s.verdict)), ` ${s.en}`),
  );
}

function voteScreen(ctx: Ctx, me: CourtMe): HTMLElement {
  const { game } = ctx;
  const side = me.role === 'pros' || me.role === 'def' ? me.role : null;
  if (side) {
    const judges = game.cast?.judges ?? [];
    return screen(
      band(ctx, me, side === 'def' ? 'the verdict. A tie goes to you: うたがわしきは ばっせず.' : 'the verdict.'),
      watchCard('The judges are voting', `${judges.length} judges: ${judges.map((id) => nameOf(ctx.view, id)).join(', ')}. You don’t vote in your own case.`),
    );
  }
  const open = me.canVote && game.step === 'vote';
  const levels = game.args.map((a) => a.level);
  const same = levels.length === 2 && levels[0] === levels[1];
  return screen(
    band(ctx, me, 'the verdict.'),
    h('p', { class: 'yc-strong center' }, game.step === 'gist' ? 'Both arguments, side by side' : 'Who won you over?'),
    h('div', { class: 'yc-args' }, ...game.args.map((a) => argCard(ctx, me, a, open ? () => void ctx.send({ kind: 'vote', round: game.round, side: a.side }).then((ok) => ok && buzz(20)) : null))),
    h('p', { class: 'yc-hint center' }, same ? `Both lawyers are ${levelLabel(levels[0]!)}. Vote for who argued it better.` : 'Vote for who argued it better.'),
    open ? h('p', { class: 'yc-hint center' }, me.vote ? '✓ Locked in. Tap the other side to change it.' : 'One vote. Change it until the timer ends.') : game.step === 'gist' ? h('p', { class: 'yc-hint center' }, 'The vote opens in a moment.') : null,
  );
}

function resultCard(me: CourtMe): HTMLElement | null {
  const r = me.result;
  if (!r) return null;
  const ch = me.check;
  return h(
    'div',
    { class: 'yc-box' },
    ch ? h('p', {}, 'Check: ', r.checkRight === null ? 'no answer' : r.checkRight ? '✓ right' : '✗ not this time', r.checkValid ? '' : ' (the lawyer didn’t say it, so nobody scores it)') : null,
    r.voted ? h('p', {}, 'Your vote: ', icon(r.voted), ' ', h('span', { lang: 'ja' }, ruby(SIDE[r.voted].verdict)), r.majority ? ' · with the majority ✓' : '') : h('p', {}, 'No vote this case.'),
    r.hunch ? h('p', { class: 'yc-hint' }, 'Your hunch was ', h('b', { lang: 'ja' }, r.hunch.word.kana), ` (${r.hunch.word.en}).`) : null,
  );
}

/** A Kana judge's one word from the case, logged on their path as seen. */
function keepCard(me: CourtMe): HTMLElement | null {
  const k = me.keep;
  if (!k) return null;
  return h(
    'div',
    { class: 'yc-keep' },
    h('p', { class: 'yc-label' }, h('span', { 'aria-hidden': 'true' }, '🔖 '), 'Word to keep'),
    h('div', { class: 'yc-keep-row' }, pic(k, 'yc-pic yc-keep-pic'), jpv(k.word, me.level, 'yc-keep-ja')),
    h('p', { class: 'yc-hint' }, k.checked ? 'The answer to your check. Saved to your path as a word you’ve seen.' : 'The evidence in this case. Saved to your path as a word you’ve seen.'),
  );
}

const TAKE: Record<NonNullable<CourtMe['kanaNote']>['take'], string> = {
  said: 'You said every tile ✓',
  unchecked: 'You said it (the game couldn’t check the words)',
  partly: 'The game heard some of your tiles, not all: say every tile next time',
  silent: 'The game didn’t hear your tiles: hold the phone closer and say every tile next time',
  read: 'Fude-san read them for you. Next time, say them yourself',
};

/** A Kana lawyer's recap: the tiles they sent, with romaji and English, and whether the evidence went out. */
function kanaNoteCard(me: CourtMe): HTMLElement | null {
  const n = me.kanaNote;
  if (!n) return null;
  return h(
    'div',
    { class: 'yc-note' },
    h('p', { class: 'yc-label' }, h('span', { 'aria-hidden': 'true' }, '🔒 '), 'Your tiles'),
    h('p', { class: `yc-take${n.take === 'said' ? ' good' : ''}` }, TAKE[n.take]),
    h(
      'ol',
      { class: 'yc-recap' },
      ...n.tiles.map((x) => h('li', { class: x.evidence ? 'evidence' : '' }, jpv(x.word, me.level, 'yc-recap-ja'), x.evidence ? h('p', { class: 'yc-recap-tag' }, '🔎 evidence') : null)),
    ),
    h(
      'p',
      { class: 'yc-hint' },
      n.evidence
        ? '✓ Your evidence went out: judges could hear it.'
        : n.evidence === null
          ? 'The game couldn’t check your words, so the judges’ check counted.'
          : n.tiles.some((x) => x.evidence)
          ? 'You picked your evidence, but it wasn’t heard in your take, so judges couldn’t be checked on it.'
          : 'No evidence tile this time: judges had nothing to check you on.',
    ),
  );
}

function noteCard(me: CourtMe): HTMLElement | null {
  const n = me.note;
  if (!n) return null;
  const chip =
    n.credit === 'memory'
      ? h('span', { class: 'yc-mark-chip memory' }, 'Said it from memory ✓')
      : n.credit === 'hint'
        ? h('span', { class: 'yc-mark-chip' }, 'Said it, with a hint')
        : n.credit === 'unchecked'
          ? h('span', { class: 'yc-mark-chip' }, 'Said it (the game couldn’t check the words)')
          : h('span', { class: 'yc-mark-chip' }, n.said !== null ? 'Logged as seen: use the pattern in your own words to log it as said' : 'Logged as seen: say it yourself next time to log it as said');
  return h(
    'div',
    { class: 'yc-note' },
    h('p', { class: 'yc-label' }, '🔒 Private note'),
    chip,
    n.chunk ? h('p', { class: 'yc-used' }, '✓ Skill used: ', plain('span', '', n.chunk)) : null,
    n.said !== null ? h('div', {}, h('p', { class: 'yc-label' }, 'You said'), plain('p', 'yc-said', n.said)) : null,
    h('div', {}, h('p', { class: 'yc-label' }, 'Fude-san’s way'), jpv(n.model, me.level, 'yc-model')),
    h('p', { class: 'yc-hint' }, 'Path credit only. Not on the scoreboard.'),
  );
}

const RANK: Record<string, number> = { kana: 0, n5: 1, n4: 2, n3: 3 };
function boothTag(mine: string, chunk: string, tag: string): string {
  if (RANK[mine] === RANK[chunk]) return `You’re on this line: ${tag}`;
  return (RANK[mine] ?? 0) > (RANK[chunk] ?? 0) ? `Already on your map: ${tag}` : `Coming up on your map: ${tag}`;
}

function boothCard(ctx: Ctx, me: CourtMe): HTMLElement | null {
  const b = ctx.game.booth;
  if (!b) return null;
  const mine = b.playerId === ctx.me.id;
  const line = h('p', { class: 'yc-said', lang: 'ja' });
  const at = b.chunk ? b.line.indexOf(b.chunk) : -1;
  if (at >= 0) {
    const lit = document.createElement('mark');
    lit.className = 'yc-lit';
    lit.textContent = b.chunk;
    line.append(b.line.slice(0, at), lit, b.line.slice(at + b.chunk.length));
  } else line.textContent = b.line;
  return h(
    'div',
    { class: 'yc-note' },
    h('p', { class: 'yc-label' }, mine ? '✓ Skill used' : `Replay · ${nameOf(ctx.view, b.playerId)}`),
    mine ? plain('p', 'yc-chunk', b.chunk) : line,
    h('p', {}, b.note),
    b.tag ? h('p', { class: 'yc-tag' }, '🚃 ', boothTag(me.level, b.level, b.tag)) : null,
  );
}

function scoreScreen(ctx: Ctx, me: CourtMe): HTMLElement {
  const { game } = ctx;
  const next = game.round < game.totalRounds ? 'the next case.' : 'the results.';
  if (game.step === 'verdict') {
    const left = game.stepAt + POINTS_AT_MS - serverNow(ctx);
    if (left > 0) {
      later('points', left + 20, bump);
      return screen(band(ctx, me, next), watchCard('Watch the TV', 'The verdict is coming.'));
    }
  }
  const lines = me.breakdown.filter((x) => x.points !== 0);
  const v = game.verdict;
  return screen(
    band(ctx, me, next),
    v ? h('p', { class: `yc-verdict yc-side-${v.winner}` }, icon(v.winner), ' ', h('span', { lang: 'ja' }, ruby(SIDE[v.winner].verdict)), ` · ${v.pros} to ${v.def}${v.tie ? ', and a tie is not guilty' : ''}`) : null,
    h('p', { class: 'yc-label center' }, 'This case'),
    h('p', { class: `yc-points${me.points ? '' : ' zero'}` }, `+${me.points ?? 0}`),
    me.scoreWhy ? h('p', { class: 'yc-hint center' }, me.scoreWhy) : null,
    lines.length ? h('ul', { class: 'yc-breakdown' }, ...lines.map((x) => h('li', {}, h('span', {}, WHY[x.why] ?? x.why), h('b', {}, `+${x.points}`)))) : null,
    resultCard(me),
    keepCard(me),
    kanaNoteCard(me),
    noteCard(me),
    boothCard(ctx, me),
  );
}

/** The VIP can take an argument's words off the TV (it earns nothing; the vote still counts). */
function vipFold(ctx: Ctx): HTMLElement | null {
  const { game, view } = ctx;
  if (!ctx.isVip || (view.phase !== 'reveal' && view.phase !== 'encore')) return null;
  const ids: { id: string; text: string | null }[] = [];
  for (const a of game.args) if (!a.hidden && a.kind !== 'fude' && (a.kind !== 'tiles' || a.subtitle)) ids.push({ id: a.playerId, text: a.subtitle });
  const p = game.play;
  if (p && !p.hidden && (p.kind === 'clip' || p.kind === 'typed' || (p.kind === 'tiles' && (p.clipId || p.local))) && !ids.some((x) => x.id === p.playerId)) ids.push({ id: p.playerId, text: p.text });
  const list = ids.filter((x) => !hiddenByMe.has(`${game.round}:${x.id}`));
  if (!list.length) return null;
  return h(
    'details',
    { class: 'yc-vip' },
    h('summary', {}, h('span', {}, 'VIP: hide an argument'), h('small', {}, 'Takes it off the TV. It scores nothing; the vote still counts.')),
    ...list.map((x) =>
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
        `🚫 Hide ${nameOf(view, x.id)}’s argument `,
        x.text ? plain('span', '', `「${x.text}」`) : null,
      ),
    ),
  );
}

export const yokaiCourtPhone: PhoneMode<CourtView> = {
  key: (view, game) =>
    [
      view.phaseSeq,
      game.step,
      game.stepAt,
      game.round,
      JSON.stringify(game.me),
      local,
      JSON.stringify(game.play),
      JSON.stringify(game.testimony),
      game.args.length,
      game.verdict ? 'v' : '',
      game.booth ? JSON.stringify(game.booth) : '',
    ].join('|'),

  render(ctx) {
    latest = ctx;
    const { view, game } = ctx;
    const me = game.me;
    newRound(game.round);
    if (rec && (rec.round !== game.round || (rec.purpose === 'argue' && view.phase !== 'answer') || (rec.purpose === 'say' && view.phase !== 'prompt'))) void stopAndSend();
    if (pending && (view.phase !== 'answer' || pending.round !== game.round)) retryPending();
    if (view.phase !== 'score') cancel('points');
    armTypedSend(ctx);
    const send: Send = (move) => void ctx.send({ round: game.round, ...move }).then((ok) => ok && buzz(40));
    let out: HTMLElement;
    if (view.phase === 'intro') out = introScreen();
    else if (!me?.role) out = waiting('Look at the TV!');
    else if (view.phase === 'prompt' || view.phase === 'answer') {
      if (me.role === 'witness') out = view.phase === 'prompt' ? witnessScreen(ctx, me) : judgePromptScreen(ctx, me);
      else if (me.role === 'judge') out = judgePromptScreen(ctx, me);
      else out = me.level === 'kana' ? kanaLawyerScreen(ctx, me, send) : speakerScreen(ctx, me, send);
    } else if (view.phase === 'reveal') out = revealScreen(ctx, me);
    else if (view.phase === 'encore') out = voteScreen(ctx, me);
    else if (view.phase === 'score') out = scoreScreen(ctx, me);
    else out = waiting('Look at the TV!');
    const fold = vipFold(ctx);
    if (fold) {
      const d = out.querySelector(':scope > .yc-dock');
      if (d) d.before(fold);
      else out.append(fold);
    }
    return out;
  },
};
