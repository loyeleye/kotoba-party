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
// - A fin is something you could add to any rumour: when, how, with whom. It sits before the place.

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
  audience?: 'cheeky';
}

const S = (path: string) => `/stage/assets/${path}.png`;

export const RUMOUR_SEEDS: readonly RumourSeed[] = [
  {
    id: 'chochin-dance',
    who: { kana: 'ちょうちんさん', en: 'Chōchin-san', keys: ['ちょうちん'], sprite: S('hosts/chochin') },
    where: { kana: 'こうえんで', en: 'in the park', keys: ['こうえん'] },
    what: { kana: 'ダンスを ならって いる', masu: 'ダンスを ならって います', en: 'is taking dance lessons', keys: ['だんす'] },
    source: { kana: 'カッパ', en: 'the kappa' },
    truth: { text: 'ほんとうは、こうえんで ラジオたいそうを して いた だけなのよ。まいあさ。', kana: 'ほんとうは、こうえんで ラジオたいそうを して いた だけなのよ。まいあさ。', en: 'Really, he was just doing the radio exercises in the park. Every morning.' },
  },
  {
    id: 'fude-letter',
    who: { kana: 'フデさん', en: 'Fude-san', keys: ['ふで'], sprite: S('hosts/fude') },
    where: { kana: 'コンビニで', en: 'at the konbini', keys: ['こんびに'] },
    what: { kana: 'ラブレターを かいて いる', masu: 'ラブレターを かいて います', en: 'is writing a love letter', keys: ['らぶれた', 'れたあ', 'てがみ'] },
    source: { kana: 'ポン', en: 'Pon' },
    truth: { text: 'ほんとうは、かいものの メモだったのよ。たまご、ぎゅうにゅう、パン。', kana: 'ほんとうは、かいものの メモだったのよ。たまご、ぎゅうにゅう、パン。', en: 'Really, it was a shopping list. Eggs, milk, bread.' },
  },
  {
    id: 'pon-omamori',
    who: { kana: 'ポン', en: 'Pon', keys: ['ぽん'], sprite: S('hosts/pon') },
    where: { kana: 'じんじゃで', en: 'at the shrine', keys: ['じんじゃ'] },
    what: { kana: 'おまもりを ひゃっこも かった', masu: 'おまもりを ひゃっこも かいました', en: 'bought a hundred good-luck charms', keys: ['おまもり'] },
    source: { kana: 'フデさん', en: 'Fude-san' },
    truth: { text: 'ほんとうは、ひとつ かった だけ。ちこく しない おまもりよ。きかないけど。', kana: 'ほんとうは、ひとつ かった だけ。ちこく しない おまもりよ。きかないけど。', en: "Really, he bought just one. A charm against being late. It doesn't work." },
  },
  {
    id: 'kappa-swim',
    who: { kana: 'カッパ', en: 'the kappa', keys: ['かっぱ'], sprite: S('yokai/book/yokai-kappa') },
    where: { kana: 'プールで', en: 'at the pool', keys: ['ぷうる'] },
    what: { kana: 'およぎかたを ならって いる', masu: 'およぎかたを ならって います', en: 'is taking swimming lessons', keys: ['およぎ', 'すいえい'] },
    source: { kana: 'ちょうちんさん', en: 'Chōchin-san' },
    truth: { text: 'ほんとうは、カッパが せんせいなの。せいとは まだ ゼロにんよ。', kana: 'ほんとうは、カッパが せんせいなの。せいとは まだ ゼロにんよ。', en: 'Really, the kappa is the teacher. So far he has zero students.' },
  },
  {
    id: 'yukionna-oden',
    who: { kana: 'ゆきおんな', en: 'the snow woman', keys: ['ゆきおんな'], sprite: null },
    where: { kana: 'やたいで', en: 'at a food stall', keys: ['やたい'] },
    what: { kana: 'あつい おでんを たべて いる', masu: 'あつい おでんを たべて います', en: 'is eating piping-hot oden', keys: ['おでん'] },
    source: { kana: 'フデさん', en: 'Fude-san' },
    truth: { text: 'ほんとうは、おでんを ぜんぶ こおらせて しまったのよ。やたいの ひとも。', kana: 'ほんとうは、おでんを ぜんぶ こおらせて しまったのよ。やたいの ひとも。', en: 'Really, she froze all the oden by accident. And the stall owner.' },
  },
  {
    id: 'nobiko-date',
    who: { kana: 'のびこさん', en: 'Nobiko-san', keys: ['のびこ'], sprite: S('hosts/nobiko') },
    where: { kana: 'スタジオで', en: 'at the studio', keys: ['すたじお'] },
    what: { kana: 'ひみつの デートを して いる', masu: 'ひみつの デートを して います', en: 'is going on a secret date', keys: ['でえと'] },
    source: { kana: 'ちょうちんさん', en: 'Chōchin-san' },
    truth: { text: 'ちょっと！ あいては うちの だんなよ。こたつごと きたの。', kana: 'ちょっと！ あいては うちの だんなよ。こたつごと きたの。', en: 'Excuse me! That was my husband. He came kotatsu and all.' },
  },
  {
    id: 'umbrella-haircut',
    who: { kana: 'からかさおばけ', en: 'the umbrella ghost', keys: ['からかさ', 'かさおばけ'], sprite: S('yokai/yokai-umbrella') },
    where: { kana: 'びよういんで', en: 'at the hair salon', keys: ['びよういん'] },
    what: { kana: 'かみを きって もらって いる', masu: 'かみを きって もらって います', en: 'is getting a haircut', keys: ['かみ'] },
    source: { kana: 'カッパ', en: 'the kappa' },
    truth: { text: 'ほんとうは、あまやどりを して いた だけなのよ。かさなのに。', kana: 'ほんとうは、あまやどりを して いた だけなのよ。かさなのに。', en: 'Really, he was just sheltering from the rain. Even though he is an umbrella.' },
  },
  {
    id: 'nekomata-sushi',
    who: { kana: 'ねこまた', en: 'the nekomata', keys: ['ねこまた'], sprite: S('yokai/book/yokai-nekomata') },
    where: { kana: 'すしやで', en: 'at the sushi bar', keys: ['すしや', 'すし'] },
    what: { kana: 'アルバイトを して いる', masu: 'アルバイトを して います', en: 'has a part-time job', keys: ['あるばいと', 'ばいと'] },
    source: { kana: 'ポン', en: 'Pon' },
    truth: { text: 'ほんとうは、カウンターで マグロを じっと みて いる だけなの。まいにち。', kana: 'ほんとうは、カウンターで マグロを じっと みて いる だけなの。まいにち。', en: 'Really, she just sits at the counter staring at the tuna. Every day.' },
  },
  {
    id: 'daruma-marathon',
    who: { kana: 'だるま', en: 'the daruma', keys: ['だるま'], sprite: S('yokai/book/yokai-daruma') },
    where: { kana: 'スポーツクラブで', en: 'at the gym', keys: ['すぽおつくらぶ', 'くらぶ', 'じむ'] },
    what: { kana: 'マラソンの れんしゅうを して いる', masu: 'マラソンの れんしゅうを して います', en: 'is training for a marathon', keys: ['まらそん'] },
    source: { kana: 'ちょうちんさん', en: 'Chōchin-san' },
    truth: { text: 'ほんとうは、ころがって いた だけ。でも いちばん はやかったのよ。', kana: 'ほんとうは、ころがって いた だけ。でも いちばん はやかったのよ。', en: 'Really, he was just rolling about. But he was the fastest there.' },
  },
  // ---- Cheeky (the room's Audience is Cheeky) ----
  {
    id: 'chochin-izakaya',
    audience: 'cheeky',
    who: { kana: 'ちょうちんさん', en: 'Chōchin-san', keys: ['ちょうちん'], sprite: S('hosts/chochin') },
    where: { kana: 'いざかやで', en: 'at an izakaya', keys: ['いざかや'] },
    what: { kana: 'えんかを うたって いる', masu: 'えんかを うたって います', en: 'is singing enka', keys: ['えんか', 'うたって'] },
    source: { kana: 'カッパ', en: 'the kappa' },
    truth: { text: 'ほんとうは、いざかやの ちょうちんの ふりを して いたのよ。いちばん あかるい ちょうちん。', kana: 'ほんとうは、いざかやの ちょうちんの ふりを して いたのよ。いちばん あかるい ちょうちん。', en: "Really, he was pretending to be the izakaya's lantern. The brightest one there." },
  },
  {
    id: 'fude-bar',
    audience: 'cheeky',
    who: { kana: 'フデさん', en: 'Fude-san', keys: ['ふで'], sprite: S('hosts/fude') },
    where: { kana: 'バーで', en: 'at a bar', keys: ['ばあ'] },
    what: { kana: 'おきゃくさんに ポエムを よんで いる', masu: 'おきゃくさんに ポエムを よんで います', en: 'is reading her poems to the customers', keys: ['ぽえむ'] },
    source: { kana: 'ポン', en: 'Pon' },
    truth: { text: 'ほんとうは、メニューを かいて いた だけなのよ。とても きれいな じで。', kana: 'ほんとうは、メニューを かいて いた だけなのよ。とても きれいな じで。', en: 'Really, she was only writing out the menu. In very nice handwriting.' },
  },
];

export const RUMOUR_FINS: readonly RumourFin[] = [
  { id: 'every-night', kana: 'まいばん', en: 'every night', tile: 'まいばん', keys: ['まいばん'], kind: 'time' },
  { id: 'midnight', kana: 'よなかに', en: 'in the middle of the night', tile: 'よなか', keys: ['よなか'], kind: 'time' },
  { id: 'five-am', kana: 'まいあさ ごじに', en: 'at five every morning', tile: 'ごじ', keys: ['ごじ'], kind: 'time' },
  { id: 'three-hours', kana: 'さんじかんも', en: 'for three whole hours', tile: 'さんじかん', keys: ['さんじかん'], kind: 'time' },
  { id: 'alone', kana: 'ひとりで', en: 'all alone', tile: 'ひとり', keys: ['ひとり'], kind: 'how' },
  { id: 'secretly', kana: 'ないしょで', en: 'in secret', tile: 'ないしょ', keys: ['ないしょ'], kind: 'how' },
  { id: 'sunglasses', kana: 'サングラスを かけて', en: 'wearing sunglasses', tile: 'サングラス', keys: ['さんぐらす'], kind: 'how' },
  { id: 'singing', kana: 'うたいながら', en: 'while singing', tile: 'うたいながら', keys: ['うたいながら'], kind: 'how' },
  { id: 'crying', kana: 'なきながら', en: 'while crying', tile: 'なきながら', keys: ['なきながら'], kind: 'how' },
  { id: 'barefoot', kana: 'はだしで', en: 'barefoot', tile: 'はだし', keys: ['はだし'], kind: 'how' },
  { id: 'pink-kimono', kana: 'ピンクの きものを きて', en: 'in a pink kimono', tile: 'ピンク', keys: ['ぴんく'], kind: 'how' },
  { id: 'with-cat', kana: 'ねこと いっしょに', en: 'with a cat', tile: 'ねこ', keys: ['ねこと'], kind: 'how' },
  { id: 'wig', kana: 'かつらを かぶって', en: 'wearing a wig', tile: 'かつら', keys: ['かつら'], kind: 'how' },
  { id: 'tiny-hat', kana: 'ちいさい ぼうしを かぶって', en: 'in a tiny hat', tile: 'ぼうし', keys: ['ぼうし'], kind: 'how' },
  { id: 'skipping', kana: 'スキップしながら', en: 'skipping along', tile: 'スキップ', keys: ['すきっぷ'], kind: 'how' },
  { id: 'robot', kana: 'ロボットの まねを しながら', en: 'doing a robot impression', tile: 'ロボット', keys: ['ろぼっと'], kind: 'how' },
  { id: 'tv-camera', kana: 'テレビカメラの まえで', en: 'in front of TV cameras', tile: 'カメラ', keys: ['かめら'], kind: 'how' },
  { id: 'loudly', kana: 'おおごえで', en: 'very loudly', tile: 'おおごえ', keys: ['おおごえ'], kind: 'how' },
  // ---- Cheeky ----
  { id: 'drunk', kana: 'よっぱらって', en: 'drunk', tile: 'よっぱらって', keys: ['よっぱら'], kind: 'how', audience: 'cheeky' },
  { id: 'hungover', kana: 'ふつかよいで', en: 'hungover', tile: 'ふつかよい', keys: ['ふつかよい'], kind: 'how', audience: 'cheeky' },
  { id: 'skiving', kana: 'かいしゃを サボって', en: 'skipping work', tile: 'サボって', keys: ['さぼ'], kind: 'how', audience: 'cheeky' },
  { id: 'after-date', kana: 'デートの あとで', en: 'after a date', tile: 'デート', keys: ['でえとのあと'], kind: 'time', audience: 'cheeky' },
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

/** The rumour's body in plain form: 「ちょうちんさんは まいばん こうえんで ダンスを ならって いる」. */
function body(seed: RumourSeed, fins: readonly RumourFin[], particle: 'は' | 'が'): string {
  return sp(`${seed.who.kana}${particle} ${orderFins(fins).map((f) => f.kana).join(' ')} ${seed.where.kana} ${seed.what.kana}`);
}

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
      kana = sp(`${seed.who.kana}は ${orderFins(fins).map((f) => f.kana).join(' ')} ${seed.where.kana} ${seed.what.masu}。`);
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
      kana = `${body(seed, fins, 'は')} らしいです。`;
      en = `Apparently ${bodyEn(seed, fins)}.`;
      break;
    case 'n-datte':
      kana = `${body(seed, fins, 'は')}んだって！`;
      en = `They say ${bodyEn(seed, fins)}!`;
      break;
    case 'plain':
      kana = `ねえねえ、${body(seed, fins, 'は')}よ！`;
      en = `Psst, ${bodyEn(seed, fins)}!`;
      break;
  }
  return { text: kana, kana, en };
}

/** Nobiko-san's opener, whispered to the first relayer only. */
export function rumourOpener(seed: RumourSeed): JpText {
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

// Adjectives that end in らしい (あたらしい, めずらしい …) aren't hearsay.
const NOT_RASHII = /(あた|めず|すば|かわい|いや|ばか|きたな|おとこ|おんな|こども|おとな)らし/;

/**
 * The rumour frame a relay used, or null. Uses the learning path's own matchers where they exist (so the
 * round and the path agree), plus two the path doesn't have yet: ＿に よると and ＿んだって.
 */
export function rumourFrameOf(u: { text: string; reading?: string; tokens?: readonly UtteranceToken[] }): RumourFrameId | null {
  const kana = u.reading ?? u.text;
  const k = normalizeReading(kana).replace(/[\s　]/g, '');
  const found = new Set(framesOf({ text: u.text, kana }, u.tokens, { keepHidden: true }));
  if (/によると/.test(k) && /そう(です|だ|よ|な)/.test(k)) return 'ni-yoru';
  if (found.has('to-itte-ita') || found.has('tte-quote') || /(と|って)(いって|ゆって)(い)?(ました|た|る|ます)/.test(k)) return 'to-itte-ita';
  if (/んだって|なんだって/.test(k)) return 'n-datte';
  if (found.has('rashii') || (/[るたいだ]らしい/.test(k) && !NOT_RASHII.test(k))) return 'rashii';
  if (found.has('sou-hear') || /[るたいだ]そう(です|だ|よ)/.test(k)) return 'sou-hear';
  if (found.has('plain') || /[るたいだ](よ|ね|の)[！!？?。…]*$/.test(k)) return 'plain';
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
