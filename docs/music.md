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
| Intro, prompt | The mode's theme, full mix |
| Answer, encore, penalty | The mode's theme, "under" (see below). Encores keep whatever is playing |
| Reveal | Theme under, with the synth's drum roll on top |
| Score | A recorded theme plays on; Last Train gets the synth's **Tally Ho** |
| Finale | A recorded theme plays on, under; Last Train gets the synth's **Taiko Showdown** |
| Recap | **Happy Dance** (Holizna) |

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

- **Under mix.** While players may be speaking, the music is low-passed at 900 Hz and turned down,
  so the speech band (about 1–4 kHz) the phone mics and Whisper need stays clear. Synth songs also drop
  their lead and most high drums; rendered offline, that cuts their energy above 1 kHz by about 24 dB.
- **Host ducking.** The music drops to about a third while a host's voice line plays.
- **One mute.** The sound button (top left of the stage) mutes the music and Karaoke Duel's track
  together and is remembered in that browser. Browsers only allow sound after a click or key press on
  the page, so until then the button reads "Click for music".

## Adding a recorded track

Encode it to 128 kbps MP3 in `stage/assets/music/`, add it to `TRACKS` with its author, licence and
source, add its row to commercial-blockers.md, and name it in `cues.ts`. CC BY tracks need their
credit line (`TRACK_CREDITS`) on the credits screen.

## Editing a synth tune

Songs are data in `stage/src/music/songs.ts`; the format is described at the top of the file. Chords
are one per bar, the lead is on an 8th-note grid, drums on a 16th grid, and bass and accompaniment are
generated from the chords in a named style. `tests/music.test.ts` checks every song compiles and every
lead fills its bars.

To hear a change without playing a game, render it offline: `renderInto()` in
`stage/src/music/engine.ts` works with an `OfflineAudioContext` (for example in Playwright's Chromium).
