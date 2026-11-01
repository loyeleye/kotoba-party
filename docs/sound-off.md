# Sound off and Mic off

Each phone has two separate switches, in the lobby and in the header at any time (mid-game too):

- **🎤 Mic off** (quiet mode, "I can't talk right now"): the player taps and types. `PlayerState.mic === 'quiet'`,
  set by the `micCheck` command. See `controller/src/components/speak.ts`.
- **🔇 Sound off** ("I can't hear my phone right now"): the phone plays no sound, and anything it would have said
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

## Mic off roles

Most games already take taps and typing from a mic-off player (often for a smaller bonus). Three games are
built on speaking out loud, so mic-off players sit those roles out and play the rest:

| Game | Mic-off players | Code |
|---|---|---|
| Karaoke Duel | Never cast as a singer; they watch and vote. No "I sang it!" button | `pickDuel` |
| Happyōkai! | Don't present; they still assist, react, ask by tapping a question and grade | `presenterOrder` |
| Phrase Bingo | Stay in the audience, catching lines | `pickCast` |

Each falls back to casting everyone if fewer than two players have their mic on (someone switched theirs
off mid-game). Before a game starts, those three have `ModeInfo.minSpeakers: 2`: the VIP's menu and the
stage's game controls grey them out with "needs 2 mics on", Surprise Me! skips them, and the server refuses
the start with `not-enough-mics` (`noFit` in `shared/src/modes/registry.ts`).

Bots: `npm run bots -- --mode karaoke-duel --bots 4 --quiet 2 --sound-off 1` (the first n bots).
