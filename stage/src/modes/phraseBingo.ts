// Phrase Bingo Theater on the TV: the scene card and cast, ACTION! with a live ticker of who just
// slipped a phrase in (never which), the secrets revealed, the shout-back phrase, and bingo.

import { h, ruby } from '../../../shared/src/dom.js';
import { scenePic } from '../../../shared/src/art.js';
import type { PhraseBingoView } from '../../../shared/src/modes/views.js';
import type { ActorView, PhraseCard, TickerItem } from '../../../shared/src/modes/phraseBingo/phraseBingo.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import type { StageMode } from './types.js';

const nameOf = (view: RoomView, id: string | null | undefined): string => view.players.find((p) => p.id === id)?.name ?? '(left)';
const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

function sceneCard(game: PhraseBingoView, compact = false): HTMLElement | null {
  const sc = game.scene;
  if (!sc) return null;
  return h(
    'div',
    { class: `pb-scene${compact ? ' pb-compact' : ''}` },
    scenePic(sc, 'pb-emoji'),
    h(
      'div',
      { class: 'pb-scene-text' },
      h('p', { class: 'pb-setting' }, ruby(sc.setting)),
      h('p', { class: 'pb-setting-en' }, sc.setting.en),
      h('p', { class: 'pb-twist' }, `Twist: ${sc.twist}`),
    ),
    game.multiplier > 1 ? h('span', { class: 'pb-double' }, 'Final scene · ×2') : null,
  );
}

function castList(view: RoomView, game: PhraseBingoView, live: boolean): HTMLElement {
  return h(
    'ul',
    { class: 'pb-cast' },
    game.cast.map((a) =>
      h(
        'li',
        { class: 'pb-actor' },
        h('span', { class: 'pb-actor-name' }, nameOf(view, a.playerId)),
        h('span', { class: 'pb-role' }, ruby(a.role), h('small', {}, a.role.en)),
        live
          ? h('span', { class: 'pb-bells', 'aria-label': `${a.said} of ${a.total} phrases slipped in` }, '🔔'.repeat(a.said), h('span', { class: 'pb-bells-left' }, '◌'.repeat(Math.max(0, a.total - a.said))))
          : view.phase === 'prompt'
            ? h('span', { class: `pb-ready${a.ready ? ' on' : ''}` }, a.ready ? 'ready' : 'studying…')
            : null,
      ),
    ),
  );
}

function tickerLine(view: RoomView, item: TickerItem): HTMLElement {
  const who = nameOf(view, item.playerId);
  if (item.kind === 'slip') {
    return h(
      'li',
      { class: 'pb-tick pb-tick-slip' },
      h('span', { class: 'pb-time' }, clock(item.atSec)),
      h('span', {}, `🔔 ${who} slipped one in!`),
      item.phrase ? h('span', { class: 'pb-tick-phrase' }, ruby(item.phrase), h('small', {}, item.phrase.en)) : null,
    );
  }
  return h(
    'li',
    { class: `pb-tick pb-tick-buzz${item.buzz ? (item.buzz.ok ? ' ok' : ' miss') : ''}` },
    h('span', { class: 'pb-time' }, clock(item.atSec)),
    h('span', {}, item.buzz ? `🫵 ${who} → ${nameOf(view, item.buzz.actorId)}: ` : `🫵 ${who} buzzed!`, item.buzz?.phrase ? ruby(item.buzz.phrase) : null, item.buzz ? (item.buzz.ok ? ' ✓' : ' ✗') : null),
  );
}

function ticker(view: RoomView, game: PhraseBingoView, max: number): HTMLElement {
  const items = [...game.ticker].reverse().slice(0, max);
  return h(
    'div',
    { class: 'pb-ticker' },
    h('p', { class: 'pb-ticker-title' }, view.phase === 'answer' ? 'Live from the stage' : 'How the scene went'),
    items.length ? h('ul', {}, items.map((i) => tickerLine(view, i))) : h('p', { class: 'muted' }, view.phase === 'answer' ? 'Listen closely…' : 'Nobody slipped a phrase in.'),
  );
}

function phraseBig(p: PhraseCard): HTMLElement {
  return h(
    'div',
    { class: 'pb-big-phrase' },
    h('p', { class: 'pb-big-jp' }, ruby(p)),
    p.kana !== p.text ? h('p', { class: 'pb-big-kana', lang: 'ja' }, p.kana) : null,
    h('p', { class: 'pb-big-en' }, p.en),
  );
}

function revealActor(view: RoomView, a: ActorView): HTMLElement {
  return h(
    'div',
    { class: 'pb-reveal-actor' },
    h('p', { class: 'pb-reveal-name' }, nameOf(view, a.playerId), ' ', h('span', { class: 'pb-role', lang: 'ja' }, ruby(a.role))),
    h(
      'ul',
      {},
      (a.phrases ?? []).map((p) => {
        const status = !p.said ? 'unsaid' : p.smooth ? 'smooth' : 'caught';
        const chip = !p.said ? 'not said' : p.smooth ? '⭐ smooth' : `🎯 caught by ${p.caughtBy.map((id) => nameOf(view, id)).join(', ')}`;
        return h(
          'li',
          { class: `pb-secret pb-${status}` },
          ruby(p, { class: 'pb-secret-jp' }),
          h('span', { class: 'pb-secret-en' }, p.en),
          h('span', { class: 'pb-chip' }, chip, p.memory ? ' · from memory' : ''),
        );
      }),
    ),
  );
}

function points(view: RoomView, game: PhraseBingoView): HTMLElement | null {
  const rows = (game.scenePoints ?? []).filter((r) => r.points > 0).sort((a, b) => b.points - a.points);
  if (!rows.length) return null;
  return h('ol', { class: 'pb-points' }, rows.map((r) => h('li', {}, h('span', {}, nameOf(view, r.playerId)), h('strong', {}, `+${r.points}`))));
}

export const phraseBingoStage: StageMode<PhraseBingoView> = {
  badge(game, playerId) {
    const a = game.cast.find((x) => x.playerId === playerId);
    if (game.scenePoints) {
      const p = game.scenePoints.find((x) => x.playerId === playerId)?.points ?? 0;
      return p ? `+${p}` : '';
    }
    return a ? `🎭 ${a.said}/${a.total}` : '';
  },

  render(view, game) {
    switch (view.phase) {
      case 'intro':
        return h(
          'div',
          { class: 'pb-stage pb-intro' },
          h('p', { class: 'pb-title', lang: 'ja' }, 'フレーズビンゴ劇場'),
          h('p', { class: 'pb-subtitle' }, 'Phrase Bingo Theater'),
          h(
            'ol',
            { class: 'pb-steps' },
            h('li', {}, h('strong', {}, '🎭 Actors'), ' act out the scene, out loud, and secretly slip in the phrases on their phone.'),
            h('li', {}, h('strong', {}, '🎤 To score one,'), ' hold the button and say it into your phone as part of the scene.'),
            h('li', {}, h('strong', {}, '🫵 The audience'), ' plays bingo: heard a secret phrase? Tap it and pick who said it.'),
            h('li', {}, h('strong', {}, '⭐ Smooth'), ' phrases nobody catches score double. Caught ones pay the catcher.'),
          ),
        );
      case 'prompt':
        return h(
          'div',
          { class: 'pb-stage' },
          sceneCard(game),
          h('p', { class: 'pb-callout' }, 'Starring…'),
          castList(view, game, false),
          h('p', { class: 'hint' }, 'Actors: learn your secret lines on your phone. Audience: check your bingo card.'),
        );
      case 'answer':
        return h(
          'div',
          { class: 'pb-stage' },
          sceneCard(game, true),
          h('p', { class: 'pb-action' }, '🎬 ACTION!'),
          h('div', { class: 'pb-live' }, castList(view, game, true), ticker(view, game, 8)),
        );
      case 'reveal':
        return h(
          'div',
          { class: 'pb-stage' },
          h('p', { class: 'pb-callout' }, `${game.scene?.emoji ?? ''} The secret lines were…`),
          h('div', { class: `pb-reveal pb-reveal-${game.cast.length}` }, game.cast.map((a) => revealActor(view, a))),
        );
      case 'encore':
        return h(
          'div',
          { class: 'pb-stage pb-encore' },
          h('p', { class: 'pb-callout' }, 'Everyone, say it! せーの！'),
          game.highlight ? phraseBig(game.highlight) : null,
          h('p', { class: 'hint' }, 'Say it into your phone for a bonus.'),
          game.echoed.length ? h('p', { class: 'pb-echoed' }, `🎤 ${game.echoed.map((id) => nameOf(view, id)).join(' · ')}`) : null,
        );
      case 'score':
        return h(
          'div',
          { class: 'pb-stage pb-score' },
          game.bingos.length
            ? h('p', { class: 'pb-bingo' }, 'BINGO!', h('span', {}, game.bingos.map((id) => nameOf(view, id)).join(' · ')))
            : h('p', { class: 'pb-callout' }, 'No bingo this time'),
          h('div', { class: 'pb-live' }, points(view, game) ?? h('p', { class: 'muted' }, 'No points this scene.'), ticker(view, game, 6)),
        );
      default:
        return h('div', { class: 'pb-stage' }, sceneCard(game));
    }
  },
};
