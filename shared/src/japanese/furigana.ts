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
  const norm = (s: string) => toHiragana(s).replace(/[\s　]/g, '');
  const reading = norm(kana);
  const out: Furigana = [];
  if (!match(0, 0)) return null;
  return out;

  function match(r: number, p: number): boolean {
    if (r === runs.length) return p === reading.length;
    const run = runs[r]!;
    if (!run.kanji) {
      const want = norm(run.s);
      if (!reading.startsWith(want, p)) return false;
      out.push([run.s, '']);
      if (match(r + 1, p + want.length)) return true;
      out.pop();
      return false;
    }
    // A kanji run reads at least one kana per character is too strict (日 → ひ, 一人 → ひとり are
    // fine, 々 repeats); at least one kana in all, at most four per character.
    const max = Math.min(reading.length - p, run.s.length * 4);
    for (let n = 1; n <= max; n++) {
      out.push([run.s, reading.slice(p, p + n)]);
      if (match(r + 1, p + n)) return true;
      out.pop();
    }
    return false;
  }
}
