// Dub Club on the phone: your secret direction card, the plain read (rehearsal), the acted take,
// then guessing each dub as the TV screens it.
//
//   Scene      the scene, your line, and two direction cards: pick one. Nobody else sees it.
//   Record     1. read the line plainly (hold to talk): only you see which sounds came through, with one
//                 retry. 2. act it the way your card says: tap to record, listen back, retake or send.
//                 A take recorded but not sent goes in by itself just before time runs out.
//   Screening  each dub in turn: tap how you think it was directed, ask for もう いっかい, give your one
//              heart of the scene to the dub you loved.
//   Notes      how your scene went, privately.
//
// The N4 ad-lib role (one N4 player a scene, in turn): opt-in. Until they tap "Take it: ad-lib", the phone
// shows the scripted N4 line with the offer beside it; sending the scripted take without answering times the
// offer out. Once taken: no script, a mission and a picture instead. Say it your way, casually; the check is
// lenient and private, and a model line shows once the take is sent. "Not this time" keeps the script.
//
// Mixed rooms: while someone's ad-lib dub is on, everyone else gets a Gallery tile (a reaction, or once a game
// the curveball). After a good ad-lib, Kana and N5 phones get the gist of the booth's model line; in a small room
// with nobody at N4, the gist of Fude's own ad-lib on one scene card.
//
// A take goes to the room for the TV to play (kept in memory only), or, with "Play my voice from this
// phone", stays here and this phone plays it when its turn comes.

import { h } from '../../../shared/src/dom.js';
import type { DubCard, DubView } from '../../../shared/src/modes/dubClub/dubClub.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import { MicClip, recordReady, uploadClip } from '../components/mic.js';
import { canSpeak, isQuiet, speakBox } from '../components/speak.js';
import { jpView } from '../components/jp.js';
import { roleOffer } from '../components/roleOffer.js';
import { boothGist, galleryTile } from '../components/gallery.js';
import { isSoundOff } from '../components/voice.js';
import { holdButton, waiting } from '../components/ui.js';
import type { PhoneContext, PhoneMode } from './types.js';

type Ctx = PhoneContext<DubView>;
type Me = NonNullable<DubView['me']>;

const nameOf = (view: RoomView, id: string | null | undefined): string => view.players.find((p) => p.id === id)?.name ?? '';

const buzz = (ms = 60) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // no vibration here
  }
};

// ---- this phone's choices ----

const LOCAL_KEY = 'kotoba:dub:local';
const NOTICE_KEY = 'kotoba:dub:notice';
function stored(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}
function store(key: string, on: boolean): void {
  try {
    localStorage.setItem(key, on ? '1' : '0');
  } catch {
    // private mode: not remembered
  }
}
/** Play my takes from this phone instead of sending them to the TV. */
let playLocal = stored(LOCAL_KEY);

// ---- the take being made (kept across redraws) ----

interface Draft {
  round: number;
  wav: Uint8Array<ArrayBuffer>;
  url: string;
  durMs: number;
}
/** Kept takes by round: the one in progress, and the sent ones this phone may have to play. */
const drafts = new Map<number, Draft>();
let rec: { round: number; clip: MicClip; started: number | null; timer: ReturnType<typeof setTimeout> | null } | null = null;
/** Step of the record phase: the plain read, or the acted take. */
let stepOf: { round: number; act: boolean; retry: boolean } = { round: 0, act: false, retry: false };
let sending = false;
let problem = '';
/** Bumped by local changes, so the screen key changes and the phone redraws. */
let local = 0;

const durOf = (wav: Uint8Array): number => Math.round(((wav.length - 44) / 32_000) * 1000);

function act(round: number): boolean {
  if (stepOf.round !== round) stepOf = { round, act: false, retry: false };
  return stepOf.act;
}

function setStep(ctx: Ctx, patch: Partial<typeof stepOf>): void {
  stepOf = { ...stepOf, round: ctx.game.round, ...patch };
  local++;
  ctx.redraw();
}

function startRecording(ctx: Ctx, me: Me): void {
  if (rec || sending) return;
  problem = '';
  const round = ctx.game.round;
  const clip = new MicClip({ raw: true });
  rec = { round, clip, started: null, timer: null };
  local++;
  ctx.redraw();
  // The take starts when the mic is open, never before: the first syllable would be lost.
  void clip.ready.then((ok) => {
    if (rec?.clip !== clip) return;
    if (!ok) {
      rec = null;
      problem = clip.blocked ? 'The microphone is blocked. Allow it in your browser, or guess only this scene.' : 'Couldn’t open the microphone.';
      local++;
      return ctx.redraw();
    }
    buzz(40);
    rec.started = Date.now();
    rec.timer = setTimeout(() => stopRecording(ctx), me.limitMs);
    local++;
    ctx.redraw();
  });
}

function stopRecording(ctx: Ctx): void {
  const r = rec;
  if (!r) return;
  rec = null;
  if (r.timer) clearTimeout(r.timer);
  const wav = r.clip.stop();
  if (!wav || wav.length <= 44 || r.started === null) {
    problem = 'Didn’t hear anything. Tap record and act it out loud!';
  } else {
    const old = drafts.get(r.round);
    if (old) URL.revokeObjectURL(old.url);
    drafts.set(r.round, { round: r.round, wav, url: URL.createObjectURL(new Blob([wav], { type: 'audio/wav' })), durMs: durOf(wav) });
  }
  local++;
  ctx.redraw();
}

async function sendTake(ctx: Ctx): Promise<void> {
  const d = drafts.get(ctx.game.round);
  if (!d || sending) return;
  sending = true;
  problem = '';
  local++;
  ctx.redraw();
  let res = await uploadClip(d.wav, !playLocal);
  let kept = playLocal;
  // The room's clip memory is full: this phone plays it instead.
  if (!res.ok && res.why === 'full') {
    res = await uploadClip(d.wav, false);
    kept = true;
  }
  sending = false;
  if (!res.ok) {
    problem = 'Couldn’t send that. Try again?';
    local++;
    return ctx.redraw();
  }
  const ok = await ctx.send({ kind: 'take', clipId: res.clipId, local: kept || !res.clipId, durMs: res.durMs || d.durMs, heard: res.heard, checked: res.checked, round: ctx.game.round });
  if (ok) buzz(80);
  local++;
  ctx.redraw();
}

// A take recorded but not sent goes in by itself just before the phase ends.
let autoSend: ReturnType<typeof setTimeout> | null = null;
function armAutoSend(ctx: Ctx, view: RoomView): void {
  if (autoSend) clearTimeout(autoSend);
  autoSend = null;
  const remaining = ctx.remainingMs();
  if (view.phase !== 'answer' || remaining === null || ctx.game.me?.sent) return;
  const left = remaining - 4_000;
  autoSend = setTimeout(
    () => {
      autoSend = null;
      if (rec) stopRecording(ctx);
      if (drafts.get(ctx.game.round) && !ctx.game.me?.sent) void sendTake(ctx);
    },
    Math.max(0, left),
  );
}

// ---- listening back: a pixel play button and the take's waveform ----

const ICON = (name: string) => `/stage/assets/dub/ui-${name}.png`;
const WAVE_BARS = 36;
const peaksCache = new WeakMap<Uint8Array, number[]>();
/** The take's loudness in WAVE_BARS slices, 0–1 (16-bit mono PCM after the 44-byte header). */
function peaksOf(wav: Uint8Array): number[] {
  const hit = peaksCache.get(wav);
  if (hit) return hit;
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  const samples = Math.floor((wav.length - 44) / 2);
  const per = Math.max(1, Math.floor(samples / WAVE_BARS));
  const peaks: number[] = [];
  for (let b = 0; b < WAVE_BARS; b++) {
    let max = 0;
    for (let i = b * per; i < Math.min(samples, (b + 1) * per); i++) max = Math.max(max, Math.abs(view.getInt16(44 + i * 2, true)));
    peaks.push(max / 32768);
  }
  const top = Math.max(...peaks) || 1;
  const out = peaks.map((p) => p / top);
  peaksCache.set(wav, out);
  return out;
}

let preview: HTMLAudioElement | null = null;
let previewUrl = '';
function showProgress(): void {
  const p = preview && preview.duration ? preview.currentTime / preview.duration : 0;
  for (const wave of document.querySelectorAll<HTMLElement>('.dc-wave')) {
    const on = wave.dataset.url === previewUrl && preview && !preview.paused;
    wave.querySelectorAll('i').forEach((bar, i) => bar.classList.toggle('on', !!on && i / WAVE_BARS < p));
  }
  for (const img of document.querySelectorAll<HTMLImageElement>('.dc-play img')) {
    const playing = img.closest<HTMLElement>('.dc-player')?.dataset.url === previewUrl && preview && !preview.paused;
    img.src = ICON(playing ? 'stop' : 'play');
  }
}
function togglePreview(url: string): void {
  if (!preview) {
    preview = new Audio();
    preview.addEventListener('timeupdate', showProgress);
    preview.addEventListener('ended', showProgress);
    preview.addEventListener('pause', showProgress);
  }
  if (previewUrl === url && !preview.paused) {
    preview.pause();
    preview.currentTime = 0;
  } else {
    previewUrl = url;
    preview.src = url;
    void preview.play().catch(() => {});
  }
  showProgress();
}

/**
 * Your take, to play back. With sound off there is no listen-back: just its waveform and length. (A take that
 * stayed on this phone still plays in the screening: that's the room's dub, not the player listening.)
 */
function takePlayer(d: Draft): HTMLElement {
  if (isSoundOff()) {
    return h(
      'div',
      { class: 'dc-player' },
      h('span', { class: 'dc-wave', 'aria-hidden': 'true' }, peaksOf(d.wav).map((p) => h('i', { class: 'on', style: `--h:${Math.max(1, Math.round(p * 8))}` }))),
      h('span', { class: 'dc-dur' }, `${(d.durMs / 1000).toFixed(1)} s`),
    );
  }
  return h(
    'div',
    { class: 'dc-player', 'data-url': d.url },
    h('button', { type: 'button', class: 'dc-play', 'aria-label': 'Play your take', onclick: () => togglePreview(d.url) }, h('img', { src: ICON('play'), alt: '', draggable: 'false' })),
    h('span', { class: 'dc-wave', 'data-url': d.url, 'aria-hidden': 'true' }, peaksOf(d.wav).map((p) => h('i', { style: `--h:${Math.max(1, Math.round(p * 8))}` }))),
    h('span', { class: 'dc-dur' }, `${(d.durMs / 1000).toFixed(1)} s`),
  );
}

// The mic level meter while recording: eight pixel bars that follow the mic, on their own frame loop.
let metering = false;
function startMeter(): void {
  if (metering || typeof requestAnimationFrame === 'undefined') return;
  metering = true;
  const tick = () => {
    const els = document.querySelectorAll<HTMLElement>('.dc-meter');
    if (!els.length || !rec) {
      metering = false;
      return;
    }
    const lit = Math.round(rec.clip.level * 8);
    for (const el of els) el.querySelectorAll('i').forEach((bar, i) => bar.classList.toggle('on', i < lit));
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ---- playing my own take (when it stayed on this phone) ----

let playedKey = '';
let player: HTMLAudioElement | null = null;
function playMine(round: number, key: string): void {
  if (key === playedKey) return;
  playedKey = key;
  const d = drafts.get(round);
  if (!d) return;
  player?.pause();
  player = new Audio(d.url);
  void player.play().catch(() => {});
}

// ---- pieces ----

function cardFace(c: DubCard, opts: { tip?: boolean; cls?: string } = {}): HTMLElement {
  return h(
    'span',
    { class: `dc-card ${opts.cls ?? ''}` },
    h('img', { class: 'dc-card-emoji', src: `/stage/assets/dub/cards/${c.id}.png`, alt: '', draggable: 'false' }),
    h('span', { class: 'dc-card-jp', lang: 'ja' }, c.jp.text),
    c.romaji ? h('span', { class: 'dc-card-ro' }, c.romaji) : null,
    h('span', { class: 'dc-card-en' }, c.jp.en),
    opts.tip && c.tip ? h('span', { class: 'dc-card-tip' }, c.tip) : null,
  );
}

/** Playing the ad-lib (said yes): the mission instead of the script. An open offer isn't yet. */
const adlibbing = (me: Me): boolean => me.adlib?.state === 'accepted';

function lineBox(me: Me, cls = ''): HTMLElement | null {
  return me.line ? jpView(me.line, me.level, { cls: `dc-line ${cls}` }) : null;
}

/** The ad-lib's mission, in place of the script: the picture, the English, and how to say it. */
function missionBox(me: Me, cls = ''): HTMLElement | null {
  const ad = me.adlib;
  if (!ad || ad.state !== 'accepted') return null;
  return h(
    'div',
    { class: `dc-mission ${cls}` },
    h('span', { class: 'dc-mission-emoji', 'aria-hidden': 'true' }, ad.emoji),
    h('p', { class: 'dc-mission-what' }, ad.mission),
    h('p', { class: 'dc-mission-how' }, 'No script: say it like you would to a friend. Plain form + ', h('span', { lang: 'ja' }, 'よ／ね／の？'), ', ', h('span', { lang: 'ja' }, '〜んだ'), ', ', h('span', { lang: 'ja' }, '〜ちゃった'), '.'),
  );
}

/** The model line, once the take is in: one casual way to say it. */
function modelBox(me: Me): HTMLElement | null {
  const m = me.adlib?.model;
  if (!m) return null;
  return h('div', { class: 'dc-model' }, h('p', { class: 'dc-label' }, '💡 One way to say it'), jpView(m, me.level, { cls: 'dc-line small' }));
}

/** The offer: take the ad-lib, or "not this time" to keep the scripted line (showing above it). */
function adlibOffer(ctx: Ctx, me: Me): HTMLElement | null {
  const ad = me.adlib;
  if (!ad || me.sent) return null;
  const send = (accept: boolean) => void ctx.send({ kind: 'adlib', accept, round: ctx.game.round });
  if (ad.state === 'accepted') return h('button', { type: 'button', class: 'linkish', onclick: () => send(false) }, 'Give me the script after all');
  return roleOffer({
    kicker: '🎬 Fude-kantoku: “No script this time. Make it yours!”',
    pitch: `${ad.emoji} Ad-lib instead: ${ad.mission}`,
    take: '🎙 Take it: ad-lib',
    onTake: () => send(true),
    onDecline: () => send(false),
  });
}

/** After "mission missed": one of the mission's words, so they know what to aim for. */
function aimFor(me: Me): HTMLElement | null {
  const w = me.adlib?.hint;
  if (!w) return null;
  return h('p', { class: 'hint dc-aim' }, '🎯 Try to get this word in: ', h('span', { lang: 'ja' }, w));
}

function adlibVerdict(me: Me): string | null {
  const c = me.adlib?.check;
  if (!c) return null;
  if (c.casual && c.key) return 'Nice and casual, and on the mission!';
  if (c.casual) return 'Casual! Now get the mission in too.';
  if (c.key) return 'On the mission. Make it casual: end with よ, ね or の？';
  return 'Say it like you would to a friend: plain form + よ or ね.';
}

function sceneCard(game: DubView): HTMLElement | null {
  const sc = game.scene;
  if (!sc) return null;
  return h('div', { class: 'dc-scene' }, h('p', { class: 'dc-scene-who' }, h('span', { lang: 'ja' }, sc.who.text), ` · ${sc.who.en}`), h('p', { class: 'dc-scene-setup' }, sc.setup));
}

function privacy(): HTMLElement {
  const seen = stored(NOTICE_KEY);
  const box = h(
    'label',
    { class: 'dc-local' },
    h('input', {
      type: 'checkbox',
      checked: playLocal,
      onchange: (e: Event) => {
        playLocal = (e.target as HTMLInputElement).checked;
        store(LOCAL_KEY, playLocal);
      },
    }),
    h('span', {}, 'Play my voice from this phone instead of the TV'),
  );
  if (seen) return h('details', { class: 'dc-privacy' }, h('summary', {}, '🔒 Where your voice goes'), notice(), box);
  store(NOTICE_KEY, true);
  return h('div', { class: 'dc-privacy open' }, h('p', { class: 'dc-privacy-title' }, '🔒 Where your voice goes'), notice(), box);
}

const notice = () =>
  h(
    'p',
    { class: 'hint' },
    'Your acted take plays on this room’s TV. The room keeps it in memory only while the game needs it (the scene, or tonight’s episode) and never saves it. Your plain read only goes to the speech check.',
  );

// ---- screens ----

function pickScreen(ctx: Ctx, me: Me): HTMLElement {
  const { game, send } = ctx;
  return h(
    'div',
    { class: 'screen' },
    sceneCard(game),
    boothGist(me.gist),
    h('p', { class: 'dc-label' }, adlibbing(me) ? '🎙 Ad-lib: your mission' : 'Your line'),
    lineBox(me),
    missionBox(me),
    adlibOffer(ctx, me),
    h('p', { class: 'dc-label' }, '🤫 Pick your secret direction'),
    h(
      'div',
      { class: 'dc-pick' },
      me.offered.map((c) =>
        h(
          'button',
          {
            type: 'button',
            class: `dc-pick-btn${me.direction?.id === c.id ? ' on' : ''}`,
            'aria-pressed': me.direction?.id === c.id ? 'true' : 'false',
            onclick: () => {
              buzz(30);
              void send({ kind: 'pick', direction: c.id, round: game.round });
            },
          },
          cardFace(c, { tip: true }),
        ),
      ),
    ),
    h('p', { class: 'hint' }, 'Don’t show anyone! The room will guess it from your voice.'),
    privacy(),
  );
}

function marks(me: Me): HTMLElement | null {
  const reh = me.rehearsal;
  if (!reh?.marks.length) return null;
  return h(
    'p',
    { class: 'dc-marks', lang: 'ja', 'aria-label': 'Sounds that came through are filled; lost ones are dashed' },
    reh.marks.map((m) => h('span', { class: m.ok ? 'ok' : 'miss' }, m.m)),
  );
}

function rehearseScreen(ctx: Ctx, me: Me): HTMLElement {
  const { game, send } = ctx;
  const reh = me.rehearsal;
  const again = !reh || (stepOf.retry && reh.left > 0);
  const sim = reh?.similarity ?? 0;
  const ad = adlibbing(me);
  const verdict = !reh ? null : ad ? adlibVerdict(me) : reh.marks.every((m) => m.ok) ? 'Crisp! Every sound came through.' : sim >= 0.5 ? 'Nearly! Try the dashed sounds again.' : 'Hard to hear. Slow down and say every sound.';
  return h(
    'div',
    { class: 'screen' },
    h('p', { class: 'dc-step' }, ad ? 'Step 1 of 2 · say it your way' : 'Step 1 of 2 · read it plainly'),
    lineBox(me),
    missionBox(me),
    reh ? marks(me) : null,
    verdict ? h('p', { class: sim >= 0.5 ? 'dc-ok' : 'dc-warn' }, verdict) : null,
    ad ? aimFor(me) : null,
    verdict ? null : h('p', { class: 'hint' }, ad ? 'First just say it, no acting yet, the way you’d talk to a friend. Only you see how it went.' : 'Just the words, clearly. Only you see how it went.'),
    again
      ? speakBox({ label: ad ? 'Hold and say it' : 'Hold and read the line', speechOnly: true, autoSend: true, onSend: (utterance) => (setStep(ctx, { retry: false }), void send({ kind: 'rehearse', utterance, round: game.round })) })
      : null,
    reh && !again && reh.left > 0 ? h('button', { type: 'button', class: 'secondary dc-retry', onclick: () => setStep(ctx, { retry: true }) }, ad ? '🔁 Try it once more' : '🔁 Read it once more') : null,
    h('button', { type: 'button', class: reh ? 'primary' : 'linkish', onclick: () => setStep(ctx, { act: true }) }, reh ? '🎬 Now act it!' : 'Skip to acting'),
    adlibOffer(ctx, me),
  );
}

function actScreen(ctx: Ctx, me: Me): HTMLElement {
  const { game } = ctx;
  const d = drafts.get(game.round);
  const live = rec?.round === game.round ? rec : null;
  const seconds = Math.round(me.limitMs / 1000);
  const review = d && !live ? d : null;
  if (live?.started != null) startMeter();
  const recBtn = live
    ? h(
        'button',
        { type: 'button', class: `dc-rec on${live.started === null ? ' opening' : ''}`, style: live.started !== null ? `--len:${me.limitMs}ms; --into:-${Date.now() - live.started}ms` : null, onclick: () => stopRecording(ctx) },
        h('span', { class: 'dc-rec-bar', 'aria-hidden': 'true' }),
        h('span', { class: 'dc-rec-label' }, live.started === null ? 'Opening the mic…' : '● REC · tap to stop'),
        live.started !== null ? h('span', { class: 'dc-meter', 'aria-hidden': 'true' }, h('img', { src: ICON('mic'), alt: '' }), [1, 2, 3, 4, 5, 6, 7, 8].map(() => h('i', {}))) : null,
      )
    : h('button', { type: 'button', class: `dc-rec${d ? ' again' : ''}`, disabled: sending, onclick: () => startRecording(ctx, me) }, h('span', { class: 'dc-rec-label' }, d ? '● Record again' : '● Record'));
  return h(
    'div',
    { class: 'screen' },
    h('p', { class: 'dc-step' }, me.rehearsal || canSpeak() ? 'Step 2 of 2 · act it!' : 'Act it!'),
    me.direction ? cardFace(me.direction, { tip: !review, cls: review ? 'small' : 'big' }) : null,
    me.offered.length > 1 && !review ? offeredStrip(ctx, me) : null,
    lineBox(me, 'small'),
    missionBox(me, 'small'),
    me.adlib?.state === 'offered' && !review && !live ? adlibOffer(ctx, me) : null,
    review
      ? h(
          'div',
          { class: 'dc-review' },
          h('p', { class: 'hint' }, isSoundOff() ? 'Sound’s off, so no listen-back: send it, or record again.' : 'Listen back, then send it to the TV.'),
          takePlayer(review),
          h('button', { type: 'button', class: 'primary dc-send', disabled: sending, onclick: () => void sendTake(ctx) }, sending ? 'Sending…' : '📤 Send this take'),
          h('p', { class: 'hint dc-autosend' }, '⏱ Not sent by the end? It goes in by itself.'),
        )
      : h('p', { class: 'hint' }, `${adlibbing(me) ? 'Say it your way' : 'Say the line'}, the way your card says, up to ${seconds} seconds. Don’t say the card!`),
    recBtn,
    problem ? h('p', { class: 'dc-warn' }, problem) : null,
    !me.rehearsal && canSpeak() ? h('button', { type: 'button', class: 'linkish', onclick: () => setStep(ctx, { act: false }) }, '← Back to the plain read') : null,
  );
}

function sentScreen(ctx: Ctx, me: Me): HTMLElement {
  const d = drafts.get(ctx.game.round);
  const waitingOn = ctx.game.cast.filter((c) => !c.sent && !c.passed).map((c) => nameOf(ctx.view, c.playerId));
  return h(
    'div',
    { class: 'screen' },
    h('p', { class: 'big' }, '🎬 Take sent!'),
    me.direction ? cardFace(me.direction, { cls: 'small' }) : null,
    d ? takePlayer(d) : null,
    modelBox(me),
    waitingOn.length ? h('p', { class: 'hint' }, `Waiting for ${waitingOn.join(', ')}…`) : null,
  );
}

function noMicScreen(ctx: Ctx, me: Me, why: string): HTMLElement {
  return h(
    'div',
    { class: 'screen' },
    h('p', { class: 'big' }, '🎧 Guessing this scene'),
    h('p', {}, why),
    lineBox(me, 'small'),
    me.passed ? h('p', { class: 'hint' }, 'You’ll guess everyone else’s dubs.') : h('button', { type: 'button', class: 'primary', onclick: () => void ctx.send({ kind: 'pass', round: ctx.game.round }) }, 'OK, I’ll guess'),
  );
}

function recordPhase(ctx: Ctx, me: Me): HTMLElement {
  if (!me.acting) return waiting('Look at the TV!', 'You’re watching this scene.');
  if (me.sent) return sentScreen(ctx, me);
  if (me.passed) return noMicScreen(ctx, me, 'No recording this time.');
  if (isQuiet()) return noMicScreen(ctx, me, 'You’re in quiet mode, so you won’t record.');
  if (!recordReady()) return noMicScreen(ctx, me, 'This phone can’t record here.');
  if (!act(ctx.game.round) && canSpeak()) return rehearseScreen(ctx, me);
  return actScreen(ctx, me);
}

function hearts(ctx: Ctx, me: Me): HTMLElement | null {
  const { game, send } = ctx;
  if (!me.heartable.length) return null;
  return h(
    'div',
    { class: 'dc-hearts' },
    h('p', { class: 'dc-label' }, '❤ Your one heart this scene'),
    h(
      'div',
      { class: 'dc-heart-row' },
      me.heartable.map((id) =>
        h(
          'button',
          {
            type: 'button',
            class: `dc-heart${me.heart === id ? ' on' : ''}`,
            'aria-pressed': me.heart === id ? 'true' : 'false',
            onclick: () => {
              buzz(30);
              void send({ kind: 'heart', actorId: me.heart === id ? null : id, round: game.round });
            },
          },
          me.heart === id ? '❤ ' : '♡ ',
          nameOf(ctx.view, id),
        ),
      ),
    ),
  );
}

function screeningScreen(ctx: Ctx, me: Me): HTMLElement {
  const { game, send, isVip, view } = ctx;
  const now = game.now;
  const kids: (HTMLElement | null)[] = [];
  if (!now) kids.push(h('p', { class: 'big' }, '🎬 The screening!'), h('p', { class: 'hint' }, 'Watch the TV. Guess how each dub was directed.'));
  else if (me.myTurn) {
    if (now.local && (now.step === 'play' || now.step === 'replay')) playMine(game.round, `${game.round}:${now.index}:${now.step}`);
    kids.push(
      h('p', { class: 'big' }, '🎬 Your dub is on!'),
      now.local ? h('p', { class: 'hint' }, 'Playing from this phone: hold it up!') : null,
      (now.step === 'reveal' || now.step === 'booth') && now.card ? h('p', { class: 'dc-ok' }, `${now.guessedBy.length} of ${now.guessers} read your card.`) : h('p', { class: 'hint' }, 'Keep a straight face…'),
      now.step === 'booth' ? h('p', { class: 'dc-ok' }, '🎬 カット！ Fude-kantoku liked that ad-lib.') : null,
    );
  } else {
    const revealed = (now.step === 'reveal' || now.step === 'booth') && now.card;
    const right = revealed && me.guess === now.card!.id;
    kids.push(
      h('p', { class: 'dc-now' }, `${nameOf(view, now.playerId)}’s dub · ${now.index + 1} of ${now.count}`),
      now.step === 'lead' ? h('p', { class: 'hint' }, 'Listen…') : null,
      revealed
        ? h('div', { class: `dc-result ${right ? 'right' : 'wrong'}` }, cardFace(now.card!), h('p', {}, right ? '⭕ You got it!' : me.guess ? '❌ Not this time' : 'It was this card.'))
        : h(
            'div',
            { class: 'dc-grid' },
            me.grid.map((c) =>
              h(
                'button',
                {
                  type: 'button',
                  class: `dc-guess${me.guess === c.id ? ' on' : ''}`,
                  disabled: !me.canGuess,
                  'aria-pressed': me.guess === c.id ? 'true' : 'false',
                  onclick: () => {
                    buzz(30);
                    void send({ kind: 'guess', actorId: now.playerId, direction: c.id, round: game.round });
                  },
                },
                cardFace(c),
              ),
            ),
          ),
      now.step === 'guess' && !me.askedAgain
        ? h('button', { type: 'button', class: 'secondary dc-again', onclick: () => void send({ kind: 'again', actorId: now.playerId, round: game.round }) }, h('span', { lang: 'ja' }, 'もう いっかい！'), ' Play it again')
        : now.step === 'guess' && me.askedAgain
          ? h('p', { class: 'hint' }, `🙋 Asked to hear it again (${now.again} so far)`)
          : null,
    );
  }
  kids.push(boothGist(me.gist), galleryTile(me.gallery, (pick) => void send({ kind: 'gallery', pick, round: game.round })), hearts(ctx, me));
  if (isVip && now && !now.skipped && now.step !== 'reveal' && now.step !== 'booth')
    kids.push(h('details', { class: 'dc-vip' }, h('summary', {}, 'VIP: skip this dub'), holdButton('🚫 Skip it', 'secondary', () => void send({ kind: 'skip', actorId: now.playerId, round: game.round }))));
  return h('div', { class: 'screen' }, ...kids);
}

function notesScreen(ctx: Ctx, me: Me): HTMLElement {
  const n = me.notes;
  if (!n) return h('div', { class: 'screen' }, h('p', { class: 'big' }, '📝 Cast notes'), h('p', { class: 'hint' }, 'Look at the TV!'), hearts(ctx, me));
  const pct = n.similarity === null ? null : Math.round(n.similarity * 100);
  return h(
    'div',
    { class: 'screen' },
    h('p', { class: 'big' }, n.best ? '🏆 Your dub is in tonight’s episode!' : '📝 Your cast notes'),
    h(
      'ul',
      { class: 'dc-notes' },
      h('li', {}, `🎭 ${n.guessedBy} read your card`),
      h('li', {}, `❤ ${n.hearts} heart${n.hearts === 1 ? '' : 's'}`),
      me.adlib && adlibbing(me)
        ? h('li', {}, me.adlib.check ? `🎙 Ad-lib: ${me.adlib.check.casual ? 'casual ✓' : 'not casual yet'} · ${me.adlib.check.key ? 'mission ✓' : 'mission missed'}` : '🎙 Ad-lib: no plain read this time')
        : h('li', {}, n.checked ? (pct === null ? '🗣 No plain read this time' : `🗣 Plain read: ${pct}% of the sounds came through`) : '🗣 No speech check tonight'),
      n.spoiler ? h('li', { class: 'dc-warn' }, '🤐 You said your card out loud: no acting points this time.') : null,
    ),
    adlibbing(me) ? aimFor(me) : null,
    marks(me),
    modelBox(me),
    h('p', { class: 'dc-total' }, `+${n.total}`),
  );
}

export const dubClubPhone: PhoneMode<DubView> = {
  key: (view, game) => [view.phaseSeq, JSON.stringify(game.me), game.now ? `${game.now.index}${game.now.step}` : '', game.step ? `${game.step.kind}${game.step.scene?.index ?? ''}` : '', local, view.phase === 'answer' ? game.cast.map((c) => +c.sent).join('') : ''].join('|'),

  render(ctx) {
    const { view, game } = ctx;
    const me = game.me;
    armAutoSend(ctx, view);
    switch (view.phase) {
      case 'intro':
        return h(
          'div',
          { class: 'screen' },
          h('p', { class: 'big', lang: 'ja' }, 'アフレコ', h('ruby', {}, '部', h('rt', {}, 'ぶ'))),
          h('p', {}, '🎬 You’re the voice cast of a very cheap anime.'),
          h('p', {}, '🤫 Each scene, you get a secret card: how to say your line (sadly, like a robot…).'),
          h('p', {}, '🎤 Read the line plainly, then record it in character. The TV plays every dub; guess how each was directed!'),
          privacy(),
        );
      case 'prompt':
        if (!me?.acting) return waiting('Look at the TV!', 'You’re watching this scene.');
        return pickScreen(ctx, me);
      case 'answer':
        if (!me) return waiting('Look at the TV!');
        return recordPhase(ctx, me);
      case 'reveal':
        return me ? screeningScreen(ctx, me) : waiting('Look at the TV!');
      case 'score':
        return me ? notesScreen(ctx, me) : waiting('Look at the TV!');
      case 'finale': {
        const st = game.step;
        if (me?.myTurn && st?.scene?.local) playMine(st.scene.index, `ep:${st.scene.index}`);
        return h('div', { class: 'screen' }, h('p', { class: 'big' }, '📺 Tonight’s episode'), h('p', { class: 'hint' }, me?.myTurn ? 'Your dub is on!' : 'Look at the TV!'));
      }
      default:
        return waiting('Look at the TV!');
    }
  },
};

/** The two cards, small, while recording: you can still change your mind until the take is sent. */
function offeredStrip(ctx: Ctx, me: Me): HTMLElement {
  return h(
    'div',
    { class: 'dc-strip' },
    h('p', { class: 'dc-label' }, 'Switch card? (until you send)'),
    h(
      'div',
      { class: 'dc-pick small' },
      me.offered.map((c) =>
        h('button', { type: 'button', class: `dc-pick-btn${me.direction?.id === c.id ? ' on' : ''}`, onclick: () => void ctx.send({ kind: 'pick', direction: c.id, round: ctx.game.round }) }, cardFace(c)),
      ),
    ),
  );
}
