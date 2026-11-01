// The learning path on the phone, version 2 (docs/progressive-learning.md): signed-in players who turn it on
// get a one-row strip under Start in the lobby, a "Tonight on your path" box with hanko stamps on the recap,
// a train map on My progress, and a "line cleared" card that offers to move their level up. It's all on
// their own phone: the TV and the other players see nothing new (only a wish count on the VIP's list).

import { h } from '../../shared/src/dom.js';
import { MODES } from '../../shared/src/modes/registry.js';
import type { PhraseEntry } from '../../shared/src/modes/mode.js';
import {
  frameReady,
  frameText,
  goalLabel,
  GOAL_BY_ID,
  GOALS,
  LINE_BY_ID,
  LINES,
  missingFrames,
  SET_PHRASES,
  suggest,
  type FrameNeed,
  type Goal,
  type GoalState,
  type Line,
  type LineId,
  type PathStatus,
  type RoomFit,
} from '../../shared/src/path.js';
import { phraseFrames, recallOf, type AccountView } from '../../shared/src/progress.js';
import type { Level, ModeId } from '../../shared/src/protocol.js';

// ---- the phone's copy of the save, for the lobby and the recap ----

let saved: AccountView | null = null;
let loading = false;

/** The save as last loaded, when the path is on. */
export const pathView = (): AccountView | null => (saved?.path && saved.pathStatus ? saved : null);

/** Keeps the lobby's copy in step with My progress (after the switch, or a review). */
export function setPathView(view: AccountView | null): void {
  saved = view;
}

/**
 * Loads the save for the lobby and recap. `fetchMe` is account.ts's signed-in GET; null when signed out.
 * Calls `done` when something changed, so the screen can redraw.
 */
export async function loadPathView(fetchMe: (() => Promise<AccountView | null>) | null, done: () => void): Promise<void> {
  if (!fetchMe) {
    if (saved) (saved = null), done();
    return;
  }
  if (loading) return;
  loading = true;
  try {
    const view = await fetchMe();
    const changed = view?.path !== saved?.path || view?.games[0]?.at !== saved?.games[0]?.at || JSON.stringify(view?.pathStatus) !== JSON.stringify(saved?.pathStatus);
    saved = view;
    if (changed) done();
  } catch {
    /* offline: keep what we had */
  } finally {
    loading = false;
  }
}

/** What the lobby and recap draw from the path, so a redraw happens only when it changes. */
export function pathKey(): string {
  const v = pathView();
  return v ? `${v.games[0]?.at ?? 0}:${v.pathStatus.goals.map((x) => `${x.met ? 1 : 0}${x.recheck ?? ''}${Math.round(x.progress * 20)}`).join('')}:${stripOpen}` : '';
}

// ---- small pieces ----

const pct = (x: number): number => Math.round(x * 100);
const goalState = (st: PathStatus, id: string): GoalState => st.goals.find((x) => x.id === id)!;

/** One frame as a chip: 「＿を ください」, its rōmaji at the Kana level, and its English. */
function frameChip(id: string, level: Level, extra?: string): HTMLElement {
  const f = frameText(id);
  return h(
    'span',
    { class: `frame-chip${frameReady(id) ? '' : ' soon'}` },
    h('span', { class: 'frame-ja', lang: 'ja' }, f.ja),
    level === 'kana' ? h('small', { class: 'frame-romaji' }, f.romaji) : null,
    h('small', {}, f.en),
    extra ? h('small', { class: 'frame-n' }, extra) : null,
  );
}

/** A required frame, or "one of" a few. */
function needChips(n: FrameNeed, level: Level): HTMLElement {
  if (typeof n === 'string') return frameChip(n, level);
  return h('span', { class: 'frame-any' }, h('small', {}, 'One of:'), n.map((id) => frameChip(id, level)));
}

/** The 済 stamp, on the hanko art My progress already uses for caught yōkai. */
const sumiStamp = (cls = ''): HTMLElement => h('span', { class: `path-hanko ${cls}`, lang: 'ja', 'aria-label': 'Met' }, '済');

/** How a goal is met, in words. */
function goalRule(goal: Goal): string {
  if (goal.kind === 'kana') return 'Met at 90% of the script, each kana read from memory on 2 days.';
  if (goal.kind === 'kanji') return 'Met at 30 kanji, each read from memory on 2 days.';
  if (goal.kind === 'set') return 'Met at 6 of these 8, each said from memory on 2 days.';
  return 'A frame is met when you’ve said it from memory 3 times, with 2 different words in the gap, on 2 days at least 3 days apart (one of them in a game). Read, typed or tile answers don’t count.';
}

/** The goal's detail: why, its frames, how far along, and where to practise. */
function goalDetail(goal: Goal, st: PathStatus, level: Level): HTMLElement {
  const s = goalState(st, goal.id);
  const missing = missingFrames(goal);
  return h(
    'div',
    { class: 'path-detail' },
    h('p', { class: 'path-why' }, goal.why),
    goal.need.length ? h('div', { class: 'path-frames' }, h('small', { class: 'path-label' }, 'Say from memory'), goal.need.map((n) => needChips(n, level))) : null,
    goal.also.length ? h('div', { class: 'path-frames also' }, h('small', { class: 'path-label' }, 'These count too'), goal.also.map((id) => frameChip(id, level))) : null,
    goal.kind === 'set'
      ? h(
          'ul',
          { class: 'path-set' },
          SET_PHRASES.map((p) => h('li', {}, h('span', { lang: 'ja' }, p.ja), level === 'kana' ? h('small', { class: 'frame-romaji' }, p.romaji) : null, h('small', {}, p.en))),
        )
      : null,
    h('p', { class: 'path-goal' }, goalRule(goal)),
    s.count ? h('p', { class: 'path-goal' }, `${s.count.have} of ${s.count.need} so far.`) : null,
    missing.length ? h('p', { class: 'path-note' }, 'Coming soon: the game can’t spot ', h('span', { lang: 'ja' }, missing.map((id) => frameText(id).ja).join('、')), ' in what you say yet.') : null,
    s.recheck === 'fading' ? h('p', { class: 'path-note' }, 'You missed this in its 3-week check. Say it from memory again and the ring goes.') : null,
    s.recheck === 'due' ? h('p', { class: 'path-note' }, 'Due for its 3-week check: it’s in your phrase review.') : null,
    goal.thin ? h('p', { class: 'path-note' }, goal.thin) : null,
    goal.games.length ? h('p', { class: 'path-games' }, 'Practise in: ', goal.games.filter((m, i, a) => a.indexOf(m) === i && m !== 'bento-haus-vs').map((m) => MODES[m].info.title).join(', ')) : null,
  );
}

// ---- the lobby strip ----

let stripOpen = false;

export interface StripOpts {
  isVip: boolean;
  /** Recap: the strip only, no pick or wish button. */
  recap?: boolean;
  /** The game on the VIP's menu, and this phone's wish. */
  picked?: ModeId | null;
  wish?: ModeId | null;
  pick: (mode: ModeId) => void;
  setWish: (mode: ModeId | null) => void;
  redraw: () => void;
}

/**
 * One row under Start: `Local Line · 5.4 Find your way · Last Train`. The VIP gets a small "Put it on the
 * menu"; everyone else "♡ Wish for it". Tapping the row opens the why, the frames and the goal. The row's
 * height is kept while the save loads, so Start doesn't jump. Null when the path is off.
 */
export function pathStrip(level: Level, room: RoomFit, opts: StripOpts): HTMLElement | null {
  const view = pathView();
  if (!view) return saved === null && loading ? h('div', { class: 'path-strip loading', 'aria-hidden': 'true' }) : null;
  const st = view.pathStatus;
  const s = suggest(st, level, room);
  if (!s) return null;
  const info = MODES[s.mode].info;
  const action = opts.recap
    ? null
    : opts.isVip
      ? opts.picked === s.mode
        ? h('span', { class: 'path-done' }, '✓ On the menu')
        : h('button', { type: 'button', class: 'path-act', onclick: () => opts.pick(s.mode) }, 'Put it on the menu')
      : h(
          'button',
          { type: 'button', class: `path-act${opts.wish === s.mode ? ' on' : ''}`, 'aria-pressed': String(opts.wish === s.mode), onclick: () => opts.setWish(opts.wish === s.mode ? null : s.mode) },
          opts.wish === s.mode ? '♥ Wished' : '♡ Wish for it',
        );
  const toggle = () => {
    stripOpen = !stripOpen;
    opts.redraw();
  };
  return h(
    'section',
    { class: `path-strip${stripOpen ? ' open' : ''}`, 'aria-label': 'Your learning path' },
    h(
      'div',
      { class: 'path-strip-row' },
      h(
        'button',
        { type: 'button', class: 'path-strip-text', 'aria-expanded': String(stripOpen), onclick: toggle },
        h('span', { class: 'path-line-dot', 'data-line': s.line.id, 'aria-hidden': 'true' }),
        h('span', {}, `${s.line.name} · ${goalLabel(s.goal)} · ${info.title}`),
      ),
      action,
    ),
    stripOpen
      ? h(
          'div',
          { class: 'path-strip-more' },
          goalDetail(s.goal, st, level),
          s.instead ? h('p', { class: 'path-note' }, 'The goal before this one needs a game that doesn’t fit tonight’s room. This one does.') : null,
          h('p', { class: 'path-note' }, 'Your path shows on your phone only.'),
        )
      : null,
  );
}

/** The wish count on a game in the VIP's list: ♡ 2, no names. */
export const wishBadge = (n: number | undefined): HTMLElement | null => (n ? h('span', { class: 'gp-wish', 'aria-label': `${n} ${n === 1 ? 'player wishes' : 'players wish'} for it` }, `♡ ${n}`) : null);

// ---- the recap ----

/** Frames said from memory tonight: each once, with how many different phrases used it. */
export function tonightFrames(phrasebook: readonly PhraseEntry[], mode: ModeId): { id: string; phrases: number }[] {
  const by = new Map<string, Set<string>>();
  for (const e of phrasebook) {
    if (e.outcome !== 'said' || recallOf(e, mode) !== 'memory') continue;
    for (const id of phraseFrames(e)) by.set(id, (by.get(id) ?? new Set()).add(e.text));
  }
  return [...by].map(([id, set]) => ({ id, phrases: set.size }));
}

/**
 * "Tonight on your path", above the phrasebook: each frame said from memory, once, with a count, and a
 * hanko for every goal met tonight. Null when the path is off or nothing counted.
 */
export function tonightBox(phrasebook: readonly PhraseEntry[], mode: ModeId, level: Level): HTMLElement | null {
  const view = pathView();
  if (!view) return null;
  const frames = tonightFrames(phrasebook, mode);
  const since = view.games[0]?.mode === mode ? view.games[0].at : Infinity;
  const stamped = view.pathStatus.goals.filter((x) => x.metAt !== null && x.metAt >= since).map((x) => GOAL_BY_ID[x.id]!);
  if (!frames.length && !stamped.length) return null;
  return h(
    'section',
    { class: 'path-tonight', 'aria-label': 'Tonight on your path' },
    h('h3', {}, 'Tonight on your path'),
    stamped.map((goal) => h('p', { class: 'path-stamped' }, sumiStamp('big'), h('span', {}, h('strong', {}, goalLabel(goal)), h('small', {}, `${LINE_BY_ID[goal.line].name}: goal met`)))),
    frames.length
      ? h(
          'ul',
          { class: 'path-tonight-frames' },
          frames.map((f) => h('li', {}, frameChip(f.id, level, `× ${f.phrases} ${f.phrases === 1 ? 'phrase' : 'phrases'}`))),
        )
      : h('p', { class: 'path-note' }, 'No frames said from memory tonight.'),
    frames.length ? h('p', { class: 'path-note' }, 'Said from memory only. Lines read off the screen don’t count.') : null,
  );
}

// ---- line cleared ----

const SEEN_KEY = 'kotoba:path:cleared';

function seenClears(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

function markSeen(id: LineId): void {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...new Set([...seenClears(), id])]));
  } catch {
    /* private window: it shows again next time */
  }
}

/**
 * "Local Line cleared": the frames, words and kanji used, a JLPT mock test for reading and listening, and the
 * level move offered with Not yet at the same weight. Shown once per line, on this phone only.
 */
export function clearedCard(level: Level, moveUp: (to: Level) => void, redraw: () => void): HTMLElement | null {
  const view = pathView();
  if (!view) return null;
  const st = view.pathStatus;
  const seen = seenClears();
  const line = LINES.find((l, i) => st.lines[i]!.cleared && !seen.includes(l.id) && l.level === level);
  if (!line) return null;
  const done = () => {
    markSeen(line.id);
    redraw();
  };
  return h(
    'section',
    { class: 'path-cleared', 'aria-label': `${line.name} cleared` },
    h('p', { class: 'path-cleared-title' }, sumiStamp('big'), h('span', {}, h('strong', {}, `${line.name} cleared`), h('small', { lang: 'ja' }, line.ja))),
    h('p', {}, `You’ve said this level’s core sentence patterns out loud, from memory, on more than one day. So far: ${st.stats.frames} frames, ${st.stats.words} phrases from memory, ${st.stats.kanji} kanji.`),
    h('p', { class: 'path-note' }, 'That’s the speaking side of the level, not a JLPT result: the test also checks reading, listening and many more words. A free mock test will show where you stand.'),
    line.up
      ? h(
          'div',
          { class: 'path-choice' },
          h('button', { type: 'button', class: 'secondary', onclick: () => (moveUp(line.up!), done()) }, 'Move me up'),
          h('button', { type: 'button', class: 'secondary', onclick: done }, 'Not yet'),
        )
      : h('button', { type: 'button', class: 'secondary', onclick: done }, 'OK'),
  );
}

// ---- My progress: the Path tab ----

let openStation: string | null = null;

/** One line on the map: a track with one station per visible goal. */
function lineMap(line: Line, st: PathStatus, level: Level, current: Goal | null, redraw: () => void): HTMLElement {
  const goals = GOALS.filter((x) => x.line === line.id && !x.gap);
  const ls = st.lines.find((l) => l.id === line.id)!;
  const open = goals.find((x) => x.id === openStation);
  return h(
    'section',
    { class: 'path-line', 'data-line': line.id, 'aria-label': `${line.name}: ${ls.met} of ${ls.of} goals met` },
    h('h3', {}, h('span', { class: 'path-line-dot', 'data-line': line.id, 'aria-hidden': 'true' }), line.name, ' ', h('small', { lang: 'ja' }, line.ja), h('small', { class: 'path-line-n' }, ls.cleared ? 'Cleared' : `${ls.met} of ${ls.of}`)),
    h(
      'ol',
      { class: 'path-track' },
      goals.map((goal) => {
        const s = goalState(st, goal.id);
        const isNow = goal === current;
        const cls = ['path-station', s.met ? 'met' : '', isNow ? 'now' : '', s.recheck ? `ring-${s.recheck}` : '', s.ready ? '' : 'soon', openStation === goal.id ? 'open' : ''].filter(Boolean).join(' ');
        return h(
          'li',
          { class: cls },
          h(
            'button',
            {
              type: 'button',
              'aria-expanded': String(openStation === goal.id),
              'data-goal': goal.id,
              onclick: () => {
                openStation = openStation === goal.id ? null : goal.id;
                redraw();
                // The redraw rebuilds the page: keep focus on this station.
                document.querySelector<HTMLElement>(`.path-station button[data-goal="${goal.id}"]`)?.focus();
              },
            },
            h('span', { class: 'path-stop', 'aria-hidden': 'true' }, s.met ? sumiStamp() : null),
            h('span', { class: 'path-stop-text' }, h('strong', {}, goal.id), h('small', {}, goal.title)),
            isNow && !s.met ? h('span', { class: 'path-bar', role: 'progressbar', 'aria-valuenow': String(pct(s.progress)), 'aria-valuemin': '0', 'aria-valuemax': '100' }, h('i', { style: `width:${pct(s.progress)}%` })) : null,
          ),
        );
      }),
    ),
    open ? h('div', { class: 'path-station-detail' }, h('p', {}, h('strong', {}, goalLabel(open))), goalDetail(open, st, level)) : null,
  );
}

/** The switch and the train map: three lines, a station per goal, 済 for met, a ring for the 3-week check. */
export function pathTab(view: AccountView, level: Level, toggle: (on: boolean) => void, busy: boolean, redraw: () => void): HTMLElement {
  const on = view.path;
  const st = view.pathStatus;
  const s = suggest(st, level, null);
  return h(
    'div',
    { class: 'acct-cards path-tab' },
    h(
      'div',
      { class: 'path-switch' },
      h(
        'p',
        {},
        h('strong', {}, 'Learning path'),
        h('small', {}, 'Three lines, Kana → N5 → N4, of things to say from memory. Your phone suggests what to play next. It shows on your phone only; the TV and the game stay the same for everyone.'),
      ),
      h('button', { type: 'button', class: on ? 'secondary' : 'primary', role: 'switch', 'aria-checked': String(on), disabled: busy, onclick: () => toggle(!on) }, on ? 'Turn off' : 'Turn on'),
    ),
    h(
      'div',
      { class: `path-map${on ? '' : ' off'}` },
      LINES.map((line) => lineMap(line, st, level, s?.goal ?? null, redraw)),
      h('p', { class: 'path-legend' }, sumiStamp(), ' met · ', h('span', { class: 'path-ring-key', 'aria-hidden': 'true' }), ' due for its 3-week check, or faded'),
    ),
  );
}
