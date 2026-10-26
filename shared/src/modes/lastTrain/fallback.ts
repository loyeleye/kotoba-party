// PLACEHOLDER content for Last Train, used only when the content library has no Last Train
// minigames or scenarios (tests, a broken content build). The real, fluent-checked content
// lives in content/src/last-train. Keep this set tiny and obviously correct.

import type { JpText, LastTrainMinigame, LastTrainScenario, MinigameItem } from '../../../../content/src/types.js';

const t = (text: string, kana: string, en: string): JpText => ({ text, kana, en });

function item(id: string, level: MinigameItem['level'], prompt: JpText, accepted: string[], model: JpText, hint: string, visual?: string, timeLimit = 10): MinigameItem {
  return { id: `fallback.${id}`, level, prompt, accepted, model, hint, visual, timeLimit };
}

export const FALLBACK_MINIGAMES: LastTrainMinigame[] = [
  {
    id: 'konbini-math',
    title: t('コンビニ計算', 'コンビニけいさん', 'Konbini Math'),
    topic: 'numbers and prices',
    promptType: 'spoken-question',
    penalty: false,
    phase: 1,
    status: 'draft',
    intro: t('全部でいくら？', 'ぜんぶでいくら？', 'What’s the total?'),
    items: [
      item('km.300', 'kana', t('パンは百円、お茶は二百円。全部でいくら？', 'パンはひゃくえん、おちゃはにひゃくえん。ぜんぶでいくら？', 'Bread 100 yen, tea 200 yen. Total?'), ['さんびゃくえん', 'さんびゃくえんです', 'さんびゃく'], t('三百円です。', 'さんびゃくえんです。', 'It’s 300 yen.'), 'After さん, ひゃく becomes びゃく.', 'Tags: bread ¥100, tea ¥200'),
      item('km.200', 'kana', t('ガムは百円、あめは百円。全部でいくら？', 'ガムはひゃくえん、あめはひゃくえん。ぜんぶでいくら？', 'Gum 100 yen, candy 100 yen. Total?'), ['にひゃくえん', 'にひゃくえんです', 'にひゃく'], t('二百円です。', 'にひゃくえんです。', 'It’s 200 yen.'), 'Two hundreds: に + ひゃく.', 'Tags: gum ¥100, candy ¥100'),
      item('km.600', 'n5', t('アイスは五百円、ガムは百円。全部でいくらですか。', 'アイスはごひゃくえん、ガムはひゃくえん。ぜんぶでいくらですか。', 'Ice cream 500 yen, gum 100 yen. How much in total?'), ['ろっぴゃくえん', 'ろっぴゃくえんです', 'ろっぴゃく'], t('六百円です。', 'ろっぴゃくえんです。', 'It’s 600 yen.'), 'ろく + ひゃく squeeze into ろっぴゃく.', 'Tags: ice cream ¥500, gum ¥100'),
      item('km.800', 'n5', t('お弁当は五百円、お茶は三百円。全部でいくらですか。', 'おべんとうはごひゃくえん、おちゃはさんびゃくえん。ぜんぶでいくらですか。', 'Bento 500 yen, tea 300 yen. How much in total?'), ['はっぴゃくえん', 'はっぴゃくえんです', 'はっぴゃく'], t('八百円です。', 'はっぴゃくえんです。', 'It’s 800 yen.'), 'はち + ひゃく squeeze into はっぴゃく.', 'Tags: bento ¥500, tea ¥300'),
    ],
  },
  {
    id: 'meet-the-innkeeper',
    title: t('旅館の人', 'りょかんのひと', 'Meet the Innkeeper'),
    topic: 'greetings',
    promptType: 'spoken-question',
    penalty: false,
    phase: 1,
    status: 'draft',
    intro: t('旅館に着きました。あいさつしてください。', 'りょかんにつきました。あいさつしてください。', 'You’ve reached the inn. Greet the innkeeper.'),
    items: [
      item('mi.morning', 'kana', t('朝です。何と言いますか。', 'あさです。なんといいますか。', 'It’s morning. What do you say?'), ['おはようございます', 'おはよう'], t('おはようございます。', 'おはようございます。', 'Good morning.'), 'The morning greeting starts with お.'),
      item('mi.evening', 'kana', t('夜です。何と言いますか。', 'よるです。なんといいますか。', 'It’s evening. What do you say?'), ['こんばんは', 'こんばんわ'], t('こんばんは。', 'こんばんは。', 'Good evening.'), 'The evening greeting starts with こん.'),
      item('mi.thanks', 'n5', t('お茶をもらいました。何と言いますか。', 'おちゃをもらいました。なんといいますか。', 'You were given tea. What do you say?'), ['ありがとうございます', 'ありがとう', 'どうもありがとうございます'], t('ありがとうございます。', 'ありがとうございます。', 'Thank you very much.'), 'The polite thank-you ends in ございます.'),
      item('mi.night', 'n5', t('もう寝ます。何と言いますか。', 'もうねます。なんといいますか。', 'You’re off to bed. What do you say?'), ['おやすみなさい', 'おやすみ'], t('おやすみなさい。', 'おやすみなさい。', 'Good night.'), 'Good night starts with おやすみ.'),
    ],
  },
  {
    id: 'counter-chaos',
    title: t('数え方カオス', 'かぞえかたカオス', 'Counter Chaos'),
    topic: 'counters',
    promptType: 'picture',
    penalty: true,
    phase: 4,
    status: 'draft',
    intro: t('いくつありますか。', 'いくつありますか。', 'How many are there?'),
    items: [
      item('cc.two', 'kana', t('りんごはいくつ？', 'りんごはいくつ？', 'How many apples?'), ['ふたつ', 'ふたつです'], t('二つです。', 'ふたつです。', 'Two.'), 'One, two: ひとつ, ふたつ.', 'Two apples', 8),
      item('cc.three', 'kana', t('りんごはいくつ？', 'りんごはいくつ？', 'How many apples?'), ['みっつ', 'みっつです'], t('三つです。', 'みっつです。', 'Three.'), 'ひとつ, ふたつ, then a small っ.', 'Three apples', 8),
      item('cc.pens', 'n5', t('ペンは何本ですか。', 'ペンはなんぼんですか。', 'How many pens?'), ['さんぼん', 'さんぼんです'], t('三本です。', 'さんぼんです。', 'Three.'), 'After さん, ほん becomes ぼん.', 'Three pens', 8),
      item('cc.tickets', 'n5', t('切符は何枚ですか。', 'きっぷはなんまいですか。', 'How many tickets?'), ['にまい', 'にまいです'], t('二枚です。', 'にまいです。', 'Two.'), 'Flat things count with まい.', 'Two tickets', 8),
    ],
  },
];

const DASH: MinigameItem[] = [
  item('dash.eki', 'kana', t('「station」は日本語で？', '「station」はにほんごで？', '"Station" in Japanese?'), ['えき'], t('駅', 'えき', 'station'), 'え + き.', undefined, 6),
  item('dash.densha', 'kana', t('「train」は日本語で？', '「train」はにほんごで？', '"Train" in Japanese?'), ['でんしゃ'], t('電車', 'でんしゃ', 'train'), 'でん + しゃ.', undefined, 6),
  item('dash.hai', 'kana', t('「yes」は日本語で？', '「yes」はにほんごで？', '"Yes" in Japanese?'), ['はい'], t('はい', 'はい', 'yes'), 'Two kana: は + い.', undefined, 6),
  item('dash.mizu', 'kana', t('「water」は日本語で？', '「water」はにほんごで？', '"Water" in Japanese?'), ['みず', 'おみず'], t('水', 'みず', 'water'), 'み + ず.', undefined, 6),
  item('dash.kippu', 'kana', t('「ticket」は日本語で？', '「ticket」はにほんごで？', '"Ticket" in Japanese?'), ['きっぷ', 'チケット'], t('切符', 'きっぷ', 'ticket'), 'き, small っ, ぷ.', undefined, 6),
  item('dash.sumimasen', 'kana', t('「excuse me」は日本語で？', '「excuse me」はにほんごで？', '"Excuse me" in Japanese?'), ['すみません'], t('すみません', 'すみません', 'excuse me'), 'すみ + ません.', undefined, 6),
];

export const FALLBACK_SCENARIO: LastTrainScenario = {
  id: 'fallback-line',
  title: t('最終電車', 'さいしゅうでんしゃ', 'The Last Train'),
  departure: t('最終電車、まもなく発車します！', 'さいしゅうでんしゃ、まもなくはっしゃします！', 'The last train is about to depart!'),
  stops: [
    { id: 'fallback.konbini', name: t('コンビニ前', 'コンビニまえ', 'Konbini-mae'), minigameId: 'konbini-math', announcement: t('次はコンビニ前です。', 'つぎはコンビニまえです。', 'Next: Konbini-mae.') },
    { id: 'fallback.ryokan', name: t('旅館前', 'りょかんまえ', 'Ryokan-mae'), minigameId: 'meet-the-innkeeper', announcement: t('次は旅館前です。', 'つぎはりょかんまえです。', 'Next: Ryokan-mae.') },
    { id: 'fallback.kozeni', name: t('小銭坂', 'こぜにざか', 'Kozeni-zaka'), minigameId: 'konbini-math', announcement: t('次は小銭坂です。', 'つぎはこぜにざかです。', 'Next: Small Change Hill.') },
    { id: 'fallback.onsen', name: t('温泉口', 'おんせんぐち', 'Onsen-guchi'), minigameId: 'meet-the-innkeeper', announcement: t('終点、温泉口です。', 'しゅうてん、おんせんぐちです。', 'Last stop: Onsen-guchi.') },
  ],
  twist: t('実は……この電車は、幽霊電車です！', 'じつは……このでんしゃは、ゆうれいでんしゃです！', 'The truth is… this is a ghost train!'),
  platformDash: DASH,
  status: 'draft',
};

/** Station names for stops built when a scenario is short (PLACEHOLDER, fictional). */
export const SPARE_STOP_NAMES: JpText[] = [
  t('提灯橋', 'ちょうちんばし', 'Chōchin Bridge'),
  t('狐坂', 'きつねざか', 'Fox Hill'),
  t('河童川', 'かっぱがわ', 'Kappa River'),
  t('月見台', 'つきみだい', 'Moon-viewing Heights'),
  t('夜桜通り', 'よざくらどおり', 'Night Blossom Street'),
  t('狸山', 'たぬきやま', 'Tanuki Mountain'),
];
