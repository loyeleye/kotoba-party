// Late Again!'s content: the scenes (what the latecomer is late for), the causes the excuse can blame,
// Pon's reaction to each, and the round's last beat, "the real story". Every line is draft until a fluent
// check. See docs/modes/late-again.md. The deck, the lines and Pon's reactions follow the humor seat's
// pass (storyboards/reviews/humor-late-again-content.md, 1 Nov 2026), with the PR #136 panel's fixes
// (learning-path/late-again-pr136-review: Japanese, story, humor and learning-science seats).
//
// Each cause is one picture tile. The latecomer blames one of the three the witness was offered, so every
// cause carries a line for each level, written as a mission (the phone never names the grammar, it asks
// for the punchline) and a model line (Pon's version, shown only as a hint, and read out on a mic pass).
// A deal is one believable cause, one self-own and one yōkai: three joke shapes, so the latecomer picks a
// strategy and the witness has to guess which.
//
// Never: 人身事故, disasters, death, overwork, harassment, drinking or hangovers, illness or injury, family
// emergencies or childcare, weight or body jokes, a partner controlling you. The train is never stopped or
// delayed: the passenger is the problem, not the railway.

import type { JpText, Level } from '../../../../content/src/types.js';
import type { Audience } from '../../protocol.js';
import { n4Up } from '../../level.js';

const jp = (text: string, en: string, kana = text): JpText => ({ text, kana, en });

/** What the latecomer is late for: one card on the TV, and Pon's opener. Never a hint at the cause. */
export interface LateScene {
  id: string;
  place: JpText;
  emoji: string;
  /** Pon's opener, after he reads how late they are. */
  opener: JpText;
  /** Left out: every room. */
  audiences?: readonly Audience[];
  /** Saved for the last round. */
  finale?: boolean;
}

/** The grammar chunk the commentary booth calls out, when the excuse used it. */
export interface Chunk {
  /** As written in the model line, to highlight. */
  text: string;
  /** Kana that show the chunk was said (any one is enough), matched in the reading of what was heard. */
  keys: string[];
  /** Pon's one line of colour commentary, in English. */
  note: string;
  /** The preview tag: where this grammar lives on the train map. */
  tag: string;
}

export interface CauseLine {
  /** What the latecomer is asked to do, in plain English. Never names the grammar. */
  mission: string;
  /** Pon's version: a hint behind a tap, and what Pon reads on a mic pass. */
  model: JpText;
  /**
   * N5 only: a fill-in sentence frame (＿＿ marks the gap), the first step behind "Need a hint?". The gap is
   * on the grammar (the verb, the connector, a particle), never on the cause word, which is on the tile
   * already; the English names what goes in it, so the frame stays solvable.
   */
  frame?: JpText;
  chunk?: Chunk;
}

export type Bucket = 'believable' | 'selfown' | 'yokai';

export interface Cause {
  id: string;
  bucket: Bucket;
  /** Sleep jokes: at most one in a deal. */
  sleep?: boolean;
  /** Left out: every room. */
  audiences?: readonly Audience[];
  /** Scenes this cause is never dealt in (the date stays out of the omiai and your own wedding). */
  avoidScenes?: readonly string[];
  /** stage/assets/late/<picture>.png */
  picture: string;
  /** The picture, as an emoji, for places that can't show art (bots, logs, alt text). */
  emoji: string;
  /** The Kana tile: one word. */
  word: JpText;
  /** The Kana latecomer's third tile: the cause's sound or punch (ぐうぐう, にゃー). */
  sound: JpText;
  /**
   * Kana that show the cause was named in the excuse (any one). Matched on the plain reading (spaces
   * stripped, ー read as its vowel), so a short word carries its particle (からすが), or it would match
   * across a word boundary (から＋すみません).
   */
  keys: string[];
  /** The gist every phone gets at the gist beat: a short kana line, with English. */
  gist: JpText;
  /** N5 and N4 lines (N3 joins at step 6). */
  lines: Partial<Record<Exclude<Level, 'kana'>, CauseLine>>;
  /** Pon's reaction at the ruling, by how the leaves went: flop "I've used that one", good "taking notes", IPPON "I'm using it tomorrow". */
  pon: { flop: JpText; good: JpText; ippon: JpText };
  /** The N4+ gallery's listening check: one question, the right answer and two near misses. None of them may touch the never-list. */
  check: { q: string; right: string; wrong: [string, string] };
  /** The real story, when this cause is the round's last beat: one short line of Pon's (ほんとうは… …ポン！). */
  truth: JpText;
  status: 'draft' | 'fluent-checked';
}

/** The Kana latecomer's apology tile, and the witness's curveball (once a game each). */
export const SORRY_TILE = { id: 'sorry', word: jp('すみません！', 'Sorry!'), keys: ['すみません', 'すいません', 'ごめん', 'もうしわけ'] };
export const TANUKI_TILE = { id: 'tanuki', word: jp('たぬき！', 'A tanuki!'), keys: ['たぬき'], picture: 'curve-tanuki', emoji: '🍃' };
/** The Kana latecomer's sound tile: it takes the sound of whichever cause they tapped. */
export const SOUND_TILE_ID = 'sound';

export const SCENES: readonly LateScene[] = [
  { id: 'meeting', place: { text: '朝の 会議', kana: 'あさの かいぎ', en: 'the morning meeting' }, emoji: '📋', opener: jp('みんな まってる！ …ポンも まだ パジャマだポン。', 'Everyone’s waiting! …I’m still in my pyjamas too.') },
  { id: 'recording', place: { text: 'テレビ番組', kana: 'テレビばんぐみ', en: 'tonight’s TV show recording' }, emoji: '🎬', opener: jp('ほんばん ごふんまえ！ ゲストが いないポン！', 'Five minutes to air! The guest is missing!') },
  { id: 'trip', place: { text: '社員旅行', kana: 'しゃいんりょこう', en: 'the company trip bus' }, emoji: '🚌', opener: jp('バスが いっちゃったポン！ バイバーイ！', 'The bus has gone! Bye-bye!') },
  { id: 'cake', place: { text: '部長の 誕生日', kana: 'ぶちょうの たんじょうび', en: 'the boss’s surprise party (you’ve got the cake)' }, emoji: '🎂', opener: jp('ケーキは… きみが もってるポン！？', 'The cake is… with YOU?!') },
  { id: 'photo', place: { text: '会社の 写真', kana: 'かいしゃの しゃしん', en: 'the company photo' }, emoji: '📸', opener: jp('まるの なかに はいるポン？', 'Going in the little circle, then?') },
  { id: 'firstday', place: { text: '仕事の 最初の 日', kana: 'しごとの さいしょの ひ', en: 'your first day' }, emoji: '🎉', opener: jp('いちにちめから！？', 'From day one?!') },
  { id: 'client', place: { text: '大事な お客さん', kana: 'だいじな おきゃくさん', en: 'the big client' }, emoji: '🤝', opener: jp('おきゃくさんが まどから みてるポン…', 'The client is looking in through the window…') },
  { id: 'sports', place: { text: '運動会', kana: 'うんどうかい', en: 'company sports day (you’re the anchor)' }, emoji: '🏃', opener: jp('アンカーが いないポン！', 'The anchor’s missing!') },
  { id: 'omiai', place: { text: 'お見合い', kana: 'おみあい', en: 'the omiai Nobiko-san arranged' }, emoji: '💐', opener: jp('のびこさんの くびが さがしに きたポン！', 'Nobiko-san’s neck has come looking for you!'), audiences: ['family', 'cheeky'] },
  { id: 'wedding', place: { text: '自分の 結婚式', kana: 'じぶんの けっこんしき', en: 'your own wedding (the boss is giving the speech)' }, emoji: '💒', opener: jp('じぶんの けっこんしきだポン！？', 'Your OWN wedding?!'), audiences: ['family', 'cheeky'], finale: true },
  // The Kids finale: the cake round again, a year on.
  { id: 'birthday2', place: { text: '部長の 次の 誕生日', kana: 'ぶちょうの つぎの たんじょうび', en: 'the boss’s NEXT birthday (you’ve still got the cake)' }, emoji: '🎂', opener: jp('もう つぎの たんじょうび！ ケーキ ふたつだポン！', 'It’s the NEXT birthday already! Two cakes!'), audiences: ['kids'], finale: true },
];

/**
 * The premise, said once as the game starts (in place of a random late_intro line): the boss is late too,
 * the one in the sash is acting chief, a latecomer phones the boss, and the chief calls Safe or Out.
 */
export const PREMISE: JpText = jp(
  'たいへん！ ぶちょうも ちこくだポン！ きょうは たすきの ひとが ぶちょうだいり。ちこくした ひとは ぶちょうに でんわ！ セーフ？ アウト？',
  'Oh no! The boss is late too! Today the one in the sash is acting chief. Late? Phone the boss! Safe or Out?',
);

/**
 * How late, climbing each round from five minutes to a year; the last round is always a year. It drills ふん／ぷん
 * and the counters. A rung's `quip` is Pon's own reading of it, in place of the shocked one (five minutes is
 * early, for Pon), so the shock has somewhere to climb from.
 */
export type Lateness = JpText & { quip?: JpText };
export const LATENESS: readonly Lateness[] = [
  { ...jp('ごふん', '5 minutes'), quip: jp('ごふん？ ポンより はやいポン！', 'Five minutes? That’s earlier than me!') },
  jp('じゅっぷん', '10 minutes'),
  jp('さんじゅっぷん', '30 minutes'),
  jp('いちじかん', '1 hour'),
  jp('さんじかん', '3 hours'),
  jp('はんにち', 'half a day'),
  jp('いちにち', 'a whole day'),
  jp('みっか', '3 days'),
  jp('いっしゅうかん', 'a week'),
  jp('いちねん', 'a year'),
];

/** The lateness for round `round` of `total`: spread along the ladder, always ending on a year. */
export function latenessFor(round: number, total: number): Lateness {
  const last = LATENESS.length - 1;
  if (total <= 1) return LATENESS[last]!;
  const i = Math.round(((round - 1) / (total - 1)) * last);
  return LATENESS[Math.max(0, Math.min(last, i))]!;
}

const tag = {
  shimau: 'Express Line · 〜て しまいました',
  sugite: 'Express Line · 〜すぎて',
  node: 'Express Line · 〜ので',
  passive: 'Express Line · 〜(ら)れました',
  must: 'Express Line · 〜なければ なりませんでした',
};
// Plain hiragana, matched on the plain reading. しまっ catches しまった／しまって.
const SHIMAU = ['しまい', 'しまっ', 'ちゃい', 'ちゃっ', 'じゃい', 'じゃっ'];
// すぎて／すぎました, not the time suffix (じゅうじ すぎに, よじすぎまで).
const SUGI = ['すぎて', 'すぎました'];
// ので after a verb, an adjective or noun＋な, never after the particle の (あさの でんしゃ, えきの でぐち).
const NODE = ['たので', 'るので', 'なので', 'いので'];
const MUST = ['なければ', 'なきゃ', 'なくちゃ'];

/** N4 apologises for the delay itself (おくれて すみません). */
const N4_SORRY: JpText = { text: '遅れて すみません。', kana: 'おくれて すみません。', en: 'Sorry I’m late. ' };
/** A year late to the finale, the register climbs with the ladder: たいへん もうしわけ ありません. */
const FINALE_SORRY: JpText = { text: '大変 申し訳 ありません。', kana: 'たいへん もうしわけ ありません。', en: 'I am terribly sorry. ' };
const n4 = (kanji: string, kana: string, en: string): JpText => ({ text: `${N4_SORRY.text}${kanji}`, kana: `${N4_SORRY.kana}${kana}`, en: `${N4_SORRY.en}${en}` });

export const CAUSES: readonly Cause[] = [
  {
    id: 'oversleep',
    bucket: 'selfown',
    sleep: true,
    picture: 'cause-oversleep',
    emoji: '⏰',
    word: jp('ねぼう！', 'Overslept!'),
    sound: jp('ぐうぐう', 'Zzz'),
    keys: ['ねぼう', 'ねぼお', 'とけい', 'めざまし', 'ねすぎ'],
    gist: jp('とけいが ねぼうした！', 'The clock overslept!'),
    lines: {
      n5: {
        mission: 'Apologise, then blame your alarm clock. Sound sorry about what it did.',
        model: jp('すみません！ とけいが ねて いました。', 'Sorry! My clock was asleep.'),
        frame: jp('すみません！ とけいが ＿＿ いました。', 'Sorry! My clock was ＿＿ (sleeping).'),
      },
      n4: {
        mission: 'Apologise, then blame your alarm clock. Sound sorry about what it did.',
        model: n4('目覚まし時計が 寝坊して しまいました。', 'めざましどけいが ねぼうして しまいました。', 'My alarm clock overslept.'),
        chunk: { text: '寝坊して しまいました', keys: SHIMAU, note: '〜て しまいました: it happened, and you’re sorry it did. Even the clock is sorry.', tag: tag.shimau },
      },
    },
    pon: {
      flop: jp('ポンの とけいも まいにち ねぼうするポン。', 'My clock oversleeps every day too.'),
      good: jp('とけいが ねぼう！？ メモ、メモ…', 'The CLOCK overslept?! Taking notes…'),
      ippon: jp('あした ポンの とけいも ねぼうするポン！', 'My clock’s oversleeping tomorrow too!'),
    },
    check: { q: 'Who overslept?', right: 'The alarm clock', wrong: ['The boss', 'The cat'] },
    truth: jp('ほんとうは… とけいが まだ ねてるポン。', 'What really happened… the clock’s still asleep.'),
    status: 'draft',
  },
  {
    id: 'train',
    bucket: 'believable',
    sleep: true,
    picture: 'cause-train',
    emoji: '🚃',
    word: jp('でんしゃ！', 'The train!'),
    sound: jp('うみ！', 'The sea!'),
    keys: ['でんしゃ'],
    gist: jp('でんしゃで ねて、うみ！', 'Fell asleep on the train: the sea!'),
    lines: {
      n5: {
        mission: 'Apologise, then blame the train. Say where you woke up.',
        model: jp('すみません！ でんしゃで ねて、うみまで いきました。', 'Sorry! I fell asleep on the train and went all the way to the sea.'),
        frame: jp('すみません！ でんしゃで ＿＿、うみまで いきました。', 'Sorry! On the train I ＿＿ (fell asleep) and went to the sea.'),
      },
      n4: {
        mission: 'Apologise, then blame the train. Say where you woke up.',
        model: n4('電車で 寝て しまいました。起きたら、海でした。', 'でんしゃで ねて しまいました。おきたら、うみでした。', 'I fell asleep on the train. When I woke up, I was at the sea.'),
        chunk: { text: '寝て しまいました', keys: SHIMAU, note: '〜て しまいました: you didn’t mean to. Nobody means to wake up at the sea.', tag: tag.shimau },
      },
    },
    pon: {
      flop: jp('でんしゃ… ポンも せんしゅう つかったポン。', 'The train… I used that one last week.'),
      good: jp('うみまで！？ いい でんしゃだポン！', 'All the way to the sea?! Nice train!'),
      ippon: jp('ポンも あした うみまで ねて いくポン！', 'Tomorrow I’m sleeping my way to the sea too!'),
    },
    check: { q: 'Where did they wake up?', right: 'At the sea', wrong: ['At the office', 'At home in bed'] },
    truth: jp('ほんとうは… まだ うみに いるポン！', 'What really happened… they’re still at the sea!'),
    status: 'draft',
  },
  {
    id: 'rain',
    bucket: 'believable',
    picture: 'cause-rain',
    emoji: '☔',
    word: jp('あめ！', 'Rain!'),
    sound: jp('ざあざあ', 'Pouring!'),
    keys: ['あめ'],
    gist: jp('あめだから、いえに いた！', 'It rained, so they stayed home!'),
    lines: {
      n5: {
        mission: 'Apologise, then blame the rain. Explain very politely why staying home made sense.',
        model: jp('すみません！ あめでしたから、いえで まって いました。', 'Sorry! It was raining, so I waited at home.'),
        frame: jp('すみません！ あめでした＿＿、いえで まって いました。', 'Sorry! It was raining, ＿＿ (so) I waited at home.'),
      },
      n4: {
        mission: 'Apologise, then blame the rain. Explain very politely why staying home made sense.',
        model: n4('雨が 降って いたので、止むまで 家で 待って いました。', 'あめが ふって いたので、やむまで いえで まって いました。', 'It was raining, so I waited at home until it stopped.'),
        chunk: { text: '降って いたので', keys: NODE, note: '〜ので: the polite “so”. It makes staying home sound perfectly reasonable.', tag: tag.node },
      },
    },
    pon: {
      flop: jp('あめ… ポンは きょう さんかい つかったポン。', 'Rain… I’ve used that three times today.'),
      good: jp('やむまで まつ！ あたまが いいポン！', 'Wait till it stops! Smart!'),
      ippon: jp('あしたは はれでも、あめって いうポン！', 'Tomorrow, even if it’s sunny, I’m saying rain!'),
    },
    check: { q: 'What did they do about the rain?', right: 'Waited at home until it stopped', wrong: ['Ran to work in it', 'Bought an umbrella'] },
    truth: jp('ほんとうは… あめを みてたポン。ずっと。', 'What really happened… they were watching the rain. All morning.'),
    status: 'draft',
  },
  {
    id: 'station',
    bucket: 'believable',
    picture: 'cause-station',
    emoji: '🚉',
    word: jp('えき！', 'The station!'),
    sound: jp('ぐるぐる', 'Round and round'),
    keys: ['えきが', 'えきの', 'えきで', 'えきは', 'えきに', 'えきを', 'えきも', 'えきから', 'でぐち'],
    gist: jp('えきの でぐちが わからない！', 'Couldn’t find the way out of the station!'),
    lines: {
      n5: {
        mission: 'Apologise, then blame the station. Say just how big it was.',
        model: jp('すみません！ えきが ひろくて、でぐちが わかりませんでした。', 'Sorry! The station was so big I couldn’t find the exit.'),
        frame: jp('すみません！ えきが ひろくて、でぐちが ＿＿。', 'Sorry! The station was so big I ＿＿ (couldn’t find) the exit.'),
      },
      n4: {
        mission: 'Apologise, then blame the station. Say just how big it was.',
        model: n4('駅が 広すぎて、出口が わかりませんでした。', 'えきが ひろすぎて、でぐちが わかりませんでした。', 'The station was so big I couldn’t find the exit.'),
        chunk: { text: '広すぎて', keys: SUGI, note: '〜すぎて: too much, so… Ninety-nine exits is too many exits.', tag: tag.sugite },
      },
    },
    pon: {
      flop: jp('えきは ひろい。ポンも まいにち でぐちが わからないポン。', 'Stations are big. I can’t find the exit every day.'),
      good: jp('でぐちが いっぱい！ しかたないポン！', 'So many exits! Fair enough!'),
      ippon: jp('ポン、あしたから えきに すむポン！', 'From tomorrow I’m living in the station!'),
    },
    check: { q: 'What was the problem?', right: 'They couldn’t find the exit', wrong: ['They missed the train', 'They lost their ticket'] },
    truth: jp('ほんとうは… まだ えきの なかだポン！', 'What really happened… they’re still inside the station!'),
    status: 'draft',
  },
  {
    id: 'granny',
    bucket: 'believable',
    picture: 'cause-granny',
    emoji: '👵',
    word: jp('おばあさん！', 'An old lady!'),
    sound: jp('よいしょ', 'Heave-ho'),
    keys: ['おばあさん', 'おばあちゃん'],
    gist: jp('おばあさんと やまへ！', 'Up a mountain with an old lady!'),
    lines: {
      n5: {
        mission: 'Apologise, then blame an old lady. Say you had no choice.',
        model: jp('すみません！ おばあさんの にもつを もちました。やまの うえまで！', 'Sorry! I carried an old lady’s bags. To the top of a mountain!'),
        frame: jp('すみません！ おばあさんの にもつを ＿＿。やまの うえまで！', 'Sorry! I ＿＿ (carried) an old lady’s bags. Up a mountain!'),
      },
      n4: {
        mission: 'Apologise, then blame an old lady. Say why, and that you had no choice.',
        model: n4('おばあさんが 道に 迷って いたので、山の 上まで 送らなければ なりませんでした。', 'おばあさんが みちに まよって いたので、やまの うえまで おくらなければ なりませんでした。', 'An old lady was lost, so I had to take her all the way up a mountain.'),
        chunk: { text: '送らなければ なりませんでした', keys: MUST, note: '〜なければ なりませんでした: you HAD to. A kind person has no choice.', tag: tag.must },
      },
    },
    pon: {
      flop: jp('おばあさん… まんがで よく みるポン。', 'An old lady… I see that one in manga a lot.'),
      good: jp('やさしいポン！ …ほんとう？', 'So kind! …Really?'),
      ippon: jp('ポンも あした おばあさんを さがすポン！', 'Tomorrow I’m finding an old lady too!'),
    },
    check: { q: 'Where did they take the old lady?', right: 'Up a mountain', wrong: ['To the shops', 'To the station'] },
    truth: jp('ほんとうは… おばあさんの ほうが はやかったポン！', 'What really happened… the old lady was faster!'),
    status: 'draft',
  },
  {
    id: 'crow',
    bucket: 'believable',
    picture: 'cause-crow',
    emoji: '🐦‍⬛',
    word: jp('カラス！', 'A crow!'),
    sound: jp('カーカー', 'Caw caw'),
    keys: ['からすが', 'からすに', 'からすの', 'からすは', 'からすも', 'からすを', 'かあかあ'],
    gist: jp('カラスが かぎを とった！', 'A crow took the keys!'),
    lines: {
      n5: {
        mission: 'Apologise, then blame a crow. Say what it did to you.',
        model: jp('すみません！ カラスが かぎを もって いきました！', 'Sorry! A crow flew off with my keys!'),
        frame: jp('すみません！ カラスが かぎを もって ＿＿！', 'Sorry! A crow took my keys and ＿＿ (went off)!'),
      },
      n4: {
        mission: 'Apologise, then blame a crow. Say what it did to you, and what you did about it.',
        model: n4('カラスに 家の 鍵を 取られたので、ずっと 追いかけて いました。', 'カラスに いえの かぎを とられたので、ずっと おいかけて いました。', 'A crow took my house keys, so I was chasing it the whole time.'),
        chunk: { text: '取られた', keys: ['とられ', 'いかれ'], note: 'カラスに とられました: it was done TO you. The passive is how victims talk.', tag: tag.passive },
      },
    },
    pon: {
      flop: jp('カラス… ポンも おべんとうを とられたポン。', 'The crow… it took my bento too.'),
      good: jp('カーカー！ わるい カラスだポン！', 'Caw caw! Bad crow!'),
      ippon: jp('あした ポンの かぎも カラスに あげるポン！', 'Tomorrow I’m giving my keys to the crow too!'),
    },
    check: { q: 'What did the crow take?', right: 'Their house keys', wrong: ['Their lunch', 'Their phone'] },
    truth: jp('ほんとうは… カラスと ともだちに なったポン。', 'What really happened… they made friends with the crow.'),
    status: 'draft',
  },
  {
    id: 'cat',
    bucket: 'selfown',
    sleep: true,
    picture: 'cause-cat',
    emoji: '🐈',
    word: jp('ねこ！', 'The cat!'),
    sound: jp('にゃー', 'Meow'),
    keys: ['ねこ'],
    gist: jp('ねこが ねてた！', 'The cat was asleep on them!'),
    lines: {
      n5: {
        mission: 'Apologise, then blame the cat. Politely explain why you couldn’t move.',
        model: jp('すみません！ ねこが ねて いました。わたしも ねました。', 'Sorry! The cat was asleep. So I slept too.'),
        frame: jp('すみません！ ねこが ねて いました。わたし＿＿ ねました。', 'Sorry! The cat was asleep. So I slept ＿＿ (too).'),
      },
      n4: {
        mission: 'Apologise, then blame the cat. Politely explain why you couldn’t move.',
        model: n4('猫が お腹の 上で 寝て いたので、起きられませんでした。', 'ねこが おなかの うえで ねて いたので、おきられませんでした。', 'The cat was asleep on my stomach, so I couldn’t get up.'),
        chunk: { text: '寝て いたので', keys: NODE, note: '〜ので: the polite “so”. Everyone knows you can’t move a sleeping cat.', tag: tag.node },
      },
    },
    pon: {
      flop: jp('ねこ… ポンも よく つかうポン。', 'The cat… I use that one a lot.'),
      good: jp('ねこが ねて いたら、うごけないポン！', 'If the cat’s asleep, you can’t move. Rules!'),
      ippon: jp('ポンも あした ねこを かうポン！', 'I’m getting a cat tomorrow!'),
    },
    check: { q: 'Why couldn’t they get up?', right: 'The cat was asleep on them', wrong: ['The cat was hungry', 'The cat hid their shoes'] },
    truth: jp('ほんとうは… ねこが めざましを とめたポン！', 'What really happened… the cat switched the alarm off!'),
    status: 'draft',
  },
  {
    id: 'breakfast',
    bucket: 'selfown',
    picture: 'cause-breakfast',
    emoji: '🍚',
    word: jp('あさごはん！', 'Breakfast!'),
    sound: jp('もぐもぐ', 'Munch munch'),
    keys: ['あさごはん', 'ごはん'],
    gist: jp('あさごはんを たくさん たべた！', 'Ate loads of breakfast!'),
    lines: {
      n5: {
        mission: 'Apologise, then blame breakfast. Say just how good it was.',
        model: jp('すみません！ あさごはんを みっつ たべました！', 'Sorry! I ate three breakfasts!'),
        frame: jp('すみません！ あさごはんを みっつ ＿＿！', 'Sorry! I ＿＿ (ate) three breakfasts!'),
      },
      n4: {
        mission: 'Apologise, then blame breakfast. Say just how good it was.',
        model: n4('朝ごはんが おいしすぎて、止まりませんでした。', 'あさごはんが おいしすぎて、とまりませんでした。', 'Breakfast was so good I couldn’t stop.'),
        chunk: { text: 'おいしすぎて', keys: SUGI, note: '〜すぎて: too much, so… Too delicious is a real problem.', tag: tag.sugite },
      },
    },
    pon: {
      flop: jp('あさごはん… ポンは よっつ たべたポン。', 'Breakfast… I had four.'),
      good: jp('そんなに おいしい！？ ポンも たべたいポン！', 'That good?! I want some!'),
      ippon: jp('あした ポンも その あさごはんを たべに いくポン！', 'Tomorrow I’m going to eat that breakfast too!'),
    },
    check: { q: 'What was wrong with breakfast?', right: 'It was too good to stop', wrong: ['It was burnt', 'There wasn’t any'] },
    truth: jp('ほんとうは… いま よっつめだポン！', 'What really happened… they’re on breakfast number four!'),
    status: 'draft',
  },
  {
    id: 'game',
    bucket: 'selfown',
    picture: 'cause-game',
    emoji: '🎮',
    word: jp('ゲーム！', 'Games!'),
    sound: jp('ピコピコ', 'Bleep bloop'),
    keys: ['げーむ'],
    gist: jp('あさまで ゲーム！', 'Games till morning!'),
    lines: {
      n5: {
        mission: 'Apologise, then blame a game. Confess what you forgot to do.',
        model: jp('すみません！ じかんを わすれて、あさまで ゲームを しました。', 'Sorry! I lost track of time and played games till morning.'),
        frame: jp('すみません！ じかんを ＿＿、あさまで ゲームを しました。', 'Sorry! I ＿＿ (forgot) the time and played games till morning.'),
      },
      n4: {
        mission: 'Apologise, then blame a game. Confess what you forgot to do.',
        model: n4('ゲームが 楽しすぎて、寝るのを 忘れて しまいました。', 'ゲームが たのしすぎて、ねるのを わすれて しまいました。', 'The game was so fun I forgot to sleep.'),
        chunk: { text: '忘れて しまいました', keys: SHIMAU, note: '〜て しまいました: oops, it happened. Forgetting to sleep counts.', tag: tag.shimau },
      },
    },
    pon: {
      flop: jp('ゲーム… ポンは ごじまで したポン。', 'Games… I played till five.'),
      good: jp('どの ゲーム？ …この ゲーム！？ うれしいポン！', 'Which game? …THIS game?! I’m touched!'),
      ippon: jp('それなら しかたない！ こんやも あそぶポン！', 'Well, that’s fair! Let’s play tonight too!'),
    },
    check: { q: 'What happened?', right: 'They played games all night', wrong: ['They forgot their bag', 'Their game broke'] },
    truth: jp('ほんとうは… この ゲームを してたポン！', 'What really happened… they were playing THIS game!'),
    status: 'draft',
  },
  {
    id: 'kotatsu',
    bucket: 'selfown',
    sleep: true,
    picture: 'cause-kotatsu',
    emoji: '🍊',
    word: jp('こたつ！', 'The kotatsu!'),
    sound: jp('ぬくぬく', 'Toasty'),
    keys: ['こたつ'],
    gist: jp('こたつから でない！', 'They won’t come out of the kotatsu!'),
    lines: {
      n5: {
        mission: 'Apologise, then blame the kotatsu. Say why you couldn’t get out.',
        model: jp('すみません！ こたつが あたたかいです。…いまも こたつの なかです。', 'Sorry! The kotatsu is warm. …I’m still in it.'),
        frame: jp('すみません！ こたつが あたたかいです。…いま＿＿ こたつの なかです。', 'Sorry! The kotatsu is warm. …I’m ＿＿ (still) in it.'),
      },
      n4: {
        mission: 'Apologise, then blame the kotatsu. Say why you couldn’t get out.',
        model: n4('こたつが 暖かすぎて、出られませんでした。', 'こたつが あたたかすぎて、でられませんでした。', 'The kotatsu was too warm; I couldn’t get out.'),
        chunk: { text: '暖かすぎて', keys: SUGI, note: '〜すぎて: too much, so… Nobody beats a kotatsu.', tag: tag.sugite },
      },
    },
    pon: {
      flop: jp('こたつ… ポンも ふゆは まいにち つかうポン。', 'Kotatsu… I use that every day in winter.'),
      good: jp('こたつは つよい！ だれも かてないポン！', 'The kotatsu is strong! Nobody beats it!'),
      ippon: jp('あした ポンは こたつから でんわするポン！', 'Tomorrow I’m phoning in from the kotatsu!'),
    },
    check: { q: 'Why couldn’t they get out?', right: 'The kotatsu was too warm', wrong: ['The door was locked', 'The cat was on them'] },
    truth: jp('ほんとうは… いまも こたつの なかだポン！', 'What really happened… they’re still in the kotatsu!'),
    status: 'draft',
  },
  {
    id: 'umbrella',
    bucket: 'yokai',
    picture: 'cause-umbrella',
    emoji: '☂️',
    word: jp('かさおばけ！', 'Umbrella ghost!'),
    sound: jp('ぴょんぴょん', 'Boing boing'),
    keys: ['かさ', 'おばけ'],
    gist: jp('かさが おばけに なった！', 'The umbrella turned into a ghost!'),
    lines: {
      n5: {
        mission: 'Apologise, then blame a yōkai umbrella. Say what it did, and sound sorry it happened.',
        model: jp('すみません！ かさが おばけに なりました。ぴょんぴょん！', 'Sorry! My umbrella turned into a ghost. Boing, boing!'),
        frame: jp('すみません！ かさが おばけに ＿＿。ぴょんぴょん！', 'Sorry! My umbrella ＿＿ (turned into) a ghost. Boing, boing!'),
      },
      n4: {
        mission: 'Apologise, then blame a yōkai umbrella. Say what it did, and sound sorry it happened.',
        model: n4('傘が お化けに なって、逃げて しまいました。', 'かさが おばけに なって、にげて しまいました。', 'My umbrella turned into a ghost and ran off.'),
        chunk: { text: '逃げて しまいました', keys: SHIMAU, note: '〜て しまいました: it got away, and you’re sorry. Umbrellas do that round here.', tag: tag.shimau },
      },
    },
    pon: {
      flop: jp('かさおばけ、きのうも スタジオに いたポン。', 'The umbrella ghost was in the studio yesterday too.'),
      good: jp('ぴょんぴょん！ はやいポン！', 'Boing boing! It’s quick!'),
      ippon: jp('ポンの かさも、あした おばけに するポン！', 'Tomorrow I’ll turn my umbrella into a ghost too!'),
    },
    check: { q: 'What did the umbrella do?', right: 'Turned into a ghost and ran off', wrong: ['Broke in the wind', 'Got left on the train'] },
    truth: jp('ほんとうは… かさおばけと かけっこしたポン！', 'What really happened… they raced the umbrella ghost!'),
    status: 'draft',
  },
  {
    id: 'kappa',
    bucket: 'yokai',
    picture: 'cause-kappa',
    emoji: '🥒',
    word: jp('かっぱ！', 'A kappa!'),
    sound: jp('みず！', 'Water!'),
    keys: ['かっぱ'],
    gist: jp('かっぱが みちを きいた！', 'A kappa asked the way!'),
    lines: {
      n5: {
        mission: 'Apologise, then blame a kappa. Say what it asked you.',
        model: jp('すみません！ かっぱが みちを ききました。かわまで いっしょに いきました。', 'Sorry! A kappa asked me the way. I went with it to the river.'),
        frame: jp('すみません！ かっぱが みちを ＿＿。かわまで いっしょに いきました。', 'Sorry! A kappa ＿＿ (asked) me the way. I went with it to the river.'),
      },
      n4: {
        mission: 'Apologise, then blame a kappa. Say what it asked you, and what you did next.',
        model: n4('かっぱに 川までの 道を 聞かれたので、いっしょに 行きました。', 'かっぱに かわまでの みちを きかれたので、いっしょに いきました。', 'A kappa asked me the way to the river, so I went with it.'),
        chunk: { text: '聞かれた', keys: ['きかれ'], note: 'かっぱに きかれました: it happened TO you. The kappa started it.', tag: tag.passive },
      },
    },
    pon: {
      flop: jp('かっぱは いつも みちを きくポン。', 'Kappas are always asking for directions.'),
      good: jp('きゅうりの おれいは もらったポン？', 'Did it give you a cucumber as thanks?'),
      ippon: jp('ポンも あした かっぱに ばけて、みちを きくポン！', 'Tomorrow I’ll disguise as a kappa and ask the way!'),
    },
    check: { q: 'What did the kappa want?', right: 'The way to the river', wrong: ['A cucumber', 'Their umbrella'] },
    truth: jp('ほんとうは… かっぱと すもうを したポン！', 'What really happened… they did sumo with a kappa!'),
    status: 'draft',
  },
  {
    id: 'fox',
    bucket: 'yokai',
    picture: 'cause-fox',
    emoji: '🦊',
    word: jp('きつね！', 'A fox!'),
    sound: jp('コンコン', 'Kon kon'),
    keys: ['きつね'],
    gist: jp('ぶちょうは きつねだった！', 'The “boss” was a fox!'),
    lines: {
      n5: {
        mission: 'Apologise, then blame a fox. Say what “the boss” told you.',
        model: jp('すみません！ ぶちょうが「やすみ」と いいました。…きつねでした。', 'Sorry! The boss said “day off”. …It was a fox.'),
        frame: jp('すみません！ ぶちょうが「やすみ」と ＿＿。…きつねでした。', 'Sorry! The boss ＿＿ (said) “day off”. …It was a fox.'),
      },
      n4: {
        mission: 'Apologise, then blame a fox. Say what “the boss” told you, and what you did about it.',
        model: n4('部長に「今日は 休みだよ」と 言われたので、家で のんびり して いました。…きつねでした。', 'ぶちょうに「きょうは やすみだよ」と いわれたので、いえで のんびり して いました。…きつねでした。', 'The boss told me “today’s a day off”, so I took it easy at home. …It was a fox.'),
        chunk: { text: '言われた', keys: ['いわれ'], note: 'ぶちょうに いわれました: you were TOLD. It’s not your fault the boss was a fox.', tag: tag.passive },
      },
    },
    pon: {
      flop: jp('きつねは うそつきだポン。ポンは うそを つかない… たぶん。', 'Foxes are liars. I never lie… probably.'),
      good: jp('きつね！？ ポンの ライバルだポン！', 'A fox?! My rival!'),
      ippon: jp('くやしい！ あした ポンも ぶちょうに ばけるポン！', 'So jealous! Tomorrow I’m disguising myself as the boss!'),
    },
    check: { q: 'What did “the boss” say?', right: 'That today was a day off', wrong: ['That the meeting moved', 'To bring a cake'] },
    truth: jp('ほんとうは… きつねと いなりずしを たべたポン！', 'What really happened… they ate inari sushi with the fox!'),
    status: 'draft',
  },
  {
    id: 'nobiko',
    bucket: 'yokai',
    picture: 'cause-nobiko',
    emoji: '🦒',
    word: jp('のびこさん！', 'Nobiko-san!'),
    sound: jp('にゅーっ', 'Stretch!'),
    keys: ['のびこ'],
    gist: jp('のびこさんの はなしが ながい！', 'Nobiko-san talked and talked!'),
    lines: {
      n5: {
        mission: 'Apologise, then blame Nobiko-san. Say how long she talked.',
        model: jp('すみません！ のびこさんと はなしました。にじかん！', 'Sorry! I talked with Nobiko-san. For two hours!'),
        frame: jp('すみません！ のびこさん＿＿ はなしました。にじかん！', 'Sorry! I talked ＿＿ (with) Nobiko-san. For two hours!'),
      },
      n4: {
        mission: 'Apologise, then blame Nobiko-san. Say how long she talked.',
        model: n4('のびこさんの 話が 長すぎて、逃げられませんでした。', 'のびこさんの はなしが ながすぎて、にげられませんでした。', 'Nobiko-san’s story was so long I couldn’t get away.'),
        chunk: { text: '長すぎて', keys: SUGI, note: '〜すぎて: too much, so… And her neck follows you round corners.', tag: tag.sugite },
      },
    },
    pon: {
      flop: jp('のびこさん、ポンとは さんじかんだったポン。', 'With me it was three hours.'),
      good: jp('くびが おいかけて くる！ にげられないポン！', 'The neck follows you! No escape!'),
      ippon: jp('あ… のびこさんの くびが きた！ にげるポン！', 'Uh oh… here comes Nobiko-san’s neck! Run!'),
    },
    check: { q: 'Why couldn’t they get away?', right: 'Nobiko-san talked too long', wrong: ['Nobiko-san was lost', 'Nobiko-san took their bag'] },
    truth: jp('ほんとうは… のびこさんの はなし、まだ おわらないポン。', 'What really happened… Nobiko-san still hasn’t finished.'),
    status: 'draft',
  },
  {
    id: 'date',
    bucket: 'selfown',
    audiences: ['cheeky'],
    avoidScenes: ['wedding', 'omiai'],
    picture: 'cause-date',
    emoji: '💕',
    word: jp('デート！', 'A date!'),
    sound: jp('ドキドキ', 'Ba-dum'),
    keys: ['でーと'],
    gist: jp('デートが ながかった！', 'The date went long!'),
    lines: {
      n5: {
        mission: 'Apologise, then blame last night’s date. Don’t say too much.',
        model: jp('すみません！ きのうの デートが… ながかったです。', 'Sorry! Last night’s date was… long.'),
        frame: jp('すみません！ きのうの デートが… ＿＿。', 'Sorry! Last night’s date was… ＿＿ (long).'),
      },
      n4: {
        mission: 'Apologise, then blame last night’s date. Don’t say too much.',
        model: n4('昨日の デートが 楽しすぎて… 朝に なって しまいました。', 'きのうの デートが たのしすぎて… あさに なって しまいました。', 'Last night’s date was so fun… it turned into morning.'),
        chunk: { text: 'なって しまいました', keys: SHIMAU, note: '〜て しまいました: it just happened. That’s all Pon will say.', tag: tag.shimau },
      },
    },
    pon: {
      flop: jp('デート… ポンは おくさんと じゅうねん ないポン。', 'A date… none with my wife in ten years.'),
      good: jp('くわしく！ …やっぱり いわないで！', 'Details! …No, don’t tell me!'),
      ippon: jp('いいなあ！ ポンも あした おくさんを デートに さそうポン！', 'Lucky you! Tomorrow I’m asking my wife on a date!'),
    },
    check: { q: 'What happened on the date?', right: 'It went on till morning', wrong: ['It was cancelled', 'They got lost'] },
    truth: jp('ほんとうは… デートの あいては たぬきだったポン。', 'What really happened… the date was a tanuki.'),
    status: 'draft',
  },
  {
    id: 'okozukai',
    bucket: 'believable',
    audiences: ['cheeky'],
    picture: 'cause-okozukai',
    emoji: '👛',
    word: jp('おこづかい！', 'Pocket money!'),
    sound: jp('とぼとぼ', 'Trudge trudge'),
    keys: ['おこづかい', 'おかね'],
    gist: jp('おかねが ない！ あるいた！', 'No money! They walked!'),
    lines: {
      n5: {
        mission: 'Apologise, then blame your empty wallet. Say what you had to do.',
        model: jp('すみません！ おかねが ありません。あるいて きました。', 'Sorry! I’ve got no money. I walked here.'),
        frame: jp('すみません！ おかねが ありません。あるいて ＿＿。', 'Sorry! I’ve got no money. I ＿＿ (came) here on foot.'),
      },
      n4: {
        mission: 'Apologise, then blame your empty wallet. Say what you had to do.',
        model: n4('お小遣いが なかったので、歩いて 来なければ なりませんでした。', 'おこづかいが なかったので、あるいて こなければ なりませんでした。', 'I had no pocket money left, so I had to walk here.'),
        chunk: { text: '来なければ なりませんでした', keys: MUST, note: '〜なければ なりませんでした: you HAD to. Twenty kilometres of had to.', tag: tag.must },
      },
    },
    pon: {
      flop: jp('おこづかい… ポンも ゼロえんだポン。', 'Pocket money… mine’s zero yen too.'),
      good: jp('あるいて！？ すごいポン！', 'You walked?! Impressive!'),
      ippon: jp('ポンも あした おこづかいを ゼロに する！ …もう ゼロだったポン。', 'Tomorrow I’m spending mine down to zero too! …It’s already zero.'),
    },
    check: { q: 'How did they get to work?', right: 'They walked', wrong: ['By taxi', 'By bike'] },
    truth: jp('ほんとうは… おこづかいで ガチャを したポン！', 'What really happened… they blew it all on gacha!'),
    status: 'draft',
  },
];

const BY_ID = new Map(CAUSES.map((c) => [c.id, c]));
export const causeOf = (id: string): Cause | undefined => BY_ID.get(id);
export const sceneOf = (id: string): LateScene | undefined => SCENES.find((s) => s.id === id);

const fits = (x: { audiences?: readonly Audience[] }, audience: Audience): boolean => !x.audiences || x.audiences.includes(audience);
export const causesFor = (audience: Audience): Cause[] => CAUSES.filter((c) => fits(c, audience));
export const scenesFor = (audience: Audience): LateScene[] => SCENES.filter((s) => fits(s, audience));

/**
 * The line a latecomer at `level` works from: N5 for Kana (shown on a mic pass), the highest written one at or
 * below the level. In the finale (a year late), the N4 model opens たいへん もうしわけ ありません instead.
 */
export function lineFor(cause: Cause, level: Level, opts: { finale?: boolean } = {}): CauseLine {
  const line = n4Up(level) && cause.lines.n4 ? cause.lines.n4 : (cause.lines.n5 ?? cause.lines.n4!);
  if (!opts.finale || !line.model.text.startsWith(N4_SORRY.text)) return line;
  const m = line.model;
  return {
    ...line,
    model: {
      text: FINALE_SORRY.text + m.text.slice(N4_SORRY.text.length),
      kana: FINALE_SORRY.kana + m.kana.slice(N4_SORRY.kana.length),
      en: FINALE_SORRY.en + m.en.slice(N4_SORRY.en.length),
    },
  };
}

/** The cause's tile word without its "！", for slots (ほんとうは… ねこだったポン！). */
export const bareWord = (c: Cause): JpText => ({ text: c.word.text.replace(/！$/, ''), kana: c.word.kana.replace(/！$/, ''), en: c.word.en.replace(/!$/, '') });

/** The Kana excuse: the apology tile, the cause's tile and its sound. Read out by Pon on a Kana mic pass. */
export const kanaLine = (cause: Cause): JpText => ({
  text: `${SORRY_TILE.word.text} ${cause.word.text} ${cause.sound.text}`,
  kana: `${SORRY_TILE.word.kana} ${cause.word.kana} ${cause.sound.kana}`,
  en: `${SORRY_TILE.word.en} ${cause.word.en} ${cause.sound.en}`,
});

/** Pon's line when a cause is blamed a second time in a game. */
export const callbackLine = (c: Cause): JpText => {
  const w = bareWord(c);
  return { text: `また ${w.text}！？ この かいしゃ、だいじょうぶポン？`, kana: `また ${w.kana}！？ この かいしゃ、だいじょうぶポン？`, en: `${w.en} again?! Is this company OK?` };
};

/** Pon's own confession: the real story was him (1 in 12, and after a tanuki curveball). */
export const PON_TRUTH: JpText = jp('ほんとうは… ポンだったポン。', 'What really happened… it was me.');
/** The last round's real story closes the premise: the boss who was late too was Pon all along. */
export const FINALE_TRUTH: JpText = jp('ほんとうは… ぶちょうは ポンだったポン！ ドロン！', 'What really happened… the boss was me all along! Poof!');

/** The round's last beat: what really happened. The finale's is always Pon the boss; null is Pon himself; otherwise the cause's own line. */
export function truthLine(c: Cause | null, opts?: { finale?: boolean }): JpText {
  if (opts?.finale) return FINALE_TRUTH;
  return c ? c.truth : PON_TRUTH;
}

/** Chance the real story is Pon himself. */
export const PON_TRUTH_CHANCE = 1 / 12;

/**
 * Picks the real story from the causes not dealt this round, two to one towards a self-own; null is Pon.
 * Never one in `used` (this game's earlier truths, say), so a stinger doesn't repeat: Pon when none is left.
 */
export function truthFor(random: () => number, dealt: readonly string[], audience: Audience, used: ReadonlySet<string> = new Set()): string | null {
  if (random() < PON_TRUTH_CHANCE) return null;
  const pool = causesFor(audience).filter((c) => !dealt.includes(c.id) && !used.has(c.id));
  const weighted = pool.flatMap((c) => (c.bucket === 'selfown' ? [c, c] : [c]));
  return weighted.length ? weighted[Math.floor(random() * weighted.length)]!.id : null;
}

/**
 * The witness's three options: one believable cause, one self-own and one yōkai, shuffled. At most one sleep
 * joke in a deal. `avoid` (the last rounds' causes) is skipped while its bucket has others left. A cause that
 * avoids the round's scene (`sceneId`) is never dealt in it.
 */
export function dealOptions(random: () => number, avoid: ReadonlySet<string> = new Set(), audience: Audience = 'family', sceneId?: string): [string, string, string] {
  const pick = (pool: Cause[]): Cause => pool[Math.floor(random() * pool.length)]!;
  const out: Cause[] = [];
  const allowed = causesFor(audience).filter((c) => !(sceneId && c.avoidScenes?.includes(sceneId)));
  for (const bucket of ['believable', 'selfown', 'yokai'] as const) {
    const all = allowed.filter((c) => c.bucket === bucket);
    const sleepy = out.some((c) => c.sleep);
    const ok = all.filter((c) => !(sleepy && c.sleep));
    const fresh = ok.filter((c) => !avoid.has(c.id));
    out.push(pick(fresh.length ? fresh : ok.length ? ok : all));
  }
  const ids = out.map((c) => c.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
  }
  return ids as [string, string, string];
}
