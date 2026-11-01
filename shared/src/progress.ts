// Saved progress for signed-in players (docs/accounts.md): the yōkai cards (a Leitner queue per kana)
// and the scores from every game they finish. Pure rules, no storage: the account service
// (server/src/accounts.ts) loads a profile, applies one of these and saves it.

import { FRAMES, frameOf, type FrameId } from './japanese/frames.js';
import { soundKey, toHiragana } from './japanese/kana.js';
import { toRomaji } from './japanese/romaji.js';
import { isRomaji, romajiToHiragana } from './japanese/toKana.js';
import type { PhraseEntry } from './modes/mode.js';
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
const DAY_MS = 86_400_000;

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
  for (const e of phrases ?? []) if (!isCard.has(e.itemId)) addPhrase(p, e, result.mode, result.at);
}

/**
 * One phrasebook entry from a game. Said from memory moves it up a box; a retry or a miss brings it
 * back tomorrow; seen (tapped or read) only adds it.
 */
function addPhrase(p: Progress, e: PhraseEntry, mode: ModeId, at: number): void {
  const all = (p.phrases ??= {});
  const card = (all[e.itemId] ??= { itemId: e.itemId, text: e.text, kana: e.kana, en: e.en, mode, box: 0, due: at, seen: 0, said: 0, missed: 0, last: e.outcome, lastAt: at });
  Object.assign(card, { text: e.text, kana: e.kana, en: e.en, mode, last: e.outcome, lastAt: at });
  card.seen += 1;
  if (e.outcome === 'said') {
    card.said += 1;
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

/** The phrases up for review now, as for cards. */
export function duePhrases(p: Progress, now: number, limit = REVIEW_SIZE): PhraseCard[] {
  return Object.values(p.phrases ?? {})
    .filter((c) => c.due <= now)
    .sort((a, b) => a.box - b.box || a.due - b.due)
    .slice(0, limit);
}

/**
 * A phrase review: the phone shows the English, the player says it out loud, then checks the answer
 * and marks it themselves. Only they lose by being generous.
 */
export function reviewPhrase(p: Progress, itemId: string, knew: boolean, now: number): PhraseCard | null {
  const card = p.phrases?.[itemId];
  if (!card) return null;
  card.seen += 1;
  card.last = knew ? 'said' : 'missed';
  card.lastAt = now;
  if (knew) {
    card.said += 1;
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
