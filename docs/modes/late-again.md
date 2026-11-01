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
commentary booth calls it out only when the excuse used it.

Kana latecomers build the excuse from tiles: すみません！, the cause, and the cause's sound (ぐうぐう,
にゃー), and say it out loud to the room. Listeners practise too: N4 phones answer one listening check
while the clip plays, Kana and N5 phones tap the words they catch.

## A round

| Phase | Beat | Length | What happens |
|---|---|---|---|
| prompt | scene | 5 s | The departure board: who is late, how late (ごふん climbing to いちねん over the game), for what. Pon's opener. |
| prompt | plan | 8 s | The latecomer sees the witness's three causes and taps one; the witness picks blind; the gallery bets. Ready ends it. |
| answer | record | 6 s Kana, 9 s N5/N4 | One button: tap, talk, tap. The mic pass lets Pon say it, once a game. Silence: Pon stands in. |
| reveal | play | the clip | The TV shows only who is talking. Checks and word catch on the phones. |
| reveal | gist | 4 s (5 s on a miss) | The subtitle, the picture gist, the alibi card flip. The chief's phone gets the gist. |
| encore | vote | 6 s | Voters give a leaf (Safe) or keep it; the chief calls Safe or Out. Hidden until the ruling. |
| score | ruling | 5 s | The stamp, the leaves, Pon's reaction to this cause, points. |
| score | booth | 7 s | Only when the excuse used its chunk: the line with the chunk lit, a line of colour, the train-line tag. |
| score | truth | 2.5 s | "What really happened…": a cause nobody was dealt (or, 1 in 12, Pon himself). Every round ends on a laugh. |

Rounds: the smallest multiple of the player count that is 6 or more (everyone is late equally often), or
one lap with the "One turn each" setting. An 8-player game with every excuse at full length takes under
8.5 minutes (tested).

## Roles

- **Latecomer:** from the seat lap, whoever has been late least.
- **Witness:** the next seat. Sees the three causes, not the excuse. Once a game, the curveball: たぬき！
  The latecomer keeps the +50 alibi points when it lands, so it wrecks the story, not the friend's score.
- **Acting chief:** whoever has judged least, ties to Kana players, never twice in a row with 4+ players.
- **Gallery:** everyone else. Bets on the cause.
- **Two players:** co-op against Pon's record, Pon is the witness; the chief names the cause, then rules.

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
| Latecomer | 100 per leaf given; 50 when the alibi matched (or the curveball landed) |
| Witness | 50 when the alibi matched |
| Acting chief | 100 for a call that matches the room (50 on an exact split) |
| Gallery | 20 for the right bet |
| Listeners | N4: 30 for the check. Kana and N5: 10 per word caught, at most 30 (a wrong tap cancels a right one) |
| Co-op | 100 each for naming the cause, 50 more for Safe on it; 50 each for Pon's alibi matching |

Leaves: everyone starts with one, gets one more at the start of rounds 3, 5, 7 …, and holds two at most
(the "Votes are free" setting turns them off). Tiers follow the leaves: fewer than half is a flop; IPPON
needs every voter, and at least three of them. Every point is in the ledger, which adds up to the scores
(tested).

## Learning path

The latecomer's line goes in the phrasebook. It counts as said (from memory) when the clip used the
chunk (N4) or named the cause (Kana tiles count as read), and as read when the hint was opened.

## Open, for playtests

- The curveball has one tile (たぬき). The humor seat's ぶちょう and ちょうちんさん tiles need art.
- No word timestamps, so word catch has no timing rule.
- The 2-player Late Card (stamp card) is not built: co-op scores against Pon's record instead.
- Every Japanese line needs the JLPT seat's check (see the humor content file's section 11).
