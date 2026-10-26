// Kana Yōkai Raid: the co-op on-ramp. Kana-shaped yōkai march across the stage and the team
// knocks them out from their phones. See docs/modes/kana-raid.md.
//
// Shape of a game: intro (chapter pick) → three waves, each prompt (banner) → answer (the
// timed battle) → reveal (wave results) → score → finale (the Word Yōkai boss) → encore (the
// raid's own recap: seen / correct tonight, the haunted list) → the room's recap.
//
// Time: yōkai have fixed spawn and escape times decided when a wave starts. The mode has no
// timers, so an escape is settled at the next move (or when the wave ends); the stage animates
// from the same times, so what people see matches what the rules settle.

import type { JpText, Kana, MinimalPair } from '../../../../content/src/types.js';
import { isUtterance, type Utterance } from '../../japanese/kana.js';
import type { Phase, Viewer } from '../../protocol.js';
import { isObject, moveError, MOVE_OK, pick, shuffled, type Award, type ContentLibrary, type Mode, type ModeContext, type MoveResult } from '../mode.js';
import {
  buildDeck,
  chapterDifficulty,
  checkSound,
  checkWord,
  inOtherScript,
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

export const BASE_POINTS = 100;
/** A quiet (tapped or typed) Shout lands at this share of a spoken one. */
export const QUIET_DAMAGE = 0.7;
/** The speaking bonus on top of a hit's points, from the capped pool. */
export const SPEAK_BONUS = 0.3;
/** Speaking bonuses are at most this share of a player's points in a wave (design doc). */
export const BONUS_CAP = 0.3;
export const COMBO_WINDOW_MS = 4_000;
export const BOSS_BONUS = 100;
export const WAVES = 3;
const CUE_GAP_MS = 2_500;

const WAVE_TIMING: Record<number, { gap: number; walk: number }> = {
  1: { gap: 1_800, walk: 26_000 },
  2: { gap: 1_500, walk: 22_000 },
  3: { gap: 2_600, walk: 26_000 },
};

export const WAVE_INFO: Record<number, { title: string; titleJa: string; how: string }> = {
  1: { title: 'Night Parade', titleJa: '百鬼夜行', how: 'Shout each yōkai’s sound, or strike it with its twin from the other alphabet.' },
  2: { title: 'Shapeshifters', titleJa: '化け物', how: 'Look-alikes and echoes: hear the sound, tap the right kana.' },
  3: { title: 'Long and Short', titleJa: 'のばす・つまる', how: 'Hear one word, tap it, then say it. Listen for long sounds and little pauses.' },
  4: { title: 'Word Yōkai', titleJa: 'ことば妖怪', how: 'Break one piece each, then read the whole word together!' },
};

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

export type AttackKind = 'shout' | 'twin' | 'lookalike' | 'echo' | 'pair' | 'piece' | 'blow';

export interface RaidOption {
  id: string;
  label: string;
  sub?: string;
}

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
  options: RaidOption[];
  /** Wave 3: tap what you heard, then say it. */
  step?: 'tap' | 'say';
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
}

interface Tally {
  char: string;
  hear: string;
  seen: number;
  correct: number;
  missed: number;
  tip: string | null;
}

interface WaveStats {
  base: number;
  bonus: number;
  hits: number;
  misses: number;
  spoken: number;
}

interface PlayerRaid {
  chapters: number[];
  ready: boolean;
  top: number;
  attack: Attack | null;
  last: LastResult | null;
  /** The item to retry once after a miss. */
  retryNext: { itemId: string; kind: AttackKind } | null;
  tally: Record<string, Tally>;
  wave: WaveStats;
  stats: { hits: number; misses: number; shoutsSpoken: number; comboHits: number; pieces: number; defeats: number; comebacks: number; reads: number };
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
}

export interface KanaRaidView {
  mode: 'kana-raid';
  /** 0 chapter pick, 1–3 waves, 4 boss, 5 recap. */
  wave: number;
  waveInfo: { title: string; titleJa: string; how: string } | null;
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
    attack: AttackView | null;
    last: LastResult | null;
    hits: number;
    misses: number;
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

export const kanaRaidMode: Mode<RaidState, KanaRaidView> = {
  info: {
    id: 'kana-raid',
    title: 'Kana Yōkai Raid',
    titleJa: 'かな妖怪レイド',
    blurb: 'Kana-shaped yōkai invade the studio. Shout their sounds to catch them.',
    host: 'fude',
    minPlayers: 1,
    maxPlayers: 8,
    roundChoices: [],
    usesPack: false,
  },

  setup(ctx) {
    const deck = deckOf(ctx);
    const first = deck.chapters[0]?.number ?? 1;
    const players: Record<string, PlayerRaid> = {};
    for (const p of ctx.players()) players[p.id] = newPlayer([first]);
    return {
      wave: 0,
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
        return s.wave < WAVES ? 'prompt' : 'finale';
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
      s.combo = { count: 0, players: [], lastAt: 0, best: 0 };
      for (const p of Object.values(s.players)) p.wave = { base: 0, bonus: 0, hits: 0, misses: 0, spoken: 0 };
      cue(s, ctx, 'raid_wave_start', true);
    }
    if (phase === 'answer') {
      buildHorde(s, ctx, deck);
      for (const id of seatedIds(s, ctx)) assignAttack(s, id, ctx, deck);
    }
    if (phase === 'finale') {
      s.wave = WAVES + 1;
      s.horde = [];
      s.combo = { count: 0, players: [], lastAt: 0, best: 0 };
      for (const p of Object.values(s.players)) {
        p.wave = { base: 0, bonus: 0, hits: 0, misses: 0, spoken: 0 };
        p.last = null;
        p.retryNext = null;
      }
      buildBoss(s, ctx, deck);
      for (const id of seatedIds(s, ctx)) assignAttack(s, id, ctx, deck);
      cue(s, ctx, 'raid_boss', true);
    }
    if (phase === 'encore') {
      s.wave = WAVES + 2;
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
      for (const y of s.horde) {
        if (y.state !== 'alive') continue;
        y.state = 'escaped';
        y.endedAt = Math.min(ctx.now, y.escapeAt);
        s.escaped.push({ itemId: y.itemId, char: y.char });
      }
      for (const p of Object.values(s.players)) p.attack = null;
      s.waveResult = {
        wave: s.wave,
        total: s.horde.length,
        defeated: s.horde.filter((y) => y.state === 'defeated').length,
        escaped: s.horde.filter((y) => y.state === 'escaped').length,
        escapedChars: [...new Set(s.horde.filter((y) => y.state === 'escaped').map((y) => y.char))],
        bestCombo: s.combo.best,
        players: seatedIds(s, ctx).map((id) => {
          const w = s.players[id]!.wave;
          return { playerId: id, hits: w.hits, misses: w.misses, points: w.base + w.bonus, bonus: w.bonus };
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
          ctx.phrase(id, { itemId: `boss:${b.id}`, text: b.word.text, kana: b.word.kana, en: b.word.en, outcome: b.reads[id] === 'spoken' ? 'said' : b.reads[id] === 'missed' ? 'missed' : 'seen' });
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
      case 'attack': {
        if (phase !== 'answer' && phase !== 'finale') return moveError('wrong-phase');
        const a = p.attack;
        if (!a) return moveError('no-attack');
        if (raw.attackId !== a.id) return moveError('stale-attack');
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
    return { round: Math.min(s.wave, WAVES + 1), totalRounds: WAVES + 1 };
  },

  view(s, phase, viewer, ctx) {
    const inBattle = phase === 'answer' || phase === 'reveal';
    const b = s.boss;
    const name = (id: string | null) => (id ? (ctx.player(id)?.name ?? null) : null);
    const ids = seatedIds(s, ctx);
    const view: KanaRaidView = {
      mode: 'kana-raid',
      wave: s.wave,
      waveInfo: WAVE_INFO[s.wave] ?? null,
      at: s.at,
      chapters: phase === 'intro' ? s.chapters : [],
      picks: ids.map((id) => ({ playerId: id, chapters: s.players[id]!.chapters, ready: s.players[id]!.ready })),
      horde: inBattle ? s.horde.map(yokaiView) : [],
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
        view.me = {
          chapters: p.chapters,
          ready: p.ready,
          attack: live && p.attack ? attackView(p.attack) : null,
          last: live ? p.last : null,
          hits: p.stats.hits,
          misses: p.stats.misses,
          recap: phase === 'encore' ? playerRecap(p) : null,
        };
      }
    }
    return view;
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
    give('fude.award.battle-cry', { text: 'おおごえしょう', en: 'Battle Cry' }, (p) => p.stats.shoutsSpoken);
    give('fude.award.boss-breaker', { text: 'ボス ブレイカー', en: 'Boss Breaker' }, (p) => p.stats.pieces);
    give('fude.award.exorcist', { text: 'おはらい マスター', en: 'Exorcist' }, (p) => p.stats.comebacks);
    return out;
  },
};

// ---------- helpers ----------

function newPlayer(chapters: number[]): PlayerRaid {
  return {
    chapters,
    ready: false,
    top: Math.max(...chapters),
    attack: null,
    last: null,
    retryNext: null,
    tally: {},
    wave: { base: 0, bonus: 0, hits: 0, misses: 0, spoken: 0 },
    stats: { hits: 0, misses: 0, shoutsSpoken: 0, comboHits: 0, pieces: 0, defeats: 0, comebacks: 0, reads: 0 },
  };
}

/** Players still seated who are in the raid, by seat. */
function seatedIds(s: RaidState, ctx: ModeContext): string[] {
  return ctx.players().filter((p) => s.players[p.id]).map((p) => p.id);
}

function cue(s: RaidState, ctx: ModeContext, event: Parameters<ModeContext['cue']>[0]['event'], force = false, slots?: Record<string, string>): void {
  if (!force && ctx.now - s.lastCueAt < CUE_GAP_MS) return;
  s.lastCueAt = ctx.now;
  ctx.cue({ host: 'fude', event, ...(slots ? { slots } : {}) });
}

function yokaiView(y: Yokai): YokaiView {
  return {
    id: y.id,
    char: y.char,
    ...(y.alt ? { alt: y.alt } : {}),
    hp: y.hp,
    maxHp: y.maxHp,
    spawnAt: y.spawnAt,
    escapeAt: y.escapeAt,
    state: y.state,
    endedAt: y.endedAt,
    hitAt: y.hitAt,
    ...(y.leader ? { leader: y.leader } : {}),
  };
}

function attackView(a: Attack): AttackView {
  const { answer: _a, played: _p, pieceIndex: _i, itemId: _id, ...rest } = a;
  // The word to say is the answer while the player still has to pick it by ear.
  if (a.kind === 'pair' && a.step === 'tap') delete rest.word;
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

type Answer = { pick: string } | { say: Utterance } | { pass: true };

function readAnswer(raw: Record<string, unknown>): Answer | null {
  if (typeof raw.pick === 'string' && raw.pick.length <= 8) return { pick: raw.pick };
  if (isUtterance(raw.say)) return { say: raw.say };
  if (raw.pass === true) return { pass: true };
  return null;
}

const texts = (u: Utterance): string[] => [u.reading, u.text].filter((t): t is string => !!t);

// ---------- the horde ----------

function buildHorde(s: RaidState, ctx: ModeContext, deck: Deck): void {
  const ids = seatedIds(s, ctx);
  const n = ids.length || 1;
  const timing = WAVE_TIMING[s.wave] ?? WAVE_TIMING[1]!;
  const hits = 1 + Math.floor((n - 1) / 3);
  const count = s.wave === 3 ? Math.min(10, 3 + n) : Math.min(18, 5 + 2 * n);
  const recent: string[] = [];
  const horde: Yokai[] = [];
  let t = ctx.now + 1_200;

  for (let i = 0; i < count; i++) {
    const owner = s.players[ids[i % n] ?? ''] ?? newPlayer([1]);
    let itemId: string;
    let char: string;
    let alt: string | undefined;
    if (s.wave === 3) {
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
    horde.push({ id: ctx.newId(), itemId, char, ...(alt ? { alt } : {}), hp: BASE_POINTS * hits, maxHp: BASE_POINTS * hits, spawnAt: t, escapeAt: t + walk, state: 'alive', endedAt: null, hitAt: null });
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

/** Escapes whatever reached the gate by now. */
function sweep(s: RaidState, ctx: ModeContext): void {
  let fled = 0;
  for (const y of s.horde) {
    if (y.state === 'alive' && y.escapeAt <= ctx.now) {
      y.state = 'escaped';
      y.endedAt = y.escapeAt;
      s.escaped.push({ itemId: y.itemId, char: y.char });
      fled++;
    }
  }
  if (fled) cue(s, ctx, 'raid_escape');
}

const isAlive = (y: Yokai, now: number) => y.state === 'alive' && y.escapeAt > now;

// ---------- attacks ----------

function assignAttack(s: RaidState, playerId: string, ctx: ModeContext, deck: Deck): void {
  const p = s.players[playerId];
  if (!p) return;
  p.attack = s.wave > WAVES ? bossAttack(s, playerId, ctx, deck) : waveAttack(s, playerId, p, ctx, deck);
}

function waveAttack(s: RaidState, playerId: string, p: PlayerRaid, ctx: ModeContext, deck: Deck): Attack | null {
  const now = ctx.now;
  const retry = p.retryNext;
  p.retryNext = null;
  const poolIds = new Set(s.wave === 3 ? pairsFor(deck, p.top).map((x) => x.id) : poolFor(deck, p.chapters).map((k) => k.id));
  let itemId: string | undefined = retry?.itemId;
  let yokai: Yokai | undefined;
  if (itemId) yokai = s.horde.find((y) => y.itemId === itemId && isAlive(y, now));
  else {
    const targeted = new Map<string, number>();
    for (const [id, other] of Object.entries(s.players)) if (id !== playerId && other.attack?.yokaiId) targeted.set(other.attack.yokaiId, (targeted.get(other.attack.yokaiId) ?? 0) + 1);
    const mine = s.horde.filter((y) => isAlive(y, now) && poolIds.has(y.itemId));
    // On stage first (closest to the gate), then the next to walk on.
    mine.sort((a, b) => Number(a.spawnAt > now) - Number(b.spawnAt > now) || (a.spawnAt > now ? a.spawnAt - b.spawnAt : a.escapeAt - b.escapeAt));
    const front = mine.slice(0, 3);
    front.sort((a, b) => (targeted.get(a.id) ?? 0) - (targeted.get(b.id) ?? 0));
    yokai = front[0];
    itemId = yokai?.itemId ?? pick([...poolIds], ctx.random);
  }
  if (!itemId) return null;
  const base = { id: ctx.newId(), yokaiId: yokai?.id ?? null, itemId, retry: !!retry };

  if (s.wave === 3) {
    const pair = deck.pairs.find((x) => x.id === itemId);
    return pair ? pairAttack(base, pair, ctx) : null;
  }
  const k = deck.byId.get(itemId);
  if (!k) return null;
  const pool = poolFor(deck, p.chapters);
  let kind: AttackKind;
  if (retry) kind = retry.kind;
  else if (s.wave === 1) kind = k.twinId && deck.byId.has(k.twinId) && ctx.random() < 0.35 ? 'twin' : 'shout';
  else kind = lookAlikeFor(deck, k, pool) && ctx.random() < 0.6 ? 'lookalike' : 'echo';
  return kanaAttack(base, kind, k, pool, deck, s.wave, ctx);
}

type AttackBase = Pick<Attack, 'id' | 'yokaiId' | 'itemId' | 'retry'>;

/** Shuffles options and gives them opaque ids; returns the id of the right one. */
function dealOptions(right: Omit<RaidOption, 'id'>, wrong: Omit<RaidOption, 'id'>[], ctx: ModeContext): { options: RaidOption[]; answer: string } {
  const all = shuffled([{ ...right, right: true }, ...wrong.map((w) => ({ ...w, right: false }))], ctx.random);
  const options = all.map((o, i) => ({ id: String(i), label: o.label, ...(o.sub ? { sub: o.sub } : {}) }));
  return { options, answer: String(all.findIndex((o) => o.right)) };
}

/** Up to `n` distinct picks, preferred ones first. */
function distinct<T>(preferred: readonly T[], rest: readonly T[], n: number, key: (t: T) => string, exclude: Set<string>, ctx: ModeContext): T[] {
  const out: T[] = [];
  const seen = new Set(exclude);
  for (const list of [shuffled(preferred, ctx.random), shuffled(rest, ctx.random)]) {
    for (const t of list) {
      if (out.length >= n) return out;
      const k = key(t);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(t);
    }
  }
  return out;
}

function kanaAttack(base: AttackBase, kind: AttackKind, k: Kana, pool: Kana[], deck: Deck, wave: number, ctx: ModeContext): Attack {
  const sameScript = (script: Kana['script']) => pool.filter((x) => x.script === script);
  const romaji = wave === 1 && k.chapter === 1 ? { romaji: k.romaji } : {};
  const hear = k.sound;
  const hearText = inOtherScript(k.sound, k.script);

  if (kind === 'twin') {
    const twin = deck.byId.get(k.twinId!)!;
    const mates = deck.lookAlikes.filter((x) => x.kanaIds.includes(twin.id)).flatMap((x) => x.kanaIds).map((id) => deck.byId.get(id)!).filter((x) => x.script === twin.script);
    const wrong = distinct(mates, sameScript(twin.script), 3, (x) => x.sound, new Set([twin.sound]), ctx);
    const { options, answer } = dealOptions({ label: twin.char }, wrong.map((x) => ({ label: x.char })), ctx);
    return { ...base, kind, show: k.char, hear, options, answer, ...romaji };
  }
  if (kind === 'lookalike' || kind === 'echo') {
    let preferred: Kana[];
    if (kind === 'lookalike') {
      const set = lookAlikeFor(deck, k, pool)!;
      const inPool = new Set(pool.map((x) => x.id));
      preferred = set.kanaIds.filter((id) => inPool.has(id)).map((id) => deck.byId.get(id)!);
    } else {
      const confusions = new Set(k.confusableSounds ?? []);
      preferred = sameScript(k.script).filter((x) => confusions.has(x.sound));
    }
    const wrong = distinct(preferred, sameScript(k.script), 3, (x) => x.sound, new Set([k.sound]), ctx);
    const { options, answer } = dealOptions({ label: k.char }, wrong.map((x) => ({ label: x.char })), ctx);
    const twin = k.twinId ? deck.byId.get(k.twinId) : undefined;
    return { ...base, kind, ...(kind === 'lookalike' ? { show: twin?.char ?? hearText } : {}), hear, hearText, options, answer };
  }
  // Shout: say it; the four sounds (in the other script) are the quiet fallback.
  const others = pool.map((x) => x.sound);
  const wrong = distinct(k.confusableSounds ?? [], others, 3, (x) => x, new Set([k.sound]), ctx);
  const { options, answer } = dealOptions({ label: hearText }, wrong.map((x) => ({ label: inOtherScript(x, k.script) })), ctx);
  return { ...base, kind: 'shout', show: k.char, hear, options, answer, ...romaji };
}

function pairAttack(base: AttackBase, pair: MinimalPair, ctx: ModeContext): Attack {
  const played: 'a' | 'b' = ctx.random() < 0.5 ? 'a' : 'b';
  const opts = shuffled(['a', 'b'] as const, ctx.random).map((id) => ({ id, label: pair[id].kana, sub: pair[id].en }));
  return { ...base, kind: 'pair', step: 'tap', hear: pair[played].kana, hearText: pair[played].kana, options: opts, answer: played, played, word: pair[played] };
}

// ---------- the boss ----------

function buildBoss(s: RaidState, ctx: ModeContext, deck: Deck): void {
  const ids = seatedIds(s, ctx);
  const top = Math.max(1, ...ids.map((id) => s.players[id]!.top));
  let fit = deck.bosses.filter((b) => b.minChapter <= top);
  if (!fit.length) {
    const lowest = Math.min(...deck.bosses.map((b) => b.minChapter));
    fit = deck.bosses.filter((b) => b.minChapter === lowest);
  }
  const roomy = fit.filter((b) => b.pieces.length >= ids.length);
  const choices = roomy.length ? [...roomy].sort((a, b) => b.minChapter - a.minChapter).slice(0, 4) : [[...fit].sort((a, b) => b.pieces.length - a.pieces.length)[0]!];
  const word = pick(choices, ctx.random)!;
  const load = new Map(ids.map((id) => [id, 0]));
  const pieces: BossPiece[] = word.pieces.map((char) => {
    const k = deck.byChar.get(char);
    const knows = ids.filter((id) => !k || s.players[id]!.chapters.includes(k.chapter));
    const pool = knows.length ? knows : ids;
    const fewest = Math.min(...pool.map((id) => load.get(id) ?? 0));
    const owner = pool.find((id) => (load.get(id) ?? 0) === fewest) ?? null;
    if (owner) load.set(owner, (load.get(owner) ?? 0) + 1);
    return { char, sound: pieceSound(deck, char), owner, by: null };
  });
  // Everyone gets a piece where the word is long enough: hand spares to anyone left out.
  for (const id of ids) {
    if ((load.get(id) ?? 0) > 0) continue;
    const donor = pieces.find((x) => x.owner && (load.get(x.owner) ?? 0) > 1);
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
    // Done with your own pieces: help with one whose owner left or is stuck.
    const open = b.pieces.map((x, i) => ({ x, i })).filter(({ x }) => !x.by);
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
        const check = checkSound(texts(ans.say), k, deck);
        return settle(s, playerId, p, a, check.ok, ans.say.via === 'speech' ? 'spoken' : 'quiet', ctx, deck, { kana: k, check, spoke: ans.say.via === 'speech' });
      }
      return moveError('bad-answer');
    }
    case 'twin':
    case 'lookalike':
    case 'echo': {
      if (!k || !('pick' in ans)) return moveError('bad-answer');
      const label = a.options.find((o) => o.id === ans.pick)?.label;
      if (label === undefined) return moveError('bad-answer');
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
      const word = pair[a.played];
      const other = a.played === 'a' ? pair.b : pair.a;
      let ok = false;
      let spoken = false;
      if ('say' in ans) {
        ok = checkWord(texts(ans.say), word, other);
        spoken = ans.say.via === 'speech';
      } else if (!('pass' in ans)) return moveError('bad-answer');
      const bonus = ok && spoken ? payBonus(p, ctx, playerId, Math.round(BASE_POINTS * SPEAK_BONUS)) : 0;
      if (ok) {
        p.wave.spoken += spoken ? 1 : 0;
        if (spoken) ctx.phrase(playerId, { itemId: `pair:${pair.id}:${a.played}`, text: word.text, kana: word.kana, en: word.en, outcome: 'said' });
      }
      p.last = {
        attackId: a.id,
        ok: ok || 'pass' in ans,
        kind: 'pair',
        char: word.kana,
        hear: word.kana,
        points: bonus,
        damage: 0,
        tip: ok || 'pass' in ans ? null : `It was ${word.kana} (${word.en}). ${pairTip(pair, a.played)}`,
        combo: s.combo.count,
        splash: false,
        retryNext: false,
      };
      assignAttack(s, playerId, ctx, deck);
      return MOVE_OK;
    }
    case 'piece':
      return pieceAttack(s, playerId, p, a, ans, ctx, deck);
    case 'blow': {
      const b = s.boss;
      if (!b) return moveError('bad-attack');
      if ('pick' in ans) return moveError('bad-answer');
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
}

/** Settles a kana attack (waves 1 and 2). */
function settle(s: RaidState, playerId: string, p: PlayerRaid, a: Attack, ok: boolean, how: 'spoken' | 'quiet' | 'tap', ctx: ModeContext, deck: Deck, info: SettleInfo): MoveResult {
  const k = info.kana;
  let tip: string | null = null;
  if (!ok) {
    const wrong = info.wrongLabel ? deck.kana.find((x) => x.char === info.wrongLabel || (a.kind === 'shout' && sameSound(x.sound, info.wrongLabel!))) : undefined;
    tip = kanaTip(deck, k, wrong && wrong.id !== k.id ? wrong : undefined, info.check);
  }
  if (a.kind === 'shout' && info.spoke) p.stats.shoutsSpoken += 1;
  p.last = hitOrMiss(s, playerId, p, a, ok, how, ctx, { char: k.char, hear: k.sound, tip, difficulty: k.difficulty, en: kanaEn(deck, k), phrase: null });
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

/** Pays a speaking bonus from the capped pool (≤ 30% of the player's points this wave). */
function payBonus(p: PlayerRaid, ctx: ModeContext, playerId: string, want: number): number {
  const room = Math.floor((BONUS_CAP * p.wave.base - (1 - BONUS_CAP) * p.wave.bonus) / (1 - BONUS_CAP));
  const bonus = Math.max(0, Math.min(want, room));
  if (bonus > 0) {
    ctx.award(playerId, bonus);
    p.wave.bonus += bonus;
  }
  return bonus;
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
}

function hitOrMiss(s: RaidState, playerId: string, p: PlayerRaid, a: Attack, ok: boolean, how: 'spoken' | 'quiet' | 'tap', ctx: ModeContext, info: HitInfo): LastResult {
  const t = (p.tally[a.itemId] ??= { char: info.char, hear: info.hear, seen: 0, correct: 0, missed: 0, tip: null });
  t.seen += 1;
  const phraseOf = (outcome: 'said' | 'retry' | 'missed' | 'seen') =>
    ctx.phrase(playerId, info.phrase ? { itemId: info.phraseId ?? a.itemId, text: info.phrase.text, kana: info.phrase.kana, en: info.phrase.en, outcome } : { itemId: a.itemId, text: info.char, kana: info.hear, en: info.en, outcome });

  if (!ok) {
    t.missed += 1;
    t.tip = info.tip;
    p.stats.misses += 1;
    p.wave.misses += 1;
    // One retry, then the item moves on (it stays on the haunted list).
    const retryNext = !a.retry && a.kind !== 'pair';
    p.retryNext = retryNext ? { itemId: a.itemId, kind: a.kind } : null;
    phraseOf('missed');
    return { attackId: a.id, ok: false, kind: a.kind, char: info.char, hear: info.hear, points: 0, damage: 0, tip: info.tip, combo: s.combo.count, splash: false, retryNext };
  }

  const now = ctx.now;
  const scale = levelScale(info.difficulty, p.top);
  const base = Math.round(BASE_POINTS * scale);
  let damage = how === 'quiet' ? base * QUIET_DAMAGE : base;

  // Team combo: hits from two or more players inside the window.
  const c = s.combo;
  if (now - c.lastAt <= COMBO_WINDOW_MS) {
    c.count += 1;
    if (!c.players.includes(playerId)) c.players.push(playerId);
  } else {
    c.count = 1;
    c.players = [playerId];
  }
  c.lastAt = now;
  const teamCombo = c.players.length >= 2;
  if (teamCombo) {
    damage *= 1 + 0.1 * Math.min(5, c.count - 1);
    c.best = Math.max(c.best, c.count);
    p.stats.comboHits += 1;
    if ([3, 6, 10, 15, 20].includes(c.count)) cue(s, ctx, 'raid_combo', true);
  }
  damage = Math.round(damage);

  // Land it: on the target, or splash onto the yōkai closest to the gate.
  let target = a.yokaiId ? s.horde.find((y) => y.id === a.yokaiId && isAlive(y, now)) : undefined;
  let splash = false;
  if (!target) {
    const onStage = s.horde.filter((y) => isAlive(y, now) && y.spawnAt <= now).sort((x, y) => x.escapeAt - y.escapeAt);
    target = onStage[0] ?? s.horde.filter((y) => isAlive(y, now)).sort((x, y) => x.spawnAt - y.spawnAt)[0];
    splash = !!target;
  }
  if (target) {
    target.hp = Math.max(0, target.hp - damage);
    target.hitAt = now;
    if (target.hp === 0) {
      target.state = 'defeated';
      target.endedAt = now;
      p.stats.defeats += 1;
      s.defeatedTotal += 1;
      cue(s, ctx, 'raid_hit');
    }
  }
  s.bestCombo = Math.max(s.bestCombo, c.best);

  ctx.award(playerId, base);
  p.wave.base += base;
  p.wave.hits += 1;
  p.stats.hits += 1;
  if (t.missed > 0) p.stats.comebacks += 1;
  t.correct += 1;
  let bonus = 0;
  if (how === 'spoken') {
    bonus = payBonus(p, ctx, playerId, Math.round(base * SPEAK_BONUS));
    p.wave.spoken += 1;
  }
  phraseOf(how === 'spoken' ? 'said' : a.retry ? 'retry' : 'seen');
  return { attackId: a.id, ok: true, kind: a.kind, char: info.char, hear: info.hear, points: base + bonus, damage, tip: null, combo: teamCombo ? c.count : 0, splash, retryNext: false };
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
    check = k ? checkSound(texts(ans.say), k, deck) : { ok: texts(ans.say).some((t) => sameSound(t, piece.sound)) };
    ok = check.ok;
    how = ans.say.via === 'speech' ? 'spoken' : 'quiet';
  } else return moveError('bad-answer');

  const t = (p.tally[a.itemId] ??= { char: piece.char, hear: piece.sound, seen: 0, correct: 0, missed: 0, tip: null });
  t.seen += 1;
  if (!ok) {
    const tip = MARK_OPTIONS[piece.char] ? `${piece.char} means: ${MARK_OPTIONS[piece.char]!.right.toLowerCase()}.` : k ? kanaTip(deck, k, undefined, check) : `${piece.char} sounds like ${piece.sound}.`;
    t.missed += 1;
    t.tip = tip;
    p.stats.misses += 1;
    p.wave.misses += 1;
    p.retryNext = { itemId: a.itemId, kind: 'piece' };
    if (k) ctx.phrase(playerId, { itemId: k.id, text: k.char, kana: k.sound, en: kanaEn(deck, k), outcome: 'missed' });
    p.last = { attackId: a.id, ok: false, kind: 'piece', char: piece.char, hear: piece.sound, points: 0, damage: 0, tip, combo: 0, splash: false, retryNext: true };
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
    const bonus = how === 'spoken' ? payBonus(p, ctx, playerId, Math.round(base * SPEAK_BONUS)) : 0;
    if (k) ctx.phrase(playerId, { itemId: k.id, text: k.char, kana: k.sound, en: kanaEn(deck, k), outcome: how === 'spoken' ? 'said' : 'seen' });
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
