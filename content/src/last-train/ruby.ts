// A short way to write a Last Train line with its furigana: {漢字|かんじ} marks a reading, everything else is
// read as written. ruby('{次|つぎ}は{終点|しゅうてん}。', 'Next is the last stop.') gives text 次は終点。, kana
// つぎはしゅうてん。 and the furigana pairs the stage needs. Used by the Green Car content.

import type { JpText } from '../types.js';

export function ruby(src: string, en: string): JpText {
  const furigana: [string, string][] = [];
  let text = '';
  let kana = '';
  const plain = (s: string) => {
    if (!s) return;
    furigana.push([s, '']);
    text += s;
    kana += s;
  };
  const re = /\{([^|}]+)\|([^}]+)\}/g;
  let last = 0;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    plain(src.slice(last, m.index));
    furigana.push([m[1]!, m[2]!]);
    text += m[1]!;
    kana += m[2]!;
    last = re.lastIndex;
  }
  plain(src.slice(last));
  return { text, kana, en, ...(furigana.some(([, r]) => r) ? { furigana } : {}) };
}
