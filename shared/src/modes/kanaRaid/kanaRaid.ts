// Kana Yōkai Raid: the co-op on-ramp. Kana-shaped yōkai march across the stage and the team
// knocks them out from their phones. See docs/modes/kana-raid.md.
//
// Shape of a game: intro (chapter pick) → three waves, each prompt (banner) → answer (the
// timed battle) → reveal (wave results) → score; then the optional Ink Storm wave (draw each
// kana on the phone, graded by shared/src/japanese/strokes.ts) → finale (the Word Yōkai
// boss) → encore (the raid's own recap: seen / correct tonight, the haunted list) → the
// room's recap.
//
// Time: yōkai have fixed spawn and escape times decided when a wave starts. The mode has no
// timers, so an escape is settled at the next move (or when the wave ends); the stage animates
// from the same times, so what people see matches what the rules settle.

import type { BossWord, JpText, Kana, MinimalPair } from '../../../../content/src/types.js';
import { isUtterance, type Utterance } from '../../japanese/kana.js';
import { gradeInk, inkTipText, readInk, thin, type InkGrade, type InkPoint } from '../../japanese/strokes.js';
import type { PracticeItem } from '../../progress.js';
import type { Phase, Viewer } from '../../protocol.js';
import { cleanText, isObject, moveError, MOVE_OK, pick, shuffled, type Award, type ContentLibrary, type Mode, type ModeContext, type MoveResult } from '../mode.js';
import { katsuyoRaidMode } from './katsuyoRaid.js';
import {
  along,
  BASE_POINTS,
  BOSS_BONUS,
  bringOn,
  cueRaid,
  dealOptions,
  distinct,
  escapeRest,
  greenCarSwitch,
  isAlive,
  payBonus,
  QUIET_DAMAGE,
  SAY_LATER_MS,
  SPEAK_BONUS,
  strike,
  sweep,
  type RaidOption,
} from './raidCore.js';
import {
  buildDeck,
  chapterDifficulty,
  checkSound,
  romajiHint,
  checkWord,
  inOtherScript,
  inkPoolFor,
  kanaTip,
  pairTip,
  pairsFor,
  pieceSound,
  poolFor,
  sameSound,
  type ChapterInfo,
  type Deck,
  type SoundCheck,
} from './deck.js';

// ---------- tuning ----------

// The battle engine's numbers live in raidCore.ts, shared with the Green Car raid.
export { BASE_POINTS, BONUS_CAP, BOSS_BONUS, COMBO_WINDOW_MS, QUIET_DAMAGE, SPEAK_BONUS } from './raidCore.js';
export type { RaidOption } from './raidCore.js';
/**
 * Points off for a wrong guess, by the furthest chapter the player has studied: nothing while
 * you're learning the first rows, then a little more as you go (a hit is worth 60–100).
 */
export function missPenalty(top: number): number {
  if (top <= 3) return 0;
  if (top <= 7) return 5;
  if (top <= 10) return 10;
  return 15;
}

/** Takes a wrong guess's points off (never below zero); returns what was taken. */
function dock(p: PlayerRaid, ctx: ModeContext, playerId: string): number {
  const lost = Math.min(missPenalty(p.top), ctx.player(playerId)?.score ?? 0);
  if (lost > 0) {
    ctx.award(playerId, -lost);
    p.wave.lost += lost;
  }
  return lost;
}

/** The three spoken waves; Ink Storm, when on, is wave 4 and the boss comes after it. */
export const WAVES = 3;
export const INK_WAVE = WAVES + 1;
/** Drawings the stage keeps for its ink replay. */
const STAGE_INKS = 4;
/** Points per stroke in the stage replay and the phone's "how it's written" replay. */
const REPLAY_POINTS = 16;
/** A passed drawing of a look-alike below this shape score still gets a vision second look. */
const COACH_BELOW = 0.85;

const WAVE_TIMING: Record<number, { gap: number; walk: number }> = {
  1: { gap: 1_800, walk: 26_000 },
  2: { gap: 1_500, walk: 22_000 },
  3: { gap: 2_600, walk: 26_000 },
  // Ink Storm: drawing takes longer than tapping, so fewer, slower yōkai.
  4: { gap: 3_000, walk: 34_000 },
};

export const WAVE_INFO: Record<number, { title: string; titleJa: string; titleKana: string; how: string }> = {
  1: { title: 'Night Parade', titleJa: '百鬼夜行', titleKana: 'ひゃっきやこう', how: 'Pick a yōkai on your phone, then shout its sound or strike it with its twin from the other alphabet.' },
  2: { title: 'Shapeshifters', titleJa: '化け物', titleKana: 'ばけもの', how: 'Pick a yōkai on your phone. Look-alikes and echoes: find the sound it really makes.' },
  3: { title: 'Long and Short', titleJa: 'のばす・つまる', titleKana: 'のばす・つまる', how: 'Hear one word, tap it, then say it. Listen for long sounds and little pauses.' },
  4: { title: 'Word Yōkai', titleJa: 'ことば妖怪', titleKana: 'ことばようかい', how: 'Break one piece each, then read the whole word together!' },
};

export const INK_INFO = { title: 'Ink Storm', titleJa: '墨の嵐', titleKana: 'すみのあらし', how: 'The yōkai wear their twins’ masks. Draw each one’s true form on your phone, stroke by stroke, then say it.' };

const isInkWave = (s: RaidState) => s.ink && s.wave === INK_WAVE;
/** Waves 1 and 2: a player can pick which yōkai to attack. */
const canAimWave = (s: RaidState) => (s.wave === 1 || s.wave === 2) && !isInkWave(s);

/** The banner for the wave being played (the boss's is always WAVE_INFO[4]). */
function waveInfoOf(s: RaidState): { title: string; titleJa: string; titleKana: string; how: string } | null {
  if (isInkWave(s)) return INK_INFO;
  if (s.wave > s.waves) return s.wave === s.waves + 1 ? WAVE_INFO[4]! : null;
  return WAVE_INFO[s.wave] ?? null;
}

const DURATIONS: Record<Phase, number> = {
  lobby: 0,
  intro: 30_000,
  prompt: 5_000,
  answer: 45_000,
  reveal: 9_000,
  encore: 25_000,
  score: 7_000,
  penalty: 0,
  finale: 75_000,
  recap: 0,
};

/** What ー and っ do in a word (boss pieces you can't say on their own). */
const MARK_OPTIONS: Record<string, { right: string; wrong: string[] }> = {
  ー: { right: 'Stretch the sound before it', wrong: ['A tiny pause', 'Says ん', 'Makes it a question'] },
  ッ: { right: 'A tiny pause before the next sound', wrong: ['Stretch the sound before it', 'Says つ', 'Says ん'] },
  っ: { right: 'A tiny pause before the next sound', wrong: ['Stretch the sound before it', 'Says つ', 'Says ん'] },
};

// ---------- state ----------

export type AttackKind = 'shout' | 'twin' | 'lookalike' | 'echo' | 'pair' | 'draw' | 'piece' | 'blow';

export interface Attack {
  id: string;
  kind: AttackKind;
  yokaiId: string | null;
  itemId: string;
  /** A second go at an item just missed. */
  retry: boolean;
  /** The glyph on the phone (the yōkai, or the twin to match). */
  show?: string;
  /** Kana for the phone to voice (ja-JP speech synthesis). */
  hear?: string;
  /** The sound written in the other script, shown when the phone can't voice it. */
  hearText?: string;
  /** Chapter 1 training wheels only. */
  romaji?: string;
  /** Sound off, Wave 3: the meaning to find among the spellings, in place of the voiced word. */
  clue?: string;
  options: RaidOption[];
  /** Wave 3: tap what you heard, then say it. Ink Storm: draw it, then say it. */
  step?: 'tap' | 'draw' | 'say';
  /** Ink Storm: the script to draw it in. */
  script?: Kana['script'];
  /** The word to say (Wave 3 say step, the boss's finishing blow). */
  word?: JpText;
  // ---- server only ----
  answer: string;
  played?: 'a' | 'b';
  pieceIndex?: number;
}

export type AttackView = Omit<Attack, 'answer' | 'played' | 'pieceIndex' | 'itemId'>;

export interface LastResult {
  attackId: string;
  ok: boolean;
  kind: AttackKind;
  /** What was attacked (a kana, a word). */
  char: string;
  /** Its sound for the phone to voice. */
  hear: string;
  points: number;
  damage: number;
  tip: string | null;
  combo: number;
  /** The target had already gone, so the hit landed on another yōkai. */
  splash: boolean;
  /** A retry of this item comes next. */
  retryNext: boolean;
  /** Ink Storm: the drawing and how the kana is written, for the phone's replay. */
  ink?: { mine: InkPoint[][]; ref: InkPoint[][]; clean: boolean; score: number };
}

/** One drawing for the stage's ink replay. */
export interface InkShow {
  id: string;
  playerId: string;
  char: string;
  strokes: InkPoint[][];
  ok: boolean;
  clean: boolean;
  at: number;
}

/** A drawing waiting for the server's optional vision second look (server only). */
interface InkAsk {
  key: string;
  /** The drawing attack it is about: a tip that lands after the player moved on is dropped. */
  attackId: string;
  char: string;
  candidates: string[];
  strokes: InkPoint[][];
  passed: boolean;
  at: number;
}

export interface Yokai {
  id: string;
  itemId: string;
  char: string;
  /** Wave 3: the other word of the pair. */
  alt?: string;
  hp: number;
  maxHp: number;
  spawnAt: number;
  escapeAt: number;
  state: 'alive' | 'defeated' | 'escaped';
  endedAt: number | null;
  hitAt: number | null;
  /** The chapter leader's folklore name. */
  leader?: string;
  /** Ink Storm: the twin's face the yōkai wears on stage (its true form is the answer). */
  mask?: string;
  /** Who landed the last hit, and what that hit paid: the stage's catch chip. */
  caughtBy?: string;
  caughtPoints?: number;
}

interface Tally {
  char: string;
  hear: string;
  seen: number;
  correct: number;
  missed: number;
  tip: string | null;
  /** Right from memory (said, typed or drawn, not picked): what moves a saved yōkai card up. */
  recalled: number;
  /** The saved yōkai card this counts towards (the kana's id), or null for a pair word. */
  card: { id: string; en: string } | null;
}

interface WaveStats {
  base: number;
  bonus: number;
  /** Points taken off for wrong guesses. */
  lost: number;
  hits: number;
  misses: number;
  spoken: number;
}

interface PlayerRaid {
  chapters: number[];
  ready: boolean;
  top: number;
  attack: Attack | null;
  /** Attack ids replaced without the player's doing (the boss moving on): a late answer to one is a harmless race. */
  replaced: string[];
  last: LastResult | null;
  /** The item to retry once after a miss. */
  retryNext: { itemId: string; kind: AttackKind } | null;
  tally: Record<string, Tally>;
  wave: WaveStats;
  stats: { hits: number; misses: number; shoutsSpoken: number; comboHits: number; pieces: number; defeats: number; comebacks: number; reads: number; inkClean: number };
  /** Drawings waiting for a vision second look (server only, at most two). */
  inkAsks: InkAsk[];
  /** Say steps the player moved on from while the phone checks the recording (at most three). */
  pendingSays: { attack: Attack; at: number }[];
  /** The latest of those, scored when it came back. */
  said: LastResult | null;
  /** The vision second look's line on the latest drawing (shown only while that drawing is the last result). */
  coach: { attackId: string; char: string; tip: string; at: number } | null;
}

export interface BossPiece {
  char: string;
  sound: string;
  owner: string | null;
  by: string | null;
}

interface BossState {
  id: string;
  word: JpText;
  pieces: BossPiece[];
  stage: 'break' | 'blow';
  reads: Record<string, 'spoken' | 'typed' | 'missed' | 'pass'>;
  defeated: boolean;
  defeatedAt: number | null;
}

export interface WaveResult {
  wave: number;
  total: number;
  defeated: number;
  escaped: number;
  escapedChars: string[];
  bestCombo: number;
  players: { playerId: string; hits: number; misses: number; points: number; bonus: number }[];
}

export interface RaidState {
  wave: number;
  /** Waves before the boss: 3, or 4 with Ink Storm. */
  waves: number;
  /** Ink Storm is on (VIP's choice; needs stroke references in the content). */
  ink: boolean;
  inkAvailable: boolean;
  /** The latest drawings, for the stage's replay. */
  inks: InkShow[];
  /** ctx.now of the last change (the stage uses it to line its clock up with the server's). */
  at: number;
  chapters: ChapterInfo[];
  players: Record<string, PlayerRaid>;
  horde: Yokai[];
  combo: { count: number; players: string[]; lastAt: number; best: number };
  waveEndsAt: number;
  waveResult: WaveResult | null;
  boss: BossState | null;
  escaped: { itemId: string; char: string }[];
  lastCueAt: number;
  placeholder: boolean;
  /** Night totals for the raid's recap. */
  defeatedTotal: number;
  bestCombo: number;
}

// ---------- view ----------

export interface YokaiView {
  id: string;
  char: string;
  alt?: string;
  hp: number;
  maxHp: number;
  spawnAt: number;
  escapeAt: number;
  state: Yokai['state'];
  endedAt: number | null;
  hitAt: number | null;
  leader?: string;
  caughtBy?: string;
  caughtPoints?: number;
  /** Players attacking it right now (waves 1–2: they picked it, or were dealt it). */
  aimedBy?: string[];
}

export interface KanaRaidView {
  mode: 'kana-raid';
  /** 0 chapter pick, 1…waves waves, waves + 1 boss, waves + 2 recap. */
  wave: number;
  /** Waves before the boss: 3, or 4 when Ink Storm is on. */
  waves: number;
  ink: boolean;
  /** Ink Storm can be switched on (the content has stroke references). */
  inkAvailable: boolean;
  /** Ink Storm: the latest drawings, for the stage's replay. */
  inks: InkShow[];
  waveInfo: { title: string; titleJa: string; titleKana: string; how: string } | null;
  at: number;
  /** The chapter list (intro only). */
  chapters: ChapterInfo[];
  /** Who studied what, and who's ready (public: chapters aren't secret). */
  picks: { playerId: string; chapters: number[]; ready: boolean }[];
  horde: YokaiView[];
  combo: { count: number; players: number; lastAt: number; best: number };
  waveResult: WaveResult | null;
  boss: {
    word: string;
    en: string;
    pieces: { char: string; broken: boolean; owner: string | null; by: string | null }[];
    stage: 'break' | 'blow';
    readers: string[];
    defeated: boolean;
    defeatedAt: number | null;
  } | null;
  /** The raid's own recap (encore): what the team met tonight. */
  summary: {
    correct: { char: string; n: number }[];
    haunted: string[];
    defeated: number;
    escaped: number;
    bestCombo: number;
    bossDefeated: boolean;
  } | null;
  placeholder: boolean;
  me: {
    chapters: number[];
    ready: boolean;
    /** Waves 1–2: you can pick which yōkai to attack ({ kind: 'aim', yokaiId }); these are yours to pick from. */
    canAim: boolean;
    aimable: string[];
    attack: AttackView | null;
    last: LastResult | null;
    /** A say you moved on from, scored once the phone's speech check came back. */
    said: LastResult | null;
    hits: number;
    misses: number;
    /** Ink Storm's vision second look on the latest drawing. */
    coach: { char: string; tip: string } | null;
    recap: {
      seen: string[];
      correct: string[];
      haunted: { char: string; hear: string; tip: string | null }[];
    } | null;
  } | null;
}

// ---------- the deck, memoised per content library ----------

const decks = new WeakMap<ContentLibrary, Deck>();
function deckOf(ctx: ModeContext): Deck {
  let d = decks.get(ctx.content);
  if (!d) decks.set(ctx.content, (d = buildDeck(ctx.content)));
  return d;
}

// ---------- the mode ----------

/** Kana Yōkai Raid as it plays outside the Green Car. */
export const kanaYokaiRaidMode: Mode<RaidState, KanaRaidView> = {
  info: {
    id: 'kana-raid',
    title: 'Kana Yōkai Raid',
    titleJa: 'かな妖怪レイド',
    titleKana: 'かなようかいレイド',
    blurb: 'Kana-shaped yōkai invade the studio. Shout their sounds to catch them.',
    host: 'fude',
    phaseLabels: { intro: 'Choose your kana', prompt: 'Next wave', answer: 'Raid!', reveal: 'Wave over', score: 'Points', finale: 'Boss', encore: 'Tonight’s haul' },
    minPlayers: 1,
    maxPlayers: 8,
    roundChoices: [],
    usesPack: false,
  },

  setup(ctx, opts) {
    const deck = deckOf(ctx);
    const first = deck.chapters[0]?.number ?? 1;
    const players: Record<string, PlayerRaid> = {};
    for (const p of ctx.players()) players[p.id] = newPlayer([first]);
    // Ink Storm is on unless the VIP starts with { ink: false } (or turns it off at the chapter pick).
    const inkAvailable = deck.strokes.size > 0;
    const ink = inkAvailable && opts.extra?.ink !== false;
    return {
      wave: 0,
      waves: ink ? INK_WAVE : WAVES,
      ink,
      inkAvailable,
      inks: [],
      at: ctx.now,
      chapters: [...deck.chapters],
      players,
      horde: [],
      combo: { count: 0, players: [], lastAt: 0, best: 0 },
      waveEndsAt: 0,
      waveResult: null,
      boss: null,
      escaped: [],
      lastCueAt: -1e15,
      placeholder: deck.placeholder,
      defeatedTotal: 0,
      bestCombo: 0,
    };
  },

  next(s, from) {
    switch (from) {
      case 'intro':
        return 'prompt';
      case 'prompt':
        return 'answer';
      case 'answer':
        return 'reveal';
      case 'reveal':
        return 'score';
      case 'score':
        return s.wave < s.waves ? 'prompt' : 'finale';
      case 'finale':
        return 'encore';
      default:
        return 'recap';
    }
  },

  enter(s, phase, ctx) {
    s.at = ctx.now;
    const deck = deckOf(ctx);
    if (phase === 'intro') cue(s, ctx, 'intro', true);
    if (phase === 'prompt') {
      s.wave += 1;
      s.waveResult = null;
      s.horde = [];
      s.inks = [];
      s.combo = { count: 0, players: [], lastAt: 0, best: 0 };
      for (const p of Object.values(s.players)) {
        p.wave = { base: 0, bonus: 0, lost: 0, hits: 0, misses: 0, spoken: 0 };
        p.last = null;
        p.said = null;
        p.pendingSays = [];
        p.retryNext = null;
      }
      cue(s, ctx, 'raid_wave_start', true);
    }
    if (phase === 'answer') {
      buildHorde(s, ctx, deck);
      for (const id of seatedIds(s, ctx)) assignAttack(s, id, ctx, deck);
    }
    if (phase === 'finale') {
      s.wave = s.waves + 1;
      s.horde = [];
      s.combo = { count: 0, players: [], lastAt: 0, best: 0 };
      for (const p of Object.values(s.players)) {
        p.wave = { base: 0, bonus: 0, lost: 0, hits: 0, misses: 0, spoken: 0 };
        p.last = null;
        p.said = null;
        p.pendingSays = [];
        p.retryNext = null;
      }
      buildBoss(s, ctx, deck);
      for (const id of seatedIds(s, ctx)) assignAttack(s, id, ctx, deck);
      cue(s, ctx, 'raid_boss', true);
    }
    if (phase === 'encore') {
      s.wave = s.waves + 2;
      const caught = Object.values(s.players).some((p) => p.stats.hits > 0);
      cue(s, ctx, caught ? 'raid_catch' : 'encore_cheer', true);
    }
  },

  leave(s, phase, ctx) {
    s.at = ctx.now;
    if (phase === 'intro') {
      for (const p of Object.values(s.players)) p.top = Math.max(...p.chapters);
    }
    if (phase === 'answer') {
      sweep(s, ctx);
      // Whoever is still on the stage when the wave ends slips away.
      escapeRest(s, ctx.now);
      for (const p of Object.values(s.players)) {
        p.attack = null;
        p.coach = null;
        p.inkAsks = [];
      }
      s.waveResult = {
        wave: s.wave,
        total: s.horde.length,
        defeated: s.horde.filter((y) => y.state === 'defeated').length,
        escaped: s.horde.filter((y) => y.state === 'escaped').length,
        escapedChars: [...new Set(s.horde.filter((y) => y.state === 'escaped').map((y) => y.char))],
        bestCombo: s.combo.best,
        players: seatedIds(s, ctx).map((id) => {
          const w = s.players[id]!.wave;
          return { playerId: id, hits: w.hits, misses: w.misses, points: w.base + w.bonus - w.lost, bonus: w.bonus };
        }),
      };
    }
    if (phase === 'finale') {
      for (const p of Object.values(s.players)) p.attack = null;
      const b = s.boss;
      if (b?.defeated) {
        for (const id of seatedIds(s, ctx)) {
          const helped = b.pieces.some((x) => x.by === id) || (b.reads[id] && b.reads[id] !== 'pass');
          if (helped) {
            ctx.award(id, BOSS_BONUS);
            s.players[id]!.wave.base += BOSS_BONUS;
          }
        }
      }
      if (b) {
        for (const id of seatedIds(s, ctx)) {
          ctx.phrase(id, { itemId: `boss:${b.id}`, text: b.word.text, kana: b.word.kana, en: b.word.en, outcome: b.reads[id] === 'spoken' ? 'said' : b.reads[id] === 'missed' ? 'missed' : 'seen', recall: 'memory' });
        }
      }
    }
  },

  duration(s, phase, ctx) {
    if (phase === 'answer') return Math.max(10_000, s.waveEndsAt - ctx.now);
    return DURATIONS[phase];
  },

  done(s, phase, ctx) {
    const here = ctx.connected().filter((p) => s.players[p.id]);
    if (here.length === 0) return false;
    if (phase === 'intro') return here.every((p) => s.players[p.id]!.ready);
    if (phase === 'answer') return s.horde.length > 0 && s.horde.every((y) => y.state !== 'alive' || y.escapeAt <= ctx.now);
    if (phase === 'finale') return !!s.boss && s.boss.stage === 'blow' && here.every((p) => s.boss!.reads[p.id] !== undefined);
    return false;
  },

  move(s, phase, playerId, raw, ctx) {
    const p = s.players[playerId];
    if (!p) return moveError('not-playing');
    if (!isObject(raw)) return moveError('bad-move');
    switch (raw.kind) {
      case 'chapters': {
        if (phase !== 'intro') return moveError('wrong-phase');
        if (!Array.isArray(raw.chapters) || raw.chapters.length > 20) return moveError('bad-chapters');
        const valid = new Set(s.chapters.map((c) => c.number));
        const picked = [...new Set(raw.chapters)].filter((n): n is number => typeof n === 'number' && valid.has(n)).sort((a, b) => a - b);
        if (picked.length === 0 || picked.length !== new Set(raw.chapters).size) return moveError('bad-chapters');
        p.chapters = picked;
        p.top = Math.max(...picked);
        s.at = ctx.now;
        return MOVE_OK;
      }
      case 'ready': {
        if (phase !== 'intro') return moveError('wrong-phase');
        p.ready = raw.ready !== false;
        s.at = ctx.now;
        return MOVE_OK;
      }
      case 'ink': {
        // The VIP switches Ink Storm on or off at the chapter pick.
        if (phase !== 'intro') return moveError('wrong-phase');
        if (playerId !== ctx.vipId) return moveError('not-vip');
        if (typeof raw.on !== 'boolean') return moveError('bad-move');
        if (raw.on && !s.inkAvailable) return moveError('no-ink');
        s.ink = raw.on;
        s.waves = s.ink ? INK_WAVE : WAVES;
        s.at = ctx.now;
        return MOVE_OK;
      }
      case 'ink-tip': {
        // The server's vision second look on a drawing (server/src/ink.ts). Only the server
        // knows the key: it never leaves the mode state.
        const ask = typeof raw.key === 'string' ? p.inkAsks.find((x) => x.key === raw.key) : undefined;
        const tip = cleanText(raw.tip, 140);
        if (!ask || !tip) return moveError('bad-move');
        p.inkAsks = p.inkAsks.filter((x) => x !== ask);
        // The look is slow: if the player has drawn or said something since, the tip is about
        // an older kana and would read as a verdict on the one in front of them, so drop it.
        if (p.last?.attackId !== ask.attackId) return MOVE_OK;
        p.coach = { attackId: ask.attackId, char: ask.char, tip, at: ctx.now };
        s.at = ctx.now;
        return MOVE_OK;
      }
      case 'aim': {
        // Waves 1–2: attack this yōkai instead (it must be on stage and one of your kana).
        if (phase !== 'answer' || !canAimWave(s)) return moveError('wrong-phase');
        sweep(s, ctx);
        const y = typeof raw.yokaiId === 'string' ? s.horde.find((x) => x.id === raw.yokaiId) : undefined;
        if (!y || y.spawnAt > ctx.now) return moveError('gone');
        // Caught or got away a moment before the tap landed: keep the attack you have.
        if (!isAlive(y, ctx.now)) return MOVE_OK;
        const deck = deckOf(ctx);
        if (!poolFor(deck, p.chapters).some((k) => k.id === y.itemId)) return moveError('not-yours');
        if (p.attack?.yokaiId === y.id) return MOVE_OK;
        // Picking a new target drops a pending retry: the one you missed stays on the haunted list.
        p.retryNext = null;
        if (p.last) p.last = { ...p.last, retryNext: false };
        if (p.attack) p.replaced = [...p.replaced.slice(-4), p.attack.id];
        p.attack = waveAttack(s, playerId, p, ctx, deck, y);
        s.at = ctx.now;
        return MOVE_OK;
      }
      case 'attack': {
        if (phase !== 'answer' && phase !== 'finale') return moveError('wrong-phase');
        if (p.attack?.id !== raw.attackId) {
          const later = settleLater(s, playerId, p, raw.attackId, raw, ctx, deckOf(ctx));
          if (later) return later;
        }
        const a = p.attack;
        if (!a) return moveError(typeof raw.attackId === 'string' && p.replaced.includes(raw.attackId) ? 'wrong-phase' : 'no-attack');
        if (raw.attackId !== a.id) return moveError(typeof raw.attackId === 'string' && p.replaced.includes(raw.attackId) ? 'wrong-phase' : 'stale-attack');
        const answer = readAnswer(raw);
        if (!answer) return moveError('bad-answer');
        s.at = ctx.now;
        sweep(s, ctx);
        return attack(s, playerId, p, a, answer, ctx, deckOf(ctx));
      }
      default:
        return moveError('bad-move');
    }
  },

  release(s, playerId) {
    delete s.players[playerId];
    if (s.boss) {
      for (const piece of s.boss.pieces) if (piece.owner === playerId) piece.owner = null;
      delete s.boss.reads[playerId];
    }
  },

  progress(s) {
    return { round: Math.min(s.wave, s.waves + 1), totalRounds: s.waves + 1 };
  },

  view(s, phase, viewer, ctx) {
    const inBattle = phase === 'answer' || phase === 'reveal';
    const aimedBy = new Map<string, string[]>();
    if (phase === 'answer' && canAimWave(s)) {
      for (const [id, p] of Object.entries(s.players)) {
        const y = p.attack?.yokaiId;
        if (y) aimedBy.set(y, [...(aimedBy.get(y) ?? []), id]);
      }
    }
    const b = s.boss;
    const name = (id: string | null) => (id ? (ctx.player(id)?.name ?? null) : null);
    const ids = seatedIds(s, ctx);
    const view: KanaRaidView = {
      mode: 'kana-raid',
      wave: s.wave,
      waves: s.waves,
      ink: s.ink,
      inkAvailable: s.inkAvailable,
      inks: inBattle && isInkWave(s) ? s.inks : [],
      waveInfo: waveInfoOf(s),
      at: s.at,
      chapters: phase === 'intro' ? s.chapters : [],
      picks: ids.map((id) => ({ playerId: id, chapters: s.players[id]!.chapters, ready: s.players[id]!.ready })),
      horde: inBattle ? s.horde.map((y) => yokaiView(y, aimedBy)) : [],
      combo: { count: s.combo.count, players: s.combo.players.length, lastAt: s.combo.lastAt, best: s.combo.best },
      waveResult: phase === 'reveal' || phase === 'score' ? s.waveResult : null,
      boss:
        b && (phase === 'finale' || phase === 'encore')
          ? {
              word: b.word.text,
              en: b.word.en,
              pieces: b.pieces.map((x) => ({ char: x.char, broken: !!x.by, owner: name(x.owner), by: name(x.by) })),
              stage: b.stage,
              readers: Object.entries(b.reads).filter(([, r]) => r === 'spoken' || r === 'typed').map(([id]) => id),
              defeated: b.defeated,
              defeatedAt: b.defeatedAt,
            }
          : null,
      summary: phase === 'encore' ? summary(s) : null,
      placeholder: s.placeholder,
      me: null,
    };
    if (viewer.kind === 'player') {
      const p = s.players[viewer.playerId];
      if (p) {
        const live = phase === 'answer' || phase === 'finale';
        const canAim = phase === 'answer' && canAimWave(s);
        const mine = canAim ? new Set(poolFor(deckOf(ctx), p.chapters).map((k) => k.id)) : null;
        view.me = {
          chapters: p.chapters,
          ready: p.ready,
          canAim,
          aimable: mine ? s.horde.filter((y) => y.state === 'alive' && mine.has(y.itemId)).map((y) => y.id) : [],
          attack: live && p.attack ? attackView(p.attack) : null,
          last: live ? p.last : null,
          said: live ? (p.said ?? null) : null,
          hits: p.stats.hits,
          misses: p.stats.misses,
          coach: live && p.coach && p.coach.attackId === p.last?.attackId ? { char: p.coach.char, tip: p.coach.tip } : null,
          recap: phase === 'encore' ? playerRecap(p) : null,
        };
      }
    }
    return view;
  },

  practice(s, playerId) {
    const p = s.players[playerId];
    if (!p) return [];
    // One card per kana: the same kana met as a horde yōkai and as a boss piece adds up.
    const out = new Map<string, PracticeItem>();
    for (const t of Object.values(p.tally)) {
      // ー and ッ have no sound of their own (tap questions), so they can't be reviewed by sound.
      if (!t.card || MARK_OPTIONS[t.char]) continue;
      const item = out.get(t.card.id) ?? { itemId: t.card.id, char: t.char, hear: t.hear, en: t.card.en, seen: 0, recalled: 0, missed: 0 };
      item.seen += t.seen;
      item.recalled += t.recalled;
      item.missed += t.missed;
      out.set(t.card.id, item);
    }
    return [...out.values()];
  },

  awards(s, ctx) {
    const ids = seatedIds(s, ctx);
    const out: Award[] = [];
    const named = (awardId: string, fallback: { text: string; en: string }) => {
      const a = ctx.content.hostAwards.find((x) => x.id === awardId);
      return a ? { text: a.name.text, en: a.name.en } : fallback;
    };
    const give = (awardId: string, fallback: { text: string; en: string }, score: (p: PlayerRaid) => number) => {
      let best: string | null = null;
      let bestScore = 0;
      for (const id of ids) {
        const v = score(s.players[id]!);
        if (v > bestScore) [best, bestScore] = [id, v];
      }
      const pl = best ? ctx.player(best) : undefined;
      if (!pl) return;
      const n = named(awardId, fallback);
      out.push({ playerId: pl.id, name: pl.name, title: n.text, en: n.en });
    };
    give('fude.award.page-hunter', { text: 'ページ ハンター', en: 'Page Hunter' }, (p) => Object.values(p.tally).filter((t) => t.correct > 0).length);
    give('fude.award.combo-champion', { text: 'コンボ チャンピオン', en: 'Combo Champion' }, (p) => p.stats.comboHits);
    give('fude.award.battle-cry', { text: 'おおごえ賞', en: 'Battle Cry' }, (p) => p.stats.shoutsSpoken);
    give('fude.award.boss-breaker', { text: 'ボス ブレイカー', en: 'Boss Breaker' }, (p) => p.stats.pieces);
    give('fude.award.exorcist', { text: 'おはらい マスター', en: 'Exorcist' }, (p) => p.stats.comebacks);
    return out;
  },
};

/**
 * The menu's Kana Yōkai Raid: the kana raid above, or, when the game starts in a Green Car room, Katsuyō Raid
 * (katsuyoRaid.ts), its N4/N3 version on the same battle engine (raidCore.ts).
 */
export const kanaRaidMode = greenCarSwitch(kanaYokaiRaidMode, katsuyoRaidMode);

// ---------- helpers ----------

function newPlayer(chapters: number[]): PlayerRaid {
  return {
    chapters,
    ready: false,
    top: Math.max(...chapters),
    attack: null,
    replaced: [],
    last: null,
    retryNext: null,
    tally: {},
    wave: { base: 0, bonus: 0, lost: 0, hits: 0, misses: 0, spoken: 0 },
    stats: { hits: 0, misses: 0, shoutsSpoken: 0, comboHits: 0, pieces: 0, defeats: 0, comebacks: 0, reads: 0, inkClean: 0 },
    inkAsks: [],
    pendingSays: [],
    said: null,
    coach: null,
  };
}

/** Players still seated who are in the raid, by seat. */
function seatedIds(s: RaidState, ctx: ModeContext): string[] {
  return ctx.players().filter((p) => s.players[p.id]).map((p) => p.id);
}

const cue = cueRaid;

function yokaiView(y: Yokai, aimedBy: Map<string, string[]>): YokaiView {
  const aimers = aimedBy.get(y.id);
  return {
    ...(aimers?.length && y.state === 'alive' ? { aimedBy: aimers } : {}),
    id: y.id,
    // An ink yōkai shows only its mask: its true form is the answer.
    char: y.mask ?? y.char,
    ...(y.alt ? { alt: y.alt } : {}),
    hp: y.hp,
    maxHp: y.maxHp,
    spawnAt: y.spawnAt,
    escapeAt: y.escapeAt,
    state: y.state,
    endedAt: y.endedAt,
    hitAt: y.hitAt,
    ...(y.leader ? { leader: y.leader } : {}),
    ...(y.caughtBy ? { caughtBy: y.caughtBy, caughtPoints: y.caughtPoints ?? 0 } : {}),
  };
}

function attackView(a: Attack): AttackView {
  const { answer: _a, played: _p, pieceIndex: _i, itemId: _id, ...rest } = a;
  // The word to say is the answer while the player still has to pick it by ear (or draw it).
  if ((a.kind === 'pair' && a.step === 'tap') || (a.kind === 'draw' && a.step === 'draw')) delete rest.word;
  return rest;
}

function summary(s: RaidState): NonNullable<KanaRaidView['summary']> {
  const correct = new Map<string, number>();
  const haunted = new Set<string>(s.escaped.map((e) => e.char));
  for (const p of Object.values(s.players)) {
    for (const t of Object.values(p.tally)) {
      if (t.correct > 0) correct.set(t.char, (correct.get(t.char) ?? 0) + t.correct);
      if (t.missed > 0) haunted.add(t.char);
    }
  }
  return {
    correct: [...correct].map(([char, n]) => ({ char, n })).sort((a, b) => b.n - a.n),
    haunted: [...haunted],
    defeated: s.defeatedTotal,
    escaped: s.escaped.length,
    bestCombo: s.bestCombo,
    bossDefeated: !!s.boss?.defeated,
  };
}

function playerRecap(p: PlayerRaid): NonNullable<NonNullable<KanaRaidView['me']>['recap']> {
  const all = Object.values(p.tally);
  return {
    seen: all.map((t) => t.char),
    correct: all.filter((t) => t.correct > 0).map((t) => t.char),
    haunted: all.filter((t) => t.missed > 0).map((t) => ({ char: t.char, hear: t.hear, tip: t.tip })),
  };
}

/** `pending`: the player spoke and the phone is still checking the recording (say steps only). */
type Answer = { pick: string } | { say: Utterance } | { pass: true } | { ink: InkPoint[][] } | { pending: true };

function readAnswer(raw: Record<string, unknown>): Answer | null {
  if (raw.ink !== undefined) {
    const ink = readInk(raw.ink);
    return ink ? { ink } : null;
  }
  if (typeof raw.pick === 'string' && raw.pick.length <= 8) return { pick: raw.pick };
  if (isUtterance(raw.say)) return { say: raw.say };
  if (raw.pass === true) return { pass: true };
  if (raw.pending === true) return { pending: true };
  return null;
}

const texts = (u: Utterance): string[] => [u.reading, u.text].filter((t): t is string => !!t);

// ---------- the horde ----------

function buildHorde(s: RaidState, ctx: ModeContext, deck: Deck): void {
  const ids = seatedIds(s, ctx);
  const n = ids.length || 1;
  const timing = WAVE_TIMING[s.wave] ?? WAVE_TIMING[1]!;
  const ink = isInkWave(s);
  // Hits to knock one out: 1 solo, 2 for 2–3 players, 3 for 4–6, 4 for 7–8 (one fewer in Ink Storm).
  const hits = Math.max(1, (n === 1 ? 1 : 1 + Math.ceil(n / 3)) - (ink ? 1 : 0));
  const count = s.wave === 3 ? Math.min(10, 3 + n) : ink ? Math.min(12, 3 + n) : Math.min(18, 5 + 2 * n);
  const recent: string[] = [];
  const horde: Yokai[] = [];
  let t = ctx.now + 1_200;

  for (let i = 0; i < count; i++) {
    const owner = s.players[ids[i % n] ?? ''] ?? newPlayer([1]);
    let itemId: string;
    let char: string;
    let alt: string | undefined;
    let mask: string | undefined;
    if (ink) {
      const pool = inkPoolFor(deck, owner.chapters);
      const fresh = pool.filter((k) => !recent.includes(k.id));
      const k = pick(fresh.length ? fresh : pool, ctx.random)!;
      itemId = k.id;
      char = k.char;
      mask = (k.twinId ? deck.byId.get(k.twinId)?.char : undefined) ?? inOtherScript(k.sound, k.script);
    } else if (s.wave === 3) {
      const pairs = pairsFor(deck, owner.top);
      const fresh = pairs.filter((x) => !recent.includes(x.id));
      const pair = pick(fresh.length ? fresh : pairs, ctx.random)!;
      itemId = pair.id;
      char = pair.a.kana;
      alt = pair.b.kana;
    } else {
      const pool = poolFor(deck, owner.chapters);
      const shifters = s.wave === 2 ? pool.filter((k) => lookAlikeFor(deck, k, pool)) : [];
      const from = shifters.length && ctx.random() < 0.6 ? shifters : pool;
      const fresh = from.filter((k) => !recent.includes(k.id));
      const k = pick(fresh.length ? fresh : from, ctx.random)!;
      itemId = k.id;
      char = k.char;
    }
    recent.push(itemId);
    if (recent.length > 3) recent.shift();
    const walk = Math.round(timing.walk * (0.9 + 0.2 * ctx.random()));
    horde.push({ id: ctx.newId(), itemId, char, ...(alt ? { alt } : {}), ...(mask ? { mask } : {}), hp: BASE_POINTS * hits, maxHp: BASE_POINTS * hits, spawnAt: t, escapeAt: t + walk, state: 'alive', endedAt: null, hitAt: null });
    t += Math.round(timing.gap * (0.8 + 0.4 * ctx.random()));
  }

  // The last kana yōkai is the chapter leader: twice as tough.
  const last = horde.at(-1);
  if (last && s.wave !== 3) {
    const top = Math.max(...ids.map((id) => s.players[id]!.top), 1);
    const leader = [...s.chapters].reverse().find((c) => c.number <= top && c.leader)?.leader;
    if (leader) {
      last.leader = leader.text;
      last.hp = last.maxHp = last.maxHp * 2;
    }
  }
  s.horde = horde;
  s.waveEndsAt = Math.max(...horde.map((y) => y.escapeAt)) + 1_000;
}

/** A look-alike set for `k` with at least two members the player has studied, all different sounds. */
function lookAlikeFor(deck: Deck, k: Kana, pool: readonly Kana[]) {
  const ids = new Set(pool.map((x) => x.id));
  return deck.lookAlikes.find((set) => {
    if (!set.kanaIds.includes(k.id)) return false;
    const members = set.kanaIds.filter((id) => ids.has(id)).map((id) => deck.byId.get(id)!);
    const sounds = new Set(members.map((m) => m.sound));
    return members.length >= 2 && sounds.size === members.length;
  });
}

// ---------- attacks ----------

function assignAttack(s: RaidState, playerId: string, ctx: ModeContext, deck: Deck): void {
  const p = s.players[playerId];
  if (!p) return;
  if (p.attack) p.replaced = [...p.replaced.slice(-4), p.attack.id];
  p.attack = s.wave > s.waves ? bossAttack(s, playerId, ctx, deck) : waveAttack(s, playerId, p, ctx, deck);
}

function waveAttack(s: RaidState, playerId: string, p: PlayerRaid, ctx: ModeContext, deck: Deck, aimed?: Yokai): Attack | null {
  const now = ctx.now;
  const retry = aimed ? null : p.retryNext;
  p.retryNext = null;
  const ink = isInkWave(s);
  const poolIds = new Set(s.wave === 3 ? pairsFor(deck, p.top).map((x) => x.id) : (ink ? inkPoolFor : poolFor)(deck, p.chapters).map((k) => k.id));
  let itemId: string | undefined = aimed?.itemId ?? retry?.itemId;
  let yokai: Yokai | undefined = aimed;
  if (aimed) {
    // The player picked it.
  } else if (itemId) yokai = s.horde.find((y) => y.itemId === itemId && isAlive(y, now));
  else {
    const targeted = new Map<string, number>();
    for (const [id, other] of Object.entries(s.players)) if (id !== playerId && other.attack?.yokaiId) targeted.set(other.attack.yokaiId, (targeted.get(other.attack.yokaiId) ?? 0) + 1);
    const mine = s.horde.filter((y) => isAlive(y, now) && poolIds.has(y.itemId));
    // Only yōkai you can see: on stage, closest to the gate first. With the stage empty, the
    // next one walks on now, so a hit never lands on a yōkai nobody has seen yet.
    const onStage = mine.filter((y) => y.spawnAt <= now).sort((a, b) => along(b, now) - along(a, now));
    const next = mine.filter((y) => y.spawnAt > now).sort((a, b) => a.spawnAt - b.spawnAt)[0];
    const front = onStage.length ? onStage.slice(0, 3) : next ? [next] : [];
    front.sort((a, b) => (targeted.get(a.id) ?? 0) - (targeted.get(b.id) ?? 0));
    yokai = front[0];
    itemId = yokai?.itemId ?? pick([...poolIds], ctx.random);
  }
  if (yokai && yokai.spawnAt > now) bringOn(s, yokai, now);
  if (!itemId) return null;
  const base = { id: ctx.newId(), yokaiId: yokai?.id ?? null, itemId, retry: !!retry };

  if (s.wave === 3) {
    const pair = deck.pairs.find((x) => x.id === itemId);
    return pair ? pairAttack(base, pair, ctx, !!ctx.player(playerId)?.soundOff) : null;
  }
  const k = deck.byId.get(itemId);
  if (!k) return null;
  if (ink) return drawAttack(base, k, deck, ctx.player(playerId)?.level === 'kana');
  const pool = poolFor(deck, p.chapters);
  let kind: AttackKind;
  if (retry) kind = retry.kind;
  else if (s.wave === 1) kind = k.twinId && deck.byId.has(k.twinId) && ctx.random() < 0.35 ? 'twin' : 'shout';
  else kind = lookAlikeFor(deck, k, pool) && ctx.random() < 0.6 ? 'lookalike' : 'echo';
  // Sound off: Echo is all voices, and writing them out would give it away, so a reading attack takes its place.
  if (kind === 'echo' && ctx.player(playerId)?.soundOff) kind = lookAlikeFor(deck, k, pool) ? 'lookalike' : k.twinId && deck.byId.has(k.twinId) ? 'twin' : 'shout';
  return kanaAttack(base, kind, k, pool, deck, s.wave, ctx);
}

type AttackBase = Pick<Attack, 'id' | 'yokaiId' | 'itemId' | 'retry'>;

const ECHO_LABELS = ['①', '②', '③', '④'];

function kanaAttack(base: AttackBase, kind: AttackKind, k: Kana, pool: Kana[], deck: Deck, wave: number, ctx: ModeContext): Attack {
  const sameScript = (script: Kana['script']) => pool.filter((x) => x.script === script);
  const romaji = wave === 1 && k.chapter === 1 ? { romaji: romajiHint(k) } : {};
  const hear = k.sound;
  const hearText = inOtherScript(k.sound, k.script);

  if (kind === 'twin') {
    const twin = deck.byId.get(k.twinId!)!;
    const mates = deck.lookAlikes.filter((x) => x.kanaIds.includes(twin.id)).flatMap((x) => x.kanaIds).map((id) => deck.byId.get(id)!).filter((x) => x.script === twin.script);
    const wrong = distinct(mates, sameScript(twin.script), 3, (x) => x.sound, new Set([twin.sound]), ctx);
    const { options, answer } = dealOptions({ label: twin.char }, wrong.map((x) => ({ label: x.char })), ctx);
    return { ...base, kind, show: k.char, hear, options, answer, ...romaji };
  }
  // Wave 2 shows the yōkai's own kana (the player may have picked it on the TV, so the kana
  // can't be the answer): say which sound it really makes.
  if (kind === 'lookalike') {
    // Shapeshifter: the choices are the sounds of the kana it's easily mistaken for, written in the other script.
    const set = lookAlikeFor(deck, k, pool)!;
    const inPool = new Set(pool.map((x) => x.id));
    const preferred = set.kanaIds.filter((id) => inPool.has(id)).map((id) => deck.byId.get(id)!);
    const wrong = distinct(preferred, sameScript(k.script), 3, (x) => x.sound, new Set([k.sound]), ctx);
    const { options, answer } = dealOptions({ label: hearText }, wrong.map((x) => ({ label: inOtherScript(x.sound, k.script) })), ctx);
    return { ...base, kind, show: k.char, hearText, options, answer };
  }
  if (kind === 'echo') {
    // Echo: four voices, one is its own. Each choice plays its sound; nothing is written.
    const confusions = new Set(k.confusableSounds ?? []);
    const preferred = sameScript(k.script).filter((x) => confusions.has(x.sound)).map((x) => x.sound);
    const wrong = distinct([...preferred, ...(k.confusableSounds ?? [])], pool.map((x) => x.sound), 3, (x) => x, new Set([k.sound]), ctx);
    const dealt = dealOptions({ label: '', hear: k.sound }, wrong.map((x) => ({ label: '', hear: x })), ctx);
    const options = dealt.options.map((o, i) => ({ ...o, label: ECHO_LABELS[i] ?? String(i + 1) }));
    return { ...base, kind, show: k.char, hearText, options, answer: dealt.answer };
  }
  // Shout: say it; the four sounds (in the other script) are the quiet fallback.
  const others = pool.map((x) => x.sound);
  const wrong = distinct(k.confusableSounds ?? [], others, 3, (x) => x, new Set([k.sound]), ctx);
  const { options, answer } = dealOptions({ label: hearText }, wrong.map((x) => ({ label: inOtherScript(x, k.script) })), ctx);
  return { ...base, kind: 'shout', show: k.char, hear, options, answer, ...romaji };
}

/**
 * Ink Storm: draw the kana. The phone shows its twin (the mask the yōkai wears) and the
 * script to draw it in, voices the sound, and adds romaji for kana-level players and chapter 1
 * (the answer is a drawing, so romaji gives nothing away).
 */
function drawAttack(base: AttackBase, k: Kana, deck: Deck, kanaLevel: boolean): Attack {
  const twin = k.twinId ? deck.byId.get(k.twinId) : undefined;
  const hearText = inOtherScript(k.sound, k.script);
  return {
    ...base,
    kind: 'draw',
    step: 'draw',
    script: k.script,
    show: twin?.char ?? hearText,
    hear: k.sound,
    hearText,
    options: [],
    answer: '',
    word: { text: k.char, kana: k.sound, en: '' },
    ...(kanaLevel || k.chapter === 1 ? { romaji: k.romaji } : {}),
  };
}

/**
 * Wave 3: hear one word of a minimal pair, tap which. With sound off it's read instead: the meaning is the
 * clue and the two spellings are the choices (おばさん or おばあさん for "grandmother"), so it still turns on
 * the one mark that differs.
 */
function pairAttack(base: AttackBase, pair: MinimalPair, ctx: ModeContext, soundOff = false): Attack {
  const played: 'a' | 'b' = ctx.random() < 0.5 ? 'a' : 'b';
  const opts = shuffled(['a', 'b'] as const, ctx.random).map((id) => (soundOff ? { id, label: pair[id].kana } : { id, label: pair[id].kana, sub: pair[id].en }));
  const read = soundOff ? { clue: pair[played].en } : { hear: pair[played].kana, hearText: pair[played].kana };
  return { ...base, kind: 'pair', step: 'tap', ...read, options: opts, answer: played, played, word: pair[played] };
}

// ---------- the boss ----------

function buildBoss(s: RaidState, ctx: ModeContext, deck: Deck): void {
  const ids = seatedIds(s, ctx);
  const knows = (id: string, char: string) => {
    const k = deck.byChar.get(char);
    return !k || s.players[id]!.chapters.includes(k.chapter);
  };
  // Only words where every piece is one somebody here has studied; the more players with a piece
  // of their own the better, then the hardest such words. A room with nothing that fits gets the
  // easiest word there is.
  const readable = deck.bosses.filter((b) => b.pieces.every((c) => ids.some((id) => knows(id, c))));
  const reach = (b: BossWord) => ids.filter((id) => b.pieces.some((c) => knows(id, c))).length;
  const lowest = Math.min(...deck.bosses.map((b) => b.minChapter));
  const fit = readable.length ? readable : deck.bosses.filter((b) => b.minChapter === lowest);
  const best = Math.max(...fit.map((b) => Math.min(reach(b), b.pieces.length)));
  const roomy = fit.filter((b) => Math.min(reach(b), b.pieces.length) === best);
  const choices = [...roomy].sort((a, b) => b.minChapter - a.minChapter || b.pieces.length - a.pieces.length).slice(0, 4);
  const word = pick(choices, ctx.random)!;
  const load = new Map(ids.map((id) => [id, 0]));
  const pieces: BossPiece[] = word.pieces.map((char) => {
    const who = ids.filter((id) => knows(id, char));
    const pool = who.length ? who : ids;
    const fewest = Math.min(...pool.map((id) => load.get(id) ?? 0));
    const owner = pool.find((id) => (load.get(id) ?? 0) === fewest) ?? null;
    if (owner) load.set(owner, (load.get(owner) ?? 0) + 1);
    return { char, sound: pieceSound(deck, char), owner, by: null };
  });
  // Everyone gets a piece where the word is long enough: hand a spare to anyone left out, but
  // only a piece they've studied.
  for (const id of ids) {
    if ((load.get(id) ?? 0) > 0) continue;
    const donor = pieces.find((x) => x.owner && (load.get(x.owner) ?? 0) > 1 && knows(id, x.char));
    if (donor) {
      load.set(donor.owner!, (load.get(donor.owner!) ?? 0) - 1);
      donor.owner = id;
      load.set(id, 1);
    }
  }
  s.boss = { id: word.id, word: word.word, pieces, stage: 'break', reads: {}, defeated: false, defeatedAt: null };
}

function bossAttack(s: RaidState, playerId: string, ctx: ModeContext, deck: Deck): Attack | null {
  const b = s.boss;
  if (!b) return null;
  const base = { id: ctx.newId(), yokaiId: null, retry: false };
  if (b.stage === 'blow') {
    if (b.reads[playerId]) return null;
    return { ...base, itemId: `boss:${b.id}`, kind: 'blow', word: b.word, hear: b.word.kana, options: [], answer: '' };
  }
  const p = s.players[playerId]!;
  const retry = p.retryNext;
  p.retryNext = null;
  let index = b.pieces.findIndex((x) => !x.by && x.owner === playerId);
  if (index < 0) {
    // Done with your own pieces: help with one whose owner left or is stuck (one you've studied).
    const studied = (char: string) => {
      const k = deck.byChar.get(char);
      return !k || p.chapters.includes(k.chapter);
    };
    const open = b.pieces.map((x, i) => ({ x, i })).filter(({ x }) => !x.by && studied(x.char));
    const ownerGone = open.find(({ x }) => !x.owner || !ctx.player(x.owner)?.connected);
    index = (ownerGone ?? open[0])?.i ?? -1;
  }
  if (index < 0) return null;
  const piece = b.pieces[index]!;
  const k = deck.byChar.get(piece.char);
  const mark = MARK_OPTIONS[piece.char];
  const itemId = k?.id ?? `piece:${piece.char}`;
  if (mark) {
    const { options, answer } = dealOptions({ label: mark.right }, mark.wrong.map((label) => ({ label })), ctx);
    return { ...base, itemId, retry: !!retry, kind: 'piece', show: piece.char, options, answer, pieceIndex: index };
  }
  const script = k?.script ?? 'katakana';
  const others = (k ? poolFor(deck, p.chapters) : []).map((x) => x.sound);
  const wrong = distinct(k?.confusableSounds ?? [], others.length >= 3 ? others : deck.kana.filter((x) => x.kind === 'basic').map((x) => x.sound), 3, (x) => x, new Set([piece.sound]), ctx);
  const { options, answer } = dealOptions({ label: inOtherScript(piece.sound, script) }, wrong.map((x) => ({ label: inOtherScript(x, script) })), ctx);
  return {
    ...base,
    itemId,
    retry: !!retry,
    kind: 'piece',
    show: piece.char,
    hear: piece.sound,
    options,
    answer,
    pieceIndex: index,
    ...(k?.chapter === 1 ? { romaji: k.romaji } : {}),
  };
}

// ---------- resolving an attack ----------

function attack(s: RaidState, playerId: string, p: PlayerRaid, a: Attack, ans: Answer, ctx: ModeContext, deck: Deck): MoveResult {
  const k = deck.byId.get(a.itemId);
  switch (a.kind) {
    case 'shout': {
      if (!k) return moveError('bad-attack');
      if ('pick' in ans) return settle(s, playerId, p, a, ans.pick === a.answer, 'quiet', ctx, deck, { kana: k, wrongLabel: a.options.find((o) => o.id === ans.pick)?.label });
      if ('say' in ans) {
        const check = checkSound(texts(ans.say), k, deck, { spoken: ans.say.via === 'speech' });
        return settle(s, playerId, p, a, check.ok, ans.say.via === 'speech' ? 'spoken' : 'quiet', ctx, deck, { kana: k, check, spoke: ans.say.via === 'speech', recalled: true });
      }
      return moveError('bad-answer');
    }
    case 'twin':
    case 'lookalike':
    case 'echo': {
      if (!k || !('pick' in ans)) return moveError('bad-answer');
      const picked = a.options.find((o) => o.id === ans.pick);
      if (!picked) return moveError('bad-answer');
      const label = picked.hear ?? picked.label;
      return settle(s, playerId, p, a, ans.pick === a.answer, 'tap', ctx, deck, { kana: k, wrongLabel: label });
    }
    case 'pair': {
      const pair = deck.pairs.find((x) => x.id === a.itemId);
      if (!pair || !a.played) return moveError('bad-attack');
      if (a.step === 'tap') {
        if (!('pick' in ans) || (ans.pick !== 'a' && ans.pick !== 'b')) return moveError('bad-answer');
        const right = ans.pick === a.played;
        const res = hitOrMiss(s, playerId, p, a, right, 'tap', ctx, { char: pair[a.played].kana, hear: pair[a.played].kana, tip: right ? null : pairTip(pair, a.played), difficulty: chapterDifficulty(pair.minChapter), en: pair[a.played].en, phrase: pair[a.played], phraseId: `pair:${pair.id}:${a.played}` });
        p.last = res;
        // Either way, say the word you heard next: it's the out-loud moment.
        a.step = 'say';
        a.id = ctx.newId();
        return MOVE_OK;
      }
      // Say step
      if ('pending' in ans) return sayLater(s, playerId, p, a, ctx, deck);
      const said = sayPair(s, playerId, p, a, pair, ans, ctx);
      if (!said) return moveError('bad-answer');
      p.last = said;
      assignAttack(s, playerId, ctx, deck);
      return MOVE_OK;
    }
    case 'draw':
      if (!k) return moveError('bad-attack');
      if (a.step !== 'say') return drawSpell(s, playerId, p, a, k, ans, ctx, deck);
      if ('pending' in ans) return sayLater(s, playerId, p, a, ctx, deck);
      return saySpell(s, playerId, p, a, k, ans, ctx, deck);
    case 'piece':
      return pieceAttack(s, playerId, p, a, ans, ctx, deck);
    case 'blow': {
      const b = s.boss;
      if (!b) return moveError('bad-attack');
      if (!('say' in ans) && !('pass' in ans)) return moveError('bad-answer');
      if ('pass' in ans) b.reads[playerId] = 'pass';
      else {
        const ok = checkWord(texts(ans.say), b.word, null);
        const spoken = ans.say.via === 'speech';
        b.reads[playerId] = ok ? (spoken ? 'spoken' : 'typed') : 'missed';
        let points = 0;
        if (ok) {
          const base = BASE_POINTS;
          ctx.award(playerId, base);
          p.wave.base += base;
          points = base + (spoken ? payBonus(p, ctx, playerId, Math.round(base * SPEAK_BONUS)) : 0);
          p.stats.reads += 1;
          if (!b.defeated) {
            b.defeated = true;
            b.defeatedAt = ctx.now;
            cue(s, ctx, 'raid_catch', true);
          }
        }
        p.last = { attackId: a.id, ok, kind: 'blow', char: b.word.text, hear: b.word.kana, points, damage: 0, tip: ok ? null : `It reads ${b.word.kana}: “${b.word.en}”.`, combo: 0, splash: false, retryNext: false };
      }
      p.attack = null;
      return MOVE_OK;
    }
  }
}

interface SettleInfo {
  kana: Kana;
  check?: SoundCheck;
  wrongLabel?: string;
  spoke?: boolean;
  /** Said or typed, not picked from options. */
  recalled?: boolean;
}

/** Settles a kana attack (waves 1 and 2). */
function settle(s: RaidState, playerId: string, p: PlayerRaid, a: Attack, ok: boolean, how: 'spoken' | 'quiet' | 'tap', ctx: ModeContext, deck: Deck, info: SettleInfo): MoveResult {
  const k = info.kana;
  let tip: string | null = null;
  if (!ok) {
    // Twin choices are kana; the other choices are sounds (written, or voiced in Echo).
    const bySound = a.kind !== 'twin';
    const label = info.wrongLabel;
    const wrong = label ? (deck.kana.find((x) => x.script === k.script && (bySound ? sameSound(x.sound, label) : x.char === label)) ?? deck.kana.find((x) => (bySound ? sameSound(x.sound, label) : x.char === label))) : undefined;
    tip = kanaTip(deck, k, wrong && wrong.id !== k.id ? wrong : undefined, info.check);
  }
  if (a.kind === 'shout' && info.spoke) p.stats.shoutsSpoken += 1;
  p.last = hitOrMiss(s, playerId, p, a, ok, how, ctx, { char: k.char, hear: k.sound, tip, difficulty: k.difficulty, en: kanaEn(deck, k), phrase: null, card: k.id, recalled: !!info.recalled });
  assignAttack(s, playerId, ctx, deck);
  return MOVE_OK;
}

function kanaEn(deck: Deck, k: Kana): string {
  const twin = k.twinId ? deck.byId.get(k.twinId) : undefined;
  const chapter = deck.chapters.find((c) => c.number === k.chapter)?.title ?? `Chapter ${k.chapter}`;
  return [k.chapter === 1 ? `“${k.romaji}”` : null, twin ? `twin ${twin.char}` : null, chapter].filter(Boolean).join(' · ');
}

/** Damage scales by level: a first-timer's あ hits as hard as an expert's ヴォ. */
export function levelScale(difficulty: number, playerTop: number): number {
  const top = chapterDifficulty(playerTop);
  return 0.6 + 0.4 * Math.min(1, difficulty / top);
}

interface HitInfo {
  char: string;
  hear: string;
  tip: string | null;
  difficulty: number;
  en: string;
  /** A word to put in the phrasebook instead of the kana, with its phrasebook id. */
  phrase: JpText | null;
  phraseId?: string;
  /** The kana's id, for the saved yōkai card; pair words have none. */
  card?: string;
  recalled?: boolean;
}

function hitOrMiss(s: RaidState, playerId: string, p: PlayerRaid, a: Attack, ok: boolean, how: 'spoken' | 'quiet' | 'tap', ctx: ModeContext, info: HitInfo): LastResult {
  const t = (p.tally[a.itemId] ??= { char: info.char, hear: info.hear, seen: 0, correct: 0, missed: 0, tip: null, recalled: 0, card: info.card ? { id: info.card, en: info.en } : null });
  t.seen += 1;
  const phraseOf = (outcome: 'said' | 'retry' | 'missed' | 'seen') =>
    ctx.phrase(playerId, info.phrase ? { itemId: info.phraseId ?? a.itemId, text: info.phrase.text, kana: info.phrase.kana, en: info.phrase.en, outcome, recall: how === 'spoken' ? 'memory' : 'read' } : { itemId: a.itemId, text: info.char, kana: info.hear, en: info.en, outcome, recall: how === 'spoken' ? 'memory' : 'read' });

  if (!ok) {
    t.missed += 1;
    t.tip = info.tip;
    p.stats.misses += 1;
    p.wave.misses += 1;
    // One retry, then the item moves on (it stays on the haunted list).
    const retryNext = !a.retry && a.kind !== 'pair';
    p.retryNext = retryNext ? { itemId: a.itemId, kind: a.kind } : null;
    phraseOf('missed');
    // A wrong guess costs a little; a drawing isn't a guess.
    const lost = a.kind === 'draw' ? 0 : dock(p, ctx, playerId);
    return { attackId: a.id, ok: false, kind: a.kind, char: info.char, hear: info.hear, points: -lost, damage: 0, tip: info.tip, combo: s.combo.count, splash: false, retryNext };
  }

  const now = ctx.now;
  const scale = levelScale(info.difficulty, p.top);
  const base = Math.round(BASE_POINTS * scale);
  // Team combo, then land it: on the target, or splash onto the yōkai closest to the gate (raidCore.ts).
  const hit = strike(s, playerId, a.yokaiId, how === 'quiet' ? base * QUIET_DAMAGE : base, ctx);
  const { damage, teamCombo, target, splash } = hit;
  if (teamCombo) p.stats.comboHits += 1;
  if (hit.defeated) p.stats.defeats += 1;

  ctx.award(playerId, base);
  p.wave.base += base;
  p.wave.hits += 1;
  p.stats.hits += 1;
  if (t.missed > 0) p.stats.comebacks += 1;
  t.correct += 1;
  if (info.recalled) t.recalled += 1;
  let bonus = 0;
  if (how === 'spoken') {
    bonus = payBonus(p, ctx, playerId, Math.round(base * SPEAK_BONUS));
    p.wave.spoken += 1;
  }
  phraseOf(how === 'spoken' ? 'said' : a.retry ? 'retry' : 'seen');
  if (target?.caughtBy === playerId && target.endedAt === now) target.caughtPoints = base + bonus;
  return { attackId: a.id, ok: true, kind: a.kind, char: info.char, hear: info.hear, points: base + bonus, damage, tip: null, combo: teamCombo ? hit.combo : 0, splash, retryNext: false };
}

function pieceAttack(s: RaidState, playerId: string, p: PlayerRaid, a: Attack, ans: Answer, ctx: ModeContext, deck: Deck): MoveResult {
  const b = s.boss;
  const piece = b?.pieces[a.pieceIndex ?? -1];
  if (!b || !piece) return moveError('bad-attack');
  const k = deck.byChar.get(piece.char);
  let ok: boolean;
  let how: 'spoken' | 'quiet' | 'tap' = 'tap';
  let check: SoundCheck | undefined;
  if ('pick' in ans) {
    if (!a.options.some((o) => o.id === ans.pick)) return moveError('bad-answer');
    ok = ans.pick === a.answer;
    how = MARK_OPTIONS[piece.char] ? 'tap' : 'quiet';
  } else if ('say' in ans) {
    if (MARK_OPTIONS[piece.char]) return moveError('bad-answer');
    check = k ? checkSound(texts(ans.say), k, deck, { spoken: ans.say.via === 'speech' }) : { ok: texts(ans.say).some((t) => sameSound(t, piece.sound)) };
    ok = check.ok;
    how = ans.say.via === 'speech' ? 'spoken' : 'quiet';
  } else return moveError('bad-answer');

  const t = (p.tally[a.itemId] ??= { char: piece.char, hear: piece.sound, seen: 0, correct: 0, missed: 0, tip: null, recalled: 0, card: k ? { id: k.id, en: kanaEn(deck, k) } : null });
  t.seen += 1;
  if (!ok) {
    const tip = MARK_OPTIONS[piece.char] ? `${piece.char} means: ${MARK_OPTIONS[piece.char]!.right.toLowerCase()}.` : k ? kanaTip(deck, k, undefined, check) : `${piece.char} sounds like ${piece.sound}.`;
    t.missed += 1;
    t.tip = tip;
    p.stats.misses += 1;
    p.wave.misses += 1;
    p.retryNext = { itemId: a.itemId, kind: 'piece' };
    if (k) ctx.phrase(playerId, { itemId: k.id, text: k.char, kana: k.sound, en: kanaEn(deck, k), outcome: 'missed' });
    const lost = dock(p, ctx, playerId);
    p.last = { attackId: a.id, ok: false, kind: 'piece', char: piece.char, hear: piece.sound, points: -lost, damage: 0, tip, combo: 0, splash: false, retryNext: true };
  } else {
    const splash = !!piece.by;
    if (!piece.by) piece.by = playerId;
    // The last round is worth double.
    const base = 2 * Math.round(BASE_POINTS * levelScale(k?.difficulty ?? 3, p.top));
    ctx.award(playerId, base);
    p.wave.base += base;
    p.wave.hits += 1;
    p.stats.hits += 1;
    if (!splash) p.stats.pieces += 1;
    t.correct += 1;
    if ('say' in ans) t.recalled += 1;
    const bonus = how === 'spoken' ? payBonus(p, ctx, playerId, Math.round(base * SPEAK_BONUS)) : 0;
    if (k) ctx.phrase(playerId, { itemId: k.id, text: k.char, kana: k.sound, en: kanaEn(deck, k), outcome: how === 'spoken' ? 'said' : 'seen', recall: 'memory' });
    p.last = { attackId: a.id, ok: true, kind: 'piece', char: piece.char, hear: piece.sound, points: base + bonus, damage: base, tip: null, combo: 0, splash, retryNext: false };
    if (!splash) cue(s, ctx, 'raid_hit');
  }
  if (b.pieces.every((x) => x.by)) {
    if (b.stage === 'break') {
      b.stage = 'blow';
      cue(s, ctx, 'kakegoe_call', true);
      for (const id of seatedIds(s, ctx)) assignAttack(s, id, ctx, deck);
    }
  } else assignAttack(s, playerId, ctx, deck);
  return MOVE_OK;
}

// ---------- Ink Storm ----------

/** Grades a drawing and lands it. A pass hits (full damage when clean, softer when messy) and asks to say it. */
function drawSpell(s: RaidState, playerId: string, p: PlayerRaid, a: Attack, k: Kana, ans: Answer, ctx: ModeContext, deck: Deck): MoveResult {
  const ref = deck.strokes.get(k.id);
  if (!ref) return moveError('bad-attack');
  if (!('ink' in ans)) return moveError('bad-answer');
  const g = gradeInk(ans.ink, ref);
  const tip = g.clean ? null : inkTipText(g, k.char, ref);
  // A messy pass (order, one stroke off) lands like a quiet Shout: full points, 70% damage.
  const res = hitOrMiss(s, playerId, p, a, g.pass, g.clean ? 'tap' : 'quiet', ctx, { char: k.char, hear: k.sound, tip, difficulty: k.difficulty, en: kanaEn(deck, k), phrase: null, card: k.id, recalled: true });
  const mine = ans.ink.map((x) => thin(x, REPLAY_POINTS));
  res.tip = tip;
  res.ink = { mine, ref: ref.map((x) => thin(x, REPLAY_POINTS)), clean: g.clean, score: g.shapeScore };
  p.last = res;
  if (g.clean) p.stats.inkClean += 1;
  s.inks = [...s.inks.slice(1 - STAGE_INKS), { id: a.id, playerId, char: k.char, strokes: mine, ok: g.pass, clean: g.clean, at: ctx.now }];
  askCoach(p, a.id, k, ans.ink, g, ctx, deck);
  if (g.pass) {
    // Say what you drew: the speaking bonus, from the same capped pool as every other bonus.
    a.step = 'say';
    a.id = ctx.newId();
    return MOVE_OK;
  }
  assignAttack(s, playerId, ctx, deck);
  return MOVE_OK;
}

/** After a drawing that landed: say the kana for the speaking bonus (or type it, or skip). */
function saySpell(s: RaidState, playerId: string, p: PlayerRaid, a: Attack, k: Kana, ans: Answer, ctx: ModeContext, deck: Deck): MoveResult {
  const said = spellSay(s, playerId, p, a, k, ans, ctx, deck);
  if (!said) return moveError('bad-answer');
  p.last = said;
  assignAttack(s, playerId, ctx, deck);
  return MOVE_OK;
}

/** Scores saying the drawn kana (or skipping it); null when the answer isn't a say or a skip. */
function spellSay(s: RaidState, playerId: string, p: PlayerRaid, a: Attack, k: Kana, ans: Answer, ctx: ModeContext, deck: Deck): LastResult | null {
  let check: SoundCheck | undefined;
  let spoken = false;
  if ('say' in ans) {
    check = checkSound(texts(ans.say), k, deck, { spoken: ans.say.via === 'speech' });
    spoken = ans.say.via === 'speech';
  } else if (!('pass' in ans)) return null;
  const ok = !!check?.ok;
  const base = Math.round(BASE_POINTS * levelScale(k.difficulty, p.top));
  const bonus = ok && spoken ? payBonus(p, ctx, playerId, Math.round(base * SPEAK_BONUS)) : 0;
  if (ok && spoken) {
    p.wave.spoken += 1;
    ctx.phrase(playerId, { itemId: k.id, text: k.char, kana: k.sound, en: kanaEn(deck, k), outcome: 'said', recall: 'memory' });
  }
  return {
    attackId: a.id,
    ok: ok || !check,
    kind: 'draw',
    char: k.char,
    hear: k.sound,
    points: bonus,
    damage: 0,
    tip: check && !ok ? kanaTip(deck, k, undefined, check) : null,
    combo: s.combo.count,
    splash: false,
    retryNext: false,
  };
}

/** Scores saying the word you heard in Wave 3 (or skipping it); null when the answer isn't a say or a skip. */
function sayPair(s: RaidState, playerId: string, p: PlayerRaid, a: Attack, pair: MinimalPair, ans: Answer, ctx: ModeContext): LastResult | null {
  const played = a.played!;
  const word = pair[played];
  const other = played === 'a' ? pair.b : pair.a;
  let ok = false;
  let spoken = false;
  if ('say' in ans) {
    ok = checkWord(texts(ans.say), word, other);
    spoken = ans.say.via === 'speech';
  } else if (!('pass' in ans)) return null;
  const bonus = ok && spoken ? payBonus(p, ctx, playerId, Math.round(BASE_POINTS * SPEAK_BONUS)) : 0;
  if (ok) {
    p.wave.spoken += spoken ? 1 : 0;
    if (spoken) ctx.phrase(playerId, { itemId: `pair:${pair.id}:${played}`, text: word.text, kana: word.kana, en: word.en, outcome: 'said', recall: 'read' });
  }
  return {
    attackId: a.id,
    ok: ok || 'pass' in ans,
    kind: 'pair',
    char: word.kana,
    hear: word.kana,
    points: bonus,
    damage: 0,
    tip: ok || 'pass' in ans ? null : `It was ${word.kana} (${word.en}). ${pairTip(pair, played)}`,
    combo: s.combo.count,
    splash: false,
    retryNext: false,
  };
}

/**
 * The player has spoken and the phone is checking the recording: move them on to the next
 * yōkai now, and score the say when it comes back (speech checks can take a few seconds).
 */
function sayLater(s: RaidState, playerId: string, p: PlayerRaid, a: Attack, ctx: ModeContext, deck: Deck): MoveResult {
  p.pendingSays = [...(p.pendingSays ?? []).filter((x) => ctx.now - x.at < SAY_LATER_MS).slice(-2), { attack: { ...a, options: [...a.options] }, at: ctx.now }];
  assignAttack(s, playerId, ctx, deck);
  return MOVE_OK;
}

/** A say for a recording the player already moved on from: scored, shown as its own line. */
function settleLater(s: RaidState, playerId: string, p: PlayerRaid, attackId: unknown, raw: Record<string, unknown>, ctx: ModeContext, deck: Deck): MoveResult | null {
  const i = (p.pendingSays ?? []).findIndex((x) => x.attack.id === attackId);
  if (i < 0) return null;
  const { attack: a, at } = p.pendingSays[i]!;
  p.pendingSays.splice(i, 1);
  if (ctx.now - at >= SAY_LATER_MS) return moveError('wrong-phase');
  const ans = readAnswer(raw);
  if (!ans || !('say' in ans || 'pass' in ans)) return moveError('bad-answer');
  let said: LastResult | null = null;
  if (a.kind === 'pair') {
    const pair = deck.pairs.find((x) => x.id === a.itemId);
    if (pair) said = sayPair(s, playerId, p, a, pair, ans, ctx);
  } else {
    const k = deck.byId.get(a.itemId);
    if (k) said = spellSay(s, playerId, p, a, k, ans, ctx, deck);
  }
  if (!said) return moveError('bad-attack');
  p.said = said;
  s.at = ctx.now;
  return MOVE_OK;
}

/**
 * Queues a drawing for the server's optional vision second look: every miss, and passes of a
 * look-alike that weren't clearly right. The question is closed-set: the target and the kana
 * it is most easily drawn as (its look-alike sets, then the closest shapes by the stroke check).
 */
function askCoach(p: PlayerRaid, attackId: string, k: Kana, ink: InkPoint[][], g: InkGrade, ctx: ModeContext, deck: Deck): void {
  const sets = deck.lookAlikes.filter((x) => x.kanaIds.includes(k.id));
  if (g.pass && (!sets.length || g.shapeScore >= COACH_BELOW)) return;
  const near = new Set<string>(sets.flatMap((x) => x.kanaIds).filter((id) => id !== k.id && deck.strokes.has(id)));
  if (near.size < 3) {
    const scored = [...deck.strokes]
      .filter(([id]) => id !== k.id && !near.has(id) && deck.byId.get(id)?.script === k.script)
      .map(([id, ref]) => ({ id, score: gradeInk(ink, ref).shapeScore }));
    for (const x of scored.sort((a, b) => b.score - a.score).slice(0, 3 - near.size)) near.add(x.id);
  }
  const candidates = shuffled([k.char, ...[...near].slice(0, 3).map((id) => deck.byId.get(id)!.char)], ctx.random);
  p.inkAsks = [...p.inkAsks.slice(-1), { key: ctx.newId(), attackId, char: k.char, candidates, strokes: ink, passed: g.pass, at: ctx.now }];
}

/** A drawing waiting for a vision second look, as the server's ink coach sees it. */
export interface InkCoachRequest {
  playerId: string;
  /** Echo this back in the { kind: 'ink-tip' } move. */
  key: string;
  /** The kana the player was asked to draw. */
  char: string;
  /** The closed set to ask about (includes `char`, shuffled). */
  candidates: string[];
  strokes: InkPoint[][];
  /** The offline check let it through. */
  passed: boolean;
  at: number;
}

/** Drawings waiting for the server's vision second look (read-only; the server answers with an 'ink-tip' move). */
export function inkCoachRequests(state: unknown): InkCoachRequest[] {
  const s = state as Partial<RaidState> | null;
  if (!s || typeof s !== 'object' || !s.players) return [];
  return Object.entries(s.players).flatMap(([playerId, p]) =>
    (p.inkAsks ?? []).map((x) => ({ playerId, key: x.key, char: x.char, candidates: x.candidates, strokes: x.strokes, passed: x.passed, at: x.at })),
  );
}
