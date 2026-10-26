// A minimal text filter for the host's LLM lines and for player text the host repeats. The design doc's full
// moderation layer (player text, VIP hide, family mode) is its own piece; this is the hook it plugs into, with a
// small built-in list so an LLM line never reaches the stage unchecked. A line that fails is replaced by a bank line.

export type Moderator = (text: string) => boolean;

// Deliberately short: slurs and sexual terms in English and Japanese. The real list belongs with the moderation work.
const BLOCK = [
  /\bf+u+c+k/i, /\bshit/i, /\bcunt/i, /\bn[i1]gg/i, /\bfag/i, /\bretard/i, /\bwhore/i, /\bslut/i, /\brape/i, /\bsex/i, /\bporn/i,
  /ちんこ/, /まんこ/, /セックス/, /せっくす/, /しね/, /死ね/, /ころす/, /殺す/, /ばか/, /バカ/, /馬鹿/, /あほ/, /アホ/,
];

/** True when the text may be shown and voiced. */
export const defaultModerator: Moderator = (text) => !BLOCK.some((re) => re.test(text.normalize('NFKC')));
