# Open questions and decisions made on Ladi's behalf

Every call Claude made without asking goes here, so Ladi can review them in one place.
Each entry says what was decided, why, and what would change it. Mark an entry **OK** to accept
it, or write your answer under it and the next build pass will act on it.

Sections: Phase 0 (multiplayer), Content, AI and voice. Threads add to their own section.

## Phase 0 (multiplayer)

1. **Repo layout: one root package, no workspaces.** One `package.json` and `tsconfig.json` at
   the root; server, stage, controller, shared, content and tools import each other by relative
   path. Simplest thing that shares types across all of them. Revisit if a part needs its own
   release cycle.
2. **Level names are lowercase: `kana`, `n5`, `n4`.** Agreed with the content and AI threads so
   the three line up.
3. **IPPON means every voter except the author picked the answer, with at least 3 such voters.**
   The design doc says "every other voter"; the author can't vote for themselves, so they're
   left out of the count. The bonus is +200 (doubled in the last round, like everything else).
   The 200 is a guess; tune it in Phase 1 playtests.
4. **Points:** 100 per vote, last round doubled. Speaking bonuses (capped at 30%) arrive with
   speech in Phase 3.
5. **Room codes use 20 consonants only** (`BCDFGHJKLMNPQRSTVWXZ`): no vowels means no
   accidental words, and dropping I/O/U/Y avoids 1/0/V mix-ups. 160,000 codes.
6. **New players can join only in the lobby.** Held seats can come back any time. Joining
   mid-game would arrive with audience mode (design doc: up to 8 audience members).
7. **A dropped phone doesn't hold up the round.** The answer and vote phases end early once every
   *connected* player is in; a dropped player can still answer when back if the phase is open.
8. **A reveal with no answers is skipped** straight to the encore.
9. **A reloaded page finds its seat by saved token, or by its anonymous device id alone.** Someone
   who copied another phone's device id could take that seat; acceptable for a party game.
10. **Answers can't be edited once sent** (matches "say it to send it").
11. **Names are unique per room, ignoring case**, 1 to 12 characters.
12. **The stage can also start, skip and play again**, not only the VIP. Useful on the debug
    stage; should the real stage keep these buttons in Phase 1?
13. **Rooms close after 10 minutes with nobody connected.**
14. **Default phase lengths:** intro 8 s, prompt 4 s, answer 60 s, vote 30 s, encore 6 s,
    score 6 s. Placeholders until Phase 1 pacing work (target: Oogiri Night under 18 minutes).
15. **QR join URL:** uses `PUBLIC_URL` when set; on localhost it swaps in the machine's LAN IP so
    a phone on the same Wi-Fi can scan it.
16. **Hosting is undecided.** The server is one Node process with static pages, so Fly.io,
    Render or a small VM all work. Which do you want, and on what domain?
17. **Phase 0 debug prompts** (`content/debug/prompts.json`) have Japanese subtitles that no
    fluent speaker has checked. They are throwaway and will be replaced by Phase 1 packs.

## Content

(The content thread adds its questions here.)

## AI and voice

Host voice pipeline and typed-answer judge (`server/ai/`, see its README).

1. **Which Claude model, given the $0.10-per-game cap?** Both the host and the judge default to
   `claude-opus-5-5` at low effort. My estimate is $0.005 to $0.01 per call; an 8-player Oogiri Night
   makes roughly 40 to 50 calls (a quip per answer plus judge calls), so about $0.25 to $0.45 a game.
   The cap therefore trips partway through and the rest of the night runs on written lines and the
   offline judge, as the design doc says it should. `claude-haiku-5-5` costs about 40 times less
   (around $0.01 a game). It's one env var each: `KOTOBA_HOST_MODEL=claude-haiku-5-5`,
   `KOTOBA_JUDGE_MODEL=...`. My suggestion: Haiku for host quips now, and pick the judge model on
   the Phase 2 evaluation set (80% agreement gate). Your call; these are estimates, not measured,
   because no API key reached this session (see 16).
2. **Voices.** Pon = 白上虎太郎 (わーい style for IPPON), matching the content thread's first audition
   pick; Chōchin-san = ちび式じい (an old man's voice for the lantern-ghost conductor); Fude = 春日部つむぎ
   (bright and fast). Each host has a fallback voice if the engine lacks the first choice. Listen in the
   project files: `voice-samples/` has each host in its chosen voice, and `voice-samples/auditions/` has
   one line per candidate: Pon (白上虎太郎, 玄野武宏), Chōchin-san (ちび式じい, 冥鳴ひまり, 青山龍星,
   ユーレイちゃん) and Fude (春日部つむぎ, ずんだもん, 四国めたん). To swap a voice, edit
   `server/ai/hosts.ts`.
3. **Voice licences.** Each chosen voice's terms, as the engine reports them (`/speaker_info`), allow
   commercial and non-commercial use if the credit `VOICEVOX:<name>` is shown. The credits screen
   must show `HOSTS[h].credit` for each voice. Each character also has detailed terms (linked from
   the engine) with banned uses. I haven't read those in full: someone should read them before a
   public release. I avoided 青山龍星 (the content thread's first pick for Chōchin-san) because, per a press
   report I haven't checked against his terms, any use involving a company needs prior permission.
   ずんだもん has its own separate character rules.
4. **Engine licence.** The VOICEVOX engine's own terms (bundled in the Docker image) allow commercial
   use and redistribution, require following each voice's terms, and ban reverse engineering. We
   run the official image unmodified, as a separate container, so nothing in our code is affected.
5. **Hosting the engine.** It's a 4.4 GB CPU image. On 4 CPU cores a line takes 1 to 3 seconds,
   plus 1 to 3 seconds for the LLM. A line starts the moment its answer is locked in, so with a
   60-second answer phase there is time, but an answer locked in during the last seconds usually
   gets a bank line. A GPU image or a smaller host would change this. It needs to run next to the
   game server (see Phase 0 item 16, hosting).
6. **Which lines the LLM writes.** Only the reaction right after the host reads an answer
   (`reveal_react` with no tier), the mic-check greeting, recap awards and the encore invite. Every
   other event uses fluent-checked written lines. The design doc says a fluent speaker checks every
   host line, which LLM lines can't satisfy. Is that acceptable for these four events, or should the
   host be bank-only until the Phase 2 evaluation? Bank-only is `llm: false` per cue, or no LLM at all.
7. **Tiered reactions (flop, good, IPPON) come from the bank.** Votes arrive after the reveal, so a
   fresh line per tier would mean writing three lines per answer, which triples the cost. Pon's
   IPPON line uses his 喜び (joy) style.
8. **Checks on an LLM line before it reaches the stage:** the reading is pure kana; every kana in the
   text appears, in order, in the reading; the line is at most 40 characters with at most 14
   subtitle words; it passes moderation; it doesn't repeat this game's lines. If any check fails, a
   bank line is used. If the LLM line is fine but the TTS fails, a voiced bank line wins over a
   silent fresh one.
9. **Moderation is a placeholder blocklist** (`server/ai/moderation.ts`). It includes ばか and あほ,
   which also blocks a playful 「ばかな！」 from the host. The real moderation layer, with family
   mode, is separate work.
10. **Players' names are spoken from a romaji guess** (Ladi → ラディ, Ken → ケン). Should the join
    screen offer an optional "how do you say your name" kana field? The pipeline already takes one.
11. **Judge: what counts as the same answer.** Accepted: kanji, kana or digits for the same reading;
    katakana for hiragana; は/へ/を typed as わ/え/お; おう/おお and えい/ええ spellings; じ/ぢ and ず/づ; a
    trailing よ or ね. Never accepted: a difference in vowel length or a small っ, even if the LLM
    says it's fine. The particle fold is lossy (はし and わし match), which leans towards accepting as
    the design doc asks.
12. **Judge: when the LLM is asked.** Never for exact or forgiving matches (which saves budget, and the
    offline pass gives the particle-spelling tip itself). Always for open Oogiri answers, near misses
    and rejects, so an offline "wrong" gets a second look before a beginner is marked wrong. A natural
    version is shown only when the model says it's confident and its reading is pure kana.
13. **Judge: kanji in typed answers.** Offline, the judge reads only kanji numbers. A typed answer
    with other kanji that isn't character-for-character an accepted answer goes to the LLM. An
    offline reading dictionary (kuromoji with IPADIC, about 20 MB) would fix that. Worth adding in
    Phase 3 with speech-to-text?
14. **Judge bonus:** exact 1, forgiving match 0.8, LLM "full Japanese" 1, "some" 0.5, English 0.
    These are shares of the capped 30% pool; scoring applies the cap.
15. **The host and the judge share one budget per game** (`voice.budget(room)` is passed to the judge).
16. **No API key reached this session.** The key was added after the session started, so the Claude
    client is tested against a fake Messages API only and real Claude was never called. The
    `voice-samples/07-pon-pipeline.wav` line came from a scripted stand-in. The next session with the
    key should run `npx tsx server/ai/tools/voice.ts demo` to check real lines and their latency.
17. **GitHub downloads were still blocked here** (HTTP 403 on github.com releases), but Docker Hub
    worked, so VOICEVOX ran from its official image and the live synthesis test passed for all
    three hosts.
18. **Wiring left to the server thread:** a `GET /audio/:id` route serving `voice.audio(id)`,
    calling `prepare()` when an answer locks in, calling `ready(remaining ms)` at the reveal,
    `warmUp()` at startup, and showing the voice credits.
