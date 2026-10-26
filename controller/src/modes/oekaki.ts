// Oekaki on the phone: draw your secret word, write fake titles (say them, type them, or build
// them from word tiles), pick the real title, then say it with the room. The VIP can hide a
// drawing or a title.

import { h } from '../../../shared/src/dom.js';
import type { OekakiView } from '../../../shared/src/modes/views.js';
import { OEKAKI_LIMITS, PALETTE } from '../../../shared/src/modes/oekaki/drawing.js';
import { MAX_FAKE_LENGTH, MAX_FAKE_TILES } from '../../../shared/src/modes/oekaki/fakes.js';
import { toRomaji } from '../../../shared/src/modes/oogiri/romaji.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import { inkPad } from '../components/inkPad.js';
import { speakBox } from '../components/speak.js';
import { waiting } from '../components/ui.js';
import type { PhoneContext, PhoneMode } from './types.js';

type Ctx = PhoneContext<OekakiView>;

export const oekakiPhone: PhoneMode<OekakiView> = {
  key(view, game, playerId) {
    const m = game.mine;
    const vip = view.players.find((p) => p.id === playerId)?.isVip ?? false;
    return [
      view.phaseSeq,
      vip,
      m ? [m.drawn, m.isArtist, m.fake, m.pick, m.said, m.tiles?.length ?? -1, m.prompt?.text ?? ''].join(',') : '',
      game.hiddenDrawing,
      (game.options ?? []).map((o) => `${o.id}${o.hidden ? 'h' : ''}`).join(','),
      game.result ? (game.result.options.map((o) => `${o.id}${o.hidden ? 'h' : ''}`).join(',') + (game.result.points[playerId] ?? 0)) : '',
    ].join('|');
  },

  render(ctx) {
    const { view } = ctx;
    if (view.phase === 'intro') {
      return waiting('お絵かき · Oekaki', 'Draw your secret word, write fake titles for the other drawings, find the real one, then say it together. Watch the screen!');
    }
    if (view.phase === 'prompt') return drawScreen(ctx);
    if (view.phase === 'answer') return fakeScreen(ctx);
    if (view.phase === 'reveal') return voteScreen(ctx);
    return scoreScreen(ctx);
  },
};

const isKanaLevel = (ctx: Ctx) => ctx.me.level === 'kana';
const nameOf = (view: RoomView, id: string | null | undefined) => view.players.find((p) => p.id === id)?.name ?? '…';

function tag(ctx: Ctx, text: string): HTMLElement {
  const g = ctx.game;
  return h('p', { class: 'oek-tag' }, `Round ${g.round}/${g.totalRounds}${g.index ? ` · drawing ${g.index}/${g.count}` : ''} · ${text}`);
}

function titleCard(t: { text: string; kana: string; en: string; romaji: string | null }, kanaFirst: boolean, note?: string): HTMLElement {
  const sameKana = t.kana.replace(/\s/g, '') === t.text.replace(/\s/g, '');
  return h(
    'div',
    { class: 'oek-word' },
    note ? h('p', { class: 'oek-note' }, note) : null,
    h('p', { class: 'oek-big', lang: 'ja' }, kanaFirst ? t.kana : t.text),
    !kanaFirst && !sameKana ? h('p', { class: 'oek-kana', lang: 'ja' }, t.kana) : null,
    t.romaji ? h('p', { class: 'oek-romaji' }, t.romaji) : null,
    h('p', { class: 'oek-en' }, t.en),
  );
}

function hideDrawingButton(ctx: Ctx): HTMLElement | null {
  if (!ctx.isVip || ctx.game.hiddenDrawing) return null;
  return h('button', { type: 'button', class: 'linkish oek-hide', onclick: () => void ctx.send({ kind: 'hide', drawing: true }) }, 'VIP: hide this drawing');
}

// ---- draw ----

function drawScreen(ctx: Ctx): HTMLElement {
  const { game, send, view } = ctx;
  const m = game.mine;
  if (!m?.prompt) return waiting('Everyone is drawing…', 'Watch the screen!');
  if (m.drawn) return h('div', { class: 'screen oek' }, tag(ctx, 'draw'), waiting('Drawing sent! 🖼', `${game.drawn.length} / ${view.players.length} in. Remember your word, and don’t tell anyone!`));
  return h(
    'div',
    { class: 'screen oek' },
    tag(ctx, 'draw'),
    titleCard(m.prompt, isKanaLevel(ctx), 'Your secret word. Draw it! (no letters)'),
    inkPad({
      key: `oekaki-${view.phaseSeq}`,
      sendLabel: 'Send my drawing 🖼',
      limits: OEKAKI_LIMITS,
      palette: PALETTE,
      lineWidth: 0.02,
      label: 'Drawing pad: draw your secret word',
      onSend: (strokes, colors) => send({ kind: 'draw', strokes, colors }),
    }),
  );
}

// ---- fake titles ----

// Picked tiles survive a redraw within the same phase.
let tray: { seq: number; picks: number[] } = { seq: -1, picks: [] };

function fakeScreen(ctx: Ctx): HTMLElement {
  const { game, send, flash, view } = ctx;
  const m = game.mine;
  if (game.hiddenDrawing) return waiting('Fude painted over this drawing.', 'On to the next one…');
  if (!m) return waiting('Watch the screen!');
  if (m.isArtist) {
    return h(
      'div',
      { class: 'screen oek' },
      tag(ctx, 'your drawing'),
      m.prompt ? titleCard(m.prompt, isKanaLevel(ctx), 'This one is yours! Keep a straight face.') : null,
      h('p', { class: 'hint' }, 'The others are writing fake titles. You get points for everyone who finds the real one.'),
      hideDrawingButton(ctx),
    );
  }
  if (m.fake) return h('div', { class: 'screen oek' }, tag(ctx, 'fake titles'), waiting('Fake sent!', `“${m.fake}”. Waiting for the others…`), hideDrawingButton(ctx));

  const kana = isKanaLevel(ctx);
  const sendFake = (move: unknown) =>
    void send(move).then((ok) => {
      if (ok) tray = { seq: -1, picks: [] };
    });
  return h(
    'div',
    { class: 'screen oek' },
    tag(ctx, 'fake titles'),
    h('p', { class: 'prompt' }, 'Look at the TV. What could it be?'),
    h('p', { class: 'hint' }, 'Write a fake title in Japanese that sounds real. Say it, type it, or build it from tiles.'),
    speakBox({
      label: 'Hold and say a fake title',
      placeholder: 'にほんごで…',
      kanaPadOpen: false,
      maxLength: MAX_FAKE_LENGTH,
      onSend: (u) => {
        if (!/[ぁ-ゖァ-ヺー㐀-鿿]/.test(u.text)) return flash('Fake titles are in Japanese (kana is fine). Try the tiles!');
        sendFake({ kind: 'fake', utterance: u });
      },
    }),
    m.tiles ? tilePanel(ctx, m.tiles, kana, sendFake, view.phaseSeq) : null,
    hideDrawingButton(ctx),
  );
}

function tilePanel(ctx: Ctx, tiles: NonNullable<NonNullable<OekakiView['mine']>['tiles']>, kana: boolean, sendFake: (move: unknown) => void, seq: number): HTMLElement {
  if (tray.seq !== seq) tray = { seq, picks: [] };
  const line = h('p', { class: 'oek-tray', lang: 'ja' });
  const sendBtn = h('button', { type: 'button', class: 'primary' }, 'Send these tiles') as HTMLButtonElement;
  const buttons: HTMLButtonElement[] = [];
  const label = (i: number) => (kana ? tiles[i]!.kana : tiles[i]!.text);
  const refresh = () => {
    line.textContent = tray.picks.length ? tray.picks.map(label).join(' ').replace(/ の/g, 'の') : 'Tap tiles to build a title';
    sendBtn.disabled = !tray.picks.some((i) => !tiles[i]!.particle);
    buttons.forEach((b, i) => b.classList.toggle('on', tray.picks.includes(i)));
  };
  tiles.forEach((t, i) => {
    const b = h(
      'button',
      { type: 'button', class: `tile oek-tile ${t.particle ? 'particle' : ''}` },
      h('span', { lang: 'ja' }, kana ? t.kana : t.text),
      t.romaji ? h('small', { class: 'oek-romaji' }, t.romaji) : null,
      h('small', {}, t.en),
    ) as HTMLButtonElement;
    b.addEventListener('click', () => {
      const at = tray.picks.indexOf(i);
      if (at >= 0) tray.picks.splice(at, 1);
      else if (tray.picks.length < MAX_FAKE_TILES) tray.picks.push(i);
      refresh();
    });
    buttons.push(b);
  });
  sendBtn.addEventListener('click', () => sendFake({ kind: 'fake', tiles: [...tray.picks] }));
  const clear = h('button', { type: 'button', class: 'secondary' }, 'Clear');
  clear.addEventListener('click', () => {
    tray.picks = [];
    refresh();
  });
  refresh();
  const body = h('div', { class: 'oek-tiles-body' }, line, h('div', { class: 'oek-tiles' }, buttons), h('div', { class: 'oek-tile-actions' }, clear, sendBtn));
  // Open by default at Kana level; one tap away for everyone else.
  const details = h('details', { class: 'oek-tile-box' }, h('summary', {}, `Word tiles (up to ${MAX_FAKE_TILES})`), body);
  if (kana || tray.picks.length) details.setAttribute('open', '');
  return details;
}

// ---- vote ----

function optionLabel(o: { text: string; kana: string }, kana: boolean): (HTMLElement | null)[] {
  const sameKana = o.kana.replace(/\s/g, '') === o.text.replace(/\s/g, '');
  return [
    h('span', { class: 'oek-opt', lang: 'ja' }, kana && o.kana ? o.kana : o.text),
    !kana && !sameKana && o.kana ? h('small', { lang: 'ja' }, o.kana) : null,
    kana && o.kana ? h('small', { class: 'oek-romaji' }, toRomaji(o.kana)) : null,
  ];
}

function voteScreen(ctx: Ctx): HTMLElement {
  const { game, send, isVip } = ctx;
  const m = game.mine;
  if (game.hiddenDrawing) return waiting('Fude painted over this drawing.');
  if (!m) return waiting('Watch the screen!');
  const kana = isKanaLevel(ctx);
  const options = game.options ?? [];
  const hide = (id: string) => void send({ kind: 'hide', optionId: id });
  const vipList = () =>
    isVip
      ? h(
          'div',
          { class: 'oek-vip' },
          h('p', { class: 'hint' }, 'VIP: hide a title that shouldn’t be on the TV.'),
          options.filter((o) => !o.hidden).map((o) => h('button', { type: 'button', class: 'secondary oek-hide-opt', onclick: () => hide(o.id) }, `Hide “${o.text}”`)),
          hideDrawingButton(ctx),
        )
      : null;
  if (m.isArtist) return h('div', { class: 'screen oek' }, tag(ctx, 'your drawing'), waiting('Your drawing is up!', 'Everyone is hunting for your real title.'), vipList());
  if (m.pick) return h('div', { class: 'screen oek' }, tag(ctx, 'vote'), waiting('Locked in!', 'Waiting for the others…'), vipList());
  return h(
    'div',
    { class: 'screen oek' },
    tag(ctx, 'vote'),
    h('p', { class: 'prompt' }, 'Which title is real?'),
    options.map((o) =>
      o.id === m.optionId
        ? h('button', { class: 'option oek-option oek-own', disabled: true }, ...optionLabel(o, kana), h('small', {}, '(yours)'))
        : h('button', { class: `option oek-option ${o.hidden ? 'oek-hidden' : ''}`, disabled: o.hidden, onclick: () => void send({ kind: 'pick', optionId: o.id }) }, ...optionLabel(o, kana)),
    ),
    vipList(),
  );
}

// ---- score ----

function scoreScreen(ctx: Ctx): HTMLElement {
  const { game, send, flash, view, isVip } = ctx;
  const r = game.result;
  const m = game.mine;
  if (!r || !m) return waiting('Watch the screen!');
  const me = ctx.me.id;
  const kana = isKanaLevel(ctx);
  const points = r.points[me] ?? 0;
  const real = r.options.find((o) => o.real);
  const mine = r.options.find((o) => o.authors.some((a) => a.id === me));
  const fooled = mine ? mine.pickedBy.filter((p) => p.id !== me).length : 0;
  const finders = real ? real.pickedBy.length : 0;
  const lines = game.hiddenDrawing
    ? ['The VIP hid this drawing: no points, but say the title anyway!']
    : m.isArtist
    ? [`${finders} player${finders === 1 ? '' : 's'} read your drawing.`]
    : [real?.pickedBy.some((p) => p.id === me) ? 'You found the real title!' : 'Fooled this time.', fooled ? `Your fake fooled ${fooled}.` : ''];
  return h(
    'div',
    { class: 'screen oek' },
    tag(ctx, 'say it together'),
    titleCard(r.real, kana, `The real title (drawn by ${nameOf(view, r.artistId)})`),
    h('p', { class: 'big oek-points' }, `+${points}`),
    h('p', { class: 'hint' }, lines.filter(Boolean).join(' ')),
    m.said
      ? h('p', { class: 'oek-good' }, m.said === 'speech' ? 'You said it! It’s in your sketchbook.' : 'Typed it! Say it out loud next time for a bigger bonus.')
      : h(
          'div',
          { class: 'oek-say' },
          h('p', { class: 'prompt' }, `Say it with the room: ${r.real.kana}`),
          speakBox({
            label: `Hold and say ${r.real.kana}`,
            placeholder: r.real.kana,
            kanaPadOpen: kana,
            maxLength: MAX_FAKE_LENGTH,
            onSend: (u) =>
              void send({ kind: 'say', utterance: u }).then((ok) => {
                if (!ok) flash(`Not quite: it’s ${r.real.kana}${r.real.romaji ? ` (${r.real.romaji})` : ''}. Try again!`);
              }),
          }),
        ),
    isVip
      ? h(
          'details',
          { class: 'oek-vip' },
          h('summary', {}, 'VIP: hide a title'),
          r.options.filter((o) => !o.hidden && !o.real).map((o) => h('button', { type: 'button', class: 'secondary oek-hide-opt', onclick: () => void send({ kind: 'hide', optionId: o.id }) }, `Hide “${o.text}”`)),
          hideDrawingButton(ctx),
        )
      : null,
  );
}
