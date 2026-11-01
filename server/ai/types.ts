// Shared types for the AI layer: the host's voice and the typed-answer judge.
// Names match the Phase 0 skeleton (shared/src/protocol.ts) and the content thread's host line bank.
// This package imports nothing from server/src or shared/src, so it can be wired in from either side.

export type HostId = 'pon' | 'chochin' | 'fude' | 'nobiko';
export type Level = 'kana' | 'n5' | 'n4' | 'n3';
export type ReactionTier = 'flop' | 'good' | 'ippon';

/** Every event a host speaks on: the content thread's HostEvent (content/src/types.ts), kept in step by hand. */
export const HOST_EVENTS = [
  // shared round skeleton
  'lobby_welcome',
  'mic_check_ok',
  'mic_check_quiet',
  'intro',
  'prompt_read',
  'say_it_first',
  'answer_hurry',
  'all_in',
  'reveal_react',
  'encore_invite',
  'encore_cheer',
  'natural_version',
  'kakegoe_call',
  'retry_clue',
  'miss_kind',
  'recap_award',
  'play_again',
  // Omiai Matchmaker
  'omiai_tease',
  'omiai_nakodo_read',
  'omiai_nakodo_cheer',
  'omiai_standin',
  'omiai_standin_setup',
  // Narabete!
  'narabete_intro',
  'narabete_deal',
  'narabete_say',
  'narabete_order',
  'narabete_defence',
  'narabete_hard',
  'narabete_replay',
  'narabete_hooray',
  'narabete_standin',
  'narabete_standin_setup',
  'narabete_perfect',
  'narabete_knot',
  'narabete_story',
  // Happyōkai!
  'happyokai_intro',
  'happyokai_photo_1',
  'happyokai_photo_2',
  'happyokai_photo_3',
  'happyokai_call',
  'happyokai_call_last',
  'happyokai_title',
  'happyokai_mishap_blackout',
  'happyokai_mishap_wrong',
  'happyokai_mishap_graph',
  'happyokai_mishap_upside',
  'happyokai_mishap_message',
  'happyokai_question',
  'happyokai_ask',
  'happyokai_stall',
  'happyokai_grade',
  'happyokai_card',
  'happyokai_great',
  'happyokai_vote',
  'bento_intro',
  'bento_round',
  'bento_customer',
  'bento_static',
  'bento_perfect',
  'bento_close',
  'bento_meh',
  'bento_leave',
  'bento_bake',
  'bento_ajimi',
  'bento_stars',
  'bento_replay',
  'bento_standin',
  'bento_standin_setup',
  'bento_manager_win',
  'bento_omotenashi_win',
  'bento_vs_intro',
  'bento_vs_win',
  'bento_vs_sendback',
  'bento_vs_final',
  'bento_vs_tie',
  'hajime_intro',
  'hajime_guest',
  'hajime_write',
  'hajime_introduce',
  'hajime_read',
  'hajime_rank',
  'hajime_known',
  'hajime_top_lie',
  'hajime_pon_win',
  'hajime_truth',
  'hajime_recall',
  // Surprise Me!
  'surprise_spin',
  'surprise_pick',
  // Oogiri Night
  'ippon',
  'cushion_steal',
  // Kana Yōkai Raid
  'raid_wave_start',
  'raid_hit',
  'raid_combo',
  'raid_boss',
  'raid_catch',
  'raid_escape',
  // Last Train
  'train_departure',
  'train_stop',
  'train_ghost',
  'train_revive',
  'train_last_stop_twist',
  'platform_dash',
  'room_overrule',
  'train_role_read',
  'train_announcer_react',
  'train_stand_in',
  'train_stand_in_setup',
  // Murder at the Onsen
  'onsen_case',
  'onsen_turn',
  'onsen_clue',
  'onsen_accuse',
  'onsen_reveal',
  'onsen_report',
  'onsen_deputy_cheer',
  'onsen_standin',
  'onsen_standin_setup',
  // Who's the Tourist?
  'tourist_intro',
  'tourist_deal',
  'tourist_vote',
  'tourist_last_chance',
  'tourist_caught',
  'tourist_escaped',
  // Shodō Taikai
  'shodo_intro',
  'shodo_practice',
  'shodo_read',
  'shodo_dictation',
  'shodo_clean',
  'shodo_misread',
  'shodo_gallery',
  'shodo_vote',
  'shodo_claim',
  'shodo_synchro_break',
  'shodo_gallery_reveal',
  'shodo_callback',
  'shodo_award',
  'shodo_claimed',
  'shodo_other_hand',
  // Kotoba Concentration
  'concentration_intro',
  'concentration_say_it',
  'concentration_keep',
  'concentration_steal_open',
  'concentration_stolen',
  'concentration_missed',
  'concentration_mismatch',
  'concentration_yokai',
  'concentration_bonus',
  'concentration_fog',
  'concentration_picture',
  'concentration_clear',
  'concentration_time',
] as const;
export type HostEvent = (typeof HOST_EVENTS)[number];

/** Japanese with its reading and subtitle. Same shape as the content thread's JpText. */
export interface JpText {
  /** Japanese as shown on the stage (kanji allowed). */
  text: string;
  /** Full kana reading of `text`. This is what gets voiced, so the TTS never guesses a kanji reading. */
  kana: string;
  /** English subtitle. */
  en: string;
}

/**
 * A written line from the bank (content/src/hosts/). Slots such as {name} appear verbatim in text, kana and en,
 * and are listed in `slots`, with or without braces ('{name}' or 'name'). Ids are stable (e.g. 'pon.reveal_react.good.03'), so audio is cached by id.
 */
export interface BankLine {
  id: string;
  host: HostId;
  event: HostEvent;
  tier?: ReactionTier;
  jp: JpText;
  slots?: string[];
  /** Only for this Audience setting (Kids or Cheeky). Untagged lines play in every room. */
  audience?: 'kids' | 'cheeky';
  /** Only in a room where someone plays at N3 (content HostLine.level). */
  level?: 'n3';
  /** Review state from the content thread ('draft' until a fluent check). Not used here. */
  status?: string;
}

/** Same shape as server/src/clock.ts, so the skeleton's ManualClock can be passed straight in. */
export interface Clock {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export const systemClock: Clock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, Math.max(0, ms)),
  clearTimeout: (handle) => clearTimeout(handle as NodeJS.Timeout),
};

/** Where a line or a verdict came from, for logging and the cost and latency metrics. */
export type Source = 'llm' | 'bank' | 'offline' | 'pack';

export interface Logger {
  info(msg: string, data?: Record<string, unknown>): void;
  warn(msg: string, data?: Record<string, unknown>): void;
}

export const silentLogger: Logger = { info: () => {}, warn: () => {} };
