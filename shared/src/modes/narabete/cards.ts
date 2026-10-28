// Narabete!'s cards: the Time Line sets (round 1) and the Feelings Line themes (rounds 2 and 3).
// See docs/modes/narabete.md. All Japanese is draft until the fluent check.
//
// A Time Line set is a tiny story told in order, like a four-panel comic: its last card (by value)
// is the punchline, and is always dealt. Values are minutes from midnight on the set's day (past 24:00
// for the small hours), yen, or the day of the year, so cards sort by value.
//
// A Feelings Line theme is an opinion scale from 1 to 100. Opinion, never fact: "how big is this animal"
// has a right answer, so nobody argues and nobody laughs. Each theme carries ready answers, roughly
// scored, for players who'd rather pick one than make one up (Kana and N5), and swerve words: one that
// fits, one absurd, to spark a funny answer.

import type { JpText } from '../../../../content/src/types.js';
import type { Audience } from '../../protocol.js';

export interface TimeCard {
  id: string;
  /** Sort value: minutes, yen or day of the year. */
  value: number;
  /** What the phone shows instead of the sentence: a clock, a price tag or a date. */
  label: string;
  emoji: string;
  /** The sentence to say. */
  jp: JpText;
  /** The time, price or date as said, in kana: any one of these in the reading counts as said. */
  keys: string[];
}

export interface TimeSet {
  id: string;
  title: JpText;
  /** What the line runs from and to (the neck's two ends). */
  low: JpText;
  high: JpText;
  unit: 'time' | 'price' | 'date';
  audiences: readonly Audience[];
  cards: TimeCard[];
}

export interface ReadyAnswer {
  jp: JpText;
  emoji: string;
  /** Roughly where it sits on the scale, 1–100. */
  score: number;
}

export interface FeelTheme {
  id: string;
  /** The question on the TV. */
  ask: JpText;
  /** The theme's adjective for arguing about order: 「Aさんの ほうが 〜！」 */
  more: JpText;
  low: JpText;
  high: JpText;
  audiences: readonly Audience[];
  /** Round 3 only: the Worst Day Ever story. */
  story?: true;
  /** Sentence frames for the phone (kana with 〜 for the gap). */
  frames: string[];
  /** One that fits, one absurd. */
  swerve: JpText[];
  ready: ReadyAnswer[];
}

const jp = (text: string, en: string): JpText => ({ text, kana: text, en });
const t = (id: string, value: number, label: string, emoji: string, text: string, en: string, keys: string[]): TimeCard => ({ id, value, label, emoji, jp: jp(text, en), keys });
const r = (text: string, en: string, emoji: string, score: number): ReadyAnswer => ({ jp: jp(text, en), emoji, score });
const ALL: readonly Audience[] = ['kids', 'family', 'cheeky'];

const H = 60;

// ---- round 1: Time Line sets ----

export const TIME_SETS: TimeSet[] = [
  {
    id: 'pon-diet',
    title: jp('ポンの ダイエット', "Pon's diet"),
    low: jp('あさ', 'morning'),
    high: jp('よる', 'night'),
    unit: 'time',
    audiences: ALL,
    cards: [
      t('pon-diet.wake', 7 * H, '7:00 am', '🌅', 'ごぜん しちじに おきます。', 'Wakes up at 7 a.m.', ['しちじ']),
      t('pon-diet.salad', 8 * H, '8:00 am', '🥗', 'ごぜん はちじに サラダを たべます。', 'Eats a salad at 8 a.m.', ['はちじ']),
      t('pon-diet.jog', 10 * H, '10:00 am', '🏃', 'ごぜん じゅうじに ジョギングを します。', 'Goes jogging at 10 a.m.', ['じゅうじ']),
      t('pon-diet.lunch', 12 * H, '12:00 noon', '🍗', 'ひるの じゅうにじに サラダと からあげを たべます。', 'At noon, eats salad and karaage.', ['じゅうにじ']),
      t('pon-diet.snack', 15 * H, '3:00 pm', '🍗', 'ごご さんじに からあげだけ たべます。', 'At 3 p.m., eats only karaage.', ['さんじ']),
      t('pon-diet.cake', 17 * H + 30, '5:30 pm', '🍰', 'ごご ごじはんに ケーキを かいます。', 'Buys a cake at 5:30 p.m.', ['ごじはん', 'ごじさんじゅっぷん', 'ごじさんじっぷん']),
      t('pon-diet.ramen', 19 * H, '7:00 pm', '🍜', 'よる しちじに ラーメンを たべます。', 'Eats ramen at 7 p.m.', ['しちじ']),
      t('pon-diet.tomorrow', 21 * H, '9:00 pm', '🙈', 'よる くじに 「ダイエットは あしたから」と いいます。', 'At 9 p.m.: "The diet starts tomorrow."', ['くじ']),
    ],
  },
  {
    id: 'ghost-day',
    title: jp('ゆうれいの いちにち', "A ghost's day"),
    low: jp('おきる', 'gets up'),
    high: jp('ねる', 'goes to bed'),
    unit: 'time',
    audiences: ALL,
    cards: [
      t('ghost-day.wake', 16 * H + 30, '4:30 pm', '🥱', 'ごご よじはんに おきます。', 'Wakes up at 4:30 p.m.', ['よじはん', 'よじさんじゅっぷん', 'よじさんじっぷん']),
      t('ghost-day.shower', 17 * H, '5:00 pm', '🚿', 'ごご ごじに シャワーを あびます。', 'Takes a shower at 5 p.m.', ['ごじ']),
      t('ghost-day.breakfast', 19 * H, '7:00 pm', '🍳', 'よる しちじに あさごはんを たべます。', 'Eats breakfast at 7 p.m.', ['しちじ']),
      t('ghost-day.school', 21 * H, '9:00 pm', '🏫', 'よる くじに がっこうへ いきます。', 'Goes to school at 9 p.m.', ['くじ']),
      t('ghost-day.scare', 24 * H, '12:00 midnight', '👻', 'よなかの じゅうにじに ひとを おどかします。', 'Scares people at midnight.', ['じゅうにじ']),
      t('ghost-day.ice', 26 * H, '2:00 am', '🍦', 'ごぜん にじに コンビニで アイスを かいます。', 'Buys ice cream at a konbini at 2 a.m.', ['にじ']),
      t('ghost-day.karaoke', 28 * H + 30, '4:30 am', '🎤', 'ごぜん よじはんに カラオケを します。', 'Sings karaoke at 4:30 a.m.', ['よじはん', 'よじさんじゅっぷん', 'よじさんじっぷん']),
      t('ghost-day.sunrise', 30 * H, '6:00 am', '🌄', 'ごぜん ろくじに あさひを みて、ちょっと きえます。', 'At 6 a.m., sees the sunrise and fades a little.', ['ろくじ']),
    ],
  },
  {
    id: 'konbini-prices',
    title: jp('コンビニの ねだん', 'Konbini prices'),
    low: jp('やすい', 'cheap'),
    high: jp('たかい', 'expensive'),
    unit: 'price',
    audiences: ['kids', 'family'],
    cards: [
      t('konbini.gum', 98, '¥98', '🍬', 'ガムは きゅうじゅうはちえんです。', 'Gum is 98 yen.', ['きゅうじゅうはちえん']),
      t('konbini.onigiri', 150, '¥150', '🍙', 'おにぎりは ひゃくごじゅうえんです。', 'A rice ball is 150 yen.', ['ひゃくごじゅうえん']),
      t('konbini.tea', 180, '¥180', '🍵', 'おちゃは ひゃくはちじゅうえんです。', 'Tea is 180 yen.', ['ひゃくはちじゅうえん']),
      t('konbini.ice', 300, '¥300', '🍦', 'アイスは さんびゃくえんです。', 'Ice cream is 300 yen.', ['さんびゃくえん']),
      t('konbini.karaage', 450, '¥450', '🍗', 'からあげは よんひゃくごじゅうえんです。', 'Karaage is 450 yen.', ['よんひゃくごじゅうえん']),
      t('konbini.bento', 600, '¥600', '🍱', 'おべんとうは ろっぴゃくえんです。', 'A bento is 600 yen.', ['ろっぴゃくえん']),
      t('konbini.battery', 800, '¥800', '🔋', 'でんちは はっぴゃくえんです。', 'Batteries are 800 yen.', ['はっぴゃくえん']),
      t('konbini.umbrella', 1980, '¥1,980', '☂️', 'ゆうれいの かさは せんきゅうひゃくはちじゅうえんです。', "A ghost's umbrella is 1,980 yen.", ['せんきゅうひゃくはちじゅうえん']),
    ],
  },
  {
    id: 'pon-calendar',
    title: jp('ポンの カレンダー', "Pon's calendar"),
    low: jp('いちがつ', 'January'),
    high: jp('じゅうにがつ', 'December'),
    unit: 'date',
    audiences: ['kids', 'family', 'cheeky'],
    cards: [
      t('calendar.mochi', 1, 'Jan 1', '🎍', 'いちがつ ついたちに おもちを たべすぎます。', 'Eats too much mochi on January 1.', ['いちがつついたち']),
      t('calendar.choco', 45, 'Feb 14', '🍫', 'にがつ じゅうよっかに チョコを もらえません。', "Can't get any chocolate on February 14.", ['にがつじゅうよっか']),
      t('calendar.lie', 91, 'Apr 1', '🤥', 'しがつ ついたちに うそを つきます。', 'Tells a lie on April 1.', ['しがつついたち']),
      t('calendar.koinobori', 125, 'May 5', '🎏', 'ごがつ いつかに こいのぼりに なります。', 'Turns into a carp streamer on May 5.', ['ごがついつか']),
      t('calendar.tanabata', 188, 'Jul 7', '🎋', 'しちがつ なのかに ねがいごとを かきます。', 'Writes a wish on July 7.', ['しちがつなのか']),
      t('calendar.homework', 232, 'Aug 20', '📚', 'はちがつ はつかに しゅくだいを はじめます。', 'Starts the summer homework on August 20.', ['はちがつはつか']),
      t('calendar.halloween', 304, 'Oct 31', '🎃', 'じゅうがつ さんじゅういちにちに おばけに なります。', 'Becomes a ghost on October 31.', ['じゅうがつさんじゅういちにち']),
      t('calendar.cake', 358, 'Dec 24', '🎂', 'じゅうにがつ にじゅうよっかに ケーキを ぜんぶ たべます。', 'Eats the whole cake on December 24.', ['じゅうにがつにじゅうよっか']),
    ],
  },
  {
    id: 'nobiko-night',
    title: jp('のびこの よる', "Nobiko's night"),
    low: jp('ゆうがた', 'evening'),
    high: jp('あさ', 'morning'),
    unit: 'time',
    audiences: ['family', 'cheeky'],
    cards: [
      t('nobiko-night.dinner', 18 * H, '6:00 pm', '🍲', 'ごご ろくじに ばんごはんを つくります。', 'Cooks dinner at 6 p.m.', ['ろくじ']),
      t('nobiko-night.bath', 19 * H + 30, '7:30 pm', '🛁', 'よる しちじはんに おふろに はいります。', 'Takes a bath at 7:30 p.m.', ['しちじはん', 'しちじさんじゅっぷん', 'しちじさんじっぷん']),
      t('nobiko-night.drama', 20 * H, '8:00 pm', '📺', 'よる はちじに ドラマを みます。', 'Watches a drama at 8 p.m.', ['はちじ']),
      t('nobiko-night.bed', 22 * H, '10:00 pm', '😴', 'よる じゅうじに ねます。', 'Goes to bed at 10 p.m.', ['じゅうじ']),
      t('nobiko-night.neck', 23 * H, '11:00 pm', '🦒', 'よる じゅういちじに くびが のびます。', 'Her neck stretches at 11 p.m.', ['じゅういちじ']),
      t('nobiko-night.peek', 24 * H, '12:00 midnight', '👀', 'よなかの じゅうにじに となりの いえを のぞきます。', "Peeks into the neighbours' house at midnight.", ['じゅうにじ']),
      t('nobiko-night.back', 27 * H, '3:00 am', '↩️', 'ごぜん さんじに くびが もどります。', 'Her neck comes back at 3 a.m.', ['さんじ']),
      t('nobiko-night.nothing', 31 * H, '7:00 am', '🤐', 'ごぜん しちじに 「なにも しりません」と いいます。', 'At 7 a.m.: "I know nothing."', ['しちじ']),
    ],
  },
  {
    id: 'first-date',
    title: jp('はじめての デート', 'A first date'),
    low: jp('ゆうがた', 'evening'),
    high: jp('つぎの あさ', 'the next morning'),
    unit: 'time',
    audiences: ['cheeky'],
    cards: [
      t('first-date.meet', 18 * H, '6:00 pm', '🚉', 'ごご ろくじに えきで まちあわせを します。', 'Meets up at the station at 6 p.m.', ['ろくじ']),
      t('first-date.name', 18 * H + 10, '6:10 pm', '😅', 'ろくじ じゅっぷんに あいての なまえを わすれます。', "At 6:10, forgets their date's name.", ['ろくじじゅっぷん', 'ろくじじっぷん']),
      t('first-date.wine', 19 * H, '7:00 pm', '🍷', 'よる しちじに ワインを のみます。', 'Drinks wine at 7 p.m.', ['しちじ']),
      t('first-date.home', 21 * H, '9:00 pm', '🏃', 'よる くじに かえりたく なります。', 'At 9 p.m., wants to go home.', ['くじ']),
      t('first-date.karaoke', 22 * H + 30, '10:30 pm', '🎤', 'よる じゅうじはんに カラオケに いきます。', 'Goes to karaoke at 10:30 p.m.', ['じゅうじはん', 'じゅうじさんじゅっぷん', 'じゅうじさんじっぷん']),
      t('first-date.midnight', 24 * H, '12:00 midnight', '🌙', 'よなかの じゅうにじ、まだ かえって いません。', 'Midnight: still not home.', ['じゅうにじ']),
      t('first-date.train', 26 * H, '2:00 am', '🚃', 'ごぜん にじ、もう でんしゃが ありません。', "2 a.m.: the last train's gone.", ['にじ']),
      t('first-date.breakfast', 31 * H, '7:00 am', '🍳', 'ごぜん しちじに あさごはんも いっしょに たべます。', 'At 7 a.m., they have breakfast together too.', ['しちじ']),
    ],
  },
  {
    id: 'boss-schedule',
    title: jp('ぶちょうの ひみつの スケジュール', "The boss's secret schedule"),
    low: jp('あさ', 'morning'),
    high: jp('ゆうがた', 'evening'),
    unit: 'time',
    audiences: ['cheeky'],
    cards: [
      t('boss.arrive', 9 * H, '9:00 am', '🏢', 'ごぜん くじに かいしゃに きます。', 'Gets to the office at 9 a.m.', ['くじ']),
      t('boss.coffee', 9 * H + 30, '9:30 am', '☕', 'くじはんに コーヒーを のみます。', 'Drinks coffee at 9:30.', ['くじはん', 'くじさんじゅっぷん', 'くじさんじっぷん']),
      t('boss.meeting', 10 * H, '10:00 am', '😴', 'じゅうじに かいぎで ねます。', 'Sleeps in a meeting at 10.', ['じゅうじ']),
      t('boss.lunch', 12 * H, '12:00 noon', '🍜', 'ひるの じゅうにじに ながい ランチに いきます。', 'Goes for a long lunch at noon.', ['じゅうにじ']),
      t('boss.golf', 14 * H, '2:00 pm', '⛳', 'ごご にじに ゴルフの ビデオを みます。', 'Watches golf videos at 2 p.m.', ['にじ']),
      t('boss.busy', 15 * H + 30, '3:30 pm', '📢', 'さんじはんに 「いそがしい！」と いいます。', 'At 3:30, says "I\'m busy!"', ['さんじはん', 'さんじさんじゅっぷん', 'さんじさんじっぷん']),
      t('boss.pack', 16 * H + 45, '4:45 pm', '🎒', 'よじ よんじゅうごふんに かえる じゅんびを します。', 'Gets ready to go home at 4:45.', ['よじよんじゅうごふん']),
      t('boss.done', 17 * H + 5, '5:05 pm', '😮‍💨', 'ごじ ごふんに 「きょうも いそがしかった」と いいます。', 'At 5:05: "Busy day again today."', ['ごじごふん']),
    ],
  },
];

// ---- rounds 2 and 3: Feelings Line themes ----

const FRAMES = {
  thing: ['〜です。', '〜が すきです。', '〜は ちょっと…'],
  excuse: ['〜から、おくれました。', '〜て、〜ませんでした。', 'じつは、〜。'],
  day: ['きょう、〜ました。', '〜て、〜ました。', 'あさ、〜。'],
};

export const FEEL_THEMES: FeelTheme[] = [
  // Kids
  {
    id: 'smelly',
    ask: jp('どのくらい くさい？', 'How smelly is it?'),
    more: jp('くさい', 'smellier'),
    low: jp('いい におい', 'smells nice'),
    high: jp('ポンの くつした', "Pon's socks"),
    audiences: ['kids', 'family'],
    frames: FRAMES.thing,
    swerve: [jp('なっとう', 'natto'), jp('おばけの パンツ', "a ghost's pants")],
    ready: [
      r('はな', 'a flower', '🌸', 3),
      r('せっけん', 'soap', '🧼', 6),
      r('パン', 'bread', '🍞', 15),
      r('いぬ', 'a dog', '🐕', 40),
      r('なっとう', 'natto', '🫘', 65),
      r('ゴミばこ', 'a bin', '🗑️', 80),
      r('ふるい くつ', 'old shoes', '👟', 88),
      r('ポンの くつした', "Pon's socks", '🧦', 99),
    ],
  },
  {
    id: 'ghost-scary',
    ask: jp('おばけが みたら、どのくらい こわがる？', 'How scary would a ghost find it?'),
    more: jp('こわい', 'scarier'),
    low: jp('ぜんぜん こわくない', 'not scary at all'),
    high: jp('ぎゃー！', 'AAAH!'),
    audiences: ['kids', 'family'],
    frames: FRAMES.thing,
    swerve: [jp('はいしゃ', 'the dentist'), jp('おかあさん', 'Mum')],
    ready: [
      r('くらい へや', 'a dark room', '🌑', 2),
      r('ねこ', 'a cat', '🐈', 15),
      r('でんき', 'the lights', '💡', 40),
      r('おまわりさん', 'a police officer', '👮', 55),
      r('そうじき', 'a vacuum cleaner', '🧹', 70),
      r('おひさま', 'the sun', '☀️', 85),
      r('はいしゃ', 'the dentist', '🦷', 92),
      r('おかあさん', 'Mum', '👩', 99),
    ],
  },
  {
    id: 'pon-ate',
    ask: jp('ポンが たべたら、どのくらい たいへん？', 'If Pon ate it, how much trouble?'),
    more: jp('たいへん', 'worse'),
    low: jp('だいじょうぶ', "it's fine"),
    high: jp('たいへん！', 'disaster!'),
    audiences: ['kids', 'family'],
    frames: FRAMES.thing,
    swerve: [jp('しゅくだい', 'homework'), jp('つき', 'the moon')],
    ready: [
      r('りんご', 'an apple', '🍎', 3),
      r('ケーキ', 'cake', '🍰', 20),
      r('ぼくの おやつ', 'my snack', '🍪', 45),
      r('せんせいの おべんとう', "the teacher's bento", '🍱', 60),
      r('しゅくだい', 'homework', '📓', 72),
      r('テレビの リモコン', 'the TV remote', '📺', 84),
      r('おばあちゃんの いれば', "Grandma's false teeth", '🦷', 93),
      r('つき', 'the moon', '🌕', 100),
    ],
  },
  // Family
  {
    id: 'grandma-shock',
    ask: jp('おばあちゃんに みせたら、どのくらい びっくりする？', 'How shocked would Grandma be?'),
    more: jp('びっくりする', 'more shocking'),
    low: jp('ふーん', '"Hmm."'),
    high: jp('きゅうきゅうしゃ！', 'call an ambulance!'),
    audiences: ['family', 'cheeky'],
    frames: FRAMES.thing,
    swerve: [jp('ぼくの へや', 'my room'), jp('ロボット', 'a robot')],
    ready: [
      r('ねこの しゃしん', 'a cat photo', '🐈', 5),
      r('あたらしい くつ', 'new shoes', '👟', 15),
      r('ピンクの かみ', 'pink hair', '💇', 45),
      r('ぼくの へや', 'my room', '🛏️', 60),
      r('テストの てん', 'my test score', '📝', 70),
      r('ロボットの かれし', 'a robot boyfriend', '🤖', 85),
      r('タトゥー', 'a tattoo', '🐉', 90),
      r('ぎんこうの つうちょう', 'my bank book', '🏦', 98),
    ],
  },
  {
    id: 'flea-market',
    ask: jp('フリマで いくらで うれる？', 'How much would it sell for at a flea market?'),
    more: jp('たかい', 'pricier'),
    low: jp('ゼロえん', '0 yen'),
    high: jp('ひゃくまんえん', 'a million yen'),
    audiences: ['kids', 'family', 'cheeky'],
    frames: ['〜を うります。', '〜は いかがですか？', 'これは 〜です。'],
    swerve: [jp('ポンの しっぽ', "Pon's tail"), jp('ふるい でんわ', 'an old phone')],
    ready: [
      r('つかった ティッシュ', 'a used tissue', '🤧', 1),
      r('かたほうの くつした', 'one sock', '🧦', 4),
      r('ふるい でんわ', 'an old phone', '📱', 25),
      r('おじいちゃんの ぼうし', "Grandpa's hat", '🎩', 35),
      r('ギター', 'a guitar', '🎸', 60),
      r('ポンの しっぽ', "Pon's tail", '🦝', 75),
      r('ゆうれいの しゃしん', 'a photo of a ghost', '👻', 88),
      r('ほんものの こばん', 'a real gold coin', '🪙', 97),
    ],
  },
  {
    id: 'hard-morning',
    ask: jp('その ひの あさ、おきるのが どのくらい つらい？', 'How hard is getting up on that day?'),
    more: jp('つらい', 'harder'),
    low: jp('すぐ おきる', 'up at once'),
    high: jp('むり', 'impossible'),
    audiences: ['kids', 'family', 'cheeky'],
    frames: ['〜の ひは すぐ おきます。', '〜の ひは おきません。', '〜は ちょっと…'],
    swerve: [jp('たんじょうび', 'a birthday'), jp('はいしゃ', 'the dentist')],
    ready: [
      r('たんじょうび', 'my birthday', '🎂', 3),
      r('りょこう', 'a trip', '✈️', 8),
      r('どようび', 'Saturday', '😎', 20),
      r('がっこう', 'school', '🏫', 55),
      r('しごと', 'work', '💼', 70),
      r('あめの げつようび', 'a rainy Monday', '🌧️', 85),
      r('はいしゃ', 'the dentist', '🦷', 92),
      r('テスト', 'a test', '📝', 96),
    ],
  },
  // Cheeky
  {
    id: 'late-excuse',
    ask: jp('ちこくの いいわけ、どのくらい ひどい？', 'How bad is this excuse for being late?'),
    more: jp('ひどい', 'worse'),
    low: jp('まあ、ゆるせる', 'fair enough'),
    high: jp('ぜったい アウト', 'totally unforgivable'),
    audiences: ['cheeky'],
    frames: FRAMES.excuse,
    swerve: [jp('でんしゃ', 'the train'), jp('うちゅうじん', 'aliens')],
    ready: [
      r('でんしゃが おくれました。', 'The train was late.', '🚃', 5),
      r('ねこが ひざで ねて いました。', 'My cat was asleep on my lap.', '🐈', 25),
      r('でんしゃで ねて、しゅうてんまで いきました。', 'I fell asleep on the train and rode to the end.', '😴', 40),
      r('かみが きまりませんでした。', "My hair wouldn't sit right.", '💇', 55),
      r('ゆうれいが シャワーを つかって いました。', 'A ghost was using my shower.', '👻', 65),
      r('のみすぎて、くつが ありませんでした。', 'I drank too much and lost my shoes.', '👞', 78),
      r('うちゅうじんに つれて いかれました。', 'I was taken by aliens.', '🛸', 90),
      r('きょうが なんようびか わかりませんでした。', "I didn't know what day it was.", '📅', 97),
    ],
  },
  {
    id: 'dating-profile',
    ask: jp('マッチングアプリに かいたら、どのくらい モテる？', 'How popular would this make your dating profile?'),
    more: jp('モテる', 'more popular'),
    low: jp('ブロック', 'blocked'),
    high: jp('モテモテ', 'swipes galore'),
    audiences: ['cheeky'],
    frames: ['しゅみは 〜です。', '〜が できます。', 'わたしは 〜です。'],
    swerve: [jp('りょうり', 'cooking'), jp('ははの てづくりの セーター', "my mum's hand-knitted sweater")],
    ready: [
      r('へびを ごひき かって います。', 'I keep five snakes.', '🐍', 5),
      r('ははと すんで います。', 'I live with my mum.', '👩', 15),
      r('まいにち カップラーメンです。', 'Cup noodles every day.', '🍜', 25),
      r('ねるのが すきです。', 'I like sleeping.', '😴', 40),
      r('いぬが います。', 'I have a dog.', '🐕', 70),
      r('りょうりが とくいです。', "I'm a good cook.", '🍳', 82),
      r('にほんごが はなせます。', 'I can speak Japanese.', '🗣️', 90),
      r('へやが いつも きれいです。', 'My room is always tidy.', '✨', 96),
    ],
  },
  {
    id: 'midnight-message',
    ask: jp('よなかの メッセージ、どのくらい あやしい？', 'How suspicious is this midnight message?'),
    more: jp('あやしい', 'more suspicious'),
    low: jp('ふつう', 'normal'),
    high: jp('あやしすぎる', 'way too suspicious'),
    audiences: ['cheeky'],
    frames: ['「〜」', '「〜 しない？」', '「〜、いい？」'],
    swerve: [jp('カラオケ', 'karaoke'), jp('ペンギン', 'a penguin')],
    ready: [
      r('「あした なんじ？」', '"What time tomorrow?"', '🕐', 5),
      r('「かぎ わすれた」', '"Forgot my keys."', '🔑', 20),
      r('「おきてる？」', '"You up?"', '🌙', 60),
      r('「いま、ちかくに いる」', '"I\'m nearby right now."', '📍', 75),
      r('「ペンギン、ほしい？」', '"Want a penguin?"', '🐧', 80),
      r('「ないしょに して」', '"Keep this a secret."', '🤫', 88),
      r('「シャベル ある？」', '"Got a shovel?"', '⛏️', 98),
      r('「カラオケ いく？」', '"Karaoke?"', '🎤', 45),
    ],
  },
  {
    id: 'parents-saw',
    ask: jp('おやに みられたら、どのくらい まずい？', 'How bad if your parents saw it?'),
    more: jp('まずい', 'worse'),
    low: jp('セーフ', 'safe'),
    high: jp('かぞく かいぎ', 'family meeting'),
    audiences: ['cheeky'],
    frames: FRAMES.thing,
    swerve: [jp('にっき', 'my diary'), jp('きのうの よるの しゃしん', "last night's photos")],
    ready: [
      r('しゅくだい', 'my homework', '📓', 3),
      r('ゲーム', 'my games', '🎮', 15),
      r('へやの なか', 'my room', '🛏️', 35),
      r('ネットの りれき', 'my browser history', '💻', 80),
      r('にっき', 'my diary', '📔', 70),
      r('きのうの よるの しゃしん', "last night's photos", '📸', 90),
      r('クレジットカードの めいさい', 'my credit card bill', '💳', 85),
      r('タトゥー', 'my tattoo', '🐉', 95),
    ],
  },
  {
    id: 'morning-regret',
    ask: jp('のみかいの つぎの あさ、どのくらい こうかいする？', 'How much would you regret it the next morning?'),
    more: jp('はずかしい', 'more embarrassing'),
    low: jp('へいき', 'no regrets'),
    high: jp('きえたい', 'want to vanish'),
    audiences: ['cheeky'],
    frames: ['〜ました。', '〜て しまいました。', 'じつは、〜。'],
    swerve: [jp('カラオケ', 'karaoke'), jp('ぶちょう', 'the boss')],
    ready: [
      r('みずを のみました。', 'I drank water.', '💧', 2),
      r('ラーメンを たべました。', 'I ate ramen.', '🍜', 20),
      r('カラオケで うたいました。', 'I sang karaoke.', '🎤', 35),
      r('タクシーで ねました。', 'I fell asleep in a taxi.', '🚕', 50),
      r('ぶちょうと おどりました。', 'I danced with the boss.', '💃', 75),
      r('もとカレに でんわしました。', 'I called my ex.', '📞', 88),
      r('ぶちょうを「ママ」と よびました。', 'I called the boss "Mum".', '😱', 95),
      r('へんな タトゥーを いれました。', 'I got a weird tattoo.', '🐉', 99),
    ],
  },
  // Round 3: the Worst Day Ever
  {
    id: 'worst-day-kids',
    ask: jp('きょう あった こと、どのくらい たいへん？', 'What happened today, and how bad was it?'),
    more: jp('たいへん', 'worse'),
    low: jp('ちょっと', 'a bit'),
    high: jp('さいあく！', 'the worst!'),
    audiences: ['kids'],
    story: true,
    frames: FRAMES.day,
    swerve: [jp('アイス', 'ice cream'), jp('きょうりゅう', 'a dinosaur')],
    ready: [
      r('くつしたが ぬれました。', 'My socks got wet.', '🧦', 5),
      r('アイスが おちました。', 'I dropped my ice cream.', '🍦', 25),
      r('しゅくだいを わすれました。', 'I forgot my homework.', '📓', 40),
      r('ねこが にげました。', 'The cat ran away.', '🐈', 55),
      r('せんせいが おこりました。', 'The teacher got angry.', '😠', 65),
      r('ポンが おやつを たべました。', 'Pon ate my snack.', '🦝', 75),
      r('いえが ゆうれいで いっぱいでした。', 'The house was full of ghosts.', '👻', 88),
      r('きょうりゅうが きました。', 'A dinosaur came.', '🦖', 98),
    ],
  },
  {
    id: 'worst-day',
    ask: jp('きょう あった こと、どのくらい ひどい？', 'What happened today, and how bad was it?'),
    more: jp('ひどい', 'worse'),
    low: jp('まあまあ', 'meh'),
    high: jp('さいあく！', 'the worst!'),
    audiences: ['family'],
    story: true,
    frames: FRAMES.day,
    swerve: [jp('かさ', 'my umbrella'), jp('うちゅうじん', 'aliens')],
    ready: [
      r('コーヒーが つめたかったです。', 'My coffee was cold.', '☕', 5),
      r('かさを わすれました。', 'I forgot my umbrella.', '☂️', 20),
      r('でんしゃが とまりました。', 'The trains stopped.', '🚃', 35),
      r('さいふを おとしました。', 'I dropped my wallet.', '👛', 55),
      r('かいぎで ねました。', 'I fell asleep in a meeting.', '😴', 65),
      r('いぬが しゅくだいを たべました。', 'The dog ate my homework.', '🐕', 75),
      r('いえが なくなりました。', 'My house was gone.', '🏚️', 90),
      r('うちゅうじんが きました。', 'Aliens came.', '🛸', 98),
    ],
  },
  {
    id: 'worst-day-cheeky',
    ask: jp('きょう あった こと、どのくらい ひどい？', 'What happened today, and how bad was it?'),
    more: jp('ひどい', 'worse'),
    low: jp('まあまあ', 'meh'),
    high: jp('じんせい おわり', 'life over'),
    audiences: ['cheeky'],
    story: true,
    frames: FRAMES.day,
    swerve: [jp('もとカレ', 'my ex'), jp('ペンギン', 'a penguin')],
    ready: [
      r('ねぐせが ひどかったです。', 'Terrible bed hair.', '💇', 5),
      r('でんしゃで となりの ひとが わたしの かたで ねました。', 'The person next to me slept on me.', '🚃', 20),
      r('まちがえて ぶちょうに メールしました。', 'I emailed the boss by mistake.', '📧', 45),
      r('もとカレに あいました。', 'I ran into my ex.', '💔', 55),
      r('ズボンが やぶれました。', 'My trousers split.', '👖', 70),
      r('もとカレの けっこんしきでした。', "It was my ex's wedding.", '💒', 82),
      r('かいぎに ペンギンが きました。', 'A penguin turned up at the meeting.', '🐧', 90),
      r('ぜんぶ ゆめでした。まだ げつようびです。', "It was all a dream. It's still Monday.", '📅', 99),
    ],
  },
];

/** Time Line sets for an audience. */
export const timeSetsFor = (a: Audience): TimeSet[] => TIME_SETS.filter((s) => s.audiences.includes(a));

/** Feelings Line themes for an audience: the round 2 ones, or the Worst Day Ever for round 3. */
export const feelThemesFor = (a: Audience, story: boolean): FeelTheme[] => FEEL_THEMES.filter((f) => f.audiences.includes(a) && !!f.story === story);
