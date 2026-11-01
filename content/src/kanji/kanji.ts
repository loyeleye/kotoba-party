// The kanji Shodō Taikai (the Calligraphy Contest) asks players to write, in writing order (not
// frequency), from the Japanese expert panel's starter list (2026-10-27). N5 players write steps
// 1–7 (70 kanji); N4 players get steps 8–11 (60 N4 kanji), with N5 kanji as review. Step 11 is the
// N4 kanji the game's own N4 lines use (思う, 持って, 待って, 使えます, 会社, 教室…), added after
// the PR #146 panel. Steps 12–14 are the 30 sign kanji of goal 3.12 (N3 players): kanji read on
// station and inn signs, each said through its sign word (受 → 受付, 禁 → 禁煙). JLPT has published
// no official kanji lists since 2010, so the level bands are our own draft picks; "sign kanji" is
// what the game calls the N3 set, never "N3 kanji", since 30 is a small part of what N3 adds.
//
// Each kanji has one "say word": the word players say aloud for it, never a reading on its own
// (日 alone could be ひ, にち or か). A kanji that is a word by itself says that word (山 やま);
// any other says a common word that contains it (日 → 毎日 まいにち). A sign kanji says the sign
// it's read on, even when that's a word of two or three kanji (常 → 非常口 ひじょうぐち).
//
// Stroke data comes from KanjiVG (content/src/kanji/strokes.ts, generated). Everything here is
// `draft` until a fluent speaker checks it.

import type { JpText, ReviewStatus } from '../types.js';

export interface WriteKanji {
  /** Stable id: `kj-` and the character. */
  id: string;
  char: string;
  level: KanjiLevel;
  /** Writing order: lower steps first. */
  step: number;
  /** A short English meaning of the character. */
  meaning: string;
  /** What players say for it. */
  say: JpText;
  status: ReviewStatus;
}

/** The N3 set is the 30 sign kanji (goal 3.12). */
export type KanjiLevel = 'n5' | 'n4' | 'n3';

/** A word written in two or more kanji, one grid cell each (N4 dictation). */
export interface WriteWord {
  id: string;
  word: JpText;
  status: ReviewStatus;
}

/** [char, meaning, say text, say kana, say en] */
type Row = [char: string, meaning: string, text: string, kana: string, en: string];

const steps: { level: KanjiLevel; rows: Row[] }[] = [
  // 1 · Numbers
  {
    level: 'n5',
    rows: [
      ['一', 'one', '一', 'いち', 'one'],
      ['二', 'two', '二', 'に', 'two'],
      ['三', 'three', '三', 'さん', 'three'],
      ['十', 'ten', '十', 'じゅう', 'ten'],
      ['八', 'eight', '八', 'はち', 'eight'],
      ['九', 'nine', '九', 'きゅう', 'nine'],
      ['七', 'seven', '七', 'なな', 'seven'],
      ['千', 'thousand', '千', 'せん', 'a thousand'],
      ['万', 'ten thousand', '一万', 'いちまん', 'ten thousand'],
    ],
  },
  // 2 · Pictures
  {
    level: 'n5',
    rows: [
      ['人', 'person', '人', 'ひと', 'a person'],
      ['口', 'mouth', '口', 'くち', 'a mouth'],
      ['山', 'mountain', '山', 'やま', 'a mountain'],
      ['川', 'river', '川', 'かわ', 'a river'],
      ['日', 'sun, day', '毎日', 'まいにち', 'every day'],
      ['月', 'moon, month', '月', 'つき', 'the moon'],
      ['火', 'fire', '火', 'ひ', 'fire'],
      ['水', 'water', '水', 'みず', 'water'],
      ['木', 'tree', '木', 'き', 'a tree'],
    ],
  },
  // 3 · Place and size
  {
    level: 'n5',
    rows: [
      ['上', 'up, above', '上', 'うえ', 'up, on top'],
      ['下', 'down, below', '下', 'した', 'down, below'],
      ['中', 'middle, inside', '中', 'なか', 'inside'],
      ['大', 'big', '大きい', 'おおきい', 'big'],
      ['小', 'small', '小さい', 'ちいさい', 'small'],
      ['子', 'child', '子ども', 'こども', 'a child'],
      ['女', 'woman', '女の人', 'おんなのひと', 'a woman'],
      ['土', 'soil, earth', '土曜日', 'どようび', 'Saturday'],
    ],
  },
  // 4 · Order lessons (右 and 左 share a top but start differently)
  {
    level: 'n5',
    rows: [
      ['右', 'right', '右', 'みぎ', 'right'],
      ['左', 'left', '左', 'ひだり', 'left'],
      ['四', 'four', '四', 'よん', 'four'],
      ['五', 'five', '五', 'ご', 'five'],
      ['六', 'six', '六', 'ろく', 'six'],
      ['円', 'yen, circle', '百円', 'ひゃくえん', 'a hundred yen'],
      ['今', 'now', '今', 'いま', 'now'],
      ['手', 'hand', '手', 'て', 'a hand'],
      ['父', 'father', '父', 'ちち', 'my father'],
    ],
  },
  // 5 · Everyday
  {
    level: 'n5',
    rows: [
      ['本', 'book, origin', '本', 'ほん', 'a book'],
      ['目', 'eye', '目', 'め', 'an eye'],
      ['白', 'white', '白い', 'しろい', 'white'],
      ['出', 'go out', '出る', 'でる', 'to go out'],
      ['半', 'half', '半分', 'はんぶん', 'half'],
      ['生', 'life, birth', '先生', 'せんせい', 'a teacher'],
      ['母', 'mother', '母', 'はは', 'my mother'],
      ['北', 'north', '北', 'きた', 'north'],
      ['外', 'outside', '外', 'そと', 'outside'],
      ['分', 'minute, part', '分かる', 'わかる', 'to understand'],
    ],
  },
  // 6 · Six and seven strokes
  {
    level: 'n5',
    rows: [
      ['年', 'year', '来年', 'らいねん', 'next year'],
      ['名', 'name', '名前', 'なまえ', 'a name'],
      ['先', 'ahead, previous', '先週', 'せんしゅう', 'last week'],
      ['気', 'spirit, air', '元気', 'げんき', 'well, lively'],
      ['休', 'rest', '休み', 'やすみ', 'a day off'],
      ['百', 'hundred', '百', 'ひゃく', 'a hundred'],
      ['行', 'go', '行く', 'いく', 'to go'],
      ['何', 'what', '何', 'なに', 'what'],
      ['見', 'see', '見る', 'みる', 'to see'],
      ['来', 'come', '来る', 'くる', 'to come'],
      ['男', 'man', '男の人', 'おとこのひと', 'a man'],
      ['車', 'car, wheel', '車', 'くるま', 'a car'],
      ['西', 'west', '西', 'にし', 'west'],
    ],
  },
  // 7 · Stretch (8–10 strokes)
  {
    level: 'n5',
    rows: [
      ['金', 'gold, money', 'お金', 'おかね', 'money'],
      ['雨', 'rain', '雨', 'あめ', 'rain'],
      ['東', 'east', '東', 'ひがし', 'east'],
      ['南', 'south', '南', 'みなみ', 'south'],
      ['時', 'time, hour', '時間', 'じかん', 'time'],
      ['学', 'study', '学生', 'がくせい', 'a student'],
      ['食', 'eat', '食べる', 'たべる', 'to eat'],
      ['前', 'front, before', '前', 'まえ', 'in front'],
      ['後', 'behind, after', '後ろ', 'うしろ', 'behind'],
      ['校', 'school', '学校', 'がっこう', 'a school'],
      ['高', 'tall, expensive', '高い', 'たかい', 'tall, expensive'],
      ['書', 'write', '書く', 'かく', 'to write'],
    ],
  },
  // 8 · N4: short shapes
  {
    level: 'n4',
    rows: [
      ['力', 'power', '力', 'ちから', 'strength'],
      ['心', 'heart', '心', 'こころ', 'heart, mind'],
      ['犬', 'dog', '犬', 'いぬ', 'a dog'],
      ['牛', 'cow', '牛', 'うし', 'a cow'],
      ['夕', 'evening', '夕方', 'ゆうがた', 'evening'],
      ['元', 'origin', '元気', 'げんき', 'well, lively'],
      ['天', 'sky, heaven', '天気', 'てんき', 'the weather'],
      ['友', 'friend', '友だち', 'ともだち', 'a friend'],
      ['引', 'pull', '引く', 'ひく', 'to pull'],
      ['止', 'stop', '止まる', 'とまる', 'to stop'],
      ['公', 'public', '公園', 'こうえん', 'a park'],
      ['冬', 'winter', '冬', 'ふゆ', 'winter'],
      ['少', 'a little', '少し', 'すこし', 'a little'],
      ['田', 'rice field', '田んぼ', 'たんぼ', 'a rice paddy'],
      ['正', 'correct', '正しい', 'ただしい', 'correct'],
    ],
  },
  // 9 · N4: six and seven strokes
  {
    level: 'n4',
    rows: [
      ['字', 'letter', '字', 'じ', 'a written character'],
      ['自', 'self', '自分', 'じぶん', 'oneself'],
      ['色', 'colour', '色', 'いろ', 'a colour'],
      ['光', 'light', '光', 'ひかり', 'light'],
      ['地', 'ground', '地図', 'ちず', 'a map'],
      ['同', 'same', '同じ', 'おなじ', 'the same'],
      ['早', 'early', '早い', 'はやい', 'early'],
      ['考', 'think', '考える', 'かんがえる', 'to think'],
      ['足', 'foot, leg', '足', 'あし', 'a foot, a leg'],
      ['赤', 'red', '赤い', 'あかい', 'red'],
      ['町', 'town', '町', 'まち', 'a town'],
      ['体', 'body', '体', 'からだ', 'a body'],
      ['作', 'make', '作る', 'つくる', 'to make'],
      ['花', 'flower', '花', 'はな', 'a flower'],
      ['社', 'company, shrine', '会社', 'かいしゃ', 'a company'],
      ['私', 'I, private', '私', 'わたし', 'I, me'],
      ['医', 'medicine', '医者', 'いしゃ', 'a doctor'],
      ['走', 'run', '走る', 'はしる', 'to run'],
    ],
  },
  // 10 · N4: eight and nine strokes
  {
    level: 'n4',
    rows: [
      ['青', 'blue', '青い', 'あおい', 'blue'],
      ['店', 'shop', '店', 'みせ', 'a shop'],
      ['夜', 'night', '夜', 'よる', 'night'],
      ['歩', 'walk', '歩く', 'あるく', 'to walk'],
      ['近', 'near', '近い', 'ちかい', 'near'],
      ['春', 'spring', '春', 'はる', 'spring'],
      ['秋', 'autumn', '秋', 'あき', 'autumn'],
      ['昼', 'noon', '昼', 'ひる', 'noon'],
      ['音', 'sound', '音', 'おと', 'a sound'],
      ['屋', 'shop, roof', '本屋', 'ほんや', 'a bookshop'],
      ['室', 'room', '教室', 'きょうしつ', 'a classroom'],
      ['海', 'sea', '海', 'うみ', 'the sea'],
    ],
  },
  // 11 · N4: verbs and places the game's own N4 lines use (JLPT and Japanese seats, PR #146)
  {
    level: 'n4',
    rows: [
      ['写', 'copy', '写真', 'しゃしん', 'a photo'],
      ['会', 'meet', '会う', 'あう', 'to meet'],
      ['売', 'sell', '売る', 'うる', 'to sell'],
      ['使', 'use', '使う', 'つかう', 'to use'],
      ['待', 'wait', '待つ', 'まつ', 'to wait'],
      ['持', 'hold', '持つ', 'もつ', 'to hold, to have'],
      ['思', 'think', '思う', 'おもう', 'to think'],
      ['計', 'measure', '時計', 'とけい', 'a clock'],
      ['映', 'reflect, project', '映画', 'えいが', 'a film'],
      ['乗', 'ride', '乗る', 'のる', 'to ride'],
      ['夏', 'summer', '夏', 'なつ', 'summer'],
      ['教', 'teach', '教える', 'おしえる', 'to teach'],
      ['終', 'end', '終わる', 'おわる', 'to end'],
      ['堂', 'hall', '食堂', 'しょくどう', 'a dining hall'],
      ['着', 'wear, arrive', '着る', 'きる', 'to wear'],
    ],
  },
  // 12 · Sign kanji (goal 3.12): at the station
  {
    level: 'n3',
    rows: [
      ['由', 'reason, freedom', '自由席', 'じゆうせき', 'a non-reserved seat'],
      ['札', 'tag, ticket', '改札', 'かいさつ', 'the ticket gates'],
      ['改', 'renew, inspect', '改札', 'かいさつ', 'the ticket gates'],
      ['定', 'fixed', '指定席', 'していせき', 'a reserved seat'],
      ['両', 'both', '両替', 'りょうがえ', 'currency exchange'],
      ['発', 'depart', '発車', 'はっしゃ', 'departure (of a train)'],
      ['指', 'finger, point', '指定席', 'していせき', 'a reserved seat'],
      ['席', 'seat', '席', 'せき', 'a seat'],
      ['替', 'swap', '両替', 'りょうがえ', 'currency exchange'],
      ['窓', 'window', '窓口', 'まどぐち', 'a ticket window'],
      ['線', 'line, track', '番線', 'ばんせん', 'a platform (track number)'],
      ['優', 'kind, priority', '優先席', 'ゆうせんせき', 'a priority seat'],
    ],
  },
  // 13 · Sign kanji (goal 3.12): safety
  {
    level: 'n3',
    rows: [
      ['危', 'danger', '危険', 'きけん', 'danger'],
      ['非', 'not', '非常口', 'ひじょうぐち', 'an emergency exit'],
      ['押', 'push', '押す', 'おす', 'to push'],
      ['段', 'step', '階段', 'かいだん', 'stairs'],
      ['常', 'usual', '非常口', 'ひじょうぐち', 'an emergency exit'],
      ['険', 'steep, risky', '危険', 'きけん', 'danger'],
      ['階', 'floor', '階段', 'かいだん', 'stairs'],
      ['禁', 'forbid', '禁煙', 'きんえん', 'no smoking'],
      ['煙', 'smoke', '禁煙', 'きんえん', 'no smoking'],
    ],
  },
  // 14 · Sign kanji (goal 3.12): at the inn and the shop
  {
    level: 'n3',
    rows: [
      ['予', 'in advance', '予約', 'よやく', 'a reservation'],
      ['内', 'inside', '案内', 'あんない', 'information, guidance'],
      ['付', 'attach', '受付', 'うけつけ', 'reception'],
      ['受', 'receive', '受付', 'うけつけ', 'reception'],
      ['約', 'promise', '予約', 'よやく', 'a reservation'],
      ['案', 'plan, guide', '案内', 'あんない', 'information, guidance'],
      ['割', 'divide', '割引', 'わりびき', 'a discount'],
      ['無', 'nothing', '無料', 'むりょう', 'free of charge'],
      ['落', 'fall', '落とし物', 'おとしもの', 'lost property'],
    ],
  },
];

export const writeKanji: WriteKanji[] = steps.flatMap((s, i) =>
  s.rows.map(([char, meaning, text, kana, en]) => ({ id: `kj-${char}`, char, level: s.level, step: i + 1, meaning, say: { text, kana, en }, status: 'draft' as const })),
);

/** Two-kanji words for N4 dictation: every kanji in them is in `writeKanji`. */
export const writeWords: WriteWord[] = (
  [
    ['学生', 'がくせい', 'a student'],
    ['先生', 'せんせい', 'a teacher'],
    ['大学', 'だいがく', 'a university'],
    ['日本', 'にほん', 'Japan'],
    ['上手', 'じょうず', 'good at'],
    ['火山', 'かざん', 'a volcano'],
    ['人口', 'じんこう', 'population'],
    ['来年', 'らいねん', 'next year'],
    ['名前', 'なまえ', 'a name'],
    ['元気', 'げんき', 'well, lively'],
    ['天気', 'てんき', 'the weather'],
    ['子犬', 'こいぬ', 'a puppy'],
    ['花火', 'はなび', 'fireworks'],
    ['水車', 'すいしゃ', 'a water wheel'],
    // N4 kanji in words (PR #146: N4 dictation was mostly N5 kanji).
    ['会社', 'かいしゃ', 'a company'],
    ['教室', 'きょうしつ', 'a classroom'],
    ['自分', 'じぶん', 'oneself'],
    ['食堂', 'しょくどう', 'a dining hall'],
    ['時計', 'とけい', 'a clock'],
    ['売店', 'ばいてん', 'a kiosk'],
    ['本屋', 'ほんや', 'a bookshop'],
    ['体力', 'たいりょく', 'stamina'],
    // Sign words (goal 3.12): the signs themselves, two or three kanji each.
    ['改札', 'かいさつ', 'the ticket gates'],
    ['窓口', 'まどぐち', 'a ticket window'],
    ['発車', 'はっしゃ', 'departure (of a train)'],
    ['指定席', 'していせき', 'a reserved seat'],
    ['自由席', 'じゆうせき', 'a non-reserved seat'],
    ['優先席', 'ゆうせんせき', 'a priority seat'],
    ['両替', 'りょうがえ', 'currency exchange'],
    ['非常口', 'ひじょうぐち', 'an emergency exit'],
    ['禁煙', 'きんえん', 'no smoking'],
    ['危険', 'きけん', 'danger'],
    ['階段', 'かいだん', 'stairs'],
    ['受付', 'うけつけ', 'reception'],
    ['予約', 'よやく', 'a reservation'],
    ['案内', 'あんない', 'information, guidance'],
    ['割引', 'わりびき', 'a discount'],
  ] as const
)
  .filter(([text]) => [...text].every((c) => writeKanji.some((k) => k.char === c)))
  .map(([text, kana, en]) => ({ id: `kw-${text}`, word: { text, kana, en }, status: 'draft' as const }));
