// Happyōkai!'s content: talk titles, slides, mishaps, question cards and the presenter's lines.
// See docs/modes/happyokai.md. All Japanese is draft until the fluent check. It is written with kanji and
// their readings in brackets (猫[ねこ]の 仕事[しごと]), and each player sees it at their level (see ruby.ts).
//
// A title is what the presenter talks about; the slides are pictures the assistant deals them, so the
// comedy is in joining the two. Every title is a noun phrase (it has to fit 「〜に ついて はなします」)
// with a topic noun, and the ready sentences bridge any slide back to it: 「これが ドラゴンです！」 over a
// picture of a single sock. Every slide is a picture with one word; its kind (living, place, food,
// thing) picks frames and verbs that fit it, so nobody is offered 「かっぱで 〜を しました」.
//
// Two N4 decks, for N4 presenters only: "Then and now" (goal 4.12: ＿ように なりました, ＿ことに
// しました, ＿ことに なりました) and "If I were…" (もし ＿だったら). A deck is a set of titles plus its own
// slide frames, ready sentences (the cue cards), question cards and answer frames; the slides are the
// usual ones. Everyone else keeps the usual titles and lines.

import type { JpText, Level, ReviewStatus } from '../../../../content/src/types.js';
import type { Audience } from '../../protocol.js';
import { forLevel, rb, src } from './ruby.js';

/** What a title or slide is about, for the assistant's "fits the title" choice. */
export type Tag = 'animal' | 'yokai' | 'food' | 'place' | 'person' | 'thing' | 'home' | 'school' | 'work' | 'love' | 'travel' | 'space' | 'fun';

export interface Title {
  id: string;
  jp: JpText;
  /** The noun the talk is about, for bridge sentences (これが 〔topic〕です). */
  topic: JpText;
  tags: readonly Tag[];
  audiences: readonly Audience[];
  /** An N4 deck's title: offered only to N4 presenters. */
  deck?: Deck;
  /**
   * A Then and now title about a place (私の 町): the topic can't go places or marry anything, so its
   * sentences say what the place used to be like (`before`, a clause ending in です/でした, in its own
   * words so a town is never said to have become a town) and what you can do there now.
   */
  place?: PlaceTopic;
}

/** What a place topic was like before: 「静[しず]かでした」 → 「私の 町は 前は 静かでしたが、今では …」. */
export interface PlaceTopic {
  before: string;
  /** "used to be quiet", after the topic's English. */
  beforeEn: string;
}

/** The N4 decks. */
export type Deck = 'then-now' | 'if';

export const DECKS: Record<Deck, { name: JpText; frames: readonly string[]; status: ReviewStatus }> = {
  'then-now': { name: rb('昔[むかし]と 今[いま]', 'Then and now'), frames: ['you-ni-naru', 'koto-ni-suru', 'koto-ni-naru', 'potential'], status: 'draft' },
  if: { name: rb('もしも…', 'If I were…'), frames: ['tara', 'to-omou'], status: 'draft' },
};

export type WordKind = 'living' | 'place' | 'food' | 'thing';

/** An adjective a slide's word is often described with, for the ready sentences. */
export interface Adjective {
  /** Dictionary form, in bracket notation: 大[おお]きい, きれい. */
  text: string;
  en: string;
  kind: 'i' | 'na';
}

export interface Slide {
  id: string;
  /** The slide's word (what's in the picture). */
  word: JpText;
  emoji: string;
  kind: WordKind;
  adj: Adjective;
  /** "Yesterday I …" with this word, when the kind's default verb doesn't fit (でんしゃに のりました). */
  did?: JpText;
  tags: readonly Tag[];
  /** In the むちゃぶり (impossible ask) pool: the assistant's third, odd choice. */
  wild?: true;
  /** An event, not an object (さくら, かいぎ): no "how much was it?" question. */
  event?: true;
  /**
   * For a thing you don't 使う (おみくじを 引く, 電車に 乗る): the N4 decks' verb, with its particle, in
   * the potential (が 引[ひ]ける) and the たい form (を 引[ひ]きたい), and in English (draw).
   */
  use?: { can: string; want: string; en: string };
  audiences: readonly Audience[];
}

export type MishapId = 'blackout' | 'wrong' | 'graph' | 'upside' | 'message';

export interface Mishap {
  id: MishapId;
  /** The name on the assistant's card and the TV's banner. */
  name: JpText;
  emoji: string;
}

const jp = rb;
const ALL: readonly Audience[] = ['kids', 'family', 'cheeky'];
const KF: readonly Audience[] = ['kids', 'family'];
const FC: readonly Audience[] = ['family', 'cheeky'];
const C: readonly Audience[] = ['cheeky'];

const title = (id: string, text: string, en: string, topic: string, topicEn: string, tags: Tag[], audiences: readonly Audience[], deck?: Deck): Title => ({ id, jp: jp(text, en), topic: jp(topic, topicEn), tags, audiences, ...(deck ? { deck } : {}) });
const thenNow = (id: string, text: string, en: string, topic: string, topicEn: string, tags: Tag[], audiences: readonly Audience[] = ALL) => title(id, text, en, topic, topicEn, tags, audiences, 'then-now');
const thenNowPlace = (id: string, text: string, en: string, topic: string, topicEn: string, tags: Tag[], before: [string, string], audiences: readonly Audience[] = ALL): Title => ({
  ...title(id, text, en, topic, topicEn, tags, audiences, 'then-now'),
  place: { before: before[0], beforeEn: before[1] },
});
const ifWere = (id: string, text: string, en: string, topic: string, topicEn: string, tags: Tag[], audiences: readonly Audience[] = ALL) => title(id, text, en, topic, topicEn, tags, audiences, 'if');

// ---- titles (Kids titles also play in Family rooms; Family titles also play in Cheeky rooms) ----

export const TITLES: Title[] = [
  // Kids
  title('dragon', 'ドラゴンの 飼[か]い方[かた]', 'How to keep a dragon', 'ドラゴン', 'the dragon', ['animal', 'home'], KF),
  title('ghost-school', 'おばけの 学校[がっこう]', 'Ghost school', 'おばけ', 'the ghost', ['yokai', 'school'], KF),
  title('snack', '世界一[せかいいち] おいしい おやつ', "The world's tastiest snack", 'おやつ', 'the snack', ['food'], KF),
  title('cat-job', '猫[ねこ]の 仕事[しごと]', 'What cats do at work', '猫[ねこ]', 'the cat', ['animal', 'work'], KF),
  title('fridge', '冷蔵庫[れいぞうこ]の 秘密[ひみつ]', 'The secret of the fridge', '冷蔵庫[れいぞうこ]', 'the fridge', ['food', 'home'], KF),
  title('socks', '靴下[くつした]が 消[き]える 謎[なぞ]', 'The mystery of the vanishing socks', '靴下[くつした]', 'the sock', ['thing', 'home'], KF),
  title('alien', '宇宙人[うちゅうじん]の 友[とも]だち', 'My alien friend', '宇宙人[うちゅうじん]', 'the alien', ['space', 'person'], KF),
  title('penguin', 'ペンギンの 夏休[なつやす]み', "A penguin's summer holiday", 'ペンギン', 'the penguin', ['animal', 'travel'], KF),
  title('robot-lunch', 'ロボットの お弁当[べんとう]', "A robot's packed lunch", 'ロボット', 'the robot', ['food', 'thing'], KF),
  title('dino', '恐竜[きょうりゅう]の 歯[は]みがき', 'How dinosaurs brush their teeth', '恐竜[きょうりゅう]', 'the dinosaur', ['animal'], KF),
  title('nap', '昼寝[ひるね]の プロ', 'The professional napper', '昼寝[ひるね]', 'the nap', ['home'], KF),
  title('ghost-day', '幽霊[ゆうれい]の 一日[いちにち]', "A ghost's day", '幽霊[ゆうれい]', 'the ghost', ['yokai'], KF),
  // Family
  title('kappa', 'かっぱの 洗濯[せんたく]', 'Kappa laundry day', 'かっぱ', 'the kappa', ['yokai', 'home'], FC),
  title('grandpa', 'おじいちゃんの 秘密[ひみつ]', "Grandpa's secret", 'おじいちゃん', 'Grandpa', ['person'], FC),
  title('papa-karaoke', 'パパの カラオケ', "Dad's karaoke", 'パパ', 'Dad', ['person', 'fun'], FC),
  title('grandma-phone', 'おばあちゃんの スマホ', "Grandma's smartphone", 'おばあちゃん', 'Grandma', ['person', 'thing'], FC),
  title('remote', '消[き]えた リモコン', 'The case of the vanished remote', 'リモコン', 'the remote', ['thing', 'home'], FC),
  title('dog', '犬[いぬ]の 本当[ほんとう]の 気持[きも]ち', 'What the dog really thinks', '犬[いぬ]', 'the dog', ['animal', 'home'], FC),
  title('toilets', 'トイレが 十個[じゅっこ] ある 家[いえ]', 'My house with ten toilets', '家[いえ]', 'the house', ['home', 'place'], FC),
  title('souvenir', '一番[いちばん] いらない お土産[みやげ]', "The world's least wanted souvenir", 'お土産[みやげ]', 'the souvenir', ['travel', 'thing'], FC),
  title('neighbours', '隣[となり]の 人[ひと]の 謎[なぞ]', 'The mystery of the neighbours', '隣[となり]の 人[ひと]', 'the neighbour', ['person', 'home'], FC),
  title('ghost-good', '幽霊[ゆうれい]の いい ところ', 'The good side of ghosts', '幽霊[ゆうれい]', 'the ghost', ['yokai'], FC),
  title('trip', '家族旅行[かぞくりょこう]の 大失敗[だいしっぱい]', 'Our family trip disaster', '旅行[りょこう]', 'the trip', ['travel'], FC),
  title('teacher', '先生[せんせい]の 週末[しゅうまつ]', 'What teachers do at the weekend', '先生[せんせい]', 'the teacher', ['person', 'school'], FC),
  // Cheeky
  title('secret-job', '私[わたし]の 秘密[ひみつ]の 仕事[しごと]', 'My secret job', '仕事[しごと]', 'the job', ['work'], C),
  title('ex-him', '元[もと]カレの 話[はなし]', 'About my ex-boyfriend', '元[もと]カレ', 'my ex', ['love', 'person'], C),
  title('ex-her', '元[もと]カノの 話[はなし]', 'About my ex-girlfriend', '元[もと]カノ', 'my ex', ['love', 'person'], C),
  title('skip-work', '会社[かいしゃ]を 休[やす]む 言[い]い訳[わけ]', 'Excuses for skipping work', '言[い]い訳[わけ]', 'the excuse', ['work'], C),
  title('hangover', '二日酔[ふつかよ]いの 治[なお]し方[かた]', 'How to cure a hangover', '二日酔[ふつかよ]い', 'the hangover', ['food', 'home'], C),
  title('boss', '部長[ぶちょう]の 秘密[ひみつ]', "The boss's secret", '部長[ぶちょう]', 'the boss', ['work', 'person'], C),
  title('worst-date', '最悪[さいあく]の デート', 'My worst date', 'デート', 'the date', ['love'], C),
  title('groom', '新郎[しんろう]の 秘密[ひみつ]', "The groom's secrets", '新郎[しんろう]', 'the groom', ['love', 'person'], C),
  title('app-photo', 'マッチングアプリの 写真[しゃしん]', 'My dating-app photo', '写真[しゃしん]', 'the photo', ['love', 'thing'], C),
  title('meeting', '会議[かいぎ]で 寝[ね]ない 方法[ほうほう]', 'How not to fall asleep in meetings', '会議[かいぎ]', 'the meeting', ['work'], C),
  title('last-train', '終電[しゅうでん]を 逃[のが]した 夜[よる]', 'The night I missed the last train', '終電[しゅうでん]', 'the last train', ['travel', 'fun'], C),
  title('cv', '履歴書[りれきしょ]の うそ', 'The lies on my CV', '履歴書[りれきしょ]', 'the CV', ['work', 'thing'], C),
  // From women's side of the night out, the date and the wedding (Ladi: the audience is half women).
  title('joshikai', '女子会[じょしかい]の 秘密[ひみつ]', "What really happens at girls' night", '女子会[じょしかい]', "girls' night", ['fun', 'love', 'person'], C),
  title('goukon', '合[ごう]コンの 反省会[はんせいかい]', 'The group-date post-mortem', '合[ごう]コン', 'the group date', ['love', 'fun'], C),
  title('shuutome', '姑[しゅうとめ]の チェック', "My mother-in-law's inspection", '姑[しゅうとめ]', 'my mother-in-law', ['home', 'person'], C),
  title('bride', '花嫁[はなよめ]の 本音[ほんね]', 'What the bride really thinks', '花嫁[はなよめ]', 'the bride', ['love', 'person'], C),
  title('suppin', 'すっぴんの 秘密[ひみつ]', 'The secret of my bare face', 'すっぴん', 'my bare face', ['home', 'love'], C),
  // College life.
  title('tetsuya', 'テスト前[まえ]の 徹夜[てつや]', 'The all-nighter before the exam', '徹夜[てつや]', 'the all-nighter', ['school', 'fun'], C),
  title('circle', 'サークルの 飲[の]み会[かい]', "My club's drinking party", '飲[の]み会[かい]', 'the drinking party', ['school', 'fun', 'food'], C),
  title('student-fridge', '一人暮[ひとりぐ]らしの 冷蔵庫[れいぞうこ]', 'What is in my student fridge', '冷蔵庫[れいぞうこ]', 'my fridge', ['school', 'home', 'food'], C),
  title('baito', 'バイトの 店長[てんちょう]', 'My part-time job manager', '店長[てんちょう]', 'the manager', ['work', 'person'], C),
  // Yakuza who really shouldn't be yakuza.
  title('kid-boss', '小学校[しょうがっこう]の 組長[くみちょう]', 'The primary-school crime boss', '組長[くみちょう]', 'the boss', ['school', 'person', 'fun'], C),
  title('granny-gang', 'おばあちゃん組[ぐみ]', 'The Granny Gang', 'おばあちゃん組[ぐみ]', 'the Granny Gang', ['person', 'fun'], C),
  title('shiba-oyabun', '柴犬[しばいぬ]の 親分[おやぶん]', 'The shiba-inu godfather', '親分[おやぶん]', 'the godfather', ['animal', 'work'], C),
  title('konbini-3am', '夜中[よなか]の コンビニ', 'The konbini at 3 a.m.', 'コンビニ', 'the konbini', ['food', 'place', 'fun'], C),
  // N4 deck: Then and now (〜ように なりました, 〜ことに しました, 〜ことに なりました)
  thenNow('tn-grandpa', 'おじいちゃんの 昔[むかし]と 今[いま]', 'Grandpa, then and now', 'おじいちゃん', 'Grandpa', ['person', 'home']),
  thenNow('tn-cat', 'うちの 猫[ねこ]の 成長[せいちょう]', 'How our cat grew up', '猫[ねこ]', 'the cat', ['animal', 'home']),
  thenNow('tn-robot', 'ロボットの 進化[しんか]', "The robot's evolution", 'ロボット', 'the robot', ['thing', 'space']),
  thenNow('tn-kappa', 'かっぱの 新[あたら]しい 生活[せいかつ]', "The kappa's new life", 'かっぱ', 'the kappa', ['yokai', 'home']),
  thenNow('tn-tanuki', 'たぬきの 東京[とうきょう]デビュー', "The tanuki's Tokyo debut", 'たぬき', 'the tanuki', ['animal', 'travel']),
  thenNow('tn-dad', 'パパの ダイエット', "Dad's diet", 'パパ', 'Dad', ['person', 'food']),
  thenNow('tn-ghost', '幽霊[ゆうれい]の 転職[てんしょく]', "The ghost's career change", '幽霊[ゆうれい]', 'the ghost', ['yokai', 'work']),
  thenNow('tn-boss', '部長[ぶちょう]の イメチェン', "The boss's makeover", '部長[ぶちょう]', 'the boss', ['work', 'person'], C),
  // Places, each with its own "before" (never 「町は 町に なりました」 about a place that was already a town).
  thenNowPlace('tn-town', '私[わたし]の 町[まち]の 昔[むかし]と 今[いま]', 'My town, then and now', '私[わたし]の 町[まち]', 'my town', ['place', 'travel', 'home'], ['静[しず]かでした', 'used to be quiet']),
  thenNowPlace('tn-village', 'おばあちゃんの 村[むら]の 今[いま]', "Grandma's village today", 'おばあちゃんの 村[むら]', "Grandma's village", ['place', 'travel', 'person'], ['人[ひと]が 少[すく]なかったです', 'used to have hardly anyone in it']),
  thenNowPlace('tn-shotengai', '商店街[しょうてんがい]の 復活[ふっかつ]', "The shopping street's comeback", '商店街[しょうてんがい]', 'the shopping street', ['place', 'food', 'work'], ['誰[だれ]も いませんでした', 'used to be empty'], FC),
  // N4 deck: If I were… (もし 〜だったら)
  ifWere('if-cat', 'もし 私[わたし]が 猫[ねこ]だったら', 'If I were a cat', '猫[ねこ]', 'a cat', ['animal']),
  ifWere('if-dragon', 'もし 私[わたし]が ドラゴンだったら', 'If I were a dragon', 'ドラゴン', 'a dragon', ['animal', 'yokai']),
  ifWere('if-pm', 'もし 私[わたし]が 総理大臣[そうりだいじん]だったら', 'If I were prime minister', '総理大臣[そうりだいじん]', 'prime minister', ['person', 'work']),
  ifWere('if-teacher', 'もし 私[わたし]が 先生[せんせい]だったら', 'If I were the teacher', '先生[せんせい]', 'the teacher', ['school', 'person']),
  ifWere('if-ghost', 'もし 私[わたし]が 幽霊[ゆうれい]だったら', 'If I were a ghost', '幽霊[ゆうれい]', 'a ghost', ['yokai']),
  ifWere('if-alien', 'もし 私[わたし]が 宇宙人[うちゅうじん]だったら', 'If I were an alien', '宇宙人[うちゅうじん]', 'an alien', ['space', 'person']),
  ifWere('if-rich', 'もし 私[わたし]が お金持[かねも]ちだったら', 'If I were rich', 'お金持[かねも]ち', 'a rich person', ['person', 'fun']),
  ifWere('if-boss', 'もし 私[わたし]が 社長[しゃちょう]だったら', 'If I ran the company', '社長[しゃちょう]', 'the company boss', ['work', 'person'], C),
];

// ---- slides ----

const i = (text: string, en: string): Adjective => ({ text, en, kind: 'i' });
const na = (text: string, en: string): Adjective => ({ text, en, kind: 'na' });
interface SlideOpts {
  did?: [string, string];
  wild?: true;
  event?: true;
  use?: Slide['use'];
  audiences?: readonly Audience[];
}
const slide = (id: string, word: string, en: string, emoji: string, kind: WordKind, adj: Adjective, tags: Tag[], o: SlideOpts = {}): Slide => ({
  id,
  word: jp(word, en),
  emoji,
  kind,
  adj,
  tags,
  audiences: o.audiences ?? ALL,
  ...(o.did ? { did: jp(o.did[0], o.did[1]) } : {}),
  ...(o.wild ? { wild: true as const } : {}),
  ...(o.event ? { event: true as const } : {}),
  ...(o.use ? { use: o.use } : {}),
});

const DRAW: Slide['use'] = { can: 'が 引[ひ]ける', want: 'を 引[ひ]きたい', en: 'draw' };
const RIDE: Slide['use'] = { can: 'に 乗[の]れる', want: 'に 乗[の]りたい', en: 'ride' };
// A place you don't just 行く to, for Then and now's 「一人で ＿に 〜ように なりました」.
const BATHE: Slide['use'] = { can: 'に 入[はい]れる', want: 'に 入[はい]りたい', en: 'get into' };

export const SLIDES: Slide[] = [
  // Everyday Japan, played straight: real things a visitor sees, so the talk teaches real words.
  slide('omikuji', 'おみくじ', 'fortune slip', '🎋', 'thing', na('不思議[ふしぎ]', 'mysterious'), ['travel', 'fun'], { did: ['おみくじを 引[ひ]きました', 'I drew a fortune'], use: DRAW }),
  slide('jihanki', '自販機[じはんき]', 'vending machine', '🥤', 'thing', na('便利[べんり]', 'handy'), ['thing', 'food'], { did: ['自販機[じはんき]で お茶[ちゃ]を 買[か]いました', 'I bought tea from a vending machine'] }),
  slide('rush-hour', '電車[でんしゃ]', 'train', '🚃', 'thing', i('狭[せま]い', 'cramped'), ['travel', 'work'], { did: ['電車[でんしゃ]に 乗[の]りました', 'I rode a train'], use: RIDE }),
  slide('shinkansen', '新幹線[しんかんせん]', 'bullet train', '🚄', 'thing', i('速[はや]い', 'fast'), ['travel'], { did: ['新幹線[しんかんせん]に 乗[の]りました', 'I rode the bullet train'], use: RIDE }),
  slide('kotatsu', 'こたつ', 'kotatsu', '🍊', 'thing', i('暖[あたた]かい', 'warm'), ['home'], { did: ['こたつで 寝[ね]ました', 'I slept in the kotatsu'] }),
  slide('ekiben', '駅弁[えきべん]', 'station bento', '🍱', 'food', i('おいしい', 'tasty'), ['food', 'travel']),
  slide('sakura', '桜[さくら]', 'cherry blossoms', '🌸', 'thing', na('きれい', 'beautiful'), ['travel', 'fun', 'love'], { did: ['桜[さくら]を 見[み]ました', 'I saw the cherry blossoms'], event: true }),
  slide('oden', 'おでん', 'oden', '🍢', 'food', i('熱[あつ]い', 'hot'), ['food', 'work']),
  slide('sento', '銭湯[せんとう]', 'public bath', '🛁', 'place', i('広[ひろ]い', 'big'), ['travel', 'home', 'place'], { use: BATHE }),
  slide('ramen', 'ラーメン', 'ramen', '🍜', 'food', i('おいしい', 'tasty'), ['food', 'travel']),
  slide('sushi', 'すし', 'sushi', '🍣', 'food', i('高[たか]い', 'expensive'), ['food', 'love']),
  slide('curry', 'カレー', 'curry', '🍛', 'food', i('辛[から]い', 'spicy'), ['food', 'home']),
  slide('natto', '納豆[なっとう]', 'natto', '🫘', 'food', i('くさい', 'smelly'), ['food', 'home']),
  slide('school', '学校[がっこう]', 'school', '🏫', 'place', i('古[ふる]い', 'old'), ['school', 'place']),
  slide('konbini', 'コンビニ', 'konbini', '🏪', 'place', i('明[あか]るい', 'bright'), ['food', 'work', 'place']),
  slide('onsen', '温泉[おんせん]', 'hot spring', '♨️', 'place', i('熱[あつ]い', 'hot'), ['travel', 'place'], { use: BATHE }),
  slide('fuji', '富士山[ふじさん]', 'Mount Fuji', '🗻', 'place', i('高[たか]い', 'tall'), ['travel', 'place'], { did: ['富士山[ふじさん]に 登[のぼ]りました', 'I climbed Mount Fuji'], use: { can: 'に 登[のぼ]れる', want: 'に 登[のぼ]りたい', en: 'climb' } }),
  slide('sea', '海[うみ]', 'the sea', '🌊', 'place', na('きれい', 'beautiful'), ['travel', 'place', 'love'], { use: { can: 'で 泳[およ]げる', want: 'で 泳[およ]ぎたい', en: 'swim in' } }),
  slide('shiba', '犬[いぬ]', 'dog', '🐕', 'living', i('賢[かしこ]い', 'clever'), ['animal', 'home']),
  slide('cat', '猫[ねこ]', 'cat', '🐱', 'living', i('かわいい', 'cute'), ['animal', 'home']),
  slide('teacher', '先生[せんせい]', 'teacher', '🧑‍🏫', 'living', i('厳[きび]しい', 'strict'), ['person', 'school']),
  slide('grandpa', 'おじいちゃん', 'grandpa', '👴', 'living', i('強[つよ]い', 'tough'), ['person', 'fun']),
  slide('baby', '赤[あか]ちゃん', 'baby', '👶', 'living', i('小[ちい]さい', 'tiny'), ['person', 'home']),
  slide('umbrella', '傘[かさ]', 'umbrella', '☂️', 'thing', i('古[ふる]い', 'old'), ['thing', 'travel']),
  slide('bicycle', '自転車[じてんしゃ]', 'bicycle', '🚲', 'thing', i('重[おも]い', 'heavy'), ['thing', 'home'], { did: ['自転車[じてんしゃ]に 乗[の]りました', 'I rode a bicycle'], use: RIDE }),
  slide('money', 'お金[かね]', 'money', '💴', 'thing', na('大事[だいじ]', 'important'), ['work', 'thing'], { did: ['お金[かね]を 拾[ひろ]いました', 'I found some money'] }),
  // Ridiculous: the むちゃぶり (impossible ask) pool, for every room.
  slide('grandma', 'おばあちゃん', 'grandma', '👵', 'living', na('元気[げんき]', 'full of energy'), ['person', 'fun'], { wild: true }),
  slide('sock', '靴下[くつした]', 'sock', '🧦', 'thing', na('大切[たいせつ]', 'precious'), ['thing', 'home'], { wild: true }),
  slide('cat-boss', '社長[しゃちょう]', 'company boss', '💼', 'living', i('偉[えら]い', 'important'), ['work', 'animal', 'person'], { wild: true }),
  slide('kappa', 'かっぱ', 'kappa', '🥒', 'living', na('真面目[まじめ]', 'hard-working'), ['yokai', 'home'], { wild: true }),
  slide('tanuki', 'たぬき', 'tanuki', '🦝', 'living', i('悲[かな]しい', 'sad'), ['animal', 'yokai', 'fun'], { wild: true }),
  slide('ghost', 'おばけ', 'ghost', '👻', 'living', i('かわいい', 'cute'), ['yokai', 'travel'], { wild: true }),
  slide('dragon', 'ドラゴン', 'dragon', '🐉', 'living', i('熱[あつ]い', 'hot'), ['animal', 'yokai', 'food'], { wild: true }),
  slide('octopus', 'たこ', 'octopus', '🐙', 'living', i('怖[こわ]い', 'scary'), ['animal', 'food', 'work'], { wild: true }),
  slide('pudding', 'プリン', 'pudding', '🍮', 'food', i('大[おお]きい', 'huge'), ['food'], { wild: true }),
  slide('ufo', 'ユーフォー', 'UFO', '🛸', 'thing', na('不思議[ふしぎ]', 'mysterious'), ['space', 'thing'], { did: ['ユーフォーを 見[み]ました', 'I saw a UFO'], wild: true }),
  slide('dinosaur', '恐竜[きょうりゅう]', 'dinosaur', '🦖', 'living', i('大[おお]きい', 'big'), ['animal', 'work', 'travel'], { wild: true }),
  slide('penguin', 'ペンギン', 'penguin', '🐧', 'living', na('寒[さむ]がり', 'sensitive to the cold'), ['animal', 'travel'], { wild: true }),
  slide('robot', 'ロボット', 'robot', '🤖', 'thing', na('丁寧[ていねい]', 'polite'), ['thing', 'work'], { wild: true }),
  slide('alien', '宇宙人[うちゅうじん]', 'alien', '👽', 'living', na('親切[しんせつ]', 'kind'), ['space', 'person', 'food'], { wild: true }),
  slide('pants', 'パンツ', 'underpants', '🩲', 'thing', i('大[おお]きい', 'big'), ['home', 'fun'], { wild: true }),
  slide('toilet', 'トイレ', 'toilet', '🚽', 'place', i('難[むずか]しい', 'complicated'), ['home', 'place', 'thing'], { wild: true }),
  slide('panda', 'パンダ', 'panda', '🐼', 'living', i('重[おも]い', 'heavy'), ['animal', 'travel'], { wild: true }),
  slide('daruma', 'だるま', 'daruma doll', '🔴', 'thing', i('赤[あか]い', 'red'), ['thing', 'fun'], { did: ['だるまを 買[か]いました', 'I bought a daruma'], wild: true }),
  slide('mochi', 'お餅[もち]', 'mochi', '🍡', 'food', i('柔[やわ]らかい', 'soft'), ['food', 'home'], { wild: true }),
  slide('pigeon', '鳩[はと]', 'pigeon', '🐦', 'living', na('真面目[まじめ]', 'serious'), ['animal', 'travel', 'work'], { wild: true }),
  slide('fridge', '冷蔵庫[れいぞうこ]', 'fridge', '🧊', 'thing', i('冷[つめ]たい', 'cold'), ['food', 'home'], { did: ['冷蔵庫[れいぞうこ]を 開[あ]けました', 'I opened the fridge'], wild: true }),
  slide('remote', 'リモコン', 'TV remote', '📺', 'thing', i('小[ちい]さい', 'small'), ['home', 'thing'], { did: ['リモコンを 探[さが]しました', 'I looked for the remote'], wild: true }),
  // Grown-up (Family and Cheeky)
  slide('office', '会社[かいしゃ]', 'office', '🏢', 'place', i('忙[いそが]しい', 'busy'), ['work', 'place'], { audiences: FC }),
  slide('karaoke', 'カラオケ', 'karaoke', '🎤', 'place', i('うるさい', 'loud'), ['fun', 'place', 'work'], { audiences: FC, wild: true }),
  slide('ring', '指輪[ゆびわ]', 'ring', '💍', 'thing', i('高[たか]い', 'expensive'), ['love', 'thing', 'food'], { audiences: FC, wild: true }),
  // Cheeky: awkward grown-up moments, never explicit.
  slide('balcony', 'ベランダ', 'balcony', '🩳', 'place', i('寒[さむ]い', 'cold'), ['home', 'love'], { audiences: C, did: ['ベランダに 出[で]ました', 'I went out on the balcony'], use: { can: 'に 出[で]られる', want: 'に 出[で]たい', en: 'go out on' }, wild: true }),
  slide('drunk', '酔[よ]っ払[ぱら]い', 'drunk salaryman', '🍶', 'living', i('うるさい', 'loud'), ['work', 'person', 'fun'], { audiences: C, wild: true }),
  slide('meeting', '会議[かいぎ]', 'meeting', '😴', 'thing', i('長[なが]い', 'long'), ['work'], { audiences: C, did: ['会議[かいぎ]に 出[で]ました', 'I went to a meeting'], wild: true, event: true }),
  slide('groom', '新郎[しんろう]', 'groom', '🤵', 'living', na('真面目[まじめ]', 'earnest'), ['love', 'person'], { audiences: C, wild: true }),
  slide('you-up', 'メッセージ', 'message', '📱', 'thing', i('怖[こわ]い', 'scary'), ['love', 'thing'], { audiences: C, did: ['メッセージを 読[よ]みました', 'I read a message'], wild: true }),
  slide('beer', 'ビール', 'beer', '🍺', 'food', i('冷[つめ]たい', 'cold'), ['food', 'work', 'fun'], { audiences: C, did: ['ビールを 飲[の]みました', 'I drank beer'] }),
  slide('cv', '履歴書[りれきしょ]', 'CV', '📄', 'thing', na('正直[しょうじき]', 'honest'), ['work'], { audiences: C, did: ['履歴書[りれきしょ]を 書[か]きました', 'I wrote my CV'], wild: true }),
  slide('love-letter', 'ラブレター', 'love letter', '💌', 'thing', i('恥[は]ずかしい', 'embarrassing'), ['love', 'school', 'work'], { audiences: C, did: ['ラブレターを 書[か]きました', 'I wrote a love letter'], wild: true }),
  slide('heel', 'ハイヒール', 'high heel', '👠', 'thing', i('高[たか]い', 'high'), ['love', 'travel'], { audiences: C, wild: true }),
  slide('fish-photo', '魚[さかな]', 'fish', '🐟', 'food', i('大[おお]きい', 'big'), ['love', 'food', 'fun'], { audiences: C, wild: true }),
  slide('capsule', 'カプセルホテル', 'capsule hotel', '🛌', 'place', i('狭[せま]い', 'cramped'), ['travel', 'work', 'place'], { audiences: C, did: ['カプセルホテルに 泊[と]まりました', 'I stayed in a capsule hotel'], use: { can: 'に 泊[と]まれる', want: 'に 泊[と]まりたい', en: 'stay at' }, wild: true }),
  // Cheeky from women's side.
  slide('bouquet', 'ブーケ', 'bouquet', '💐', 'thing', na('きれい', 'pretty'), ['love', 'fun'], { audiences: C, did: ['ブーケを 取[と]りました', 'I caught the bouquet'], wild: true }),
  slide('joshikai', '女子会[じょしかい]', "girls' night", '🥂', 'thing', i('楽[たの]しい', 'fun'), ['fun', 'love', 'person'], { audiences: C, did: ['女子会[じょしかい]に 行[い]きました', "I went to a girls' night"] }),
  slide('shuutome', '姑[しゅうとめ]', 'mother-in-law', '🧤', 'living', i('厳[きび]しい', 'strict'), ['home', 'person'], { audiences: C, wild: true }),
  slide('makeup', '化粧[けしょう]', 'makeup', '💄', 'thing', i('早[はや]い', 'quick'), ['travel', 'work'], { audiences: C, did: ['電車[でんしゃ]で 化粧[けしょう]を しました', 'I did my makeup on the train'], wild: true }),
  slide('mama-boy', 'マザコン', "mummy's boy", '📞', 'living', i('優[やさ]しい', 'sweet'), ['love', 'person', 'home'], { audiences: C, wild: true }),
  slide('face-mask', 'パック', 'face mask', '🧖', 'thing', i('白[しろ]い', 'white'), ['home', 'love'], { audiences: C, did: ['パックを しました', 'I put on a face mask'], wild: true }),
  slide('shopping', '買[か]い物[もの]', 'shopping', '🛍️', 'thing', i('楽[たの]しい', 'fun'), ['fun', 'love', 'travel'], { audiences: C, did: ['買[か]い物[もの]を しました', 'I went shopping'], wild: true }),
  slide('cake', 'ケーキ', 'cake', '🍰', 'food', i('甘[あま]い', 'sweet'), ['food', 'home', 'love'], { audiences: C, wild: true }),
  // College life.
  slide('all-nighter', '徹夜[てつや]', 'all-nighter', '🥱', 'thing', i('眠[ねむ]い', 'sleepy'), ['school', 'fun'], { audiences: C, did: ['徹夜[てつや]しました', 'I pulled an all-nighter'], wild: true, event: true }),
  slide('cup-noodle', 'カップラーメン', 'cup noodles', '🍜', 'food', i('安[やす]い', 'cheap'), ['food', 'school', 'home'], { audiences: C }),
  slide('nomikai', '飲[の]み会[かい]', 'drinking party', '🍻', 'thing', i('うるさい', 'loud'), ['school', 'fun', 'food'], { audiences: C, did: ['飲[の]み会[かい]に 行[い]きました', 'I went to a drinking party'], wild: true, event: true }),
  slide('lecture', '授業[じゅぎょう]', 'lecture', '💤', 'thing', i('長[なが]い', 'long'), ['school'], { audiences: C, did: ['授業[じゅぎょう]で 寝[ね]ました', 'I slept in class'], wild: true, event: true }),
  slide('kigurumi', '着[き]ぐるみ', 'mascot costume', '🐔', 'thing', i('暑[あつ]い', 'hot'), ['work', 'fun'], { audiences: C, did: ['着[き]ぐるみを 着[き]ました', 'I wore a mascot costume'], wild: true }),
  // Yakuza who really shouldn't be yakuza.
  slide('kid-boss', '組長[くみちょう]', 'gang boss', '🎒', 'living', i('怖[こわ]い', 'scary'), ['school', 'person', 'fun'], { audiences: C, wild: true }),
  slide('tea-yakuza', 'ヤクザ', 'yakuza', '🍵', 'living', na('丁寧[ていねい]', 'polite'), ['person', 'fun', 'food'], { audiences: C, wild: true }),
  slide('shiba-oyabun', '親分[おやぶん]', 'godfather', '🐕', 'living', i('偉[えら]い', 'important'), ['animal', 'work', 'person'], { audiences: C, wild: true }),
  slide('maid-yakuza', 'メイドカフェ', 'maid café', '🎀', 'place', i('かわいい', 'cute'), ['work', 'food', 'place'], { audiences: C, wild: true }),
  slide('hitokara', '一人[ひとり]カラオケ', 'solo karaoke', '🎤', 'place', na('静[しず]か', 'quiet'), ['fun', 'place'], { audiences: C, wild: true }),
];

// ---- mishaps ----

export const MISHAPS: Mishap[] = [
  { id: 'blackout', name: jp('真[ま]っ暗[くら]', 'Blackout'), emoji: '🌑' },
  { id: 'wrong', name: jp('間違[まちが]い', 'Wrong slide'), emoji: '🏮' },
  { id: 'graph', name: jp('グラフ', 'The graph'), emoji: '📈' },
  { id: 'upside', name: jp('逆[さか]さま', 'Upside down'), emoji: '🙃' },
  { id: 'message', name: jp('メッセージ', 'A message'), emoji: '💬' },
];

/** The message that pops up over the slide in the メッセージ mishap: Mum in most rooms, an ex in Cheeky. */
export const messageFor = (audience: Audience): { from: JpText; text: JpText } =>
  audience === 'cheeky' ? { from: jp('元[もと]カレ', 'Ex'), text: jp('起[お]きてる？😉', 'You up? 😉') } : { from: jp('お母[かあ]さん', 'Mum'), text: jp('ご飯[はん]よ！🍛', "Dinner's ready! 🍛") };

// ---- the presenter's lines ----

/** "The mystery of…" mid-sentence: "the mystery of…". */
const lower = (en: string): string => en.replace(/^(The|A|An) /, (m) => m.toLowerCase());

/** A title as the opening names it: an If I were… title is a clause, so it goes in quotes (「もし…」に ついて). */
const named = (t: JpText): string => (t.kana.startsWith('もし') ? `「${src(t)}」` : src(t));

/** The opening line, by level: the ritual of every Japanese presentation. */
export function openingFor(level: Level, name: string, t: JpText): JpText {
  if (level === 'kana') return forLevel(jp(`みなさん、こんにちは。${name}です。タイトルは 「${src(t)}」です。`, `Hello everyone. I'm ${name}. The title is "${t.en}".`), level);
  if (level === 'n5') return forLevel(jp(`みなさん、こんばんは。${name}です。今日[きょう]は ${named(t)}に ついて 話[はな]します。よろしく お願[ねが]いします。`, `Good evening, everyone. I'm ${name}. Today I'll talk about ${lower(t.en)}. Thank you in advance.`), level);
  return forLevel(jp(`みなさん、こんばんは。${name}と 申[もう]します。今日[きょう]は ${named(t)}に ついて 話[はな]したいと 思[おも]います。よろしく お願[ねが]いします。`, `Good evening, everyone. My name is ${name}. Today I'd like to talk about ${lower(t.en)}. Thank you in advance.`), level);
}

export function closingFor(level: Level): JpText {
  if (level === 'kana') return forLevel(jp('以上[いじょう]です。ありがとうございました！', "That's all. Thank you very much!"), level);
  if (level === 'n5') return forLevel(jp('これで 発表[はっぴょう]を 終[お]わります。ありがとうございました！', 'That ends my presentation. Thank you very much!'), level);
  return forLevel(jp('以上[いじょう]です。ご清聴[せいちょう] ありがとうございました。', "That's all. Thank you for listening."), level);
}

/** Sentence patterns for a picture slide (＿ is the slide's word, 〜 a gap to fill), fitted to its kind. In kana: they're patterns. */
export function framesFor(level: Level, s: Slide, deck?: Deck): string[] {
  if (level === 'n4' && deck === 'then-now') return ['まえは 〜でしたが、いまは 〜ように なりました。', '＿が 〜られるように なりました。', '〜ことに しました。', '〜ことに なりました。', '＿は 〜そうですね。'];
  if (level === 'n4' && deck === 'if') return ['もし ＿だったら、〜たいです。', `もし ＿が ${s.kind === 'living' ? 'いなかったら' : 'なかったら'}、〜。`, 'もし わたしが 〜だったら、〜と おもいます。', '＿は 〜そうですね。'];
  if (level === 'kana') return ['これは ＿です。', '＿が すきです。', 'すごいですね！'];
  if (level === 'n5') {
    const kind = { living: '＿と あそびました。', place: '＿に いきました。', food: '＿を たべました。', thing: '＿を かいました。' }[s.kind];
    return ['これは ＿です。', '＿は とても 〜です。', s.did ? s.did.kana.replace(s.word.kana, '＿') + '。' : kind, '〜から、〜。', 'そして… ／ でも…'];
  }
  return ['＿は 〜そうですね。', '〜ので、〜。', '〜たら、〜。', '〜と おもいます。', 'じつは、〜んです。', '〜た ことが あります。'];
}

/** English with its article: "a dog", "an octopus", "cherry blossoms". */
const a = (en: string): string => (/s$|^[A-Z]/.test(en) ? en : /^[aeiou]/i.test(en) ? `an ${en}` : `a ${en}`);
const polite = (a: Adjective): string => `${a.text}です`;
const te = (a: Adjective): string => (a.kind === 'i' ? (a.text === 'いい' ? 'よくて' : `${a.text.slice(0, -1)}くて`) : `${a.text}で`);
const didOf = (s: Slide): JpText => {
  if (s.did) return s.did;
  const w = src(s.word);
  const en = s.word.en;
  if (s.kind === 'living') return jp(`${w}と 遊[あそ]びました`, `I played with a ${en}`);
  if (s.kind === 'place') return jp(`${w}に 行[い]きました`, `I went to the ${en}`);
  if (s.kind === 'food') return jp(`${w}を 食[た]べました`, `I ate ${en}`);
  return jp(`${w}を 買[か]いました`, `I bought a ${en}`);
};

/**
 * Sentences for a picture slide, to read out or tap. Each level gets two; the second bridges the picture
 * back to the talk's topic, which is where the joke is (「これが ドラゴンです！」 over a sock).
 */
export function readySentences(s: Slide, level: Level, topic: JpText | null, deck?: Deck, place?: PlaceTopic): JpText[] {
  const w = src(s.word);
  const en = s.word.en;
  const t = topic ?? jp('友[とも]だち', 'my friend');
  const did = didOf(s);
  const at = (x: JpText[]) => x.map((j) => forLevel(j, level));
  if (level === 'n4' && deck) return at(deckSentences(s, t, deck, place));
  if (level === 'kana') return at([jp(`これは ${w}です。`, `This is ${a(en)}.`), jp(`これが ${src(t)}です！`, `THIS is ${t.en}!`)]);
  if (level === 'n5')
    return at([
      jp(`これは ${w}です。とても ${polite(s.adj)}。`, `This is ${a(en)}. It's very ${s.adj.en}.`),
      jp(`昨日[きのう]、${src(did)}。${src(t)}も 一緒[いっしょ]でした。`, `Yesterday ${did.en}. ${cap(t.en)} came too.`),
    ]);
  return at([
    jp(`実[じつ]は、${src(t)}は ${w}が 大好[だいす]きなんです。`, `Actually, ${t.en} loves ${en}s.`),
    jp(`この ${w}は ${te(s.adj)}、${src(t)}に ぴったりだと 思[おも]います。`, `This ${en} is ${s.adj.en}, so I think it's perfect for ${t.en}.`),
  ]);
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** "the sea", "Mount Fuji", "the konbini": English with "the" once. */
const the = (en: string): string => (/^(the |[A-Z])/.test(en) ? en : `the ${en}`);

/**
 * An N4 deck's ready sentences for a slide: three, each in one of the deck's frames, tied to the topic.
 * A Then and now place topic (私の 町) gets its own (placeSentences), never 「町も 一人で 公園に
 * 行けるように」 or 「町と 引っ越す」.
 */
function deckSentences(s: Slide, t: JpText, deck: Deck, place?: PlaceTopic): JpText[] {
  const w = src(s.word);
  const en = s.word.en;
  const T = src(t);
  if (deck === 'then-now') {
    if (place) return placeSentences(s, w, en, T, t, place);
    const can = s.event
      ? jp(`今[いま]では ${T}も ${w}が 楽[たの]しめるように なりました。`, `These days even ${t.en} can enjoy ${en}.`)
      : {
          living: jp(`今[いま]では ${T}も ${w}と 遊[あそ]べるように なりました。`, `These days even ${t.en} can play with ${a(en)}.`),
          place: s.use
            ? jp(`今[いま]では ${T}も 一人[ひとり]で ${w}${s.use.can}ように なりました。`, `These days even ${t.en} can ${s.use.en} ${the(en)} alone.`)
            : jp(`今[いま]では ${T}も 一人[ひとり]で ${w}に 行[い]けるように なりました。`, `These days even ${t.en} can go to ${the(en)} alone.`),
          food: jp(`今[いま]では ${T}も ${w}が 食[た]べられるように なりました。`, `These days even ${t.en} can eat ${en}.`),
          thing: s.use
            ? jp(`今[いま]では ${T}も ${w}${s.use.can}ように なりました。`, `These days even ${t.en} can ${s.use.en} ${a(en)}.`)
            : jp(`今[いま]では ${T}も ${w}が 使[つか]えるように なりました。`, `These days even ${t.en} can use ${a(en)}.`),
        }[s.kind];
    return [
      can,
      jp(`それで、${w}に ついて もっと 調[しら]べる ことに しました。`, `So I decided to find out more about ${the(en)}.`),
      news(s, w, en, T, t),
    ];
  }
  const If = `もし 私[わたし]が ${T}だったら、`;
  const IfEn = `If I were ${t.en},`;
  return [
    s.event
      ? jp(`${If}毎日[まいにち] ${w}を 楽[たの]しみたいです。`, `${IfEn} I'd want to enjoy ${en} every day.`)
      : {
          living: jp(`${If}毎日[まいにち] ${w}と 一緒[いっしょ]に いたいです。`, `${IfEn} I'd want to be with ${a(en)} every day.`),
          place: jp(`${If}${w}に 住[す]みたいです。`, `${IfEn} I'd want to live at ${the(en)}.`),
          food: jp(`${If}毎日[まいにち] ${w}を 食[た]べたいです。`, `${IfEn} I'd want to eat ${en} every day.`),
          thing: s.use
            ? jp(`${If}毎日[まいにち] ${w}${s.use.want}です。`, `${IfEn} I'd want to ${s.use.en} ${a(en)} every day.`)
            : jp(`${If}毎日[まいにち] ${w}を 使[つか]いたいです。`, `${IfEn} I'd want to use ${a(en)} every day.`),
        }[s.kind],
    jp(`もし ${w}が ${s.kind === 'living' ? 'いなかったら' : 'なかったら'}、${T}は 困[こま]ると 思[おも]います。`, `If there were no ${en}, I think ${t.en} would be in trouble.`),
    jp(`もし この ${w}が ${T}だったら、みんな びっくりするでしょうね。`, `If this ${en} were ${t.en}, everyone would be amazed.`),
  ];
}

/**
 * Then and now about a place: what it was like and what you can do there now (「私の 町は 前は 静かでしたが、
 * 今では 温泉まで バスで 行けるように なりました」), the same 調べる ことに しました, then the news of what's
 * coming to it: a bus to a place, a shop for a food, a festival for anything else.
 */
function placeSentences(s: Slide, w: string, en: string, T: string, t: JpText, p: PlaceTopic): JpText[] {
  const [now, nowEn] = s.event
    ? [`${w}が 楽[たの]しめる`, `you can enjoy ${en} there`]
    : {
        living: [`${w}が 見[み]られる`, `you can see ${a(en)} there`],
        place: [`${w}まで バスで 行[い]ける`, `you can get to ${the(en)} by bus`],
        food: [`${w}が 食[た]べられる`, `you can eat ${en} there`],
        thing: s.use ? [`${w}${s.use.can}`, `you can ${s.use.en} ${a(en)} there`] : [`${w}が 買[か]える`, `you can buy ${a(en)} there`],
      }[s.kind];
  const news =
    s.kind === 'place'
      ? jp(`実[じつ]は、来月[らいげつ] ${T}から ${w}まで 新[あたら]しい バスが 走[はし]る ことに なりました。`, `Actually, it's been decided: next month a new bus starts running from ${t.en} to ${the(en)}.`)
      : s.kind === 'food'
        ? jp(`実[じつ]は、来月[らいげつ] ${T}に ${w}の お店[みせ]が できる ことに なりました。`, `Actually, it's been decided: next month ${a(`${en} shop`)} is opening in ${t.en}.`)
        : jp(`実[じつ]は、来月[らいげつ] ${T}で ${w}の お祭[まつ]りを する ことに なりました。`, `Actually, it's been decided: next month ${t.en} is holding ${a(`${en} festival`)}.`);
  return [
    jp(`${T}は 前[まえ]は ${p.before}が、今[いま]では ${now}ように なりました。`, `${cap(t.en)} ${p.beforeEn}, but these days ${nowEn}.`),
    jp(`それで、${w}に ついて もっと 調[しら]べる ことに しました。`, `So I decided to find out more about ${the(en)}.`),
    news,
  ];
}

/**
 * Then and now's big news (〜ことに なりました), fitted to the slide: the topic moves to a place, opens a
 * shop for a food, and marries anything else (「来月 猫と パンツが 結婚する ことに なりました」).
 */
function news(s: Slide, w: string, en: string, T: string, t: JpText): JpText {
  if (s.kind === 'place') return jp(`実[じつ]は、来月[らいげつ] ${T}と ${w}に 引[ひ]っ越[こ]す ことに なりました。`, `Actually, it's been decided: next month ${t.en} and I are moving to ${the(en)}.`);
  if (s.kind === 'food') return jp(`実[じつ]は、来月[らいげつ]から ${T}が ${w}の お店[みせ]を 開[ひら]く ことに なりました。`, `Actually, it's been decided: from next month ${t.en} is opening ${a(`${en} shop`)}.`);
  return jp(`実[じつ]は、来月[らいげつ] ${T}と ${w}が 結婚[けっこん]する ことに なりました。`, `Actually, it's been decided: next month ${t.en} and the ${en} are getting married.`);
}

/** What the presenter can say to recover from a mishap, by level. `word` is the talk's first slide word. */
export function recoveryFor(id: MishapId, level: Level, word: JpText | null, up: boolean, audience: Audience = 'family'): JpText {
  const w = src(word ?? jp('お客[きゃく]さん', 'visitors'));
  const wEn = word?.en ?? 'visitors';
  const L = (kana: [string, string], n5: [string, string], n4: [string, string]): JpText => {
    const [text, en] = level === 'kana' ? kana : level === 'n5' ? n5 : n4;
    return forLevel(jp(text, en), level);
  };
  switch (id) {
    case 'blackout':
      return L(['あれ？　真[ま]っ暗[くら]です！', "Huh? It's pitch dark!"], ['あれ？　真[ま]っ暗[くら]ですね。すみません、次[つぎ] お願[ねが]いします。', "Huh? It's pitch dark. Sorry, next one please."], ['あれ、電気[でんき]が 消[き]えて しまいました。すみません、次[つぎ] お願[ねが]いします。', 'Oh, the lights have gone out. Sorry, next one please.']);
    case 'wrong':
      return L(['あ、すみません。間違[まちが]えました。', 'Oh, sorry. Wrong one.'], ['あ、失礼[しつれい]しました。これは ちょうちんさんの 写真[しゃしん]ですね。', "Oh, excuse me. This is Chōchin-san's photo, isn't it."], ['失礼[しつれい]しました。ちょうちんさんの 旅行[りょこう]の 写真[しゃしん]が 混[ま]ざって いました。', "Excuse me. Chōchin-san's holiday photos got mixed in."]);
    case 'graph':
      return L(
        ['見[み]て ください！　すごいですね！', "Look! Amazing, isn't it!"],
        up ? [`見[み]て ください。${w}が こんなに 多[おお]く なりました！`, `Look. There are this many more ${wEn}s now!`] : [`見[み]て ください。${w}が こんなに 少[すく]なく なりました！`, `Look. There are this many fewer ${wEn}s now!`],
        up ? [`見[み]て ください。${w}が こんなに 増[ふ]えました！`, `Look. ${cap(wEn)}s have gone up this much!`] : [`見[み]て ください。${w}が こんなに 減[へ]りました！`, `Look. ${cap(wEn)}s have gone down this much!`],
      );
    case 'upside':
      return L(['あれ？　逆[さか]さまです！', "Huh? It's upside down!"], ['あれ？　逆[さか]さまですね。すみません！', "Huh? It's upside down. Sorry!"], ['あれ、スライドが 逆[さか]さまに なって います。失礼[しつれい]しました。', 'Oh, the slide is upside down. Excuse me.']);
    case 'message':
      if (audience === 'cheeky') return L(['見[み]ないで ください！', "Don't look!"], ['今[いま]のは 見[み]ないで ください！', "Please don't look at that!"], ['今[いま]のは 見[み]なかった ことに して ください。', 'Please pretend you never saw that.']);
      return L(['すみません、母[はは]です。', "Sorry, it's my mum."], ['すみません、母[はは]からです。', "Sorry, it's from my mum."], ['すみません、母[はは]から メッセージが 来[き]ました。', 'Sorry, I got a message from my mum.']);
  }
}

// ---- question time ----

export interface Question {
  id: string;
  /** In bracket notation. `{word}` is the talk's first slide word, `{topic}` the title's topic. */
  text: string;
  en: string;
  /** Lowest level that gets this card. */
  level: Level;
  /** Only for these kinds of slide word (when it uses {word}). */
  kinds?: readonly WordKind[];
  audiences?: readonly Audience[];
  /** An N4 deck's card: only in that deck's talks. */
  deck?: Deck;
  /** Only about a topic that can be somewhere or do something, not a place (「私の 町は 今 どこですか」). */
  notPlace?: true;
}

export const QUESTIONS: Question[] = [
  { id: 'really', text: '本当[ほんとう]ですか？', en: 'Really?', level: 'kana' },
  { id: 'why', text: 'どうしてですか？', en: 'Why?', level: 'kana' },
  { id: 'like', text: '{word}が 好[す]きですか？', en: 'Do you like {word_en}s?', level: 'kana' },
  { id: 'photo', text: '写真[しゃしん]は ありますか？', en: 'Do you have a photo?', level: 'kana' },
  { id: 'mum', text: 'お母[かあ]さんは 知[し]っていますか？', en: 'Does your mum know?', level: 'kana' },
  { id: 'price', text: '{word}は いくらですか？', en: 'How much was the {word_en}?', level: 'n5', kinds: ['food', 'thing'] },
  { id: 'where', text: '{topic}は 今[いま] どこですか？', en: 'Where is {topic_en} now?', level: 'n5', notPlace: true },
  { id: 'how-was', text: 'どうでしたか？', en: 'How was it?', level: 'n5' },
  { id: 'work', text: '会社[かいしゃ]の 人[ひと]は 知[し]っていますか？', en: 'Does anyone at work know?', level: 'n5', audiences: ['cheeky'] },
  { id: 'hardest', text: '一番[いちばん] 大変[たいへん]だった ことは 何[なん]ですか？', en: 'What was the hardest part?', level: 'n4' },
  { id: 'without', text: 'もし {word}が なかったら、どう しますか？', en: 'What would you do without the {word_en}?', level: 'n4', kinds: ['place', 'food', 'thing'] },
  { id: 'without-living', text: 'もし {word}が いなかったら、どう しますか？', en: 'What would you do without the {word_en}?', level: 'n4', kinds: ['living'] },
  // N4 decks
  { id: 'tn-before', text: '{topic}は 前[まえ]は どうでしたか？', en: 'What was {topic_en} like before?', level: 'n4', deck: 'then-now' },
  { id: 'tn-why', text: 'どうして そう する ことに しましたか？', en: 'Why did you decide to do that?', level: 'n4', deck: 'then-now' },
  { id: 'tn-now', text: '今[いま]は 何[なに]が できるように なりましたか？', en: 'What can be done now that couldn’t before?', level: 'n4', deck: 'then-now' },
  { id: 'if-you', text: 'もし あなたが {word}だったら、どう しますか？', en: 'If you were the {word_en}, what would you do?', level: 'n4', deck: 'if' },
  { id: 'if-could', text: 'もし {topic}に なれたら、何[なに]が したいですか？', en: 'If you could become {topic_en}, what would you want to do?', level: 'n4', deck: 'if' },
];

const LEVELS: Level[] = ['kana', 'n5', 'n4'];

/**
 * Three question cards for one asker, at the lower of their level and the presenter's (so both can manage
 * the exchange), fitted to the talk's slide word and the room.
 */
export function questionsFor(level: Level, word: Slide | null, topic: JpText | null, audience: Audience, random: () => number, deck?: Deck, place?: PlaceTopic): JpText[] {
  const w = word?.word ?? jp('それ', 'it');
  const t = topic ?? jp('それ', 'it');
  const pool = QUESTIONS.filter(
    (q) => LEVELS.indexOf(q.level) <= LEVELS.indexOf(level) && (!q.kinds || (word && q.kinds.includes(word.kind) && !(q.id === 'price' && word.event))) && (!q.audiences || q.audiences.includes(audience)) && (word || !q.text.includes('{word}')) && (!q.deck || q.deck === deck) && !(place && q.notPlace),
  );
  // Each player's three: one at their level if there is one (the deck's own, in a deck talk), the rest at random.
  const own = pool.filter((q) => q.level === level && q.deck !== undefined);
  const top = own.length ? own : pool.filter((q) => q.level === level);
  const first = top.length ? top[Math.floor(random() * top.length)]! : pool[Math.floor(random() * pool.length)]!;
  const rest = pool.filter((q) => q !== first);
  for (let k = rest.length - 1; k > 0; k--) {
    const j = Math.floor(random() * (k + 1));
    [rest[k], rest[j]] = [rest[j]!, rest[k]!];
  }
  return [first, ...rest.slice(0, 2)].map((q) => forLevel(jp(fill(q.text, w, t), q.en.replace('{word_en}', w.en).replace('{topic_en}', t.en)), level));
}

const fill = (s: string, w: JpText, t: JpText): string => s.replace('{word}', src(w)).replace('{topic}', src(t));

/** Answer patterns for question time. */
export function answerFrames(level: Level, deck?: Deck): string[] {
  if (level === 'n4' && deck === 'then-now') return ['まえは 〜でしたが、いまは 〜ように なりました。', '〜から、〜ことに しました。', '〜ことに なりました。', 'それは ひみつです。'];
  if (level === 'n4' && deck === 'if') return ['もし 〜だったら、〜たいです。', '〜と おもいます。', 'いい しつもんですね。じつは、〜んです。', 'それは ひみつです。'];
  if (level === 'kana') return ['はい、ほんとうです！', 'はい、すきです。', 'いいえ…', 'それは ひみつです！'];
  if (level === 'n5') return ['はい、〜です。', '〜からです。', 'いい しつもんですね。…', 'ノーコメントです。'];
  return ['いい しつもんですね。じつは、〜んです。', '〜と おもいます。', 'いちばん たいへんだったのは 〜ことです。', 'それは ひみつです。'];
}

// ---- report card ----

/** The teacher's stamps: every grade is praise, like a real Japanese teacher's. */
export const GRADE_STAMPS: Record<1 | 2 | 3, JpText> = {
  1: jp('よく できました', 'Well done'),
  2: jp('たいへん よく できました', 'Very well done'),
  3: jp('はなまる', 'Top marks'),
};

/** Chōchin-san's comment on the report card: about the talk, never about anyone's Japanese. Shown at the presenter's level. */
export function teacherComment(best: Slide | null, mishap: boolean, topic: JpText | null, level: Level = 'n5'): JpText {
  if (mishap) return forLevel(jp('ハプニングにも 負[ま]けませんでした。', "Didn't let the mishap win."), level);
  if (best) return forLevel(jp(`${src(best.word)}の 話[はなし]が よかったです。`, `The bit about the ${best.word.en} was great.`), level);
  if (topic) return forLevel(jp(`${src(topic)}の ことが もっと 知[し]りたく なりました。`, `Now I want to know more about ${topic.en}.`), level);
  return forLevel(jp('また 聞[き]きたいです。', "I'd like to hear it again."), level);
}

/** The usual titles for a room (not the N4 decks'). */
export const titlesFor = (a: Audience): Title[] => TITLES.filter((t) => t.audiences.includes(a) && !t.deck);
/** One N4 deck's titles for a room. */
export const deckTitlesFor = (a: Audience, deck: Deck): Title[] => TITLES.filter((t) => t.audiences.includes(a) && t.deck === deck);
export const slidesFor = (a: Audience): Slide[] => SLIDES.filter((s) => s.audiences.includes(a));
export const slideOf = (id: string): Slide | undefined => SLIDES.find((s) => s.id === id);
export const titleOf = (id: string): Title | undefined => TITLES.find((t) => t.id === id);
export const mishapOf = (id: string): Mishap | undefined => MISHAPS.find((m) => m.id === id);
export const slidePicture = (id: string): string => `/stage/assets/slides/${id}.png`;
/** Chōchin-san's holiday photos (his running gag and the まちがい mishap): 1 a dark platform, 2 eyes in the dark, 3 the group photo. */
export const holidayPicture = (n: 1 | 2 | 3): string => `/stage/assets/slides/chochin-holiday-${n}.png`;
