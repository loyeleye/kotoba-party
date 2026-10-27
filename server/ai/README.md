# server/ai: the host's voice and the typed-answer judge

The AI layer from the design doc's "AI and speech" section. Self-contained: it imports nothing from
`server/src` or `shared/src`, and its types match theirs by name (`HostId`, `Level`, the clock).

```
player answer ──► host LLM (Claude) ──► { text, kana, en } ──► checks ──► VOICEVOX (kana only) ──► WAV
       │               │ slow / failed / over budget / bad line                                    │
       │               └──────────────► written line bank (content/src/hosts/) ◄── pre-rendered ───┘
       └──► judge: offline kana check ──► unclear? ──► LLM second look (quotes verified) ──► Verdict
```

## Host voice

```ts
import { createHostVoice, llmFromEnv, VoicevoxTts } from '../ai/index.js';

const voice = createHostVoice({ llm: llmFromEnv(), tts: new VoicevoxTts(), lines: hostLines, clock });
void voice.warmUp();                                  // render the bank once, at startup

// When a player locks in an answer (the Answer phase): start the line. Never throws, never blocks.
const pending = voice.prepare(room.code, { host: 'pon', event: 'reveal_react', prompt, answer: text });

// At the Reveal: resolves within the given ms with the LLM line if it's done, else a bank line.
const line = await pending.ready(1500);              // VoicedLine | null
// line = { id, host, event, text, kana, en, source: 'llm' | 'bank', audio?: { id, mime, ms } }
// Serve the audio from a route: voice.audio(line.audio.id) → { mime, bytes }.

voice.speak(room.code, 'pon', answerAsJpText);        // the host reads an answer, prompt or natural version aloud
voice.newGame(room.code);                             // fresh $0.10 budget, every bank line fresh
voice.closeRoom(room.code);
```

- **Which events use the LLM:** `reveal_react`, `mic_check_ok`, `recap_award`, `encore_invite` (see
  `LLM_EVENTS`; override per cue with `llm: true | false`). Everything else is a written line.
- **An LLM line is dropped for the bank** when its reading isn't pure kana, the reading doesn't match the text,
  it's over 40 characters or 14 subtitle words, it fails moderation, it repeats a line from this game, or the TTS
  fails (a voiced bank line beats a silent fresh one).
- **Bank lines** are picked without repeats per game; a tier with no lines falls back to the event's untiered
  lines; `{name}` slots are filled, and voiced with a reading (given, or guessed from romaji: Ladi → ラディ).
- **Voices** (`hosts.ts`): Pon = 白上虎太郎 (わーい style for IPPON), Chōchin-san = ちび式じい, Fude = 春日部つむぎ,
  each with fallbacks, resolved by name through `GET /speakers`. The credits screen must show
  `HOSTS[h].credit` for each voice used.

## Judge

```ts
import { createJudge } from '../ai/index.js';
const judge = createJudge({ llm: llmFromEnv(), clock });
const v = await judge.judge({ answer, item, level: 'n5', budget: voice.budget(room.code) }); // never rejects
// v = { acceptable: true | false | null, match, natural?, tip?, clue?, points, bonus: 0..1, source }
```

`item` is `{ id, prompt, accepted?: JpText[], points?: RubricPoint[], natural? }`: fixed answers for Last Train
and the kana pad, rubric points for open Oogiri answers. Offline it compares kana readings after normalising
script, width, numbers (三百五十円 → さんびゃくごじゅうえん), long marks and punctuation, then a forgiving pass that
folds は/へ/を said as わ/え/お, おう/おお and えい/ええ spellings, じ/ぢ and ず/づ, and drops よ/ね. Vowel length and
small っ are never forgiven (おばさん ≠ おばあさん). Exact and forgiving matches never call the LLM; open answers,
near misses and rejects do, and the LLM's points count only with a quote found in the answer (the Isekai'd
checker's rule). `acceptable: null` means "can't tell": accept it with no bonus.

## Ink Storm coach

`createInkCoach({ llm })` (`inkCoach.ts`) takes a second look at a kana drawing the Raid's offline stroke check
wasn't sure about: it rasterises the strokes to a 96×96 grayscale PNG (no native deps), asks the judge model a
closed-set question ("They were asked to write ぬ. Is this drawing め, ぬ, ね?") and returns one moderated line, or
null. `server/src/ink.ts` runs it after commits and hands the line back to the mode; it never changes a grade or
waits. Requests may carry `images` (`LlmRequest.images`), sent as image blocks before the text.

## LLM

`ClaudeLlm` uses structured outputs (Zod), effort `low`, server-side refusal fallbacks, no retries, a per-call
timeout, and charges every call to the game's `LlmBudget` (default cap $0.10; once spent, every call fails at
once and the game runs on banks and packs). Models default to `claude-opus-5-5`; set `KOTOBA_HOST_MODEL` /
`KOTOBA_JUDGE_MODEL` to change (see docs/open-questions.md on cost). The Onsen suspects' lead-ins use
`claude-haiku-5-5` (`KOTOBA_SUSPECT_MODEL`): they must land within a 1.8 s beat, which Opus usually misses. `llmFromEnv()` returns undefined without
`ANTHROPIC_API_KEY`, and the pipeline then runs bank-only and offline-only.

## Running VOICEVOX

```
docker compose -f server/ai/docker-compose.voicevox.yml up -d
npx tsx server/ai/tools/voice.ts check             # all three voices installed?
npx tsx server/ai/tools/voice.ts demo voice-demo   # sample WAVs for each host
npx tsx server/ai/tools/voice.ts render content/src/hosts/index.ts content/audio/hosts
VOICEVOX_URL=http://127.0.0.1:50021 npm test       # also runs the live synthesis test
```
