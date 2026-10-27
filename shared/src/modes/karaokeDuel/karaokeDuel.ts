// Karaoke Duel (backlog): two singers duel through a short original song, line by line.
// The TV plays the backing and guide melody and bounces a ball over the lyrics; the singer
// holds a button on their phone and sings. Each take scores pronunciation 60%, pitch 25% and
// timing 15% (scoring.ts). Everyone else sings along for a small chorus bonus and votes for
// the crowd favourite. See docs/modes/karaoke-duel.md.
//
// Phases, per round (one song, one duel):
//   prompt  the song card: title, lyrics and English, who is duelling
//   answer  one sing turn: one singer sings one line. In a sing-along song each turn has its own
//           count-in and both duelists sing every line, taking turns to go first. In a continuous
//           song the track plays straight through and each turn is one line of it: the duelists
//           trade lines, a take may land after its turn has ended, and the next singer's count-in
//           runs at the end of the turn before.
//   reveal  the crowd vote (skipped when nobody is watching: a 2-player game)
//   score   the duel's result; the duel's loser may pick the next song from three random ones
// then finale after the last round.
//
// Songs: each round plays the next track (a song, whatever its versions) from a shuffled queue, so no
// track comes up twice until all have played, then a random one of its recorded takes, and a lyric
// set for the room's Audience setting (kids, family or cheeky; lyrics/). The loser's pick is optional:
// the three choices are the next three in the queue, so nobody can always fall back on a favourite.

import type { JpText, Level } from '../../../../content/src/types.js';
import { isUtterance, type Utterance } from '../../japanese/kana.js';
import type { Audience } from '../../protocol.js';
import { isObject, moveError, MOVE_OK, shuffled, type Award, type Mode, type ModeContext, type ModePlayer } from '../mode.js';
import { lyricSetsOf } from './lyrics/index.js';
import { parseTake, pronScore, scoreTake, type TakeScore } from './scoring.js';
import { beatMs, lineMs, noteTimes, romajiMorae, SONGS, sungRomaji, withLyrics, wordsOf, type LyricSet, type Song, type SongStyle } from './songs.js';

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
/** Songs the loser chooses between. */
export const PICK_CHOICES = 3;
/** Lines sung per sing-along song (they have 4). */
export const MAX_LINES = 4;
/** Continuous songs: a take may arrive this long after its line ends (the recogniser is slow). */
export const LATE_MS = 10_000;
/** Continuous songs: after the last line, time for the last take before the song ends. */
export const SONG_TAIL_MS = 5_000;

export const DURATIONS = {
  intro: 12_000,
  songCard: 8_000,
  songCardKana: 10_000,
  vote: 12_000,
  score: 9_000,
  /** The duel result while the loser picks the next song. */
  scorePick: 14_000,
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

/** The duel's loser choosing the next song (the score phase). */
export interface SongPick {
  chooserId: string;
  /** Track keys: the next ones in the queue. */
  options: string[];
  /** The track picked; null with `decided` is "Surprise me". */
  chosen: string | null;
  decided: boolean;
}

export interface KaraokeState {
  totalRounds: number;
  round: number;
  /**
   * The tracks still to play, in order: track keys (a song's group, or its id), each played as a
   * random take; a version id plays that version. Refilled, reshuffled, once it runs out.
   */
  songOrder: string[];
  /** The version playing (a Song id). */
  songId: string | null;
  /** The lyric set it is sung with; null for the version's own lines. */
  lyricsId: string | null;
  pick: SongPick | null;
  duel: { a: string; b: string } | null;
  /** The sing turns of this round, in order (`beat`: where the line starts in a continuous song). */
  turns: { line: number; singerId: string; beat?: number }[];
  turnIdx: number;
  /** Counts every sing turn of the game; moves name it so a late take can't land in the next turn. */
  turnNo: number;
  /** Server time the current line's first beat falls on. */
  lineAt: number;
  /** Continuous songs: server time of the song's beat 0 (0 until it starts). */
  songAt: number;
  /** Continuous songs: the turn number of the song's first turn (turn k is firstTurnNo + k). */
  firstTurnNo: number;
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
  | { kind: 'vote'; playerId: string }
  /** The duel's loser chooses the next song: a track from the choices, or null for "Surprise me". */
  | { kind: 'pick'; track: string | null };

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
  /** The backing's chords, spread evenly over the line; empty when the bass follows the melody. */
  chords: string[];
}

export interface SongView {
  id: string;
  title: JpText;
  bpm: number;
  beatMs: number;
  style: SongStyle;
  lines: LineView[];
  /** The whole song plays as one track and the duelists trade lines. */
  continuous: boolean;
  /** The produced instrumental: its id in the stage's tracks, its bar 0 in the file, and the stretches played. */
  track: { id: string; start: number; segments: [number, number][] } | null;
  /** The chorus lines (shown on the song card for everyone to learn). */
  chorus: number[];
  /** Whose words these are: the lyric set's audience, or null for the version's own lines (family). */
  audience: Audience | null;
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
  /** The round's sing turns, in order (`at`: server time the line starts, continuous songs). */
  order: { line: number; singerId: string; at: number | null }[];
  /** Continuous songs: server time of beat 0 of the track (0 before it starts). */
  songAt: number;
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
  /** The loser picking the next song (score phase). */
  pick: { chooserId: string; options: { track: string; title: JpText; style: SongStyle }[]; chosen: string | null; decided: boolean } | null;
  tally: ({ playerId: string } & Tally)[];
  /** Somebody at the table plays at Kana level, so the stage shows romaji. */
  romaji: boolean;
  finished: boolean;
  mine: {
    role: 'duelist' | 'audience';
    level: Level;
    isMyTurn: boolean;
    canSing: boolean;
    /**
     * The turn my phone should be ready to sing: the current one if it's mine, else (continuous
     * songs) the next one if it's mine, so the hold can start on its count-in. Null once sent.
     */
    singTurn: { no: number; index: number; line: number; lineAt: number } | null;
    canChorus: boolean;
    canVote: boolean;
    voted: string | null;
    /** I lost the duel and may pick the next song. */
    canPick: boolean;
    /** My takes this round, with what the recogniser heard. */
    takes: (TakeView & { heard: string })[];
    /** My chorus on the current turn. */
    chorus: { ok: boolean; points: number } | null;
    chorusPoints: number;
  } | null;
}

// ---- helpers ----

/** The version playing, with the round's lyric set's words. */
const songOf = (s: KaraokeState): Song | undefined => {
  const song = SONGS.find((x) => x.id === s.songId);
  return song && withLyrics(song, lyricSetsOf(song.id).find((x) => x.id === s.lyricsId));
};

/** A track: one song, whatever its versions (its group, or its own id). */
export const trackOf = (song: Song): string => song.group ?? song.id;
export const TRACK_KEYS: readonly string[] = [...new Set(SONGS.map(trackOf))];
const versionsOf = (track: string) => SONGS.filter((x) => trackOf(x) === track);
const isKidsTrack = (track: string) => versionsOf(track).every((x) => x.kids);
const pickOne = <T>(list: readonly T[], random: () => number): T => list[Math.floor(random() * list.length)]!;

/**
 * The tracks a game plays, in order. For kids everything is shuffled together; otherwise the
 * grown-up songs come first and the children's sing-alongs only once those have all come up.
 */
export function songQueue(audience: Audience, random: () => number): string[] {
  if (audience === 'kids') return shuffled([...TRACK_KEYS], random);
  return [...shuffled(TRACK_KEYS.filter((x) => !isKidsTrack(x)), random), ...shuffled(TRACK_KEYS.filter(isKidsTrack), random)];
}

/** The words a version can be sung with for an audience: its sets for it (its own lines are a family set). */
export function lyricChoices(song: Song, audience: Audience): (LyricSet | null)[] {
  const sets = lyricSetsOf(song.id).filter((x) => x.audience === audience);
  return audience === 'family' ? [null, ...sets] : sets;
}

/**
 * What a queue entry plays: for a track key, one of its recorded takes at random (each take as likely,
 * however many versions it has), then a version and lyric set for the audience; for a version id,
 * that version. A version with no words for the audience (the children's sing-alongs) sings its own.
 */
export function pickSong(entry: string, audience: Audience, random: () => number): { songId: string; lyricsId: string | null } | null {
  const versions = TRACK_KEYS.includes(entry) ? versionsOf(entry) : SONGS.filter((x) => x.id === entry);
  if (!versions.length) return null;
  const fits = versions.flatMap((song) => lyricChoices(song, audience).map((set) => ({ song, set })));
  const pool = fits.length ? fits : versions.map((song) => ({ song, set: null }));
  const takeOf = (song: Song) => song.track?.id ?? song.id;
  const take = pickOne([...new Set(pool.map((x) => takeOf(x.song)))], random);
  const { song, set } = pickOne(pool.filter((x) => takeOf(x.song) === take), random);
  return { songId: song.id, lyricsId: set?.id ?? null };
}

/** Takes the round's track off the queue: the loser's pick, or the next one (refilling an empty queue). */
function nextTrack(s: KaraokeState, audience: Audience, random: () => number): string | undefined {
  topUp(s, audience, random, 1);
  const i = s.pick?.chosen ? s.songOrder.indexOf(s.pick.chosen) : 0;
  return s.songOrder.splice(Math.max(0, i), 1)[0];
}

/** Makes sure the queue holds `n` tracks, adding a fresh shuffle that doesn't repeat the one just played. */
function topUp(s: KaraokeState, audience: Audience, random: () => number, n: number): void {
  if (s.songOrder.length >= n) return;
  const last = SONGS.find((x) => x.id === s.songId);
  const more = songQueue(audience, random).filter((x) => !s.songOrder.includes(x));
  if (last && more[0] === trackOf(last) && more.length > 1) more.push(more.shift()!);
  s.songOrder.push(...more);
}

/** Who picks the next song: the duel's loser, or on a tie either duelist at random. Null if they've left. */
function chooserOf(s: KaraokeState, ctx: ModeContext): string | null {
  if (!s.duel || !s.result) return null;
  const { a, b } = s.duel;
  const winners = s.result.winners;
  const id = winners.length === 1 ? (winners[0] === a ? b : a) : ctx.random() < 0.5 ? a : b;
  return ctx.player(id)?.connected ? id : null;
}
const isDuelist = (s: KaraokeState, id: string) => !!s.duel && (s.duel.a === id || s.duel.b === id);
const currentTurn = (s: KaraokeState) => (s.turnIdx >= 0 ? s.turns[s.turnIdx] : undefined);
export const isContinuous = (song: Song | undefined): boolean => !!song?.form;
const barMs = (song: Song) => COUNT_IN_BEATS * beatMs(song.bpm);
/** Continuous songs: the server time turn k's line starts. */
const turnAt = (s: KaraokeState, song: Song, k: number) => s.songAt + Math.round((s.turns[k]?.beat ?? 0) * beatMs(song.bpm));
/** The turn number of turn index k this round. */
const turnNoOf = (s: KaraokeState, song: Song | undefined, k: number) => (isContinuous(song) ? s.firstTurnNo + k : s.turnNo);
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

/** The lines sung more than once in a continuous song: its chorus. */
export function chorusLines(song: Song): number[] {
  const count = new Map<number, number>();
  for (const p of song.form ?? []) count.set(p.line, (count.get(p.line) ?? 0) + 1);
  return [...count].filter(([, n]) => n > 1).map(([line]) => line);
}

/** A continuous song's turns: its placements, with A and B as the duel's first and second seat. */
export function planForm(duel: { a: string; b: string }, song: Song): { line: number; singerId: string; beat: number }[] {
  return (song.form ?? []).map((p) => ({ line: p.line, singerId: p.by === 'A' ? duel.a : duel.b, beat: p.beat }));
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
    romajiMorae: sungRomaji(romajiMorae(line)),
    notes: noteTimes(line, song.bpm),
    ms: lineMs(line, song.bpm),
    chords: line.chords?.split(/\s+/).filter(Boolean) ?? [],
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
  ctx.phrase(playerId, { itemId: `karaoke.${s.lyricsId ?? song.id}.${line}`, text: l.text, kana: l.kana, en: l.en, outcome });
}

/** Every turn of a continuous song that has no take by the song's end counts as missed. */
function markMissing(s: KaraokeState, ctx: ModeContext): void {
  const song = songOf(s);
  if (!isContinuous(song) || s.turnIdx < 0) return;
  s.turns.forEach((turn, k) => {
    const turnNo = turnNoOf(s, song, k);
    if (k > s.turnIdx || s.takes.some((t) => t.turnNo === turnNo)) return;
    s.takes.push({ turnNo, line: turn.line, playerId: turn.singerId, via: null, heard: '', score: { quality: 0, pron: 0, pitch: null, timing: null, similarity: 0, pitchUsed: false }, points: 0, missed: true });
    if (ctx.player(turn.singerId)) phraseFor(s, ctx, turn.singerId, turn.line, 'seen');
  });
  s.at = ctx.now;
}

function settleRound(s: KaraokeState, ctx: ModeContext): void {
  const duel = s.duel;
  if (!duel) return;
  const ids = [duel.a, duel.b];
  const sung: Record<string, number> = { [duel.a]: 0, [duel.b]: 0 };
  const linesWon: Record<string, number> = { [duel.a]: 0, [duel.b]: 0 };
  for (const t of s.takes) sung[t.playerId] = (sung[t.playerId] ?? 0) + t.points;
  // Lines both duelists sing (in a continuous song only the chorus lines).
  const lines = new Set(s.turns.map((t) => t.line).filter((line) => s.turns.some((t) => t.line === line && t.singerId === duel.a) && s.turns.some((t) => t.line === line && t.singerId === duel.b)));
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
      songOrder: songQueue(ctx.audience ?? 'family', random),
      songId: null,
      lyricsId: null,
      pick: null,
      duel: null,
      turns: [],
      turnIdx: -1,
      turnNo: 0,
      lineAt: 0,
      songAt: 0,
      firstTurnNo: 0,
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
        const audience = ctx.audience ?? 'family';
        const random = () => ctx.random();
        const next = nextTrack(s, audience, random);
        const played = next ? pickSong(next, audience, random) : null;
        s.songId = played?.songId ?? null;
        s.lyricsId = played?.lyricsId ?? null;
        s.pick = null;
        s.duel = pickDuel(ctx.players(), s.duelCount, s.lastPair, () => ctx.random());
        s.takes = [];
        s.chorus = [];
        s.votes = {};
        s.result = null;
        s.turnIdx = -1;
        s.songAt = 0;
        const song = songOf(s);
        s.turns = s.duel && song ? (isContinuous(song) ? planForm(s.duel, song) : planTurns(s.duel, Math.min(MAX_LINES, song.lines.length))) : [];
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
        if (song && isContinuous(song)) {
          // The track starts with the first turn and runs on: every line's time comes from it.
          if (s.turnIdx === 0) {
            s.songAt = ctx.now + PRE_ROLL_MS;
            s.firstTurnNo = s.turnNo;
          }
          s.lineAt = turnAt(s, song, s.turnIdx);
        } else s.lineAt = ctx.now + PRE_ROLL_MS + (song ? Math.round(COUNT_IN_BEATS * beatMs(song.bpm)) : 0);
        break;
      }
      case 'reveal':
        markMissing(s, ctx);
        ctx.cue({ host: 'chochin', event: 'encore_cheer' });
        break;
      case 'score': {
        markMissing(s, ctx);
        settleRound(s, ctx);
        // Before the next round, the loser may choose it from the next few in the queue.
        if (isLastRound(s)) break;
        topUp(s, ctx.audience ?? 'family', () => ctx.random(), PICK_CHOICES);
        const chooserId = chooserOf(s, ctx);
        const options = s.songOrder.slice(0, PICK_CHOICES);
        if (chooserId && options.length >= 2) s.pick = { chooserId, options, chosen: null, decided: false };
        break;
      }
      case 'finale':
        s.finished = true;
        s.turnIdx = -1;
        break;
    }
  },

  leave(s, phase, ctx) {
    if (phase !== 'answer') return;
    if (isContinuous(songOf(s))) {
      // Takes may still land for the line just sung; misses are counted when the song ends.
      if (s.turnIdx === s.turns.length - 1) markMissing(s, ctx);
      return;
    }
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
        if (!song || !turn) return 5_000;
        if (!isContinuous(song)) return turnMs(song, turn.line);
        // Up to the next singer's count-in (one bar before their line), or the song's end.
        const k = s.turnIdx;
        const end = k + 1 < s.turns.length ? turnAt(s, song, k + 1) - barMs(song) : turnAt(s, song, k) + lineMs(song.lines[turn.line]!, song.bpm) + SONG_TAIL_MS;
        return Math.max(300, end - ctx.now);
      }
      case 'reveal':
        return DURATIONS.vote;
      case 'score':
        return s.pick ? DURATIONS.scorePick : DURATIONS.score;
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
        if (isContinuous(songOf(s))) {
          // The track runs on whatever happens; only the last line can end the song early.
          if (s.turnIdx < s.turns.length - 1) return false;
          return s.turns.every((_, k) => s.takes.some((t) => t.turnNo === s.firstTurnNo + k));
        }
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
      const song = songOf(s);
      if (!song) return moveError('wrong-phase');
      let k = s.turnIdx;
      if (isContinuous(song)) {
        // The track doesn't wait: a take can be sung on the next turn's count-in, which starts at
        // the end of this turn, and can land after its turn has ended (the recogniser is slow).
        k = raw.turn - s.firstTurnNo;
        const lineEnd = k >= 0 && k < s.turns.length ? turnAt(s, song, k) + lineMs(song.lines[s.turns[k]!.line]!, song.bpm) : 0;
        if (k < 0 || k >= s.turns.length || k > s.turnIdx + (raw.kind === 'sing' ? 1 : 0) || ctx.now > lineEnd + LATE_MS) return moveError('wrong-phase');
      } else if (raw.turn !== s.turnNo) {
        // A take from an earlier turn arriving late: a harmless race with the clock.
        return moveError('wrong-phase');
      }
      const turn = s.turns[k];
      if (!turn) return moveError('wrong-phase');
      const turnNo = turnNoOf(s, song, k);
      const line = song.lines[turn.line]!;

      if (raw.kind === 'chorus') {
        if (isDuelist(s, playerId)) return moveError('not-eligible');
        if (s.chorus.some((c) => c.turnNo === turnNo && c.playerId === playerId)) return moveError('already-answered');
        const u = raw.utterance;
        if (!isUtterance(u) || u.via !== 'speech') return moveError('bad-utterance');
        const { score } = pronScore(line, u, me.level);
        const ok = score >= CHORUS_PASS;
        const used = s.chorus.filter((c) => c.playerId === playerId).reduce((n, c) => n + c.points, 0);
        const points = ok ? Math.max(0, Math.min(CHORUS_POINTS, CHORUS_CAP - used)) : 0;
        s.chorus.push({ turnNo, playerId, ok, points });
        give(s, ctx, playerId, points);
        if (ok) {
          tallyFor(s, playerId).chorus += points;
          phraseFor(s, ctx, playerId, turn.line, 'said');
        }
        s.at = ctx.now;
        return MOVE_OK;
      }

      if (turn.singerId !== playerId) return moveError('not-your-turn');
      if (s.takes.some((t) => t.turnNo === turnNo)) return moveError('already-answered');
      const take = parseTake(raw);
      if ('error' in take) return moveError(take.error);
      const score = scoreTake(line, song.bpm, lineMs(line, song.bpm), take, me.level);
      const points = score.quality * (isLastRound(s) ? 2 : 1);
      s.takes.push({ turnNo, line: turn.line, playerId, via: take.utterance.via, heard: take.utterance.text, score, points, missed: false });
      give(s, ctx, playerId, points);
      const t = tallyFor(s, playerId);
      t.takes += 1;
      t.best = Math.max(t.best, score.quality);
      const outcome = take.utterance.via !== 'speech' ? 'seen' : score.similarity >= 0.8 ? 'said' : score.similarity >= 0.5 ? 'retry' : 'missed';
      phraseFor(s, ctx, playerId, turn.line, outcome);
      s.at = ctx.now;
      return MOVE_OK;
    }

    if (raw.kind === 'pick') {
      if (phase !== 'score' || !s.pick) return moveError('wrong-phase');
      if (s.pick.chooserId !== playerId) return moveError('not-eligible');
      if (s.pick.decided) return moveError('already-answered');
      // A track from the choices, or null for "Surprise me" (the next in the queue).
      if (raw.track !== null && (typeof raw.track !== 'string' || !s.pick.options.includes(raw.track))) return moveError('bad-move');
      s.pick.chosen = raw.track;
      s.pick.decided = true;
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
      const myChorus = s.chorus.find((c) => c.turnNo === s.turnNo && c.playerId === id);
      // The current turn if it's mine, or in a continuous song the next one, while it has no take.
      let singTurn: NonNullable<KaraokeDuelView['mine']>['singTurn'] = null;
      if (turn && song && !s.finished) {
        for (const k of isContinuous(song) ? [s.turnIdx, s.turnIdx + 1] : [s.turnIdx]) {
          const t = s.turns[k];
          const no = turnNoOf(s, song, k);
          if (t?.singerId !== id || s.takes.some((x) => x.turnNo === no)) continue;
          singTurn = { no, index: k, line: t.line, lineAt: isContinuous(song) ? turnAt(s, song, k) : s.lineAt };
          break;
        }
      }
      mine = {
        role: duelist ? 'duelist' : 'audience',
        level: me?.level ?? 'n5',
        isMyTurn: myTurn,
        canSing: !!singTurn,
        singTurn,
        canChorus: !!turn && !duelist && !myChorus && !s.finished,
        canVote: phase === 'reveal' && !duelist && s.votes[id] === undefined,
        voted: s.votes[id] ?? null,
        canPick: phase === 'score' && !!s.pick && s.pick.chooserId === id && !s.pick.decided,
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
        ? {
            id: song.id,
            title: song.title,
            bpm: song.bpm,
            beatMs: beatMs(song.bpm),
            style: song.style,
            lines: song.lines.slice(0, isContinuous(song) ? song.lines.length : MAX_LINES).map((_, i) => lineView(song, i)),
            continuous: isContinuous(song),
            track: song.track ? { id: song.track.id, start: song.track.start, segments: song.track.segments.map(([x, y]) => [x, y]) } : null,
            chorus: chorusLines(song),
            audience: lyricSetsOf(song.id).find((x) => x.id === s.lyricsId)?.audience ?? null,
          }
        : null,
      duel: s.duel,
      order: s.turns.map((t, k) => ({ line: t.line, singerId: t.singerId, at: song && isContinuous(song) && s.songAt ? turnAt(s, song, k) : null })),
      songAt: s.songAt,
      turn: turn ? { no: s.turnNo, index: s.turnIdx, line: turn.line, singerId: turn.singerId, lineAt: s.lineAt, countInBeats: COUNT_IN_BEATS } : null,
      takes: s.takes.map(takeView),
      chorus: s.chorus.map((c) => ({ turnNo: c.turnNo, playerId: c.playerId, ok: c.ok })),
      vote: { open: phase === 'reveal', voters: Object.keys(s.votes) },
      result: phase === 'score' || phase === 'finale' ? s.result : null,
      pick:
        phase === 'score' && s.pick
          ? {
              chooserId: s.pick.chooserId,
              options: s.pick.options.map((track) => {
                const song = versionsOf(track)[0] ?? SONGS.find((x) => x.id === track)!;
                return { track, title: song.title, style: song.style };
              }),
              chosen: s.pick.chosen,
              decided: s.pick.decided,
            }
          : null,
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
    if (fave) out.push({ playerId: fave.id, name: fave.name, title: 'はくしゅ賞', en: 'Applause Prize: most crowd-favourite votes won' });
    const choir = best('chorus');
    if (choir) out.push({ playerId: choir.id, name: choir.name, title: 'コーラス賞', en: 'Chorus Prize: sang along the most' });
    return out;
  },
};
