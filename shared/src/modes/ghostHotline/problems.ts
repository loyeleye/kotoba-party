// Ghost Advice Hotline's content: the yōkai who phone Nobiko-san's late-night advice line, their problems,
// the secret of what would really help, and the advice tiles. Every line is draft until a fluent check.
// See docs/modes/ghost-hotline.md and the storyboards (learning-path/storyboards/v2/ghost-hotline.html).
//
// A call: the caller says the problem at their level. Only the caller sees the secret ("the kappa's dish is
// dry: water on it"). Advisers give advice; the caller answers ちがう！ / おしい！ / それだ！. Kana advisers pick
// one of four tiles: the cure, the near miss, a decoy and the curveball, so the cure's picture is always
// one of their tiles and reading the gist is how they find it. The gallery bets on the cure from four
// pictures (the cure, the near miss and two decoys).
//
// Never: illness, injury, death, mental health, family emergencies, body or weight jokes, drinking. The
// problems are yōkai nuisances (a dry dish, a lantern that's lost its flame, a tanuki who can't change back).

import type { ByLevel, JpText, Level } from '../../../../content/src/types.js';
import type { Audience } from '../../protocol.js';

/** One piece of advice: a Kana adviser's tile, a gallery bet picture, and what the recogniser listens for. */
export interface AdviceTile {
  id: string;
  /** The tile: short imperative advice in kana (みずを かけて！). */
  word: JpText;
  /** stage/assets/hotline/<picture>.png */
  picture: string;
  /** The picture as an emoji, for bots, logs and alt text. */
  emoji: string;
  /** Kana that show this advice was given (any one), matched in the normalised reading of what was heard. */
  keys: string[];
}

/** The level lines a speaking adviser works from. */
export interface AdviceLine {
  /** What the adviser is asked to do, in plain English. Never names the grammar. */
  mission: string;
  /** Nobiko-san's version: behind "Need a hint?", and what she reads on a mic pass. */
  model: JpText;
  /**
   * N4 lines that open with a conditional (＿たら, 4.5) only: the advice without it. The phrasebook logs this one
   * unless the adviser's own words used the conditional, so 4.5 is credited only when ＿たら was really said.
   */
  plain?: JpText;
  /** N5 only: a fill-in frame (＿＿ marks the gap), the first step behind "Need a hint?". */
  frame?: JpText;
}

export interface Problem {
  id: string;
  /** Who is calling: a yōkai of the studio. */
  caller: { name: JpText; picture: string; emoji: string };
  /** The problem as the caller says it, by level (Kana: one short line on a tile). */
  line: ByLevel<JpText>;
  /** The gist every phone gets once the problem is said: a short kana line, with English. */
  gist: JpText;
  /** What would really help: only the caller sees it until the secret beat. */
  secret: JpText;
  /** Advice tile ids (from ADVICE): the cure, the near miss (おしい！), two decoys and the curveball. */
  cure: string;
  near: string;
  decoys: [string, string];
  curve: string;
  /** Speaking advisers' lines, by level. */
  advice: { n5: AdviceLine; n4: AdviceLine };
  /** Nobiko-san's line at the secret beat. */
  reveal: JpText;
  /** Left out: every room. */
  audiences?: readonly Audience[];
  status: 'draft' | 'fluent-checked';
}

/** A grammar chunk the commentary booth can credit when an adviser used it. */
export interface AdviceChunk {
  id: string;
  level: Exclude<Level, 'kana'>;
  /** As written, to highlight in the line. */
  text: string;
  /** Kana that show the chunk was said (any one), in the normalised reading. */
  keys: string[];
  /** One line of colour commentary, in English. Calls the play, never a mistake. */
  note: string;
  /** Where it lives on the train map. */
  tag: string;
}

const jp = (text: string, en: string, kana = text): JpText => ({ text, kana, en });
/** A line with kanji: `kana` is its exact reading, space for space (furigana is built from the pair). */
const jk = (text: string, kana: string, en: string): JpText => ({ text, kana, en });

// Keys are plain hiragana in the normalised reading: no spaces, ー read as its vowel (クーラー is くうらあ).
// A short word carries its particle or its verb, so it can't fire across a word boundary (かさを, not かさ,
// which is inside たかさ; ひをつけ, not ひ). Nouns carry the idea, so こたつに はいって and おふろに はいって
// stay apart. The near miss's and the decoys' keys never fire on the cure's model lines.
export const ADVICE: readonly AdviceTile[] = [
  // The cures (each one is some caller's secret), then the near misses, decoys and curveballs.
  { id: 'water', word: jp('みずを かけて！', 'Pour water on it!'), picture: 'advice-water', emoji: '💧', keys: ['みずを', 'みずに', 'おみず', 'みずかけ'] },
  { id: 'fire', word: jp('ひを つけて！', 'Light it!'), picture: 'advice-fire', emoji: '🔥', keys: ['ひをつけ', 'ひをともし', 'ろうそく', 'まっち', 'らいたあ', 'ほのお'] },
  { id: 'leaf', word: jp('はっぱを のせて！', 'Put a leaf on it!'), picture: 'advice-leaf', emoji: '🍃', keys: ['はっぱ'] },
  // Not a bare すみを / すみに: おやすみを, やすみを and へやの すみに would fire. Tie すみ to its verb.
  { id: 'ink', word: jp('すみを つけて！', 'Dip into the ink!'), picture: 'advice-ink', emoji: '🖋️', keys: ['すみをつけ', 'すみにつけ', 'すみをたっぷり', 'すみをいれ', 'いんく', 'ぼくじゅう', 'すずり'] },
  { id: 'umbrella', word: jp('かさを さして！', 'Put up an umbrella!'), picture: 'advice-umbrella', emoji: '☂️', keys: ['かさを', 'かさに', 'かさが', 'かさの', 'かさも', 'かさは', 'あまがさ'] },
  { id: 'aircon', word: jp('クーラーを つけて！', 'Turn on the air con!'), picture: 'advice-aircon', emoji: '🌬️', keys: ['くうらあ', 'えあこん', 'れいぼう'] },
  { id: 'kotatsu', word: jp('こたつに はいって！', 'Get in the kotatsu!'), picture: 'advice-kotatsu', emoji: '🍊', keys: ['こたつ'] },
  { id: 'play', word: jp('あそんで！', 'Play!'), picture: 'advice-play', emoji: '🪀', keys: ['あそん', 'あそぼ', 'あそび', 'あそべ', 'あそば'] },
  { id: 'dont-look', word: jp('したを みないで！', 'Don’t look down!'), picture: 'advice-dont-look', emoji: '🙈', keys: ['みないで', 'みないほう', 'みちゃだめ', 'みてはだめ', 'みてはいけ', 'みるな', 'したをみず', 'うえをみ'] },
  { id: 'dont-move', word: jp('うごかないで！', 'Don’t move!'), picture: 'advice-dont-move', emoji: '🗿', keys: ['うごかな', 'うごくな', 'じっと', 'とまって'] },
  // Not にげな: にげないで is the opposite advice.
  { id: 'run', word: jp('にげて！', 'Run!'), picture: 'advice-run', emoji: '🏃', keys: ['にげて', 'にげた', 'にげる', 'にげろ', 'にげま', 'はしって'] },
  { id: 'search', word: jp('さがして！', 'Look for it!'), picture: 'advice-search', emoji: '🔍', keys: ['さがし', 'さがそ', 'さがす', 'さがせ', 'みつけ'] },
  { id: 'shout', word: jp('さけんで！', 'Shout!'), picture: 'advice-shout', emoji: '📣', keys: ['さけん', 'さけび', 'さけぼ', 'さけべ', 'おおきなこえ', 'おおきいこえ', 'おおごえ', 'やっほお'] },
  { id: 'wash', word: jp('あらって！', 'Wash it!'), picture: 'advice-wash', emoji: '🧼', keys: ['あらって', 'あらう', 'あらった', 'あらえ', 'あらお', 'せんたく'] },
  // Not a bare すみません: learners open advice with it.
  { id: 'sorry', word: jp('あやまって！', 'Say sorry!'), picture: 'advice-sorry', emoji: '🙇', keys: ['あやま', 'ごめん', 'すみませんと', 'すみませんって', 'もうしわけ'] },
  { id: 'dont-clean', word: jp('そうじしないで！', 'Don’t clean!'), picture: 'advice-dont-clean', emoji: '🧹', keys: ['そうじしな', 'そうじをしな', 'そうじはしな', 'そうじするな', 'そうじをするな', 'そうじはだめ', 'そうじをやめ', 'そうじやめ'] },
  // Near misses: close, but not what the caller needs.
  { id: 'switch', word: jp('でんきを つけて！', 'Turn the light on!'), picture: 'advice-switch', emoji: '💡', keys: ['でんき', 'あかりを', 'あかりが'] },
  { id: 'flowers', word: jp('はなを あげて！', 'Give flowers!'), picture: 'advice-flowers', emoji: '💐', keys: ['はなを', 'はなたば', 'ぷれぜんと'] },
  { id: 'close-eyes', word: jp('めを とじて！', 'Close your eyes!'), picture: 'advice-close-eyes', emoji: '😌', keys: ['めをとじ', 'めをつぶ', 'めをつむ'] },
  { id: 'swim', word: jp('およいで！', 'Swim!'), picture: 'advice-swim', emoji: '🏊', keys: ['およい', 'およぐ', 'およご', 'およげ', 'ぷうる', 'すいえい'] },
  { id: 'hide', word: jp('かくれて！', 'Hide!'), picture: 'advice-hide', emoji: '🫣', keys: ['かくれ'] },
  { id: 'bath', word: jp('おふろに はいって！', 'Have a bath!'), picture: 'advice-bath', emoji: '🛁', keys: ['おふろ', 'ふろに', 'ふろへ', 'しゃわあ', 'おんせん'] },
  { id: 'sing', word: jp('うたって！', 'Sing!'), picture: 'advice-sing', emoji: '🎤', keys: ['うたっ', 'うたう', 'うたお', 'うたえ', 'うたを', 'からおけ'] },
  // The everyday decoys.
  { id: 'sleep', word: jp('ねて！', 'Sleep!'), picture: 'advice-sleep', emoji: '😴', keys: ['ねて', 'ねる', 'ねむ', 'ねたら', 'ねなさい', 'ねましょう', 'ねます', 'やすんで', 'おやすみ'] },
  { id: 'eat', word: jp('たべて！', 'Eat!'), picture: 'advice-eat', emoji: '🍙', keys: ['たべ'] },
  { id: 'dance', word: jp('おどって！', 'Dance!'), picture: 'advice-dance', emoji: '💃', keys: ['おどっ', 'おどる', 'おどり', 'だんす'] },
];

export const PROBLEMS: readonly Problem[] = [
  {
    id: 'kappa',
    caller: { name: jp('かっぱ', 'the kappa'), picture: 'caller-kappa', emoji: '🥒' },
    line: {
      kana: jp('おさらが からから…', 'My dish is bone dry…'),
      n5: jp('あたまの おさらが かわきました。ちからが でません…', 'The dish on my head has dried out. I’ve no strength…'),
      n4: jk('頭の お皿が 乾いて、力が 出ないんです…', 'あたまの おさらが かわいて、ちからが でないんです…', 'The dish on my head has dried out, and I’ve lost all my strength…'),
    },
    gist: jp('おさらが からから！', 'The kappa’s dish is bone dry, and it feels weak.'),
    secret: jp('おさらに みず', 'Water on the dish'),
    cure: 'water',
    near: 'swim',
    decoys: ['sleep', 'eat'],
    curve: 'kotatsu',
    advice: {
      n5: {
        mission: 'Tell the kappa what to do, right now.',
        model: jp('おさらに みずを かけて ください！', 'Please pour water on your dish!'),
        frame: jp('おさらに みずを ＿＿ ください！', 'Please ＿＿ (pour) water on your dish!'),
      },
      n4: {
        mission: 'Gently suggest something the kappa could try.',
        model: jk('お皿に 水を かけたら どうですか。', 'おさらに みずを かけたら どうですか。', 'Why not pour some water on your dish?'),
      },
    },
    reveal: jp('おさらに みず！ かっぱの きほんよ〜。', 'Water on the dish! Kappa basics, dear~'),
    status: 'draft',
  },
  {
    id: 'chochin',
    caller: { name: jp('ちょうちんさん', 'Chōchin-san'), picture: 'caller-chochin', emoji: '🏮' },
    line: {
      kana: jp('ひが きえた…', 'My flame went out…'),
      n5: jp('ゆらゆら… ひが きえました。まっくらです。', '(Flicker…) My flame has gone out. It’s pitch dark.'),
      n4: jk('火が 消えて しまいました。何も 見えないんです…', 'ひが きえて しまいました。なにも みえないんです…', 'My flame has gone out. I can’t see a thing…'),
    },
    gist: jp('ひが きえた！ まっくら！', 'Chōchin-san’s flame has gone out. It’s pitch dark.'),
    secret: jp('ひを つける', 'Light his flame again'),
    cure: 'fire',
    near: 'switch',
    decoys: ['sleep', 'sing'],
    curve: 'water',
    advice: {
      n5: {
        mission: 'Tell Chōchin-san what to do, right now.',
        model: jp('ろうそくに ひを つけて ください。', 'Please light your candle.'),
        frame: jp('ろうそくに ひを ＿＿ ください。', 'Please ＿＿ (light) your candle.'),
      },
      n4: {
        mission: 'Tell Chōchin-san what he’d better do next time his flame goes out.',
        model: jk('今度 火が 消えたら、マッチで 火を つけた ほうが いいですよ。', 'こんど ひが きえたら、マッチで ひを つけた ほうが いいですよ。', 'Next time your flame goes out, you’d better light it with a match.'),
        plain: jk('マッチで 火を つけた ほうが いいですよ。', 'マッチで ひを つけた ほうが いいですよ。', 'You’d better light it with a match.'),
      },
    },
    reveal: jp('ひが ついたら、また ゆらゆらね〜。', 'Light him up, and he’s flickering again~'),
    status: 'draft',
  },
  {
    id: 'pon',
    caller: { name: jp('ポン', 'Pon'), picture: 'caller-pon', emoji: '🦝' },
    line: {
      kana: jp('しっぽが でたポン…', 'My tail popped out…'),
      n5: jp('あたまの はっぱが おちました。しっぽが でました！', 'The leaf fell off my head. My tail popped out!'),
      n4: jk('頭の 葉っぱが 落ちて、半分 たぬきに 戻って しまったんです！', 'あたまの はっぱが おちて、はんぶん たぬきに もどって しまったんです！', 'The leaf fell off my head, and I’ve gone half back to tanuki!'),
    },
    gist: jp('あたまの うえが からっぽ！ しっぽが でた！', 'Nothing’s on top of Pon’s head any more, and his tail popped out.'),
    secret: jp('あたまに はっぱ', 'A leaf back on his head'),
    cure: 'leaf',
    near: 'hide',
    decoys: ['sleep', 'wash'],
    curve: 'dance',
    advice: {
      n5: {
        mission: 'Tell Pon what to do, quick, before anyone sees.',
        model: jp('あたまに はっぱを のせて ください！', 'Please put a leaf on your head!'),
        frame: jp('あたまに はっぱを ＿＿ ください！', 'Please ＿＿ (put) a leaf on your head!'),
      },
      n4: {
        mission: 'Gently suggest something Pon could try.',
        model: jk('もう 一度 葉っぱを 頭に のせたら どうですか。', 'もう いちど はっぱを あたまに のせたら どうですか。', 'Why not put a leaf on your head again?'),
      },
    },
    reveal: jp('はっぱ いちまいで ドロン！ かんたんね〜。', 'One leaf and… poof! Easy~'),
    status: 'draft',
  },
  {
    id: 'fude',
    caller: { name: jp('フデ', 'Fude'), picture: 'caller-fude', emoji: '🖌️' },
    line: {
      kana: jp('すみが ない！', 'I’m out of ink!'),
      n5: jp('シュッ！ …あれ？ すみが ありません。かみが まっしろです！', 'Swish! …Huh? No ink. The paper’s still blank!'),
      n4: jk('墨が なくなって、字が 書けないんです！', 'すみが なくなって、じが かけないんです！', 'I’ve run out of ink, and I can’t write a thing!'),
    },
    gist: jp('すみが ない！ まっしろ！', 'Fude has run out of ink: the paper’s still blank.'),
    secret: jp('すみを つける', 'A dip in the ink'),
    cure: 'ink',
    near: 'water',
    decoys: ['eat', 'sleep'],
    curve: 'bath',
    advice: {
      n5: {
        mission: 'Tell Fude what to do before the next stroke.',
        model: jp('すみを つけて ください！ たっぷり！', 'Please dip into the ink! Lots of it!'),
        frame: jp('すみを ＿＿ ください！ たっぷり！', 'Please ＿＿ (dip into) the ink! Lots of it!'),
      },
      n4: {
        mission: 'Tell Fude what he’d better do.',
        model: jk('もう 一度 墨を つけた ほうが いいですよ。', 'もう いちど すみを つけた ほうが いいですよ。', 'You’d better dip into the ink again.'),
      },
    },
    reveal: jp('すみを つけて、シュッ！ ふっかつね〜。', 'A dip of ink and… swish! He’s back~'),
    status: 'draft',
  },
  {
    id: 'karakasa',
    caller: { name: jp('からかさおばけ', 'the umbrella ghost'), picture: 'caller-karakasa', emoji: '☂️' },
    line: {
      kana: jp('あめ、きらい…', 'I hate rain…'),
      n5: jp('あめが だいきらいです。ぬれたく ないです…', 'I really hate rain. I don’t want to get wet…'),
      n4: jk('雨の 日は 外に 出たく ないんです。ぬれるのが きらいで…', 'あめの ひは そとに でたく ないんです。ぬれるのが きらいで…', 'I don’t want to go out on rainy days. I hate getting wet…'),
    },
    gist: jp('あめ きらい！ ぬれたく ない！', 'The umbrella ghost hates rain and doesn’t want to get wet.'),
    secret: jp('かさを さす', 'Put up an umbrella (yes, really)'),
    cure: 'umbrella',
    near: 'hide',
    decoys: ['bath', 'sleep'],
    curve: 'swim',
    advice: {
      n5: {
        mission: 'Tell the umbrella ghost what to do on rainy days.',
        model: jp('あめの ひは かさを さして ください。', 'On rainy days, please put up an umbrella.'),
        frame: jp('あめの ひは かさを ＿＿ ください。', 'On rainy days, please ＿＿ (put up) an umbrella.'),
      },
      n4: {
        mission: 'Gently suggest something the umbrella ghost could try.',
        model: jk('雨の 日は 傘を さしたら どうですか。', 'あめの ひは かさを さしたら どうですか。', 'Why not put up an umbrella on rainy days?'),
      },
    },
    reveal: jp('かさが かさを さすの。…いいじゃない〜。', 'An umbrella under an umbrella. …Why not~'),
    status: 'draft',
  },
  {
    id: 'yukionna',
    caller: { name: jp('ゆきおんな', 'the snow woman'), picture: 'caller-yukionna', emoji: '❄️' },
    line: {
      kana: jp('あつい！ とける〜！', 'Hot! I’m melting!'),
      n5: jp('とうきょうの なつは あついです。わたしは ゆきですから…', 'Tokyo summers are hot. And I’m made of snow…'),
      n4: jk('東京の 夏は 暑すぎて、とけそうなんです…', 'とうきょうの なつは あつすぎて、とけそうなんです…', 'Tokyo summers are too hot. I feel like I’m melting…'),
    },
    gist: jp('あつい！ とける！ すずしく したい！', 'The snow woman is melting in the heat and needs cooling down.'),
    secret: jp('クーラーを つける', 'Turn on the air conditioner'),
    cure: 'aircon',
    near: 'swim',
    decoys: ['eat', 'kotatsu'],
    curve: 'bath',
    advice: {
      n5: {
        mission: 'Tell the snow woman what to do, right now.',
        model: jp('クーラーを つけて ください！', 'Please turn on the air conditioner!'),
        frame: jp('クーラーを ＿＿ ください！', 'Please ＿＿ (turn on) the air conditioner!'),
      },
      n4: {
        mission: 'Tell the snow woman what she’d better do when she starts to melt.',
        model: jp('とけそうに なったら、クーラーを つけた ほうが いいですよ。', 'When you feel yourself melting, you’d better turn on the air conditioner.'),
        plain: jp('クーラーを つけた ほうが いいですよ。', 'You’d better turn on the air conditioner.'),
      },
    },
    reveal: jp('クーラーで ひんやり。なつは これよ〜。', 'Nice cool air. That’s summer sorted~'),
    status: 'draft',
  },
  {
    id: 'nekomata',
    caller: { name: jp('ねこまた', 'the two-tailed cat'), picture: 'caller-nekomata', emoji: '🐈' },
    line: {
      kana: jp('さむい… ぶるぶる…', 'So cold… shiver, shiver…'),
      n5: jp('ふゆは さむいです。ふたつの しっぽが つめたいです…', 'Winter is cold. Both my tails are freezing…'),
      n4: jk('冬は 寒くて、しっぽが 二本とも 冷たく なって しまったんです…', 'ふゆは さむくて、しっぽが にほんとも つめたく なって しまったんです…', 'Winter is so cold, both my tails have gone icy…'),
    },
    gist: jp('さむい！ ぶるぶる！', 'The two-tailed cat is freezing cold.'),
    secret: jp('こたつで まるく なる', 'Curl up in the kotatsu'),
    cure: 'kotatsu',
    near: 'bath',
    decoys: ['dance', 'eat'],
    curve: 'aircon',
    advice: {
      n5: {
        mission: 'Tell the two-tailed cat what to do to warm up.',
        model: jp('こたつに はいって ください。', 'Please get in the kotatsu.'),
        frame: jp('こたつに ＿＿ ください。', 'Please ＿＿ (get in) the kotatsu.'),
      },
      n4: {
        mission: 'Gently suggest something the cat could try.',
        model: jk('こたつに 入ったら どうですか。', 'こたつに はいったら どうですか。', 'Why not get in the kotatsu?'),
      },
    },
    reveal: jp('ねこは こたつで まるく なるの。うたにも あるわ〜。', 'Cats curl up in the kotatsu. There’s even a song~'),
    status: 'draft',
  },
  {
    id: 'zashiki',
    caller: { name: jp('ざしきわらし', 'the house spirit'), picture: 'caller-zashiki', emoji: '👘' },
    line: {
      kana: jp('ひま… ひま…', 'Bored… so bored…'),
      n5: jp('いえに だれも いません。まいにち ひまです…', 'There’s nobody home. Every day is so boring…'),
      n4: jk('家族が みんな 出かけて しまって、毎日 たいくつなんです…', 'かぞくが みんな でかけて しまって、まいにち たいくつなんです…', 'The whole family has gone out, and every day is so boring…'),
    },
    gist: jp('ひま！ だれも いない！', 'The house spirit is home alone and bored stiff.'),
    secret: jp('いっしょに あそぶ', 'Someone to play with'),
    cure: 'play',
    near: 'sing',
    decoys: ['sleep', 'wash'],
    curve: 'run',
    advice: {
      n5: {
        mission: 'Ask the house spirit to do something with you.',
        model: jp('いっしょに あそんで ください！', 'Please play with us!'),
        frame: jp('いっしょに ＿＿ ください！', 'Please ＿＿ (play) with us!'),
      },
      n4: {
        mission: 'Tell the house spirit what it’d better do if it’s bored.',
        model: jk('ひまだったら、近所の 子どもと 遊んだ ほうが いいですよ。', 'ひまだったら、きんじょの こどもと あそんだ ほうが いいですよ。', 'If you’re bored, you’d better play with the kids next door.'),
        plain: jk('近所の 子どもと 遊んだ ほうが いいですよ。', 'きんじょの こどもと あそんだ ほうが いいですよ。', 'You’d better play with the kids next door.'),
      },
    },
    reveal: jp('あそびあいてが いれば、いえも にこにこよ〜。', 'A playmate, and the whole house smiles~'),
    status: 'draft',
  },
  {
    id: 'tengu',
    caller: { name: jp('てんぐ', 'the tengu'), picture: 'caller-tengu', emoji: '👺' },
    line: {
      kana: jp('たかい ところ、こわい…', 'Heights are scary…'),
      n5: jp('わたしは てんぐです。でも、たかい ところが こわいです…', 'I’m a tengu. But I’m scared of heights…'),
      n4: jk('てんぐなのに、高い 所が こわくて 飛べないんです…', 'てんぐなのに、たかい ところが こわくて とべないんです…', 'I’m a tengu, but heights scare me so much I can’t fly…'),
    },
    gist: jp('たかい！ したが こわい！', 'The tengu is scared of heights: looking down is the worst.'),
    secret: jp('したを みない', 'Don’t look down'),
    cure: 'dont-look',
    near: 'close-eyes',
    decoys: ['hide', 'sleep'],
    curve: 'kotatsu',
    advice: {
      n5: {
        mission: 'Tell the tengu what not to do up there.',
        model: jp('したを みないで ください！', 'Please don’t look down!'),
        frame: jp('したを ＿＿ ください！', 'Please ＿＿ (don’t look) down!'),
      },
      n4: {
        mission: 'Tell the tengu what it’d better not do once it’s flying.',
        model: jk('空を 飛んだら、下を 見ない ほうが いいですよ。', 'そらを とんだら、したを みない ほうが いいですよ。', 'Once you’re up in the sky, you’d better not look down.'),
        plain: jk('下を 見ない ほうが いいですよ。', 'したを みない ほうが いいですよ。', 'You’d better not look down.'),
      },
    },
    reveal: jp('したを みなければ、そらは きもちいいわよ〜。', 'Don’t look down, and the sky is lovely~'),
    status: 'draft',
  },
  {
    id: 'daruma',
    caller: { name: jp('だるま', 'the daruma'), picture: 'caller-daruma', emoji: '🔴' },
    line: {
      kana: jp('じっと できない…', 'I can’t keep still…'),
      n5: jp('「だるまさんが ころんだ」で いつも まけます。すぐ うごきます…', 'I always lose at “Daruma-san ga koronda”. I keep moving…'),
      n4: jk('「だるまさんが ころんだ」で、いつも 動いて しまうんです…', '「だるまさんが ころんだ」で、いつも うごいて しまうんです…', 'At “Daruma-san ga koronda”, I always end up moving…'),
    },
    gist: jp('つい うごいちゃう！ また まけた！', 'At red light, green light, the daruma keeps moving and keeps losing.'),
    secret: jp('うごかない', 'Don’t move a muscle'),
    cure: 'dont-move',
    near: 'sleep',
    decoys: ['run', 'dance'],
    curve: 'shout',
    advice: {
      n5: {
        mission: 'Tell the daruma what not to do when “it” turns round.',
        model: jp('うごかないで ください！ じっと！', 'Please don’t move! Stay still!'),
        frame: jp('＿＿ ください！ じっと！', 'Please ＿＿ (don’t move)! Stay still!'),
      },
      n4: {
        mission: 'Tell the daruma what it’d better not do when it hears “koronda!”.',
        model: jk('「ころんだ」と 聞こえたら、動かない ほうが いいですよ。', '「ころんだ」と きこえたら、うごかない ほうが いいですよ。', 'When you hear “koronda!”, you’d better not move.'),
        plain: jk('「ころんだ」の あとは、動かない ほうが いいですよ。', '「ころんだ」の あとは、うごかない ほうが いいですよ。', 'After “koronda!”, you’d better not move.'),
      },
    },
    reveal: jp('だるまは うごかないのが しごとよ〜。', 'Not moving is a daruma’s whole job~'),
    status: 'draft',
  },
  {
    id: 'oni',
    caller: { name: jp('おに', 'the oni'), picture: 'caller-oni', emoji: '👹' },
    line: {
      kana: jp('まめが とんで くる！', 'Beans are flying at me!'),
      n5: jp('きょうは せつぶんです。みんなが まめを なげます！', 'It’s Setsubun today. Everyone’s throwing beans at me!'),
      n4: jk('節分の 日は、子どもたちに 豆を 投げられるんです！', 'せつぶんの ひは、こどもたちに まめを なげられるんです！', 'On Setsubun, the kids throw beans at me!'),
    },
    gist: jp('まめが とんで くる！ 「おには そと！」', 'Everyone’s throwing Setsubun beans at the oni: “Demons out!”'),
    secret: jp('にげる', 'Run for it'),
    cure: 'run',
    near: 'hide',
    decoys: ['eat', 'sleep'],
    curve: 'sorry',
    advice: {
      n5: {
        mission: 'Tell the oni what to do, fast!',
        model: jp('はやく にげて ください！', 'Please run away, quick!'),
        frame: jp('はやく ＿＿ ください！', 'Please ＿＿ (run away), quick!'),
      },
      n4: {
        mission: 'Gently suggest something the oni could try.',
        model: jk('節分の 日は 山へ にげたら どうですか。', 'せつぶんの ひは やまへ にげたら どうですか。', 'Why not run off to the mountains on Setsubun?'),
      },
    },
    reveal: jp('にげるが かちよ〜。おには そと！', 'Running away is winning~ Demons out!'),
    status: 'draft',
  },
  {
    id: 'bakezori',
    caller: { name: jp('ばけぞうり', 'the sandal ghost'), picture: 'caller-bakezori', emoji: '🩴' },
    line: {
      kana: jp('かたほうが いない…', 'My other one’s gone…'),
      n5: jp('わたしは ぞうりです。でも、もう かたほうが いません…', 'I’m a sandal. But my other one is gone…'),
      n4: jk('もう 片方の ぞうりが どこかへ 行って しまったんです…', 'もう かたほうの ぞうりが どこかへ いって しまったんです…', 'My other sandal has wandered off somewhere…'),
    },
    gist: jp('かたほうが いない！ どこ？', 'The sandal ghost has lost its other sandal.'),
    secret: jp('さがしに いく', 'Go and look for it'),
    cure: 'search',
    near: 'shout',
    decoys: ['wash', 'sleep'],
    curve: 'umbrella',
    advice: {
      n5: {
        mission: 'Tell the sandal ghost what to do.',
        model: jp('かたほうを さがして ください！', 'Please look for your other one!'),
        frame: jp('かたほうを ＿＿ ください！', 'Please ＿＿ (look for) your other one!'),
      },
      n4: {
        mission: 'Tell the sandal ghost what it’d better do.',
        model: jk('玄関を 探した ほうが いいですよ。', 'げんかんを さがした ほうが いいですよ。', 'You’d better look by the front door.'),
      },
    },
    reveal: jp('かたほうは げんかんに いたわ。おにあいね〜。', 'The other one was by the front door. A perfect pair~'),
    status: 'draft',
  },
  {
    id: 'kodama',
    caller: { name: jp('こだま', 'the echo spirit'), picture: 'caller-kodama', emoji: '🌳' },
    line: {
      kana: jp('やまが しずか…', 'The mountain’s so quiet…'),
      n5: jp('わたしは こだまです。でも、もう だれも 「やっほー」と いいません…', 'I’m an echo spirit. But nobody shouts “yoo-hoo!” any more…'),
      n4: jk('最近 だれも 山で 叫ばないので、返事が できないんです…', 'さいきん だれも やまで さけばないので、へんじが できないんです…', 'Nobody shouts in the mountains any more, so I’ve nothing to answer…'),
    },
    gist: jp('だれも よんで くれない！ しーん…', 'Nobody calls out in the mountains any more, so there’s nothing to echo.'),
    secret: jp('おおきな こえで やっほー', 'A big, loud “yoo-hoo!”'),
    cure: 'shout',
    near: 'sing',
    decoys: ['sleep', 'hide'],
    curve: 'bath',
    advice: {
      n5: {
        mission: 'Tell the echo spirit what to do, out loud.',
        model: jp('おおきな こえで 「やっほー」と いって ください！', 'Please call “yoo-hoo!” in a big voice!'),
        frame: jp('おおきな こえで 「やっほー」と ＿＿ ください！', 'Please ＿＿ (say) “yoo-hoo!” in a big voice!'),
      },
      n4: {
        mission: 'Gently suggest something the echo spirit could try.',
        model: jk('自分から 大きな 声で 「やっほー」と 言ったら どうですか。', 'じぶんから おおきな こえで 「やっほー」と いったら どうですか。', 'Why not call “yoo-hoo!” first yourself, nice and loud?'),
      },
    },
    reveal: jp('やっほー！ …やっほー… いい こだまね〜。', 'Yoo-hoo! …yoo-hoo… What an echo~'),
    status: 'draft',
  },
  {
    id: 'ittan',
    caller: { name: jp('いったんもめん', 'the flying cloth'), picture: 'caller-ittan', emoji: '🧣' },
    line: {
      kana: jp('どろどろ…', 'All muddy…'),
      n5: jp('きのう あめの なかを とびました。いま、どろどろです…', 'I flew through the rain yesterday. Now I’m all muddy…'),
      n4: jk('雨の 中を 飛んで、どろどろに なって しまったんです…', 'あめの なかを とんで、どろどろに なって しまったんです…', 'I flew through the rain, and now I’m covered in mud…'),
    },
    gist: jp('どろどろ！ まっくろ！', 'The flying cloth is covered in mud.'),
    secret: jp('せんたく', 'A good wash'),
    cure: 'wash',
    near: 'water',
    decoys: ['sleep', 'hide'],
    curve: 'ink',
    advice: {
      n5: {
        mission: 'Tell the flying cloth what to do before it flies again.',
        model: jp('せっけんで あらって ください。', 'Please wash yourself with soap.'),
        frame: jp('せっけんで ＿＿ ください。', 'Please ＿＿ (wash) yourself with soap.'),
      },
      n4: {
        mission: 'Tell the flying cloth what it’d better do when it gets muddy.',
        model: jk('どろどろに なったら、せんたくきで 洗った ほうが いいですよ。', 'どろどろに なったら、せんたくきで あらった ほうが いいですよ。', 'When you get muddy, you’d better go through the washing machine.'),
        plain: jk('せんたくきで 洗った ほうが いいですよ。', 'せんたくきで あらった ほうが いいですよ。', 'You’d better go through the washing machine.'),
      },
    },
    reveal: jp('せんたくして、まっしろ！ ふわふわ〜。', 'Washed, snow-white and fluffy~'),
    status: 'draft',
  },
  // Cheeky only: a date gone wrong (Late Again!'s date cause is Cheeky too).
  {
    id: 'kitsune',
    caller: { name: jp('きつね', 'the fox'), picture: 'caller-kitsune', emoji: '🦊' },
    line: {
      kana: jp('デートに おくれた…', 'I was late for a date…'),
      n5: jp('デートに さんじかん おくれました。あいては おこって います…', 'I was three hours late for a date. My date is furious…'),
      n4: jk('デートに 三時間も 遅れて、相手が 怒って しまったんです…', 'デートに さんじかんも おくれて、あいてが おこって しまったんです…', 'I was three hours late for a date, and now my date is furious…'),
    },
    gist: jp('デートに おくれた！ あいてが おこってる！', 'The fox was three hours late for a date, and the date is furious.'),
    secret: jp('ちゃんと あやまる', 'A proper apology'),
    cure: 'sorry',
    near: 'flowers',
    decoys: ['hide', 'run'],
    curve: 'dance',
    advice: {
      n5: {
        mission: 'Tell the fox what to do the moment it sees its date.',
        model: jp('すぐ あやまって ください！', 'Please apologise, right away!'),
        frame: jp('すぐ ＿＿ ください！', 'Please ＿＿ (apologise), right away!'),
      },
      n4: {
        mission: 'Gently suggest something the fox could try.',
        model: jk('会って すぐ 謝ったら どうですか。', 'あって すぐ あやまったら どうですか。', 'Why not apologise the moment you meet?'),
      },
    },
    reveal: jp('まず あやまる！ はなは そのあとよ〜。', 'Say sorry first! The flowers come after~'),
    audiences: ['cheeky'],
    status: 'draft',
  },
  // Cheeky only: the akaname licks the grime off bathtubs, and this family won't stop cleaning.
  {
    id: 'akaname',
    caller: { name: jp('あかなめ', 'the bath licker'), picture: 'caller-akaname', emoji: '👅' },
    line: {
      kana: jp('おふろが ぴかぴか…', 'The bath is spotless…'),
      n5: jp('この いえの ひとは まいにち おふろを そうじします。なめる ものが ありません…', 'The family here clean the bath every day. There’s nothing to lick…'),
      n4: jk('この 家の 人が 毎日 お風呂を 掃除するので、なめる 物が ないんです…', 'この いえの ひとが まいにち おふろを そうじするので、なめる ものが ないんです…', 'The family here clean the bath every day, so there’s nothing to lick…'),
    },
    gist: jp('おふろが ぴかぴか！ なめる ものが ない！', 'The family keeps the bath spotless: nothing left to lick.'),
    secret: jp('もう そうじしない', 'No more cleaning'),
    cure: 'dont-clean',
    near: 'search',
    decoys: ['wash', 'bath'],
    curve: 'sing',
    advice: {
      n5: {
        mission: 'Tell the family what not to do any more.',
        model: jp('もう そうじしないで ください！', 'Please don’t clean any more!'),
        frame: jp('もう そうじ＿＿ ください！', 'Please ＿＿ (don’t) clean any more!'),
      },
      n4: {
        mission: 'Tell the family what they’d better not do any more.',
        model: jk('もう 掃除しない ほうが いいですよ。', 'もう そうじしない ほうが いいですよ。', 'You’d better not clean any more.'),
      },
    },
    reveal: jp('そうじしない いえ… うちの ことかしら？', 'A house that never cleans… sounds like mine?'),
    audiences: ['cheeky'],
    status: 'draft',
  },
];

const tag = {
  tara: 'Express Line · 〜たら どうですか',
  hou: 'Express Line · 〜た ほうが いいです',
  naiHou: 'Express Line · 〜ない ほうが いいです',
  te: 'Local Line · 〜て ください',
  naide: 'Local Line · 〜ないで ください',
};

/**
 * The chunks the booth credits, highest level first. Within a level the longer chunk comes first, because
 * its keys hold the shorter one's (ないほうがいい holds ほうがいい, ないでください holds でください).
 */
export const CHUNKS: readonly AdviceChunk[] = [
  { id: 'nai-hou', level: 'n4', text: 'ない ほうが いいです', keys: ['ないほうがいい'], note: '〜ない ほうが いいです: friendly advice with a stop sign on it. Fair warning, given.', tag: tag.naiHou },
  { id: 'hou', level: 'n4', text: 'ほうが いいです', keys: ['たほうがいい', 'だほうがいい'], note: '〜た ほうが いいです: “you’d better”. Advice with a gentle shove behind it.', tag: tag.hou },
  // だら after ん (さけんだら, あそんだら): the highlight has to find だら too.
  { id: 'tara', level: 'n4', text: 'たら どうですか', keys: ['たらどうで', 'だらどうで', 'たらいかが', 'だらいかが'], note: '〜たら どうですか: “why not…?” So gentle the yōkai will think it was its own idea.', tag: tag.tara },
  { id: 'naide', level: 'n5', text: 'ないで ください', keys: ['ないでください'], note: '〜ないで ください: a polite “don’t!”. The caller has been warned, nicely.', tag: tag.naide },
  // で after ん (あそんで, さけんで).
  { id: 'te', level: 'n5', text: 'て ください', keys: ['てください', 'でください'], note: '〜て ください: a polite “please do”. Short, clear, and the caller knows exactly what to do.', tag: tag.te },
];

const BY_ID = new Map<string, AdviceTile>();
export const adviceOf = (id: string): AdviceTile | undefined => {
  if (BY_ID.size !== ADVICE.length) for (const a of ADVICE) BY_ID.set(a.id, a);
  return BY_ID.get(id);
};
export const problemOf = (id: string): Problem | undefined => PROBLEMS.find((p) => p.id === id);
const fits = (x: { audiences?: readonly Audience[] }, audience: Audience): boolean => !x.audiences || x.audiences.includes(audience);
export const problemsFor = (audience: Audience): Problem[] => PROBLEMS.filter((p) => fits(p, audience));

/** A Kana adviser's four tiles: the cure, the near miss, the first decoy and the curveball. */
export const kanaTilesOf = (p: Problem): string[] => [p.cure, p.near, p.decoys[0], p.curve];
/** The gallery's four bet pictures: the cure, the near miss and both decoys. */
export const betTilesOf = (p: Problem): string[] => [p.cure, p.near, ...p.decoys];

/** Hand romaji for Kana phones where the kana alone can't show the word split (the word-break table only reads
 *  content/, so these lines would glue particles on: "Higa kieta"). Keyed by the kana as shown. */
export const ROMAJI: Record<string, string> = {
  'ひが きえた…': 'hi ga kieta…',
  'ひが きえた！ まっくら！': 'Hi ga kieta! Makkura!',
  'おさらに みず': 'osara ni mizu',
  'おさらが からから！': 'Osara ga karakara!',
  'しっぽが でたポン…': 'shippo ga deta pon…',
  'あたまに はっぱ': 'atama ni happa',
  'こたつで まるく なる': 'kotatsu de maruku naru',
  'いっしょに あそぶ': 'issho ni asobu',
  'さがしに いく': 'sagashi ni iku',
  'おおきな こえで やっほー': 'ōkina koe de yahhō',
  'もう そうじしない': 'mō sōji shinai',
  'こたつに はいって！': 'Kotatsu ni haitte!',
  'おふろに はいって！': 'Ofuro ni haitte!',
  'そうじしないで！': 'Sōji shinaide!',
};
