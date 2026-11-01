// Last Train · Read the Signs (駅の案内を読もう). Station signs in kanji: say what one says, or which way to go.
// Kanji as icons, before anyone has to write them (docs/progressive-learning.md): 駅, 出口, 男 and 女 are
// read like traffic signs. N5 and N4 hints are pictures to remember a kanji by, never its reading; a Kana
// player's retry gives the reading to say, since a word never heard can't be recalled.
// Item ids are stable: never rename one once it ships.

import type { LastTrainMinigame, MinigameItem, StationSign } from '../types.js';

const READ = { text: 'これは何と読みますか。', kana: 'これはなんとよみますか。', en: 'What does this sign say?', furigana: [['これは', ''], ['何', 'なん'], ['と', ''], ['読', 'よ'], ['みますか。', '']] as [string, string][] };

type Furigana = [string, string][];

/**
 * One sign to read out loud. The model quotes the sign (「男」です。), since 男です。 can mean "I'm a man".
 * Readings are accepted bare, with です, or as 〜とよみます.
 */
const read = (id: string, level: MinigameItem['level'], sign: StationSign, name: { text: string; kana: string; en: string }, hint: string, extra: string[] = []): MinigameItem => ({
  id: `read-the-signs.${id}`,
  level,
  prompt: READ,
  signs: [sign],
  accepted: [name.kana, `${name.kana}です`, `${name.kana}とよみます`, ...extra],
  model: { text: `「${name.text}」です。`, kana: `${name.kana}です。`, en: `It says “${name.en}”.`, furigana: [['「', ''], [name.text, name.kana], ['」です。', '']] },
  hint,
  timeLimit: 10,
});

type Side = 'left' | 'right' | 'up';
const SIDE = {
  left: { text: '左', kana: 'ひだり', en: 'on the left' },
  right: { text: '右', kana: 'みぎ', en: 'on the right' },
  up: { text: '', kana: 'まっすぐ', en: 'straight ahead' },
} as const;
const FLIP: Record<Side, Side> = { left: 'right', right: 'left', up: 'up' };

/** Every way to say where it is, bare or naming the sign (でぐちはひだりです). */
function answers(side: Side, name: string): string[] {
  if (side === 'up') return ['まっすぐです', 'まっすぐ', 'まえです', 'まえ', 'まっすぐいってください', `${name}はまっすぐです`];
  const k = SIDE[side].kana;
  return [`${k}です`, k, `${k}がわです`, `${k}がわ`, `${k}のほうです`, `${k}のほう`, `${k}にあります`, `${k}がわにあります`, `${name}は${k}です`, `${name}は${k}のほうです`, `${name}は${k}にあります`];
}

interface Place { text: string; kana: string; en: string; furigana: Furigana }

/** The model names the sign: 出口は左です。 */
function placeModel(side: Side, place: Place, hou: boolean): MinigameItem['model'] {
  const s = SIDE[side];
  const word = side === 'up' ? 'まっすぐ' : s.text;
  const tail = `${hou && side !== 'up' ? 'のほう' : ''}です。`;
  return {
    text: `${place.text}は${word}${tail}`,
    kana: `${place.kana}は${s.kana}${tail}`,
    en: `The ${place.en} is ${hou && side !== 'up' ? s.en.replace('on the', 'to the') : s.en}.`,
    furigana: [...place.furigana, ['は', ''], [word, side === 'up' ? '' : s.kana], [tail, '']],
  };
}

/**
 * Which way to go. The question is in kana only, so the sign it asks about never appears in it. The
 * boards are drawn plain on the first try (exit yellow and toilet red would give it away) and half the
 * deals come mirrored, so neither the colour nor the side can stand in for reading.
 */
function where(id: string, level: MinigameItem['level'], question: { kana: string; en: string }, signs: StationSign[], side: Side, place: Place, hint: string, hou = false): MinigameItem {
  return {
    id: `read-the-signs.${id}`,
    level,
    prompt: { text: question.kana, kana: question.kana, en: question.en, furigana: [[question.kana, '']] },
    signs,
    accepted: answers(side, place.kana),
    model: placeModel(side, place, hou),
    mirror: { accepted: answers(FLIP[side], place.kana), model: placeModel(FLIP[side], place, hou) },
    hint,
    timeLimit: 10,
  };
}

const EXIT: Place = { text: '出口', kana: 'でぐち', en: 'exit', furigana: [['出口', 'でぐち']] };
const WOMENS: Place = { text: '女の人のトイレ', kana: 'おんなのひとのトイレ', en: "women's toilet", furigana: [['女', 'おんな'], ['の', ''], ['人', 'ひと'], ['のトイレ', '']] };
const SOUTH: Place = { text: '南口', kana: 'みなみぐち', en: 'south exit', furigana: [['南口', 'みなみぐち']] };
const TICKETS: Place = { text: '切符売り場', kana: 'きっぷうりば', en: 'ticket office', furigana: [['切符', 'きっぷ'], ['売', 'う'], ['り', ''], ['場', 'ば']] };
const EAST: Place = { text: '東口', kana: 'ひがしぐち', en: 'east exit', furigana: [['東口', 'ひがしぐち']] };
const WAITING: Place = { text: '待合室', kana: 'まちあいしつ', en: 'waiting room', furigana: [['待合室', 'まちあいしつ']] };
const FREE_SEATS: Place = { text: '自由席', kana: 'じゆうせき', en: 'non-reserved seats', furigana: [['自由席', 'じゆうせき']] };
const EMERGENCY: Place = { text: '非常口', kana: 'ひじょうぐち', en: 'emergency exit', furigana: [['非常口', 'ひじょうぐち']] };
const PUSH: Place = { text: '押すドア', kana: 'おすドア', en: 'door to push', furigana: [['押', 'お'], ['すドア', '']] };

export const readTheSigns: LastTrainMinigame = {
  id: 'read-the-signs',
  title: { text: '駅の案内を読もう', kana: 'えきのあんないをよもう', en: 'Read the Signs', furigana: [['駅', 'えき'], ['の', ''], ['案内', 'あんない'], ['を', ''], ['読', 'よ'], ['もう', '']] },
  topic: 'reading signs (kanji as icons)',
  promptType: 'picture',
  penalty: false,
  // Most players meet these kanji here for the first time: a miss never sends anyone to the penalty car.
  forgiving: true,
  phase: 5,
  status: 'draft',
  intro: { text: '駅の案内、読めますか？', kana: 'えきのあんない、よめますか？', en: 'Can you read the station signs?', furigana: [['駅', 'えき'], ['の', ''], ['案内', 'あんない'], ['、', ''], ['読', 'よ'], ['めますか？', '']] },
  items: [
    // ---- Kana level: show first, then test. A Kana player may never have heard these words, so the read
    //      items show the reading and the memory picture on the first try, and the player says it out
    //      loud. Kana players are dealt these before the direction items, which then test the same signs
    //      with no reading on them (until the retry). ----
    read('01-eki', 'kana', { text: '駅', reading: 'えき' }, { text: '駅', kana: 'えき', en: 'station' }, 'Memory picture: a horse (馬) on the left. Stations began as horse stops.'),
    read('02-deguchi', 'kana', { text: '出口', kind: 'exit', reading: 'でぐち' }, { text: '出口', kana: 'でぐち', en: 'exit' }, 'Memory picture: 出 as two hills, 口 a doorway. Exits are yellow.'),
    read('03-iriguchi', 'kana', { text: '入口', reading: 'いりぐち' }, { text: '入口', kana: 'いりぐち', en: 'entrance' }, '入 is someone stepping in, 口 a doorway. Careful: 入 is not 人.', ['いりくち', 'いりくちです']),
    read('04-otoko', 'kana', { text: '男', kind: 'men', reading: 'おとこ' }, { text: '男', kana: 'おとこ', en: 'man' }, 'Memory picture: a rice field (田) over strength (力).', ['おとこのひと', 'おとこのひとです']),
    read('05-onna', 'kana', { text: '女', kind: 'women', reading: 'おんな' }, { text: '女', kana: 'おんな', en: 'woman' }, 'Memory picture: a kneeling figure. The women’s is often red.', ['おんなのひと', 'おんなのひとです']),
    where('06-deguchi-doko', 'kana', { kana: 'でぐちはどこですか。', en: 'Where is the exit?' }, [{ text: '出口', kind: 'exit', arrow: 'left', target: true, reading: 'でぐち' }, { text: '入口', arrow: 'right', reading: 'いりぐち' }], 'left', EXIT, '出 (out) has the two hills. 入 (in) is someone stepping in.'),
    where('07-onna-toire', 'kana', { kana: 'おんなのひとのトイレはどこですか。', en: "Where's the women's toilet?" }, [{ text: '男', kind: 'men', arrow: 'left', reading: 'おとこ' }, { text: '女', kind: 'women', arrow: 'right', target: true, reading: 'おんな' }], 'right', WOMENS, '女 is the kneeling figure. 男 has a rice field (田) on top.'),
    // ---- N5: the exits round a big station ----
    read('08-kitaguchi', 'n5', { text: '北口', kind: 'exit' }, { text: '北口', kana: 'きたぐち', en: 'north exit' }, 'Memory picture: 北 as two people sitting back to back. 口 here means exit.'),
    read('09-minamiguchi', 'n5', { text: '南口', kind: 'exit' }, { text: '南口', kana: 'みなみぐち', en: 'south exit' }, 'Memory picture: 南 as a tent with a cross on top. 口 here means exit.'),
    read('10-higashiguchi', 'n5', { text: '東口', kind: 'exit' }, { text: '東口', kana: 'ひがしぐち', en: 'east exit' }, 'Memory picture: 東 as the sun (日) rising behind a tree (木).'),
    read('11-nishiguchi', 'n5', { text: '西口', kind: 'exit' }, { text: '西口', kana: 'にしぐち', en: 'west exit' }, 'Memory picture: 西 as a bird settling into its nest at sunset.'),
    where('13-minamiguchi-doko', 'n5', { kana: 'みなみぐちはどこですか。', en: 'Where is the south exit?' }, [{ text: '北口', kind: 'exit', arrow: 'left' }, { text: '南口', kind: 'exit', arrow: 'right', target: true }], 'right', SOUTH, 'North is two people back to back. South is the tent with a cross.'),
    // ---- N4: inside the gates, and buying a ticket. 切符 is a station icon, read as a whole sign (like 出口).
    // In 乗換 and 乗り場, 乗 counts as an N4 kanji; 改札's 改 and 札 count as sign kanji (goal 3.12). ----
    read('18-chuuouguchi', 'n4', { text: '中央口', kind: 'exit' }, { text: '中央口', kana: 'ちゅうおうぐち', en: 'central exit' }, '中 is a line through the middle of a box. 央 is centre. 口 here means exit.'),
    read('12-kippu', 'n4', { text: '切符' }, { text: '切符', kana: 'きっぷ', en: 'ticket' }, '切 has a knife (刀) in it: the slip you tear off.'),
    where('14-kippu-doko', 'n4', { kana: 'きっぷうりばはどこですか。', en: 'Where do you buy tickets?' }, [{ text: '出口', kind: 'exit', arrow: 'left' }, { text: '切符', arrow: 'up', target: true }], 'up', TICKETS, '切 has a knife (刀) in it. An arrow pointing up means まっすぐ.'),
    read('15-kaisatsu', 'n4', { text: '改札' }, { text: '改札', kana: 'かいさつ', en: 'ticket gates' }, '札 is a wooden tag (木): your ticket. 改 is to check it.', ['かいさつぐち', 'かいさつぐちです']),
    read('16-norikae', 'n4', { text: '乗換' }, { text: '乗換', kana: 'のりかえ', en: 'transfer' }, 'Memory picture: 乗 a person up a tree (riding), 換 a hand swapping.'),
    where('17-higashiguchi-doko', 'n4', { kana: 'ひがしぐちはどちらですか。', en: 'Which way is the east exit?' }, [{ text: '西口', kind: 'exit', arrow: 'left' }, { text: '東口', kind: 'exit', arrow: 'right', target: true }], 'right', EAST, 'East is the sun behind a tree. West is the bird in its nest.', true),
    // ---- N4: the platform at night. Each target sign has an N4 kanji (待 乗 終 使 売), so Read the Signs moves
    // goal 4.10 too (the PR #146 panel found no N4 kanji on any target sign). ----
    read('19-machiaishitsu', 'n4', { text: '待合室' }, { text: '待合室', kana: 'まちあいしつ', en: 'waiting room' }, '待 has a road (彳) on the left: you wait by the road. 室 is a room under a roof.'),
    read('20-noriba', 'n4', { text: '乗り場' }, { text: '乗り場', kana: 'のりば', en: 'boarding point' }, '乗 is a person up a tree: riding. 場 has earth (土) on the left: a place.'),
    read('21-shuuden', 'n4', { text: '終電' }, { text: '終電', kana: 'しゅうでん', en: 'last train' }, '終 has thread (糸) on the left: the end of the thread. 電 is rain (雨) over a spark: electric.'),
    read('22-shiyouchuu', 'n4', { text: '使用中' }, { text: '使用中', kana: 'しようちゅう', en: 'occupied' }, '使 is a person (亻) given a job: use. 中 is a line through the middle of a box: in the middle of it.'),
    read('23-baiten', 'n4', { text: '売店' }, { text: '売店', kana: 'ばいてん', en: 'kiosk' }, '売 has a samurai (士) on top, selling. 店 is a roof (广) over a stall.'),
    where('24-machiaishitsu-doko', 'n4', { kana: 'まちあいしつはどこですか。', en: 'Where is the waiting room?' }, [{ text: '売店', arrow: 'left' }, { text: '待合室', arrow: 'right', target: true }], 'right', WAITING, '待 has a road on its left. 売 has a samurai (士) on top.'),
    // ---- N3: the 30 sign kanji (goal 3.12), read through the sign they're on. Dealt to N3 players once N3 is in
    // the level picker (step 6). ----
    read('25-hijouguchi', 'n3', { text: '非常口' }, { text: '非常口', kana: 'ひじょうぐち', en: 'emergency exit' }, '非 is two rows of bars facing apart: "not". 常 has cloth (巾) under a roof: "usual". The not-usual exit.'),
    read('26-kinen', 'n3', { text: '禁煙' }, { text: '禁煙', kana: 'きんえん', en: 'no smoking' }, '禁 is two trees (林) over an altar (示): forbidden ground. 煙 has fire (火) on the left: smoke.'),
    read('27-kiken', 'n3', { text: '危険' }, { text: '危険', kana: 'きけん', en: 'danger' }, '危 is a person crouching on a cliff edge. 険 has a hill (阝) on the left: steep.'),
    read('28-annaijo', 'n3', { text: '案内所' }, { text: '案内所', kana: 'あんないじょ', en: 'information centre' }, '案 has a tree (木) under a roof: a plan on the table. 内 is someone stepping into a box: inside.', ['あんないしょ', 'あんないしょです']),
    read('29-madoguchi', 'n3', { text: '窓口' }, { text: '窓口', kana: 'まどぐち', en: 'ticket window' }, '窓 has a hole (穴) on top: a window. 口 here is the counter’s opening.'),
    read('30-kaidan', 'n3', { text: '階段' }, { text: '階段', kana: 'かいだん', en: 'stairs' }, '階 has a hill (阝) and two people side by side (比): floors. 段 is steps cut with a tool (殳).'),
    read('31-ryougae', 'n3', { text: '両替' }, { text: '両替', kana: 'りょうがえ', en: 'currency exchange' }, '両 is a balance with two pans: both. 替 is two men (夫) over the sun (日): swapping places.'),
    read('32-otoshimono', 'n3', { text: '落とし物' }, { text: '落とし物', kana: 'おとしもの', en: 'lost property' }, '落 is leaves (艹) and water (氵) falling. 物 has a cow (牛) on the left: a thing.'),
    read('33-hassha', 'n3', { text: '発車' }, { text: '発車', kana: 'はっしゃ', en: 'departing' }, '発 has two feet (癶) on top, setting off. 車 is a cart seen from above.'),
    read('34-yuusenseki', 'n3', { text: '優先席' }, { text: '優先席', kana: 'ゆうせんせき', en: 'priority seats' }, '優 has a person (亻) beside a worried heart: be kind. 先 goes first. 席 is cloth (巾) under a roof: a seat.'),
    read('35-waribiki', 'n3', { text: '割引' }, { text: '割引', kana: 'わりびき', en: 'discount' }, '割 has a knife (刂) on the right: cut the price. 引 is a bow being drawn: pull down.'),
    read('36-muryou', 'n3', { text: '無料' }, { text: '無料', kana: 'むりょう', en: 'free of charge' }, '無 is a dancer with nothing in hand. 料 is rice (米) measured with a ladle (斗): the fee.'),
    read('37-bansen', 'n3', { text: '3番線' }, { text: '3番線', kana: 'さんばんせん', en: 'platform 3' }, '番 is a rice field (田) under a seed: a number in turn. 線 has thread (糸) on the left: a line, the track.', ['ばんせん', 'ばんせんです']),
    read('38-shiteiseki', 'n3', { text: '指定席' }, { text: '指定席', kana: 'していせき', en: 'reserved seats' }, '指 has a hand (扌) on the left: a seat pointed out for you. 定 is a foot settled under a roof: fixed.'),
    where('39-jiyuuseki-doko', 'n3', { kana: 'じゆうせきはどこですか。', en: 'Where are the non-reserved seats?' }, [{ text: '指定席', arrow: 'left' }, { text: '自由席', arrow: 'right', target: true }], 'right', FREE_SEATS, '自 is your own nose: sit where you like. 指 has a hand (扌): a seat pointed out for you.'),
    where('40-hijouguchi-doko', 'n3', { kana: 'ひじょうぐちはどこですか。', en: 'Where is the emergency exit?' }, [{ text: '非常口', arrow: 'left', target: true }, { text: '階段', arrow: 'right' }], 'left', EMERGENCY, '非 is the two rows of bars. 階 has a hill (阝) on its left.'),
    where('41-osu-doa', 'n3', { kana: 'おすドアはどちらですか。', en: 'Which door do you push?' }, [{ text: '引', arrow: 'left' }, { text: '押', arrow: 'right', target: true }], 'right', PUSH, '押 has a hand (扌) on the left: push. 引 is a bow being drawn back: pull.'),
  ],
};
