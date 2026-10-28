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
// A take goes to the room for the TV to play (kept in memory only), or, with "Play my voice from this
// phone", stays here and this phone plays it when its turn comes.

import { h } from '../../../shared/src/dom.js';
import type { DubCard, DubView } from '../../../shared/src/modes/dubClub/dubClub.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import { MicClip, recordReady, uploadClip } from '../components/mic.js';
import { canSpeak, isQuiet, speakBox } from '../components/speak.js';
import { jpView } from '../components/jp.js';
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
    h('span', { class: 'dc-card-emoji', 'aria-hidden': 'true' }, c.emoji),
    h('span', { class: 'dc-card-jp', lang: 'ja' }, c.jp.text),
    c.romaji ? h('span', { class: 'dc-card-ro' }, c.romaji) : null,
    h('span', { class: 'dc-card-en' }, c.jp.en),
    opts.tip && c.tip ? h('span', { class: 'dc-card-tip' }, c.tip) : null,
  );
}

function lineBox(me: Me, cls = ''): HTMLElement | null {
  return me.line ? jpView(me.line, me.level, { cls: `dc-line ${cls}` }) : null;
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
    h('p', { class: 'dc-label' }, 'Your line'),
    lineBox(me),
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
    { class: 'dc-marks', lang: 'ja', 'aria-label': 'Sounds that came through are green' },
    reh.marks.map((m) => h('span', { class: m.ok ? 'ok' : 'miss' }, m.m)),
  );
}

function rehearseScreen(ctx: Ctx, me: Me): HTMLElement {
  const { game, send } = ctx;
  const reh = me.rehearsal;
  const again = !reh || (stepOf.retry && reh.left > 0);
  const sim = reh?.similarity ?? 0;
  const verdict = !reh ? null : reh.marks.every((m) => m.ok) ? 'Crisp! Every sound came through.' : sim >= 0.5 ? 'Nearly! The grey sounds got lost.' : 'Hard to hear. Slow down and say every sound.';
  return h(
    'div',
    { class: 'screen' },
    h('p', { class: 'dc-step' }, 'Step 1 of 2 · read it plainly'),
    lineBox(me),
    reh ? marks(me) : null,
    verdict ? h('p', { class: sim >= 0.5 ? 'dc-ok' : 'dc-warn' }, verdict) : h('p', { class: 'hint' }, 'Just the words, clearly. Only you see how it went.'),
    again
      ? speakBox({ label: 'Hold and read the line', speechOnly: true, autoSend: true, onSend: (utterance) => (setStep(ctx, { retry: false }), void send({ kind: 'rehearse', utterance, round: game.round })) })
      : null,
    reh && !again && reh.left > 0 ? h('button', { type: 'button', class: 'secondary dc-retry', onclick: () => setStep(ctx, { retry: true }) }, '🔁 Read it once more') : null,
    h('button', { type: 'button', class: reh ? 'primary' : 'linkish', onclick: () => setStep(ctx, { act: true }) }, reh ? '🎬 Now act it!' : 'Skip to acting'),
  );
}

function actScreen(ctx: Ctx, me: Me): HTMLElement {
  const { game } = ctx;
  const d = drafts.get(game.round);
  const live = rec?.round === game.round ? rec : null;
  const seconds = Math.round(me.limitMs / 1000);
  const recBtn = live
    ? h(
        'button',
        { type: 'button', class: `dc-rec on${live.started === null ? ' opening' : ''}`, style: live.started !== null ? `--len:${me.limitMs}ms` : null, onclick: () => stopRecording(ctx) },
        h('span', { class: 'dc-rec-bar', 'aria-hidden': 'true' }),
        h('span', { class: 'dc-rec-label' }, live.started === null ? 'Opening the mic…' : '■ Stop'),
      )
    : h('button', { type: 'button', class: 'dc-rec', disabled: sending, onclick: () => startRecording(ctx, me) }, h('span', { class: 'dc-rec-label' }, d ? '● Record again' : '● Record'));
  return h(
    'div',
    { class: 'screen' },
    h('p', { class: 'dc-step' }, me.rehearsal || canSpeak() ? 'Step 2 of 2 · act it!' : 'Act it!'),
    me.direction ? cardFace(me.direction, { tip: true, cls: 'big' }) : null,
    me.offered.length > 1 ? offeredStrip(ctx, me) : null,
    lineBox(me, 'small'),
    h('p', { class: 'hint' }, `Say the line the way your card says, up to ${seconds} seconds. Don’t say the card!`),
    recBtn,
    d && !live
      ? h(
          'div',
          { class: 'dc-review' },
          h('audio', { controls: true, src: d.url, preload: 'auto' }),
          h('button', { type: 'button', class: 'primary', disabled: sending, onclick: () => void sendTake(ctx) }, sending ? 'Sending…' : '📤 Send this take'),
        )
      : null,
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
    d ? h('audio', { controls: true, src: d.url }) : null,
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
      now.step === 'reveal' && now.card ? h('p', { class: 'dc-ok' }, `${now.guessedBy.length} of ${now.guessers} read your card.`) : h('p', { class: 'hint' }, 'Keep a straight face…'),
    );
  } else {
    const revealed = now.step === 'reveal' && now.card;
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
  kids.push(hearts(ctx, me));
  if (isVip && now && !now.skipped && now.step !== 'reveal')
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
      h('li', {}, n.checked ? (pct === null ? '🗣 No plain read this time' : `🗣 Plain read: ${pct}% of the sounds came through`) : '🗣 No speech check tonight'),
      n.spoiler ? h('li', { class: 'dc-warn' }, '🤐 You said your card out loud: no acting points this time.') : null,
    ),
    marks(me),
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
          h('p', { class: 'big', lang: 'ja' }, 'アフレコ部'),
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
