# Music

The stage (the TV) plays music; the phones don't, because their mics are listening. Most of it is
recorded tracks under CC0 or CC BY licences (`stage/assets/music/`, listed in
`stage/src/music/tracks.ts`); the rest is original tunes played by a small chiptune synth in the
browser (`stage/src/music/songs.ts`). Licences: [commercial-blockers.md](commercial-blockers.md), row 22.

**Direction (Ladi, 2026-10-26):** after comparing samplers, bright "out with friends" pop, funk and
swing for the lobby and the social games, mystery and quiz tracks for the quiz games and Murder at the
Onsen, and an anime-style battle theme for the Raid.

## What plays when

`stage/src/music/cues.ts` picks a cue from the mode and phase:

| Phase | Music |
| --- | --- |
| Lobby | **Bouncing** (Holizna) |
| Intro, prompt | The mode's theme, full mix (under where a mode speaks in its prompt: Oogiri, Omiai, the Onsen, Concentration) |
| Answer, encore, penalty | The mode's theme, "under" (see below). Encores keep whatever is playing |
| Reveal | Theme under, with the synth's drum roll on top where it's a real reveal |
| Score | A recorded theme plays on; Last Train gets the synth's **Tally Ho** |
| Finale | A recorded theme plays on, under; Last Train gets the synth's **Taiko Showdown** |
| Recap | The fanfare, then **Happy Dance** (Holizna), with the credits on screen |

| Mode | Theme |
| --- | --- |
| Oogiri | **Monkeys Spinning Monkeys** (Kevin MacLeod) |
| Phrase Bingo | **Love Love Love** (Holizna) |
| Oekaki | **Hep Cats** (Kevin MacLeod) |
| Tourist Trouble | **Take a Trip** (genaralskar) |
| Omiai | **Carefree** (Kevin MacLeod) |
| Word Gauntlet | **Investigations** (Kevin MacLeod) |
| Concentration | **Funkorama** (Kevin MacLeod) |
| Murder at the Onsen | **Sneaky Snitch** (Kevin MacLeod) |
| Kana Yōkai Raid | **Determination** (HydroGene) |
| The Last Train | **Last Train Dash** (synth) |
| Karaoke Duel | None: it plays its own backing track (`stage/src/modes/karaokeAudio.ts`) |

The synth's other tunes (a festival lobby, comedy, quiz, stroll, battle, mystery, music-box, outro and
fanfare) are kept as spares; switch a mode back to one by naming it in `MODE_THEMES`.

## Players' voices come first

- **Under mix.** While players may be speaking, or the stage is reading Japanese aloud, the music goes
  through a high-pass at 90 Hz and two low-passes at 750 Hz and drops to about a third (synth songs
  also lose their lead and most high drums). That keeps the speech band (about 1–4 kHz) the phone mics
  and Whisper need mostly clear. It applies to recorded tracks too. The phases that count as speaking
  are `TALKING` and `SPEAKING_PHASES` in `cues.ts`.
- **Ducking.** The music drops to a fifth while a host's voice line or the browser's Japanese speech
  (Murder at the Onsen's suspects, Concentration's audio cards) plays, and comes back when the last one
  ends. A new host line cuts off the previous one.
- **One mute.** The sound button (top left of the stage) mutes the music, the host voices, the read-aloud
  Japanese and Karaoke Duel's track together, and is remembered in that browser. With sound off,
  Concentration shows audio cards' kana instead. Browsers only allow sound after a tap, click or key
  press on the page, so until then the button reads "Click for music".
- **Stings.** The drum roll plays only on reveals that are reveals (Oogiri, Bingo, Oekaki, Tourist,
  Omiai, the Raid) and on the Onsen's accusation; the recap opens with the fanfare.

## Recorded tracks: loops, loudness, credits

- **Loop points.** Each track loops between two beat-aligned points (`loop` in `tracks.ts`), found with
  beat tracking so intros, fade-outs and silent tails never play. Determination is exactly 40 bars, so it
  loops whole.
- **Loudness.** `gainDb` brings each file to about −16 LUFS (measured with ffmpeg's `ebur128`), level
  with the synth through the music bus, so switching games doesn't jump in volume.
- **Loading.** Tracks are fetched when needed, the next likely ones ahead of time, and at most three
  stay decoded in memory. The old music keeps playing until the new track can start; if a file can't
  load, its synth `fallback` plays instead. The server sends MP3s with a week's cache.
- **Credits.** The now-playing line beside the sound button names the track, author and licence; the
  recap screen lists them all (`creditSummary()`), with the host voices' credits.

## Adding a recorded track

Encode it to 128 kbps MP3 in `stage/assets/music/`, add it to `TRACKS` with its author, licence,
source, loop points, gain and fallback, add it to row 22 of commercial-blockers.md, and name it in
`cues.ts`. `tests/music.test.ts` checks the file exists, the loop fits inside it and the credit lines
are complete.

## Editing a synth tune

Songs are data in `stage/src/music/songs.ts`; the format is described at the top of the file. Chords
are one per bar, the lead is on an 8th-note grid, drums on a 16th grid, and bass and accompaniment are
generated from the chords in a named style. `tests/music.test.ts` checks every song compiles and every
lead fills its bars.

To hear a change without playing a game, render it offline: `renderInto()` in
`stage/src/music/engine.ts` works with an `OfflineAudioContext` (for example in Playwright's Chromium).
