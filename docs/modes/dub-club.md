# Dub Club (アフレコ部 "the dubbing club")

Host: **Fude-kantoku**, a broke but proud anime director. 3–8 players, three scenes, about 12 minutes.
Inspired by Jackbox's Hear Say. Design and panel reviews (humor, JLPT, learning science, game design,
and the music panel): `/mnt/project-files/dub-club/` (design.md and review/).

The room is the voice cast of a terrible late-night anime. Each scene shows a silent pixel-art scene and
one line. Each phone secretly gets two direction cards (かなしそうに, ロボットみたいに, たべながら…) and keeps
one. Everyone reads the line plainly (the words are checked privately), then records it in character.
The TV screens every dub with the character lip-syncing to the real voice, the room guesses how each
was directed, and the card flips at once. The most-loved dub of each scene goes into tonight's episode,
played at the end with credits.

## Why it works for speaking

- **Two takes of one line:** a plain read for accuracy, then an acted read for prosody (pitch, length,
  stress). The second is the fun; the first is the learning, and it never decides who wins.
- **Private feedback:** the plain read shows each mora green (heard) or grey (lost), with one retry. Only
  the player sees it, so nobody is shamed for a bad line in front of the room.
- **Listening:** every guesser hears the line three to eight times, in different voices and moods.
- **Grammar from the cards:** each card is an adverbial form (〜く, 〜て, 〜で are N5; 〜そうに, 〜みたいに,
  〜ながら N4). A card guessed right goes in the guesser's phrasebook with its root word (かなしい →
  かなしそうに).

## How a game goes

| Phase | TV | Phone |
| --- | --- | --- |
| intro | アフレコ部 title, tonight's episode, how to play; the "turn on the TV's sound" button if needed | How to play; where your voice goes, and "Play my voice from this phone" |
| prompt (12 s) | The scene, its setup and the line; Fude reads it plainly (the table read) | The scene, your line at your level, two secret cards to choose from |
| answer (65 s, 75 s with a Kana player) | The scene, mouth shut; the cast ticks off who rehearsed and who sent a take; silence | 1: hold and read plainly (mora marks, one retry). 2: tap to record the acted take, listen back, retake or send. A take recorded but not sent goes in 4 s before the end. No mic or quiet mode: guess only |
| reveal (the screening) | One dub at a time: clapper and name card (1.6 s), the clip with lip sync, 4.5 s to guess, an optional replay (もう いっかい, when half the guessers ask), the card flips with who got it | A grid of six cards (the real one and five from other sound families); もう いっかい; one heart for the scene; VIP can skip a dub |
| score | Cast notes: every card, who read it, hearts, points; the dub chosen for the episode | Your private notes: how many read your card, hearts, the plain read's marks |
| finale | Tonight's episode: title card, the three chosen dubs back to back, つづく…, the credits | "Look at the TV" (a dub kept on a phone plays from that phone) |

Scene 3 counts double. The episode keeps each scene's most-hearted dub, then the most guessed, then
the first sent.

## Scoring

| What | Points |
| --- | --- |
| Each player who read your card | 100 (none if your take said the card out loud: ネタバレ) |
| Each card you guessed right | 50 |
| Each heart your dub got (one heart per player per scene) | 100 |
| Your dub goes into the episode | 150 |
| Words, from the plain read: all heard at your level's bar (Kana 70%, N5 80%, N4 85%) / half / tried | 50 / 30 / 20 (30 for everyone on a night with no speech check) |
| The Gallery's curveball, right (once a game, one Kana or N5 player, ad-lib rooms only) | 5 (not doubled) |

Words are capped low on purpose: careful reading should never beat bold acting.

Awards: しゅえんしょう (most hearts), めいえんぎしょう (card read most), ききじょうずしょう (best guesser),
かつぜつしょう (clearest plain reads).

## The ad-lib (N4 hard role, goal 4.8)

In a room with an N4 player, each scene offers one of them the **ad-lib**: no script showing. Who is
offered it comes from the shared `nextOfferee` (shared/src/modes/hardRoleLog.ts): the N4 player offered
fewest times, then longest ago; a "not this time" sits the next scene out; in a room of 4 or more, whoever
played it last scene gets this one off.
Their phone shows the scene, a mission in English and a picture ("Your lunch box is empty. Ask, casually,
who ate your onigiri." 🍙) instead of the line, and they say it their own way in casual speech: plain form
+ よ/ね/の？, 〜んだ, 〜てる/〜ちゃった. They still get two direction cards and act it, so the screening works
as before. Everyone else keeps their scripted line, and a room with no N4 player sees no change.

- **The offer** is opt-in, on the shared offer card (`roleOffer`): two equal buttons, **🎙 Take it: ad-lib** or **Not this time** (keep the
  scripted N4 line), with Fude-kantoku's "No script this time. Make it yours!" and the mission, until the
  take is sent. Until they tap Take it: ad-lib, the phone shows the scripted N4 line; sending the scripted
  take without answering logs the offer as timed out. A plain read while the offer is open is of the
  script and isn't a yes. An offer still open when recording ends is `timeout` (`away` if the player had
  dropped out). Each actor keeps the answer in `Actor.adlib` (the shared `OfferAnswer`), and `adlibTally`
  counts offers, yeses and `offerRate` (the step's gate: 60% or more taken; away is left out).
- **The check** is lenient, since there is nothing to match against: casual if a clause ends in a casual
  particle, the copula or a plain form (よ, ね, の, だ, かな, じゃん, 〜た, 〜ない, 〜う…) and not in a polite
  form (です/ます, でしょう, ください…), or a clause ends in 〜んだ, or a contraction (〜ちゃった, 〜てる,
  〜とく, でしょ but not でしょう) turns up outside katakana words (so ホテル isn't 〜てる); on the mission if
  one of the scene's key words comes through. Both score as a full
  plain read (50), one as close (30), neither as tried (20): the same word points as everyone else.
- **The model line** (one casual N4 way to say it) shows on the phone once the take is sent, in the cast
  notes and in the phrasebook (`dub:<scene>:adlib`). The TV tags the cast list and the name card
  アドリブ; over an ad-lib's voice it captions only the model line's English (so the room can follow
  without being handed a Japanese answer), and the reveal captions it with the model line itself.
- An ad-lib take may run 9 s (13.5 s capped at 12 s for slow cards).
- **Mission missed**: when the plain read misses the mission, the phone shows one of its words to aim for
  ("🎯 Try to get this word in: おにぎり": the first key word of 3+ kana, else the first), on the rehearsal
  screen and in the cast notes.

### Mixed rooms (shared, mixedRoom.ts)

- **The Gallery**: while an ad-lib dub is on (from the clip to its card flip), every other connected
  player gets one tile: four reactions, shown as bubbles in the TV's side column, never scored. Once a game,
  the first Kana or N5 player's tile is the curveball instead: "Which word did you hear?", with the
  longest of the mission's words (3+ kana) heard in the acted take and two from the episode's other
  missions, +5 if right (paid at once, not doubled in scene 3). No speech check on the take, or none of
  the mission's words in it: no curveball that scene.
- **The commentary booth**: once a good ad-lib's card flips (the take sent, not skipped or spoiled, and
  casual in the plain read or the acted take), one more screening step, `booth`, 5–7 s
  (`commentaryMs`), and only then: Fude calls 「カット！ いいね！」 (`dub_cut`), and 1.2 s later says the
  scene's model ad-lib line himself (`dub_booth`, a `{line}` bank line), never the player's take. The TV
  shows the model line with its casual chunk lit (〜ちゃった, 〜んだ, だよ, …の？: `casualChunk`) and one
  line of colour ("No script, all Aki. One casual way to say it, with 「ちゃった」."); Kana and N5 phones
  show its gist. A night with no speech check has no booth.
- **The host stand-in**: in a room of one or two connected players with nobody at N4 (a 3-player game
  with one gone), Fude ad-libs one scene himself, once a game: 5 s into its scene card, after his table
  read, he says the scene's model ad-lib line (`dub_standin`), the TV shows it in the booth strip and Kana
  and N5 phones show the gist. Inside the 12 s scene card, so no time is added; nobody is asked to say
  anything, and nothing is scored.

Content: `Scene.adlib` (and `cheekyAdlib` for Under the Cherry Tree's Cheeky twist) in `scenes.ts`, one per
scene, all draft, each tagged with its frames (`plain`, `n-da`, `teru`, and
`potential` for two).

## Content

`shared/src/modes/dubClub/scenes.ts`: nine episodes of three scenes (setup, build, twist), each line at
Kana (4+ morae), N5 and N4 (with its N4 point in the English); 33 direction cards in sound families, so
a grid never holds two that sound alike. Kids rooms get the all-ages and Kids episodes and cards;
Family adds Family; Cheeky gets Cheeky and Family, including Girls' Night told from her side (Ladi:
the audience is about half women) and a really cheap idol who drops the act backstage. One drinking card at most. All draft until a fluent check.

Fude's lines: `content/src/hosts/fude.ts`, events `dub_*`.

## Art

PixelLab pixel art in `stage/assets/dub/`: 13 sets, 14 characters, each with a three-frame mouth sheet
(`char-*-talk.png`; the monster's is built from its own still by `tools/art/sources/monster-talk.py`),
33 direction-card icons (`cards/`), the episode's title, つづく and credits backdrops (`ep-*.png`), and the
phone's play, stop and mic icons (`ui-*.png`) for listening back and the recording level meter.

## Clips and privacy

A take is posted to `POST /api/rooms/:code/clip` and kept in the room's memory only while the mode
lists it in `clipsInUse` (the current scene, and the episode's chosen dubs); only the main TV can fetch
it. See [speech.md](../speech.md#dub-clubs-kept-clips) and commercial-blockers row 32.

## Music and sound

The music panel's rules (stage/src/music/cues.ts `dubCue`): the ident, then the anime
opening (`dub-opening` and `dub-opening-b`, two Mureka takes that alternate game by game; the synth `anime-op` if it can't load); the scene card under the listening mix so the table read is heard;
**silence** while phones record and while dubs play (a voice over music is mush on a TV speaker); the
tally tune for cast notes; in the episode, the opening under the title, nothing under each dub, the
`eyecatch` jingle on つづく, and the ending ballad (`dub-ending`, Mureka; synth `anime-end` as fallback) over the credits. No recap fanfare after it: the
episode was the ending. Clips are levelled on the TV (to one loudness, clamped −6…+15 dB, so a whisper
stays quieter than a shout), high-passed at 100 Hz, and played on their own voices bus through the
master limiter. Fude never talks over a dub (`hostHoldMs`).

## Open questions

- Ad-lib, decided for now (Ladi to confirm): it's offered every scene to one N4 player in turn; the check
  is casual-or-key-word lenient, not a grammar check; the model line is shown after the take, never
  before; the TV shows only the model line's English over an ad-lib's voice, and the Japanese at the reveal.
- Rotation: the shared `nextOfferee` (fewest offers, then longest ago; a "not this time" sits one scene
  out; in rooms of 4+, nobody two scenes running). A lone N4 player in a small room who declines is now
  offered it every other scene, not every scene.
- Mixed rooms, decided for now (for Ladi to confirm): the curveball's word is a mission word heard in the
  take (the player's own words are what the room hears, not the model line); the booth needs casual
  speech found by the check, so a night with no speech check has none; the stand-in can only happen when a
  game is down to one or two connected players (Dub Club needs three to start, and bots count as players).
- Ad-lib, deferred: the N3 ad-lib (step 6).

- Players with no mic: a VOICEVOX dub of their line in their chosen style (deferred).
- The learning-science "stress scene", where the card is a word to stress, not a mood (deferred).
