import type { RoomObject } from './roomObject.js';

/** Bindings and settings from wrangler.jsonc, plus secrets set with `wrangler secret put`. */
export interface Env {
  ROOMS: DurableObjectNamespace<RoomObject>;
  ASSETS: Fetcher;
  /** Base URL phones should open (for the QR code). Defaults to the request's own origin. */
  PUBLIC_URL?: string;
  /** VOICEVOX engine for host voices. Unset: the host's lines show as subtitles only. */
  VOICEVOX_URL?: string;
  /** Secret the VOICEVOX proxy checks (Authorization: Bearer). Unset: no header is sent. */
  VOICEVOX_TOKEN?: string;
  /** Reader service for kanji answers (server/src/readerMain.ts). Unset: answers are compared as written. */
  READER_URL?: string;
  READER_TOKEN?: string;
  /** Workers AI, for Whisper when STT_URL is `workers-ai`. */
  AI?: Ai;
  /** `workers-ai`, or a self-hosted Whisper server's URL (server/src/stt.ts). Unset: phones type or tap. */
  STT_URL?: string;
  /** Secret, when the Whisper server sits behind a proxy that checks a Bearer token. */
  STT_TOKEN?: string;
  STT_MODEL?: string;
  /** Secret. Live host lines and the Ink Storm coach; without it the host uses the written line bank. */
  ANTHROPIC_API_KEY?: string;
  KOTOBA_ANTHROPIC_API_KEY?: string;
  KOTOBA_HOST_MODEL?: string;
  KOTOBA_JUDGE_MODEL?: string;
  /** The Onsen suspects' lead-ins; default claude-haiku-5-5, fast enough for the 1.8 s thinking beat. */
  KOTOBA_SUSPECT_MODEL?: string;
}
