// The six questions every suspect can be asked, how a spoken or typed question is matched to
// one (leniently: kana reading plus keywords), the question tiles, and the accusation check.
//
// Matching never needs an LLM: each question has weighted kana keywords (どこ, だれ, なんじ …)
// and the case adds its victim's and item's names. The best-scoring question wins when it
// scores at least MIN_SCORE; ties go to a question not yet asked of that suspect.

import type { JpText, OnsenCase, OnsenIntent, OnsenSuspect } from '../../../../content/src/types.js';
import { normalizeReading, soundKey, type Utterance } from '../../japanese/kana.js';
import { framesOf, type FrameId } from '../../japanese/frames.js';

export const INTENTS: readonly OnsenIntent[] = ['where', 'what', 'who', 'when', 'victim', 'item'];

/** A question needs this much keyword weight to count as asked. */
export const MIN_SCORE = 2;

interface Key {
  kana: string;
  weight: number;
}

const BASE_KEYS: Record<OnsenIntent, Key[]> = {
  where: [{ kana: 'どこ', weight: 3 }],
  what: [
    { kana: 'なに', weight: 2 },
    { kana: 'なん', weight: 1 },
    { kana: 'して', weight: 1 },
  ],
  who: [
    { kana: 'だれ', weight: 2 },
    { kana: 'みました', weight: 1 },
    { kana: 'みた', weight: 1 },
  ],
  when: [
    { kana: 'なんじ', weight: 3 },
    { kana: 'いつ', weight: 2 },
    { kana: 'ねました', weight: 1 },
    { kana: 'ねた', weight: 1 },
  ],
  victim: [{ kana: 'どんな', weight: 3 }],
  item: [{ kana: 'だれの', weight: 3 }],
};

const k = (text: string, en: string): JpText => ({ text, kana: text, en });

/** A name without its さん / くん / ちゃん, so "ゆきだるま" finds ゆきだるまさん. */
export function bareName(kana: string): string {
  return normalizeReading(kana).replace(/(さん|くん|ちゃん|さま)$/, '');
}

/** The natural version of each question for this case. */
export function questionFor(c: OnsenCase, intent: OnsenIntent): JpText {
  switch (intent) {
    case 'where':
      return k('どこに いましたか？', 'Where were you?');
    case 'what':
      return k('なにを して いましたか？', 'What were you doing?');
    case 'who':
      return k('だれを みましたか？', 'Who did you see?');
    case 'when':
      return k('なんじに ねましたか？', 'What time did you go to bed?');
    case 'victim':
      return { text: `${c.victim.name.text}は どんな ひとでしたか？`, kana: `${c.victim.name.kana}は どんな ひとでしたか？`, en: `What was ${c.victim.name.en.split(',')[0]} like?` };
    case 'item':
      return { text: `この ${c.item.name.text}は だれのですか？`, kana: `この ${c.item.name.kana}は だれのですか？`, en: `Whose is this ${c.item.name.en}?` };
  }
}

/** English for each question, for the phone's "you could ask…" list. */
export function questionEn(c: OnsenCase, intent: OnsenIntent): string {
  return questionFor(c, intent).en;
}

function keysFor(c: OnsenCase, intent: OnsenIntent): Key[] {
  const keys = [...BASE_KEYS[intent]];
  if (intent === 'victim') keys.push({ kana: bareName(c.victim.name.kana), weight: 1 });
  if (intent === 'item') for (const key of c.item.keys) keys.push({ kana: key, weight: 3 });
  return keys;
}

/** Readings to check an utterance by: the server's reading and the raw text (kana typed or heard). */
export function readingsOf(u: Pick<Utterance, 'text' | 'reading'>): string[] {
  const out = new Set<string>();
  for (const r of [u.reading, u.text]) if (r) out.add(soundKey(r));
  return [...out].filter(Boolean);
}

export function scoreQuestion(c: OnsenCase, intent: OnsenIntent, readings: readonly string[]): number {
  let best = 0;
  for (const r of readings) {
    let score = 0;
    for (const key of keysFor(c, intent)) if (key.kana && r.includes(soundKey(key.kana))) score += key.weight;
    best = Math.max(best, score);
  }
  return best;
}

export interface QuestionMatch {
  /** The question asked, or null if nothing scored MIN_SCORE. */
  intent: OnsenIntent | null;
  /** The best guess even below MIN_SCORE (null if nothing matched at all), for the retry hint. */
  closest: OnsenIntent | null;
}

/** Which question did they ask? `asked` are the questions this suspect has already answered. */
export function matchQuestion(c: OnsenCase, u: Pick<Utterance, 'text' | 'reading'>, asked: readonly OnsenIntent[] = []): QuestionMatch {
  const readings = readingsOf(u);
  let best: OnsenIntent | null = null;
  let bestScore = 0;
  for (const intent of INTENTS) {
    const score = scoreQuestion(c, intent, readings);
    if (score === 0) continue;
    const better = score > bestScore || (score === bestScore && best !== null && asked.includes(best) && !asked.includes(intent));
    if (better) {
      best = intent;
      bestScore = score;
    }
  }
  return { intent: bestScore >= MIN_SCORE ? best : null, closest: best };
}

// ---- tiles: build a question from pieces (the "build" rung of the ladder) ----

export interface QuestionTile {
  id: string;
  text: string;
  kana: string;
  en: string;
  /** Particles join the word before them without a space. */
  kind: 'question' | 'particle' | 'word' | 'ending';
}

export function tilesFor(c: OnsenCase): QuestionTile[] {
  const tile = (id: string, text: string, en: string, kind: QuestionTile['kind'], kana = text): QuestionTile => ({ id, text, kana, en, kind });
  return [
    tile('dare', 'だれ', 'who', 'question'),
    tile('doko', 'どこ', 'where', 'question'),
    tile('nani', 'なに', 'what', 'question'),
    tile('nanji', 'なんじ', 'what time', 'question'),
    tile('donna', 'どんな', 'what kind of', 'question'),
    tile('wo', 'を', '(object)', 'particle'),
    tile('ni', 'に', 'at / to', 'particle'),
    tile('wa', 'は', '(topic)', 'particle'),
    tile('no', 'の', "'s / of", 'particle'),
    tile('victim', c.victim.name.text, c.victim.name.en.split(',')[0]!, 'word', c.victim.name.kana),
    tile('kono', 'この', 'this', 'word'),
    tile('item', c.item.name.text, c.item.name.en, 'word', c.item.name.kana),
    tile('hito', 'ひと', 'person', 'word'),
    tile('imashita', 'いましたか', 'were you?', 'ending'),
    tile('shiteimashita', 'して いましたか', 'were you doing?', 'ending'),
    tile('mimashita', 'みましたか', 'did you see?', 'ending'),
    tile('nemashita', 'ねましたか', 'did you sleep?', 'ending'),
    tile('deshita', 'でしたか', 'was it?', 'ending'),
    tile('desu', 'ですか', 'is it?', 'ending'),
  ];
}

/** Joins tiles into a sentence: particles hug the word before, everything else gets a space. */
export function joinTiles(tiles: readonly Pick<QuestionTile, 'text' | 'kind'>[]): string {
  let out = '';
  for (const t of tiles) out += out && t.kind !== 'particle' ? ` ${t.text}` : t.text;
  return out ? `${out}？` : '';
}

// ---- the accusation: 「はんにんは ○○さんです！」 ----

/** The name as people say it: たなかさん, もりくん, タマ. */
export function calledName(s: Pick<OnsenSuspect, 'name' | 'suffix'>): JpText {
  const suffix = s.suffix ?? 'さん';
  return { text: s.name.text + suffix, kana: s.name.kana + suffix, en: s.name.en };
}

export function accusationLine(s: Pick<OnsenSuspect, 'name' | 'suffix'>): JpText {
  const n = calledName(s);
  return { text: `はんにんは ${n.text}です！`, kana: `はんにんは ${n.kana}です！`, en: `The culprit is ${s.name.en}!` };
}

/** Did they say the accusation for this suspect? Needs はんにん and the suspect's name, in any order. */
export function checkAccusation(u: Pick<Utterance, 'text' | 'reading'>, s: Pick<OnsenSuspect, 'name'>): boolean {
  const name = soundKey(bareName(s.name.kana));
  const culprit = soundKey('はんにん');
  return readingsOf(u).some((r) => r.includes(name) && r.includes(culprit));
}

// ---- the Green Car's N3 accusation ----

/** The Green Car's N3 accusation lines (goal 3.10, with 3.3's ＿せいで / ＿おかげで where they fit). */
export type GcAccuseId = 'chigainai' | 'sei' | 'hazu' | 'okage';

/** Each line's frames, by id (shared/src/japanese/frames.ts): the aim deals by these. */
export const GC_ACCUSE: Record<GcAccuseId, readonly FrameId[]> = {
  chigainai: ['ni-chigainai'],
  sei: ['sei-de', 'ni-chigainai'],
  hazu: ['hazu-ga-nai'],
  okage: ['okage-de', 'ni-chigainai'],
};

/** The frames a Green Car accusation must carry, one of them: ＿に ちがいない or ＿はずが ない. */
export const GC_ACCUSE_NEEDS: readonly FrameId[] = ['ni-chigainai', 'hazu-ga-nai'];

/**
 * A Green Car accusation line (draft): 「はんにんは ○○さんに ちがいない！」, 「ゆきだるまさんが とけたのは、 ○○さんの
 * せいに ちがいない！」 (needs the case's `victim.fate`), 「○○さんの はなしが ほんとうの はずが ない。 はんにんは ○○さんだ！」
 * or 「みんなの おかげで わかった。 はんにんは ○○さんに ちがいない！」. Null for ＿せいで on a case with no fate.
 */
export function gcAccusationLine(c: Pick<OnsenCase, 'victim'>, s: Pick<OnsenSuspect, 'name' | 'suffix'>, id: GcAccuseId): JpText | null {
  const n = calledName(s);
  const both = (f: (name: string) => string, en: string): JpText => ({ text: f(n.text), kana: f(n.kana), en });
  switch (id) {
    case 'chigainai':
      return both((x) => `はんにんは ${x}に ちがいない！`, `The culprit must be ${s.name.en}!`);
    case 'sei': {
      const fate = c.victim.fate;
      if (!fate) return null;
      return {
        text: `${fate.text}のは、 ${n.text}の せいに ちがいない！`,
        kana: `${fate.kana}のは、 ${n.kana}の せいに ちがいない！`,
        en: `${fate.en}: it must be ${s.name.en}'s fault!`,
      };
    }
    case 'hazu':
      return both((x) => `${x}の はなしが ほんとうの はずが ない。 はんにんは ${x}だ！`, `There's no way ${s.name.en}'s story is true. ${s.name.en} did it!`);
    case 'okage':
      return both((x) => `みんなの おかげで わかった。 はんにんは ${x}に ちがいない！`, `Thanks to everyone, I've got it: the culprit must be ${s.name.en}!`);
  }
}

/**
 * The frames heard in a Green Car accusation of this suspect, or null when it doesn't count: the suspect's name
 * and one of ＿に ちがいない / ＿はずが ない must be there (framesOf, over the reading and the text).
 */
export function gcAccusationFrames(u: Pick<Utterance, 'text' | 'reading' | 'tokens'>, s: Pick<OnsenSuspect, 'name'>): FrameId[] | null {
  const name = soundKey(bareName(s.name.kana));
  if (!readingsOf(u).some((r) => r.includes(name))) return null;
  const heard = new Set<FrameId>();
  for (const kana of [u.reading, u.text]) if (kana) for (const f of framesOf({ text: u.text, kana }, u.tokens, { keepHidden: true })) heard.add(f);
  return GC_ACCUSE_NEEDS.some((f) => heard.has(f)) ? [...heard] : null;
}
