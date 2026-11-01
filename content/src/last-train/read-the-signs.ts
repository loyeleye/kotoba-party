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
    read('18-chuuouguchi', 'n5', { text: '中央口', kind: 'exit' }, { text: '中央口', kana: 'ちゅうおうぐち', en: 'central exit' }, '中 is a line through the middle of a box. 央 is centre. 口 here means exit.'),
    where('13-minamiguchi-doko', 'n5', { kana: 'みなみぐちはどこですか。', en: 'Where is the south exit?' }, [{ text: '北口', kind: 'exit', arrow: 'left' }, { text: '南口', kind: 'exit', arrow: 'right', target: true }], 'right', SOUTH, 'North is two people back to back. South is the tent with a cross.'),
    // ---- N4: inside the gates, and buying a ticket (符 is a late kanji, so 切符 waits until N4) ----
    read('12-kippu', 'n4', { text: '切符' }, { text: '切符', kana: 'きっぷ', en: 'ticket' }, '切 has a knife (刀) in it: the slip you tear off.'),
    where('14-kippu-doko', 'n4', { kana: 'きっぷうりばはどこですか。', en: 'Where do you buy tickets?' }, [{ text: '出口', kind: 'exit', arrow: 'left' }, { text: '切符', arrow: 'up', target: true }], 'up', TICKETS, '切 has a knife (刀) in it. An arrow pointing up means まっすぐ.'),
    read('15-kaisatsu', 'n4', { text: '改札' }, { text: '改札', kana: 'かいさつ', en: 'ticket gates' }, '札 is a wooden tag (木): your ticket. 改 is to check it.', ['かいさつぐち', 'かいさつぐちです']),
    read('16-norikae', 'n4', { text: '乗換' }, { text: '乗換', kana: 'のりかえ', en: 'transfer' }, 'Memory picture: 乗 a person up a tree (riding), 換 a hand swapping.'),
    where('17-higashiguchi-doko', 'n4', { kana: 'ひがしぐちはどちらですか。', en: 'Which way is the east exit?' }, [{ text: '西口', kind: 'exit', arrow: 'left' }, { text: '東口', kind: 'exit', arrow: 'right', target: true }], 'right', EAST, 'East is the sun behind a tree. West is the bird in its nest.', true),
  ],
};
