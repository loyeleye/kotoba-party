# Open questions and decisions made on Ladi's behalf

Every call Claude made without asking goes here, so Ladi can review them in one place.
Each entry says what was decided, why, and what would change it. Mark an entry **OK** to accept
it, or write your answer under it and the next build pass will act on it.

Sections: Start here, Phase 0 (multiplayer), Mode engine (v1), Modes, Content, AI and voice,
Hosting.
Each mode's full list of decisions (numbered per mode) lives in its own doc under `docs/modes/`.

## Start here (the questions that change the most)

If you only have ten minutes, these are the answers that would change the build the most.

- **Fluent check (C1 below).** Every pack, host line, award title and the Word Gauntlet obscure
  words are `draft`. Who checks them, and when?
- **Oogiri Night:** with 8 players Round 1 has 8 matchups (about 13 minutes per game if every
  timer runs out). Too long? Is Pon's cushion steal funny or unfair?
  ([oogiri.md](modes/oogiri.md#open-questions))
- **Kotoba Concentration:** should a kept pair earn another turn, as in classic memory? Should
  steals be spoken only? ([concentration.md](modes/concentration.md#open-questions))
- **Word Gauntlet:** a rejected shiritori challenge knocks the player out. Too harsh?
  ([word-gauntlet.md](modes/word-gauntlet.md#decisions-made-on-ladis-behalf))
- **Last Train:** ghosts earn 50% points. Too generous? ([last-train.md](modes/last-train.md#open-questions))
- **Phrase Bingo Theater (backlog):** saying a secret line into the phone is what scores, on the
  honour system that it was also said in the scene. Should the audience be able to challenge it?
  A caught actor loses nothing (only the smooth bonus). ([phrase-bingo.md](modes/phrase-bingo.md#open-questions))
- **Omiai Matchmaker (backlog):** a rule-based manners meter (no LLM) scores politeness, the room
  votes for charm, and the guest invites the player with the most hearts (votes + manners
  stars) to tea for +200. Fair to funny casual answers? ([omiai.md](modes/omiai.md#open-questions))
- **Kana Yōkai Raid:** catching, the Leitner queue and the yōkai book need saved progress per
  player. Is it time to add accounts or device-local saves? ([kana-raid.md](modes/kana-raid.md#open-questions))
- **Ink Storm (kana drawing):** the drawing pad has never been tried with a thumb on a real
  small phone, and the pass thresholds were tuned on synthetic handwriting. Should drawings show
  on the TV with the player's name? ([kana-raid.md](modes/kana-raid.md#open-questions))
- **Photo Caption art (C2)** and **voice casting (C3).**

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
16. **Hosting: Cloudflare** (Ladi, Oct 26). The Node server stays for LAN play and tests; the
    always-on version is a Cloudflare Worker with one Durable Object per room. See ADR 0003 and
    the Hosting section below. Which domain, if any?
17. **Phase 0 debug prompts** (`content/debug/prompts.json`) have Japanese subtitles that no
    fluent speaker has checked. They are throwaway and will be replaced by Phase 1 packs.

## Mode engine (v1)

18. **One room machine, pluggable modes.** The room owns seats, levels, VIP, scores and the
    lobby → game → recap loop; each mode (Oogiri Night, Last Train, Kana Yōkai Raid) owns its
    phases, moves and points (`shared/src/modes/`). The Phase 0 round stays as a hidden "debug"
    mode so the 100-round gate keeps running.
19. **New players can also join between games** (on the recap screen), not only in the lobby.
20. **A player who picks no level starts at N5.** Levels can be changed in the lobby only.
21. ~~Speech uses the browser's own recogniser for now.~~ **Answered (Ladi, Oct 26): no audio to
    Google.** Speech now goes to Whisper: on Cloudflare Workers AI for the live game, or a server we run
    (`STT_URL`, [speech.md](speech.md), ADRs 0004 and 0005). Without either, phones type or tap.
22. **Answers with kanji are read into kana on the server** (kuromoji dictionary), then compared
    leniently (long vowels, じ/ぢ, ず/づ, お/を, えい/ええ, おう/おお). Small っ and vowel length are
    never forgiven, matching the judge in server/ai.
23. **The host says at most one line per phase**: if the rules raise several cues at once, the
    last (most specific) wins. Lines that arrive after their phase ended are dropped.
24. **The AI judge is not wired into the rules yet.** Modes are synchronous; the judge is async.
    Oogiri's natural version uses the prompt's written example answer until the judge runs as
    answers lock in (design doc Phase 2).
25. **Host audio needs a running VOICEVOX** (`VOICEVOX_URL`); without it the host shows
    subtitles only. LLM lines need `ANTHROPIC_API_KEY`; without it the written bank is used.
26. **Modes can see who the VIP is** (`ModeContext.vipId`), so Oogiri's VIP can hide an answer.
    That one-tap Hide is the only moderation in any mode so far; Word Gauntlet and Last Train
    show player text unfiltered. A shared hide/moderation hook for every mode is the next step.
27. **Modes can rename phases on the stage header** (`ModeInfo.phaseLabels`). Concentration
    uses it (its encore is the steal window); the others keep the shared labels.
28. **The phone shows friendly wording for every refusal code** the modes use (the `ERRORS` map
    in `controller/src/main.ts`). Race codes such as `wrong-phase` stay silent.
29. **`npm run bots -- --mode <id>`** plays whole games of any mode with the test bot policies,
    so you can watch a full game on the stage without phones.
30. **Shipping order.** v1 (Kana Yōkai Raid, Oogiri Night, Last Train) and the v1.1 backlog
    (Word Gauntlet, Kotoba Concentration, and the Brush / Ink Storm kana drawing wave) were all
    built tonight on one branch and go up as one pull request. They can be split if you would
    rather review v1 first.

## Modes

Each mode doc has how it plays, the decisions made on your behalf and its open questions.

| Mode | Doc | Decisions | Host |
| --- | --- | --- | --- |
| Kana Yōkai Raid | [kana-raid.md](modes/kana-raid.md) | 19 | Fude |
| Oogiri Night | [oogiri.md](modes/oogiri.md) | 21 | Pon |
| Last Train | [last-train.md](modes/last-train.md) | 15 | Chōchin-san |
| Word Gauntlet (v1.1) | [word-gauntlet.md](modes/word-gauntlet.md) | 18 | Pon |
| Kotoba Concentration (v1.1) | [concentration.md](modes/concentration.md) | 15 | Fude |
| Phrase Bingo Theater (backlog) | [phrase-bingo.md](modes/phrase-bingo.md) | 20 | Pon |
| Karaoke Duel (backlog) | [karaoke-duel.md](modes/karaoke-duel.md) | 18 | Chōchin-san |
| Murder at the Onsen (backlog) | [onsen-murder.md](modes/onsen-murder.md) | 15 | Chōchin-san |
| Who's the Tourist? (backlog) | [tourist.md](modes/tourist.md) | 20 | Chōchin-san |
| Oekaki (backlog) | [oekaki.md](modes/oekaki.md) | 18 | Fude |
| Omiai Matchmaker (backlog) | [omiai.md](modes/omiai.md) | 20 | Pon |

## Content

The biggest open item first, then the rest grouped by area. All content is marked
`status: 'draft'` until a fluent speaker has checked it.

### Needs Ladi

C1. **Who does the fluent-speaker check, and when?** The design doc says a fluent speaker checks
    every pack and host line before it ships, and the Phase 1 gate depends on it. Nothing here has
    had that check. Suggest one native reviewer pass over the food, family and travel packs, the
    Phase 1 Last Train minigames (Konbini Math, Meet the Innkeeper) and Pon's lines before the first
    game night (about 1,000 short items; the puns flagged below first). Who should that be?
C2. **Photo Caption pictures are pixel art from PixelLab** (`content/media/photo-caption/`, 24
    images at 320×240, about 24 KB each; `tools/generate-caption-art.ts` redraws them). I picked
    pixel art over photos so nothing shows a real person, and so the pictures match a retro
    haunted-TV-studio look; this also sets a visual direction for the game, so say if you want a
    different style. Gemini image generation was blocked by this session's network policy
    (`generativelanguage.googleapis.com` isn't on the allowed list), so only PixelLab was used.
    I redrew five that came out wrong (a fox instead of Pon the tanuki, an awake family, made-up
    kanji on station signs) and cropped one. I checked all 24 by eye: none has made-up Japanese
    text left (the station-cat picture has a couple of tiny Latin letter marks on its signs).
C3. **Voice casting.** `hosts/profiles.ts` names VOICEVOX characters to audition for each host.
    Each voice's commercial-use and credit terms need checking before we pick.

### Shape and conventions

C4. **Content types live in `content/src/types.ts`**, not `shared/` (agreed with the Phase 0
    thread). The engine imports everything from `content/src/index.ts`.
C5. **Every Japanese string carries its own kana reading** (`JpText.kana`), which is what TTS voices
    and what the answer checker compares. `npm run content:readings` cross-checks every reading
    against the kuromoji dictionary: 161 of 882 kanji texts differ, and every one was reviewed by
    hand and is a dictionary miss (counters and numbers read digit by digit, 一日 as いちにち,
    行き as いき, 何と as なにと, made-up place names).
C6. **The `tai` tile form is stored bare** (食べたい), and prompts add です around the blank where
    they need it. Masu forms and adjective forms are polite (おいしかったです).
C7. **Only some verbs have a `te-kudasai` form** (all food verbs, three travel verbs, no family
    verbs), but two Photo Caption frames and one travel prompt want a て-form. Recommend adding
    `te` forms to every verb in a follow-up so the tile builder never has to conjugate.
C8. **Blanks can take more than one tile** (example answers like ゾンビの えいが combine tiles and
    particles). The tile builder should allow several tiles plus typed particles per blank.
C9. **Slots in host lines are written with braces** (`slots: ['{name}']`). `{award}` takes the
    award's `name.kana` and `{stop}` the stop's `name.kana`. A slotted line can't be fully
    pre-rendered; the voice pipeline either splits around the slot or voices the name live.

### Kana Yōkai Raid

C10. **231 kana:** 46 basic pairs, 25 voiced pairs, small っ/ッ, ヴ, 33 combination pairs, ー and
     19 special katakana (ファ フィ フェ フォ ティ ディ トゥ デュ ウィ ウェ ウォ シェ ジェ チェ ツァ
     ヴァ ヴィ ヴェ ヴォ). ぢゃ/ぢゅ/ぢょ are left out as too rare. Add or trim special katakana?
C11. **Same-sound kana:** お/を, じ/ぢ and ず/づ are one sound in the kana check (`homophoneIds`).
     **Should Shout accept ぶ for ヴ (and ば for ヴァ)?** Most speakers say them that way. I listed
     them as `confusableSounds`; recommend accepting them instead.
C12. **Chapter leaders are real folklore yōkai** with a one-line source each (からかさ小僧, 河童,
     猫又, 天狗, ろくろ首, 一反木綿, のっぺらぼう, 雪女, 座敷童子, 鬼, 狐, 鵺, 雲外鏡), per the
     story review. 提灯お化け is left for Chōchin-san.
C13. **Memory cards are original** and cover the 46 basic hiragana only; katakana cards come next.
     They avoid the published Tofugu pictures.
C14. **14 minimal pairs** for the Long and Short wave (おばさん/おばあさん, きて/きって, ビル/ビール,
     ちず/チーズ, しゅじん/しゅうじん, きねん/きんえん, てんき/でんき …). Some words (囚人, 作家) are
     above N5; they're for hearing the contrast, not for learning the word.
C15. **25 boss words** from menus, stations and shops; each boss's chapter is computed from its
     hardest kana.

### Topic packs and Oogiri Night

C16. **Three packs: food (73 words, 18 phrases), family (75, 17), travel (80, 20)**, each with
     50 prompts (36 Head to Head, 8 Photo Caption, 6 IPPON). Every prompt has an n5 and a kana
     version; 33 have an n4 version. Travel hit the 80-word cap; should travel split into two packs
     (getting around, staying over) later?
C17. **N4 grammar band.** The linter flags たら, ば, ては いけない, られる, そう and
     あげる/くれる/もらう in kana and n5 text; none remain. Treated as N5: て-form, 〜ないでください,
     〜てもいいですか, 〜ませんか, plain form + noun clauses, 〜て います. N4 grammar appears only in
     n4 versions. Speaker colons (兄：「…」) are used instead of と言う.
C18. **Some N5 prompts use everyday words that aren't on community N5 lists** (改札, 終電, ICカード,
     冷蔵庫, お会計, 会議, 実は). They have furigana and English, and travel ones are tagged
     `beyond-n5-list`. Keep, or swap for list words?
C19. **Baseline words** (10 per pack, for the delayed spoken test) are never used as tiles, and the
     food and travel packs also keep them out of all prompt text. Family keeps them out of tiles
     and prompts too. A cross-pack check is still needed (a word held back in one pack may be
     taught by another).
C20. **Stereotype words:** family and travel each have one (にんじゃ / 忍者, flagged, swerve-only,
     never in an example answer); food has none.
C21. **Swerve variety:** travel leans on かっぱ (27 of 50 prompts) and たこ (26). The engine should
     avoid dealing the same swerve twice in a game; the next content pass should spread them out.
C22. **住む** is in the family pack per the brief, but 住みます is rarely natural (住んでいます is).
     Swap it for another verb, or add a `te-iru` form?
C23. **Pitch accent** is filled in only where the writer was sure (12 travel words). The phrasebook's
     pitch line needs a reviewer pass or a licensed accent dictionary.

### Last Train

C24. **8 minigames, 135 items:** Konbini Math (25) and Meet the Innkeeper (20) for Phase 1; Station
     Announcement, What Time?, Order Up, Counter Chaos, Particle Panic and Calendar Crunch (15 each)
     for Phase 4. The other 9 of the 17 designed minigames come later as content.
C25. **3 scenarios**: the Chōchin Line (Phase 1 minigames only; twist: the train is inside
     Chōchin-san's lantern), the Obake Line (ghosts ride free) and the Hoshimidai Line (the last
     train turns out to be the first train of the morning). 10 Platform Dash items each.
C26. **Accepted answers lean generous** (with/without です, えん, ぜんぶで, a leading すみません;
     both しちじ/ななじ, じゅっぷん/じっぷん, はちじゅっさい/はちじゅうさい). Left out on purpose:
     いっせんえん, はちひき, なぬか and さんふん. Plain greetings (おはよう) are not
     accepted for the innkeeper but are in the Platform Dash. Too strict, or right?
C27. **Particle Panic** accepts the whole sentence or just the particle, and both へ and に for
     "go to". A one-sound answer is the recogniser's weakest case (language review), so the
     whole-sentence answer should be encouraged in the prompt UI.
C28. **Station Announcement must play the audio before showing the text**, or the text gives the
     answer away. The server needs to honour the item's `visual` note.
C29. **TTS needs the supplied kana** for 行き (ゆき in announcements), the made-up stops 港口
     (みなとぐち) and 星見台 (ほしみだい), and should skip or chime over ＿＿＿.

### Hosts

C30. **466 written lines** (Pon 188, Fude 139, Chōchin-san 139), all in kana so they suit
     kana-level players. The design target is about 30 lines per event per host; Pon has 8 per
     event and 12 per reveal tier, the others 5 and 8. The AI host fills the gap from Phase 2.
     Should N5 players see kanji versions later?
C31. **Puns and coined award names need a native check**: ふとんが ふっとんだ, いかが ですか？
     いかです！, the しょう-suffixed awards (ざぶとん さようならしょう, また でたしょう, which can
     be heard as また でたでしょう), and ごじょうしゃ かんりょうです (not a standard announcement).
     I replaced one Chōchin-san line that joked about rushing onto the train.
C32. **"Most Cushions Stolen"** goes to the player Pon stole from most (players never steal).
C33. **No Kotoba Concentration lines yet**: it's v1.1 and has no host events.

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

## Hosting

Decisions for the Cloudflare version ([ADR 0003](decisions/0003-cloudflare-workers-durable-objects.md),
[docs/cloudflare.md](cloudflare.md)).

- **H1. One Worker with static assets, not Cloudflare Pages.** The pages and the API share one
  deploy and one origin, so there is no CORS and no second project to keep in step. Pages would
  only add a separate preview URL per branch.
- **H2. Room state lives only in memory.** A deploy, or every device in a room dropping at
  once, can end a game. Saving snapshots to Durable Object storage is the fix if that happens
  in real play. Is losing a room on deploy OK for now?
- **H3. Kanji readings need a separate reader service** (`npm run reader`), because the
  dictionary needs about 290 MB and a Worker has 128 MB. Without it, a spoken 三百円 doesn't
  match さんびゃくえん in Last Train and similar checks. Where should it run: your computer
  through a tunnel when you play, or a small always-on VM next to VOICEVOX?
- **H4. No ping-based dead-phone detection on Cloudflare.** Workers can't send WebSocket pings,
  so a phone that vanishes without closing is noticed later than on Node (edge timeout instead
  of 20 s). A small client heartbeat would fix it; not added yet to keep ADR 0002's "clients
  never send" rule.
- **H5. Bank lines aren't pre-voiced on Cloudflare.** The Node server renders every bank line
  through VOICEVOX at start-up; per room that would repeat the work, so fallback lines are
  subtitles only there. LLM lines are still voiced when `VOICEVOX_URL` is set.
- **H6. No room cap on Cloudflare.** The Node server stops at 500 rooms; on Cloudflare each room
  is its own object, and the per-game LLM budget still caps Claude spend per game. Anyone with
  the link can open rooms, so a public link could be used to run up the Claude bill a game at a
  time. Add a simple passcode for creating rooms?
