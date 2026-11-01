// The learning path on the phone, version 2 (docs/progressive-learning.md): signed-in players who turn it on
// get a one-row strip under Start in the lobby, a "Tonight on your path" box with hanko stamps on the recap,
// a train map on My progress, and a "line cleared" card that offers to move their level up. It's all on
// their own phone: the TV and the other players see nothing new (only a wish count on the VIP's list).

import { creditable, framesOf } from '../../shared/src/japanese/frames.js';
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
  currentLine,
  missingFrames,
  SET_PHRASES,
  suggest,
  type FrameNeed,
  type FrameState,
  type Goal,
  type GoalState,
  type Line,
  type LineId,
  type PathStatus,
  type RoomFit,
} from '../../shared/src/path.js';
import { FRAME_FILLERS, FRAME_GAP_DAYS, FRAME_SAYS, recallOf, type AccountView } from '../../shared/src/progress.js';
import { PICKER_LEVELS, type Level, type ModeId } from '../../shared/src/protocol.js';

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
const frameState = (st: PathStatus, id: string): FrameState | undefined => st.frames.find((x) => x.id === id);

/** "Nov 4", from YYYY-MM-DD. */
const shortDay = (day: string): string => new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const plusDays = (day: string, n: number): string => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** Text only a screen reader reads. */
const srOnly = (text: string): HTMLElement => h('span', { class: 'sr-only' }, text);

/** The line's Japanese name, with furigana over the kanji. */
const LINE_RUBY: Record<LineId, [string, string][]> = {
  kana: [['かな', ''], ['線', 'せん']],
  local: [['各駅停車', 'かくえきていしゃ']],
  express: [['急行', 'きゅうこう']],
  limited: [['特急', 'とっきゅう']],
};
function lineJa(id: LineId): HTMLElement {
  return h('small', { lang: 'ja' }, LINE_RUBY[id].map(([t, r]) => (r ? h('ruby', {}, t, h('rt', {}, r)) : t)));
}

/** One frame's tally in words: "2 of 3 says · say it again from Nov 4 · needs a game day". */
function frameTally(f: FrameState | undefined): string | undefined {
  if (!f || !f.ready) return undefined;
  if (f.met) return f.recheck === 'fading' ? 'faded: say it once more' : 'met';
  const r = f.rule;
  if (!r || !r.firstDay) return 'not said yet';
  const parts = [`${Math.min(r.says, FRAME_SAYS)} of ${FRAME_SAYS} says`];
  if (r.fillers < FRAME_FILLERS) parts.push(`${r.fillers} of ${FRAME_FILLERS} words`);
  if (!r.spaced) parts.push(`say it again from ${shortDay(f.waitUntil ?? plusDays(r.firstDay, FRAME_GAP_DAYS))}`);
  if (!r.inGame) parts.push('needs a game day');
  return parts.join(' · ');
}

/** One frame as a chip: 「＿を ください」, its rōmaji at the Kana level, its English, and an optional tally. */
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

/** A required frame, or "one of" a few. With `st`, each chip carries its tally. */
function needChips(n: FrameNeed, level: Level, st?: PathStatus): HTMLElement {
  const chip = (id: string) => frameChip(id, level, st ? frameTally(frameState(st, id)) : undefined);
  if (typeof n === 'string') return chip(n);
  return h('span', { class: 'frame-any' }, h('small', { class: 'path-label' }, 'One of'), n.map(chip));
}

/** The 済 stamp, on the hanko art My progress already uses for caught yōkai. */
const sumiStamp = (cls = ''): HTMLElement => h('span', { class: `path-hanko ${cls}`, lang: 'ja', 'aria-label': 'Met' }, '済');

/** How a goal is met, in words: short for the lobby, in full on the map. */
function goalRule(goal: Goal, short: boolean): string {
  if (goal.kind === 'kana') return short ? 'Read 90% of the script from memory, each on 2 days.' : 'Met at 90% of the script, each kana read from memory on 2 days.';
  if (goal.kind === 'kanji') return short ? 'Read 30 kanji from memory, each on 2 days.' : 'Met at 30 kanji, each read from memory on 2 days.';
  if (goal.kind === 'set') return short ? 'Say 6 of these 8 from memory, each on 2 days.' : 'Met at 6 of these 8, each said from memory on 2 days.';
  if (short) return 'Say each one from memory 3 times, on 2 days a few days apart.';
  return 'A frame is met when you’ve said it from memory 3 times, with 2 different words in the gap, on 2 days at least 3 days apart (one of them in a game). Read, typed or tile answers don’t count.';
}

/** What a counted goal counts: "0 of 95 hiragana". */
function countText(goal: Goal, c: { have: number; need: number }): string {
  const noun = goal.kind === 'kana' ? (goal.id === 'K1' ? 'hiragana' : 'katakana') : goal.kind === 'kanji' ? 'kanji' : 'set phrases';
  return `${c.have} of ${c.need} ${noun} so far.`;
}

/** The goal's detail: why, its frames, how far along, and where to practise. `short` is the lobby's. */
function goalDetail(goal: Goal, st: PathStatus, level: Level, short = false): HTMLElement {
  const s = goalState(st, goal.id);
  const missing = missingFrames(goal);
  const tallies = !short;
  return h(
    'div',
    { class: 'path-detail' },
    h('p', { class: 'path-why' }, goal.why),
    goal.need.length ? h('div', { class: 'path-frames' }, h('small', { class: 'path-label' }, 'Say from memory'), goal.need.map((n) => needChips(n, level, tallies ? st : undefined))) : null,
    goal.also.length ? h('div', { class: 'path-frames also' }, h('small', { class: 'path-label' }, 'These count too'), goal.also.map((id) => frameChip(id, level))) : null,
    goal.kind === 'set'
      ? h(
          'ul',
          { class: 'path-set' },
          SET_PHRASES.map((p) => h('li', {}, h('span', { lang: 'ja' }, p.ja), level === 'kana' ? h('small', { class: 'frame-romaji' }, p.romaji) : null, h('small', {}, p.en))),
        )
      : null,
    h('p', { class: 'path-goal' }, goalRule(goal, short)),
    s.count ? h('p', { class: 'path-goal' }, countText(goal, s.count)) : null,
    s.waitUntil ? h('p', { class: 'path-note' }, `Resting: say it again from ${shortDay(s.waitUntil)} and it counts toward the 3-day gap.`) : null,
    missing.length ? h('p', { class: 'path-note' }, 'Coming soon: the game can’t spot ', h('span', { lang: 'ja' }, missing.map((id) => frameText(id).ja).join('、')), ' in what you say yet.') : null,
    s.recheck === 'fading' ? h('p', { class: 'path-note' }, 'This stamp’s ink is fading. Say it from memory once more and it’s fresh again.') : null,
    s.recheck === 'due' ? h('p', { class: 'path-note' }, 'Time for a return trip: one of these is waiting in your phrase review.') : null,
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

/** When nothing can be suggested: the goal resting on its 3-day gap, or the phrase review. */
function stripFallback(view: AccountView, level: Level): HTMLElement | null {
  const st = view.pathStatus;
  const line = currentLine(st, level);
  const resting = GOALS.find((x) => x.line === line.id && goalState(st, x.id).waitUntil);
  const due = view.duePhrases?.length ?? 0;
  if (!resting && !due) return null;
  const top = resting ? `Rest stop · say it again from ${shortDay(goalState(st, resting.id).waitUntil!)}` : `Phrase review · ${due} waiting`;
  const sub = resting ? `${goalLabel(resting)} · ${line.name}` : 'On My progress, between games';
  return h(
    'section',
    { class: 'path-strip', 'aria-label': 'Your learning path' },
    h('div', { class: 'path-strip-row' }, h('p', { class: 'path-strip-text static' }, h('span', { class: 'path-line-dot', 'data-line': line.id, 'aria-hidden': 'true' }), h('span', { class: 'path-strip-lines' }, h('strong', {}, top), h('small', {}, sub)))),
  );
}

/**
 * Two rows under Start: the game first ("Next stop: Last Train"), then the goal and line. The VIP gets
 * "Put it on the menu"; everyone else "♡ Wish for it". Tapping the text opens the why, the frames and a short
 * rule. The row's height is kept while the save loads, so Start doesn't jump. Null when the path is off.
 */
export function pathStrip(level: Level, room: RoomFit, opts: StripOpts): HTMLElement | null {
  const view = pathView();
  if (!view) return saved === null && loading ? h('div', { class: 'path-strip loading', 'aria-hidden': 'true' }) : null;
  const st = view.pathStatus;
  const s = suggest(st, level, room);
  if (!s) return opts.recap ? null : stripFallback(view, level);
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
        h('span', { class: 'path-strip-lines' }, h('strong', {}, `Next stop: ${info.title}`), h('small', {}, `${goalLabel(s.goal)} · ${s.line.name}`)),
        h('span', { class: 'path-chev', 'aria-hidden': 'true' }, stripOpen ? '▴' : '▾'),
      ),
      action,
    ),
    stripOpen
      ? h(
          'div',
          { class: 'path-strip-more' },
          goalDetail(s.goal, st, level, true),
          s.instead ? h('p', { class: 'path-note' }, 'The goal before this one needs a game that doesn’t fit tonight’s room. This one does.') : null,
          h('p', { class: 'path-note' }, 'Your path shows on your phone only. The whole map is on My progress.'),
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
    // Only frames that count (`creditable`): no listening-only ＿じゃん chip, and no N3 chips before N3 is on the path.
    for (const id of framesOf(e, undefined, { only: creditable })) by.set(id, (by.get(id) ?? new Set()).add(e.text));
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
    stamped.map((goal) => h('p', { class: 'path-stamped' }, sumiStamp('big'), h('span', {}, h('strong', {}, goalLabel(goal)), h('small', {}, `Station stamped on the ${LINE_BY_ID[goal.line].name}`)))),
    frames.length
      ? h(
          'ul',
          { class: 'path-tonight-frames' },
          frames.map((f) => h('li', {}, frameChip(f.id, level, `× ${f.phrases} ${f.phrases === 1 ? 'phrase' : 'phrases'}`))),
        )
      : null,
    frames.length ? h('p', { class: 'path-note' }, 'Just the ones you said from memory. Those are the ones that stick.') : null,
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

/** Each line's sign-off: what clearing it means, and the move it offers. */
const CLEARED: Record<LineId, { jlpt: string | null; move: string | null; stay: string | null; end: string | null; endEn?: string }> = {
  kana: { jlpt: null, move: 'Change to the Local Line', stay: 'Stay on the Kana Line', end: null },
  local: {
    jlpt: 'That’s the speaking side of N5, not a JLPT result: the test also checks reading, listening and many more words. A JLPT mock test will show where you stand there.',
    move: 'Change to the Express Line',
    stay: 'Stay on the Local Line',
    end: null,
  },
  express: {
    jlpt: 'That’s the speaking side of N4, not a JLPT result: the test also checks reading, listening and many more words. A JLPT mock test will show where you stand there.',
    move: 'Change to the Limited Express Line',
    stay: 'Stay on the Express Line',
    end: null,
  },
  limited: {
    jlpt: 'That’s the speaking side of some everyday N3, not a JLPT result: the test also checks reading, listening and far more words and kanji. A JLPT mock test will show where you stand there.',
    move: null,
    stay: null,
    end: '「しゅうてん、 しゅうてんです。 ごじょうしゃ ありがとう ございました。」',
    endEn: 'Last stop. Thanks for riding.',
  },
};

/**
 * "Local Line cleared": the celebration first, then what was said, a JLPT note for the N5, N4 and N3 lines,
 * and the level move offered with "stay" at the same weight. Shown once per line, on this phone only. The move
 * is never automatic, and never to a level the picker doesn't offer yet: until N3 opens, the Express card says
 * the Limited Express platform is still being built, with a single OK.
 */
export function clearedCard(level: Level, moveUp: (to: Level) => void, redraw: () => void): HTMLElement | null {
  const view = pathView();
  if (!view) return null;
  const st = view.pathStatus;
  const seen = seenClears();
  const line = LINES.find((l, i) => st.lines[i]!.cleared && !seen.includes(l.id) && l.level === level);
  if (!line) return null;
  const c = CLEARED[line.id];
  const canMove = !!line.up && PICKER_LEVELS.includes(line.up) && !!c.move && !!c.stay;
  const done = () => {
    markSeen(line.id);
    redraw();
  };
  return h(
    'section',
    { class: 'path-cleared', 'aria-label': `${line.name} cleared` },
    h('p', { class: 'path-cleared-title' }, sumiStamp('big'), h('span', {}, h('strong', {}, `${line.name} cleared!`), lineJa(line.id))),
    canMove ? h('p', { class: 'path-chochin', lang: 'ja' }, '「のりかえです！ つぎの せんへ どうぞ。」') : null,
    line.up && !canMove ? h('p', { class: 'path-chochin', lang: 'ja' }, '「とっきゅうの ホームは ただいま こうじちゅうです。」') : null,
    line.up && !canMove ? h('p', { class: 'path-note' }, 'The Limited Express platform is still being built. Its first station is already on your map.') : null,
    c.end ? h('p', { class: 'path-chochin', lang: 'ja' }, c.end) : null,
    c.endEn ? h('p', { class: 'path-note' }, c.endEn) : null,
    h('p', {}, `You’ve said this line’s sentence patterns out loud, from memory, on more than one day. So far: ${st.stats.frames} frames, ${st.stats.words} phrases from memory, ${st.stats.kanji} kanji.`),
    c.jlpt ? h('p', { class: 'path-note' }, c.jlpt) : null,
    canMove
      ? h(
          'div',
          { class: 'path-choice' },
          h('button', { type: 'button', class: 'secondary', onclick: () => (moveUp(line.up!), done()) }, c.move),
          h('button', { type: 'button', class: 'secondary', onclick: done }, c.stay),
        )
      : h('button', { type: 'button', class: 'secondary', onclick: done }, 'OK'),
  );
}

// ---- My progress: the Path tab ----

// The map: one line at a time behind a route-sign picker, solid stations for met goals, and each station's
// detail in a bottom sheet so the map never moves. The red hanko stays for the reward moments (the recap,
// the line-cleared card, and the top of a met station's sheet).

let shownLine: LineId | null = null;

/** A station's state, for screen readers and for its pill. */
function stationState(s: GoalState, isNow: boolean): string {
  const parts: string[] = [];
  if (s.met) parts.push('met');
  if (s.recheck === 'due') parts.push('return trip due');
  if (s.recheck === 'fading') parts.push('ink fading');
  if (!s.ready) parts.push('coming soon');
  if (isNow) parts.push('next stop');
  if (!s.met && s.ready) parts.push(`${pct(s.progress)}% there`);
  return parts.join(', ');
}

/** The pill at the row's end: words, so no state rests on colour alone. */
function stationPill(s: GoalState, isNow: boolean): HTMLElement | null {
  if (s.recheck === 'due') return h('span', { class: 'path-pill due', 'aria-hidden': 'true' }, '↻ Return trip');
  if (s.recheck === 'fading') return h('span', { class: 'path-pill fading', 'aria-hidden': 'true' }, 'Ink fading');
  if (isNow && !s.met) return h('span', { class: 'path-pill now', 'aria-hidden': 'true' }, '▶ Next stop');
  if (!s.ready) return h('span', { class: 'path-pill soon', 'aria-hidden': 'true' }, 'Coming soon');
  if (!s.met && s.progress > 0) return h('span', { class: 'path-pill', 'aria-hidden': 'true' }, `${pct(s.progress)}%`);
  return null;
}

/** The route sign for one line: its name, the Japanese with furigana, and how far along it is. */
function lineSign(line: Line, st: PathStatus, level: Level, on: boolean, pick: () => void): HTMLElement {
  const ls = st.lines.find((l) => l.id === line.id)!;
  const below = LINES.indexOf(line) < LINES.findIndex((l) => l.level === level);
  const due = GOALS.filter((x) => x.line === line.id && goalState(st, x.id).recheck).length;
  const count = ls.cleared ? '済 Cleared' : `${ls.met} of ${ls.of}${below ? ' · optional' : ''}`;
  return h(
    'button',
    { type: 'button', role: 'tab', class: `path-sign${on ? ' on' : ''}`, 'data-line': line.id, 'aria-selected': String(on), 'aria-controls': 'path-line-panel', id: `path-sign-${line.id}`, tabindex: on ? '0' : '-1', onclick: pick },
    h('span', { class: 'path-sign-band', 'aria-hidden': 'true' }),
    h('span', { class: 'path-sign-ja', lang: 'ja' }, LINE_RUBY[line.id].flatMap(([t, r]): (HTMLElement | string)[] => (r ? [...t].map((c, i) => h('ruby', {}, c, h('rt', {}, rubyPart(r, t, i)))) : [t]))),
    h('strong', {}, line.name.replace(' Line', '')),
    h('small', {}, count),
    due ? h('span', { class: 'path-sign-due', 'aria-label': `${due} return ${due === 1 ? 'trip' : 'trips'} due` }, `↻ ${due}`) : null,
  );
}

/** Furigana split per kanji where the reading divides evenly (各駅停車 → かく えき てい しゃ). */
const RUBY_SPLIT: Record<string, string[]> = { 各駅停車: ['かく', 'えき', 'てい', 'しゃ'], 急行: ['きゅう', 'こう'], 特急: ['とっ', 'きゅう'], 線: ['せん'] };
const rubyPart = (reading: string, text: string, i: number): string => RUBY_SPLIT[text]?.[i] ?? (i === 0 ? reading : '');

/** One line's track: a row per goal, the marker on the track, the state in words. */
function lineTrack(line: Line, st: PathStatus, current: Goal | null, open: (goal: Goal, btn: HTMLElement) => void): HTMLElement {
  const goals = GOALS.filter((x) => x.line === line.id);
  return h(
    'ol',
    { class: 'path-track', 'data-line': line.id },
    goals.map((goal) => {
      const s = goalState(st, goal.id);
      if (goal.gap) {
        return h(
          'li',
          { class: 'path-station gap' },
          h('div', { class: 'path-row static' }, h('span', { class: 'path-stop', 'aria-hidden': 'true' }), h('span', { class: 'path-stop-text' }, h('strong', {}, goal.id), h('small', {}, goal.title)), h('span', { class: 'path-pill koji', lang: 'ja' }, '工事中')),
        );
      }
      const isNow = goal === current;
      const cls = ['path-station', s.met ? 'met' : s.progress > 0 && s.ready ? 'started' : '', isNow ? 'now' : '', s.recheck ? `ring-${s.recheck}` : '', s.ready ? '' : 'soon'].filter(Boolean).join(' ');
      return h(
        'li',
        { class: cls, 'aria-current': isNow ? 'step' : null, style: `--p:${pct(s.met ? 1 : s.progress)}%` },
        h(
          'button',
          { type: 'button', class: 'path-row', 'aria-haspopup': 'dialog', 'data-goal': goal.id, onclick: (e: Event) => open(goal, e.currentTarget as HTMLElement) },
          h('span', { class: 'path-stop', 'aria-hidden': 'true' }),
          h('span', { class: 'path-stop-text' }, h('strong', {}, goal.id), h('small', {}, goal.title), srOnly(stationState(s, isNow))),
          stationPill(s, isNow),
        ),
      );
    }),
  );
}

/** A station's sheet: the stamp when met, then the detail. */
function stationSheet(): { sheet: HTMLDialogElement; show: (goal: Goal, st: PathStatus, level: Level, from: HTMLElement) => void } {
  const body = h('div', { class: 'path-sheet-body' });
  const title = h('h2', { id: 'path-sheet-title' });
  const sheet = h('dialog', { class: 'gp-sheet path-sheet', 'aria-labelledby': 'path-sheet-title' }, h('div', { class: 'gp-head' }, title, h('button', { type: 'button', class: 'gp-close', 'aria-label': 'Close', onclick: () => sheet.close() }, '✕')), body) as HTMLDialogElement;
  let back: HTMLElement | null = null;
  sheet.addEventListener('click', (e) => e.target === sheet && sheet.close());
  sheet.addEventListener('close', () => back?.isConnected && back.focus());
  const show = (goal: Goal, st: PathStatus, level: Level, from: HTMLElement) => {
    back = from;
    const s = goalState(st, goal.id);
    title.textContent = goalLabel(goal);
    body.replaceChildren(
      s.met ? h('p', { class: 'path-stamped' }, sumiStamp('big'), h('span', {}, h('strong', {}, 'Station stamped'), h('small', {}, `${LINE_BY_ID[goal.line].name}${s.metAt ? ` · ${new Date(s.metAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}`))) : '',
      goalDetail(goal, st, level),
    );
    sheet.dataset.line = goal.line;
    if (!sheet.open) sheet.showModal();
  };
  return { sheet, show };
}

/** The switch, the line picker and one line's track. */
export function pathTab(view: AccountView, level: Level, toggle: (on: boolean) => void, busy: boolean, redraw: () => void): HTMLElement {
  const on = view.path;
  const st = view.pathStatus;
  const s = suggest(st, level, null);
  const line = LINE_BY_ID[shownLine ?? s?.line.id ?? currentLine(st, level).id];
  const { sheet, show } = stationSheet();
  const pick = (id: LineId) => {
    shownLine = id;
    redraw();
    document.getElementById(`path-sign-${id}`)?.focus();
  };
  // Arrow keys move between the signs, as in any tab list.
  const onKey = (e: KeyboardEvent) => {
    const i = LINES.indexOf(line);
    const j = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : -1;
    if (j >= 0 && j < LINES.length) (e.preventDefault(), pick(LINES[j]!.id));
  };
  const ls = st.lines.find((l) => l.id === line.id)!;
  const below = LINES.indexOf(line) < LINES.findIndex((l) => l.level === level);
  const next = LINES[LINES.indexOf(line) + 1];
  return h(
    'div',
    { class: 'acct-cards path-tab' },
    h(
      'div',
      { class: 'path-switch' },
      h('p', {}, h('strong', {}, 'Learning path'), h('small', {}, 'Stations you can say from memory. Only you see it.')),
      h('button', { type: 'button', class: on ? 'secondary' : 'primary', role: 'switch', 'aria-checked': String(on), disabled: busy, onclick: () => toggle(!on) }, on ? 'Turn off' : 'Turn on'),
    ),
    h(
      'div',
      { class: `path-map${on ? '' : ' off'}` },
      h('div', { class: 'path-signs', role: 'tablist', 'aria-label': 'Lines', onkeydown: onKey as EventListener }, LINES.map((l) => lineSign(l, st, level, l === line, () => pick(l.id)))),
      h(
        'section',
        { class: 'path-line', id: 'path-line-panel', role: 'tabpanel', 'aria-labelledby': `path-sign-${line.id}`, 'data-line': line.id },
        below ? h('p', { class: 'path-note' }, 'Optional · filled in by what you’ve said') : null,
        ls.soon ? h('p', { class: 'path-note' }, `${ls.soon} ${ls.soon === 1 ? 'station opens' : 'stations open'} when the game learns to spot their sentences. They don’t count yet.`) : null,
        lineTrack(line, st, s?.goal ?? null, (goal, btn) => show(goal, st, level, btn)),
        next ? h('button', { type: 'button', class: 'path-transfer', 'data-line': next.id, onclick: () => pick(next.id) }, h('span', { lang: 'ja' }, 'のりかえ'), ` Change to the ${next.name} →`) : null,
      ),
    ),
    sheet,
  );
}
