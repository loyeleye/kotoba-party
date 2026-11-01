# Express Line simulation (step 5)

How many game nights does an N4 player need to clear the Express Line (急行)? The N4/N3 plan guessed
12–16 nights. This step measures it instead: `npm run sim:express` (tools/sim/expressLine.ts).

**Short answer: with today's games nobody clears the line**, with or without phone reviews. Four of the nine
counted goals (4.6, 4.8, 4.10 and, without reviews, 4.2) have no game that lets an N4 player say their
required frame from memory often enough. 4.6 can't be measured at all until the bots can retell a Word
Gauntlet rumour. The four goals the games do carry (4.1, 4.4, 4.5, 4.9) take a median of **31 weekly game
nights** together, about seven months, from games alone. One phone review sitting a week cuts that to
**19 nights**.

Those 31 nights are the pace for a few fixed lines, not for N4 as a whole. The JLPT seat counted 39 of the 61
N4 frames that no game gets an N4 player to say from memory. The tables below are from the nine-goal line;
step 6a added 4.11 to 4.14 (see "With 14 goals" below), and games barely carry them yet.

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
| One phone review sitting a week | 19 (12 / 28) | about 4½ months | 99% |
| Two sittings a week | 14 (8 / 21) | about 3 months | 99% |
| A sitting every day | 12 (7 / 20) | about 2¾ months | 100% |

- **The shipped suggestion is slower than picking games at random.** `suggest` offers the first open goal in
  list order, so a room keeps getting sent to Tourist for 4.2, which can't move it, and to Omiai, which is first
  in 4.9's games and gives no Express frame from memory. On the phone it says "Next stop: Tourist · 4.2" night
  after night, and because the suggestion becomes a ♡ wish, the whole room plays Tourist, Kana players too.
- **Phone reviews are the biggest lever.** One sitting a week cuts the four carried goals from 31 nights to 19, and
  lifts 4.2 from 3% of rooms to 57% and 4.3 from 6% to 73%: a phrase read in Tourist becomes a say from memory
  on the phone, and only the in-game day still needs a game. More sittings keep speeding up the four (14 nights
  at two a week, 12 daily) but stamp 4.2 in fewer rooms (46% and 41%), probably because the room finishes the
  four sooner and the suggestion then sends it to Tourist every game. None of it clears the line: 4.6, 4.8 and
  4.10 still need a game that gives those frames from memory. Recall here is a flat 0.7 for everyone, with no
  forgetting or learning, so these runs say how the rules respond, not how fast a person learns.
- **Twice a week gives exactly the same night counts.** The 3-day gap is met either way, and what's scarce is
  chances to say the frame. It cuts the calendar time to under half.
- **The longest dry spell is long.** In the base run, the median stamps come at nights 4, 5 and 9, then nothing for
  months: the game design seat measured a median of 17 nights with no new stamp in rooms that get all four.

### With 14 goals (step 6a, 300 rooms, same base settings)

| Goal | Rooms that stamp it | Nights (p25 / median / p75) | What limits it |
|---|---|---|---|
| 4.11 Reasons and too much | 0% | – | ＿ので comes up 0.1 times a Late Again! game; ＿すぎる comes from Late Again! only (1.0) |
| 4.12 Change and decisions | 0% | – | ＿ように なりました and ＿ことに しました: 0.1 a Happyōkai game each, nowhere else |
| 4.13 Passive, easy and hard | 9% | too few rooms | The passive: 0.3 a Late Again! game |
| 4.14 Quote, purpose, embedded questions | 0% | – | Purpose ＿ために／＿ように comes from no game; ＿と いって いました comes from Ghost Advice Hotline (0.4), now on 4.14 |

The four carried goals together now take a median of **33 nights (22 / 52)**, and 84% of rooms get all four,
against 31 (20 / 45) and 91% on the nine-goal line. The new goals don't help any room, but they slow the others:
the shipped suggestion takes open goals in list order, and 4.2 stays open in nearly every room, so it keeps
sending rooms to Tourist either way; the change probably comes from the extra games 4.11 to 4.14 bring into the random
draw (Late Again!, Narabete, Murder at the Onsen), most of which give nothing from memory. Fix 1 below (rank by
yield, skip goals no game carries) is meant to undo this, and the line went from 5 of 9 goals no game carries
to 8 of 13 (4.13 stamps in 9% of rooms).

## Step 5b: the suggestion ranked by what games yield (300 rooms, same base settings)

On the Express Line, `suggest` now ranks the open goals by **pace**: what tonight's games give each goal's
scarcest required frame not met yet, from a measured table (`npm run sim:yields -- --games 32` writes
shared/src/pathYields.ts: frames an N4, N5 or Kana seat says from memory per game, from 32 bot games per
room, leaving out anything under 0.05). The scarcest frame decides because a goal stamps only when every
required frame is met; summing let 4.11's plentiful ＿すぎます hide its rare ＿ので. Each frame takes its own best
game (4.6's three frames come from three games), and the room is sent to the game for the scarcest one.
Optional frames only break ties, and never make a goal suggestible on their own.

- **Slow stops take turns.** A stop under 0.15 says a game comes only after every faster one, and the slow ones
  rotate by day, so no slow stop holds a room. Frames that only a known bot gap says (Word Gauntlet's retold
  rumour) count as slow: guessed at 1 a game, 4.6 outranked every measured goal and held every room.
- **Kanji goals are scaled** to frame units: 30 kanji on 2 days each, against 3 says for a frame.
- **A goal no game on it carries** (4.8 and 4.14 today) is never suggested, and the map shows "Not stopping
  yet". It still counts toward clearing, and saying its frame anywhere, or in the phrase review, still moves it.
- **A faded frame's goal comes first** only at a game that gives the faded frame.
- **The Kana and Local Lines keep list order** (a new N5 player starts on 5.1 again). The Local yields say 7 of
  its 10 goals have no game an N5 player says from memory in: most N5 lines are logged as read, with the frame
  on screen. That needs its own simulation, and probably cues that fade from the full line to the English, before
  the phone acts on it. The Limited Express keeps list order too: N3 frames earn no credit until N3 opens.
- A test checks that every game giving a required Express frame (0.05 or more a game) is on that goal's list.
  It put Phrase Bingo on 4.2 and Late Again! on 4.4 and 4.5.

| Setting | Seven goals (4.1, 4.3, 4.4, 4.5, 4.9, 4.11, 4.13), median nights (p25 / p75) | Rooms that get all seven |
|---|---|---|
| Ignores the suggestion (follow 0) | – | 1% |
| Base: follows it 60% of the time | **40 (31 / 52)** | 85% |
| Follows it 90% of the time | **29 (22 / 36)** | 97% |
| Base, plus one phone review sitting a week | 49 (34 / >60) | 57% |

- **Following the suggestion is now the fastest way to meet the frame rule.** Before, it was slower than random.
  The four goals that were already carried stamp by nights 2 (4.1, 4.9), 5 (4.4) and 7 (4.5) at the median,
  against 8 to 21 nights when the room ignores it.
- **Three more goals come within reach:** 4.3 in every room (median 19 nights), 4.13 in 99% (27) and 4.11 in 86%
  (40). Ignoring the suggestion, they stamp in 18%, 36% and 8% of rooms. 4.2 now stamps in 16% (26% when
  followed closely) through Phrase Bingo.
- **A weekly review sitting** lifts 4.2 to 65% of rooms but slows the seven: missed re-checks fade frames, and a
  faded goal comes first. Recall here is a flat 0.7 with no forgetting or learning, so this measures how the
  rules respond, not how fast people learn, and it can't show any cost of blocked practice. The longest run of
  one goal is about 10 nights in the median room; interleaving evidence for L2 grammar is modest, so variety
  within a night is a should-fix, not a rule.
- `tests/pathSim.test.ts` checks that following the suggestion stamps at least as many goals, no later, than
  random picks over 12 short rooms (the old list-order suggestion fails it, 24 stamps against 42).
  `tests/path.test.ts` checks that slow stops rotate, that every carried Express goal has a pace, and the list
  rule above.

Still not cleared in any room: 4.6 (bot gap), 4.8, 4.10, 4.12 and 4.14 need games or bots (fixes 3 to 8
below). The next most useful game fixes, by the game design seat: more ＿ので excuses in Late Again! (2 of its
16 N4 excuses), and a "what changed / what I decided" card in Happyōkai for 4.12.

## Step 5b-2: games that give the slow goals more (300 rooms, same base settings)

Game and bot fixes for the goals the step 5b suggestion couldn't move, then the panel's fixes, `sim:yields` and
these runs again.

- **Credit only what was heard (panel on #160).** Where a game logs a model sentence for a line the player made up
  (Late Again!'s Pon line, Dub Club's ad-lib, Happyōkai's deck sentence), the card counts only for the model's
  frames that were also heard in what they said (`framesHeard`; the phrasebook card carries `frames`), and a card
  with a different set is its own card. Before the panel, a card counted for every frame in the model.
- **Late Again!:** three more N4 excuses give a reason with ので (the crow, the kappa, the fox), so 6 of 16 do.
  ＿ので from Late Again! went from 0.2 to 0.6 a game. The passive matcher also missed a doer's に right before a
  quote (ぶちょうに「やすみだよ」と いわれた), so the passive went from 0.3 to 0.5.
- **Happyōkai:** a Then and now (or If I were…) presenter's own sentence in one of the deck's frames, on a slide or
  as the answer in question time, logs the closest ready sentence as said from memory, for the frames heard, one
  card per line. A line 75% the same as a ready sentence on the slide was read off it and earns nothing. Before
  this, nothing the presenter made up was logged. ＿ことに しました went from 0.06 to 0.4 a game and ＿ように なりました
  from 0.09 to 0.4, so 4.12 now stamps. ＿と おもいます fell to 0: the If I were… bot fills the frame with the slide's
  word, which is near enough the ready sentence to count as read.
- **Tourist:** three ＿ても いいですか questions any place can answer, with answers that fit, dealt first.
  ＿ても いいですか from Tourist went from 0.14 to 0.2 a game.
- **Dub Club:** the N4 ad-lib is logged as said from memory, and the casual matcher now catches lines ending in
  ちゃった, じゃん, でしょ (not でしょう), 〜んだ after a plain verb (not のんだ "drank"), だろ(う) and なの. The casual frame
  went from 0 to 1 a game. Its そう (looks) fell to 0 once only heard frames count, so Dub Club left goal 4.6.
- **Bots:** a sentence read out is sent in kana (the server adds the reading in a real room; without it,
  Happyōkai counted bots' read lines as their own). `BOT_GAPS` is empty. Two games joined goal lists because they
  now measurably give a required frame: Word Gauntlet on 4.13 (かこまれて).
- **A trap found and fixed:** the deck's card was first one per frame, so a room could never get the two different
  phrases a frame needs. Yields count says, not different phrases, so the ranking can't see this.

**These are the optimistic case.** The bots do what each game cues, at these rates: Dub Club bots take the ad-lib
60% of the time and say a casual line of their own; Happyōkai presenters say a line of their own in the deck's
frame on a picture slide, and answer in a deck frame two times in three; Tourist bots ask a question remembered
from an earlier turn 35% of the time; Word Gauntlet's N4 bots retell in a new reporting frame and keep every
detail; Late Again! bots say Pon's whole line, so ので from Late Again! is the most optimistic. The learning science
seat halved four of these in a scratch copy (before the panel's fixes, 50 rooms): 4.2 fell from 74% of rooms to
2%, 4.6 from 100% to 54%, 4.13 from 100% to 64%, and the ten goals together from 74% to 42%. Real rates come
from playtests.

| Setting | Seven goals, median nights (p25 / p75) | Rooms that get all seven | Before (step 5b) |
|---|---|---|---|
| Ignores the suggestion (follow 0) | – | 10% | 1% |
| Base: follows it 60% of the time | **33 (28 / 39)** | 99% | 40 nights, 85% |
| Follows it 90% of the time | **24 (20 / 28)** | 100% | 29 nights, 97% |
| Base, plus one phone review sitting a week | 34 (29 / 39) | 99% | 49 nights, 57% |

Ten goals now stamp in most rooms (4.1, 4.2, 4.3, 4.4, 4.5, 4.8, 4.9, 4.11, 4.12, 4.13): all ten in 95% of rooms
by a median of 40 nights. At the base setting 4.2 stamps in 95% of rooms (was 16%), 4.8 in 100% (was 0%, by
night 4), 4.11 by night 14 (was 40), 4.12 by night 21 (was never). Still in no room: 4.6 (no game has players say
＿と おもいます from memory), 4.7 (no game asks for plans), 4.10 (N4 kanji in Shodō) and 4.14 (purpose
＿ために／＿ように).

## What would let the line clear

Each of these is a change to a game or the path, so they're logged as open questions and come in their own PR
(step 5b), in the order the panel gave. Re-run the simulation after each.

1. **Fix the suggestion** (done in step 5b, above). Rank goals by how much tonight's games can move them, using the per-game yields
   above (a table `sim:express --json` can regenerate and CI can check), and order each goal's games by yield.
   Keep a "this goal hasn't moved in recent nights" check only as a guard: on its own it made things worse
   (the UX seat measured 42 nights at follow 0.9). Add a test that following the suggestion isn't slower than
   ignoring it.
2. **Show the stops no game carries yet** (done in step 5b for the Express Line; they still count toward clearing
   the line, so "cleared" keeps meaning every stop was met) as their own state on the phone: never
   suggested, with one line saying why.
3. **Put Late Again! and Ghost Advice Hotline on the goals they carry** (Late Again! on 4.2, 4.3, 4.11, 4.13;
   the Hotline on 4.5 only for real conditionals such as ゆうれいが 来たら、にげた ほうが いいですよ).
4. **Shodō: deal N4 kanji to N4 players**, and grow the N4 pool (it lacks 思 持 待 使 乗 着 終 写 会 教, which the
   game's own lines use), so 4.10 can be reached.
5. **Tourist: count the asker's own question from memory** (the ＿ても いいですか questions are in, step 5b-2; the rule isn't) when it isn't read off a tile showing the Japanese:
   cue it with the English intent and a frame chip, with the Japanese behind a peek, as Last Train does. Count a
   tile with one word changed as the asker's own words. Give 4.2 one ＿ても いいですか question per place.
6. **More ＿た ことが あります:** a "Have you ever…?" question card in Happyōkai, one prompt a game cued by
   meaning (more than two a night add nothing under the 2-says-a-day cap), with the topics rotating.
7. **Teach the Word Gauntlet bots to retell a rumour** (done in step 5b-2), then re-run. Until then the simulation can't say how
   fast 4.6 goes.
8. **A game where players say ＿と おもいます from memory** (4.6, step 5b-2): Happyōkai's If I were… frame filled with the
   slide's word is read, and the opening's 〜と おもいます is read off the card. The If I were… answer frames already
   offer 〜と おもいます in question time, but the bots only answered Then and now talks in a deck frame. They now
   answer If I were… talks the same way (a third each in 〜たい and 〜と おもいます): ＿と おもいます from Happyōkai went
   from 0 to 0.2 a game, and 4.6 stamps in 70% of rooms by a median of 51 nights (all eleven goals together in 69%,
   by 53). An opinion card in every N4 talk's question time (「〔word〕は どう おもいますか」) would give it more.
8. **A plain-form source for 4.8** (done in step 5b-2, with the bots taking the ad-lib and logged as the model line): count Dub Club's ad-lib from memory with what the player said, and let the
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
recap with bots, that a room run is repeatable, that review sittings count toward a stamp, and that following the
suggestion is no slower than ignoring it. After a change to a game, run `npm run sim:yields` and commit the new
shared/src/pathYields.ts.
