# Ghost Advice Hotline (おばけの おなやみ相談室)

Host: Nobiko-san, the late-night advice auntie (her husband is a こたつむり who never leaves the kotatsu).
Kana–N4 (N3 joins at step 6 of the learning path). 2–8 players. A yōkai phones in with a problem, and only
the caller knows what would really help. Up to three advisers give advice at the same time; it plays in a
random order and the caller answers each with ちがう！ (nope), おしい！ (so close) or それだ！ (that's it).
Then the secret is shown, the room votes for the funniest advice, and the replay booth credits one chunk.
You can win by being right or by being funny.

Code: `shared/src/modes/ghostHotline/` (rules and views in `hotline.ts`; calls, advice tiles and chunks in
`problems.ts`), `stage/src/modes/ghostHotline.{ts,css}`, `controller/src/modes/ghostHotline.{ts,css}`,
`tools/bots/policies/ghostHotline.ts`, `tests/ghostHotline.test.ts`, pictures in `stage/assets/hotline/`.
Design: the v2 storyboard and its six reviews in the project's `learning-path/storyboards/` (v2/CHANGES.md).
Every line is `draft` until a fluent check.

## Why it works for speaking

Giving advice is everyday speech (〜て ください at N5, 〜たら どうですか and 〜ほうが いいです at N4), and
the secret turns it into a listening and reasoning task: the cure can be worked out from the problem's
gist (the kappa's dish is dry, so: water). Kana advisers pick one of four tiles (the cure, the near miss,
a decoy and an absurd curveball), so reading the gist is how they find it. The caller says the problem
out loud at their level and listens to every piece of advice to judge it.

## A call

| Phase | Beat | Length | What happens |
|---|---|---|---|
| prompt | ring | 6 s | The caller card and the problem line (kanji with furigana). The caller says it (+50 for trying); if nobody heard them, Nobiko-san reads it. Every phone gets the gist; only the caller's shows the secret. |
| prompt | plan | 8 s | Speaking advisers read their mission (Nobiko-san's way is behind "Need a hint?"); Kana advisers pick a tile; the gallery bets on the cure. Ends when every adviser is ready. Bets and picks lock here. |
| answer | record | 9 s N5/N4, then 3.5 s to upload | Every speaking adviser records at once. Typing works from the plan beat (quiet mode, no mic). The mic pass lets Nobiko-san read it, once a game, for half points; a free read when the mic is blocked. |
| reveal | play → react, per advice | the clip, then 3 s | In a random order. The TV shows only who is talking; the caller taps ちがう / おしい / それだ (they can change it until it locks); then the words and the picture appear. Kana tiles are marked by the game. |
| reveal | secret | 4 s | The secret card flips over and the matching rows glow. "Fair" when every それだ！ went to advice the game heard naming the cure. |
| encore | vote | 6 s | Which advice made you laugh? Everyone votes, never for themselves. Skipped with two players. |
| score | points | 4 s | Tally, top laugh (大ウケ！ on a sweep), points. |
| score | booth | 7 s | Only when an adviser's own words used a chunk: the line, the chunk lit, a line of colour, the train-line tag. |

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
| Adviser | 50 per laugh vote; 100 more for a sweep (every vote, three voters or more) |
| Gallery | 20 for betting on the cure |
| Caller | 50 for saying the problem out loud (a try counts) |

When the caller doesn't tap in time, the game judges the advice by what it heard: the cure's keys are
それだ！, the near miss's おしい！, anything else ちがう！; a clip with no speech-to-text is おしい！.

## Learning path

A speaking adviser's level line goes in the phrasebook. It counts as said when it was their own clip and
speech-to-text heard it name any advice or use a chunk (or there was no speech-to-text to tell); typing and
Nobiko-san's reading are seen. It is from memory unless the hint was opened or Nobiko-san read it. The
caller's line is read (it's on their phone), and said when they recorded it. A Kana adviser's tile is seen.

## Open, for playtests

- N3 lines (＿べきです, ＿ば よかったのに, ＿ように したら どうですか) join at step 6.
- The caller's reaction is trusted: the secret beat shows when it wasn't fair, but nothing is charged.
- No listening check: the Listening card names a word to listen for, with no points.
