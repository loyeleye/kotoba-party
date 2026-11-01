// Sentence frames: the handful of beginner sentence shapes every game keeps reusing
// (docs/progressive-learning.md). A frame has one or two slots the player fills with their own words,
// so seeing 「＿は ＿です」 in Nice to Meet You!, Last Train and Oogiri shows it's one pattern, not three
// phrases. Players on the learning path see each phrase's frame in their phrasebook and on My progress.
//
// Frames are found from a phrase's own words (frameOf), so every game's phrasebook is covered without
// tagging content by hand. A phrase gets at most one frame, the most specific that matches; a phrase that
// matches none (a single word, a set greeting) has none. Missing a frame is fine; naming the wrong one
// isn't, so the matchers ask for clear signs (a spaced particle, a fixed ending) and leave the rest out.
//
// framesOf, at the end of the file, names every frame in a line, N5 to N3 (docs/n4-n3-frames.md).

import type { UtteranceToken } from './kana.js';

export type FrameId =
  | 'te-mo-ii'
  | 'masen-ka'
  | 'doko'
  | 'nan'
  | 'te-kudasai'
  | 'kudasai'
  | 'ja-nai'
  | 'tai'
  | 'suki'
  | 'ni-aru'
  | 'mashita'
  | 'o-masu'
  | 'sou'
  | 'ka'
  | 'wa-desu'
  | 'desu'
  | 'ikura'
  | 'ji-fun'
  | 'ni-masu'
  | 'youbi'
  | 'gatsu-nichi'
  | 'wa-ni-aru'
  | 'migi-hidari'
  | 'hoshii'
  | 'de-o'
  | 'te-iru'
  | 'no'
  | 'adj-desu'
  | 'kunai'
  | 'kara'
  | 'hou-ga'
  | 'mashou'
  | 'naide-kudasai'
  | 'te-moraeru'
  | 'te-kuremasen'
  | 'ageru-kureru'
  | 'te-itadakemasen'
  | 'nakereba'
  | 'nakutemo-ii'
  | 'te-wa-ikenai'
  | 'ta-koto'
  | 'te-shimau'
  | 'te-miru'
  | 'potential'
  | 'tara'
  | 'nara'
  | 'ba'
  | 'to-cond'
  | 'toki'
  | 'temo'
  | 'sou-look'
  | 'sou-hear'
  | 'ni-yoru'
  | 'n-datte'
  | 'to-omou'
  | 'kamo'
  | 'hazu'
  | 'you-to-omou'
  | 'tsumori'
  | 'hou-ga-ii'
  | 'tara-dou'
  | 'te-oku'
  | 'te-aru'
  | 'plain'
  | 'n-da'
  | 'teru'
  | 'o-kudasai'
  | 'o-ni-naru'
  | 'o-suru'
  | 'keigo'
  | 'node'
  | 'sugiru'
  | 'nagara'
  | 'shi'
  | 'you-ni-naru'
  | 'koto-ni-suru'
  | 'koto-ni-naru'
  | 'passive'
  | 'sasete-kudasai'
  | 'yasui-nikui'
  | 'to-itte-ita'
  | 'tame-ni'
  | 'you-ni'
  | 'ka-dou-ka'
  | 'nani-ka'
  | 'mitai-you'
  | 'n-desu'
  | 'causative'
  | 'te-hoshii'
  | 'ba-yokatta'
  | 'tari-tari'
  | 'tokoro-desu'
  | 'tte-quote'
  | 'rashii'
  | 'noni'
  | 'uchi-ni'
  | 'tame-reason';

export interface Frame {
  id: FrameId;
  /** The frame as the phone shows it, ＿ for each slot. */
  ja: string;
  /** The frame in English. */
  en: string;
  /** One line on what it's for. */
  use: string;
  /** A short example, kana only. */
  example: { ja: string; en: string };
  /** The JLPT-style level it belongs to, and the N4/N3 goal it counts for (docs/n4-n3-frames.md). The first sixteen have none. */
  level?: 'n5' | 'n4' | 'n3';
  goal?: string;
  /** 'draft' until a fluent speaker has checked the frame and its example. */
  status?: 'draft';
}

/** The sixteen N5 frames the learning path shows today, in the order a beginner meets them (not the order
 * they're matched in). MORE_N5_FRAMES, N4_FRAMES and N3_FRAMES follow at the end of the file. */
export const FRAMES: readonly Frame[] = [
  { id: 'wa-desu', ja: '＿は ＿です', en: 'A is B', use: 'Say what something is, or who you are.', example: { ja: 'わたしは アキです。', en: "I'm Aki." } },
  { id: 'desu', ja: '＿です', en: "It's ___", use: '＿は ＿です with the topic left out, when everyone knows what you mean.', example: { ja: 'さんびゃくえんです。', en: "It's 300 yen." } },
  { id: 'ka', ja: '＿ですか ／ ＿ますか', en: 'Is it ___? / Do you ___?', use: 'Add か to any です or ます sentence to ask it.', example: { ja: 'すしが すきですか。', en: 'Do you like sushi?' } },
  { id: 'ja-nai', ja: '＿は ＿じゃないです', en: "A isn't B", use: 'Say what something is not.', example: { ja: 'これは コーヒーじゃないです。', en: "This isn't coffee." } },
  { id: 'sou', ja: 'そうです ／ ちがいます', en: "That's right / That's not it", use: 'Answer when someone checks with you.', example: { ja: 'いいえ、ちがいます。', en: "No, that's not it." } },
  { id: 'kudasai', ja: '＿を ください', en: '___, please', use: 'Ask for a thing: order, buy, point at it.', example: { ja: 'コーヒーを ください。', en: 'A coffee, please.' } },
  { id: 'doko', ja: '＿は どこですか', en: 'Where is ___?', use: 'Ask where a place or thing is.', example: { ja: 'えきは どこですか。', en: 'Where is the station?' } },
  { id: 'nan', ja: '＿は なんですか', en: 'What is ___?', use: 'Ask what something is.', example: { ja: 'これは なんですか。', en: 'What is this?' } },
  { id: 'suki', ja: '＿が すきです', en: 'I like ___', use: 'Say what you like.', example: { ja: 'ねこが すきです。', en: 'I like cats.' } },
  { id: 'ni-aru', ja: '＿に ＿が あります', en: 'There is ___ (at ___)', use: 'Say what there is, and where (います for people and animals).', example: { ja: 'へやに ねこが います。', en: "There's a cat in the room." } },
  { id: 'o-masu', ja: '＿を ＿ます', en: 'I do ___ (to something)', use: 'Say what you do: を marks the thing.', example: { ja: 'すしを たべます。', en: 'I eat sushi.' } },
  { id: 'mashita', ja: '＿ました', en: 'I did ___', use: 'Say what happened.', example: { ja: 'えいがを みました。', en: 'I watched a film.' } },
  { id: 'tai', ja: '＿たいです', en: 'I want to ___', use: 'Say what you want to do.', example: { ja: 'にほんに いきたいです。', en: 'I want to go to Japan.' } },
  { id: 'te-kudasai', ja: '＿て ください', en: 'Please ___', use: 'Ask someone to do something.', example: { ja: 'まって ください。', en: 'Please wait.' } },
  { id: 'masen-ka', ja: '＿ませんか', en: "Won't you ___?", use: 'Invite someone, softly: it leaves the choice to them.', example: { ja: 'いっしょに たべませんか。', en: "Why don't we eat together?" } },
  { id: 'te-mo-ii', ja: '＿ても いいですか', en: 'May I ___?', use: 'Ask permission.', example: { ja: 'しゃしんを とっても いいですか。', en: 'May I take a photo?' } },
];

// Spaces of either width, and the end of a sentence.
const S = '[\\s\\u3000]*';
const END = `${S}[。！？!?…]*${S}$`;
// A number of things, for 「Nを ふたつ ください」.
const COUNT = `([一二三四五六七八九十0-9０-９]+[^\\s\\u3000、。]{0,2}|ひとつ|ふたつ|みっつ|よっつ|いつつ|むっつ|ななつ|やっつ|ここのつ|とお|いっこ|にこ|さんこ|いっぽん|にほん|さんぼん|いちまい|にまい|さんまい|すこし|ちょっと|もう${S}ひとつ)`;
// Hearsay 「〜そうです」 after a verb, an adjective or だ (あめが ふるそうです: apparently it'll rain).
const HEARSAY = new RegExp(`[るたいくだ]${S}そう${S}です`);

/**
 * Matchers, most specific first: 「〜ても いいですか」 is also a です sentence, 「〜を ください」 also has を, and
 * ちがいます ends in います, so a yes or a no goes first of all. Each runs on the reading (kana) and on the written text, and either may match. `not` rules out the
 * look-alikes found in the game's own lines (tests/frames.test.ts keeps them out).
 */
const MATCHERS: readonly { id: FrameId; re: RegExp; not?: RegExp }[] = [
  // A yes or a no to a check. Not そうですね or そうですか (fillers: "well…", "I see").
  { id: 'sou', re: new RegExp(`^(はい|いいえ|ええ|いや)?[、,]?${S}(それは${S})?(そう${S}です(?![ねかよ])|そう${S}じゃ${S}(ない|ありません)|ちがいます|違います)|(^|[\\s\\u3000、…])(これ|それ|あれ)(も|は)${S}(ちがいます|違います)`) },
  { id: 'te-mo-ii', re: new RegExp(`[てで]${S}も${S}(いい|良い)${S}です${S}か`) },
  // 「ありませんか」 asks if there is any; 「すみません」 is sorry. Neither invites.
  { id: 'masen-ka', re: new RegExp(`(?<!あり|(^|[\\s\\u3000、])すみ|有り)ません${S}か(?!ら)`), not: new RegExp(`[てで]${S}(くれ|呉れ|もらえ|貰え|いただけ|頂け|ください|くださいま)ません${S}か`) },
  { id: 'doko', re: new RegExp(`[はわ][\\s\\u3000、]*(どこ|何処)${S}(です|でしょう)${S}か`) },
  { id: 'nan', re: new RegExp(`\\S${S}は${S}(なん|何)${S}です${S}か`) },
  // Not 「〜ないで ください」 (please don't: the opposite).
  { id: 'te-kudasai', re: new RegExp(`[てで]${S}(ください|下さい)`), not: new RegExp(`ないで${S}(ください|下さい)`) },
  // An order: 「Nを ください」, 「Nを おねがいします」 or a spaced 「N みっつ、おねがいします」. Not 「〜て ください」
  // (matched above), よろしく おねがいします, はい、おねがいします (yes please: taking an offer, not asking for a
  // thing), or keigo requests such as 「ごじょうしゃ ください」 (please board).
  { id: 'kudasai', re: new RegExp(`(を${S}(${COUNT}${S})?(ください|下さい|おねがいします|お願いします)|[\\s\\u3000、](ください|下さい|おねがいします|お願いします))`), not: new RegExp(`(よろしく|宜しく|はやく|早く|ゆっくり|ちゃんと|しずかに|どうぞ|どうか|ぜひ|もう${S}いちど)${S}(おねがい|お願い|ください|下さい)|^(はい|ええ)[、,]?${S}(おねがい|お願い)|ないで${S}(ください|下さい)|(ご\\S+|お(まち|待ち|むかえ|迎え|はいり|入り|すわり|座り|あがり|のり|乗り|かけ))${S}(ください|下さい)`) },
  // Not 「〜んじゃない」 (isn't it that…: a different pattern).
  { id: 'ja-nai', re: new RegExp(`(じゃ|では)${S}(ない|ありません)`), not: new RegExp(`(?<!に)んじゃ${S}(ない|ありません)`) },
  // Not the adjectives that end in たい: いたい (it hurts), つめたい (cold), かたい (hard)…, nor みたい (looks like),
  // けいたい (a mobile) or ネクタイ, nor their negatives (つめたくない: isn't cold).
  { id: 'tai', re: new RegExp(`\\S(たい|たく(ない|ありません))${S}です(${END}|${S}と${S}(いい|言い|いっ|言っ|おも|思))|\\S\\Sたい${S}(な|なあ|ね|よ|の)?${S}[！!。？?…]*$`), not: new RegExp(`(^|[\\s\\u3000、が])(い|痛)たい|(?<!(を|も)[\\s\\u3000]*)みたい|くたい|けいたい|携帯|つめたい|冷たい|かたい|固い|硬い|ひらたい|おもたい|重たい|けむたい|めでたい|(^|[\\s\\u3000、が])(い|痛)たく|(つめ|冷|かた|固|硬|ひら|おも|重|けむ)たく`) },
  // A yes-or-no question: 「すきですか」, 「よく きますか」, 「ありませんか」. After the question frames above (where, what, may I,
  // shall we). Not 「そうですか」 (I see).
  { id: 'ka', re: new RegExp(`(です|ます|ません)${S}か${END}`), not: new RegExp(`(^|[\\s\\u3000、])そう${S}です${S}か|[てで]${S}(くれ|呉れ|もらえ|貰え|いただけ|頂け|ください|くださいま)(ます|ません)${S}か`) },
  // Not 「おなかが すきました」 (I'm hungry).
  { id: 'suki', re: new RegExp(`が${S}(いちばん|一番|とても|すごく|ほんとうに)?${S}(だい)?(すき|好き|大好き)(?!ま|な)`) },
  // 「Nに Nが あります」, or just 「Nが（十本）あります」. Polite forms only: plain ある／いる is mostly a relative clause
  // (ゆうきが ある ひと: people who have courage). Not 「〜て います」 (doing: a different pattern), nor
  // ありがとう ございます, whose が and います are inside words.
  { id: 'ni-aru', re: new RegExp(`が${S}[^\\s\\u3000、。]{0,4}${S}(あります|います|有ります|居ます)`), not: new RegExp(`[てで]${S}(います|いる)|ございます|ありがとう|ちがいます`) },
  { id: 'mashita', re: new RegExp(`ました${END}`) },
  // Not 「〜て います」 (いぬを かって います: a state, a different pattern).
  { id: 'o-masu', re: new RegExp(`\\Sを${S}\\S*ます${END}`), not: new RegExp(`[てで]${S}います`) },
  // 「Aは Bです」: the topic は needs a space after it, so はし or はじめまして don't count, unless it follows a
  // pronoun or a kanji noun (わたしは学生です, unspaced as Last Train writes it). Not hearsay 「〜るそうです」
  // (apparently…), which isn't "A is B".
  { id: 'wa-desu', re: new RegExp(`(\\Sは[\\s\\u3000、]+\\S|(わたし|わたくし|ぼく|あなた|これ|それ|あれ|ここ|そこ|あそこ|[一-龯]{1,3})は\\S)[^。！？]*です(?!か)`), not: new RegExp(`${HEARSAY.source}|^(では|じゃ)[、,]|([うぐすつぬぶむるた]|[^\\s\\u3000]な)ん[\\s\\u3000]*です`) },
  // The same with the topic left out: 「さんびゃくえんです」. Last, so anything more specific wins. Not hearsay, and
  // not past or negative adjectives (つめたかったです, つめたくないです), which "It's ___" would gloss wrongly.
  { id: 'desu', re: new RegExp(`\\S${S}です${END}`), not: new RegExp(`^(そう|どう)|^いい(?!え)|^(はい|いいえ)[、,]?${S}(そう|ちがい)|(かった|くない)${S}です|${HEARSAY.source}`) },
];

const hits = (m: (typeof MATCHERS)[number], s: string): boolean => m.re.test(s) && !m.not?.test(s);

/** A phrase's sentences, each with its own 。！？ (はじめまして。アキです。 is two). */
// Quotes and a speaker's name (ポン：「…」) are dropped, so 「はい、そうです。」 starts with はい like any answer.
const sentences = (s: string): string[] =>
  s
    .split(/(?<=[。！？!?])/)
    .map((x) => x.replace(/^[\s\u3000」』）)]*([^\s\u3000：:「」]{1,10}[：:])?[\s\u3000「『（(]*/, '').replace(/[」』）)\s\u3000]+/g, ' ').trim())
    .filter(Boolean);

/** The index of the most specific matcher a sentence hits, or -1. */
const best = (sentence: string): number => MATCHERS.findIndex((m) => hits(m, sentence));

/**
 * The frame one string is built on, sentence by sentence: the sentence with the player's ＿ blank if it
 * has a frame (that's where their own words go), else the most specific frame in any sentence, so
 * はじめまして。アキです。よろしく おねがいします。 is a ＿です line. -1 if none.
 */
function frameIndex(s: string): number {
  const parts = sentences(s);
  const blank = parts.filter((p) => /[＿_]/.test(p)).map(best).filter((i) => i >= 0);
  if (blank.length) return Math.min(...blank);
  const any = parts.map(best).filter((i) => i >= 0);
  return any.length ? Math.min(...any) : -1;
}

/** The frame a phrase is built on, or null: from the reading and the written text, the more specific. */
export function frameOf(phrase: { text: string; kana: string }): FrameId | null {
  const found = [frameIndex(phrase.kana), frameIndex(phrase.text)].filter((i) => i >= 0);
  return found.length ? MATCHERS[Math.min(...found)]!.id : null;
}

// ---- every frame in a line (framesOf) ----
//
// frameOf above names the one N5 frame a phrase is built on, for the chips and the path. framesOf names
// every frame in a line, N5 to N3 (docs/n4-n3-frames.md): 「あめに ふられたので、おくれました」 is the passive,
// ので and ＿ました at once. The same rule holds: missing a frame is fine, naming the wrong one isn't.
//
// Some frames can't be told apart by their kana alone: hearsay ふるそう and looks-like ふりそう, the
// passive and potential られる, the と of "if" and of "with", purpose and reason ため. Those also read the
// dictionary's part of speech (kuromoji tokens for the written text, from server/src/reading.ts), and
// without tokens they're left out (pos: 'need'). Where the kana settles it, a matcher works on kana alone
// and uses the tokens only to veto (pos: 'veto'): kuromoji misreads some kana-only lines, so it never adds
// a frame the spelling doesn't show.

/** Spaces of either width; a phrase boundary (a space, a comma or the end). */
const B = `(?=[\\s\\u3000、,。！？!?…]|$)`;
// A て-form's て or で: any kana then て, or ん／い then で (よんで, いそいで). Not the place particle で
// after a noun (えきで), which needs more than kana to tell from a て-form after ん (こうえんで).
const TE = `(?:[ぁ-んァ-ヶー一-龯]て|[んい]で)`;
// The kana a plain non-past or past form ends in (いく, たべた, たかい, しずかだ).
const PLAIN = `(?:[うくぐすつぬぶむるいただ]|ない)`;
// A verb's 連用形 or an adjective's stem: what comes before そう (looks), ながら, やすい, すぎる.
const STEM = `[いきぎしじちにひびみりえけげせぜてでねべめれ]`;

/** A token as the matchers see it: spaces dropped, every field filled. */
interface Tok {
  s: string;
  pos: string;
  detail: string;
  base: string;
  ctype: string;
  cform: string;
}

interface Sentence {
  /** The sentence's kana and its written text (the same string for a kana-only phrase). */
  k: string;
  t: string;
  /** Tokens for the written text of this sentence, or undefined when there are none. */
  toks?: Tok[];
}

interface Matcher {
  id: FrameId;
  /** Regex hits on the kana or the written text; `not` rules a sentence out. */
  re?: RegExp;
  not?: RegExp;
  /** Used in place of `re` when there are tokens (a looser net, since `tok` then checks each catch). */
  reTok?: RegExp;
  /** A spelling clear enough to count on its own, even where kuromoji misreads a kana-only line. */
  alt?: RegExp;
  /** kuromoji misreads some kana-only text (やさい as an adjective), so on a line with no kanji a `tok` hit
   * must also match this. */
  kanaOnly?: RegExp;
  /** A test on the tokens. 'need': only with tokens. 'veto': regex alone, unless tokens say no. */
  tok?: (t: Tok[]) => boolean;
  pos?: 'need' | 'veto';
  /** Frames this one makes redundant when both hit the same sentence (＿て もらえますか is also a question). */
  hides?: FrameId[];
}

const rx = (src: string): RegExp => new RegExp(src);
const HAS_KANJI = /[一-龯々]/;
// Common adjectives, for a kana-only line where kuromoji can't be trusted (it reads やさい as one).
const ADJ_KANA = `(おいし|たか|やす|ひく|おお?き|ちいさ|あたらし|ふる|あつ|さむ|つめた|あたたか|すずし|むずかし|やさし|たのし|かなし|うれし|さびし|こわ|かわい|いた|ねむ|おもしろ|つまらな|はや|おそ|なが|みじか|ちか|とお|ひろ|せま|おも|かる|あか|あお|しろ|くろ|きいろ|あま|から|にが|まず|すご|わか|よわ|つよ|いそがし|ほし|うるさ|くら|あかる|おかし|すばらし|めずらし|はずかし|くやし|あぶな|きたな|まる|ふと|ほそ|うつくし|くるし|やわらか|かた|まぶし|あやし|ずるい?|すっぱ|しょっぱ|ぬる|かっこい|かっこよ)い|(きれい|しずか|げんき|ひま|すき|きらい|じょうず|へた|たいへん|だいじょうぶ|べんり|ゆうめい|しんせつ|かんたん|ふべん|だめ|へん|すてき|まじめ|しんぱい|あんぜん|きけん|とくい|にがて|むり|ふしぎ|しあわせ|ざんねん|たいせつ|だいすき|だいきらい|いや|らく|にぎやか|おしゃれ|さかん|しつれい|りっぱ|ていねい|ハンサム|シンプル)`;
const isVerb = (t: Tok | undefined) => t?.pos === '動詞';
const isAdj = (t: Tok | undefined) => t?.pos === '形容詞';
const isAux = (t: Tok | undefined, base?: string) => t?.pos === '助動詞' && (base === undefined || t.base === base);
/** Ends a plain clause: a verb, an adjective, or だ／た／ない (not です／ます). */
const endsPlain = (t: Tok | undefined) => isVerb(t) || isAdj(t) || (t?.pos === '助動詞' && ['だ', 'た', 'ない', 'ぬ', 'ん', 'う', 'よう', 'たい'].includes(t.base));
const tokAt = (ts: Tok[], i: number) => (i >= 0 && i < ts.length ? ts[i] : undefined);
const some = (ts: Tok[], f: (t: Tok, i: number) => boolean) => ts.some(f);

// Frames that end in です say something more specific than "It's ___" or "A is B".
const DESU_FAMILY: FrameId[] = ['desu', 'wa-desu', 'adj-desu'];
// Question frames say more than a plain yes-or-no ＿ですか.
const QUESTION: FrameId[] = ['ka', 'masen-ka'];

// The core N5 matchers again, for framesOf (frameOf keeps its own order and rules above).
const CORE: Matcher[] = MATCHERS.map((m) => ({ id: m.id, re: m.re, not: m.not }));
const CORE_HIDES: Partial<Record<FrameId, FrameId[]>> = {
  'te-mo-ii': [...QUESTION, ...DESU_FAMILY],
  'masen-ka': ['ka'],
  'te-kudasai': ['kudasai'],
  'wa-desu': ['desu'],
  doko: [...QUESTION, 'wa-desu'],
  nan: [...QUESTION, 'wa-desu'],
  'ja-nai': DESU_FAMILY,
  tai: DESU_FAMILY,
  suki: DESU_FAMILY,
  sou: DESU_FAMILY,
};
for (const m of CORE) m.hides = CORE_HIDES[m.id];

const MORE_N5: Matcher[] = [
  // 「いくらですか」. Not いくら (salmon roe) or いくらでも (any amount).
  { id: 'ikura', re: rx(`(いくら|幾ら)\\s*(です|でしょう)\\s*か|(いくら|幾ら)[？?]`), hides: [...QUESTION, ...DESU_FAMILY] },
  // A clock time: a number, じ, then はん or ＿ふん (さんじ はん, 7時10分, なんじ なんぷん). An hour alone is left out:
  // くじ is also a lottery and いちじ "for a while".
  {
    id: 'ji-fun',
    re: rx(`([0-9０-９一二三四五六七八九十〇]|いち|に|さん|よ|ご|ろく|しち|なな|はち|く|じゅう|れい|なん)\\s*(じ|時)\\s*(はん|半|([0-9０-９一二三四五六七八九十]+|いっ|に|さん|よん|ご|ろっ|なな|はっ|きゅう|じゅっ|じっ|なん|[ぁ-ん]{0,6})\\s*(ふん|ぷん|分))`),
    not: rx(`じぶん|自分`),
  },
  // 「Nに Vます」: where or when, then a polite verb. Not there is (に あります／います), become (に なります),
  // the N4 ように／ことに／ために, or に after a plain verb (たべに いきます is fine, it's still に ＿ます).
  {
    id: 'ni-masu',
    re: rx(`[^\\s\\u3000、。]に[\\s\\u3000]+([^\\s\\u3000、。]+[\\s\\u3000]+)?[^\\s\\u3000、。]*(ます|ました)(か)?\\s*[。！？!?]*\\s*$|[^\\s\\u3000、。](に|へ)(いき|き|かえり|おき|ね|つき|はいり|のり|すわり|でかけ|もどり)(ます|ました)`),
    not: rx(`に[\\s\\u3000]*(あり|い|なり|ござい|おり|ちがい|あい|会い|あげ|もらい|おしえ|かし|かり|きき|でんわ|まけ|かち|にて|よろしく)(ます|ました)|(よう|こと|ため|ほか|ぜったい|ほんとう|すぐ|とく|べつ|さき|いっしょ|じょうず|へた|しずか|きれい|げんき|たしか|かんたん|ていねい|ひま)に|${TE}\\s*(い|あり|おき|しまい|み)ます|させ(ます|ました)|に[\\s\\u3000]+[^\\s\\u3000]*[えけせてねへめれげべ]られ(ます|ました)`),
    hides: ['o-masu'],
  },
  // げつようび … にちようび, なんようび.
  { id: 'youbi', re: rx(`(げつ|か|すい|もく|きん|ど|にち|なん|月|火|水|木|金|土|日|何)(よう|曜)(び|日)`) },
  // A date: a month and a day (しがつ ついたち, 12月25日), or なんがつ なんにち. A month or a day alone is left out
  // (いつか is "someday", ようか "shall we").
  {
    id: 'gatsu-nichi',
    re: rx(`(^|[^ぁ-んァ-ヶ一-龯])(いち|に|さん|し|ご|ろく|しち|はち|く|じゅう|じゅういち|じゅうに|なん|[0-9０-９]+|[一二三四五六七八九十]+)(がつ|月)[\\s\\u3000の]*((じゅう|にじゅう|さんじゅう)?(ついたち|ふつか|みっか|よっか|いつか|むいか|なのか|ようか|ここのか|とおか|はつか)|[ぁ-ん]{1,8}(にち)|[0-9０-９一二三四五六七八九十]+日|なんにち|何日)`),
  },
  // 「Aは Bに あります／います」: where A is. Not 「Bに Aが あります」 (that's ni-aru), 〜て います, or こんにちは.
  {
    id: 'wa-ni-aru',
    re: rx(`[^\\s\\u3000、]は[\\s\\u3000、]+[^。！？]*?[^\\s\\u3000、]に[\\s\\u3000]*(あります|ありません|ありました|います|いません|いました|ある|いる|いた|あった|ありますか|いますか)`),
    not: rx(`(こんにち|こんばん)は|(?<!(さん|なん|ちか|かい|まち|な))が([\\s\\u3000]+[^\\s\\u3000、。]{1,4})?[\\s\\u3000]*(あり|い)(ます|ません|ました)|${TE}[\\s\\u3000]*(い|あり)`),
  },
  // Where a thing is: 「Nの まえに」, 「みぎに まがって」. Position words after Nの or as directions (みぎ, ひだり).
  // Not したの (did), おなか, なまえ, or まえに after a verb (ねる まえに: before, a time).
  {
    id: 'migi-hidari',
    re: rx(`(^|[\\s\\u3000、])(みぎ|ひだり|となり|右|左|隣)[\\s\\u3000]*(に|へ|の|がわ|側|です)|の[\\s\\u3000]*(みぎ|ひだり|まえ|うしろ|となり|うえ|した|なか|よこ|むこう|そば|右|左|前|後ろ|隣|上|下|中|横)[\\s\\u3000]*(に|へ|の|です|から|で|を|が|は)`),
    not: rx(`(しょくじ|ごはん|じゅぎょう|しけん|しごと|たいかい|ねる|じかん|テスト|パーティー|かいぎ|しゅっぱつ|でかける|食事|授業|試験|仕事|会議|出発)の[\\s\\u3000]*(まえ|前)|(じかん|時間)の[\\s\\u3000]*(なか|中)|の[\\s\\u3000]*(なか|中)[\\s\\u3000]*(で|は|が)[\\s\\u3000]*(いちばん|一番)`),
  },
  // 「Nが ほしいです」. Not 〜て ほしい (want someone to: N4), ほし (star), ほしいも (dried sweet potato).
  { id: 'hoshii', re: rx(`(ほしい|欲しい|(ほしく|欲しく)(?=ない|なかった|て|なる|なっ|ありません))(?!も[^の])`), not: rx(`${TE}[\\s\\u3000]*(ほし|欲し)`), hides: DESU_FAMILY },
  // 「Nで Nを Vます」: where or with what you do it. で must be the particle, not a て-form (よんで), so with
  // tokens it has to be one; without, で after ん or い is left out.
  {
    id: 'de-o',
    re: rx(`([^\\s\\u3000、。んい]|こうえん|レストラン|パン|ペン|スプーン|びょういん|しんかんせん|でんわ|ほんやさん|がっこう)で[\\s\\u3000]+([^\\s\\u3000、。]+[\\s\\u3000]+)*?[^\\s\\u3000、。]*を[\\s\\u3000]*[^\\s\\u3000、。]*(ます|ました|ません|ましょう|たい|て|る|た)`),
    not: rx(`(でも|では|まで|それで|なんで|ひとりで|ふたりで|みんなで)[\\s\\u3000]`),
  },
  // 「〜て います」: ongoing or a state. Not に います (there is), ひとりで いる (alone), ていねい.
  {
    id: 'te-iru',
    re: rx(`${TE}[\\s\\u3000]*(い|居)(ます|ません|ました|ませんでした|る|ない|た|なかった|て)`),
    not: rx(`(ひとり|ふたり|みんな|ここ|そこ|うち|いえ|へや|じぶん|家|部屋)[\\s\\u3000]*で[\\s\\u3000]*い|ていねい|${TE}[\\s\\u3000]*いた(い|だ|く)`),
    tok: (ts) => some(ts, (t, i) => (t.s === 'て' || t.s === 'で') && t.detail.startsWith('接続助詞') && (tokAt(ts, i + 1)?.base === 'いる' || tokAt(ts, i + 1)?.base === '居る')),
    pos: 'veto',
  },
  // 「Nの N」: whose or what kind. Only with tokens: の between two nouns. Not the explanatory の, この/その, or
  // a sentence-final の.
  {
    id: 'no',
    // kuromoji splits some kana nouns wrongly (なまえ → な ま え), so common nouns count on their spelling too.
    alt: rx(`(^|[\\s\\u3000、])(わたし|ぼく|あなた|かれ|かのじょ|だれ|にほん|にほんご|えいご|ともだち|せんせい|ねこ|いぬ|がっこう|かいしゃ|えき|へや|いえ|うち|まち|くに|ポン|おかあさん|おとうさん|かぞく|みんな)の[\\s\\u3000]+(?!(です|だ|に|で|は|が|を|も|か|よ|ね|ため|よう|とき|こと|ほう|まえ|うしろ|うえ|した|なか|となり|よこ|みぎ|ひだり)(?![ぁ-ん]))[ぁ-んァ-ヶ一-龯]`),
    tok: (ts) =>
      some(ts, (t, i) => {
        const a = tokAt(ts, i - 1);
        const b = tokAt(ts, i + 1);
        return t.s === 'の' && t.detail.startsWith('連体化') && a?.pos === '名詞' && !a.detail.startsWith('非自立') && b?.pos === '名詞' && !b.detail.startsWith('非自立') && !b.detail.startsWith('接尾');
      }),
    pos: 'need',
  },
  // An adjective + です: おいしいです, しずかです. Present only (not 〜かったです or 〜くないです), and not 〜たいです,
  // 〜そうです or いいです (also "no thanks"). Only with tokens: とけいです or せんせいです end in い too.
  {
    id: 'adj-desu',
    re: rx(`です`),
    not: rx(`(かった|くない|く[\\s\\u3000]*ありません|たい|そう)[\\s\\u3000]*です|(^|[\\s\\u3000、])(いい|良い)[\\s\\u3000]*です`),
    tok: (ts) =>
      some(ts, (t, i) => {
        if (!isAux(t, 'です')) return false;
        const a = tokAt(ts, i - 1);
        return (isAdj(a) && a!.detail.startsWith('自立') && a!.cform === '基本形' && a!.base !== 'いい' && a!.base !== 'よい') || (a?.pos === '名詞' && a.detail.startsWith('形容動詞語幹'));
      }),
    pos: 'need',
    kanaOnly: rx(`${ADJ_KANA}[\\s\\u3000]*です`),
  },
  // An い-adjective's negative: たかくないです, よく ありません. Not 〜たくない (don't want to), すくない (few), じゃない.
  {
    id: 'kunai',
    re: rx(`[^\\s\\u3000、。]く[\\s\\u3000]*(ない|なかった|ありません)`),
    not: rx(`(すく|少)ない|[^\\s\\u3000、が](?<!(^|[\\s\\u3000、が])(い|痛|つめ|冷|かた|固|硬|ひら|おも|重|けむ))たく[\\s\\u3000]*(ない|なかった|ありません)|(よく|はやく|おそく)[\\s\\u3000]+な(いて|いで|いた|かない)`),
    tok: (ts) => some(ts, (t, i) => isAdj(t) && t.cform.startsWith('連用') && ['ない', 'ありません', 'ある'].includes(tokAt(ts, i + 1)?.base ?? '') || (isAdj(t) && t.cform.startsWith('連用') && tokAt(ts, i + 1)?.s === 'あり')),
    pos: 'veto',
    hides: DESU_FAMILY,
  },
  // Reason から after a clause: あついから, いきますから. Not "from" (とうきょうから, あしたから) or からい／からだ.
  // Kana alone counts only after です／ます／だ／ない／かった; with tokens, any から the dictionary calls a
  // conjunction (接続助詞).
  {
    id: 'kara',
    re: rx(`(です|でした|ます|ました|ません|だ|だった|ない|なかった|かった)[\\s\\u3000]*から(?![いだくさあ])`),
    reTok: rx(`([るいただうくすつぬぶむぐ]|ない)[\\s\\u3000]*から(?![いだくさあ])`),
    not: rx(`^(だ|です)から|[、。][\\s\\u3000]*(だ|です)から`),
    tok: (ts) => some(ts, (t, i) => t.s === 'から' && t.detail.startsWith('接続助詞') && i > 0 && endsPlain(ts[i - 1]) || (t.s === 'から' && t.detail.startsWith('接続助詞') && (isAux(ts[i - 1], 'です') || isAux(ts[i - 1], 'ます')))),
    pos: 'veto',
  },
  // A comparison: 「Nより Nの ほうが」. Not advice 〜た ほうが いい (that's after a verb, never after の).
  { id: 'hou-ga', re: rx(`より[^。！？]*の[\\s\\u3000]*(ほう|方)[\\s\\u3000]*が|の[\\s\\u3000]*(ほう|方)[\\s\\u3000]*が[^。！？]*より`) },
  // ＿ましょう／ましょうか. Not でしょう or しょうゆ.
  { id: 'mashou', re: rx(`ましょう`), hides: [...QUESTION] },
  // ＿ないで ください.
  // Plain ＿ないで at the end counts too (Ladi, Nov 1: casual forms count toward the polite frames). Mid-sentence
  // ないで is "without doing" (たべないで いく).
  { id: 'naide-kudasai', re: rx(`ないで[\\s\\u3000]*(ください|下さい)|ないで[\\s\\u3000]*(ね|よ|な)?[\\s\\u3000]*[！!。…]*[\\s\\u3000]*$`), hides: ['kudasai'] },
];

// ---- N4 matchers (goals 4.1 to 4.14) ----

/** そう after this kana is hearsay (plain form) or looks-like (a stem): ふるそう / ふりそう. Null when only
 * the dictionary can tell (an い ending: かいそう "looks like buying" or おいしいそう "I hear it's tasty"). */
const ADJ_STEM_U = /(^|[\s　、がはもを])(あつ|さむ|ぬる|わる|やす|うす|かる|まる|ゆる|ずる|つよ|よわ|あぶな|せま|ひろ|ふと|ほそ|おもしろ|うれし|たの|おいし|むずかし|やさし|かなし|さびし|いた|かた|つめた|ひらた|おもた|けむた|あま|から|にが|すっぱ|しょっぱ|ねむ|こわ|あか|あお|しろ|くろ|はや|おそ|たか|ひく|ちか|とお|おお|ちいさ|おおき|あたらし|ふる|わか|うま)そう/;
// Stems the kana branches below would misread: お-row stems are never a plain form (つよ, おもしろ), and these
// な-adjectives end in kana that look like a verb or a past (しんせつ, らく, へた).
const LOOK_STEM = /(^|[\s　、がはもを])(おもしろ|ひろ|しろ|くろ|ほそ|おそ|つよ|ふと|おも|とお|あお|しんせつ|たいくつ|らく|へた|ふべん|ふしぎ|しあわせ)$/;
function souKind(s: string, toks?: Tok[]): ('look' | 'hear')[] {
  const out: ('look' | 'hear')[] = [];
  const re = /([^\s　、。！？「」]+?)(そう)(?=(です|でした|だ|な|に|じゃ|ね|よ|も|[\s　、。！？!?…]|$))/g;
  for (const m of s.matchAll(re)) {
    const before = m[1]!;
    const word = before + 'そう';
    if (/(ごち|かわい|ほう|れん|きょう|こう|ぼう|たい|かい|しん|ど|ちょう|かん|ひ|ほん|かそう|はっ|へいそう|まっ|こっ)そう$/.test(word) && !/(なさ|よさ)そう$/.test(word)) continue;
    // Hearsay そう never becomes そうな／そうに／そうも (たべたそうな かお: looks like it wants to eat).
    if (/^(な|に|も)$/.test(m[3]!)) out.push('look');
    else if (/(なさ|よさ)$/.test(before) || LOOK_STEM.test(before)) out.push('look');
    else if (/(だ|ない|なかった|た)$/.test(before)) {
      // 〜たそう is hearsay (たべたそう), but かたそう, つめたそう, いたそう are adjective stems.
      if (/(^|[\s　、がはもを])(かた|つめた|ひらた|おもた|けむた|ねむた|いた)$/.test(before) && !/ない$/.test(before)) {
        if (!/(^|[\s　、がはもを])いた$/.test(before)) out.push('look');
      } else out.push('hear');
    } else if (/[うくぐすつぬぶむる]$/.test(before)) {
      // ふる, ひく and ぬる read as verbs (降る, 弾く, 塗る): 古そう, 低そう are written in kanji.
      if (ADJ_STEM_U.test(word) && !/(^|[\s\u3000、がはもを])(ふる|ひく|ぬる)そう/.test(word)) out.push('look');
      else out.push('hear');
    } else if (/い$/.test(before)) {
      // An adjective + そう (おいしいそう) is hearsay; a verb stem + そう (かいそう) looks. Only the dictionary knows.
      const i = toks?.findIndex((t, j) => t.s === 'そう' && toks[j - 1]?.s.endsWith('い')) ?? -1;
      const k = i > 0 ? toks![i - 1] : undefined;
      if (k && isAdj(k) && k.cform === '基本形') out.push('hear');
      else if (k && isAux(k, 'ない')) out.push('hear');
      else if (k && isVerb(k) && k.cform.startsWith('連用')) out.push('look');
    } else if (new RegExp(`${STEM}$|[かさしたなまらわずん一-龯]$`).test(before)) out.push('look');
  }
  return out;
}

/** A noun that can be someone doing something (はは, 先生), not a pronoun, a time, a number or a counter (八時). */
const isAgentNoun = (t?: Tok): boolean =>
  t?.pos === '名詞' && !t.detail.startsWith('代名詞') && !t.detail.startsWith('副詞可能') && !t.detail.startsWith('数') && !t.detail.startsWith('接尾');
const PASSIVE_TOK = (ts: Tok[]): boolean =>
      some(ts, (t, i) => {
        if (t.pos !== '動詞' || !t.detail.startsWith('接尾')) return false;
        const v = tokAt(ts, i - 1);
        if (!isVerb(v)) return false;
        // Someone who did it (Nに) or something it was done to (を): without one, godan れる is as likely
        // honorific (社長は帰られました) and ichidan られる "can".
        const before = ts.slice(0, i);
        const agent = before.some((x, j) => x.s === 'に' && x.detail.startsWith('格助詞') && isAgentNoun(before[j - 1]));
        const object = before.some((x) => x.s === 'を' && x.detail.startsWith('格助詞'));
        if (t.base === 'れる') return (v!.ctype.startsWith('五段') || v!.ctype.startsWith('サ変')) && !looksIchidan(v!.s) && (agent || object);
        if (t.base !== 'られる' || !v!.ctype.startsWith('一段')) return false;
        return agent || /(前|まえ)に/.test(ts.map((x) => x.s).join(''));
      });

const N4: Matcher[] = [
  // 4.1 Favours.
  { id: 'te-moraeru', re: rx(`${TE}[\\s\\u3000]*(もらえ|貰え)(ます|ません)[\\s\\u3000]*か|${TE}[\\s\\u3000]*(もらえ|貰え)(る|ない)[？?]`), hides: QUESTION },
  { id: 'te-kuremasen', re: rx(`${TE}[\\s\\u3000]*(くれ|呉れ)(ませんか|ますか|ない[？?]|る[？?])`), hides: QUESTION },
  {
    id: 'te-itadakemasen',
    re: rx(`${TE}[\\s\\u3000]*(いただけ|頂け)(ます|ません|ない|る)[\\s\\u3000]*(か|でしょうか|[？?])`),
    hides: [...QUESTION, 'te-moraeru', 'keigo'],
  },
  // Doing something for someone: 〜て あげます／くれます／もらいます (and plain, and past). Not a request
  // (〜て くれませんか, matched above), てを あげて (raise a hand), or giving a thing (ほんを あげます).
  {
    id: 'ageru-kureru',
    re: rx(`${TE}[\\s\\u3000]*(あげ|上げ|くれ|呉れ|もらい|もらっ|もらう|もらわ|貰|さしあげ|くださいま|くださっ|いただき|いただい)(ます|ました|ません|る|た|て|ない|なかった|まし|った|う)?`),
    not: rx(`${TE}[\\s\\u3000]*(くれ|呉れ)(ませんか|ますか|ない[？?]|る[？?])|${TE}[\\s\\u3000]*(もらえ|いただけ)|(て|手)を[\\s\\u3000]*(あげ|上げ)|${TE}[\\s\\u3000]*いただきます[。！!]*$`),
  },
  // 4.2 Must and needn't.
  {
    id: 'nakereba',
    re: rx(`(なければ|なくては|なくちゃ|ないと)[\\s\\u3000]*(なりません|ならない|ならなかった|なりませんでした|いけません|いけない|いけなかった|だめ|ダメ)|[^\\s\\u3000]なきゃ(?!い)`),
    hides: ['ba', 'to-cond', 'te-wa-ikenai'],
  },
  { id: 'nakutemo-ii', re: rx(`なくても[\\s\\u3000]*(いい|良い|よい|かまいません|大丈夫|だいじょうぶ)`), hides: ['temo', 'te-mo-ii', ...QUESTION, ...DESU_FAMILY] },
  {
    id: 'te-wa-ikenai',
    re: rx(`(${TE}は|[^お\\s\\u3000]ちゃ|[んい]じゃ)[\\s\\u3000]*(いけません|いけない|いけないよ|だめ|ダメ|なりません|ならない)`),
    not: rx(`なく(て|ちゃ)|(おもちゃ|おちゃ)`),
  },
  // 4.3 Experiences, tries, oops.
  {
    id: 'ta-koto',
    re: rx(`[たっだ][\\s\\u3000]*(こと|事)[\\s\\u3000]*(が|は|も)?[\\s\\u3000]*(あります|ありません|ありますか|ある|あった|ない|なかった|ありました)`),
    not: rx(`(こと|事)[\\s\\u3000]*(が|は|も)?[\\s\\u3000]*(あった|ありました)?ら|(こまった|たいへんな|へんな)[\\s\\u3000]*こと[\\s\\u3000]*が[\\s\\u3000]*(あっ|おき)`),
  },
  {
    id: 'te-shimau',
    re: rx(`${TE}[\\s\\u3000]*(しまい|しまう|しまっ|しまわ|仕舞)|[^\\s\\u3000おもちゃ](ちゃ|じゃ)(った|う|います|いました|って|お)`),
    not: rx(`(おもちゃ|おちゃ|こうちゃ|りょくちゃ|むぎちゃ|(^|[\\s\\u3000、のをがはもこ])まっちゃ|かぼちゃ|にんじゃ|ちゃん|ちゃいろ|ちゃわん|しまうま)`),
  },
  {
    id: 'te-miru',
    re: rx(`${TE}[\\s\\u3000]*(み|見)(ます|ました|ません|る|た|て|たい|よう|ない|な|ましょう|たら|れば)`),
    not: rx(`${TE}[\\s\\u3000]*(み|見)(せ|つけ|え)`),
  },
  // 4.4 Can: ＿ことが できます, an ability できます, the godan potentials learners use most, and ichidan
  // られる when it isn't the passive (no "by someone" に before it). Not past できました (it's done, it's made).
  {
    id: 'potential',
    re: rx(`(こと|事)[\\s\\u3000]*が[\\s\\u3000]*(でき|出来)(ます|ません|る|ない|た|ました|なかった)|(が|も|は)[\\s\\u3000]*(でき|出来)(ます|ません|る|ない)(?!だけ)|(こられ|来られ)(ます|ません|る|ない)|が[\\s\\u3000]*(ひけ|弾け|かけ|書け)(ます|ません|る|ない)|(^|[\\s\\u3000、をがもは])(ねむれ|眠れ|はなせ|話せ|よめ|読め|のめ|飲め|およげ|泳げ|うたえ|歌え|つくれ|作れ|あるけ|歩け|はしれ|走れ|あそべ|遊べ|かえれ|帰れ|すわれ|座れ)(ます|ません|る|ない|なかった|ました)(?!し)|[いきしちにひみりえけせてねへめれげべ](られ)(ます|ません|る|ない|なかった)`),
    not: rx(`(できる|出来る)[\\s\\u3000]*だけ|(でき|出来)れば|(わすれ|忘れ|つかれ|疲れ|うまれ|生まれ|おくれ|遅れ|わかれ|別れ|はなれ|離れ|ながれ|流れ|こわれ|壊れ|たおれ|倒れ|くれ|入れ|いれ|ぬれ|濡れ|なれ|慣れ|かれ|枯れ|はれ|晴れ|とれ|取れ|ずれ|まけ|負け|かけ(?!ま))|(ともだち|友達|こいびと|恋人|かれし|かのじょ|みせ|店|あかちゃん|こども|子供|えき|駅|ビル)[\\s\\u3000]*が[\\s\\u3000]*(でき|出来)|しられ|知られ`),
    tok: (ts) => {
      // A がでける ability or godan potential the regex found stands. An ichidan られる needs no agent に before it.
      const i = ts.findIndex((t, j) => t.base === 'られる' && t.pos === '動詞' && t.detail.startsWith('接尾') && !!ts[j - 1]?.ctype.startsWith('一段'));
      if (i < 0) return true;
      return !ts.slice(0, i).some((t, j) => t.s === 'に' && t.detail.startsWith('格助詞') && isAgentNoun(ts[j - 1]));
    },
    pos: 'veto',
  },
  // 4.5 If, when, even if.
  {
    id: 'tara',
    re: rx(`[っんいしきみべねえけせてれげじびめちりぎにひかぜで](た|だ)ら(${B.slice(3, -1)}|ば)`),
  },
  {
    id: 'nara',
    re: rx(`[^\\s\\u3000、]なら(?=[\\s\\u3000、,]|ば)`),
    not: rx(`さようなら|さよなら|(なければ|なくては|なくちゃ)[\\s\\u3000]*なら`),
  },
  {
    id: 'ba',
    re: rx(`(けれ|[えけげせぜてねへべめれ])ば(?=[\\s\\u3000、,]|$)`),
    not: rx(`(たとえ|例え)ば|(なけれ|なくても)ば|ば[\\s\\u3000]*(よかった|良かった|いい|よい)`),
    tok: (ts) => some(ts, (t) => t.s === 'ば' && t.pos === '助詞' && t.detail.startsWith('接続助詞')),
    pos: 'veto',
  },
  // と as "whenever, if" after a plain verb or adjective: ボタンを おすと. Only with tokens (接続助詞), and not
  // before おもう／いう (kuromoji calls some quoting と a conjunction).
  {
    id: 'to-cond',
    alt: rx(`[をがにで][\\s\\u3000]+(する|くる|おす|あける|みる|なる)と[\\s\\u3000、,]`),
    re: rx(`${PLAIN}[\\s\\u3000]*と(?=[\\s\\u3000、,])`),
    not: rx(`と[\\s\\u3000、]*(おも|思|いい|言|いっ|いう|かんがえ|考え|きい|聞|よば|呼ば|かいて|書いて)|ないと[\\s\\u3000]*(いけ|だめ|ダメ)|(やさい|せんせい|とけい|ゆうれい|かい|しゃちょう|かちょう|ぶちょう|おねえさん|おにいさん|おかあさん|おとうさん|いもうと|おとうと|ねこ|いぬ|うさぎ|かぞく|家族|おきゃく|きょうだい|がくせい|りょうしん|しんゆう|こいびと|かれし|かのじょ|みんな|ポン)と[\\s\\u3000]`),
    tok: (ts) => some(ts, (t, i) => t.s === 'と' && t.detail.startsWith('接続助詞') && endsPlain(tokAt(ts, i - 1))),
    pos: 'need',
    kanaOnly: rx(`([うくぐすつぬぶむる]|ない|${ADJ_KANA})[\\s\\u3000]*と[\\s\\u3000、,]`),
  },
  // ＿とき: after a clause or Nの. Not ときどき, ときめく, その とき (no clause), 7時 (o'clock), 時間.
  {
    id: 'toki',
    re: rx(`(${PLAIN}|な|の)[\\s\\u3000]*(とき|時)(?=[\\s\\u3000、,は にもの]|です|でした|$)`),
    not: rx(`ときどき|時々|ときめ|(^|[\\s\\u3000、])(その|あの|この|どの|どんな)[\\s\\u3000]*(とき|時)|[0-9０-９一二三四五六七八九十]時|なん(とき|時)`),
  },
  // ＿ても: even if. Not とても, でも (but), N + でも (コーヒーでも), or ても いいですか／なくても いい (their own frames).
  {
    id: 'temo',
    re: rx(`(く|[っいしきみべねえけせれげじびめちりぎひで])て[\\s\\u3000]*も(?=[\\s\\u3000、,。！!]|$)(?![\\s\\u3000]*(いい|良い|よい|かまい|大丈夫|だいじょうぶ))|[んい]で[\\s\\u3000]*も(?=[\\s\\u3000、,。！!]|$)(?![\\s\\u3000]*(いい|良い|よい|かまい|大丈夫|だいじょうぶ))|(ひま|げんき|しずか|すき|きらい|じょうず|へた|暇|元気|静か|好き|嫌い|上手|下手)でも[\\s\\u3000、]`),
    tok: (ts) => !some(ts, (t, i) => t.s === 'でも' && t.pos === '助詞' && t.detail.startsWith('副助詞') && !isAdj(ts[i - 1]) && !isVerb(ts[i - 1]) && !ts[i - 1]?.detail.startsWith('形容動詞語幹')),
    pos: 'veto',
    not: rx(`とっ?ても|(ねん|ふん|ぷん|かい|えん|にん|ほん|ばん)でも|なくても[\\s\\u3000]*(いい|良い|よい|かまい|大丈夫|だいじょうぶ)|(いつ|なに|なん|だれ|どこ|どれ)でも`),
  },
  // 4.6 Looks, hearsay, guesses.
  { id: 'sou-look', tok: () => true, hides: DESU_FAMILY },
  { id: 'sou-hear', tok: () => true, hides: DESU_FAMILY },
  // ＿に よると ＿そうです: a source, then hearsay (そう, らしい, って, ということ) later in the same sentence. Not
  // によって (depending on, by), によるもの, nor によると with a plain statement after it.
  {
    id: 'ni-yoru',
    // The hearsay must follow a plain form (ふるそう, not ふりそう), and って must end the clause (not まって).
    re: rx(
      `に[\\s\\u3000]*(よると|よれば|よりますと|依ると|拠ると|依れば|拠れば)[、,\\s\\u3000]*[^。！？!?]*?` +
        `(?:[うくぐすつぬぶむるいただ]|ない|だった)[\\s\\u3000]*` +
        `(そう[\\s\\u3000]*(です|でした|だ|だった|よ|ね|な(?!い)|[。！!…]|$)` +
        `|(?<!あた|すば|めず|かわい)らし(い|かった)` +
        `|(ん|の)?(だ|です)?って(?=[\\s\\u3000]*(さ|よ|ね|[。！!？?…、,〜ー]|$)))`,
    ),
    // ＿て いそう／だれか いそう: いる's stem + looks-like そう, not hearsay.
    not: rx(`([てでがかはも])[\\s\\u3000]*いそう`),
  },
  // ＿んだって／＿んですって: news passed on to a friend. Not なんだって？ alone ("What?!"), nor だって "because"
  // or "even", nor ＿んだって いって いました (a quote: tte-quote).
  {
    id: 'n-datte',
    // って ends the sentence (not ってば), and な doesn't start a word (カッパが なんだって？).
    re: rx(
      `(?:[うくぐすつぬぶむるいただ]|(?<=[^\\s\\u3000、。！？!?がはをにもで])な|てる|ない)[\\s\\u3000]*(ん|の)(だ|です)って` +
        `(?=[\\s\\u3000]*(さ|よ|ね|[。！!？?…、,〜ー]|$))`,
    ),
    not: rx(`^[\\s\\u3000]*(なん|何)(だ|です)って[\\s\\u3000]*[？?！!。…]*[\\s\\u3000]*$`),
    hides: ['n-da'],
  },
  {
    id: 'to-omou',
    re: rx(`と[\\s\\u3000]*(おもい|思い|おもっ|思っ|おもう|思う|おもわ|思わ)`),
    not: rx(`(おもいで|思い出|おもいだ|おもいつ|思いつ|思い付|おもいきり|思いきり|思い切)|(もっと|ずっと|きっと|ちょっと|やっと)[\\s\\u3000]*(おも|思)`),
    hides: [],
  },
  { id: 'kamo', re: rx(`かも[\\s\\u3000]*(しれ|知れ)|かも(?=[\\s\\u3000]*[。！？!?…]|[\\s\\u3000]*$|ね|よ|[\\s\\u3000]*、)`), not: rx(`かもめ|かもく|かもしか|しかも`), hides: DESU_FAMILY },
  { id: 'hazu', re: rx(`(はず|筈)(?=[\\s\\u3000]*(です|だ|でした|だった|が|は|じゃ|では|なのに|ない|。|$))`), not: rx(`はずかし|はずし|はずれ|はずす|恥ずかし`), hides: DESU_FAMILY },
  // 4.7 Plans, advice, getting ready.
  {
    id: 'you-to-omou',
    re: rx(`[おこごそぞとどのぼもよろ]う[\\s\\u3000]*と[\\s\\u3000]*(おもい|思い|おもっ|思っ|おもう|思う)`),
    not: rx(`(ほんとう|本当|がっこう|ぎんこう|くうこう|こうこう|おはよう|ありがとう|さとう|えいご|きのう|ひこう|だいとう|とうとう|そう)と`),
    hides: ['to-omou'],
  },
  {
    id: 'tsumori',
    re: rx(`([うくぐすつぬぶむる]|ない)[\\s\\u3000]*(つもり|積もり)(?=[\\s\\u3000]*(です|だ|でした|だった|は|で|じゃ|では|。|！|？|$|でしたが|だよ))`),
    not: rx(`が[\\s\\u3000]*(つもり|積もり)`),
    hides: DESU_FAMILY,
  },
  { id: 'hou-ga-ii', re: rx(`(た|だ|ない)[\\s\\u3000]*(ほう|方)[\\s\\u3000]*が[\\s\\u3000]*(いい|良い|よい|よかった|いいよ|いいです)`), hides: DESU_FAMILY },
  { id: 'tara-dou', re: rx(`[ったいだ]ら[\\s\\u3000]*(どう|いかが)(?![\\s\\u3000]*(し|な|す|つかい|使い|おも|思))`), hides: ['tara', ...QUESTION, ...DESU_FAMILY] },
  {
    id: 'te-oku',
    re: rx(`${TE}[\\s\\u3000]*(おき(ます|ました|ません|ましょう|たい|ましたか)|おく(?![らじれ])|おいて|おいた|おこう|おけ|おかない|置きます|置いて)`),
    alt: rx(`(っ|ん|い|し|べ|み|き|け|え|ね|せ|れ|め|げ)と(く|いた|いて|こう|きます)(?!べつ|い[^たて]|ちょう|に)|[んい]ど(く|いた|いて|こう)(?!く)`),
    not: rx(`${TE}[\\s\\u3000]*おきて|とくべつ|とくい|かんとく|つんどく|なっとく|せっとく|ほっとく(?!ね)|もくてき|(もっと|きっと|ずっと|ちょっと|そっと|じっと|ちゃんと|きちんと|ほんと)(く|いた|いて|こう|き)|きとく`),
  },
  {
    id: 'te-aru',
    re: rx(`${TE}[\\s\\u3000]*(あり|有り)(ます|ました|ません|ますか)|${TE}[\\s\\u3000]*(ある|あった)(?=[\\s\\u3000、。！？よね]|$|から|けど|の)`),
    not: rx(`はじめて[\\s\\u3000]*(あ|会)`),
    hides: ['ni-aru'],
  },
  // 4.8 Talk casually.
  {
    id: 'plain',
    re: rx(`([うくぐすつぬぶむるいただ]|ない|だった)[\\s\\u3000]*(よ|ね|よね|の|かな|わ)[\\s\\u3000]*[！!？?。…〜ー]*[\\s\\u3000]*$`),
    tok: (ts) => {
      const last = [...ts].reverse().find((t) => t.pos !== '記号');
      return last?.s !== 'の' || last.detail.startsWith('終助詞') || HAS_KANJI.test(ts.map((t) => t.s).join('')) === false && endsPlain(ts[ts.indexOf(last) - 1]);
    },
    pos: 'veto',
    not: rx(`(です|ます|でした|ました|ません|でしょう|ください|下さい)[\\s\\u3000]*(よ|ね|よね|の|かな|わ)|(^|[\\s\\u3000、])(わたし|ぼく|おれ|あなた|きみ|だれ|これ|それ)の[\\s\\u3000]*[！!？?。]*$|^(はい|ええ|いいえ|うん)[\\s\\u3000、]*(よ|ね)|(すい|みな|かな|ほん)[\\s\\u3000]*(よ|ね)$`),
  },
  {
    id: 'n-da',
    re: rx(`([うくぐつぬむぶるいたな]|[^\\s\\u3000、]す)(ん|の)だ(?!ち|け|ん)|([うくぐすつぬむぶるいたな])んだ(よ|ね|もん|って|けど|から)`),
    not: rx(`(^|[\\s\\u3000、])(なんだ|すんだ|しんだ|よんだ|のんだ|とんだ|あそんだ|えらんだ|ならんだ|かんだ)|(この|その|あの|どの)だ|(ふっと|ころ|なら|すす|やす|ぬす)んだ|(^|[\\s\\u3000、])うんだ`),
  },
  // 〜てる／〜とく: ている and ておく, said casually. Only with tokens: すてる, そだてる and でる end in てる too.
  // Verbs that end in てる／でる themselves (すてる, そだてる, でる) have no て-form before the てる.
  {
    id: 'teru',
    re: rx(`[っしべみきいけえねせれめげじびちりぎ]て(る|た|ます|て|ない|なかった)(?=[\\s\\u3000、。！？!?…よねのかんしけ]|$)|[んい]で(る|た|ます|て|ない)(?=[\\s\\u3000、。！？!?…よねのかんしけ]|$)|(っ|ん|い|し|べ|み|き|け|え|ね|せ|れ|め|げ)と(く|いた|いて|こう)(?!べつ|い[^たて]|ちょう)|[んい]ど(く|いた|いて|こう)`),
    not: rx(`(てるてる|とくべつ|とくい|かんとく|つんどく|なっとく|せっとく|ホテル|(^|[\\s\\u3000、])(すて|そだて|たて|あて|はて|もて|かて|でる))|(もっと|きっと|ずっと|ちょっと|そっと|じっと|ちゃんと|きちんと|ほんと)(く|いた|いて|こう|き)|きとく`),
  },
  // 4.9 Polite to strangers.
  {
    id: 'o-kudasai',
    re: rx(`お(まち|待ち|すわり|座り|はいり|入り|かけ|掛け|あがり|上がり|さがり|下がり|もち|持ち|よび|呼び|つかい|使い|いれ|入れ|きき|聞き|かえり|帰り|こし|越し|とり|取り|のり|乗り|おり|降り|ためし|試し|たちより|立ち寄り|もとめ|求め|うけとり|受け取り|まちがえ|気をつけ|きをつけ|きがるに|気軽に|しらせ|知らせ|わたり|渡り|すすみ|進み|ならび|並び|めしあがり|召し上がり|あるき|歩き|いそぎ|急ぎ|つかまり|つかみ|でかけ|出かけ|すごし|過ごし|休み|やすみ|みせ|見せ|はなし|話し|かき|書き|よみ|読み|まわり|回り|ぬぎ|脱ぎ|はき|履き|つけ|付け|わすれ|忘れ|あずけ|預け|かけ|掛け|おくり|送り|もうしこみ|申し込み|しはらい|支払い)[\\s\\u3000]*(ください|下さい)|ご(ちゅうい|えんりょ|りよう|らん|ようい|かくにん|れんらく|ちゅうもん|きにゅう|じょうしゃ|注意|遠慮|利用|覧|用意|確認|連絡|注文|記入|乗車)[\\s\\u3000]*(ください|下さい)`),
    hides: ['kudasai'],
  },
  {
    id: 'o-ni-naru',
    re: rx(`お(かえり|帰り|かけ|掛け|よみ|読み|まち|待ち|つかい|使い|わかり|分かり|みえ|見え|かき|書き|のり|乗り|すわり|座り|はいり|入り|でかけ|出かけ|もち|持ち|きき|聞き|すまい|住まい|うまれ|生まれ|つき|着き|あい|会い|とり|取り|かい|買い|たち|立ち|おき|起き|ね|寝|つくり|作り|きめ|決め|やすみ|休み|しらべ|調べ|きがえ|着替え|もどり|戻り|でになり|すい|吸い|のみ|飲み|たべ|食べ|わすれ|忘れ|こまり|困り|よろこび|喜び|つかれ|疲れ|いそぎ|急ぎ|きまり|決まり|わかり|でかけ|おもい|思い|すわり)[\\s\\u3000]*に[\\s\\u3000]*(なり|なる|なっ|なれ)`),
    not: rx(`(おやすみ|お休み)に[\\s\\u3000]*なります[。！!]*$`),
    hides: ['ni-masu'],
  },
  {
    id: 'o-suru',
    re: rx(`(お(もち|持ち|まち|待ち|つたえ|伝え|しらせ|知らせ|おくり|送り|とり|取り|よび|呼び|あずかり|預かり|みせ|見せ|たずね|尋ね|かし|貸し|かり|借り|てつだい|手伝い|はこび|運び|つつみ|包み|いれ|入れ|わたし|渡し|でんわ|電話|へんじ|返事|しはらい|支払い|きき|聞き|あい|会い|うけ|受け|かえし|返し|ひき|引き|あけ|開け|しめ|閉め|つくり|作り|さがし|探し|えらび|選び|とどけ|届け|むかえ|迎え|まもり|守り)|ご(あんない|しょうかい|れんらく|せつめい|ようい|よやく|そうだん|ほうこく|ちゅうい|かくにん|ていあん|しょうたい|しゅっぱつ|案内|紹介|連絡|説明|用意|予約|相談|報告|注意|確認|提案|招待))[\\s\\u3000]*(します|しました|しましょう|しましょうか|する|して|した|いたします|いたしました|いたしましょう|致します|しております|して おります|して います|しています)`),
    hides: ['keigo'],
  },
  // Special keigo verbs: いらっしゃる, おっしゃる, めしあがる, なさる, まいる, もうす, いたす, うかがう, ござる, おる
  // after a て-form… Not set phrases (ありがとう ございます, いただきます before a meal), おります (get off),
  // まいにち, もう (already), or なさい (do it!).
  {
    id: 'keigo',
    re: rx(`(いらっしゃ|おっしゃ|めしあが|召し上が|なさ(い|っ|る|れ)(?!い[。！!\\s\\u3000]|い$)|まい(り|る|っ)(?!ます[\\s\\u3000]*$)|まいります|参り|参る|もうし(ます|ました|あげ|ません)|申し(ます|ました|上げ|ません)|もうしあげ|いたし(ます|ました|ましょう|て|ません)|致し|うかが|伺|はいけん|拝見|ごらん|ご覧|ござい|ぞんじ|存じ|くださいま|くださっ|いただき(まし|たい|ません)|頂き|いただい|おめにかか|お目にかか|ちょうだい|頂戴)|${TE}[\\s\\u3000]*(おり|居り)(ます|ました|ません)|[をはも][\\s\\u3000]+(よく[\\s\\u3000]+)?(いただき|頂き)ます`),
    not: rx(`(ありがとう|有難う|おはよう|おめでとう|お早う)[\\s\\u3000]*ござい|(なさい)(?![ま])|まいにち|まいとし|まいあさ|まいばん|まいしゅう|まいった|まいっちゃ|ちょうだい[！!。]*$|${TE}[\\s\\u3000]*ごらん`),
  },
  // 4.11 Reasons and order.
  {
    id: 'node',
    re: rx(`(${PLAIN}|な|す|た)[\\s\\u3000]*ので(?!しょう|す|は|も|ん|ー)`),
    not: rx(`(この|その|あの|どの|もの)で`),
    tok: (ts) => some(ts, (t) => t.s === 'ので' && t.pos === '助詞') || some(ts, (t, i) => t.s === 'の' && t.detail.startsWith('非自立') === false && t.pos === '助詞' && tokAt(ts, i + 1)?.s === 'で' && !!tokAt(ts, i + 1)?.detail.startsWith('接続')),
    pos: 'veto',
  },
  {
    id: 'sugiru',
    re: rx(`[^\\s\\u3000、。がはもを](すぎ|過ぎ)(ます|ました|ません|る|た|て|ない|ちゃ|じゃ|ちゃった|ないで|です|だ|でした)`),
    not: rx(`([0-9０-９一二三四五六七八九十]|じ|時|ふん|ぷん|分|はん|半)[\\s\\u3000]*(すぎ|過ぎ)|(すぎ|杉)の`),
  },
  {
    id: 'nagara',
    re: rx(`${STEM}[\\s\\u3000]*ながら`),
    not: rx(`(ざんねん|残念|むかし|昔|しかし|いつも|われ|我|ちいさい|生まれ|しつれい|失礼|かげ|陰|(^|[\\s\\u3000、])(しり|知り|しってい|いい))ながら|[^\\s\\u3000、]い[\\s\\u3000]*ながらも`),
  },
  // ＿し、＿し: listing reasons. Only with tokens: わたし, すし and むし end in し too.
  { id: 'shi', re: rx(`し[\\s\\u3000]*[、,]`), kanaOnly: rx(`([いだるたうくすつむぶぐ]|ない|です|ます)し[\\s\\u3000]*[、,]`), alt: rx(`(ない|ある|いる|です|ます|だ|かった|いい|おいしい|たかい|やすい|こわい|さむい|あつい|ひろい|せまい|きれいだ|しずかだ)[\\s\\u3000]*し[、,]`), tok: (ts) => some(ts, (t, i) => t.s === 'し' && t.pos === '助詞' && t.detail.startsWith('接続助詞') && (endsPlain(tokAt(ts, i - 1)) || isAux(tokAt(ts, i - 1), 'です') || isAux(tokAt(ts, i - 1), 'ます'))), pos: 'need' },
  // 4.12 Change and decisions.
  { id: 'you-ni-naru', re: rx(`(${PLAIN}|れる|せる)[\\s\\u3000]*ように[\\s\\u3000]*(なり|なる|なっ|なれ)`), not: rx(`(に|く)[\\s\\u3000]*なる[\\s\\u3000]*ように`), hides: ['you-ni'] },
  { id: 'koto-ni-suru', re: rx(`([うくぐすつぬぶむる]|ない)[\\s\\u3000]*(こと|事)[\\s\\u3000]*に[\\s\\u3000]*(し|する|した|します)`) },
  { id: 'koto-ni-naru', re: rx(`([うくぐすつぬぶむる]|ない)[\\s\\u3000]*(こと|事)[\\s\\u3000]*に[\\s\\u3000]*(なり|なる|なっ|なった)`) },
  // 4.13 Passive, causative, easy/hard. The passive needs tokens: a godan or する verb + れる, or an ichidan verb
  // + られる with someone doing it (Nに) — without that, ichidan られる reads as "can".
  {
    id: 'passive',
    re: rx(`(れ|られ)(ます|ました|ません|る|た|て|ない|なかった|まし)`),
    tok: (ts) => PASSIVE_TOK(ts),
    pos: 'need',
    hides: ['ni-masu'],
  },
  {
    id: 'sasete-kudasai',
    re: rx(`せ[\\s\\u3000]*て[\\s\\u3000]*(ください|下さい|もらえ|もらいたい|くれ|いただけ|いただき|ほしい)`),
    tok: (ts) => some(ts, (t, i) => (t.base === 'せる' || t.base === 'させる') && t.detail.startsWith('接尾') && tokAt(ts, i + 1)?.s === 'て'),
    pos: 'need',
    hides: ['te-kudasai', 'kudasai', 'te-moraeru', 'te-kuremasen', 'te-itadakemasen', 'ageru-kureru', 'keigo'],
  },
  {
    id: 'yasui-nikui',
    re: rx(`${STEM}(やす|にく|づら)(い|く|かった|そう|さ)`),
    not: rx(`あいにく|(^|[\\s\\u3000、をがはの])(お|ぎゅう|ぶた|とり|やき|ひ|ひき)にく|(^|[\\s\\u3000、])にくい`),
    tok: (ts) => some(ts, (t) => (t.base === 'やすい' || t.base === 'にくい' || t.base === 'づらい') && t.detail.startsWith('非自立')),
    pos: 'veto',
  },
  // 4.14 Quote, purpose, embedded questions.
  {
    id: 'to-itte-ita',
    re: rx(`(と|って)[\\s\\u3000]*(いって|言って)[\\s\\u3000]*(い|た|まし)|と[\\s\\u3000]*(いいました|言いました|いった|言った|いってた|言ってた|いっていた)`),
    not: rx(`(^|[\\s\\u3000、])(なん|何)と[\\s\\u3000]*(いい|言い)|(ともだち|かぞく|みんな|いっしょ|かれ|かのじょ|ちち|はは|あに|あね|いもうと|おとうと|友達|家族)と[\\s\\u3000]*(いって|いっ|行)`),
  },
  // Purpose ために after a non-past verb, or Nの ために "for" (こどもの ために). Not a reason ため (after た or an
  // adjective), ためし, ためる.
  {
    id: 'tame-ni',
    re: rx(`([うくぐすつぬぶむる]|(こども|子供|かぞく|家族|みんな|けんこう|健康|しょうらい|将来|ゆめ|夢|しけん|試験|ひと|人|わたし|あなた|ともだち|友達|しごと|仕事|おきゃく|お客|なん|何|きょう|今日|あした|明日|パーティー|たんじょうび|誕生日|ダイエット)の)[\\s\\u3000]*(ために|為に|ための)`),
    // …nor a reason with its own subject: かれが くる ために (because he's coming).
    not: rx(`ためし|ためる|ためいき|が[\\s\\u3000]+([^\\s\\u3000、。]+[\\s\\u3000]+)?(くる|来る|ある|いる|なる)[\\s\\u3000]*ために`),
  },
  {
    id: 'you-ni',
    re: rx(`([うくぐすつぬぶむる]|ない|れる|せる)[\\s\\u3000]*ように(?![\\s\\u3000]*(なり|なる|なっ|なれ|し|する|して|いって|言って|いわれ|言われ|たのん|頼ん|みえ|見え))`),
    not: rx(`(の|な)[\\s\\u3000]*ように|(おもう|思う|しって[\\s\\u3000]*いる|しってる|知って[\\s\\u3000]*いる|いう|言う|みる)[\\s\\u3000]*ように`),
  },
  { id: 'ka-dou-ka', re: rx(`か[\\s\\u3000]*(どうか|どう[\\s\\u3000]+か)(?![\\s\\u3000]*(おねがい|お願い))`), hides: [] },
  {
    id: 'nani-ka',
    re: rx(`(なに|なん|何|どこ|どれ|どの|だれ|誰|いつ|どう|どんな|いくら|どちら|なぜ|どうして|いくつ)[^。？?！!]*?(${PLAIN}|[ぁ-ん]た)[\\s\\u3000]*か[\\s\\u3000、]*((まだ|よく|ぜんぜん|ちょっと|しょうじきに|正直に)[\\s\\u3000]*)?(わか|分か|しり|しら|しって|知|おしえ|教え|せつめい|説明|えら|選|いい|言い|きい|きき|きか|聞|おぼえ|覚え|わすれ|忘れ|しらべ|調べ|かんがえ|考え|きめ|決め|いって|言って|みて|見て|たずね|尋ね|はなし|話|あて|当て|きにな|気にな|ふしぎ)`),
    not: rx(`(なに|だれ|どこ|いつ|どれ|なん|何|誰)か[\\s\\u3000]|か[\\s\\u3000]*どうか|かしら|(なに|なん|だれ|どこ|いつ)も|どうも|なんでも|いつでも`),
  },
  // ---- Added on the Japanese expert's advice (Nov 1): N4 grammar the goals need ----
  // A guess from what you see: ＿みたいです／＿ようです. Not 〜て みたい (want to try), Nが みたい (want to see),
  // おはよう, ようこそ, ようび, or Nの ように (like N, as an adverb).
  {
    id: 'mitai-you',
    re: rx(`[^\\s\\u3000、。てでがを][\\s\\u3000]*みたい[\\s\\u3000]*(です|でした|だ|だった|ね|よ|[。！!？?…]|$)|(${PLAIN}|の|な)[\\s\\u3000]*(よう|様)[\\s\\u3000]*(です|でした|だ|だった)`),
    // A む verb + たい (のみたい, すみたい) is "want to", not みたい.
    not: rx(`${TE}[\\s\\u3000]*みたい|(が|を|も)[\\s\\u3000]*みたい|(^|[\\s\\u3000、をがもは])(の|飲|よ|読|す|住|やす|休|か|噛|たの|頼|ぬす|盗|すす|進|あ|編|う|生|しず|沈|ふ|踏|こ|込|つつ|包|つ|積|この|好)みたい|おはよう|ようこそ|ようび|(どう|こう|そう|ちゅう|ほう|しゅう|きょう|ひつ|だいじょう|しよう|たべよう|いこう)よう[\\s\\u3000]*です|[おこごそぞとどのぼもよろ]う[\\s\\u3000]*(よう|様)[\\s\\u3000]*です`),
    hides: [...DESU_FAMILY, 'tai'],
  },
  // Explaining, politely: ＿んです／＿のです. Only with tokens (ん as a 非自立 noun before です): かいしゃいんです
  // and びょういんです end in ん too.
  {
    id: 'n-desu',
    re: rx(`(ん|の)[\\s\\u3000]*(です|でした|ですか|ですが)`),
    tok: (ts) => some(ts, (t, i) => (t.s === 'ん' || t.s === 'の') && t.pos === '名詞' && t.detail.startsWith('非自立') && isAux(tokAt(ts, i + 1), 'です') && (endsPlain(tokAt(ts, i - 1)) || isAux(tokAt(ts, i - 1), 'だ') || tokAt(ts, i - 1)?.s === 'な')),
    pos: 'need',
    kanaOnly: rx(`([うくぐすつぬぶむるた]|ない|かった|[^\\s\\u3000ん]い|[^\\s\\u3000]な)[\\s\\u3000]*(ん|の)[\\s\\u3000]*です`),
    hides: [...DESU_FAMILY, 'n-da'],
  },
  // Making or letting someone do it: ＿させます. Only with tokens (せる／させる as a suffix): ませ, あわせ, しあわせ
  // end in せ too. ＿させて ください is its own frame.
  {
    id: 'causative',
    re: rx(`(せ|させ)(ます|ました|ません|る|た|ない|なかった|られ|て)`),
    tok: (ts) => some(ts, (t, i) => (t.base === 'せる' || t.base === 'させる') && t.pos === '動詞' && t.detail.startsWith('接尾') && !(tokAt(ts, i + 1)?.s === 'て' && ['ください', '下さい', 'もらえ', 'くれ', 'いただけ', 'ほしい'].some((x) => (tokAt(ts, i + 2)?.s ?? '').startsWith(x)))),
    pos: 'need',
    kanaOnly: rx(`([かがさたなばまらわ]せ|させ)(ます|ました|ません|る|た|ない|なかった|られ|て)`),
    hides: ['ni-masu'],
  },
  // Wanting someone else to do it: ＿て ほしい.
  { id: 'te-hoshii', re: rx(`${TE}[\\s\\u3000]*(ほし|欲し)(い|く|かった)`), hides: [...DESU_FAMILY, 'hoshii'] },
  // Regret: ＿ば よかった.
  { id: 'ba-yokatta', re: rx(`(けれ|[えけげせぜてねへべめれ])ば[\\s\\u3000]*(よかった|良かった)`), not: rx(`(たとえ|例え)ば`), hides: ['ba', ...DESU_FAMILY] },
  // Examples of what you did: ＿たり ＿たり します. Two たり／だり after a verb, then する. Not ふたり, あたり,
  // ぴったり, ゆったり.
  {
    id: 'tari-tari',
    re: rx(`[っいしきみびんぎちりにえけせてでねべめれげじ](たり|だり)[^。！？]*?[っいしきみびんぎちりにえけせてでねべめれげじ](たり|だり)[\\s\\u3000]*(し|する|した|して|します|しました|しています)`),
    not: rx(`(ぴ|ば|ゆ|ぐ|が|か|さ|や|ま|ば|ぼ|ほ|に|け)ったり|(ふ|ひと)たり`),
  },
  // Where in an action you are: ＿る／＿て いる／＿た ところです. Not a place (すんで いる ところ: where I live).
  {
    id: 'tokoro-desu',
    re: rx(`([るた]|て[\\s\\u3000]*いる|てる|で[\\s\\u3000]*いる|でる|だ)[\\s\\u3000]*(ところ|所)[\\s\\u3000]*(です|だ|でした|だった|なんです)`),
    not: rx(`(すんで|住んで|はたらいて|働いて|つとめて|勤めて)[\\s\\u3000]*(いる|る)?[\\s\\u3000]*(ところ|所)|(すんで|住んで|すむ|住む|うまれた|生まれた|そだった|育った|はたらいて|働いて|つとめて|勤めて|いった|行った|いく|行く|いきたい|すきな|好きな|いい|あった|会った|あそぶ|あそんだ|みた|見た|かった|買った)[\\s\\u3000]*(ところ|所)`),
  },
  // A casual quote: ＿って いって いた／＿って いう. Not topic って (こうちゃって おいしい).
  // The quote follows a plain form (やすみだって, くるって, ないって) or a request (まってって); もって いって is "take".
  { id: 'tte-quote', re: rx(`([だるたいうくすつぬぶむぐて]|ない)って[\\s\\u3000]*(いって|いった|いう|いってた|いいました|いいます|きいた|きいて|きいたよ|聞い|言っ|言う)`) },
];

// ---- N3 matchers (the three the step needs part of speech for, and のに, now N4) ----
const N3: Matcher[] = [
  // Hearsay らしい: かれは くる らしい. Not the adjectives あたらしい, めずらしい, すばらしい, nor おとこらしい (manly)
  // or Nらしい, which can mean either "apparently N" or "typical of N".
  {
    id: 'rashii',
    // Nらしい at the very end reads as hearsay (あしたは あめらしい); before a noun or ね it's "typical of".
    alt: rx(`[^\\s\\u3000、]らしい(です)?[\\s\\u3000]*[。！!]*[\\s\\u3000]*$`),
    re: rx(`(${PLAIN}|ない)[\\s\\u3000]*らし(い|く|かった)`),
    not: rx(`(あた|かわい|いや|ばか|あほ|きたな|めず|すば|素晴|可愛|にく|憎|あい|愛|ほこ|誇|みすぼ|わざと|もっとも|しおらし|いじらし|うい|おとこ|おんな|こども|おとな|男|女|子供|大人|さん|くん|ちゃん|さま|様)らし|らしい[\\s\\u3000]*(ね|な)|らしい[\\s\\u3000]+(?!です|でした|よ|ね)[ぁ-んァ-ヶ一-龯]`),
    tok: (ts) => some(ts, (t) => t.base === 'らしい' && t.pos === '助動詞'),
    pos: 'veto',
    hides: DESU_FAMILY,
  },
  // のに: even though. Not の + に (この にもつ) or purpose のに (きるのに つかいます).
  {
    id: 'noni',
    re: rx(`(${PLAIN}|な|です|ます|でした|ました)[\\s\\u3000]*のに(?![\\s\\u3000]*(つかい|使い|つかう|使う|いい|良い|べんり|便利|ひつよう|必要|やくに|役に|ちょうど|てきして|かかり|かかる|かかった|かかります|じゅうぶん|十分))`),
    not: rx(`(この|その|あの|どの)[\\s\\u3000]*に|のに[、,\\s\\u3000][^。]*(かかり|かかる|かかった|つかい|使い|ひつよう|必要|べんり|便利)`),
    tok: (ts) => some(ts, (t) => t.s === 'のに' && t.pos === '助詞'),
    pos: 'veto',
  },
  // うちに: while still, before. kuromoji reads every kana うち as "home", so this goes by spelling: after
  // ない, ている, な or an adjective, and not before a verb of going home or living (おおきい うちに すんで).
  {
    id: 'uchi-ni',
    re: rx(`(ない|て[\\s\\u3000]*いる|て[\\s\\u3000]*いない|てる|(^|[\\s\\u3000、])(いる|ある)|な|[^\\s\\u3000、]い|(きょう|今日|こんしゅう|今週|ことし|今年|こんや|今夜|あさ|朝|ひる|昼|いま|今|しゅうまつ|週末|なつやすみ|夏休み)の)[\\s\\u3000]*(うちに|内に)`),
    not: rx(`(そのうち|その うち)|(うち|内)に[\\s\\u3000]*(すん|住|かえ|帰|いる|いま|き[てま]|来|あそびに|とまり|泊|もどり|ある|あり|おいで|よって|寄っ|つい|着い|は?いっ|入っ|むかえ|ひっこ|引っ越)|(おおきい|大きい|ちいさい|小さい|あたらしい|新しい|ふるい|古い|ひろい|広い|せまい|狭い|きれいな|りっぱな|しずかな|すてきな|あかい|しろい|たかい|高い)[\\s\\u3000]*(うち|家)`),
  },
  // Reason ため: after た／だった, an adjective, な, or Nの with a cause (あめ, じこ…). kuromoji reads kana ため as
  // ためる, so this goes by spelling too. A noun + の that could be a goal is left out (both readings).
  {
    id: 'tame-reason',
    re: rx(`([ぁ-ん]た|だった|なかった|かった|[^\\s\\u3000、てで]い|な|(あめ|雨|ゆき|雪|じこ|事故|かぜ|風|風邪|たいふう|台風|じしん|地震|こうじ|工事|ちゅう|中|びょうき|病気|けが|ちこく|ていでん|停電|こしょう|故障|じゅうたい|渋滞|ねつ|熱|ゆうれい)の)[\\s\\u3000]*(ため|為)(に)?[、,\\s\\u3000]`),
    not: rx(`ためし|ためる|ためいき|(ない|たい)[\\s\\u3000]+(ため|為)`),
  },
];

const d = (id: FrameId, level: 'n5' | 'n4' | 'n3', goal: string, ja: string, en: string, use: string, exJa: string, exEn: string): Frame => ({
  id,
  level,
  goal,
  ja,
  en,
  use,
  example: { ja: exJa, en: exEn },
  status: 'draft',
});

/** More N5 frames for the tiered path's goals, after the sixteen above. Draft until a fluent speaker checks them. */
export const MORE_N5_FRAMES: readonly Frame[] = [
  d('ikura', 'n5', '', '＿は いくらですか', 'How much is ___?', 'Ask the price.', 'この おべんとうは いくらですか。', 'How much is this bento?'),
  d('ji-fun', 'n5', '', '＿じ ＿ふん（ぷん）です', "It's ___:___", 'Say the time.', 'いま、さんじ じゅっぷんです。', "It's 3:10 now."),
  d('ni-masu', 'n5', '', '＿に ＿ます', 'I go/do ___ to/at ___', 'Say where you go, or when you do it.', 'まいあさ しちじに おきます。', 'I get up at seven every morning.'),
  d('youbi', 'n5', '', '＿ようび', '___day', 'Name the day of the week.', 'きょうは きんようびです。', "Today is Friday."),
  d('gatsu-nichi', 'n5', '', '＿がつ ＿にち', 'Month and day', 'Say a date.', 'たんじょうびは しがつ ついたちです。', 'My birthday is April 1st.'),
  d('wa-ni-aru', 'n5', '', '＿は ＿に あります', '___ is in/at ___', 'Say where something is (います for people and animals).', 'ねこは へやに います。', 'The cat is in the room.'),
  d('migi-hidari', 'n5', '', '＿の まえに ／ みぎに', 'In front of / right of ___', 'Say where, using position words.', 'えきの まえに あります。', "It's in front of the station."),
  d('hoshii', 'n5', '', '＿が ほしいです', 'I want ___', 'Say what thing you want.', 'あたらしい かさが ほしいです。', 'I want a new umbrella.'),
  d('de-o', 'n5', '', '＿で ＿を ＿ます', 'I do ___ at/with ___', 'で marks where, or with what.', 'こうえんで おべんとうを たべます。', 'I eat my lunch in the park.'),
  d('te-iru', 'n5', '', '＿て います', "I'm ___ing", 'Say what is going on now, or a state.', 'いま、テレビを みて います。', "I'm watching TV now."),
  d('no', 'n5', '', '＿の ＿', "___'s ___", 'Join two nouns: whose, or what kind.', 'これは わたしの かばんです。', 'This is my bag.'),
  d('adj-desu', 'n5', '', '＿いです ／ ＿です', "It's ___ (describing)", 'Describe something with an adjective.', 'この ラーメンは おいしいです。', 'This ramen is tasty.'),
  d('kunai', 'n5', '', '＿くないです', "It isn't ___", 'Say what something is not like.', 'きょうは さむくないです。', "It isn't cold today."),
  d('kara', 'n5', '', '＿から', '___, so…', 'Give a reason first, then what happens.', 'あついから、まどを あけます。', "It's hot, so I'll open the window."),
  d('hou-ga', 'n5', '', '＿より ＿の ほうが', '___ more than ___', 'Compare two things.', 'いぬより たぬきの ほうが すきです。', 'I like tanuki more than dogs.'),
  d('mashou', 'n5', '', '＿ましょう', "Let's ___", 'Suggest doing something together.', 'いっしょに たべましょう。', "Let's eat together."),
  d('naide-kudasai', 'n5', '', '＿ないで ください', "Please don't ___", 'Ask someone not to do something.', 'ここで たべないで ください。', "Please don't eat here."),
];

/** The Express Line (急行, N4): goals 4.1 to 4.14 (docs/n4-n3-frames.md). Draft until a fluent speaker checks them. */
export const N4_FRAMES: readonly Frame[] = [
  d('te-moraeru', 'n4', '4.1', '＿て もらえますか', 'Could you ___ for me?', 'Ask a favour.', 'おべんとうを あたためて もらえますか。', 'Could you heat up my bento?'),
  d('te-kuremasen', 'n4', '4.1', '＿て くれませんか', "Would you ___ for me?", 'Ask a favour of a friend or someone close.', 'ちょっと てつだって くれませんか。', 'Would you help me a bit?'),
  d('ageru-kureru', 'n4', '4.1', '＿て あげます／くれます／もらいます', 'do ___ for someone', 'Say who did a kindness for whom.', 'ともだちが ノートを みせて くれました。', 'My friend showed me their notes.'),
  d('te-itadakemasen', 'n4', '4.1, 4.9', '＿て いただけませんか', 'Could you kindly ___?', 'Ask a stranger or a guest a favour.', 'もう いちど いって いただけませんか。', 'Could you kindly say it once more?'),
  d('nakereba', 'n4', '4.2', '＿なければ なりません', 'I have to ___', 'Say what you must do.', 'あした はやく おきなければ なりません。', 'I have to get up early tomorrow.'),
  d('nakutemo-ii', 'n4', '4.2', '＿なくても いいです', "You don't have to ___", "Say what isn't needed.", 'くつを ぬがなくても いいです。', "You don't have to take your shoes off."),
  d('te-wa-ikenai', 'n4', '4.2', '＿ては いけません', "You mustn't ___", 'Say what is not allowed.', 'ここで しゃしんを とっては いけません。', "You mustn't take photos here."),
  d('ta-koto', 'n4', '4.3', '＿た ことが あります', "I've ___ before", 'Talk about experiences.', 'かっぱを みた ことが あります。', "I've seen a kappa."),
  d('te-shimau', 'n4', '4.3', '＿て しまいました', 'I ended up ___ / I\'ve done ___', 'Say you did it completely, or that it happened and you regret it.', 'でんしゃで ねて しまいました。', 'I fell asleep on the train.'),
  d('te-miru', 'n4', '4.3', '＿て みます', "I'll try ___", 'Say you will give something a go.', 'この ケーキを たべて みます。', "I'll try this cake."),
  d('potential', 'n4', '4.4', 'たべられます ／ よめます', 'I can ___', 'Say what you can do: ＿られる for る verbs, ＿える for the rest (よむ → よめる).', 'ひらがなが よめます。', 'I can read hiragana.'),
  d('tara', 'n4', '4.5', '＿たら', 'if / when ___', 'Say what happens once something else does.', 'えきに ついたら、でんわして ください。', 'Call me when you get to the station.'),
  d('nara', 'n4', '4.5', '＿なら', 'if it\'s ___', 'Pick up what someone said: "if it\'s that…".', 'すしなら、あの みせが いいです。', 'If it\'s sushi, that shop is good.'),
  d('ba', 'n4', '4.5', '＿ば', 'if ___', 'Say what it takes: if this, then that.', 'やすければ かいます。', "If it's cheap, I'll buy it."),
  d('to-cond', 'n4', '4.5', '＿と', 'whenever / if ___', "Say what always follows. A request or offer can't come after と.", 'この ボタンを おすと、ドアが あきます。', 'Press this button and the door opens.'),
  d('toki', 'n4', '4.5', '＿とき', 'when ___', 'Say when something happens.', 'こどもの とき、ねこを かって いました。', 'When I was a child, I had a cat.'),
  d('temo', 'n4', '4.5', '＿ても', 'even if ___', 'Say it happens anyway.', 'あめが ふっても、いきます。', "Even if it rains, I'll go."),
  d('sou-look', 'n4', '4.6', '＿そうです', 'It looks ___', 'Say how something looks.', 'この ケーキ、おいしそうです。', 'This cake looks tasty.'),
  d('sou-hear', 'n4', '4.6', '＿る／＿た／＿だ そうです', 'I hear ___', 'Pass on what you heard.', 'あしたは あめが ふるそうです。', 'I hear it will rain tomorrow.'),
  d('to-omou', 'n4', '4.6', '＿と おもいます', 'I think ___', 'Give your opinion or guess.', 'もう でんしゃは こないと おもいます。', "I don't think any more trains are coming."),
  d('kamo', 'n4', '4.6', '＿かもしれません', 'It might ___', 'Say something is possible.', 'あしたは ゆきかもしれません。', 'It might snow tomorrow.'),
  d('ni-yoru', 'n4', '4.6', '＿に よると ＿そうです', 'According to ___, I hear ___', 'Say where you heard it.', 'てんきよほうに よると、あしたは ゆきが ふるそうです。', 'According to the forecast, it will snow tomorrow.'),
  d('n-datte', 'n4', '4.6', '＿んだって', 'They say ___ (casual)', 'Pass on news to a friend.', 'ポン、また ちこくしたんだって。', 'Apparently Pon was late again.'),
  d('hazu', 'n4', '4.6', '＿はずです', 'It should ___', 'Say what you expect.', 'バスは もうすぐ くる はずです。', 'The bus should come soon.'),
  d('you-to-omou', 'n4', '4.7', '＿(よ)うと おもいます', "I'm thinking of ___", 'Share a plan.', 'らいねん にほんに いこうと おもいます。', "I'm thinking of going to Japan next year."),
  d('tsumori', 'n4', '4.7', '＿つもりです', 'I intend to ___', 'Say what you mean to do.', 'なつやすみに うみに いく つもりです。', 'I plan to go to the sea in the summer holidays.'),
  d('hou-ga-ii', 'n4', '4.7', '＿た ほうが いいです', 'You should ___', 'Give advice.', 'はやく ねた ほうが いいです。', "You should go to bed early."),
  d('tara-dou', 'n4', '4.7', '＿たら どうですか', "Why don't you ___?", 'Suggest something to try.', 'すこし やすんだら どうですか。', "Why don't you rest a bit?"),
  d('te-oku', 'n4', '4.7', '＿て おきます', "I'll ___ in advance", 'Say you will get something ready.', 'さきに きっぷを かって おきます。', "I'll buy the tickets ahead of time."),
  d('te-aru', 'n4', '4.7', '＿て あります', '___ has been done', 'Say something is ready, done on purpose.', 'へやは よやくして あります。', 'The room is booked.'),
  d('plain', 'n4', '4.8', '＿よ ／ ＿ね ／ ＿の？', 'Casual talk', 'Talk with friends: drop です and ます.', 'これ、おいしいね！', 'This is good, huh!'),
  d('n-da', 'n4', '4.8', '＿んだ', 'You see, ___', 'Explain, casually.', 'きょうは つかれて いるんだ。', "I'm tired today, you see."),
  d('teru', 'n4', '4.8', '＿てる ／ ＿とく', "___ing (casual)", 'ている and ておく, as friends say them.', 'いま、ごはん たべてる。', "I'm eating right now."),
  d('o-kudasai', 'n4', '4.9', 'お＿ください', 'Please ___ (polite)', 'Ask a guest or customer to do something.', 'こちらで おまちください。', 'Please wait here.'),
  d('o-ni-naru', 'n4', '4.9', 'お＿に なります', 'They do ___ (respectful)', 'Talk politely about what a guest does.', 'おきゃくさまは もう おかえりに なりました。', 'The guest has already gone home.'),
  d('o-suru', 'n4', '4.9', 'お＿します', "I'll ___ for you (humble)", 'Offer to do something for a guest.', 'にもつを おもちします。', "I'll carry your bags."),
  d('keigo', 'n4', '4.9', 'いらっしゃいます ／ まいります', 'Special polite verbs', 'The special polite verbs: いらっしゃいます, まいります, もうします, ございます…', 'まもなく でんしゃが まいります。', 'The train will arrive shortly.'),
  d('node', 'n4', '4.11', '＿ので', 'Since ___ (politer)', 'Give a reason, politely.', 'あめが ふって いるので、いきません。', "It's raining, so I won't go."),
  d('sugiru', 'n4', '4.11', '＿すぎます ／ ＿すぎて', 'too ___', 'Say there is, or was, too much.', 'たべすぎて、おなかが いたいです。', 'I ate too much and my stomach hurts.'),
  d('nagara', 'n4', '4.11', '＿ながら', 'while ___ing', 'Say two things at once.', 'おんがくを ききながら、はしります。', 'I run while listening to music.'),
  d('shi', 'n4', '4.11', '＿し、＿し', '___, and ___ too', 'List reasons.', 'やすいし、おいしいし、この みせが すきです。', "It's cheap and tasty, so I like this shop."),
  d('you-ni-naru', 'n4', '4.12', '＿ように なりました', "I've come to ___", 'Say what changed: now you can, or now you do.', 'にほんごが はなせるように なりました。', "I've become able to speak Japanese."),
  d('koto-ni-suru', 'n4', '4.12', '＿ことに しました', "I've decided to ___", 'Say what you decided.', 'まいにち あるく ことに しました。', "I've decided to walk every day."),
  d('koto-ni-naru', 'n4', '4.12', '＿ことに なりました', "It's been decided that ___", 'Say what was decided for you.', 'らいげつ ひっこす ことに なりました。', "It's been decided I'll move next month."),
  d('passive', 'n4', '4.13', '＿れました ／ ＿られました', 'I got ___ed / It was ___ed', 'Say what was done to you.', 'ははに しかられました。', 'I got told off by my mum.'),
  d('sasete-kudasai', 'n4', '4.13', '＿させて ください', 'Let me ___', 'Ask to be allowed to do something.', 'わたしに はらわせて ください。', 'Let me pay.'),
  d('yasui-nikui', 'n4', '4.13', '＿やすい ／ ＿にくい', 'easy / hard to ___', 'Say how easy something is to do.', 'この ペンは かきやすいです。', 'This pen is easy to write with.'),
  d('to-itte-ita', 'n4', '4.14', '＿と いって いました', '(They) said ___', 'Pass on what someone said.', 'フデさんは きょう おくれると いって いました。', 'Fude said they\'d be late today.'),
  d('tame-ni', 'n4', '4.14', '＿ために', 'in order to ___', 'Say what something is for.', 'にほんごを べんきょうする ために、にほんに きました。', 'I came to Japan to study Japanese.'),
  d('you-ni', 'n4', '4.14', '＿ように', 'so that ___', 'Say what you do it for.', 'わすれないように、メモします。', "I'll make a note so I don't forget."),
  d('ka-dou-ka', 'n4', '4.14', '＿か どうか', 'whether ___', 'Say you\'re not sure yes or no.', 'しゅうでんに まにあうか どうか、わかりません。', "I don't know whether I'll make the last train."),
  d('nani-ka', 'n4', '4.14', 'なに／どこ／だれ ＿か', 'what ___ (inside a sentence)', 'Fold a question into a sentence.', 'なにを たべたか、おしえて ください。', 'Tell me what you ate.'),
  // のに moved here from N3 on the Japanese expert's advice (Genki II L22, Minna II L45 teach it in the N4 range).
  d('noni', 'n4', '4.5', '＿のに', 'even though ___', 'Say it turned out against what you expected.', 'がんばったのに、まけました。', 'I tried hard, and still lost.'),
  // Added on the Japanese expert's advice: N4 grammar Genki II and Minna II students expect. No path goal yet.
  d('mitai-you', 'n4', '', '＿みたいです ／ ＿ようです', "It seems ___ / It's like ___", 'Guess from what you see or hear, or say what something is like.', 'だれも いない みたいです。', 'It seems nobody is here.'),
  d('n-desu', 'n4', '', '＿んです', "It's that ___ (explaining)", 'Explain, or ask for an explanation, politely.', 'じつは、あした ひっこすんです。', "The thing is, I'm moving tomorrow."),
  d('causative', 'n4', '', '＿させます ／ ＿せます', 'make / let ___ do it', 'Say who you made, or let, do something.', 'こどもに やさいを たべさせました。', 'I made the kids eat vegetables.'),
  d('te-hoshii', 'n4', '', '＿て ほしいです', 'I want you to ___', 'Say what you want someone else to do.', 'もっと ゆっくり はなして ほしいです。', 'I want you to speak more slowly.'),
  d('ba-yokatta', 'n4', '', '＿ば よかったです', 'I should have ___', 'Say what you wish you had done.', 'もっと はやく くれば よかったです。', 'I should have come earlier.'),
  d('tari-tari', 'n4', '', '＿たり ＿たり します', 'do things like ___ and ___', 'Give examples of what you do.', 'しゅうまつは えいがを みたり、ほんを よんだり します。', 'At weekends I watch films, read books and so on.'),
  d('tokoro-desu', 'n4', '', '＿ところです', "I'm just about to / in the middle of / have just ___", 'Say where you are in an action.', 'いま、でかける ところです。', "I'm just about to go out."),
  d('tte-quote', 'n4', '', '＿って いって いました', '(They) said ___ (casual)', 'Pass on what someone said, casually.', 'あしたは やすみだって いって いたよ。', 'They said tomorrow is a day off.'),
];

/** The four Limited Express (特急, N3) frames that need part of speech; the rest of N3 comes at step 6. Draft. */
export const N3_FRAMES: readonly Frame[] = [
  d('rashii', 'n3', '3.1', '＿らしいです', 'Apparently ___', 'Pass on something you heard or read.', 'ゆきおんなは らいげつ けっこんする らしいです。', 'Apparently the snow woman is getting married next month.'),
  d('uchi-ni', 'n3', '3.9', '＿うちに', 'while still ___', 'Do it before the chance passes.', 'あつい うちに たべて ください。', 'Eat it while it\'s hot.'),
  d('tame-reason', 'n3', '3.3', '＿ため、', 'Due to ___ (formal)', 'Give a reason, formally.', 'ゆきが ふった ため、でんしゃが おくれて います。', 'The train is late because it snowed.'),
];

/** Every frame, N5 to N3. */
export const ALL_FRAMES: readonly Frame[] = [...FRAMES, ...MORE_N5_FRAMES, ...N4_FRAMES, ...N3_FRAMES];

export const FRAME_BY_ID: Readonly<Record<FrameId, Frame>> = Object.fromEntries(ALL_FRAMES.map((f) => [f.id, f])) as Record<FrameId, Frame>;


const SOU = (kind: 'look' | 'hear') => (s: Sentence) => souKind(s.k, s.toks).includes(kind) || (s.t !== s.k && souKind(s.t, s.toks).includes(kind));

/** Every matcher framesOf runs, most specific first within each level. */
const ALL_MATCHERS: readonly Matcher[] = [...CORE, ...MORE_N5, ...N4, ...N3];
// Ichidan verbs that end in an あ-row kana + れる (わかれる, うまれる, つかれる…) look like a godan passive. These
// are what comes before the れ: the long ones as a word's ending, the one-kana ones as the whole word.
// The godan verbs whose stem ends in an あ-row kana before る (とまる, すわる) make a potential that looks the same.
const ARERU_END = /(わか|うま|つか|こわ|なが|あば|はな|みだ|あら|あらわ|とま|すわ|まが|わた|あが|さが|かか|つかま|あやま|がんば|別|生ま|疲|壊|慣|晴|枯|荒|流|離|乱|現)$/;
const ARERU_WHOLE = /^(な|は|か|あ|た|ば|こ|そ|ど|だ|わ)$/;
const looksIchidan = (w: string) => ARERU_END.test(w) || ARERU_WHOLE.test(w);
/** The passive: from the dictionary when there are tokens, or a godan／する passive spelled out after
 * someone who did it (みんなに わらわれた, ぶちょうに ちゅういされました), since kuromoji reads some of those kana
 * as a single ichidan verb. */
function passiveIn(s: Sentence): boolean {
  // kuromoji misreads kana passives both ways (ねられない as ねら + れ), so the tokens count only with kanji.
  if (s.toks && HAS_KANJI.test(s.t) && PASSIVE_TOK(s.toks)) return true;
  return [s.k, s.t].some((x) => {
    const agent = x.search(/[^\s\u3000、。]に[\s\u3000]/);
    if (agent < 0) return false;
    for (const m of x.slice(agent).matchAll(/([^\s\u3000、。をがにはもで]*?[わかがさたなばまら])れ(る|た|ます|ました|て|ない|なかった|まし)/g)) {
      const w = m[1]!;
      // たべられ, いられ, こられ: an ichidan or くる verb + られる, passive or "can". Only the dictionary can tell.
      if (/[いきぎしじちにひびみりえけげせぜてでねべめれ来]ら$/.test(w) || /(^|[^ぁ-ん])こら$/.test(w) || w === 'こら') {
        // …unless someone did it to something (ともだちに ケーキを たべられました): "can" takes が, not を.
        if (/[^\s\u3000、。]を[\s\u3000]*$/.test(x.slice(agent, x.indexOf(m[0]!, agent))) && !/(ここ|そこ|あそこ|どこ)に/.test(x)) return true;
        continue;
      }
      if (!looksIchidan(w)) return true;
    }
    return false;
  });
}
const SPECIAL: Partial<Record<FrameId, (s: Sentence) => boolean>> = { 'sou-look': SOU('look'), 'sou-hear': SOU('hear'), passive: passiveIn };

/** The dictionary's tokens as the matchers want them: spaces dropped, every field a string. */
function toToks(tokens: readonly UtteranceToken[]): Tok[] {
  return tokens
    .filter((t) => t.pos !== '記号' || !/空白/.test(t.detail ?? '') )
    .filter((t) => t.surface.trim() !== '')
    .map((t) => ({ s: t.surface, pos: t.pos, detail: t.detail ?? '', base: t.base && t.base !== '*' ? t.base : t.surface, ctype: t.ctype ?? '', cform: t.cform ?? '' }));
}

/** Splits tokens into sentences at 。！？, the way `sentences` splits text. */
function tokSentences(toks: Tok[]): Tok[][] {
  const out: Tok[][] = [[]];
  for (const t of toks) {
    out[out.length - 1]!.push(t);
    // kuromoji glues an end mark to the symbols after it (「！　{」, even calling it a noun), so any token
    // holding one ends a sentence.
    if (/[。！？!?]/.test(t.s)) out.push([]);
  }
  return out.filter((x) => x.some((t) => t.pos !== '記号'));
}

function hitsIn(m: Matcher, s: Sentence): boolean {
  const special = SPECIAL[m.id];
  if (special) return special(s);
  const test = (r: RegExp) => [s.k, s.t].some((x) => r.test(x) && !m.not?.test(x));
  // A spelling that counts alone, unless the dictionary says no (素晴らしい is one adjective).
  if (m.alt && test(m.alt) && !(m.pos === 'veto' && s.toks && m.tok && !m.tok(s.toks))) return true;
  const re = s.toks && m.reTok ? m.reTok : m.re;
  if (re ? !test(re) : !m.tok) return false;
  if (!m.tok) return true;
  if (!s.toks) return m.pos !== 'need';
  if (m.kanaOnly && !HAS_KANJI.test(s.t) && !m.kanaOnly.test(s.k)) return false;
  return m.tok(s.toks);
}

/**
 * Every frame in a phrase, N5 to N3, sentence by sentence, in the order of ALL_FRAMES. Pass the kuromoji
 * tokens of `phrase.text` (server/src/reading.ts) to find the frames that need part of speech; without
 * them those are left out. Where a frame says more than another in the same sentence (＿て もらえますか is
 * also a ＿ますか question), only the more specific one is named, which suits showing a player what they
 * said. For counting progress, pass `{ keepHidden: true }` so an N5 frame still counts when a more specific frame
 * also matched (この ケーキ、おいしそうです still counts as ＿です).
 */
export function framesOf(
  phrase: { text: string; kana: string },
  tokens?: readonly UtteranceToken[],
  opts: { keepHidden?: boolean } = {},
): FrameId[] {
  const ks = sentences(phrase.kana);
  const ts = sentences(phrase.text);
  const toks = tokens?.length ? toToks(tokens) : undefined;
  const tokGroups = toks ? tokSentences(toks) : undefined;
  // Pair kana and text sentence by sentence when they split the same way; otherwise read each whole.
  const pairs: Sentence[] =
    ks.length === ts.length || !ts.length
      ? (ks.length ? ks : ts).map((k, i) => ({
          k,
          t: ts[i] ?? k,
          // Tokens that don't split like the text would credit one sentence with another's frame: drop them.
          toks: tokGroups && tokGroups.length === ks.length ? tokGroups[i] : ks.length <= 1 ? toks : undefined,
        }))
      : [{ k: ks.join(' '), t: ts.join(' '), toks }];
  const found = new Set<FrameId>();
  for (const s of pairs) {
    const hit = ALL_MATCHERS.filter((m) => hitsIn(m, s));
    const hidden = new Set(opts.keepHidden ? [] : hit.flatMap((m) => m.hides ?? []));
    const kept = hit.filter((m) => !hidden.has(m.id)).map((m) => m.id);
    for (const id of kept) found.add(id);
  }
  return ALL_FRAMES.map((f) => f.id).filter((id) => found.has(id));
}
