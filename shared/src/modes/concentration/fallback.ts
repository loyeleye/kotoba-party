// PLACEHOLDER word set. Used only when the content library has no usable topic pack, so the
// mode still runs end to end. Real games draw on the night's pack (content/src/packs).

import type { PackWord } from '../../../../content/src/types.js';

const w = (id: string, text: string, kana: string, en: string, level: PackWord['level'] = 'kana'): PackWord => ({
  id: `concentration.fallback.${id}`,
  jp: { text, kana, en },
  pos: 'noun',
  level,
});

export const FALLBACK_WORDS: readonly PackWord[] = [
  w('sushi', 'すし', 'すし', 'sushi'),
  w('pan', 'パン', 'パン', 'bread'),
  w('ramen', 'ラーメン', 'ラーメン', 'ramen'),
  w('coffee', 'コーヒー', 'コーヒー', 'coffee'),
  w('ringo', 'りんご', 'りんご', 'apple'),
  w('neko', 'ねこ', 'ねこ', 'cat'),
  w('inu', '犬', 'いぬ', 'dog', 'n5'),
  w('mizu', '水', 'みず', 'water', 'n5'),
  w('eki', '駅', 'えき', 'station', 'n5'),
  w('densha', '電車', 'でんしゃ', 'train', 'n5'),
  w('kasa', 'かさ', 'かさ', 'umbrella'),
  w('kagi', 'かぎ', 'かぎ', 'key'),
  w('tori', '鳥', 'とり', 'bird', 'n5'),
  w('ie', '家', 'いえ', 'house', 'n5'),
  w('terebi', 'テレビ', 'テレビ', 'TV'),
  w('sakana', '魚', 'さかな', 'fish', 'n5'),
  w('ocha', 'お茶', 'おちゃ', 'green tea', 'n5'),
  w('tamago', 'たまご', 'たまご', 'egg'),
];
