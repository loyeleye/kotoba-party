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

In a room with N4 players, one of them each round (in turn, skipping a card not said or hidden) also
defends their own card's place, with ので. Any round, the Time Line too, where the ordinary defence
doesn't run.

- **The offer** comes during the line-up: "🎙 N4: after the line-up, say why your card goes where it
  is", with **I'm in** and **Not this time**. Declining (or passing, or letting it run out unsaid) skips
  it; the answer is kept per round in `hardLog`, counted by `hardTally` (the gate: 60% or more taken).
- **Its own encore** (`encore`, 15 s), after the ordinary defence when there is one, so two people never
  talk at once. When the N4 player is also the most-moved card's author they defend once, with the N4
  script.
- **The script** (`defence.ts`) fits where the card ended up: 「＿ので、これが いちばん さきです。」 at
  the low end, 「＿ので、これが いちばん あとです。」 at the high end, 「＿ので、これは Aさんの あとです。」
  after a neighbour. The phone shows the frame and two whole model lines to read out, with reasons that
  fit the round (じかんが いちばん はやいので, Aさんのより たかいので, いちばん くさいので…); the TV shows
  the frame under the neck. All draft, tagged `node`.
- **Scoring**: said out loud in Japanese, it adds the same 30% defence share as the ordinary defence, to
  the N4 player only. The team points and everyone else's bonus don't change. Whether ので was used goes
  to the phrasebook (`narabete:defence:<spot>`), not the score.

## Scoring (co-op)

- **The team**: 100 per neighbouring pair in order, +300 when the whole line is in order. Everyone
  gets the same.
- **Saying it**: a bonus per player from a pool capped at 30% of the team points at stake: said
  from memory 70% of the cap, with help (the hint, or a ready answer read out) 50%, typed 35%, a ready
  answer tapped 15%, a Time card said with the time missing 20%. A spoken defence adds 30%.
- Points are paid at the end of the flip, not when it starts.
- **Votes**: 50 per vote. **The story**: 50 for reading your line out loud.
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
   Deferred: the host playing it in rooms without an N4 player, the commentary booth, and the N3 script
   (＿ような きが します, step 6).
