// Saved progress for signed-in players (docs/accounts.md): the yōkai cards (a Leitner queue per kana)
// and the scores from every game they finish. Pure rules, no storage: the account service
// (server/src/accounts.ts) loads a profile, applies one of these and saves it.

import { FRAMES, frameOf, type FrameId } from './japanese/frames.js';
import { soundKey, toHiragana } from './japanese/kana.js';
import { toRomaji } from './japanese/romaji.js';
import { isRomaji, romajiToHiragana } from './japanese/toKana.js';
import type { PhraseEntry } from './modes/mode.js';
import type { PathStatus } from './path.js';
import type { ModeId } from './protocol.js';

/** How one card went in one game, from the mode (Kana Raid's tally). */
export interface PracticeItem {
  /** Stable id of the content item, so a kana met in two games is one card. */
  itemId: string;
  /** What the card shows (あ) and how it sounds (あ; ティ sounds てぃ). */
  char: string;
  hear: string;
  en: string;
  seen: number;
  /** Right from memory: said or typed (or drawn), not picked from options. Only these move a card up. */
  recalled: number;
  missed: number;
}

/** One signed-in player's result from one finished game. The room sends it with their account token. */
export interface GameResult {
  mode: ModeId;
  /** Epoch ms when the game ended. */
  at: number;
  score: number;
  /** 1 for first; 0 when they scored nothing (nobody is told they came 3rd for 0). */
  place: number;
  players: number;
  coop: boolean;
  awards: { title: string; en: string }[];
  cards: PracticeItem[];
  /** This game's phrasebook for the player (every mode fills one): said, retried, missed or seen. */
  phrases: PhraseEntry[];
}

/** A yōkai card: one kana in the player's Leitner queue. */
export interface Card {
  itemId: string;
  char: string;
  hear: string;
  en: string;
  /** Leitner box, 0 (met, never recalled) to 5. */
  box: number;
  /** Epoch ms when it's next up for review. */
  due: number;
  /** Days (YYYY-MM-DD, the player's own) it was recalled right. Three different days catch the yōkai. */
  days: string[];
  seen: number;
  missed: number;
  caughtAt: number | null;
}

/** A saved phrase: one phrasebook item from any game, in its own Leitner queue. */
export interface PhraseCard {
  itemId: string;
  text: string;
  kana: string;
  en: string;
  /** The game it was last met in. */
  mode: ModeId;
  /** 0 (met, never said) to 5, as for yōkai cards. */
  box: number;
  due: number;
  seen: number;
  said: number;
  missed: number;
  /** How it went the last time, in a game or a review. */
  last: PhraseEntry['outcome'];
  lastAt: number;
  /** 'memory' once it has been said from memory; 'read' while it has only been read, echoed or typed. Missing on old saves. */
  recall?: Recall;
  /** The days it was said from memory (newest last, capped at MEMORY_DAYS), for the learning path's goals. */
  memory?: MemoryDay[];
  /** Epoch ms it was last said from memory. */
  memAt?: number;
}

/** One day a phrase was said from memory: how many times, and whether any of them was in a game (not a phone review). */
export interface MemoryDay {
  day: string;
  n: number;
  game: boolean;
}

/**
 * True recall (docs/progressive-learning.md): a phrase said from memory counts toward the path; one read off
 * the screen, echoed after the TV, sung from lyrics, built from tiles or typed doesn't.
 */
export type Recall = 'memory' | 'read';

/** A met sentence frame, kept so it stays met when its phrases age out of the phrasebook. */
export interface FrameMark {
  metAt: number;
  /** When it next comes back in the phone review (21 days after it was met, then 60 days after that). */
  recheckAt: number;
  /** waiting: not re-checked yet; passed: said again from memory at every check; fading: missed, until said again. */
  recheck: 'waiting' | 'passed' | 'fading';
  /** Which re-check is next or running: 1 (the 21-day one) or 2 (60 days later). Missing means 1. */
  round?: number;
  /** The day (the player's own) it faded: only a say from memory on a later day brings it back. */
  fadedDay?: string;
}

/** A finished game as the profile keeps it (without the per-card detail). */
export type GameRecord = Omit<GameResult, 'cards' | 'phrases'>;

export interface Progress {
  cards: Record<string, Card>;
  /** Newest first, capped at MAX_GAMES. */
  games: GameRecord[];
  /** The saved phrasebook. Missing on saves made before it existed. */
  phrases?: Record<string, PhraseCard>;
  /** The learning path is on (docs/progressive-learning.md). Off, or missing, until the player turns it on. */
  path?: boolean;
  /** Sentence frames met (shared/src/path.ts's rule), by frame id. */
  frameMarks?: Record<string, FrameMark>;
  /** Path goals met, by goal id: when. The 済 stamp stays even if a frame later fades. */
  goalsMet?: Record<string, number>;
}

/** Days until the next review, by box (design doc: 1, 3, 7, 14, 30). Box 0 is due at once. */
export const BOX_DAYS = [0, 1, 3, 7, 14, 30] as const;
export const TOP_BOX = BOX_DAYS.length - 1;
/** Recalled right on this many different days: the yōkai is caught. */
export const CATCH_DAYS = 3;
export const MAX_GAMES = 100;
/** Phrases kept per save; the ones met longest ago go first. */
export const MAX_PHRASES = 600;
/** One review sitting: about the design doc's 3 minutes. */
export const REVIEW_SIZE = 12;
export const DAY_MS = 86_400_000;
/** Memory days kept per phrase: plenty for the path's rule (2 days at least 3 apart). */
export const MEMORY_DAYS = 12;
/** A frame said from memory counts at most this many times a day (so one night can't meet it). */
export const SAYS_PER_DAY = 2;
/** The frame rule: says, different fillers, and two days at least this far apart. */
export const FRAME_SAYS = 3;
export const FRAME_FILLERS = 2;
export const FRAME_GAP_DAYS = 3;
/** A met frame comes back in the phone review this many days later, and once more this many days after that. */
export const RECHECK_DAYS = 21;
export const SECOND_RECHECK_DAYS = 60;

/** A re-check passed: the first schedules the second; the second is the last. */
function passRecheck(m: FrameMark, now: number): void {
  delete m.fadedDay;
  if ((m.round ?? 1) < 2) {
    m.round = 2;
    m.recheckAt = now + SECOND_RECHECK_DAYS * DAY_MS;
    m.recheck = 'waiting';
  } else m.recheck = 'passed';
}

/**
 * How a phrasebook entry was said. Opt-in: only a line its game tags `recall: 'memory'` counts as said from
 * memory; anything untagged (Dub Club's script, Karaoke Duel's lyrics, a new mode) is read.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const recallOf = (e: Pick<PhraseEntry, 'recall'>, _mode?: ModeId): Recall => e.recall ?? 'read';

/** Today counts once more for a phrase said from memory. */
function rememberDay(card: PhraseCard, day: string, game: boolean, at: number): void {
  card.recall = 'memory';
  card.memAt = Math.max(card.memAt ?? 0, at);
  const days = (card.memory ??= []);
  const d = days.find((x) => x.day === day);
  if (d) {
    d.n += 1;
    d.game ||= game;
  } else days.push({ day, n: 1, game });
  days.sort((a, b) => (a.day < b.day ? -1 : 1));
  if (days.length > MEMORY_DAYS) days.splice(0, days.length - MEMORY_DAYS);
}

export const emptyProgress = (): Progress => ({ cards: {}, games: [], phrases: {} });

/** The player's calendar day, from their UTC offset in minutes (Date.getTimezoneOffset's sign: UTC − local). */
export function dayOf(now: number, tzOffsetMin: number): string {
  return new Date(now - tzOffsetMin * 60_000).toISOString().slice(0, 10);
}

/** A right answer from memory: one box up, and today counts towards catching. */
function recall(card: Card, now: number, day: string): void {
  card.box = Math.min(TOP_BOX, card.box + 1);
  card.due = now + BOX_DAYS[card.box]! * DAY_MS;
  if (!card.days.includes(day)) card.days.push(day);
  if (card.caughtAt === null && card.days.length >= CATCH_DAYS) card.caughtAt = now;
}

/** A miss: back to box 1, so it haunts them again tomorrow. A caught yōkai stays caught. */
function miss(card: Card, now: number): void {
  card.missed += 1;
  card.box = 1;
  card.due = now + BOX_DAYS[1] * DAY_MS;
}

/** Adds a finished game: its score to the history and each card's result to the queue. */
export function addGame(p: Progress, result: GameResult, tzOffsetMin: number): void {
  const { cards, phrases, ...record } = result;
  p.games.unshift(record);
  // Rooms can finish out of order (two saves arriving together): newest first all the same.
  p.games.sort((a, b) => b.at - a.at);
  p.games.length = Math.min(p.games.length, MAX_GAMES);
  const day = dayOf(result.at, tzOffsetMin);
  for (const item of cards) {
    if (item.seen <= 0) continue;
    const card = (p.cards[item.itemId] ??= { itemId: item.itemId, char: item.char, hear: item.hear, en: item.en, box: 0, due: result.at, days: [], seen: 0, missed: 0, caughtAt: null });
    card.seen += item.seen;
    // Missed and then got on the retry: the day still counts, but the card starts over tomorrow.
    if (item.recalled > 0) recall(card, result.at, day);
    if (item.missed > 0) miss(card, result.at);
  }
  // Kana Raid puts its kana in the phrasebook too; those already are yōkai cards.
  const isCard = new Set(cards.map((c) => c.itemId));
  for (const e of phrases ?? []) if (!isCard.has(e.itemId)) addPhrase(p, e, result.mode, result.at, day);
}

/**
 * One phrasebook entry from a game. Said from memory moves it up a box; a retry or a miss brings it
 * back tomorrow; seen (tapped or read) only adds it.
 */
function addPhrase(p: Progress, e: PhraseEntry, mode: ModeId, at: number, day: string): void {
  const all = (p.phrases ??= {});
  const card = (all[e.itemId] ??= { itemId: e.itemId, text: e.text, kana: e.kana, en: e.en, mode, box: 0, due: at, seen: 0, said: 0, missed: 0, last: e.outcome, lastAt: at });
  Object.assign(card, { text: e.text, kana: e.kana, en: e.en, mode, last: e.outcome, lastAt: at });
  card.seen += 1;
  if (e.outcome === 'said') {
    card.said += 1;
    if (recallOf(e, mode) === 'memory') rememberDay(card, day, true, at);
    else card.recall ??= 'read';
    card.box = Math.min(TOP_BOX, card.box + 1);
    card.due = at + BOX_DAYS[card.box]! * DAY_MS;
  } else if (e.outcome === 'retry' || e.outcome === 'missed') {
    if (e.outcome === 'missed') card.missed += 1;
    card.box = 1;
    card.due = at + BOX_DAYS[1] * DAY_MS;
  }
  const ids = Object.keys(all);
  if (ids.length > MAX_PHRASES) {
    const oldest = ids.sort((a, b) => all[a]!.lastAt - all[b]!.lastAt).slice(0, ids.length - MAX_PHRASES);
    for (const id of oldest) delete all[id];
  }
}

/** The phrases up for review now, as for cards, with any met frame's 21-day re-check first. */
export function duePhrases(p: Progress, now: number, limit = REVIEW_SIZE): PhraseCard[] {
  const checks = recheckPhrases(p, now);
  const ids = new Set(checks.map((c) => c.itemId));
  const due = Object.values(p.phrases ?? {})
    .filter((c) => c.due <= now && !ids.has(c.itemId))
    .sort((a, b) => a.box - b.box || a.due - b.due);
  return [...checks, ...due].slice(0, limit);
}

/** The frames a phrase is built on (frames.ts gives one today; the path takes a list so more can count). */
export const phraseFrames = (c: { text: string; kana: string }): FrameId[] => {
  const id = frameOf(c);
  return id ? [id] : [];
};

/** Each frame's saved phrases. */
function byFrame(p: Progress): Map<string, PhraseCard[]> {
  const by = new Map<string, PhraseCard[]>();
  for (const c of Object.values(p.phrases ?? {})) for (const id of phraseFrames(c)) by.set(id, [...(by.get(id) ?? []), c]);
  return by;
}

/** Frames whose re-check is due: one phrase each (the one said from memory most), shown once in the review. */
export function recheckPhrases(p: Progress, now: number): PhraseCard[] {
  const marks = p.frameMarks ?? {};
  const due = Object.entries(marks).filter(([, m]) => m.recheck === 'waiting' && m.recheckAt <= now);
  if (!due.length) return [];
  const by = byFrame(p);
  const out: PhraseCard[] = [];
  for (const [id] of due) {
    // The probe is the phrase practised least, and longest ago: the hardest fair test of the frame.
    const best = (by.get(id) ?? []).filter((c) => c.recall === 'memory').sort((a, b) => memSays(a) - memSays(b) || (a.memAt ?? 0) - (b.memAt ?? 0))[0];
    if (best && !out.includes(best)) out.push(best);
  }
  return out;
}

const memSays = (c: PhraseCard): number => (c.memory ?? []).reduce((n, d) => n + d.n, 0);

/** How far one frame is along the path's rule (docs/progressive-learning.md). */
export interface FrameRule {
  /** Says from memory, at most SAYS_PER_DAY a day. */
  says: number;
  /** Different phrases (fillers) said from memory. */
  fillers: number;
  /** Days said from memory, and whether two of them are FRAME_GAP_DAYS apart. */
  days: number;
  spaced: boolean;
  /** Said from memory in a game on at least one day (not only in phone reviews). */
  inGame: boolean;
  /** The first and last days said from memory (YYYY-MM-DD), or null. */
  firstDay: string | null;
  lastDay: string | null;
}

const dayNum = (day: string): number => Date.parse(`${day}T00:00:00Z`) / DAY_MS;

/** The rule's tally for one frame's phrases. */
export function frameRule(cards: readonly PhraseCard[]): FrameRule {
  const perDay = new Map<string, { n: number; game: boolean }>();
  let fillers = 0;
  for (const c of cards) {
    if (!c.memory?.length) continue;
    fillers += 1;
    for (const d of c.memory) {
      const t = perDay.get(d.day) ?? { n: 0, game: false };
      t.n += d.n;
      t.game ||= d.game;
      perDay.set(d.day, t);
    }
  }
  const keys = [...perDay.keys()].sort();
  const days = keys.map(dayNum);
  const says = [...perDay.values()].reduce((n, d) => n + Math.min(SAYS_PER_DAY, d.n), 0);
  return {
    says,
    fillers,
    days: days.length,
    spaced: days.length >= 2 && days[days.length - 1]! - days[0]! >= FRAME_GAP_DAYS,
    inGame: [...perDay.values()].some((d) => d.game),
    firstDay: keys[0] ?? null,
    lastDay: keys[keys.length - 1] ?? null,
  };
}

export const ruleMet = (r: FrameRule): boolean => r.says >= FRAME_SAYS && r.fillers >= FRAME_FILLERS && r.spaced && r.inGame;

/** 0 to 1: a quarter for each part of the rule (the days part half-done after the first day). */
export const ruleProgress = (r: FrameRule): number =>
  ruleMet(r) ? 1 : (Math.min(r.says, FRAME_SAYS) / FRAME_SAYS + Math.min(r.fillers, FRAME_FILLERS) / FRAME_FILLERS + (r.spaced ? 1 : r.days ? 0.5 : 0) + (r.inGame ? 1 : 0)) / 4;

/** Every frame's tally, from the saved phrasebook. */
export function frameRules(p: Progress): Map<string, FrameRule> {
  return new Map([...byFrame(p)].map(([id, cards]) => [id, frameRule(cards)]));
}

/**
 * Marks frames that now meet the rule, and clears a fading re-check once the frame is said from memory again
 * (in a game or a review) after its re-check date. Returns the frames newly met.
 */
export function markFrames(p: Progress, now: number): string[] {
  const marks = (p.frameMarks ??= {});
  const fresh: string[] = [];
  for (const [id, cards] of byFrame(p)) {
    const m = marks[id];
    if (!m) {
      if (ruleMet(frameRule(cards))) {
        marks[id] = { metAt: now, recheckAt: now + RECHECK_DAYS * DAY_MS, recheck: 'waiting' };
        fresh.push(id);
      }
      continue;
    }
    if (m.recheck === 'passed' || now < m.recheckAt) continue;
    // Said from memory again since the check came due (and, once faded, on a later day than the miss).
    const again = cards.some((c) => (c.memAt ?? 0) >= m.recheckAt && (!m.fadedDay || (c.memory ?? []).some((d) => d.day > m.fadedDay!)));
    if (again) passRecheck(m, now);
  }
  return fresh;
}

/**
 * The re-check in a phone review: only the probe phrase decides it. Known, the frame passes; missed, it fades
 * until said from memory again on a later day.
 */
function recheckReview(p: Progress, card: PhraseCard, knew: boolean, now: number, day: string): void {
  if (!recheckPhrases(p, now).includes(card)) return;
  for (const id of phraseFrames(card)) {
    const m = p.frameMarks?.[id];
    if (!m || m.recheckAt > now || m.recheck !== 'waiting') continue;
    if (knew) passRecheck(m, now);
    else {
      m.recheck = 'fading';
      m.fadedDay = day;
    }
  }
}

/**
 * A phrase review: the phone shows the English, the player says it out loud, then checks the answer
 * and marks it themselves. Only they lose by being generous.
 */
export function reviewPhrase(p: Progress, itemId: string, knew: boolean, now: number, tzOffsetMin = 0): PhraseCard | null {
  const card = p.phrases?.[itemId];
  if (!card) return null;
  recheckReview(p, card, knew, now, dayOf(now, tzOffsetMin));
  card.seen += 1;
  card.last = knew ? 'said' : 'missed';
  card.lastAt = now;
  if (knew) {
    card.said += 1;
    rememberDay(card, dayOf(now, tzOffsetMin), false, now);
    card.box = Math.min(TOP_BOX, card.box + 1);
    card.due = now + BOX_DAYS[card.box]! * DAY_MS;
  } else {
    card.missed += 1;
    card.box = 1;
    card.due = now + BOX_DAYS[1] * DAY_MS;
  }
  return card;
}

/** The cards up for review now: lowest box first, then the longest overdue. */
export function dueCards(p: Progress, now: number, limit = REVIEW_SIZE): Card[] {
  return Object.values(p.cards)
    .filter((c) => c.due <= now)
    .sort((a, b) => a.box - b.box || a.due - b.due)
    .slice(0, limit);
}

/** Is a typed romaji answer the card's sound? Hepburn and the usual variants (si, tu, hu) all count. */
export function rightSound(card: Pick<Card, 'hear'>, typed: string): boolean {
  const text = typed.trim();
  if (!isRomaji(text)) return false;
  // The romaji the card itself shows always counts (ティ "ti", ウォ "wo", パーティー "pātī" typed as pati or paatii).
  const shown = toRomaji(card.hear);
  if (shown && romajiForms(shown).includes(plain(text))) return true;
  return soundKey(romajiToHiragana(text.replace(/\s+/g, ''))) === soundKey(toHiragana(card.hear));
}

const plain = (s: string): string => s.toLowerCase().replace(/[^a-z]/g, '');
/** A shown romaji with its long vowels typed single (pati) or doubled (paatii). */
function romajiForms(shown: string): string[] {
  const s = shown.toLowerCase();
  const long: Record<string, string> = { ā: 'a', ī: 'i', ū: 'u', ē: 'e', ō: 'o', â: 'a', î: 'i', û: 'u', ê: 'e', ô: 'o' };
  return [plain(s.replace(/[āīūēōâîûêô]/g, (c) => long[c]!)), plain(s.replace(/[āīūēōâîûêô]/g, (c) => long[c]!.repeat(2)))];
}

/** One review answer. Null for a card the player doesn't have. */
export function reviewCard(p: Progress, itemId: string, right: boolean, now: number, tzOffsetMin: number): Card | null {
  const card = p.cards[itemId];
  if (!card) return null;
  card.seen += 1;
  if (right) recall(card, now, dayOf(now, tzOffsetMin));
  else miss(card, now);
  return card;
}

/** What the phone's My progress page shows (GET /api/account/me). */
export interface AccountView {
  name: string;
  cards: Card[];
  /** Up for review now (one sitting's worth). */
  due: Card[];
  games: GameRecord[];
  bests: ModeBest[];
  /** The saved phrasebook, most recently met first. */
  phrases: PhraseCard[];
  duePhrases: PhraseCard[];
  /** The learning path is on. */
  path: boolean;
  /** Every sentence frame met in the saved phrasebook, in the path's order. */
  frames: FrameStat[];
  /** The learning path's goals, frames and lines (shared/src/path.ts), worked out from the whole save. */
  pathStatus: PathStatus;
}

/** One sentence frame across the saved phrasebook (shared/src/japanese/frames.ts). */
export interface FrameStat {
  id: FrameId;
  /** Phrases on this frame, and how many times they were said from memory (games and reviews). */
  phrases: number;
  said: number;
  /** Up to three, most recently met first. */
  examples: Pick<PhraseCard, 'text' | 'kana' | 'en'>[];
}

/** The frames in a saved phrasebook. Frames never met are left out. */
export function frameStats(p: Progress): FrameStat[] {
  const by = new Map<FrameId, { said: number; cards: PhraseCard[] }>();
  for (const c of Object.values(p.phrases ?? {})) {
    const id = frameOf(c);
    if (!id) continue;
    const f = by.get(id) ?? { said: 0, cards: [] };
    f.said += c.said;
    f.cards.push(c);
    by.set(id, f);
  }
  return FRAMES.filter((f) => by.has(f.id)).map((f) => {
    const { said, cards } = by.get(f.id)!;
    const examples = [...cards].sort((a, b) => b.lastAt - a.lastAt).slice(0, 3).map(({ text, kana, en }) => ({ text, kana, en }));
    return { id: f.id, phrases: cards.length, said, examples };
  });
}

export interface ModeBest {
  mode: ModeId;
  best: number;
  played: number;
  wins: number;
}

/** Each mode's best score and how often it was played, for the scores page. */
export function bests(p: Progress): ModeBest[] {
  const by = new Map<ModeId, ModeBest>();
  for (const g of p.games) {
    const b = by.get(g.mode) ?? { mode: g.mode, best: 0, played: 0, wins: 0 };
    b.best = Math.max(b.best, g.score);
    b.played += 1;
    if (g.place === 1 && !g.coop && g.players > 1) b.wins += 1;
    by.set(g.mode, b);
  }
  return [...by.values()].sort((a, b) => b.played - a.played);
}
