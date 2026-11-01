// The AI layer's public face: the host's voice, the typed-answer judge, the Ink Storm coach and the Onsen suspects' lead-ins. See README.md for wiring.

export * from './types.js';
export { HOSTS, type HostPersona, type HostVoiceConfig } from './hosts.js';
export { ClaudeLlm, LlmBudget, LlmUnavailable, ScriptedLlm, costUsd, llmFromEnv, type LlmClient } from './llm.js';
export { AudioStore, SilentTts, VoicevoxTts, mouthTrack, type Audio, type Mouth, type TtsEngine } from './tts.js';
export { LineBank, STARTER_LINES, fillSlots, fitsAudience, fitsLevel, type Slots } from './lineBank.js';
export { createHostVoice, LLM_EVENTS, type HostCue, type HostVoice, type HostVoiceOptions, type PendingLine, type VoicedLine } from './hostVoice.js';
export { createJudge, judgeOffline, type Judge, type JudgeItem, type JudgeRequest, type RubricPoint, type Verdict } from './judge.js';
export { createInkCoach, encodePng, rasterize, type InkCoach, type InkLook } from './inkCoach.js';
export { defaultModerator, moderatorFor, type Moderator } from './moderation.js';
export { nameToKana, normalizeKana, numberToKana, readNumbers } from './kana.js';
export { createSuspectVoice, type SuspectLeadRequest, type SuspectVoice } from './suspect.js';
