// Word Gauntlet's rumour round (うわさの でんごんゲーム, N4 and up): Nobiko-san's rumours about the
// studio's yōkai, the fins players add as they pass them on (うわさに おひれが つく), and the reported-speech
// frames the round practises. See docs/modes/word-gauntlet.md, "Round 2b".
//
// STATUS: draft. Every Japanese line here needs a fluent speaker's check before it ships.
//
// Rules for writing more:
// - A rumour is always about a studio yōkai or a host, never about a player (the round also refuses a
//   relay that names a player).
// - `what` is an action, so it takes で for the place, and it has a plain form (for every rumour frame)
//   and a polite form (the N5 line).
// - The truth is mundane (or, now and then, stranger than the rumour). Nobiko-san says it, so it is in
//   her voice. It is the round's punchline.
// - A fin is something you could add to any rumour: when, how, with whom. Time fins go before the place,
//   the rest after it (time → place → how), and a rumour holds one time fin at a time.

import type { JpText, ReviewStatus } from '../../../../content/src/types.js';
import type { Audience } from '../../protocol.js';
import { normalizeReading } from '../../japanese/kana.js';
import { framesOf } from '../../japanese/frames.js';
import type { UtteranceToken } from '../../japanese/kana.js';

export const RUMOURS_STATUS: ReviewStatus = 'draft';

/** One part of a rumour, with the kana a relay must still contain to have kept it. */
export interface RumourBit {
  kana: string;
  en: string;
  /** Kana (any one is enough) that show the part survived the relay. Compared after normalizeReading. */
  keys: string[];
}

export interface RumourSeed {
  id: string;
  /** Untagged seeds play in every room; 'cheeky' ones only when the room's Audience is Cheeky. */
  audience?: 'cheeky';
  /** Who the rumour is about: a studio yōkai or a host. */
  who: RumourBit & { sprite: string | null };
  /** Where, with its で. */
  where: RumourBit;
  /** What they're up to: the plain form (for the rumour frames) and the polite form (the N5 line). */
  what: RumourBit & { masu: string };
  /** Who saw it (the source for ＿に よると and ＿と いって いました). Never a player. */
  source: { kana: string; en: string };
  /** What really happened, in Nobiko-san's voice: the round's last line. */
  truth: JpText;
  /** Nobiko-san's own opener, when the default one wouldn't fit (a rumour about herself). */
  opener?: JpText;
}

export interface RumourFin {
  id: string;
  kana: string;
  en: string;
  /** The short tile a Kana player taps and says. */
  tile: string;
  keys: string[];
  /** Time fins go first in the sentence. */
  kind: 'time' | 'how';
  /** A big, visual fin: every hand of cards has at least one. */
  big?: boolean;
  audience?: 'cheeky';
}

const S = (path: string) => `/stage/assets/${path}.png`;

export const RUMOUR_SEEDS: readonly RumourSeed[] = [
  {
    id: 'chochin-dance',
    who: { kana: 'ちょうちんさん', en: 'Chōchin-san', keys: ['ちょうちん', 'ちょちん'], sprite: S('hosts/chochin') },
    where: { kana: 'こうえんで', en: 'in the park', keys: ['こうえん'] },
    what: { kana: 'ダンスを ならって いる', masu: 'ダンスを ならって います', en: 'is taking dance lessons', keys: ['だんす', 'おどっ', 'おどり'] },
    source: { kana: 'カッパ', en: 'the kappa' },
    truth: { text: 'ほんとうは、こうえんで ラジオたいそうを して いた だけなのよ。スタンプカード、もう いっぱいですって。', kana: 'ほんとうは、こうえんで ラジオたいそうを して いた だけなのよ。スタンプカード、もう いっぱいですって。', en: 'Really, he was just doing the morning radio exercises in the park. His stamp card is already full, apparently.' },
  },
  {
    id: 'fude-letter',
    who: { kana: 'フデさん', en: 'Fude-san', keys: ['ふで'], sprite: S('hosts/fude') },
    where: { kana: 'コンビニで', en: 'at the konbini', keys: ['こんびに'] },
    what: { kana: 'ラブレターを かいて いる', masu: 'ラブレターを かいて います', en: 'is writing a love letter', keys: ['らぶれた', 'れたあ', 'てがみ'] },
    source: { kana: 'ポン', en: 'Pon' },
    truth: { text: 'ほんとうは、かいものの メモだったのよ。ハートに みえたのは、トマトの え。', kana: 'ほんとうは、かいものの メモだったのよ。ハートに みえたのは、トマトの え。', en: 'Really, it was a shopping list. The heart everyone saw was a drawing of a tomato.' },
  },
  {
    id: 'pon-omamori',
    who: { kana: 'ポン', en: 'Pon', keys: ['ぽん'], sprite: S('hosts/pon') },
    where: { kana: 'じんじゃで', en: 'at the shrine', keys: ['じんじゃ'] },
    what: { kana: 'おまもりを あつめて いる', masu: 'おまもりを あつめて います', en: 'is collecting good-luck charms', keys: ['おまもり'] },
    source: { kana: 'フデさん', en: 'Fude-san' },
    truth: { text: 'ほんとうは、ひとつ かった だけ。ちこく しない おまもりよ。きかないけど。', kana: 'ほんとうは、ひとつ かった だけ。ちこく しない おまもりよ。きかないけど。', en: "Really, he bought just one. A charm against being late. It doesn't work." },
  },
  {
    id: 'kappa-swim',
    who: { kana: 'カッパ', en: 'the kappa', keys: ['かっぱ'], sprite: S('yokai/book/yokai-kappa') },
    where: { kana: 'プールで', en: 'at the pool', keys: ['ぷうる'] },
    what: { kana: 'およぎを ならって いる', masu: 'およぎを ならって います', en: 'is taking swimming lessons', keys: ['およぎ', 'およい', 'およぐ', 'すいえい'] },
    source: { kana: 'ちょうちんさん', en: 'Chōchin-san' },
    truth: { text: 'ほんとうは、カッパが せんせいなの。せいとは まだ ひとりも いないのよ。', kana: 'ほんとうは、カッパが せんせいなの。せいとは まだ ひとりも いないのよ。', en: "Really, the kappa is the teacher. He hasn't got a single student yet." },
  },
  {
    id: 'yukionna-oden',
    who: { kana: 'ゆきおんな', en: 'the snow woman', keys: ['ゆきおんな'], sprite: null },
    where: { kana: 'やたいで', en: 'at a food stall', keys: ['やたい'] },
    what: { kana: 'あつい おでんを たべて いる', masu: 'あつい おでんを たべて います', en: 'is eating piping-hot oden', keys: ['おでん'] },
    source: { kana: 'フデさん', en: 'Fude-san' },
    truth: { text: 'ほんとうは、おでんを ふうふう したら、ぜんぶ こおっちゃったのよ。おでんアイス、よく うれたわ。', kana: 'ほんとうは、おでんを ふうふう したら、ぜんぶ こおっちゃったのよ。おでんアイス、よく うれたわ。', en: 'Really, she blew on the oden to cool it and froze the lot. Oden ice lollies sold very well.' },
  },
  {
    id: 'nobiko-date',
    who: { kana: 'のびこさん', en: 'Nobiko-san', keys: ['のびこ'], sprite: S('hosts/nobiko') },
    where: { kana: 'スタジオで', en: 'at the studio', keys: ['すたじお'] },
    what: { kana: 'ひみつの デートを して いる', masu: 'ひみつの デートを して います', en: 'is going on a secret date', keys: ['でえと'] },
    source: { kana: 'ちょうちんさん', en: 'Chōchin-san' },
    opener: { text: 'ちょっと きいて！ のびこさんが スタジオで ひみつの デートを して いるって うわさが あるの。…わたしの ことよ！ ないしょね。', kana: 'ちょっと きいて！ のびこさんが スタジオで ひみつの デートを して いるって うわさが あるの。…わたしの ことよ！ ないしょね。', en: "Listen! There's a rumour that Nobiko-san is going on a secret date at the studio. …That's me! Keep it quiet." },
    truth: { text: 'ちょっと！ あいては うちの だんなよ。こたつごと でて きたの。じゅうねんぶりに！', kana: 'ちょっと！ あいては うちの だんなよ。こたつごと でて きたの。じゅうねんぶりに！', en: 'Excuse me! That was my husband. He came out, kotatsu and all. First time in ten years!' },
  },
  {
    id: 'umbrella-haircut',
    who: { kana: 'からかさおばけ', en: 'the umbrella ghost', keys: ['からかさ', 'かさおばけ', 'かさのおばけ'], sprite: S('yokai/yokai-umbrella') },
    where: { kana: 'びよういんで', en: 'at the hair salon', keys: ['びよういん', 'とこや'] },
    what: { kana: 'かみを きって もらって いる', masu: 'かみを きって もらって います', en: 'is getting a haircut', keys: ['かみを', 'かみき', 'さんぱつ'] },
    source: { kana: 'カッパ', en: 'the kappa' },
    truth: { text: 'ほんとうは、かみは かみでも、かさの かみよ。やぶれたから、はりかえて もらって いたの。', kana: 'ほんとうは、かみは かみでも、かさの かみよ。やぶれたから、はりかえて もらって いたの。', en: 'Really, it was paper, not hair (both are かみ): his umbrella paper. It tore, so he was having it replaced.' },
  },
  {
    id: 'nekomata-sushi',
    who: { kana: 'ねこまた', en: 'the nekomata', keys: ['ねこまた'], sprite: S('yokai/book/yokai-nekomata') },
    where: { kana: 'すしやで', en: 'at the sushi bar', keys: ['すしや', 'すし'] },
    what: { kana: 'アルバイトを して いる', masu: 'アルバイトを して います', en: 'has a part-time job', keys: ['あるばいと', 'ばいと'] },
    source: { kana: 'ポン', en: 'Pon' },
    truth: { text: 'ほんとうは、おみせの マスコットなの。きゅうりょうは マグロで もらって いるわ。', kana: 'ほんとうは、おみせの マスコットなの。きゅうりょうは マグロで もらって いるわ。', en: "Really, she's the shop's mascot. She gets paid in tuna." },
  },
  {
    id: 'daruma-marathon',
    who: { kana: 'だるま', en: 'the daruma', keys: ['だるま'], sprite: S('yokai/book/yokai-daruma') },
    where: { kana: 'ジムで', en: 'at the gym', keys: ['じむで', 'じむに', 'すぽおつくらぶ'] },
    what: { kana: 'マラソンの れんしゅうを して いる', masu: 'マラソンの れんしゅうを して います', en: 'is training for a marathon', keys: ['まらそん'] },
    source: { kana: 'ちょうちんさん', en: 'Chōchin-san' },
    truth: { text: 'ほんとうは、ころがって いた だけ。あしが ないもの。いちばん はやかったけど、とまれなかったわ。', kana: 'ほんとうは、ころがって いた だけ。あしが ないもの。いちばん はやかったけど、とまれなかったわ。', en: "Really, he was just rolling about. He has no legs. He was the fastest there, but he couldn't stop." },
  },
  // ---- More for every room (2026-11-01: Family rooms get 20) ----
  {
    id: 'bakezori-tap',
    who: { kana: 'ばけぞうり', en: 'the haunted sandal', keys: ['ばけぞうり', 'ぞうり'], sprite: S('yokai/book/yokai-bakezori') },
    where: { kana: 'えきで', en: 'at the station', keys: ['えきで', 'えきの'] },
    what: { kana: 'タップダンスの れんしゅうを して いる', masu: 'タップダンスの れんしゅうを して います', en: 'is practising tap dance', keys: ['たっぷ'] },
    source: { kana: 'カッパ', en: 'the kappa' },
    truth: { text: 'ほんとうは、かたほうを さがして いた だけなの。ずっと ケンケンで あるいて いたから、そう みえたのね。', kana: 'ほんとうは、かたほうを さがして いた だけなの。ずっと ケンケンで あるいて いたから、そう みえたのね。', en: "Really, he was just looking for his other half. He'd been hopping on one foot the whole time, so it looked like dancing." },
  },
  {
    id: 'dobin-date',
    who: { kana: 'どびんさん', en: 'Dobin-san the teapot', keys: ['どびん'], sprite: S('yokai/book/yokai-dobin') },
    where: { kana: 'きっさてんで', en: 'at a café', keys: ['きっさてん'] },
    what: { kana: 'こいびとを まって いる', masu: 'こいびとを まって います', en: 'is waiting for a sweetheart', keys: ['こいびと'] },
    source: { kana: 'フデさん', en: 'Fude-san' },
    truth: { text: 'ほんとうは、おゆが わくのを まって いたのよ。じぶんが どびんなのに。', kana: 'ほんとうは、おゆが わくのを まって いたのよ。じぶんが どびんなのに。', en: 'Really, she was waiting for the water to boil. Even though she IS the teapot.' },
  },
  {
    id: 'hitodama-library',
    who: { kana: 'ひとだま', en: 'the hitodama', keys: ['ひとだま'], sprite: S('yokai/book/yokai-hitodama') },
    where: { kana: 'としょかんで', en: 'at the library', keys: ['としょかん'] },
    what: { kana: 'しけんの べんきょうを して いる', masu: 'しけんの べんきょうを して います', en: 'is studying for an exam', keys: ['しけん'] },
    source: { kana: 'ちょうちんさん', en: 'Chōchin-san' },
    truth: { text: 'ほんとうは、としょかんの でんきが きれて いたの。ひとだまが ずっと あかりの かわりを して いたのよ。', kana: 'ほんとうは、としょかんの でんきが きれて いたの。ひとだまが ずっと あかりの かわりを して いたのよ。', en: "Really, the library's lights had gone out. The hitodama was standing in as the lamp." },
  },
  {
    id: 'kitsunebi-guitar',
    who: { kana: 'きつねび', en: 'the fox fire', keys: ['きつねび'], sprite: S('yokai/book/yokai-kitsunebi') },
    where: { kana: 'キャンプじょうで', en: 'at the campsite', keys: ['きゃんぷ'] },
    what: { kana: 'ギターを ひいて いる', masu: 'ギターを ひいて います', en: 'is playing the guitar', keys: ['ぎたあ'] },
    source: { kana: 'ポン', en: 'Pon' },
    truth: { text: 'ほんとうは、キャンプファイヤーの ふりを して いたの。みんな マシュマロを やいて いたわ。', kana: 'ほんとうは、キャンプファイヤーの ふりを して いたの。みんな マシュマロを やいて いたわ。', en: 'Really, he was pretending to be the campfire. Everyone was toasting marshmallows on him.' },
  },
  {
    id: 'kodama-karaoke',
    who: { kana: 'こだま', en: 'the kodama', keys: ['こだま'], sprite: S('yokai/book/yokai-kodama') },
    where: { kana: 'やまで', en: 'in the mountains', keys: ['やまで', 'やまの', 'やまに'] },
    what: { kana: 'カラオケを して いる', masu: 'カラオケを して います', en: 'is doing karaoke', keys: ['からおけ'] },
    source: { kana: 'フデさん', en: 'Fude-san' },
    truth: { text: 'ほんとうは、やまびこの しごとちゅうだったのよ。だれかが 「ヤッホー」って いうと、「ヤッホー」って かえすの。', kana: 'ほんとうは、やまびこの しごとちゅうだったのよ。だれかが 「ヤッホー」って いうと、「ヤッホー」って かえすの。', en: "Really, he was at work as the echo. When someone shouts 'Yoo-hoo!', he shouts it back." },
  },
  {
    id: 'toro-yoga',
    who: { kana: 'とうろうさん', en: 'Tōrō-san the stone lantern', keys: ['とうろう'], sprite: S('yokai/book/yokai-toro') },
    where: { kana: 'にわで', en: 'in the garden', keys: ['にわで', 'にわの'] },
    what: { kana: 'ヨガを して いる', masu: 'ヨガを して います', en: 'is doing yoga', keys: ['よが'] },
    source: { kana: 'ねこまた', en: 'the nekomata' },
    truth: { text: 'ほんとうは、ずっと たって いた だけなの。もう ひゃくねんも おなじ ポーズよ。', kana: 'ほんとうは、ずっと たって いた だけなの。もう ひゃくねんも おなじ ポーズよ。', en: 'Really, he was just standing there. Same pose for a hundred years.' },
  },
  {
    id: 'tsurube-nap',
    who: { kana: 'つるべおとし', en: 'the tsurube-otoshi', keys: ['つるべ'], sprite: S('yokai/book/yokai-tsurube') },
    where: { kana: 'きの うえで', en: 'up a tree', keys: ['きのうえ'] },
    what: { kana: 'ひるねを して いる', masu: 'ひるねを して います', en: 'is taking a nap', keys: ['ひるね'] },
    source: { kana: 'カッパ', en: 'the kappa' },
    truth: { text: 'ほんとうは、おちる れんしゅうを して いたのよ。でも こわくて、まだ いちども おちて いないの。', kana: 'ほんとうは、おちる れんしゅうを して いたのよ。でも こわくて、まだ いちども おちて いないの。', en: "Really, he was practising dropping on people. But he's scared, so he hasn't dropped once yet." },
  },
  {
    id: 'tengu-airport',
    who: { kana: 'てんぐ', en: 'the tengu', keys: ['てんぐ'], sprite: null },
    where: { kana: 'くうこうで', en: 'at the airport', keys: ['くうこう'] },
    what: { kana: 'ひこうきの チケットを かって いる', masu: 'ひこうきの チケットを かって います', en: 'is buying a plane ticket', keys: ['ちけっと', 'ひこうき'] },
    source: { kana: 'ちょうちんさん', en: 'Chōchin-san' },
    truth: { text: 'ほんとうは、おみやげを かって いた だけなの。じぶんで とべるもの。', kana: 'ほんとうは、おみやげを かって いた だけなの。じぶんで とべるもの。', en: 'Really, he was just buying souvenirs. He can fly on his own.' },
  },
  {
    id: 'zashiki-hotel',
    who: { kana: 'ざしきわらし', en: 'the zashiki-warashi', keys: ['ざしきわらし', 'ざしき'], sprite: null },
    where: { kana: 'ホテルで', en: 'at a hotel', keys: ['ほてる'] },
    what: { kana: 'ひっこしの じゅんびを して いる', masu: 'ひっこしの じゅんびを して います', en: 'is getting ready to move out', keys: ['ひっこし'] },
    source: { kana: 'ポン', en: 'Pon' },
    truth: { text: 'ほんとうは、まくらなげの しあいを して いたのよ。ホテルの ひと、みんな まけたわ。', kana: 'ほんとうは、まくらなげの しあいを して いたのよ。ホテルの ひと、みんな まけたわ。', en: 'Really, she was having a pillow fight. The hotel staff all lost.' },
  },
  {
    id: 'pon-bakery',
    who: { kana: 'ポン', en: 'Pon', keys: ['ぽん'], sprite: S('hosts/pon') },
    where: { kana: 'パンやで', en: 'at the bakery', keys: ['ぱんや'] },
    what: { kana: 'ケーキを つくって いる', masu: 'ケーキを つくって います', en: 'is baking a cake', keys: ['けえき'] },
    source: { kana: 'ちょうちんさん', en: 'Chōchin-san' },
    truth: { text: 'ほんとうは、パンを かいに いった だけ。でも ちこくして、おみせは もう しまって いたの。', kana: 'ほんとうは、パンを かいに いった だけ。でも ちこくして、おみせは もう しまって いたの。', en: 'Really, he only went to buy bread. But he was late, and the shop had already closed.' },
  },
  {
    id: 'kappa-aquarium',
    who: { kana: 'カッパ', en: 'the kappa', keys: ['かっぱ'], sprite: S('yokai/book/yokai-kappa') },
    where: { kana: 'すいぞくかんで', en: 'at the aquarium', keys: ['すいぞくかん'] },
    what: { kana: 'しごとを さがして いる', masu: 'しごとを さがして います', en: 'is looking for a job', keys: ['しごと'] },
    source: { kana: 'ゆきおんな', en: 'the snow woman' },
    truth: { text: 'ほんとうは、ペンギンに およぎを ならって いたの。こんどは カッパが せいとよ。', kana: 'ほんとうは、ペンギンに およぎを ならって いたの。こんどは カッパが せいとよ。', en: 'Really, he was taking swimming lessons from the penguins. This time the kappa is the student.' },
  },
  // ---- Cheeky (the room's Audience is Cheeky) ----
  {
    id: 'chochin-izakaya',
    audience: 'cheeky',
    who: { kana: 'ちょうちんさん', en: 'Chōchin-san', keys: ['ちょうちん', 'ちょちん'], sprite: S('hosts/chochin') },
    where: { kana: 'いざかやで', en: 'at an izakaya', keys: ['いざかや'] },
    what: { kana: 'えんかを うたって いる', masu: 'えんかを うたって います', en: 'is singing enka', keys: ['えんか', 'うたって'] },
    source: { kana: 'カッパ', en: 'the kappa' },
    truth: { text: 'ほんとうは、おみせの まえの あかちょうちんの ふりを して いたのよ。よっぱらいに 「ただいま」って いわれて いたわ。', kana: 'ほんとうは、おみせの まえの あかちょうちんの ふりを して いたのよ。よっぱらいに 「ただいま」って いわれて いたわ。', en: "Really, he was posing as the red lantern outside. Drunks kept telling him 'I'm home'." },
  },
  {
    id: 'fude-bar',
    audience: 'cheeky',
    who: { kana: 'フデさん', en: 'Fude-san', keys: ['ふで'], sprite: S('hosts/fude') },
    where: { kana: 'バーで', en: 'at a bar', keys: ['ばあで', 'ばあに'] },
    what: { kana: 'おきゃくさんに ポエムを よんで いる', masu: 'おきゃくさんに ポエムを よんで います', en: 'is reading his poems to the customers', keys: ['ぽえむ'] },
    source: { kana: 'ポン', en: 'Pon' },
    truth: { text: 'ほんとうは、メニューを かいて いた だけなのよ。「ハイボール ごひゃくえん」。もじが きれいすぎて、おきゃくさんが ないちゃったの。', kana: 'ほんとうは、メニューを かいて いた だけなのよ。「ハイボール ごひゃくえん」。もじが きれいすぎて、おきゃくさんが ないちゃったの。', en: "Really, he was only writing the menu. 'Highball, 500 yen.' The handwriting was so beautiful the customers cried." },
  },
  {
    id: 'pon-snack',
    audience: 'cheeky',
    who: { kana: 'ポン', en: 'Pon', keys: ['ぽん'], sprite: S('hosts/pon') },
    where: { kana: 'スナックで', en: 'at a snack bar', keys: ['すなっく'] },
    what: { kana: 'ママと デュエットを して いる', masu: 'ママと デュエットを して います', en: 'is singing duets with the mama-san', keys: ['でゅえっと'] },
    source: { kana: 'フデさん', en: 'Fude-san' },
    truth: { text: 'ほんとうは、ママは ポンの おかあさんなのよ。まいばん むかえに きて いるの。', kana: 'ほんとうは、ママは ポンの おかあさんなのよ。まいばん むかえに きて いるの。', en: "Really, the mama-san is Pon's mum. She comes to fetch him every night." },
  },
];

export const RUMOUR_FINS: readonly RumourFin[] = [
  { id: 'every-night', kana: 'まいばん', en: 'every night', tile: 'まいばん', keys: ['まいばん'], kind: 'time' },
  { id: 'midnight', kana: 'よなかに', en: 'in the middle of the night', tile: 'よなか', keys: ['よなか'], kind: 'time' },
  { id: 'five-am', kana: 'まいあさ ごじに', en: 'at five every morning', tile: 'ごじ', keys: ['ごじ'], kind: 'time' },
  { id: 'three-hours', kana: 'さんじかんも かけて', en: 'for three whole hours', tile: 'さんじかん', keys: ['さんじかん'], kind: 'time' },
  { id: 'alone', kana: 'ひとりで', en: 'all alone', tile: 'ひとり', keys: ['ひとり'], kind: 'how' },
  { id: 'secretly', kana: 'ないしょで', en: 'in secret', tile: 'ないしょ', keys: ['ないしょ'], kind: 'how' },
  { id: 'sunglasses', kana: 'サングラスを かけて', en: 'wearing sunglasses', tile: 'サングラス', keys: ['さんぐらす'], kind: 'how' , big: true },
  { id: 'singing', kana: 'うたいながら', en: 'while singing', tile: 'うたいながら', keys: ['うたいながら'], kind: 'how' },
  { id: 'crying', kana: 'なきながら', en: 'while crying', tile: 'なきながら', keys: ['なきながら'], kind: 'how' },
  { id: 'barefoot', kana: 'はだしで', en: 'barefoot', tile: 'はだし', keys: ['はだし'], kind: 'how' },
  { id: 'pink-kimono', kana: 'ピンクの きものを きて', en: 'in a pink kimono', tile: 'ピンク', keys: ['ぴんく'], kind: 'how' , big: true },
  { id: 'with-cat', kana: 'ねこと いっしょに', en: 'with a cat', tile: 'ねこ', keys: ['ねこと'], kind: 'how' },
  { id: 'wig', kana: 'かつらを かぶって', en: 'wearing a wig', tile: 'かつら', keys: ['かつら'], kind: 'how' , big: true },
  { id: 'tiny-hat', kana: 'ちいさい ぼうしを かぶって', en: 'in a tiny hat', tile: 'ぼうし', keys: ['ぼうし'], kind: 'how' },
  { id: 'skipping', kana: 'スキップしながら', en: 'skipping along', tile: 'スキップ', keys: ['すきっぷ'], kind: 'how' },
  { id: 'robot', kana: 'ロボットの まねを しながら', en: 'doing a robot impression', tile: 'ロボット', keys: ['ろぼっと'], kind: 'how' , big: true },
  { id: 'tv-camera', kana: 'テレビカメラに かこまれて', en: 'surrounded by TV cameras', tile: 'カメラ', keys: ['かめら'], kind: 'how', big: true },
  { id: 'loudly', kana: 'おおごえで', en: 'very loudly', tile: 'おおごえ', keys: ['おおごえ'], kind: 'how' },
  { id: 'panda', kana: 'パンダの きぐるみで', en: 'in a panda costume', tile: 'パンダ', keys: ['ぱんだ'], kind: 'how', big: true },
  { id: 'pon-pyjamas', kana: 'ポンの パジャマを きて', en: "in Pon's pyjamas", tile: 'パジャマ', keys: ['ぱじゃま'], kind: 'how', big: true },
  { id: 'handstand', kana: 'さかだちで', en: 'doing a handstand', tile: 'さかだち', keys: ['さかだち'], kind: 'how', big: true },
  { id: 'banana', kana: 'バナナを もって', en: 'holding a banana', tile: 'バナナ', keys: ['ばなな'], kind: 'how', big: true },
  { id: 'hundred-friends', kana: 'ともだち ひゃくにんと', en: 'with a hundred friends', tile: 'ひゃくにん', keys: ['ひゃくにん'], kind: 'how', big: true },
  // ---- Cheeky ----
  { id: 'drunk', kana: 'よっぱらって', en: 'drunk', tile: 'よっぱらって', keys: ['よっぱら'], kind: 'how', audience: 'cheeky' },
  { id: 'hungover', kana: 'ふつかよいで', en: 'hungover', tile: 'ふつかよい', keys: ['ふつかよい'], kind: 'how', audience: 'cheeky' },
  { id: 'skiving', kana: 'かいしゃを サボって', en: 'skipping work', tile: 'サボって', keys: ['さぼ'], kind: 'how', audience: 'cheeky' },
  { id: 'after-date', kana: 'デートの あとで', en: 'after a date', tile: 'デート', keys: ['でえと'], kind: 'time', audience: 'cheeky' },
  { id: 'with-ex', kana: 'もとカレと', en: 'with an ex', tile: 'もとカレ', keys: ['もとかれ'], kind: 'how', audience: 'cheeky', big: true },
  { id: 'missed-last-train', kana: 'しゅうでんを のがして', en: 'after missing the last train', tile: 'しゅうでん', keys: ['しゅうでん'], kind: 'time', audience: 'cheeky' },
];

/** A rumour keeps its newest three fins: older ones fall off, as they do in real gossip. */
export const MAX_FINS = 3;

// ---- the frames the round practises ----

export type RumourFrameId = 'sou-hear' | 'to-itte-ita' | 'ni-yoru' | 'rashii' | 'n-datte' | 'plain';

export interface RumourFrame {
  id: RumourFrameId;
  ja: string;
  en: string;
}

/** In the order N4 relayers are offered them (each N4 relayer's hint is the next one along). */
export const RUMOUR_FRAMES: readonly RumourFrame[] = [
  { id: 'sou-hear', ja: '＿そうです', en: 'I hear ___' },
  { id: 'to-itte-ita', ja: '＿と いって いました', en: '(Someone) said ___' },
  { id: 'n-datte', ja: '＿んだって', en: 'They say ___ (casual)' },
  { id: 'ni-yoru', ja: '＿に よると ＿そうです', en: 'According to ___, ___' },
  { id: 'rashii', ja: '＿らしいです', en: 'Apparently ___' },
  { id: 'plain', ja: '＿よ ／ ＿ね ／ ＿の？', en: 'Casual: plain form + よ, ね or の' },
];

const sp = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Time fins first, then the rest in the order they were added. */
function orderFins(fins: readonly RumourFin[]): RumourFin[] {
  return [...fins.filter((f) => f.kind === 'time'), ...fins.filter((f) => f.kind !== 'time')];
}

/** Adds a fin to a rumour: one time fin at a time (まいばん and まいあさ ごじに can't both be true), newest three kept. */
export function addFin(fins: readonly RumourFin[], fin: RumourFin): RumourFin[] {
  const rest = fins.filter((f) => f.id !== fin.id && (fin.kind !== 'time' || f.kind !== 'time'));
  return [...rest, fin].slice(-MAX_FINS);
}

/** Time → place → how, then the action: 「まいばん こうえんで ひとりで ダンスを ならって いる」. */
function middle(seed: RumourSeed, fins: readonly RumourFin[], what: string): string {
  const time = fins.filter((f) => f.kind === 'time').map((f) => f.kana).join(' ');
  const how = fins.filter((f) => f.kind !== 'time').map((f) => f.kana).join(' ');
  return sp(`${time} ${seed.where.kana} ${how} ${what}`);
}

/** The rumour's body in plain form: 「ちょうちんさんは まいばん こうえんで ダンスを ならって いる」. */
function body(seed: RumourSeed, fins: readonly RumourFin[], particle: 'は' | 'が'): string {
  return sp(`${seed.who.kana}${particle} ${middle(seed, fins, seed.what.kana)}`);
}

/** Casual speech: ならって いる → ならってる. */
const casual = (what: string) => what.replace(/て いる$/, 'てる').replace(/で いる$/, 'でる');

function bodyEn(seed: RumourSeed, fins: readonly RumourFin[]): string {
  const extra = orderFins(fins).map((f) => f.en).join(', ');
  return `${seed.who.en} ${seed.what.en} ${seed.where.en}${extra ? `, ${extra}` : ''}`;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Nobiko-san's model line for a rumour in a frame: the "Need a hint?" line, and the relay a stand-in passes on. */
export function rumourLine(seed: RumourSeed, fins: readonly RumourFin[], frame: RumourFrameId | 'n5'): JpText {
  let kana: string;
  let en: string;
  switch (frame) {
    case 'n5':
      kana = sp(`${seed.who.kana}は ${middle(seed, fins, seed.what.masu)}。`);
      en = `${cap(bodyEn(seed, fins))}.`;
      break;
    case 'sou-hear':
      kana = `${body(seed, fins, 'は')}そうです。`;
      en = `I hear ${bodyEn(seed, fins)}.`;
      break;
    case 'to-itte-ita':
      kana = `${seed.source.kana}は、${body(seed, fins, 'が')}と いって いました。`;
      en = `${cap(seed.source.en)} said ${bodyEn(seed, fins)}.`;
      break;
    case 'ni-yoru':
      kana = `${seed.source.kana}に よると、${body(seed, fins, 'は')}そうです。`;
      en = `According to ${seed.source.en}, ${bodyEn(seed, fins)}.`;
      break;
    case 'rashii':
      kana = `${body(seed, fins, 'は')}らしいです。`;
      en = `Apparently ${bodyEn(seed, fins)}.`;
      break;
    case 'n-datte':
      kana = `${seed.who.kana}、${middle(seed, fins, casual(seed.what.kana))}んだって！`;
      en = `They say ${bodyEn(seed, fins)}!`;
      break;
    case 'plain':
      kana = `ねえねえ、しってる？ ${seed.who.kana}、${middle(seed, fins, casual(seed.what.kana))}んだよ！`;
      en = `Hey, guess what? ${cap(bodyEn(seed, fins))}!`;
      break;
  }
  return { text: kana, kana, en };
}

/** Nobiko-san's opener, whispered to the first relayer only. */
export function rumourOpener(seed: RumourSeed): JpText {
  if (seed.opener) return seed.opener;
  const kana = `ねえ、きいた？ ${body(seed, [], 'は')}そうよ。ないしょね。`;
  return { text: kana, kana, en: `Psst, have you heard? ${cap(bodyEn(seed, []))}. Don't tell anyone.` };
}

/** Which parts of the rumour a relay kept. */
export function keptParts(seed: RumourSeed, reading: string): { who: boolean; where: boolean; what: boolean } {
  const r = normalizeReading(reading).replace(/[\s　、。！？!?,.]/g, '');
  const has = (keys: readonly string[]) => keys.some((k) => r.includes(normalizeReading(k)));
  return { who: has(seed.who.keys), where: has(seed.where.keys), what: has(seed.what.keys) };
}

export function finKept(fin: RumourFin, reading: string): boolean {
  const r = normalizeReading(reading).replace(/[\s　、。！？!?,.]/g, '');
  return fin.keys.some((k) => r.includes(normalizeReading(k)));
}

// Adjectives (and Nらしい "typical of N") that end in らしい aren't hearsay. Judged per らしい, so
// 「あたらしい みせで … する らしい」 still counts.
const NOT_RASHII = /(あた|めず|すば|かわい|いや|ばか|きたな|おとこ|おんな|こども|おとな|さん|くん|ちゃん)$/;
// A polite ending with よ／ね／の on it is still polite (いました よ), not the casual frame.
const POLITE_END = /(です|ます|でした|ました|ません|でしょう)(よ|ね|よね|の|わ)?[！!？?。…〜ー]*$/;

/** True when one らしい in the sentence is hearsay: after a plain form or ない, and not part of an adjective. */
function hasRashii(k: string): boolean {
  for (const m of k.matchAll(/らし(い|く|かった)/g)) {
    const before = k.slice(0, m.index);
    if (NOT_RASHII.test(before)) continue;
    if (/([うくぐすつぬぶむるいただ]|ない)$/.test(before)) return true;
  }
  return false;
}

/**
 * The rumour frame a relay used, or null. Uses the learning path's own matchers where they exist (so the
 * round and the path agree, including ＿に よると and ＿んだって at goal 4.6), plus forms the path doesn't have: ＿って！,
 * ＿んですって and ＿と ききました.
 */
export function rumourFrameOf(u: { text: string; reading?: string; tokens?: readonly UtteranceToken[] }): RumourFrameId | null {
  const kana = u.reading ?? u.text;
  const k = normalizeReading(kana).replace(/[\s　]/g, '');
  const found = new Set(framesOf({ text: u.text, kana }, u.tokens, { keepHidden: true }));
  const rashii = found.has('rashii') || hasRashii(k);
  if (found.has('ni-yoru') || (/によると/.test(k) && (/そう(です|だ|よ|な)/.test(k) || rashii))) return 'ni-yoru';
  // と in a quote follows a plain form (くると いって いました); ともだちと いって いました is "went with a friend".
  if (found.has('to-itte-ita') || found.has('tte-quote') || /([うくぐすつぬぶむるいただよね]と|って)(いって|ゆって)(い)?(ました|た|る|ます)/.test(k) || /[うくぐすつぬぶむるいただ]と(きき|きい)(ました|た)/.test(k)) return 'to-itte-ita';
  if (found.has('n-datte') || /(ん|の)(だ|です)って|なんだって/.test(k) || /([うくぐすつぬぶむるいただ]|ない)って[！!。…〜ー]*$/.test(k)) return 'n-datte';
  if (rashii) return 'rashii';
  if (found.has('sou-hear')) return 'sou-hear';
  if (!POLITE_END.test(k) && (found.has('plain') || /([うくぐすつぬぶむるいただ]|ない)(よ|ね|の)[！!？?。…]*$/.test(k))) return 'plain';
  return null;
}

/** The seeds for a room's Audience: Cheeky rooms get their own first, mixed with the rest. */
export function rumourSeeds(audience: Audience): RumourSeed[] {
  if (audience === 'cheeky') return [...RUMOUR_SEEDS];
  return RUMOUR_SEEDS.filter((s) => !s.audience);
}

export function rumourFins(audience: Audience): RumourFin[] {
  if (audience === 'cheeky') return [...RUMOUR_FINS];
  return RUMOUR_FINS.filter((f) => !f.audience);
}

export const rumourFin = (id: string): RumourFin | undefined => RUMOUR_FINS.find((f) => f.id === id);
