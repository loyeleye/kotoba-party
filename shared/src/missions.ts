// Solo missions (Green Car design, "Fallback: solo missions"): short reps on a player's own phone, in the
// lobby or before joining a room, for path goals the party games can't carry on their own. The first one
// is Sign Walk (かんばん さんぽ) for 3.12, "Read 30 sign kanji": Shodō gives about 0.56 sign kanji a
// game (pathYields.ts), so the 30 kanji on 2 days each would take over a hundred games.
//
// How it stays "said from memory" without a room to hear it: the phone shows a sign with no reading, the
// player says it (or types it in kana), and the server checks the reading (accounts.ts). Peeking at the
// reading, or typing the kanji, never counts. A mission day is marked `solo` on the phrase's memory days,
// and only goals listed here read solo days (path.ts kanjiDays); frames goals never do.
//
// Pure rules, no storage or DOM: accounts.ts serves them and controller/src/mission.ts draws them.

import { writeKanji, type KanjiLevel } from '../../content/src/kanji/kanji.js';
import type { StationSign } from '../../content/src/types.js';
import { hasKanji, matchesAccepted, utteranceReading, type Utterance } from './japanese/kana.js';
import { isRomaji, romajiToHiragana } from './japanese/toKana.js';
import { DAY_MS, dayOf, type Progress } from './progress.js';

/** path.ts's ITEM_DAYS (a test keeps them equal; importing it here would be a cycle). */
const ITEM_DAYS = 2;

/** One sign to read: its say word (the phrasebook's `kw-<word>` card) and the sign kanji in it. */
export interface MissionWord {
  itemId: string;
  text: string;
  kana: string;
  en: string;
  /** The goal's kanji in the word (非常口 → 非, 常), with their meanings, for the reveal. */
  kanji: readonly { char: string; meaning: string }[];
  /** How the board looks: exits are yellow, as at Japanese stations. */
  sign: StationSign;
}

export interface Mission {
  id: string;
  /** The path goal it counts toward. */
  goal: string;
  band: KanjiLevel;
  title: string;
  ja: string;
  /** One line for the entry button. */
  blurb: string;
  /** What the phone asks under each item. */
  ask: string;
  /** A station sign (sign kanji) or a plain word card (N4 kanji, which are words, not signs). */
  look: 'sign' | 'card';
  words: readonly MissionWord[];
}

/** Items per sitting: about two minutes. */
export const MISSION_SIZE = 5;
/** A wrong reading gets this many more tries before the reading shows. */
export const MISSION_RETRIES = 1;

/**
 * How many of a kanji's ITEM_DAYS a mission may fill (the design's open point "how much of a stamp a solo
 * say may fill"). 2: a kanji read from memory in missions on two days counts in full, so 3.12 can clear
 * without enough Shodō nights. 1 would leave each kanji needing a game day too. See the open questions doc.
 */
export const SOLO_KANJI_DAYS = 2;

/** Say words that are exits, drawn yellow. */
const EXITS = new Set(['非常口', '中央口']);

function wordsFor(band: KanjiLevel): MissionWord[] {
  const byText = new Map<string, MissionWord>();
  for (const k of writeKanji) {
    if (k.level !== band) continue;
    const w = byText.get(k.say.text) ?? {
      itemId: `kw-${k.say.text}`,
      text: k.say.text,
      kana: k.say.kana,
      en: k.say.en,
      kanji: [],
      sign: { text: k.say.text, ...(EXITS.has(k.say.text) ? { kind: 'exit' as const } : {}) },
    };
    byText.set(k.say.text, { ...w, kanji: [...w.kanji, { char: k.char, meaning: k.meaning }] });
  }
  // The kanji in word order (非常口: 非 then 常), whichever the writing steps listed first.
  return [...byText.values()].map((w) => ({ ...w, kanji: [...w.kanji].sort((a, b) => w.text.indexOf(a.char) - w.text.indexOf(b.char)) }));
}

export const MISSIONS: readonly Mission[] = [
  {
    id: 'sign-walk',
    goal: '3.12',
    band: 'n3',
    title: 'Sign Walk',
    ja: 'かんばん さんぽ',
    blurb: `${MISSION_SIZE} signs, about two minutes. Read each one aloud.`,
    ask: 'Read this sign out loud. Say the whole sign, from memory.',
    look: 'sign',
    words: wordsFor('n3'),
  },
  {
    // 4.10, "Read 30 N4 kanji": Shodō and Last Train give too few, and the sims don't model kanji reading
    // (the game-tuning thread, Nov 2). Same rules as Sign Walk, over the N4 say words (61, of which 30 count).
    id: 'kanji-walk',
    goal: '4.10',
    band: 'n4',
    title: 'Kanji Walk',
    ja: 'かんじ さんぽ',
    blurb: `${MISSION_SIZE} words, about two minutes. Read each one aloud.`,
    ask: 'Read this word out loud, from memory.',
    look: 'card',
    words: wordsFor('n4'),
  },
];
export const MISSION_BY_ID: Readonly<Record<string, Mission>> = Object.fromEntries(MISSIONS.map((m) => [m.id, m]));
/** The mission for a path goal, if it has one. */
export const missionFor = (goalId: string): Mission | undefined => MISSIONS.find((m) => m.goal === goalId);
/** Goals whose kanji count solo days. */
export const SOLO_GOALS: ReadonlySet<string> = new Set(MISSIONS.map((m) => m.goal));

/** The days each of a mission's kanji has been read from memory (any source), from the phrasebook. */
function charDays(p: Progress, m: Mission): Map<string, Set<string>> {
  const chars = new Set(m.words.flatMap((w) => w.kanji.map((k) => k.char)));
  const out = new Map<string, Set<string>>([...chars].map((c) => [c, new Set<string>()]));
  for (const c of Object.values(p.phrases ?? {})) {
    if (!c.memory?.length) continue;
    const inCard = c.itemId.startsWith('kj-') ? [c.itemId.slice(3)] : c.itemId.startsWith('kw-') ? [...c.itemId.slice(3)] : [];
    for (const ch of inCard) for (const d of c.memory) if (d.game || d.solo) out.get(ch)?.add(d.day);
  }
  return out;
}

/**
 * Tonight's signs: words with a kanji still short of its days come first (one already read on an earlier
 * day before a fresh one, so stamps finish), skipping words whose kanji were all read today (another say
 * today adds nothing). When every kanji is done, the ones read longest ago come back as review.
 */
export function pickMission(p: Progress, m: Mission, now: number, tzOffsetMin: number, size = MISSION_SIZE): MissionWord[] {
  const today = dayOf(now, tzOffsetMin);
  const days = charDays(p, m);
  const score = (w: MissionWord): number => {
    const ds = w.kanji.map((k) => days.get(k.char) ?? new Set<string>());
    const open = ds.filter((d) => d.size < ITEM_DAYS && !d.has(today));
    if (!open.length) return -1;
    // Half-done kanji first, then words that finish more kanji at once.
    return open.filter((d) => d.size > 0).length * 10 + open.length;
  };
  const last = (w: MissionWord): number => {
    const all = w.kanji.flatMap((k) => [...(days.get(k.char) ?? [])]);
    return all.length ? Math.max(...all.map((d) => Date.parse(d))) : 0;
  };
  const open = m.words.filter((w) => score(w) >= 0).sort((a, b) => score(b) - score(a) || m.words.indexOf(a) - m.words.indexOf(b));
  const picked = open.slice(0, size);
  if (picked.length < size) {
    const review = m.words.filter((w) => !picked.includes(w) && !w.kanji.every((k) => days.get(k.char)?.has(today))).sort((a, b) => last(a) - last(b));
    picked.push(...review.slice(0, size - picked.length));
  }
  // Mixed up, so the same board isn't always first; seeded by the day, so a reload deals the same signs.
  const seed = Math.floor((now - tzOffsetMin * 60_000) / DAY_MS);
  return picked.map((w, i) => ({ w, k: (i * 7919 + seed * 104729) % 9973 })).sort((a, b) => a.k - b.k).map((x) => x.w);
}

export type MissionCheck = { right: true } | { right: false; why: 'wrong' | 'kanji-typed' | 'empty' };

/**
 * Is this the sign's reading? Spoken answers are checked by the server's reading of what Whisper heard;
 * typed ones must be kana or romaji (typing the kanji only copies the sign).
 */
export function checkReading(w: MissionWord, u: Utterance): MissionCheck {
  if (!u.text.trim()) return { right: false, why: 'empty' };
  if (u.via !== 'speech' && hasKanji(u.text)) return { right: false, why: 'kanji-typed' };
  const said = u.via !== 'speech' && isRomaji(u.text) ? romajiToHiragana(u.text) : utteranceReading(u);
  return matchesAccepted(said, [w.kana]) ? { right: true } : { right: false, why: 'wrong' };
}
