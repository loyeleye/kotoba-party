# Music

The stage (the TV) plays music; the phones don't, because their mics are listening. Every tune is
original to Kotoba Party and is played by a small chiptune synth in the browser, so there are no
audio files and nothing to license ([commercial-blockers.md](commercial-blockers.md), row 21).

## What plays when

`stage/src/music/cues.ts` picks a cue from the mode and phase:

| Phase | Music |
| --- | --- |
| Lobby | **Natsu Matsuri Walk-in** (`lobby`): festival walk-in, D major pentatonic, chanchiki and taiko |
| Intro, prompt | The mode's theme, full mix |
| Answer, encore, penalty | The mode's theme, "under" (see below). Encores keep whatever is playing |
| Reveal | Theme under, with a drum roll (`reveal`) on top |
| Score | **Tally Ho** (`score`) |
| Finale | **Taiko Showdown** (`finale`), under |
| Recap | **Curtain Call** fanfare, then **Otsukaresama** (`outro`) |

| Mode | Theme |
| --- | --- |
| Oogiri, Phrase Bingo, Oekaki | **Laugh Track Bounce** (`festive`) |
| Word Gauntlet, Concentration | **Tick-Tock Quiz Desk** (`quiz`) |
| Tourist Trouble | **Ekimae Stroll** (`stroll`) |
| The Last Train | **Last Train Dash** (`rush`) |
| Kana Yōkai Raid | **Yōkai Raid** (`battle`) |
| Murder at the Onsen | **Steam and Suspicion** (`mystery`) |
| Omiai | **Teacups at Two** (`gentle`) |
| Karaoke Duel | None: it plays its own backing track (`stage/src/modes/karaokeAudio.ts`) |

## Players' voices come first

- **Under mix.** While players may be speaking, the lead and most high drums drop out and the rest is
  low-passed at 900 Hz and turned down. Rendered offline, that cuts the music's energy above 1 kHz by
  about 24 dB, so the speech band the phone mics and Whisper need stays clear.
- **Host ducking.** The music drops to about a third while a host's voice line plays.
- **One mute.** The sound button (top left of the stage) mutes the music and Karaoke Duel's track
  together and is remembered in that browser. Browsers only allow sound after a click or key press on
  the page, so until then the button reads "Click for music".

## Editing a tune

Songs are data in `stage/src/music/songs.ts`; the format is described at the top of the file. Chords
are one per bar, the lead is on an 8th-note grid, drums on a 16th grid, and bass and accompaniment are
generated from the chords in a named style. `tests/music.test.ts` checks every song compiles and every
lead fills its bars.

To hear a change without playing a game, render it offline: `renderInto()` in
`stage/src/music/engine.ts` works with an `OfflineAudioContext` (for example in Playwright's Chromium).
