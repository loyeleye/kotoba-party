// Turns an answer move (tiles, a set-phrase frame, typed text, a spoken lock-in) into the
// answer the stage shows, and decides how it was given (from memory, said to send, tiles …).

import type { JpText, OogiriRound, TileForm } from '../../../../content/src/types.js';
import { MAX_ANSWER_LENGTH } from '../../constants.js';
import { isUtterance, matchesAccepted, normalizeReading, utteranceReading, type Utterance } from '../../japanese/kana.js';
import { cleanText, isObject } from '../mode.js';
import { FORM_LABELS, isAdj, isVerb, type Frame, type Tile } from './deal.js';
import type { AnswerShape } from './natural.js';

/**
 * How an answer was given, best first. `memory-*`: in the say-it-first window, before any
 * tiles. `spoken`: built, then said to send it and the recogniser heard it. `tried`: said to
 * send it but the recogniser heard something else (still counts as trying). `typed` / `tiles`:
 * the quiet fallbacks. `english`: no Japanese bonus.
 */
export type AnswerStyle = 'memory-spoken' | 'memory-typed' | 'spoken' | 'tried' | 'typed' | 'tiles' | 'english';

export const STYLE_LABELS: Record<AnswerStyle, string> = {
  'memory-spoken': 'said from memory',
  'memory-typed': 'typed from memory',
  spoken: 'said to send',
  tried: 'said to send',
  typed: 'typed',
  tiles: 'tiles',
  english: 'English',
};

export interface AnswerMove {
  kind: 'answer';
  slot: number;
  /** Tiles in order, by hand key, with the form picked for tiles that ask for one. */
  tiles?: { key: string; form?: TileForm }[];
  /** A set-phrase frame id (Photo Caption). */
  frame?: string;
  /** Typed text (kana pad or keyboard), added after the tiles. */
  typed?: Utterance;
  /** What the player said to send it, or, with nothing else, their whole answer. */
  said?: Utterance;
}

export interface BuiltAnswer {
  /** What goes in the blank, as shown on the stage. */
  text: string;
  kana: string;
  /** English for the blank. */
  en: string;
  style: AnswerStyle;
  english: boolean;
  /** Tiles used, with the form picked and whether it was the one asked for. */
  used: { tile: Tile; jp: JpText; form?: TileForm; right?: boolean }[];
  /** One line per wrong form: the kind private correction. */
  formTips: string[];
  /** Free text the player gave (typed or said), for callbacks. */
  freeReading: string;
  /** What it is made of, for the natural version. */
  shape: AnswerShape;
}

export const MAX_TILES_PER_ANSWER = 3;

const JAPANESE = /[ぁ-ゖァ-ヺー㐀-鿿]/;
export const isEnglish = (text: string): boolean => /[A-Za-z]/.test(text) && !JAPANESE.test(text);

const BLANK_JP = /＿+|_{3,}/;
const BLANK_EN = /_{2,}|＿+/;

/** Puts `fill` into a sentence's blank (or after it, if the sentence has none). */
export function fillBlank(sentence: string, fill: string, en = false): string {
  const blank = en ? BLANK_EN : BLANK_JP;
  const m = blank.exec(sentence);
  if (!m) return `${sentence} ${fill}`;
  const before = sentence.slice(0, m.index);
  // A blank already inside quotes ("…__.") takes the answer bare, not “quoted” again.
  const quoted = en && (before.split(/["“”]/).length - 1) % 2 === 1;
  return before + (quoted ? fill.replace(/^“(.*)”$/s, '$1') : fill) + sentence.slice(m.index + m[0].length);
}

/** The player's whole sentence: their prompt version with the answer in the blank. */
export function sentenceFor(version: JpText, a: { text: string; kana: string; en: string }): JpText {
  return { text: fillBlank(version.text, a.text), kana: fillBlank(version.kana, a.kana), en: fillBlank(version.en, a.en, true) };
}

const stripTo = (en: string) => en.replace(/^to\s+/i, '');

export type BuildResult = { ok: true; answer: BuiltAnswer } | { ok: false; error: string };

export function parseAnswerMove(raw: Record<string, unknown>): AnswerMove | null {
  if (!Number.isInteger(raw.slot)) return null;
  const move: AnswerMove = { kind: 'answer', slot: raw.slot as number };
  if (raw.tiles !== undefined) {
    if (!Array.isArray(raw.tiles) || raw.tiles.length > MAX_TILES_PER_ANSWER) return null;
    const tiles: { key: string; form?: TileForm }[] = [];
    for (const t of raw.tiles) {
      if (!isObject(t) || typeof t.key !== 'string' || t.key.length > 8) return null;
      if (t.form !== undefined && typeof t.form !== 'string') return null;
      tiles.push({ key: t.key, form: t.form as TileForm | undefined });
    }
    move.tiles = tiles;
  }
  if (raw.frame !== undefined) {
    if (typeof raw.frame !== 'string' || raw.frame.length > 64) return null;
    move.frame = raw.frame;
  }
  if (raw.typed !== undefined) {
    if (!isUtterance(raw.typed)) return null;
    move.typed = raw.typed;
  }
  if (raw.said !== undefined) {
    if (!isUtterance(raw.said)) return null;
    move.said = raw.said;
  }
  return move;
}

/**
 * Builds the answer. `hand` and `frames` are the slot's; `memory` is true while the say-it-first
 * window is still open (no tiles shown yet).
 */
export function buildAnswer(move: AnswerMove, hand: readonly Tile[], frames: readonly Frame[], memory: boolean, round: OogiriRound): BuildResult {
  const tiles = move.tiles ?? [];
  const typedText = move.typed ? cleanText(move.typed.text, MAX_ANSWER_LENGTH) : null;
  const saidText = move.said ? cleanText(move.said.text, MAX_ANSWER_LENGTH) : null;
  const frame = move.frame !== undefined ? frames.find((f) => f.id === move.frame) : undefined;
  if (move.frame !== undefined && !frame) return { ok: false, error: 'unknown-frame' };

  // Said with nothing else: the whole answer is what they said (or typed into the speak box).
  const freeOnly = !tiles.length && !typedText && !frame;
  if (freeOnly) {
    if (!saidText || !move.said) return { ok: false, error: 'empty-answer' };
    const english = isEnglish(saidText);
    if (english && round === 'head-to-head') return { ok: false, error: 'japanese-only' };
    const viaSpeech = move.said.via === 'speech';
    const style: AnswerStyle = english ? 'english' : memory ? (viaSpeech ? 'memory-spoken' : 'memory-typed') : viaSpeech ? 'spoken' : 'typed';
    const kana = move.said.reading ?? saidText;
    return {
      ok: true,
      answer: { text: saidText, kana, en: english ? saidText : `“${saidText}”`, style, english, used: [], formTips: [], freeReading: kana, shape: 'free' },
    };
  }
  if (memory) return { ok: false, error: 'say-it-first' };

  const used: BuiltAnswer['used'] = [];
  const formTips: string[] = [];
  const seen = new Set<string>();
  for (const pick of tiles) {
    const tile = hand.find((t) => t.key === pick.key);
    if (!tile) return { ok: false, error: 'unknown-tile' };
    if (seen.has(tile.key)) return { ok: false, error: 'tile-twice' };
    seen.add(tile.key);
    if (tile.options) {
      // Inside a verb frame the frame sets the form; otherwise the player must pick one.
      if (frame && frame.slot !== 'noun') {
        used.push({ tile, jp: tile.jp });
        continue;
      }
      const option = tile.options.find((o) => o.form === pick.form);
      if (!option) return { ok: false, error: 'pick-form' };
      const right = option.form === tile.ask;
      if (!right && tile.ask) {
        const want = tile.options.find((o) => o.form === tile.ask);
        if (want) formTips.push(`${tile.jp.text} in the ${FORM_LABELS[tile.ask]} form is ${want.jp.text} (${want.jp.en}).`);
      }
      used.push({ tile, jp: option.jp, form: option.form, right });
    } else used.push({ tile, jp: tile.jp });
  }

  let text: string;
  let kana: string;
  let en: string;
  const typedKana = move.typed?.reading ?? typedText ?? '';
  const typedEnglish = !!typedText && isEnglish(typedText);
  if (frame && frame.slot !== 'noun') {
    // Verb frames take exactly one verb, as its stem (〜たい) or て-form (〜てください), or typed text.
    if (used.length > 1 || (used.length === 1 && typedText)) return { ok: false, error: 'frame-one-verb' };
    if (used.length === 1) {
      const t = used[0]!.tile;
      const part = frame.slot === 'verb-stem' ? t.stem : t.te;
      if (!part) return { ok: false, error: 'frame-needs-verb' };
      text = fillBlank(frame.frame.text, part.text);
      kana = fillBlank(frame.frame.kana, part.kana);
      en = fillBlank(frame.frame.en, stripTo(t.jp.en), true);
      used[0] = { tile: t, jp: { text: text, kana, en } };
    } else if (typedText) {
      text = fillBlank(frame.frame.text, typedText);
      kana = fillBlank(frame.frame.kana, typedKana);
      en = fillBlank(frame.frame.en, typedEnglish ? typedText : `“${typedText}”`, true);
    } else return { ok: false, error: 'empty-answer' };
  } else {
    const parts = used.map((u) => u.jp);
    if (typedText) parts.push({ text: typedText, kana: typedKana, en: typedEnglish ? typedText : `“${typedText}”` });
    if (!parts.length) return { ok: false, error: 'empty-answer' };
    const inner = { text: parts.map((p) => p.text).join(' '), kana: parts.map((p) => p.kana).join(' '), en: parts.map((p) => stripTo(p.en)).join(' ') };
    if (frame) {
      text = fillBlank(frame.frame.text, inner.text);
      kana = fillBlank(frame.frame.kana, inner.kana);
      en = fillBlank(frame.frame.en, inner.en, true);
    } else ({ text, kana, en } = inner);
  }
  if ([...text].length > MAX_ANSWER_LENGTH) return { ok: false, error: 'too-long' };

  const english = isEnglish(text);
  if (english && round === 'head-to-head') return { ok: false, error: 'japanese-only' };

  let style: AnswerStyle;
  if (english) style = 'english';
  else if (move.said?.via === 'speech') style = matchesAccepted(utteranceReading(move.said), [kana]) ? 'spoken' : 'tried';
  else style = typedText ? 'typed' : 'tiles';

  const freeReading = [typedKana, move.said ? utteranceReading(move.said) : ''].filter(Boolean).join(' ');
  return { ok: true, answer: { text, kana, en, style, english, used, formTips, freeReading, shape: shapeOf(used, !!typedText, !!frame) } };
}

function shapeOf(used: BuiltAnswer['used'], typed: boolean, frame: boolean): AnswerShape {
  if (frame) return 'phrase';
  if (used.length === 0) return 'free';
  if (used.length > 1 || typed) return 'mixed';
  const u = used[0]!;
  if (isVerb(u.tile)) return 'pred';
  if (isAdj(u.tile)) return u.form && u.form !== 'plain' ? 'pred' : 'adj';
  return 'noun';
}

/** True if the said utterance sounds like the answer (used for the encore). */
export function saysAnswer(said: Utterance, answerKana: string): boolean {
  return normalizeReading(answerKana) !== '' && matchesAccepted(utteranceReading(said), [answerKana]);
}
