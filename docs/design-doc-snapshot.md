<!-- Plain-text snapshot of the design doc (Oct 26, 2026) for offline reference. The live, editable doc is https://claude.ai/artifact/FpDS7hXjcg4dfPSY9fu1AL; tables are flattened to "|"-separated lines. -->

# Kotoba Party! Game Design Document
 · 
## Vision and pillars
Kotoba Party is a Jackbox-style party game where 1 to 8 friends learn to speak Japanese by laughing at each other's answers. A shared screen is the stage, phones are the controllers, and an AI host runs the show. Every round ends with players saying something out loud in Japanese, because the goal is speaking, not recognising.
Who it's for: total beginners through JLPT N4 (roughly the first two years of study), plus travellers preparing for a trip to Japan. Mixed groups are the norm: one player may know only the vowels while another reads kanji.
Pillars (every feature must serve at least one, and none may break another):
Funny first. If a round isn't fun with zero learning, it doesn't ship. The laughs carry the reps.
Say it out loud. Every round has a moment where each player produces Japanese aloud: reading their answer, shouting a kana, ordering at the konbini. Tapping and typing are scaffolds toward speaking, never the end point.
Beginners can win. Votes, team play and level-scaled scoring mean a first-timer can beat a fluent friend. Mistakes never cost points; they earn a kind correction.
Learning you can't see, progress you can. No lectures during play. The teaching happens at the reveal, in a 20-second "natural version" moment, and in a phrasebook after the game. Progress shows up as caught yōkai, a growing phrasebook and harder prompts.
One room, one truth. The server owns the game state, so a phone that drops, sleeps or cheats can't break a round.
What it is not: a flashcard app, a grammar course, or a chat with an AI tutor. Kotoba Party is the thing you play on game night that makes your study stick.
## Cast and tone
Kotoba Party is one late-night variety show broadcast from a haunted TV studio. The studio's old dictionary has come alive (in folklore, old objects become spirits called tsukumogami), so its letters are the kana yōkai. Every mode is a segment of the same show.
 | 
Host | 
Segments | 
Comic role
 | 
Pon, a tanuki comedian | 
Oogiri Night, Word Gauntlet | 
The MC. Plays the straight man (tsukkomi) to the absurd answers, never to the learner's Japanese. Steals a cushion from the leader once a game.
 | 
Chōchin-san, a paper-lantern ghost | 
Last Train | 
The theatrical conductor. Dramatic announcements, terrible puns, secretly rooting for the ghosts.
 | 
Fude, a living brush | 
Kana Yōkai Raid, Kotoba Concentration | 
The battle caller. Excitable, writes the kana in the air, cheers team combos.
Tone rules: the joke is always on the situation or the answer, never on a player's mistake or on Japan. Each host has three running gags and three reaction tiers (flop, good, IPPON). Stereotype words (ninja, samurai, geisha) appear at most once per tile set. A fluent speaker checks every host line and topic pack before it ships. Yōkai a player has caught sit in the studio audience in other modes.
## Players, session shape and platform
A game night is 15 to 20 minutes per mode, played in one room (or on a video call with the stage screen shared). Groups usually chain two or three modes.
 | 
Piece | 
What it is | 
Runs on
 | 
Stage | 
The shared screen: host, prompts, reveals, scores, music | 
Any browser on a TV or laptop
 | 
Controller | 
Each player's phone: join, answer, speak, vote | 
Mobile browser, no install (an app is optional later)
 | 
Game server | 
Owns rooms, phases, timers, scores; calls the AI and speech services | 
One cloud process
Joining: the stage shows a 4-letter room code and a QR code. Players open the site, enter the code and a nickname, pick their level (Kana, N5, N4) or take a 60-second placement check, and pick an avatar. A player who drops rejoins with the same code and keeps their seat for 90 seconds.
Player counts: 3 to 8 for the vote-based modes (Oogiri Night, Word Gauntlet), 1 to 8 for the co-op and skill modes (Kana Yōkai Raid, Last Train, Kotoba Concentration). Up to 8 more people can join as audience: they vote and cheer but don't answer.
Remote play: works by sharing the stage tab on a video call. Speaking happens into each player's own phone, so a call's audio lag doesn't matter.
Accessibility and comfort: every spoken step has a quiet fallback (tap or type) for players in a noisy bar or with a speech difference; it earns smaller bonuses but never blocks play. Text sizes on the stage are readable from 3 metres. Furigana is on by default; romaji is shown only at the Kana level and fades as kana are learned.
## Learning design
The game teaches speaking through a fixed ladder in every round: hear it, build it, say it, get a kind correction, meet it again later. The ladder borrows the principles the two Isekai'd games already use (retrieval before feedback, spacing, interleaving, calibrated feedback) and adds three that matter for a spoken language.
 | 
Principle | 
Where it lives in Kotoba Party
 | 
Output from memory, not just reading aloud (producing language exposes gaps that reading hides) | 
Every round includes a spoken answer from memory: say it first before tiles appear, say it to send it when locking in, and the Encore after the vote. Reading off the screen earns less than saying it from memory.
 | 
Retrieval before recognition | 
From N5 up, every prompt opens with a 5-second say-it-first window before any tiles appear. Tiles fade: a word used from tiles 3 times must then be said or typed. Multiple choice is kept for listening checks and the Kana level.
 | 
Input at the right level (a design heuristic, not settled evidence) | 
Each player's prompt, tiles and host lines are pitched at their level, with furigana and tap-to-translate.
 | 
Low anxiety | 
No points lost for mistakes. Answers are read on the stage by the host, so nobody performs until after the vote. Corrections go privately to each phone; only the winning answer's natural version is shown on the stage.
 | 
Prompt, then correct (corrective feedback that asks the learner to fix it is noticed more than a silent recast) | 
On a miss, the host gives one private clue and one retry. Then the natural version appears and the player says it aloud once.
 | 
Spacing across games and between them | 
Missed and "almost" items feed a Leitner queue (1, 3, 7, 14, 30 days). Only a spoken or typed answer from memory moves an item up a box; a tile pick moves nothing. A missed item comes back once more in the same game. A 3-minute solo phone review covers the days between game nights.
 | 
Interleaving through topic packs | 
A game night mixes one topic pack across modes, so the same words show up as a joke, a quiz and a memory tile.
 | 
Sounds that change meaning | 
Minimal pairs that differ only in length or a small っ (おばさん/おばあさん, きて/きって, ビル/ビール) appear as yōkai and minigame items. The host models devoiced vowels (です as "des"). Pitch accent is shown in the phrasebook but not scored in v1.
 | 
Call and response | 
After the natural version, the host calls it out and the room shouts it back, variety-show style. It counts as a review rep for everyone.
Level bands:
 | 
Band | 
Player picks | 
What they practise | 
Exit sign
 | 
Kana | 
"I can't read Japanese yet" | 
All ~230 hiragana and katakana by sound, shape and twin; first greetings | 
All 46 basic hiragana caught
 | 
N5 | 
"I can read ひらがな" | 
です sentences, の / は / が / を / に, 〜ます / 〜ました / 〜ません, 〜たい, 〜てください, plain form, numbers, time, travel phrases | 
80% of N5 topic-pack items reviewed from memory
 | 
N4 | 
"I can make simple sentences" | 
Potential and volitional forms, 〜たら / 〜ば, 〜そう, giving and receiving, casual vs polite speech | 
Content after v1; N4 players use N5 packs with no tiles until then
The game adjusts a player's band quietly after each game. Word lists follow textbooks and community N5/N4 lists, since the JLPT has published no official vocabulary lists since 2010.
Feedback rules: a correction is one sentence, shows the natural version, names one pattern ("の links two nouns, like 's"), and never lists every mistake. It arrives privately on the phone; the stage shows only the winning answer's natural version. The Japanese bonus lives in one capped pool (see Scoring), so a funny English answer can still win rounds 2 and 3.
What we measure (see Metrics): a delayed spoken test per topic pack, scored blind by a fluent rater against untaught baseline items. Spoken answers per round is tracked as engagement, not as learning.
## Core loop and shared systems
Every mode runs on the same round skeleton, so players learn the rhythm once and the server runs one state machine per mode with shared phases.
The round skeleton (each phase has a server-owned timer; the stage and phones only render it):
Players say their answer privately to send it, the host reads every answer anonymously, and the highlighted Encore is the out-loud moment after the vote.
Lobby: join, then a mic check: the phone asks for the microphone and the player says こんにちは, and the host answers by name. A denied or silent mic switches that player to the quiet fallback. The first player in (the VIP) picks the topic pack and starts. Phones keep their screens awake for the game.
Intro: the host explains the segment in one 20-second animated example. Skippable after the first game.
Prompt: the stage shows and reads the prompt; each phone shows that player's level version.
Answer (say it first): from N5 up, a 5-second say-it-first window opens before any tiles appear. Then players build, type (built-in kana pad), draw or speak. Locking in means saying it to send it: each player says their answer into their own phone, privately and all at once (hold-to-talk). The phone shows what the recogniser heard. The phase ends early when everyone is in.
Reveal and vote: the host reads every answer aloud on the stage, anonymously and with comic timing. Everyone votes, or the game resolves hits and misses in skill modes.
Encore: authors are revealed. The winner says their answer aloud for the room, from memory, for a spotlight bonus; anyone else may encore too. Players who opted out let the host read it.
Score and tip: cushions, damage or distance. The winning answer's natural version goes on the stage and the room shouts it back; every other player gets their own natural version privately on their phone.
Next round or finale, then Recap: awards named by the host in character, the night's phrasebook on each phone (stored on this device unless the player signs in), and a play-again vote.
Shared systems:
 | 
System | 
Rule
 | 
Scoring | 
Votes or hits count most. All Japanese and speaking bonuses come from one pool capped at 30% of a round's points. Comebacks raise trailing players' bonuses up to that cap, never past it. The last round is worth double.
 | 
IPPON | 
Every other voter picks the same answer, with at least 3 voters.
 | 
Comebacks | 
Trailing players get first pick of tiles; knocked-out players become ghosts or judges who still play.
 | 
Crew | 
A group that plays together gets a shared Crew name and goal (e.g. catch 46 yōkai together), so the group has a reason to come back.
 | 
Profiles | 
A nickname plus an anonymous device ID by default. Signing in (email link) is optional and keeps a phrasebook across devices.
 | 
Phrasebook | 
Every word used, every natural version, every miss, with audio, kana reading and pitch pattern. Missed items feed the spaced-review queue and the 3-minute solo review.
 | 
Topic packs | 
Curated sets of 40 to 80 words and 10 to 20 phrases per theme and level. Every item stores its kana reading, pitch pattern and checked audio, so TTS never guesses (一日 is ついたち or いちにち). A fluent speaker checks each pack.
 | 
Moderation | 
All player text and AI output pass a filter before the stage shows it. The VIP can hide any answer with one tap. Family mode tightens the filter.
 | 
Host | 
One host per segment (see Cast and tone). Short lines (under 12 words), simple Japanese with subtitles, a bank of about 30 written lines per event per host plus AI reactions.
 | 
Audio | 
Music per segment, a sound for every action, the host's TTS. A quiet-room setting mutes music while players speak.
 | 
Pacing | 
Each phase has a time budget; a full Oogiri Night game targets under 18 minutes with 8 players. A default playlist for first-time groups: Kana Yōkai Raid (one chapter), then Oogiri Night.
## Game modes
Three modes ship in v1 and two follow in v1.1, ordered by the player's path: Kana Yōkai Raid is the on-ramp, Oogiri Night the flagship, Last Train the most direct speaking practice. Six more sit in the backlog.
 | 
Mode | 
Ships | 
Inspired by | 
Players | 
Style | 
Level | 
Main speaking moment
 | 
Kana Yōkai Raid | 
v1 | 
LRNJ, ToKini Andy's pairs course | 
1–8 | 
Co-op raid | 
Kana | 
Shout each kana's sound
 | 
Oogiri Night | 
v1 | 
Shōten, IPPON Grand Prix, Quiplash | 
3–8 | 
Vote | 
N5 | 
Say your joke to send it; Encore
 | 
Last Train | 
v1 | 
Trivia Murder Party | 
1–8 | 
Survival quiz | 
N5 | 
Answer every question aloud
 | 
Word Gauntlet | 
v1.1 | 
Fibbage, Telephone, shiritori | 
4–8 | 
3-round | 
N5 | 
Spoken shiritori finale
 | 
Kotoba Concentration | 
v1.1 | 
Concentration | 
2–8 | 
Turn-based memory | 
Kana–N5 | 
Say the word to claim a pair
### Kana Yōkai Raid (on-ramp)
Kana-shaped yōkai invade the stage; the team defeats them from their phones. Covers all ~230 kana in 13 chapters that follow ToKini Andy's free pairs course (vowels, K row … combinations, special katakana). No romaji in answers.
 | 
Phase | 
What happens
 | 
Chapter pick | 
Each player marks chapters studied or takes the optional 60-second placement (it never holds up the room). The horde mixes everyone's chapters, but each player is only attacked with their own.
 | 
Wave 1: Night Parade | 
Shout (say the sound) and Twin Strike (tap the other alphabet's twin). Slow yōkai.
 | 
Wave 2: Shapeshifters | 
Look-alikes (シ/ツ, ソ/ン, ぬ/め, わ/ね/れ) and Echo (hear a sound, tap the kana).
 | 
Wave 3: Long and Short | 
Minimal pairs that differ only in length or a small っ (おばさん/おばあさん, きて/きって, ビル/ビール): hear one, tap it, then say it.
 | 
Boss: Word Yōkai | 
A katakana word (コーヒー, サンドイッチ); each player breaks one character, then the team reads the whole word aloud.
 | 
Recap | 
New yōkai caught (3 correct answers on separate days, solo review included), the haunted list of misses, memory cards.
Brush (drawing kana, graded on shape and stroke order) moves to v1.1 as an Ink Storm wave.
Damage scales by level, so a first-timer's あ hits as hard as an expert's ヴォ. Catching all 46 basic hiragana switches the player's Oogiri tiles from romaji to kana.
### Oogiri Night (flagship)
The AI shows a silly prompt in simple Japanese ("ねこの ひみつの しごとは ＿＿＿ です。"), players answer, the room votes for the funniest, and the host shows the natural version.
 | 
Round | 
Prompt | 
Answer | 
Points
 | 
1. Head to Head (3 prompts) | 
Sentence with a blank; each prompt goes to 2 players, Quiplash-style | 
Say it first, then 8 tiles at your level: 3 that fit, 3 absurd swerves, 2 callbacks (a word from tonight or a caught yōkai). From N5 up, tiles include 2 verbs and 1 adjective that ask for a form (ます, ました, ません, たい). Tiles or kana pad only. 6 tiles for new players. | 
Normal
 | 
2. Photo Caption | 
A funny photo (Bokete-style) | 
Tiles plus set phrases (〜たい, 〜てください); English allowed, no bonus | 
Normal
 | 
3. IPPON Round | 
One prompt for all | 
Any style; Japanese bonus doubled | 
Double
Each vote is a cushion (座布団), and every answer on the stage carries an English subtitle so the joke lands for everyone. An IPPON (every other voter, at least 3) gets a big animation. The Encore winner earns the spotlight bonus from the capped pool. Once a game, when the leader is 3+ cushions ahead, Pon "steals" one, Shōten-style.
### Last Train (spoken survival)
The players are travellers racing for the last train; the host is a theatrical yōkai conductor. Every answer is spoken.
 | 
Phase | 
What happens
 | 
Departure | 
Chōchin-san announces the last train; each stop is named, and the last stop has a twist.
 | 
Quiz stops (4–6) | 
A travel minigame per stop: Konbini Math, Meet the Innkeeper, Station Announcement, What Time?, Order Up, Counter Chaos, Particle Panic and more (17 designed, first-year topics). Particle Panic accepts は, へ and を said as わ, え and お.
 | 
Retry and penalty | 
A miss gets one retry with a hint. A second miss sends that player to a short penalty minigame (Calendar Crunch, Counter Chaos); failing it makes them a ghost. A rejection the room overrules never counts as a miss.
 | 
Ghosts | 
Still answer, can haunt a living player once per stop (shave 2 seconds), and earn their way back.
 | 
Platform Dash (finale) | 
Rapid spoken questions move players along the platform; first aboard wins. Ghosts start further back but can win.
 | 
Recap | 
A "travel survival kit": every phrase used and missed, with audio.
Each minigame is a template (prompt type, audio or image, accepted answers with variants, time limit) filled from topic packs, so new minigames are mostly content.
### Word Gauntlet (three escalating rounds)
 | 
Round | 
What happens | 
Points
 | 
1. Fake Kanji (Fibbage) | 
A real but obscure word; players invent fake meanings, then find the real one. Real words become golden words. | 
Normal
 | 
2. Lost in Translation (telephone, 4+ players) | 
A Japanese sentence passes around the room, translated back and forth; the drift is revealed. Players say their step aloud. | 
Double
 | 
3. Shiritori Showdown | 
Spoken word chain (りんご → ごりら → らっぱ), shrinking timer, ん knocks you out. House rules: ー continues from the vowel before it (コーヒー → ひ), small kana count as full size, dakuten may be added or dropped. Beginners get a longer floor timer and hint tokens; earlier points become extra seconds and tokens. Knocked-out players judge challenged words. | 
Decides the winner
### Kotoba Concentration (memory)
A memory board where pairs are two forms of one word (kana ↔ meaning, picture ↔ word, audio ↔ word). You keep a pair only by saying the word within 5 seconds; anyone else can steal it by saying it right. Cleared pairs reveal a hidden picture puzzle for a buzz-in bonus. Special tiles: yōkai (shuffle), bonus (extra turn), fog (hide a row). Boards are 4×4 to 6×6 and built from the night's topic pack.
### Backlog (after v1, in order)
Murder at the Onsen: interrogate AI-voiced suspects in simple Japanese, then vote whodunit.
Phrase Bingo Theater: improv scenes where each player secretly slips in assigned phrases.
Karaoke Duel: original beginner lyrics; pronunciation 60%, pitch 25%, timing 15%.
Who's the Tourist?: Spyfall-style social deduction in simple Japanese.
Oekaki: Drawful-style drawing and fake answers in Japanese.
Omiai Matchmaker: dating-show parody scoring politeness.
## AI and speech
The AI writes, judges and hosts; curated content keeps it honest. Every AI piece has a non-AI fallback so a slow or failed call never freezes a round.
 | 
Piece | 
Job | 
Fallback
 | 
Prompt writer (LLM) | 
Prompts, tile sets and minigame items at each player's level, drawn only from the topic pack's word list | 
Hand-written prompt packs (50+ per pack)
 | 
Judge (LLM) | 
Grammar check, the natural version, a 1-line tip, the private clue for a retry, the Japanese bonus | 
No bonus that round; natural version from the pack if one exists
 | 
Typed-answer checker (reused from the Isekai'd games) | 
Rubric check of typed Japanese with key terms plus an on-device embedding model, then the LLM judge for anything unclear | 
Offline rubric only
 | 
Multiple choice with ELI5, Huh??? and Search (reused) | 
Kana-level and listening checks; Huh??? explains the grammar point behind a tip, ELI5 gives a plain-English analogy, Search opens Jisho | 
Buttons hidden
 | 
Host (LLM + TTS) | 
Short in-character reactions with subtitles | 
The written line bank
 | 
Moderation | 
Filters player text and AI output before the stage | 
Block and show "[hidden]"
 | 
Text-to-speech | 
One fixed voice per host, run offline on our server (candidates: VOICEVOX character voices, Kokoro, Style-Bert-VITS2; licences checked per voice). The host LLM returns its line with a kana reading, which is what gets voiced, so kanji are never misread. Lines are voiced while players answer, so the reaction is ready at the reveal | 
Pre-rendered audio for pack content
 | 
Speech-to-text | 
Turns spoken answers into text for checking | 
Tap or type fallback
 | 
Answer checker | 
Converts transcripts and accepted answers to kana readings (三百五十円 → さんびゃくごじゅうえん), then compares after normalising numbers, long vowels and polite/plain variants | 
Accept on a close match and let the room overrule
 | 
Kana sound check | 
Closed-set check against only the target kana and its known confusions (つ/す, ら-row, small っ, long vowels). じ/ぢ, ず/づ and お/を count as one sound each. | 
Accept on transcript match
 | 
Kana drawing grader (hybrid) | 
The phone records each stroke's path and order. An offline check compares strokes to KanjiVG references (count, order, direction). A vision LLM then gets the drawing with a closed-set question ("ぬ, or め, ね, れ?") and writes a one-line tip. Later, an on-device classifier trained on the ETL handwriting set replaces most LLM calls. | 
Stroke check only
Latency hiding: the next round's prompts are generated during the current round. A round never waits on an LLM; if the pre-generated set isn't ready, the pack fallback is used. Judge calls for all answers run in parallel as answers are locked in, so results are ready by the vote.
Speech pipeline: the phone records a short clip (hold-to-talk, max 6 seconds) and sends it to the server, which calls a Japanese speech-to-text service and then the answer checker. Browser speech recognition is often cloud-backed and missing in some browsers, so it is only an optional fast path where measured to work. Single kana use the closed-set check, not general dictation. We do not claim pronunciation scoring in v1: "clean" means the recogniser understood it. We log false accepts (a wrong sound accepted) as well as false rejects, since open dictation tends to hide length and small-っ errors.
Forgiving by design: the most fun-killing failure is marking a correct beginner wrong. The checker leans towards accepting, the room can overrule a rejection with a thumbs-up vote, and every reject is logged for the false-reject metric.
Cost cap: a per-game LLM budget (target under $0.10 per 15-minute game) enforced by the server; over budget, the game switches to pack content for the rest of the night.
## Architecture
The architecture decisions from the earlier planning thread stand; the stack changes now that the project is built by Claude rather than as a learning exercise.
Kept (ADRs 0001 and 0002):
Authoritative server, thin clients. The server owns score, timer and phase. The stage and phones send intents and render what they're told.
WebSocket push, HTTP commands. State goes out over a WebSocket per client; actions (join, answer, vote, upload audio) go in as HTTP calls with a session token, which makes retries idempotent.
Full state on every change. Each phase change pushes the whole room view (tiny at 8 players), so a reconnecting phone just takes the latest. Each message carries a version number; clients drop older versions.
One writer per room. All actions for a room go through one queue, so two votes in the same millisecond both count exactly once.
Changed (decided by Ladi, Oct 26):
 | 
Earlier plan | 
Now | 
Why
 | 
Kotlin + Spring Boot server | 
TypeScript on Node | 
One language across server, stage and controllers; the protocol types are shared, which removes a whole class of bugs.
 | 
Android controller app | 
Mobile web controller (installable later as a PWA) | 
Jackbox's own model: no install means friends join in 10 seconds. iOS players aren't left out.
 | 
PostgreSQL from milestone 1 | 
In-memory rooms; a small database only for profiles, phrasebooks, packs and eval data | 
Rooms are ephemeral; only learning history needs to last.
Deployment: one server process behind HTTPS, with static stage and controller pages. Rooms live in memory; a crash loses the current game (acceptable for a 15-minute party game) but never a phrasebook. Scaling past one process is a design note, not a v1 task: rooms are a natural shard key, so routing by room code would come first.
Repo layout (kotoba-party): server/, stage/, controller/, shared/ (protocol types and game rules), content/ (topic packs, kana data), docs/ (this design, ADRs), tools/ (headless playtest bots, content linters).
## Build phases
Six phases, each playable on its own and ending with a gate: if a phase's gate fails, we fix it before starting the next. Phase 1 is the first real game night.
Phase 1, highlighted, is the first real game night with friends.
Phase 0: Skeleton. Rooms and codes, QR join, WebSocket push, HTTP commands, reconnect, the round state machine, a debug stage, and headless bot players for testing. Gate: 8 bots play 100 scripted rounds with no desyncs; a phone that drops for 30 seconds rejoins its seat.
Phase 1: First game night. Oogiri Night end to end with 3 hand-written, fluent-checked topic packs (food, family, travel): say-it-first, tiles with verb forms, the kana pad, host-read reveal, voting, cushions, IPPON, the Encore with hold-to-talk (recorded, not yet scored), the lobby mic check, and the phrasebook recap. Plus two fixed-answer Last Train minigames (Konbini Math, Meet the Innkeeper) as a speaking-from-memory segment. Host Pon as written lines with pre-rendered TTS. Gate: a real group of 4+ plays, every player speaks at least once per round, the game runs under 18 minutes, and the group votes to play again.
Phase 2: The AI layer. Prompt writer, judge with natural versions and retry clues, the reused typed-answer checker, host reactions, moderation, pre-generation, cost and latency logging, and the judge evaluation set (150–200 answers rated by fluent speakers). Gate: judge agrees with fluent raters at least 80% of the time on "acceptable or not"; no round waits on an LLM.
Phase 3: Speech, Kana Yōkai Raid and solo review. Speech-to-text pipeline, kana-reading answer checker, closed-set kana check, room overrule, false-reject and false-accept logging; Kana Yōkai Raid chapters 1–10 with the Long and Short wave, the yōkai book and spaced review; the 3-minute solo phone review. Gate: beginner false-reject rate under 10% on basic kana; a total beginner catches 10+ yōkai over their first week.
Phase 4: Last Train. The minigame template engine with 6 starter minigames, retry-then-penalty, ghosts, the Platform Dash and the named-stop story. Gate: playtesters rate 80% of the spoken phrases as ones they'd actually use in Japan.
Phase 5: v1 release. Kana chapters 11–13, the remaining Last Train minigames as content, Crews, optional sign-in, polish and a public link. Gate: the delayed spoken test shows gains over baseline items on two topic packs; 50% of playtest groups start a second game.
v1.1: Word Gauntlet, Kotoba Concentration, and Brush with the hybrid kana drawing grader.
The backlog modes follow release, Murder at the Onsen first.
## Metrics, risks and open questions
Metrics (logged from Phase 1 onward):
 | 
Question | 
Metric | 
Target
 | 
Is it fun? | 
Groups that vote to play again; game length | 
50%+ replay; under 18 minutes
 | 
Do people speak? | 
Spoken answers from memory per player per round; share using the quiet fallback (engagement, not learning) | 
1+ per player per round
 | 
Does it teach? | 
Delayed (7-day) spoken test per topic pack: name 10 pictured items and answer 3 open questions, scored blind by a fluent rater; half the tested items never appear in the game, as a baseline | 
Gain over baseline items; reported with sample size
 | 
Is the AI right? | 
Judge agreement with fluent raters; prompts readable at their level | 
80%+ agreement
 | 
Is speech fair? | 
False rejects and false accepts for beginners, per kana and per minigame | 
False rejects under 10%; false accepts tracked
 | 
Is it fast and cheap? | 
Answer-to-score latency; LLM cost per game | 
Under 2 s median; under $0.10
Risks:
 | 
Risk | 
Mitigation
 | 
Speech recognition rejects correct beginner speech | 
Lenient checker, room overrule, closed-set kana check, false-reject metric gates Phase 3
 | 
Speaking aloud in front of friends feels exposing | 
Private say-it-to-send, opt-in Encore, host reads answers on the stage, team shouting in the Raid, praise for trying
 | 
AI judge "corrects" correct Japanese or misses errors | 
Fluent-rater evaluation set, conservative corrections, natural versions only on confident calls
 | 
Mixed-level groups feel unfair | 
Per-player prompts and tiles, level-scaled damage and bonuses, votes for funny
 | 
Offensive answers on the stage | 
Moderation on every text, VIP hide button, family mode
 | 
Scope (5 modes, 17 minigames, 230 kana; v1 is now 3 modes) | 
Phases ship independently; minigames and packs are content, not code
Open questions for playtests:
Are 8 tiles right for beginners, or fewer? Do tile meanings show in English by default?
Does the Encore stay fun when several players want one, or should only the winner perform?
Is "3 correct answers on separate days" the right bar for catching a yōkai?
Does Brush work on small phones?
Does the cushion-stealing host feel funny or unfair?
Should N4 players get a "no tiles" mode for a bigger bonus?
## Expert panel review (Oct 26, 2026)
The first draft averaged 6.6 out of 10 across five reviewers (the kotoba panel). Every fix below is already folded into this version.
 | 
Expert | 
Rating | 
Headline | 
Review
 | 
Game design | 
7 | 
Strong spine and gates, but Perform broke anonymity, incentives favoured English, and v1 held too much | 
Panel: Game Design
 | 
UX design | 
7 | 
Right platform and fallbacks; the speaking moment needed design (anonymity, pacing, mic permission, no Japanese keyboard) | 
Panel: UX Design
 | 
Story craft | 
6 | 
Good Japanese comedy roots, but no shared world or named cast | 
Panel: Story Craft
 | 
Learning science | 
6 | 
Most "speaking" was recognition and reading aloud; recasts go unnoticed; spacing depended on irregular game nights | 
Panel: Learning Science
 | 
Japanese language | 
7 | 
Japanese examples correct; N4 band mislabelled, no pronunciation content, noun-only tiles, speech claims too strong | 
Panel: Japanese Teaching
Where several experts agreed, and what changed:
 | 
Theme | 
Raised by | 
Change
 | 
Authors reading their own "anonymous" answers gave them away and slowed rounds | 
Game design, UX, Story | 
Say it to send it (private, simultaneous), host reads answers on the stage, authors revealed in the Encore after the vote
 | 
Players need to speak from memory, not read | 
Learning, Japanese, UX | 
Say-it-first window, fading tiles, verb and adjective tiles with forms, only from-memory answers advance spacing
 | 
Pronunciation was missing | 
Learning, Japanese | 
Sounds that change meaning principle, the Long and Short wave, pitch in the phrasebook, false-accept logging
 | 
Corrections and scoring rules contradicted each other | 
Game design, UX | 
One capped bonus pool, private corrections, winner's natural version on the stage, IPPON needs 3+ voters
 | 
Too much in v1 | 
Game design | 
v1 is Raid, Oogiri and Last Train; Gauntlet, Concentration and Brush move to v1.1
Factual fixes from the Japanese review: て-form, past and plain form moved from N4 to N5; じ/ぢ, ず/づ and お/を treated as one sound; particles は/へ/を accepted as わ/え/お; browser speech recognition described as often cloud-backed; no official JLPT vocab lists since 2010. Full reviews are also saved in the project files under reviews/gdd-panel-2026-10-26/.
Added after the panel (Ladi's request): the typed-answer checker and multiple choice with ELI5, Huh??? and Search from the Isekai'd games, and a hybrid kana drawing grader (stroke check plus a closed-set vision LLM).