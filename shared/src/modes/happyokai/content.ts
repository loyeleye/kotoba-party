// Happyōkai!'s content: talk titles, slides, mishaps, question cards and the presenter's lines.
// See docs/modes/happyokai.md. All Japanese is draft, and all kana, until the fluent check.
//
// A title is what the presenter talks about; the slides are pictures the assistant deals them, so the
// comedy is in joining the two. Every title is a noun phrase (it has to fit 「〜に ついて はなします」)
// with a topic noun, and the ready sentences bridge any slide back to it: 「これが ドラゴンです！」 over a
// picture of a single sock. Every slide is a picture with one word; its kind (living, place, food,
// thing) picks frames and verbs that fit it, so nobody is offered 「かっぱで 〜を しました」.

import type { JpText, Level } from '../../../../content/src/types.js';
import type { Audience } from '../../protocol.js';

/** What a title or slide is about, for the assistant's "fits the title" choice. */
export type Tag = 'animal' | 'yokai' | 'food' | 'place' | 'person' | 'thing' | 'home' | 'school' | 'work' | 'love' | 'travel' | 'space' | 'fun';

export interface Title {
  id: string;
  jp: JpText;
  /** The noun the talk is about, for bridge sentences (これが 〔topic〕です). */
  topic: JpText;
  tags: readonly Tag[];
  audiences: readonly Audience[];
}

export type WordKind = 'living' | 'place' | 'food' | 'thing';

/** An adjective a slide's word is often described with, for the ready sentences. */
export interface Adjective {
  /** Dictionary form in kana: おおきい, きれい. */
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
  audiences: readonly Audience[];
}

export type MishapId = 'blackout' | 'wrong' | 'graph' | 'upside' | 'message';

export interface Mishap {
  id: MishapId;
  /** The name on the assistant's card and the TV's banner. */
  name: JpText;
  emoji: string;
}

const jp = (text: string, en: string): JpText => ({ text, kana: text, en });
const ALL: readonly Audience[] = ['kids', 'family', 'cheeky'];
const KF: readonly Audience[] = ['kids', 'family'];
const FC: readonly Audience[] = ['family', 'cheeky'];
const C: readonly Audience[] = ['cheeky'];

const title = (id: string, text: string, en: string, topic: string, topicEn: string, tags: Tag[], audiences: readonly Audience[]): Title => ({ id, jp: jp(text, en), topic: jp(topic, topicEn), tags, audiences });

// ---- titles (Kids titles also play in Family rooms; Family titles also play in Cheeky rooms) ----

export const TITLES: Title[] = [
  // Kids
  title('dragon', 'ドラゴンの かいかた', 'How to keep a dragon', 'ドラゴン', 'the dragon', ['animal', 'home'], KF),
  title('ghost-school', 'おばけの がっこう', 'Ghost school', 'おばけ', 'the ghost', ['yokai', 'school'], KF),
  title('snack', 'せかいいち おいしい おやつ', "The world's tastiest snack", 'おやつ', 'the snack', ['food'], KF),
  title('cat-job', 'ねこの しごと', 'What cats do at work', 'ねこ', 'the cat', ['animal', 'work'], KF),
  title('fridge', 'れいぞうこの ひみつ', 'The secret of the fridge', 'れいぞうこ', 'the fridge', ['food', 'home'], KF),
  title('socks', 'くつしたが きえる なぞ', 'The mystery of the vanishing socks', 'くつした', 'the sock', ['thing', 'home'], KF),
  title('alien', 'うちゅうじんの ともだち', 'My alien friend', 'うちゅうじん', 'the alien', ['space', 'person'], KF),
  title('penguin', 'ペンギンの なつやすみ', "A penguin's summer holiday", 'ペンギン', 'the penguin', ['animal', 'travel'], KF),
  title('robot-lunch', 'ロボットの おべんとう', "A robot's packed lunch", 'ロボット', 'the robot', ['food', 'thing'], KF),
  title('dino', 'きょうりゅうの はみがき', 'How dinosaurs brush their teeth', 'きょうりゅう', 'the dinosaur', ['animal'], KF),
  title('nap', 'ひるねの プロ', 'The professional napper', 'ひるね', 'the nap', ['home'], KF),
  title('ghost-day', 'ゆうれいの いちにち', "A ghost's day", 'ゆうれい', 'the ghost', ['yokai'], KF),
  // Family
  title('kappa', 'かっぱの せんたく', 'Kappa laundry day', 'かっぱ', 'the kappa', ['yokai', 'home'], FC),
  title('grandpa', 'おじいちゃんの ひみつ', "Grandpa's secret", 'おじいちゃん', 'Grandpa', ['person'], FC),
  title('papa-karaoke', 'パパの カラオケ', "Dad's karaoke", 'パパ', 'Dad', ['person', 'fun'], FC),
  title('grandma-phone', 'おばあちゃんの スマホ', "Grandma's smartphone", 'おばあちゃん', 'Grandma', ['person', 'thing'], FC),
  title('remote', 'きえた リモコン', 'The case of the vanished remote', 'リモコン', 'the remote', ['thing', 'home'], FC),
  title('dog', 'いぬの ほんとうの きもち', 'What the dog really thinks', 'いぬ', 'the dog', ['animal', 'home'], FC),
  title('toilets', 'トイレが じゅっこ ある いえ', 'My house with ten toilets', 'いえ', 'the house', ['home', 'place'], FC),
  title('souvenir', 'いちばん いらない おみやげ', "The world's least wanted souvenir", 'おみやげ', 'the souvenir', ['travel', 'thing'], FC),
  title('neighbours', 'となりの ひとの なぞ', 'The mystery of the neighbours', 'となりの ひと', 'the neighbour', ['person', 'home'], FC),
  title('ghost-good', 'ゆうれいの いい ところ', 'The good side of ghosts', 'ゆうれい', 'the ghost', ['yokai'], FC),
  title('trip', 'かぞくりょこうの だいしっぱい', 'Our family trip disaster', 'りょこう', 'the trip', ['travel'], FC),
  title('teacher', 'せんせいの しゅうまつ', 'What teachers do at the weekend', 'せんせい', 'the teacher', ['person', 'school'], FC),
  // Cheeky
  title('secret-job', 'わたしの ひみつの しごと', 'My secret job', 'しごと', 'the job', ['work'], C),
  title('ex-him', 'もとカレの はなし', 'About my ex-boyfriend', 'もとカレ', 'my ex', ['love', 'person'], C),
  title('ex-her', 'もとカノの はなし', 'About my ex-girlfriend', 'もとカノ', 'my ex', ['love', 'person'], C),
  title('skip-work', 'かいしゃを やすむ いいわけ', 'Excuses for skipping work', 'いいわけ', 'the excuse', ['work'], C),
  title('hangover', 'ふつかよいの なおしかた', 'How to cure a hangover', 'ふつかよい', 'the hangover', ['food', 'home'], C),
  title('boss', 'ぶちょうの ひみつ', "The boss's secret", 'ぶちょう', 'the boss', ['work', 'person'], C),
  title('worst-date', 'さいあくの デート', 'My worst date', 'デート', 'the date', ['love'], C),
  title('groom', 'しんろうの ひみつ', "The groom's secrets", 'しんろう', 'the groom', ['love', 'person'], C),
  title('app-photo', 'マッチングアプリの しゃしん', 'My dating-app photo', 'しゃしん', 'the photo', ['love', 'thing'], C),
  title('meeting', 'かいぎで ねない ほうほう', 'How not to fall asleep in meetings', 'かいぎ', 'the meeting', ['work'], C),
  title('last-train', 'しゅうでんを のがした よる', 'The night I missed the last train', 'しゅうでん', 'the last train', ['travel', 'fun'], C),
  title('cv', 'りれきしょの うそ', 'The lies on my CV', 'りれきしょ', 'the CV', ['work', 'thing'], C),
  // From women's side of the night out, the date and the wedding (Ladi: the audience is half women).
  title('joshikai', 'じょしかいの ひみつ', "What really happens at girls' night", 'じょしかい', "girls' night", ['fun', 'love', 'person'], C),
  title('goukon', 'ごうコンの はんせいかい', 'The group-date post-mortem', 'ごうコン', 'the group date', ['love', 'fun'], C),
  title('shuutome', 'しゅうとめの チェック', "My mother-in-law's inspection", 'しゅうとめ', 'my mother-in-law', ['home', 'person'], C),
  title('bride', 'はなよめの ほんね', 'What the bride really thinks', 'はなよめ', 'the bride', ['love', 'person'], C),
  title('suppin', 'すっぴんの ひみつ', 'The secret of my bare face', 'すっぴん', 'my bare face', ['home', 'love'], C),
  // College life.
  title('tetsuya', 'テストまえの てつや', 'The all-nighter before the exam', 'てつや', 'the all-nighter', ['school', 'fun'], C),
  title('circle', 'サークルの のみかい', "My club's drinking party", 'のみかい', 'the drinking party', ['school', 'fun', 'food'], C),
  title('student-fridge', 'ひとりぐらしの れいぞうこ', 'What is in my student fridge', 'れいぞうこ', 'my fridge', ['school', 'home', 'food'], C),
  title('baito', 'バイトの てんちょう', 'My part-time job manager', 'てんちょう', 'the manager', ['work', 'person'], C),
  // Yakuza who really shouldn't be yakuza.
  title('kid-boss', 'しょうがっこうの くみちょう', 'The primary-school crime boss', 'くみちょう', 'the boss', ['school', 'person', 'fun'], C),
  title('granny-gang', 'おばあちゃんぐみ', 'The Granny Gang', 'おばあちゃんぐみ', 'the Granny Gang', ['person', 'fun'], C),
  title('shiba-oyabun', 'しばいぬの おやぶん', 'The shiba-inu godfather', 'おやぶん', 'the godfather', ['animal', 'work'], C),
  title('konbini-3am', 'よなかの コンビニ', 'The konbini at 3 a.m.', 'コンビニ', 'the konbini', ['food', 'place', 'fun'], C),
];

// ---- slides ----

const i = (text: string, en: string): Adjective => ({ text, en, kind: 'i' });
const na = (text: string, en: string): Adjective => ({ text, en, kind: 'na' });
interface SlideOpts {
  did?: [string, string];
  wild?: true;
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
});

export const SLIDES: Slide[] = [
  // Everyday Japan, played straight: real things a visitor sees, so the talk teaches real words.
  slide('omikuji', 'おみくじ', 'fortune slip', '🎋', 'thing', na('ふしぎ', 'mysterious'), ['travel', 'fun'], { did: ['おみくじを ひきました', 'I drew a fortune'] }),
  slide('jihanki', 'じはんき', 'vending machine', '🥤', 'thing', na('べんり', 'handy'), ['thing', 'food'], { did: ['じはんきで おちゃを かいました', 'I bought tea from a vending machine'] }),
  slide('rush-hour', 'でんしゃ', 'train', '🚃', 'thing', i('せまい', 'cramped'), ['travel', 'work'], { did: ['でんしゃに のりました', 'I rode a train'] }),
  slide('shinkansen', 'しんかんせん', 'bullet train', '🚄', 'thing', i('はやい', 'fast'), ['travel'], { did: ['しんかんせんに のりました', 'I rode the bullet train'] }),
  slide('kotatsu', 'こたつ', 'kotatsu', '🍊', 'thing', i('あたたかい', 'warm'), ['home'], { did: ['こたつで ねました', 'I slept in the kotatsu'] }),
  slide('ekiben', 'えきべん', 'station bento', '🍱', 'food', i('おいしい', 'tasty'), ['food', 'travel']),
  slide('sakura', 'さくら', 'cherry blossoms', '🌸', 'thing', na('きれい', 'beautiful'), ['travel', 'fun', 'love'], { did: ['さくらを みました', 'I saw the cherry blossoms'] }),
  slide('oden', 'おでん', 'oden', '🍢', 'food', i('あつい', 'hot'), ['food', 'work']),
  slide('sento', 'せんとう', 'public bath', '🛁', 'place', i('ひろい', 'big'), ['travel', 'home', 'place']),
  slide('ramen', 'ラーメン', 'ramen', '🍜', 'food', i('おいしい', 'tasty'), ['food', 'travel']),
  slide('sushi', 'すし', 'sushi', '🍣', 'food', i('たかい', 'expensive'), ['food', 'love']),
  slide('curry', 'カレー', 'curry', '🍛', 'food', i('からい', 'spicy'), ['food', 'home']),
  slide('natto', 'なっとう', 'natto', '🫘', 'food', i('くさい', 'smelly'), ['food', 'home']),
  slide('school', 'がっこう', 'school', '🏫', 'place', i('ふるい', 'old'), ['school', 'place']),
  slide('konbini', 'コンビニ', 'konbini', '🏪', 'place', i('あかるい', 'bright'), ['food', 'work', 'place']),
  slide('onsen', 'おんせん', 'hot spring', '♨️', 'place', i('あつい', 'hot'), ['travel', 'place']),
  slide('fuji', 'ふじさん', 'Mount Fuji', '🗻', 'place', i('たかい', 'tall'), ['travel', 'place']),
  slide('sea', 'うみ', 'the sea', '🌊', 'place', na('きれい', 'beautiful'), ['travel', 'place', 'love']),
  slide('shiba', 'いぬ', 'dog', '🐕', 'living', i('かしこい', 'clever'), ['animal', 'home']),
  slide('cat', 'ねこ', 'cat', '🐱', 'living', i('かわいい', 'cute'), ['animal', 'home']),
  slide('teacher', 'せんせい', 'teacher', '🧑‍🏫', 'living', i('きびしい', 'strict'), ['person', 'school']),
  slide('grandpa', 'おじいちゃん', 'grandpa', '👴', 'living', i('つよい', 'tough'), ['person', 'fun']),
  slide('baby', 'あかちゃん', 'baby', '👶', 'living', i('ちいさい', 'tiny'), ['person', 'home']),
  slide('umbrella', 'かさ', 'umbrella', '☂️', 'thing', i('ふるい', 'old'), ['thing', 'travel']),
  slide('bicycle', 'じてんしゃ', 'bicycle', '🚲', 'thing', i('おもい', 'heavy'), ['thing', 'home'], { did: ['じてんしゃに のりました', 'I rode a bicycle'] }),
  slide('money', 'おかね', 'money', '💴', 'thing', na('だいじ', 'important'), ['work', 'thing'], { did: ['おかねを ひろいました', 'I found some money'] }),
  // Ridiculous: the むちゃぶり (impossible ask) pool, for every room.
  slide('grandma', 'おばあちゃん', 'grandma', '👵', 'living', na('げんき', 'full of energy'), ['person', 'fun'], { wild: true }),
  slide('sock', 'くつした', 'sock', '🧦', 'thing', na('たいせつ', 'precious'), ['thing', 'home'], { wild: true }),
  slide('cat-boss', 'しゃちょう', 'company boss', '💼', 'living', i('えらい', 'important'), ['work', 'animal', 'person'], { wild: true }),
  slide('kappa', 'かっぱ', 'kappa', '🥒', 'living', na('まじめ', 'hard-working'), ['yokai', 'home'], { wild: true }),
  slide('tanuki', 'たぬき', 'tanuki', '🦝', 'living', i('かなしい', 'sad'), ['animal', 'yokai', 'fun'], { wild: true }),
  slide('ghost', 'おばけ', 'ghost', '👻', 'living', i('かわいい', 'cute'), ['yokai', 'travel'], { wild: true }),
  slide('dragon', 'ドラゴン', 'dragon', '🐉', 'living', i('あつい', 'hot'), ['animal', 'yokai', 'food'], { wild: true }),
  slide('octopus', 'たこ', 'octopus', '🐙', 'living', i('こわい', 'scared'), ['animal', 'food', 'work'], { wild: true }),
  slide('pudding', 'プリン', 'pudding', '🍮', 'food', i('おおきい', 'huge'), ['food'], { wild: true }),
  slide('ufo', 'ユーフォー', 'UFO', '🛸', 'thing', na('ふしぎ', 'mysterious'), ['space', 'thing'], { did: ['ユーフォーを みました', 'I saw a UFO'], wild: true }),
  slide('dinosaur', 'きょうりゅう', 'dinosaur', '🦖', 'living', i('おおきい', 'big'), ['animal', 'work', 'travel'], { wild: true }),
  slide('penguin', 'ペンギン', 'penguin', '🐧', 'living', i('さむい', 'cold'), ['animal', 'travel'], { wild: true }),
  slide('robot', 'ロボット', 'robot', '🤖', 'thing', na('ていねい', 'polite'), ['thing', 'work'], { wild: true }),
  slide('alien', 'うちゅうじん', 'alien', '👽', 'living', na('しんせつ', 'kind'), ['space', 'person', 'food'], { wild: true }),
  slide('pants', 'パンツ', 'underpants', '🩲', 'thing', i('おおきい', 'big'), ['home', 'fun'], { wild: true }),
  slide('toilet', 'トイレ', 'toilet', '🚽', 'place', i('むずかしい', 'complicated'), ['home', 'place', 'thing'], { wild: true }),
  slide('panda', 'パンダ', 'panda', '🐼', 'living', i('おもい', 'heavy'), ['animal', 'travel'], { wild: true }),
  slide('daruma', 'だるま', 'daruma doll', '🔴', 'thing', i('あかい', 'red'), ['thing', 'fun'], { did: ['だるまを かいました', 'I bought a daruma'], wild: true }),
  slide('mochi', 'おもち', 'mochi', '🍡', 'food', i('ながい', 'long'), ['food', 'home'], { wild: true }),
  slide('pigeon', 'はと', 'pigeon', '🐦', 'living', na('まじめ', 'serious'), ['animal', 'travel', 'work'], { wild: true }),
  slide('fridge', 'れいぞうこ', 'fridge', '🧊', 'thing', i('つめたい', 'cold'), ['food', 'home'], { did: ['れいぞうこを あけました', 'I opened the fridge'], wild: true }),
  slide('remote', 'リモコン', 'TV remote', '📺', 'thing', i('ちいさい', 'small'), ['home', 'thing'], { did: ['リモコンを さがしました', 'I looked for the remote'], wild: true }),
  // Grown-up (Family and Cheeky)
  slide('office', 'かいしゃ', 'office', '🏢', 'place', i('いそがしい', 'busy'), ['work', 'place'], { audiences: FC }),
  slide('karaoke', 'カラオケ', 'karaoke', '🎤', 'place', i('うるさい', 'loud'), ['fun', 'place', 'work'], { audiences: FC, wild: true }),
  slide('ring', 'ゆびわ', 'ring', '💍', 'thing', i('たかい', 'expensive'), ['love', 'thing', 'food'], { audiences: FC, wild: true }),
  // Cheeky: awkward grown-up moments, never explicit.
  slide('balcony', 'ベランダ', 'balcony', '🩳', 'place', i('さむい', 'cold'), ['home', 'love'], { audiences: C, wild: true }),
  slide('drunk', 'よっぱらい', 'drunk salaryman', '🍶', 'living', i('うるさい', 'loud'), ['work', 'person', 'fun'], { audiences: C, wild: true }),
  slide('meeting', 'かいぎ', 'meeting', '😴', 'thing', i('ながい', 'long'), ['work'], { audiences: C, did: ['かいぎに でました', 'I went to a meeting'], wild: true }),
  slide('groom', 'しんろう', 'groom', '🤵', 'living', na('まじめ', 'earnest'), ['love', 'person'], { audiences: C, wild: true }),
  slide('you-up', 'メッセージ', 'message', '📱', 'thing', i('こわい', 'scary'), ['love', 'thing'], { audiences: C, did: ['メッセージを よみました', 'I read a message'], wild: true }),
  slide('beer', 'ビール', 'beer', '🍺', 'food', i('つめたい', 'cold'), ['food', 'work', 'fun'], { audiences: C, did: ['ビールを のみました', 'I drank beer'] }),
  slide('cv', 'りれきしょ', 'CV', '📄', 'thing', na('しょうじき', 'honest'), ['work'], { audiences: C, did: ['りれきしょを かきました', 'I wrote my CV'], wild: true }),
  slide('love-letter', 'ラブレター', 'love letter', '💌', 'thing', i('はずかしい', 'embarrassing'), ['love', 'school', 'work'], { audiences: C, did: ['ラブレターを かきました', 'I wrote a love letter'], wild: true }),
  slide('heel', 'ハイヒール', 'high heel', '👠', 'thing', i('たかい', 'high'), ['love', 'travel'], { audiences: C, wild: true }),
  slide('fish-photo', 'さかな', 'fish', '🐟', 'food', i('おおきい', 'big'), ['love', 'food', 'fun'], { audiences: C, wild: true }),
  slide('capsule', 'カプセルホテル', 'capsule hotel', '🛌', 'place', i('せまい', 'cramped'), ['travel', 'work', 'place'], { audiences: C, wild: true }),
  // Cheeky from women's side.
  slide('bouquet', 'ブーケ', 'bouquet', '💐', 'thing', na('きれい', 'pretty'), ['love', 'fun'], { audiences: C, did: ['ブーケを とりました', 'I caught the bouquet'], wild: true }),
  slide('joshikai', 'じょしかい', "girls' night", '🥂', 'thing', i('たのしい', 'fun'), ['fun', 'love', 'person'], { audiences: C, did: ['じょしかいに いきました', "I went to a girls' night"] }),
  slide('shuutome', 'しゅうとめ', 'mother-in-law', '🧤', 'living', i('きびしい', 'strict'), ['home', 'person'], { audiences: C, wild: true }),
  slide('makeup', 'けしょう', 'makeup', '💄', 'thing', i('はやい', 'quick'), ['travel', 'work'], { audiences: C, did: ['でんしゃで けしょうを しました', 'I did my makeup on the train'], wild: true }),
  slide('mama-boy', 'マザコン', "mummy's boy", '📞', 'living', i('やさしい', 'sweet'), ['love', 'person', 'home'], { audiences: C, wild: true }),
  slide('face-mask', 'パック', 'face mask', '🧖', 'thing', i('しろい', 'white'), ['home', 'love'], { audiences: C, did: ['パックを しました', 'I put on a face mask'], wild: true }),
  slide('shopping', 'かいもの', 'shopping', '🛍️', 'thing', i('たのしい', 'fun'), ['fun', 'love', 'travel'], { audiences: C, did: ['かいものを しました', 'I went shopping'], wild: true }),
  slide('cake', 'ケーキ', 'cake', '🍰', 'food', i('あまい', 'sweet'), ['food', 'home', 'love'], { audiences: C, wild: true }),
  // College life.
  slide('all-nighter', 'てつや', 'all-nighter', '🥱', 'thing', i('ねむい', 'sleepy'), ['school', 'fun'], { audiences: C, did: ['てつやしました', 'I pulled an all-nighter'], wild: true }),
  slide('cup-noodle', 'カップラーメン', 'cup noodles', '🍜', 'food', i('やすい', 'cheap'), ['food', 'school', 'home'], { audiences: C }),
  slide('nomikai', 'のみかい', 'drinking party', '🍻', 'thing', i('うるさい', 'loud'), ['school', 'fun', 'food'], { audiences: C, did: ['のみかいに いきました', 'I went to a drinking party'], wild: true }),
  slide('lecture', 'じゅぎょう', 'lecture', '💤', 'thing', i('ながい', 'long'), ['school'], { audiences: C, did: ['じゅぎょうで ねました', 'I slept in class'], wild: true }),
  slide('kigurumi', 'きぐるみ', 'mascot costume', '🐔', 'thing', i('あつい', 'hot'), ['work', 'fun'], { audiences: C, did: ['きぐるみを きました', 'I wore a mascot costume'], wild: true }),
  // Yakuza who really shouldn't be yakuza.
  slide('kid-boss', 'くみちょう', 'gang boss', '🎒', 'living', i('こわい', 'scary'), ['school', 'person', 'fun'], { audiences: C, wild: true }),
  slide('tea-yakuza', 'ヤクザ', 'yakuza', '🍵', 'living', na('ていねい', 'polite'), ['person', 'fun', 'food'], { audiences: C, wild: true }),
  slide('shiba-oyabun', 'おやぶん', 'godfather', '🐕', 'living', i('えらい', 'important'), ['animal', 'work', 'person'], { audiences: C, wild: true }),
  slide('maid-yakuza', 'メイドカフェ', 'maid café', '🎀', 'place', i('かわいい', 'cute'), ['work', 'food', 'place'], { audiences: C, wild: true }),
  slide('hitokara', 'ひとりカラオケ', 'solo karaoke', '🎤', 'place', na('しずか', 'quiet'), ['fun', 'place'], { audiences: C, wild: true }),
];

// ---- mishaps ----

export const MISHAPS: Mishap[] = [
  { id: 'blackout', name: jp('まっくら', 'Blackout'), emoji: '🌑' },
  { id: 'wrong', name: jp('まちがい', 'Wrong slide'), emoji: '🏮' },
  { id: 'graph', name: jp('グラフ', 'The graph'), emoji: '📈' },
  { id: 'upside', name: jp('さかさま', 'Upside down'), emoji: '🙃' },
  { id: 'message', name: jp('メッセージ', 'A message'), emoji: '💬' },
];

/** The message that pops up over the slide in the メッセージ mishap: Mum in most rooms, an ex in Cheeky. */
export const messageFor = (audience: Audience): { from: JpText; text: JpText } =>
  audience === 'cheeky' ? { from: jp('もとカレ', 'Ex'), text: jp('おきてる？😉', 'You up? 😉') } : { from: jp('おかあさん', 'Mum'), text: jp('ごはんよ！🍛', "Dinner's ready! 🍛") };

// ---- the presenter's lines ----

/** The opening line, by level: the ritual of every Japanese presentation. */
export function openingFor(level: Level, name: string, t: JpText): JpText {
  if (level === 'kana') return jp(`みなさん、こんにちは。${name}です。タイトルは 「${t.text}」です。`, `Hello everyone. I'm ${name}. The title is "${t.en}".`);
  if (level === 'n5') return jp(`はじめまして。${name}です。きょうは ${t.text}に ついて はなします。よろしく おねがいします。`, `Nice to meet you. I'm ${name}. Today I'll talk about ${t.en}. Thank you in advance.`);
  return jp(`みなさん、こんばんは。${name}と もうします。きょうは ${t.text}に ついて はなしたいと おもいます。よろしく おねがいします。`, `Good evening, everyone. My name is ${name}. Today I'd like to talk about ${t.en}. Thank you in advance.`);
}

export function closingFor(level: Level): JpText {
  if (level === 'kana') return jp('いじょうです。ありがとうございました！', "That's all. Thank you very much!");
  if (level === 'n5') return jp('これで はっぴょうを おわります。ありがとうございました！', 'That ends my presentation. Thank you very much!');
  return jp('いじょうです。ごせいちょう ありがとうございました。', "That's all. Thank you for listening.");
}

/** Sentence patterns for a picture slide (＿ is the slide's word, 〜 a gap to fill), fitted to its kind. */
export function framesFor(level: Level, s: Slide): string[] {
  if (level === 'kana') return ['これは ＿です。', '＿が すきです。', 'すごいですね！'];
  if (level === 'n5') {
    const kind = { living: '＿と あそびました。', place: '＿に いきました。', food: '＿を たべました。', thing: '＿を かいました。' }[s.kind];
    return ['これは ＿です。', '＿は とても 〜です。', s.did ? s.did.text.replace(s.word.text, '＿') + '。' : kind, '〜から、〜。', 'そして… ／ でも…'];
  }
  return ['＿は 〜そうですね。', '〜ので、〜。', '〜たら、〜。', '〜と おもいます。', 'じつは、〜んです。', '〜た ことが あります。'];
}

const polite = (a: Adjective): string => `${a.text}です`;
const te = (a: Adjective): string => (a.kind === 'i' ? (a.text === 'いい' ? 'よくて' : `${a.text.slice(0, -1)}くて`) : `${a.text}で`);
const didOf = (s: Slide): JpText => {
  if (s.did) return s.did;
  const w = s.word.text;
  const en = s.word.en;
  if (s.kind === 'living') return jp(`${w}と あそびました`, `I played with a ${en}`);
  if (s.kind === 'place') return jp(`${w}に いきました`, `I went to the ${en}`);
  if (s.kind === 'food') return jp(`${w}を たべました`, `I ate ${en}`);
  return jp(`${w}を かいました`, `I bought a ${en}`);
};

/**
 * Sentences for a picture slide, to read out or tap. Each level gets two; the second bridges the picture
 * back to the talk's topic, which is where the joke is (「これが ドラゴンです！」 over a sock).
 */
export function readySentences(s: Slide, level: Level, topic: JpText | null): JpText[] {
  const w = s.word.text;
  const en = s.word.en;
  const t = topic ?? jp('これ', 'this');
  const did = didOf(s);
  if (level === 'kana') return [jp(`これは ${w}です。`, `This is a ${en}.`), jp(`これが ${t.text}です！`, `THIS is ${t.en}!`)];
  if (level === 'n5')
    return [
      jp(`これは ${w}です。とても ${polite(s.adj)}。`, `This is a ${en}. It's very ${s.adj.en}.`),
      jp(`きのう、${did.text}。${t.text}も いっしょでした。`, `Yesterday ${did.en}. ${cap(t.en)} came too.`),
    ];
  return [
    jp(`じつは、${t.text}は ${w}が だいすきなんです。`, `Actually, ${t.en} loves ${en}s.`),
    jp(`この ${w}は ${te(s.adj)}、${t.text}に ぴったりだと おもいます。`, `This ${en} is ${s.adj.en}, so I think it's perfect for ${t.en}.`),
  ];
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** What the presenter can say to recover from a mishap, by level. `word` is the talk's first slide word. */
export function recoveryFor(id: MishapId, level: Level, word: JpText | null, up: boolean, audience: Audience = 'family'): JpText {
  const w = word ?? jp('おきゃくさん', 'visitors');
  const L = (kana: [string, string], n5: [string, string], n4: [string, string]): JpText => {
    const [text, en] = level === 'kana' ? kana : level === 'n5' ? n5 : n4;
    return jp(text, en);
  };
  switch (id) {
    case 'blackout':
      return L(['あれ？　まっくらです！', "Huh? It's pitch dark!"], ['あれ？　まっくらですね。すみません、つぎ おねがいします。', "Huh? It's pitch dark. Sorry, next one please."], ['あれ、でんきが きえて しまいました。すみません、つぎ おねがいします。', 'Oh, the lights have gone out. Sorry, next one please.']);
    case 'wrong':
      return L(['あ、すみません。まちがえました。', 'Oh, sorry. Wrong one.'], ['あ、しつれいしました。これは ちょうちんさんの しゃしんですね。', "Oh, excuse me. This is Chōchin-san's photo, isn't it."], ['しつれいしました。ちょうちんさんの りょこうの しゃしんが まざって いました。', "Excuse me. Chōchin-san's holiday photos got mixed in."]);
    case 'graph':
      return L(
        ['みて ください！　すごいですね！', "Look! Amazing, isn't it!"],
        up ? [`みて ください。${w.text}が こんなに おおく なりました！`, `Look. There are this many more ${w.en}s now!`] : [`みて ください。${w.text}が こんなに すくなく なりました！`, `Look. There are this many fewer ${w.en}s now!`],
        up ? [`みて ください。${w.text}が こんなに ふえました！`, `Look. ${cap(w.en)}s have gone up this much!`] : [`みて ください。${w.text}が こんなに へりました！`, `Look. ${cap(w.en)}s have gone down this much!`],
      );
    case 'upside':
      return L(['あれ？　さかさまです！', "Huh? It's upside down!"], ['あれ？　さかさまですね。すみません！', "Huh? It's upside down. Sorry!"], ['あれ、スライドが さかさまに なって います。しつれいしました。', 'Oh, the slide is upside down. Excuse me.']);
    case 'message':
      if (audience === 'cheeky') return L(['みないで ください！', "Don't look!"], ['いまのは みないで ください！', "Please don't look at that!"], ['いまのは みなかった ことに して ください。', 'Please pretend you never saw that.']);
      return L(['すみません、ははです。', "Sorry, it's my mum."], ['すみません、ははからです。', "Sorry, it's from my mum."], ['すみません、ははから メッセージが きました。', 'Sorry, I got a message from my mum.']);
  }
}

// ---- question time ----

export interface Question {
  id: string;
  /** `{word}` is the talk's first slide word, `{topic}` the title's topic. */
  text: string;
  en: string;
  /** Lowest level that gets this card. */
  level: Level;
  /** Only for these kinds of slide word (when it uses {word}). */
  kinds?: readonly WordKind[];
  audiences?: readonly Audience[];
}

export const QUESTIONS: Question[] = [
  { id: 'really', text: 'ほんとうですか？', en: 'Really?', level: 'kana' },
  { id: 'why', text: 'どうしてですか？', en: 'Why?', level: 'kana' },
  { id: 'like', text: '{word}が すきですか？', en: 'Do you like {word_en}s?', level: 'kana' },
  { id: 'photo', text: 'しゃしんは ありますか？', en: 'Do you have a photo?', level: 'kana' },
  { id: 'mum', text: 'おかあさんは しっていますか？', en: 'Does your mum know?', level: 'kana' },
  { id: 'price', text: '{word}は いくらですか？', en: 'How much was the {word_en}?', level: 'n5', kinds: ['food', 'thing'] },
  { id: 'where', text: '{topic}は いま どこですか？', en: 'Where is {topic_en} now?', level: 'n5' },
  { id: 'how-was', text: 'どうでしたか？', en: 'How was it?', level: 'n5' },
  { id: 'work', text: 'かいしゃの ひとは しっていますか？', en: 'Does anyone at work know?', level: 'n5', audiences: ['cheeky'] },
  { id: 'hardest', text: 'いちばん たいへんだった ことは なんですか？', en: 'What was the hardest part?', level: 'n4' },
  { id: 'without', text: 'もし {word}が なかったら、どう しますか？', en: 'What would you do without the {word_en}?', level: 'n4' },
];

const LEVELS: Level[] = ['kana', 'n5', 'n4'];

/**
 * Three question cards for one asker, at the lower of their level and the presenter's (so both can manage
 * the exchange), fitted to the talk's slide word and the room.
 */
export function questionsFor(level: Level, word: Slide | null, topic: JpText | null, audience: Audience, random: () => number): JpText[] {
  const w = word?.word ?? jp('それ', 'it');
  const t = topic ?? jp('それ', 'it');
  const pool = QUESTIONS.filter(
    (q) => LEVELS.indexOf(q.level) <= LEVELS.indexOf(level) && (!q.kinds || (word && q.kinds.includes(word.kind))) && (!q.audiences || q.audiences.includes(audience)) && (word || !q.text.includes('{word}')),
  );
  // Each player's three: one at their level if there is one, the rest at random.
  const top = pool.filter((q) => q.level === level);
  const first = top.length ? top[Math.floor(random() * top.length)]! : pool[Math.floor(random() * pool.length)]!;
  const rest = pool.filter((q) => q !== first);
  for (let k = rest.length - 1; k > 0; k--) {
    const j = Math.floor(random() * (k + 1));
    [rest[k], rest[j]] = [rest[j]!, rest[k]!];
  }
  return [first, ...rest.slice(0, 2)].map((q) => jp(fill(q.text, w, t), fill(q.en.replace('{word_en}', w.en).replace('{topic_en}', t.en), w, t)));
}

const fill = (s: string, w: JpText, t: JpText): string => s.replace('{word}', w.text).replace('{topic}', t.text);

/** Answer patterns for question time. */
export function answerFrames(level: Level): string[] {
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

/** Chōchin-san's comment on the report card: about the talk, never about anyone's Japanese. */
export function teacherComment(best: Slide | null, mishap: boolean, topic: JpText | null): JpText {
  if (mishap) return jp('ハプニングにも まけませんでした。', "Didn't let the mishap win.");
  if (best) return jp(`${best.word.text}の はなしが よかったです。`, `The bit about the ${best.word.en} was great.`);
  if (topic) return jp(`${topic.text}に あいたく なりました。`, `Now I want to meet ${topic.en}.`);
  return jp('また ききたいです。', "I'd like to hear it again.");
}

export const titlesFor = (a: Audience): Title[] => TITLES.filter((t) => t.audiences.includes(a));
export const slidesFor = (a: Audience): Slide[] => SLIDES.filter((s) => s.audiences.includes(a));
export const slideOf = (id: string): Slide | undefined => SLIDES.find((s) => s.id === id);
export const titleOf = (id: string): Title | undefined => TITLES.find((t) => t.id === id);
export const mishapOf = (id: string): Mishap | undefined => MISHAPS.find((m) => m.id === id);
export const slidePicture = (id: string): string => `/stage/assets/slides/${id}.png`;
/** Chōchin-san's holiday photos (his running gag and the まちがい mishap): 1 a dark platform, 2 eyes in the dark, 3 the group photo. */
export const holidayPicture = (n: 1 | 2 | 3): string => `/stage/assets/slides/chochin-holiday-${n}.png`;
