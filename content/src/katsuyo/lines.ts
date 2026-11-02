// Katsuyō Raid's chunks (Wave 3, 一言 Chunk Strike) and boss lines (the 文妖怪 Sentence Yōkai). See
// docs/modes/kana-raid.md, "Green Car".
//
// A chunk is a picture, an English gist and a badge: the player says a short chunk with the yōkai's verb in
// that form and a word of their own in the gap (さいふを ぬすまれた). The model chunk is never shown before the
// answer: it is what the TV shows once the yōkai is caught, and what the phone shows after a miss.
//
// A boss line is one N3 line said whole from the gist, from memory. It is never shown whole until the boss
// falls. Its pieces are the forms the team breaks off first (say the form on that piece's verb).
//
// Audiences (green-car/design.md, "Kids, Family and Cheeky"): left out means every room. Kids rooms draw only
// lines with no `audiences`; Cheeky changes only the boss lines (Cheeky rooms prefer the Cheeky ones). Nothing
// stinging is aimed at a player: the one who suffers is "I", and whoever did it is a cat, a sister, the rain or
// a boss. Every line is `draft` until the fluent check (and the taste check for Kids and Cheeky).

import type { JpText, ReviewStatus } from '../types.js';
import type { BadgeId, KatsuyoAudience } from './verbs.js';

export interface KatsuyoChunk {
  id: string;
  badge: BadgeId;
  /** KATSUYO_VERBS id: the verb the chunk must use. */
  verbId: string;
  /** Placeholder picture until the chunk art is drawn. */
  picture: string;
  /** The English gist the player turns into Japanese. */
  gist: string;
  /** Fude's version, shown after the answer. */
  model: JpText;
  audiences?: readonly KatsuyoAudience[];
  status: ReviewStatus;
}

export interface KatsuyoBossLine {
  id: string;
  /** The N3 badge the line is about (its frame must be heard in the finishing blow). */
  badge: BadgeId;
  /** The verb that carries the badge in the line (KATSUYO_VERBS id). */
  verbId: string;
  gist: string;
  line: JpText;
  /** The forms the team breaks off first: a verb and a drill badge it takes. */
  pieces: readonly { verbId: string; badge: BadgeId }[];
  audiences?: readonly KatsuyoAudience[];
  status: ReviewStatus;
}

const FAMILY: readonly KatsuyoAudience[] = ['family', 'cheeky'];
const CHEEKY: readonly KatsuyoAudience[] = ['cheeky'];
const jp = (kana: string, en: string, text = kana): JpText => ({ text, kana, en });
const c = (id: string, badge: BadgeId, verbId: string, picture: string, gist: string, kana: string, audiences?: readonly KatsuyoAudience[]): KatsuyoChunk => ({
  id,
  badge,
  verbId,
  picture,
  gist,
  model: jp(kana, gist),
  ...(audiences ? { audiences } : {}),
  status: 'draft',
});

export const KATSUYO_CHUNKS: readonly KatsuyoChunk[] = [
  // 受身 passive (4.13)
  c('ch-shikaru', 'passive', 'shikaru', '👩‍🏫', 'I got told off by my teacher', 'せんせいに しかられた'),
  c('ch-fumu', 'passive', 'fumu', '🦶', 'Someone stepped on my foot on the train', 'でんしゃで あしを ふまれた'),
  c('ch-warau', 'passive', 'warau', '😂', 'Everyone laughed at me', 'みんなに わらわれた'),
  c('ch-yomu-diary', 'passive', 'yomu', '📔', 'My little sister read my diary', 'いもうとに にっきを よまれた'),
  c('ch-taberu-pudding', 'passive', 'taberu', '🍮', 'The cat ate my pudding', 'ねこに プリンを たべられた'),
  c('ch-nusumu', 'passive', 'nusumu', '👛', 'My wallet got stolen', 'さいふを ぬすまれた', FAMILY),
  // 可能 potential (4.4)
  c('ch-taberu-natto', 'potential', 'taberu', '🥢', "I can't eat natto", 'なっとうが たべられない'),
  c('ch-hanasu', 'potential', 'hanasu', '🗣️', 'I can speak a little Japanese', 'にほんごが すこし はなせる'),
  c('ch-okiru', 'potential', 'okiru', '⏰', "I can't get up early", 'あさ はやく おきられない'),
  c('ch-hashiru', 'potential', 'hashiru', '🏃', 'I can run five kilometres', 'ごキロ はしれる'),
  c('ch-nomu-coffee', 'potential', 'nomu', '☕', "I can't drink black coffee", 'ブラックコーヒーが のめない', FAMILY),
  // 使役 causative (4.2)
  c('ch-taberu-veg', 'causative', 'taberu', '🥦', 'Mum made my brother eat his vegetables', 'ははが おとうとに やさいを たべさせた'),
  c('ch-matsu', 'causative', 'matsu', '⌚', 'I kept my friend waiting', 'ともだちを またせた'),
  c('ch-warau-dad', 'causative', 'warau', '🤡', 'Dad made everyone laugh', 'ちちが みんなを わらわせた'),
  c('ch-kayou', 'causative', 'kayou', '🎹', 'My parents sent me to piano lessons', 'おやが わたしを ピアノきょうしつに かよわせた'),
  // ＿やすい／にくい (4.13)
  c('ch-yomu-manga', 'yasui-nikui', 'yomu', '📖', 'This manga is easy to read', 'この まんがは よみやすい'),
  c('ch-taberu-fish', 'yasui-nikui', 'taberu', '🐟', 'Fish with bones is hard to eat', 'ほねが ある さかなは たべにくい'),
  c('ch-aruku', 'yasui-nikui', 'aruku', '👟', 'These shoes are easy to walk in', 'この くつは あるきやすい'),
  c('ch-hanasu-teacher', 'yasui-nikui', 'hanasu', '🧑‍🏫', 'Our teacher is easy to talk to', 'せんせいは はなしやすい'),
  // 使役受身 made to (3.2)
  c('ch-utau', 'saserareru', 'utau', '🎤', 'I was made to sing at karaoke', 'カラオケで うたわされた'),
  c('ch-matsu-hour', 'saserareru', 'matsu', '⏳', 'I was kept waiting for an hour', 'いちじかんも またされた'),
  c('ch-taberu-carrot', 'saserareru', 'taberu', '🥕', 'I was made to eat carrots', 'にんじんを たべさせられた'),
  c('ch-souji', 'saserareru', 'souji', '🧽', 'I was made to clean the toilet', 'トイレを そうじさせられた'),
  c('ch-hashiru-pe', 'saserareru', 'hashiru', '🏃‍♂️', 'I was made to run laps in PE', 'たいいくで なんしゅうも はしらされた'),
  c('ch-nomu-boss', 'saserareru', 'nomu', '🍶', 'My boss made me drink', 'ぶちょうに のまされた', CHEEKY),
  // 迷惑の受身 suffering passive (3.2): always someone (or the rain) who did it, with に
  c('ch-furu', 'suffering-passive', 'furu', '🌧️', 'I got caught in the rain', 'あめに ふられた'),
  c('ch-naku', 'suffering-passive', 'naku', '👶', 'The baby cried on me all night', 'あかちゃんに ひとばんじゅう なかれた'),
  c('ch-kuru', 'suffering-passive', 'kuru', '🚪', 'My friends turned up without warning', 'きゅうに ともだちに こられた'),
  c('ch-nigeru', 'suffering-passive', 'nigeru', '🐈', 'My cat ran away on me', 'ねこに にげられた'),
  c('ch-suwaru', 'suffering-passive', 'suwaru', '💺', 'A stranger sat in my seat', 'しらない ひとに すわられた'),
  c('ch-yasumu', 'suffering-passive', 'yasumu', '🤒', 'My coworker took the day off on me', 'どうりょうに やすまれた', FAMILY),
  // ＿ずに without (3.6)
  c('ch-taberu-breakfast', 'zu-ni', 'taberu', '🍳', 'I went out without eating breakfast', 'あさごはんを たべずに でかけた'),
  c('ch-neru', 'zu-ni', 'neru', '🌙', 'I studied all night without sleeping', 'ねずに べんきょうした'),
  c('ch-benkyou', 'zu-ni', 'benkyou', '📚', 'I took the test without studying', 'べんきょうせずに テストを うけた'),
  c('ch-motsu', 'zu-ni', 'motsu', '☂️', 'I went out without an umbrella', 'かさを もたずに でかけた'),
  c('ch-harau', 'zu-ni', 'harau', '💸', 'He left without paying', 'おかねを はらわずに かえった', FAMILY),
  // ＿ようと する tried to (3.6)
  c('ch-okiru-try', 'you-to-suru', 'okiru', '🛌', 'I tried to get up early', 'はやく おきようと した'),
  c('ch-taberu-dog', 'you-to-suru', 'taberu', '🐕', 'The dog tried to eat my cake', 'いぬが ケーキを たべようと した'),
  c('ch-tsukeru-tv', 'you-to-suru', 'tsukeru', '📺', 'I tried to turn on the TV', 'テレビを つけようと した'),
  c('ch-kaeru', 'you-to-suru', 'kaeru', '🏠', 'I was just about to go home', 'ちょうど かえろうと した'),
  // ＿っぱなし left that way (3.2)
  c('ch-tsukeru', 'ppanashi', 'tsukeru', '💡', 'The light was left on', 'でんきが つけっぱなしだった'),
  c('ch-akeru', 'ppanashi', 'akeru', '🪟', 'The window was left open', 'まどが あけっぱなしだった'),
  c('ch-dasu', 'ppanashi', 'dasu', '🧃', 'The juice was left out of the fridge', 'ジュースが だしっぱなしだった'),
  c('ch-oku', 'ppanashi', 'oku', '🧦', 'Socks left lying on the floor', 'くつしたが ゆかに おきっぱなし'),
  c('ch-wasureru', 'ppanashi', 'wasureru', '📒', 'My homework, forgotten and left that way', 'しゅくだいを わすれっぱなし'),
  // ＿かける half-done (3.2)
  c('ch-yomu-half', 'kakeru', 'yomu', '📚', 'a half-read book', 'よみかけの ほん'),
  c('ch-taberu-donut', 'kakeru', 'taberu', '🍩', 'a half-eaten donut', 'たべかけの ドーナツ'),
  c('ch-korobu', 'kakeru', 'korobu', '🍌', 'I nearly slipped on a banana', 'バナナで ころびかけた'),
  c('ch-neru-class', 'kakeru', 'neru', '😴', 'I nearly fell asleep in class', 'じゅぎょうで ねかけた'),
  c('ch-tokeru', 'kakeru', 'tokeru', '🍦', 'My ice cream is half melted', 'アイスが とけかけて いる'),
  c('ch-kieru', 'kakeru', 'kieru', '🕯️', 'The candle nearly went out', 'ろうそくが きえかけた'),
  // ＿きる all the way (3.2)
  c('ch-taberu-pizza', 'kiru', 'taberu', '🍕', "I can't eat all of this", 'こんなに たくさん たべきれない'),
  c('ch-matsu-birthday', 'kiru', 'matsu', '🎁', "I can't wait for my birthday", 'たんじょうびが まちきれない'),
  c('ch-oboeru', 'kiru', 'oboeru', '🔤', "There are too many kanji to memorise", 'かんじが おおすぎて おぼえきれない'),
  c('ch-hashiru-marathon', 'kiru', 'hashiru', '🏅', 'I ran the whole marathon', 'マラソンを はしりきった'),
  c('ch-tsukau', 'kiru', 'tsukau', '🖍️', 'I used up all my crayons', 'クレヨンを つかいきった'),
  c('ch-nomu-soup', 'kiru', 'nomu', '🍜', 'I drank all the soup', 'スープを ぜんぶ のみきった', FAMILY),
  // ＿たて fresh from (3.11)
  c('ch-yaku', 'tate', 'yaku', '🍞', 'fresh-baked bread', 'やきたての パン'),
  c('ch-dekiru', 'tate', 'dekiru', '🍙', 'freshly made rice balls', 'できたての おにぎり'),
  c('ch-nuru', 'tate', 'nuru', '🎨', 'Wet paint! (freshly painted)', 'ペンキ ぬりたて'),
  c('ch-umareru', 'tate', 'umareru', '🐣', 'a newborn chick', 'うまれたての ひよこ'),
  c('ch-ireru', 'tate', 'ireru', '🍵', 'freshly made tea', 'いれたての おちゃ'),
  c('ch-oboeru-new', 'tate', 'oboeru', '🗣️', 'my brand-new Japanese', 'おぼえたての にほんご'),
];

const b = (
  id: string,
  badge: BadgeId,
  verbId: string,
  gist: string,
  kana: string,
  pieces: readonly [string, BadgeId][],
  audiences?: readonly KatsuyoAudience[],
): KatsuyoBossLine => ({
  id,
  badge,
  verbId,
  gist,
  line: jp(kana, gist),
  pieces: pieces.map(([v, x]) => ({ verbId: v, badge: x })),
  ...(audiences ? { audiences } : {}),
  status: 'draft',
});

export const KATSUYO_BOSS_LINES: readonly KatsuyoBossLine[] = [
  // Every room
  b('boss-breakfast', 'zu-ni', 'taberu', 'I ran to school without eating breakfast.', 'あさごはんを たべずに がっこうまで はしった', [['taberu', 'zu-ni'], ['hashiru', 'potential'], ['okiru', 'you-to-suru']]),
  b('boss-futon', 'you-to-suru', 'neru', 'Just as I was about to go to sleep, the cat jumped onto my futon.', 'ねようと したら、ねこが ふとんに とびのって きた', [['neru', 'you-to-suru'], ['neru', 'potential'], ['neru', 'kakeru']]),
  b('boss-light', 'ppanashi', 'tsukeru', 'I fell asleep with the light left on.', 'でんきを つけっぱなしで ねて しまった', [['tsukeru', 'ppanashi'], ['neru', 'kakeru'], ['tsukeru', 'zu-ni']]),
  b('boss-manga', 'kakeru', 'yomu', 'I left my half-read manga on the bus.', 'よみかけの まんがを バスに わすれた', [['yomu', 'kakeru'], ['wasureru', 'zu-ni'], ['yomu', 'potential']]),
  b('boss-grandma', 'kiru', 'taberu', "Grandma made so much food I couldn't eat it all.", 'おばあちゃんの りょうりが おおすぎて、たべきれなかった', [['taberu', 'kiru'], ['tsukuru', 'passive'], ['taberu', 'causative']]),
  b('boss-bread', 'tate', 'yaku', 'My little sister ate all the fresh-baked bread.', 'やきたての パンを いもうとに ぜんぶ たべられた', [['yaku', 'tate'], ['taberu', 'passive'], ['taberu', 'kiru']]),
  b('boss-classroom', 'saserareru', 'souji', 'The teacher made me clean the classroom.', 'せんせいに きょうしつを そうじさせられた', [['souji', 'saserareru'], ['souji', 'zu-ni'], ['souji', 'causative']]),
  b('boss-rain', 'suffering-passive', 'furu', 'I got caught in the rain on the way home and got soaked.', 'かえりに あめに ふられて、びしょびしょに なった', [['kaeru', 'you-to-suru'], ['kaeru', 'potential'], ['kaeru', 'zu-ni']]),
  b('boss-homework', 'zu-ni', 'benkyou', 'I played games without studying, and Mum told me off.', 'べんきょうせずに ゲームを して、ははに しかられた', [['benkyou', 'zu-ni'], ['shikaru', 'passive'], ['yaru', 'kakeru']]),
  b('boss-icecream', 'kakeru', 'tokeru', 'My ice cream was half melted, so I ate it fast.', 'アイスが とけかけて いたので、いそいで たべた', [['tokeru', 'kakeru'], ['taberu', 'yasui-nikui'], ['taberu', 'kiru']]),
  b('boss-baby', 'suffering-passive', 'naku', "The baby next door cried all night, so I couldn't sleep.", 'となりの あかちゃんに なかれて、ねられなかった', [['naku', 'causative'], ['neru', 'potential'], ['naku', 'zu-ni']]),
  b('boss-carrots', 'saserareru', 'taberu', 'At school lunch I was made to eat carrots I hate.', 'きゅうしょくで きらいな にんじんを たべさせられた', [['taberu', 'saserareru'], ['taberu', 'potential'], ['taberu', 'zu-ni']]),
  // Family and Cheeky
  b('boss-karaoke', 'saserareru', 'utau', 'My boss made me sing at karaoke.', 'ぶちょうに カラオケで うたわされた', [['utau', 'saserareru'], ['utau', 'potential'], ['utau', 'zu-ni']], FAMILY),
  b('boss-train', 'you-to-suru', 'noru', 'Just as I tried to get on the train, the doors closed.', 'でんしゃに のろうと したら、ドアが しまった', [['noru', 'you-to-suru'], ['noru', 'potential'], ['noru', 'zu-ni']], FAMILY),
  b('boss-coffee', 'tate', 'ireru', 'I spilled freshly made coffee on my trousers.', 'いれたての コーヒーを ズボンに こぼした', [['ireru', 'tate'], ['ireru', 'ppanashi'], ['nomu', 'potential']], FAMILY),
  b('boss-window', 'ppanashi', 'akeru', 'I went out with the window left open, and a cat got into my room.', 'まどを あけっぱなしで でかけたら、へやに ねこが はいって いた', [['akeru', 'ppanashi'], ['akeru', 'zu-ni'], ['akeru', 'you-to-suru']], FAMILY),
  b('boss-books', 'kiru', 'yomu', 'I read three whole books in one week.', 'いっしゅうかんで ほんを さんさつ よみきった', [['yomu', 'kiru'], ['yomu', 'yasui-nikui'], ['yomu', 'kakeru']], FAMILY),
  // Cheeky
  b('boss-nomikai', 'saserareru', 'utau', 'At the work drinks, the boss made me sing.', 'のみかいで ぶちょうに うたわされた', [['utau', 'saserareru'], ['nomu', 'saserareru'], ['nomu', 'kiru']], CHEEKY),
  b('boss-drunk-light', 'ppanashi', 'tsukeru', 'I got drunk and slept with the light left on.', 'よっぱらって でんきを つけっぱなしで ねた', [['tsukeru', 'ppanashi'], ['nomu', 'kiru'], ['neru', 'zu-ni']], CHEEKY),
  b('boss-date-wallet', 'zu-ni', 'motsu', 'I went on a date without my wallet and made them pay for everything.', 'さいふを もたずに デートに いって、ぜんぶ はらわせた', [['motsu', 'zu-ni'], ['harau', 'causative'], ['iku', 'zu-ni']], CHEEKY),
  b('boss-date-rain', 'suffering-passive', 'furu', 'I got rained on before my date, and my hair was a mess.', 'デートの まえに あめに ふられて、かみが ぐちゃぐちゃに なった', [['iku', 'you-to-suru'], ['iku', 'potential'], ['iku', 'zu-ni']], CHEEKY),
  b('boss-sneak', 'you-to-suru', 'kaeru', 'I tried to sneak home early and the boss spotted me.', 'こっそり かえろうと したら、ぶちょうに みつかった', [['kaeru', 'you-to-suru'], ['kaeru', 'potential'], ['kaeru', 'zu-ni']], CHEEKY),
  b('boss-beer', 'kakeru', 'nomu', 'Someone drank my half-finished beer.', 'のみかけの ビールを だれかに のまれた', [['nomu', 'kakeru'], ['nomu', 'potential'], ['nomu', 'saserareru']], CHEEKY),
  b('boss-newbie', 'tate', 'oboeru', 'I tried out my brand-new Japanese at the bar, and nobody understood.', 'おぼえたての にほんごを バーで つかったら、だれにも つうじなかった', [['oboeru', 'tate'], ['tsukau', 'potential'], ['hanasu', 'yasui-nikui']], CHEEKY),
];
