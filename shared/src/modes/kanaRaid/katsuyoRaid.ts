// Katsuyō Raid (活用レイド): Kana Yōkai Raid as it plays in the Green Car. The yōkai are verbs wearing a form
// badge (a しかる yōkai with a 受身 badge): say the form and it goes down. See docs/modes/kana-raid.md, "Green
// Car", and the design (project files n3-coverage/green-car/katsuyo-raid.md).
//
// Shape of a game, the raid's own phases: intro (the badge check) → three waves, each prompt → answer → reveal →
// score: 百鬼活用 Form Parade (say the form), 化け物 Which badge? (hear a form, tap its badge, say the plain
// verb), 一言 Chunk Strike (a picture and a gist: say a short chunk with a word of your own) → the optional Ink
// Storm (write N4 and sign kanji) → finale (the 文妖怪 Sentence Yōkai: break your piece, then say the whole N3
// line from its gist) → encore (the raid's recap) → the room's recap.
//
// What counts toward stamps (the path's rule: a frame said from memory with your own words): bare forms (Waves
// 1–2, boss pieces) go in the phrasebook with `frames: []`, so they move no goal. Only Wave 3 chunks said with the
// player's own word, and the boss line said from the gist, count; typed and tapped answers log `read`.
//
// The battle engine (spawn and escape times, the lazy sweep, combos, the capped speaking bonus) is raidCore.ts,
// shared with the kana raid.

import type { JpText } from '../../../../content/src/types.js';
import { BADGES, BADGE_BY_ID, KATSUYO_VERBS, type Badge, type BadgeId, type KatsuyoVerb } from '../../../../content/src/katsuyo/verbs.js';
import { KATSUYO_BOSS_LINES, KATSUYO_CHUNKS, type KatsuyoBossLine, type KatsuyoChunk } from '../../../../content/src/katsuyo/lines.js';
import { framesHeard } from '../../japanese/frames.js';
import { isUtterance, normalizeReading, type Utterance } from '../../japanese/kana.js';
import { gradeInk, inkTipText, KANJI_LIMITS, readInk, thin, type InkPoint } from '../../japanese/strokes.js';
import { playerTextAllowed } from '../../moderation.js';
import type { Audience, Phase, Viewer } from '../../protocol.js';
import { isObject, moveError, MOVE_OK, pick, shuffled, type Award, type ModeContext, type MoveResult, type Mode } from '../mode.js';
import { checkForm, checkLine, formTip, formVariants, heard } from './katsuyoCheck.js';
import {
  along,
  BASE_POINTS,
  BOSS_BONUS,
  bringOn,
  cueRaid,
  dealOptions,
  distinct,
  escapeRest,
  freshCombo,
  isAlive,
  payBonus,
  QUIET_DAMAGE,
  SAY_LATER_MS,
  SPEAK_BONUS,
  strike,
  sweep,
  type Combo,
  type CoreYokai,
  type GreenTagged,
  type RaidOption,
} from './raidCore.js';

// ---------- tuning ----------

export const KATSUYO_WAVES = 3;
export const KATSUYO_INK_WAVE = KATSUYO_WAVES + 1;
/** A Wave 3 chunk is worth more than a bare form. */
export const CHUNK_POINTS = 150;
/** The finishing blow: said, or typed. */
export const BLOW_POINTS = { spoken: 200, typed: 100 };
/** A wrong tap costs this much (to blunt guessing); a spoken or typed miss costs nothing. */
export const TAP_MISS = 5;
/** Wave 3 and the boss walk this much slower when no seat is N3 (every N3 badge is then a stretch). */
export const SLOW = 1.3;
/** Hits with this many different badges inside one team combo make a badge chain. */
export const CHAIN = 3;
/** An N4 seat is dealt an N3 stretch badge one deal in this many (when it ticked any). */
const STRETCH_EVERY = 4;
/** Drawings the stage keeps for its ink replay. */
const STAGE_INKS = 4;
const REPLAY_POINTS = 16;

const WAVE_TIMING: Record<number, { gap: number; walk: number }> = {
  1: { gap: 2_000, walk: 28_000 },
  2: { gap: 2_200, walk: 28_000 },
  // Chunks take thinking: fewer, slower yōkai.
  3: { gap: 4_000, walk: 40_000 },
  // Ink Storm: kanji take longer than kana (Shodō gives 45 s a writing item).
  4: { gap: 4_000, walk: 50_000 },
};

export const KATSUYO_WAVE_INFO: Record<number, { title: string; titleJa: string; titleKana: string; how: string }> = {
  1: { title: 'Form Parade', titleJa: '百鬼活用', titleKana: 'ひゃっきかつよう', how: 'Each verb yōkai wears a form badge. Say the verb in that form to knock it out (tapping works too, just softer).' },
  2: { title: 'Which badge?', titleJa: '化け物', titleKana: 'ばけもの', how: 'The yōkai hide their badges. Hear the form, tap its badge, then say the plain verb back for a bonus.' },
  3: { title: 'Chunk Strike', titleJa: '一言', titleKana: 'ひとこと', how: 'A picture and a gist: say a short chunk with the yōkai’s verb in its badge form and a word of your own.' },
  4: { title: 'Sentence Yōkai', titleJa: '文妖怪', titleKana: 'ぶんようかい', how: 'Break your piece, then the finishing blow: say the whole line from its gist, from memory.' },
};

export const KATSUYO_INK_INFO = { title: 'Ink Storm', titleJa: '墨の嵐', titleKana: 'すみのあらし', how: 'The yōkai wear the English of a word. Write its kanji from memory on your phone, then say the word.' };

const DURATIONS: Record<Phase, number> = {
  lobby: 0,
  intro: 40_000,
  prompt: 6_000,
  answer: 45_000,
  reveal: 9_000,
  encore: 25_000,
  score: 7_000,
  penalty: 0,
  finale: 90_000,
  recap: 0,
};

// ---------- state ----------

export type KatsuyoAttackKind = 'form' | 'badge' | 'chunk' | 'draw' | 'piece' | 'blow';

/** A badge as screens show it. */
export interface BadgeView {
  id: BadgeId;
  ja: string;
  jaKana: string;
  en: string;
  icon: string;
  side: 'n4' | 'n3';
}

export const badgeView = (b: Badge): BadgeView => ({ id: b.id, ja: b.ja, jaKana: b.jaKana, en: b.en, icon: b.icon, side: b.side });

export interface KatsuyoAttack {
  id: string;
  kind: KatsuyoAttackKind;
  yokaiId: string | null;
  itemId: string;
  retry: boolean;
  /** Wave 2: tap the badge, then say the plain verb. Ink Storm: draw, then say the word. */
  step?: 'tap' | 'say' | 'draw';
  /** The yōkai's verb in its dictionary form (the talisman tag). */
  verb?: JpText;
  /** The badge to say (hidden in Wave 2's tap step: it's the answer). */
  badge?: BadgeView;
  /** An N3 badge dealt to an N4 seat: optional stretch, the tap fallback always open. */
  stretch?: boolean;
  /** Kana for the phone to voice (Wave 2's form, Ink Storm's word). */
  hear?: string;
  /** The same, written: shown when the phone can't voice it, or its sound is off. */
  hearText?: string;
  /** The player's phone sound is off: Wave 2 shows the form as text. */
  read?: boolean;
  /** Wave 3 and the boss: the picture and the English gist. */
  picture?: string;
  gist?: string;
  /** Ink Storm: the word to write a kanji of, with that kanji as □ (非□口), and its meaning. */
  write?: { blanked: string; kana: string; en: string; meaning: string };
  /** The word to say in a say step (Ink Storm: shown once the kanji is written). */
  word?: JpText;
  options: RaidOption[];
  // ---- server only ----
  answer: string;
  verbId?: string;
  badgeId?: BadgeId;
  chunkId?: string;
  char?: string;
  pieceIndex?: number;
}

export type KatsuyoAttackView = Omit<KatsuyoAttack, 'answer' | 'verbId' | 'badgeId' | 'chunkId' | 'char' | 'pieceIndex' | 'itemId'>;

export interface KatsuyoLast {
  attackId: string;
  ok: boolean;
  kind: KatsuyoAttackKind;
  /** What was attacked, as shown (のまされる, a chunk, a kanji). */
  label: string;
  /** Its kana for the phone to voice. */
  hear: string;
  points: number;
  damage: number;
  tip: string | null;
  combo: number;
  splash: boolean;
  retryNext: boolean;
  /** Counted toward the path: a chunk or the boss line, said from memory with the player's own words. */
  counted: boolean;
  /** Ink Storm: the drawing and how the kanji is written. */
  ink?: { mine: InkPoint[][]; ref: InkPoint[][]; clean: boolean; score: number };
}

export interface KatsuyoInk {
  id: string;
  playerId: string;
  char: string;
  strokes: InkPoint[][];
  ok: boolean;
  clean: boolean;
  at: number;
}

export interface KatsuyoYokai extends CoreYokai {
  /** The talisman tag: the verb (Waves 1 and 3), the conjugated form (Wave 2), the English (Ink Storm). */
  tag: string;
  badge: BadgeId | null;
  /** Wave 2: the badge is hidden behind a question mark. */
  hidden?: boolean;
  picture?: string;
  /** Wave 3: Fude's chunk, shown on the TV once the yōkai is caught. */
  model?: string;
}

interface Tally {
  label: string;
  hear: string;
  badge: BadgeId | null;
  seen: number;
  correct: number;
  missed: number;
  counted: number;
  tip: string | null;
}

interface WaveStats {
  base: number;
  bonus: number;
  lost: number;
  hits: number;
  misses: number;
  spoken: number;
}

interface KatsuyoPlayer {
  level: 'n4' | 'n3';
  badges: BadgeId[];
  ready: boolean;
  attack: KatsuyoAttack | null;
  replaced: string[];
  last: KatsuyoLast | null;
  said: KatsuyoLast | null;
  pendingSays: { attack: KatsuyoAttack; at: number }[];
  retryNext: { itemId: string; kind: KatsuyoAttackKind } | null;
  /** Aim the deal: says tonight that counted, by badge (frame), and badges dealt. */
  counted: Partial<Record<BadgeId, number>>;
  dealtBadges: Partial<Record<BadgeId, number>>;
  deals: number;
  tally: Record<string, Tally>;
  wave: WaveStats;
  stats: { hits: number; misses: number; spoken: number; comboHits: number; pieces: number; defeats: number; chunks: number; chains: number; kanji: number };
}

interface KatsuyoBoss {
  lineId: string;
  pieces: { verbId: string; badge: BadgeId; owner: string | null; by: string | null }[];
  stage: 'break' | 'blow';
  reads: Record<string, 'spoken' | 'typed' | 'missed' | 'pass'>;
  defeated: boolean;
  defeatedAt: number | null;
}

export interface KatsuyoWaveResult {
  wave: number;
  total: number;
  defeated: number;
  escaped: number;
  escapedChars: string[];
  bestCombo: number;
  players: { playerId: string; hits: number; misses: number; points: number; bonus: number }[];
}

export interface KatsuyoState extends GreenTagged {
  wave: number;
  waves: number;
  ink: boolean;
  inkAvailable: boolean;
  inks: KatsuyoInk[];
  at: number;
  audience: Audience;
  /** No N3 seat: Wave 3 and the boss walk slower. */
  slow: boolean;
  players: Record<string, KatsuyoPlayer>;
  horde: KatsuyoYokai[];
  combo: Combo;
  /** The badges hit in the current combo, and the latest badge chain for the TV. */
  comboBadges: BadgeId[];
  chain: { badges: BadgeId[]; at: number } | null;
  waveEndsAt: number;
  waveResult: KatsuyoWaveResult | null;
  boss: KatsuyoBoss | null;
  escaped: { itemId: string; char: string }[];
  lastCueAt: number;
  defeatedTotal: number;
  bestCombo: number;
}

// ---------- view ----------

export interface KatsuyoYokaiView {
  id: string;
  tag: string;
  badge: BadgeView | null;
  hidden?: boolean;
  picture?: string;
  model?: string;
  hp: number;
  maxHp: number;
  spawnAt: number;
  escapeAt: number;
  state: KatsuyoYokai['state'];
  endedAt: number | null;
  hitAt: number | null;
  caughtBy?: string;
  caughtPoints?: number;
  aimedBy?: string[];
}

export interface KatsuyoRaidView {
  mode: 'kana-raid';
  variant: 'katsuyo';
  /** 0 badge check, 1…waves waves, waves + 1 boss, waves + 2 recap. */
  wave: number;
  waves: number;
  ink: boolean;
  inkAvailable: boolean;
  inks: KatsuyoInk[];
  waveInfo: { title: string; titleJa: string; titleKana: string; how: string } | null;
  at: number;
  slow: boolean;
  /** The badge chart (intro): N4 left, N3 right, each with an example. */
  chart: (BadgeView & { example: JpText; goal: string })[];
  picks: { playerId: string; level: 'n4' | 'n3'; badges: BadgeId[]; ready: boolean }[];
  horde: KatsuyoYokaiView[];
  combo: { count: number; players: number; lastAt: number; best: number };
  chain: { badges: BadgeView[]; at: number } | null;
  waveResult: KatsuyoWaveResult | null;
  boss: {
    gist: string;
    badge: BadgeView;
    pieces: { verb: string; badge: BadgeView; broken: boolean; owner: string | null; by: string | null }[];
    stage: 'break' | 'blow';
    readers: string[];
    defeated: boolean;
    defeatedAt: number | null;
    /** The model line: only once the boss is beaten (it's never on screen whole before). */
    line: JpText | null;
  } | null;
  summary: { defeated: number; escaped: number; bestCombo: number; bossDefeated: boolean; caught: { label: string; n: number }[]; haunted: string[] } | null;
  me: {
    level: 'n4' | 'n3';
    badges: BadgeId[];
    ready: boolean;
    canAim: boolean;
    aimable: string[];
    attack: KatsuyoAttackView | null;
    last: KatsuyoLast | null;
    said: KatsuyoLast | null;
    hits: number;
    misses: number;
    recap: {
      forms: { label: string; badge: BadgeView | null; ok: boolean; counted: number }[];
      counted: { badge: BadgeView; n: number }[];
      haunted: { label: string; hear: string; tip: string | null }[];
      bossLine: JpText | null;
    } | null;
  } | null;
}

// ---------- decks ----------

const VERB_BY_ID = new Map(KATSUYO_VERBS.map((v) => [v.id, v]));
const CHUNK_BY_ID = new Map(KATSUYO_CHUNKS.map((c) => [c.id, c]));
const LINE_BY_ID = new Map(KATSUYO_BOSS_LINES.map((l) => [l.id, l]));

/** Kids rooms draw only what has no `audiences`; the others what lists them (or lists none). */
const inAudience = (x: { audiences?: readonly string[] }, a: Audience) => (a === 'kids' ? !x.audiences : !x.audiences || x.audiences.includes(a));

const verbsFor = (a: Audience) => KATSUYO_VERBS.filter((v) => inAudience(v, a));
const chunksFor = (a: Audience) => KATSUYO_CHUNKS.filter((c) => inAudience(c, a) && inAudience(VERB_BY_ID.get(c.verbId) ?? {}, a));

/** Badges a wave can deal in this room (Waves 1–2 and pieces: drill badges with a verb; Wave 3: with a chunk). */
function dealable(s: KatsuyoState, wave3: boolean): Set<BadgeId> {
  if (wave3) return new Set(chunksFor(s.audience).map((c) => c.badge));
  return new Set(verbsFor(s.audience).flatMap((v) => (Object.keys(v.forms) as BadgeId[]).filter((b) => BADGE_BY_ID[b].drill)));
}

interface InkItem {
  id: string;
  char: string;
  level: 'n4' | 'n3';
  say: JpText;
  meaning: string;
  strokes: readonly (readonly InkPoint[])[];
}

const inkDecks = new WeakMap<object, InkItem[]>();
function inkDeck(ctx: ModeContext): InkItem[] {
  let d = inkDecks.get(ctx.content);
  if (!d) {
    const strokes = new Map(ctx.content.kanjiStrokes.filter((k) => k.strokes.length).map((k) => [k.char, k.strokes]));
    d = ctx.content.writeKanji
      .filter((k) => (k.level === 'n4' || k.level === 'n3') && strokes.has(k.char))
      .map((k) => ({ id: k.id, char: k.char, level: k.level as 'n4' | 'n3', say: k.say, meaning: k.meaning, strokes: strokes.get(k.char)! }));
    inkDecks.set(ctx.content, d);
  }
  return d;
}

// ---------- the mode ----------

export const katsuyoRaidMode: Mode<KatsuyoState, KatsuyoRaidView> = {
  info: {
    id: 'kana-raid',
    title: 'Katsuyō Raid',
    titleJa: '活用レイド',
    titleKana: 'かつようレイド',
    blurb: 'Verb yōkai wearing form badges invade the Green Car. Say the form to catch them.',
    host: 'fude',
    phaseLabels: { intro: 'Badge check', prompt: 'Next wave', answer: 'Raid!', reveal: 'Wave over', score: 'Points', finale: 'Boss', encore: 'Tonight’s haul' },
    minPlayers: 1,
    maxPlayers: 8,
    roundChoices: [],
    usesPack: false,
  },

  setup(ctx, opts) {
    const players: Record<string, KatsuyoPlayer> = {};
    for (const p of ctx.players()) players[p.id] = newPlayer(p.level === 'n3' ? 'n3' : 'n4');
    const inkAvailable = inkDeck(ctx).length > 0;
    const ink = inkAvailable && opts.extra?.ink !== false;
    return {
      variant: 'katsuyo',
      wave: 0,
      waves: ink ? KATSUYO_INK_WAVE : KATSUYO_WAVES,
      ink,
      inkAvailable,
      inks: [],
      at: ctx.now,
      audience: ctx.audience ?? 'family',
      slow: !Object.values(players).some((p) => p.level === 'n3'),
      players,
      horde: [],
      combo: freshCombo(),
      comboBadges: [],
      chain: null,
      waveEndsAt: 0,
      waveResult: null,
      boss: null,
      escaped: [],
      lastCueAt: -1e15,
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
    if (phase === 'intro') cueRaid(s, ctx, 'intro', true);
    if (phase === 'prompt') {
      s.wave += 1;
      resetWave(s);
      cueRaid(s, ctx, 'raid_wave_start', true);
    }
    if (phase === 'answer') {
      buildHorde(s, ctx);
      for (const id of seatedIds(s, ctx)) assignAttack(s, id, ctx);
    }
    if (phase === 'finale') {
      s.wave = s.waves + 1;
      s.horde = [];
      resetWave(s);
      buildBoss(s, ctx);
      for (const id of seatedIds(s, ctx)) assignAttack(s, id, ctx);
      cueRaid(s, ctx, 'raid_boss', true);
    }
    if (phase === 'encore') {
      s.wave = s.waves + 2;
      const caught = Object.values(s.players).some((p) => p.stats.hits > 0);
      cueRaid(s, ctx, caught ? 'raid_catch' : 'encore_cheer', true);
    }
  },

  leave(s, phase, ctx) {
    s.at = ctx.now;
    if (phase === 'answer') {
      sweep(s, ctx);
      escapeRest(s, ctx.now);
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
    }
  },

  duration(s, phase, ctx) {
    if (phase === 'answer') return Math.max(10_000, s.waveEndsAt - ctx.now);
    if (phase === 'finale' && s.slow) return Math.round(DURATIONS.finale * SLOW);
    return DURATIONS[phase];
  },

  done(s, phase, ctx) {
    const here = ctx.connected().filter((p) => s.players[p.id]);
    if (here.length === 0) return false;
    if (phase === 'intro') return here.every((p) => s.players[p.id]!.ready);
    if (phase === 'answer') return s.horde.length > 0 && s.horde.every((y) => y.state !== 'alive' || y.escapeAt <= ctx.now);
    // The scroll keeps glowing until everyone has said their line or passed.
    if (phase === 'finale') {
      const b = s.boss;
      if (!b || b.stage !== 'blow') return false;
      // A miss with its one retry still to go isn't done.
      return here.every((x) => b.reads[x.id] !== undefined && !(b.reads[x.id] === 'missed' && s.players[x.id]!.attack));
    }
    return false;
  },

  move(s, phase, playerId, raw, ctx) {
    const p = s.players[playerId];
    if (!p) return moveError('not-playing');
    if (!isObject(raw)) return moveError('bad-move');
    switch (raw.kind) {
      case 'badges': {
        if (phase !== 'intro') return moveError('wrong-phase');
        if (!Array.isArray(raw.badges) || raw.badges.length > BADGES.length) return moveError('bad-badges');
        const valid = new Set<string>(BADGES.map((b) => b.id));
        const picked = [...new Set(raw.badges)].filter((b): b is BadgeId => typeof b === 'string' && valid.has(b));
        if (picked.length !== raw.badges.length) return moveError('bad-badges');
        // Keep at least one badge on the seat's own side (N3 seats: one each side, for the 50/50 mix).
        const sides = new Set(picked.map((b) => BADGE_BY_ID[b].side));
        if (!sides.has('n4') || (p.level === 'n3' && !sides.has('n3'))) return moveError('bad-badges');
        p.badges = BADGES.map((b) => b.id).filter((b) => picked.includes(b));
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
        if (phase !== 'intro') return moveError('wrong-phase');
        if (playerId !== ctx.vipId) return moveError('not-vip');
        if (typeof raw.on !== 'boolean') return moveError('bad-move');
        if (raw.on && !s.inkAvailable) return moveError('no-ink');
        s.ink = raw.on;
        s.waves = s.ink ? KATSUYO_INK_WAVE : KATSUYO_WAVES;
        s.at = ctx.now;
        return MOVE_OK;
      }
      case 'aim': {
        if (phase !== 'answer' || !canAimWave(s)) return moveError('wrong-phase');
        sweep(s, ctx);
        const y = typeof raw.yokaiId === 'string' ? s.horde.find((x) => x.id === raw.yokaiId) : undefined;
        if (!y || y.spawnAt > ctx.now) return moveError('gone');
        if (!isAlive(y, ctx.now)) return MOVE_OK;
        if (!y.badge || !p.badges.includes(y.badge)) return moveError('not-yours');
        if (p.attack?.yokaiId === y.id) return MOVE_OK;
        p.retryNext = null;
        if (p.last) p.last = { ...p.last, retryNext: false };
        if (p.attack) p.replaced = [...p.replaced.slice(-4), p.attack.id];
        p.attack = waveAttack(s, playerId, p, ctx, y);
        s.at = ctx.now;
        return MOVE_OK;
      }
      case 'attack': {
        if (phase !== 'answer' && phase !== 'finale') return moveError('wrong-phase');
        if (p.attack?.id !== raw.attackId) {
          const later = settleLater(s, playerId, p, raw.attackId, raw, ctx);
          if (later) return later;
        }
        const a = p.attack;
        const stale = typeof raw.attackId === 'string' && p.replaced.includes(raw.attackId);
        if (!a) return moveError(stale ? 'wrong-phase' : 'no-attack');
        if (raw.attackId !== a.id) return moveError(stale ? 'wrong-phase' : 'stale-attack');
        const ans = readAnswer(raw, a.kind === 'draw' && a.step === 'draw');
        if (!ans) return moveError('bad-answer');
        // What a Kids room's players type is checked before it can reach the screens.
        if ('say' in ans && ans.say.via === 'typed' && !playerTextAllowed(ans.say.text, ctx.audience)) return moveError('kids-words');
        s.at = ctx.now;
        sweep(s, ctx);
        return attack(s, playerId, p, a, ans, ctx);
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
    const name = (id: string | null) => (id ? (ctx.player(id)?.name ?? null) : null);
    const ids = seatedIds(s, ctx);
    const b = s.boss;
    const line = b ? LINE_BY_ID.get(b.lineId) : undefined;
    const view: KatsuyoRaidView = {
      mode: 'kana-raid',
      variant: 'katsuyo',
      wave: s.wave,
      waves: s.waves,
      ink: s.ink,
      inkAvailable: s.inkAvailable,
      inks: inBattle && isInkWave(s) ? s.inks : [],
      waveInfo: waveInfoOf(s),
      at: s.at,
      slow: s.slow,
      chart: phase === 'intro' ? BADGES.map((x) => ({ ...badgeView(x), example: x.example, goal: x.goal })) : [],
      picks: ids.map((id) => ({ playerId: id, level: s.players[id]!.level, badges: s.players[id]!.badges, ready: s.players[id]!.ready })),
      horde: inBattle ? s.horde.map((y) => yokaiView(y, aimedBy)) : [],
      combo: { count: s.combo.count, players: s.combo.players.length, lastAt: s.combo.lastAt, best: s.combo.best },
      chain: s.chain && inBattle ? { badges: s.chain.badges.map((x) => badgeView(BADGE_BY_ID[x])), at: s.chain.at } : null,
      waveResult: phase === 'reveal' || phase === 'score' ? s.waveResult : null,
      boss:
        b && line && (phase === 'finale' || phase === 'encore')
          ? {
              gist: line.gist,
              badge: badgeView(BADGE_BY_ID[line.badge]),
              pieces: b.pieces.map((x) => ({ verb: VERB_BY_ID.get(x.verbId)?.verb.kana ?? '?', badge: badgeView(BADGE_BY_ID[x.badge]), broken: !!x.by, owner: name(x.owner), by: name(x.by) })),
              stage: b.stage,
              readers: Object.entries(b.reads).filter(([, r]) => r === 'spoken' || r === 'typed').map(([id]) => id),
              defeated: b.defeated,
              defeatedAt: b.defeatedAt,
              line: b.defeated || phase === 'encore' ? line.line : null,
            }
          : null,
      summary: phase === 'encore' ? summary(s) : null,
      me: null,
    };
    if (viewer.kind === 'player') {
      const p = s.players[viewer.playerId];
      if (p) {
        const live = phase === 'answer' || phase === 'finale';
        const canAim = phase === 'answer' && canAimWave(s);
        view.me = {
          level: p.level,
          badges: p.badges,
          ready: p.ready,
          canAim,
          aimable: canAim ? s.horde.filter((y) => y.state === 'alive' && y.badge && p.badges.includes(y.badge)).map((y) => y.id) : [],
          attack: live && p.attack ? attackView(p.attack) : null,
          last: live ? p.last : null,
          said: live ? p.said : null,
          hits: p.stats.hits,
          misses: p.stats.misses,
          recap: phase === 'encore' ? playerRecap(p, line ?? null) : null,
        };
      }
    }
    return view;
  },

  practice() {
    // Saved yōkai cards are kana cards: the verb forms go in the phrasebook instead.
    return [];
  },

  awards(s, ctx) {
    const ids = seatedIds(s, ctx);
    const out: Award[] = [];
    const give = (awardId: string, fallback: { text: string; en: string }, score: (p: KatsuyoPlayer) => number) => {
      let best: string | null = null;
      let bestScore = 0;
      for (const id of ids) {
        const v = score(s.players[id]!);
        if (v > bestScore) [best, bestScore] = [id, v];
      }
      const pl = best ? ctx.player(best) : undefined;
      if (!pl) return;
      const a = ctx.content.hostAwards.find((x) => x.id === awardId);
      out.push({ playerId: pl.id, name: pl.name, title: a?.name.text ?? fallback.text, en: a?.name.en ?? fallback.en });
    };
    give('fude.award.katsuyo-master', { text: 'かつよう マスター', en: 'Form Master' }, (p) => Object.values(p.tally).filter((t) => t.correct > 0).length);
    give('fude.award.combo-champion', { text: 'コンボ チャンピオン', en: 'Combo Champion' }, (p) => p.stats.comboHits);
    give('fude.award.battle-cry', { text: 'おおごえ賞', en: 'Battle Cry' }, (p) => p.stats.spoken);
    give('fude.award.chunk-striker', { text: 'ひとこと 名人', en: 'Chunk Striker' }, (p) => p.stats.chunks);
    give('fude.award.boss-breaker', { text: 'ボス ブレイカー', en: 'Boss Breaker' }, (p) => p.stats.pieces);
    return out;
  },
};

// ---------- helpers ----------

function newPlayer(level: 'n4' | 'n3'): KatsuyoPlayer {
  return {
    level,
    // Tonight's badges, ticked from the level: an N4 seat sees the N3 badges as optional stretch.
    badges: BADGES.filter((b) => level === 'n3' || b.side === 'n4').map((b) => b.id),
    ready: false,
    attack: null,
    replaced: [],
    last: null,
    said: null,
    pendingSays: [],
    retryNext: null,
    counted: {},
    dealtBadges: {},
    deals: 0,
    tally: {},
    wave: { base: 0, bonus: 0, lost: 0, hits: 0, misses: 0, spoken: 0 },
    stats: { hits: 0, misses: 0, spoken: 0, comboHits: 0, pieces: 0, defeats: 0, chunks: 0, chains: 0, kanji: 0 },
  };
}

function resetWave(s: KatsuyoState): void {
  s.waveResult = null;
  s.horde = [];
  s.inks = [];
  s.combo = freshCombo();
  s.comboBadges = [];
  s.chain = null;
  for (const p of Object.values(s.players)) {
    p.wave = { base: 0, bonus: 0, lost: 0, hits: 0, misses: 0, spoken: 0 };
    p.last = null;
    p.said = null;
    p.pendingSays = [];
    p.retryNext = null;
  }
}

const seatedIds = (s: KatsuyoState, ctx: ModeContext): string[] => ctx.players().filter((p) => s.players[p.id]).map((p) => p.id);
const isInkWave = (s: KatsuyoState) => s.ink && s.wave === KATSUYO_INK_WAVE;
const canAimWave = (s: KatsuyoState) => s.wave === 1 || s.wave === 2;

function waveInfoOf(s: KatsuyoState) {
  if (isInkWave(s)) return KATSUYO_INK_INFO;
  if (s.wave > s.waves) return s.wave === s.waves + 1 ? KATSUYO_WAVE_INFO[4]! : null;
  return KATSUYO_WAVE_INFO[s.wave] ?? null;
}

/**
 * Badge scale: an N4 badge at N4, or an N3 badge at N3, is 1.0; an N3 stretch badge for an N4 seat 1.2; an N4
 * badge for an N3 seat 0.8 (like the kana raid's "あ for a beginner equals ヴォ for an expert").
 */
export function badgeScale(badge: BadgeId, level: 'n4' | 'n3'): number {
  const side = BADGE_BY_ID[badge].side;
  if (side === level) return 1;
  return side === 'n3' ? 1.2 : 0.8;
}

/**
 * Aim the deal: the side first (an N3 seat alternates N4 and N3; an N4 seat gets N4, with an N3 stretch one deal
 * in four if it ticked any), then, within the side, the badge this seat has said least tonight (counted says
 * first, then deals), so no frame gets more than its two spaced says while another gets none.
 */
function dealBadge(p: KatsuyoPlayer, ctx: ModeContext, allowed: ReadonlySet<BadgeId>, nth: number, extra: Partial<Record<BadgeId, number>> = {}): BadgeId | null {
  const mine = p.badges.filter((b) => allowed.has(b));
  if (!mine.length) return null;
  const n3 = p.level === 'n3' ? nth % 2 === 1 : nth % STRETCH_EVERY === STRETCH_EVERY - 1;
  const side = n3 ? 'n3' : 'n4';
  const onSide = mine.filter((b) => BADGE_BY_ID[b].side === side);
  const from = onSide.length ? onSide : mine;
  const score = (b: BadgeId) => (p.counted[b] ?? 0) * 100 + (p.dealtBadges[b] ?? 0) + (extra[b] ?? 0);
  const least = Math.min(...from.map(score));
  return pick(from.filter((b) => score(b) === least), ctx.random)!;
}

/** A verb that takes the badge in this room, avoiding the ones just used. */
function verbFor(s: KatsuyoState, badge: BadgeId, recent: readonly string[], ctx: ModeContext, unique = false): KatsuyoVerb | undefined {
  const pool = verbsFor(s.audience).filter((v) => {
    const f = v.forms[badge];
    if (!f) return false;
    // Wave 2: the form must say only one badge (たべられる is passive and "can").
    return !unique || !Object.entries(v.forms).some(([b, g]) => b !== badge && normalizeReading(g!.kana) === normalizeReading(f.kana));
  });
  const fresh = pool.filter((v) => !recent.includes(v.id));
  return pick(fresh.length ? fresh : pool, ctx.random);
}

/** Wave 2's form as it is heard: the plain form or its past (よまれる, よまれた). */
function spokenShape(badge: BadgeId, kana: string, ctx: ModeContext): string {
  const variants = formVariants(badge, kana);
  const past = variants.find((v) => v.endsWith('た') && v.length === normalizeReading(kana).length);
  return past && ctx.random() < 0.6 ? past : normalizeReading(kana);
}

// ---------- the horde ----------

function buildHorde(s: KatsuyoState, ctx: ModeContext): void {
  const ids = seatedIds(s, ctx);
  const n = ids.length || 1;
  const timing = WAVE_TIMING[s.wave] ?? WAVE_TIMING[1]!;
  const ink = isInkWave(s);
  const slow = s.wave === 3 && s.slow ? SLOW : 1;
  const hits = Math.max(1, (n === 1 ? 1 : 1 + Math.ceil(n / 3)) - (ink || s.wave === 3 ? 1 : 0));
  const count = ink ? Math.min(10, 2 + n) : s.wave === 3 ? Math.min(14, 2 + 2 * n) : Math.min(18, 5 + 2 * n);
  const recent: string[] = [];
  const horde: KatsuyoYokai[] = [];
  let t = ctx.now + 1_200;
  const wave3 = s.wave === 3;
  const allowed = dealable(s, wave3);
  const chunks = chunksFor(s.audience);
  const kanji = inkDeck(ctx);
  // Badges for the horde come from each owner's deal (aim the deal); the player's own attacks count as dealt.
  const local = new Map<KatsuyoPlayer, { nth: number; extra: Partial<Record<BadgeId, number>> }>();
  const peek = (p: KatsuyoPlayer): BadgeId | null => {
    const l = local.get(p) ?? { nth: p.deals, extra: {} };
    local.set(p, l);
    const b = dealBadge(p, ctx, allowed, l.nth, l.extra);
    l.nth += 1;
    if (b) l.extra[b] = (l.extra[b] ?? 0) + 1;
    return b;
  };
  for (let i = 0; i < count; i++) {
    const owner = s.players[ids[i % n] ?? ''] ?? newPlayer('n4');
    let y: Omit<KatsuyoYokai, 'id' | 'hp' | 'maxHp' | 'spawnAt' | 'escapeAt' | 'state' | 'endedAt' | 'hitAt'> | null = null;
    if (ink) {
      const level = owner.level === 'n3' && i % 2 === 1 ? 'n3' : 'n4';
      const pool = kanji.filter((k) => k.level === level);
      const from = (pool.length ? pool : kanji).filter((k) => !recent.includes(k.id));
      const k = pick(from.length ? from : kanji, ctx.random);
      if (k) y = { itemId: k.id, char: k.char, tag: k.say.en, badge: null };
    } else if (wave3) {
      const badge = peek(owner);
      const pool = chunks.filter((c) => c.badge === badge);
      const fresh = (pool.length ? pool : chunks).filter((c) => !recent.includes(c.id));
      const c = pick(fresh.length ? fresh : pool.length ? pool : chunks, ctx.random);
      const v = c ? VERB_BY_ID.get(c.verbId) : undefined;
      if (c && v) y = { itemId: c.id, char: c.model.kana, tag: v.verb.kana, badge: c.badge, picture: c.picture, model: c.model.kana };
    } else {
      const badge = peek(owner);
      const v = badge ? verbFor(s, badge, recent, ctx, s.wave === 2) : undefined;
      const f = badge && v ? v.forms[badge] : undefined;
      if (badge && v && f) {
        const shown = s.wave === 2 ? spokenShape(badge, f.kana, ctx) : v.verb.kana;
        y = { itemId: `${v.id}:${badge}`, char: f.kana, tag: shown, badge, ...(s.wave === 2 ? { hidden: true } : {}) };
      }
    }
    if (!y) continue;
    recent.push(y.itemId.split(':')[0]!);
    if (recent.length > 4) recent.shift();
    const walk = Math.round(timing.walk * slow * (0.9 + 0.2 * ctx.random()));
    const hp = (wave3 ? CHUNK_POINTS : BASE_POINTS) * hits;
    horde.push({ ...y, id: ctx.newId(), hp, maxHp: hp, spawnAt: t, escapeAt: t + walk, state: 'alive', endedAt: null, hitAt: null });
    t += Math.round(timing.gap * slow * (0.8 + 0.4 * ctx.random()));
  }
  s.horde = horde;
  s.waveEndsAt = horde.length ? Math.max(...horde.map((y) => y.escapeAt)) + 1_000 : ctx.now + 10_000;
}

// ---------- attacks ----------

function assignAttack(s: KatsuyoState, playerId: string, ctx: ModeContext): void {
  const p = s.players[playerId];
  if (!p) return;
  if (p.attack) p.replaced = [...p.replaced.slice(-4), p.attack.id];
  p.attack = s.wave > s.waves ? bossAttack(s, playerId, p, ctx) : waveAttack(s, playerId, p, ctx);
}

/** The yōkai this player can attack: one of their badges (waves 1–3), any kanji (Ink Storm). */
const isMine = (s: KatsuyoState, p: KatsuyoPlayer, y: KatsuyoYokai) => isInkWave(s) || (!!y.badge && p.badges.includes(y.badge));

function waveAttack(s: KatsuyoState, playerId: string, p: KatsuyoPlayer, ctx: ModeContext, aimed?: KatsuyoYokai): KatsuyoAttack | null {
  const now = ctx.now;
  const retry = aimed ? null : p.retryNext;
  p.retryNext = null;
  let yokai: KatsuyoYokai | undefined = aimed;
  if (!yokai && retry) yokai = s.horde.find((y) => y.itemId === retry.itemId && isAlive(y, now));
  if (!yokai) {
    const targeted = new Map<string, number>();
    for (const [id, other] of Object.entries(s.players)) if (id !== playerId && other.attack?.yokaiId) targeted.set(other.attack.yokaiId, (targeted.get(other.attack.yokaiId) ?? 0) + 1);
    const mine = s.horde.filter((y) => isAlive(y, now) && isMine(s, p, y));
    const onStage = mine.filter((y) => y.spawnAt <= now).sort((a, b) => along(b, now) - along(a, now));
    const next = mine.filter((y) => y.spawnAt > now).sort((a, b) => a.spawnAt - b.spawnAt)[0];
    const front = onStage.length ? onStage.slice(0, 3) : next ? [next] : [];
    // Fewest others on it, then the badge this seat has said least tonight (aim the deal).
    const need = (y: KatsuyoYokai) => (y.badge ? (p.counted[y.badge] ?? 0) * 10 + (p.dealtBadges[y.badge] ?? 0) : 0);
    front.sort((a, b) => (targeted.get(a.id) ?? 0) - (targeted.get(b.id) ?? 0) || need(a) - need(b));
    yokai = front[0];
  }
  if (!yokai) return null;
  if (yokai.spawnAt > now) bringOn(s, yokai, now);
  if (yokai.badge && !retry) {
    p.deals += 1;
    p.dealtBadges[yokai.badge] = (p.dealtBadges[yokai.badge] ?? 0) + 1;
  }
  const base = { id: ctx.newId(), yokaiId: yokai.id, itemId: yokai.itemId, retry: !!retry };
  if (isInkWave(s)) return drawAttack(base, yokai.itemId, ctx);
  if (s.wave === 3) return chunkAttack(base, yokai.itemId, p);
  const [verbId, badgeId] = yokai.itemId.split(':') as [string, BadgeId];
  const v = VERB_BY_ID.get(verbId);
  if (!v || !v.forms[badgeId]) return null;
  if (s.wave === 2) return badgeAttack(base, v, badgeId, yokai.tag, p, ctx, !!ctx.player(playerId)?.soundOff);
  return formAttack(base, 'form', v, badgeId, p, ctx);
}

type AttackBase = Pick<KatsuyoAttack, 'id' | 'yokaiId' | 'itemId' | 'retry'>;

const stretchFor = (badge: BadgeId, p: KatsuyoPlayer) => p.level === 'n4' && BADGE_BY_ID[badge].side === 'n3';

/** Wave 1 and boss pieces: the verb and its badge, big; say the form. The tap fallback is its sibling forms. */
function formAttack(base: AttackBase, kind: 'form' | 'piece', v: KatsuyoVerb, badge: BadgeId, p: KatsuyoPlayer, ctx: ModeContext, pieceIndex?: number): KatsuyoAttack {
  const form = v.forms[badge]!;
  const siblings = Object.entries(v.forms)
    .filter(([b, f]) => b !== badge && normalizeReading(f!.kana) !== normalizeReading(form.kana))
    .map(([, f]) => f!.kana);
  // Few siblings: the plain verb and a near-miss spelling of the form fill the four.
  const near = nearMisses(badge, form.kana);
  const wrong = distinct(siblings, [...near, v.verb.kana], 3, (x) => normalizeReading(x), new Set([normalizeReading(form.kana)]), ctx);
  const { options, answer } = dealOptions({ label: form.kana }, wrong.map((label) => ({ label })), ctx);
  return {
    ...base,
    kind,
    verb: v.verb,
    badge: badgeView(BADGE_BY_ID[badge]),
    ...(stretchFor(badge, p) ? { stretch: true } : {}),
    options,
    answer,
    verbId: v.id,
    badgeId: badge,
    ...(pieceIndex !== undefined ? { pieceIndex } : {}),
  };
}

/** Wrong spellings of a form that look close (for the tap fallback when a verb has few other forms). */
function nearMisses(badge: BadgeId, kana: string): string[] {
  const out: string[] = [];
  if (badge === 'saserareru') out.push(kana.replace(/される$/, 'させる'), kana.replace(/される$/, 'れる'));
  if (badge === 'passive') out.push(kana.replace(/れる$/, 'せる'));
  if (badge === 'zu-ni') out.push(kana.replace(/ずに$/, 'ないで'));
  if (badge === 'ppanashi') out.push(kana.replace(/っぱなし$/, 'たまま'));
  if (badge === 'tate') out.push(kana.replace(/たて$/, 'たち'));
  if (badge === 'kiru') out.push(kana.replace(/き(る|れない)$/, 'かける'));
  if (badge === 'kakeru') out.push(kana.replace(/かける$/, 'きる'));
  if (badge === 'you-to-suru') out.push(kana.replace(/と する$/, 'と おもう'));
  return out.filter((x) => x !== kana);
}

/** Wave 2: hear the form, tap its badge among four; then say the plain verb back. */
function badgeAttack(base: AttackBase, v: KatsuyoVerb, badge: BadgeId, shown: string, p: KatsuyoPlayer, ctx: ModeContext, soundOff: boolean): KatsuyoAttack {
  const own = Object.keys(v.forms).filter((b) => b !== badge && BADGE_BY_ID[b as BadgeId].drill) as BadgeId[];
  const others = BADGES.filter((b) => b.drill && b.id !== badge).map((b) => b.id);
  const wrong = distinct(own, others, 3, (x) => x, new Set([badge]), ctx);
  const label = (b: BadgeId) => ({ label: `${BADGE_BY_ID[b].icon} ${BADGE_BY_ID[b].ja}`, sub: BADGE_BY_ID[b].en });
  const { options, answer } = dealOptions(label(badge), wrong.map(label), ctx);
  return {
    ...base,
    kind: 'badge',
    step: 'tap',
    hear: shown,
    hearText: shown,
    ...(soundOff ? { read: true } : {}),
    ...(stretchFor(badge, p) ? { stretch: true } : {}),
    options,
    answer,
    verbId: v.id,
    badgeId: badge,
  };
}

/** Wave 3: the picture, the gist and the badge (the verb on the talisman tag); say a chunk of your own. */
function chunkAttack(base: AttackBase, chunkId: string, p: KatsuyoPlayer): KatsuyoAttack | null {
  const c = CHUNK_BY_ID.get(chunkId);
  const v = c ? VERB_BY_ID.get(c.verbId) : undefined;
  if (!c || !v) return null;
  return {
    ...base,
    kind: 'chunk',
    verb: v.verb,
    badge: badgeView(BADGE_BY_ID[c.badge]),
    ...(stretchFor(c.badge, p) ? { stretch: true } : {}),
    picture: c.picture,
    gist: c.gist,
    options: [],
    answer: '',
    verbId: v.id,
    badgeId: c.badge,
    chunkId: c.id,
  };
}

/** Ink Storm: the English and 🔊 reading of the kanji's say word, with the kanji as □; write it, then say it. */
function drawAttack(base: AttackBase, kanjiId: string, ctx: ModeContext): KatsuyoAttack | null {
  const k = inkDeck(ctx).find((x) => x.id === kanjiId);
  if (!k) return null;
  const blanked = k.say.text.length > 1 && k.say.text.includes(k.char) ? k.say.text.replace(k.char, '□') : '□';
  return {
    ...base,
    kind: 'draw',
    step: 'draw',
    hear: k.say.kana,
    hearText: k.say.kana,
    write: { blanked, kana: k.say.kana, en: k.say.en, meaning: k.meaning },
    options: [],
    answer: '',
    char: k.char,
  };
}

// ---------- the boss ----------

function buildBoss(s: KatsuyoState, ctx: ModeContext): void {
  const ids = seatedIds(s, ctx);
  const lines = KATSUYO_BOSS_LINES.filter((l) => inAudience(l, s.audience));
  // The N3 badge the room has said least tonight, among the badges someone here ticked.
  const ticked = new Set(ids.flatMap((id) => s.players[id]!.badges));
  const said = (b: BadgeId) => ids.reduce((n, id) => n + (s.players[id]!.counted[b] ?? 0), 0);
  const badges = [...new Set(lines.map((l) => l.badge))].filter((b) => ticked.has(b));
  const least = Math.min(...badges.map(said));
  const want = shuffled(badges.filter((b) => said(b) === least), ctx.random)[0];
  let pool = lines.filter((l) => !want || l.badge === want);
  // Cheeky changes only the boss lines: a Cheeky room gets a Cheeky one where there is one.
  const cheeky = pool.filter((l) => l.audiences?.length === 1 && l.audiences[0] === 'cheeky');
  if (s.audience === 'cheeky' && cheeky.length) pool = cheeky;
  const line = pick(pool.length ? pool : lines, ctx.random) ?? KATSUYO_BOSS_LINES[0]!;
  // Everyone gets a piece: past the line's own, more of its verbs' forms.
  const extra = line.pieces.flatMap((x) => {
    const v = VERB_BY_ID.get(x.verbId);
    return v ? (Object.keys(v.forms) as BadgeId[]).filter((b) => BADGE_BY_ID[b].drill && !line.pieces.some((y) => y.verbId === x.verbId && y.badge === b)).map((b) => ({ verbId: x.verbId, badge: b })) : [];
  });
  const want2 = Math.max(line.pieces.length, Math.min(8, ids.length));
  const all = [...line.pieces, ...shuffled(extra, ctx.random)].slice(0, want2);
  const pieces = all.map((x, i) => ({ verbId: x.verbId, badge: x.badge, owner: ids.length ? ids[i % ids.length]! : null, by: null as string | null }));
  s.boss = { lineId: line.id, pieces, stage: 'break', reads: {}, defeated: false, defeatedAt: null };
}

function bossAttack(s: KatsuyoState, playerId: string, p: KatsuyoPlayer, ctx: ModeContext): KatsuyoAttack | null {
  const b = s.boss;
  const line = b ? LINE_BY_ID.get(b.lineId) : undefined;
  if (!b || !line) return null;
  const base = { id: ctx.newId(), yokaiId: null, retry: false };
  if (b.stage === 'blow') {
    const r = b.reads[playerId];
    if (r && (r !== 'missed' || p.retryNext?.kind !== 'blow')) return null;
    const retry = r === 'missed';
    p.retryNext = null;
    const v = VERB_BY_ID.get(line.verbId);
    return {
      ...base,
      retry,
      itemId: `katsuyo-boss:${line.id}`,
      kind: 'blow',
      gist: line.gist,
      badge: badgeView(BADGE_BY_ID[line.badge]),
      ...(v ? { verb: v.verb } : {}),
      options: [],
      answer: '',
      verbId: line.verbId,
      badgeId: line.badge,
    };
  }
  const retry = p.retryNext;
  p.retryNext = null;
  let index = b.pieces.findIndex((x) => !x.by && x.owner === playerId);
  if (index < 0) {
    // Done with your own: help with one whose owner left, or anyone's.
    const open = b.pieces.map((x, i) => ({ x, i })).filter(({ x }) => !x.by);
    const ownerGone = open.find(({ x }) => !x.owner || !ctx.player(x.owner)?.connected);
    index = (ownerGone ?? open[0])?.i ?? -1;
  }
  if (index < 0) return null;
  const piece = b.pieces[index]!;
  const v = VERB_BY_ID.get(piece.verbId);
  if (!v || !v.forms[piece.badge]) return null;
  return formAttack({ ...base, itemId: `${v.id}:${piece.badge}`, retry: !!retry }, 'piece', v, piece.badge, p, ctx, index);
}

// ---------- answers ----------

type Answer = { pick: string } | { say: Utterance } | { pass: true } | { ink: InkPoint[][] } | { pending: true };

function readAnswer(raw: Record<string, unknown>, drawing: boolean): Answer | null {
  if (raw.ink !== undefined) {
    if (!drawing) return null;
    const ink = readInk(raw.ink, KANJI_LIMITS);
    return ink ? { ink } : null;
  }
  if (typeof raw.pick === 'string' && raw.pick.length <= 8) return { pick: raw.pick };
  if (isUtterance(raw.say)) return { say: raw.say };
  if (raw.pass === true) return { pass: true };
  if (raw.pending === true) return { pending: true };
  return null;
}

const spokenVia = (u: Utterance) => u.via === 'speech';

function attack(s: KatsuyoState, playerId: string, p: KatsuyoPlayer, a: KatsuyoAttack, ans: Answer, ctx: ModeContext): MoveResult {
  switch (a.kind) {
    case 'form':
    case 'piece':
      return formAnswer(s, playerId, p, a, ans, ctx);
    case 'badge': {
      const v = VERB_BY_ID.get(a.verbId ?? '');
      if (!v || !a.badgeId) return moveError('bad-attack');
      if (a.step === 'tap') {
        if (!('pick' in ans) || !a.options.some((o) => o.id === ans.pick)) return moveError('bad-answer');
        const right = ans.pick === a.answer;
        const form = v.forms[a.badgeId]!;
        const tip = right ? null : `${a.hear} wears ${BADGE_BY_ID[a.badgeId].ja} (${BADGE_BY_ID[a.badgeId].en}): ${v.verb.kana} → ${form.kana}.`;
        p.last = hitOrMiss(s, playerId, p, a, right, 'tap', ctx, { label: a.hear ?? form.kana, hear: a.hear ?? form.kana, tip, badge: a.badgeId, points: BASE_POINTS, phrase: { itemId: `katsuyo:${v.id}:${a.badgeId}`, text: form.text, kana: form.kana, en: `${v.verb.kana} · ${BADGE_BY_ID[a.badgeId].en}: ${form.en}` } });
        // Either way, say the plain verb next: the out-loud moment.
        a.step = 'say';
        a.id = ctx.newId();
        return MOVE_OK;
      }
      if ('pending' in ans) return sayLater(s, playerId, p, a, ctx);
      const said = sayVerb(s, playerId, p, a, v, ans, ctx);
      if (!said) return moveError('bad-answer');
      p.last = said;
      assignAttack(s, playerId, ctx);
      return MOVE_OK;
    }
    case 'chunk': {
      if ('pending' in ans) return sayLater(s, playerId, p, a, ctx);
      const res = chunkAnswer(s, playerId, p, a, ans, ctx);
      if (!res) return moveError('bad-answer');
      p.last = res;
      assignAttack(s, playerId, ctx);
      return MOVE_OK;
    }
    case 'draw': {
      const k = inkDeck(ctx).find((x) => x.id === a.itemId);
      if (!k) return moveError('bad-attack');
      if (a.step === 'draw') return drawAnswer(s, playerId, p, a, k, ans, ctx);
      if ('pending' in ans) return sayLater(s, playerId, p, a, ctx);
      const said = sayKanji(s, playerId, p, a, k, ans, ctx);
      if (!said) return moveError('bad-answer');
      p.last = said;
      assignAttack(s, playerId, ctx);
      return MOVE_OK;
    }
    case 'blow':
      return blowAnswer(s, playerId, p, a, ans, ctx);
  }
}

interface HitInfo {
  label: string;
  hear: string;
  tip: string | null;
  badge: BadgeId | null;
  /** The hit's points before badge scale (100 a form, 150 a chunk; boss pieces double). */
  points: number;
  /** The phrasebook card: what was said or the form, and which frames it may count for. */
  phrase: { itemId: string; text: string; kana: string; en: string; frames?: readonly string[] } | null;
  /** Counted toward the path (a chunk said from memory with the player's own word). */
  counted?: boolean;
  /** Who pays for a wrong answer: taps cost TAP_MISS, says nothing. */
  noRetry?: boolean;
}

function tallyOf(p: KatsuyoPlayer, a: KatsuyoAttack, info: HitInfo): Tally {
  return (p.tally[a.itemId] ??= { label: info.label, hear: info.hear, badge: info.badge, seen: 0, correct: 0, missed: 0, counted: 0, tip: null });
}

/** Settles a wave hit or miss: points, damage, the combo, the badge chain, the phrasebook. */
/**
 * `how`: spoken (full damage, the speaking bonus, from memory), quiet (typed: 70% damage), tap (70% damage, a
 * wrong one costs TAP_MISS) or clean (an Ink Storm drawing written cleanly: full damage, the bonus is for saying it).
 */
function hitOrMiss(s: KatsuyoState, playerId: string, p: KatsuyoPlayer, a: KatsuyoAttack, ok: boolean, how: 'spoken' | 'quiet' | 'tap' | 'clean', ctx: ModeContext, info: HitInfo): KatsuyoLast {
  const t = tallyOf(p, a, info);
  t.seen += 1;
  const log = (outcome: 'said' | 'retry' | 'missed' | 'seen') => {
    if (info.phrase) ctx.phrase(playerId, { ...info.phrase, outcome, recall: how === 'spoken' ? 'memory' : 'read' });
  };
  if (!ok) {
    t.missed += 1;
    t.tip = info.tip;
    p.stats.misses += 1;
    p.wave.misses += 1;
    const retryNext = !a.retry && !info.noRetry && a.kind !== 'badge';
    p.retryNext = retryNext ? { itemId: a.itemId, kind: a.kind } : null;
    log('missed');
    // A wrong tap costs a little, to blunt guessing; a spoken (or typed) miss is free.
    const lost = how === 'tap' ? dock(p, ctx, playerId) : 0;
    return { attackId: a.id, ok: false, kind: a.kind, label: info.label, hear: info.hear, points: -lost, damage: 0, tip: info.tip, combo: s.combo.count, splash: false, retryNext, counted: false };
  }
  const scale = info.badge ? badgeScale(info.badge, p.level) : 1;
  const base = Math.round(info.points * scale);
  const hit = strike(s, playerId, a.yokaiId, how === 'spoken' || how === 'clean' ? base : base * QUIET_DAMAGE, ctx);
  if (hit.teamCombo) p.stats.comboHits += 1;
  if (hit.defeated) p.stats.defeats += 1;
  chainBadge(s, p, info.badge, hit.combo, ctx);
  ctx.award(playerId, base);
  p.wave.base += base;
  p.wave.hits += 1;
  p.stats.hits += 1;
  t.correct += 1;
  if (info.counted) t.counted += 1;
  let bonus = 0;
  if (how === 'spoken') {
    bonus = payBonus(p, ctx, playerId, Math.round(base * SPEAK_BONUS));
    p.wave.spoken += 1;
    p.stats.spoken += 1;
  }
  log(how === 'spoken' ? 'said' : a.retry ? 'retry' : 'seen');
  if (hit.target?.caughtBy === playerId && hit.target.endedAt === ctx.now) hit.target.caughtPoints = base + bonus;
  return { attackId: a.id, ok: true, kind: a.kind, label: info.label, hear: info.hear, points: base + bonus, damage: hit.damage, tip: null, combo: hit.teamCombo ? hit.combo : 0, splash: hit.splash, retryNext: false, counted: !!info.counted };
}

function dock(p: KatsuyoPlayer, ctx: ModeContext, playerId: string): number {
  const lost = Math.min(TAP_MISS, ctx.player(playerId)?.score ?? 0);
  if (lost > 0) {
    ctx.award(playerId, -lost);
    p.wave.lost += lost;
  }
  return lost;
}

/** Badge chains: three different badges inside one team combo flash together on the TV. */
function chainBadge(s: KatsuyoState, p: KatsuyoPlayer, badge: BadgeId | null, combo: number, ctx: ModeContext): void {
  if (combo <= 1) s.comboBadges = [];
  if (!badge) return;
  if (!s.comboBadges.includes(badge)) s.comboBadges.push(badge);
  if (s.comboBadges.length === CHAIN && s.combo.players.length >= 2) {
    s.chain = { badges: [...s.comboBadges], at: ctx.now };
    p.stats.chains += 1;
    cueRaid(s, ctx, 'raid_combo');
  }
}

/** Wave 1 forms and boss pieces: said (or typed) and checked against the closed set, or tapped. */
function formAnswer(s: KatsuyoState, playerId: string, p: KatsuyoPlayer, a: KatsuyoAttack, ans: Answer, ctx: ModeContext): MoveResult {
  const v = VERB_BY_ID.get(a.verbId ?? '');
  const badge = a.badgeId;
  if (!v || !badge || !v.forms[badge]) return moveError('bad-attack');
  const form = v.forms[badge]!;
  let ok: boolean;
  let how: 'spoken' | 'quiet' | 'tap';
  let sibling: BadgeId | null = null;
  if ('pick' in ans) {
    if (!a.options.some((o) => o.id === ans.pick)) return moveError('bad-answer');
    ok = ans.pick === a.answer;
    how = 'tap';
    const picked = a.options.find((o) => o.id === ans.pick)?.label ?? '';
    if (!ok) sibling = checkForm([normalizeReading(picked)], v, badge).sibling;
  } else if ('say' in ans) {
    const check = checkForm(heard(ans.say), v, badge);
    ok = check.ok;
    sibling = check.sibling;
    how = spokenVia(ans.say) ? 'spoken' : 'quiet';
  } else return moveError('bad-answer');
  const tip = ok ? null : formTip(v, badge, sibling);
  // Bare forms move no goal (frames: []): a conjugation said alone is recall of a form, not a frame in a sentence.
  const phrase = { itemId: `katsuyo:${v.id}:${badge}`, text: form.text, kana: form.kana, en: `${v.verb.kana} · ${BADGE_BY_ID[badge].en}: ${form.en}`, frames: [] as string[] };
  if (a.kind === 'form') {
    p.last = hitOrMiss(s, playerId, p, a, ok, how, ctx, { label: form.kana, hear: form.kana, tip, badge, points: BASE_POINTS, phrase });
    assignAttack(s, playerId, ctx);
    return MOVE_OK;
  }
  return pieceAnswer(s, playerId, p, a, ok, how, tip, form, badge, phrase, ctx);
}

function pieceAnswer(
  s: KatsuyoState,
  playerId: string,
  p: KatsuyoPlayer,
  a: KatsuyoAttack,
  ok: boolean,
  how: 'spoken' | 'quiet' | 'tap',
  tip: string | null,
  form: { kana: string },
  badge: BadgeId,
  phrase: NonNullable<HitInfo['phrase']>,
  ctx: ModeContext,
): MoveResult {
  const b = s.boss;
  const piece = b?.pieces[a.pieceIndex ?? -1];
  if (!b || !piece) return moveError('bad-attack');
  const t = tallyOf(p, a, { label: form.kana, hear: form.kana, tip, badge, points: 0, phrase });
  t.seen += 1;
  const recall = how === 'spoken' ? ('memory' as const) : ('read' as const);
  if (!ok) {
    t.missed += 1;
    t.tip = tip;
    p.stats.misses += 1;
    p.wave.misses += 1;
    p.retryNext = { itemId: a.itemId, kind: 'piece' };
    ctx.phrase(playerId, { ...phrase, outcome: 'missed', recall });
    const lost = how === 'tap' ? dock(p, ctx, playerId) : 0;
    p.last = { attackId: a.id, ok: false, kind: 'piece', label: form.kana, hear: form.kana, points: -lost, damage: 0, tip, combo: 0, splash: false, retryNext: true, counted: false };
  } else {
    const splash = !!piece.by;
    if (!piece.by) piece.by = playerId;
    // The last round is worth double.
    const base = 2 * Math.round(BASE_POINTS * badgeScale(badge, p.level));
    ctx.award(playerId, base);
    p.wave.base += base;
    p.wave.hits += 1;
    p.stats.hits += 1;
    if (!splash) p.stats.pieces += 1;
    t.correct += 1;
    const bonus = how === 'spoken' ? payBonus(p, ctx, playerId, Math.round(base * SPEAK_BONUS)) : 0;
    if (how === 'spoken') p.stats.spoken += 1;
    ctx.phrase(playerId, { ...phrase, outcome: how === 'spoken' ? 'said' : 'seen', recall });
    p.last = { attackId: a.id, ok: true, kind: 'piece', label: form.kana, hear: form.kana, points: base + bonus, damage: base, tip: null, combo: 0, splash, retryNext: false, counted: false };
    if (!splash) cueRaid(s, ctx, 'raid_hit');
  }
  if (b.pieces.every((x) => x.by)) {
    if (b.stage === 'break') {
      b.stage = 'blow';
      cueRaid(s, ctx, 'kakegoe_call', true);
      for (const id of seatedIds(s, ctx)) assignAttack(s, id, ctx);
    }
  } else assignAttack(s, playerId, ctx);
  return MOVE_OK;
}

/** Wave 2's say step: the plain verb back, for the bonus (or skip it). */
function sayVerb(s: KatsuyoState, playerId: string, p: KatsuyoPlayer, a: KatsuyoAttack, v: KatsuyoVerb, ans: Answer, ctx: ModeContext): KatsuyoLast | null {
  let ok = false;
  let spoken = false;
  if ('say' in ans) {
    const plain = normalizeReading(v.verb.kana);
    const masu = v.group === 'godan' ? null : plain.replace(/る$/, 'ます');
    ok = heard(ans.say).some((h) => h === plain || h.endsWith(plain) || (!!masu && h === masu));
    spoken = spokenVia(ans.say);
  } else if (!('pass' in ans)) return null;
  const bonus = ok && spoken ? payBonus(p, ctx, playerId, Math.round(BASE_POINTS * SPEAK_BONUS)) : 0;
  if (ok && spoken) {
    p.wave.spoken += 1;
    p.stats.spoken += 1;
    // The plain verb, heard back from its form: a phrasebook card that moves no goal.
    ctx.phrase(playerId, { itemId: `katsuyo-verb:${v.id}`, text: v.verb.text, kana: v.verb.kana, en: v.verb.en, outcome: 'said', recall: 'memory', frames: [] });
  }
  return {
    attackId: a.id,
    ok: ok || 'pass' in ans,
    kind: 'badge',
    label: v.verb.kana,
    hear: v.verb.kana,
    points: bonus,
    damage: 0,
    tip: ok || 'pass' in ans ? null : `The plain verb is ${v.verb.kana} (${v.verb.en}).`,
    combo: s.combo.count,
    splash: false,
    retryNext: false,
    counted: false,
  };
}

/** Wave 3: a chunk of the player's own. Counts toward the path only when spoken, with the frame and an own word. */
function chunkAnswer(s: KatsuyoState, playerId: string, p: KatsuyoPlayer, a: KatsuyoAttack, ans: Answer, ctx: ModeContext): KatsuyoLast | null {
  const c = CHUNK_BY_ID.get(a.chunkId ?? '');
  const v = c ? VERB_BY_ID.get(c.verbId) : undefined;
  if (!c || !v) return null;
  const badge = c.badge;
  const B = BADGE_BY_ID[badge];
  if ('pass' in ans) {
    const t = tallyOf(p, a, { label: c.model.kana, hear: c.model.kana, tip: null, badge, points: 0, phrase: null });
    t.seen += 1;
    t.tip = `Fude’s version: ${c.model.kana}`;
    return { attackId: a.id, ok: true, kind: 'chunk', label: c.model.kana, hear: c.model.kana, points: 0, damage: 0, tip: `Fude’s version: ${c.model.kana}`, combo: s.combo.count, splash: false, retryNext: false, counted: false };
  }
  if (!('say' in ans)) return null;
  const u = ans.say;
  const check = checkLine(u, v, badge);
  const spoken = spokenVia(u);
  const said = (u.reading ?? u.text).trim();
  let tip: string | null = null;
  if (!check.ok) {
    if (!check.verb) tip = `Use ${v.verb.kana} as ${B.ja} (${B.en}): ${v.forms[badge]?.kana ?? ''}. Fude’s version: ${c.model.kana}`;
    else if (!check.ownWord) tip = `Add a word of your own to the form, like ${c.model.kana}.`;
    else tip = `The badge wants ${B.en} (${B.ja}). Fude’s version: ${c.model.kana}`;
  }
  // Said with the player's own words: the card is what they said, so a new noun is a new filler.
  const counted = check.ok && spoken;
  if (counted) {
    p.counted[badge] = (p.counted[badge] ?? 0) + 1;
    p.stats.chunks += 1;
  }
  const phrase = check.ok ? { itemId: `katsuyo-chunk:${normalizeReading(said)}`, text: u.text, kana: u.reading ?? u.text, en: c.gist } : { itemId: `katsuyo-chunk:${c.id}`, text: c.model.text, kana: c.model.kana, en: c.gist, frames: [] as string[] };
  const res = hitOrMiss(s, playerId, p, a, check.ok, spoken ? 'spoken' : 'quiet', ctx, { label: check.ok ? said : c.model.kana, hear: check.ok ? said : c.model.kana, tip, badge, points: CHUNK_POINTS, phrase, counted, noRetry: true });
  return res;
}

/** Ink Storm: grade the kanji. A pass hits (full damage clean, 70% messy) and asks to say the word. */
function drawAnswer(s: KatsuyoState, playerId: string, p: KatsuyoPlayer, a: KatsuyoAttack, k: InkItem, ans: Answer, ctx: ModeContext): MoveResult {
  if (!('ink' in ans)) return moveError('bad-answer');
  const g = gradeInk(ans.ink, k.strokes);
  const tip = g.clean ? null : inkTipText(g, k.char, k.strokes);
  // Written wrong: the card comes back tomorrow (logged now); written right, it's logged once the word is said.
  const res = hitOrMiss(s, playerId, p, a, g.pass, g.clean ? 'clean' : 'quiet', ctx, { label: k.char, hear: k.say.kana, tip, badge: null, points: BASE_POINTS, phrase: g.pass ? null : { itemId: k.id, text: k.say.text, kana: k.say.kana, en: k.say.en } });
  if (g.pass) p.stats.kanji += 1;
  const mine = ans.ink.map((x) => thin(x, REPLAY_POINTS));
  res.tip = tip;
  res.ink = { mine, ref: k.strokes.map((x) => thin(x, REPLAY_POINTS)), clean: g.clean, score: g.shapeScore };
  p.last = res;
  s.inks = [...s.inks.slice(1 - STAGE_INKS), { id: a.id, playerId, char: k.char, strokes: mine, ok: g.pass, clean: g.clean, at: ctx.now }];
  if (g.pass) {
    a.step = 'say';
    a.id = ctx.newId();
    a.word = k.say;
    return MOVE_OK;
  }
  assignAttack(s, playerId, ctx);
  return MOVE_OK;
}

/** After a kanji that landed: say its word. Shodō's item id, from memory: it was written from the prompt. */
function sayKanji(s: KatsuyoState, playerId: string, p: KatsuyoPlayer, a: KatsuyoAttack, k: InkItem, ans: Answer, ctx: ModeContext): KatsuyoLast | null {
  let ok = false;
  let spoken = false;
  if ('say' in ans) {
    const want = normalizeReading(k.say.kana);
    ok = heard(ans.say).some((h) => h === want || h.includes(want));
    spoken = spokenVia(ans.say);
  } else if (!('pass' in ans)) return null;
  const bonus = ok && spoken ? payBonus(p, ctx, playerId, Math.round(BASE_POINTS * SPEAK_BONUS)) : 0;
  if (ok && spoken) {
    p.wave.spoken += 1;
    p.stats.spoken += 1;
  }
  ctx.phrase(playerId, { itemId: k.id, text: k.say.text, kana: k.say.kana, en: k.say.en, outcome: ok && spoken ? 'said' : 'seen', recall: 'memory' });
  return {
    attackId: a.id,
    ok: ok || 'pass' in ans,
    kind: 'draw',
    label: k.say.text,
    hear: k.say.kana,
    points: bonus,
    damage: 0,
    tip: ok || 'pass' in ans ? null : `${k.say.text} reads ${k.say.kana} (${k.say.en}).`,
    combo: s.combo.count,
    splash: false,
    retryNext: false,
    counted: false,
  };
}

/** The finishing blow: the whole line from the gist. It falls to the first right one; the rest still say theirs. */
function blowAnswer(s: KatsuyoState, playerId: string, p: KatsuyoPlayer, a: KatsuyoAttack, ans: Answer, ctx: ModeContext): MoveResult {
  const b = s.boss;
  const line = b ? LINE_BY_ID.get(b.lineId) : undefined;
  const v = line ? VERB_BY_ID.get(line.verbId) : undefined;
  if (!b || !line || !v) return moveError('bad-attack');
  if ('pass' in ans) {
    b.reads[playerId] = 'pass';
    p.attack = null;
    return MOVE_OK;
  }
  if (!('say' in ans)) return moveError('bad-answer');
  const u = ans.say;
  const spoken = spokenVia(u);
  const check = checkLine(u, v, line.badge, 4);
  const ok = check.ok;
  const B = BADGE_BY_ID[line.badge];
  b.reads[playerId] = ok ? (spoken ? 'spoken' : 'typed') : 'missed';
  let points = 0;
  if (ok) {
    const base = spoken ? BLOW_POINTS.spoken : BLOW_POINTS.typed;
    ctx.award(playerId, base);
    p.wave.base += base;
    points = base + (spoken ? payBonus(p, ctx, playerId, Math.round(base * SPEAK_BONUS)) : 0);
    if (spoken) {
      p.stats.spoken += 1;
      p.counted[line.badge] = (p.counted[line.badge] ?? 0) + 1;
    }
    if (!b.defeated) {
      b.defeated = true;
      b.defeatedAt = ctx.now;
      cueRaid(s, ctx, 'raid_catch', true);
    }
  }
  // The model line, counting only for the frames heard in the player's own line (as Late Again! credits Pon's line).
  const heardText = { text: u.text, kana: u.reading ?? u.text };
  const frames = ok ? framesHeard(line.line, heardText, u.tokens) : [];
  ctx.phrase(playerId, { itemId: `katsuyo-boss:${line.id}`, text: line.line.text, kana: line.line.kana, en: line.gist, outcome: ok ? (spoken ? 'said' : 'seen') : 'missed', recall: spoken ? 'memory' : 'read', frames });
  const retryNext = !ok && !a.retry;
  p.retryNext = retryNext ? { itemId: a.itemId, kind: 'blow' } : null;
  const tip = ok ? null : !check.verb ? `It turns on ${v.verb.kana} as ${B.ja} (${B.en}): ${v.forms[line.badge]?.kana ?? ''}.` : `The badge wants ${B.en} (${B.ja}).`;
  p.last = { attackId: a.id, ok, kind: 'blow', label: ok ? line.line.kana : line.gist, hear: line.line.kana, points, damage: 0, tip, combo: 0, splash: false, retryNext, counted: ok && spoken };
  p.attack = null;
  if (retryNext) assignAttack(s, playerId, ctx);
  return MOVE_OK;
}

/** The player spoke and the phone is checking the recording: move them on now, and score it when it comes back. */
function sayLater(s: KatsuyoState, playerId: string, p: KatsuyoPlayer, a: KatsuyoAttack, ctx: ModeContext): MoveResult {
  p.pendingSays = [...p.pendingSays.filter((x) => ctx.now - x.at < SAY_LATER_MS).slice(-2), { attack: { ...a, options: [...a.options] }, at: ctx.now }];
  assignAttack(s, playerId, ctx);
  return MOVE_OK;
}

function settleLater(s: KatsuyoState, playerId: string, p: KatsuyoPlayer, attackId: unknown, raw: Record<string, unknown>, ctx: ModeContext): MoveResult | null {
  const i = p.pendingSays.findIndex((x) => x.attack.id === attackId);
  if (i < 0) return null;
  const { attack: a, at } = p.pendingSays[i]!;
  p.pendingSays.splice(i, 1);
  if (ctx.now - at >= SAY_LATER_MS) return moveError('wrong-phase');
  const ans = readAnswer(raw, false);
  if (!ans || !('say' in ans || 'pass' in ans)) return moveError('bad-answer');
  if ('say' in ans && ans.say.via === 'typed' && !playerTextAllowed(ans.say.text, ctx.audience)) return moveError('kids-words');
  let said: KatsuyoLast | null = null;
  if (a.kind === 'badge') {
    const v = VERB_BY_ID.get(a.verbId ?? '');
    if (v) said = sayVerb(s, playerId, p, a, v, ans, ctx);
  } else if (a.kind === 'chunk') {
    sweep(s, ctx);
    said = chunkAnswer(s, playerId, p, a, ans, ctx);
  } else if (a.kind === 'draw') {
    const k = inkDeck(ctx).find((x) => x.id === a.itemId);
    if (k) said = sayKanji(s, playerId, p, a, k, ans, ctx);
  }
  if (!said) return moveError('bad-attack');
  p.said = said;
  s.at = ctx.now;
  return MOVE_OK;
}

// ---------- views ----------

function yokaiView(y: KatsuyoYokai, aimedBy: Map<string, string[]>): KatsuyoYokaiView {
  const aimers = aimedBy.get(y.id);
  const shown = y.state === 'defeated';
  return {
    ...(aimers?.length && y.state === 'alive' ? { aimedBy: aimers } : {}),
    id: y.id,
    tag: y.tag,
    // Wave 2 hides the badge behind a question mark until the yōkai is caught.
    badge: y.badge && (!y.hidden || shown) ? badgeView(BADGE_BY_ID[y.badge]) : null,
    ...(y.hidden && !shown ? { hidden: true } : {}),
    ...(y.picture ? { picture: y.picture } : {}),
    // The TV never shows a transcript: once a chunk yōkai is caught it shows Fude's model chunk.
    ...(y.model && shown ? { model: y.model } : {}),
    hp: y.hp,
    maxHp: y.maxHp,
    spawnAt: y.spawnAt,
    escapeAt: y.escapeAt,
    state: y.state,
    endedAt: y.endedAt,
    hitAt: y.hitAt,
    ...(y.caughtBy ? { caughtBy: y.caughtBy, caughtPoints: y.caughtPoints ?? 0 } : {}),
  };
}

function attackView(a: KatsuyoAttack): KatsuyoAttackView {
  const { answer: _a, verbId: _v, badgeId: _b, chunkId: _c, char: _k, pieceIndex: _i, itemId: _id, ...rest } = a;
  // Wave 2's badge is the answer while it's being tapped.
  if (a.kind === 'badge' && a.step === 'tap') delete rest.badge;
  return rest;
}

function summary(s: KatsuyoState): NonNullable<KatsuyoRaidView['summary']> {
  const caught = new Map<string, number>();
  const haunted = new Set<string>(s.escaped.map((e) => e.char));
  for (const p of Object.values(s.players)) {
    for (const t of Object.values(p.tally)) {
      if (t.correct > 0) caught.set(t.label, (caught.get(t.label) ?? 0) + t.correct);
      if (t.missed > 0) haunted.add(t.label);
    }
  }
  return {
    defeated: s.defeatedTotal,
    escaped: s.escaped.length,
    bestCombo: s.bestCombo,
    bossDefeated: !!s.boss?.defeated,
    caught: [...caught].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n),
    haunted: [...haunted],
  };
}

function playerRecap(p: KatsuyoPlayer, line: KatsuyoBossLine | null): NonNullable<NonNullable<KatsuyoRaidView['me']>['recap']> {
  const all = Object.values(p.tally);
  return {
    forms: all.map((t) => ({ label: t.label, badge: t.badge ? badgeView(BADGE_BY_ID[t.badge]) : null, ok: t.correct > 0, counted: t.counted })),
    counted: BADGES.filter((b) => (p.counted[b.id] ?? 0) > 0).map((b) => ({ badge: badgeView(b), n: p.counted[b.id]! })),
    haunted: all.filter((t) => t.missed > 0).map((t) => ({ label: t.label, hear: t.hear, tip: t.tip })),
    bossLine: line?.line ?? null,
  };
}

/** Chunks a bot (or a test) can build: the deck, read-only. */
export const katsuyoDeck = { verbs: KATSUYO_VERBS, chunks: KATSUYO_CHUNKS as readonly KatsuyoChunk[], lines: KATSUYO_BOSS_LINES };
