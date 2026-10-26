// Oogiri Night state and view types.

import type { JpText, Level, OogiriPrompt, OogiriRound, TileForm } from '../../../../content/src/types.js';
import type { AnswerStyle } from './answer.js';
import type { Frame, Tile } from './deal.js';

/** One prompt in play and the players answering it: a head-to-head pair, or everyone in round 3. */
export interface Matchup {
  index: number;
  prompt: OogiriPrompt;
  authors: string[];
  /** voterId → answerId */
  votes: Record<string, string>;
  /** authorId → how they did their encore */
  encores: Record<string, EncoreKind>;
  result: MatchupResult | null;
}

export type EncoreKind = 'said' | 'typed' | 'host';

export interface Slot {
  matchup: number;
  /** The prompt version for this player's level. */
  version: JpText;
  /** Server time the slot opened (the say-it-first window starts here); null until it does. */
  openedAt: number | null;
  tilesShown: boolean;
  tiles: Tile[];
  frames: Frame[];
  answerId: string | null;
}

export interface Answer {
  id: string;
  authorId: string;
  matchup: number;
  /** What goes in the blank. */
  text: string;
  kana: string;
  /** The stage subtitle: the prompt's English with the answer in it. */
  en: string;
  /** English for just the blank, for host lines that name the answer. */
  blankEn: string;
  /** The author's whole sentence (their prompt version, filled). */
  sentence: JpText;
  style: AnswerStyle;
  english: boolean;
  formsRight: number;
  formTips: string[];
  callback: boolean;
  hidden: boolean;
}

export interface ResultLine {
  answerId: string;
  authorId: string;
  authorName: string;
  votes: number;
  /** Votes × 100 × the round multiplier. */
  votePoints: number;
  ipponPoints: number;
  /** Japanese/speaking bonus for the answer, from the capped pool. */
  bonus: number;
  /** Encore spotlight bonus (set in the score phase), from the same pool. */
  encoreBonus: number;
  /** The most this answer can take from the bonus pool. */
  bonusCap: number;
  winner: boolean;
  ippon: boolean;
}

export interface MatchupResult {
  lines: ResultLine[];
  ippon: boolean;
}

export interface PlayerStats {
  cushions: number;
  ippons: number;
  callbackVotes: number;
  /** Encores performed plus answers given from memory. */
  brave: number;
  stolen: number;
}

export interface LedgerEntry {
  playerId: string;
  round: number;
  points: number;
  why: 'votes' | 'ippon' | 'bonus' | 'encore' | 'steal';
}

export interface OogiriState {
  packId: string;
  placeholder: boolean;
  /** 1–3; 0 before the first round. */
  round: number;
  /** Prompts left to deal, per round type (ids). */
  decks: Record<OogiriRound, string[]>;
  matchups: Matchup[];
  /** Index of the matchup on show (reveal → score), or -1. */
  current: number;
  slots: Record<string, Slot[]>;
  answers: Answer[];
  /** Words used in answers tonight, newest last: tomorrow's callbacks. */
  used: string[];
  stats: Record<string, PlayerStats>;
  ledger: LedgerEntry[];
  /** Pon's once-a-game cushion steal. */
  steal: { playerId: string; round: number } | null;
  /** Server time the current phase began (stage animations sync to it). */
  phaseAt: number;
}

// ---- view ----

export interface PromptCard {
  text: string;
  kana: string;
  en: string;
  furigana?: JpText['furigana'];
  /** Photo Caption: what the photo shows, until there is art. */
  photo?: string;
  /** Kana level only: training-wheel romaji. */
  romaji?: string;
}

export interface AnswerCard {
  id: string;
  /** "[hidden]" once the VIP hides it. */
  text: string;
  en: string;
  hidden: boolean;
  english: boolean;
  /** Only in the viewer's own view: this is my answer. */
  mine?: boolean;
  /** Kana level only: the reading and its romaji, so the player can read the answers out and vote. */
  kana?: string;
  romaji?: string;
  // From the encore on:
  authorId?: string;
  authorName?: string;
  votes?: number;
  points?: number;
  winner?: boolean;
  ippon?: boolean;
  encore?: EncoreKind | null;
  style?: AnswerStyle;
}

export interface MatchupView {
  /** Position among the matchups on show this round (for "2 / 4"). */
  index: number;
  /** The matchup's id within the round; moves may echo it so a late one is ignored. */
  id: number;
  count: number;
  prompt: PromptCard;
  answers: AnswerCard[];
  /** Who may vote in this matchup, and who has. */
  voters: string[];
  voted: string[];
  ippon: boolean;
  /** Score phase: the natural version (the prompt's model answer until the AI judge is wired). */
  natural: (JpText & { romaji?: string }) | null;
  pattern: string | null;
}

export interface TileView {
  key: string;
  text: string;
  kana: string;
  en: string;
  romaji?: string;
  role: Tile['role'];
  ask?: { form: TileForm; label: string };
  options?: { form: TileForm; label: string; text: string; kana: string; en: string }[];
  /** The verb's stem (for 〜たい frames) and て-form (for 〜てください frames), when it has them. */
  stem?: string;
  te?: string;
}

export interface SlotView {
  index: number;
  count: number;
  prompt: PromptCard;
  /** The say-it-first window is open: no tiles yet. */
  sayFirst: boolean;
  sayFirstMs: number;
  tiles: TileView[];
  frames: { id: string; text: string; kana: string; en: string; slot: Frame['slot'] }[];
  englishOk: boolean;
}

export interface Tip {
  /** My answer as a whole sentence. */
  mine: JpText;
  natural: JpText;
  pattern: string;
  formTips: string[];
  style: AnswerStyle;
  points: number;
  votes: number;
}

export interface MeView {
  level: Level;
  /** Answer phase: the slot to answer now, or null when all are in. */
  slot: SlotView | null;
  done: { prompt: string; answer: string }[];
  // Reveal → score, for the matchup on show:
  canVote: boolean;
  votedFor: string | null;
  /** Encore: what this player may do. */
  encore: 'winner' | 'author' | 'done' | 'none';
  tip: Tip | null;
}

export interface OogiriView {
  mode: 'oogiri';
  round: number;
  totalRounds: number;
  kind: OogiriRound | null;
  multiplier: number;
  phaseAt: number;
  placeholder: boolean;
  cushions: Record<string, number>;
  /** Answer phase: players who have answered every prompt they were given. */
  answered: string[];
  /** Answer phase in the IPPON round: the one prompt everyone answers. */
  prompt: PromptCard | null;
  matchup: MatchupView | null;
  matchupCount: number;
  steal: { playerId: string; name: string } | null;
  me: MeView | null;
}
