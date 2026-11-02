// Content for Oogiri Night: which prompts, words and set phrases a game draws on, and how a
// player's tiles are dealt. Falls back to the built-in placeholder set (fallback.ts) whenever
// the content library is thin, so a game always runs end to end.

import type { JpText, Level, OogiriPrompt, OogiriRound, PackWord, SetPhraseTile, TileForm } from '../../../../content/src/types.js';
import type { Audience } from '../../protocol.js';
import { normalizeReading } from '../../japanese/kana.js';
import { shuffled, type ContentLibrary } from '../mode.js';
import { FALLBACK_PACK, FALLBACK_PROMPTS, FALLBACK_SET_PHRASES } from './fallback.js';
import { greenCarPrompts } from '../../../../content/src/oogiri/greenCar.js';

export const ROUNDS: readonly OogiriRound[] = ['head-to-head', 'photo-caption', 'ippon'];

const LEVEL_RANK: Record<Level, number> = { kana: 0, n5: 1, n4: 2, n3: 3 };

/** Forms a tile can ask for. Verbs: the four N5 polite forms; adjectives: plain, past, negative. */
export type AskForm = TileForm;
export const VERB_FORMS: readonly TileForm[] = ['masu', 'mashita', 'masen', 'tai'];
export const ADJ_FORMS: readonly TileForm[] = ['plain', 'past', 'negative'];

export const FORM_LABELS: Record<TileForm, string> = {
  masu: 'ます',
  mashita: 'ました',
  masen: 'ません',
  tai: 'たい',
  'te-kudasai': 'てください',
  plain: 'plain',
  past: 'past',
  negative: 'not',
};

export interface TileOption {
  form: TileForm;
  jp: JpText;
}

/** One tile in a player's hand. */
export interface Tile {
  /** Unique within the hand. */
  key: string;
  wordId: string;
  pos: PackWord['pos'];
  role: 'fit' | 'swerve' | 'callback';
  /** Dictionary form (what the tile face shows). */
  jp: JpText;
  /** The form the tile asks for (verbs and adjectives from N5 up). */
  ask?: TileForm;
  /** The forms the player picks between, when the tile asks for one. */
  options?: TileOption[];
  /** For set-phrase frames: the verb's stem (食べ) and て-form (食べて), when the pack has them. */
  stem?: JpText;
  te?: JpText;
}

export interface Frame {
  id: string;
  frame: JpText;
  slot: SetPhraseTile['slot'];
  pattern: string;
}

/** Everything one game draws on. Built once per call from ctx.content plus the fallback. */
export interface Library {
  packId: string;
  words: Map<string, PackWord>;
  /** Words dealt as filler and fallback callbacks: the pack minus its untaught baseline. */
  pool: PackWord[];
  /** The room's Audience when the library was built. */
  audience: Audience;
  /** Prompts the audience may be dealt, per round. */
  prompts: Record<OogiriRound, OogiriPrompt[]>;
  frames: SetPhraseTile[];
  /** True when any part came from the placeholder set. */
  placeholder: boolean;
  /** Green Car: every round draws on the Green Car prompts (content/src/oogiri/greenCar.ts), with no set phrases. */
  greenCar?: true;
}

/** Whether a prompt may be dealt to an audience (an untagged prompt suits everyone). */
export const suits = (p: Pick<OogiriPrompt, 'audiences'>, audience: Audience): boolean => !p.audiences || p.audiences.includes(audience);

/** A prompt written for this audience alone (a Kids or Cheeky prompt): dealt before the shared ones. */
export const ownPrompt = (p: Pick<OogiriPrompt, 'audiences'>, audience: Audience): boolean => p.audiences?.length === 1 && p.audiences[0] === audience;

/** Pack words kept out of a Kids hand (beer). */
const grownUp = (w: PackWord) => w.tags?.includes('grown-up') === true;

export function library(content: ContentLibrary, wantedPackId: string | undefined, random: () => number, audience: Audience = 'family', greenCar = false): Library {
  const promptPacks = new Set(content.oogiriPrompts.map((p) => p.packId));
  const usable = content.packs.filter((p) => promptPacks.has(p.id));
  const pack = usable.find((p) => p.id === wantedPackId) ?? (usable.length ? usable[Math.floor(random() * usable.length)]! : undefined);
  return libraryFor(content, pack?.id ?? FALLBACK_PACK.id, audience, greenCar);
}

/** The library for a pack id that was picked earlier (deterministic: no randomness). */
export function libraryFor(content: ContentLibrary, packId: string, audience: Audience = 'family', greenCar = false): Library {
  const words = new Map<string, PackWord>();
  for (const p of content.packs) for (const w of p.words) words.set(w.id, w);
  for (const w of FALLBACK_PACK.words) if (!words.has(w.id)) words.set(w.id, w);
  const pack = content.packs.find((p) => p.id === packId);
  const baseline = new Set(pack?.baselineWordIds ?? []);
  let placeholder = !pack;
  const pool = (pack ?? FALLBACK_PACK).words.filter((w) => !baseline.has(w.id) && !(audience === 'kids' && grownUp(w)));

  const prompts = {} as Record<OogiriRound, OogiriPrompt[]>;
  if (greenCar) {
    // The Green Car: one deck of frame prompts for every round (the room's own first, deal is aimed in oogiri.ts),
    // no photos and no N5 set-phrase tiles.
    const deck = greenCarPrompts.filter((p) => suits(p, audience));
    for (const round of ROUNDS) prompts[round] = deck;
    return { packId, words, pool: pool.length ? pool : FALLBACK_PACK.words, audience, prompts, frames: [], placeholder, greenCar: true };
  }
  for (const round of ROUNDS) {
    const usable = content.oogiriPrompts.filter((p) => p.round === round && suits(p, audience));
    let list = usable.filter((p) => p.packId === packId);
    if (!list.length) list = usable;
    if (!list.length) {
      list = FALLBACK_PROMPTS.filter((p) => p.round === round);
      placeholder = true;
    }
    prompts[round] = list;
  }
  let frames = [...content.setPhraseTiles];
  if (!frames.length) {
    frames = FALLBACK_SET_PHRASES;
    placeholder = true;
  }
  return { packId, words, pool: pool.length ? pool : FALLBACK_PACK.words, audience, prompts, frames, placeholder };
}

/** The prompt version a player sees: their level, N4 falling back to N5, anything as a last resort. */
export function versionFor(prompt: OogiriPrompt, level: Level): JpText {
  const v = prompt.versions;
  const order: Level[] = level === 'n3' ? ['n3', 'n4', 'n5', 'kana'] : level === 'n4' ? ['n4', 'n5', 'kana'] : level === 'n5' ? ['n5', 'kana', 'n4'] : ['kana', 'n5', 'n4'];
  for (const l of order) if (v[l]) return v[l]!;
  return { text: '＿＿＿', kana: '＿＿＿', en: '___' };
}

/** The version the stage shows: N5 first, since most of the room reads it. */
export const stageVersion = (prompt: OogiriPrompt): JpText => versionFor(prompt, 'n5');

export const isVerb = (w: Pick<PackWord, 'pos'>) => w.pos === 'verb-ru' || w.pos === 'verb-u' || w.pos === 'verb-irregular';
export const isAdj = (w: Pick<PackWord, 'pos'>) => w.pos === 'adj-i' || w.pos === 'adj-na';

const stripTail = (jp: JpText, tail: RegExp): JpText => ({ ...jp, text: jp.text.replace(tail, ''), kana: jp.kana.replace(tail, ''), furigana: undefined });

export function makeTile(word: PackWord, role: Tile['role'], key: string, level: Level, random: () => number): Tile {
  const tile: Tile = { key, wordId: word.id, pos: word.pos, role, jp: word.jp };
  const forms = word.forms ?? {};
  if (forms.masu) tile.stem = stripTail(forms.masu, /ます$/);
  if (forms['te-kudasai']) tile.te = stripTail(forms['te-kudasai'], /\s*ください$/);
  let options: TileOption[] = [];
  if (isVerb(word)) options = VERB_FORMS.filter((f) => forms[f]).map((f) => ({ form: f, jp: forms[f]! }));
  else if (isAdj(word)) options = ADJ_FORMS.flatMap((f): TileOption[] => (f === 'plain' ? [{ form: f, jp: word.jp }] : forms[f] ? [{ form: f, jp: forms[f]! }] : []));
  if (options.length >= 2) {
    if (level === 'kana') {
      // Kana level: no form quiz. A verb comes ready in its ます form.
      const ready = options.find((o) => o.form === 'masu') ?? options[0]!;
      tile.jp = ready.jp;
    } else {
      tile.options = options;
      const askable = options.filter((o) => o.form !== 'plain');
      tile.ask = askable[Math.floor(random() * askable.length)]!.form;
    }
  }
  return tile;
}

/**
 * Deals a hand for one prompt: 3 that fit, 3 swerves, 2 callbacks (a word used earlier
 * tonight), or 3 / 2 / 1 for Kana-level players. Short slots are filled from the pack.
 * At most one stereotype word per hand, and no grown-up word (beer) for a Kids audience.
 */
export function dealTiles(lib: Library, prompt: OogiriPrompt, level: Level, usedWordIds: readonly string[], random: () => number): Tile[] {
  const want = level === 'kana' ? { fit: 3, swerve: 2, callback: 1 } : { fit: 3, swerve: 3, callback: 2 };
  const taken = new Set<string>();
  let stereotypes = 0;
  const ok = (w: PackWord | undefined): w is PackWord => {
    if (!w || taken.has(w.id)) return false;
    if (lib.audience === 'kids' && grownUp(w)) return false;
    if (w.stereotype && stereotypes >= 1) return false;
    return true;
  };
  const take = (ids: readonly string[], n: number): PackWord[] => {
    const out: PackWord[] = [];
    for (const id of shuffled(ids, random)) {
      if (out.length >= n) break;
      const w = lib.words.get(id);
      if (!ok(w)) continue;
      taken.add(w.id);
      if (w.stereotype) stereotypes++;
      out.push(w);
    }
    return out;
  };
  const fit = take(prompt.fitTileIds, want.fit);
  const swerve = take(prompt.swerveTileIds, want.swerve);
  const callback = take(usedWordIds, want.callback);
  // Fill anything short from the pack: swerve-flagged words for swerves, any word otherwise.
  const pool = lib.pool.map((w) => w.id);
  if (swerve.length < want.swerve) swerve.push(...take(lib.pool.filter((w) => w.swerve).map((w) => w.id), want.swerve - swerve.length));
  if (fit.length < want.fit) fit.push(...take(pool, want.fit - fit.length));
  if (swerve.length < want.swerve) swerve.push(...take(pool, want.swerve - swerve.length));
  if (callback.length < want.callback) callback.push(...take(pool, want.callback - callback.length));

  const hand = [
    ...fit.map((w) => ({ w, role: 'fit' as const })),
    ...swerve.map((w) => ({ w, role: 'swerve' as const })),
    ...callback.map((w) => ({ w, role: 'callback' as const })),
  ];
  // Shuffle so the role isn't given away by position (callbacks are still marked).
  return shuffled(hand, random).map(({ w, role }, i) => makeTile(w, role, `t${i + 1}`, level, random));
}

/** Set-phrase frames for the Photo Caption round: up to 3 at or below the player's level that the hand can fill. */
export function dealFrames(lib: Library, level: Level, hand: readonly Tile[], random: () => number): Frame[] {
  const fits = (f: SetPhraseTile) => f.slot === 'noun' || (f.slot === 'verb-stem' ? hand.some((t) => t.stem) : hand.some((t) => t.te));
  const allowed = lib.frames.filter((f) => LEVEL_RANK[f.level] <= LEVEL_RANK[level] && fits(f));
  return shuffled(allowed, random)
    .slice(0, 3)
    .map((f) => ({ id: f.id, frame: f.frame, slot: f.slot, pattern: f.pattern }));
}

/** Pack words that appear in a free answer (typed or said), so they can come back as callbacks. */
export function wordsIn(lib: Library, reading: string): string[] {
  const r = normalizeReading(reading);
  if (!r) return [];
  const out: string[] = [];
  for (const w of lib.pool) {
    const k = normalizeReading(w.jp.kana);
    if (k.length >= 2 && r.includes(k)) out.push(w.id);
  }
  return out.slice(0, 3);
}
