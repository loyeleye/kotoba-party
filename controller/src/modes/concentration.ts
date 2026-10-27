// Kotoba Concentration on the phone: a mini board to flip cards on your turn, the say-it
// box when you match (or when you can steal), and the hidden-picture buzzer.

import { h, ruby } from '../../../shared/src/dom.js';
import type { ConcentrationView } from '../../../shared/src/modes/views.js';
import type { CellView } from '../../../shared/src/modes/concentration/concentration.js';
import type { Face } from '../../../shared/src/modes/concentration/board.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import { speakBox } from '../components/speak.js';
import { waiting } from '../components/ui.js';
import type { PhoneContext, PhoneMode } from './types.js';

type Ctx = PhoneContext<ConcentrationView>;

const nameOf = (view: RoomView, id: string | null | undefined): string => view.players.find((p) => p.id === id)?.name ?? '…';

function faceText(face: Face): string {
  if (face.kind === 'audio') return '🔊';
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
    ].join('|'),

  render(ctx) {
    const { view, game, me } = ctx;
    const mine = game.mine;
    const turnName = nameOf(view, game.turn?.playerId);
    const tally = game.tally.find((t) => t.playerId === me.id);
    const footer = h('p', { class: 'hint cc-foot' }, `Your pairs: ${tally?.pairs ?? 0} · ${game.pairsLeft} pairs left`);

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
