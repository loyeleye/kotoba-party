// Late Again!'s content: the scenes (what the latecomer is late for), the causes the excuse can blame,
// Pon's reaction to each, and the round's last beat, "the real story". Every line is draft until a fluent
// check. See docs/modes/late-again.md. The deck, the lines and Pon's reactions follow the humor seat's
// pass (storyboards/reviews/humor-late-again-content.md, 1 Nov 2026).
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
  /** N5 only: a fill-in sentence frame (＿＿ marks the gap), the first step behind "Need a hint?". */
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
  /** stage/assets/late/<picture>.png */
  picture: string;
  /** The picture, as an emoji, for places that can't show art (bots, logs, alt text). */
  emoji: string;
  /** The Kana tile: one word. */
  word: JpText;
  /** The Kana latecomer's third tile: the cause's sound or punch (ぐうぐう, にゃー). */
  sound: JpText;
  /** Kana that show the cause was named in the excuse (any one). */
  keys: string[];
  /** The gist every phone gets at the gist beat: a short kana line, with English. */
  gist: JpText;
  /** N5 and N4 lines (N3 joins at step 6). */
  lines: Partial<Record<Exclude<Level, 'kana'>, CauseLine>>;
  /** Pon's reaction at the ruling, by how the leaves went: flop "I've used that one", good "taking notes", IPPON "I'm using it tomorrow". */
  pon: { flop: JpText; good: JpText; ippon: JpText };
  /** The N4+ gallery's listening check: one question, the right answer and two near misses. */
  check: { q: string; right: string; wrong: [string, string] };
  status: 'draft' | 'fluent-checked';
}

/** The Kana latecomer's apology tile, and the witness's curveball (once a game each). */
export const SORRY_TILE = { id: 'sorry', word: jp('すみません！', 'Sorry!'), keys: ['すみません', 'ごめん', 'もうしわけ'] };
export const TANUKI_TILE = { id: 'tanuki', word: jp('たぬき！', 'A tanuki!'), keys: ['たぬき'], picture: 'curve-tanuki', emoji: '🍃' };
/** The Kana latecomer's sound tile: it takes the sound of whichever cause they tapped. */
export const SOUND_TILE_ID = 'sound';

export const SCENES: readonly LateScene[] = [
  { id: 'meeting', place: { text: '朝の 会議', kana: 'あさの かいぎ', en: 'the morning meeting' }, emoji: '📋', opener: jp('みんな まってるポン！ …ポンも まだ パジャマだポン。', 'Everyone’s waiting! …I’m still in my pyjamas too.') },
  { id: 'recording', place: { text: '収録', kana: 'しゅうろく', en: 'tonight’s recording' }, emoji: '🎬', opener: jp('ほんばん ごふんまえ！ ゲストが いないポン！', 'Five minutes to air! The guest is missing!') },
  { id: 'trip', place: { text: '社員旅行', kana: 'しゃいんりょこう', en: 'the company trip bus' }, emoji: '🚌', opener: jp('バスが いっちゃったポン！ バイバーイ！', 'The bus has gone! Bye-bye!') },
  { id: 'cake', place: { text: '部長の 誕生日', kana: 'ぶちょうの たんじょうび', en: 'the boss’s surprise party (you’ve got the cake)' }, emoji: '🎂', opener: jp('ケーキは… きみが もってるポン！？', 'The cake is… with YOU?!') },
  { id: 'photo', place: { text: '写真', kana: 'しゃしん', en: 'the company photo' }, emoji: '📸', opener: jp('まるの なかに はいるポン？', 'Going in the little circle, then?') },
  { id: 'firstday', place: { text: 'はじめての 仕事', kana: 'はじめての しごと', en: 'your first day' }, emoji: '🎉', opener: jp('いちにちめから！？', 'From day one?!') },
  { id: 'client', place: { text: '大きい お客さん', kana: 'おおきい おきゃくさん', en: 'the big client' }, emoji: '🤝', opener: jp('おきゃくさんが まどから みてるポン…', 'The client is looking in through the window…') },
  { id: 'sports', place: { text: '運動会', kana: 'うんどうかい', en: 'company sports day (you’re the anchor)' }, emoji: '🏃', opener: jp('アンカーが いないポン！', 'The anchor’s missing!') },
  { id: 'omiai', place: { text: 'お見合い', kana: 'おみあい', en: 'the omiai Nobiko-san arranged' }, emoji: '💐', opener: jp('のびこさんの くびが さがしに きたポン！', 'Nobiko-san’s neck has come looking for you!'), audiences: ['family', 'cheeky'] },
  { id: 'wedding', place: { text: '自分の 結婚式', kana: 'じぶんの けっこんしき', en: 'your own wedding (the boss is giving the speech)' }, emoji: '💒', opener: jp('じぶんの けっこんしき だポン！？', 'Your OWN wedding?!'), audiences: ['family', 'cheeky'], finale: true },
];

/** How late, climbing each round from five minutes to a year; the last round is always a year. It drills ふん／ぷん and the counters. */
export const LATENESS: readonly JpText[] = [
  jp('ごふん', '5 minutes'),
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
export function latenessFor(round: number, total: number): JpText {
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
const SHIMAU = ['しまい', 'ちゃい', 'ちゃっ', 'じゃい', 'じゃっ'];
const SUGI = ['すぎ'];
const NODE = ['ので'];
const MUST = ['なければ', 'なきゃ', 'なくちゃ'];

/** N4 apologises for the delay itself (おくれて すみません). */
const n4 = (kanji: string, kana: string, en: string): JpText => ({ text: `遅れて すみません。${kanji}`, kana: `おくれて すみません。${kana}`, en: `Sorry I’m late. ${en}` });

export const CAUSES: readonly Cause[] = [
  {
    id: 'oversleep',
    bucket: 'selfown',
    sleep: true,
    picture: 'cause-oversleep',
    emoji: '⏰',
    word: jp('ねぼう！', 'Overslept!'),
    sound: jp('ぐうぐう', 'Zzz'),
    keys: ['ねぼう', 'とけい', 'めざまし', 'ねすぎ'],
    gist: jp('とけいが ねぼうした！', 'The clock overslept!'),
    lines: {
      n5: {
        mission: 'Apologise, then blame your alarm clock. Sound sorry about what it did.',
        model: jp('すみません！ とけいが ねて いました。', 'Sorry! My clock was asleep.'),
        frame: jp('すみません！ ＿＿が ねて いました。', 'Sorry! My ＿＿ was asleep.'),
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
        frame: jp('すみません！ ＿＿で ねて、うみまで いきました。', 'Sorry! I fell asleep on the ＿＿ and went to the sea.'),
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
    status: 'draft',
  },
  {
    id: 'rain',
    bucket: 'believable',
    picture: 'cause-rain',
    emoji: '☔',
    word: jp('あめ！', 'Rain!'),
    sound: jp('ざあざあ', 'Pitter-patter'),
    keys: ['あめ'],
    gist: jp('あめだから、いえに いた！', 'It rained, so they stayed home!'),
    lines: {
      n5: {
        mission: 'Apologise, then blame the rain. Explain very politely why staying home made sense.',
        model: jp('すみません！ あめでしたから、いえで まって いました。', 'Sorry! It was raining, so I waited at home.'),
        frame: jp('すみません！ ＿＿でしたから、いえで まって いました。', 'Sorry! It was ＿＿, so I waited at home.'),
      },
      n4: {
        mission: 'Apologise, then blame the rain. Explain very politely why staying home made sense.',
        model: n4('雨が 降って いたので、止むまで 家で 待って いました。', 'あめが ふって いたので、やむまで いえで まって いました。', 'It was raining, so I waited at home until it stopped.'),
        chunk: { text: '降って いたので', keys: NODE, note: '〜ので: the polite “so”. It makes staying home sound perfectly reasonable.', tag: tag.node },
      },
    },
    pon: {
      flop: jp('あめ… ポンは きょう さんかい つかったポン。', 'Rain… I’ve used that three times today.'),
      good: jp('やむまで まつ！ かしこいポン！', 'Wait till it stops! Smart!'),
      ippon: jp('あしたは はれでも、あめって いうポン！', 'Tomorrow, even if it’s sunny, I’m saying rain!'),
    },
    check: { q: 'What did they do about the rain?', right: 'Waited at home until it stopped', wrong: ['Ran to work in it', 'Bought an umbrella'] },
    status: 'draft',
  },
  {
    id: 'station',
    bucket: 'believable',
    picture: 'cause-station',
    emoji: '🚉',
    word: jp('えき！', 'The station!'),
    sound: jp('ぐるぐる', 'Round and round'),
    keys: ['えき', 'でぐち'],
    gist: jp('えきの でぐちが ない！', 'No way out of the station!'),
    lines: {
      n5: {
        mission: 'Apologise, then blame the station. Say just how big it was.',
        model: jp('すみません！ えきの でぐちが わかりませんでした。', 'Sorry! I couldn’t find the station exit.'),
        frame: jp('すみません！ ＿＿の でぐちが わかりませんでした。', 'Sorry! I couldn’t find the ＿＿ exit.'),
      },
      n4: {
        mission: 'Apologise, then blame the station. Say just how big it was.',
        model: n4('駅が 広すぎて、出口が わかりませんでした。', 'えきが ひろすぎて、でぐちが わかりませんでした。', 'The station was so big I couldn’t find the exit.'),
        chunk: { text: '広すぎて', keys: SUGI, note: '〜すぎて: too much, so… Ninety-nine exits is too many exits.', tag: tag.sugite },
      },
    },
    pon: {
      flop: jp('えきは ひろいポン。ポンも まいにち まいごだポン。', 'Stations are big. I’m lost every day.'),
      good: jp('でぐちが ひゃく！？ しかたないポン！', 'A hundred exits?! Fair enough!'),
      ippon: jp('ポン、あしたから えきに すむポン！', 'From tomorrow I’m living in the station!'),
    },
    check: { q: 'What was the problem?', right: 'They couldn’t find the exit', wrong: ['They missed the train', 'The station was closed'] },
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
        frame: jp('すみません！ ＿＿の にもつを もちました。やまの うえまで！', 'Sorry! I carried a ＿＿’s bags. Up a mountain!'),
      },
      n4: {
        mission: 'Apologise, then blame an old lady. Say you had no choice.',
        model: n4('おばあさんを 山の 上まで 送らなければ なりませんでした。', 'おばあさんを やまの うえまで おくらなければ なりませんでした。', 'I had to take an old lady all the way up a mountain.'),
        chunk: { text: '送らなければ なりませんでした', keys: MUST, note: '〜なければ なりませんでした: you HAD to. A kind person has no choice.', tag: tag.must },
      },
    },
    pon: {
      flop: jp('おばあさん… まんがで よく みるポン。', 'An old lady… I see that one in manga a lot.'),
      good: jp('やさしいポン！ …ほんとう？', 'So kind! …Really?'),
      ippon: jp('ポンも あした おばあさんを さがすポン！', 'Tomorrow I’m finding an old lady too!'),
    },
    check: { q: 'Where did they take the old lady?', right: 'Up a mountain', wrong: ['To the hospital', 'To the station'] },
    status: 'draft',
  },
  {
    id: 'crow',
    bucket: 'believable',
    picture: 'cause-crow',
    emoji: '🐦‍⬛',
    word: jp('カラス！', 'A crow!'),
    sound: jp('カーカー', 'Caw caw'),
    keys: ['からす'],
    gist: jp('カラスが かぎを とった！', 'A crow took the keys!'),
    lines: {
      n5: {
        mission: 'Apologise, then blame a crow. Say what it did to you.',
        model: jp('すみません！ カラスが かぎを もって いきました！', 'Sorry! A crow flew off with my keys!'),
        frame: jp('すみません！ ＿＿が かぎを もって いきました！', 'Sorry! A ＿＿ flew off with my keys!'),
      },
      n4: {
        mission: 'Apologise, then blame a crow. Say what it did to you.',
        model: n4('カラスに 家の 鍵を 取られました。', 'カラスに いえの かぎを とられました。', 'A crow took my house keys.'),
        chunk: { text: '取られました', keys: ['とられ'], note: 'カラスに とられました: it was done TO you. The passive is how victims talk.', tag: tag.passive },
      },
    },
    pon: {
      flop: jp('カラス… ポンの おべんとうも とったポン。', 'That crow took my bento too.'),
      good: jp('カーカー！ わるい カラスだポン！', 'Caw caw! Bad crow!'),
      ippon: jp('あした ポンの かぎも カラスに あげるポン！', 'Tomorrow I’m giving my keys to the crow too!'),
    },
    check: { q: 'What did the crow take?', right: 'Their house keys', wrong: ['Their lunch', 'Their phone'] },
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
        frame: jp('すみません！ ＿＿が ねて いました。わたしも ねました。', 'Sorry! The ＿＿ was asleep. So I slept too.'),
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
    check: { q: 'Why couldn’t they get up?', right: 'The cat was asleep on them', wrong: ['The cat was ill', 'The cat hid their shoes'] },
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
    gist: jp('あさごはん みっつ！', 'Three breakfasts!'),
    lines: {
      n5: {
        mission: 'Apologise, then blame breakfast. Say just how good it was.',
        model: jp('すみません！ あさごはんを みっつ たべました！', 'Sorry! I ate three breakfasts!'),
        frame: jp('すみません！ ＿＿を みっつ たべました！', 'Sorry! I ate three ＿＿s!'),
      },
      n4: {
        mission: 'Apologise, then blame breakfast. Say just how good it was.',
        model: n4('朝ごはんが おいしすぎて、止まりませんでした。', 'あさごはんが おいしすぎて、とまりませんでした。', 'Breakfast was so good I couldn’t stop.'),
        chunk: { text: 'おいしすぎて', keys: SUGI, note: '〜すぎて: too much, so… Too delicious is a real problem.', tag: tag.sugite },
      },
    },
    pon: {
      flop: jp('あさごはん… ポンは よっつ たべたポン。', 'Breakfast… I had four.'),
      good: jp('みっつ！？ ポンより たべるポン！', 'Three?! You eat more than me!'),
      ippon: jp('あした ポンも その あさごはんに いくポン！', 'I’m coming to that breakfast tomorrow!'),
    },
    check: { q: 'What was wrong with breakfast?', right: 'It was too good to stop', wrong: ['It was burnt', 'There wasn’t any'] },
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
        model: jp('すみません！ あさの よじまで ゲームを しました。', 'Sorry! I played games until four in the morning.'),
        frame: jp('すみません！ あさの よじまで ＿＿を しました。', 'Sorry! I played ＿＿ until four in the morning.'),
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
      ippon: jp('それなら しかたないポン！ こんやも あそぶポン！', 'Well, that’s fair! Let’s play tonight too!'),
    },
    check: { q: 'What did they forget?', right: 'To sleep', wrong: ['Their bag', 'To eat breakfast'] },
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
        frame: jp('すみません！ ＿＿が あたたかいです。…いまも ＿＿の なかです。', 'Sorry! The ＿＿ is warm. …I’m still in it.'),
      },
      n4: {
        mission: 'Apologise, then blame the kotatsu. Say why you couldn’t get out.',
        model: n4('こたつが 暖かすぎて、出られませんでした。', 'こたつが あたたかすぎて、でられませんでした。', 'The kotatsu was too warm; I couldn’t get out.'),
        chunk: { text: '暖かすぎて', keys: SUGI, note: '〜すぎて: too much, so… Nobody beats a kotatsu.', tag: tag.sugite },
      },
    },
    pon: {
      flop: jp('こたつ… ポンも ふゆは まいにち つかうポン。', 'Kotatsu… I use that every day in winter.'),
      good: jp('こたつは つよいポン！ だれも かてないポン！', 'The kotatsu is strong! Nobody beats it!'),
      ippon: jp('あした ポンは こたつから でんわするポン！', 'Tomorrow I’m phoning in from the kotatsu!'),
    },
    check: { q: 'Why couldn’t they get out?', right: 'The kotatsu was too warm', wrong: ['The door was locked', 'The cat was on them'] },
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
    gist: jp('かさが にげた！', 'The umbrella ran off!'),
    lines: {
      n5: {
        mission: 'Apologise, then blame a yōkai umbrella. Say what it did, and sound sorry it happened.',
        model: jp('すみません！ かさが おばけに なりました。ぴょん ぴょん！', 'Sorry! My umbrella turned into a ghost. Boing, boing!'),
        frame: jp('すみません！ ＿＿が おばけに なりました。ぴょん ぴょん！', 'Sorry! My ＿＿ turned into a ghost. Boing, boing!'),
      },
      n4: {
        mission: 'Apologise, then blame a yōkai umbrella. Say what it did, and sound sorry it happened.',
        model: n4('傘が お化けに なって、逃げて しまいました。', 'かさが おばけに なって、にげて しまいました。', 'My umbrella turned into a ghost and ran off.'),
        chunk: { text: '逃げて しまいました', keys: SHIMAU, note: '〜て しまいました: it got away, and you’re sorry. Umbrellas do that round here.', tag: tag.shimau },
      },
    },
    pon: {
      flop: jp('かさおばけ、きのうも スタジオに いたポン。', 'The umbrella ghost was in the studio yesterday too.'),
      good: jp('ぴょん ぴょん！ はやいポン！', 'Boing boing! It’s quick!'),
      ippon: jp('ポンの かさも、あした おばけに するポン！', 'Tomorrow I’ll turn my umbrella into a ghost too!'),
    },
    check: { q: 'What did the umbrella do?', right: 'Turned into a ghost and ran off', wrong: ['Broke in the wind', 'Got left on the train'] },
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
    gist: jp('かっぱと かわへ！', 'Off to the river with a kappa!'),
    lines: {
      n5: {
        mission: 'Apologise, then blame a kappa. Say what it asked you.',
        model: jp('すみません！ かっぱが みちを ききました。かわまで いっしょに いきました。', 'Sorry! A kappa asked me the way. I went with it to the river.'),
        frame: jp('すみません！ ＿＿が みちを ききました。かわまで いっしょに いきました。', 'Sorry! A ＿＿ asked me the way. I went with it to the river.'),
      },
      n4: {
        mission: 'Apologise, then blame a kappa. Say what it asked you.',
        model: n4('かっぱに 川への 道を 聞かれました。', 'かっぱに かわへの みちを きかれました。', 'A kappa asked me the way to the river.'),
        chunk: { text: '聞かれました', keys: ['きかれ'], note: 'かっぱに きかれました: it happened TO you. The kappa started it.', tag: tag.passive },
      },
    },
    pon: {
      flop: jp('かっぱは いつも みちを きくポン。', 'Kappas are always asking for directions.'),
      good: jp('きゅうりの おれいは もらったポン？', 'Did it give you a cucumber as thanks?'),
      ippon: jp('ポンも あした かっぱに ばけて、みちを きくポン！', 'Tomorrow I’ll disguise as a kappa and ask the way!'),
    },
    check: { q: 'What did the kappa want?', right: 'The way to the river', wrong: ['A cucumber', 'Their umbrella'] },
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
        frame: jp('すみません！ ぶちょうが「やすみ」と いいました。…＿＿でした。', 'Sorry! The boss said “day off”. …It was a ＿＿.'),
      },
      n4: {
        mission: 'Apologise, then blame a fox. Say what “the boss” told you.',
        model: n4('部長に「今日は 休みだよ」と 言われました。…きつねでした。', 'ぶちょうに「きょうは やすみだよ」と いわれました。…きつねでした。', 'The boss told me “today’s a day off”. …It was a fox.'),
        chunk: { text: '言われました', keys: ['いわれ'], note: 'ぶちょうに いわれました: you were TOLD. It’s not your fault the boss was a fox.', tag: tag.passive },
      },
    },
    pon: {
      flop: jp('きつねは うそつきだポン。ポンは しょうじき… たぶん。', 'Foxes are liars. I’m honest… probably.'),
      good: jp('きつね！？ ポンの ライバルだポン！', 'A fox?! My rival!'),
      ippon: jp('くやしい！ あした ポンも ぶちょうに ばけるポン！', 'So jealous! Tomorrow I’m disguising myself as the boss!'),
    },
    check: { q: 'What did “the boss” say?', right: 'That today was a day off', wrong: ['That the meeting moved', 'To bring a cake'] },
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
    gist: jp('のびこさんと にじかん！', 'Two hours with Nobiko-san!'),
    lines: {
      n5: {
        mission: 'Apologise, then blame Nobiko-san. Say how long she talked.',
        model: jp('すみません！ のびこさんと はなしました。にじかん！', 'Sorry! I talked with Nobiko-san. For two hours!'),
        frame: jp('すみません！ ＿＿と はなしました。にじかん！', 'Sorry! I talked with ＿＿. For two hours!'),
      },
      n4: {
        mission: 'Apologise, then blame Nobiko-san. Say how long she talked.',
        model: n4('のびこさんの 話が 長すぎて、逃げられませんでした。', 'のびこさんの はなしが ながすぎて、にげられませんでした。', 'Nobiko-san’s story was so long I couldn’t get away.'),
        chunk: { text: '長すぎて', keys: SUGI, note: '〜すぎて: too much, so… And her neck follows you round corners.', tag: tag.sugite },
      },
    },
    pon: {
      flop: jp('のびこさん、ポンとは さんじかん だったポン。', 'With me it was three hours.'),
      good: jp('くびが おいかけて くるポン！ にげられないポン！', 'The neck follows you! No escape!'),
      ippon: jp('あ… のびこさんの くびが きたポン！ にげるポン！', 'Uh oh… here comes Nobiko-san’s neck! Run!'),
    },
    check: { q: 'Why couldn’t they get away?', right: 'Nobiko-san talked too long', wrong: ['Nobiko-san was lost', 'Nobiko-san took their bag'] },
    status: 'draft',
  },
  {
    id: 'date',
    bucket: 'selfown',
    audiences: ['cheeky'],
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
        frame: jp('すみません！ きのうの ＿＿が… ながかったです。', 'Sorry! Last night’s ＿＿ was… long.'),
      },
      n4: {
        mission: 'Apologise, then blame last night’s date. Don’t say too much.',
        model: n4('昨日の デートが 楽しすぎて… 朝に なって しまいました。', 'きのうの デートが たのしすぎて… あさに なって しまいました。', 'Last night’s date was so fun… it turned into morning.'),
        chunk: { text: 'なって しまいました', keys: SHIMAU, note: '〜て しまいました: it just happened. That’s all Pon will say.', tag: tag.shimau },
      },
    },
    pon: {
      flop: jp('デート… ポンは まだ ないポン。', 'A date… I’ve never had one.'),
      good: jp('くわしく！ …やっぱり いわないで！', 'Details! …No, don’t tell me!'),
      ippon: jp('うらやましい！ ポンも あした デート… あいてが いないポン。', 'So jealous! I’ll have a date tomorrow… oh, nobody.'),
    },
    check: { q: 'What happened on the date?', right: 'It went on till morning', wrong: ['It was cancelled', 'They got lost'] },
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
        frame: jp('すみません！ ＿＿が ありません。あるいて きました。', 'Sorry! I’ve got no ＿＿. I walked here.'),
      },
      n4: {
        mission: 'Apologise, then blame your empty wallet. Say what you had to do.',
        model: n4('お小遣いが なかったので、歩いて 来なければ なりませんでした。', 'おこづかいが なかったので、あるいて こなければ なりませんでした。', 'I had no pocket money left, so I had to walk here.'),
        chunk: { text: '来なければ なりませんでした', keys: MUST, note: '〜なければ なりませんでした: you HAD to. Twenty kilometres of had to.', tag: tag.must },
      },
    },
    pon: {
      flop: jp('おこづかい… ポンも ゼロえんだポン。', 'Pocket money… mine’s zero yen too.'),
      good: jp('あるいて！？ えらいポン！', 'You walked?! Impressive!'),
      ippon: jp('ポンの おくさんに みせるポン！ …やっぱり みせないポン。', 'I’ll show this to my wife! …On second thoughts, no.'),
    },
    check: { q: 'How did they get to work?', right: 'They walked', wrong: ['By taxi', 'By bike'] },
    status: 'draft',
  },
];

const BY_ID = new Map(CAUSES.map((c) => [c.id, c]));
export const causeOf = (id: string): Cause | undefined => BY_ID.get(id);
export const sceneOf = (id: string): LateScene | undefined => SCENES.find((s) => s.id === id);

const fits = (x: { audiences?: readonly Audience[] }, audience: Audience): boolean => !x.audiences || x.audiences.includes(audience);
export const causesFor = (audience: Audience): Cause[] => CAUSES.filter((c) => fits(c, audience));
export const scenesFor = (audience: Audience): LateScene[] => SCENES.filter((s) => fits(s, audience));

/** The line a latecomer at `level` works from: N5 for Kana (shown on a mic pass), the highest written one at or below the level. */
export function lineFor(cause: Cause, level: Level): CauseLine {
  if (level === 'n4' && cause.lines.n4) return cause.lines.n4;
  return cause.lines.n5 ?? cause.lines.n4!;
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

/** The round's last beat: what really happened. A cause nobody was dealt, or (rarely) Pon himself. */
export const truthLine = (c: Cause | null): JpText => {
  if (!c) return jp('ほんとうは… ポンだったポン。', 'What really happened… it was me.');
  const w = bareWord(c);
  return { text: `ほんとうは… ${w.text}だったポン！`, kana: `ほんとうは… ${w.kana}だったポン！`, en: `What really happened… ${w.en}!` };
};

/** Chance the real story is Pon himself. */
export const PON_TRUTH_CHANCE = 1 / 12;

/** Picks the real story from the causes not dealt this round, two to one towards a self-own; null is Pon. */
export function truthFor(random: () => number, dealt: readonly string[], audience: Audience): string | null {
  if (random() < PON_TRUTH_CHANCE) return null;
  const pool = causesFor(audience).filter((c) => !dealt.includes(c.id));
  const weighted = pool.flatMap((c) => (c.bucket === 'selfown' ? [c, c] : [c]));
  return weighted.length ? weighted[Math.floor(random() * weighted.length)]!.id : null;
}

/**
 * The witness's three options: one believable cause, one self-own and one yōkai, shuffled. At most one sleep
 * joke in a deal. `avoid` (the last rounds' causes) is skipped while its bucket has others left.
 */
export function dealOptions(random: () => number, avoid: ReadonlySet<string> = new Set(), audience: Audience = 'family'): [string, string, string] {
  const pick = (pool: Cause[]): Cause => pool[Math.floor(random() * pool.length)]!;
  const out: Cause[] = [];
  for (const bucket of ['believable', 'selfown', 'yokai'] as const) {
    const all = causesFor(audience).filter((c) => c.bucket === bucket);
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
