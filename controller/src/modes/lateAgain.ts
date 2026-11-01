// Late Again! on the phone. Your role is on the band every beat (📞 late, 👀 witness, 🎀 chief, 🍿 gallery),
// with a "Next:" line under the main card.
//
//   Scene    your role card, and your leaves.
//   Plan     late: the witness's three causes (tap one to blame), your mission, a hint behind a tap, and
//            I'm ready. Kana: tap up to three tiles (ごめんなさい！, a cause, たぬき！), say them out loud.
//            witness: what did you "see"? Three causes and the curveball. gallery: bet on the cause.
//            chief: listen; you'll rule.
//   Record   late: one button, Plan → Recording → Sent (tap to start, tap to stop, it sends itself at the
//            limit), and "Pon, say it for me" once a game. Quiet mode or no mic: type it.
//   Play     N4: the listening check. Kana and N5: tap each word you hear. Late: your excuse is on.
//   Gist     the gist at your level; your check's answer, privately.
//   Vote     voters: give a leaf (Safe) or keep it. chief: ⭕ セーフ (sky blue) or ❌ アウト (vermilion), full
//            width, one above the other. Two players: first, what did they blame?
//   Ruling   your points; the latecomer's private note (Pon's version). The booth's tag at your level.

import { h } from '../../../shared/src/dom.js';
import type { LateMe, LateView, TileView } from '../../../shared/src/modes/lateAgain/lateAgain.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import { MicClip, recordReady, uploadClip } from '../components/mic.js';
import { isQuiet } from '../components/speak.js';
import { jpView } from '../components/jp.js';
import { waiting } from '../components/ui.js';
import type { PhoneContext, PhoneMode } from './types.js';

type Ctx = PhoneContext<LateView>;

const nameOf = (view: RoomView, id: string | null | undefined): string => view.players.find((p) => p.id === id)?.name ?? '';
const ART = (picture: string): string => `/stage/assets/late/${picture}.png`;
const LEAF = '/stage/assets/late/leaf.png';

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
/** 0 closed; N5 opens the sentence frame first (1), then Pon's version (2). Other levels go straight to 2. */
let hint = { round: 0, step: 0 };
let rec: { round: number; clip: MicClip; started: number | null; timer: ReturnType<typeof setTimeout> | null } | null = null;
let sending = false;
let problem = '';
let typed = '';
/** Kept takes by round, so a phone that plays its own clip can. */
const kept = new Map<number, string>();
let playedKey = '';
let player: HTMLAudioElement | null = null;

function startRecording(ctx: Ctx, me: LateMe): void {
  if (rec || sending) return;
  problem = '';
  const round = ctx.game.round;
  const clip = new MicClip({ raw: true });
  rec = { round, clip, started: null, timer: null };
  bump(ctx);
  // The take starts when the mic is open, never before: the first syllable would be lost.
  void clip.ready.then((ok) => {
    if (rec?.clip !== clip) return;
    if (!ok) {
      rec = null;
      problem = clip.blocked ? 'The microphone is blocked. Type your excuse, or let Pon say it.' : 'Couldn’t open the microphone.';
      return bump(ctx);
    }
    buzz(40);
    rec.started = Date.now();
    rec.timer = setTimeout(() => void stopAndSend(ctx), me.limitMs);
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

function playMine(round: number): void {
  const key = `late:${round}`;
  if (key === playedKey) return;
  playedKey = key;
  const url = kept.get(round);
  if (!url) return;
  player?.pause();
  player = new Audio(url);
  void player.play().catch(() => {});
}

// ---- pieces ----

const ROLE: Record<NonNullable<LateMe['role']>, { icon: string; label: string }> = {
  latecomer: { icon: '📞', label: 'You’re late!' },
  witness: { icon: '👀', label: 'Witness' },
  chief: { icon: '🎀', label: 'Acting chief' },
  gallery: { icon: '🍿', label: 'Gallery' },
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

function pic(t: TileView): HTMLElement {
  if (t.picture === 'sorry' || t.picture === 'sound') return h('span', { class: 'la-pic la-emoji', 'aria-hidden': 'true' }, t.emoji);
  return h('img', { class: 'la-pic', src: ART(t.picture), alt: '', draggable: 'false' });
}

function tileButton(t: TileView, on: boolean, onclick: (() => void) | null, extra = ''): HTMLElement {
  return h(
    'button',
    { type: 'button', class: `la-tile${on ? ' on' : ''} ${extra}`, disabled: !onclick, onclick: onclick ?? undefined, 'aria-pressed': on ? 'true' : 'false' },
    pic(t),
    h('span', { class: 'la-tile-ja', lang: 'ja' }, t.word.text),
    t.romaji ? h('span', { class: 'la-tile-ro' }, t.romaji) : null,
    h('span', { class: 'la-tile-en' }, t.word.en),
  );
}

function gistCard(me: LateMe, who: string): HTMLElement | null {
  if (!me.gist) return null;
  return h('div', { class: 'la-gist' }, h('p', { class: 'la-label' }, `The gist of ${who}’s excuse`), jpView(me.gist, me.level, { cls: 'la-gist-line' }));
}

// ---- screens ----

function sceneScreen(ctx: Ctx, me: LateMe): HTMLElement {
  const { view, game } = ctx;
  const late = nameOf(view, game.cast?.latecomer);
  const what: Record<NonNullable<LateMe['role']>, string> = {
    latecomer: `You’re ${game.scene?.late.en ?? 'very'} late for ${game.scene?.place.en ?? 'work'}. Phone the boss with an excuse!`,
    witness: `${late} is late. Back their story up: you “saw” what happened.`,
    chief: `You wear Pon’s sash today. Listen to ${late}’s excuse, then rule Safe or Out.`,
    gallery: `${late} is late. Bet on what they’ll blame, then spend your leaf if you like the excuse.`,
  };
  return h('div', { class: 'screen la-screen' }, band(me, 'the plan'), h('p', { class: 'big' }, me.role ? `${ROLE[me.role].icon} ${ROLE[me.role].label}` : 'Look at the TV!'), me.role ? h('p', {}, what[me.role]) : null);
}

function lateScreen(ctx: Ctx, me: LateMe): HTMLElement {
  const { game, view } = ctx;
  if (me.sent) {
    if (view.phase === 'reveal' && game.play?.local) playMine(game.round);
    return h('div', { class: 'screen la-screen' }, band(me, 'the room rules on it'), h('p', { class: 'big' }, 'Sent ✓'), h('p', { class: 'hint' }, 'Watch the TV!'));
  }
  const send = (move: Record<string, unknown>) => void ctx.send({ ...move, round: game.round });
  const record = view.phase === 'answer';
  const pass = me.micPassLeft ? h('button', { type: 'button', class: 'la-pass', onclick: () => send({ kind: 'micPass' }) }, '🦝 Pon, say it for me (1 left)') : null;

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
      h('p', { class: 'la-mission' }, me.mission?.text ?? ''),
      h('div', { class: 'la-tiles' }, ...me.tiles.map((t) => tileButton(t, draft.includes(t.id), () => toggle(t.id), t.id === 'tanuki' ? 'la-curve' : ''))),
      h('p', { class: 'la-built', lang: 'ja' }, draft.length ? draft.map((id) => me.tiles.find((t) => t.id === id)?.word.text ?? '').join(' ') : '…'),
      h('p', { class: 'hint' }, '🗣 Say it out loud to the room too!'),
      h('button', { type: 'button', class: 'primary la-send', disabled: !draft.length, onclick: () => send({ kind: 'excuse', type: 'tiles', tiles: draft }) }, 'Send ✓'),
      pass,
    );
  }

  const options = me.canPick
    ? h(
        'div',
        { class: 'la-tiles la-tiles-3' },
        ...game.options.map((t) => tileButton(t, me.cause === t.id, () => send({ kind: 'cause', causeId: t.id }))),
      )
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
        step >= 1 && frame ? h('div', { class: 'la-frame' }, h('p', { class: 'la-label' }, 'Fill the gap:'), jpView(frame, me.level, { cls: 'la-model' })) : null,
        step === 1 ? h('button', { type: 'button', class: 'ghost', onclick: open(2) }, 'Still stuck? See Pon’s version') : null,
        step >= 2 ? h('div', {}, h('p', { class: 'la-label' }, 'Pon’s version:'), jpView(me.mission.model, me.level, { cls: 'la-model' })) : null,
      )
    : null;

  let action: HTMLElement;
  if (!record) {
    action = me.ready ? h('p', { class: 'hint' }, 'Ready ✓ Recording opens in a moment.') : h('button', { type: 'button', class: 'primary', onclick: () => send({ kind: 'ready' }) }, 'I’m ready');
  } else if (isQuiet() || !recordReady()) {
    action = h(
      'div',
      { class: 'la-typed' },
      h('input', { type: 'text', maxlength: '80', lang: 'ja', placeholder: 'Type your excuse in Japanese', value: typed, oninput: (e: Event) => (typed = (e.target as HTMLInputElement).value) }),
      h('button', { type: 'button', class: 'primary', onclick: () => typed.trim() && send({ kind: 'excuse', type: 'typed', text: typed }) }, 'Send ✓'),
    );
  } else {
    const on = rec?.round === game.round;
    const live = on && rec?.started !== null;
    action = h(
      'button',
      {
        type: 'button',
        class: `la-rec-btn${live ? ' live' : ''}`,
        disabled: sending,
        style: live ? `--ms: ${me.limitMs}ms` : null,
        onclick: () => (on ? void stopAndSend(ctx) : startRecording(ctx, me)),
      },
      h('span', { class: 'la-rec-ring', 'aria-hidden': 'true' }),
      sending ? 'Sending…' : live ? '■ Stop and send' : on ? 'Opening the mic…' : '● Tap to record',
    );
  }
  return h(
    'div',
    { class: 'screen la-screen' },
    band(me, record ? `up to ${Math.round(me.limitMs / 1000)} s, then the TV plays it` : 'record your excuse'),
    h('p', { class: 'la-label' }, me.canPick ? 'Blame one of these (the witness has the same three):' : 'You’re blaming:'),
    options,
    h('p', { class: 'la-mission' }, me.mission?.text ?? ''),
    hintBox,
    action,
    problem ? h('p', { class: 'la-problem' }, problem) : null,
    pass,
  );
}

function witnessScreen(ctx: Ctx, me: LateMe): HTMLElement {
  const late = nameOf(ctx.view, ctx.game.cast?.latecomer);
  return h(
    'div',
    { class: 'screen la-screen' },
    band(me, 'listen to the excuse'),
    h('p', { class: 'la-mission' }, `What did you “see” make ${late} late? Pick the one they’ll blame. Or swear it was a tanuki.`),
    h('div', { class: 'la-tiles' }, ...me.alibiTiles.map((t) => tileButton(t, me.alibi === t.id, () => void ctx.send({ kind: 'alibi', tileId: t.id, round: ctx.game.round }), t.id === 'tanuki' ? 'la-curve' : ''))),
    me.alibi ? h('p', { class: 'hint' }, 'Locked in when the call starts. You can still change it.') : null,
  );
}

function galleryScreen(ctx: Ctx, me: LateMe): HTMLElement {
  const late = nameOf(ctx.view, ctx.game.cast?.latecomer);
  return h(
    'div',
    { class: 'screen la-screen' },
    band(me, 'listen to the excuse'),
    h('p', { class: 'la-mission' }, `Bet: what will ${late} blame? (+20)`),
    h('div', { class: 'la-tiles la-tiles-3' }, ...ctx.game.options.map((t) => tileButton(t, me.bet === t.id, () => void ctx.send({ kind: 'bet', causeId: t.id, round: ctx.game.round })))),
  );
}

function chiefWait(ctx: Ctx, me: LateMe): HTMLElement {
  const late = nameOf(ctx.view, ctx.game.cast?.latecomer);
  return h('div', { class: 'screen la-screen' }, band(me, 'listen, then rule'), h('p', { class: 'big' }, '🎀 Acting chief'), h('p', {}, `${late} is phoning you. Listen to the excuse. Then: Safe or Out?`), h('p', { class: 'hint' }, 'Right call = +100. Watch everyone’s leaves on the TV: who can still vote Safe?'));
}

function listenScreen(ctx: Ctx, me: LateMe): HTMLElement {
  const { game, view } = ctx;
  const late = nameOf(view, game.cast?.latecomer);
  if (me.role === 'latecomer') return lateScreen(ctx, me);
  const send = (move: Record<string, unknown>) => void ctx.send({ ...move, round: game.round });
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
            c.right === i ? ' ✓' : '',
          ),
        ),
      ),
    );
  }
  if (me.catchTiles.length) {
    parts.push(
      h('p', { class: 'la-mission' }, gisting ? 'Words you caught:' : 'Tap each word you hear! (+10 each)'),
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
  const send = (move: Record<string, unknown>) => void ctx.send({ ...move, round: game.round });
  if (me.role === 'chief') {
    if (game.coop && !me.coopPick)
      return h(
        'div',
        { class: 'screen la-screen' },
        band(me, 'Safe or Out'),
        gistCard(me, late),
        h('p', { class: 'la-mission' }, `What did ${late} blame? (+100 for the team)`),
        h('div', { class: 'la-tiles la-tiles-3' }, ...game.options.map((t) => tileButton(t, false, () => send({ kind: 'pick', causeId: t.id })))),
      );
    return h(
      'div',
      { class: 'screen la-screen' },
      band(me, 'the ruling'),
      gistCard(me, late),
      h('p', { class: 'la-mission' }, game.coop ? 'Safe or Out?' : 'Will the room forgive them? Rule:'),
      h('button', { type: 'button', class: `la-call la-safe${me.call === 'safe' ? ' on' : ''}`, lang: 'ja', onclick: () => send({ kind: 'rule', call: 'safe' }) }, h('span', { class: 'la-call-icon' }, '⭕'), 'セーフ！', h('small', {}, 'Safe')),
      h('button', { type: 'button', class: `la-call la-out${me.call === 'out' ? ' on' : ''}`, lang: 'ja', onclick: () => send({ kind: 'rule', call: 'out' }) }, h('span', { class: 'la-call-icon' }, '❌'), 'アウト！', h('small', {}, 'Out')),
      h('p', { class: 'hint' }, '🗣 Say it out loud as you tap!'),
    );
  }
  if (me.canVote) {
    const none = me.leaves <= 0;
    return h(
      'div',
      { class: 'screen la-screen' },
      band(me, 'the ruling'),
      gistCard(me, late),
      h('p', { class: 'la-mission' }, `Forgive ${late}? A leaf is a Safe vote (+100 to them).`),
      h(
        'button',
        { type: 'button', class: `la-call la-give${me.gave === true ? ' on' : ''}`, disabled: none, onclick: () => send({ kind: 'leaf', give: true }) },
        h('img', { class: 'la-leaf big', src: LEAF, alt: '' }),
        none ? 'No leaf left' : 'Give a leaf',
      ),
      h('button', { type: 'button', class: `la-call la-keep${me.gave === false ? ' on' : ''}`, onclick: () => send({ kind: 'leaf', give: false }) }, '✋ Keep it'),
      h('p', { class: 'hint' }, none ? 'You get a new leaf every other round.' : 'Leaves are scarce: one more comes every other round, and you can hold two.'),
    );
  }
  return h('div', { class: 'screen la-screen' }, band(me, 'the ruling'), h('p', { class: 'big' }, me.role === 'latecomer' ? '🙏 The room is deciding…' : 'Look at the TV!'));
}

function scoreScreen(ctx: Ctx, me: LateMe): HTMLElement {
  const { game } = ctx;
  const b = game.booth;
  const tag = b?.tag ? h('p', { class: 'la-tag' }, '🚃 ', me.level === 'n4' ? `You’re on this line: ${b.tag}` : `Coming up: ${b.tag}`) : null;
  const note = me.note
    ? h(
        'div',
        { class: 'la-note' },
        h('p', { class: 'la-label' }, me.note.used ? 'Nice: you used it!' : 'Pon’s version, for next time:'),
        jpView(me.note.model, me.level, { cls: 'la-model' }),
      )
    : null;
  return h('div', { class: 'screen la-screen' }, band(me, game.round < game.totalRounds ? 'the next latecomer' : 'the results'), h('p', { class: 'big la-points' }, `+${me.points ?? 0}`), note, tag);
}

export const lateAgainPhone: PhoneMode<LateView> = {
  key: (view, game) => [view.phaseSeq, game.step, game.round, JSON.stringify(game.me), local, game.booth ? 'b' : '', game.play?.local ? 'l' : ''].join('|'),

  render(ctx) {
    const { view, game } = ctx;
    const me = game.me;
    // A recording left running when the phase moves on is sent as it is.
    if (rec && (view.phase !== 'answer' || rec.round !== game.round)) void stopAndSend(ctx);
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
