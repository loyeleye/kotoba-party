// Fake titles: reading what a player wrote, said or built from tiles, and refusing fakes that
// are really the answer (like Word Gauntlet's Fake Kanji, but compared as kana readings, so
// ラーメン, らあめん and 拉麺 are all the same title).

import { isUtterance, soundKey, type Utterance } from '../../japanese/kana.js';
import { cleanText } from '../mode.js';
import type { Tile } from './prompts.js';

/** Titles are short: a few words. */
export const MAX_FAKE_LENGTH = 30;
export const MAX_FAKE_TILES = 4;

export type FakeVia = Utterance['via'] | 'tiles';

export interface Fake {
  text: string;
  /** Kana reading (the text itself when the server couldn't read kanji). */
  kana: string;
  /** English, when known (tile fakes only). */
  en: string | null;
  via: FakeVia;
}

const JAPANESE = /[ぁ-ゖァ-ヺー㐀-鿿]/;

/** Edit distance between two short strings (titles are at most 30 characters). */
export function editDistance(a: string, b: string): number {
  const x = [...a];
  const y = [...b];
  let prev = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const row = [i];
    for (let j = 1; j <= y.length; j++) row[j] = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + (x[i - 1] === y[j - 1] ? 0 : 1));
    prev = row;
  }
  return prev[y.length]!;
}

/**
 * Is this fake really the answer? The same reading (however it's spelt), the real title with
 * something added, or one kana away from it (a typo of the answer). A fake that is only part of
 * the real title (ねこ for ねこの シェフ) is a fair bluff and allowed.
 */
export function tooClose(fake: { text: string; kana: string }, real: { text: string; kana: string }): boolean {
  const f = soundKey(fake.kana);
  const r = soundKey(real.kana);
  if (!f || !r) return false;
  if (f === r || soundKey(fake.text) === soundKey(real.text)) return true;
  if (r.length >= 2 && f.includes(r)) return true;
  return [...r].length >= 3 && editDistance(f, r) <= 1;
}

/** Two fakes that read the same share one option. */
export const sameFake = (a: { kana: string }, b: { kana: string }): boolean => soundKey(a.kana) === soundKey(b.kana);

export type ReadFake = { ok: true; fake: Fake } | { ok: false; error: string };

/** A typed or spoken fake. The server has already added `reading` for kanji. */
export function readUtteranceFake(raw: unknown): ReadFake {
  if (!isUtterance(raw)) return { ok: false, error: 'bad-move' };
  const text = cleanText(raw.text, MAX_FAKE_LENGTH);
  if (!text) return { ok: false, error: 'empty-answer' };
  if (!JAPANESE.test(text)) return { ok: false, error: 'not-japanese' };
  // Kanji the server couldn't read (no dictionary) are compared as written.
  const kana = raw.reading?.trim() ? raw.reading : text;
  return { ok: true, fake: { text, kana, en: null, via: raw.via } };
}

/** A fake built from the player's tiles, by index into their hand. の joins its neighbours. */
export function buildTileFake(raw: unknown, hand: readonly Tile[]): ReadFake {
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, error: 'empty-answer' };
  if (raw.length > MAX_FAKE_TILES) return { ok: false, error: 'too-long' };
  if (!raw.every((i) => Number.isInteger(i) && i >= 0 && i < hand.length)) return { ok: false, error: 'bad-move' };
  if (new Set(raw).size !== raw.length) return { ok: false, error: 'tile-twice' };
  const tiles = (raw as number[]).map((i) => hand[i]!);
  // Particles at either end mean nothing: drop them (forgiving), but keep at least one word.
  while (tiles[0]?.particle) tiles.shift();
  while (tiles.at(-1)?.particle) tiles.pop();
  if (!tiles.length) return { ok: false, error: 'empty-answer' };
  let text = '';
  let kana = '';
  const en: string[] = [];
  for (const t of tiles) {
    if (t.particle) {
      // ねこ + の → ねこの (and "cat's"); the next word follows after a space.
      text += t.text;
      kana += t.kana;
      if (en.length) en[en.length - 1] += t.en;
      continue;
    }
    const sep = text ? ' ' : '';
    text += sep + t.text;
    kana += sep + t.kana;
    en.push(t.en);
  }
  return { ok: true, fake: { text, kana, en: en.join(' '), via: 'tiles' } };
}
