// The learning path on the phone (docs/progressive-learning.md): signed-in players who turn it on get
// a "next on your path" card in the lobby and the recap, frame chips on their recap phrasebook, and a
// Path tab on My progress. It's all on their own phone: the TV and the other players see nothing new,
// and the game itself doesn't change.

import { h } from '../../shared/src/dom.js';
import { FRAME_BY_ID, FRAMES, frameOf } from '../../shared/src/japanese/frames.js';
import { toRomaji } from '../../shared/src/japanese/romaji.js';
import { MODES } from '../../shared/src/modes/registry.js';
import { factsOf, stepFrames, stepsFor, suggest, type RoomFit } from '../../shared/src/path.js';
import type { AccountView } from '../../shared/src/progress.js';
import type { Level, ModeId } from '../../shared/src/protocol.js';

// ---- the phone's copy of the save, for the lobby and the recap ----

let saved: AccountView | null = null;
let loading = false;

/** The save as last loaded, when the path is on. */
export const pathView = (): AccountView | null => (saved?.path ? saved : null);

/** Keeps the lobby's copy in step with My progress (after the switch, or a review). */
export function setPathView(view: AccountView | null): void {
  saved = view;
}

/**
 * Loads the save for the lobby and recap cards. `fetchMe` is account.ts's signed-in GET; null when
 * signed out. Calls `done` when something changed, so the screen can redraw.
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
    const changed = JSON.stringify(view?.path) !== JSON.stringify(saved?.path) || view?.games[0]?.at !== saved?.games[0]?.at || view?.frames.length !== saved?.frames.length;
    saved = view;
    if (changed) done();
  } catch {
    /* offline: keep what we had */
  } finally {
    loading = false;
  }
}

// ---- the lobby and recap card ----

/**
 * "Next on your path": the game, why, and the frames it practises. The VIP can pick it straight onto the
 * menu; anyone else can ask for it. Null when the path is off or has nothing to say.
 */
export function nextCard(level: Level, room: RoomFit, opts: { isVip: boolean; pick: (mode: ModeId) => void; picked?: ModeId | null }): HTMLElement | null {
  const view = pathView();
  if (!view) return null;
  const s = suggest(factsOf(view, level), room);
  if (!s) return null;
  const info = MODES[s.mode].info;
  const first = s.step && s.instead ? stepsFor(level).find((st) => st.progress(factsOf(view, level)) < 1) : null;
  return h(
    'section',
    { class: 'path-next', 'aria-label': 'Next on your learning path' },
    h('p', { class: 'path-kicker' }, s.step ? `Your learning path · step ${s.done + 1} of ${s.of}` : 'Learning path done · keep it fresh'),
    h('p', { class: 'path-game' }, h('strong', {}, info.title), ' ', level === 'kana' ? h('span', { lang: 'ja' }, info.titleKana ?? info.titleJa) : h('span', { lang: 'ja' }, info.titleJa)),
    s.step ? h('p', { class: 'path-step' }, s.step.title) : null,
    h('p', { class: 'path-why' }, s.why),
    s.step?.frames.length ? h('ul', { class: 'path-frames' }, stepFrames(s.step).map((f) => h('li', {}, h('span', { lang: 'ja' }, f.ja), h('small', {}, f.en)))) : null,
    first ? h('p', { class: 'path-note' }, `${MODES[first.mode].info.title} comes first, but it doesn’t fit tonight’s room. This one does.`) : null,
    s.step ? h('p', { class: 'path-goal' }, `Done when: ${s.step.goal.toLowerCase()}.`) : null,
    opts.isVip
      ? opts.picked === s.mode
        ? h('p', { class: 'path-note' }, '✓ On the menu. Press Start when everyone’s ready.')
        : h('button', { type: 'button', class: 'secondary path-pick', onclick: () => opts.pick(s.mode) }, `Put ${info.title} on the menu`)
      : h('p', { class: 'path-note' }, 'Fancy it? Ask the VIP.'),
  );
}

// ---- frame chips ----

/** The frame under a phrase, as a small chip: 「＿を ください」 · ___, please. Null for no frame. */
export function frameChip(phrase: { text: string; kana: string }, level: Level): HTMLElement | null {
  const id = frameOf(phrase);
  if (!id) return null;
  const f = FRAME_BY_ID[id];
  return h('span', { class: 'frame-chip' }, h('span', { class: 'frame-ja', lang: 'ja' }, f.ja), level === 'kana' ? h('small', { class: 'frame-romaji' }, toRomaji(f.ja.replace(/＿/g, ' … '))) : null, h('small', {}, f.en));
}

// ---- My progress: the Path tab ----

/** The switch, the steps with how far along each is, and the frames met so far. */
export function pathTab(view: AccountView, level: Level, toggle: (on: boolean) => void, busy: boolean): HTMLElement {
  const on = view.path;
  const facts = factsOf(view, level);
  const steps = stepsFor(level);
  const firstOpen = steps.find((s) => s.progress(facts) < 1);
  // Frames met so far first; the rest fold away until they turn up in a game.
  const met = FRAMES.filter((f) => view.frames.some((s) => s.id === f.id));
  const unmet = FRAMES.filter((f) => !met.includes(f));
  const frameRow = (f: (typeof FRAMES)[number]) => {
    const stat = view.frames.find((s) => s.id === f.id);
    const ex = stat?.examples[0];
    return h(
      'li',
      { class: `path-frame${stat ? '' : ' unmet'}` },
      h('span', { class: 'frame-ja', lang: 'ja' }, f.ja),
      h('span', { class: 'path-frame-en' }, `${f.en}. ${f.use}`),
      h('span', { class: 'path-frame-ex' }, h('span', { lang: 'ja' }, ex ? ex.text : f.example.ja), ` · ${ex ? ex.en : f.example.en}`),
      h('small', { class: 'path-frame-n' }, stat ? `Said ${stat.said} ${stat.said === 1 ? 'time' : 'times'} · ${stat.phrases} ${stat.phrases === 1 ? 'phrase' : 'phrases'}` : 'Not met yet'),
    );
  };
  return h(
    'div',
    { class: 'acct-cards path-tab' },
    h(
      'div',
      { class: 'path-switch' },
      h('p', {}, h('strong', {}, 'Learning path'), h('small', {}, 'Suggests what to play next, in an order that builds up, and names the sentence frames you use. It shows on your phone only; the TV and the game stay the same for everyone.')),
      h('button', { type: 'button', class: on ? 'secondary' : 'primary', role: 'switch', 'aria-checked': String(on), disabled: busy, onclick: () => toggle(!on) }, on ? 'Turn off' : 'Turn on'),
    ),
    h(
      'ol',
      { class: `path-steps${on ? '' : ' off'}` },
      steps.map((s) => {
        const p = s.progress(facts);
        const state = p >= 1 ? 'done' : s === firstOpen ? 'now' : 'later';
        return h(
          'li',
          { class: `path-row ${state}` },
          h('span', { class: 'path-mark', 'aria-hidden': 'true' }, state === 'done' ? '✓' : state === 'now' ? '▶' : ''),
          h(
            'span',
            { class: 'path-text' },
            h('strong', {}, s.title),
            h('small', {}, MODES[s.mode].info.title, s.frames.length ? ' · ' : '', s.frames.map((id) => h('span', { lang: 'ja' }, FRAME_BY_ID[id].ja)).flatMap((el, i) => (i ? [' ', el] : [el]))),
            h('small', { class: 'path-goal' }, state === 'done' ? 'Done' : `${s.goal} · ${Math.round(p * 100)}%`),
          ),
          h('span', { class: 'path-bar', 'aria-hidden': 'true' }, h('i', { style: `width:${Math.round(p * 100)}%` })),
        );
      }),
    ),
    h('h3', {}, 'Sentence frames'),
    h('p', { class: 'acct-note' }, 'The shapes you keep reusing. Swap the words in the gaps and the same frame says something new.'),
    met.length ? h('ul', { class: 'path-frame-list' }, met.map(frameRow)) : h('p', { class: 'acct-note' }, 'None yet: play a game signed in and the frames you use show up here.'),
    unmet.length
      ? h(
          'details',
          { class: 'path-more' },
          h('summary', {}, met.length ? `${unmet.length} more frames to meet` : `See all ${unmet.length} frames`),
          h('ul', { class: 'path-frame-list' }, unmet.map(frameRow)),
        )
      : null,
  );
}
