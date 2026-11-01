// Last Train on the stage: the route, the stop and its shared situation, each traveller's
// status (never their words until the stop resolves), then everyone's answer beside the
// natural version, the penalty car, and the Platform Dash track. Mixed rooms: the Gallery's bubbles while a
// hard-role line is said, the commentary booth at its reveal, and the host stand-in's announcement.

import { h, ruby, stagger } from '../../../shared/src/dom.js';
import { icon } from '../../../shared/src/art.js';
import { signBoard } from '../../../shared/src/signBoard.js';
import type { JpText } from '../../../content/src/types.js';
import type { LastTrainView, TravellerStatus, TravellerView } from '../../../shared/src/modes/lastTrain/lastTrain.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import type { StageMode } from './types.js';
import { sfx } from '../music/sfx.js';
import { boothStrip, galleryBubbles } from '../components/mixedRoom.js';

const STATUS: Record<TravellerStatus, { icon: string; label: string }> = {
  waiting: { icon: '🧳', label: 'ready' },
  answering: { icon: '🎤', label: 'answering' },
  retry: { icon: '↻', label: 'retry' },
  correct: { icon: '✓', label: 'correct' },
  missed: { icon: '✗', label: 'missed' },
  away: { icon: '…', label: 'away' },
  penalty: { icon: '🚨', label: 'penalty car' },
  passed: { icon: '😮‍💨', label: 'survived' },
  failed: { icon: '👻', label: 'ghosted' },
  aboard: { icon: '🚃', label: 'aboard' },
  racing: { icon: '🏃', label: 'running' },
};

function route(game: LastTrainView): HTMLElement {
  return h(
    'ol',
    { class: 'lt-line' },
    game.stops.map((s, i) =>
      h(
        'li',
        { class: i < game.stopIndex ? 'done' : i === game.stopIndex ? 'here' : '' },
        h('span', { class: 'lt-dot' }),
        h('span', { class: 'lt-stop-name' }, ruby(s.name)),
        h('small', {}, s.minigame.en),
      ),
    ),
  );
}

function travellerCard(t: TravellerView, game: LastTrainView): HTMLElement {
  const st = STATUS[t.status];
  const vote = game.overrules.find((w) => w.playerId === t.playerId && w.state === 'open');
  const haunted = game.haunts.filter((x) => x.target === t.playerId).length;
  return h(
    'li',
    { class: `lt-trav s-${t.status}${t.ghost ? ' ghost' : ''}` },
    h('span', { class: 'lt-trav-icon' }, t.ghost && t.status !== 'failed' ? '👻' : st.icon),
    h('span', { class: 'lt-trav-name' }, t.name),
    h('span', { class: 'lt-trav-status' }, t.ghost ? `ghost · ${st.label}` : st.label),
    vote ? h('span', { class: 'lt-trav-vote' }, `room vote ${vote.up}/${vote.eligible} 👍`) : null,
    haunted ? h('span', { class: 'lt-trav-haunt' }, `haunted −${haunted * 2}s`) : null,
  );
}

function situation(game: LastTrainView, compact = false): HTMLElement | null {
  const stop = game.stop;
  if (!stop) return null;
  return h(
    'div',
    { class: `lt-situation${compact ? ' compact' : ''}` },
    h('p', { class: 'lt-kicker' }, `Stop ${stop.index + 1} / ${game.stops.length}${stop.isLast ? ' · 終点' : ''} · `, ruby(stop.minigame.title), ` ${stop.minigame.title.en}`),
    h('p', { class: 'lt-stopname' }, ruby(stop.name)),
    h('p', { class: 'lt-intro-jp' }, ruby(stop.minigame.intro)),
    h('p', { class: 'lt-en' }, stop.minigame.intro.en),
  );
}

function intro(game: LastTrainView): HTMLElement {
  return h(
    'div',
    { class: 'card lt-stage' },
    h('p', { class: 'lt-kicker' }, '🏮 Chōchin-san presents'),
    h('p', { class: 'prompt' }, ruby(game.title)),
    h('p', { class: 'lt-intro-jp' }, ruby(game.departure)),
    h('p', { class: 'lt-en' }, game.departure.en),
    route(game),
    h('p', { class: 'hint' }, 'Every answer is spoken. Miss twice and it’s the penalty car. Fail that and you’re a ghost.'),
  );
}

function prompt(game: LastTrainView): HTMLElement {
  const stop = game.stop;
  return h(
    'div',
    { class: 'card lt-stage' },
    route(game),
    stop ? h('p', { class: 'lt-stopname huge' }, ruby(stop.name)) : null,
    stop ? h('p', { class: 'lt-intro-jp' }, ruby(stop.announcement)) : null,
    stop ? h('p', { class: 'lt-en' }, stop.announcement.en) : null,
    stop?.isLast && game.twist ? h('div', { class: 'lt-twist' }, h('p', { class: 'lt-intro-jp' }, ruby(game.twist)), h('p', { class: 'lt-en' }, game.twist.en)) : null,
    standIn(game),
    situation(game, true),
  );
}

/** Each traveller who gets it chimes, each who misses bwomps (counted per stop, so a late screen stays quiet). */
let heard = { key: '', correct: 0, missed: 0 };
function answerSfx(game: LastTrainView): void {
  const key = JSON.stringify(game.travellers.map((t) => t.playerId ?? '')) + (game.stop?.index ?? '');
  const correct = game.travellers.filter((t) => t.status === 'correct').length;
  const missed = game.travellers.filter((t) => t.status === 'missed').length;
  if (heard.key === key) {
    if (correct > heard.correct) sfx('right');
    if (missed > heard.missed) sfx('wrong');
  }
  heard = { key, correct, missed };
}

function answer(game: LastTrainView): HTMLElement {
  answerSfx(game);
  const done = game.travellers.filter((t) => t.status === 'correct' || t.status === 'missed').length;
  return h(
    'div',
    { class: 'card lt-stage' },
    situation(game),
    h('p', { class: 'hint' }, `Each phone has its own question · ${done} / ${game.travellers.length} done`),
    h('ul', { class: 'lt-travs' }, game.travellers.map((t) => travellerCard(t, game))),
    galleryBubbles(game.gallery ?? []),
  );
}

/** The host stand-in: Chōchin-san takes his own megaphone, subtitled, as he says it (once a game). */
function standIn(game: LastTrainView): HTMLElement | null {
  const si = game.standIn;
  if (!si) return null;
  return h(
    'div',
    { class: 'lt-stand-in', style: `animation-delay:${si.atMs}ms` },
    h('p', { class: 'booth-tag' }, '📢 Chōchin-san takes the megaphone'),
    h('p', { class: 'booth-line', lang: 'ja' }, '「', ruby(si.line), '」'),
    h('p', { class: 'booth-note' }, si.line.en),
  );
}

/** The commentary booth: it lights up as Chōchin-san says the taken role's line. */
function booth(game: LastTrainView): HTMLElement | null {
  const b = game.booth;
  if (!b) return null;
  return h('div', { class: 'lt-booth', style: `animation-delay:${b.atMs}ms` }, boothStrip(b, b.name, b.holdKey));
}

const OUTCOME: Record<string, string> = { first: '✓', retry: '✓ retry', overruled: '🙌 room overrule', missed: '✗', away: 'away' };

function reveal(game: LastTrainView): HTMLElement {
  const rows = game.results ?? [];
  return h(
    'div',
    { class: 'card lt-stage' },
    situation(game, true),
    h(
      'ul',
      // Four or more riders sit two to a row, so the whole stop fits the TV without shrinking.
      { class: `lt-results${rows.length >= 4 ? ' two-up' : ''}` },
      // Rows pull in one at a time, like carriages.
      stagger(
        rows.map((r) =>
          h(
            'li',
            { class: `o-${r.outcome}` },
            h('span', { class: 'lt-r-name' }, r.ghost ? `👻 ${r.name}` : r.name, r.role ? h('small', { class: 'lt-r-role' }, '⭐ ', ruby(r.role)) : null),
            h('span', { class: 'lt-r-q' }, r.signs?.length ? signBoard(r.signs, { small: true, outline: true }) : null, ruby(r.prompt)),
            h('span', { class: 'lt-r-said', lang: 'ja' }, r.said ? `“${r.said}”` : '—'),
            h('span', { class: 'lt-r-model' }, ruby(r.model), h('small', {}, ` ${r.model.en}`)),
            h('span', { class: 'lt-r-out' }, OUTCOME[r.outcome] ?? '', r.points ? ` +${r.points}` : ''),
          ),
        ),
        450,
      ),
    ),
    booth(game),
    galleryBubbles(game.gallery ?? []),
  );
}

function penalty(game: LastTrainView): HTMLElement {
  const p = game.penalty;
  return h(
    'div',
    { class: 'card lt-stage lt-penalty-car' },
    h('p', { class: 'prompt' }, '🚨 Penalty car'),
    p?.minigames.length ? h('p', { class: 'lt-intro-jp' }, p.minigames.flatMap((m, i) => [i ? ' · ' : '', ruby(m), ` ${m.en}`])) : null,
    h('p', { class: 'hint' }, 'Get it right or ride the rest of the line as a ghost.'),
    h(
      'ul',
      { class: 'lt-results' },
      (p?.rows ?? []).map((r) =>
        h(
          'li',
          { class: `o-${r.status}` },
          h('span', { class: 'lt-r-name' }, r.name),
          h('span', { class: 'lt-r-out' }, r.status === 'answering' ? '🎤 answering…' : r.status === 'passed' ? '😮‍💨 survived' : '👻 ghosted'),
          r.said ? h('span', { class: 'lt-r-said', lang: 'ja' }, `“${r.said}”`) : null,
          r.model ? h('span', { class: 'lt-r-model' }, ruby(r.model), h('small', {}, ` ${r.model.en}`)) : null,
        ),
      ),
    ),
  );
}

function dash(view: RoomView, game: LastTrainView): HTMLElement {
  const d = game.dash;
  if (!d) return h('div', { class: 'card' });
  const span = d.track - d.ghostStart;
  // Lane positions as a % of the lane, leaving room for the runner at the start and the door.
  const at = (pos: number) => 4 + ((pos - d.ghostStart) / span) * 86;
  return h(
    'div',
    { class: 'card lt-stage' },
    h('p', { class: 'prompt' }, '🏃 Platform Dash!'),
    view.phase === 'score' && game.twist ? h('p', { class: 'lt-en' }, game.twist.en) : h('p', { class: 'hint' }, 'Answer out loud to run. First aboard wins. Ghosts start further back.'),
    h(
      'ul',
      { class: 'lt-track' },
      d.racers.map((r) =>
        h(
          'li',
          { class: r.ghost ? 'ghost' : '', 'data-key': r.playerId },
          h('span', { class: 'lt-lane-name' }, r.name),
          h(
            'span',
            { class: 'lt-lane' },
            h('span', { class: 'lt-start', style: `left:${at(0)}%` }),
            h('span', { class: 'lt-runner', style: `left:${at(Math.min(d.track, r.pos))}%` }, r.aboard !== null ? icon('lt-train', '🚃', 'lt-runner-pic') : r.ghost ? '👻' : '🏃'),
            icon('lt-door', '🚪', 'lt-door'),
          ),
          h('span', { class: 'lt-lane-rank' }, r.aboard !== null ? `#${r.aboard}` : ''),
        ),
      ),
    ),
    d.results
      ? h(
          'ol',
          { class: 'standings' },
          d.results.map((r) => h('li', {}, h('span', {}, `${r.rank ? `#${r.rank} ` : ''}${r.name}`), h('span', {}, `+${r.points}`))),
        )
      : null,
  );
}

export const lastTrainStage: StageMode<LastTrainView> = {
  badge(game, id) {
    const t = game.travellers.find((x) => x.playerId === id);
    if (!t) return '';
    return `${t.ghost ? '👻' : ''}${t.status === 'waiting' ? '' : STATUS[t.status].icon}`;
  },

  render(view, game) {
    switch (view.phase) {
      case 'intro':
        return intro(game);
      case 'prompt':
        return prompt(game);
      case 'answer':
        return answer(game);
      case 'reveal':
        return reveal(game);
      case 'penalty':
        return penalty(game);
      case 'finale':
      case 'score':
        return dash(view, game);
      default:
        return h('div', { class: 'card' }, h('p', { class: 'big' }, '🏮'));
    }
  },
};
