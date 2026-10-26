// Karaoke Duel (backlog): two singers duel through a short original song, line by line.
// The TV plays the backing and guide melody and bounces a ball over the lyrics; the singer
// holds a button on their phone and sings. Each take scores pronunciation 60%, pitch 25% and
// timing 15% (scoring.ts). Everyone else sings along for a small chorus bonus and votes for
// the crowd favourite. See docs/modes/karaoke-duel.md.
//
// Phases, per round (one song, one duel):
//   prompt  the song card: title, lyrics and English, who is duelling
//   answer  one sing turn: count-in, then one singer sings one line (both duelists sing every
//           line, taking turns to go first)
//   reveal  the crowd vote (skipped when nobody is watching: a 2-player game)
//   score   the duel's result
// then finale after the last round.

import type { JpText, Level } from '../../../../content/src/types.js';
import { isUtterance, type Utterance } from '../../japanese/kana.js';
import { isObject, moveError, MOVE_OK, shuffled, type Award, type Mode, type ModeContext, type ModePlayer } from '../mode.js';
import { parseTake, pronScore, scoreTake, type TakeScore } from './scoring.js';
import { beatMs, lineMs, noteTimes, romajiMorae, SONGS, wordsOf, type Song } from './songs.js';

// ---- tuning ----

/** Count-in before every line: one bar. */
export const COUNT_IN_BEATS = 4;
/** A breath between the phase opening and the count-in, so the stage and phone are ready. */
export const PRE_ROLL_MS = 700;
/** After the line: time for the singer to let go and the recogniser to hand back. */
export const TAIL_MS = 3_000;
/** A sung-along line that is at least this good (pronunciation, 0–1) earns chorus points. */
export const CHORUS_PASS = 0.6;
export const CHORUS_POINTS = 10;
/** Chorus points per player per round at most (a bonus, kept small: see the doc's 30% pool). */
export const CHORUS_CAP = 40;
/** Crowd favourite bonus (split on a tie). */
export const CROWD_BONUS = 60;
/** Lines sung per song (all v1 songs have 4). */
export const MAX_LINES = 4;

export const DURATIONS = {
  intro: 12_000,
  songCard: 8_000,
  songCardKana: 10_000,
  vote: 12_000,
  score: 9_000,
  finale: 9_000,
} as const;

// ---- state ----

export interface TakeRecord {
  turnNo: number;
  line: number;
  playerId: string;
  via: Utterance['via'] | null;
  /** What the recogniser heard (private: only the singer sees it). */
  heard: string;
  score: TakeScore;
  points: number;
  /** Nothing arrived before the turn ended. */
  missed: boolean;
}

export interface ChorusRecord {
  turnNo: number;
  playerId: string;
  ok: boolean;
  points: number;
}

export interface Tally {
  duels: number;
  wins: number;
  takes: number;
  best: number;
  chorus: number;
  crowd: number;
  points: number;
}

export interface RoundResult {
  /** Singing points per duelist this round (after the last-round double). */
  sung: Record<string, number>;
  /** Lines each duelist won (the better take on that line). */
  linesWon: Record<string, number>;
  votes: Record<string, number>;
  /** Crowd favourite(s): most votes, at least one. Empty with no votes. */
  favourites: string[];
  crowdBonus: number;
  /** Duel winner(s) by sung points plus crowd bonus; both on a tie. */
  winners: string[];
}

export interface KaraokeState {
  totalRounds: number;
  round: number;
  songOrder: string[];
  songId: string | null;
  duel: { a: string; b: string } | null;
  /** The sing turns of this round, in order. */
  turns: { line: number; singerId: string }[];
  turnIdx: number;
  /** Counts every sing turn of the game; moves name it so a late take can't land in the next turn. */
  turnNo: number;
  /** Server time the current line's first beat falls on. */
  lineAt: number;
  takes: TakeRecord[];
  chorus: ChorusRecord[];
  votes: Record<string, string>;
  result: RoundResult | null;
  duelCount: Record<string, number>;
  lastPair: string;
  tally: Record<string, Tally>;
  /** Server time of the last change (the stage and phones set their clocks by it). */
  at: number;
  finished: boolean;
}

export type KaraokeMove =
  | { kind: 'sing'; turn: number; utterance: Utterance; pitch?: (number | null)[] | null; onsetMs?: number; durMs?: number; timing?: 'mic' | 'button' }
  | { kind: 'chorus'; turn: number; utterance: Utterance }
  | { kind: 'vote'; playerId: string };

// ---- view ----

export interface LineView {
  text: string;
  kana: string;
  romaji: string;
  en: string;
  /** Morae, grouped by word. */
  words: string[][];
  /** One romaji syllable per mora. */
  romajiMorae: string[];
  /** One per mora: start and length in ms from the line's first beat, and the MIDI note. */
  notes: { startMs: number; ms: number; midi: number }[];
  ms: number;
}

export interface SongView {
  id: string;
  title: JpText;
  bpm: number;
  beatMs: number;
  lines: LineView[];
}

export interface TakeView {
  turnNo: number;
  line: number;
  playerId: string;
  via: Utterance['via'] | null;
  quality: number;
  pron: number;
  pitch: number | null;
  timing: number | null;
  pitchUsed: boolean;
  points: number;
  missed: boolean;
}

export interface KaraokeDuelView {
  mode: 'karaoke-duel';
  at: number;
  round: number;
  totalRounds: number;
  /** The last round counts double. */
  doubled: boolean;
  song: SongView | null;
  duel: { a: string; b: string } | null;
  /** The round's sing turns, in order. */
  order: { line: number; singerId: string }[];
  turn: {
    no: number;
    index: number;
    line: number;
    singerId: string;
    /** Server time of the line's first beat; the count-in starts COUNT_IN_BEATS beats earlier. */
    lineAt: number;
    countInBeats: number;
  } | null;
  takes: TakeView[];
  chorus: { turnNo: number; playerId: string; ok: boolean }[];
  vote: { open: boolean; voters: string[] };
  result: RoundResult | null;
  tally: ({ playerId: string } & Tally)[];
  /** Somebody at the table plays at Kana level, so the stage shows romaji. */
  romaji: boolean;
  finished: boolean;
  mine: {
    role: 'duelist' | 'audience';
    level: Level;
    isMyTurn: boolean;
    canSing: boolean;
    canChorus: boolean;
    canVote: boolean;
    voted: string | null;
    /** My takes this round, with what the recogniser heard. */
    takes: (TakeView & { heard: string })[];
    /** My chorus on the current turn. */
    chorus: { ok: boolean; points: number } | null;
    chorusPoints: number;
  } | null;
}

// ---- helpers ----

const songOf = (s: KaraokeState): Song | undefined => SONGS.find((x) => x.id === s.songId);
const isDuelist = (s: KaraokeState, id: string) => !!s.duel && (s.duel.a === id || s.duel.b === id);
const currentTurn = (s: KaraokeState) => (s.turnIdx >= 0 ? s.turns[s.turnIdx] : undefined);
const isLastRound = (s: KaraokeState) => s.round === s.totalRounds;

function tallyFor(s: KaraokeState, id: string): Tally {
  return (s.tally[id] ??= { duels: 0, wins: 0, takes: 0, best: 0, chorus: 0, crowd: 0, points: 0 });
}

function give(s: KaraokeState, ctx: ModeContext, id: string, points: number): void {
  const p = Math.round(points);
  if (p <= 0) return;
  tallyFor(s, id).points += p;
  ctx.award(id, p);
}

/** Total length of one sing turn's phase. */
export function turnMs(song: Song, line: number): number {
  return PRE_ROLL_MS + COUNT_IN_BEATS * beatMs(song.bpm) + lineMs(song.lines[line]!, song.bpm) + TAIL_MS;
}

/**
 * The next duel: the two players who have duelled least (connected first), avoiding the
 * same pair twice in a row when there's anyone else; ties broken at random.
 */
export function pickDuel(players: readonly ModePlayer[], duelCount: Record<string, number>, lastPair: string, random: () => number): { a: string; b: string } | null {
  const connected = players.filter((p) => p.connected);
  const pool = connected.length >= 2 ? connected : players;
  if (pool.length < 2) return null;
  const jitter = new Map(pool.map((p) => [p.id, random()]));
  const ranked = [...pool].sort((x, y) => (duelCount[x.id] ?? 0) - (duelCount[y.id] ?? 0) || jitter.get(x.id)! - jitter.get(y.id)!);
  const key = (a: string, b: string) => [a, b].sort().join('|');
  let a = ranked[0]!;
  let b = ranked[1]!;
  if (key(a.id, b.id) === lastPair && ranked.length > 2) b = ranked[2]!;
  // Seat order decides who goes first on line 1, so it doesn't depend on the shuffle.
  if (a.seat > b.seat) [a, b] = [b, a];
  return { a: a.id, b: b.id };
}

/** Both duelists sing every line; who goes first alternates by line (A B, B A, A B …). */
export function planTurns(duel: { a: string; b: string }, lines: number): { line: number; singerId: string }[] {
  const out: { line: number; singerId: string }[] = [];
  for (let line = 0; line < lines; line++) {
    const [first, second] = line % 2 === 0 ? [duel.a, duel.b] : [duel.b, duel.a];
    out.push({ line, singerId: first }, { line, singerId: second });
  }
  return out;
}

function lineView(song: Song, i: number): LineView {
  const line = song.lines[i]!;
  return {
    text: line.text,
    kana: line.kana,
    romaji: line.romaji,
    en: line.en,
    words: wordsOf(line),
    romajiMorae: romajiMorae(line),
    notes: noteTimes(line, song.bpm),
    ms: lineMs(line, song.bpm),
  };
}

const takeView = (t: TakeRecord): TakeView => ({
  turnNo: t.turnNo,
  line: t.line,
  playerId: t.playerId,
  via: t.via,
  quality: t.score.quality,
  pron: t.score.pron,
  pitch: t.score.pitch,
  timing: t.score.timing,
  pitchUsed: t.score.pitchUsed,
  points: t.points,
  missed: t.missed,
});

function phraseFor(s: KaraokeState, ctx: ModeContext, playerId: string, line: number, outcome: 'said' | 'retry' | 'missed' | 'seen'): void {
  const song = songOf(s);
  const l = song?.lines[line];
  if (!song || !l) return;
  ctx.phrase(playerId, { itemId: `karaoke.${song.id}.${line}`, text: l.text, kana: l.kana, en: l.en, outcome });
}

function settleRound(s: KaraokeState, ctx: ModeContext): void {
  const duel = s.duel;
  if (!duel) return;
  const ids = [duel.a, duel.b];
  const sung: Record<string, number> = { [duel.a]: 0, [duel.b]: 0 };
  const linesWon: Record<string, number> = { [duel.a]: 0, [duel.b]: 0 };
  for (const t of s.takes) sung[t.playerId] = (sung[t.playerId] ?? 0) + t.points;
  const lines = new Set(s.takes.map((t) => t.line));
  for (const line of lines) {
    const qa = s.takes.find((t) => t.line === line && t.playerId === duel.a)?.score.quality ?? 0;
    const qb = s.takes.find((t) => t.line === line && t.playerId === duel.b)?.score.quality ?? 0;
    if (qa > qb) linesWon[duel.a]! += 1;
    else if (qb > qa) linesWon[duel.b]! += 1;
  }
  const votes: Record<string, number> = { [duel.a]: 0, [duel.b]: 0 };
  for (const target of Object.values(s.votes)) votes[target] = (votes[target] ?? 0) + 1;
  const top = Math.max(...ids.map((id) => votes[id] ?? 0));
  const favourites = top > 0 ? ids.filter((id) => votes[id] === top) : [];
  const crowdBonus = favourites.length ? Math.round(((isLastRound(s) ? 2 : 1) * CROWD_BONUS) / favourites.length) : 0;
  for (const id of favourites) {
    give(s, ctx, id, crowdBonus);
    tallyFor(s, id).crowd += 1;
  }
  const final = (id: string) => (sung[id] ?? 0) + (favourites.includes(id) ? crowdBonus : 0);
  const best = Math.max(...ids.map(final));
  const winners = best > 0 ? ids.filter((id) => final(id) === best) : [];
  for (const id of winners) tallyFor(s, id).wins += 1;
  s.result = { sung, linesWon, votes, favourites, crowdBonus, winners };

  const winner = winners.length === 1 ? ctx.player(winners[0]!) : undefined;
  const avg = winner ? s.takes.filter((t) => t.playerId === winner.id).reduce((n, t) => n + t.score.quality, 0) / Math.max(1, s.takes.filter((t) => t.playerId === winner.id).length) : 0;
  if (winner && avg >= 45) ctx.cue({ host: 'chochin', event: 'reveal_react', tier: avg >= 85 ? 'ippon' : 'good', slots: { name: winner.name } });
  else ctx.cue({ host: 'chochin', event: 'miss_kind' });
}

// ---- the mode ----

export const karaokeDuelMode: Mode<KaraokeState, KaraokeDuelView> = {
  info: {
    id: 'karaoke-duel',
    title: 'Karaoke Duel',
    titleJa: 'カラオケ対決',
    blurb: 'Sing short Japanese songs head to head. Words, tune and timing all count.',
    host: 'chochin',
    minPlayers: 2,
    maxPlayers: 8,
    roundChoices: [4, 2, 6],
    usesPack: false,
    phrasebookTitle: 'Song sheet',
    phaseLabels: { prompt: 'Song card', answer: 'Sing', reveal: 'Crowd vote', score: 'Duel result', finale: 'Finale' },
  },

  setup(ctx, opts) {
    const random = () => ctx.random();
    const rounds = Math.max(1, Math.min(12, opts.rounds ?? 4));
    return {
      totalRounds: rounds,
      round: 0,
      songOrder: shuffled(SONGS.map((x) => x.id), random),
      songId: null,
      duel: null,
      turns: [],
      turnIdx: -1,
      turnNo: 0,
      lineAt: 0,
      takes: [],
      chorus: [],
      votes: {},
      result: null,
      duelCount: {},
      lastPair: '',
      tally: Object.fromEntries(ctx.players().map((p) => [p.id, { duels: 0, wins: 0, takes: 0, best: 0, chorus: 0, crowd: 0, points: 0 }])),
      at: ctx.now,
      finished: false,
    };
  },

  next(s, from, ctx) {
    switch (from) {
      case 'intro':
        return 'prompt';
      case 'prompt':
        return s.turns.length ? 'answer' : 'score';
      case 'answer': {
        if (s.turnIdx + 1 < s.turns.length) return 'answer';
        const audience = ctx.players().filter((p) => !isDuelist(s, p.id));
        return audience.length ? 'reveal' : 'score';
      }
      case 'reveal':
        return 'score';
      case 'score':
        return s.round < s.totalRounds ? 'prompt' : 'finale';
      default:
        return 'recap';
    }
  },

  enter(s, phase, ctx) {
    s.at = ctx.now;
    switch (phase) {
      case 'prompt': {
        s.round += 1;
        s.songId = s.songOrder[(s.round - 1) % s.songOrder.length] ?? null;
        s.duel = pickDuel(ctx.players(), s.duelCount, s.lastPair, () => ctx.random());
        s.takes = [];
        s.chorus = [];
        s.votes = {};
        s.result = null;
        s.turnIdx = -1;
        const song = songOf(s);
        s.turns = s.duel && song ? planTurns(s.duel, Math.min(MAX_LINES, song.lines.length)) : [];
        if (s.duel) {
          for (const id of [s.duel.a, s.duel.b]) {
            s.duelCount[id] = (s.duelCount[id] ?? 0) + 1;
            tallyFor(s, id).duels += 1;
          }
          s.lastPair = [s.duel.a, s.duel.b].sort().join('|');
        }
        // Chōchin-san hands the first singer the mic (his bank has no song lines yet: see the doc).
        const first = s.turns[0] ? ctx.player(s.turns[0].singerId) : undefined;
        if (song && first) ctx.cue({ host: 'chochin', event: 'encore_invite', slots: { name: first.name }, prompt: { text: song.title.text, kana: song.title.kana, en: song.title.en } });
        break;
      }
      case 'answer': {
        s.turnIdx += 1;
        s.turnNo += 1;
        const song = songOf(s);
        s.lineAt = ctx.now + PRE_ROLL_MS + (song ? Math.round(COUNT_IN_BEATS * beatMs(song.bpm)) : 0);
        break;
      }
      case 'reveal':
        ctx.cue({ host: 'chochin', event: 'encore_cheer' });
        break;
      case 'score':
        settleRound(s, ctx);
        break;
      case 'finale':
        s.finished = true;
        s.turnIdx = -1;
        break;
    }
  },

  leave(s, phase, ctx) {
    if (phase !== 'answer') return;
    const turn = currentTurn(s);
    if (!turn || s.takes.some((t) => t.turnNo === s.turnNo)) return;
    s.takes.push({
      turnNo: s.turnNo,
      line: turn.line,
      playerId: turn.singerId,
      via: null,
      heard: '',
      score: { quality: 0, pron: 0, pitch: null, timing: null, similarity: 0, pitchUsed: false },
      points: 0,
      missed: true,
    });
    if (ctx.player(turn.singerId)) phraseFor(s, ctx, turn.singerId, turn.line, 'seen');
    s.at = ctx.now;
  },

  duration(s, phase, ctx) {
    const song = songOf(s);
    switch (phase) {
      case 'intro':
        return DURATIONS.intro;
      case 'prompt': {
        const kana = s.duel && [s.duel.a, s.duel.b].some((id) => ctx.player(id)?.level === 'kana');
        return kana ? DURATIONS.songCardKana : DURATIONS.songCard;
      }
      case 'answer': {
        const turn = currentTurn(s);
        return song && turn ? turnMs(song, turn.line) : 5_000;
      }
      case 'reveal':
        return DURATIONS.vote;
      case 'score':
        return DURATIONS.score;
      case 'finale':
        return DURATIONS.finale;
      default:
        return 5_000;
    }
  },

  done(s, phase, ctx) {
    const anyoneHere = ctx.connected().length > 0;
    switch (phase) {
      case 'prompt':
        return !s.duel;
      case 'answer': {
        const turn = currentTurn(s);
        if (!turn) return true;
        if (s.takes.some((t) => t.turnNo === s.turnNo)) return true;
        const singer = ctx.player(turn.singerId);
        return (!singer || !singer.connected) && anyoneHere;
      }
      case 'reveal': {
        const voters = ctx.connected().filter((p) => !isDuelist(s, p.id));
        return voters.every((p) => s.votes[p.id] !== undefined);
      }
      default:
        return false;
    }
  },

  move(s, phase, playerId, raw, ctx) {
    if (!isObject(raw)) return moveError('bad-move');
    if (s.finished) return moveError('wrong-phase');
    const me = ctx.player(playerId);
    if (!me) return moveError('not-playing');

    if (raw.kind === 'sing' || raw.kind === 'chorus') {
      if (phase !== 'answer') return moveError('wrong-phase');
      if (typeof raw.turn !== 'number' || !Number.isInteger(raw.turn)) return moveError('bad-move');
      // A take from an earlier turn arriving late: a harmless race with the clock.
      if (raw.turn !== s.turnNo) return moveError('wrong-phase');
      const turn = currentTurn(s);
      const song = songOf(s);
      if (!turn || !song) return moveError('wrong-phase');
      const line = song.lines[turn.line]!;

      if (raw.kind === 'chorus') {
        if (isDuelist(s, playerId)) return moveError('not-eligible');
        if (s.chorus.some((c) => c.turnNo === s.turnNo && c.playerId === playerId)) return moveError('already-answered');
        const u = raw.utterance;
        if (!isUtterance(u) || u.via !== 'speech') return moveError('bad-utterance');
        const { score } = pronScore(line, u, me.level);
        const ok = score >= CHORUS_PASS;
        const used = s.chorus.filter((c) => c.playerId === playerId).reduce((n, c) => n + c.points, 0);
        const points = ok ? Math.max(0, Math.min(CHORUS_POINTS, CHORUS_CAP - used)) : 0;
        s.chorus.push({ turnNo: s.turnNo, playerId, ok, points });
        give(s, ctx, playerId, points);
        if (ok) {
          tallyFor(s, playerId).chorus += points;
          phraseFor(s, ctx, playerId, turn.line, 'said');
        }
        s.at = ctx.now;
        return MOVE_OK;
      }

      if (turn.singerId !== playerId) return moveError('not-your-turn');
      if (s.takes.some((t) => t.turnNo === s.turnNo)) return moveError('already-answered');
      const take = parseTake(raw);
      if ('error' in take) return moveError(take.error);
      const score = scoreTake(line, song.bpm, lineMs(line, song.bpm), take, me.level);
      const points = score.quality * (isLastRound(s) ? 2 : 1);
      s.takes.push({ turnNo: s.turnNo, line: turn.line, playerId, via: take.utterance.via, heard: take.utterance.text, score, points, missed: false });
      give(s, ctx, playerId, points);
      const t = tallyFor(s, playerId);
      t.takes += 1;
      t.best = Math.max(t.best, score.quality);
      const outcome = take.utterance.via === 'typed' ? 'seen' : score.similarity >= 0.8 ? 'said' : score.similarity >= 0.5 ? 'retry' : 'missed';
      phraseFor(s, ctx, playerId, turn.line, outcome);
      s.at = ctx.now;
      return MOVE_OK;
    }

    if (raw.kind === 'vote') {
      if (phase !== 'reveal') return moveError('wrong-phase');
      if (isDuelist(s, playerId)) return moveError('not-eligible');
      if (s.votes[playerId] !== undefined) return moveError('already-voted');
      if (typeof raw.playerId !== 'string' || !isDuelist(s, raw.playerId)) return moveError('bad-vote');
      s.votes[playerId] = raw.playerId;
      s.at = ctx.now;
      return MOVE_OK;
    }

    return moveError('bad-move');
  },

  release(s, playerId) {
    delete s.votes[playerId];
  },

  progress(s) {
    return { round: s.round, totalRounds: s.totalRounds };
  },

  view(s, phase, viewer, ctx) {
    const song = songOf(s);
    const turn = phase === 'answer' ? currentTurn(s) : undefined;
    const players = ctx.players();
    let mine: KaraokeDuelView['mine'] = null;
    if (viewer.kind === 'player') {
      const id = viewer.playerId;
      const me = ctx.player(id);
      const duelist = isDuelist(s, id);
      const myTurn = !!turn && turn.singerId === id;
      const took = s.takes.some((t) => t.turnNo === s.turnNo);
      const myChorus = s.chorus.find((c) => c.turnNo === s.turnNo && c.playerId === id);
      mine = {
        role: duelist ? 'duelist' : 'audience',
        level: me?.level ?? 'n5',
        isMyTurn: myTurn,
        canSing: myTurn && !took && !s.finished,
        canChorus: !!turn && !duelist && !myChorus && !s.finished,
        canVote: phase === 'reveal' && !duelist && s.votes[id] === undefined,
        voted: s.votes[id] ?? null,
        takes: s.takes.filter((t) => t.playerId === id).map((t) => ({ ...takeView(t), heard: t.heard })),
        chorus: myChorus && turn ? { ok: myChorus.ok, points: myChorus.points } : null,
        chorusPoints: s.chorus.filter((c) => c.playerId === id).reduce((n, c) => n + c.points, 0),
      };
    }
    return {
      mode: 'karaoke-duel',
      at: s.at,
      round: s.round,
      totalRounds: s.totalRounds,
      doubled: isLastRound(s),
      song: song
        ? { id: song.id, title: song.title, bpm: song.bpm, beatMs: beatMs(song.bpm), lines: song.lines.slice(0, MAX_LINES).map((_, i) => lineView(song, i)) }
        : null,
      duel: s.duel,
      order: s.turns,
      turn: turn ? { no: s.turnNo, index: s.turnIdx, line: turn.line, singerId: turn.singerId, lineAt: s.lineAt, countInBeats: COUNT_IN_BEATS } : null,
      takes: s.takes.map(takeView),
      chorus: s.chorus.map((c) => ({ turnNo: c.turnNo, playerId: c.playerId, ok: c.ok })),
      vote: { open: phase === 'reveal', voters: Object.keys(s.votes) },
      result: phase === 'score' || phase === 'finale' ? s.result : null,
      tally: players.map((p) => ({ playerId: p.id, ...tallyFor(s, p.id) })),
      romaji: players.some((p) => p.level === 'kana'),
      finished: s.finished,
      mine,
    };
  },

  awards(s, ctx) {
    const out: Award[] = [];
    const players = ctx.players();
    const best = (key: keyof Tally) => {
      let top: ModePlayer | undefined;
      for (const p of players) if ((s.tally[p.id]?.[key] ?? 0) > (top ? (s.tally[top.id]?.[key] ?? 0) : 0)) top = p;
      return top;
    };
    const star = best('wins');
    if (star) out.push({ playerId: star.id, name: star.name, title: 'カラオケ スター', en: 'Karaoke Star: most duels won' });
    const take = best('best');
    if (take) out.push({ playerId: take.id, name: take.name, title: 'ベスト テイク', en: `Best Take: the night’s best line (${s.tally[take.id]!.best})` });
    const fave = best('crowd');
    if (fave) out.push({ playerId: fave.id, name: fave.name, title: 'はくしゅ しょう', en: 'Applause Prize: most crowd-favourite votes won' });
    const choir = best('chorus');
    if (choir) out.push({ playerId: choir.id, name: choir.name, title: 'コーラス しょう', en: 'Chorus Prize: sang along the most' });
    return out;
  },
};
