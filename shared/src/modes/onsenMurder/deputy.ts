// The deputy (N4 hard role): after a suspect answers, the deputy tells the room what was said, in
// reported speech (たなかさんは 12じに ねたと いっていました) or the passive (たなかさんは すずきさんに
// みられました). The line is hand-written with the answer (content/src/onsen, `report`), so it is
// checkable: the phone gets its words as shuffled tiles under the frame, and a spoken or typed
// report is checked against the same words. The tiles leave the polite→plain step to the deputy: the
// quoted verb comes as its plain form (いた) beside the suspect's own polite one (いました), with
// と いっていました a tile of its own; a passive report gets the active みました beside みられました.
// See docs/modes/onsen-murder.md.

import type { OnsenReport } from '../../../../content/src/types.js';
import { normalizeReading, utteranceReading, type Utterance } from '../../japanese/kana.js';
import { shuffled } from '../mode.js';
import { saidPhrase } from '../phraseBingo/check.js';
import { framesOf } from '../../japanese/frames.js';

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
  if (isN3Report(r)) return n3Frame(r);
  return r.frames?.includes('passive') ? '＿は ＿に ＿られました' : '＿は ＿と いっていました';
}

const isPassive = (r: OnsenReport) => !!r.frames?.includes('passive');

/** The frame's own tile in a reported-speech report: と hugs the plain form tapped before it. */
export const QUOTE_TILE = 'と いっていました';

// Plain → polite, for the decoy tile: the suspect's own ます form of the verb the deputy has to make plain.
// Enough for the forms the reports use (draft); anything it can't place gets no decoy.
const A_TO_I: Record<string, string> = { あ: 'い', か: 'き', が: 'ぎ', さ: 'し', た: 'ち', な: 'に', ば: 'び', ま: 'み', ら: 'り', わ: 'い' };
const U_TO_I: Record<string, string> = { う: 'い', く: 'き', ぐ: 'ぎ', す: 'し', つ: 'ち', ぬ: 'に', ぶ: 'び', む: 'み', る: 'り' };
/** ～った verbs that aren't the う-verb the rules below guess, and the ～んだ / ～いだ verbs (else ～だ is a noun's). */
const PAST: Record<string, string> = {
  かえった: 'かえりました',
  はいった: 'はいりました',
  あった: 'ありました',
  つくった: 'つくりました',
  とった: 'とりました',
  のった: 'のりました',
  おわった: 'おわりました',
  もった: 'もちました',
  まった: 'まちました',
  よんだ: 'よみました',
  のんだ: 'のみました',
  すんだ: 'すみました',
  やすんだ: 'やすみました',
  およいだ: 'およぎました',
  いそいだ: 'いそぎました',
  ぬいだ: 'ぬぎました',
  あそんだ: 'あそびました',
  とんだ: 'とびました',
  えらんだ: 'えらびました',
  ならんだ: 'ならびました',
  しんだ: 'しにました',
};
/**
 * ～かった verbs, which the い-adjective rule (たかかった → たかかったです) would otherwise take. Matched whole, so
 * あつかった (it was hot) stays an adjective.
 */
const KATTA_VERBS: Record<string, string> = {
  かった: 'かいました',
  わかった: 'わかりました',
  つかった: 'つかいました',
  みつかった: 'みつかりました',
  たすかった: 'たすかりました',
  ぶつかった: 'ぶつかりました',
};
/** う-verbs ending in える / いる, which the る-verb rule would take (かえる → かえます). Matched whole. */
const GODAN_RU = ['かえる', 'はいる', 'しる', 'はしる', 'へる', 'すべる', 'しゃべる', 'にぎる', 'ける'];
/** い-adjectives ending in ない, which take です rather than ません. */
const NAI_ADJ = ['すくない', 'あぶない', 'きたない', 'つまらない', 'おさない', 'せつない'];
const E_OR_I_ROW = /[いきぎしじちぢにひびぴみりえけげせぜてでねへべぺめれ]$/u;

/** The polite (ます / です) form of a plain predicate, or null when the rules can't tell. */
export function politeForm(w: string): string | null {
  const cut = (n: number) => w.slice(0, w.length - n);
  const negStem = (st: string) => st.slice(0, -1) + (A_TO_I[st.slice(-1)] ?? st.slice(-1));
  if (KATTA_VERBS[w]) return KATTA_VERBS[w]!;
  if (w === 'こない') return 'きません';
  if (w === 'こなかった') return 'きませんでした';
  if (/[てで]いた$/u.test(w)) return `${cut(2)}いました`;
  if (w.endsWith('だった')) return `${cut(3)}でした`;
  if (w.endsWith('なかった')) return cut(4) ? `${negStem(cut(4))}ませんでした` : 'ありませんでした';
  if (w.endsWith('かった')) return `${w}です`;
  if (w === 'ない') return 'ありません';
  if (w.endsWith('ない')) return NAI_ADJ.some((a) => w.endsWith(a)) ? `${w}です` : `${negStem(cut(2))}ません`;
  for (const [past, polite] of Object.entries(PAST)) if (w.endsWith(past)) return cut(past.length) + polite;
  if (w.endsWith('だ')) return `${cut(1)}です`;
  if (w.endsWith('い')) return `${w}です`;
  if (w.endsWith('した')) return `${cut(2)}しました`;
  if (w.endsWith('いった')) return `${cut(3)}いきました`;
  if (w.endsWith('った')) return `${cut(2)}いました`;
  if (w === 'いた') return 'いました';
  if (w.endsWith('いた')) return `${cut(2)}きました`;
  if (w.endsWith('た')) return `${cut(1)}ました`;
  if (w.endsWith('する')) return `${cut(2)}します`;
  if (w === 'くる') return 'きます';
  if (w.endsWith('いう')) return `${cut(2)}いいます`;
  if (w === 'いる') return 'います';
  if (GODAN_RU.includes(w)) return `${cut(1)}ります`;
  if (w.endsWith('る') && E_OR_I_ROW.test(cut(1))) return `${cut(1)}ます`;
  const last = w.slice(-1);
  return U_TO_I[last] ? `${cut(1)}${U_TO_I[last]}ます` : null;
}

/**
 * The tiles that make the report, in order. Reported speech splits the quoted verb from its と: the deputy taps
 * the plain form (いた), then と いっていました, so the polite→plain step is theirs to make.
 */
export function answerTiles(r: OnsenReport): { text: string; kana: string }[] {
  const words = reportWords(r);
  if (isPassive(r) || words.length < 3) return words;
  const verb = words.at(-2)!;
  if (!verb.text.endsWith('と') || !verb.kana.endsWith('と')) return words;
  return [...words.slice(0, -2), { text: verb.text.slice(0, -1), kana: verb.kana.slice(0, -1) }, { text: QUOTE_TILE, kana: QUOTE_TILE }];
}

/**
 * The decoy: the suspect's polite verb (いました for いた) before と いっていました, or the active みました beside
 * みられました. It never fits: only the plain form (or the passive) builds the report.
 */
export function decoyTile(r: OnsenReport): { text: string; kana: string } | null {
  if (isN3Report(r)) {
    // The retelling's verb before らしいです / そうです, in the suspect's own ます form.
    const verb = reportWords(r).at(-2);
    const text = verb && politeForm(verb.text);
    const kana = verb && politeForm(verb.kana);
    return verb && text && kana && text !== verb.text ? { text, kana } : null;
  }
  if (isPassive(r)) return { text: 'みました', kana: 'みました' };
  const tiles = answerTiles(r);
  if (tiles.at(-1)?.text !== QUOTE_TILE) return null;
  const verb = tiles.at(-2)!;
  const text = politeForm(verb.text);
  const kana = politeForm(verb.kana);
  return text && kana && text !== verb.text ? { text, kana } : null;
}

/** The deputy's tiles: the report's tiles and the decoy, shuffled. */
export function reportTiles(r: OnsenReport, random: () => number): ReportTile[] {
  const decoy = decoyTile(r);
  return shuffled([...answerTiles(r), ...(decoy ? [decoy] : [])], random).map((w, i) => ({ id: `w${i}`, text: w.text, kana: w.kana }));
}

/** Joins tiles (or words) into the line as the stage shows it: と いっていました hugs the word before. */
export function joinReport(words: readonly { text: string }[]): string {
  if (!words.length) return '';
  return `${words.map((w, i) => (i > 0 && !w.text.startsWith('と ') ? ' ' : '') + w.text).join('')}。`;
}

/** Tiles that build the report? Compared as the joined line, so two identical words can go either way. */
export function tilesInOrder(r: OnsenReport, tiles: readonly { text: string }[]): boolean {
  return tiles.length > 0 && joinReport(tiles) === joinReport(reportWords(r));
}

/**
 * The frame's rule alone, for before the first try: it names the form to use without handing over the word
 * (the full notes name the plain verb itself, so they wait for a first try).
 */
export function reportRule(r: OnsenReport): string {
  if (isN3Report(r)) return N3_RULE;
  return isPassive(r) ? PASSIVE_NOTE : '＿と いっていました takes the plain form, not the ます form.';
}

/** The frame notes the deputy sees under the frame. */
export function reportNotes(r: OnsenReport): string[] {
  if (isN3Report(r)) {
    const decoy = decoyTile(r);
    const plain = reportWords(r).at(-2)?.text;
    const tail = reportWords(r).at(-1)?.text;
    return [decoy && plain ? `${tail} takes the plain form: they said ${decoy.text}, you pass on ${plain} ${tail}.` : N3_RULE];
  }
  if (isPassive(r)) return [PASSIVE_NOTE];
  const decoy = decoyTile(r);
  const plain = answerTiles(r).at(-2)?.text;
  return [decoy && plain ? `＿と いっていました takes the plain form: they said ${decoy.text}, you report ${plain}と.` : '＿と いっていました takes the plain form, not the ます form.'];
}

/** The N3 retelling's rule: ＿に よると names the source, ＿らしい / ＿そうです take the plain form. */
export const N3_RULE = '＿に よると names who said it; ＿らしいです (apparently) and ＿そうです (I hear) take the plain form, not the ます form.';

/** みられました, for the passive's frame note (on the offer card too). */
export const PASSIVE_NOTE = 'みられました is the passive of みる: “was seen” (by the one marked with に). Not the potential みられる, “can see”.';

/**
 * Did they say the report? Leniently, by sound (Phrase Bingo's check): the frame's last two words
 * must be there (いたと いっていました, すずきさんに みられました), and then the whole line within a few
 * kana, or most of its words. The frame is checked as one stretch, because the sound key reads a
 * word by its neighbour (わらって いた sounds like わらってえた), which a lone short word can't absorb.
 * A direct quote in polite form (いましたと いっていました) also passes: it is still correct Japanese.
 * A passive report fails when the one who saw is marked with を or が instead of に.
 */
export function checkReport(u: Utterance, r: OnsenReport): boolean {
  const words = reportWords(r).map((w) => w.kana);
  const has = (kana: string) => saidPhrase(u, kana, undefined, 'n4');
  if (r.frames?.includes('passive')) {
    // The one who saw is marked with に. With を or が they become the one seen, which the lenient
    // sound check alone would let through (すずきさんを みられました).
    const agent = normalizeReading(words.at(-2)!.replace(/に$/, ''));
    const said = normalizeReading(utteranceReading(u)).replace(/[\s　]+/g, '');
    if (said.includes(`${agent}を`) || said.includes(`${agent}が`)) return false;
    // And it has to be the passive: the active みました (the tiles' decoy) is near enough in sound to slip
    // through the lenient check.
    if (!said.includes('られ')) return false;
  }
  if (!has(words.slice(-2).join(''))) return false;
  if (has(r.jp.kana)) return true;
  return words.filter(has).length >= Math.ceil(words.length * REPORT_WORDS);
}

// ---- the Green Car's N3 retelling (＿に よると … ＿らしいです) ----

/** A report as dealt in the Green Car: the N4 line, or its N3 retelling (`level: 'n3'`). */
export interface DeputyReport extends OnsenReport {
  level?: 'n4' | 'n3';
}

const SAID_RE = /^(\S+?)は (.+)と いっていました。$/u;
const SEEN_RE = /^(.+) みられました。$/u;
const SAID_EN = /^(.+?) said (.+?)\.?$/u;

/**
 * The N3 retelling of a scripted report, made by rule (goal 3.1): reported speech becomes
 * 「たなかさんに よると、 12じに ねた らしいです。」 (＿に よると + ＿らしい), and the passive 「すずきさんは
 * やまださんに みられた らしいです。」. Where ＿らしい can't follow (a noun's だ: やまださんのだ) it is
 * 「…やまださんのだ そうです。」 instead. じぶん becomes the speaker's name, as the speaker is no longer the
 * sentence's subject. Only a line whose frames the matcher finds is kept; null when none fits.
 */
export function n3Report(r: OnsenReport): DeputyReport | null {
  const seen = isPassive(r);
  const retell = (line: string, tail: string): string | null => {
    if (seen) {
      const m = SEEN_RE.exec(line);
      return m ? `${m[1]} みられた ${tail}` : null;
    }
    const m = SAID_RE.exec(line);
    if (!m) return null;
    const who = m[1]!;
    return `${who}に よると、 ${m[2]!.replace(/じぶん/gu, who)} ${tail}`;
  };
  // A noun's だ (やまださんのだ, にかいだ) can't stand before らしい, and without it the matcher can't find ＿らしい:
  // those take ＿そうです, which keeps the だ.
  const last = SAID_RE.exec(r.jp.kana)?.[2]?.split(' ').at(-1) ?? '';
  const nounDa = last.endsWith('だ') && !!politeForm(last)?.endsWith('です');
  for (const [tail, frame] of [
    ['らしいです。', 'rashii'],
    ['そうです。', 'sou-hear'],
  ] as const) {
    if (nounDa && frame === 'rashii') continue;
    const text = retell(r.jp.text, tail);
    const kana = retell(r.jp.kana, tail);
    if (!text || !kana) return null;
    const frames = framesOf({ text: kana, kana }, undefined, { keepHidden: true });
    if (!frames.includes(frame)) continue;
    const said = SAID_EN.exec(r.jp.en);
    const en = seen
      ? `Apparently, ${r.jp.en}`
      : said
        ? frame === 'rashii'
          ? `According to ${said[1]}, apparently ${said[2]}.`
          : `According to ${said[1]}, ${said[2]}.`
        : r.jp.en;
    return { jp: { text, kana, en }, frames: frames.filter((f) => f === 'rashii' || f === 'sou-hear' || f === 'ni-yoru'), level: 'n3' };
  }
  return null;
}

/** The N3 retelling's frame word, as the phone's frame shows it. */
const n3Frame = (r: OnsenReport) => (r.frames?.includes('rashii') ? (r.frames.includes('ni-yoru') ? '＿に よると、 ＿らしいです' : '＿は ＿に ＿られた らしいです') : '＿に よると、 ＿そうです');

export const isN3Report = (r: OnsenReport): boolean => (r as DeputyReport).level === 'n3';
