// はじめまして！'s cards (おだい): what each turn's guest tells the truth about and the tanuki lie about.
// See docs/modes/hajimemashite.md. All Japanese is draft until the fluent check.
//
// A card is a frame with one blank (＿), said in the first person by its writer and in the third
// person by the introducer ({name} is the guest's katakana name). Frames that can't take someone
// else as their subject (〜たい, こわい) are noun sentences: 「アキさんの いきたい ところは ＿です」,
// never 「アキさんは ＿に いきたいです」. Each card has 16 tiles to fill the blank: the guest sees them
// all, each tanuki a private hand of four. Kana only, katakana for loanwords, so a typed card and a
// tile look the same on the TV. `pon` is Pon's own in-frame lie, used once a game in a 3-player room.
//
// The N4 deck (goal 4.3, experiences, tries and oops): ＿た ことが あります, ＿て しまいました,
// ＿て みました and ＿て みたい. N4 guests draw these first; everyone else never sees them. Kids and
// Cheeky rooms add their own N4 cards (Ladi's call), which their N4 guests draw before the shared ones.
//
// The deck's verb cards (`conj`) make the player conjugate: the blank is a verb phrase, its tiles show
// the dictionary form (ふじさんに のぼる) under the card's `cue` (＿た ことが あります), and the line is
// said with the た or て form (ふじさんに のぼった ことが あります). A tile's kana is the conjugated phrase,
// so the TV, twins, the truth and every check use the form the line needs; `dict` is only the prompt.

import type { JpText, ReviewStatus } from '../../../../content/src/types.js';
import type { Audience } from '../../protocol.js';

export interface Tile {
  id: string;
  /** The blank's word, as the TV shows it (on a verb card, the conjugated phrase: ふじさんに のぼった). */
  kana: string;
  en: string;
  emoji: string;
  /** A verb card's tile: the phrase in the dictionary form, which is what the player is shown (ふじさんに のぼる). */
  dict?: string;
}

/** A verb card's form: ＿た (ta) or ＿て (te). */
export type Conj = 'ta' | 'te';

export interface IntroCard {
  id: string;
  title: JpText;
  /** First person, with ＿ for the blank. */
  first: string;
  /** Third person, with {name} and ＿. */
  third: string;
  /** The frame in English, with ___ for the blank. */
  en: string;
  /** The same about someone else, with {name} (what the tanuki and the introducer see). */
  enThird: string;
  /** N4 cards go only to N4 guests. A chunk card is N4 grammar used as a fixed phrase. */
  level: 'n5' | 'n4';
  /**
   * A verb card: the blank takes the た or て form of its tile's dictionary-form phrase. `first` and
   * `third` take the conjugated phrase; `cue` and `cueThird` are the same frames as the player sees them,
   * with ＿た or ＿て for the verb they conjugate.
   */
  conj?: Conj;
  cue?: string;
  cueThird?: string;
  /** The N4 frames the card's lines practise, by frame id (N4 cards). */
  frames?: readonly string[];
  /** Set on the N4 deck's cards (all cards are draft until the fluent check). */
  status?: ReviewStatus;
  audiences: readonly Audience[];
  tiles: Tile[];
  pon: Tile;
}

const ALL: readonly Audience[] = ['kids', 'family', 'cheeky'];
const KF: readonly Audience[] = ['kids', 'family'];
const KIDS: readonly Audience[] = ['kids'];
const CHEEKY: readonly Audience[] = ['cheeky'];

/** Tiles from [kana, en, emoji] rows; ids are the card's id and the row number. */
function tiles(card: string, rows: [string, string, string][]): Tile[] {
  return rows.map(([kana, en, emoji], i) => ({ id: `${card}.${String(i + 1).padStart(2, '0')}`, kana, en, emoji }));
}
const ponTile = (card: string, kana: string, en: string): Tile => ({ id: `${card}.pon`, kana, en, emoji: '🍃' });
/** A verb card's tiles from [dictionary form, conjugated, en, emoji] rows. */
function verbTiles(card: string, rows: [string, string, string, string][]): Tile[] {
  return rows.map(([dict, kana, en, emoji], i) => ({ id: `${card}.${String(i + 1).padStart(2, '0')}`, kana, en, emoji, dict }));
}
const verbPon = (card: string, dict: string, kana: string, en: string): Tile => ({ ...ponTile(card, kana, en), dict });

export const INTRO_CARDS: IntroCard[] = [
  {
    id: 'suki',
    title: { text: 'すきな たべもの', kana: 'すきな たべもの', en: 'Favourite food' },
    first: '＿が だいすきです',
    third: '{name}さんは ＿が だいすきです',
    en: 'I love ___',
    enThird: '{name} loves ___',
    level: 'n5',
    audiences: ALL,
    tiles: tiles('suki', [
      ['すし', 'sushi', '🍣'], ['なっとう', 'nattō', '🫘'], ['カレー', 'curry', '🍛'], ['ピザ', 'pizza', '🍕'],
      ['ラーメン', 'ramen', '🍜'], ['うめぼし', 'pickled plums', '🟣'], ['チョコレート', 'chocolate', '🍫'], ['たこやき', 'takoyaki', '🐙'],
      ['からあげ', 'fried chicken', '🍗'], ['アイスクリーム', 'ice cream', '🍦'], ['ブロッコリー', 'broccoli', '🥦'], ['ドーナツ', 'doughnuts', '🍩'],
      ['ギョーザ', 'gyōza', '🥟'], ['おにぎり', 'rice balls', '🍙'], ['わさび', 'wasabi', '🌿'], ['パクチー', 'coriander', '🌱'],
    ]),
    pon: ponTile('suki', 'はっぱ', 'leaves'),
  },
  {
    id: 'kirai',
    title: { text: 'きらいな たべもの', kana: 'きらいな たべもの', en: 'Food you hate' },
    first: '＿が きらいです',
    third: '{name}さんは ＿が きらいです',
    en: 'I hate ___',
    enThird: '{name} hates ___',
    level: 'n5',
    audiences: ALL,
    tiles: tiles('kirai', [
      ['ピーマン', 'green peppers', '🫑'], ['なっとう', 'nattō', '🫘'], ['セロリ', 'celery', '🥬'], ['トマト', 'tomatoes', '🍅'],
      ['わさび', 'wasabi', '🌿'], ['しいたけ', 'shiitake', '🍄'], ['にんじん', 'carrots', '🥕'], ['なす', 'aubergine', '🍆'],
      ['うめぼし', 'pickled plums', '🟣'], ['パクチー', 'coriander', '🌱'], ['レバー', 'liver', '🥩'], ['グリンピース', 'peas', '🟢'],
      ['チーズ', 'cheese', '🧀'], ['たまねぎ', 'onions', '🧅'], ['オクラ', 'okra', '🌶'], ['きのこ', 'mushrooms', '🍄'],
    ]),
    pon: ponTile('kirai', 'ポンの りょうり', "Pon's cooking"),
  },
  {
    id: 'shumi',
    title: { text: 'しゅみ', kana: 'しゅみ', en: 'Hobby' },
    first: 'しゅみは ＿です',
    third: '{name}さんの しゅみは ＿です',
    en: 'My hobby is ___',
    enThird: "{name}'s hobby is ___",
    level: 'n5',
    audiences: ALL,
    tiles: tiles('shumi', [
      ['カラオケ', 'karaoke', '🎤'], ['つり', 'fishing', '🎣'], ['ダンス', 'dancing', '💃'], ['ゲーム', 'video games', '🎮'],
      ['りょうり', 'cooking', '🍳'], ['さんぽ', 'going for walks', '🚶'], ['ヨガ', 'yoga', '🧘'], ['しゃしん', 'photography', '📷'],
      ['ねること', 'sleeping', '😴'], ['まんがを よむこと', 'reading manga', '📚'], ['サッカー', 'football', '⚽'], ['ギター', 'guitar', '🎸'],
      ['キャンプ', 'camping', '⛺'], ['おかしづくり', 'baking sweets', '🧁'], ['ボルダリング', 'bouldering', '🧗'], ['ガーデニング', 'gardening', '🪴'],
    ]),
    pon: ponTile('shumi', 'ポンの ものまね', 'doing Pon impressions'),
  },
  {
    id: 'ikitai',
    title: { text: 'いきたい ところ', kana: 'いきたい ところ', en: 'Where you want to go' },
    first: 'いきたい ところは ＿です',
    third: '{name}さんの いきたい ところは ＿です',
    en: 'The place I want to go is ___',
    enThird: 'The place {name} wants to go is ___',
    level: 'n5',
    audiences: ALL,
    tiles: tiles('ikitai', [
      ['ほっかいどう', 'Hokkaidō', '❄'], ['おきなわ', 'Okinawa', '🏝'], ['きょうと', 'Kyoto', '⛩'], ['パリ', 'Paris', '🗼'],
      ['ハワイ', 'Hawaii', '🌺'], ['つき', 'the moon', '🌕'], ['エジプト', 'Egypt', '🐫'], ['アイスランド', 'Iceland', '🌋'],
      ['ディズニーランド', 'Disneyland', '🏰'], ['ふじさん', 'Mount Fuji', '🗻'], ['ブラジル', 'Brazil', '🇧🇷'], ['なんきょく', 'the South Pole', '🐧'],
      ['オーストラリア', 'Australia', '🦘'], ['イタリア', 'Italy', '🍝'], ['おばけやしき', 'a haunted house', '👻'], ['うちゅう', 'space', '🚀'],
    ]),
    pon: ponTile('ikitai', 'たぬきの むら', 'the tanuki village'),
  },
  {
    id: 'dekiru',
    title: { text: 'できること', kana: 'できること', en: 'Something you can do' },
    first: '＿が できます',
    third: '{name}さんは ＿が できます',
    en: 'I can do ___',
    enThird: '{name} can do ___',
    level: 'n5',
    audiences: ALL,
    tiles: tiles('dekiru', [
      ['ピアノ', 'piano', '🎹'], ['スキー', 'skiing', '⛷'], ['おりがみ', 'origami', '🦢'], ['けんだま', 'kendama', '🪀'],
      ['いちりんしゃ', 'a unicycle', '🚲'], ['ジャグリング', 'juggling', '🤹'], ['スケートボード', 'skateboarding', '🛹'], ['さかだち', 'a handstand', '🙃'],
      ['くちぶえ', 'whistling', '😗'], ['バイオリン', 'violin', '🎻'], ['サーフィン', 'surfing', '🏄'], ['からて', 'karate', '🥋'],
      ['あやとり', "cat's cradle", '🧶'], ['ものまね', 'impressions', '🎭'], ['ブレイクダンス', 'breakdancing', '🕺'], ['そろばん', 'the abacus', '🧮'],
    ]),
    pon: ponTile('dekiru', 'へんしん', 'shapeshifting'),
  },
  {
    id: 'kowai',
    title: { text: 'こわい もの', kana: 'こわい もの', en: "Something you're scared of" },
    first: 'こわい ものは ＿です',
    third: '{name}さんの こわい ものは ＿です',
    en: "The thing I'm scared of is ___",
    enThird: 'The thing {name} is scared of is ___',
    level: 'n5',
    audiences: ALL,
    tiles: tiles('kowai', [
      ['クモ', 'spiders', '🕷'], ['おばけ', 'ghosts', '👻'], ['ピエロ', 'clowns', '🤡'], ['かみなり', 'thunder', '⚡'],
      ['はいしゃさん', 'the dentist', '🦷'], ['たかい ところ', 'heights', '🏔'], ['ヘビ', 'snakes', '🐍'], ['ゴキブリ', 'cockroaches', '🪳'],
      ['にんぎょう', 'dolls', '🪆'], ['ジェットコースター', 'roller coasters', '🎢'], ['ひこうき', 'planes', '✈'], ['くらい ところ', 'the dark', '🌑'],
      ['ハチ', 'bees', '🐝'], ['ちゅうしゃ', 'injections', '💉'], ['うみ', 'the sea', '🌊'], ['ねこ', 'cats', '🐈'],
    ]),
    pon: ponTile('kowai', 'かがみ', 'mirrors'),
  },
  {
    id: 'asa',
    title: { text: 'まいあさ のむ もの', kana: 'まいあさ のむ もの', en: 'What you drink every morning' },
    first: 'まいあさ ＿を のみます',
    third: '{name}さんは まいあさ ＿を のみます',
    en: 'Every morning I drink ___',
    enThird: 'Every morning {name} drinks ___',
    level: 'n5',
    audiences: ALL,
    tiles: tiles('asa', [
      ['コーヒー', 'coffee', '☕'], ['おちゃ', 'green tea', '🍵'], ['ぎゅうにゅう', 'milk', '🥛'], ['オレンジジュース', 'orange juice', '🍊'],
      ['こうちゃ', 'black tea', '🫖'], ['みず', 'water', '💧'], ['スムージー', 'a smoothie', '🥤'], ['ココア', 'hot chocolate', '🍫'],
      ['コーラ', 'cola', '🥤'], ['みそしる', 'miso soup', '🥣'], ['エナジードリンク', 'energy drinks', '⚡'], ['やさいジュース', 'vegetable juice', '🥕'],
      ['プロテイン', 'protein shakes', '💪'], ['おゆ', 'hot water', '♨'], ['レモンティー', 'lemon tea', '🍋'], ['のむヨーグルト', 'drinking yoghurt', '🥛'],
    ]),
    pon: ponTile('asa', 'はっぱの おちゃ', 'leaf tea'),
  },
  {
    id: 'petto',
    title: { text: 'かいたい ペット', kana: 'かいたい ペット', en: 'The pet you want' },
    first: 'かいたい ペットは ＿です',
    third: '{name}さんの かいたい ペットは ＿です',
    en: 'The pet I want is ___',
    enThird: 'The pet {name} wants is ___',
    level: 'n5',
    audiences: KF,
    tiles: tiles('petto', [
      ['ねこ', 'a cat', '🐈'], ['いぬ', 'a dog', '🐕'], ['うさぎ', 'a rabbit', '🐇'], ['ハムスター', 'a hamster', '🐹'],
      ['カメ', 'a turtle', '🐢'], ['ヘビ', 'a snake', '🐍'], ['インコ', 'a budgie', '🦜'], ['きんぎょ', 'a goldfish', '🐠'],
      ['ハリネズミ', 'a hedgehog', '🦔'], ['フェレット', 'a ferret', '🦦'], ['カピバラ', 'a capybara', '🦫'], ['ペンギン', 'a penguin', '🐧'],
      ['トカゲ', 'a lizard', '🦎'], ['ミニブタ', 'a micro pig', '🐖'], ['アルパカ', 'an alpaca', '🦙'], ['クワガタ', 'a stag beetle', '🪲'],
    ]),
    pon: ponTile('petto', 'たぬき', 'a tanuki'),
  },
  {
    id: 'yume',
    title: { text: 'こどもの ころの ゆめ', kana: 'こどもの ころの ゆめ', en: 'Your childhood dream' },
    first: 'こどもの ころの ゆめは ＿でした',
    third: '{name}さんの こどもの ころの ゆめは ＿でした',
    en: 'My childhood dream was to be ___',
    enThird: "{name}'s childhood dream was to be ___",
    level: 'n5',
    audiences: ALL,
    tiles: tiles('yume', [
      ['ケーキやさん', 'a cake-shop owner', '🎂'], ['うちゅうひこうし', 'an astronaut', '👩‍🚀'], ['サッカーせんしゅ', 'a footballer', '⚽'], ['にんじゃ', 'a ninja', '🥷'],
      ['けいさつかん', 'a police officer', '👮'], ['おいしゃさん', 'a doctor', '🩺'], ['アイドル', 'a pop idol', '🌟'], ['パイロット', 'a pilot', '✈'],
      ['せんせい', 'a teacher', '🧑‍🏫'], ['ユーチューバー', 'a YouTuber', '📹'], ['まほうつかい', 'a wizard', '🪄'], ['しょうぼうし', 'a firefighter', '🚒'],
      ['パンやさん', 'a baker', '🥐'], ['きょうりゅう', 'a dinosaur', '🦖'], ['おひめさま', 'a princess', '👸'], ['やきゅうせんしゅ', 'a baseball player', '⚾'],
    ]),
    pon: ponTile('yume', 'たぬき', 'a tanuki'),
  },
  {
    id: 'neru',
    title: { text: 'ねる まえに', kana: 'ねる まえに', en: 'Before bed' },
    first: 'ねる まえに ＿',
    third: '{name}さんは ねる まえに ＿',
    en: 'Before bed, I ___',
    enThird: 'Before bed, {name} ___',
    level: 'n5',
    audiences: KF,
    tiles: tiles('neru', [
      ['ほんを よみます', 'read a book', '📖'], ['はを みがきます', 'brush my teeth', '🪥'], ['ストレッチを します', 'stretch', '🤸'], ['ゲームを します', 'play games', '🎮'],
      ['おふろに はいります', 'take a bath', '🛁'], ['ミルクを のみます', 'drink milk', '🥛'], ['にっきを かきます', 'write a diary', '📔'], ['ぬいぐるみと はなします', 'talk to my teddy', '🧸'],
      ['うたを うたいます', 'sing a song', '🎶'], ['おいのりを します', 'say a prayer', '🙏'], ['スマホを みます', 'look at my phone', '📱'], ['おかしを たべます', 'eat snacks', '🍪'],
      ['ラジオを ききます', 'listen to the radio', '📻'], ['ダンスを します', 'dance', '💃'], ['なきます', 'cry', '😢'], ['ねこと あそびます', 'play with the cat', '🐈'],
    ]),
    pon: ponTile('neru', 'おなかを たたきます', 'drum my belly'),
  },
  {
    id: 'tabeta',
    title: { text: 'たべた ことが ある もの', kana: 'たべた ことが ある もの', en: "Something you've eaten" },
    first: '＿を たべた ことが あります',
    third: '{name}さんは ＿を たべた ことが あります',
    en: "I've eaten ___",
    enThird: '{name} has eaten ___',
    level: 'n4',
    frames: ['ta-koto'],
    status: 'draft',
    audiences: ALL,
    tiles: tiles('tabeta', [
      ['ふぐ', 'pufferfish', '🐡'], ['カエル', 'frog', '🐸'], ['むし', 'insects', '🦗'], ['ドリアン', 'durian', '🍈'],
      ['ワニ', 'crocodile', '🐊'], ['うなぎ', 'eel', '🐍'], ['うに', 'sea urchin', '🟠'], ['なまたまご', 'raw egg', '🥚'],
      ['いなご', 'locusts', '🦗'], ['かたつむり', 'snails', '🐌'], ['カンガルー', 'kangaroo', '🦘'], ['しかの にく', 'venison', '🦌'],
      ['くさや', 'kusaya (smelly fish)', '🐟'], ['ハチのこ', 'bee larvae', '🐝'], ['ザリガニ', 'crayfish', '🦞'], ['サボテン', 'cactus', '🌵'],
    ]),
    pon: ponTile('tabeta', 'はっぱ', 'leaves'),
  },
  {
    id: 'itta',
    title: { text: 'いった ことが ある ところ', kana: 'いった ことが ある ところ', en: "Somewhere you've been" },
    first: '＿に いった ことが あります',
    third: '{name}さんは ＿に いった ことが あります',
    en: "I've been to ___",
    enThird: '{name} has been to ___',
    level: 'n4',
    frames: ['ta-koto'],
    status: 'draft',
    audiences: ALL,
    tiles: tiles('itta', [
      ['ふじさん', 'Mount Fuji', '🗻'], ['ハワイ', 'Hawaii', '🌺'], ['こうばん', 'a police box', '👮'], ['おきなわ', 'Okinawa', '🏝'],
      ['ほっかいどう', 'Hokkaidō', '❄'], ['エジプト', 'Egypt', '🐫'], ['ディズニーランド', 'Disneyland', '🏰'], ['なんきょく', 'the South Pole', '🐧'],
      ['おんせん', 'a hot spring', '♨'], ['スカイツリー', 'Skytree', '🗼'], ['ペルー', 'Peru', '🦙'], ['ラスベガス', 'Las Vegas', '🎰'],
      ['むじんとう', 'a desert island', '🏝'], ['きょうと', 'Kyoto', '⛩'], ['グランドキャニオン', 'the Grand Canyon', '🏜'], ['おばけやしき', 'a haunted house', '👻'],
    ]),
    pon: ponTile('itta', 'たぬきの むら', 'the tanuki village'),
  },
  {
    id: 'wasureta',
    title: { text: 'わすれて しまった もの', kana: 'わすれて しまった もの', en: 'Something you left behind' },
    first: 'でんしゃに ＿を わすれて しまいました',
    third: '{name}さんは でんしゃに ＿を わすれて しまいました',
    en: 'I (oops) left ___ on a train',
    enThird: '{name} (oops) left ___ on a train',
    level: 'n4',
    frames: ['te-shimau'],
    status: 'draft',
    audiences: ALL,
    tiles: tiles('wasureta', [
      ['かさ', 'an umbrella', '☂'], ['さいふ', 'a wallet', '👛'], ['スマホ', 'a phone', '📱'], ['パスポート', 'a passport', '🛂'],
      ['くつ', 'shoes', '👟'], ['しゅくだい', 'homework', '📓'], ['おべんとう', 'a packed lunch', '🍱'], ['ギター', 'a guitar', '🎸'],
      ['ねこ', 'a cat', '🐈'], ['ケーキ', 'a cake', '🎂'], ['めがね', 'glasses', '👓'], ['かぎ', 'keys', '🔑'],
      ['ぼうし', 'a hat', '🧢'], ['ラケット', 'a racket', '🎾'], ['スーツケース', 'a suitcase', '🧳'], ['うわぎ', 'a jacket', '🧥'],
    ]),
    pon: ponTile('wasureta', 'しっぽ', 'my tail'),
  },
  {
    id: 'kowashita',
    title: { text: 'こわして しまった もの', kana: 'こわして しまった もの', en: 'Something you broke' },
    first: '＿を こわして しまいました',
    third: '{name}さんは ＿を こわして しまいました',
    en: 'I (oops) broke ___',
    enThird: '{name} (oops) broke ___',
    level: 'n4',
    frames: ['te-shimau'],
    status: 'draft',
    audiences: ALL,
    tiles: tiles('kowashita', [
      ['おさら', 'a plate', '🍽'], ['スマホ', 'a phone', '📱'], ['めがね', 'glasses', '👓'], ['テレビ', 'the TV', '📺'],
      ['いす', 'a chair', '🪑'], ['パソコン', 'a computer', '💻'], ['まど', 'a window', '🪟'], ['かさ', 'an umbrella', '☂'],
      ['とけい', 'a clock', '⏰'], ['ゲームき', 'a games console', '🎮'], ['ドア', 'a door', '🚪'], ['ベッド', 'a bed', '🛏'],
      ['ピアノ', 'a piano', '🎹'], ['じてんしゃ', 'a bike', '🚲'], ['おもちゃ', 'a toy', '🧸'], ['トイレ', 'the toilet', '🚽'],
    ]),
    pon: ponTile('kowashita', 'ポンの カメラ', "Pon's camera"),
  },
  {
    id: 'yattemita',
    title: { text: 'さいきん やって みた こと', kana: 'さいきん やって みた こと', en: 'Something you tried lately' },
    first: 'さいきん ＿を やって みました',
    third: '{name}さんは さいきん ＿を やって みました',
    en: 'Lately I tried ___',
    enThird: 'Lately {name} tried ___',
    level: 'n4',
    frames: ['te-miru'],
    status: 'draft',
    audiences: ALL,
    tiles: tiles('yattemita', [
      ['ヨガ', 'yoga', '🧘'], ['ボルダリング', 'bouldering', '🧗'], ['サーフィン', 'surfing', '🏄'], ['すもう', 'sumo', '🤼'],
      ['いけばな', 'flower arranging', '💐'], ['ざぜん', 'zen meditation', '🪷'], ['スキー', 'skiing', '⛷'], ['からて', 'karate', '🥋'],
      ['つり', 'fishing', '🎣'], ['キャンプ', 'camping', '⛺'], ['ゴルフ', 'golf', '⛳'], ['けんどう', 'kendō', '🤺'],
      ['さどう', 'the tea ceremony', '🍵'], ['ボクシング', 'boxing', '🥊'], ['スカイダイビング', 'skydiving', '🪂'], ['ジャグリング', 'juggling', '🤹'],
    ]),
    pon: ponTile('yattemita', 'ダイエット', 'a diet'),
  },
  {
    id: 'mitai',
    title: { text: 'いつか やって みたい こと', kana: 'いつか やって みたい こと', en: "Something you'd love to try" },
    first: 'いつか やって みたい ことは ＿です',
    third: '{name}さんの いつか やって みたい ことは ＿です',
    en: "Something I'd love to try one day is ___",
    enThird: "Something {name} would love to try one day is ___",
    level: 'n4',
    frames: ['te-miru'],
    status: 'draft',
    audiences: ALL,
    tiles: tiles('mitai', [
      ['スカイダイビング', 'skydiving', '🪂'], ['バンジージャンプ', 'a bungee jump', '🪢'], ['ダイビング', 'scuba diving', '🤿'], ['うちゅうりょこう', 'a trip to space', '🚀'],
      ['すもう', 'sumo', '🤼'], ['にんじゃしゅぎょう', 'ninja training', '🥷'], ['ふじさんの とざん', 'climbing Mount Fuji', '🗻'], ['せかいいっしゅう', 'a trip round the world', '🌍'],
      ['ききゅうに のる こと', 'riding in a hot-air balloon', '🎈'], ['マラソン', 'a marathon', '🏃'], ['サーカス', 'the circus', '🎪'], ['ひとりたび', 'travelling alone', '🎒'],
      ['かぶき', 'kabuki', '🎭'], ['ボルダリング', 'bouldering', '🧗'], ['まんがを かく こと', 'drawing manga', '✏'], ['イルカと およぐ こと', 'swimming with dolphins', '🐬'],
    ]),
    pon: ponTile('mitai', 'にんげんの ふり', 'passing as a human'),
  },
  // ---- N4 verb cards: the blank is a verb phrase, given in the dictionary form; whoever says the line
  // (an N4 introducer, the guest at the truth) makes the た or て form themselves. The tile's kana is the
  // conjugated form, which is what the TV shows and what the check listens for. ----
  {
    id: 'shita-koto',
    title: { text: 'した ことが ある こと', kana: 'した ことが ある こと', en: "Something you've done" },
    first: '＿ ことが あります',
    third: '{name}さんは ＿ ことが あります',
    cue: '＿た ことが あります',
    cueThird: '{name}さんは ＿た ことが あります',
    conj: 'ta',
    en: "I've ___",
    enThird: '{name} has ___',
    level: 'n4',
    frames: ['ta-koto'],
    status: 'draft',
    audiences: ALL,
    tiles: verbTiles('shita-koto', [
      ['ふじさんに のぼる', 'ふじさんに のぼった', 'climbed Mount Fuji', '🗻'], ['うまに のる', 'うまに のった', 'ridden a horse', '🐎'],
      ['ゆきで あそぶ', 'ゆきで あそんだ', 'played in the snow', '⛄'], ['おばけを みる', 'おばけを みた', 'seen a ghost', '👻'],
      ['テレビに でる', 'テレビに でた', 'been on TV', '📺'], ['きものを きる', 'きものを きた', 'worn a kimono', '👘'],
      ['すしを つくる', 'すしを つくった', 'made sushi', '🍣'], ['うみで およぐ', 'うみで およいだ', 'swum in the sea', '🌊'],
      ['にほんに いく', 'にほんに いった', 'been to Japan', '🗾'], ['かぶきを みる', 'かぶきを みた', 'seen kabuki', '🎭'],
      ['ひこうきで ねる', 'ひこうきで ねた', 'slept on a plane', '✈️'], ['さるに あう', 'さるに あった', 'met a monkey', '🐒'],
      ['マラソンを はしる', 'マラソンを はしった', 'run a marathon', '🏃'], ['てがみを かく', 'てがみを かいた', 'written a letter', '✉️'],
      ['おまつりで おどる', 'おまつりで おどった', 'danced at a festival', '🏮'], ['ねこを かう', 'ねこを かった', 'kept a cat', '🐱'],
    ]),
    pon: verbPon('shita-koto', 'にんげんに ばける', 'にんげんに ばけた', 'turned into a human'),
  },
  {
    id: 'ukkari',
    title: { text: 'うっかり して しまった こと', kana: 'うっかり して しまった こと', en: 'Something you did by mistake' },
    first: 'うっかり ＿ しまいました',
    third: '{name}さんは うっかり ＿ しまいました',
    cue: 'うっかり ＿て しまいました',
    cueThird: '{name}さんは うっかり ＿て しまいました',
    conj: 'te',
    en: 'Oops, I ___',
    enThird: 'Oops, {name} ___',
    level: 'n4',
    frames: ['te-shimau'],
    status: 'draft',
    audiences: ALL,
    tiles: verbTiles('ukkari', [
      ['かぎを なくす', 'かぎを なくして', 'lost the keys', '🔑'], ['でんしゃで ねる', 'でんしゃで ねて', 'fell asleep on the train', '🚃'],
      ['さいふを おとす', 'さいふを おとして', 'dropped a wallet', '👛'], ['ケーキを ぜんぶ たべる', 'ケーキを ぜんぶ たべて', 'ate the whole cake', '🍰'],
      ['えきを まちがえる', 'えきを まちがえて', 'got the wrong station', '🚉'], ['かさを わすれる', 'かさを わすれて', 'forgot an umbrella', '☂️'],
      ['じゅぎょうに おくれる', 'じゅぎょうに おくれて', 'was late for class', '⏰'], ['コーヒーを こぼす', 'コーヒーを こぼして', 'spilled coffee', '☕'],
      ['スマホを こわす', 'スマホを こわして', 'broke a phone', '📱'], ['しゅくだいを わすれる', 'しゅくだいを わすれて', 'forgot the homework', '📓'],
      ['バスに おくれる', 'バスに おくれて', 'was late for the bus', '🚌'], ['みちに まよう', 'みちに まよって', 'got lost', '🗺️'],
      ['ゆびを きる', 'ゆびを きって', 'cut a finger', '🩹'], ['ねぼうする', 'ねぼうして', 'overslept', '😴'],
      ['パンを やきすぎる', 'パンを やきすぎて', 'burnt the toast', '🍞'], ['ふくを よごす', 'ふくを よごして', 'got clothes dirty', '👕'],
    ]),
    pon: verbPon('ukkari', 'しっぽを だす', 'しっぽを だして', 'let the tail show'),
  },
  {
    id: 'nihon-temitai',
    title: { text: 'にほんで して みたい こと', kana: 'にほんで して みたい こと', en: "Something you'd love to try in Japan" },
    first: 'にほんで ＿ みたいです',
    third: '{name}さんは にほんで ＿ みたいそうです',
    cue: 'にほんで ＿て みたいです',
    cueThird: '{name}さんは にほんで ＿て みたいそうです',
    conj: 'te',
    en: "In Japan I'd love to try ___",
    enThird: "In Japan {name} would love to try ___",
    level: 'n4',
    frames: ['te-miru', 'tai', 'sou-hear'],
    status: 'draft',
    audiences: ALL,
    tiles: verbTiles('nihon-temitai', [
      ['おんせんに はいる', 'おんせんに はいって', 'getting into a hot spring', '♨️'], ['きものを きる', 'きものを きて', 'wearing a kimono', '👘'],
      ['しんかんせんに のる', 'しんかんせんに のって', 'riding the bullet train', '🚄'], ['なっとうを たべる', 'なっとうを たべて', 'eating nattō', '🫘'],
      ['すもうを みる', 'すもうを みて', 'watching sumo', '🤼'], ['ふじさんに のぼる', 'ふじさんに のぼって', 'climbing Mount Fuji', '🗻'],
      ['カラオケで うたう', 'カラオケで うたって', 'singing karaoke', '🎤'], ['おまつりで おどる', 'おまつりで おどって', 'dancing at a festival', '🏮'],
      ['ラーメンを つくる', 'ラーメンを つくって', 'making ramen', '🍜'], ['おてらに とまる', 'おてらに とまって', 'staying at a temple', '🛕'],
      ['にほんごで はなす', 'にほんごで はなして', 'speaking Japanese', '💬'], ['さくらを みる', 'さくらを みて', 'seeing the cherry blossoms', '🌸'],
      ['ゆかたで あるく', 'ゆかたで あるいて', 'walking about in a yukata', '🎐'], ['おみくじを ひく', 'おみくじを ひいて', 'drawing a fortune slip', '🎋'],
      ['しかに あう', 'しかに あって', 'meeting the deer', '🦌'], ['ねこカフェに いく', 'ねこカフェに いって', 'going to a cat café', '🐈'],
    ]),
    pon: verbPon('nihon-temitai', 'たぬきそばを たべる', 'たぬきそばを たべて', 'eating tanuki soba'),
  },
  // ---- Kids N4: gentle experiences, tries and oops, for N4 guests in a Kids room ----
  {
    id: 'mita',
    title: { text: 'みた ことが ある どうぶつ', kana: 'みた ことが ある どうぶつ', en: "An animal you've seen" },
    first: '＿を みた ことが あります',
    third: '{name}さんは ＿を みた ことが あります',
    en: "I've seen ___",
    enThird: '{name} has seen ___',
    level: 'n4',
    frames: ['ta-koto'],
    status: 'draft',
    audiences: KIDS,
    tiles: tiles('mita', [
      ['パンダ', 'a panda', '🐼'], ['キリン', 'a giraffe', '🦒'], ['ゾウ', 'an elephant', '🐘'], ['ペンギン', 'a penguin', '🐧'],
      ['イルカ', 'a dolphin', '🐬'], ['クジラ', 'a whale', '🐋'], ['コアラ', 'a koala', '🐨'], ['ライオン', 'a lion', '🦁'],
      ['ラッコ', 'a sea otter', '🦦'], ['フラミンゴ', 'a flamingo', '🦩'], ['カピバラ', 'a capybara', '🦫'], ['ゴリラ', 'a gorilla', '🦍'],
      ['シマウマ', 'a zebra', '🦓'], ['カンガルー', 'a kangaroo', '🦘'], ['シロクマ', 'a polar bear', '🐻‍❄️'], ['カバ', 'a hippo', '🦛'],
    ]),
    pon: ponTile('mita', 'かっぱ', 'a kappa'),
  },
  {
    id: 'koboshita',
    title: { text: 'こぼして しまった もの', kana: 'こぼして しまった もの', en: 'Something you spilled' },
    first: '＿を こぼして しまいました',
    third: '{name}さんは ＿を こぼして しまいました',
    en: 'I (oops) spilled ___',
    enThird: '{name} (oops) spilled ___',
    level: 'n4',
    frames: ['te-shimau'],
    status: 'draft',
    audiences: KIDS,
    tiles: tiles('koboshita', [
      ['ぎゅうにゅう', 'milk', '🥛'], ['オレンジジュース', 'orange juice', '🍊'], ['みそしる', 'miso soup', '🥣'], ['カレー', 'curry', '🍛'],
      ['ココア', 'hot chocolate', '🍫'], ['おちゃ', 'green tea', '🍵'], ['みず', 'water', '💧'], ['ヨーグルト', 'yoghurt', '🥄'],
      ['シチュー', 'stew', '🍲'], ['ケチャップ', 'ketchup', '🍅'], ['はちみつ', 'honey', '🍯'], ['えのぐ', 'paint', '🎨'],
      ['のり', 'glue', '🧴'], ['コーンフレーク', 'cornflakes', '🥣'], ['ラーメンの スープ', 'ramen soup', '🍜'], ['かきごおり', 'shaved ice', '🍧'],
    ]),
    pon: ponTile('koboshita', 'はっぱの おちゃ', 'leaf tea'),
  },
  {
    id: 'tsukutta',
    title: { text: 'つくって みた もの', kana: 'つくって みた もの', en: 'Something you tried making' },
    first: '＿を つくって みました',
    third: '{name}さんは ＿を つくって みました',
    en: 'I tried making ___',
    enThird: '{name} tried making ___',
    level: 'n4',
    frames: ['te-miru'],
    status: 'draft',
    audiences: KIDS,
    tiles: tiles('tsukutta', [
      ['クッキー', 'cookies', '🍪'], ['おにぎり', 'rice balls', '🍙'], ['パンケーキ', 'pancakes', '🥞'], ['かみひこうき', 'a paper plane', '✈'],
      ['ゆきだるま', 'a snowman', '⛄'], ['すなの おしろ', 'a sandcastle', '🏰'], ['ひみつきち', 'a secret den', '🛖'], ['プリン', 'pudding', '🍮'],
      ['ロボット', 'a robot', '🤖'], ['おりがみの つる', 'an origami crane', '🦢'], ['ねんどの どうぶつ', 'a clay animal', '🐾'], ['サンドイッチ', 'sandwiches', '🥪'],
      ['ケーキ', 'a cake', '🎂'], ['ジャム', 'jam', '🍓'], ['てがみ', 'a letter', '✉'], ['どんぐりの こま', 'an acorn spinning top', '🌰'],
    ]),
    pon: ponTile('tsukutta', 'はっぱの おかね', 'leaf money'),
  },
  // Kids N4 verb cards.
  {
    id: 'gakkou-ta',
    title: { text: 'がっこうで した こと', kana: 'がっこうで した こと', en: "Something you've done at school" },
    first: 'がっこうで ＿ ことが あります',
    third: '{name}さんは がっこうで ＿ ことが あります',
    cue: 'がっこうで ＿た ことが あります',
    cueThird: '{name}さんは がっこうで ＿た ことが あります',
    conj: 'ta',
    en: "At school I've ___",
    enThird: 'At school {name} has ___',
    level: 'n4',
    frames: ['ta-koto'],
    status: 'draft',
    audiences: KIDS,
    tiles: verbTiles('gakkou-ta', [
      ['じゅぎょうで ねる', 'じゅぎょうで ねた', 'fallen asleep in class', '😴'], ['ごはんを おかわりする', 'ごはんを おかわりした', 'had seconds at lunch', '🍚'],
      ['せんせいを ママと よぶ', 'せんせいを ママと よんだ', 'called the teacher "Mum"', '🙊'], ['ろうかを はしる', 'ろうかを はしった', 'run in the corridor', '🏃'],
      ['うんどうかいで ころぶ', 'うんどうかいで ころんだ', 'fallen over on sports day', '🏅'], ['こくばんに えを かく', 'こくばんに えを かいた', 'drawn on the blackboard', '🖍️'],
      ['プールで およぐ', 'プールで およいだ', 'swum in the school pool', '🏊'], ['カエルを つかまえる', 'カエルを つかまえた', 'caught a frog', '🐸'],
      ['てがみを もらう', 'てがみを もらった', 'got a letter', '💌'], ['たいこを たたく', 'たいこを たたいた', 'played the drum', '🥁'],
      ['きょうしつで うたう', 'きょうしつで うたった', 'sung in the classroom', '🎶'], ['そうじを サボる', 'そうじを サボった', 'skipped cleaning duty', '🧹'],
      ['ドッジボールで かつ', 'ドッジボールで かった', 'won at dodgeball', '🏐'], ['うさぎに えさを やる', 'うさぎに えさを やった', 'fed the rabbits', '🐰'],
      ['おべんとうを わすれる', 'おべんとうを わすれた', 'forgotten a packed lunch', '🍱'], ['ともだちと けんかする', 'ともだちと けんかした', 'had a fight with a friend', '😤'],
    ]),
    pon: verbPon('gakkou-ta', 'はっぱで ばける', 'はっぱで ばけた', 'shapeshifted with a leaf'),
  },
  {
    id: 'ouchi-te',
    title: { text: 'おうちで やって しまった こと', kana: 'おうちで やって しまった こと', en: 'Something you did at home, oops' },
    first: 'おうちで ＿ しまいました',
    third: '{name}さんは おうちで ＿ しまいました',
    cue: 'おうちで ＿て しまいました',
    cueThird: '{name}さんは おうちで ＿て しまいました',
    conj: 'te',
    en: 'At home I (oops) ___',
    enThird: 'At home {name} (oops) ___',
    level: 'n4',
    frames: ['te-shimau'],
    status: 'draft',
    audiences: KIDS,
    tiles: verbTiles('ouchi-te', [
      ['おさらを わる', 'おさらを わって', 'broke a plate', '🍽️'], ['ソファで ねる', 'ソファで ねて', 'fell asleep on the sofa', '🛋️'],
      ['おやつを ぜんぶ たべる', 'おやつを ぜんぶ たべて', 'ate all the snacks', '🍪'], ['かべに えを かく', 'かべに えを かいて', 'drew on the wall', '🖍️'],
      ['ジュースを こぼす', 'ジュースを こぼして', 'spilled juice', '🧃'], ['ねこの しっぽを ふむ', 'ねこの しっぽを ふんで', "stepped on the cat's tail", '🐈'],
      ['ぬいぐるみを なくす', 'ぬいぐるみを なくして', 'lost a cuddly toy', '🧸'], ['おふろで ねる', 'おふろで ねて', 'fell asleep in the bath', '🛁'],
      ['テレビを こわす', 'テレビを こわして', 'broke the TV', '📺'], ['おとうとと けんかする', 'おとうとと けんかして', 'had a fight with a little brother', '😤'],
      ['ゲームを ずっと する', 'ゲームを ずっと して', 'played games for hours', '🎮'], ['かみを じぶんで きる', 'かみを じぶんで きって', 'did a DIY haircut', '✂️'],
      ['でんきを けすのを わすれる', 'でんきを けすのを わすれて', 'forgot to turn off the light', '💡'], ['いぬの さんぽを わすれる', 'いぬの さんぽを わすれて', 'forgot to walk the dog', '🐕'],
      ['あさ ねぼうする', 'あさ ねぼうして', 'overslept', '⏰'], ['ママの くつを はく', 'ママの くつを はいて', "put on Mum's shoes", '👠'],
    ]),
    pon: verbPon('ouchi-te', 'しっぽを だす', 'しっぽを だして', 'let the tail show'),
  },
  // ---- Cheeky: written for everyone in the room (both ex tiles, both partners' homes) ----
  {
    id: 'date',
    title: { text: 'はつデート', kana: 'はつデート', en: 'Your first date' },
    first: 'はつデートは ＿でした',
    third: '{name}さんの はつデートは ＿でした',
    en: 'My first date was at ___',
    enThird: "{name}'s first date was at ___",
    level: 'n5',
    audiences: CHEEKY,
    tiles: tiles('date', [
      ['カラオケ', 'karaoke', '🎤'], ['こうえん', 'a park', '🌳'], ['コンビニ', 'a convenience store', '🏪'], ['おはかまいり', 'a family grave visit', '🪦'],
      ['えいがかん', 'the cinema', '🎬'], ['すいぞくかん', 'an aquarium', '🐠'], ['ゆうえんち', 'a theme park', '🎡'], ['ファミレス', 'a family diner', '🍽'],
      ['いざかや', 'an izakaya', '🏮'], ['どうぶつえん', 'the zoo', '🦒'], ['としょかん', 'the library', '📚'], ['ボウリング', 'bowling', '🎳'],
      ['ラーメンや', 'a ramen shop', '🍜'], ['かれの いえ', "his place", '🏠'], ['かのじょの いえ', 'her place', '🏡'], ['ゲームセンター', 'an arcade', '🕹'],
    ]),
    pon: ponTile('date', 'ポンの ばんぐみ', "Pon's show"),
  },
  {
    id: 'yopparau',
    title: { text: 'よっぱらうと', kana: 'よっぱらうと', en: 'When you get drunk' },
    first: 'よっぱらうと ＿',
    third: '{name}さんは よっぱらうと ＿',
    en: 'When I get drunk, I ___',
    enThird: 'When {name} gets drunk, they ___',
    level: 'n5',
    audiences: CHEEKY,
    tiles: tiles('yopparau', [
      ['なきます', 'cry', '😭'], ['おどります', 'dance', '💃'], ['もとカレに でんわします', 'call my ex-boyfriend', '📞'], ['もとカノに でんわします', 'call my ex-girlfriend', '📞'],
      ['うたいます', 'sing', '🎤'], ['ねます', 'fall asleep', '😴'], ['くつを ぬぎます', 'take my shoes off', '👠'], ['えいごで はなします', 'speak English', '🗣'],
      ['だれとでも ともだちに なります', 'make friends with everyone', '🤝'], ['ラーメンを たべます', 'eat ramen', '🍜'], ['おこります', 'get angry', '😤'], ['ずっと わらいます', 'laugh nonstop', '🤣'],
      ['ははに でんわします', 'call my mum', '☎'], ['ネットで かいものします', 'shop online', '🛒'], ['じどりを します', 'take selfies', '🤳'], ['はだしで かえります', 'walk home barefoot', '🦶'],
    ]),
    pon: ponTile('yopparau', 'たぬきに なります', 'turn into a tanuki'),
  },
  {
    id: 'sumaho',
    title: { text: 'スマホの しゃしん', kana: 'スマホの しゃしん', en: 'The photos on your phone' },
    first: 'スマホには ＿の しゃしんが たくさん あります',
    third: '{name}さんの スマホには ＿の しゃしんが たくさん あります',
    en: 'My phone is full of photos of ___',
    enThird: "{name}'s phone is full of photos of ___",
    level: 'n5',
    audiences: CHEEKY,
    tiles: tiles('sumaho', [
      ['ねこ', 'cats', '🐈'], ['じぶん', 'myself', '🤳'], ['ごはん', 'food', '🍱'], ['もとカレ', 'my ex-boyfriend', '💔'],
      ['もとカノ', 'my ex-girlfriend', '💔'], ['いぬ', 'dogs', '🐕'], ['そら', 'the sky', '☁'], ['イケメンの はいゆう', 'hot actors', '😍'],
      ['アイドル', 'pop idols', '🌟'], ['あかちゃん', 'babies', '👶'], ['けしき', 'scenery', '🏞'], ['おさけ', 'drinks', '🍶'],
      ['くるま', 'cars', '🚗'], ['ネイル', 'my nails', '💅'], ['きんにく', 'my muscles', '💪'], ['ともだちの ねがお', "friends' sleeping faces", '😪'],
    ]),
    pon: ponTile('sumaho', 'ポン', 'Pon'),
  },
  {
    id: 'jitsuwa',
    title: { text: 'じつは すき', kana: 'じつは すき', en: 'A secret love' },
    first: 'じつは ＿が すきです',
    third: '{name}さんは じつは ＿が すきです',
    en: 'Actually, I secretly love ___',
    enThird: 'Actually, {name} secretly loves ___',
    level: 'n5',
    audiences: CHEEKY,
    tiles: tiles('jitsuwa', [
      ['ホラーえいが', 'horror films', '🧟'], ['ひとりカラオケ', 'karaoke alone', '🎤'], ['アイドル', 'pop idols', '🌟'], ['かんこくドラマ', 'K-dramas', '📺'],
      ['ラブソング', 'love songs', '💘'], ['ジャンクフード', 'junk food', '🍔'], ['こいばな', 'gossip about love lives', '💬'], ['うらない', 'fortune-telling', '🔮'],
      ['プロレス', 'pro wrestling', '🤼'], ['しょうじょまんが', 'romance manga', '💖'], ['ひとりで のむこと', 'drinking alone', '🍷'], ['リアリティショー', 'reality TV', '🌹'],
      ['くまの ぬいぐるみ', 'teddy bears', '🧸'], ['ダサい ふく', 'tacky clothes', '👕'], ['ねぐせ', 'bed hair', '💇'], ['ゴシップ', 'gossip', '🗞'],
    ]),
    pon: ponTile('jitsuwa', 'ポン', 'Pon'),
  },
  // ---- Cheeky N4: the Cheeky set in the experience frames, for N4 guests in a Cheeky room ----
  {
    id: 'denwashita',
    title: { text: 'よっぱらって でんわした ひと', kana: 'よっぱらって でんわした ひと', en: 'Who you drunk-called' },
    first: 'よっぱらって ＿に でんわして しまいました',
    third: '{name}さんは よっぱらって ＿に でんわして しまいました',
    en: 'I got drunk and (oops) called ___',
    enThird: '{name} got drunk and (oops) called ___',
    level: 'n4',
    frames: ['te-shimau'],
    status: 'draft',
    audiences: CHEEKY,
    tiles: tiles('denwashita', [
      ['もとカレ', 'my ex-boyfriend', '💔'], ['もとカノ', 'my ex-girlfriend', '💔'], ['はは', 'my mum', '☎'], ['ちち', 'my dad', '📞'],
      ['じょうし', 'my boss', '👔'], ['しゃちょう', 'the company president', '🏢'], ['おばあちゃん', 'my grandma', '👵'], ['こうこうの せんせい', 'my old high-school teacher', '🧑‍🏫'],
      ['ピザや', 'a pizza place', '🍕'], ['おすしや', 'a sushi place', '🍣'], ['ラジオきょく', 'a radio station', '📻'], ['はつこいの ひと', 'my first love', '💘'],
      ['いもうと', 'my little sister', '👧'], ['おとうと', 'my little brother', '👦'], ['ルームメイト', 'my flatmate', '🛋'], ['うらないし', 'a fortune-teller', '🔮'],
    ]),
    pon: ponTile('denwashita', 'ポンの おかあさん', "Pon's mum"),
  },
  {
    id: 'neta',
    title: { text: 'ねた ことが ある ところ', kana: 'ねた ことが ある ところ', en: "Somewhere you've fallen asleep" },
    first: '＿で ねた ことが あります',
    third: '{name}さんは ＿で ねた ことが あります',
    en: "I've fallen asleep in ___",
    enThird: '{name} has fallen asleep in ___',
    level: 'n4',
    frames: ['ta-koto'],
    status: 'draft',
    audiences: CHEEKY,
    tiles: tiles('neta', [
      ['でんしゃ', 'a train', '🚃'], ['トイレ', 'a toilet', '🚽'], ['カラオケ', 'a karaoke room', '🎤'], ['タクシー', 'a taxi', '🚕'],
      ['こうえんの ベンチ', 'a park bench', '🪑'], ['かいしゃ', 'the office', '🏢'], ['えいがかん', 'the cinema', '🎬'], ['おふろ', 'the bath', '🛁'],
      ['ネットカフェ', 'an internet café', '💻'], ['くうこう', 'an airport', '🛫'], ['いざかや', 'an izakaya', '🏮'], ['エレベーター', 'a lift', '🛗'],
      ['クローゼット', 'a wardrobe', '🚪'], ['けっこんしき', 'a wedding', '💒'], ['びよういん', 'the hairdresser', '💇'], ['はいしゃさん', 'the dentist', '🦷'],
    ]),
    pon: ponTile('neta', 'たぬきの あな', 'a tanuki burrow'),
  },
  {
    id: 'detemitai',
    title: { text: 'デートで いって みたい ところ', kana: 'デートで いって みたい ところ', en: "Where you'd love to go on a date" },
    first: 'デートで いって みたい ところは ＿です',
    third: '{name}さんの デートで いって みたい ところは ＿です',
    en: "Somewhere I'd love to go on a date is ___",
    enThird: "Somewhere {name} would love to go on a date is ___",
    level: 'n4',
    frames: ['te-miru'],
    status: 'draft',
    audiences: CHEEKY,
    tiles: tiles('detemitai', [
      ['すいぞくかん', 'an aquarium', '🐠'], ['おんせん', 'a hot spring', '♨'], ['ゆうえんち', 'a theme park', '🎡'], ['プラネタリウム', 'a planetarium', '🌌'],
      ['カラオケ', 'karaoke', '🎤'], ['キャンプじょう', 'a campsite', '⛺'], ['びじゅつかん', 'an art gallery', '🖼'], ['やたい', 'a street-food stall', '🏮'],
      ['おばけやしき', 'a haunted house', '👻'], ['どうぶつえん', 'the zoo', '🦒'], ['ホテルの バー', 'a hotel bar', '🍸'], ['ふじさん', 'Mount Fuji', '🗻'],
      ['ラーメンや', 'a ramen shop', '🍜'], ['ゲームセンター', 'an arcade', '🕹'], ['うみ', 'the seaside', '🏖'], ['パリ', 'Paris', '🗼'],
    ]),
    pon: ponTile('detemitai', 'まんげつの やま', 'a mountain under the full moon'),
  },
  // Cheeky N4 verb cards.
  {
    id: 'nomikai-ta',
    title: { text: 'のみかいで した こと', kana: 'のみかいで した こと', en: "Something you've done at a drinking party" },
    first: 'のみかいで ＿ ことが あります',
    third: '{name}さんは のみかいで ＿ ことが あります',
    cue: 'のみかいで ＿た ことが あります',
    cueThird: '{name}さんは のみかいで ＿た ことが あります',
    conj: 'ta',
    en: "At a drinking party I've ___",
    enThird: 'At a drinking party {name} has ___',
    level: 'n4',
    frames: ['ta-koto'],
    status: 'draft',
    audiences: CHEEKY,
    tiles: verbTiles('nomikai-ta', [
      ['ぶちょうと おどる', 'ぶちょうと おどった', 'danced with the boss', '🕺'], ['トイレで ねる', 'トイレで ねた', 'fallen asleep in the toilet', '🚽'],
      ['くつを なくす', 'くつを なくした', 'lost a shoe', '👞'], ['カラオケで なく', 'カラオケで ないた', 'cried at karaoke', '😭'],
      ['さいふを わすれる', 'さいふを わすれた', 'forgotten a wallet', '👛'], ['ひとりで ぜんぶ はらう', 'ひとりで ぜんぶ はらった', 'paid for everyone', '💸'],
      ['しゅうでんを のがす', 'しゅうでんを のがした', 'missed the last train', '🚃'], ['テーブルで おどる', 'テーブルで おどった', 'danced on the table', '💃'],
      ['ビールを こぼす', 'ビールを こぼした', 'spilled beer', '🍺'], ['いきなり うたう', 'いきなり うたった', 'burst into song', '🎤'],
      ['ネクタイを あたまに まく', 'ネクタイを あたまに まいた', 'worn a tie as a headband', '👔'], ['ひみつを はなす', 'ひみつを はなした', 'told a secret', '🤫'],
      ['タクシーで ねる', 'タクシーで ねた', 'fallen asleep in a taxi', '🚕'], ['ウーロンちゃで よう', 'ウーロンちゃで よった', 'got drunk on oolong tea', '🍵'],
      ['プロポーズする', 'プロポーズした', 'proposed', '💍'], ['はだしで かえる', 'はだしで かえった', 'gone home barefoot', '🦶'],
    ]),
    pon: verbPon('nomikai-ta', 'はっぱで はらう', 'はっぱで はらった', 'paid with leaves'),
  },
  {
    id: 'ichido-temitai',
    title: { text: 'いちど して みたい こと', kana: 'いちど して みたい こと', en: "Something you'd love to try just once" },
    first: 'いちどで いいから ＿ みたいです',
    third: '{name}さんは いちどで いいから ＿ みたいそうです',
    cue: 'いちどで いいから ＿て みたいです',
    cueThird: '{name}さんは いちどで いいから ＿て みたいそうです',
    conj: 'te',
    en: "Just once, I'd love to try ___",
    enThird: "Just once, {name} would love to try ___",
    level: 'n4',
    frames: ['te-miru', 'tai', 'sou-hear'],
    status: 'draft',
    audiences: CHEEKY,
    tiles: verbTiles('ichido-temitai', [
      ['かいしゃを ずるやすみする', 'かいしゃを ずるやすみして', 'pulling a sickie', '🤒'], ['ぶちょうに いいかえす', 'ぶちょうに いいかえして', 'talking back to the boss', '🗯️'],
      ['ホストクラブに いく', 'ホストクラブに いって', 'going to a host club', '🥂'], ['キャバクラに いく', 'キャバクラに いって', 'going to a hostess bar', '🍾'],
      ['パジャマで すごす', 'パジャマで すごして', 'spending all day in pyjamas', '🛌'], ['ヘリで しゅっきんする', 'ヘリで しゅっきんして', 'commuting by helicopter', '🚁'],
      ['たからくじを あてる', 'たからくじを あてて', 'winning the lottery', '🎰'], ['まいにち ひるねする', 'まいにち ひるねして', 'napping every day', '😪'],
      ['ハワイで けっこんする', 'ハワイで けっこんして', 'getting married in Hawaii', '🌺'], ['ひとりで やきにくに いく', 'ひとりで やきにくに いって', 'going for barbecue alone', '🥩'],
      ['ケーキを ワンホール たべる', 'ケーキを ワンホール たべて', 'eating a whole cake', '🎂'], ['ぶちょうの せきに すわる', 'ぶちょうの せきに すわって', "sitting in the boss's chair", '🪑'],
      ['リムジンに のる', 'リムジンに のって', 'riding in a limo', '🚘'], ['メイドカフェで はたらく', 'メイドカフェで はたらいて', 'working at a maid café', '🎀'],
      ['マッチングアプリを する', 'マッチングアプリを して', 'using a dating app', '📱'], ['ひしょを やとう', 'ひしょを やとって', 'hiring a secretary', '🗂️'],
    ]),
    pon: verbPon('ichido-temitai', 'たぬきの おうさまに なる', 'たぬきの おうさまに なって', 'becoming the tanuki king'),
  },
];

export const introCardOf = (id: string): IntroCard | undefined => INTRO_CARDS.find((c) => c.id === id);

/** Every tile, by id (Pon's own included). */
export function tileOf(id: string): Tile | undefined {
  for (const c of INTRO_CARDS) {
    if (c.pon.id === id) return c.pon;
    const t = c.tiles.find((x) => x.id === id);
    if (t) return t;
  }
  return undefined;
}

/** The cards a turn can draw for this guest: the room's audience, and N4 cards only for N4 guests. */
export function cardsFor(audience: Audience, level: 'kana' | 'n5' | 'n4'): IntroCard[] {
  return INTRO_CARDS.filter((c) => c.audiences.includes(audience) && (c.level === 'n5' || level === 'n4'));
}

/** Cheeky cards (and every card in a Kids room) take tiles only from the tanuki: no typed lies about a real person there. */
export const tilesOnly = (card: IntroCard, audience: Audience): boolean => audience === 'kids' || (card.audiences.length === 1 && card.audiences[0] === 'cheeky');

/**
 * Does a typed verb phrase end in the card's plain form? た: た, or だ after ん/い (よんだ, およいだ), not
 * the polite ました/でした. て: て, or で after ん/い (よんで, およいで), not まして/でして, and not a
 * particle で (うみで). Trailing spaces and punctuation are ignored.
 */
export const endsInForm = (word: string, conj: Conj): boolean => {
  const w = word.replace(/[\s　。！？!?]+$/, '');
  return conj === 'ta' ? /(た|[んい]だ)$/.test(w) && !/(ました|でした)$/.test(w) : /(て|[んい]で)$/.test(w) && !/(まして|でして)$/.test(w);
};

/** Fills a frame: ＿ with the word, {name} with the guest's name, and a 。 at the end. */
export function fillFrame(frame: string, word: string, name = ''): string {
  const t = frame.replace('＿', word).replace('{name}', name);
  return /[。！？]$/.test(t) ? t : `${t}。`;
}
