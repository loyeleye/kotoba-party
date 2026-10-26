// Kotoba Concentration on the TV: the board (with the hidden picture showing through the
// cleared cells), whose turn it is, the say-it and steal windows, and the picture guesses.
// Audio cards speak their word with the browser's Japanese voice when they turn over.

import { h, ruby } from '../../../shared/src/dom.js';
import type { ConcentrationView } from '../../../shared/src/modes/views.js';
import type { CellView } from '../../../shared/src/modes/concentration/concentration.js';
import type { Face } from '../../../shared/src/modes/concentration/board.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import type { StageMode } from './types.js';

// ---- speech ----

function jaVoice(): SpeechSynthesisVoice | null {
  if (typeof speechSynthesis === 'undefined') return null;
  return speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith('ja')) ?? null;
}
if (typeof speechSynthesis !== 'undefined') speechSynthesis.getVoices();

/** True when the stage can voice audio cards; otherwise they show their kana. */
const canTalk = (): boolean => jaVoice() !== null;

let lastSpoken = '';
function speakOnce(key: string, kana: string): void {
  if (key === lastSpoken) return;
  lastSpoken = key;
  const voice = jaVoice();
  if (!voice) return;
  const u = new SpeechSynthesisUtterance(kana);
  u.lang = 'ja-JP';
  u.voice = voice;
  u.rate = 0.85;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

// ---- toasts for specials and guesses ----

let flashSeen = { seq: 0, at: 0 };
const FLASH_MS = 3_500;

function toast(view: RoomView, game: ConcentrationView): HTMLElement | null {
  const f = game.flash;
  if (!f) return null;
  if (f.seq !== flashSeen.seq) flashSeen = { seq: f.seq, at: Date.now() };
  const elapsed = Date.now() - flashSeen.at;
  if (elapsed > FLASH_MS) return null;
  const who = nameOf(view, f.playerId);
  const text: Record<typeof f.kind, string> = {
    yokai: `👹 Yōkai! ${who} woke it up: the cards are shuffled!`,
    bonus: `⭐ Bonus! ${who} gets an extra turn`,
    fog: `🌫️ Fog! Row ${(f.row ?? 0) + 1} is hidden next turn`,
    claimed: `✨ ${who} keeps the pair!`,
    stolen: `🦊 ${who} stole it!`,
    missed: '💨 Nobody said it',
    'guess-right': `🔍 ${who} guessed the picture!`,
    'guess-wrong': `🔍 ${who} guessed… not quite`,
  };
  // Keyed by the flash, so a new one is a new element and its animation plays from the start.
  return h('div', { class: `cc-toast cc-toast-${f.kind}`, style: `animation-delay: -${elapsed}ms`, 'data-key': `flash-${f.seq}` }, text[f.kind]);
}

// ---- pieces ----

const nameOf = (view: RoomView, id: string | null | undefined): string => view.players.find((p) => p.id === id)?.name ?? '…';
const seatOf = (view: RoomView, id: string | null | undefined): number => view.players.find((p) => p.id === id)?.seat ?? 0;

/** Font size that fits `text` inside a card (container query units; ignored where unsupported). */
function fit(text: string, kind: Face['kind']): string {
  const len = [...text].length || 1;
  if (kind === 'en') return `font-size: ${len <= 6 ? 20 : len <= 12 ? 15 : 12}cqw`;
  return `font-size: ${Math.min(kind === 'kanji' ? 46 : 40, Math.floor(86 / len))}cqw`;
}

function faceEl(face: Face, opts: { audioKey?: string; inCell?: boolean } = {}): HTMLElement {
  const size = (text: string) => (opts.inCell ? fit(text, face.kind) : null);
  switch (face.kind) {
    case 'emoji':
    case 'special':
      return h('div', { class: `cc-face cc-${face.kind}` }, h('span', { class: 'cc-emoji' }, face.text));
    case 'audio': {
      if (opts.audioKey && face.say) speakOnce(opts.audioKey, face.say);
      return h(
        'div',
        { class: 'cc-face cc-audio' },
        h('span', { class: 'cc-emoji' }, '🔊'),
        canTalk() ? h('span', { class: 'cc-small' }, 'listen') : h('span', { class: 'cc-kana', lang: 'ja' }, face.say ?? ''),
      );
    }
    case 'en':
      return h('div', { class: 'cc-face cc-en' }, h('span', { style: size(face.text) }, face.text));
    case 'word':
      return h(
        'div',
        { class: 'cc-face cc-word' },
        h('span', { class: 'cc-jp', lang: 'ja', style: size(face.text) }, face.text),
        face.sub ? h('span', { class: 'cc-sub', lang: 'ja' }, face.sub) : null,
      );
    default:
      // kana, kanji
      return h('div', { class: `cc-face cc-${face.kind}` }, h('span', { class: 'cc-jp', lang: 'ja', style: size(face.text) }, face.text));
  }
}

function board(view: RoomView, game: ConcentrationView): HTMLElement {
  const cells = game.cells.map((c: CellView, i) => {
    const row = Math.floor(i / game.cols);
    const fogged = game.fogRow === row && c.state === 'down';
    const tile = game.picture.tiles[i];
    if (c.state === 'cleared') {
      const owner = c.owner ? seatOf(view, c.owner) : 0;
      return h(
        'div',
        { class: 'cc-cell cc-cleared' },
        h('span', { class: 'cc-tile' }, tile ?? ''),
        owner ? h('span', { class: `cc-owner seat-${owner}` }, String(owner)) : null,
      );
    }
    if (c.state === 'up') {
      if (c.masked) return h('div', { class: 'cc-cell cc-up cc-masked' }, h('span', { class: 'cc-q' }, '？'));
      return h('div', { class: 'cc-cell cc-up' }, c.face ? faceEl(c.face, { audioKey: `${game.turn?.no ?? 0}:${i}`, inCell: true }) : null);
    }
    // Face down: once the picture is solved, show it through the backs too.
    if (tile && game.picture.answer) return h('div', { class: 'cc-cell cc-down cc-solved' }, h('span', { class: 'cc-tile' }, tile));
    return h('div', { class: `cc-cell cc-down${fogged ? ' cc-fog' : ''}` }, fogged ? h('span', { class: 'cc-emoji' }, '🌫️') : h('span', { class: 'cc-back' }, '筆'));
  });
  return h('div', { class: `cc-board cc-size-${game.cols}`, style: `grid-template-columns: repeat(${game.cols}, 1fr); grid-template-rows: repeat(${game.rows}, 1fr)` }, cells);
}

function banner(view: RoomView, game: ConcentrationView): HTMLElement {
  const turnName = nameOf(view, game.turn?.playerId);
  const claim = game.claim;
  switch (view.phase) {
    case 'intro':
      return h(
        'div',
        { class: 'cc-banner' },
        h('p', { class: 'cc-title', lang: 'ja' }, 'ことば神経衰弱'),
        h('p', { class: 'cc-line' }, 'Flip two cards on your phone. A pair is two forms of one word.'),
        h('p', { class: 'cc-line' }, 'Match? Say the word in 5 seconds to keep it, or anyone can steal it!'),
        h('p', { class: 'cc-line muted' }, 'Cleared cards uncover a hidden picture: guess it on your phone for a bonus.'),
      );
    case 'answer':
      return h(
        'div',
        { class: 'cc-banner' },
        h('p', { class: 'cc-title' }, `${turnName}’s turn`, game.turn?.extra ? h('span', { class: 'cc-chip' }, '⭐ extra turn') : null),
        h('p', { class: 'cc-line muted' }, game.turn?.flips ? 'One more card…' : 'Flip two cards'),
      );
    case 'prompt':
      return h('div', { class: 'cc-banner cc-match' }, h('p', { class: 'cc-title' }, `Match! ${nameOf(view, claim?.claimerId)}, remember the word…`));
    case 'reveal':
    case 'encore': {
      if (!claim) return h('div', { class: 'cc-banner' });
      const stealing = claim.stage === 'steal';
      return h(
        'div',
        { class: `cc-banner ${stealing ? 'cc-steal' : 'cc-claim'}` },
        h('p', { class: 'cc-title' }, stealing ? 'Steal it! Anyone can say it' : `${nameOf(view, claim.claimerId)}, say it!`),
        h('div', { class: 'cc-cue' }, faceEl(claim.cue, { audioKey: `${game.turn?.no ?? 0}:cue:${claim.stage}` })),
        claim.tried.length ? h('p', { class: 'cc-line muted' }, `Tried: ${claim.tried.map((id) => nameOf(view, id)).join(', ')}`) : null,
      );
    }
    case 'score': {
      const r = game.result;
      if (!r) return h('div', { class: 'cc-banner' });
      const word = r.word ? h('span', { class: 'cc-word-line', lang: 'ja' }, ruby(r.word), h('span', { class: 'muted' }, ` · ${r.word.en}`)) : null;
      const lines: Record<typeof r.kind, string> = {
        claimed: `${nameOf(view, r.playerId)} keeps it! +${r.points}${r.spoken ? ' 🎤' : ''}`,
        stolen: `${nameOf(view, r.playerId)} stole it! +${r.points}${r.spoken ? ' 🎤' : ''}`,
        missed: 'Nobody said it: back it goes',
        cleared: 'Nobody said it: off the board',
        mismatch: 'No match',
      };
      return h('div', { class: `cc-banner cc-result cc-${r.kind}` }, h('p', { class: 'cc-title' }, lines[r.kind]), word);
    }
    case 'finale': {
      const top = [...game.tally].sort((a, b) => b.points - a.points)[0];
      return h(
        'div',
        { class: 'cc-banner cc-finale' },
        h('p', { class: 'cc-title' }, game.pairsLeft === 0 ? 'Board clear! お疲れさま！' : 'Time! お疲れさま！'),
        game.picture.answer ? h('p', { class: 'cc-line', lang: 'ja' }, `The picture: ${game.picture.answer.text} · ${game.picture.answer.en}`) : null,
        top ? h('p', { class: 'cc-line' }, `Most points: ${nameOf(view, top.playerId)} (${top.points})`) : null,
      );
    }
    default:
      return h('div', { class: 'cc-banner' });
  }
}

function side(view: RoomView, game: ConcentrationView): HTMLElement {
  const pic = game.picture;
  const minutes = Math.max(0, Math.ceil((game.endsAt - Date.now()) / 60_000));
  return h(
    'div',
    { class: 'cc-side' },
    h('div', { class: 'cc-stat' }, h('strong', {}, `${game.totalPairs - game.pairsLeft} / ${game.totalPairs}`), h('span', {}, 'pairs found')),
    view.phase !== 'finale' ? h('div', { class: 'cc-stat' }, h('strong', {}, `${minutes} min`), h('span', {}, 'left at most')) : null,
    h(
      'div',
      { class: 'cc-picture' },
      h('p', { class: 'cc-pic-title' }, pic.answer ? 'The hidden picture' : 'What’s the hidden picture?'),
      pic.answer
        ? h('p', { class: 'cc-pic-answer', lang: 'ja' }, ruby(pic.answer), h('small', {}, pic.answer.en))
        : h(
            'ol',
            { class: 'cc-options' },
            pic.options.map((o) => h('li', {}, ruby(o), h('small', {}, o.en))),
          ),
      pic.solvedBy ? h('p', { class: 'cc-line good' }, `${nameOf(view, pic.solvedBy)} got it!`) : null,
      !pic.answer && pic.open ? h('p', { class: 'cc-line muted' }, `Guess on your phone: +${pic.worth} now (one try each)`) : null,
      !pic.answer && !pic.open && view.phase !== 'intro' ? h('p', { class: 'cc-line muted' }, 'Clear a pair to start guessing') : null,
      pic.guessed.filter((g) => !g.ok).length
        ? h('p', { class: 'cc-line muted' }, `Missed: ${pic.guessed.filter((g) => !g.ok).map((g) => nameOf(view, g.playerId)).join(', ')}`)
        : null,
    ),
    game.fallback ? h('p', { class: 'cc-line muted' }, '(placeholder words: no topic pack loaded)') : null,
  );
}

export const concentrationStage: StageMode<ConcentrationView> = {
  badge(game, playerId) {
    const t = game.tally.find((x) => x.playerId === playerId);
    const turn = game.turn?.playerId === playerId ? '▶ ' : '';
    return `${turn}${t?.pairs ? `🃏${t.pairs}` : ''}`;
  },

  render(view, game) {
    return h('div', { class: 'cc-stage' }, banner(view, game), h('div', { class: 'cc-layout' }, h('div', { class: 'cc-board-wrap' }, board(view, game), toast(view, game)), side(view, game)));
  },
};
