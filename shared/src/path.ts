// The learning path (docs/progressive-learning.md): an optional, signed-in-only order through the games,
// so a player always knows what to play next. Each step is one game and the sentence frames it
// practises; a step is done once the player's saved progress shows it. The phone suggests the first
// step not yet done that tonight's room can play. Nothing here changes a game: it only suggests.
//
// Pure rules over what the account already saves (yōkai cards, scores, the phrasebook's frames), so the
// phone can work it out from GET /api/account/me with no new storage.

import { FRAME_BY_ID, type FrameId } from './japanese/frames.js';
import { MODES, noFit } from './modes/registry.js';
import type { AccountView } from './progress.js';
import type { Level, ModeId } from './protocol.js';

/** What the path looks at, boiled down from an AccountView. */
export interface PathFacts {
  level: Level;
  /** Yōkai caught (kana recalled on 3 different days). */
  caught: number;
  /** Finished games, by mode. */
  played: Partial<Record<ModeId, number>>;
  /** Phrases said from memory, by frame. */
  said: Partial<Record<FrameId, number>>;
  /** Saved phrases due for review, by the game they were last met in. */
  due: Partial<Record<ModeId, number>>;
}

export interface PathStep {
  id: string;
  /** The game to play, and other games that count as playing it (Bento Haus VS for Bento Haus). */
  mode: ModeId;
  also?: ModeId[];
  title: string;
  /** Why this game now, in one line. */
  why: string;
  frames: FrameId[];
  /** Skipped for players above this level (Kana Raid's reading step for N5 and N4 players). */
  onlyFor?: Level[];
  /** What "done" means, said to the player. */
  goal: string;
  /** How far along the goal is, 0 to 1. */
  progress(f: PathFacts): number;
}

const playedOf = (f: PathFacts, s: Pick<PathStep, 'mode' | 'also'>): number => [s.mode, ...(s.also ?? [])].reduce((n, m) => n + (f.played[m] ?? 0), 0);
const part = (have: number, need: number): number => Math.min(1, have / need);
const avg = (...xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Kana caught before the path moves on from Kana Raid. */
export const KANA_GOAL = 20;

/**
 * The path, in order. It follows the beginner's order the design doc already uses (kana first, then
 * fixed frames in real situations, then free sentences), with each game reusing the frames before it.
 */
export const PATH: readonly PathStep[] = [
  {
    id: 'kana',
    mode: 'kana-raid',
    title: 'Read and say the kana',
    why: 'Every other game is easier once kana stop being squiggles.',
    frames: [],
    onlyFor: ['kana'],
    goal: `Catch ${KANA_GOAL} yōkai`,
    progress: (f) => part(f.caught, KANA_GOAL),
  },
  {
    id: 'intro',
    mode: 'hajimemashite',
    title: 'Introduce yourself',
    why: 'Your first frame: ＿は ＿です. Swap the words and it says almost anything.',
    frames: ['wa-desu', 'desu'],
    goal: 'Play once and say a ＿です sentence 3 times',
    // ＿が すきです is a です sentence too: the game's 「{name}さんは ＿が だいすきです」 lines count.
    progress: (f) => avg(part(f.played.hajimemashite ?? 0, 1), part((f.said['wa-desu'] ?? 0) + (f.said.desu ?? 0) + (f.said.suki ?? 0), 3)),
  },
  {
    id: 'ask',
    mode: 'last-train',
    title: 'Ask for things and places',
    why: '＿を ください and ＿は どこですか get you through a station, a shop and a café.',
    frames: ['kudasai', 'doko'],
    goal: 'Play once and ask for something 2 times',
    progress: (f) => avg(part(f.played['last-train'] ?? 0, 1), part(f.said.kudasai ?? 0, 2)),
  },
  {
    id: 'order',
    mode: 'bento-haus',
    also: ['bento-haus-vs'],
    title: 'Order with numbers',
    why: 'The same ＿を ください, now with how many: ふたつ, さんこ, いっぽん.',
    frames: ['kudasai'],
    goal: 'Play one shift',
    progress: (f) => part(playedOf(f, { mode: 'bento-haus', also: ['bento-haus-vs'] }), 1),
  },
  {
    id: 'own',
    mode: 'oogiri',
    title: 'Make your own sentences',
    why: 'Fill the frames you know with your own funny words.',
    frames: ['wa-desu', 'suki', 'tai'],
    goal: 'Play 2 games',
    progress: (f) => part(f.played.oogiri ?? 0, 2),
  },
  {
    id: 'numbers',
    mode: 'narabete',
    title: 'Times, prices and opinions',
    why: 'Say numbers out loud until they come without counting on your fingers.',
    frames: ['desu'],
    goal: 'Play once',
    progress: (f) => part(f.played.narabete ?? 0, 1),
  },
  {
    id: 'questions',
    mode: 'tourist',
    title: 'Ask and answer questions',
    why: 'Ask yes-or-no questions with か, and answer with そうです or ちがいます.',
    frames: ['ka', 'sou'],
    goal: 'Play once',
    progress: (f) => part(f.played.tourist ?? 0, 1),
  },
  {
    id: 'polite',
    mode: 'omiai',
    title: 'Polite Japanese',
    why: 'です and ます all the way through, and when to bow with your words.',
    frames: ['nan', 'masen-ka', 'te-mo-ii'],
    goal: 'Play once',
    progress: (f) => part(f.played.omiai ?? 0, 1),
  },
];

/** The steps this player walks: Kana Raid's step only at the Kana level. */
export const stepsFor = (level: Level): PathStep[] => PATH.filter((s) => !s.onlyFor || s.onlyFor.includes(level));

/** The path's facts from what My progress already loads. */
export function factsOf(view: Pick<AccountView, 'cards' | 'bests' | 'frames' | 'phrases' | 'duePhrases'>, level: Level): PathFacts {
  const played: PathFacts['played'] = {};
  for (const b of view.bests) played[b.mode] = b.played;
  const said: PathFacts['said'] = {};
  for (const fr of view.frames) said[fr.id] = fr.said;
  const due: PathFacts['due'] = {};
  for (const p of view.duePhrases) due[p.mode] = (due[p.mode] ?? 0) + 1;
  return { level, caught: view.cards.filter((c) => c.caughtAt !== null).length, played, said, due };
}

/** Tonight's room, as far as the suggestion cares. */
export interface RoomFit {
  players: number;
  speakers: number;
}

export interface Suggestion {
  /** The step, or null once the path is done (then it's a review pick). */
  step: PathStep | null;
  mode: ModeId;
  /** Steps done, out of the player's steps. */
  done: number;
  of: number;
  /** One line under the game's name. */
  why: string;
  /** The path's next step doesn't fit tonight's room, so this is the next one that does. */
  instead: boolean;
}

const fitsRoom = (mode: ModeId, room: RoomFit | null): boolean => !room || !noFit(MODES[mode].info, room.players, room.speakers);

/**
 * What to play next: the first step not yet done that the room can play. With every step done, the game
 * that has the most saved phrases due (practice where it's needed), else null.
 */
export function suggest(facts: PathFacts, room: RoomFit | null): Suggestion | null {
  const steps = stepsFor(facts.level);
  const open = steps.filter((s) => s.progress(facts) < 1);
  const done = steps.length - open.length;
  const first = open[0];
  const fit = open.find((s) => fitsRoom(s.mode, room));
  if (fit) return { step: fit, mode: fit.mode, done, of: steps.length, why: fit.why, instead: fit !== first };
  const review = (Object.entries(facts.due) as [ModeId, number][])
    .filter(([m, n]) => n > 0 && m in MODES && m !== 'debug' && fitsRoom(m, room))
    .sort((a, b) => b[1] - a[1])[0];
  if (review && open.length === 0) return { step: null, mode: review[0], done, of: steps.length, why: `${review[1]} of your saved phrases from this game are due. Play it and they come back.`, instead: false };
  return null;
}

/** The frames a step names, for the phone: 「＿を ください」 · "___, please". */
export const stepFrames = (s: PathStep): { ja: string; en: string }[] => s.frames.map((id) => ({ ja: FRAME_BY_ID[id].ja, en: FRAME_BY_ID[id].en }));

