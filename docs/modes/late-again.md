# Late Again! (また ちこく！), pilot

Host: Pon. Kana–N4 (N3 joins at step 6 of the learning path). 2–8 players. Pon's office of hopeless
latecomers: each round one player is late (again), phones the boss and blames one of three causes. A
witness backs the story up without hearing it, the room spends Pon's leaves on "Safe", and the acting
chief (ぶちょうだいり: the boss is late too) calls セーフ！ or アウト！ by reading the room.

Code: `shared/src/modes/lateAgain/` (rules and views in `lateAgain.ts`; causes, scenes, Pon's reactions
and the real story in `causes.ts`), `stage/src/modes/lateAgain.{ts,css}`,
`controller/src/modes/lateAgain.{ts,css}`, `tools/bots/policies/lateAgain.ts`, `tests/lateAgain.test.ts`,
pictures in `stage/assets/late/` (PixelLab, see [commercial-blockers.md](../commercial-blockers.md) row 6).
Design: the storyboards and the six-seat reviews in the project's `learning-path/storyboards/`, with the
humor seat's content pass (`reviews/humor-late-again-content.md`). Every line is `draft` until a fluent
check.

## Why it works for speaking

An apology plus a reason is the most useful thing a learner can say to a boss, and lying about it with the
room watching is funny. Each level gets the same mission card in English ("Apologise, then blame the
train. Say where you woke up."), which never names the grammar; it asks for the punchline. Pon's version
is behind "Need a hint?" (N5 first sees a fill-in frame, then Pon's line). The N4 lines each carry one
Express Line chunk (〜て しまいました, 〜すぎて, 〜ので, the passive, 〜なければ なりませんでした), and the
commentary booth calls it out only when the excuse used it. On half the N4 rounds, a cause with an "ask"
version (`N4_ASKS`) pushes its luck instead: a cheeky request (こたつと いっしょに 行っても いいですか？) or a
question for the boss (部長の 時計も 寝坊した ことが ありますか？), so 〜ても いいですか and 〜た ことが あります
come up too. An ask line is the apology plus the ask, and names the cause so the listening check still works
(26–38 mora against about 30 for the usual N4 lines); an ask round records for 3 s longer.

The trade-off: an ask round replaces the cause's usual N4 line, so on those rounds its chunk (〜すぎて, 〜ので,
〜て しまいました, the passive, 〜なければ なりませんでした) mostly doesn't come up. About a third of N4 rounds are
ask rounds (half the rounds, for the 11 of 16 causes that have one), which costs 4.11 and 4.13 some of the
little they get here. Four ask lines keep a chunk where it fits (cat ので, Nobiko-san すぎて, train しまいました,
kappa the passive), but only the ask is listened for. Worth re-checking with `sim:yields` before adding more.

Kana latecomers build the excuse from tiles: すみません！, the cause, and the cause's sound (ぐうぐう,
にゃー), and say it out loud to the room. Listeners practise too: N4 phones answer one listening check
while the clip plays, Kana and N5 phones tap the words they catch.

## A round

| Phase | Beat | Length | What happens |
|---|---|---|---|
| prompt | scene | 5 s | The departure board: who is late, how late (ごふん climbing to いちねん over the game), for what. Pon's opener. The latecomer may already pick. |
| prompt | plan | 8 s | The latecomer taps one of the witness's three causes (each phone has its own order); the witness picks blind; the gallery bets. Ready ends it once the witness is in. Everything locks here, before the room hears a word. |
| answer | record | 6 s Kana, 9 s N5, 12 s N4 (15 s on an ask round), then 3.5 s to upload | One button: tap, talk, tap. Typing works from the plan beat (quiet mode, no mic). The mic pass lets Pon say it, once a game. Silence: Pon stands in. |
| reveal | play | the clip | The TV shows only who is talking. Checks and word catch on the phones. |
| reveal | gist | 4 s (5 s on a miss) | The subtitle, the picture gist, the alibi card (face down, flipping at 1.3 s as Pon reacts). The chief's phone gets the gist. |
| encore | vote | 6 s | Voters holding a leaf give it (Safe) or keep it; the chief calls Safe or Out. The TV shows how many can say Safe, never how anyone voted. |
| score | ruling | 5 s | The stamp, the leaves (Safe turns them into Pon's late pass, Out puffs them back), "Overruled by the room" when the chief misread it, Pon's reaction to this cause, points. |
| score | booth | 7 s | Only when the latecomer's own excuse used its chunk: 「でました！」, the line with the chunk lit, Pon's version in English, a line of colour, the train-line tag. |
| score | truth | 4 s | "What really happened…", a pause, then a cause nobody was dealt and nobody has used this game (Pon himself, 1 in 12 or after a tanuki curveball; "the boss was Pon" in the last round). Every round ends on a laugh. |

Rounds: the smallest multiple of the player count that is 6 or more (everyone is late equally often), or
one lap with the "One turn each" setting. With every excuse at full length and the booth open every N4
round, an 8-player game takes under 9 minutes and the longest (5 players, two laps) under 11 (tested).

## Roles

- **Latecomer:** from the seat lap, whoever has been late least.
- **Witness:** the next seat. Sees the three causes, not the excuse. Once a game, the curveball: たぬき！
  The latecomer keeps the +50 alibi points when it lands, so it wrecks the story, not the friend's score.
- **Acting chief:** whoever has judged least, ties to Kana players, never twice in a row with 4+ players.
- **Gallery:** everyone else. Bets on the cause.
- **Two players:** co-op against Pon's record (both scores together), Pon is the witness and backs a cause
  at random. The cause stays hidden until the chief names it; there is no Safe or Out.

## The deck

A deal is one believable cause, one self-own and one yōkai, with at most one sleep joke. Sixteen causes;
two (デート, おこづかい) are Cheeky only, and two scenes (お見合い, 自分の 結婚式, the finale) are Family
and Cheeky only. Each cause has a picture, a Kana tile and sound, keys for spotting it in what was heard, a
gist, N5 and N4 lines, a listening check, and Pon's three reactions (flop "I've used that one", good
"taking notes", IPPON "I'm using it tomorrow"). A cause blamed twice in a game gets a callback instead.

Never: 人身事故, disasters, death, overwork, harassment, drinking, illness, family emergencies, body jokes, a
controlling partner. The train is never stopped or delayed: the passenger is the problem.

## Scoring

| Who | Points |
|---|---|
| Latecomer | 100 per leaf given (50 on a mic pass, none when Pon stood in: he keeps them); 50 when the alibi matched (or the curveball landed); 50 when speech-to-text heard the excuse name its cause or use its chunk |
| Witness | 50 when the alibi matched; 100 when the tanuki curveball didn't stop the room saying Safe |
| Acting chief | 100 for a call that matches the room (50 on an exact split) |
| Voters | 20 each for a leaf given when the room ruled Safe |
| Gallery | 20 for the right bet |
| Listeners | N4: 30 for the check. Kana and N5: 10 per word caught, at most 30 (a wrong tap cancels a right one) |
| Co-op | 100 each for naming the cause; 50 each for Pon's alibi matching. Pon's record is 110 a round per player |

Leaves: everyone starts with two, gets one more at the start of rounds 3, 5, 7 …, and holds two at most
(the "Votes are free" setting turns them off). The room is the voters holding a leaf when the vote opens; a
voter with none counts as voted. Tiers follow the leaves: fewer than half is a flop; IPPON is every holder
giving, with at least three of them or the chief backing them with Safe. In co-op, naming the cause is good,
and with Pon's alibi matching too, IPPON. Every point is in the ledger, which adds up to the scores
(tested).

## Learning path

The latecomer's line goes in the phrasebook. It counts as said when it was their own clip and
speech-to-text heard it name the cause or use the chunk (or there was no speech-to-text to tell); tiles,
typing and Pon's reading are seen. It is from memory unless the hint was opened or Pon read it. When
speech-to-text heard a different one of the three causes than the one tapped, the excuse blamed that one.
An ask round logs the ask line (its own item, `late:<cause>:<level>:ask`) as said only when a checked clip
was heard asking (its chunk, so ＿ても いいですか or ＿た ことが あります is really credited). Otherwise the ask isn't
credited: with the hint open or Pon reading, the ask is logged as read; else the excuse counts as the cause's
usual N4 line, as on any other round, since naming the cause alone says nothing about the ask.
The private note at the ruling shows "From memory ✓" or "With a hint", and what they said beside Pon's way.
Pon's line is the card, but when speech-to-text heard the clip, the card counts only for Pon's frames that were
heard in it (`late:<cause>:<level>:<frames>`, its own card): naming the crow doesn't earn Pon's ので (panel on
#160).

## Green Car

When every player is N4 or N3 the room may ride in the Green Car (`ctx.greenCar`, `shared/src/greenCar.ts`;
design: the project's `n3-coverage/green-car/design.md`). Nothing moved out of mixed rooms for this game: N4 and
N3 excuses already only change the latecomer's own phone. In the Green Car:

- **N4 and N3 lines only.** An N3 latecomer takes an N3 line and an N4 line in turn (N3 first; `LateRound.lineLevel`),
  so about half each; an N3 line is never an ask round. An N4 latecomer works from the N4 line, and the hint also
  shows the cause's N3 line with an N3 tag as optional stretch: when their own clip uses its chunk, the N3 line is
  logged (`late:<cause>:n3`) and the booth calls it out.
- **Eight causes a game** (`greenCarDeck`): three believable, three self-owns and two yōkai, drawn from the room's
  audience, with up to two of the audience's own causes first. Every deal comes from them, so a cause and its frame
  come round again; only the last round's options are kept back.
- **Aim the deal.** In each bucket the deal keeps the causes whose line (at the level this latecomer is dealt)
  has the frames they need most (`shared/src/modes/aim.ts` `aimWeight`: the room's `ctx.frameNeed`, where a frame a path goal requires weighs 2 and an optional one 1, each divided by one plus tonight's earlier says, then divided by one plus this game's says), then draws at random among those; the cause dealt to them
  (they may tap another) is the neediest of the three. This game's counts are `LateState.said` (from what
  speech-to-text heard, else the line's own frames).
- **The witness backs the story up** out loud at the gist and the vote, as hearsay about the cause they backed: N4
  each cause in its own words (`BACKUPS` in causes.ts): 「ねこが どいて くれなかった そうです。」, N3 「でんしゃで ねすごした
  らしいです。」, the curveball 「たぬきの しわざだった らしいです。」 (the same 50/50 turn as the latecomer's lines; an N4 witness sees the
  らしい version as stretch). The line is behind a hint. A checked take counts only when it passes it on as hearsay;
  without speech-to-text a try counts. It's logged as `late:backup:<level>:<cause>`, path credit only, no points.
- **Kids and Cheeky.** New Green Car causes, N4 and N3 lines only, never dealt in a mixed room, art still to come
  (the screens show the emoji): Kids and Family get late-for-school causes (the dog ate the homework, a little brother
  hid my shoes, a flat tyre) and a Kids school scene (学校の 朝の 会); Cheeky gets the drinking party and the dull
  date (its two Cheeky causes already had N3 excuses). The new Kids/Family N3 lines carry ＿わけでは ない, ＿うえに and
  ＿しか ない, which were Cheeky only, so every frame can come up in every audience (tested). The design's ＿せいで and
  ＿させられた for Kids come from the all-ages causes (the alarm clock, the old lady, the kappa).

## Open, for playtests

- The curveball has one tile (たぬき). The humor seat's ぶちょう and ちょうちんさん tiles need art.
- No word timestamps, so word catch has no timing rule.
- The 2-player Late Card (stamp card) is not built: co-op scores against Pon's record instead.
- Every Japanese line needs the JLPT seat's check (see the humor content file's section 11).
