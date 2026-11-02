// Kotoba Concentration on the phone: a mini board to flip cards on your turn, the say-it
// box when you match (or when you can steal), and the hidden-picture buzzer.
// In the Green Car (Frame Concentration) you say a whole sentence: the gist card stays up, the frame chunk
// turns away, everyone else may say their own at the same time, and a tile tray builds it for N4 stretch.

import { h, ruby } from '../../../shared/src/dom.js';
import type { ConcentrationView } from '../../../shared/src/modes/views.js';
import type { CellView, GreenLine, LastTry } from '../../../shared/src/modes/concentration/concentration.js';
import type { Face } from '../../../shared/src/modes/concentration/board.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import { speakBox } from '../components/speak.js';
import { waiting } from '../components/ui.js';
import type { PhoneContext, PhoneMode } from './types.js';

type Ctx = PhoneContext<ConcentrationView>;

const nameOf = (view: RoomView, id: string | null | undefined): string => view.players.find((p) => p.id === id)?.name ?? '…';

function faceText(face: Face): string {
  if (face.kind === 'audio') return '🔊';
  if (face.kind === 'gist') return face.pic ?? '';
  return face.text;
}

function cellKey(c: CellView): string {
  return `${c.state[0]}${c.masked ? 'm' : ''}${c.face ? faceText(c.face) : ''}${c.owner ? '*' : ''}`;
}

function miniBoard(ctx: Ctx, tappable: boolean): HTMLElement {
  const { game, send } = ctx;
  return h(
    'div',
    { class: `cc-mini cc-mini-${game.cols}`, style: `grid-template-columns: repeat(${game.cols}, 1fr)` },
    game.cells.map((c, i) => {
      const fogged = game.fogRow === Math.floor(i / game.cols) && c.state === 'down';
      if (c.state === 'cleared') return h('span', { class: 'cc-m cc-m-cleared' }, game.picture.tiles[i] ?? '');
      if (c.state === 'up') {
        // A word card with kanji carries its reading, as it does on the TV.
        const face = c.masked ? '？' : c.face?.kind === 'word' && c.face.sub ? ruby({ text: c.face.text, kana: c.face.sub }) : c.face ? faceText(c.face) : '';
        return h('span', { class: `cc-m cc-m-up cc-m-${c.face?.kind ?? 'masked'}`, lang: 'ja' }, face);
      }
      if (fogged) return h('span', { class: 'cc-m cc-m-fog' }, '🌫️');
      if (!tappable) return h('span', { class: 'cc-m cc-m-down' });
      return h('button', {
        type: 'button',
        class: 'cc-m cc-m-down cc-m-tap',
        'aria-label': `Card ${i + 1}`,
        onclick: (e: Event) => {
          (e.currentTarget as HTMLButtonElement).classList.add('cc-m-picked');
          void send({ kind: 'flip', cell: i });
        },
      });
    }),
  );
}

function cueCard(face: Face, size: 'big' | 'small' = 'big'): HTMLElement {
  if (face.kind === 'gist') {
    return h(
      'div',
      { class: `cc-cuecard ${size}` },
      h('span', { class: 'cc-cue-main' }, face.pic ?? ''),
      face.text ? h('span', { class: 'cc-gist-p' }, face.text) : h('span', { class: 'hint' }, 'Picture only: what happened?'),
    );
  }
  if (face.kind === 'chunk') {
    return h(
      'div',
      { class: `cc-cuecard ${size} cc-chunk-p` },
      h('span', { class: `cc-tag-p ${face.tag === 'N3' ? 'n3' : ''}` }, face.tag ?? ''),
      h('span', { class: 'cc-cue-main', lang: 'ja' }, face.text),
    );
  }
  return h(
    'div',
    { class: `cc-cuecard ${size}` },
    h('span', { class: 'cc-cue-main', lang: 'ja' }, face.kind === 'audio' ? '🔊' : face.text),
    face.kind === 'audio' ? h('span', { class: 'hint' }, 'Listen to the TV') : face.sub ? h('span', { class: 'hint', lang: 'ja' }, face.sub) : null,
  );
}

function guessPanel(ctx: Ctx): HTMLElement | null {
  const { game, send } = ctx;
  const pic = game.picture;
  const mine = game.mine;
  if (!mine) return null;
  if (mine.guess) {
    return h('p', { class: `cc-guessed ${mine.guess.ok ? 'ok' : ''}` }, mine.guess.ok ? '🔍 You guessed the picture!' : '🔍 Your picture guess missed. Keep matching!');
  }
  if (pic.solvedBy) return h('p', { class: 'hint' }, `🔍 ${nameOf(ctx.view, pic.solvedBy)} guessed the picture: `, pic.answer ? h('span', { lang: 'ja' }, ruby(pic.answer)) : null, ` (${pic.answer?.en ?? ''})`);
  if (!pic.open) return null;
  return h(
    'div',
    { class: 'cc-guess' },
    h('p', { class: 'hint' }, `🔍 What’s the hidden picture? +${pic.worth} now, one try:`),
    h(
      'div',
      { class: 'cc-guess-grid' },
      pic.options.map((o) =>
        h('button', { type: 'button', class: 'option cc-guess-btn', onclick: () => void send({ kind: 'guess', optionId: o.id }) }, h('span', { lang: 'ja' }, ruby(o)), h('small', {}, o.en)),
      ),
    ),
  );
}

function sayScreen(ctx: Ctx, stealing: boolean): HTMLElement {
  const { game, me, send } = ctx;
  const mine = game.mine!;
  const claim = game.claim!;
  const last = mine.last;
  return h(
    'div',
    { class: 'screen cc-say' },
    h('p', { class: 'big' }, stealing ? 'Steal it! Say the word' : 'Match! Say the word'),
    cueCard(claim.cue),
    mine.hint ? h('p', { class: 'cc-hint', lang: 'ja' }, `${mine.hint.kana} · ${mine.hint.romaji}`) : null,
    last && !last.ok ? h('p', { class: 'cc-miss' }, `Not quite (heard “${last.heard}”). ${mine.attemptsLeft} ${mine.attemptsLeft === 1 ? 'try' : 'tries'} left.`) : null,
    speakBox({
      label: 'Hold and say the word',
      placeholder: 'Type it in kana',
      kanaPadOpen: me.level === 'kana',
      onSend: (utterance) => void send({ kind: 'say', utterance }),
    }),
    h('p', { class: 'hint' }, 'Saying it aloud earns +40 more than typing.'),
  );
}

function resultLine(ctx: Ctx): HTMLElement {
  const { game, view, me } = ctx;
  const r = game.result;
  if (!r) return waiting('…');
  const word = r.word ? `${r.word.text}${r.word.kana !== r.word.text ? ` (${r.word.kana})` : ''} · ${r.word.en}` : '';
  const who = r.playerId === me.id ? 'You' : nameOf(view, r.playerId);
  switch (r.kind) {
    case 'claimed':
      return waiting(`${who} kept it! +${r.points}`, word);
    case 'stolen':
      return waiting(`${who} stole it! +${r.points}`, word);
    case 'missed':
      return waiting('Nobody said it', `${word}. Back it goes: remember where!`);
    case 'cleared':
      return waiting('Nobody said it', `${word}. Off the board.`);
    default:
      return waiting('No match', 'Remember where those were…');
  }
}

// ---- Frame Concentration (Green Car) ----

/** The tile tray's local state: which tiles you've placed, for this say window only. */
let tray: { key: string; open: boolean | null; picked: number[] } = { key: '', open: null, picked: [] };
function trayFor(view: RoomView, game: ConcentrationView) {
  const key = `${view.phaseSeq}:${game.mine?.attemptsLeft ?? 0}`;
  if (tray.key !== key) tray = { key, open: tray.key.split(':')[0] === String(view.phaseSeq) ? tray.open : null, picked: [] };
  return tray;
}

function tipText(last: LastTry, frameJa: string | null, anchorEn: string | null): string {
  const t = last.tip;
  if (!t) return `Not quite (heard “${last.heard}”).`;
  if (t.frame && !t.anchor) return `I heard ${frameJa ?? 'the frame'}, but not “${anchorEn ?? 'the key word'}”.`;
  if (!t.frame && t.anchor) return `I heard “${anchorEn ?? 'the key word'}”, but not the frame.`;
  return `I didn't hear the frame or “${anchorEn ?? 'the key word'}” (heard “${last.heard}”).`;
}

function tileTray(ctx: Ctx): HTMLElement | null {
  const { view, game, send, redraw } = ctx;
  const g = game.mine?.green;
  if (!g?.tiles?.length) return null;
  const t = trayFor(view, game);
  const open = t.open ?? g.stretch;
  if (!open) {
    return h('button', { type: 'button', class: 'secondary cc-tiles-open', onclick: () => ((t.open = true), redraw()) }, '🧩 Use word tiles (scores 100, no 🎤 bonus)');
  }
  const tiles = g.tiles;
  const built = t.picked.map((i) => tiles[i]!).join(' ');
  return h(
    'div',
    { class: 'cc-tray' },
    h('p', { class: 'hint' }, g.stretch ? '🧩 N3 stretch: build it from tiles, or say it for +20' : '🧩 Build the sentence (two tiles don’t belong)'),
    h('p', { class: 'cc-built', lang: 'ja' }, built || '…'),
    h(
      'div',
      { class: 'cc-tiles' },
      tiles.map((w, i) =>
        h(
          'button',
          { type: 'button', class: `cc-tile-btn${t.picked.includes(i) ? ' used' : ''}`, lang: 'ja', disabled: t.picked.includes(i), onclick: () => (t.picked.push(i), redraw()) },
          w,
        ),
      ),
    ),
    h(
      'div',
      { class: 'cc-tray-actions' },
      h('button', { type: 'button', class: 'secondary', onclick: () => ((t.picked = []), redraw()) }, 'Clear'),
      h('button', { type: 'button', disabled: !t.picked.length, onclick: () => void send({ kind: 'say', utterance: { via: 'tap', text: `${built}。` } }) }, 'Send'),
    ),
  );
}

function greenSayScreen(ctx: Ctx, stealing: boolean): HTMLElement {
  const { game, send } = ctx;
  const mine = game.mine!;
  const g = mine.green!;
  const claim = game.claim!;
  const last = mine.last;
  const title = g.chorus
    ? claim.winnerId
      ? 'They kept it! Say yours too (+30)'
      : 'Say your own sentence too! (+30)'
    : stealing
      ? 'Steal it! Say the whole sentence'
      : 'Match! Say the whole sentence';
  return h(
    'div',
    { class: 'screen cc-say' },
    h('p', { class: 'big' }, title),
    cueCard(claim.cue),
    h('p', { class: 'hint' }, 'In your own words: the frame you just saw, and what’s in the picture.'),
    g.stretch ? h('p', { class: 'cc-chip-p cc-n3' }, 'N3 stretch') : null,
    last && !last.ok ? h('p', { class: 'cc-miss' }, `${tipText(last, g.frameJa, g.anchorEn)} ${mine.attemptsLeft} ${mine.attemptsLeft === 1 ? 'try' : 'tries'} left.`) : null,
    speakBox({
      label: 'Hold and say the sentence',
      placeholder: 'Type it in kana',
      onSend: (utterance) => void send({ kind: 'say', utterance }),
    }),
    tileTray(ctx),
    h('p', { class: 'hint' }, g.chorus ? 'Only your own phone sees what you said.' : 'Saying it aloud earns +40 more than typing.'),
  );
}

function greenResult(ctx: Ctx): HTMLElement {
  const { game, view, me } = ctx;
  const r = game.result;
  const mine = game.mine;
  if (!r || r.kind === 'mismatch') return resultLine(ctx);
  const who = r.playerId === me.id ? 'You' : nameOf(view, r.playerId);
  const head = r.kind === 'claimed' ? `${who} kept it! +${r.points}` : r.kind === 'stolen' ? `${who} stole it! +${r.points}` : 'Nobody said it';
  const last = mine?.last ?? null;
  return h(
    'div',
    { class: 'screen' },
    h('p', { class: 'big' }, head),
    last ? h('p', { class: last.ok ? 'cc-own ok' : 'cc-own' }, `${last.ok ? '✓' : '✗'} You said: `, h('span', { lang: 'ja' }, last.heard)) : null,
    r.word ? h('p', { class: 'hint' }, last && !last.ok ? 'One way to say it: ' : 'Our model: ', ruby(r.word), ` · ${r.word.en}`) : null,
    r.kind === 'missed' ? h('p', { class: 'hint' }, 'Back it goes: remember where!') : null,
  );
}

function greenLines(lines: GreenLine[] | null): HTMLElement {
  if (!lines?.length) return h('p', { class: 'hint' }, 'No sentences this game. Next time, join the chorus!');
  return h(
    'ul',
    { class: 'cc-lines' },
    lines.map((l) =>
      h(
        'li',
        { class: l.ok ? 'ok' : '' },
        h('span', { lang: 'ja' }, `${l.ok ? '✓' : '✗'} ${l.heard}`),
        h('small', {}, l.ok ? (l.memory ? 'counted (said from memory)' : 'right (typed, tiles or echoed: not counted)') : `one way to say it: ${l.model.kana}`),
      ),
    ),
  );
}

function greenRender(ctx: Ctx, footer: HTMLElement): HTMLElement | null {
  const { view, game, me } = ctx;
  const mine = game.mine;
  const tally = game.tally.find((t) => t.playerId === me.id);
  switch (view.phase) {
    case 'intro':
      return h(
        'div',
        { class: 'screen' },
        h('p', { class: 'big', lang: 'ja' }, 'フレーム神経衰弱'),
        h('p', {}, 'On your turn, tap two cards. A pair is a picture with an English gist and the frame that says it.'),
        h('p', {}, 'Match? Say the whole sentence in your own words to keep it. Everyone else: say yours too for +30. Miss, and anyone can steal it!'),
        h('p', { class: 'hint', lang: 'ja' }, '😴 “I pretended to be asleep” + ＿ふりを する → ねた ふりを しました。'),
      );
    case 'prompt': {
      const mineClaim = game.claim?.claimerId === me.id;
      const chunk = game.cells.find((c) => c.state === 'up' && c.face?.kind === 'chunk')?.face;
      return h(
        'div',
        { class: 'screen' },
        h('p', { class: 'big' }, mineClaim ? 'Match! Make the sentence…' : `${nameOf(view, game.claim?.claimerId)} found a pair! Get yours ready`),
        game.claim ? cueCard(game.claim.cue) : null,
        chunk ? cueCard(chunk) : null,
      );
    }
    case 'reveal':
    case 'encore': {
      const stealing = view.phase === 'encore';
      if (mine?.canSay && game.claim) return greenSayScreen(ctx, stealing);
      const last = mine?.last;
      const tip = last && !last.ok ? tipText(last, mine?.green?.frameJa ?? null, mine?.green?.anchorEn ?? null) : '';
      if (game.claim?.claimerId === me.id) return waiting(game.claim.winnerId ? 'You kept it! The others are saying theirs…' : 'The others can steal it now…', tip);
      if (!stealing) return waiting(last?.ok ? 'Nice! Yours counted (+30)' : `${nameOf(view, game.claim?.claimerId)} is saying it…`, tip || 'If they miss, you can steal it.');
      return waiting('No more tries', 'Fingers crossed nobody else gets it.');
    }
    case 'score':
      return h('div', { class: 'screen' }, greenResult(ctx), game.result?.kind === 'mismatch' ? miniBoard(ctx, false) : null, guessPanel(ctx), footer);
    case 'finale':
      return h(
        'div',
        { class: 'screen' },
        h('p', { class: 'big' }, game.pairsLeft === 0 ? 'Board clear!' : 'Time!'),
        h('p', {}, `You kept ${tally?.pairs ?? 0} pair${tally?.pairs === 1 ? '' : 's'}${tally?.steals ? ` (${tally.steals} stolen)` : ''}. Your sentences:`),
        greenLines(mine?.green?.lines ?? null),
      );
    default:
      return null;
  }
}

export const concentrationPhone: PhoneMode<ConcentrationView> = {
  key: (view, game) =>
    [
      view.phaseSeq,
      game.cells.map(cellKey).join(','),
      game.fogRow,
      game.turn ? `${game.turn.playerId}:${game.turn.flips}:${game.turn.specials}` : '',
      JSON.stringify(game.mine),
      game.picture.open,
      game.picture.solvedBy,
      game.picture.worth,
      game.claim?.winnerId,
      game.result?.kind,
      game.green ? `${game.claim?.chorus?.join('.') ?? ''}:${tray.key}:${tray.open}:${tray.picked.join('.')}` : '',
    ].join('|'),

  render(ctx) {
    const { view, game, me } = ctx;
    const mine = game.mine;
    const turnName = nameOf(view, game.turn?.playerId);
    const tally = game.tally.find((t) => t.playerId === me.id);
    const footer = h('p', { class: 'hint cc-foot' }, `Your pairs: ${tally?.pairs ?? 0} · ${game.pairsLeft} pairs left`);
    const green = game.green ? greenRender(ctx, footer) : null;
    if (green) return green;

    switch (view.phase) {
      case 'intro':
        return h(
          'div',
          { class: 'screen' },
          h('p', { class: 'big', lang: 'ja' }, 'ことば神経衰弱'),
          h('p', {}, 'On your turn, tap two cards. A pair is two forms of one word (kana ↔ meaning, kanji ↔ reading, picture or sound ↔ word).'),
          h('p', {}, 'Match? Say the word within 5 seconds to keep it. Miss, and anyone can steal it!'),
          h('p', { class: 'hint' }, 'Specials: 👹 shuffles the cards · ⭐ extra turn · 🌫️ hides a row next turn.'),
        );
      case 'answer': {
        const myTurn = !!mine?.isTurn;
        return h(
          'div',
          { class: 'screen' },
          h('p', { class: 'big' }, myTurn ? (game.turn?.flips ? 'One more card!' : 'Your turn! Tap two cards') : `${turnName}’s turn`),
          myTurn && game.turn?.extra ? h('p', { class: 'cc-chip-p' }, '⭐ Extra turn') : null,
          myTurn && game.fogRow !== null ? h('p', { class: 'hint' }, `🌫️ Row ${game.fogRow + 1} is fogged this turn.`) : null,
          miniBoard(ctx, !!mine?.canFlip),
          !myTurn ? h('p', { class: 'hint' }, 'Watch the cards: you can steal if they match and miss.') : null,
          guessPanel(ctx),
          footer,
        );
      }
      case 'prompt': {
        const mineClaim = game.claim?.claimerId === me.id;
        const word = game.claim?.word;
        return h(
          'div',
          { class: 'screen' },
          h('p', { class: 'big' }, mineClaim ? 'Match! Remember the word…' : `${nameOf(view, game.claim?.claimerId)} found a pair!`),
          word ? h('div', { class: 'cc-cuecard big' }, h('span', { class: 'cc-cue-main', lang: 'ja' }, word.text), word.kana !== word.text ? h('span', { class: 'hint', lang: 'ja' }, word.kana) : null) : null,
          h('p', { class: 'hint' }, mineClaim ? 'Get ready to say it.' : 'Get ready to steal it if they miss.'),
        );
      }
      case 'reveal':
      case 'encore': {
        const stealing = view.phase === 'encore';
        if (mine?.canSay && game.claim) return sayScreen(ctx, stealing);
        const claimer = nameOf(view, game.claim?.claimerId);
        if (!stealing) return h('div', { class: 'screen' }, h('p', { class: 'big' }, `${claimer} is saying it…`), game.claim ? cueCard(game.claim.cue, 'small') : null, h('p', { class: 'hint' }, 'If they miss, you can steal it. Get ready!'), guessPanel(ctx));
        if (game.claim?.claimerId === me.id) return waiting('The others can steal it now…', mine?.last?.ok === false ? `Heard “${mine.last.heard}”` : '');
        return waiting('No more tries', 'Fingers crossed nobody else gets it.');
      }
      case 'score':
        return h('div', { class: 'screen' }, resultLine(ctx), game.result?.kind === 'mismatch' ? miniBoard(ctx, false) : null, guessPanel(ctx), footer);
      case 'finale':
        return h(
          'div',
          { class: 'screen' },
          h('p', { class: 'big' }, game.pairsLeft === 0 ? 'Board clear!' : 'Time!'),
          h('p', {}, `You kept ${tally?.pairs ?? 0} pair${tally?.pairs === 1 ? '' : 's'}${tally?.steals ? ` (${tally.steals} stolen)` : ''}.`),
          game.picture.answer ? h('p', { class: 'hint' }, 'The picture was ', h('span', { lang: 'ja' }, ruby(game.picture.answer)), ` · ${game.picture.answer.en}`) : null,
        );
      default:
        return waiting('Look at the TV!');
    }
  },
};
