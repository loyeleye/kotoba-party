// The word lists behind moderation, by Audience. Family and Cheeky share the base list (slurs, sexual terms,
// "die"/"kill" and the insults ばか and あほ); "never explicit" still holds in Cheeky. Kids adds a stricter list:
// mild swearing, rude insults, body and dating words, alcohol, smoking and drugs.
//
// server/ai/moderation.ts checks every LLM line with these. The modes check what players type in Kids rooms
// (playerTextAllowed); in Family and Cheeky rooms player text is left to the VIP's one-tap Hide, as before.

import type { Audience } from './protocol.js';

const BASE: readonly RegExp[] = [
  /\bf+u+c+k/i, /\bshit/i, /\bcunt/i, /\bn[i1]gg/i, /\bfag/i, /\bretard/i, /\bwhore/i, /\bslut/i, /\brape/i, /\bsex/i, /\bporn/i,
  /ちんこ/, /まんこ/, /セックス/, /せっくす/, /しね/, /死ね/, /ころす/, /殺す/, /ばか/, /バカ/, /馬鹿/, /あほ/, /アホ/,
];

// Kids only. Word boundaries and lookarounds keep "hello", "class", きもの (kimono) and やくそく (promise) out of it.
// うんこ is left in on purpose: it's a staple of Japanese children's humour (and textbooks).
const KIDS: readonly RegExp[] = [
  /\bdamn/i, /\bhell\b/i, /\bcrap/i, /\bass(hole)?\b/i, /\bbitch/i, /\bpiss/i, /\bdick\b/i, /\bboob/i, /\bsexy/i, /\bnaked/i, /\bnude/i,
  /\bstupid/i, /\bidiot/i, /\bdumb/i, /\bugly/i, /\bshut up/i, /\bkill/i, /\bdie\b/i,
  /\bdrunk/i, /\bbeers?\b/i, /\bwine\b/i, /\bsake\b/i, /\bvodka/i, /\bwhisk(e)?y/i, /\bhangover/i, /\bcigarette/i, /\bweed\b/i, /\bdrugs?\b/i,
  /(?<!や)くそ(?!く)/, /クソ/, /糞/, /うざ/, /ウザ/, /きもい/, /キモい/, /キモイ/, /ブス/, /ぶさいく/, /ブサイク/, /デブ/, /まぬけ/, /殺/,
  /おっぱい/, /ちんちん/, /ちくび/, /えっち/, /エッチ/, /はだか/, /裸/,
  /酒/, /おさけ/, /ビール/, /ワイン/, /よっぱら/, /酔/, /ふつかよい/, /二日酔/, /たばこ/, /タバコ/, /煙草/,
];

/** True when the text may be shown and voiced for this audience (Family when left out). */
export function textAllowed(text: string, audience: Audience = 'family'): boolean {
  const t = text.normalize('NFKC');
  if (BASE.some((re) => re.test(t))) return false;
  return audience !== 'kids' || !KIDS.some((re) => re.test(t));
}

/**
 * For what a player types: in Kids rooms it has to pass the Kids list, so it never reaches the stage. Other
 * rooms keep today's behaviour (the VIP can hide an answer), so this is always true there.
 */
export function playerTextAllowed(text: string, audience: Audience | undefined): boolean {
  return audience !== 'kids' || textAllowed(text, 'kids');
}
