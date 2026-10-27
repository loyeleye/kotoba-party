// Furigana worked out from a written text and its kana reading, for content that has no
// hand-written segments: お会計、お願いします / おかいけい、おねがいします →
// [お][会計:かいけい][、お][願:ねが][いします]. The kana in the text are anchors in the reading; the
// kanji runs between them get what lies between. Returns null when the two can't be lined up
// (a reading that isn't the text's, like 十分 read as じゅっぷん in another sentence).

import { toHiragana } from './kana.js';

const KANJI = /[㐀-鿿豈-﫿々〆ヶ]/;
/** Read from the reading rather than matched in it: kanji, and digits (400円 → よんひゃくえん). */
const READ = /[㐀-鿿豈-﫿々〆ヶ0-9０-９,，]/;

export type Furigana = [base: string, reading: string][];

export function autoFurigana(text: string, kana: string): Furigana | null {
  if (!KANJI.test(text)) return null;
  // Split into runs: kanji runs (to read) and everything else (to match in the reading).
  const runs: { s: string; kanji: boolean }[] = [];
  for (const ch of text) {
    const kanji = READ.test(ch);
    const last = runs.at(-1);
    if (last && last.kanji === kanji) last.s += ch;
    else runs.push({ s: ch, kanji });
  }
  // The reading keeps its word spaces (they anchor the kanji: 一人 泣くの / ひとり なくの) but not its
  // punctuation. In the text, spaces and punctuation (、！？「」…) are separators: each may stand
  // for a space in the reading or for nothing.
  const reading = toHiragana(kana)
    .replace(/[^ぁ-ゖー\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const isSep = (ch: string) => !/[ぁ-ゖー\p{L}\p{N}]/u.test(toHiragana(ch));
  // The cheapest way to line the two up: a kanji run's reading should not cross a word space, and
  // should be about one or two kana a character (一人 泣くの: 一人 ひとり, 泣 な; not 一人 ひ, 泣 とりな).
  type Best = { cost: number; out: Furigana } | null;
  const memo = new Map<number, Best>();
  return best(0, 0)?.out ?? null;

  /** The best line-up of runs r… against the reading from p. */
  function best(r: number, p: number): Best {
    const key = r * 10_000 + p;
    if (!memo.has(key)) memo.set(key, solve(r, p));
    return memo.get(key)!;
  }

  function solve(r: number, p: number): Best {
    if (r === runs.length) {
      if (reading[p] === ' ') p++;
      return p === reading.length ? { cost: 0, out: [] } : null;
    }
    const run = runs[r]!;
    let found: Best = null;
    const consider = (pair: [string, string], cost: number, next: number) => {
      const rest = best(r + 1, next);
      if (rest && (!found || cost + rest.cost < found.cost)) found = { cost: cost + rest.cost, out: [pair, ...rest.out] };
    };
    if (!run.kanji) {
      for (const [end, cost] of plain([...run.s], 0, p, 0, new Map())) consider([run.s, ''], cost, end);
      return found;
    }
    // A kanji run reads at least one kana per character is too strict (日 → ひ, 一人 → ひとり are
    // fine, 々 repeats); at least one kana in all, at most four per character.
    const start = reading[p] === ' ' ? p + 1 : p;
    const chars = [...run.s].length;
    // Numbers (10,000円) read too unevenly to guess a length from.
    const expected = /[0-9０-９]/.test(run.s) ? null : 1.6 * chars;
    for (let n = 1; start + n <= reading.length; n++) {
      const slice = reading.slice(start, start + n);
      const kanaOnly = slice.replace(/ /g, '');
      if (kanaOnly.length > chars * 4) break;
      // No word's reading starts with a small kana, ん or ー.
      if (/^[ぁぃぅぇぉっゃゅょゎんー]/.test(kanaOnly)) break;
      if (slice.endsWith(' ')) continue;
      const spaces = slice.length - kanaOnly.length;
      consider([run.s, kanaOnly], (expected === null ? 0 : (kanaOnly.length - expected) ** 2) + 10 * spaces + (start > p ? 0.5 : 0), start + n);
    }
    return found;
  }

  /** Where a non-kanji run's kana and separators can end in the reading, each at its lowest cost. */
  function plain(chars: string[], i: number, p: number, cost: number, ends: Map<number, number>): Map<number, number> {
    if (i === chars.length) {
      if (cost < (ends.get(p) ?? Infinity)) ends.set(p, cost);
      return ends;
    }
    const ch = chars[i]!;
    if (isSep(ch)) {
      if (reading[p] === ' ') plain(chars, i + 1, p + 1, cost, ends);
      return plain(chars, i + 1, p, cost, ends);
    }
    // A word space in the reading that the text runs straight through.
    if (reading[p] === ' ') return plain(chars, i, p + 1, cost + 5, ends);
    if (reading[p] === toHiragana(ch)) plain(chars, i + 1, p + 1, cost, ends);
    return ends;
  }
}
