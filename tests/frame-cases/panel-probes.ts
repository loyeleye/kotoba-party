// Fresh lines from the Japanese expert's review of the frames PR, written by someone who didn't write the
// matchers. Each names frames the line must not get (a wrong frame) and, where a fix made it work, frames it
// must get. Kept as permanent look-alikes.
import type { CaseLine } from './types.js';

export interface Probe {
  line: CaseLine;
  not: string[];
  want?: string[];
}

export const probes: Probe[] = [
  // そう: な-adjective stems, お-row stems, and そうな／そうに (always "looks").
  { line: 'あの ひとは しんせつそうです。', not: ['sou-hear'], want: ['sou-look'] },
  { line: 'かれは うたが へたそうです。', not: ['sou-hear'], want: ['sou-look'] },
  { line: 'この しごとは らくそうです。', not: ['sou-hear'], want: ['sou-look'] },
  { line: 'ねこが さかなを たべたそうな かおを して いる。', not: ['sou-hear'], want: ['sou-look'] },
  { line: 'かれは つよそうです。', not: ['sou-hear'], want: ['sou-look'] },
  { line: 'この えいが、おもしろそう！', not: ['sou-hear'], want: ['sou-look'] },
  // Godan potentials and plain verbs that look like a kana passive; honorific れる; a counter before に.
  { line: 'ホテルに とまれますか。', not: ['passive'] },
  { line: 'つぎの かどを みぎに まがれますか。', not: ['passive'] },
  { line: 'ここに すわれますか。', not: ['passive'] },
  { line: 'ひがしの そらに にじが あらわれました。', not: ['passive'] },
  { line: { text: '八時に起きられますか。', kana: 'はちじにおきられますか。' }, not: ['passive'] },
  { line: { text: '社長はもう帰られました。', kana: 'しゃちょうはもうかえられました。' }, not: ['passive'] },
  // できる = come into being; しられる is a passive.
  { line: 'だれにも しられないように して ください。', not: ['potential'] },
  { line: 'すぐ ともだちが できるよ。', not: ['potential'] },
  // らしい inside an adjective.
  { line: { text: '素晴らしいです！', kana: 'すばらしいです！' }, not: ['rashii'] },
  { line: 'あの こどもは にくらしい。', not: ['rashii'] },
  { line: 'この あかちゃんは あいらしい。', not: ['rashii'] },
  { line: { text: '可愛らしい人形ですね。', kana: 'かわいらしいにんぎょうですね。' }, not: ['rashii'] },
  // Adverbs ending in っと, unspaced; nouns ending in ちゃ／じゃ.
  { line: 'もっとください。', not: ['te-oku', 'teru'] },
  { line: 'きっとくるよ。', not: ['te-oku', 'teru'] },
  { line: 'ずっといたよ。', not: ['te-oku', 'teru'] },
  { line: 'こうちゃって おいしいね。', not: ['te-shimau'] },
  { line: 'にんじゃって かっこいい！', not: ['te-shimau'] },
  { line: 'このまっちゃおいしい！', not: ['te-shimau'] },
  // おもい (heavy), おもって with no quote.
  { line: 'もっと おもい かばんを もって きて。', not: ['to-omou'] },
  { line: 'ずっと おもって いました。', not: ['to-omou'] },
  { line: 'ちいさい とき、よく ないた。', not: ['kunai'] },
  // Past tense んだ.
  { line: 'きのうは いちにち やすんだ。', not: ['n-da'] },
  { line: 'どろぼうが おかねを ぬすんだ。', not: ['n-da'] },
  { line: 'にわとりが たまごを うんだ。', not: ['n-da'] },
  // Casual words that share a keigo verb's spelling.
  { line: 'まいったなあ。', not: ['keigo'] },
  { line: 'それ、ちょうだい！', not: ['keigo'] },
  { line: 'ちょっと たべて ごらん。', not: ['keigo'] },
  // Yes-or-no embedded questions.
  { line: 'いつも あさごはんを たべるか おしえて ください。', not: ['nani-ka'] },
  { line: 'なにも たべないか きいて みて。', not: ['nani-ka'] },
  // ように = "as".
  { line: 'みんなが しって いる ように、かれは ゆうめいです。', not: ['you-ni'] },
  { line: 'しごとが おもう ように いかない。', not: ['you-ni'] },
  { line: 'テストの まえに べんきょうします。', not: ['migi-hidari'] },
  { line: 'こどもに やさいを たべさせました。', not: ['ni-masu'] },
  { line: 'じつは あした ひっこすんです。', not: ['wa-desu'] },
  { line: 'たかい うちに ひっこしました。', not: ['uchi-ni'] },
  { line: 'かれが くる ために、へやを そうじしました。', not: ['tame-ni'] },
  { line: 'せまいながらも たのしい わがやです。', not: ['nagara'] },
  { line: 'せんせいに ほめられました。', not: ['ni-masu'] },
  // Plain forms count toward the polite frames (Ladi, Nov 1).
  { line: 'まどを あけて もらえる？', not: [], want: ['te-moraeru'] },
  { line: 'ちょっと てつだって くれない？', not: [], want: ['te-kuremasen'] },
  { line: 'すしが たべたいな。', not: [], want: ['tai'] },
  { line: 'にほんに いきたい！', not: [], want: ['tai'] },
  { line: 'わすれないで ね。', not: [], want: ['naide-kudasai'] },
  { line: 'なかないで！', not: [], want: ['naide-kudasai'] },
  { line: 'あさごはんを たべないで、がっこうに いきました。', not: ['naide-kudasai'] },
  { line: 'ねこみたいな いぬ。', not: ['tai'] },
  // Lines the fixes above must not break.
  { line: 'わたしは かいしゃいんです。', not: [], want: ['wa-desu'] },
  { line: 'あらまあ、くびが からまっちゃった！', not: [], want: ['te-shimau'] },
  { line: 'あとでやっとくね。', not: [], want: ['te-oku'] },
  { line: 'みんなに わらわれた。', not: [], want: ['passive'] },
];
