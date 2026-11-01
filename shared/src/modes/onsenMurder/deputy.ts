// The deputy (N4 hard role): after a suspect answers, the deputy tells the room what was said, in
// reported speech (たなかさんは 12じに ねたと いっていました) or the passive (たなかさんは すずきさんに
// みられました). The line is hand-written with the answer (content/src/onsen, `report`), so it is
// checkable: the phone gets its words as shuffled tiles under the frame, and a spoken or typed
// report is checked against the same words. See docs/modes/onsen-murder.md.

import type { OnsenReport } from '../../../../content/src/types.js';
import type { Utterance } from '../../japanese/kana.js';
import { shuffled } from '../mode.js';
import { saidPhrase } from '../phraseBingo/check.js';

export interface ReportTile {
  id: string;
  text: string;
  kana: string;
}

/** Share of the report's words a spoken or typed report needs, besides the frame's last two. */
export const REPORT_WORDS = 0.7;

const strip = (w: string) => w.replace(/[。、！？]+$/u, '');

/** The report's words, in order: `text` and `kana` split on spaces (the content test checks they line up). */
export function reportWords(r: OnsenReport): { text: string; kana: string }[] {
  const text = r.jp.text.split(/\s+/).filter(Boolean).map(strip);
  const kana = r.jp.kana.split(/\s+/).filter(Boolean).map(strip);
  return text.map((t, i) => ({ text: t, kana: kana[i] ?? t }));
}

/** The frame the phone shows over the tiles. */
export function reportFrame(r: OnsenReport): string {
  return r.frames?.includes('passive') ? '＿は ＿に ＿られました' : '＿は ＿と いっていました';
}

/** The deputy's tiles: the report's words, shuffled. */
export function reportTiles(r: OnsenReport, random: () => number): ReportTile[] {
  return shuffled(reportWords(r), random).map((w, i) => ({ id: `w${i}`, text: w.text, kana: w.kana }));
}

/** Joins tiles (or words) into the line as the stage shows it. */
export function joinReport(words: readonly { text: string }[]): string {
  return words.length ? `${words.map((w) => w.text).join(' ')}。` : '';
}

/** Tiles in the report's order? Compared by text, so two identical words can go either way. */
export function tilesInOrder(r: OnsenReport, tiles: readonly { text: string }[]): boolean {
  const words = reportWords(r);
  return tiles.length === words.length && tiles.every((t, i) => t.text === words[i]!.text);
}

/**
 * Did they say the report? Leniently, by sound (Phrase Bingo's check): the frame's last two words
 * must be there (いたと いっていました, すずきさんに みられました), and then the whole line within a few
 * kana, or most of its words. The frame is checked as one stretch, because the sound key reads a
 * word by its neighbour (わらって いた sounds like わらってえた), which a lone short word can't absorb.
 * A direct quote in polite form (いましたと いっていました) also passes: it is still correct Japanese.
 */
export function checkReport(u: Utterance, r: OnsenReport): boolean {
  const words = reportWords(r).map((w) => w.kana);
  const has = (kana: string) => saidPhrase(u, kana, undefined, 'n4');
  if (!has(words.slice(-2).join(''))) return false;
  if (has(r.jp.kana)) return true;
  return words.filter(has).length >= Math.ceil(words.length * REPORT_WORDS);
}
