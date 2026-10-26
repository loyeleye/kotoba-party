// Who's the Tourist? on the TV: the places in play, the live question turn and the Q&A log with
// English subtitles, the vote, the caught tourist's last chance, and the big reveal.

import { h } from '../../../shared/src/dom.js';
import type { TouristView } from '../../../shared/src/modes/views.js';
import type { ExchangeView, PlaceCard, SaidView } from '../../../shared/src/modes/tourist/tourist.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import type { StageMode } from './types.js';

const nameOf = (view: RoomView, id: string | null | undefined): string => view.players.find((p) => p.id === id)?.name ?? '(left)';

function ruby(p: { text: string; furigana?: [string, string][] }): (Node | string)[] {
  if (!p.furigana?.length) return [p.text];
  return p.furigana.map(([base, reading]) => (reading ? h('ruby', {}, base, h('rt', {}, reading)) : base));
}

function places(game: TouristView, size: 'big' | 'small', mark?: { id: string; cls: string }[]): HTMLElement {
  return h(
    'ul',
    { class: `tou-places tou-places-${size}` },
    game.places.map((p) =>
      h(
        'li',
        { class: `tou-place ${mark?.find((m) => m.id === p.id)?.cls ?? ''}` },
        h('span', { class: 'tou-place-emoji' }, p.emoji),
        h('span', { class: 'tou-place-jp', lang: 'ja' }, ruby(p)),
        h('span', { class: 'tou-place-en' }, p.en),
      ),
    ),
  );
}

function said(x: SaidView, cls: string): HTMLElement {
  return h(
    'div',
    { class: `tou-said ${cls}` },
    h('p', { class: 'tou-said-jp', lang: 'ja' }, x.text),
    x.kana && x.kana !== x.text ? h('p', { class: 'tou-said-kana', lang: 'ja' }, x.kana) : null,
    h('p', { class: `tou-said-en${x.en ? '' : ' none'}` }, x.en ? `${x.approx ? '≈ ' : ''}${x.en}` : x.text === '[hidden]' ? '' : '(in their own words)', x.spoken ? h('span', { class: 'tou-mic' }, ' 🎤') : null),
  );
}

function exchange(view: RoomView, x: ExchangeView): HTMLElement {
  return h(
    'li',
    { class: 'tou-ex' },
    h('p', { class: 'tou-ex-who' }, h('span', { class: 'tou-ex-n' }, `Q${x.index + 1}`), `${nameOf(view, x.askerId)} → ${nameOf(view, x.targetId)}`),
    said(x.question, 'q'),
    x.answer ? said(x.answer, 'a') : h('p', { class: 'tou-said-en none' }, '(no answer)'),
  );
}

function logPanel(view: RoomView, game: TouristView, max: number): HTMLElement {
  const items = [...game.log].reverse().slice(0, max);
  return h(
    'div',
    { class: 'tou-log' },
    h('p', { class: 'tou-panel-title' }, 'Questions so far'),
    items.length ? h('ul', {}, items.map((x) => exchange(view, x))) : h('p', { class: 'tou-muted' }, 'No questions yet.'),
  );
}

function liveTurn(view: RoomView, game: TouristView): HTMLElement {
  const t = game.turn;
  if (!t) return h('div', { class: 'tou-turn' }, h('p', { class: 'tou-muted' }, 'Next question…'));
  const asker = nameOf(view, t.askerId);
  const target = t.targetId ? nameOf(view, t.targetId) : null;
  return h(
    'div',
    { class: 'tou-turn' },
    h('p', { class: 'tou-turn-n' }, `Question ${Math.min(t.n, t.cap)} of ${t.cap}`),
    h('p', { class: 'tou-turn-who' }, `🎤 ${asker}`, target ? h('span', { class: 'tou-arrow' }, ' → ') : null, target ? `${target}` : null),
    t.question
      ? said(t.question, 'q big')
      : h('p', { class: 'tou-waiting' }, target ? `${asker}, ask ${target} a question in Japanese!` : `${asker} is choosing who to ask…`),
    t.question ? (t.answer ? said(t.answer, 'a big') : h('p', { class: 'tou-waiting' }, `${target}, answer out loud!`)) : null,
  );
}

function tallyBars(view: RoomView, game: TouristView): HTMLElement | null {
  const o = game.outcome;
  if (!o || !o.tally.length) return null;
  const max = Math.max(...o.tally.map((t) => t.votes));
  return h(
    'ul',
    { class: 'tou-tally' },
    o.tally.map((t) =>
      h(
        'li',
        { class: t.playerId === o.touristId ? 'tourist' : '' },
        h('span', { class: 'tou-tally-name' }, nameOf(view, t.playerId)),
        h('span', { class: 'tou-tally-bar', style: `width: ${Math.round((t.votes / max) * 100)}%` }),
        h('strong', {}, String(t.votes)),
      ),
    ),
  );
}

function points(view: RoomView, game: TouristView): HTMLElement | null {
  const rows = (game.roundPoints ?? []).filter((r) => r.points > 0).sort((a, b) => b.points - a.points);
  if (!rows.length) return null;
  return h('ol', { class: 'tou-points' }, rows.map((r) => h('li', {}, h('span', {}, nameOf(view, r.playerId)), h('strong', {}, `+${r.points}`))));
}

function headline(view: RoomView, game: TouristView): string {
  const o = game.outcome!;
  const who = nameOf(view, o.touristId);
  switch (o.how) {
    case 'caught':
      return o.lastChance?.right ? `Caught! But ${who} knew where we were!` : `Caught! ${who} was the tourist!`;
    case 'wrong-person':
      return `${nameOf(view, o.accusedId)} was a local! ${who} gets away!`;
    case 'escaped':
      return `Nobody caught ${who}, the tourist!`;
    case 'guessed':
      return `${who} was the tourist, and guessed it!`;
    case 'wrong-guess':
      return `${who} was the tourist, and guessed wrong!`;
    case 'left':
      return `${who} (the tourist) left the game.`;
  }
}

function reveal(game: TouristView, p: PlaceCard): HTMLElement {
  return h(
    'div',
    { class: 'tou-reveal' },
    h('span', { class: 'tou-reveal-emoji' }, p.emoji),
    h('div', {}, h('p', { class: 'tou-reveal-jp', lang: 'ja' }, 'ここは ', h('strong', {}, ruby(p)), ' でした！'), h('p', { class: 'tou-reveal-en' }, `We were at the ${p.en}.`)),
    game.multiplier > 1 ? h('span', { class: 'tou-double' }, 'Final round · ×2') : null,
  );
}

export const touristStage: StageMode<TouristView> = {
  badge(game, playerId) {
    if (game.roundPoints) {
      const p = game.roundPoints.find((x) => x.playerId === playerId)?.points ?? 0;
      return p ? `+${p}` : '';
    }
    if (game.vote) return game.vote.voted.includes(playerId) ? '✓ voted' : '';
    if (game.ready.includes(playerId)) return '✓';
    if (game.turn?.askerId === playerId) return '🎤 asking';
    if (game.turn?.targetId === playerId) return '👂 answering';
    return '';
  },

  render(view, game) {
    switch (view.phase) {
      case 'intro':
        return h(
          'div',
          { class: 'tou-stage tou-intro' },
          h('p', { class: 'tou-title', lang: 'ja' }, 'かんこうきゃくは だれ？'),
          h('p', { class: 'tou-subtitle' }, "Who's the Tourist?"),
          h(
            'ol',
            { class: 'tou-steps' },
            h('li', {}, h('strong', {}, '🗺️ Everyone but one'), ' sees where we are on their phone. The ', h('strong', {}, 'tourist 🧳'), ' has no idea.'),
            h('li', {}, h('strong', {}, '🎤 Take turns'), ' asking someone a question in Japanese, out loud. They answer out loud too.'),
            h('li', {}, h('strong', {}, '🤫 Locals:'), ' prove you know the place, but don’t give it away!'),
            h('li', {}, h('strong', {}, '🗳️ Suspicious?'), ' Call a vote from your phone. The tourist can guess the place any time to win.'),
          ),
        );
      case 'prompt':
        return h(
          'div',
          { class: 'tou-stage' },
          h('p', { class: 'tou-callout' }, '🤫 Look at your phone. Keep it secret!'),
          h('p', { class: 'tou-hint' }, 'One of you is the tourist. Tonight we could be at…'),
          places(game, 'big'),
          game.multiplier > 1 ? h('p', { class: 'tou-double-line' }, 'Final round · points ×2') : null,
        );
      case 'answer':
        return h(
          'div',
          { class: 'tou-stage' },
          game.failedVote ? h('p', { class: 'tou-banner' }, `🗳️ No majority. Nobody was voted out. Keep asking!`) : null,
          h('div', { class: 'tou-live' }, h('div', { class: 'tou-left' }, liveTurn(view, game), places(game, 'small')), logPanel(view, game, 5)),
          h('p', { class: 'tou-hint' }, 'Suspicious? Anyone can call a vote from their phone (once per round). The tourist can guess the place at any time.'),
        );
      case 'reveal': {
        const v = game.vote;
        const need = v ? Math.floor(v.voters.length / 2) + 1 : 0;
        return h(
          'div',
          { class: 'tou-stage tou-vote' },
          h('p', { class: 'tou-big' }, '🗳️ Who’s the tourist?'),
          h(
            'p',
            { class: 'tou-hint' },
            v?.kind === 'called' ? `${nameOf(view, v.callerId)} called a vote! It takes ${need} votes to catch someone.` : 'Time’s up! Final vote: most votes is out. A tie lets the tourist go.',
          ),
          h(
            'ul',
            { class: 'tou-voters' },
            (v?.voters ?? []).map((id) => h('li', { class: v!.voted.includes(id) ? 'on' : '' }, nameOf(view, id), h('span', {}, v!.voted.includes(id) ? ' ✓' : ' …'))),
          ),
          logPanel(view, game, 3),
        );
      }
      case 'encore': {
        const o = game.outcome;
        return h(
          'div',
          { class: 'tou-stage tou-vote' },
          h('p', { class: 'tou-big' }, `🧳 Caught! ${nameOf(view, o?.touristId)} is the tourist!`),
          h('p', { class: 'tou-callout' }, 'Last chance: where are we?'),
          places(game, 'big'),
          h('p', { class: 'tou-hint' }, `${nameOf(view, o?.touristId)}: say it, “ここは ＿＿ ですか？”, and pick on your phone.`),
        );
      }
      case 'score': {
        const o = game.outcome;
        if (!o) return h('div', { class: 'tou-stage' });
        const marks = [
          ...(o.place ? [{ id: o.place.id, cls: 'right' }] : []),
          ...(o.guess && !o.guess.right ? [{ id: o.guess.place.id, cls: 'wrong' }] : []),
          ...(o.lastChance && !o.lastChance.right ? [{ id: o.lastChance.place.id, cls: 'wrong' }] : []),
        ];
        return h(
          'div',
          { class: 'tou-stage tou-score' },
          h('p', { class: `tou-big tou-how-${o.how}` }, headline(view, game)),
          o.place ? reveal(game, o.place) : null,
          h(
            'div',
            { class: 'tou-live' },
            h('div', { class: 'tou-left' }, tallyBars(view, game), places(game, 'small', marks)),
            points(view, game) ?? h('p', { class: 'tou-muted' }, 'No points this round.'),
          ),
          h('p', { class: 'tou-hint' }, game.round < game.totalRounds ? 'Next round: new place, new tourist…' : 'That’s the last round!'),
        );
      }
      default:
        return h('div', { class: 'tou-stage' });
    }
  },
};
