// Shodō Taikai on the phone. Saying and writing are separate screens (the UX panel): say the
// word first, then write it.
//
//   お手本    say each target once, then trace it (live stroke checks), trace it faintly, and
//            write it from memory; "I know this one" skips the tracing.
//   書き取り  say-it-then-write-it (the meaning shown, say the word, then write it) and dictation
//            (🔊 on this phone, then write it), then this phone's result with the model.
//   展覧会    one big sheet with a faint guide, a sentence about it, then hanko stamps for other
//            sheets and an optional "that one's mine".

import { h } from '../../../shared/src/dom.js';
import { inkSvg } from '../../../shared/src/inkSvg.js';
import { AWARDS, STAMPS, type AwardId, type ShodoView, type TargetView } from '../../../shared/src/modes/shodo/shodo.js';
import { toRomaji } from '../../../shared/src/japanese/romaji.js';
import type { Utterance } from '../../../shared/src/japanese/kana.js';
import { brushPad, setSteadyHand, steadyHand } from '../components/brushPad.js';
import { jpView } from '../components/jp.js';
import { speakBox } from '../components/speak.js';
import { waiting } from '../components/ui.js';
import { canVoice, hearButton, say } from '../components/voice.js';
import type { PhoneContext, PhoneMode } from './types.js';

type Ctx = PhoneContext<ShodoView>;

export const shodoPhone: PhoneMode<ShodoView> = {
  key(view, game) {
    const m = game.me;
    const p = m?.practice;
    const it = m?.item;
    const g = m?.gallery;
    return [
      view.phaseSeq,
      p ? [p.at, p.of, p.rep, p.sayFirst, p.target?.text, p.results.length].join(',') : '',
      it ? [it.handedIn, it.said, it.shown, it.tries, it.result?.points ?? -1].join(',') : '',
      g ? [g.handedIn, g.said, g.sheet, g.claimed].join(',') : '',
      Object.entries(m?.stamps ?? {}).join(','),
      (game.sheets ?? []).map((s) => s.name ?? '').join(','),
    ].join('|');
  },

  render(ctx) {
    switch (ctx.view.phase) {
      case 'intro':
        return waiting('書道大会 · Shodō Taikai', 'Fude’s calligraphy contest. Say it, trace it, then write it from memory. Watch the screen!');
      case 'prompt':
        return practiceScreen(ctx);
      case 'score':
        return readScreen(ctx);
      case 'answer':
        return itemScreen(ctx);
      case 'reveal':
        return resultScreen(ctx);
      case 'encore':
        return galleryScreen(ctx);
      case 'finale':
        return stampScreen(ctx);
      case 'penalty':
        return claimScreen(ctx);
      default:
        return waiting('Watch the screen!');
    }
  },
};

const isKana = (ctx: Ctx) => ctx.me.level === 'kana';

function tag(text: string): HTMLElement {
  return h('p', { class: 'sho-tag' }, text);
}

/** What the target says, for this player's level (the written form only once it's allowed). */
function sayCard(t: TargetView, ctx: Ctx, note?: string): HTMLElement {
  return h('div', { class: 'sho-word' }, note ? h('p', { class: 'sho-note' }, note) : null, jpView({ text: t.say.text || t.say.kana, kana: t.say.kana, en: t.say.en }, ctx.me.level));
}

/** Saying it, with a quiet way past (typing works; skipping costs only the bonus). */
function sayBox(ctx: Ctx, label: string, skip: string | null): HTMLElement {
  return h(
    'div',
    { class: 'sho-say' },
    speakBox({
      label,
      placeholder: 'かなで…',
      kanaPadOpen: isKana(ctx),
      maxLength: 24,
      onSend: (u: Utterance) => {
        void ctx.send({ kind: 'say', utterance: u }).then((ok) => {
          if (!ok) ctx.flash('Not quite. Listen and try again!');
        });
      },
    }),
    skip ? h('button', { type: 'button', class: 'linkish sho-skip', onclick: () => void ctx.send({ kind: 'say-skip' }) }, skip) : null,
  );
}

function steadyToggle(): HTMLElement {
  const box = h('input', { type: 'checkbox', class: 'sho-steady-box' }) as HTMLInputElement;
  box.checked = steadyHand();
  box.addEventListener('change', () => setSteadyHand(box.checked));
  return h('label', { class: 'sho-steady' }, box, ' Steady hand (a looser check)');
}

// ---- お手本 ----

const REP_NAMES = { trace: 'Trace it', faint: 'Trace it faintly', memory: 'Write it from memory' } as const;

function practiceScreen(ctx: Ctx): HTMLElement {
  const { view, game, send } = ctx;
  const p = game.me?.practice;
  if (!p) return waiting('Everyone is practising…', 'Watch the scroll on the screen!');
  if (!p.rep || !p.target) {
    return h('div', { class: 'screen sho' }, tag('お手本 · done'), h('p', { class: 'big' }, 'All done! 🖌'), resultsRow(p.results), h('p', { class: 'hint' }, `${game.finished} / ${game.writers} finished. Your characters are on the scroll.`));
  }
  const t = p.target;
  const head = tag(`お手本 · ${p.at} / ${p.of} · ${REP_NAMES[p.rep]}`);
  if (p.sayFirst) {
    return h(
      'div',
      { class: 'screen sho' },
      head,
      h('p', { class: 'sho-glyph', lang: 'ja' }, t.text),
      sayCard(t, ctx, 'Say it first!'),
      t.kind !== 'kana' || canVoice() ? hearButton(t.say.kana, '🔊 Hear it', 'sho-hear') : null,
      sayBox(ctx, 'Hold and say it', 'Skip saying it'),
    );
  }
  const key = `sho-${view.phaseSeq}-${p.at}`;
  if (p.rep === 'memory') {
    return h(
      'div',
      { class: 'screen sho' },
      head,
      h('div', { class: 'sho-word' }, h('p', { class: 'sho-note' }, 'From memory: no model this time.'), memoryClue(t, ctx)),
      brushPad({ key, mode: 'free', cells: 1, sendLabel: 'Done 🖌', label: 'Writing pad: write it from memory', onSend: (cells) => send({ kind: 'rep', strokes: cells[0] ?? [] }) }),
    );
  }
  return h(
    'div',
    { class: 'screen sho' },
    head,
    h('p', { class: 'sho-note' }, p.rep === 'trace' ? 'Follow the model, starting at the red dot.' : 'Fainter now. Same strokes, same order.'),
    brushPad({ key, mode: p.rep, cells: 1, model: t.cells, label: `Writing pad: trace ${t.text}`, onSend: (cells, corrections) => send({ kind: 'rep', strokes: cells[0] ?? [], corrections }) }),
    steadyToggle(),
    h('button', { type: 'button', class: 'linkish sho-skip', onclick: () => void send({ kind: 'skip-trace' }) }, 'I know this one: skip the tracing'),
  );
}

/** The clue for writing from memory: the reading and meaning (a kana's romaji), never the glyph. */
function memoryClue(t: TargetView, ctx: Ctx): HTMLElement {
  if (t.kind === 'kana') return h('div', { class: 'sho-clue' }, h('p', { class: 'sho-romaji' }, t.romaji ?? t.meaning), t.mask ? h('p', { class: 'hint' }, 'Its twin: ', h('span', { lang: 'ja', class: 'sho-mask' }, t.mask)) : null);
  return h('div', { class: 'sho-clue' }, jpView({ text: t.say.kana, kana: t.say.kana, en: t.meaning }, ctx.me.level));
}

function resultsRow(results: NonNullable<NonNullable<ShodoView['me']>['practice']>['results']): HTMLElement {
  const memory = results.filter((r) => r.kind === 'memory');
  return h(
    'div',
    { class: 'sho-results' },
    memory.map((r) => h('span', { class: `sho-chip ${r.clean ? 'clean' : r.ok ? 'ok' : 'miss'}`, lang: 'ja' }, r.text, ' ', r.clean ? '◎' : r.ok ? '○' : '△')),
  );
}

function readScreen(ctx: Ctx): HTMLElement {
  const p = ctx.game.me?.practice;
  return h('div', { class: 'screen sho' }, tag('Read the scroll'), h('p', { class: 'big' }, 'せーの!'), h('p', { class: 'hint' }, 'Read the scroll on the screen aloud, all together.'), p ? resultsRow(p.results) : null);
}

// ---- 書き取り ----

function itemScreen(ctx: Ctx): HTMLElement {
  const { view, game, send } = ctx;
  const it = game.me?.item;
  if (!it) return waiting('Everyone is writing…', 'Watch the screen!');
  const head = tag(`書き取り · ${game.item} / ${game.items} · ${game.itemKind === 'dictation' ? 'Hear it, write it' : 'Say it, then write it'}`);
  if (it.handedIn) return h('div', { class: 'screen sho' }, head, waiting('Handed in! 🖌', `${game.finished} / ${game.writers} in. Watch the replay on the screen.`));
  const t = it.target;
  if (game.itemKind === 'recall' && !it.shown) {
    return h(
      'div',
      { class: 'screen sho' },
      head,
      h('div', { class: 'sho-word' }, h('p', { class: 'sho-note' }, 'Say this in Japanese, from memory:'), h('p', { class: 'sho-meaning' }, t.kind === 'kana' ? (t.romaji ?? t.meaning) : t.meaning)),
      it.tries ? h('p', { class: 'hint' }, `Not yet (${it.tries} ${it.tries === 1 ? 'try' : 'tries'}). Try again, or show the reading.`) : null,
      sayBox(ctx, 'Hold and say it', 'Show me the reading'),
    );
  }
  const dictation = game.itemKind === 'dictation';
  if (dictation) setTimeout(() => say(t.say.kana), 300);
  return h(
    'div',
    { class: 'screen sho' },
    head,
    h(
      'div',
      { class: 'sho-word' },
      dictation ? hearButton(t.say.kana, '🔊 Hear it again', 'sho-hear big') : null,
      // Without a voice, the reading is written out (a kana's as romaji, so it isn't the answer).
      dictation && !canVoice() ? h('p', { class: 'sho-reading' }, t.kind === 'kana' ? (t.romaji ?? toRomaji(t.say.kana)) : t.say.kana) : null,
      !dictation && t.kind !== 'kana' ? h('p', { class: 'sho-reading', lang: 'ja' }, t.say.kana) : null,
      !dictation && t.kind === 'kana' ? h('p', { class: 'sho-romaji' }, t.romaji ?? t.meaning) : null,
      t.kind === 'kana' && t.mask ? h('p', { class: 'hint' }, 'Its twin: ', h('span', { lang: 'ja', class: 'sho-mask' }, t.mask)) : null,
      t.kind !== 'kana' ? h('p', { class: 'sho-meaning' }, t.meaning) : null,
      it.said ? h('p', { class: 'sho-said' }, it.said === 'speech' ? 'Said from memory! ✨' : 'Typed it ✓') : null,
    ),
    brushPad({ key: `sho-item-${view.phaseSeq}`, mode: 'free', cells: t.count, label: 'Writing pad: write it', onSend: (cells) => send({ kind: 'sheet', cells }) }),
  );
}

function resultScreen(ctx: Ctx): HTMLElement {
  const it = ctx.game.me?.item;
  if (!it?.result) return waiting('Synchro replay!', 'Watch every sheet brush on together.');
  const t = it.target;
  const r = it.result;
  return h(
    'div',
    { class: 'screen sho' },
    tag('Synchro replay'),
    h('p', { class: `sho-verdict ${r.clean ? 'clean' : r.pass ? 'ok' : 'miss'}` }, r.clean ? '◎ Clean!' : r.pass ? '○ It reads!' : '△ Not yet'),
    t.cells ? h('div', { class: 'sho-models' }, t.cells.map((c) => h('div', { class: 'sho-model' }, inkSvg(c, { grid: true, numbers: true, totalMs: 2400, class: 'sho-model-svg' })))) : null,
    sayCard(t, ctx),
    h('p', { class: 'hint' }, r.tip),
    r.points ? h('p', { class: 'sho-points' }, `+${r.points}`) : null,
  );
}

// ---- 展覧会 ----

function galleryScreen(ctx: Ctx): HTMLElement {
  const { view, send } = ctx;
  const g = ctx.game.me?.gallery;
  if (!g) return waiting('Everyone is writing their big sheet…', 'Watch the screen!');
  const t = g.target;
  if (!g.handedIn) {
    return h(
      'div',
      { class: 'screen sho' },
      tag('展覧会 · Your big sheet'),
      h('p', { class: 'sho-note' }, 'Theme: something I love. Take your time: this one goes in the gallery.'),
      h('p', { class: 'sho-glyph', lang: 'ja' }, t.text),
      h('p', { class: 'sho-meaning' }, t.meaning),
      brushPad({ key: `sho-gal-${view.phaseSeq}`, mode: 'free', cells: t.count, model: t.cells, sendLabel: 'Hang it in the gallery 🖼', label: `Writing pad: write ${t.text}`, onSend: (cells) => send({ kind: 'sheet', cells }) }),
    );
  }
  if (g.said === undefined) {
    return h('div', { class: 'screen sho' }, tag('展覧会 · Say it'), sayCard(t, ctx, 'Now say why it’s up there:'), sayBox(ctx, 'Hold and say it', 'Skip'));
  }
  return h('div', { class: 'screen sho' }, tag('展覧会'), waiting('Your sheet is hanging! 🖼', `${ctx.game.finished} / ${ctx.game.writers} in. Nobody knows which one is yours.`));
}

// Which award the player is placing, kept across redraws in this phase.
let picking: { seq: number; award: AwardId } = { seq: -1, award: AWARDS[0].id };

function stampScreen(ctx: Ctx): HTMLElement {
  const { game, view, send } = ctx;
  const sheets = game.sheets ?? [];
  if (!game.voting || !sheets.length) return waiting('The gallery!', 'Look at every sheet on the screen.');
  if (picking.seq !== view.phaseSeq) picking = { seq: view.phaseSeq, award: AWARDS[0].id };
  const mine = game.me?.stamps ?? {};
  const awardButtons = AWARDS.map((a) =>
    h(
      'button',
      { type: 'button', class: `sho-award${picking.award === a.id ? ' on' : ''}`, 'aria-pressed': String(picking.award === a.id), onclick: () => {
          picking.award = a.id;
          redraw();
        },
      },
      h('span', { class: 'sho-hanko', lang: 'ja' }, a.ja),
      h('small', {}, a.en),
      mine[a.id] !== undefined ? h('small', { class: 'sho-placed' }, `on #${mine[a.id]! + 1}`) : null,
    ),
  );
  const grid = h(
    'div',
    { class: 'sho-sheets' },
    sheets.map((s, i) => {
      const own = s.name === 'you';
      const here = AWARDS.filter((a) => mine[a.id] === i);
      return h(
        'button',
        { type: 'button', class: `sho-sheet${own ? ' own' : ''}`, disabled: own, 'aria-label': own ? `Sheet ${s.n}: yours` : `Sheet ${s.n}`, onclick: () => void send({ kind: 'stamp', award: picking.award, sheet: i }) },
        h('span', { class: 'sho-n' }, own ? 'yours' : `#${s.n}`),
        h('div', { class: 'sho-thumb' }, s.cells.map((c) => inkSvg(c, { brush: true, width: 6, class: 'sho-thumb-svg', elapsedMs: 1e9 }))),
        here.length ? h('span', { class: 'sho-stamped', lang: 'ja' }, here.map((a) => a.ja.slice(0, 2)).join(' ')) : null,
      );
    }),
  );
  const placed = Object.keys(mine).length;
  const screen = h('div', { class: 'screen sho' }, tag('Hanko stamps'), h('p', { class: 'sho-note' }, `Pick a stamp, then tap a sheet. ${placed} / ${STAMPS} placed; tap again to move one.`), h('div', { class: 'sho-awards' }, awardButtons), grid);
  function redraw() {
    screen.replaceWith(stampScreen(ctx));
  }
  return screen;
}

function claimScreen(ctx: Ctx): HTMLElement {
  const g = ctx.game.me?.gallery;
  const sheet = g?.sheet;
  if (!g || !sheet) return waiting('The send-off!', 'Read every sheet aloud together.');
  if (g.claimed) return h('div', { class: 'screen sho' }, tag('Claim it'), waiting(`Sheet #${sheet} is yours, and now everyone knows! 🎉`, 'Read them all aloud together.'));
  return h(
    'div',
    { class: 'screen sho' },
    tag('Claim it'),
    h('p', { class: 'big' }, `Sheet #${sheet} is yours.`),
    h('p', { class: 'hint' }, 'Want your name on it? Only if you like.'),
    h('button', { type: 'button', class: 'primary', onclick: () => void ctx.send({ kind: 'claim' }) }, 'That one’s mine! 🙋'),
  );
}
