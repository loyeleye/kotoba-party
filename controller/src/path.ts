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
import { FRAME_FILLERS, FRAME_GAP_DAYS, FRAME_SAYS, phraseFrames, recallOf, type AccountView } from '../../shared/src/progress.js';
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
const CLEARED: Record<LineId, { jlpt: string | null; move: string | null; stay: string | null; end: string | null }> = {
  kana: { jlpt: null, move: 'Change to the Local Line', stay: 'Stay on the Kana Line', end: null },
  local: {
    jlpt: 'That’s the speaking side of N5, not a JLPT result: the test also checks reading, listening and many more words. A JLPT mock test will show where you stand there.',
    move: 'Change to the Express Line',
    stay: 'Stay on the Local Line',
    end: null,
  },
  express: {
    jlpt: 'That’s the speaking side of N4, not a JLPT result: the test also checks reading, listening and many more words. A JLPT mock test will show where you stand there.',
    move: null,
    stay: null,
    end: 'しゅうてん。 Thanks for riding.',
  },
};

/**
 * "Local Line cleared": the celebration first, then what was said, a JLPT note for the N5 and N4 lines, and
 * the level move offered with "stay" at the same weight. Shown once per line, on this phone only. The move
 * is never automatic.
 */
export function clearedCard(level: Level, moveUp: (to: Level) => void, redraw: () => void): HTMLElement | null {
  const view = pathView();
  if (!view) return null;
  const st = view.pathStatus;
  const seen = seenClears();
  const line = LINES.find((l, i) => st.lines[i]!.cleared && !seen.includes(l.id) && l.level === level);
  if (!line) return null;
  const c = CLEARED[line.id];
  const done = () => {
    markSeen(line.id);
    redraw();
  };
  return h(
    'section',
    { class: 'path-cleared', 'aria-label': `${line.name} cleared` },
    h('p', { class: 'path-cleared-title' }, sumiStamp('big'), h('span', {}, h('strong', {}, `${line.name} cleared!`), lineJa(line.id))),
    line.up ? h('p', { class: 'path-chochin', lang: 'ja' }, '「のりかえです！ つぎの せんへ どうぞ。」') : null,
    c.end ? h('p', { class: 'path-chochin', lang: 'ja' }, c.end) : null,
    h('p', {}, `You’ve said this line’s sentence patterns out loud, from memory, on more than one day. So far: ${st.stats.frames} frames, ${st.stats.words} phrases from memory, ${st.stats.kanji} kanji.`),
    c.jlpt ? h('p', { class: 'path-note' }, c.jlpt) : null,
    line.up && c.move && c.stay
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

let openStation: string | null = null;

/** A station's state, for screen readers (the map shows it with stamps, rings and colour). */
function stationState(s: GoalState, isNow: boolean): string {
  const parts: string[] = [];
  if (s.met) parts.push('met');
  if (s.recheck === 'due') parts.push('due for its return trip');
  if (s.recheck === 'fading') parts.push('ink fading');
  if (!s.ready) parts.push('coming soon');
  if (isNow) parts.push('next stop');
  if (!s.met && s.ready) parts.push(`${pct(s.progress)}% there`);
  return parts.join(', ');
}

/**
 * One line on the map: a track with one station per goal. A gap goal shows as 工事中 (under construction),
 * not counted. Lines below the player's level are muted: optional, filled in by what they've said.
 */
function lineMap(line: Line, st: PathStatus, level: Level, current: Goal | null, redraw: () => void): HTMLElement {
  const goals = GOALS.filter((x) => x.line === line.id);
  const ls = st.lines.find((l) => l.id === line.id)!;
  const below = LINES.indexOf(line) < LINES.findIndex((l) => l.level === level);
  const count = ls.cleared ? 'Cleared' : `${ls.met} of ${ls.of} met`;
  return h(
    'section',
    { class: `path-line${below ? ' below' : ''}`, 'data-line': line.id, 'aria-label': `${line.name}: ${count}${ls.soon ? `, ${ls.soon} coming soon` : ''}` },
    h('h3', {}, h('span', { class: 'path-line-dot', 'data-line': line.id, 'aria-hidden': 'true' }), line.name, ' ', lineJa(line.id), h('small', { class: 'path-line-n' }, count)),
    below ? h('p', { class: 'path-note' }, 'Optional · filled in by what you’ve said') : null,
    h(
      'ol',
      { class: 'path-track' },
      goals.map((goal) => {
        const s = goalState(st, goal.id);
        if (goal.gap) {
          return h(
            'li',
            { class: 'path-station gap' },
            h('div', { class: 'path-station-static' }, h('span', { class: 'path-stop', 'aria-hidden': 'true' }), h('span', { class: 'path-stop-text' }, h('strong', {}, goal.id), h('small', {}, goal.title), h('small', { class: 'path-koji', lang: 'ja' }, '工事中')), h('small', { class: 'path-note' }, 'Under construction: no game uses these yet, so it isn’t counted.')),
          );
        }
        const isNow = goal === current;
        const isOpen = openStation === goal.id;
        const detailId = `path-detail-${goal.id.replace('.', '-')}`;
        const cls = ['path-station', s.met ? 'met' : '', isNow ? 'now' : '', s.recheck ? `ring-${s.recheck}` : '', s.ready ? '' : 'soon', isOpen ? 'open' : ''].filter(Boolean).join(' ');
        return h(
          'li',
          { class: cls, 'aria-current': isNow ? 'step' : null },
          h(
            'button',
            {
              type: 'button',
              'aria-expanded': String(isOpen),
              'aria-controls': detailId,
              'data-goal': goal.id,
              onclick: () => {
                openStation = isOpen ? null : goal.id;
                redraw();
                // The redraw rebuilds the page: keep focus on this station, and bring its detail into view.
                const btn = document.querySelector<HTMLElement>(`.path-station button[data-goal="${goal.id}"]`);
                btn?.focus();
                if (!isOpen) document.getElementById(detailId)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
              },
            },
            h('span', { class: 'path-stop', 'aria-hidden': 'true' }, s.met ? sumiStamp() : null),
            h('span', { class: 'path-stop-text' }, h('strong', {}, goal.id), h('small', {}, goal.title), !s.met && s.ready && s.progress > 0 ? h('small', { class: 'path-pct', 'aria-hidden': 'true' }, `${pct(s.progress)}%`) : null, srOnly(stationState(s, isNow))),
            isNow && !s.met ? h('span', { class: 'path-bar', 'aria-hidden': 'true' }, h('i', { style: `width:${pct(s.progress)}%` })) : null,
          ),
          isOpen ? h('div', { class: 'path-station-detail', id: detailId }, goalDetail(goal, st, level)) : null,
        );
      }),
    ),
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
        h('small', {}, 'Ride three train lines, Kana → N5 → N4. Each station is something you can say from memory, and your phone suggests the game that gets you there. Only you see it; the TV and the game stay the same for everyone.'),
      ),
      h('button', { type: 'button', class: on ? 'secondary' : 'primary', role: 'switch', 'aria-checked': String(on), disabled: busy, onclick: () => toggle(!on) }, on ? 'Turn off' : 'Turn on'),
    ),
    h(
      'div',
      { class: `path-map${on ? '' : ' off'}` },
      LINES.map((line) => lineMap(line, st, level, s?.goal ?? null, redraw)),
      h(
        'ul',
        { class: 'path-legend', 'aria-label': 'Key' },
        h('li', {}, sumiStamp(), ' met'),
        h('li', {}, h('span', { class: 'path-key now', 'aria-hidden': 'true' }), ' next stop'),
        h('li', {}, h('span', { class: 'path-key due', 'aria-hidden': 'true' }), ' return trip due'),
        h('li', {}, h('span', { class: 'path-key fading', 'aria-hidden': 'true' }), ' ink fading'),
        h('li', {}, h('span', { class: 'path-key soon', 'aria-hidden': 'true' }), ' coming soon'),
      ),
    ),
  );
}
