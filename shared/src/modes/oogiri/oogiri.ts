// Oogiri Night (大喜利ナイト), the flagship: fill in the blank, vote for the funniest, say the
// winner out loud. Host: Pon. See docs/modes/oogiri.md for the rules in prose.
//
// Three rounds:
//   1. Head to Head: one prompt per player; each prompt goes to two players (a ring), so each
//      player answers two. Everyone but the pair votes.
//   2. Photo Caption: a photo (described in words until there is art) per pair, set-phrase
//      tiles, English allowed (no Japanese bonus for it).
//   3. IPPON Round: one prompt for everyone; vote for any answer but your own. Points and
//      the Japanese bonus are doubled.
// Each round: prompt → answer → (reveal → encore → score) per matchup → [penalty] → next.

import type { HostAward, JpText, OogiriPrompt, OogiriRound } from '../../../../content/src/types.js';
import { POINTS_PER_VOTE } from '../../constants.js';
import type { Phase, Viewer } from '../../protocol.js';
import { isUtterance } from '../../japanese/kana.js';
import { cleanText, isObject, moveError, MOVE_OK, shuffled, type Award, type HostCue, type Mode, type ModeContext } from '../mode.js';
import { buildAnswer, parseAnswerMove, sentenceFor, type AnswerStyle } from './answer.js';
import { dealFrames, dealTiles, FORM_LABELS, library, libraryFor, ROUNDS, stageVersion, versionFor, wordsIn, type Library, type Tile } from './deal.js';
import { toRomaji } from '../../japanese/romaji.js';
import type {
  Answer,
  AnswerCard,
  EncoreKind,
  Matchup,
  MatchupView,
  MeView,
  OogiriState,
  OogiriView,
  PlayerStats,
  PromptCard,
  ResultLine,
  Slot,
  SlotView,
  TileView,
} from './state.js';

export type * from './state.js';

export const TOTAL_ROUNDS = 3;
/** The say-it-first window before tiles appear, from N5 up. */
export const SAY_FIRST_MS = 5_000;
/** A phone's own 5-second timer may run a little fast against the server's; forgive this much. */
const SAY_FIRST_SLACK_MS = 750;
/** IPPON: every other voter, with at least this many. */
export const IPPON_VOTERS = 3;
export const IPPON_POINTS = 200;
/** All Japanese and speaking bonuses come from one pool: at most 30% of the points at stake. */
export const BONUS_POOL_SHARE = 0.3;
/** Pon steals a cushion once a game when the leader is this many cushions ahead. */
export const STEAL_LEAD = 3;

/** Share of an answer's bonus cap each way of answering earns (before doubling and comebacks). */
export const STYLE_BONUS: Record<AnswerStyle, number> = {
  'memory-spoken': 0.5,
  'memory-typed': 0.3,
  spoken: 0.35,
  tried: 0.25,
  typed: 0.2,
  tiles: 0.1,
  english: 0,
};
const FORM_BONUS = 0.05;
const COMEBACK = 1.5;
const ENCORE_BONUS = { winner: { said: 0.4, typed: 0.15 }, other: { said: 0.2, typed: 0.1 } } as const;

export const DURATIONS = {
  intro: 14_000,
  prompt: 6_000,
  answerBase: 20_000,
  answerPerSlot: 40_000,
  revealBase: 10_000,
  revealPerAnswer: 3_500,
  revealMax: 40_000,
  encore: 12_000,
  score: 9_000,
  penalty: 6_000,
} as const;

const multiplierFor = (round: number) => (round === TOTAL_ROUNDS ? 2 : 1);
const kindOf = (s: OogiriState): OogiriRound | null => (s.round > 0 ? ROUNDS[s.round - 1]! : null);
const round5 = (n: number) => Math.round(n / 5) * 5;
const blankStats = (): PlayerStats => ({ cushions: 0, ippons: 0, callbackVotes: 0, brave: 0, stolen: 0 });

function stats(s: OogiriState, playerId: string): PlayerStats {
  return (s.stats[playerId] ??= blankStats());
}

function pay(s: OogiriState, ctx: ModeContext, playerId: string, points: number, why: OogiriState['ledger'][number]['why']): void {
  const p = Math.round(points);
  if (!p || !ctx.player(playerId)) return;
  ctx.award(playerId, p);
  s.ledger.push({ playerId, round: s.round, points: p, why });
}

const lib = (s: OogiriState, ctx: ModeContext): Library => libraryFor(ctx.content, s.packId);

function drawPrompt(s: OogiriState, ctx: ModeContext, l: Library, round: OogiriRound, avoid: Set<string>): OogiriPrompt {
  const all = l.prompts[round];
  let deck = s.decks[round];
  if (!deck.some((id) => !avoid.has(id))) {
    deck = s.decks[round] = shuffled(
      all.map((p) => p.id),
      () => ctx.random(),
    );
  }
  const idx = Math.max(0, deck.findIndex((id) => !avoid.has(id)));
  const id = deck.splice(idx, 1)[0];
  return all.find((p) => p.id === id) ?? all[0]!;
}

/** Pairs players for a round. Returns the authors of each matchup, in matchup order. */
export function pairings(kind: OogiriRound, order: readonly string[]): string[][] {
  const n = order.length;
  if (kind === 'ippon' || n < 2) return [[...order]];
  if (kind === 'head-to-head') {
    // A ring: prompt i goes to players i and i+1, so everyone answers exactly two.
    if (n === 2) return [[order[0]!, order[1]!]];
    return order.map((id, i) => [id, order[(i + 1) % n]!]);
  }
  // Photo Caption: pairs; with an odd count the last player is paired with the first.
  const out: string[][] = [];
  for (let i = 0; i + 1 < n; i += 2) out.push([order[i]!, order[i + 1]!]);
  if (n % 2 === 1) out.push([order[n - 1]!, order[0]!]);
  return out;
}

function startRound(s: OogiriState, ctx: ModeContext): void {
  s.round += 1;
  s.current = -1;
  s.answers = [];
  s.slots = {};
  const kind = kindOf(s)!;
  const l = lib(s, ctx);
  const order = shuffled(
    ctx.players().map((p) => p.id),
    () => ctx.random(),
  );
  const avoid = new Set<string>();
  s.matchups = pairings(kind, order).map((authors, index) => {
    const prompt = drawPrompt(s, ctx, l, kind, avoid);
    avoid.add(prompt.id);
    return { index, prompt, authors, votes: {}, encores: {}, result: null };
  });
  for (const p of ctx.players()) {
    s.slots[p.id] = s.matchups
      .filter((m) => m.authors.includes(p.id))
      .map((m): Slot => {
        const tiles = dealTiles(l, m.prompt, p.level, s.used, () => ctx.random());
        return {
          matchup: m.index,
          version: versionFor(m.prompt, p.level),
          openedAt: null,
          tilesShown: false,
          tiles,
          frames: kind === 'photo-caption' ? dealFrames(l, p.level, tiles, () => ctx.random()) : [],
          answerId: null,
        };
      });
  }
}

/** Opens a player's next unanswered slot: the say-it-first window starts now (from N5 up). */
function openNext(s: OogiriState, ctx: ModeContext, playerId: string): void {
  const slot = s.slots[playerId]?.find((x) => !x.answerId);
  if (!slot || slot.openedAt !== null) return;
  slot.openedAt = ctx.now;
  slot.tilesShown = ctx.player(playerId)?.level === 'kana';
}

const currentSlot = (s: OogiriState, playerId: string): Slot | undefined => s.slots[playerId]?.find((x) => !x.answerId);
const matchupAnswers = (s: OogiriState, m: number) => s.answers.filter((a) => a.matchup === m);
const visibleAnswers = (s: OogiriState, m: number) => matchupAnswers(s, m).filter((a) => !a.hidden);

function nextMatchup(s: OogiriState): number {
  for (let i = s.current + 1; i < s.matchups.length; i++) if (matchupAnswers(s, i).length) return i;
  return -1;
}

/** Players who may vote in a matchup: everyone but its authors in head to head; everyone in round 3. */
function voters(s: OogiriState, m: Matchup, ctx: ModeContext): string[] {
  const kind = kindOf(s);
  return ctx
    .players()
    .map((p) => p.id)
    .filter((id) => (kind === 'ippon' ? true : !m.authors.includes(id)))
    .filter((id) => visibleAnswers(s, m.index).some((a) => a.authorId !== id));
}

function cushionLead(s: OogiriState, ctx: ModeContext): { leader: string; lead: number } | null {
  const ranked = ctx
    .players()
    .map((p) => ({ id: p.id, c: stats(s, p.id).cushions }))
    .sort((a, b) => b.c - a.c);
  if (ranked.length < 2) return null;
  return { leader: ranked[0]!.id, lead: ranked[0]!.c - ranked[1]!.c };
}

function afterRound(s: OogiriState, ctx: ModeContext): Phase {
  // Once a game, after round 1 or 2, Pon steals a cushion from a runaway leader.
  const lead = cushionLead(s, ctx);
  if (!s.steal && s.round < TOTAL_ROUNDS && lead && lead.lead >= STEAL_LEAD) return 'penalty';
  return s.round < TOTAL_ROUNDS ? 'prompt' : 'recap';
}

const promptCue = (p: OogiriPrompt) => {
  const v = stageVersion(p);
  return { text: v.text, kana: v.kana, en: v.en };
};

function cue(ctx: ModeContext, c: Omit<HostCue, 'host'>): void {
  ctx.cue({ host: 'pon', ...c });
}

/** Longest answer Pon will name in a written snap-back ("なんで {tile}！？"); longer ones read badly in a line. */
const TILE_MAX = 12;

/** The answer Pon snaps back at: the shortest Japanese one, since tsukkomi lands best on a short noun. */
function tileSlots(answers: Answer[]): Record<string, string> | undefined {
  const a = answers.filter((x) => !x.english && x.text.length <= TILE_MAX).sort((x, y) => x.text.length - y.text.length || byId(x, y))[0];
  return a ? { tile: a.text, tile_kana: a.kana, tile_en: a.blankEn } : undefined;
}

/** Pon's reaction to a matchup's answers, as the reveal raises it. */
function revealCue(s: OogiriState, m: Matchup): Omit<HostCue, 'host'> {
  const shown = visibleAnswers(s, m.index).sort(byId);
  return {
    event: 'reveal_react',
    tier: 'good',
    prompt: promptCue(m.prompt),
    answer: shown.map((a) => a.text).join(' / '),
    answerEn: shown.map((a) => a.en).join(' / '),
    slots: tileSlots(shown),
  };
}

/** The winning answer as the whole room shouts it back, or the prompt's example when no answer can stand in. */
function naturalFor(s: OogiriState, m: Matchup): JpText {
  const star = m.result?.lines.find((l) => l.ippon) ?? m.result?.lines.find((l) => l.winner);
  const a = star && s.answers.find((x) => x.id === star.answerId);
  // An English answer, or one with a form the player got wrong, isn't a sentence to drill.
  if (!a || a.english || a.formTips.length) return m.prompt.exampleAnswer;
  return sentenceFor(stageVersion(m.prompt), { text: a.text, kana: a.kana, en: a.blankEn });
}

/** Every slot for this matchup is answered. */
const matchupLocked = (s: OogiriState, m: number) =>
  Object.values(s.slots).every((slots) => slots.every((x) => x.matchup !== m || x.answerId !== null));

/** Votes, IPPON and the answer bonuses for the matchup on show. Paid as the encore starts. */
function scoreMatchup(s: OogiriState, ctx: ModeContext): void {
  const m = s.matchups[s.current];
  if (!m || m.result) return;
  const mult = multiplierFor(s.round);
  const answers = visibleAnswers(s, m.index).sort(byId);
  const counts = new Map<string, number>();
  for (const id of Object.values(m.votes)) counts.set(id, (counts.get(id) ?? 0) + 1);
  const ballots = Object.keys(m.votes);
  const top = Math.max(0, ...answers.map((a) => counts.get(a.id) ?? 0));
  // The bonus cap: 30% of the vote points this answer has a fair claim to.
  const eligible = kindOf(s) === 'ippon' ? ctx.players().length : Math.max(0, ctx.players().length - m.authors.length);
  const cap = round5((BONUS_POOL_SHARE * POINTS_PER_VOTE * mult * eligible) / Math.max(1, m.authors.length));
  const scores = ctx.players().map((p) => p.score);
  const mean = scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length);

  const lines: ResultLine[] = answers.map((a) => {
    const votes = counts.get(a.id) ?? 0;
    const others = ballots.filter((v) => v !== a.authorId).length;
    const ippon = others >= IPPON_VOTERS && votes === others;
    const author = ctx.player(a.authorId);
    let share = a.english ? 0 : STYLE_BONUS[a.style] + FORM_BONUS * a.formsRight;
    if (s.round === TOTAL_ROUNDS) share *= 2; // IPPON Round: Japanese bonus doubled
    if (author && author.score < mean) share *= COMEBACK; // comebacks raise the bonus, never past the cap
    const bonus = Math.min(cap, round5(cap * share));
    return {
      answerId: a.id,
      authorId: a.authorId,
      authorName: author?.name ?? '(left)',
      votes,
      votePoints: votes * POINTS_PER_VOTE * mult,
      ipponPoints: ippon ? IPPON_POINTS * mult : 0,
      bonus,
      encoreBonus: 0,
      bonusCap: cap,
      winner: votes > 0 && votes === top,
      ippon,
    };
  });
  for (const line of lines) {
    pay(s, ctx, line.authorId, line.votePoints, 'votes');
    pay(s, ctx, line.authorId, line.ipponPoints, 'ippon');
    pay(s, ctx, line.authorId, line.bonus, 'bonus');
    const st = stats(s, line.authorId);
    st.cushions += line.votes;
    if (line.ippon) st.ippons += 1;
    if (answers.find((a) => a.id === line.answerId)?.callback) st.callbackVotes += line.votes;
  }
  m.result = { lines, ippon: lines.some((l) => l.ippon) };

  const star = lines.find((l) => l.ippon) ?? lines.find((l) => l.winner);
  const starAnswer = star ? answers.find((a) => a.id === star.answerId) : undefined;
  const base = { prompt: promptCue(m.prompt), answer: starAnswer?.text, answerEn: starAnswer?.en };
  const winners = lines.filter((l) => l.winner);
  const runnerUp = Math.max(0, ...lines.filter((l) => !l.winner).map((l) => l.votes));
  const named = { name: star?.authorName ?? '', ...tileSlots(starAnswer ? [starAnswer] : []) };
  if (star?.ippon) cue(ctx, { ...base, event: 'ippon', tier: 'ippon', slots: { name: star.authorName } });
  else if (!star) cue(ctx, { prompt: base.prompt, answer: answers.map((a) => a.text).join(' / '), event: 'vote_zero', slots: tileSlots(answers) });
  else if (winners.length > 1) cue(ctx, { ...base, event: 'vote_tie' });
  else if (answers.length > 1 && top - runnerUp === 1) cue(ctx, { ...base, event: 'vote_close', slots: named });
  else if (answers.length > 1 && runnerUp === 0 && top >= 2) cue(ctx, { ...base, event: 'vote_landslide', slots: named });
  else cue(ctx, { ...base, event: 'encore_invite', slots: { name: star.authorName } });
}

/** Encore spotlight bonuses, paid as the score phase starts. */
function scoreEncores(s: OogiriState, ctx: ModeContext): void {
  const m = s.matchups[s.current];
  if (!m?.result) return;
  for (const line of m.result.lines) {
    const kind = m.encores[line.authorId];
    if (kind !== 'said' && kind !== 'typed') continue;
    const share = (line.winner ? ENCORE_BONUS.winner : ENCORE_BONUS.other)[kind];
    line.encoreBonus = Math.max(0, Math.min(line.bonusCap - line.bonus, round5(line.bonusCap * share)));
    pay(s, ctx, line.authorId, line.encoreBonus, 'encore');
  }
}

const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// ---- view helpers ----

function card(jp: JpText, photo?: string, romaji = false): PromptCard {
  return { text: jp.text, kana: jp.kana, en: jp.en, furigana: jp.furigana, photo, romaji: romaji ? toRomaji(jp.kana) : undefined };
}

function tileView(t: Tile, romaji: boolean): TileView {
  return {
    key: t.key,
    text: t.jp.text,
    kana: t.jp.kana,
    en: t.jp.en,
    romaji: romaji ? toRomaji(t.jp.kana) : undefined,
    role: t.role,
    ask: t.ask ? { form: t.ask, label: FORM_LABELS[t.ask] } : undefined,
    options: t.options?.map((o) => ({ form: o.form, label: FORM_LABELS[o.form], text: o.jp.text, kana: o.jp.kana, en: o.jp.en })),
    stem: t.stem?.text,
    te: t.te?.text,
  };
}

const AWARD_FALLBACK: Record<string, { text: string; en: string }> = {
  'pon.award.cushion-tower': { text: 'ざぶとん タワー', en: 'Cushion Tower' },
  'pon.award.ippon-king': { text: 'イッポン チャンピオン', en: 'IPPON Champion' },
  'pon.award.bravest-japanese': { text: 'ゆうき ナンバーワン', en: 'Bravest Japanese' },
  'pon.award.best-callback': { text: 'また でたしょう', en: 'Best Callback' },
  'pon.award.cushions-stolen': { text: 'ざぶとん さようならしょう', en: 'Most Cushions Stolen' },
};

export const oogiriMode: Mode<OogiriState, OogiriView> = {
  info: {
    id: 'oogiri',
    title: 'Oogiri Night',
    titleJa: '大喜利ナイト',
    blurb: 'Fill in the blank, vote for the funniest, say the winner out loud.',
    host: 'pon',
    phaseLabels: { reveal: 'Vote', encore: 'Encore', score: 'Cushions' },
    minPlayers: 3,
    maxPlayers: 8,
    roundChoices: [],
    usesPack: true,
  },

  setup(ctx, opts) {
    const l = library(ctx.content, opts.packId, () => ctx.random());
    const stats: Record<string, PlayerStats> = {};
    for (const p of ctx.players()) stats[p.id] = blankStats();
    return {
      packId: l.packId,
      placeholder: l.placeholder,
      round: 0,
      decks: { 'head-to-head': [], 'photo-caption': [], ippon: [] },
      matchups: [],
      current: -1,
      slots: {},
      answers: [],
      used: [],
      stats,
      ledger: [],
      steal: null,
      phaseAt: ctx.now,
    };
  },

  next(s, from, ctx) {
    switch (from) {
      case 'intro':
        return 'prompt';
      case 'prompt':
        return 'answer';
      case 'answer':
        return nextMatchup(s) >= 0 ? 'reveal' : afterRound(s, ctx);
      case 'reveal':
        return 'encore';
      case 'encore':
        return 'score';
      case 'score':
        return nextMatchup(s) >= 0 ? 'reveal' : afterRound(s, ctx);
      case 'penalty':
        return s.round < TOTAL_ROUNDS ? 'prompt' : 'recap';
      default:
        return 'recap';
    }
  },

  enter(s, phase, ctx) {
    s.phaseAt = ctx.now;
    switch (phase) {
      case 'intro':
        cue(ctx, { event: 'intro' });
        break;
      case 'prompt': {
        startRound(s, ctx);
        const only = s.round === TOTAL_ROUNDS ? s.matchups[0]?.prompt : undefined;
        cue(ctx, { event: 'prompt_read', prompt: only ? promptCue(only) : undefined });
        break;
      }
      case 'answer':
        for (const p of ctx.players()) openNext(s, ctx, p.id);
        if (ctx.players().some((p) => p.level !== 'kana')) cue(ctx, { event: 'say_it_first' });
        break;
      case 'reveal': {
        s.current = nextMatchup(s);
        const m = s.matchups[s.current];
        if (m) {
          cue(ctx, revealCue(s, m));
          // The later matchups' answers are final now: start their reactions while this one plays.
          for (const later of s.matchups.slice(s.current + 1)) if (matchupAnswers(s, later.index).length) cue(ctx, { ...revealCue(s, later), ahead: true });
        }
        break;
      }
      case 'encore':
        scoreMatchup(s, ctx);
        break;
      case 'score': {
        scoreEncores(s, ctx);
        const m = s.matchups[s.current];
        if (m) {
          const ex = naturalFor(s, m);
          for (const p of ctx.players()) ctx.phrase(p.id, { itemId: `${m.prompt.id}:natural`, text: ex.text, kana: ex.kana, en: ex.en, outcome: 'seen' });
          const star = m.result?.lines.find((l) => l.ippon) ?? m.result?.lines.find((l) => l.winner);
          const starAnswer = star && ex !== m.prompt.exampleAnswer ? s.answers.find((a) => a.id === star.answerId) : undefined;
          const slots = starAnswer ? { name: star!.authorName, ...tileSlots([starAnswer]) } : undefined;
          cue(ctx, { event: 'natural_version', prompt: promptCue(m.prompt), answer: ex.text, answerEn: ex.en, slots });
        }
        break;
      }
      case 'penalty': {
        const lead = cushionLead(s, ctx);
        if (!lead || s.steal) break;
        const st = stats(s, lead.leader);
        st.cushions -= 1;
        st.stolen += 1;
        pay(s, ctx, lead.leader, -POINTS_PER_VOTE, 'steal');
        s.steal = { playerId: lead.leader, round: s.round };
        cue(ctx, { event: 'cushion_steal', slots: { name: ctx.player(lead.leader)?.name ?? '' } });
        break;
      }
    }
  },

  duration(s, phase) {
    switch (phase) {
      case 'intro':
        return DURATIONS.intro;
      case 'prompt':
        return DURATIONS.prompt;
      case 'answer': {
        const most = Math.max(1, ...Object.values(s.slots).map((x) => x.length));
        return DURATIONS.answerBase + DURATIONS.answerPerSlot * most;
      }
      case 'reveal':
        return Math.min(DURATIONS.revealMax, DURATIONS.revealBase + DURATIONS.revealPerAnswer * matchupAnswers(s, s.current).length);
      case 'encore':
        return DURATIONS.encore;
      case 'score':
        return DURATIONS.score;
      case 'penalty':
        return DURATIONS.penalty;
      default:
        return 0;
    }
  },

  done(s, phase, ctx) {
    const here = ctx.connected();
    if (!here.length) return false;
    if (phase === 'answer') return here.every((p) => !currentSlot(s, p.id));
    const m = s.matchups[s.current];
    if (!m) return false;
    if (phase === 'reveal') {
      const can = new Set(voters(s, m, ctx));
      return here.every((p) => !can.has(p.id) || m.votes[p.id] !== undefined);
    }
    if (phase === 'encore') {
      // An IPPON gets its whole celebration.
      if (m.result?.ippon) return false;
      const authors = new Set(visibleAnswers(s, m.index).map((a) => a.authorId));
      return authors.size > 0 && here.every((p) => !authors.has(p.id) || m.encores[p.id] !== undefined);
    }
    return false;
  },

  move(s, phase, playerId, raw, ctx) {
    if (!isObject(raw)) return moveError('bad-move');
    // A move may name its round; one sent late (e.g. a delayed tiles request) lands as a harmless race.
    if (raw.round !== undefined && raw.round !== s.round) return moveError('wrong-phase');
    if (raw.matchup !== undefined && raw.matchup !== s.current) return moveError('wrong-phase');
    switch (raw.kind) {
      case 'tiles': {
        if (phase !== 'answer') return moveError('wrong-phase');
        const slot = currentSlot(s, playerId);
        if (!slot || slot.openedAt === null) return moveError('no-slot');
        if (raw.slot !== s.slots[playerId]!.indexOf(slot)) return moveError('wrong-slot');
        if (slot.tilesShown) return MOVE_OK;
        if (ctx.now < slot.openedAt + SAY_FIRST_MS - SAY_FIRST_SLACK_MS) return moveError('say-it-first');
        slot.tilesShown = true;
        return MOVE_OK;
      }
      case 'answer': {
        if (phase !== 'answer') return moveError('wrong-phase');
        const move = parseAnswerMove(raw);
        if (!move) return moveError('bad-move');
        const slots = s.slots[playerId];
        const slot = slots?.find((x) => !x.answerId);
        if (!slots || !slot) return moveError('already-answered');
        if (move.slot !== slots.indexOf(slot)) return moveError('wrong-slot');
        if (slot.openedAt === null) openNext(s, ctx, playerId);
        const built = buildAnswer(move, slot.tiles, slot.frames, !slot.tilesShown, kindOf(s)!);
        if (!built.ok) return moveError(built.error);
        const a = built.answer;
        const sentence = sentenceFor(slot.version, a);
        const m = s.matchups[slot.matchup]!;
        const stageEn = sentenceFor(stageVersion(m.prompt), a).en;
        const answer: Answer = {
          id: ctx.newId(),
          authorId: playerId,
          matchup: slot.matchup,
          text: a.text,
          kana: a.kana,
          en: stageEn,
          blankEn: a.en,
          sentence,
          style: a.style,
          english: a.english,
          formsRight: a.used.filter((u) => u.right).length,
          formTips: a.formTips,
          callback: a.used.some((u) => u.tile.role === 'callback'),
          hidden: false,
        };
        s.answers.push(answer);
        slot.answerId = answer.id;

        // Phrasebook and tonight's callbacks.
        const l = lib(s, ctx);
        const spoken = a.style === 'spoken' || a.style === 'memory-spoken';
        for (const u of a.used) {
          const itemId = u.form ? `${u.tile.wordId}:${u.form}` : u.tile.wordId;
          ctx.phrase(playerId, { itemId, text: u.jp.text, kana: u.jp.kana, en: u.jp.en, outcome: spoken ? 'said' : 'seen' });
          if (u.right === false && u.tile.ask) {
            const want = u.tile.options?.find((o) => o.form === u.tile.ask);
            if (want) ctx.phrase(playerId, { itemId: `${u.tile.wordId}:${u.tile.ask}`, text: want.jp.text, kana: want.jp.kana, en: want.jp.en, outcome: 'missed' });
          }
        }
        if (!a.english && !a.used.length) {
          const memory = a.style === 'memory-spoken' || a.style === 'memory-typed';
          ctx.phrase(playerId, { itemId: `oogiri:${answer.id}`, text: a.text, kana: a.kana, en: sentence.en, outcome: memory || spoken ? 'said' : 'seen' });
        }
        if (a.style === 'memory-spoken' || a.style === 'memory-typed') stats(s, playerId).brave += 1;
        // The host's reaction takes longer to write than the reveal waits, so it starts as the matchup locks.
        if (matchupLocked(s, m.index)) cue(ctx, { ...revealCue(s, m), ahead: true });
        const words = [...a.used.map((u) => u.tile.wordId), ...wordsIn(l, a.freeReading)];
        for (const w of words) {
          s.used = s.used.filter((x) => x !== w);
          s.used.push(w);
        }
        openNext(s, ctx, playerId);
        return MOVE_OK;
      }
      case 'vote': {
        if (phase !== 'reveal') return moveError('wrong-phase');
        const m = s.matchups[s.current];
        if (!m) return moveError('wrong-phase');
        if (m.votes[playerId]) return moveError('already-voted');
        const answer = s.answers.find((a) => a.id === raw.answerId);
        if (!answer) return moveError('unknown-answer');
        // A vote for an answer from an earlier matchup arrived late.
        if (answer.matchup !== m.index) return moveError('wrong-phase');
        if (answer.authorId === playerId) return moveError('own-answer');
        if (kindOf(s) !== 'ippon' && m.authors.includes(playerId)) return moveError('author-cant-vote');
        if (answer.hidden) return moveError('hidden');
        m.votes[playerId] = answer.id;
        return MOVE_OK;
      }
      case 'hide': {
        if (phase !== 'reveal') return moveError('wrong-phase');
        if (ctx.vipId !== playerId) return moveError('not-vip');
        const m = s.matchups[s.current];
        const answer = m && s.answers.find((a) => a.id === raw.answerId && a.matchup === m.index);
        if (!m || !answer) return moveError('unknown-answer');
        if (answer.hidden) return MOVE_OK;
        answer.hidden = true;
        // Hidden answers get no votes; anyone who voted for it may vote again.
        for (const [voter, id] of Object.entries(m.votes)) if (id === answer.id) delete m.votes[voter];
        return MOVE_OK;
      }
      case 'encore': {
        if (phase !== 'encore') return moveError('wrong-phase');
        const m = s.matchups[s.current];
        if (!m) return moveError('wrong-phase');
        const mine = visibleAnswers(s, m.index).find((a) => a.authorId === playerId);
        if (!mine) return moveError('not-yours');
        if (m.encores[playerId]) return moveError('already-encored');
        let kind: EncoreKind;
        if (raw.pass === true) kind = 'host';
        else if (isUtterance(raw.said) && cleanText(raw.said.text, 200)) kind = raw.said.via === 'speech' ? 'said' : 'typed';
        else return moveError('bad-move');
        m.encores[playerId] = kind;
        if (kind !== 'host') {
          stats(s, playerId).brave += 1;
          ctx.phrase(playerId, { itemId: `oogiri:${mine.id}`, text: mine.text, kana: mine.kana, en: mine.sentence.en, outcome: kind === 'said' ? 'said' : 'seen' });
          if (kind === 'said') cue(ctx, { event: 'encore_cheer', slots: { name: ctx.player(playerId)?.name ?? '' }, prompt: promptCue(m.prompt), answer: mine.text, answerEn: mine.en });
        }
        return MOVE_OK;
      }
      default:
        return moveError('bad-move');
    }
  },

  release(s, playerId) {
    for (const m of s.matchups) {
      delete m.votes[playerId];
      delete m.encores[playerId];
    }
  },

  progress(s) {
    return { round: s.round, totalRounds: TOTAL_ROUNDS };
  },

  view(s, phase, viewer: Viewer, ctx) {
    const kind = kindOf(s);
    const me = viewer.kind === 'player' ? ctx.player(viewer.playerId) : undefined;
    const romaji = me?.level === 'kana';
    const cushions: Record<string, number> = {};
    for (const p of ctx.players()) cushions[p.id] = s.stats[p.id]?.cushions ?? 0;

    const inAnswer = phase === 'answer';
    const answered = inAnswer ? ctx.players().filter((p) => !currentSlot(s, p.id)).map((p) => p.id) : [];
    const ipponPrompt = kind === 'ippon' && (phase === 'prompt' || phase === 'answer') ? s.matchups[0]?.prompt : undefined;

    const onShow = phase === 'reveal' || phase === 'encore' || phase === 'score';
    const m = onShow ? s.matchups[s.current] : undefined;
    let matchup: MatchupView | null = null;
    if (m) {
      const authorsShown = phase !== 'reveal';
      const lines = new Map((m.result?.lines ?? []).map((l) => [l.answerId, l]));
      const answers: AnswerCard[] = matchupAnswers(s, m.index)
        .sort(byId)
        .map((a) => {
          const c: AnswerCard = { id: a.id, text: a.hidden ? '[hidden]' : a.text, en: a.hidden ? '' : a.en, hidden: a.hidden, english: a.english };
          if (me && a.authorId === me.id) c.mine = true;
          if (romaji && !a.hidden && !a.english) c.romaji = toRomaji(a.kana);
          if (authorsShown) {
            const line = lines.get(a.id);
            c.authorId = a.authorId;
            c.authorName = ctx.player(a.authorId)?.name ?? '(left)';
            c.votes = line?.votes ?? 0;
            c.points = line ? line.votePoints + line.ipponPoints + line.bonus + line.encoreBonus : 0;
            c.winner = line?.winner ?? false;
            c.ippon = line?.ippon ?? false;
            c.encore = m.encores[a.authorId] ?? null;
            c.style = a.style;
          }
          return c;
        });
      matchup = {
        id: m.index,
        index: s.matchups.filter((x) => x.index < m.index && matchupAnswers(s, x.index).length).length,
        count: s.matchups.filter((x) => matchupAnswers(s, x.index).length).length,
        prompt: card(stageVersion(m.prompt), m.prompt.photo, romaji),
        answers,
        voters: voters(s, m, ctx),
        voted: Object.keys(m.votes),
        ippon: authorsShown && !!m.result?.ippon,
        natural: phase === 'score' ? { ...naturalFor(s, m), ...(romaji ? { romaji: toRomaji(naturalFor(s, m).kana) } : {}) } : null,
        pattern: phase === 'score' ? m.prompt.pattern : null,
      };
    }

    let mine: MeView | null = null;
    if (me) {
      const slots = s.slots[me.id] ?? [];
      let slot: SlotView | null = null;
      const open = inAnswer ? currentSlot(s, me.id) : undefined;
      if (open) {
        const pm = s.matchups[open.matchup]!;
        slot = {
          index: slots.indexOf(open),
          count: slots.length,
          prompt: card(open.version, pm.prompt.photo, romaji),
          sayFirst: !open.tilesShown,
          sayFirstMs: SAY_FIRST_MS,
          tiles: open.tilesShown ? open.tiles.map((t) => tileView(t, romaji)) : [],
          frames: open.tilesShown ? open.frames.map((f) => ({ id: f.id, text: f.frame.text, kana: f.frame.kana, en: f.frame.en, slot: f.slot })) : [],
          englishOk: kind !== 'head-to-head',
        };
      }
      const done = inAnswer
        ? slots
            .filter((x) => x.answerId)
            .map((x) => ({ prompt: x.version.text, answer: s.answers.find((a) => a.id === x.answerId)?.text ?? '' }))
        : [];
      const myAnswer = m ? visibleAnswers(s, m.index).find((a) => a.authorId === me.id) : undefined;
      const anyMine = m ? matchupAnswers(s, m.index).find((a) => a.authorId === me.id) : undefined;
      const line = myAnswer && m?.result?.lines.find((l) => l.answerId === myAnswer.id);
      let encore: MeView['encore'] = 'none';
      if (phase === 'encore' && m && myAnswer) encore = m.encores[me.id] ? 'done' : line?.winner ? 'winner' : 'author';
      mine = {
        level: me.level,
        slot,
        done,
        canVote: phase === 'reveal' && !!m && !m.votes[me.id] && voters(s, m, ctx).includes(me.id),
        votedFor: (phase === 'reveal' && m && m.votes[me.id]) || null,
        encore,
        tip:
          phase === 'score' && m && anyMine
            ? {
                mine: anyMine.sentence,
                natural: m.prompt.exampleAnswer,
                pattern: m.prompt.pattern,
                formTips: anyMine.formTips,
                style: anyMine.style,
                points: line ? line.votePoints + line.ipponPoints + line.bonus + line.encoreBonus : 0,
                votes: line?.votes ?? 0,
              }
            : null,
      };
    }

    return {
      mode: 'oogiri',
      round: s.round,
      totalRounds: TOTAL_ROUNDS,
      kind,
      multiplier: multiplierFor(s.round),
      phaseAt: s.phaseAt,
      placeholder: s.placeholder,
      cushions,
      answered,
      prompt: ipponPrompt ? card(stageVersion(ipponPrompt), ipponPrompt.photo) : null,
      matchup,
      matchupCount: s.matchups.length,
      steal: phase === 'penalty' && s.steal ? { playerId: s.steal.playerId, name: ctx.player(s.steal.playerId)?.name ?? '' } : null,
      me: mine,
    };
  },

  awards(s, ctx) {
    const out: Award[] = [];
    const players = ctx.players();
    const award = (id: string, playerId: string) => {
      const a: HostAward | undefined = ctx.content.hostAwards.find((x) => x.id === id);
      const name = a ? { text: a.name.text, en: a.name.en } : AWARD_FALLBACK[id]!;
      const p = ctx.player(playerId);
      if (p) out.push({ playerId, name: p.name, title: name.text, en: name.en });
    };
    const best = (f: (st: PlayerStats) => number): string | null => {
      let top: string | null = null;
      let val = 0;
      for (const p of players) {
        const v = f(stats(s, p.id));
        if (v > val) [top, val] = [p.id, v];
      }
      return top;
    };
    const winner = [...players].sort((a, b) => b.score - a.score || a.seat - b.seat)[0];
    if (winner && winner.score > 0) award('pon.award.cushion-tower', winner.id);
    const ippon = best((st) => st.ippons);
    if (ippon) award('pon.award.ippon-king', ippon);
    const brave = best((st) => st.brave);
    if (brave) award('pon.award.bravest-japanese', brave);
    const callback = best((st) => st.callbackVotes);
    if (callback) award('pon.award.best-callback', callback);
    if (s.steal) award('pon.award.cushions-stolen', s.steal.playerId);
    return out;
  },
};
