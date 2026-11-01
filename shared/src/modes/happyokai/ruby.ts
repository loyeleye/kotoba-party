// Happyōkai!'s Japanese is written once, with kanji and their readings in brackets (今日[きょう]は), and
// shown at each player's level: Kana players get kana only, N5 players keep only N5 kanji (with
// furigana), N4 players N5 and N4 kanji. Any other kanji goes back to its reading, so content can be
// written the way a Japanese speaker would write it.

import type { JpText, Level } from '../../../../content/src/types.js';
import { n4Up } from '../../level.js';

type Segments = [base: string, reading: string][];

/** The JLPT N5 kanji. */
const N5 = new Set(
  '一二三四五六七八九十百千万円年月日時分半今午前後毎週曜何上下左右中外北南東西大小長高安新古多少白人男女子父母友先生学校名国語本山川田天気雨電車金木水火土店駅道社会見行来出入休食飲言話聞読書買立口目耳手足花間魚',
);
/** The JLPT N4 kanji (added to N5's at N4). */
const N4 = new Set(
  '悪暗医意以引院員運英映遠屋音歌夏家画海回開界楽館漢寒顔帰起究急牛去強教京業近銀区計兄軽犬研県建験元工広考光好合黒菜作産紙思姉止市仕死使始試私字自事持室質写者借弱首主秋集習終住重春所暑場乗色森心親真進図青正声世赤夕切説洗早走送族村体太待貸台代題短知地池茶着昼注町鳥朝通弟低転都度答冬頭同動堂働特肉売発飯病品不風服物文別勉歩方妹味明門問夜野薬有用洋理旅料力林',
);

const RUBY = /([\p{Script=Han}々]+)\[([^\]]+)\]/gu;

function parse(src: string): Segments {
  const out: Segments = [];
  let last = 0;
  for (const m of src.matchAll(RUBY)) {
    if (m.index! > last) out.push([src.slice(last, m.index), '']);
    out.push([m[1]!, m[2]!]);
    last = m.index! + m[0].length;
  }
  if (last < src.length) out.push([src.slice(last), '']);
  return out;
}

function fromSegments(segs: Segments, en: string): JpText {
  const text = segs.map(([b]) => b).join('');
  const kana = segs.map(([b, r]) => r || b).join('');
  return segs.some(([, r]) => r) ? { text, kana, en, furigana: segs } : { text, kana, en };
}

/** Japanese from bracket notation: 今日[きょう]は 雨[あめ]です。 */
export const rb = (src: string, en: string): JpText => fromSegments(parse(src), en);

/** A JpText back in bracket notation, to build longer sentences from it. */
export const src = (j: JpText): string => (j.furigana?.length ? j.furigana.map(([b, r]) => (r ? `${b}[${r}]` : b)).join('') : j.text);

/** The JpText a player at `level` sees: kanji they can't be expected to read go back to kana. */
export function forLevel(j: JpText, level: Level): JpText {
  if (level === 'kana') return { text: j.kana, kana: j.kana, en: j.en };
  if (!j.furigana?.length) return j;
  const ok = (base: string) => [...base].every((ch) => N5.has(ch) || (n4Up(level) && N4.has(ch)) || !/\p{Script=Han}/u.test(ch));
  return fromSegments(
    j.furigana.map(([b, r]) => (r && !ok(b) ? [r, ''] : [b, r])),
    j.en,
  );
}
