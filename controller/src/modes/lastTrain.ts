// Last Train on the phone: your own item at each stop, said out loud (typed works, earns
// less), a private retry with a hint, the penalty car, room overrule votes, ghost haunts and
// the Platform Dash.
//
// Two things keep a spoken answer from being wiped by someone else's update:
//  - the screen key only covers what this player is doing (their task, status, result);
//  - room overrule cards and the haunt panel live in a "live" box that key() refreshes in
//    place, so a vote elsewhere never rebuilds the talk button mid-sentence.

import { h, mount, ruby } from '../../../shared/src/dom.js';
import type { JpText, Level, StationSign } from '../../../content/src/types.js';
import { signBoard } from '../../../shared/src/signBoard.js';
import type { LastTrainView, OverruleView, TaskView } from '../../../shared/src/modes/lastTrain/lastTrain.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import { speakBox } from '../components/speak.js';
import { waiting } from '../components/ui.js';
import { jpView } from '../components/jp.js';
import { toRomaji } from '../../../shared/src/japanese/romaji.js';
import { hasTabAudio } from '../../../shared/src/audioTabs.js';
import { isSoundOff } from '../components/voice.js';
import type { PhoneContext, PhoneMode } from './types.js';

// ---- small pieces ----

/** This phone's level, set on each render: every Japanese line follows it (components/jp.ts). */
let level: Level | null = null;

function jpBlock(jp: JpText, opts: { en?: boolean; big?: boolean; romaji?: boolean } = {}): HTMLElement {
  return jpView(jp, level, { en: opts.en, romaji: opts.romaji, cls: `lt-jp${opts.big ? ' big' : ''}` });
}

// ---- personal timer ----

/** When this phone first saw each task: the clock for that attempt starts then. */
const seenAt = new Map<string, number>();

function countdown(task: TaskView, send: (move: unknown) => Promise<boolean>): HTMLElement {
  if (!seenAt.has(task.key)) seenAt.set(task.key, Date.now());
  if (seenAt.size > 200) seenAt.delete(seenAt.keys().next().value!);
  const start = seenAt.get(task.key)!;
  const fill = h('div', { class: 'lt-clock-fill' });
  const label = h('span', { class: 'lt-clock-label' });
  // The number sits beside the bar, not on it, so it stays readable on both colours.
  const el = h('div', { class: 'lt-clock-row' }, h('div', { class: 'lt-clock' }, fill), label);
  let ticked = false;
  const draw = () => {
    const left = Math.max(0, task.limitMs - (Date.now() - start));
    fill.style.width = `${(left / task.limitMs) * 100}%`;
    el.classList.toggle('low', left < 3000);
    label.textContent = left > 0 ? `⏱ ${Math.ceil(left / 1000)}s to answer` : 'Time!';
    if (left === 0 && !ticked) {
      ticked = true;
      // Tell the server our time is up (it checks against its own clock).
      setTimeout(() => void send({ kind: 'tick' }), 300);
    }
  };
  draw();
  const timer = setInterval(() => {
    if (!el.isConnected && Date.now() - start > 1000) return clearInterval(timer);
    draw();
  }, 200);
  return el;
}

// ---- listening (Station Announcement) ----

function speakJa(text: string): boolean {
  if (isSoundOff()) return false;
  const synth = globalThis.speechSynthesis;
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return false;
  if (!hasTabAudio()) return true; // another tab of this phone reads it out
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ja-JP';
  u.rate = 0.9;
  synth.speak(u);
  return true;
}

const played = new Set<string>();

// Sound off: the announcement runs once across a station departure board, then is gone, with one replay.
// Left up, the words would turn listening into copying. Started times survive the screen's redraws.
const boards = new Map<string, { start: number; replayed: boolean }>();
const boardMs = (kana: string) => Math.max(6_000, kana.length * 380);

function boardBox(task: TaskView): HTMLElement {
  let b = boards.get(task.key);
  if (!b) boards.set(task.key, (b = { start: Date.now(), replayed: false }));
  const kana = task.prompt.kana;
  const ms = boardMs(kana);
  const line = h('span', { class: 'lt-board-line', lang: 'ja' }, kana, level === 'kana' ? h('small', { lang: 'ja-Latn' }, `  ${toRomaji(kana)}`) : null);
  const board = h('div', { class: 'lt-board', role: 'marquee', 'aria-label': kana }, line);
  // Calm motion: the words stand still on the board for the same time, then go.
  const calm = document.body.dataset.motion === 'calm' || matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (calm) line.classList.add('calm');
  const run = (from: number) => line.style.setProperty('animation', `${calm ? 'lt-board-calm' : 'lt-board'} ${ms}ms linear ${-Math.min(from, ms)}ms 1 both`);
  run(Date.now() - b.start);
  const again = h('button', { type: 'button', class: 'secondary', disabled: b.replayed }, b.replayed ? 'Shown again' : '▶ Show it again (once)') as HTMLButtonElement;
  again.addEventListener('click', () => {
    b.replayed = true;
    b.start = Date.now();
    again.disabled = true;
    again.textContent = 'Shown again';
    line.style.animation = 'none';
    void line.offsetWidth;
    run(0);
  });
  return h('div', { class: 'lt-listen' }, h('p', { class: 'hint' }, '🚉 Read the announcement as it goes by, then answer.'), board, again);
}

function listenBox(task: TaskView): HTMLElement {
  if (isSoundOff()) return boardBox(task);
  const text = h('div', { class: 'lt-listen-text', hidden: true }, jpBlock(task.prompt, { en: false }));
  const reveal = () => text.removeAttribute('hidden');
  const play = () => {
    if (!speakJa(task.prompt.kana)) setTimeout(reveal, 2500); // no voice here: show the words instead
  };
  if (!played.has(task.key)) {
    played.add(task.key);
    play();
  }
  return h(
    'div',
    { class: 'lt-listen' },
    h('p', { class: 'hint' }, '🔊 Listen to the announcement, then answer.'),
    h('button', { type: 'button', class: 'secondary', onclick: play }, '▶ Play it again'),
    text,
  );
}

// ---- answering ----

/**
 * Kana level: what the signs say, under the boards (a first meeting shows it from the start; a pair only on
 * the retry). The reading goes under the board, not on it: the board is the sign as it hangs in a station.
 */
function signReadings(signs: StationSign[], attempt: 1 | 2): HTMLElement {
  const read = signs.filter((sg) => sg.reading);
  if (read.length === 1 && signs.length === 1 && attempt === 1) {
    const r = read[0]!.reading!;
    return h('p', { class: 'lt-sign-reading' }, 'It reads ', h('strong', { lang: 'ja' }, r), ` (${toRomaji(r)}). Say it!`);
  }
  return h('p', { class: 'lt-sign-reading' }, read.flatMap((sg, i) => [i ? ' · ' : '', h('span', { lang: 'ja' }, `${sg.text} = ${sg.reading}`), ` (${toRomaji(sg.reading!)})`]));
}

/** Kana players get the direction words with every pair of boards. */
function directionStrip(): HTMLElement {
  return h('p', { class: 'lt-dir-strip' }, '← ひだり hidari · ↑ まっすぐ massugu · みぎ migi →');
}

let draft: { key: string; input: HTMLInputElement } | null = null;

function taskScreen(task: TaskView, game: LastTrainView, send: (move: unknown) => Promise<boolean>, banner?: string): HTMLElement {
  const me = game.me!;
  const showText = !task.listen || task.attempt === 2;
  const box = speakBox({
    label: task.attempt === 2 ? 'Hold and try again' : 'Hold and say your answer',
    placeholder: level === 'kana' ? 'かなで…' : 'Type it (earns less)',
    kanaPadOpen: level === 'kana',
    onSend: (utterance) => void send({ kind: 'answer', key: task.key, utterance }),
  });
  // Keep a half-typed answer across a re-render of the same task.
  const input = box.querySelector('input');
  if (input instanceof HTMLInputElement) {
    if (draft && draft.key === task.key && draft.input !== input) input.value = draft.input.value;
    draft = { key: task.key, input };
  }
  return h(
    'div',
    { class: `screen lt-task lt-${task.kind}${task.attempt === 2 ? ' retry' : ''}` },
    banner ? h('p', { class: 'lt-banner' }, banner) : null,
    h(
      'div',
      { class: 'lt-task-head' },
      task.minigame ? h('span', { class: 'lt-chip' }, ruby(task.minigame)) : h('span', { class: 'lt-chip' }, 'ダッシュ！'),
      task.attempt === 2 ? h('span', { class: 'lt-chip warn' }, 'Retry') : null,
      me.ghost ? h('span', { class: 'lt-chip ghost' }, '👻 Ghost') : null,
    ),
    countdown(task, send),
    task.listen && task.attempt === 1 ? listenBox(task) : null,
    task.signs?.length ? signBoard(task.signs) : null,
    task.signs && task.signs.length > 1 && level === 'kana' ? directionStrip() : null,
    task.signs?.some((sg) => sg.reading) ? signReadings(task.signs, task.attempt) : null,
    task.attempt === 1 && task.hint ? h('p', { class: 'lt-hint-first' }, `💡 ${task.hint}`) : null,
    // かな players get the romaji under the prompt too, unless the task carries its own.
    showText ? jpBlock(task.prompt, { en: level === 'kana' || task.attempt === 2, big: true, romaji: level === 'kana' && !task.romaji }) : null,
    // N5 and up read the Japanese first; the English is one tap away.
    showText && level !== 'kana' && task.attempt === 1 && task.prompt.en ? h('details', { class: 'lt-en-tap' }, h('summary', {}, 'English'), h('p', {}, task.prompt.en)) : null,
    showText && task.romaji ? h('p', { class: 'lt-romaji' }, task.romaji) : null,
    task.visual && !task.listen ? h('p', { class: 'lt-visual' }, `👀 ${task.visual}`) : null,
    task.attempt === 2
      ? h(
          'div',
          { class: 'lt-hint' },
          task.lastHeard ? h('p', {}, 'Heard: ', h('span', { lang: 'ja' }, task.lastHeard)) : h('p', {}, 'Time ran out.'),
          task.hint ? h('p', {}, `💡 ${task.hint}`) : null,
          // The server already adds the romaji: "お (o)".
          task.firstKana ? h('p', {}, `It starts with ${task.firstKana}`) : null,
        )
      : null,
    box,
    h('button', { type: 'button', class: 'linkish', onclick: () => void send({ kind: 'pass', key: task.key }) }, task.kind === 'dash' ? 'Skip this one' : 'I don’t know'),
  );
}

// ---- live box: overrule votes and haunts ----

let live: { el: HTMLElement; send: (m: unknown) => Promise<boolean> } | null = null;

function overruleCard(w: OverruleView, send: (m: unknown) => Promise<boolean>): HTMLElement | null {
  if (w.mine) {
    if (w.state === 'open') return h('p', { class: 'lt-vote-note' }, `🙋 The room is voting on your rejected answer: ${w.up}/${w.eligible} 👍`);
    return w.state === 'overruled' ? h('p', { class: 'lt-vote-note good' }, '🎉 The room overruled it: counted as correct!') : null;
  }
  if (w.heard === undefined || w.state !== 'open') return null;
  return h(
    'div',
    { class: 'lt-vote' },
    h('p', {}, h('strong', {}, w.name), '’s answer was rejected. Was it right?'),
    w.signs?.length ? signBoard(w.signs, { small: true }) : null,
    w.prompt ? jpBlock(w.prompt, { en: true }) : null,
    h('p', { class: 'lt-heard' }, 'They said: ', h('span', { lang: 'ja' }, w.heard)),
    level === 'kana' && w.heard ? h('p', { class: 'lt-romaji' }, toRomaji(w.heard)) : null,
    w.canVote
      ? h(
          'div',
          { class: 'lt-vote-btns' },
          // Two equal buttons: the screen asks a question, it doesn't nudge the answer.
          h('button', { type: 'button', class: 'secondary', onclick: () => void send({ kind: 'overrule', windowId: w.id, up: true }) }, '✓ Count it'),
          h('button', { type: 'button', class: 'secondary', onclick: () => void send({ kind: 'overrule', windowId: w.id, up: false }) }, '✗ Doesn’t count'),
        )
      : h('p', { class: 'hint' }, w.myVote ? 'You gave it a 👍' : 'You voted 👎'),
  );
}

function liveContent(game: LastTrainView, send: (m: unknown) => Promise<boolean>): (HTMLElement | null)[] {
  const me = game.me;
  const parts: (HTMLElement | null)[] = game.overrules.map((w) => overruleCard(w, send));
  if (me?.canHaunt && me.hauntTargets.length) {
    parts.push(
      h(
        'div',
        { class: 'lt-haunt' },
        h('p', {}, '👻 Haunt a passenger: their next timer loses 2 seconds.'),
        h('div', { class: 'lt-haunt-btns' }, me.hauntTargets.map((t) => h('button', { type: 'button', class: 'secondary', onclick: () => void send({ kind: 'haunt', targetId: t.playerId }) }, t.name))),
      ),
    );
  }
  return parts;
}

function liveBox(game: LastTrainView, send: (m: unknown) => Promise<boolean>): HTMLElement {
  const el = h('div', { class: 'lt-live' });
  mount(el, liveContent(game, send));
  live = { el, send };
  return el;
}

function liveKey(game: LastTrainView): string {
  return [game.overrules.map((w) => `${w.id}:${w.state}:${w.up}:${w.canVote}:${w.myVote}`).join(','), game.me?.canHaunt, game.me?.hauntTargets.map((t) => t.playerId).join()].join('|');
}
let lastLiveKey = '';

// ---- screens by phase ----

function statusScreen(game: LastTrainView): HTMLElement {
  const me = game.me!;
  switch (me.status) {
    case 'correct':
      return waiting('✓ Correct!', me.ghost ? `Ghost streak ${me.streak}/2: one more and you’re back aboard.` : 'Waiting for the other passengers…');
    case 'missed':
      return waiting('✗ Missed it', me.ghost ? 'Ghosts don’t fear the penalty car. Keep answering!' : 'The penalty car awaits… 👀');
    case 'away':
      return waiting('You were away', '');
    default:
      return waiting('Hold on…', '');
  }
}

function revealScreen(game: LastTrainView, send: (m: unknown) => Promise<boolean>): HTMLElement {
  const me = game.me!;
  const r = me.result;
  if (!r) return waiting('Look at the screen!', '');
  const title = { first: '✓ First try!', retry: '✓ Got it on the retry', overruled: '🙌 Saved by the room', missed: '✗ Missed', away: 'Away' }[r.outcome];
  return h(
    'div',
    { class: 'screen lt-reveal' },
    h('p', { class: 'big' }, title, r.points ? h('span', { class: 'lt-points' }, ` +${r.points}`) : null),
    r.said ? h('p', { class: 'hint' }, 'You said: ', h('span', { lang: 'ja' }, r.said), r.via === 'typed' ? ' (typed)' : '') : null,
    h('p', { class: 'hint' }, 'Natural version:'),
    jpBlock(r.model, { big: true }),
    me.canEcho
      ? h(
          'div',
          { class: 'lt-echo' },
          h('p', { class: 'hint' }, 'Say it once, out loud:'),
          speakBox({ label: 'Hold and say it', placeholder: r.model.kana, onSend: (utterance) => void send({ kind: 'echo', utterance }) }),
        )
      : null,
    me.echo ? h('p', { class: me.echo.ok ? 'lt-good' : 'hint' }, me.echo.ok ? '✓ Nice. It’s in your survival kit.' : `Heard “${me.echo.text}”. It’s in your survival kit.`) : null,
  );
}

function dashScreen(view: RoomView, game: LastTrainView, send: (m: unknown) => Promise<boolean>): HTMLElement {
  const me = game.me!;
  const d = me.dash;
  if (view.phase === 'score') {
    const mine = game.dash?.results?.find((r) => r.playerId === view.me?.playerId);
    return waiting(mine?.rank ? `#${mine.rank} aboard! +${mine.points}` : `Left on the platform${mine?.points ? ` · +${mine.points}` : ''}`, game.twist ? game.twist.en : '');
  }
  if (!d) return waiting('Platform Dash!', '');
  if (d.aboard !== null) return waiting(`🚃 Aboard #${d.aboard}!`, 'Cheer the others on!');
  const track = game.dash!.track;
  const start = game.dash!.ghostStart;
  const bar = h('div', { class: 'lt-dashbar' }, h('div', { class: 'lt-dashbar-fill', style: `width:${((d.pos - start) / (track - start)) * 100}%` }));
  if (!me.task) return h('div', { class: 'screen' }, bar);
  return h('div', { class: 'screen' }, h('p', { class: 'hint' }, `Platform Dash: ${Math.max(0, track - d.pos)} steps to the door`), bar, taskScreen(me.task, game, send));
}

export const lastTrainPhone: PhoneMode<LastTrainView> = {
  key(view, game) {
    const me = game.me;
    // Refresh the live box in place (never part of the key).
    if (live?.el.isConnected) {
      const k = liveKey(game);
      if (k !== lastLiveKey) {
        lastLiveKey = k;
        mount(live.el, liveContent(game, live.send));
      }
    }
    return [
      view.phaseSeq,
      me?.task?.key,
      me?.status,
      me?.ghost,
      me?.streak,
      me?.inPenalty,
      me?.result?.outcome,
      me?.canEcho,
      me?.echo?.text,
      me?.dash ? `${me.dash.pos}:${me.dash.aboard}` : '',
      view.phase === 'score' ? (game.dash?.results ? 'r' : '') : '',
    ].join('|');
  },

  render(ctx: PhoneContext<LastTrainView>) {
    const { view, game, send } = ctx;
    const me = game.me;
    level = ctx.me.level;
    lastLiveKey = liveKey(game);
    let main: HTMLElement;
    switch (view.phase) {
      case 'intro':
        main = h(
          'div',
          { class: 'screen lt-intro' },
          h('p', { class: 'lt-kicker' }, '🏮 Last Train'),
          jpBlock(game.title, { big: true }),
          jpBlock(game.departure),
          h('ol', { class: 'lt-route' }, game.stops.map((s, i) => h('li', {}, ruby(s.name), h('small', {}, ` · ${s.minigame.en}`), i === game.stops.length - 1 ? h('small', {}, ' · 終点') : null))),
          h('p', { class: 'hint' }, 'Every answer is spoken. Hold the button and say it!'),
        );
        break;
      case 'prompt':
        main = h(
          'div',
          { class: 'screen lt-intro' },
          h('p', { class: 'lt-kicker' }, `Stop ${game.stopIndex + 1} of ${game.stops.length}`),
          game.stop ? jpBlock(game.stop.name, { big: true }) : null,
          game.stop ? jpBlock(game.stop.minigame.intro) : null,
          me?.ghost ? h('p', { class: 'lt-chip ghost' }, '👻 You’re a ghost: answer 2 in a row to come back') : null,
        );
        break;
      case 'answer':
        main = me?.task ? taskScreen(me.task, game, send) : statusScreen(game);
        break;
      case 'reveal':
        main = revealScreen(game, send);
        break;
      case 'penalty':
        main = me?.task
          ? taskScreen(me.task, game, send, '🚨 Penalty car! Get this one or become a ghost.')
          : me?.inPenalty
            ? waiting(me.status === 'passed' ? '😮‍💨 Survived the penalty car!' : '👻 You’re a ghost now…', me.status === 'passed' ? '' : 'Ghosts still answer, can haunt, and can come back.')
            : waiting('🚨 Penalty car', 'Watch the screen: someone is fighting for their life.');
        break;
      case 'finale':
      case 'score':
        main = dashScreen(view, game, send);
        break;
      default:
        main = waiting('Look at the screen!', '');
    }
    return h('div', { class: 'lt-phone' }, main, liveBox(game, send));
  },
};
