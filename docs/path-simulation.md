# Express Line simulation (step 5)

How many game nights does an N4 player need to clear the Express Line (急行)? The N4/N3 plan guessed
12–16 nights. This step measures it instead: `npm run sim:express` (tools/sim/expressLine.ts).

**Short answer: with today's games nobody clears the line.** Four of the nine counted goals have no game
that lets an N4 player say their required frame from memory often enough, and a fifth (4.6) can't be
measured until the bots can retell a Word Gauntlet rumour. The four goals the games do
carry (4.1, 4.4, 4.5, 4.9) take a median of **27 weekly nights** together (quartiles 17–41), and 23% of
rooms don't get all four within 60 nights.

## How it works

Nothing in the measurement is hand-tuned: the games and the path are the shipped code.

1. **Bots play the real games in-process** (tools/sim/play.ts). Each mode on the Express Line runs 12 times
   with a room of 2 N4 and 2 N5 players, using the same bot policies as `npm run bots`. Three options make
   them play as a speaker would. Ghost Advice Hotline and Late Again! advisers send a checked clip of the
   host's version, where live bots type. N4 Bento Haus bots take the hard roles and say each line.
   Every bot says lines from memory where the game allows it.
2. **Each N4 seat's phrasebook goes through the real save path**: `addGame`, then `markPath`. So the frame
   rule (3 says from memory, 2 fillers, 2 days at least 3 days apart, one in a game), the goal stamps and
   the line clear are exactly what a player's profile does.
3. **500 rooms each play up to 60 nights.** Each night is 3 games. Each game is the path's own
   suggestion (`suggest`) with chance 0.6, otherwise any Express game. Games are drawn from the 12
   recorded runs per mode. A line the bot said from memory counts as memory with chance 0.7; the rest
   are logged as a retry, as a stumble or a peek at the hint would be.

Re-checks (21 and 60 days) don't affect a stamp, so phone reviews aren't simulated. Frames that need the
dictionary's part of speech (polite ＿んです, the causative) never count, as on the path today.

## Results (2026-11-01, 500 rooms, weekly nights)

| Goal | Rooms that stamp it | Nights (p25 / median / p75) | What limits it |
|---|---|---|---|
| 4.1 Ask favours | 100% | 3 / 3 / 5 | Bento Haus's deputy manager says ＿て もらえませんか every shift |
| 4.2 May, must, mustn't | 3% | 7 / 24 / 41 | **Tourist logs every line as read**, and it's the goal's only game. ＿ても いいですか comes up 0.1 times a game elsewhere |
| 4.3 Experiences and tries | 10% | 31 / 41 / 52 | ＿た ことが あります comes up 0.2 times a Hajimemashite game, and nowhere else |
| 4.4 Say what you can do | 84% | 3 / 6 / 25 | Phrase Bingo only (0.5 a game) |
| 4.5 If and when | 92% | 3 / 9 / 25 | Phrase Bingo and Happyōkai |
| 4.6 Guess, hearsay, opinion | 0% | – | The hearsay frame (required since #143) comes from Word Gauntlet's rumour relay, which counts a retelling from memory, **but the bots can't retell a rumour yet** (they repeat what they heard, which the game rightly logs as read). So this row is a gap in the simulation, not in the game. Phrase Bingo gives ＿そうです (hearsay) only 0.1 times a game |
| 4.8 Talk casually with friends | 0% | – | **No game gives an N4 player plain-form lines from memory**: Omiai's N4 lines are keigo, and Dub Club reads a script |
| 4.9 Speak politely to strangers | 98% | 11 / 16 / 26 | Bento Haus: ＿て いただけませんか and お＿ください |
| 4.10 Read N4 kanji | 0% | – | **Shodō gives an N4 player mostly N5 kanji**: about 0.4 N4 kanji a game, and the goal needs 30 on 2 days each |

4.7 (plans and advice) is under construction and isn't counted. Ghost Advice Hotline gives about 3
advice frames from memory a game, but nothing asks for plans yet.

### What changes the pace

| Setting | Four carried goals, median nights | Rooms that get all four in 60 nights |
|---|---|---|
| Base: memory 0.7, follow 0.6, weekly | 27 | 77% |
| Remembers less (memory 0.5) | 32 | 63% |
| Remembers more (memory 0.9) | 23 | 92% |
| Twice a week (every 3 days) | 24 | 85% |
| Follows the suggestion 90% of the time | 35 | 24% |

- **Twice a week barely changes the night count.** The 3-day gap is met either way; what's scarce is
  chances to say the frame. It halves the calendar time.
- **Following the suggestion closely is worse.** `suggest` offers the first open goal, so a room that
  follows it keeps getting sent to Tourist for 4.2, which can't move it. The suggestion should skip a goal
  whose games haven't moved it in recent nights, or rank goals by how much tonight's games can move them.

## What would let the line clear

Each of these except the bot change is a change to a game or the path, so they're logged as open
questions rather than made here:

1. **Tourist: count the tourist's own question from memory** when it isn't read off the card, as Last
   Train does for prompts that aren't read-alouds. This unblocks 4.2 and helps 4.4 and 4.5.
2. **Teach the Word Gauntlet bots to retell a rumour** in a new hearsay frame, then re-run. The game
   already counts that from memory. Until then the simulation can't say how fast 4.6 goes.
3. **A plain-form source for 4.8:** an N4 casual role in Omiai (the friend who drops the keigo), or casual
   lines in Late Again! or Ghost Advice Hotline.
4. **Shodō: deal N4 kanji to N4 players** (most of the sheet at their level), so 4.10 can be reached.
5. **More ＿た ことが あります:** a Happyōkai or Hajimemashite prompt that asks for it every round.
6. **Put Late Again! and Ghost Advice Hotline on the goals they already carry.** Late Again! is on no goal,
   and the Hotline gives ＿たら 3 times a game but is listed only on 4.7.

Re-run the simulation after each change. Once every goal is carried, the line's median replaces the guess
in the plan.

## Running it

```
npm run sim:express -- --rooms 500 --memory 0.7 --follow 0.6 --nights-every 7 --games 3 --json out.json
```

It takes about 4 minutes for 500 rooms. `tests/pathSim.test.ts` checks that every Express game reaches its
recap with bots and that a room run is repeatable.
