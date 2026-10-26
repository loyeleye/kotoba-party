// Answer checking and reading help for Last Train.
//
// Every answer is compared as a kana reading (the server adds `reading` for kanji and digits:
// 三百円 / 300円 → さんびゃくえん). The check is lenient (matchesAccepted's default). Particle
// Panic, and any fill-particle minigame, also accepts は / へ / を said as わ / え / お.

import { matchesAccepted, normalizeReading, soundKey, toHiragana, utteranceReading, type Utterance } from '../../japanese/kana.js';

/** は→わ, へ→え, を→お, on top of the lenient sound key. Only used for particle minigames. */
export function particleKey(text: string): string {
  return soundKey(text).replace(/は/g, 'わ').replace(/へ/g, 'え').replace(/を/g, 'お');
}

/** Is this answer right? `particles` turns on the は/へ/を leniency. */
export function isAccepted(answer: string, accepted: readonly string[], particles = false): boolean {
  if (matchesAccepted(answer, accepted)) return true;
  if (!particles) return false;
  const key = particleKey(answer);
  return key.length > 0 && accepted.some((a) => particleKey(a) === key);
}

/** Checks an utterance: the server's reading first, then the raw text (kana typed or heard). */
export function checkUtterance(u: Utterance, accepted: readonly string[], particles = false): boolean {
  const candidates = new Set([utteranceReading(u), normalizeReading(u.text)]);
  for (const c of candidates) if (c && isAccepted(c, accepted, particles)) return true;
  return false;
}

/** The first mora of a reading (with a small kana or っ attached), for a Kana-level retry. */
export function firstMora(kana: string): string {
  const s = toHiragana(normalizeReading(kana));
  let i = 0;
  let out = '';
  if (s[i] === 'っ') out += s[i++];
  if (s[i]) out += s[i++];
  if (s[i] && 'ゃゅょぁぃぅぇぉ'.includes(s[i]!)) out += s[i];
  return out;
}
