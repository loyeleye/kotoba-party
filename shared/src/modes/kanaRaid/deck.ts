// Kana Yōkai Raid: the decks the raid draws on, with a tiny built-in fallback so the mode
// still runs end to end when the content library is thin. Everything real comes from
// ctx.content (content/src/kana); the FALLBACK_* sets below are placeholders only.

import type { BossWord, JpText, Kana, KanaChapter, LookAlikeSet, MinimalPair } from '../../../../content/src/types.js';
import { normalizeReading, soundKey, toHiragana, toKatakana } from '../../japanese/kana.js';
import type { ContentLibrary } from '../mode.js';

// ---------- placeholder fallback (used only when content is empty) ----------

const fallbackRow = (hira: string, kata: string, romaji: string, chapter: number): Kana[] => [
  { id: `h-${romaji}`, char: hira, script: 'hiragana', kind: 'basic', chapter, romaji, sound: hira, twinId: `k-${romaji}`, difficulty: chapter === 1 ? 1 : 2 },
  { id: `k-${romaji}`, char: kata, script: 'katakana', kind: 'basic', chapter, romaji, sound: hira, twinId: `h-${romaji}`, difficulty: chapter === 1 ? 1 : 2 },
];

/** PLACEHOLDER: the five vowels and す, so the fallback boss アイス can be broken. */
export const FALLBACK_KANA: Kana[] = [
  ...fallbackRow('あ', 'ア', 'a', 1),
  ...fallbackRow('い', 'イ', 'i', 1),
  ...fallbackRow('う', 'ウ', 'u', 1),
  ...fallbackRow('え', 'エ', 'e', 1),
  ...fallbackRow('お', 'オ', 'o', 1),
  ...fallbackRow('す', 'ス', 'su', 3),
];

/** PLACEHOLDER minimal pair. */
export const FALLBACK_PAIRS: MinimalPair[] = [
  {
    id: 'fallback-ie-iie',
    contrast: 'long-vowel',
    a: { text: 'いえ', kana: 'いえ', en: 'house' },
    b: { text: 'いいえ', kana: 'いいえ', en: 'no' },
    minChapter: 1,
  },
];

/** PLACEHOLDER boss. */
export const FALLBACK_BOSS: BossWord[] = [{ id: 'fallback-aisu', word: { text: 'アイス', kana: 'アイス', en: 'ice cream' }, pieces: ['ア', 'イ', 'ス'], minChapter: 3 }];

const CHAPTER_TITLES: Record<number, string> = {
  1: 'Vowels', 2: 'K row', 3: 'S row', 4: 'T row', 5: 'N row', 6: 'H row', 7: 'M row', 8: 'Y row', 9: 'R row',
  10: 'W row and ん', 11: 'Voiced sounds and small っ', 12: 'Combinations and ー', 13: 'Special katakana',
};

// ---------- the deck ----------

export interface Deck {
  kana: readonly Kana[];
  byId: ReadonlyMap<string, Kana>;
  /** Kana by their exact character, for boss pieces. */
  byChar: ReadonlyMap<string, Kana>;
  chapters: readonly ChapterInfo[];
  lookAlikes: readonly LookAlikeSet[];
  pairs: readonly MinimalPair[];
  bosses: readonly BossWord[];
  /** True when any part had to fall back to the placeholder sets. */
  placeholder: boolean;
}

export interface ChapterInfo {
  number: number;
  title: string;
  titleJa: string;
  /** A few of its kana, for the picker. */
  sample: string;
  leader: JpText | null;
}

export function buildDeck(content: ContentLibrary): Deck {
  const usingFallbackKana = content.kana.length === 0;
  const kana = usingFallbackKana ? FALLBACK_KANA : content.kana;
  const byId = new Map(kana.map((k) => [k.id, k]));
  const byChar = new Map<string, Kana>();
  // Prefer the katakana entry for a char shared by nothing; chars are unique per script anyway.
  for (const k of kana) if (!byChar.has(k.char)) byChar.set(k.char, k);

  const numbers = [...new Set(kana.map((k) => k.chapter))].sort((a, b) => a - b);
  const fromContent = new Map<number, KanaChapter>(content.kanaChapters.map((c) => [c.number, c]));
  const chapters: ChapterInfo[] = numbers.map((n) => {
    const c = fromContent.get(n);
    const inChapter = kana.filter((k) => k.chapter === n && k.kind !== 'mark' && k.kind !== 'small');
    const hira = inChapter.filter((k) => k.script === 'hiragana');
    const sample = (hira.length ? hira : inChapter).slice(0, 5).map((k) => k.char).join(' ');
    return {
      number: n,
      title: c?.title.en ?? CHAPTER_TITLES[n] ?? `Chapter ${n}`,
      titleJa: c?.title.text ?? '',
      sample,
      leader: c?.leaderYokai.name ?? null,
    };
  });

  const lookAlikes = content.lookAlikeSets.filter((s) => s.kanaIds.every((id) => byId.has(id)));
  const pairs = content.minimalPairs.length ? content.minimalPairs : FALLBACK_PAIRS;
  const bosses = content.bossWords.length ? content.bossWords : FALLBACK_BOSS;
  return {
    kana,
    byId,
    byChar,
    chapters,
    lookAlikes,
    pairs,
    bosses,
    placeholder: usingFallbackKana || !content.minimalPairs.length || !content.bossWords.length,
  };
}

/** Kana a yōkai can be made of: everything but small っ and the long mark (they live in words). */
export const isFighter = (k: Kana): boolean => k.kind !== 'mark' && k.kind !== 'small';

/** The kana a player has studied, as fighters. Never empty. */
export function poolFor(deck: Deck, chapters: readonly number[]): Kana[] {
  const pool = deck.kana.filter((k) => chapters.includes(k.chapter) && isFighter(k));
  return pool.length ? pool : deck.kana.filter((k) => k.chapter === (deck.chapters[0]?.number ?? 1) && isFighter(k));
}

export function pairsFor(deck: Deck, topChapter: number): MinimalPair[] {
  const fit = deck.pairs.filter((p) => p.minChapter <= topChapter);
  if (fit.length) return fit;
  const lowest = Math.min(...deck.pairs.map((p) => p.minChapter));
  return deck.pairs.filter((p) => p.minChapter === lowest);
}

/** Difficulty of a chapter, matching the content's rule (1 vowels … 5 special katakana). */
export const chapterDifficulty = (chapter: number): number => (chapter <= 1 ? 1 : chapter <= 10 ? 2 : chapter === 11 ? 3 : chapter === 12 ? 4 : 5);

/** A sound written in the other script from `script`, so showing it doesn't give the answer away. */
export const inOtherScript = (sound: string, script: Kana['script']): string => (script === 'hiragana' ? toKatakana(sound) : toHiragana(sound));

export const sameSound = (a: string, b: string): boolean => soundKey(a) === soundKey(b);

/** The sound of a boss piece (ティ → てぃ). */
export function pieceSound(deck: Deck, piece: string): string {
  return deck.byChar.get(piece)?.sound ?? toHiragana(piece);
}

/** The vowel a reading ends on (か → あ), via the long-mark rule. */
const vowelOf = (ch: string): string => normalizeReading(`${ch}ー`).slice(ch.length);

// ---------- the kana sound check ----------

export interface SoundCheck {
  ok: boolean;
  /** What it sounded like, when it was a known confusion or something else. */
  heard?: string;
  romaji?: boolean;
}

/**
 * The closed-set kana sound check (design doc, "AI and speech"): lenient, listening for the
 * target and its known confusions only. じ/ぢ, ず/づ and お/を count as one sound; a stretched
 * vowel (かー) or a trailing っ still counts; romaji never does.
 */
export function checkSound(texts: readonly (string | undefined)[], target: Kana, deck: Deck): SoundCheck {
  const accepted = [target.sound, ...(target.homophoneIds ?? []).map((id) => deck.byId.get(id)?.sound ?? '')].filter(Boolean);
  const keys = new Set(accepted.map((a) => soundKey(a)));
  let heard: string | undefined;
  let romaji = false;
  for (const raw of texts) {
    if (!raw) continue;
    if (/[a-z]/i.test(raw) && !/[ぁ-ゖァ-ヺ]/.test(raw)) {
      romaji = true;
      continue;
    }
    const r = normalizeReading(raw);
    if (!r) continue;
    for (const v of variants(r)) {
      if (keys.has(soundKey(v))) return { ok: true };
    }
    // Lenient: one extra mora after the target (かね for か) still lands.
    const t = soundKey(target.sound);
    const k = soundKey(r);
    const confusable = (target.confusableSounds ?? []).find((c) => variants(r).some((v) => soundKey(v) === soundKey(c)));
    if (confusable) return { ok: false, heard: confusable };
    if (k.startsWith(t) && [...k].length - [...t].length <= 1) return { ok: true };
    heard ??= [...r].slice(0, 4).join('');
  }
  return { ok: false, heard, romaji: romaji && !heard };
}

/** The reading, plus the reading with a stretched end or trailing っ trimmed. */
function variants(r: string): string[] {
  const out = [r];
  let t = r.replace(/っ+$/, '');
  const chars = [...t];
  while (chars.length > 1) {
    const last = chars.at(-1)!;
    const prev = chars.at(-2)!;
    if ('あいうえお'.includes(last) && vowelOf(prev) === last) chars.pop();
    else break;
  }
  t = chars.join('');
  if (t && t !== r) out.push(t);
  return out;
}

/** Does a spoken or typed word match `word` and not its partner in the minimal pair? */
export function checkWord(texts: readonly (string | undefined)[], word: JpText, other: JpText | null): boolean {
  const want = normalizeReading(word.kana);
  const avoid = other ? normalizeReading(other.kana) : null;
  for (const raw of texts) {
    if (!raw) continue;
    const r = normalizeReading(raw);
    if (!r) continue;
    if (r === want || normalizeReading(word.text) === r) return true;
    if (avoid && (r === avoid || soundKey(r) === soundKey(avoid))) continue;
    if (soundKey(r) === soundKey(want)) return true;
  }
  return false;
}

const CONTRAST_TIP: Record<MinimalPair['contrast'], string> = {
  'long-vowel': 'listen for the long vowel: it’s one extra beat',
  'small-tsu': 'listen for the little pause (っ) before the next sound',
  'long-mark': 'listen for the long ー: it holds the sound one extra beat',
  n: 'listen for ん: it’s a beat of its own',
  voicing: 'listen for the buzz of the voiced sound (゛)',
};

export function pairTip(pair: MinimalPair, played: 'a' | 'b'): string {
  const w = pair[played];
  const o = played === 'a' ? pair.b : pair.a;
  return `${w.kana} is “${w.en}”, ${o.kana} is “${o.en}”: ${CONTRAST_TIP[pair.contrast]}.`;
}

/** One kind line after a missed kana. Never romaji, except chapter 1's training wheels. */
export function kanaTip(deck: Deck, target: Kana, wrong?: Kana, check?: SoundCheck): string {
  if (check?.romaji) return 'Fude only hears kana sounds: say it in Japanese!';
  const set =
    (wrong && deck.lookAlikes.find((s) => s.kanaIds.includes(target.id) && s.kanaIds.includes(wrong.id))) ??
    (wrong ? undefined : deck.lookAlikes.find((s) => s.kanaIds.includes(target.id) && s.kanaIds.length <= 3));
  if (set) return set.tip;
  const twin = target.twinId ? deck.byId.get(target.twinId) : undefined;
  const sound = inOtherScript(target.sound, target.script);
  if (target.chapter === 1) return `${target.char} says “${target.romaji}”${twin ? `, just like its twin ${twin.char}` : ''}.`;
  if (check?.heard && check.heard !== target.sound) return `That sounded like ${check.heard}. ${target.char} is ${sound}.`;
  if (twin) return sound === twin.char ? `${target.char} is ${twin.char}’s twin: same sound, other alphabet.` : `${target.char} is ${twin.char}’s twin: it sounds like ${sound}.`;
  return `${target.char} sounds like ${sound}.`;
}
