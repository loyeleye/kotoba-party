// Shodō Taikai on the stage. Nothing here names who is still writing or whose sheet missed:
//
//   お手本    one shared scroll, a column per player (no names), filling as each character is
//            written; then the room reads it aloud together.
//   書き取り  how many sheets are in, then the synchro replay: every sheet brushes on at once,
//            stroke by stroke, a little askew like real paper; "順 ×" marks a stroke written
//            out of order. Only clean writers are named.
//   展覧会    the brief, then the gallery: every big sheet, numbered, brushing on together as the
//            vote opens, with Fude's はなまる on its best stroke; stamps and each stamp's winner
//            show once the vote is in, and names only for sheets their writers claim.

import { h } from '../../../shared/src/dom.js';
import { inkSvg } from '../../../shared/src/inkSvg.js';
import { AWARDS, type SheetView, type ShodoView } from '../../../shared/src/modes/shodo/shodo.js';
import { toRomaji } from '../../../shared/src/japanese/romaji.js';
import type { InkPoint } from '../../../shared/src/japanese/strokes.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import type { StageMode } from './types.js';

// The stage redraws on every update, so the replay is timed from when this phase first
// showed: a re-render picks the animation up where it was.
let phaseShown = { seq: -1, at: 0 };
function sincePhase(view: RoomView): number {
  if (phaseShown.seq !== view.phaseSeq) phaseShown = { seq: view.phaseSeq, at: performance.now() };
  return performance.now() - phaseShown.at;
}

export const shodoStage: StageMode<ShodoView> = {
  render(view, game) {
    switch (view.phase) {
      case 'intro':
        return intro();
      case 'prompt':
      case 'score':
        return scroll(view, game);
      case 'answer':
        return writing(game, game.itemKind === 'dictation' ? 'きいて、かいて · Hear it on your phone, then write it' : 'いって、かいて · Say it from memory, then write it');
      case 'reveal':
        return replay(view, game);
      case 'encore':
        return writing(game, briefLine(game), game.otherHand ? '✋ はんたいの てで! · With your other hand!' : null);
      case 'finale':
      case 'penalty':
        return gallery(view, game);
      default:
        return h('div', { class: 'card sho' });
    }
  },
};

function intro(): HTMLElement {
  const step = (n: number, text: string, ja: string) => h('li', { class: 'sho-step', style: `animation-delay:${(n - 1) * 900}ms` }, h('span', { class: 'sho-num' }, String(n)), h('span', {}, text, ' ', h('span', { class: 'sho-ja', lang: 'ja' }, ja)));
  return h(
    'div',
    { class: 'card sho' },
    h('p', { class: 'big sho-title', lang: 'ja' }, '書道大会'),
    h('p', { class: 'subtitle' }, 'Shodō Taikai: the calligraphy contest'),
    h(
      'ol',
      { class: 'sho-steps' },
      step(1, 'Say it, trace it, then write it from memory.', 'お手本'),
      step(2, 'Hear it or say it, then write it. Every sheet replays at once.', '書き取り'),
      step(3, 'Write one big sheet for the gallery and give out stamps.', '展覧会'),
    ),
    h('p', { class: 'sho-motto', lang: 'ja' }, 'とめ・はね・はらい'),
  );
}

/** One character as brushwork on its own square, optionally replayed. */
function glyph(strokes: readonly (readonly InkPoint[])[], opts: { cls?: string; strokeMs?: number; elapsedMs?: number; width?: number } = {}): SVGSVGElement {
  return inkSvg(strokes, { brush: true, width: opts.width ?? 7, class: opts.cls ?? 'sho-ink', strokeMs: opts.strokeMs ?? 1, elapsedMs: opts.elapsedMs ?? 1e9 });
}

function scroll(view: RoomView, game: ShodoView): HTMLElement {
  const reading = view.phase === 'score';
  const cols = game.scroll ?? [];
  return h(
    'div',
    { class: 'card sho' },
    h('p', { class: 'sho-tag' }, reading ? 'Read the scroll aloud, all together' : `お手本 · ${game.finished} / ${game.writers} finished`),
    h('p', { class: 'prompt', lang: 'ja' }, reading ? 'せーの!' : 'なぞって、かいて'),
    h(
      'div',
      { class: 'sho-scroll' },
      cols.map((c) =>
        h(
          'div',
          { class: `sho-col${c.done ? ' done' : ''}` },
          c.chars.length
            ? c.chars.map((ch) =>
                h(
                  'div',
                  { class: 'sho-char' },
                  glyph(ch.strokes),
                  reading ? h('span', { class: 'sho-read', lang: 'ja' }, ch.say.kana, game.kanaAtTable ? h('small', {}, toRomaji(ch.say.kana)) : null) : null,
                ),
              )
            : h('div', { class: 'sho-char empty' }, h('span', { class: 'sho-wet' }, '…')),
        ),
      ),
    ),
    reading ? null : h('p', { class: 'hint' }, 'Say each one first, trace it, trace it faintly, then write it from memory.'),
  );
}

/** The gallery brief: "ねむい ＿" · "Something sleepy". */
function briefLine(game: ShodoView): HTMLElement {
  const b = game.brief;
  if (!b) return h('span', {}, 'Your best sheet, as beautifully as you can');
  return h('span', {}, h('span', { class: 'sho-brief', lang: 'ja' }, `おだい: ${b.kana} ＿`), ` · Something ${b.en}`);
}

function writing(game: ShodoView, line: string | HTMLElement, note: string | null = null): HTMLElement {
  const label = game.item ? `書き取り · ${game.item} / ${game.items}` : '展覧会';
  return h(
    'div',
    { class: 'card sho' },
    h('p', { class: 'sho-tag' }, label),
    h('p', { class: 'prompt' }, line),
    note ? h('p', { class: 'sho-other-hand' }, note) : null,
    h('div', { class: 'sho-inkstone', 'aria-hidden': 'true' }, Array.from({ length: game.writers }, (_, i) => h('span', { class: i < game.finished ? 'in' : '' }))),
    h('p', { class: 'hint' }, `${game.finished} / ${game.writers} sheets in`),
  );
}

/** A small, steady tilt per sheet, like paper pinned by hand. */
const tilt = (n: number) => `--tilt:${(((n * 37) % 7) - 3) * 0.6}deg`;

/** Each cell of a sheet, timed as one run of strokes across the cells. */
function sheetCells(sheet: SheetView, slotMs: number, elapsedMs: number, width?: number): HTMLElement[] {
  let before = 0;
  return sheet.cells.map((c) => {
    const svg = glyph(c, { strokeMs: slotMs, elapsedMs: elapsedMs - before * slotMs, ...(width ? { width } : {}) });
    before += c.length;
    return h('div', { class: 'sho-cell' }, svg);
  });
}

const done = (s: SheetView) => s.cells.reduce((n, c) => n + c.length, 0);

function replay(view: RoomView, game: ShodoView): HTMLElement {
  const sheets = game.sheets ?? [];
  const elapsed = sincePhase(view);
  const misread = sheets.find((s) => s.misread);
  return h(
    'div',
    { class: 'card sho' },
    h('p', { class: 'sho-tag' }, `書き取り · ${game.item} / ${game.items} · synchro replay`),
    h(
      'div',
      { class: `sho-wall n${Math.min(8, sheets.length)}` },
      sheets.map((s) =>
        h(
          'div',
          { class: `sho-paper${s.clean ? ' clean' : ''}`, style: tilt(s.n) },
          h('div', { class: 'sho-cells' }, sheetCells(s, game.slotMs, elapsed)),
          s.outOfOrder !== null ? h('span', { class: 'sho-order', lang: 'ja', style: `animation-delay:${Math.max(0, s.outOfOrder * game.slotMs - elapsed)}ms` }, '順 ×') : null,
          h('p', { class: 'sho-caption', lang: 'ja' }, s.text, s.clean ? h('span', { class: 'sho-clean' }, ` ◎ ${s.name ?? ''}`) : null),
          // Fude's misreading, under the sheet it's about, once that sheet has finished.
          s === misread ? h('p', { class: 'sho-misread', lang: 'ja', style: `animation-delay:${Math.max(0, done(s) * game.slotMs - elapsed)}ms` }, `…${s.misread}かな?`) : null,
        ),
      ),
    ),
  );
}

/** Fude's はなまる, a red swirl round the sheet's best stroke, once `delayMs` has passed. */
function hanamaru(sheet: SheetView, delayMs = 0): HTMLElement | null {
  const [c, i] = sheet.best;
  const s = sheet.cells[c]?.[i];
  if (!s?.length) return null;
  const mid = s[Math.floor(s.length / 2)]!;
  const left = ((c + mid[0]) / sheet.cells.length) * 100;
  return h('span', { class: 'sho-hanamaru', style: `left:${left}%;top:${mid[1] * 100}%${delayMs > 0 ? `;animation-delay:${600 + delayMs}ms` : ''}`, 'aria-hidden': 'true' });
}

function gallery(view: RoomView, game: ShodoView): HTMLElement {
  const sheets = game.sheets ?? [];
  const voting = view.phase === 'finale';
  // The vote opens with every sheet brushing on together; the send-off shows them finished.
  const elapsed = voting ? sincePhase(view) : 1e9;
  const most = Math.max(0, ...sheets.map(done));
  const winners = game.winners ?? [];
  return h(
    'div',
    { class: 'card sho' },
    h('p', { class: 'sho-tag' }, voting ? '展覧会 · give your hanko stamps on your phone' : '展覧会 · the send-off'),
    h('p', { class: 'prompt', lang: 'ja' }, voting ? 'どれが すき?' : 'みんなで よみましょう'),
    game.brief && voting ? h('p', { class: 'sho-note-line' }, h('span', { lang: 'ja' }, `おだい: ${game.brief.kana} ＿`), ` · something ${game.brief.en}`) : null,
    winners.length
      ? h(
          'ul',
          { class: 'sho-winners' },
          winners.map((w, i) => {
            const a = AWARDS.find((x) => x.id === w.award)!;
            return h('li', { style: `animation-delay:${i * 700}ms` }, h('span', { class: 'sho-hanko', lang: 'ja' }, a.ja), ` #${w.n} `, w.name ? h('strong', {}, w.name) : h('span', { class: 'sho-anon' }, '?'));
          }),
        )
      : null,
    winners.some((w) => !w.name) ? h('p', { class: 'sho-note-line', lang: 'ja' }, 'かいた ひとは… しって いますね。') : null,
    h(
      'div',
      { class: `sho-wall gallery n${Math.min(8, sheets.length)}` },
      sheets.map((s) =>
        h(
          'div',
          { class: 'sho-paper sho-large', style: tilt(s.n) },
          h('span', { class: 'sho-n' }, `#${s.n}`),
          h('div', { class: 'sho-cells' }, voting ? sheetCells(s, game.slotMs, elapsed, 8) : s.cells.map((c) => h('div', { class: 'sho-cell' }, glyph(c, { width: 8 }))), hanamaru(s, voting ? Math.max(0, most * game.slotMs - elapsed) : 0)),
          h(
            'div',
            { class: 'sho-stamps' },
            AWARDS.filter((a) => s.stamps[a.id]).map((a) => h('span', { class: 'sho-hanko', lang: 'ja', title: a.en }, a.ja, s.stamps[a.id]! > 1 ? ` ×${s.stamps[a.id]}` : '')),
          ),
          voting ? null : h('p', { class: 'sho-caption', lang: 'ja' }, s.say.kana, game.kanaAtTable ? h('small', {}, ` ${toRomaji(s.say.kana)}`) : null),
          s.name && s.name !== 'you' ? h('p', { class: 'sho-claimed' }, h('span', { class: 'sho-seal', lang: 'ja' }, '印'), ` ${s.name}`) : null,
        ),
      ),
    ),
  );
}
