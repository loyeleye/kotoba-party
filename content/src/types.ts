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

/**
 * Ink Storm (the Raid's drawing wave): a kana's strokes in standard order. Each stroke is a
 * simplified polyline from its start to its end, as [x, y] points in a 0–1 box (x right,
 * y down). Generated from KanjiVG (CC BY-SA 3.0) by tools/content-strokes.ts.
 */
export interface KanaStrokes {
  kanaId: string;
  char: string;
  strokes: [number, number][][];
}

/** Stroke references for any character (Shodō Taikai's kanji), same format as `KanaStrokes`. */
export interface CharStrokes {
  char: string;
  strokes: [number, number][][];
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
/** Who a prompt's joke is for: the room's Audience setting (shared/src/protocol.ts AUDIENCES). */
export type PromptAudience = 'kids' | 'family' | 'cheeky';

export interface OogiriPrompt {
  id: string;
  packId: string;
  round: OogiriRound;
  /**
   * The audiences it may be dealt to; every audience when left out. Kids and Cheeky prompts
   * list just their own and are dealt before the shared ones (oogiri/kids.ts, oogiri/cheeky.ts).
   */
  audiences?: PromptAudience[];
  /**
   * One version per level. Use ＿＿＿ for the blank. The N4 version is
   * optional in v1: N4 players get the N5 version with no tiles.
   */
  versions: Partial<Record<Level, JpText>>;
  /** For photo-caption prompts: what the photo shows, for art or stock search. */
  photo?: string;
  /** For photo-caption prompts: the picture, as a path relative to content/ (pixel art, no text in it). */
  image?: string;
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
  /**
   * For a blank where a verb goes: how a winning noun becomes a natural sentence with the
   * same form as the pattern, with ＿＿＿ for the noun (＿＿＿に なりました, "turned into ___").
   * Without one, a noun winner's natural version is the example answer.
   */
  nounBridge?: JpText;
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
  | 'read-the-signs'
  | 'lost-and-found'
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
  /** Station signs drawn on the phone (Read the Signs): the kanji itself is the picture. */
  signs?: StationSign[];
  /**
   * Read the Signs direction items: the answer when the signs are dealt mirrored (left and right
   * swapped), so where the target sits can't be learnt by heart. Half the deals use it.
   */
  mirror?: { accepted: string[]; model: JpText };
  /** Accepted answers, as kana readings. First is the model answer. */
  accepted: string[];
  /** The natural version shown after a miss, with English. */
  model: JpText;
  /** The one private clue given before the retry. */
  hint: string;
  /** Seconds to answer. */
  timeLimit: number;
  /**
   * A hard role (N4 and up): never dealt as an ordinary item. At each stop one N4 player in turn is
   * offered it and may say "not this time" (docs/modes/last-train.md, Hard roles).
   */
  role?: HardRole;
  /** The sentence frames the line practises, by id (shared/src/japanese/frames.ts). */
  frames?: readonly string[];
}

/** A hard role's name and its one-line pitch on the offer card. */
export interface HardRole {
  id: string;
  name: JpText;
  pitch: string;
}

/** A station sign: its kanji, which way its arrow points, and its colours (exits are yellow, toilets blue and red). */
export interface StationSign {
  text: string;
  arrow?: 'left' | 'right' | 'up';
  kind?: 'exit' | 'men' | 'women';
  /** The sign the question asks about. Never sent to a phone; the TV outlines it in the reveal. */
  target?: boolean;
  /** Kana level: the sign's reading, shown on the first try of a read item (show first, then test) and on a direction item's retry. */
  reading?: string;
}

export interface LastTrainMinigame {
  id: MinigameId;
  title: JpText;
  /** First-year topic it covers. */
  topic: string;
  promptType: PromptType;
  /** Usable as a penalty minigame after a second miss. */
  penalty: boolean;
  /** A miss at this stop never sends anyone to the penalty car (a first meeting, like Read the Signs). */
  forgiving?: boolean;
  /** Build phase the minigame ships in (Phase 1 has Konbini Math and Meet the Innkeeper). */
  phase: 1 | 4 | 5;
  /** Rides a line only as a stop swapped in for a room with an N4 player (TrainStop.withN4), never as padding. */
  n4Stop?: boolean;
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
  /** In a room with an N4 player, this stop is swapped for the given one (a hard-role stop such as Lost and Found). */
  withN4?: Omit<TrainStop, 'withN4'>;
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
  /** Rooms with this Audience setting ride this line (family when left out); see chooseScenario. */
  audience?: 'kids' | 'cheeky';
  status: ReviewStatus;
}

// ---------------------------------------------------------------------------
// Murder at the Onsen (backlog mode)

/** What a question is after. Every suspect can be asked each one; see shared/src/modes/onsenMurder/questions.ts. */
export type OnsenIntent = 'where' | 'what' | 'who' | 'when' | 'victim' | 'item';

/** A suspect's scripted answer to one kind of question. */
export interface OnsenAnswer {
  jp: JpText;
  /** The clue this answer puts in the notebook, if any. Two answers may point at the same clue. */
  clueId?: string;
  /** The N4 deputy's relay of this answer (Murder at the Onsen's hard role). Left out, nobody deputises that turn. */
  report?: OnsenReport;
}

/**
 * How the N4 deputy reports an answer to the room: reported speech (＿と いっていました) or the passive
 * (＿に みられました). Words are spaced, and `text` and `kana` split into the same number of chunks:
 * the chunks are the deputy's tiles, and the last two carry the frame.
 */
export interface OnsenReport {
  jp: JpText;
  /** The N4 frames this line practises, by id (shared/src/japanese/frames.ts). */
  frames?: readonly string[];
}

export interface OnsenSuspect {
  /** Stable within the case, e.g. 'tanaka'. */
  id: string;
  /** Name without さん (the accusation adds `suffix`): { text: 'たなか', kana: 'たなか', en: 'Tanaka' }. */
  name: JpText;
  /** What others call them after the name: さん unless set (くん for a boy, '' for the cat). */
  suffix?: string;
  role: JpText;
  emoji: string;
  /** Pitch and rate for the stage's browser voice (1 = default), so suspects sound different. */
  voice: { pitch: number; rate: number };
  /** English character notes for the optional LLM lead-in. Never shown. */
  persona: string;
  /** Scripted answers by question. A missing one gets the case's shrug line. */
  answers: Partial<Record<OnsenIntent, OnsenAnswer>>;
}

export interface OnsenClue {
  id: string;
  /** One short notebook line. */
  jp: JpText;
  /** Part of the solution (highlighted at the reveal). */
  key?: boolean;
}

/** A short whodunit, hand-written, with every fact a suspect can say. */
export interface OnsenCase {
  id: string;
  title: JpText;
  /** One line that sets the scene. */
  setting: JpText;
  victim: { name: JpText; emoji: string; found: JpText };
  /** The piece of evidence players can ask about ("Whose is this …?"). `keys` are kana the question matcher looks for. */
  item: { name: JpText; emoji: string; keys: string[] };
  suspects: OnsenSuspect[];
  clues: OnsenClue[];
  culpritId: string;
  /** The culprit's confession, line by line. */
  confession: JpText[];
  /** How the key clues point at the culprit, in English, for the reveal. */
  solution: string;
  /** What a suspect says to a question they have no scripted answer for. */
  shrug: JpText;
  /**
   * The room Audience this case was written for. Left out, it suits everyone and plays in every
   * room; a Kids or Cheeky case plays only when the host picks that Audience.
   */
  audience?: 'kids' | 'cheeky';
  status: ReviewStatus;
}

// ---------------------------------------------------------------------------
// Hosts

export type HostId = 'pon' | 'chochin' | 'fude' | 'nobiko';

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
  | 'vote_zero' // nobody voted for any answer
  | 'vote_tie' // two or more answers tied for the most votes
  | 'vote_close' // won by a single vote
  | 'vote_landslide' // every vote went one way
  // Word Gauntlet
  | 'fooled' // a fake meaning fooled someone
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
  | 'room_overrule'
  // Murder at the Onsen
  | 'onsen_case' // the case file opens
  | 'onsen_turn' // a player's turn to question a suspect
  | 'onsen_clue' // a question found a new clue
  | 'onsen_accuse' // the accusation opens
  | 'onsen_reveal' // the culprit is revealed
  | 'onsen_report' // Chōchin-san says the N4 deputy's accepted report on the TV ({line})
  // Who's the Tourist?
  | 'tourist_intro'
  | 'tourist_deal' // the secret cards are dealt
  | 'tourist_vote' // a vote is called, or the final vote
  | 'tourist_last_chance' // a caught tourist may still guess the place ({name})
  | 'tourist_caught' // the locals caught the tourist ({name})
  | 'tourist_escaped' // the tourist got away or guessed the place ({name})
  // Shodō Taikai (Fude's quiet calligraphy-teacher register)
  | 'shodo_intro'
  | 'shodo_practice' // the お手本 warm-up starts
  | 'shodo_read' // the room reads the shared scroll aloud together
  | 'shodo_dictation' // a 書き取り item starts
  | 'shodo_clean' // the synchro replay had clean writers
  | 'shodo_misread' // a drawing read as a look-alike ({char})
  | 'shodo_gallery' // the big gallery sheet starts
  | 'shodo_vote' // stamping opens
  | 'shodo_claim' // claim your sheet, then the send-off
  | 'shodo_synchro_break' // the replay had a sheet out of step with the rest
  | 'shodo_gallery_reveal' // the big sheets brush on, one stroke at a time
  | 'shodo_callback' // the gallery remembers a dictation misread ({char})
  | 'shodo_award' // Fude presents a stamp award ({award}, {n})
  | 'shodo_claimed' // someone claimed their sheet ({name})
  | 'shodo_other_hand' // the VIP's other-hand round: the big sheet with the other hand
  // Kotoba Concentration
  | 'concentration_intro'
  | 'concentration_say_it' // a match: the flipper's say-it window ({name})
  | 'concentration_keep' // the flipper said it and keeps the pair ({name})
  | 'concentration_steal_open' // the flipper missed: anyone may steal
  | 'concentration_stolen' // someone else said it first ({name})
  | 'concentration_missed' // nobody said it
  | 'concentration_mismatch' // the two cards were not a pair
  | 'concentration_yokai' // the yōkai tile shuffled the face-down cards ({name})
  | 'concentration_bonus' // the bonus tile: an extra turn ({name})
  | 'concentration_fog' // the fog tile: a row is hidden next turn ({name})
  | 'concentration_picture' // someone guessed the hidden picture ({name})
  | 'concentration_clear' // the board is clear
  | 'concentration_time' // the game ran out of time with pairs left
  // Narabete!
  | 'narabete_intro' // Nobiko-san opens the game: one team, lining things up along her neck
  | 'narabete_deal' // the cards are dealt for a round
  | 'narabete_say' // say your card out loud
  | 'narabete_order' // the line is open: move your own card
  | 'narabete_defence' // the most-moved card defends its spot ({name})
  | 'narabete_hard' // an N4 player says why their own card sits where it does ({name})
  | 'narabete_perfect' // the flip came out in order
  | 'narabete_knot' // the flip has knots in it
  | 'narabete_story' // the Worst Day Ever story is read in order
  // Happyōkai!
  | 'happyokai_intro' // Happyōkai opens: the studio's late-night recital, the players give surprise talks
  | 'happyokai_photo_1' // backstage: Chōchin-san shows "one slide of his own" (a dark station platform)
  | 'happyokai_photo_2' // backstage: his second holiday photo (eyes in the dark)
  | 'happyokai_photo_3' // backstage: his last holiday photo (a group photo of everyone)
  | 'happyokai_call' // call the next presenter up ({name})
  | 'happyokai_call_last' // call up the last presenter, the headliner (トリ) ({name})
  | 'happyokai_title' // react to the talk's title ({title})
  | 'happyokai_mishap_blackout' // mishap: your own flame went out and the slide is dark (two words, before the presenter recovers)
  | 'happyokai_mishap_wrong' // mishap: your holiday photo came up instead of the slide
  | 'happyokai_mishap_graph' // mishap: a graph came up
  | 'happyokai_mishap_upside' // mishap: the slide is upside down
  | 'happyokai_mishap_message' // mishap: a message popped up on the presenter's slide
  | 'happyokai_question' // question time: the audience asks
  | 'happyokai_ask' // read out the question the presenter chose ({name} asks {question})
  | 'happyokai_stall' // the presenter said "いい しつもんですね" (the classic stall)
  | 'happyokai_grade' // the audience gives はなまる
  | 'happyokai_card' // the report card is shown ({name})
  | 'happyokai_great' // a report card full of はなまる ({name})
  | 'happyokai_vote' // the room votes for the best talk of the night
  // Bento Haus
  | 'bento_intro' // Pon opens his bento shop: one kitchen, call out to each other
  | 'bento_round' // a new shift starts ({round}: its name)
  | 'bento_customer' // a customer phones in; {name} is taking the order
  | 'bento_static' // a call didn't come through: blame the ghost on the radio, never a player
  | 'bento_perfect' // a perfect box
  | 'bento_close' // a box with one thing off
  | 'bento_meh' // a box with several things off
  | 'bento_leave' // a customer gave up waiting
  | 'bento_bake' // Pon shape-shifts into the missing {food}
  | 'bento_ajimi' // Pon "tastes" one {food} from the box
  | 'bento_stars' // the shift's stars ({stars})
  | 'bento_vs_intro' // Bento Haus VS opens: two kitchens race for the same customers
  | 'bento_vs_win' // a VS shift is over and {team} earned more tips
  | 'bento_vs_sendback' // a VS box is sent back and offered to the other kitchen ({team})
  | 'bento_vs_final' // the last VS shift is over: {team} won the game
  | 'bento_vs_tie' // a VS shift ends level
  // Dub Club (Fude as a broke, proud anime director)
  | 'dub_intro' // Fude-kantoku opens tonight's episode ({title})
  | 'dub_scene' // a new scene: the table read of its line ({line})
  | 'dub_record' // recording opens: act it the way your card says
  | 'dub_screening' // the screening starts
  | 'dub_reveal_all' // every guesser read {name}'s direction
  | 'dub_reveal_some' // some guessers read {name}'s direction
  | 'dub_reveal_none' // nobody read it ({card})
  | 'dub_spoiler' // the actor said the direction out loud
  | 'dub_skip' // the VIP skipped a dub
  | 'dub_notes' // cast notes after a scene; {name} got the most hearts
  | 'dub_episode' // tonight's episode plays ({title})
  | 'dub_sequel' // over the credits: Fude pitches a sequel ({title})
  // はじめまして！
  | 'hajime_intro' // Pon opens his guest corner: one truth per guest, the rest are tanuki
  | 'hajime_guest' // a new guest comes on ({name})
  | 'hajime_write' // everyone writes in silence: the guest the truth, the tanuki a lie
  | 'hajime_introduce' // the introducer ({name}) is called up to read the cards
  | 'hajime_read' // Pon reads a line of the introduction himself ({line}: the line, as is)
  | 'hajime_rank' // the room ranks the cards from true to lie
  | 'hajime_known' // the room put the truth first ({name}: the guest)
  | 'hajime_top_lie' // a tanuki's lie was the room's favourite ({author})
  | 'hajime_pon_win' // one of Pon's own lies was the room's favourite
  | 'hajime_truth' // the truth was hidden well: it wasn't the room's first pick
  | 'hajime_recall' // おぼえてる？ say everyone's truth
  | 'omiai_tease' // Nobiko-san, Cheeky rooms: scandalised by the most casual answer (Omiai)
  | 'surprise_spin' // Surprise Me!: the wheel starts to spin
  | 'surprise_pick'; // Surprise Me!: the wheel stops on tonight's game ({game})

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
  /** Only for this Audience setting (Kids or Cheeky). Untagged lines play in every room. */
  audience?: 'kids' | 'cheeky';
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
