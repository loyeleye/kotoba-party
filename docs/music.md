# Music

The stage (the TV, and any friend's laptop watching the room) plays music and sound effects; the
phones don't, because their mics are listening. Most of it is
recorded tracks under CC0 or CC BY licences (`stage/assets/music/`, listed in
`stage/src/music/tracks.ts`); the rest is original tunes played by a small chiptune synth in the
browser (`stage/src/music/songs.ts`). Licences: [commercial-blockers.md](commercial-blockers.md), row 22.

**Direction (Ladi, 2026-10-26):** after comparing samplers, bright "out with friends" pop, funk and
swing for the lobby and the social games, mystery and quiz tracks for the quiz games and Murder at the
Onsen, and an anime-style battle theme for the Raid. On 2026-10-27 Ladi kept Bouncing in the lobby
with its loop seam fixed, and moved Love Love Love to Omiai.

## What plays when

`stage/src/music/cues.ts` picks a cue from the mode and phase:

| Phase | Music |
| --- | --- |
| Lobby | **Bouncing** (Holizna); the synth lobby tune (`lobby` in `songs.ts`) stands in when it can't load |
| Intro | The house ident (**Kotoba Party!**), then the mode's theme |
| Prompt | The mode's theme, full mix (under where a mode speaks in its prompt: Oogiri, Omiai, the Onsen, Concentration) |
| Answer, encore, penalty | The mode's theme, "under" (see below). Encores keep whatever is playing |
| Reveal | Theme under, with the synth's drum roll on top where it's a real reveal |
| Score | A recorded theme plays on; Last Train gets the synth's **Tally Ho** |
| Finale | A recorded theme plays on, under; Last Train gets the synth's **Taiko Showdown** |
| Recap | The fanfare, then **Happy Dance** (Holizna), with the credits on screen |

Each game has two themes and alternates between them, game by game on each screen (`MODE_ALT_THEMES`
and `themeFor` in `cues.ts`; the count is kept in the browser), so a long night doesn't loop one tune.

| Mode | First theme | Second theme |
| --- | --- | --- |
| Oogiri | **Monkeys Spinning Monkeys** (Kevin MacLeod) | **Quirky Dog** (Kevin MacLeod) |
| Phrase Bingo | **Carefree** (Kevin MacLeod) | **Life of Riley** (Kevin MacLeod) |
| Oekaki | **Hep Cats** (Kevin MacLeod) | **Wallpaper** (Kevin MacLeod) |
| Tourist Trouble | **Take a Trip** (genaralskar) | **Off to Osaka** (Kevin MacLeod) |
| Omiai | **Love Love Love** (Holizna) | **Local Forecast - Elevator** (Kevin MacLeod) |
| Word Gauntlet | **Investigations** (Kevin MacLeod) | **Cipher** (Kevin MacLeod) |
| Concentration | **Funkorama** (Kevin MacLeod) | **Kool Kats** (Kevin MacLeod) |
| Murder at the Onsen | **Sneaky Snitch** (Kevin MacLeod) | **Ishikari Lore** (Kevin MacLeod, koto) |
| Kana Yōkai Raid | **Determination** (HydroGene) | **Ouroboros** (Kevin MacLeod) |
| The Last Train | **Last Train Dash** (synth, 16 bars) | |
| Karaoke Duel | Each grown-up song is sung over one recorded instrumental (`track` in `songs.ts`; files listed with the other tracks in `tracks.ts`): Night Drive's and Harbour in the Rain's AI-made backings (Mureka, one per version of each song, credited as AI-generated), Hustle, Slow Jam and In Your Arms (Kevin MacLeod), JRPG Epic Rock Battle Theme (HydroGene), Hot Springs Town (Kistol), Lazy Saturday (vandalorum) and Cheers For Starlight (Chloe Wolfe), with a quiet synth guide melody on top. Kids' songs, streamer mode and files that won't load get the synth backing (`stage/src/modes/karaokeAudio.ts`; each song has a style: nursery, city pop, enka, rock, izakaya, blues, kayō, hip hop, idol, R&B, and grown-up songs carry chords for the bass); the synth's **Teacups at Two** between songs and **Taiko Showdown** at the end | |

**House theme.** "Ko-to-ba pa-a-ty!" (D5 D5 E5 F#5 A5 | G5 F#5 E5 D5) is the show's signature. The ident
plays it before every game, the recap's Curtain Call fanfare opens with it, and the synth lobby and
outro quote it, so streamer mode sounds like the same show too.

The synth's other tunes (comedy, quiz, stroll, battle, mystery, music-box, outro and
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
- **One tab plays.** When several tabs of one browser show the same room, only one makes sound
  (`shared/src/audioTabs.ts`): the tab you switch to or click into takes it, over a BroadcastChannel.
  The others keep the music running silently, so the switch is seamless, and their button reads
  "Sound in another tab". If you leave for a tab that isn't the game, the last game tab keeps playing;
  closing it passes the sound to another game tab. Stage tabs and phone tabs are elected separately
  (clicking into your phone tab doesn't stop the stage's music), and other devices are never affected.
  Phones follow the same rule for Kana Raid's and Last Train's read-aloud Japanese. Mute and volumes
  stay as they are; a tab handing over doesn't change them.
- **Listening waves.** In Kana Raid's Wave 2 (Echo) and Wave 3 (Long and Short), players pick what
  they heard from a phone speaker, so the music drops further still: the "listen" mix (low-passed at
  500 Hz, about a sixth of the level).
- **Stings.** The drum roll plays only on reveals that are reveals (Oogiri, Bingo, Oekaki, Tourist,
  Omiai, the Raid) and on the Onsen's accusation; the recap opens with the fanfare.

## Sound effects

`stage/src/music/sfx.ts` synthesises short effects in the browser (no files, nothing to license) on
their own bus, with their own volume:

| Effect | When |
| --- | --- |
| Pop | A player joins the lobby |
| Swish | A new round's prompt |
| Tick, tock | The last five seconds of a timed phase, except while players are speaking |
| Chime | Points go up; a Concentration pair kept or stolen; a Last Train traveller gets it |
| Bwomp (low, below the speech band) | A miss: Concentration's "nobody said it", a wrong picture guess, a yōkai escaping, a Last Train miss |
| Thwack | A yōkai takes a hit; a Concentration yōkai or fog card |
| Tap | Buttons on the stage itself |

A screen that joins late hears only what happens after it joins.

## Settings panel

The ⚙ Settings button beside the sound button opens a panel on every stage screen
(`stage/src/settings.ts`). Each screen keeps its own settings in its browser:

- **Master volume**, **Host voice volume** (VOICEVOX lines and the read-aloud Japanese), **Sound
  effects volume** and **Background music volume** (the loops, jingles and Karaoke Duel's backing).
- **Streamer mode**: plays only the synth's own tunes (each track's `fallback`), so a stream or video
  of the screen can't pick up a copyright claim for the recorded tracks.
- **Background effects**: the mist, spotlights and confetti behind the game ([graphics.md](graphics.md#backdrop)). Off shows a still set.

The main stage's panel also has **Let other screens control the game**. With it on, a friend's
watching screen (`/stage/?code=XXXX`) gets Start, Skip ahead and Play again in its own panel. It's a
room setting (the `settings` command, [protocol.md](protocol.md)); only the main stage can change it.

### Invite friends

Every panel, the stage lobby and the phone lobby carry an **Invite friends** card
(`shared/src/share.ts`) with the room's two links: the **Phone link** (`/?code=XXXX`, joins as a
player; the backup when the QR code won't scan) and the **Stage screen link** (`/stage/?code=XXXX`,
a watching screen for friends playing from somewhere else). Each has **Copy** and, where the device
has a share sheet, **Share**. Share leads on phones; Copy leads elsewhere. The address is a
selectable field, so it can still be copied by hand if the clipboard is refused, and a copy
confirms on the button (and to screen readers) without moving anything. On the phone the card sits
at the foot of the lobby in quiet colours, so the Start button stays the one orange thing.

## Recorded tracks: loops, loudness, credits

- **Loop points.** Each track loops between two beat-aligned points (`loop` in `tracks.ts`), found with
  beat tracking so intros, fade-outs and silent tails never play. Determination is exactly 40 bars, so it
  loops whole.
- **Loudness.** `gainDb` brings each file to about −16 LUFS (measured with ffmpeg's `ebur128`), level
  with the synth through the music bus, so switching games doesn't jump in volume.
- **Loading.** Tracks are fetched when needed, the next likely ones ahead of time, and at most three
  stay decoded in memory. The old music keeps playing until the new track can start; if a file can't
  load, its synth `fallback` plays instead. The server sends MP3s with a week's cache.
- **Credits.** The now-playing line beside the sound button names the track, author and licence.
  During the recap, a strip along the foot of the screen cycles through every credit (`creditSummary()`,
  three titles a line) and the host voices' credits, outside the play area so it stays full size.

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
