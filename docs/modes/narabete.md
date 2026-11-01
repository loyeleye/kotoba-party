# Narabete! (ならべて！ "Line them up!"), backlog

Host: Nobiko-san. 2–8 players. Kana–N4. Co-op. Everyone holds a secret card: say yours out loud,
listen to everyone else's, and line the cards up along Nobiko-san's neck, low end to high. Then she
flips them over one by one, and every neighbouring pair in order scores for the whole team.

Code: `shared/src/modes/narabete/` (rules and views in `narabete.ts`, the draft Time Line sets and
Feelings themes in `cards.ts`), `stage/src/modes/narabete.{ts,css}`, `stage/src/neck.ts` (the neck ruler and its knots),
`controller/src/modes/narabete.{ts,css}`, `tools/bots/policies/narabete.ts`, `tests/narabete.test.ts`.
Design: the Bento Haus and Narabe! design doc (v0.2) and its panel reviews.

## Why it works for speaking

The cards are secret, so the only way the team learns them is by hearing them. Round 1 makes every
player say a full sentence with a time, price or date in it (the numbers learners trip on most:
よじはん, さんびゃくえん, ここのか), and makes everyone else listen for it. Rounds 2 and 3 make them
say an opinion that fits a secret number without saying the number, then argue about order
(「Aさんの ほうが ひどい！」). Mistakes never cost points: a line full of knots still pays every pair
that is in order.

## How a game goes

Three rounds. The intro (15 s) explains it. Each round:

1. **Deal** (`prompt`, 9 s). The TV shows the round's title and the neck's two ends (おきる … ねる,
   ふーん … きゅうきゅうしゃ！). Each phone shows its secret card.
2. **Say it** (`answer`, 60 s; ends early when everyone has said theirs). The TV shows a 🔊 on each
   player who has said theirs, never what it was.
   - **Time Line** (round 1): the phone shows a picture, a clock and the English (Wakes up at
     4:30 p.m.). Say the sentence from memory; 💡 shows the Japanese (Kana players always see it, with
     romaji). It counts when the time, price or date comes through, checked as kana from the
     server's reading (4時半 and よじはん both count; 30分 can be さんじゅっぷん or さんじゅうふん). A
     try that misses still counts as said, and a good saying is never replaced by a worse one.
   - **Feelings Line** (round 2): a secret number 1–100 (hold to peek), an opinion theme (how shocked
     would Grandma be?), sentence frames, two swerve words (one that fits, one absurd) and ready
     answers to tap or read out (Kana players get four, others three; one is always near the number).
     Say anything that fits your number. If it sounds like a number (digits, number kanji, じゅう or
     ひゃく), the phone warns and lets you change it; it is never refused.
3. **Line them up** (`reveal`, 90 s; ends when every card is locked). The cards sit along the neck in
   a shuffled order. Each player moves **only their own card**, ◀ ▶, one place at a time (it swaps
   with its neighbour, and both cards unlock), then locks it (きめた！). In the Time Line the TV
   shows each card's picture; 🙋 on a phone asks someone to say theirs again (もう いちど
   おねがいします), and their phone shows who asked. In Feelings rounds the TV shows the answers. The
   VIP can hide an answer.
4. **One defence** (`encore`, 12 s, Feelings rounds only): the author of the card that moved the most
   says why it belongs there (〜からです。). Said out loud, it tops their bonus up. The TV shows the
   call under Nobiko-san's neck, so the line stays where it is.
5. **Cards over** (`score`, the flip plus 9 s, or 14 s with the vote). Nobiko-san turns the cards over
   from the low end, one every 1.3 s after a 1.8 s lead-in, a bell a step up the scale for each. A
   knot ties in her neck between each pair out of order (a loop that cinches tight, with a 💢); the card furthest from its true place
   wobbles and flips last. Her line waits until the last card is over, and phones hold the result
   ("Nobiko-san is turning the cards over…") until then so nobody's phone spoils it. In Feelings
   rounds everyone then votes for the funniest answer (not their own).

While her neck is on screen, the host corner shows only her empty plate, so there is never a second Nobiko-san. A stage curtain closes over the whole screen as she swaps places (into the first deal, and out to the story). Her head on the line blinks, mouths her lines and winces at each knot. The round always fits the TV at 1:1, so her pixels stay crisp: with 7 or 8 players the score ribbon goes to one line per player and the cards' text gets smaller.
A round keeps one TV layout from the deal to the flip: the cards stay in place, empty slots fill
with 🔊 as players say theirs, and moved cards slide. There is no curtain between its phases.

**Round 3, the Worst Day Ever** is a last Feelings Line on "what happened today, and how bad was
it?". After its flip, one `finale` turn per card, lowest first: the TV shows the story so far, and
the reader says their line, starting with a joiner: 「そして…」, 「それから…」, 「しかも…」 (and then,
after that, on top of that), and 「さいごに…」 (finally) for the last.

## Rank and defend (N4 hard role, goal 4.11)

In a room with N4 players, one of them each round (skipping a card not said or hidden) also defends
their own card's place, with ので. Any round, the Time Line too, where the ordinary defence doesn't run.
Who is offered it comes from the shared `nextOfferee` (shared/src/modes/hardRoleLog.ts): the N4 player
offered fewest times, then the one offered longest ago; a player who said Not this time, or let the
offer time out, sits the next round out; in a room of 4 or more, whoever gave it last round gets this round off.

- **The offer** comes during the line-up, on the shared offer card (`roleOffer`): "🎙 Nobiko-san wants to
  hear your reason. After the line-up, say why your card goes where it is, with 〜ので", with two equal
  buttons, **Take it** and **Not this time**. At the mic, the pass button reads **Not this time after all**. It's opt-in: the encore runs only when
  they tap Take it before the line-up ends. An offer still open then is logged `timeout` (`away` if they'd
  left) and skipped; Not this time is `declined`. The answer (the shared `OfferAnswer`) is kept per round
  in `hardLog`, counted by `hardTally` with `offerRate` (the gate: 60% or more taken; away is left out).
- **Its own encore** (`encore`, 15 s), after the ordinary defence when there is one, so two people never
  talk at once. Nobiko-san invites them with her own cue (`narabete_hard`: "{name}さん、どうして そこなの？　おばちゃんに おしえて！",
  never "your card moved a lot"). When the N4 player is also the most-moved card's author they defend
  once, with the N4 script. The phone says a typed defence doesn't score.
- **The script** (`defence.ts`) fits where the card ended up: 「＿ので、これが いちばん さきです。」 at
  the low end, 「＿ので、これが いちばん あとです。」 at the high end, 「＿ので、これは Aさんの あとです。」
  after a neighbour. The phone shows the frame and two whole model lines to read out, with reasons that
  fit the round (じかんが いちばん はやいので, Aさんのより たかいので, いちばん くさいので…); the TV shows
  the frame under the neck. All draft, tagged `node`. Every Feelings theme says whether its word is a
  な-adjective (`na` in cards.ts, true only for たいへん so far), so ので after it is なので (たいへんなので,
  たいへんな もの); the script no longer guesses from the word's last kana.
- **The commentary booth** (Ladi, 2026-11-01: the 15 s encore every round is fine "as long as the other
  N5/Kana players are getting something out of it"). Once the ので line lands (said out loud, in Japanese,
  with ので), one more short `encore` replays it. The TV keeps the defence and adds an instant replay: the
  line with its ので chunk lit and one line of English colour ("ので = because: Aki gave the reason first,
  then where the card goes."), while Nobiko-san says the line herself (`narabete_replay`, a bank line that
  is the `{line}` slot as is, with `line_kana` and `line_en`; the player's recording never plays). The line
  is the model line they read out; a line in their own words is shown but not voiced, because the host
  only ever speaks fixed, checked lines, never what speech recognition heard. Every Kana and N5 phone shows the gist at its level: the line in
  kana (romaji too for Kana), plain English ("Aki: this one comes first, because it's the earliest
  time."), and the card's picture. It calls the play, never the player's mistakes, and the defender's own
  phone doesn't get it. The replay fills what's left of the 15 s encore, kept to 5–7 s, so it runs at most
  5 s past the encore, and only when the line was said. Passed, typed, or said without ので: no replay.
  It uses the shared booth (`Commentary`, `lightUp`, `gistFor`; the TV's `boothStrip`, the phones'
  `boothGist`, with the card's picture above it). Nobiko-san reacts first (`narabete_hooray`: 「あらまあ！
  じょうずねえ！」, 「あらまあ！　おばちゃん、わかったわ！」…), and says the model line 1.2 s into the replay; a line in their own words gets only
  the reaction.
- **The Gallery** (shared, mixedRoom.ts): while the N4 defence is on (its encore and its replay),
  every other connected player gets one tile: four reactions (👏 すごい！, 💡 なるほど, 😮 へえ！,
  📣 がんばれ！) that pop up as bubbles under the neck, never scored. Once a game, once the defence has
  landed (as the replay starts, `armCurveball`), a Kana or N5 player who hasn't reacted yet gets the
  curveball in place of their tile: "Which word did you hear?", ので and two of のに, から, けど, まで
  (never a word the line itself contained), +5 if right (paid at once, on top of the round's points). Who
  gets it rotates with the round. A defence that is passed, typed or said without ので deals none. No
  Gallery in the ordinary defence, or without an N4 defence taken.
- **The host stand-in** (shared `hostStandsIn`): in a room of one or two players with nobody at N4,
  Nobiko-san gives one model defence herself, once a game, 4 s into the first line-up
  (`narabete_standin`, a `{line}` bank line): the round's card at the high end, the second model line,
  e.g. 「これより おそい じかんは ないので、これが いちばん あとです。」. The TV shows it in the booth strip for 5–7 s (inside the 90 s
  line-up, so no time is added), and Kana and N5 phones show its gist on the line-up screen. Nobody is
  asked to say anything, and nothing is scored.
  - *Experiment `standInSetup`* (experiments.ts, for Ladi to confirm): 4 s in she first says
    「じゃあ、おばちゃんが いいわけ するわね。」 (`narabete_standin_setup`, bank only); the defence follows 2.5 s later.
    Still inside the line-up: no time added.
  - *Experiment `standInCurveball`* (for Ladi to confirm): both phones get a Gallery tile on the line-up screen while
    she says it, and once she has (its booth length) the once-a-game curveball on ので (against `DEFENCE_POOL`), +5.
    The gist and the lit ので wait until then. A line-up everyone locks early waits until she has said it and the
    curveball is answered (at most 5 s); otherwise no time is added. Narabete now has `wakeAt`/`wake` for this.
- **Scoring**: said out loud in Japanese, it adds the same 30% defence share as the ordinary defence, to
  the N4 player only. The team points and everyone else's bonus don't change. The phrasebook
  (`narabete:defence:<spot>`) logs it `said` only for their own spoken reason with ので; a model line read
  off the phone, a typed one, or one without ので is `seen`. Not the score.

## Scoring (co-op)

- **The team**: 100 per neighbouring pair in order, +300 when the whole line is in order. Everyone
  gets the same.
- **Saying it**: a bonus per player from a pool capped at 30% of the team points at stake: said
  from memory 70% of the cap, with help (the hint, or a ready answer read out) 50%, typed 35%, a ready
  answer tapped 15%, a Time card said with the time missing 20%. A spoken defence adds 30%.
- Points are paid at the end of the flip, not when it starts.
- **Votes**: 50 per vote. **The story**: 50 for reading your line out loud.
- **The Gallery's curveball**: 5, once a game, for one Kana or N5 player, only when an N4 defence landed.
- **Awards**: ポーカーフェイス賞 (the card that fooled the room the most, Feelings rounds),
  おもしろ賞 (most votes), いいこえ賞 (most cards said out loud), ききじょうず賞 (good listener: asked
  to hear a card again the most).

## Content

All draft, all kana, until the fluent check. Seven Time Line sets of 8 cards (a ghost's day, Pon's
diet, konbini prices, Pon's calendar; Nobiko's night out and a boss's schedule for Family and
Cheeky; a first date for Cheeky). Each is a tiny story whose last card is the punchline, which is
always dealt. Feelings themes: three Kids, three Family and five Cheeky (late excuses, dating
profiles, a midnight message, what your parents saw, the morning after), plus a Worst Day Ever theme
per audience. Opinion, never fact: "how big is this animal" has a right answer, so nobody argues.

## Music and sound

**Daily Beetle** (first theme) and **Easy Lemon** (second), both Kevin MacLeod, CC BY 4.0 (row 22 of
the [commercial blockers](../commercial-blockers.md)). The music goes under while players talk and
while cards are said (`listening()`); it ducks for the flip itself (`hushFor`). The flip's bells
run up the major scale in the playing track's key (`bellTonic`), counted so the last card lands on
the tonic, with a chord for a perfect line; a knot bends its note down a semitone and adds a low
"bwomp". Calm motion turns the flip into a cross-fade.

## Open questions

1. **Is a flat team score fun enough?** Everyone gets the same team points; only the speaking bonus,
   votes and the story differ. Should the Poker Face card earn points too?
2. **Three rounds, fixed.** Should the VIP be able to pick 2–5 (more Feelings rounds)?
3. **The Time Line's TV pictures** help the room remember who said what. Do they give too much away
   (a 🍦 at a konbini is likely late at night)?
4. **Moving only your own card** keeps the TV calm and makes people talk, but a shy player can stall
   the line. Should the VIP be able to nudge any card in the last 15 s?
5. **Fluent check** of every card sentence, theme, ready answer, frame and Nobiko-san's lines, and the
   N4 defence script's frames and reasons.
6. **Rank and defend, decided for now (Ladi to confirm)**: one N4 defence a round, in turn, in every
   round including the Time Line (so a room with an N4 player gets a 15 s encore there); it never
   replaces the ordinary defence for someone else; the bonus needs Japanese said out loud, not ので.
   Rotation: the shared `nextOfferee` (fewest offers, then longest ago; a "not this time" sits one round
   out; in rooms of 4+, nobody two rounds running). A lone N4 player in a small room who declines is now
   offered it every other round, not every round.
   The 15 s encore every round: decided by Ladi, 2026-11-01, kept, as long as Kana and N5 players get
   something from it, so the commentary booth's replay is built (see Rank and defend).
   Deferred: the N3 script (＿ような きが します, step 6).
7. **Mixed rooms, decided for now (for Ladi to confirm)**: the Gallery runs through the N4 defence and its
   replay; the curveball is dealt only once the defence has landed, and ので lights up once the curveball is
   answered (the TV holds it back while it is open, `keyHeld`, so the replay doesn't give the answer away); the stand-in comes in the first line-up of the game (the Time Line) and defends the card
   at the high end; Nobiko-san's あらまあ comes before every landed defence, voiced or not.
