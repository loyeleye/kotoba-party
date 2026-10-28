// Happyōkai! (はっぴょうかい！, "the recital"): one player gives a short talk in Japanese about a silly
// title, on slides they have never seen. Another player picks each next slide in secret. Everyone else
// reacts with aizuchi stamps, asks a question, and grades the talk with はなまる. See docs/modes/happyokai.md.
//
// Everyone presents (twice each with 3 or 4 players). Each talk:
//   prompt  backstage: the presenter picks one of two titles and rehearses the opening in private;
//           the TV shows Chōchin-san's holiday photos.
//   answer  the talk: the title slide, two or three picture slides (or mishaps) and the closing, on the
//           mode's own clock. Every clip the presenter says is a caption on the TV. The assistant picks
//           each next slide from three (one that fits the title, one random, one むちゃぶり) and can push
//           a cue card; the audience sends aizuchi stamps.
//   encore  question time: every audience phone says a question card; the presenter picks one and answers.
//   reveal  the audience grades the talk, 1 to 3 はなまる.
//   score   the report card; points are paid as it leaves.
// After the last talk, `finale`: everyone votes for the best talk.

import type { JpText, Level } from '../../../../content/src/types.js';
import { MAX_ANSWER_LENGTH } from '../../constants.js';
import { isUtterance, normalizeReading, soundKey, utteranceReading, type Utterance } from '../../japanese/kana.js';
import { toRomaji } from '../../japanese/romaji.js';
import { playerTextAllowed } from '../../moderation.js';
import type { Audience, Phase, Viewer } from '../../protocol.js';
import { cleanText, isObject, moveError, MOVE_OK, shuffled, type Award, type Mode, type ModeContext, type ModePlayer } from '../mode.js';
import {
  answerFrames,
  closingFor,
  framesFor,
  GRADE_STAMPS,
  holidayPicture,
  messageFor,
  mishapOf,
  MISHAPS,
  openingFor,
  questionsFor,
  readySentences,
  recoveryFor,
  slideOf,
  slidePicture,
  slidesFor,
  teacherComment,
  titleOf,
  titlesFor,
  type MishapId,
  type Slide,
  type Title,
} from './content.js';
import { forLevel } from './ruby.js';

// ---- tuning ----

/** Picture slides per talk, and talks per presenter, by player count: a show of about 15–18 minutes. */
export function showPlan(players: number): { laps: number; pictures: number } {
  if (players <= 3) return { laps: 2, pictures: 3 };
  if (players === 4) return { laps: 2, pictures: 2 };
  if (players <= 6) return { laps: 1, pictures: 3 };
  return { laps: 1, pictures: 2 };
}

/** How long each slide stays up. Picture slides go by the presenter's level, plus a beat for the laugh. */
export const STEP_MS = { title: 15_000, picture: { kana: 20_000, n5: 25_000, n4: 30_000 }, laugh: 1_500, close: 12_000 } as const;
/** The presenter can move on once they've said something on a slide, or after this long. */
export const MIN_NEXT_MS = 5_000;
/** Sentences on one slide that light the れんぞく (non-stop) badge, by level. */
export const RENZOKU = { kana: 2, n5: 3, n4: 4 } as const;

/** The presenter's はなまる points: an average of 1 earns 0, 2 half, 3 all of it. */
export const HANAMARU_POINTS = 700;
/**
 * Speaking (the 30% pool, capped): priced so the ritual can't fill it. Columns are said from memory,
 * read from the phone, typed, tapped. Picture-slide sentences count once each, at most 3 per slide.
 */
export const SAY = {
  open: [40, 20, 10, 5],
  close: [20, 10, 5, 3],
  sentence: [30, 15, 10, 3],
  mishap: [20, 10, 5, 3],
  answer: [60, 30, 15, 5],
} as const;
export const PER_SLIDE = 3;
export const RENZOKU_BONUS = 20;
export const SPEAK_CAP = 300;
/** The assistant: per sentence said out loud on a slide they picked (capped), and a mishap recovered. */
export const ASSIST = { sentence: 20, sentenceCap: 120, mishapSaid: 50, mishapOther: 20 } as const;
/** Question time: saying your card out loud, other ways, and being picked. */
export const ASK = { said: 15, other: 5, picked: 35 } as const;
/** The best-talk vote at the end of the show. */
export const VOTE = { presenter: 100, assistant: 50 } as const;
export const DEFAULT_GRADE = 2;

export const STAMPS = ['omoshiroi', 'hee', 'sugoi', 'naruhodo', 'ee', 'hakushu'] as const;
export type StampKind = (typeof STAMPS)[number];
export const STAMP_GAP_MS = 900;
const STAMP_KEEP = 24;
const CAPTION_KEEP = 4;

export const DURATIONS = {
  intro: 16_000,
  /** Backstage: pick a title, rehearse. Kana players get longer. */
  prompt: { kana: 30_000, n5: 25_000, n4: 25_000 },
  encore: 30_000,
  reveal: 12_000,
  score: 9_000,
  finale: 20_000,
} as const;

// ---- state ----

export type StepKind = 'title' | 'picture' | 'mishap' | 'close';
export type ChoiceKind = 'fit' | 'random' | 'wild';
/** The order of the four "how it was said" columns in SAY. */
export type LineKind = 'own' | 'read' | 'typed' | 'tap';
const KIND_RANK: Record<LineKind, number> = { own: 0, read: 1, typed: 2, tap: 3 };

export interface Step {
  kind: StepKind;
  slideId: string | null;
  mishapId: MishapId | null;
  /** The assistant's choice that put this slide up (picture slides). */
  pickedBy: ChoiceKind | null;
  at: number;
  ms: number;
}

export interface Line {
  id: string;
  /** The slide it was said on, or -1 in question time. */
  step: number;
  text: string;
  /** What the TV shows: the phone's sentence when it was read out (so a mis-hearing never shows), else `text`. */
  shown: string;
  /** Furigana for `shown`, when it's the phone's sentence. */
  furigana?: [string, string][];
  kind: LineKind;
  sentences: number;
  hidden: boolean;
}

export interface Stamp {
  id: number;
  kind: StampKind;
  at: number;
  step: number;
}

export interface Asked {
  playerId: string;
  text: string;
  kana: string;
  furigana?: [string, string][];
  en: string;
  via: Utterance['via'];
}

export interface Talk {
  index: number;
  presenterId: string;
  assistantId: string | null;
  pictures: number;
  titleChoices: string[];
  titleId: string | null;
  ready: boolean;
  steps: Step[];
  /** The assistant's choices for the next picture slide. */
  choices: { slideId: string; kind: ChoiceKind }[];
  pick: { slideId: string } | { mishapId: MishapId } | null;
  mishapUsed: boolean;
  /** A ready sentence the assistant pushed to the presenter's phone, for the current slide. */
  kanpe: { step: number; key: number } | null;
  lines: Line[];
  stamps: Stamp[];
  stampCount: Record<StampKind, number>;
  lastStamp: Record<string, number>;
  /** Question time: each audience player's three cards, what they asked, and the one the presenter chose. */
  cards: Record<string, JpText[]>;
  asked: Asked[];
  chosen: string | null;
  grades: Record<string, number>;
  graders: string[];
  done: boolean;
  result: TalkResult | null;
}

export interface TalkResult {
  hanamaru: number;
  presenterPoints: number;
  speakPoints: number;
  assistantPoints: number;
  sentences: number;
  best: number;
}

export interface PlayerStats {
  hanamaru: number;
  talks: number;
  assistPoints: number;
  best: number;
  askedAloud: number;
  votes: number;
  /** おもしろい stamps on a mishap slide of their talk (the ハプニング award). */
  mishapLaughs: number;
  stamps: Partial<Record<StampKind, number>>;
}

export interface TalkRecord {
  index: number;
  presenterId: string;
  assistantId: string | null;
  titleId: string | null;
  /** The line the room heard best: the longest caption on a picture slide. */
  quote: string | null;
}

export interface HappyokaiState {
  /** Presenters in order (with 3 or 4 players, everyone twice). */
  order: string[];
  pictures: number;
  talk: Talk | null;
  done: TalkRecord[];
  votes: Record<string, number>;
  usedTitles: string[];
  usedSlides: string[];
  stats: Record<string, PlayerStats>;
  phaseAt: number;
  stampSeq: number;
  /** Server time of the last change (views have no clock of their own; the screens line up with it). */
  now: number;
}

// ---- view ----

export interface SlideView {
  kind: StepKind;
  id: string | null;
  word: JpText | null;
  emoji: string;
  picture: string | null;
  mishap: { id: MishapId; name: JpText; emoji: string } | null;
  /** The graph mishap: which way the line goes. */
  up?: boolean;
  /** The message mishap: who it's from and what it says. */
  message?: { from: JpText; text: JpText };
  /** How the assistant's choice was labelled (picture slides). */
  choice?: ChoiceKind | null;
  at: number;
  ms: number;
}

export interface CaptionView {
  id: string;
  step: number;
  text: string;
  furigana?: [string, string][];
  kind: LineKind;
  hidden: boolean;
}

export interface HappyokaiView {
  mode: 'happyokai';
  /** Server time of the last change: the screens line their clocks up with it (the slide timer, stamps). */
  at: number;
  talk: number;
  totalTalks: number;
  phaseAt: number;
  presenterId: string | null;
  assistantId: string | null;
  title: JpText | null;
  topic: JpText | null;
  /** Backstage: the presenter has picked and is rehearsing; whether they're ready. */
  backstage: { photo: 1 | 2 | 3 | null; picture: string | null; ready: boolean; last: boolean } | null;
  step: number;
  steps: number;
  slide: SlideView | null;
  captions: CaptionView[];
  stamps: { id: number; kind: StampKind; at: number }[];
  stampCount: Record<StampKind, number>;
  /** Sentences on the current slide, and the threshold for the れんぞく badge. */
  renzoku: number;
  renzokuAt: number;
  /** Question time: who has a question ready (never what it is until it's chosen), and the chosen one. */
  question: { askers: string[]; chosen: Asked | null; answered: boolean } | null;
  grading: { count: number; needed: number } | null;
  /** The report card (score). `flowers` are the grades, high to low (never who gave them). */
  card:
    | (TalkResult & {
        flowers: number[];
        stamp: JpText;
        comment: JpText;
        loudest: { kind: StampKind; n: number } | null;
      })
    | null;
  /** The best-talk vote (finale). */
  vote: { talks: { index: number; presenterId: string; assistantId: string | null; title: JpText | null; quote: string | null; votes: number }[]; count: number; needed: number } | null;
  me: {
    role: 'presenter' | 'assistant' | 'audience';
    level: Level;
    titleChoices: { key: number; jp: JpText; romaji?: string }[];
    /** Backstage: the opening and closing to rehearse. */
    rehearse: { opening: JpText & { romaji?: string }; closing: JpText & { romaji?: string } } | null;
    /** The presenter's script for this slide: the opening, the closing or a mishap's recovery line. */
    script: (JpText & { romaji?: string }) | null;
    word: JpText | null;
    frames: string[];
    ready: (JpText & { key: number; romaji?: string })[];
    kanpe: number | null;
    canNext: boolean;
    lines: CaptionView[];
    /** The assistant's next-slide choices, the mishaps they can still play, what they picked. */
    choices: (SlideView & { choice: ChoiceKind })[];
    mishaps: { id: MishapId; name: JpText; emoji: string }[];
    picked: string | null;
    /** The presenter's ready sentences, for the assistant's cue card. */
    cueCards: (JpText & { key: number })[];
    /** Question time: my cards (audience), or the questions to choose from (presenter). */
    questions: (JpText & { key: number; romaji?: string })[];
    asked: string | null;
    pickQuestion: (JpText & { playerId: string })[];
    answerFrames: string[];
    canGrade: boolean;
    graded: number | null;
    canVote: boolean;
    votedFor: number | null;
    points: number;
    /** The presenter's private report: sentences and the best run. */
    report: { sentences: number; best: number } | null;
  } | null;
}

export type HappyokaiMove =
  | { kind: 'title'; key: number }
  | { kind: 'go' }
  | { kind: 'say'; utterance: Utterance }
  | { kind: 'ready'; key: number }
  | { kind: 'next' }
  | { kind: 'pick'; slideId: string }
  | { kind: 'pick'; mishapId: MishapId }
  | { kind: 'kanpe'; key: number }
  | { kind: 'stamp'; stamp: StampKind }
  | { kind: 'ask'; key: number; utterance?: Utterance }
  | { kind: 'choose'; playerId: string }
  | { kind: 'grade'; n: number }
  | { kind: 'vote'; talk: number }
  | { kind: 'hide'; lineId: string };

// ---- helpers ----

const round5 = (n: number) => Math.round(n / 5) * 5;
const blankStats = (): PlayerStats => ({ hanamaru: 0, talks: 0, assistPoints: 0, best: 0, askedAloud: 0, votes: 0, mishapLaughs: 0, stamps: {} });
const statsOf = (s: HappyokaiState, id: string) => (s.stats[id] ??= blankStats());
const blankCount = (): Record<StampKind, number> => ({ omoshiroi: 0, hee: 0, sugoi: 0, naruhodo: 0, ee: 0, hakushu: 0 });
const JP = /[ぁ-ゖァ-ヺ一-鿿]/g;
const audienceOf = (ctx: ModeContext): Audience => ctx.audience ?? 'family';

/**
 * Sentences in one clip: pieces between 。！？ with at least two Japanese characters each (so a stray
 * "えっと" or an English aside doesn't count twice). At most four from one clip.
 */
export function sentenceCount(text: string): number {
  return Math.min(4, text.split(/[。．.！!？?\n]+/).filter((p) => (p.match(JP) ?? []).length >= 2).length);
}

/** The phone's sentence the presenter read out, if they read one (rather than saying their own). */
export function readFrom(u: Utterance, scripts: readonly JpText[]): JpText | null {
  const heard = soundKey(utteranceReading(u));
  if (heard.length < 4) return null;
  return (
    scripts.find((s) => {
      const key = soundKey(normalizeReading(s.kana));
      return key.length >= 4 && (heard.includes(key) || key.includes(heard));
    }) ?? null
  );
}

const closeStep = (t: Talk): number => t.pictures + 1;
const stepOf = (t: Talk): Step | undefined => t.steps[t.steps.length - 1];
const stepIndex = (t: Talk): number => t.steps.length - 1;
const titleFor = (t: Talk): Title | undefined => (t.titleId ? titleOf(t.titleId) : undefined);

/** The talk's first picture slide, for question cards and the graph. */
function talkWord(t: Talk): Slide | undefined {
  for (const st of t.steps) if (st.slideId) return slideOf(st.slideId);
  return undefined;
}

/** A graph mishap goes up or down, fixed per talk. */
const graphUp = (t: Talk): boolean => t.index % 2 === 0;

/** Presenters: everyone in a shuffled order; with 3 or 4 players, the same order again. */
export function presenterOrder(players: readonly ModePlayer[], random: () => number): string[] {
  const lap = shuffled(
    players.map((p) => p.id),
    random,
  );
  const { laps } = showPlan(players.length);
  return laps === 2 ? [...lap, ...lap] : lap;
}

/** The assistant: the presenter's left neighbour (next seat round), skipping anyone who has assisted more often. */
export function pickAssistant(s: HappyokaiState, presenterId: string, players: readonly ModePlayer[]): string | null {
  const seat = players.find((p) => p.id === presenterId)?.seat ?? 0;
  const n = Math.max(...players.map((p) => p.seat), 1) + 1;
  const dist = (p: ModePlayer) => (p.seat - seat + n) % n;
  const assisted = (id: string) => s.done.filter((r) => r.assistantId === id).length;
  const others = players.filter((p) => p.id !== presenterId && p.connected);
  others.sort((a, b) => assisted(a.id) - assisted(b.id) || dist(a) - dist(b));
  return others[0]?.id ?? null;
}

/** Three choices: one that fits the title's tags, one random and one むちゃぶり from the wild pool. */
export function dealChoices(pool: readonly Slide[], used: readonly string[], titleTags: readonly string[], random: () => number): { slideId: string; kind: ChoiceKind }[] {
  let fresh = pool.filter((x) => !used.includes(x.id));
  if (fresh.length < 6) fresh = [...pool];
  const take = (from: readonly Slide[]): Slide | undefined => {
    const left = from.filter((x) => !out.some((o) => o.slideId === x.id));
    return left.length ? left[Math.floor(random() * left.length)] : undefined;
  };
  const out: { slideId: string; kind: ChoiceKind }[] = [];
  const fit = take(fresh.filter((x) => !x.wild && x.tags.some((g) => titleTags.includes(g)))) ?? take(fresh.filter((x) => !x.wild));
  if (fit) out.push({ slideId: fit.id, kind: 'fit' });
  const any = take(fresh.filter((x) => !x.wild));
  if (any) out.push({ slideId: any.id, kind: 'random' });
  const wild = take(fresh.filter((x) => x.wild)) ?? take(fresh);
  if (wild) out.push({ slideId: wild.id, kind: 'wild' });
  return out;
}

function presenterLevel(t: Talk, ctx: ModeContext): Level {
  return ctx.player(t.presenterId)?.level ?? 'n5';
}

function stepMs(kind: StepKind, level: Level): number {
  return kind === 'title' ? STEP_MS.title : kind === 'close' ? STEP_MS.close : STEP_MS.picture[level] + STEP_MS.laugh;
}

function deal(s: HappyokaiState, t: Talk, ctx: ModeContext): void {
  const shown = t.steps.map((x) => x.slideId).filter((x): x is string => !!x);
  t.choices = dealChoices(slidesFor(audienceOf(ctx)), [...s.usedSlides, ...shown], titleFor(t)?.tags ?? [], () => ctx.random());
  t.pick = null;
}

/** Puts up the next slide: the assistant's pick (or the "fits" choice), or the closing after the last picture. */
function advanceStep(s: HappyokaiState, t: Talk, ctx: ModeContext): void {
  const i = stepIndex(t);
  if (i >= closeStep(t)) {
    t.done = true;
    return;
  }
  const level = presenterLevel(t, ctx);
  const next = i + 1;
  t.kanpe = null;
  if (next === closeStep(t)) {
    t.steps.push({ kind: 'close', slideId: null, mishapId: null, pickedBy: null, at: ctx.now, ms: stepMs('close', level) });
    t.choices = [];
    t.pick = null;
    return;
  }
  const pick = t.pick ?? (t.choices[0] ? { slideId: t.choices[0].slideId } : null);
  if (pick && 'mishapId' in pick) {
    t.mishapUsed = true;
    t.steps.push({ kind: 'mishap', slideId: null, mishapId: pick.mishapId, pickedBy: null, at: ctx.now, ms: stepMs('mishap', level) });
    ctx.cue({ host: 'chochin', event: `happyokai_mishap_${pick.mishapId}` as never });
  } else {
    const id = pick?.slideId ?? null;
    if (id) s.usedSlides.push(id);
    const kind = t.choices.find((c) => c.slideId === id)?.kind ?? null;
    t.steps.push({ kind: 'picture', slideId: id, mishapId: null, pickedBy: kind, at: ctx.now, ms: stepMs('picture', level) });
  }
  if (next < t.pictures) deal(s, t, ctx);
  else {
    t.choices = [];
    t.pick = null;
  }
}

const linesOn = (t: Talk, step: number): Line[] => t.lines.filter((l) => l.step === step);

/** Sentences said out loud or typed on one slide (the れんぞく count). Taps don't count. */
function renzokuOn(t: Talk, step: number): number {
  return linesOn(t, step)
    .filter((l) => l.kind !== 'tap' && !l.hidden)
    .reduce((n, l) => n + l.sentences, 0);
}

/** The best way a set of lines was said (own words beat reading beat typing beat tapping). */
const bestKind = (lines: readonly Line[]): LineKind | null => (lines.length ? lines.reduce<LineKind>((b, l) => (KIND_RANK[l.kind] < KIND_RANK[b] ? l.kind : b), 'tap') : null);
const price = (table: readonly number[], kind: LineKind | null): number => (kind ? table[KIND_RANK[kind]]! : 0);

/**
 * The presenter's speaking points: the ritual once each, the mishap recovery and the question-time answer
 * once each (by how it was best said), and up to three new sentences per picture slide, plus a れんぞく bonus.
 * A sentence said twice counts once. Capped at SPEAK_CAP.
 */
export function speakPoints(t: Pick<Talk, 'steps' | 'lines'>, level: Level): number {
  let total = 0;
  const seen = new Set<string>();
  t.steps.forEach((st, i) => {
    const lines = t.lines.filter((l) => l.step === i);
    if (st.kind === 'title') total += price(SAY.open, bestKind(lines));
    else if (st.kind === 'close') total += price(SAY.close, bestKind(lines));
    else if (st.kind === 'mishap') total += price(SAY.mishap, bestKind(lines));
    else {
      let n = 0;
      let spoken = 0;
      for (const l of lines) {
        const pieces = l.text.split(/[。．.！!？?\n]+/).filter((p) => (p.match(JP) ?? []).length >= 2);
        for (const p of pieces.slice(0, Math.max(0, l.sentences))) {
          const key = soundKey(normalizeReading(p));
          if (seen.has(key) || n >= PER_SLIDE) continue;
          seen.add(key);
          n += 1;
          total += SAY.sentence[KIND_RANK[l.kind]]!;
          if (l.kind === 'own' || l.kind === 'read') spoken += 1;
        }
        // A tapped sentence the clip splitter can't see still counts once.
        if (!pieces.length && l.kind === 'tap' && n < PER_SLIDE) {
          n += 1;
          total += SAY.sentence[3];
        }
      }
      if (spoken >= RENZOKU[level]) total += RENZOKU_BONUS;
    }
  });
  total += price(SAY.answer, bestKind(t.lines.filter((l) => l.step === -1)));
  return Math.min(SPEAK_CAP, total);
}

/** The assistant's points: sentences said out loud on the slides they picked, and a mishap recovered. */
export function assistPoints(t: Pick<Talk, 'steps' | 'lines'>): number {
  let said = 0;
  let mishap = 0;
  t.steps.forEach((st, i) => {
    const lines = t.lines.filter((l) => l.step === i && !l.hidden);
    if (st.kind === 'picture') said += lines.filter((l) => l.kind === 'own' || l.kind === 'read').reduce((n, l) => n + Math.min(PER_SLIDE, l.sentences), 0);
    if (st.kind === 'mishap' && lines.length) mishap += lines.some((l) => l.kind === 'own' || l.kind === 'read') ? ASSIST.mishapSaid : ASSIST.mishapOther;
  });
  return Math.min(ASSIST.sentenceCap, said * ASSIST.sentence) + mishap;
}

/** The average grade over the grades actually given (DEFAULT_GRADE when nobody graded). */
export function averageGrade(grades: Record<string, number>): number {
  const all = Object.values(grades);
  return all.length ? all.reduce((a, b) => a + b, 0) / all.length : DEFAULT_GRADE;
}

export const hanamaruPoints = (avg: number): number => round5((HANAMARU_POINTS * Math.max(0, avg - 1)) / 2);

function computeResult(t: Talk, level: Level): TalkResult {
  const avg = averageGrade(t.grades);
  let best = 0;
  for (let i = 0; i < t.steps.length; i++) best = Math.max(best, renzokuOn(t, i));
  return {
    hanamaru: Math.round(avg * 10) / 10,
    presenterPoints: hanamaruPoints(avg),
    speakPoints: speakPoints(t, level),
    assistantPoints: t.assistantId ? assistPoints(t) : 0,
    sentences: t.lines.filter((l) => l.kind !== 'tap').reduce((n, l) => n + l.sentences, 0),
    best,
  };
}

function startTalk(s: HappyokaiState, ctx: ModeContext): void {
  const index = s.talk ? s.talk.index + 1 : 0;
  const presenterId = s.order[index]!;
  const audience = audienceOf(ctx);
  // A pair of titles: one about a creature or thing, one about people or a situation, when the pool allows.
  const fresh = titlesFor(audience).filter((x) => !s.usedTitles.includes(x.id));
  const pool = fresh.length >= 2 ? fresh : titlesFor(audience);
  const people = (x: Title) => x.tags.includes('person') || x.tags.includes('work') || x.tags.includes('love') || x.tags.includes('travel');
  const a = shuffled(pool.filter((x) => !people(x)), () => ctx.random())[0];
  const b = shuffled(pool.filter((x) => people(x)), () => ctx.random())[0];
  const titleChoices = (a && b ? [a, b] : shuffled(pool, () => ctx.random()).slice(0, 2)).map((x) => x.id);
  s.talk = {
    index,
    presenterId,
    assistantId: pickAssistant(s, presenterId, ctx.players()),
    // A Kana presenter gets one picture fewer: their sentences are short and each slide is a bigger climb.
    pictures: ctx.player(presenterId)?.level === 'kana' ? Math.max(1, s.pictures - 1) : s.pictures,
    titleChoices,
    titleId: null,
    ready: false,
    steps: [],
    choices: [],
    pick: null,
    mishapUsed: false,
    kanpe: null,
    lines: [],
    stamps: [],
    stampCount: blankCount(),
    lastStamp: {},
    cards: {},
    asked: [],
    chosen: null,
    grades: {},
    graders: [],
    done: false,
    result: null,
  };
}

/** The sentences on the presenter's phone right now: what reading out counts as "read". */
function scriptsFor(t: Talk, ctx: ModeContext): JpText[] {
  const st = stepOf(t);
  const p = ctx.player(t.presenterId);
  const title = titleFor(t);
  if (!st || !p || !title) return [];
  if (st.kind === 'title') return [openingFor(p.level, p.name, title.jp)];
  if (st.kind === 'close') return [closingFor(p.level)];
  if (st.kind === 'mishap') return st.mishapId ? [recoveryFor(st.mishapId, p.level, talkWord(t)?.word ?? null, graphUp(t), audienceOf(ctx))] : [];
  const slide = st.slideId ? slideOf(st.slideId) : undefined;
  return slide ? readySentences(slide, p.level, title.topic) : [];
}

/** Which of Chōchin-san's three holiday photos the backstage curtain shows: talk 1, the middle, the last. */
export function photoBeat(index: number, total: number): 1 | 2 | 3 | null {
  if (index === 0) return 1;
  if (total >= 3 && index === Math.floor(total / 2)) return 2;
  if (total >= 2 && index === total - 1) return 3;
  return null;
}

function phrases(t: Talk, ctx: ModeContext): void {
  const p = ctx.player(t.presenterId);
  const title = titleFor(t);
  if (p && title) {
    const spoke = (step: number) => linesOn(t, step).some((l) => l.kind === 'own' || l.kind === 'read');
    const open = openingFor(p.level, '〜', title.jp);
    const close = closingFor(p.level);
    ctx.phrase(p.id, { itemId: `happyokai:open:${p.level}`, text: open.text, kana: open.kana, en: open.en, outcome: spoke(0) ? 'said' : 'seen' });
    ctx.phrase(p.id, { itemId: `happyokai:close:${p.level}`, text: close.text, kana: close.kana, en: close.en, outcome: spoke(closeStep(t)) ? 'said' : 'seen' });
    t.steps.forEach((st, i) => {
      if (st.kind !== 'mishap' || !st.mishapId) return;
      const r = recoveryFor(st.mishapId, p.level, talkWord(t)?.word ?? null, graphUp(t), audienceOf(ctx));
      ctx.phrase(p.id, { itemId: `happyokai:mishap:${st.mishapId}:${p.level}`, text: r.text, kana: r.kana, en: r.en, outcome: spoke(i) ? 'said' : 'seen' });
    });
  }
  for (const a of t.asked) {
    if (!ctx.player(a.playerId)) continue;
    ctx.phrase(a.playerId, { itemId: `happyokai:q:${a.text}`, text: a.text, kana: a.kana, en: a.en, outcome: a.via === 'speech' ? 'said' : 'seen' });
  }
}

const AIZUCHI: Partial<Record<StampKind, JpText>> = {
  omoshiroi: { text: 'おもしろい！', kana: 'おもしろい！', en: 'Funny! / Interesting!' },
  hee: { text: 'へえー！', kana: 'へえー！', en: 'Oh, really! (interested surprise)' },
  sugoi: { text: 'すごい！', kana: 'すごい！', en: 'Amazing!' },
  naruhodo: { text: 'なるほど。', kana: 'なるほど。', en: 'I see. (to a boss, そうなんですね is politer)' },
  ee: { text: 'えーっ？', kana: 'えーっ？', en: 'What?! (disbelief)' },
};

function slideView(st: Step, t: Talk, audience: Audience, level: Level): SlideView {
  const slide = st.slideId ? slideOf(st.slideId) : undefined;
  const m = st.mishapId ? mishapOf(st.mishapId) : undefined;
  const title = titleFor(t)?.jp ?? null;
  const at = (j: JpText | null | undefined): JpText | null => (j ? forLevel(j, level) : null);
  const view: SlideView = {
    kind: st.kind,
    id: st.slideId,
    word: at(slide?.word ?? (st.kind === 'title' || st.kind === 'close' ? title : null)),
    emoji: slide?.emoji ?? m?.emoji ?? (st.kind === 'close' ? '🙇' : '🎤'),
    picture: slide ? slidePicture(slide.id) : st.mishapId === 'wrong' ? holidayPicture(1) : null,
    mishap: m ? { id: m.id, name: at(m.name)!, emoji: m.emoji } : null,
    choice: st.pickedBy,
    at: st.at,
    ms: st.ms,
  };
  if (m?.id === 'graph') {
    view.up = graphUp(t);
    view.word = at(talkWord(t)?.word);
  }
  if (m?.id === 'upside' || m?.id === 'message') {
    // The upside-down slide, and the one the message pops up over, is the last picture shown.
    const prev = [...t.steps].reverse().find((x) => x.slideId);
    const shown = prev?.slideId ? slideOf(prev.slideId) : undefined;
    if (shown) Object.assign(view, { id: shown.id, word: shown.word, emoji: shown.emoji, picture: slidePicture(shown.id) });
  }
  if (m?.id === 'message') {
    const msg = messageFor(audience);
    view.message = { from: at(msg.from)!, text: at(msg.text)! };
  }
  return view;
}

function choiceView(c: { slideId: string; kind: ChoiceKind }, level: Level): SlideView & { choice: ChoiceKind } {
  const slide = slideOf(c.slideId)!;
  return { kind: 'picture', id: c.slideId, word: forLevel(slide.word, level), emoji: slide.emoji, picture: slidePicture(c.slideId), mishap: null, at: 0, ms: 0, choice: c.kind };
}

const captionOf = (l: Line, own = false): CaptionView => {
  const text = l.hidden && !own ? '' : own ? l.text : l.shown;
  return { id: l.id, step: l.step, text, ...(l.furigana && text === l.shown ? { furigana: l.furigana } : {}), kind: l.kind, hidden: l.hidden };
};

/** The longest caption said on a picture slide, for the best-talk vote. */
function quoteOf(t: Talk): string | null {
  const lines = t.lines.filter((l) => l.step > 0 && l.step < closeStep(t) && !l.hidden && l.kind !== 'tap');
  return lines.sort((a, b) => b.shown.length - a.shown.length)[0]?.shown ?? null;
}

// ---- the mode ----

export const happyokaiMode: Mode<HappyokaiState, HappyokaiView> = {
  info: {
    id: 'happyokai',
    title: 'Happyōkai!',
    titleJa: 'はっぴょうかい！',
    blurb: 'Give a surprise talk in Japanese on slides you’ve never seen. Your assistant picks them.',
    host: 'chochin',
    minPlayers: 3,
    maxPlayers: 8,
    roundChoices: [],
    usesPack: false,
    phrasebookTitle: 'Your presentation phrases',
    phaseLabels: { prompt: 'Backstage', answer: 'The talk', encore: 'Question time', reveal: 'はなまる', score: 'Report card', finale: 'Best talk' },
  },

  setup(ctx) {
    const stats: Record<string, PlayerStats> = {};
    for (const p of ctx.players()) stats[p.id] = blankStats();
    const players = ctx.players();
    return {
      order: presenterOrder(players, () => ctx.random()),
      pictures: showPlan(players.length).pictures,
      talk: null,
      done: [],
      votes: {},
      usedTitles: [],
      usedSlides: [],
      stats,
      phaseAt: ctx.now,
      stampSeq: 0,
      now: ctx.now,
    };
  },

  next(s, from) {
    const t = s.talk;
    switch (from) {
      case 'intro':
        return 'prompt';
      case 'prompt':
        return 'answer';
      case 'answer':
        return 'encore';
      case 'encore':
        return 'reveal';
      case 'reveal':
        return 'score';
      case 'score':
        return t && t.index + 1 < s.order.length ? 'prompt' : s.done.length >= 2 ? 'finale' : 'recap';
      default:
        return 'recap';
    }
  },

  enter(s, phase, ctx) {
    s.phaseAt = ctx.now;
    s.now = ctx.now;
    switch (phase) {
      case 'intro':
        ctx.cue({ host: 'chochin', event: 'happyokai_intro', waitMs: 4_000 });
        break;
      case 'prompt': {
        startTalk(s, ctx);
        const t = s.talk!;
        const name = ctx.player(t.presenterId)?.name ?? '';
        const beat = photoBeat(t.index, s.order.length);
        if (beat) ctx.cue({ host: 'chochin', event: `happyokai_photo_${beat}` as never });
        else ctx.cue({ host: 'chochin', event: t.index === s.order.length - 1 ? 'happyokai_call_last' : 'happyokai_call', slots: { name } });
        break;
      }
      case 'answer': {
        const t = s.talk!;
        if (!t.titleId) t.titleId = t.titleChoices[0] ?? null;
        if (t.titleId && !s.usedTitles.includes(t.titleId)) s.usedTitles.push(t.titleId);
        t.steps = [{ kind: 'title', slideId: null, mishapId: null, pickedBy: null, at: ctx.now, ms: STEP_MS.title }];
        deal(s, t, ctx);
        const beat = photoBeat(t.index, s.order.length);
        // On a photo beat the call-up waited for the photo gag; it comes now, with the title.
        const title = titleFor(t) ? forLevel(titleFor(t)!.jp, presenterLevel(t, ctx)) : undefined;
        if (title) ctx.cue({ host: 'chochin', event: beat ? 'happyokai_call' : 'happyokai_title', slots: { name: ctx.player(t.presenterId)?.name ?? '', title: title.kana }, prompt: { text: title.text, kana: title.kana, en: title.en } });
        break;
      }
      case 'encore': {
        const t = s.talk!;
        const presenter = ctx.player(t.presenterId);
        const title = titleFor(t);
        for (const p of ctx.players()) {
          if (p.id === t.presenterId || !p.connected) continue;
          const level = presenter ? lower(p.level, presenter.level) : p.level;
          t.cards[p.id] = questionsFor(level, talkWord(t) ?? null, title?.topic ?? null, audienceOf(ctx), () => ctx.random());
        }
        ctx.cue({ host: 'chochin', event: 'happyokai_question' });
        break;
      }
      case 'reveal': {
        const t = s.talk!;
        const players = ctx.players();
        // The assistant grades too in a 3-player game, so the grade isn't one person's.
        t.graders = players.filter((p) => p.connected && p.id !== t.presenterId && (p.id !== t.assistantId || players.length <= 3)).map((p) => p.id);
        ctx.cue({ host: 'chochin', event: 'happyokai_grade' });
        break;
      }
      case 'score': {
        const t = s.talk!;
        t.result = computeResult(t, presenterLevel(t, ctx));
        ctx.cue({ host: 'chochin', event: t.result.hanamaru >= 2.5 ? 'happyokai_great' : 'happyokai_card', slots: { name: ctx.player(t.presenterId)?.name ?? '' } });
        break;
      }
      case 'finale':
        ctx.cue({ host: 'chochin', event: 'happyokai_vote' });
        break;
    }
  },

  leave(s, phase, ctx) {
    s.now = ctx.now;
    const t = s.talk;
    if (phase === 'finale') {
      for (const [voter, index] of Object.entries(s.votes)) {
        const r = s.done.find((x) => x.index === index);
        if (!r || r.presenterId === voter) continue;
        if (ctx.player(r.presenterId)) {
          ctx.award(r.presenterId, VOTE.presenter);
          statsOf(s, r.presenterId).votes += 1;
        }
        if (r.assistantId && r.assistantId !== voter && ctx.player(r.assistantId)) ctx.award(r.assistantId, VOTE.assistant);
      }
      for (const p of ctx.players())
        for (const [k, a] of Object.entries(AIZUCHI)) if (statsOf(s, p.id).stamps[k as StampKind] && a) ctx.phrase(p.id, { itemId: `happyokai:aizuchi:${k}`, text: a.text, kana: a.kana, en: a.en, outcome: 'seen' });
      return;
    }
    if (!t) return;
    if (phase === 'answer') t.done = true;
    if (phase === 'score' && t.result) {
      const r = t.result;
      const presenter = ctx.player(t.presenterId);
      if (presenter) {
        ctx.award(presenter.id, r.presenterPoints + r.speakPoints);
        const st = statsOf(s, presenter.id);
        st.hanamaru += r.hanamaru;
        st.talks += 1;
        st.best = Math.max(st.best, r.best);
        st.mishapLaughs += t.stamps.filter((x) => x.kind === 'omoshiroi' && t.steps[x.step]?.kind === 'mishap').length;
      }
      if (t.assistantId && ctx.player(t.assistantId) && r.assistantPoints) {
        ctx.award(t.assistantId, r.assistantPoints);
        statsOf(s, t.assistantId).assistPoints += r.assistantPoints;
      }
      for (const a of t.asked) {
        if (!ctx.player(a.playerId)) continue;
        ctx.award(a.playerId, (a.via === 'speech' ? ASK.said : ASK.other) + (t.chosen === a.playerId ? ASK.picked : 0));
        if (a.via === 'speech') statsOf(s, a.playerId).askedAloud += 1;
      }
      phrases(t, ctx);
      s.done.push({ index: t.index, presenterId: t.presenterId, assistantId: t.assistantId, titleId: t.titleId, quote: quoteOf(t) });
    }
  },

  duration(s, phase, ctx) {
    const t = s.talk;
    switch (phase) {
      case 'intro':
        return DURATIONS.intro;
      case 'prompt': {
        const next = s.order[t ? t.index + 1 : 0] ?? s.order[0];
        return DURATIONS.prompt[ctx.player(next ?? '')?.level ?? 'n5'];
      }
      case 'answer': {
        // The talk runs on its own clock (wake); this is a backstop a little past the longest talk.
        const level = t ? presenterLevel(t, ctx) : 'n5';
        return STEP_MS.title + (t?.pictures ?? 3) * stepMs('picture', level) + STEP_MS.close + 5_000;
      }
      case 'encore':
        return DURATIONS.encore;
      case 'reveal':
        return DURATIONS.reveal;
      case 'score':
        return DURATIONS.score;
      case 'finale':
        return DURATIONS.finale;
      default:
        return 0;
    }
  },

  done(s, phase, ctx) {
    const here = new Set(ctx.connected().map((p) => p.id));
    if (phase === 'finale') {
      const voters = ctx.connected().filter((p) => s.done.some((r) => r.presenterId !== p.id));
      return voters.length > 0 && voters.every((p) => s.votes[p.id] !== undefined);
    }
    const t = s.talk;
    if (!t) return false;
    if (phase === 'prompt') return (!!t.titleId && t.ready) || !here.has(t.presenterId);
    if (phase === 'answer') return t.done;
    if (phase === 'encore') {
      const askers = Object.keys(t.cards).filter((id) => here.has(id));
      if (!askers.length || !here.has(t.presenterId)) return true;
      return !!t.chosen && t.lines.some((l) => l.step === -1);
    }
    if (phase === 'reveal') return t.graders.filter((id) => here.has(id)).every((id) => t.grades[id] !== undefined);
    return false;
  },

  wakeAt(s, phase) {
    const t = s.talk;
    if (phase !== 'answer' || !t || t.done) return null;
    const st = stepOf(t);
    return st ? st.at + st.ms : null;
  },

  wake(s, phase, ctx) {
    s.now = ctx.now;
    const t = s.talk;
    if (phase !== 'answer' || !t || t.done) return;
    const st = stepOf(t);
    if (st && ctx.now >= st.at + st.ms) advanceStep(s, t, ctx);
  },

  move(s, phase, playerId, raw, ctx) {
    s.now = ctx.now;
    if (!isObject(raw)) return moveError('bad-move');
    if (raw.kind === 'vote') {
      if (phase !== 'finale') return moveError('wrong-phase');
      const r = typeof raw.talk === 'number' ? s.done.find((x) => x.index === raw.talk) : undefined;
      if (!r) return moveError('bad-move');
      if (r.presenterId === playerId) return moveError('own-talk');
      if (s.votes[playerId] !== undefined) return moveError('already-voted');
      s.votes[playerId] = r.index;
      return MOVE_OK;
    }
    const t = s.talk;
    if (!t) return moveError('wrong-phase');
    if (raw.talk !== undefined && raw.talk !== t.index) return moveError('wrong-phase');
    const presenter = playerId === t.presenterId;
    switch (raw.kind) {
      case 'title': {
        if (phase !== 'prompt') return moveError('wrong-phase');
        if (!presenter) return moveError('not-yours');
        const id = typeof raw.key === 'number' ? t.titleChoices[raw.key] : undefined;
        if (!id) return moveError('bad-move');
        if (t.titleId !== id) {
          t.titleId = id;
          if (!photoBeat(t.index, s.order.length)) {
            const title = forLevel(titleOf(id)!.jp, presenterLevel(t, ctx));
            ctx.cue({ host: 'chochin', event: 'happyokai_title', slots: { name: ctx.player(playerId)?.name ?? '', title: title.kana }, prompt: { text: title.text, kana: title.kana, en: title.en } });
          }
        }
        return MOVE_OK;
      }
      case 'go': {
        if (phase !== 'prompt') return moveError('wrong-phase');
        if (!presenter) return moveError('not-yours');
        if (!t.titleId) return moveError('pick-a-title');
        t.ready = true;
        return MOVE_OK;
      }
      case 'say': {
        if (phase !== 'answer' && phase !== 'encore') return moveError('wrong-phase');
        if (!presenter) return moveError('not-yours');
        if (phase === 'answer' && t.done) return moveError('wrong-phase');
        if (phase === 'encore' && !t.chosen) return moveError('pick-a-question');
        if (!isUtterance(raw.utterance)) return moveError('bad-utterance');
        const text = cleanText(raw.utterance.text, MAX_ANSWER_LENGTH * 2);
        if (!text) return moveError('empty-answer');
        if (!playerTextAllowed(text, ctx.audience)) return moveError('kids-words');
        const u: Utterance = { ...raw.utterance, text };
        const script = phase === 'answer' && u.via === 'speech' ? readFrom(u, scriptsFor(t, ctx)) : null;
        const kind: LineKind = u.via === 'speech' ? (script ? 'read' : 'own') : u.via === 'tap' ? 'tap' : 'typed';
        const step = phase === 'encore' ? -1 : stepIndex(t);
        t.lines.push({ id: ctx.newId(), step, text, shown: script?.text ?? text, ...(script?.furigana ? { furigana: script.furigana } : {}), kind, sentences: sentenceCount(text), hidden: false });
        if (phase === 'encore' && /いいしつもん/.test(soundKey(normalizeReading(utteranceReading(u))))) ctx.cue({ host: 'chochin', event: 'happyokai_stall' });
        return MOVE_OK;
      }
      case 'ready': {
        if (phase !== 'answer' || t.done) return moveError('wrong-phase');
        if (!presenter) return moveError('not-yours');
        const line = typeof raw.key === 'number' ? scriptsFor(t, ctx)[raw.key] : undefined;
        if (!line) return moveError('bad-move');
        t.lines.push({ id: ctx.newId(), step: stepIndex(t), text: line.text, shown: line.text, ...(line.furigana ? { furigana: line.furigana } : {}), kind: 'tap', sentences: Math.max(1, sentenceCount(line.text)), hidden: false });
        return MOVE_OK;
      }
      case 'next': {
        if (phase !== 'answer') return moveError('wrong-phase');
        if (!presenter) return moveError('not-yours');
        const st = stepOf(t);
        if (!st || t.done) return MOVE_OK;
        if (!linesOn(t, stepIndex(t)).length && ctx.now - st.at < MIN_NEXT_MS) return moveError('say-something');
        advanceStep(s, t, ctx);
        return MOVE_OK;
      }
      case 'pick': {
        if (phase !== 'answer') return moveError('wrong-phase');
        if (playerId !== t.assistantId) return moveError('not-yours');
        if (typeof raw.slideId === 'string') {
          if (!t.choices.some((c) => c.slideId === raw.slideId)) return moveError('bad-move');
          t.pick = { slideId: raw.slideId };
          return MOVE_OK;
        }
        if (typeof raw.mishapId === 'string') {
          if (t.mishapUsed || !t.choices.length || !mishapOf(raw.mishapId)) return moveError('bad-move');
          t.pick = { mishapId: raw.mishapId as MishapId };
          return MOVE_OK;
        }
        return moveError('bad-move');
      }
      case 'kanpe': {
        if (phase !== 'answer' || t.done) return moveError('wrong-phase');
        if (playerId !== t.assistantId) return moveError('not-yours');
        if (stepOf(t)?.kind !== 'picture') return moveError('wrong-phase');
        if (typeof raw.key !== 'number' || !scriptsFor(t, ctx)[raw.key]) return moveError('bad-move');
        t.kanpe = { step: stepIndex(t), key: raw.key };
        return MOVE_OK;
      }
      case 'stamp': {
        if (phase !== 'answer' && phase !== 'encore') return moveError('wrong-phase');
        if (presenter) return moveError('not-yours');
        const kind = raw.stamp as StampKind;
        if (!(STAMPS as readonly string[]).includes(kind)) return moveError('bad-move');
        // Applause is for the closing slide and question time.
        if (kind === 'hakushu' && phase === 'answer' && stepIndex(t) !== closeStep(t)) return moveError('not-yet');
        const last = t.lastStamp[playerId] ?? -Infinity;
        if (ctx.now - last < STAMP_GAP_MS) return MOVE_OK;
        t.lastStamp[playerId] = ctx.now;
        t.stamps.push({ id: ++s.stampSeq, kind, at: ctx.now, step: phase === 'encore' ? -1 : stepIndex(t) });
        if (t.stamps.length > STAMP_KEEP * 4) t.stamps.splice(0, t.stamps.length - STAMP_KEEP * 4);
        t.stampCount[kind] += 1;
        const st = statsOf(s, playerId).stamps;
        st[kind] = (st[kind] ?? 0) + 1;
        return MOVE_OK;
      }
      case 'ask': {
        if (phase !== 'encore') return moveError('wrong-phase');
        const cards = t.cards[playerId];
        if (!cards) return moveError('not-yours');
        if (t.chosen) return moveError('question-chosen');
        const q = typeof raw.key === 'number' ? cards[raw.key] : undefined;
        if (!q) return moveError('bad-move');
        const via: Utterance['via'] = isUtterance(raw.utterance) ? raw.utterance.via : 'tap';
        const prev = t.asked.find((a) => a.playerId === playerId);
        // A question said out loud is never replaced by a tapped one.
        if (prev && (prev.via === 'speech' || via !== 'speech')) return MOVE_OK;
        t.asked = t.asked.filter((a) => a.playerId !== playerId);
        t.asked.push({ playerId, text: q.text, kana: q.kana, ...(q.furigana ? { furigana: q.furigana } : {}), en: q.en, via });
        return MOVE_OK;
      }
      case 'choose': {
        if (phase !== 'encore') return moveError('wrong-phase');
        if (!presenter) return moveError('not-yours');
        if (t.chosen) return MOVE_OK;
        if (typeof raw.playerId !== 'string' || !t.asked.some((a) => a.playerId === raw.playerId)) return moveError('bad-move');
        t.chosen = raw.playerId;
        // Chōchin-san reads the question out, so the whole room hears what the presenter is answering.
        const q = t.asked.find((a) => a.playerId === raw.playerId)!;
        ctx.cue({ host: 'chochin', event: 'happyokai_ask', slots: { name: ctx.player(q.playerId)?.name ?? '', question: q.text, question_kana: q.kana, question_en: q.en } });
        return MOVE_OK;
      }
      case 'grade': {
        if (phase !== 'reveal') return moveError('wrong-phase');
        if (!t.graders.includes(playerId)) return moveError('not-yours');
        const n = raw.n;
        if (n !== 1 && n !== 2 && n !== 3) return moveError('bad-move');
        t.grades[playerId] = n;
        return MOVE_OK;
      }
      case 'hide': {
        const line = typeof raw.lineId === 'string' ? t.lines.find((l) => l.id === raw.lineId) : undefined;
        if (!line) return moveError('unknown-line');
        // The presenter can take their own caption off the TV; the VIP can hide any.
        if (!presenter && ctx.vipId !== playerId) return moveError('not-vip');
        line.hidden = true;
        return MOVE_OK;
      }
      default:
        return moveError('bad-move');
    }
  },

  release(s, playerId) {
    const t = s.talk;
    // Talks they haven't given yet are dropped.
    const from = t ? t.index + 1 : 0;
    s.order = [...s.order.slice(0, from), ...s.order.slice(from).filter((id) => id !== playerId)];
    delete s.votes[playerId];
    if (!t) return;
    if (t.presenterId === playerId) t.done = true;
    if (t.assistantId === playerId) t.assistantId = null;
    t.graders = t.graders.filter((id) => id !== playerId);
    delete t.grades[playerId];
    delete t.cards[playerId];
    t.asked = t.asked.filter((a) => a.playerId !== playerId || t.chosen === playerId);
  },

  progress(s) {
    return { round: s.talk ? s.talk.index + 1 : 0, totalRounds: s.order.length };
  },

  view(s, phase: Phase, viewer: Viewer, ctx) {
    const t = s.talk;
    const me = viewer.kind === 'player' ? ctx.player(viewer.playerId) : undefined;
    const audience = audienceOf(ctx);
    const talking = phase === 'answer' || phase === 'encore' || phase === 'reveal' || phase === 'score';
    const title = t ? titleFor(t) : undefined;
    const st = t ? stepOf(t) : undefined;
    const step = t && talking ? stepIndex(t) : -1;
    const qa = phase === 'encore' || phase === 'reveal' || phase === 'score';
    const visible = t ? t.lines.filter((l) => (qa ? l.step === -1 : l.step === step)) : [];
    const level = t ? presenterLevel(t, ctx) : 'n5';
    const beat = t && phase === 'prompt' ? photoBeat(t.index, s.order.length) : null;

    let mine: HappyokaiView['me'] = null;
    if (me) {
      const role = t?.presenterId === me.id ? 'presenter' : t?.assistantId === me.id ? 'assistant' : 'audience';
      const romaji = me.level === 'kana';
      const withRomaji = (j: JpText) => ({ ...j, ...(romaji ? { romaji: toRomaji(j.kana) } : {}) });
      const scripts = t && phase === 'answer' && !t.done ? scriptsFor(t, ctx) : [];
      const picture = st?.kind === 'picture' && phase === 'answer' && !t?.done;
      const slide = picture && st?.slideId ? slideOf(st.slideId) : undefined;
      const asked = t?.asked.find((a) => a.playerId === me.id);
      mine = {
        role,
        level: me.level,
        titleChoices: t && role === 'presenter' && phase === 'prompt' ? t.titleChoices.map((id, key) => ({ key, jp: forLevel(titleOf(id)!.jp, me.level), ...(romaji ? { romaji: toRomaji(titleOf(id)!.jp.kana) } : {}) })) : [],
        rehearse: t && title && role === 'presenter' && phase === 'prompt' ? { opening: withRomaji(openingFor(me.level, me.name, title.jp)), closing: withRomaji(closingFor(me.level)) } : null,
        script: role === 'presenter' && !picture && scripts[0] ? withRomaji(scripts[0]) : null,
        word: role === 'presenter' && slide ? forLevel(slide.word, me.level) : null,
        frames: role === 'presenter' && slide ? framesFor(me.level, slide) : [],
        ready: role === 'presenter' && picture ? scripts.map((x, key) => ({ key, ...x, ...(romaji ? { romaji: toRomaji(x.kana) } : {}) })) : [],
        kanpe: role === 'presenter' && t?.kanpe && t.kanpe.step === step ? t.kanpe.key : null,
        // Views have no clock: before MIN_NEXT_MS with nothing said, Next is refused with say-something.
        canNext: !!t && role === 'presenter' && phase === 'answer' && !!st && !t.done && (linesOn(t, step).length > 0 || s.now - st.at >= MIN_NEXT_MS),
        lines: t && role === 'presenter' ? t.lines.filter((l) => (qa ? l.step === -1 : l.step === step)).map((l) => captionOf(l, true)) : [],
        choices: t && role === 'assistant' && phase === 'answer' ? t.choices.map((c) => choiceView(c, me.level)) : [],
        mishaps: t && role === 'assistant' && phase === 'answer' && !t.mishapUsed && t.choices.length ? MISHAPS.map((m) => ({ id: m.id, name: forLevel(m.name, me.level), emoji: m.emoji })) : [],
        picked: t?.pick ? ('slideId' in t.pick ? t.pick.slideId : t.pick.mishapId) : null,
        cueCards: t && role === 'assistant' && picture ? scripts.map((x, key) => ({ key, ...x })) : [],
        questions: t && phase === 'encore' && t.cards[me.id] && !t.chosen ? t.cards[me.id]!.map((q, key) => ({ key, ...q, ...(romaji ? { romaji: toRomaji(q.kana) } : {}) })) : [],
        asked: asked?.text ?? null,
        pickQuestion: t && role === 'presenter' && phase === 'encore' && !t.chosen ? t.asked.map((a) => ({ playerId: a.playerId, text: a.text, kana: a.kana, ...(a.furigana ? { furigana: a.furigana } : {}), en: a.en })) : [],
        answerFrames: role === 'presenter' && phase === 'encore' && t?.chosen ? answerFrames(me.level) : [],
        canGrade: !!t && phase === 'reveal' && t.graders.includes(me.id) && t.grades[me.id] === undefined,
        graded: t?.grades[me.id] ?? null,
        canVote: phase === 'finale' && s.votes[me.id] === undefined && s.done.some((r) => r.presenterId !== me.id),
        votedFor: phase === 'finale' ? (s.votes[me.id] ?? null) : null,
        points:
          t?.result && phase === 'score'
            ? (role === 'presenter' ? t.result.presenterPoints + t.result.speakPoints : role === 'assistant' ? t.result.assistantPoints : 0) +
              (asked ? (asked.via === 'speech' ? ASK.said : ASK.other) + (t.chosen === me.id ? ASK.picked : 0) : 0)
            : 0,
        report: t?.result && phase === 'score' && role === 'presenter' ? { sentences: t.result.sentences, best: t.result.best } : null,
      };
    }

    let card: HappyokaiView['card'] = null;
    if (t?.result && phase === 'score') {
      const flowers = Object.values(t.grades).sort((a, b) => b - a);
      const grade = Math.max(1, Math.min(3, Math.round(t.result.hanamaru))) as 1 | 2 | 3;
      // The slide that drew the most stamps, for the teacher's comment.
      const byStep = new Map<number, number>();
      for (const x of t.stamps) if (t.steps[x.step]?.kind === 'picture') byStep.set(x.step, (byStep.get(x.step) ?? 0) + 1);
      const top = [...byStep.entries()].sort((a, b) => b[1] - a[1])[0];
      const topSlide = top ? slideOf(t.steps[top[0]]!.slideId ?? '') : undefined;
      const mishapLaugh = t.stamps.some((x) => t.steps[x.step]?.kind === 'mishap');
      const loud = (Object.entries(t.stampCount) as [StampKind, number][]).filter(([k]) => k !== 'hakushu').sort((a, b) => b[1] - a[1])[0];
      card = {
        ...t.result,
        flowers,
        stamp: GRADE_STAMPS[grade],
        comment: teacherComment(topSlide ?? null, mishapLaugh, title?.topic ?? null, level),
        loudest: loud && loud[1] > 0 ? { kind: loud[0], n: loud[1] } : null,
      };
    }

    const chosen = t?.chosen ? (t.asked.find((a) => a.playerId === t.chosen) ?? null) : null;
    return {
      mode: 'happyokai',
      at: s.now,
      talk: t ? t.index + 1 : 0,
      totalTalks: s.order.length,
      phaseAt: s.phaseAt,
      presenterId: t?.presenterId ?? null,
      assistantId: t?.assistantId ?? null,
      title: title?.jp && (phase !== 'prompt' || t?.titleId) ? forLevel(title.jp, level) : null,
      topic: title ? forLevel(title.topic, level) : null,
      backstage: t && phase === 'prompt' ? { photo: beat, picture: beat ? holidayPicture(beat) : null, ready: t.ready, last: t.index === s.order.length - 1 } : null,
      step,
      steps: t ? closeStep(t) + 1 : 0,
      slide: st && t && talking ? slideView(st, t, audience, level) : null,
      captions: visible.slice(-CAPTION_KEEP).map((l) => captionOf(l)),
      stamps: t && (phase === 'answer' || phase === 'encore') ? t.stamps.slice(-STAMP_KEEP).map((x) => ({ id: x.id, kind: x.kind, at: x.at })) : [],
      stampCount: t?.stampCount ?? blankCount(),
      renzoku: t && phase === 'answer' && step >= 0 && st?.kind === 'picture' ? renzokuOn(t, step) : 0,
      renzokuAt: RENZOKU[level],
      question: t && qa ? { askers: t.asked.map((a) => a.playerId), chosen, answered: t.lines.some((l) => l.step === -1) } : null,
      grading: t && phase === 'reveal' ? { count: Object.keys(t.grades).length, needed: t.graders.length } : null,
      card,
      vote:
        phase === 'finale'
          ? {
              talks: s.done.map((r) => ({ index: r.index, presenterId: r.presenterId, assistantId: r.assistantId, title: r.titleId && titleOf(r.titleId) ? forLevel(titleOf(r.titleId)!.jp, ctx.player(r.presenterId)?.level ?? 'n5') : null, quote: r.quote, votes: Object.values(s.votes).filter((v) => v === r.index).length })),
              count: Object.keys(s.votes).length,
              needed: ctx.connected().filter((p) => s.done.some((r) => r.presenterId !== p.id)).length,
            }
          : null,
      me: mine,
    };
  },

  awards(s, ctx) {
    const out: Award[] = [];
    const players = ctx.players();
    const best = (f: (st: PlayerStats) => number): ModePlayer | undefined => {
      let top: ModePlayer | undefined;
      let val = 0;
      for (const p of players) {
        const v = f(statsOf(s, p.id));
        if (v > val) [top, val] = [p, v];
      }
      return top;
    };
    const add = (p: ModePlayer | undefined, title: string, en: string) => p && out.push({ playerId: p.id, name: p.name, title, en });
    // Best-talk votes first, then the はなまる average to break ties.
    add(best((st) => st.votes * 10 + (st.talks ? st.hanamaru / st.talks : 0)), 'ベストプレゼン賞', 'Best Presenter: the room’s favourite talk');
    add(best((st) => st.assistPoints), 'めいアシスタント賞', 'Best Assistant: their slides got the most said');
    add(best((st) => st.best), 'ノンストップ賞', 'Non-stop: the most sentences on one slide');
    add(best((st) => st.askedAloud), 'ベストしつもん賞', 'Best Questioner: asked out loud the most');
    add(best((st) => st.mishapLaughs), 'ハプニング賞', 'Mishap Award: the biggest laugh after a mishap');
    return out;
  },
};

/** The lower of two levels: question cards both the asker and the presenter can manage. */
export function lower(a: Level, b: Level): Level {
  const order: Level[] = ['kana', 'n5', 'n4'];
  return order[Math.min(order.indexOf(a), order.indexOf(b))]!;
}
