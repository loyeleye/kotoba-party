# Express Line simulation (step 5)

How many game nights does an N4 player need to clear the Express Line (急行)? The N4/N3 plan guessed
12–16 nights. This step measures it instead: `npm run sim:express` (tools/sim/expressLine.ts).

**Short answer: with today's games nobody clears the line**, with or without phone reviews. Four of the nine
counted goals (4.6, 4.8, 4.10 and, without reviews, 4.2) have no game that lets an N4 player say their
required frame from memory often enough. 4.6 can't be measured at all until the bots can retell a Word
Gauntlet rumour. The four goals the games do carry (4.1, 4.4, 4.5, 4.9) take a median of **31 weekly game
nights** together, about seven months, from games alone. One phone review sitting a week cuts that to
**@REV1M nights**.

Those 31 nights are the pace for a few fixed lines, not for N4 as a whole. The JLPT seat counted 39 of the 61
N4 frames that no game gets an N4 player to say from memory. Goals 4.11 to 4.14 weren't on the line when this
ran, so a cleared line wouldn't mean the N4 grammar was covered either.

## How it works

The rules and games are the shipped code. The room, the players' habits and the bots' odds are assumptions,
and each is a flag.

1. **Bots play the real games in-process** (tools/sim/play.ts). Each Express game runs 12 times with a room of
   2 N4 and 2 N5 players, using the same bot policies as `npm run bots`. That covers every game on an Express
   goal, 4.7's Ghost Advice Hotline too, plus Late Again!, which the plan puts on 4.2, 4.3, 4.11 and 4.13 but
   the path doesn't list yet. Three options make the bots play as a speaker would:
   - Ghost Advice Hotline and Late Again! advisers send a checked clip of the host's version, where live bots
     type.
   - N4 Bento Haus bots take the hard roles and say each line.
   - Every bot says lines from memory where the game allows it.
2. **Each N4 seat's phrasebook goes through the real save path**: `addGame`, then `markPath`. So the frame
   rule (3 says from memory, 2 fillers, 2 days at least 3 days apart, one in a game), the goal stamps and the
   line clear are exactly what a player's profile does.
3. **500 rooms each play up to 60 nights.** Each night is 3 games. Each game is the path's own suggestion
   (`suggest`) with chance 0.6, otherwise any Express game at random. Games are drawn from the 12 recorded runs
   per game. A line the bot said from memory counts as memory with chance 0.7; the rest are logged as a retry,
   as a stumble or a peek at the hint would be.
4. **Phone reviews are optional** (`--reviews N`: sittings between one night and the next). A sitting
   reviews the due phrases, up to 12, and the player knows each with the same 0.7 chance. A known review is a
   say from memory, as on the phone, so it counts toward a frame's says, fillers and spacing. Only the
   "one day in a game" part of the rule needs a game.

Every pace below is over all 500 rooms. A room that never stamps a goal counts as never, so a quartile it
decides reads ">60". Goals fewer than 1 room in 10 stamps get no pace at all.

## Results (2026-11-01, 500 rooms, weekly nights, games only)

| Goal | Rooms that stamp it | Nights (p25 / median / p75) | What limits it |
|---|---|---|---|
| 4.1 Ask favours | 100% | 3 / 4 / 5 | Bento Haus's deputy manager says ＿て もらえませんか every shift |
| 4.2 May, must, mustn't | 3% | too few rooms | **Tourist logs every line as read**, and it's the goal's only game. A tile with one word changed is logged as close, not as the asker's own words. ＿ても いいですか comes up 0.1 times a game elsewhere |
| 4.3 Experiences and tries | 6% | too few rooms | ＿た ことが あります comes up 0.2 times a Hajimemashite game, and nowhere else |
| 4.4 Say what you can do | 93% | 3 / 9 / 30 | Phrase Bingo (0.5 a game) and Late Again! (0.3). The potential matcher also misses common forms (行けます, 使えます, 買えます), so the real count is likely higher |
| 4.5 If and when | 100% | 3 / 5 / 11 | Ghost Advice Hotline (2.6 a game), Phrase Bingo and Happyōkai. Half of that is ＿たら どうですか, which is advice, not a condition |
| 4.6 Guess, hearsay, opinion | 0% | – | The hearsay frame (required since #143) comes from Word Gauntlet's rumour relay, which counts a retelling from memory, **but the bots can't retell a rumour yet** (they repeat what they heard, which the game rightly logs as read). So this row is a gap in the simulation, not in the game. Phrase Bingo gives ＿そうです (hearsay) only 0.1 times a game |
| 4.8 Talk casually with friends | 0% | – | **No game logs an N4 player's plain-form line from memory.** Dub Club has a no-script casual ad-lib built for 4.8, but it logs every take as read and saves the model line, not what the player said. Omiai's N4 lines are keigo |
| 4.9 Speak politely to strangers | 97% | 12 / 20 / 34 | One Bento Haus role, 3 of whose 4 いただけますか lines are すこし まって いただけますか |
| 4.10 Read N4 kanji | 0% | – | **Only Shodō gives N4 kanji**, about 0.4 a game, from a pool of 45; the goal needs 30 on 2 days each. Read the Signs has no N4 kanji on any target sign |

4.7 (plans and advice) is under construction and isn't counted. The Hotline gives about 6 advice frames from
memory a game, but nothing asks for plans yet.

**Frames an N4 seat says from memory, per game** (before the 0.7 memory chance): Bento Haus 13.0, Ghost Advice
Hotline 6.0, Phrase Bingo 2.8, Happyōkai 1.5, Hajimemashite 0.9, Late Again! 0.9. Last Train, Tourist, Oogiri,
Word Gauntlet, Omiai, Dub Club and Shodō give 0. For Word Gauntlet that's the bots (no retelling); for Last
Train, Narabete and Murder at the Onsen it may be bots not taking those hard roles; for Tourist, Dub Club and
Omiai it's the game. Happyōkai logs every question asked as memory although the asker picks it from three
cards on screen, where Tourist logs the same act as read, so Happyōkai's share is probably overcounted.

### What changes the pace

The four carried goals (4.1, 4.4, 4.5, 4.9), timed together:

| Setting | Median nights (p25 / p75) | Calendar time | Rooms that get all four in 60 nights |
|---|---|---|---|
| Base: memory 0.7, follow 0.6, weekly, games only | 31 (20 / 45) | about 7 months | 91% |
| Ignores the suggestion (follow 0) | **19 (14 / 25)** | about 4½ months | 100% |
| Follows it 90% of the time | over 60 | – | under 40% (4.9 in 40%) |
| Remembers less (memory 0.5) | 38 (26 / 57) | about 9 months | 77% |
| Remembers more (memory 0.9) | 25 (17 / 37) | about 6 months | 95% |
| Twice a week (every 3 days) | 31 (20 / 45) | about 3 months | 91% |
| One phone review sitting a week | @REV1 | @REV1C | @REV1S |
| Two sittings a week | @REV2 | @REV2C | @REV2S |
| A sitting every day | @REV7 | @REV7C | @REV7S |

- **The shipped suggestion is slower than picking games at random.** `suggest` offers the first open goal in
  list order, so a room keeps getting sent to Tourist for 4.2, which can't move it, and to Omiai, which is first
  in 4.9's games and gives no Express frame from memory. On the phone it says "Next stop: Tourist · 4.2" night
  after night, and because the suggestion becomes a ♡ wish, the whole room plays Tourist, Kana players too.
- **Phone reviews are the biggest lever.** @REVNOTE
- **Twice a week gives exactly the same night counts.** The 3-day gap is met either way, and what's scarce is
  chances to say the frame. It cuts the calendar time to under half.
- **The longest dry spell is long.** In the base run, the median stamps come at nights 4, 5 and 9, then nothing for
  months: the game design seat measured a median of 17 nights with no new stamp in rooms that get all four.

## What would let the line clear

Each of these is a change to a game or the path, so they're logged as open questions and come in their own PR
(step 5b), in the order the panel gave. Re-run the simulation after each.

1. **Fix the suggestion.** Rank goals by how much tonight's games can move them, using the per-game yields
   above (a table `sim:express --json` can regenerate and CI can check), and order each goal's games by yield.
   Keep a "this goal hasn't moved in recent nights" check only as a guard: on its own it made things worse
   (the UX seat measured 42 nights at follow 0.9). Add a test that following the suggestion isn't slower than
   ignoring it.
2. **Show the stops no game carries yet** as their own state on the phone: left out of the count, never
   suggested, with one line saying why.
3. **Put Late Again! and Ghost Advice Hotline on the goals they carry** (Late Again! on 4.2, 4.3, 4.11, 4.13;
   the Hotline on 4.5 only for real conditionals such as ゆうれいが 来たら、にげた ほうが いいですよ).
4. **Shodō: deal N4 kanji to N4 players**, and grow the N4 pool (it lacks 思 持 待 使 乗 着 終 写 会 教, which the
   game's own lines use), so 4.10 can be reached.
5. **Tourist: count the asker's own question from memory** when it isn't read off a tile showing the Japanese:
   cue it with the English intent and a frame chip, with the Japanese behind a peek, as Last Train does. Count a
   tile with one word changed as the asker's own words. Give 4.2 one ＿ても いいですか question per place.
6. **More ＿た ことが あります:** a "Have you ever…?" question card in Happyōkai, one prompt a game cued by
   meaning (more than two a night add nothing under the 2-says-a-day cap), with the topics rotating.
7. **Teach the Word Gauntlet bots to retell a rumour**, then re-run. Until then the simulation can't say how
   fast 4.6 goes.
8. **A plain-form source for 4.8:** count Dub Club's ad-lib from memory with what the player said, and let the
   bots take it. Widen the plain-form matcher first (it misses もう たべた？ and いかない？ and accepts おいしいだよ),
   or new lines will all be written with よ to get counted. An Omiai casual beat works only if the guest invites
   it (「もう けいごは なしで いいよ」) and the manners meter is off for that round.

Once every goal is carried, the line's median replaces the guess in the plan.

## Running it

```
npm run sim:express -- --rooms 500 --memory 0.7 --follow 0.6 --nights-every 7 --games 3 --reviews 0 --json out.json
npm run sim:express -- --rooms 500 --reviews 1 --goals 4.1,4.4,4.5,4.9
```

It takes about 10 minutes for 500 rooms. `tests/pathSim.test.ts` checks that every Express game reaches its
recap with bots, that a room run is repeatable, and that review sittings count toward a stamp.
