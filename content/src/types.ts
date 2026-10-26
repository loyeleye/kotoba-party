// Content schemas for Kotoba Party v1.
//
// Everything here is plain data: no runtime dependencies, safe to import from
// the server, the stage and the controller. The Phase 0 skeleton owns shared/;
// these types can be re-exported from there without changes.

/** A player's level band (see the design doc, "Level bands"). */
export type Level = 'kana' | 'n5' | 'n4';

/**
 * A piece of Japanese with everything the game needs to show, voice and check it.
 *
 * - `text`: what the stage shows (kanji allowed; furigana comes from `furigana`).
 * - `kana`: the full reading in kana. This is what TTS voices and what the
 *   answer checker compares against, so a reading is never guessed
 *   (一日 → ついたち in dates).
 * - `en`: the English subtitle.
 * - `furigana`: optional ruby segments for the kanji in `text`. Each pair is
 *   [base, reading]; kana-only segments use an empty reading.
 */
export interface JpText {
  text: string;
  kana: string;
  en: string;
  furigana?: Array<[base: string, reading: string]>;
}

/**
 * Pitch accent as the downstep mora number (0 = heiban/flat, 1 = atamadaka,
 * n = drop after mora n). Shown in the phrasebook only; never scored in v1.
 * Optional until a fluent reviewer fills it in.
 */
export type PitchAccent = number;

/** Review status of a content item. Nothing ships to players as `draft`. */
export type ReviewStatus = 'draft' | 'fluent-checked';

// ---------------------------------------------------------------------------
// Kana Yōkai Raid

export type Script = 'hiragana' | 'katakana';

export type KanaKind =
  | 'basic' // the 46 basic sounds (plus ヲ)
  | 'voiced' // dakuten and handakuten
  | 'combo' // yōon combinations (きゃ, シュ …)
  | 'small' // small っ / ッ
  | 'mark' // the long-vowel mark ー
  | 'special'; // loanword katakana (ファ, ティ …)

export interface Kana {
  /** Stable id, e.g. `h-ka`, `k-kya`, `k-fa`. */
  id: string;
  char: string;
  script: Script;
  kind: KanaKind;
  /** Chapter number, 1–13 (ToKini Andy's pairs course order). */
  chapter: number;
  /** Hepburn romaji. Shown only as chapter 1 training wheels, never accepted as an answer. */
  romaji: string;
  /** The hiragana spelling of the sound, used by the kana sound check. */
  sound: string;
  /** Id of the other script's twin (あ ↔ ア). Absent for special katakana. */
  twinId?: string;
  /**
   * Kana that sound the same in standard Japanese (じ/ぢ, ず/づ, お/を).
   * A Shout attack on one of these accepts any of the group; the GDD
   * treats each group as one sound.
   */
  homophoneIds?: string[];
  /** Sounds the closed-set kana check should listen for as likely confusions. */
  confusableSounds?: string[];
  /** Level-scaled damage multiplier input: 1 (vowels) … 5 (special katakana). */
  difficulty: 1 | 2 | 3 | 4 | 5;
}

export interface KanaChapter {
  number: number;
  title: JpText;
  /** Start of this chapter in ToKini Andy's "Learn Hiragana and Katakana in PAIRS". */
  videoUrl: string;
  kanaIds: string[];
  /** A real yōkai from folklore that leads this chapter's horde (for art and the yōkai book). */
  leaderYokai: YokaiLore;
}

/** A real folklore yōkai with a one-line source note for the yōkai book. */
export interface YokaiLore {
  name: JpText;
  /** One sentence on the folklore source. */
  source: string;
  /** One-line joke bio in the show's voice. */
  bio: string;
}

/** Wave 2: Shapeshifters. Kana that look alike. */
export interface LookAlikeSet {
  id: string;
  kanaIds: string[];
  /** One-line tip shown on a miss, e.g. "シ's strokes rise from the bottom-left; ツ's fall from the top". */
  tip: string;
}

/** Wave 3: Long and Short. Two words that differ only in length, a small っ, or a similar contrast. */
export interface MinimalPair {
  id: string;
  contrast: 'long-vowel' | 'small-tsu' | 'long-mark' | 'n' | 'voicing';
  a: JpText;
  b: JpText;
  /** Highest kana chapter a player must have studied to be dealt this pair. */
  minChapter: number;
}

/** Boss: Word Yōkai. A real word, usually katakana, broken one character per player. */
export interface BossWord {
  id: string;
  word: JpText;
  /** Characters players break one at a time. Combos like ティ count as one. */
  pieces: string[];
  minChapter: number;
  /** Topic pack this boss shares words with, if any. */
  packId?: string;
}

/** An original mnemonic for a memory card (never copied from Tofugu or ToKini Andy). */
export interface KanaMnemonic {
  kanaId: string;
  /** One sentence describing the picture. */
  picture: string;
}

// ---------------------------------------------------------------------------
// Topic packs (shared by every mode)

export type PartOfSpeech =
  | 'noun'
  | 'verb-ru' // ichidan
  | 'verb-u' // godan
  | 'verb-irregular' // する, くる and する-compounds
  | 'adj-i'
  | 'adj-na'
  | 'phrase'
  | 'counter'
  | 'number';

/** Forms a verb or adjective tile can ask for when it is placed. */
export type TileForm = 'masu' | 'mashita' | 'masen' | 'tai' | 'te-kudasai' | 'plain' | 'past' | 'negative';

export interface PackWord {
  /** Stable id within the pack, e.g. `food.onigiri`. */
  id: string;
  jp: JpText;
  pos: PartOfSpeech;
  level: Level;
  pitch?: PitchAccent;
  /**
   * Conjugated forms, for verbs and adjectives. Keys are TileForm; values are
   * full JpText so the answer checker and TTS have exact readings.
   */
  forms?: Partial<Record<TileForm, JpText>>;
  /** A stereotype word (ninja, samurai, geisha …). Capped at one per tile set. */
  stereotype?: boolean;
  /** Absurd/funny word for the "swerve" tile slot. */
  swerve?: boolean;
  tags?: string[];
}

export interface PackPhrase {
  id: string;
  jp: JpText;
  level: Level;
  /** Where it's used, e.g. "ordering at a counter". */
  situation: string;
  /** One-line grammar note naming one pattern. */
  pattern?: string;
}

export interface TopicPack {
  id: 'food' | 'family' | 'travel' | (string & {});
  title: JpText;
  /** The theme in one line, for the VIP's pack picker. */
  blurb: string;
  words: PackWord[];
  phrases: PackPhrase[];
  /** Words held back from play as the untaught baseline for the delayed spoken test. */
  baselineWordIds: string[];
  status: ReviewStatus;
}

// ---------------------------------------------------------------------------
// Oogiri Night

export type OogiriRound = 'head-to-head' | 'photo-caption' | 'ippon';

/** A prompt with a blank, written once per level. */
export interface OogiriPrompt {
  id: string;
  packId: string;
  round: OogiriRound;
  /**
   * One version per level. Use ＿＿＿ for the blank. The N4 version is
   * optional in v1: N4 players get the N5 version with no tiles.
   */
  versions: Partial<Record<Level, JpText>>;
  /** For photo-caption prompts: what the photo shows, for art or stock search. */
  photo?: string;
  /** Tiles that fit the prompt straight (word ids from the pack). */
  fitTileIds: string[];
  /** Absurd swerves (word ids, any pack). */
  swerveTileIds: string[];
  /**
   * A model natural answer, used as the stage's natural version when the
   * AI judge is unavailable.
   */
  exampleAnswer: JpText;
  /** The one grammar pattern this prompt practises. */
  pattern: string;
}

/** Set phrases offered as tiles in the Photo Caption round. */
export interface SetPhraseTile {
  id: string;
  /** Contains ＿＿＿ where the player's word goes, e.g. ＿＿＿をください. */
  frame: JpText;
  level: Level;
  /** What the slot takes: a noun, or a verb in a given form. */
  slot: 'noun' | 'verb-stem' | 'verb-te';
  pattern: string;
}

// ---------------------------------------------------------------------------
// Last Train

export type MinigameId =
  | 'konbini-math'
  | 'meet-the-innkeeper'
  | 'station-announcement'
  | 'what-time'
  | 'order-up'
  | 'counter-chaos'
  | 'particle-panic'
  | 'calendar-crunch'
  | (string & {});

export type PromptType = 'spoken-question' | 'listen-and-answer' | 'read-aloud' | 'picture' | 'fill-particle';

/**
 * One minigame item. `accepted` holds kana readings; the answer checker
 * converts the transcript to kana and normalises numbers, long vowels and
 * polite/plain variants before comparing.
 */
export interface MinigameItem {
  id: string;
  level: Level;
  /** What the conductor or character says or shows. */
  prompt: JpText;
  /** Optional on-screen visual (prices, a clock face, a picture) described in words. */
  visual?: string;
  /** Accepted answers, as kana readings. First is the model answer. */
  accepted: string[];
  /** The natural version shown after a miss, with English. */
  model: JpText;
  /** The one private clue given before the retry. */
  hint: string;
  /** Seconds to answer. */
  timeLimit: number;
}

export interface LastTrainMinigame {
  id: MinigameId;
  title: JpText;
  /** First-year topic it covers. */
  topic: string;
  promptType: PromptType;
  /** Usable as a penalty minigame after a second miss. */
  penalty: boolean;
  /** Build phase the minigame ships in (Phase 1 has Konbini Math and Meet the Innkeeper). */
  phase: 1 | 4 | 5;
  status: ReviewStatus;
  /** Chōchin-san's one-line setup for the stop. */
  intro: JpText;
  items: MinigameItem[];
}

/** A named stop on the line, with a story beat. */
export interface TrainStop {
  id: string;
  name: JpText;
  minigameId: MinigameId;
  /** Chōchin-san's announcement as the train pulls in. */
  announcement: JpText;
}

export interface LastTrainScenario {
  id: string;
  title: JpText;
  departure: JpText;
  stops: TrainStop[];
  /** The last-stop twist line. */
  twist: JpText;
  /** Rapid-fire Platform Dash questions. */
  platformDash: MinigameItem[];
  status: ReviewStatus;
}

// ---------------------------------------------------------------------------
// Hosts

export type HostId = 'pon' | 'chochin' | 'fude';

export interface HostProfile {
  id: HostId;
  name: JpText;
  /** One line on who they are. */
  role: string;
  segments: string[];
  /** Voice notes for the TTS casting (pitch, pace, energy). */
  voice: string;
  /** The host's three running gags. */
  runningGags: string[];
}

/** Events a host reacts to. Shared round phases first, then mode beats. */
export type HostEvent =
  // shared round skeleton
  | 'lobby_welcome'
  | 'mic_check_ok'
  | 'mic_check_quiet' // mic denied or silent: switching to tap/type, kindly
  | 'intro'
  | 'prompt_read'
  | 'say_it_first'
  | 'answer_hurry'
  | 'all_in'
  | 'reveal_react'
  | 'encore_invite'
  | 'encore_cheer'
  | 'natural_version'
  | 'kakegoe_call'
  | 'retry_clue'
  | 'miss_kind'
  | 'recap_award'
  | 'play_again'
  // Oogiri Night
  | 'ippon'
  | 'cushion_steal'
  // Kana Yōkai Raid
  | 'raid_wave_start'
  | 'raid_hit'
  | 'raid_combo'
  | 'raid_boss'
  | 'raid_catch'
  | 'raid_escape'
  // Last Train
  | 'train_departure'
  | 'train_stop'
  | 'train_ghost'
  | 'train_revive'
  | 'train_last_stop_twist'
  | 'platform_dash'
  | 'room_overrule';

export type ReactionTier = 'flop' | 'good' | 'ippon';

export interface HostLine {
  id: string;
  host: HostId;
  event: HostEvent;
  /** Only for `reveal_react` (and similar tiered reactions). */
  tier?: ReactionTier;
  /** Japanese as shown with subtitles. Under 12 words. */
  jp: JpText;
  /** Template slots used in the line, written with braces as they appear in the text, e.g. '{name}'. Filled by the server. */
  slots?: string[];
  status: ReviewStatus;
}

/** An award named in character at the recap. */
export interface HostAward {
  id: string;
  host: HostId;
  name: JpText;
  /** What earns it, for the server's award picker. */
  criterion: string;
}
