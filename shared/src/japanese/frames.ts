// Sentence frames: the handful of beginner sentence shapes every game keeps reusing
// (docs/progressive-learning.md). A frame has one or two slots the player fills with their own words,
// so seeing 「＿は ＿です」 in Nice to Meet You!, Last Train and Oogiri shows it's one pattern, not three
// phrases. Players on the learning path see each phrase's frame in their phrasebook and on My progress.
//
// Frames are found from a phrase's own words (frameOf), so every game's phrasebook is covered without
// tagging content by hand. A phrase gets at most one frame, the most specific that matches; a phrase that
// matches none (a single word, a set greeting) has none. Missing a frame is fine; naming the wrong one
// isn't, so the matchers ask for clear signs (a spaced particle, a fixed ending) and leave the rest out.

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
  | 'desu';

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
}

/** In the order a beginner meets them (the learning path's order), not the order they're matched in. */
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

export const FRAME_BY_ID: Readonly<Record<FrameId, Frame>> = Object.fromEntries(FRAMES.map((f) => [f.id, f])) as Record<FrameId, Frame>;

// Spaces of either width, and the end of a sentence.
const S = '[\\s\\u3000]*';
const END = `${S}[。！？!?…]*${S}$`;
// Hearsay 「〜そうです」 after a verb, an adjective or だ (あめが ふるそうです: apparently it'll rain).
const HEARSAY = new RegExp(`[るたいくだ]${S}そう${S}です`);

/**
 * Matchers, most specific first: 「〜ても いいですか」 is also a です sentence, 「〜を ください」 also has を, and
 * ちがいます ends in います, so a yes or a no goes first of all. Each runs on the reading (kana) and on the written text, and either may match. `not` rules out the
 * look-alikes found in the game's own lines (tests/frames.test.ts keeps them out).
 */
const MATCHERS: readonly { id: FrameId; re: RegExp; not?: RegExp }[] = [
  // A yes or a no to a check. Not そうですね or そうですか (fillers: "well…", "I see").
  { id: 'sou', re: new RegExp(`^(はい|いいえ)?[、,]?${S}(それは${S})?(そう${S}です(?![ねかよ])|そう${S}じゃ${S}(ない|ありません)|ちがいます|違います)`) },
  { id: 'te-mo-ii', re: new RegExp(`[てで]${S}も${S}(いい|良い)${S}です${S}か`) },
  // 「ありませんか」 asks if there is any; 「すみません」 is sorry. Neither invites.
  { id: 'masen-ka', re: new RegExp(`(?<!あり|すみ|有り)ません${S}か(?!ら)`) },
  { id: 'doko', re: new RegExp(`[はわ]${S}(どこ|何処)${S}(です|でしょう)${S}か`) },
  { id: 'nan', re: new RegExp(`\\S${S}は${S}(なん|何)${S}です${S}か`) },
  // Not 「〜ないで ください」 (please don't: the opposite).
  { id: 'te-kudasai', re: new RegExp(`[てで]${S}(ください|下さい)`), not: new RegExp(`ないで${S}(ください|下さい)`) },
  // An order: 「Nを ください」, 「Nを おねがいします」 or a spaced 「N みっつ、おねがいします」. Not 「〜て ください」
  // (matched above), よろしく おねがいします, はい、おねがいします (yes please: taking an offer, not asking for a
  // thing), or keigo requests such as 「ごじょうしゃ ください」 (please board).
  { id: 'kudasai', re: new RegExp(`(を${S}(ください|下さい|おねがいします|お願いします)|[\\s\\u3000、](ください|下さい|おねがいします|お願いします))`), not: new RegExp(`(よろしく|宜しく)${S}(おねがい|お願い)|^(はい|ええ)[、,]?${S}(おねがい|お願い)|ないで${S}(ください|下さい)|(ご\\S+|お(まち|待ち|むかえ|迎え|はいり|入り|すわり|座り|あがり|のり|乗り|かけ))${S}(ください|下さい)`) },
  // Not 「〜んじゃない」 (isn't it that…: a different pattern).
  { id: 'ja-nai', re: new RegExp(`(じゃ|では)${S}(ない|ありません)`), not: /んじゃ/ },
  // Not the adjectives that end in たい: いたい (it hurts), つめたい (cold), かたい (hard)…, nor みたい (looks like),
  // けいたい (a mobile) or ネクタイ, nor their negatives (つめたくない: isn't cold).
  { id: 'tai', re: new RegExp(`\\S(たい|たく(ない|ありません))${S}です${END}|\\S\\Sたい[！!。]*$`), not: new RegExp(`(^|[\\s\\u3000、が])(い|痛)たい|みたい|くたい|けいたい|携帯|つめたい|冷たい|かたい|固い|硬い|ひらたい|おもたい|重たい|けむたい|めでたい|(^|[\\s\\u3000、が])(い|痛)たく|(つめ|冷|かた|固|硬|ひら|おも|重|けむ)たく`) },
  // A yes-or-no question: 「すきですか」, 「よく きますか」, 「ありませんか」. After the question frames above (where, what, may I,
  // shall we). Not 「そうですか」 (I see).
  { id: 'ka', re: new RegExp(`(です|ます|ません)${S}か${END}`), not: new RegExp(`(^|[\\s\\u3000、])そう${S}です${S}か`) },
  // Not 「おなかが すきました」 (I'm hungry).
  { id: 'suki', re: new RegExp(`が${S}(だい)?(すき|好き|大好き)(?!ま)`) },
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
  { id: 'wa-desu', re: new RegExp(`(\\Sは[\\s\\u3000、]+\\S|(わたし|わたくし|ぼく|あなた|これ|それ|あれ|ここ|そこ|あそこ|[一-龯]{1,3})は\\S)[^。！？]*です(?!か)`), not: HEARSAY },
  // The same with the topic left out: 「さんびゃくえんです」. Last, so anything more specific wins. Not hearsay, and
  // not past or negative adjectives (つめたかったです, つめたくないです), which "It's ___" would gloss wrongly.
  { id: 'desu', re: new RegExp(`\\S${S}です${END}`), not: new RegExp(`^(そう|どう|いい|はい|いいえ)|(かった|くない)${S}です|${HEARSAY.source}`) },
];

const hits = (m: (typeof MATCHERS)[number], s: string): boolean => m.re.test(s) && !m.not?.test(s);

/** A phrase's sentences, each with its own 。！？ (はじめまして。アキです。 is two). */
// Quotes and a speaker's name (ポン：「…」) are dropped, so 「はい、そうです。」 starts with はい like any answer.
const sentences = (s: string): string[] =>
  s
    .split(/(?<=[。！？!?])/)
    .map((x) => x.replace(/^[\s\u3000]*([^\s\u3000：:「」]{1,10}[：:])?[\s\u3000「『（(]*/, '').replace(/[」』）)\s\u3000]+/g, ' ').trim())
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
