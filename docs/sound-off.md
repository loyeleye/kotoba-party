# Sound off and Mic off

Each phone has two separate switches, in the lobby and in the header at any time (mid-game too):

- **🎤 Mic off** (quiet mode, "I can't talk right now"): the player taps and types. `PlayerState.mic === 'quiet'`,
  set by the `micCheck` command. See `controller/src/components/speak.ts`.
- **🔇 Sound off** ("I can't hear my phone"): the phone plays no sound, and anything it would have said
  shows as text in a way that still tests something. `PlayerState.soundOff`, set by the `setSound` command.

They combine freely. Sound off covers the **phone's own speaker** only: the TV keeps playing the music,
the hosts and the dubs for the room, and games where you listen to friends in the room (Narabete, Tourist,
Phrase Bingo's audience) don't change. The TV lobby shows ⌨️ (mic off) and 🔇 (sound off) by each name.

Games see both on `ModePlayer` (`mic`, `soundOff`), so they can deal different turns or roles.

## How Sound off works on the phone

`controller/src/components/voice.ts` holds the switch (`setSoundOff`, `isSoundOff`). With it on, `say()`
stays silent, `hearButton()` draws nothing and `canVoice()` reports no Japanese voice, so every
screen's existing "no voice on this phone" text path takes over. Where that text path would give the
answer away, the game swaps in a fair version:

| Game | With sound | Sound off |
|---|---|---|
| Kana Raid | Echo: four voices, pick its own | Dealt as a Look-alike (or Twin, or Shout) instead (`waveAttack`) |
| Kana Raid | Wave 3: hear one word of a minimal pair, tap which | The meaning is the clue (`Attack.clue`) and the two spellings the choices, with no meanings under them (`pairAttack`) |
| Shodō Taikai | Dictation voices each word | The reading is written (romaji for a kana, kana for a word): the no-voice path |
| Last Train | Station Announcement read aloud | The announcement crosses a departure board once, then is gone; one replay (`boardBox`). Calm motion: it stands still for the same time |
| Bento Haus | 🔊 replays the faded order | 👀 Peek shows the words for 2 s; the fade stays (`peekButton`) |
| Dub Club | Listen back to your take | Waveform and length only. A take that stayed on the phone still plays in the screening: that is the room's dub |
| Phrasebook | 🔊 on each phrase | Hidden |

Nothing is disabled for Sound off.
