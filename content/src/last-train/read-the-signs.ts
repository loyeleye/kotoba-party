// Last Train · Read the Signs (看板を読もう). Station signs in kanji: say what one says, or which way to go.
// Kanji as icons, before anyone has to write them (docs/progressive-learning.md): 駅, 出口, 男 and 女 are
// read like traffic signs. Each sign item's hint is a picture to remember it by, never the reading.
// Item ids are stable: never rename one once it ships.

import type { LastTrainMinigame, MinigameItem, StationSign } from '../types.js';

const READ = { text: 'これは何と読みますか。', kana: 'これはなんとよみますか。', en: 'What does this sign say?', furigana: [['これは', ''], ['何', 'なん'], ['と', ''], ['読', 'よ'], ['みますか。', '']] as [string, string][] };

/** One sign to read out loud. */
const read = (id: string, level: MinigameItem['level'], sign: StationSign, accepted: string[], model: MinigameItem['model'], hint: string): MinigameItem => ({
  id: `read-the-signs.${id}`,
  level,
  prompt: READ,
  signs: [sign],
  accepted,
  model,
  hint,
  timeLimit: 10,
});

const LEFT = ['ひだりです', 'ひだり', 'ひだりがわです', 'ひだりがわ', 'ひだりのほうです'];
const RIGHT = ['みぎです', 'みぎ', 'みぎがわです', 'みぎがわ', 'みぎのほうです'];
const LEFT_MODEL = { text: '左です。', kana: 'ひだりです。', en: "It's on the left.", furigana: [['左', 'ひだり'], ['です。', '']] as [string, string][] };
const RIGHT_MODEL = { text: '右です。', kana: 'みぎです。', en: "It's on the right.", furigana: [['右', 'みぎ'], ['です。', '']] as [string, string][] };

export const readTheSigns: LastTrainMinigame = {
  id: 'read-the-signs',
  title: { text: '看板を読もう', kana: 'かんばんをよもう', en: 'Read the Signs', furigana: [['看板', 'かんばん'], ['を', ''], ['読', 'よ'], ['もう', '']] },
  topic: 'reading signs (kanji as icons)',
  promptType: 'picture',
  penalty: false,
  phase: 5,
  status: 'draft',
  intro: { text: '駅の看板、読めますか？', kana: 'えきのかんばん、よめますか？', en: 'Can you read the station signs?', furigana: [['駅', 'えき'], ['の', ''], ['看板', 'かんばん'], ['、', ''], ['読', 'よ'], ['めますか？', '']] },
  items: [
    // ---- Kana level: the signs every traveller needs, read like icons ----
    read('01-eki', 'kana', { text: '駅' }, ['えき', 'えきです'], { text: '駅です。', kana: 'えきです。', en: "It's “station”.", furigana: [['駅', 'えき'], ['です。', '']] }, 'The left half is a horse (馬): stations began as stops to change horses. It means "station".'),
    read('02-deguchi', 'kana', { text: '出口', kind: 'exit' }, ['でぐち', 'でぐちです'], { text: '出口です。', kana: 'でぐちです。', en: "It's “exit”.", furigana: [['出口', 'でぐち'], ['です。', '']] }, '出 is two hills stacked up: going out and over. 口 is a mouth, an opening. Together: the way out. Exits are yellow.'),
    read('03-iriguchi', 'kana', { text: '入口' }, ['いりぐち', 'いりぐちです'], { text: '入口です。', kana: 'いりぐちです。', en: "It's “entrance”.", furigana: [['入口', 'いりぐち'], ['です。', '']] }, '入 looks like someone stepping in through a door. 口 is an opening. Together: the way in.'),
    read('04-otoko', 'kana', { text: '男', kind: 'men' }, ['おとこ', 'おとこです', 'おとこのひと', 'おとこのひとです', 'だんせい', 'だんせいです'], { text: '男です。', kana: 'おとこです。', en: "It's “man” (the men's room).", furigana: [['男', 'おとこ'], ['です。', '']] }, 'A rice field (田) on top of strength (力): the one who works the field. On a toilet door it means the men’s.'),
    read('05-onna', 'kana', { text: '女', kind: 'women' }, ['おんな', 'おんなです', 'おんなのひと', 'おんなのひとです', 'じょせい', 'じょせいです'], { text: '女です。', kana: 'おんなです。', en: "It's “woman” (the women's room).", furigana: [['女', 'おんな'], ['です。', '']] }, 'A figure kneeling with crossed arms. On a toilet door it means the women’s, usually in red.'),
    {
      id: 'read-the-signs.06-deguchi-doko',
      level: 'kana',
      prompt: { text: '出口はどこですか。', kana: 'でぐちはどこですか。', en: 'Where is the exit?', furigana: [['出口', 'でぐち'], ['はどこですか。', '']] },
      signs: [{ text: '出口', kind: 'exit', arrow: 'left' }, { text: '入口', arrow: 'right' }],
      accepted: LEFT,
      model: LEFT_MODEL,
      hint: '出 (out) is the one with two hills. ひだり is left, みぎ is right.',
      timeLimit: 10,
    },
    {
      id: 'read-the-signs.07-onna-toire',
      level: 'kana',
      prompt: { text: '女の人のトイレはどこですか。', kana: 'おんなのひとのトイレはどこですか。', en: "Where's the women's toilet?", furigana: [['女', 'おんな'], ['の', ''], ['人', 'ひと'], ['のトイレはどこですか。', '']] },
      signs: [{ text: '男', kind: 'men', arrow: 'left' }, { text: '女', kind: 'women', arrow: 'right' }],
      accepted: RIGHT,
      model: RIGHT_MODEL,
      hint: '女 is the kneeling figure; 男 has a rice field on top. ひだり is left, みぎ is right.',
      timeLimit: 10,
    },
    // ---- N5: the exits round a big station, and buying a ticket ----
    read('08-kitaguchi', 'n5', { text: '北口' }, ['きたぐち', 'きたぐちです'], { text: '北口です。', kana: 'きたぐちです。', en: "It's “north exit”.", furigana: [['北口', 'きたぐち'], ['です。', '']] }, '北 is two people sitting back to back, turned away from the sun: north. 口 on a station sign is an exit.'),
    read('09-minamiguchi', 'n5', { text: '南口' }, ['みなみぐち', 'みなみぐちです'], { text: '南口です。', kana: 'みなみぐちです。', en: "It's “south exit”.", furigana: [['南口', 'みなみぐち'], ['です。', '']] }, '南 is south: a warm tent with a cross on top. 口 on a station sign is an exit.'),
    read('10-higashiguchi', 'n5', { text: '東口' }, ['ひがしぐち', 'ひがしぐちです'], { text: '東口です。', kana: 'ひがしぐちです。', en: "It's “east exit”.", furigana: [['東口', 'ひがしぐち'], ['です。', '']] }, '東 is the sun (日) rising behind a tree (木): east. 口 on a station sign is an exit.'),
    read('11-nishiguchi', 'n5', { text: '西口' }, ['にしぐち', 'にしぐちです'], { text: '西口です。', kana: 'にしぐちです。', en: "It's “west exit”.", furigana: [['西口', 'にしぐち'], ['です。', '']] }, '西 is a bird settling into its nest at sunset: west. 口 on a station sign is an exit.'),
    read('12-kippu', 'n5', { text: '切符' }, ['きっぷ', 'きっぷです'], { text: '切符です。', kana: 'きっぷです。', en: "It's “ticket”.", furigana: [['切符', 'きっぷ'], ['です。', '']] }, '切 is a knife (刀) cutting: a ticket is the slip you tear off. The ticket machines are under this sign.'),
    {
      id: 'read-the-signs.13-minamiguchi-doko',
      level: 'n5',
      prompt: { text: '南口はどこですか。', kana: 'みなみぐちはどこですか。', en: 'Where is the south exit?', furigana: [['南口', 'みなみぐち'], ['はどこですか。', '']] },
      signs: [{ text: '北口', arrow: 'left' }, { text: '南口', arrow: 'right' }],
      accepted: RIGHT,
      model: RIGHT_MODEL,
      hint: '北 is two people back to back; 南 is a tent with a cross on top.',
      timeLimit: 10,
    },
    {
      id: 'read-the-signs.14-kippu-doko',
      level: 'n5',
      prompt: { text: '切符売り場はどこですか。', kana: 'きっぷうりばはどこですか。', en: 'Where do you buy tickets?', furigana: [['切符売', 'きっぷう'], ['り', ''], ['場', 'ば'], ['はどこですか。', '']] },
      signs: [{ text: '出口', kind: 'exit', arrow: 'left' }, { text: '切符', arrow: 'up' }],
      accepted: ['まっすぐです', 'まっすぐ', 'まえです', 'まえ', 'まっすぐいってください'],
      model: { text: 'まっすぐです。', kana: 'まっすぐです。', en: "It's straight ahead.", furigana: [['まっすぐです。', '']] },
      hint: '切 has a knife in it: the slip you tear off. An arrow pointing up means straight ahead: まっすぐ.',
      timeLimit: 10,
    },
    // ---- N4: inside the gates ----
    read('15-kaisatsu', 'n4', { text: '改札' }, ['かいさつ', 'かいさつです', 'かいさつぐち', 'かいさつぐちです'], { text: '改札です。', kana: 'かいさつです。', en: "It's “ticket gates”.", furigana: [['改札', 'かいさつ'], ['です。', '']] }, '札 is a wooden tag (木 + a hook): your ticket. 改 is to check it. Where tickets are checked: the gates.'),
    read('16-norikae', 'n4', { text: '乗換' }, ['のりかえ', 'のりかえです'], { text: '乗換です。', kana: 'のりかえです。', en: "It's “transfer”.", furigana: [['乗換', 'のりかえ'], ['です。', '']] }, '乗 is a person up in a tree: riding. 換 is a hand swapping one thing for another. Ride, then swap: change trains here.'),
    {
      id: 'read-the-signs.17-higashiguchi-doko',
      level: 'n4',
      prompt: { text: '東口はどちらですか。', kana: 'ひがしぐちはどちらですか。', en: 'Which way is the east exit?', furigana: [['東口', 'ひがしぐち'], ['はどちらですか。', '']] },
      signs: [{ text: '西口', arrow: 'left' }, { text: '東口', arrow: 'right' }],
      accepted: RIGHT,
      model: { text: '右のほうです。', kana: 'みぎのほうです。', en: "It's to the right.", furigana: [['右', 'みぎ'], ['のほうです。', '']] },
      hint: '東 is the sun behind a tree; 西 is a bird in its nest. のほう means "that way".',
      timeLimit: 10,
    },
  ],
};
