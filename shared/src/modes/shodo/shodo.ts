// Shodō Taikai (書道大会, the Calligraphy Contest), hosted by Fude in a quiet register.
// See docs/modes/shodo.md.
//
// Three rounds, each player writing at their own level (kana, N5 kanji, N4 kanji and words):
//
//   1. お手本 (prompt): three targets each, said aloud first, then traced over a ghost, traced
//      over a faint ghost and written from memory, interleaved (trace A B C, faint A B C, memory
//      A B C). Traced strokes are checked one at a time on the phone as the finger lifts (the
//      server checks them again); the memory rep is graded whole. The TV fills one shared scroll,
//      and the room reads it aloud together (score: せーの).
//   2. 書き取り (answer → reveal, three items): "say it, then write it" (English shown, say the
//      word from memory, then write it) alternating with dictation (hear it, write it). Each item
//      ends in a synchro replay on the TV: every sheet brushes on together, stroke by stroke.
//   3. 展覧会 (encore → finale → penalty): one big sheet from a shared theme, then say a sentence
//      about it; the TV hangs every sheet anonymously and players give hanko stamps (never a
//      "worst"); then anyone may claim their sheet and the room reads them all as a send-off.
//
// Writing never earns the speaking bonus; only saying does. Speaking bonuses are settled when a
// phase ends, capped at 30% of a player's points (design doc, Scoring).

import type { JpText, Level } from '../../../../content/src/types.js';
import { isUtterance, matchesAccepted, utteranceReading, type Utterance } from '../../japanese/kana.js';
import { toRomaji } from '../../japanese/romaji.js';
import { checkStroke, gradeInk, KANJI_LIMITS, readInk, TRACE_TOLERANCE_LOOSE, type InkGrade, type InkPoint, type InkStroke } from '../../japanese/strokes.js';
import type { Phase, Viewer } from '../../protocol.js';
import { isObject, moveError, MOVE_OK, shuffled, type Award, type Mode, type ModeContext, type MoveResult } from '../mode.js';
import { buildDeck, deal, dictationPool, galleryTarget, practicePool, type ShodoDeck, type Target } from './deck.js';

// ---- tuning ----

export const POINTS = {
  trace: 10,
  faint: 15,
  memoryClean: 50,
  memoryPass: 30,
  /** Dictation, before the stroke-count scale. */
  writeClean: 100,
  writePass: 60,
  /** The gallery: per stamp received (capped), and the grader's own marks. */
  stamp: 30,
  stampCap: 120,
  galleryClean: 40,
  galleryPass: 20,
};

/** Saying it: aloud earns more than typed; from memory (dictation's "say it first") more again. */
export const SAY_BONUS = { speech: 20, typed: 5, recall: 40 };
/** Speaking bonuses are at most 30% of a player's points. */
export const BONUS_SHARE = 0.3;

export const DURATIONS = {
  intro: 14_000,
  practice: 100_000,
  read: 12_000,
  item: 45_000,
  replay: 10_000,
  gallery: 60_000,
  vote: 35_000,
  claim: 16_000,
};

export const ITEMS = 3;
/** Stamps each player gives in the gallery, one per award. */
export const STAMPS = 3;
/** Fewer players than this: no vote, the gallery goes straight to the send-off. */
export const MIN_VOTERS = 3;

/** The gallery's hanko awards (comedy and Japanese panels): kind ones only, never a "worst". */
export const AWARDS = [
  { id: 'tappitsu', ja: 'たっぴつ賞', en: 'Fine brush' },
  { id: 'oshii', ja: 'おしかったで賞', en: 'So close' },
  { id: 'doubutsu', ja: 'どうぶつに みえるで賞', en: 'Looks like an animal' },
  { id: 'sumi', ja: 'すみだらけで賞', en: 'Covered in ink' },
] as const;
export type AwardId = (typeof AWARDS)[number]['id'];
const AWARD_IDS = new Set<string>(AWARDS.map((a) => a.id));

/** One synchro-replay stroke slot: 3.6 s for the whole character, 180–450 ms a stroke (motion panel). */
export const replaySlotMs = (strokes: number): number => Math.round(Math.min(450, Math.max(180, 3600 / Math.max(1, strokes))));

// ---- state ----

export type RepKind = 'trace' | 'faint' | 'memory';
export type Via = Utterance['via'];

export interface Rep {
  target: number;
  kind: RepKind;
}

export interface RepResult extends Rep {
  ok: boolean;
  clean: boolean;
  strokes: InkPoint[][];
}

export interface Practice {
  targets: Target[];
  reps: Rep[];
  /** Index of the next rep to write. */
  next: number;
  results: RepResult[];
  /** Per target: said aloud, typed, or skipped (null). Undefined until asked. */
  said: (Via | null | undefined)[];
  /** Strokes Fude had to correct on the phone (for the 努力賞). */
  corrections: number;
  points: number;
}

export interface Sheet {
  playerId: string;
  target: Target;
  /** Strokes per character cell. */
  cells: InkPoint[][][];
  pass: boolean;
  clean: boolean;
  shape: number;
  /** The first stroke (0-based, across all cells) written out of order, for the replay. */
  outOfOrder: number | null;
  /** A look-alike this drawing reads as instead (Fude's misreading). */
  misread: string | null;
  /** The stroke (cell, index) that fits its reference best: Fude paints a はなまる on it. */
  best: [number, number];
  points: number;
}

export type ItemKind = 'recall' | 'dictation';

export interface Item {
  kind: ItemKind;
  targets: Record<string, Target>;
  sheets: Record<string, Sheet>;
  /** Recall: said from memory (or typed), unlocking the reading. */
  said: Record<string, Via>;
  /** Recall: tries at saying it. */
  tries: Record<string, number>;
  /** Recall: the reading is showing (said it, or gave up). */
  shown: Record<string, boolean>;
}

export interface Gallery {
  targets: Record<string, Target>;
  /** In hand-in order while writing; shuffled for the show. */
  sheets: Sheet[];
  said: Record<string, Via | null>;
  /** stamps[voter][award] = sheet index. */
  stamps: Record<string, Partial<Record<AwardId, number>>>;
  claimed: string[];
  scored: boolean;
}

export interface ShodoState {
  stage: 'practice' | 'read' | 'item' | 'replay' | 'gallery' | 'vote' | 'claim' | 'done';
  practice: Record<string, Practice>;
  items: Item[];
  gallery: Gallery | null;
  used: string[];
  earned: Record<string, number>;
  /** Base points (not speaking bonuses), for the 30% cap. */
  base: Record<string, number>;
  bonus: Record<string, number>;
  /** Bonuses earned this phase, paid (capped) when it ends. */
  pending: Record<string, number>;
  stats: { clean: Record<string, number>; corrections: Record<string, number>; tappitsu: Record<string, number> };
}

// ---- moves ----

export type ShodoMove =
  | { kind: 'say'; utterance: Utterance }
  | { kind: 'say-skip' }
  | { kind: 'rep'; strokes: InkPoint[][]; corrections?: number }
  | { kind: 'skip-trace' }
  | { kind: 'sheet'; cells: InkPoint[][][] }
  | { kind: 'stamp'; award: AwardId; sheet: number }
  | { kind: 'claim' };

// ---- view ----

export interface TargetView {
  text: string;
  kind: Target['kind'];
  /** Characters to write (cells on the pad). */
  count: number;
  say: JpText;
  /** Kana-level viewers only. */
  romaji: string | null;
  meaning: string;
  /** The model strokes per cell, only when the phone may show them (tracing, and after a sheet is graded). */
  cells: InkPoint[][][] | null;
  mask: string | null;
}

export interface SheetView {
  /** Show number (1-based) in the gallery; seat order is never shown. */
  n: number;
  text: string;
  say: JpText;
  cells: InkPoint[][][];
  clean: boolean;
  pass: boolean;
  outOfOrder: number | null;
  misread: string | null;
  best: [number, number];
  /** Named only when they wrote it clean (replay) or claimed it (gallery). */
  name: string | null;
  stamps: Partial<Record<AwardId, number>>;
}

export interface ShodoView {
  mode: 'shodo';
  stage: ShodoState['stage'];
  round: number;
  /** 1-based dictation item (0 outside the round). */
  item: number;
  items: number;
  itemKind: ItemKind | null;
  kanaAtTable: boolean;
  earned: Record<string, number>;
  /** How many have finished this phase's writing (never who). */
  finished: number;
  writers: number;
  /** Round 1: one column per player (no names), the latest version of each target. */
  scroll: { chars: { text: string; say: JpText; strokes: InkPoint[][]; ok: boolean }[]; done: boolean }[] | null;
  /** Replay and gallery sheets (stage, and everyone once the gallery is up). */
  sheets: SheetView[] | null;
  /** The replay's stroke slot, ms. */
  slotMs: number;
  /** Players can vote (3 or more). */
  voting: boolean;
  me: {
    practice: {
      target: TargetView | null;
      rep: RepKind | null;
      /** 1-based rep number and total. */
      at: number;
      of: number;
      /** Say the target before its first trace. */
      sayFirst: boolean;
      results: { text: string; kind: RepKind; ok: boolean; clean: boolean }[];
      points: number;
    } | null;
    item: {
      target: TargetView;
      handedIn: boolean;
      said: Via | null;
      shown: boolean;
      tries: number;
      result: { pass: boolean; clean: boolean; tip: string; points: number; misread: string | null } | null;
    } | null;
    gallery: { target: TargetView; handedIn: boolean; said: Via | null | undefined; sheet: number | null; claimed: boolean } | null;
    stamps: Partial<Record<AwardId, number>>;
  } | null;
}

// ---- helpers ----

const nameOf = (ctx: ModeContext, id: string): string => ctx.player(id)?.name ?? '(left)';
const decks = new WeakMap<object, ShodoDeck>();
function deckFor(ctx: ModeContext): ShodoDeck {
  let d = decks.get(ctx.content);
  if (!d) decks.set(ctx.content, (d = buildDeck(ctx.content)));
  return d;
}

/** Dictation points scale with the strokes written, so an N4 player's 電車 isn't worth an あ. */
export const strokeScale = (t: Target): number => (t.kind === 'kana' ? 1 : Math.min(1.6, 0.8 + 0.04 * t.strokes));

function give(s: ShodoState, ctx: ModeContext, id: string, points: number): number {
  if (points <= 0 || !ctx.player(id)) return 0;
  ctx.award(id, points);
  s.earned[id] = (s.earned[id] ?? 0) + points;
  s.base[id] = (s.base[id] ?? 0) + points;
  return points;
}

/** Pays this phase's speaking bonuses, each player capped at 30% of their points. */
function settleBonuses(s: ShodoState, ctx: ModeContext): void {
  for (const [id, want] of Object.entries(s.pending)) {
    if (!ctx.player(id) || want <= 0) continue;
    const room = Math.max(0, Math.floor(((s.base[id] ?? 0) * BONUS_SHARE) / (1 - BONUS_SHARE)) - (s.bonus[id] ?? 0));
    const points = Math.min(want, room);
    if (points <= 0) continue;
    ctx.award(id, points);
    s.earned[id] = (s.earned[id] ?? 0) + points;
    s.bonus[id] = (s.bonus[id] ?? 0) + points;
  }
  s.pending = {};
}

const owe = (s: ShodoState, id: string, points: number) => {
  s.pending[id] = (s.pending[id] ?? 0) + points;
};

const flat = (cells: InkPoint[][][]): InkPoint[][] => cells.flat();

function targetView(t: Target, level: Level | null, withStrokes: boolean): TargetView {
  return {
    text: t.text,
    kind: t.kind,
    count: t.cells.length,
    say: t.say,
    romaji: level === 'kana' ? toRomaji(t.say.kana) : null,
    meaning: t.meaning,
    cells: withStrokes ? t.cells.map((c) => c.map((s) => s.map((p) => [p[0], p[1]] as InkPoint))) : null,
    mask: t.mask ?? null,
  };
}

/**
 * A target with what would give the answer away taken out: the written form always, and the
 * reading too unless `reading` (dictation plays it aloud; recall shows it once said). A kana's
 * reading is the kana itself, so its phone only voices it and shows the romaji or the twin.
 */
function blanked(v: TargetView, reading: boolean): TargetView {
  return { ...v, text: '', cells: null, say: { text: '', kana: reading ? v.say.kana : '', en: v.say.en } };
}

/** The reps in interleaved order: trace A B C, faint A B C, memory A B C. */
function repsFor(n: number): Rep[] {
  const out: Rep[] = [];
  for (const kind of ['trace', 'faint', 'memory'] as const) for (let i = 0; i < n; i++) out.push({ target: i, kind });
  return out;
}

/** Grades a sheet cell by cell, and looks for a look-alike it reads as instead. */
function gradeSheet(deck: ShodoDeck, playerId: string, target: Target, cells: InkPoint[][][]): Sheet {
  const grades: InkGrade[] = target.cells.map((ref, i) => gradeInk(cells[i] ?? [], ref));
  const pass = grades.every((g) => g.pass);
  const clean = grades.every((g) => g.clean);
  const shape = grades.reduce((n, g) => n + g.shapeScore, 0) / Math.max(1, grades.length);
  let outOfOrder: number | null = null;
  let offset = 0;
  grades.forEach((g, i) => {
    if (outOfOrder === null && g.pass && !g.orderOk) outOfOrder = offset + Math.max(0, (g.stroke ?? 1) - 1);
    offset += cells[i]?.length ?? 0;
  });
  let misread: string | null = null;
  if (!pass && target.cells.length === 1) {
    let bestScore = 0;
    for (const c of deck.lookAlikes(target)) {
      const ref = deck.strokesOf(c);
      if (!ref) continue;
      const g = gradeInk(cells[0] ?? [], ref);
      if (g.pass && g.shapeScore > bestScore) [misread, bestScore] = [c, g.shapeScore];
    }
  }
  return { playerId, target, cells, pass, clean, shape, outOfOrder, misread, best: bestStroke(target, cells), points: 0 };
}

/** The drawn stroke closest to its own reference (as placed in the box), for Fude's はなまる. */
function bestStroke(target: Target, cells: InkPoint[][][]): [number, number] {
  let best: [number, number] = [0, 0];
  let bestD = Infinity;
  cells.forEach((cell, c) =>
    cell.forEach((s, i) => {
      const ref = target.cells[c]?.[i];
      if (!ref || !s.length) return;
      const d = Math.hypot(s[0]![0] - ref[0]![0], s[0]![1] - ref[0]![1]) + Math.hypot(s.at(-1)![0] - ref.at(-1)![0], s.at(-1)![1] - ref.at(-1)![1]);
      if (d < bestD) [best, bestD] = [[c, i], d];
    }),
  );
  return best;
}

/** Reads `cells` off the wire: one drawing per character, each within the kanji limits. */
function readCells(raw: unknown, count: number): InkPoint[][][] | null {
  if (!Array.isArray(raw) || raw.length !== count) return null;
  const out: InkPoint[][][] = [];
  for (const c of raw) {
    const ink = readInk(c, KANJI_LIMITS);
    if (!ink) return null;
    out.push(ink);
  }
  return out;
}

const tipFor = (sheet: Sheet): string => {
  if (sheet.clean) return 'Clean: right strokes, right order!';
  if (sheet.pass) return sheet.outOfOrder !== null ? `It reads! Watch the stroke order: stroke ${sheet.outOfOrder + 1} comes later.` : 'It reads! Count the strokes next time.';
  if (sheet.misread) return `Fude read it as ${sheet.misread}! Compare with the model.`;
  return 'Not quite. Watch the model, stroke by stroke.';
};

const writersOf = (ctx: ModeContext) => ctx.connected();

// ---- the mode ----

export const shodoMode: Mode<ShodoState, ShodoView> = {
  info: {
    id: 'shodo',
    title: 'Shodō Taikai',
    titleJa: '書道大会',
    blurb: 'Fude’s calligraphy contest: say it, trace it, write it from memory, then hang your best sheet in the gallery.',
    host: 'fude',
    minPlayers: 1,
    maxPlayers: 8,
    roundChoices: [],
    usesPack: false,
    phrasebookTitle: 'Practice sheets',
    phaseLabels: { prompt: 'お手本 · Trace and write', score: 'Read the scroll', answer: '書き取り · Dictation', reveal: 'Synchro replay', encore: '展覧会 · Your big sheet', finale: 'Hanko stamps', penalty: 'Claim it' },
  },

  setup() {
    return { stage: 'practice', practice: {}, items: [], gallery: null, used: [], earned: {}, base: {}, bonus: {}, pending: {}, stats: { clean: {}, corrections: {}, tappitsu: {} } };
  },

  next(s, from, ctx) {
    switch (from) {
      case 'intro':
        return 'prompt';
      case 'prompt':
        return 'score';
      case 'score':
        return 'answer';
      case 'answer':
        return 'reveal';
      case 'reveal':
        return s.items.length < ITEMS ? 'answer' : 'encore';
      case 'encore':
        return s.gallery && s.gallery.sheets.length && ctx.players().length >= MIN_VOTERS ? 'finale' : 'penalty';
      case 'finale':
        return 'penalty';
      default:
        return 'recap';
    }
  },

  enter(s, phase, ctx) {
    switch (phase) {
      case 'intro':
        ctx.cue({ host: 'fude', event: 'shodo_intro' });
        return;
      case 'prompt':
        return enterPractice(s, ctx);
      case 'score':
        s.stage = 'read';
        ctx.cue({ host: 'fude', event: 'shodo_read' });
        return;
      case 'answer':
        return enterItem(s, ctx);
      case 'reveal':
        return enterReplay(s, ctx);
      case 'encore':
        return enterGallery(s, ctx);
      case 'finale':
        s.stage = 'vote';
        ctx.cue({ host: 'fude', event: 'shodo_vote' });
        return;
      case 'penalty':
        s.stage = 'claim';
        scoreGallery(s, ctx);
        ctx.cue({ host: 'fude', event: 'shodo_claim' });
        return;
    }
  },

  leave(s, phase, ctx) {
    if (phase === 'prompt') {
      // Round 1's points land once, at the end: a chime per stroke would fill a quiet round.
      for (const [id, p] of Object.entries(s.practice)) give(s, ctx, id, p.points);
    }
    if (phase === 'answer') {
      const item = s.items.at(-1);
      if (item) for (const sheet of Object.values(item.sheets)) give(s, ctx, sheet.playerId, sheet.points);
    }
    if (phase === 'encore' && s.gallery) {
      // The show order is shuffled, so seat order never gives away whose sheet is whose.
      s.gallery.sheets = shuffled(s.gallery.sheets, () => ctx.random());
    }
    if (phase === 'finale') scoreGallery(s, ctx);
    if (phase === 'prompt' || phase === 'answer' || phase === 'encore' || phase === 'penalty') settleBonuses(s, ctx);
    if (phase === 'penalty') s.stage = 'done';
  },

  duration(s, phase) {
    switch (phase) {
      case 'intro':
        return DURATIONS.intro;
      case 'prompt':
        return DURATIONS.practice;
      case 'score':
        return DURATIONS.read;
      case 'answer':
        return DURATIONS.item;
      case 'reveal': {
        const sheets = Object.values(s.items.at(-1)?.sheets ?? {});
        const most = Math.max(1, ...sheets.map((x) => flat(x.cells).length));
        return Math.max(DURATIONS.replay, replaySlotMs(most) * most + 5_000);
      }
      case 'encore':
        return DURATIONS.gallery;
      case 'finale':
        return DURATIONS.vote;
      case 'penalty':
        return DURATIONS.claim;
      default:
        return 0;
    }
  },

  done(s, phase, ctx) {
    const here = writersOf(ctx);
    if (!here.length) return false;
    if (phase === 'prompt') return here.every((p) => { const pr = s.practice[p.id]; return !pr || pr.next >= pr.reps.length; });
    if (phase === 'answer') {
      const item = s.items.at(-1);
      return !!item && here.every((p) => !item.targets[p.id] || !!item.sheets[p.id]);
    }
    if (phase === 'encore') {
      const g = s.gallery;
      return !!g && here.every((p) => !g.targets[p.id] || (g.sheets.some((x) => x.playerId === p.id) && g.said[p.id] !== undefined));
    }
    if (phase === 'finale') {
      const g = s.gallery;
      return !!g && here.every((p) => Object.keys(g.stamps[p.id] ?? {}).length >= Math.min(STAMPS, g.sheets.filter((x) => x.playerId !== p.id).length));
    }
    return false;
  },

  move(s, phase, playerId, raw, ctx) {
    if (!isObject(raw) || typeof raw.kind !== 'string') return moveError('bad-move');
    switch (raw.kind) {
      case 'say':
        return moveSay(s, phase, playerId, raw.utterance, ctx);
      case 'say-skip':
        return moveSaySkip(s, phase, playerId);
      case 'rep':
        return moveRep(s, phase, playerId, raw, ctx);
      case 'skip-trace':
        return moveSkipTrace(s, phase, playerId);
      case 'sheet':
        return moveSheet(s, phase, playerId, raw.cells, ctx);
      case 'stamp':
        return moveStamp(s, phase, playerId, raw.award, raw.sheet);
      case 'claim':
        return moveClaim(s, phase, playerId, ctx);
      default:
        return moveError('bad-move');
    }
  },

  progress(s) {
    const round = s.stage === 'practice' || s.stage === 'read' ? 1 : s.stage === 'item' || s.stage === 'replay' ? 2 : 3;
    return { round, totalRounds: 3 };
  },

  view(s, phase, viewer: Viewer, ctx) {
    const me = viewer.kind === 'player' ? viewer.playerId : null;
    const level = me ? (ctx.player(me)?.level ?? null) : null;
    const item = phase === 'answer' || phase === 'reveal' ? s.items.at(-1) : undefined;
    const g = s.gallery;
    const players = ctx.players();
    const finished =
      phase === 'prompt'
        ? Object.values(s.practice).filter((p) => p.next >= p.reps.length).length
        : phase === 'answer' && item
          ? Object.keys(item.sheets).length
          : phase === 'encore' && g
            ? g.sheets.length
            : 0;
    const writers = phase === 'prompt' ? Object.keys(s.practice).length : phase === 'answer' && item ? Object.keys(item.targets).length : phase === 'encore' && g ? Object.keys(g.targets).length : players.length;
    const showGallery = !!g && (phase === 'finale' || phase === 'penalty');
    return {
      mode: 'shodo',
      stage: s.stage,
      round: this.progress(s).round,
      item: phase === 'answer' || phase === 'reveal' ? s.items.length : 0,
      items: ITEMS,
      itemKind: item?.kind ?? null,
      kanaAtTable: players.some((p) => p.level === 'kana'),
      earned: s.earned,
      finished,
      writers,
      scroll: (phase === 'prompt' || phase === 'score') && viewer.kind === 'stage' ? scrollView(s, ctx) : null,
      sheets: phase === 'reveal' && item && viewer.kind === 'stage' ? replayView(item, ctx) : showGallery ? galleryView(g!, ctx, me) : null,
      slotMs: item ? replaySlotMs(Math.max(1, ...Object.values(item.sheets).map((x) => flat(x.cells).length))) : 0,
      voting: players.length >= MIN_VOTERS,
      me: me ? mineView(s, phase, me, level, ctx) : null,
    };
  },

  awards(s, ctx) {
    const out: Award[] = [];
    const top = (rec: Record<string, number>) =>
      Object.entries(rec)
        .filter(([id, n]) => n > 0 && ctx.player(id))
        .sort((a, b) => b[1] - a[1] || ctx.player(a[0])!.seat - ctx.player(b[0])!.seat)[0]?.[0];
    const brush = top(s.stats.tappitsu);
    if (brush) out.push({ playerId: brush, name: nameOf(ctx, brush), title: 'たっぴつ', en: 'Fine Brush (the most たっぴつ stamps)' });
    const clean = top(s.stats.clean);
    if (clean) out.push({ playerId: clean, name: nameOf(ctx, clean), title: 'かきとり めいじん', en: 'Dictation Master (the most clean sheets)' });
    const effort = top(s.stats.corrections);
    if (effort) out.push({ playerId: effort, name: nameOf(ctx, effort), title: 'どりょく賞', en: 'Effort Prize (kept at it after the most corrections)' });
    return out;
  },
};

// ---- phases ----

function enterPractice(s: ShodoState, ctx: ModeContext): void {
  s.stage = 'practice';
  const deck = deckFor(ctx);
  const used = new Set(s.used);
  for (const p of ctx.players()) {
    const targets = deal(practicePool(deck, p.level), 3, used, () => ctx.random());
    if (!targets.length) continue;
    targets.forEach((t) => used.add(t.id));
    s.practice[p.id] = { targets, reps: repsFor(targets.length), next: 0, results: [], said: targets.map(() => undefined), corrections: 0, points: 0 };
  }
  s.used = [...used];
  ctx.cue({ host: 'fude', event: 'shodo_practice' });
}

function enterItem(s: ShodoState, ctx: ModeContext): void {
  s.stage = 'item';
  const deck = deckFor(ctx);
  const index = s.items.length;
  // Say-it-then-write first and last, dictation in the middle.
  const kind: ItemKind = index % 2 === 0 ? 'recall' : 'dictation';
  const used = new Set(s.used);
  const targets: Record<string, Target> = {};
  for (const p of ctx.players()) {
    // Spacing: the first and last items come back to two of your round 1 targets.
    const practiced = s.practice[p.id]?.targets ?? [];
    const again = index === 0 ? practiced[0] : index === 2 ? practiced[1] : undefined;
    const t = again ?? deal(dictationPool(deck, p.level, index === 1), 1, used, () => ctx.random())[0];
    if (!t) continue;
    used.add(t.id);
    targets[p.id] = t;
  }
  s.used = [...used];
  s.items.push({ kind, targets, sheets: {}, said: {}, tries: {}, shown: {} });
  ctx.cue({ host: 'fude', event: 'shodo_dictation' });
}

function enterReplay(s: ShodoState, ctx: ModeContext): void {
  s.stage = 'replay';
  const item = s.items.at(-1)!;
  const sheets = Object.values(item.sheets);
  const misread = sheets.find((x) => x.misread);
  if (misread) ctx.cue({ host: 'fude', event: 'shodo_misread', slots: { char: misread.misread! } });
  else if (sheets.some((x) => x.clean)) ctx.cue({ host: 'fude', event: 'shodo_clean' });
  for (const sheet of sheets) {
    const t = sheet.target;
    ctx.phrase(sheet.playerId, { itemId: t.id, text: t.say.text, kana: t.say.kana, en: t.say.en, outcome: item.said[sheet.playerId] === 'speech' ? 'said' : sheet.pass ? 'seen' : 'missed' });
  }
}

function enterGallery(s: ShodoState, ctx: ModeContext): void {
  s.stage = 'gallery';
  const deck = deckFor(ctx);
  const targets: Record<string, Target> = {};
  for (const p of ctx.players()) {
    const t = galleryTarget(deck, p.level, () => ctx.random());
    if (t) targets[p.id] = t;
  }
  s.gallery = { targets, sheets: [], said: {}, stamps: {}, claimed: [], scored: false };
  ctx.cue({ host: 'fude', event: 'shodo_gallery' });
}

function scoreGallery(s: ShodoState, ctx: ModeContext): void {
  const g = s.gallery;
  if (!g || g.scored) return;
  g.scored = true;
  const received = new Map<number, number>();
  for (const [voter, stamps] of Object.entries(g.stamps)) {
    if (!ctx.player(voter)) continue;
    for (const [award, n] of Object.entries(stamps)) {
      received.set(n!, (received.get(n!) ?? 0) + 1);
      const owner = g.sheets[n!]?.playerId;
      if (award === 'tappitsu' && owner) s.stats.tappitsu[owner] = (s.stats.tappitsu[owner] ?? 0) + 1;
    }
  }
  g.sheets.forEach((sheet, i) => {
    const stamps = Math.min(POINTS.stampCap, (received.get(i) ?? 0) * POINTS.stamp);
    sheet.points = stamps + (sheet.clean ? POINTS.galleryClean : sheet.pass ? POINTS.galleryPass : 0);
    give(s, ctx, sheet.playerId, sheet.points);
  });
}

// ---- moves ----

function moveSay(s: ShodoState, phase: Phase, playerId: string, u: unknown, ctx: ModeContext): MoveResult {
  if (!isUtterance(u)) return moveError('bad-move');
  const heard = utteranceReading(u);
  if (phase === 'prompt') {
    const p = s.practice[playerId];
    const rep = p?.reps[p.next];
    if (!p || !rep) return moveError('wrong-phase');
    if (p.said[rep.target] !== undefined) return moveError('already-answered');
    const t = p.targets[rep.target]!;
    if (!matchesAccepted(heard, [t.say.kana])) return moveError('not-the-word');
    p.said[rep.target] = u.via;
    owe(s, playerId, u.via === 'speech' ? SAY_BONUS.speech : u.via === 'typed' ? SAY_BONUS.typed : 0);
    ctx.phrase(playerId, { itemId: t.id, text: t.say.text, kana: t.say.kana, en: t.say.en, outcome: u.via === 'speech' ? 'said' : 'seen' });
    return MOVE_OK;
  }
  if (phase === 'answer') {
    const item = s.items.at(-1);
    const t = item?.targets[playerId];
    if (!item || !t) return moveError('not-playing');
    if (item.kind !== 'recall') return moveError('wrong-phase');
    if (item.said[playerId] || item.sheets[playerId]) return moveError('already-answered');
    if (!matchesAccepted(heard, [t.say.kana])) {
      item.tries[playerId] = (item.tries[playerId] ?? 0) + 1;
      return moveError('not-the-word');
    }
    item.said[playerId] = u.via;
    item.shown[playerId] = true;
    // From memory: the biggest speaking bonus in the mode.
    owe(s, playerId, u.via === 'speech' ? SAY_BONUS.recall : u.via === 'typed' ? SAY_BONUS.typed : 0);
    return MOVE_OK;
  }
  if (phase === 'encore') {
    const g = s.gallery;
    const t = g?.targets[playerId];
    if (!g || !t) return moveError('not-playing');
    if (!g.sheets.some((x) => x.playerId === playerId)) return moveError('write-first');
    if (g.said[playerId] !== undefined) return moveError('already-answered');
    // The sentence ("やまが すきです"), or at least the word in it.
    if (!matchesAccepted(heard, [t.say.kana, t.say.kana.replace(/が すきです$/, '')])) return moveError('not-the-word');
    g.said[playerId] = u.via;
    owe(s, playerId, u.via === 'speech' ? SAY_BONUS.speech : u.via === 'typed' ? SAY_BONUS.typed : 0);
    return MOVE_OK;
  }
  return moveError('wrong-phase');
}

/** Skip saying it (practice, the gallery sentence), or give up and show the reading (recall). */
function moveSaySkip(s: ShodoState, phase: Phase, playerId: string): MoveResult {
  if (phase === 'prompt') {
    const p = s.practice[playerId];
    const rep = p?.reps[p.next];
    if (!p || !rep) return moveError('wrong-phase');
    if (p.said[rep.target] === undefined) p.said[rep.target] = null;
    return MOVE_OK;
  }
  if (phase === 'answer') {
    const item = s.items.at(-1);
    if (!item?.targets[playerId]) return moveError('not-playing');
    item.shown[playerId] = true;
    return MOVE_OK;
  }
  if (phase === 'encore') {
    const g = s.gallery;
    if (!g?.targets[playerId]) return moveError('not-playing');
    if (g.said[playerId] === undefined) g.said[playerId] = null;
    return MOVE_OK;
  }
  return moveError('wrong-phase');
}

function moveRep(s: ShodoState, phase: Phase, playerId: string, raw: Record<string, unknown>, ctx: ModeContext): MoveResult {
  if (phase !== 'prompt') return moveError('wrong-phase');
  const p = s.practice[playerId];
  const rep = p?.reps[p.next];
  if (!p || !rep) return moveError('already-answered');
  const strokes = readInk(raw.strokes, KANJI_LIMITS);
  if (!strokes) return moveError('bad-drawing');
  const t = p.targets[rep.target]!;
  const ref = t.cells[0]!;
  let ok: boolean;
  let clean: boolean;
  if (rep.kind === 'memory') {
    const g = gradeInk(strokes, ref);
    [ok, clean] = [g.pass, g.clean];
    p.points += clean ? POINTS.memoryClean : ok ? POINTS.memoryPass : 0;
  } else {
    // The phone corrected each stroke as it went; check again, as loosely as the steadiest-hand setting.
    ok = strokes.length === ref.length && strokes.every((st, i) => checkStroke(st, ref[i] as InkStroke, TRACE_TOLERANCE_LOOSE) === 'ok');
    clean = ok;
    if (ok) p.points += rep.kind === 'trace' ? POINTS.trace : POINTS.faint;
  }
  const corrections = typeof raw.corrections === 'number' && Number.isFinite(raw.corrections) ? Math.max(0, Math.min(20, Math.floor(raw.corrections))) : 0;
  p.corrections += corrections;
  s.stats.corrections[playerId] = (s.stats.corrections[playerId] ?? 0) + corrections;
  if (rep.kind === 'memory' && clean) s.stats.clean[playerId] = (s.stats.clean[playerId] ?? 0) + 1;
  p.results.push({ ...rep, ok, clean, strokes });
  p.next += 1;
  if (rep.kind === 'memory') ctx.phrase(playerId, { itemId: t.id, text: t.say.text, kana: t.say.kana, en: t.say.en, outcome: p.said[rep.target] === 'speech' ? 'said' : ok ? 'seen' : 'retry' });
  return MOVE_OK;
}

/** "I know this one": drop the current target's trace and faint reps; its memory rep stays. */
function moveSkipTrace(s: ShodoState, phase: Phase, playerId: string): MoveResult {
  if (phase !== 'prompt') return moveError('wrong-phase');
  const p = s.practice[playerId];
  const rep = p?.reps[p.next];
  if (!p || !rep) return moveError('already-answered');
  if (rep.kind === 'memory') return moveError('wrong-phase');
  const target = rep.target;
  p.reps = [...p.reps.slice(0, p.next), ...p.reps.slice(p.next).filter((r) => r.target !== target || r.kind === 'memory')];
  if (p.said[target] === undefined) p.said[target] = null;
  return MOVE_OK;
}

function moveSheet(s: ShodoState, phase: Phase, playerId: string, raw: unknown, ctx: ModeContext): MoveResult {
  const deck = deckFor(ctx);
  if (phase === 'answer') {
    const item = s.items.at(-1);
    const t = item?.targets[playerId];
    if (!item || !t) return moveError('not-playing');
    if (item.sheets[playerId]) return moveError('already-answered');
    if (item.kind === 'recall' && !item.shown[playerId]) return moveError('say-first');
    const cells = readCells(raw, t.cells.length);
    if (!cells) return moveError('bad-drawing');
    const sheet = gradeSheet(deck, playerId, t, cells);
    const k = strokeScale(t);
    sheet.points = Math.round((sheet.clean ? POINTS.writeClean : sheet.pass ? POINTS.writePass : 0) * k);
    if (sheet.clean) s.stats.clean[playerId] = (s.stats.clean[playerId] ?? 0) + 1;
    item.sheets[playerId] = sheet;
    return MOVE_OK;
  }
  if (phase === 'encore') {
    const g = s.gallery;
    const t = g?.targets[playerId];
    if (!g || !t) return moveError('not-playing');
    if (g.sheets.some((x) => x.playerId === playerId)) return moveError('already-answered');
    const cells = readCells(raw, t.cells.length);
    if (!cells) return moveError('bad-drawing');
    g.sheets.push(gradeSheet(deck, playerId, t, cells));
    ctx.phrase(playerId, { itemId: t.id, text: t.text, kana: t.say.kana.replace(/が すきです$/, ''), en: t.meaning, outcome: 'seen' });
    return MOVE_OK;
  }
  return moveError('wrong-phase');
}

function moveStamp(s: ShodoState, phase: Phase, playerId: string, award: unknown, sheet: unknown): MoveResult {
  const g = s.gallery;
  if (phase !== 'finale' || !g) return moveError('wrong-phase');
  if (typeof award !== 'string' || !AWARD_IDS.has(award)) return moveError('bad-move');
  if (typeof sheet !== 'number' || !Number.isInteger(sheet) || !g.sheets[sheet]) return moveError('unknown-answer');
  if (g.sheets[sheet]!.playerId === playerId) return moveError('own-answer');
  const mine = (g.stamps[playerId] ??= {});
  if (mine[award as AwardId] === undefined && Object.keys(mine).length >= STAMPS) return moveError('out-of-stamps');
  // Moving a stamp to another sheet is fine until the vote closes.
  mine[award as AwardId] = sheet;
  return MOVE_OK;
}

function moveClaim(s: ShodoState, phase: Phase, playerId: string, ctx: ModeContext): MoveResult {
  const g = s.gallery;
  if (phase !== 'penalty' || !g) return moveError('wrong-phase');
  if (!g.sheets.some((x) => x.playerId === playerId)) return moveError('not-playing');
  if (!g.claimed.includes(playerId) && ctx.player(playerId)) g.claimed.push(playerId);
  return MOVE_OK;
}

// ---- views ----

function scrollView(s: ShodoState, ctx: ModeContext): NonNullable<ShodoView['scroll']> {
  // Seat order, but no names: the TV never says who is still writing.
  return ctx
    .players()
    .filter((p) => s.practice[p.id])
    .map((p) => {
      const pr = s.practice[p.id]!;
      const chars = pr.targets.flatMap((t, i) => {
        const last = [...pr.results].reverse().find((r) => r.target === i && r.ok);
        return last ? [{ text: t.text, say: t.say, strokes: last.strokes, ok: last.clean }] : [];
      });
      return { chars, done: pr.next >= pr.reps.length };
    });
}

function replayView(item: Item, ctx: ModeContext): SheetView[] {
  return Object.values(item.sheets).map((x, i) => ({
    n: i + 1,
    text: x.target.text,
    say: x.target.say,
    cells: x.cells,
    clean: x.clean,
    pass: x.pass,
    outOfOrder: x.outOfOrder,
    misread: x.misread,
    best: x.best,
    // Only clean writers are named at the replay (comedy and UX panels).
    name: x.clean ? nameOf(ctx, x.playerId) : null,
    stamps: {},
  }));
}

function galleryView(g: Gallery, ctx: ModeContext, me: string | null): SheetView[] {
  const counts = g.sheets.map(() => ({}) as Partial<Record<AwardId, number>>);
  // Stamps show once the vote is over, so nobody piles on.
  if (g.scored) for (const stamps of Object.values(g.stamps)) for (const [award, n] of Object.entries(stamps)) counts[n!]![award as AwardId] = (counts[n!]![award as AwardId] ?? 0) + 1;
  return g.sheets.map((x, i) => ({
    n: i + 1,
    text: x.target.text,
    say: x.target.say,
    cells: x.cells,
    clean: x.clean,
    pass: x.pass,
    outOfOrder: null,
    misread: null,
    best: x.best,
    name: g.claimed.includes(x.playerId) ? nameOf(ctx, x.playerId) : me === x.playerId ? 'you' : null,
    stamps: counts[i]!,
  }));
}

function mineView(s: ShodoState, phase: Phase, me: string, level: Level | null, ctx: ModeContext): NonNullable<ShodoView['me']> {
  const out: NonNullable<ShodoView['me']> = { practice: null, item: null, gallery: null, stamps: s.gallery?.stamps[me] ?? {} };
  const p = s.practice[me];
  if (p && (phase === 'prompt' || phase === 'score')) {
    const rep = phase === 'prompt' ? p.reps[p.next] : undefined;
    const t = rep ? p.targets[rep.target]! : null;
    out.practice = {
      // Tracing needs the model on the phone; writing from memory must not have it.
      target: t ? (rep!.kind === 'memory' ? blanked(targetView(t, level, false), t.kind !== 'kana') : targetView(t, level, true)) : null,
      rep: rep?.kind ?? null,
      at: Math.min(p.next + 1, p.reps.length),
      of: p.reps.length,
      sayFirst: !!rep && rep.kind === 'trace' && p.said[rep.target] === undefined,
      results: p.results.map((r) => ({ text: p.targets[r.target]!.text, kind: r.kind, ok: r.ok, clean: r.clean })),
      points: p.points,
    };
  }
  const item = phase === 'answer' || phase === 'reveal' ? s.items.at(-1) : undefined;
  const it = item?.targets[me];
  if (item && it) {
    const sheet = item.sheets[me];
    const graded = phase === 'reveal' && !!sheet;
    const view = targetView(it, level, graded);
    out.item = {
      // Before writing, the phone gets the meaning and the sound, never the written form.
      target: graded ? view : blanked(view, item.kind === 'dictation' || !!item.shown[me]),
      handedIn: !!sheet,
      said: item.said[me] ?? null,
      shown: !!item.shown[me] || item.kind === 'dictation',
      tries: item.tries[me] ?? 0,
      result: graded ? { pass: sheet.pass, clean: sheet.clean, tip: tipFor(sheet), points: sheet.points, misread: sheet.misread } : null,
    };
  }
  const g = s.gallery;
  const gt = g?.targets[me];
  if (g && gt && (phase === 'encore' || phase === 'finale' || phase === 'penalty')) {
    const at = g.sheets.findIndex((x) => x.playerId === me);
    out.gallery = {
      // The gallery glyph is shown with a faint model: it's about the beauty of the sheet.
      target: targetView(gt, level, true),
      handedIn: at >= 0,
      said: g.said[me],
      sheet: phase === 'encore' || at < 0 ? null : at + 1,
      claimed: g.claimed.includes(me),
    };
  }
  return out;
}
