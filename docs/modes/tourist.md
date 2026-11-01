# Who's the Tourist? (かんこうきゃくは だれ？), backlog

Host: Chōchin-san. 3–8 players. Kana–N4. Spyfall-style social deduction in simple Japanese:
everyone but one player knows the secret place; the tourist doesn't. Players question each other
out loud to find the tourist, while the tourist listens for clues and tries to guess the place.
The design doc's one line: "Spyfall-style social deduction in simple Japanese."

Code: `shared/src/modes/tourist/` (rules and views in `tourist.ts`, the forgiving checks in
`check.ts`, draft places and question/answer frames in `places.ts`), `stage/src/modes/tourist.{ts,css}`,
`controller/src/modes/tourist.{ts,css}`, `tools/bots/policies/tourist.ts`, `tests/tourist.test.ts`.

## Why it works for speaking

Every turn is a real spoken exchange: one player asks a question, another answers it, both out
loud, in front of the room. Questions are the core N5 interrogatives (なに / いつ / だれ / どこ /
すき / 〜ますか); answers are short です/ます sentences about a place. Locals must produce answers
that fit the place (retrieval in context); the tourist must listen hard (comprehension) and bluff
with safe phrases. The whole room reads the log with English subtitles, so a beginner who missed
a question still follows the game.

## How a game goes

Three rounds by default (the VIP can pick 3, 4 or 5). Each round has a new place and a new tourist.

1. **Your card** (`prompt`, 20 s, 28 s with a Kana-level player; ends when everyone taps *Got it*).
   - **Locals** see the place (📍 温泉 *hot spring*) and a role there (おさるさん *a snow monkey*,
     りょかんの ひと *the innkeeper* …), and are told never to say the place's name.
   - **The tourist** sees "🧳 You're the tourist!", the list of the round's 6 possible places, and a
     cheat sheet of safe phrases.
   - The stage shows the 6 possible places only. Nothing on the stage or another phone says who the
     tourist is or where we are.
2. **Questions** (`answer`, one phase per turn, 45 s, 60 s for a Kana-level asker). A turn:
   - The **asker** taps who to ask (anyone but the player who just asked them: no asking straight
     back), then **asks out loud and into the phone** (hold-to-talk; typed or kana-pad fallback).
     Or they take a **question tile** (5 suggestions at their level), say it, or send it as a tap.
   - The **answerer** sees the question, answers out loud and into the phone, or takes one of 4
     **answer tiles** that fit the question's kind (a いつ question gets "when" answers).
   - The **stage** shows "🎤 Aki → Ben", the question and the answer as they arrive, each with an
     English subtitle, and the log of earlier questions.
   - The answerer asks next. A turn nobody uses is skipped to the next seat.
   - **Any time**: anyone may **call a vote** (once per round, confirmed on the phone), and the
     tourist may tap **"I know where we are!"** and guess (one guess).
   - After 6–10 turns (players + 3) or 6 minutes, the round goes to a **final vote**.
3. **Vote!** (`reveal`, 25 s; ends when all have voted). Everyone votes secretly on their phone
   for who the tourist is (the tourist votes too, to blend in). A **called** vote needs a majority
   of the voters; without one, "No majority!" and the questions continue. The **final** vote takes
   the most votes; a tie lets the tourist go.
4. **Last chance** (`encore`, 20 s, only when the tourist was voted out). The stage reveals who the
   tourist was (not the place). The tourist picks the place and is invited to say
   "ここは ＿＿ ですか？" out loud.
5. **Who was it?** (`score`, 14 s). The place ("ここは 温泉 でした！"), the tourist, the vote tally,
   the guesses, and the round's points.

The last round is worth double. Then the shared recap: standings, awards, phrasebook ("Your
questions and answers").

### Scoring

| What | Points | Who |
| --- | --- | --- |
| Locals catch the tourist (vote) | 100 | each local |
| ...and you called that vote | +100 | the caller |
| Voted for the tourist in the deciding vote ("sharp eyes") | +100 | each such local, even if the room got it wrong |
| The tourist guesses wrong | 100 | each local |
| The tourist survives (final vote misses, ties, or a local is voted out) | 300 | tourist |
| The tourist guesses the place mid-round | 400 | tourist |
| Caught, but the last-chance guess is right | 150 | tourist |
| Asking, bonus pool | own words: 40 spoken / 20 typed; a tile said: 20 / 10; a tap: 0 | asker |
| Answering, bonus pool | own words: 30 / 15; a tile said: 15 / 5; a tap: 0 | answerer |
| Saying the guess (ここは えき ですか), bonus pool | 20 spoken / 10 typed | tourist |

- **Bonus pool**: every speaking bonus comes from one pool per player per round, capped at 30% of
  a local's top round (300 → 90 points). Players below the average score get bonuses ×1.5
  (comeback), never past the cap. Last round ×2, cap included.
- **Mistakes never cost points**: nothing is ever taken away, a wrong guess or vote only loses the
  round.

### The checks (forgiving, never blocking)

`check.ts`. Nothing a player says is ever rejected; the checks only decide how a line is shown.

- **Matching a frame**: the utterance (the server's kana reading, then the raw text) is compared
  with every known question/answer frame as sound keys (Phrase Bingo's `phraseKey`), allowing
  about one kana edit in five, and only if the frame covers at least 75% of what was said (so
  はい！ isn't found in はいります).
  - Exact match: the stage shows the tidy frame text and its English subtitle (a recogniser slip on
    a tile still shows the tile).
  - Close match: the stage shows what was heard, with the frame's English as a guess ("≈ Do you
    like it here?").
  - No match: shown as heard, "(in their own words)".
- **Own words vs tile**: a line said that matches a tile on the player's screen counts as the tile
  (they may have read it); anything else that holds Japanese counts as own words. English typed
  in is logged but earns no bonus.
- **The guess**: the place is the tap; the speech only earns the bonus if it contains the place's
  name (or an accepted variant: うち for 家, ラーメン for ラーメン屋).

### Content (draft)

`places.ts`, all `status: 'draft'`:
- **12 places**, 4 per topic pack: food (コンビニ, レストラン, ラーメン屋, スーパー), travel (駅,
  温泉, 空港, ホテル), family (学校, 公園, 家, 病院). Each has 5 roles, 4 local questions
  (kana, N5, two N4) and 15–16 answers covering what / when / who / like / how / where at the Kana and
  N5 levels, with N4 lines for some kinds.
- **29 generic questions** (6 kana, 10 N5, 13 N4) and **29 generic answers** for every kind
  (the tourist's suggestions, also mixed into locals' tiles so they aren't a giveaway).
- **The N4 deck** (goals 4.2 and 4.4, draft): 8 more generic N4 questions in ＿なければ なりませんか,
  ＿なくても いいですか, ＿られますか and ＿ことが できますか, 6 generic N4 answers in the same frames
  (そう しなければ なりません。 / しなくても いいですよ。 / はい、いつでも 来られますよ。…), and
  at every place one more N4 question and two N4 answers (おんせん: みずぎを 着なければ なりませんか →
  いいえ、みずぎは 着ては いけません。). Each deck line has `frames` (frame ids by name).
- **7 bluffing phrases** for the tourist (そうですね…, ひみつです！, いい しつもんですね！,
  みんなと おなじです。, あなたは どうですか。, 何と 言ったら いいかな…).
- Choices each round: the place, up to 3 more from its pack, then others (6 in all). The night's
  pack plays first.

### The N4 deck

Not a new seat: N4 players simply get N4 tiles, as before (their tiles are N4 first, then N5, then Kana),
and there are now enough N4 lines that an N4 asker's five suggestions are all N4. When a question carries
frames, the answerer's tiles put answers from its frame family first: a ＿なければ なりませんか question gets
must / needn't / mustn't answers, a ＿られますか or ＿ことが できますか one gets can answers. Kana and N5
players' tiles, points and turns are exactly as before (no extra random draws), and a room with no N4
player plays as it did. There is no offer to decline because there is no extra role.

### Learning hooks

- Phrasebook: a frame said in your own words → `said`; a tile read or tapped, or a close match →
  `seen`; the round's place name → `seen` for everyone, `said` for a tourist who said it right.
- Tiles are at the player's level (romaji at Kana), with English, but own words pay double.
- The stage log is a running bilingual transcript, read by the whole room.

### Host cues (Chōchin-san)

Chōchin-san's general bank is about the last train, so this mode has its own events, bank lines
only (no LLM wait): `tourist_intro` · `tourist_deal` when the cards are dealt (no place in the cue)
· `tourist_vote` at a vote · `tourist_last_chance` (`name`) at the last chance · at the score,
`tourist_caught` (`name`) when the locals win, `tourist_escaped` (`name`) when the tourist gets away
or names the place. No line when the tourist left.

### Awards (draft titles)

めいたんてい *Great Detective* (most votes for the real tourist), へんそうの たつじん *Master of
Disguise* (most rounds won as the tourist), おしゃべり おう *Chatterbox* (most lines said aloud).

### Bots

`touristPolicy({ seed })`: taps ready; on its turn picks someone and asks (35% the tile's text
as its own words, 45% the tile said, 20% a tap); answers the same way. Locals find the player
whose answers fit their place least and may call a vote after turn 4 (`callRate` 0.25) and vote
for them; the tourist counts which place the logged answers fit and guesses once one place has 2+
clues and leads; on its last chance it picks its best clue. `npm run bots -- --mode tourist --bots 5`.

## Decisions made on Ladi's behalf

1. **Phases**: card = `prompt`, each question turn = one `answer` phase (repeated, like
   Concentration's turns), vote = `reveal`, last chance = `encore`, result = `score`, labelled
   with `phaseLabels`. Every window is timed and VIP-skippable; a stalled turn can't freeze the room.
2. **Places live in the mode folder** (`places.ts`), not as a new content type with a
   `ContentLibrary` field, to avoid loader changes for a backlog mode (as Phrase Bingo did).
   They don't copy pack items, so the mode works with no packs loaded (tested).
3. **The answer is logged by the answerer on their phone**, as the brief suggested: say it into the
   phone as you say it to the room (honour system, as in Phrase Bingo).
4. **Host: Chōchin-san** (the travel host), with six `tourist_*` events of his own: his shared
   bank talks about the last train ("each station has a question").
5. **Called votes need a majority of voters; the final vote needs the most votes, and a tie lets the
   tourist go.** Spyfall needs unanimity for an accusation; majority is kinder to a noisy room.
6. **One called vote per player per round** (Spyfall's rule), and it ends the current turn at once.
   A turn interrupted before its question goes back to the same asker.
7. **The tourist votes too**, so a vote screen doesn't reveal them.
8. **A caught tourist gets a last-chance guess** (worth 150, locals keep their points). Not in
   Spyfall; added so the tourist still has a speaking moment ("ここは ＿＿ ですか？").
9. **Sharp-eye points** (+100) for every local who voted for the tourist in the deciding vote,
   even when the room got it wrong, so good deduction always pays.
10. **Points**: locals 100 each (+100 caller, +100 sharp eyes); tourist 300 escape, 400 guess,
    150 last chance. A guess is the bigger prize so tourists take the risk.
11. **No asking straight back** (Spyfall's rule), enforced by the server.
12. **Turn cap** players + 3 (6–10) and a 6-minute round cap, then the final vote. Three rounds
    ≈ 15 minutes with 5 players.
13. **Speaking bonuses come from one pool per round** capped at 30% of 300 (90), ×1.5 comeback
    clamped to it, last round ×2.
14. **Own words beat tiles**: own words pay double a tile said aloud; a tap pays nothing but
    always works (the quiet fallback is never blocked).
15. **Free questions get no machine translation**: a line that matches no frame is shown as heard
    with "(in their own words)". No round waits on an LLM; a translation could be added later as
    an async extra.
16. **Close matches show what was heard**, with the matched frame's English marked "≈", rather
    than replacing the player's words with a frame they may not have meant.
17. **6 place choices**, at least half from the round's pack, so the tourist's guess is a real
    deduction among similar places.
18. **The tourist rotates**: fewest turns as tourist first, never twice in a row if avoidable,
    connected players first (3 players × 3 rounds → each once, tested).
19. **The tourist leaving ends the round with no points** and the game moves on; anyone else
    leaving just drops out of turns and votes.
20. **The VIP can hide any logged line** (`hide`), shown as "[hidden]", per the design doc's
    moderation rule; the stage has no other text filter yet.
21. **N4 deck (step 2 of the N4/N3 plan)**: the deck is more lines in the existing level bands, not a
    hard seat, so there's no accept/decline offer. Answers are matched to a question's frame family
    (must/needn't, can) only when the question carries frames; otherwise by kind, as before.
22. **The onsen's swimsuit answer uses ＿ては いけません** (4.2's boundary frame), because "no, you
    needn't" would be wrong there: you mustn't.

## Open questions

1. **Is majority right for a called vote**, or should it be unanimous minus the accused, as in
   Spyfall? Majority makes early catches easier.
2. **Should the tourist get a last chance at all?** It softens the loss and adds a speaking line,
   but Spyfall purists end the round on a catch.
3. **Tile suggestions to locals include place-specific answers.** Do they make locals too
   obvious (or the place too easy to guess)? Option: only generic tiles for everyone at N4.
4. **Honour system on answers**: the answer is whatever the answerer logs. Should the asker be able
   to flag "that's not what you said"?
5. **Free-text subtitles**: add an async LLM translation for own-words lines (shown when ready, never
   waited on)?
6. **Kana-level players**: are the kana question tiles enough to play, or should the Kana level get a
   simpler mode (yes/no questions only)?
7. **Durations** (45 s turns, 25 s vote, 6-minute cap) and the turn cap are playtest numbers.
8. **Fluent check** of all 246 lines (and the N4 deck's 50 more), 60 roles and award titles; especially casual lines (ずるずる！,
   だいすき！), N4 forms, and whether roles like おさるさん land as jokes.
9. **N4 deck**: are 13 generic N4 questions too many next to each place's 2? Should the answer tiles
   for a deck question be only its frame family (today they fill up with the kind's other answers)?

## Known gaps

- Not tried with real phones in a real room: whether the speech recogniser copes with short
  answers like ときどき, and whether the phone-logging step slows the conversation.
- No sound effects or TTS reading of the questions on the stage.
- Place content isn't covered by the content linter or `npm run content:readings` (decision 2).
- The asker's phone has no guess or call-vote button while it is choosing or asking (those appear
  on every other screen during the turn).
- Controller error messages for this mode's codes (`bad-target`, `already-called`, `pick-someone`)
  aren't in the controller's friendly list; the UI is built so they shouldn't occur.
- Free-text questions and answers shown on the stage rely on the VIP hide button only (no filter).
