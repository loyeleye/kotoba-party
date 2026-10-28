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

Words are capped low on purpose: careful reading should never beat bold acting.

Awards: しゅえんしょう (most hearts), めいえんぎしょう (card read most), ききじょうずしょう (best guesser),
かつぜつしょう (clearest plain reads).

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

- Players with no mic: a VOICEVOX dub of their line in their chosen style (deferred).
- The learning-science "stress scene", where the card is a word to stress, not a mood (deferred).
