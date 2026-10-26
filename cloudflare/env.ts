import type { RoomObject } from './roomObject.js';

/** Bindings and settings from wrangler.jsonc, plus secrets set with `wrangler secret put`. */
export interface Env {
  ROOMS: DurableObjectNamespace<RoomObject>;
  ASSETS: Fetcher;
  /** Base URL phones should open (for the QR code). Defaults to the request's own origin. */
  PUBLIC_URL?: string;
  /** VOICEVOX engine for host voices. Unset: the host's lines show as subtitles only. */
  VOICEVOX_URL?: string;
  /** Reader service for kanji answers (server/src/readerMain.ts). Unset: answers are compared as written. */
  READER_URL?: string;
  READER_TOKEN?: string;
  /** Secret. Live host lines and the Ink Storm coach; without it the host uses the written line bank. */
  ANTHROPIC_API_KEY?: string;
  KOTOBA_HOST_MODEL?: string;
  KOTOBA_JUDGE_MODEL?: string;
}
