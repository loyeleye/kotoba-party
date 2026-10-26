// Oekaki on the stage: who's still drawing, then each drawing in turn (replayed stroke by
// stroke), the anonymous titles to vote on, and the reveal with the real title to say together.
// Nothing private is drawn: fakes stay hidden until the vote, authors and the real title until
// the score.

import { h } from '../../../shared/src/dom.js';
import { inkSvg } from '../../../shared/src/inkSvg.js';
import type { OekakiView } from '../../../shared/src/modes/views.js';
import { PALETTE } from '../../../shared/src/modes/oekaki/drawing.js';
import { toRomaji } from '../../../shared/src/modes/wordGauntlet/romaji.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import type { StageMode } from './types.js';

const nameOf = (view: RoomView, id: string | null | undefined) => view.players.find((p) => p.id === id)?.name ?? '(left)';

// The stage redraws on every update, so the replay is timed from when this phase first
// showed: a re-render picks the animation up where it was instead of starting over.
let phaseShown = { seq: -1, at: 0 };
function sincePhase(view: RoomView): number {
  if (phaseShown.seq !== view.phaseSeq) phaseShown = { seq: view.phaseSeq, at: performance.now() };
  return performance.now() - phaseShown.at;
}

/** The whole replay takes about this long, however many strokes. */
const REPLAY_MS = 5_000;

export const oekakiStage: StageMode<OekakiView> = {
  badge(game, id) {
    if (game.drawn.includes(id)) return '🖌';
    if (game.result?.artistId === id) return '🎨';
    if (game.submitted.includes(id) || game.picked.includes(id)) return '✓';
    return '';
  },

  render(view, game) {
    if (view.phase === 'intro') return intro();
    if (view.phase === 'prompt') return drawing(view, game);
    return turn(view, game);
  },
};

function intro(): HTMLElement {
  const step = (n: number, text: string, ja: string) => h('li', { class: 'oek-step', style: `animation-delay:${(n - 1) * 900}ms` }, h('span', { class: 'oek-num' }, String(n)), h('span', {}, text, ' ', h('span', { class: 'oek-ja', lang: 'ja' }, ja)));
  return h(
    'div',
    { class: 'card oek' },
    h('p', { class: 'big oek-title', lang: 'ja' }, 'お絵かき'),
    h('p', { class: 'subtitle' }, 'Oekaki: draw it, fake it, find it, say it'),
    h(
      'ol',
      { class: 'oek-steps' },
      step(1, 'Draw your secret word on your phone.', 'かいて！'),
      step(2, 'Write a fake title in Japanese for each drawing.', 'うそを かいて！'),
      step(3, 'Find the real title. Fool the others.', 'ほんものは どれ？'),
      step(4, 'Say the real one together!', 'みんなで いって！'),
    ),
  );
}

function drawing(view: RoomView, game: OekakiView): HTMLElement {
  return h(
    'div',
    { class: 'card oek' },
    h('p', { class: 'oek-tag' }, `Round ${game.round} of ${game.totalRounds} · everyone is drawing`),
    h('p', { class: 'prompt', lang: 'ja' }, 'かいて ください！'),
    h('p', { class: 'hint' }, 'Draw your secret word on your phone. No letters, no numbers!'),
    h(
      'ul',
      { class: 'oek-easels' },
      view.players.map((p) => h('li', { class: game.drawn.includes(p.id) ? 'done' : '' }, h('span', { class: 'oek-easel' }, game.drawn.includes(p.id) ? '🖼' : '🖌'), h('span', {}, p.name))),
    ),
    h('p', { class: 'hint' }, `${game.drawn.length} / ${view.players.length} drawings in`),
  );
}

function picture(view: RoomView, game: OekakiView): HTMLElement {
  if (game.hiddenDrawing || !game.drawing) {
    return h('div', { class: 'oek-frame hidden' }, h('p', {}, game.hiddenDrawing ? 'Fude painted over this one.' : '…'));
  }
  const d = game.drawing;
  const per = Math.max(60, Math.min(450, Math.floor(REPLAY_MS / Math.max(1, d.strokes.length))));
  // Replay while fakes are written; afterwards the picture is simply there.
  const elapsed = view.phase === 'answer' ? sincePhase(view) : 1e9;
  return h(
    'div',
    { class: 'oek-frame' },
    inkSvg(d.strokes, { class: 'oek-ink', strokeMs: per, elapsedMs: elapsed, colors: d.colors.map((c) => PALETTE[c]), width: 2.4 }),
  );
}

function titleLine(text: string, kana: string, romaji: boolean): HTMLElement[] {
  const kanaShown = kana && kana.replace(/\s/g, '') !== text.replace(/\s/g, '');
  return [
    h('span', { class: 'oek-opt-text', lang: 'ja' }, text),
    kanaShown ? h('span', { class: 'oek-opt-kana', lang: 'ja' }, kana) : null,
    romaji && kana ? h('span', { class: 'oek-opt-romaji' }, toRomaji(kana)) : null,
  ].filter((x): x is HTMLElement => !!x);
}

function turn(view: RoomView, game: OekakiView): HTMLElement {
  const tag = h('p', { class: 'oek-tag' }, `Round ${game.round} of ${game.totalRounds} · drawing ${game.index} of ${game.count}${game.result?.double ? ' · double points' : ''}`);
  const writers = Math.max(0, view.players.length - 1);
  let side: HTMLElement;
  if (view.phase === 'answer') {
    side = h(
      'div',
      { class: 'oek-side' },
      h('p', { class: 'prompt', lang: 'ja' }, 'これは なに？'),
      h('p', { class: 'hint' }, 'What is it? Write a fake title in Japanese on your phone. Make it sound real!'),
      h('p', { class: 'oek-count' }, `${game.submitted.length} / ${writers} fakes in`),
    );
  } else if (view.phase === 'reveal') {
    side = h(
      'div',
      { class: 'oek-side' },
      h('p', { class: 'prompt small' }, 'One title is real. Which one?'),
      h('ol', { class: 'oek-options' }, (game.options ?? []).map((o) => h('li', { class: o.hidden ? 'hidden' : '' }, titleLine(o.text, o.kana, game.kanaAtTable)))),
      h('p', { class: 'oek-count' }, `${game.picked.length} / ${writers} picks in`),
    );
  } else {
    side = result(view, game);
  }
  return h('div', { class: `card oek oek-turn ${view.phase}` }, tag, h('div', { class: 'oek-board' }, picture(view, game), side));
}

function result(view: RoomView, game: OekakiView): HTMLElement {
  const r = game.result;
  if (!r) return h('div', { class: 'oek-side' });
  const real = r.real;
  const rows = [...r.options].sort((a, b) => Number(b.real) - Number(a.real) || b.pickedBy.length - a.pickedBy.length);
  return h(
    'div',
    { class: 'oek-side' },
    h(
      'div',
      { class: 'oek-real' },
      h('p', { class: 'oek-real-tag' }, `The real title, by ${nameOf(view, r.artistId)} · say it together!`),
      h('ruby', { class: 'oek-real-text', lang: 'ja' }, real.text, h('rt', {}, real.kana.replace(/\s/g, '') !== real.text.replace(/\s/g, '') ? real.kana : '')),
      game.kanaAtTable ? h('p', { class: 'oek-opt-romaji' }, toRomaji(real.kana)) : null,
      h('p', { class: 'oek-real-en' }, real.en),
    ),
    h(
      'ol',
      { class: 'oek-results' },
      rows.map((o) =>
        h(
          'li',
          { class: `${o.real ? 'real' : ''} ${o.hidden ? 'hidden' : ''}` },
          h('span', { class: 'oek-res-title' }, ...titleLine(o.text, o.real ? '' : o.kana, false), o.en && !o.real ? h('small', {}, ` ${o.en}`) : null),
          h(
            'span',
            { class: 'by' },
            o.real ? 'REAL' : o.house ? 'Fude’s decoy' : `by ${o.authors.map((a) => a.name).join(' & ')}`,
            o.pickedBy.length ? ` · picked by ${o.pickedBy.map((p) => p.name).join(', ')}` : ' · nobody picked it',
          ),
        ),
      ),
    ),
    r.said.length ? h('p', { class: 'hint' }, `Said it: ${r.said.map((id) => nameOf(view, id)).join(', ')}`) : null,
  );
}
