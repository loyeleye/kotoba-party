# Ghost Advice Hotline (おばけの おなやみ相談室)

Host: Nobiko-san, the late-night advice auntie (her husband is a こたつむり who never leaves the kotatsu).
Kana–N4 (N3 joins at step 6 of the learning path). 2–8 players. A yōkai phones in with a problem, and only
the caller knows what would really help. Up to three advisers give advice at the same time; it plays in a
random order and the caller answers each with ちがう！ (nope), おしい！ (so close) or それだ！ (that's it).
Then the secret is shown, the room votes for the funniest idea, and the replay booth shows off one chunk.
You can win by being right or by being funny.

Code: `shared/src/modes/ghostHotline/` (rules and views in `hotline.ts`; calls, advice tiles and chunks in
`problems.ts`), `stage/src/modes/ghostHotline.{ts,css}`, `controller/src/modes/ghostHotline.{ts,css}`,
`tools/bots/policies/ghostHotline.ts`, `tests/ghostHotline.test.ts`, pictures in `stage/assets/hotline/`.
Design: the v2 storyboard and its six reviews in the project's `learning-path/storyboards/` (v2/CHANGES.md).
Every line is `draft` until a fluent check.

## On the TV

The set is Nobiko-san's call-in booth (`stage/assets/scenes/hotline-booth.png`): a starry window, her
microphone and teacup, a rotary phone and a red call light: dark between calls, flashing as a call rings
in, lit while the caller is on the line (with a warm glow drawn above the scrim), and a hitodama outside the
window. The desk sits high enough that the mic and phone show above the scoreboard. Nobiko-san and the caller stay on screen all game (Ladi,
2026-11-01): she sits at the left of the host row, idling when she has nothing to say, and the caller's
card sits at its right end, with a matching lamp, the yōkai, who is playing it and what they're doing
now, Japanese first (もしもし…, まって います, きいて います, こたえて います…) with English small. It rings
for 3 s (ジリリリン！ and a sideways buzz), then says 電話中 (でんわちゅう). Before the first call it says
お電話 まってます. The host row keeps one height all game, so the beat below never jumps. The beats have
no band or call counter of their own (the top bar has the title and round), the problem line stays up
through play and react, and the ring beat shows the caller's face beside it.

## Why it works for speaking

Giving advice is everyday speech (〜て ください at N5, 〜たら どうですか and 〜ほうが いいです at N4, some of the
latter with a real "if/when" in front: 暑く なったら、クーラーを つけた ほうが いいですよ), and
the secret turns it into a listening and reasoning task: the cure can be worked out from the problem's
gist (the kappa's dish is dry, so: water). Kana advisers pick one of four tiles (the cure, the near miss,
a decoy and an absurd curveball), so reading the gist is how they find it. The caller says the problem
out loud at their level and listens to every piece of advice to judge it.

## A call

| Phase | Beat | Length | What happens |
|---|---|---|---|
| prompt | ring | 8 s Kana, 11 s N5, 12 s N4 (6 s for a scripted caller) | The caller card and the problem line (kanji with furigana). The caller says it (+50 for trying); if no take started, Nobiko-san reads it when the ring ends. The say window closes with the ring, so the caller's voice never gets into the advisers' clips. Every phone gets the gist (it hints, never names the cure); only the caller's shows the secret. |
| prompt | plan | 8 s | Speaking advisers read their mission (Nobiko-san's way is behind "Need a hint?"); Kana advisers pick a tile; the gallery bets on the cure. Ends when every adviser is ready. Bets and picks lock here. |
| answer | record | 9 s N5/N4, then 3.5 s to upload | Every speaking adviser records at once. Typing works from the plan beat (quiet mode, no mic). The mic pass lets Nobiko-san read it, once a game, for half points; a free read when the mic is blocked keeps the adviser in the call but earns no reaction points. |
| reveal | play → react, per advice | the clip, then 3.7 s (taps lock at 3 s, so a late tap still gets its reveal) | In a random order. The TV shows only who is talking (typed advice shows its words, since it has no sound); the caller taps ちがう / おしい / それだ (they can change it until it locks); then the words and the picture appear. Kana tiles are marked by the game. |
| reveal | secret | 4 s | The secret card flips over and the matching rows glow. "Fair" when every それだ！ went to advice the game heard naming the cure. |
| encore | vote | 6 s | Which idea made you laugh? Everyone votes, never for themselves and never for Nobiko-san's readings. Skipped with two players. |
| score | points | 4 s | Tally, top laugh (大ウケ！ on a sweep), points. |
| score | booth | 7 s | Only when an adviser's own words used a chunk, and never two calls in a row: the line, the chunk lit, a line of colour, the train-line tag. |

Calls: one per player, at least five; three and four players get two laps so everyone calls equally
often. Two players: a scripted yōkai calls, both advise, and the game judges the advice by what it heard.

## Roles

- **Caller:** whoever has called least, in seat order.
- **Advisers:** up to three, whoever has advised least.
- **Gallery:** everyone else. Bets on the cure from four pictures (the cure, the near miss, two decoys).

## Scoring

| Who | Points |
|---|---|
| Adviser | それだ！ 200 (more than one can get it), おしい！ 50; half on a mic pass |
| Adviser | 50 for speaking: their own clip gave advice (or couldn't be checked) |
| Adviser | 50 per laugh vote; 100 more for a sweep (every vote but their own, three voters or more) |
| Gallery | 20 for betting on the cure |
| Caller | 50 for saying the problem out loud (a try counts) |

When the caller doesn't tap in time, the game judges the advice by what it heard: the cure's keys are
それだ！, the near miss's おしい！, anything else ちがう！; a clip with no speech-to-text is おしい！.

## Learning path

A speaking adviser's level line goes in the phrasebook. It counts as said only when their own clip used that
level's pattern (〜て ください, 〜たら どうですか, 〜た ほうが いいです…): naming the cure alone doesn't say the
frame, so it's seen. Said is from memory, or read if they opened the hint. A clip with no speech-to-text is
said but read (nobody could check it). Typing, Nobiko-san's reading and advice the VIP hid are seen. The
private note on the phone says exactly which of these was logged. The caller's line is read (it's on their
phone), and said when they recorded it. A Kana adviser's tile is seen. Goal 4.7 names this game, but stays
under construction until a game asks for plans.

## Open, for playtests

- N3 lines (＿べきです, ＿ば よかったのに, ＿ように したら どうですか) join at step 6.
- The caller's reaction is trusted: the secret beat shows when it wasn't fair, but nothing is charged.
- No listening check: the Listening card names a word to listen for, with no points.
- The cure can be worked out from the gist, so それだ！ is common and the laugh vote does most of the sorting.
  A playtest decides whether the clue that rules out the near miss should move into the caller's spoken line.
