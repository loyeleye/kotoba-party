# Oogiri Night (大喜利ナイト)

The flagship mode, hosted by Pon. Players fill in the blank of a silly Japanese prompt, the room
votes for the funniest answer, and the winner says it out loud. This is the Phase 1 build from the
design doc ("Oogiri Night (flagship)" and "Build phases").

Code:

- Rules: `shared/src/modes/oogiri/` (`oogiri.ts` is the mode, `deal.ts` deals prompts and tiles,
  `answer.ts` builds and checks answers, `state.ts` holds the state and view types, `romaji.ts`,
  and `fallback.ts`, a small placeholder pack).
- Stage: `stage/src/modes/oogiri.ts` and `.css`. Phone: `controller/src/modes/oogiri.ts` and `.css`.
- Bots: `tools/bots/policies/oogiri.ts` (`oogiriPolicy()`). Tests: `tests/oogiri.test.ts`.

## How a game runs

3 to 8 players, three rounds, always in this order:

| Round | Prompts | Who answers | Who votes | Points |
| --- | --- | --- | --- | --- |
| 1. Head to Head | One per player | Each prompt goes to 2 players (a ring), so each player answers 2. Japanese only. | Everyone except the two authors | Normal |
| 2. Photo Caption | One per pair | Each player answers 1. With an odd count, the last player is paired with the first, who answers 2. Set-phrase frames; English allowed. | Everyone except the authors | Normal |
| 3. IPPON Round | One for all | Everyone | Everyone, for any answer but their own | ×2, Japanese bonus ×2 |

Each round goes: **prompt** (round card) → **answer** (everyone answers all their prompts on
their phone) → for each matchup: **reveal** (vote) → **encore** → **score** → next matchup. After
round 1 or 2, Pon may steal a cushion (**penalty** phase). After round 3, the recap.

### Answering

- Each player gets the prompt version for their level. N4 falls back to N5 when a prompt has no N4
  version, and Kana falls back to N5 when it has no Kana one.
- **Say it first** (N5 and N4): for 5 seconds after a prompt opens, there are no tiles. A spoken
  answer from memory in that window earns the biggest bonus. Typing from memory in the window
  counts too, for less. After 5 seconds the phone asks for the tiles (`tiles` move). The server
  checks that the window has passed and allows 0.75 s of slack for the phone's timer. Each of a
  player's prompts gets its own window, which opens when they reach that prompt.
- **Tiles**: 8 per prompt (3 that fit, 3 absurd swerves, 2 callbacks), or 6 at the Kana level
  (3, 2 and 1). Callbacks are words someone used earlier tonight, newest first. If none have been
  used yet, they come from the pack. Gaps are filled from the pack (never from its untaught
  baseline words). There is at most one stereotype word per hand.
- **Forms**: from N5 up, a verb tile asks for one form (ます, ました, ません, たい) and the player
  must pick it from the conjugations. Adjective tiles offer plain, past and negative. Picking the
  asked form earns a small extra bonus. A wrong pick is still accepted; the player gets a one-line
  private correction and a "missed" entry in the phrasebook. At the Kana level, verbs come ready
  in their ます form with no quiz, and prompts and tiles show romaji.
- Players can use up to 3 tiles plus typed text (keyboard or the built-in kana pad).
- **Photo Caption** adds set-phrase frames (＿＿＿をください！, ＿＿＿たい！, ＿＿＿ください！ …).
  A noun frame takes any pieces. A 〜たい frame takes one verb as its stem, and a 〜てください frame
  takes one verb as its て-form. The game only deals frames the hand can fill.
- **Say it to send it**: once the answer is built, the player holds the talk button and says it.
  If the recogniser heard it (a lenient kana match), it counts as `spoken`. If it heard something
  else, it counts as `tried`, which still earns more than a quiet send. The quiet "Send without
  saying it" button earns the least. Phones in quiet mode, or without speech recognition, just
  get a Send button.
- English is refused in round 1 (`japanese-only`). In rounds 2 and 3 it is allowed and earns no
  Japanese bonus.

### Reveal, votes, cushions, IPPON

- Answers are shown anonymously, sorted by their random ids, so their order says nothing about
  who wrote them. The stage reveals them one by one (1.6 s apart) as the host "reads" them. Each
  answer has an English subtitle: the prompt's English with the answer's English inside it. That
  English comes from the tiles' glosses, from the player's own text if they typed in English, or
  from the Japanese in quotes for free Japanese.
- Every vote is a cushion (座布団) and is worth 100 points (×2 in round 3).
- **IPPON**: every other voter (at least 3) picked the same answer. It earns +200 (×2 in round 3),
  a full-screen stage animation and the `ippon` cue. The encore of an IPPON matchup always runs
  its full length, so the celebration isn't cut short.
- **Moderation**: during the reveal the VIP sees a Hide button on every answer. A hidden answer
  shows `[hidden]` everywhere, its votes are dropped (those voters can vote again), and it can't
  be voted for or encored.

### Encore

The encore reveals the authors and their cushions. The winner (every answer tied on the most
votes, if it has at least one) sees "I'll say it!" and says the answer from memory (speakBox,
with a typed fallback), for a spotlight bonus. Other authors may encore too, for less. "Let Pon
read it" opts out. The phase ends early once every author has chosen.

### Score and tip

The stage shows the winning answer and the **natural version**. Until the AI judge is wired, the
natural version is the prompt's `exampleAnswer`. The stage also shows the prompt's grammar
pattern, and the room shouts it back (`natural_version` cue). Each author privately sees their
points, how they answered, their own answer as a whole sentence, any form corrections, Pon's
version and the pattern.

### Pon's cushion steal

Once a game, at the end of round 1 or 2, Pon steals one cushion (−100) if the cushion leader is 3
or more ahead of second place. This has its own short `penalty` phase and the `cushion_steal` cue.

### Scoring and the bonus pool

- Vote points: votes × 100 × multiplier. IPPON: +200 × multiplier.
- All Japanese and speaking bonuses come from one capped pool. Each answer's cap is 30% of the
  vote points it has a fair claim to: `0.3 × 100 × multiplier × eligible voters ÷ authors in the
  matchup`. In round 3, every player counts as an eligible voter. The cap is rounded to 5.
- Each way of answering earns a share of the cap: from memory, spoken 50%, typed 30%; said to send
  it 35%; tried 25%; typed 20%; tiles 10%; English 0%. Each correctly picked form adds 5%. Round 3
  doubles the share. Players below the room's average score get ×1.5 (comeback). The answer bonus
  never goes past the cap.
- Encore spotlight: the winner earns 40% for saying it and 15% for typing it; other authors earn
  20% and 10%. It comes out of what's left of the same cap.
- Votes, IPPON and the answer bonus are paid as the encore starts. The encore bonus is paid as the
  score phase starts. Every payment goes in a ledger (`state.ledger`), and the tests check that
  each final score equals the ledger sum.

### Phrasebook and awards

- Phrasebook: every tile word used (in the form picked; `said` if the answer was spoken,
  otherwise `seen`), the correct form when a pick was wrong (`missed`), free Japanese answers and
  encores, and every natural version shown (for everyone).
- Awards at the recap, using the content's Pon awards (with built-in names as a fallback):
  - Cushion Tower: the winner.
  - IPPON Champion: the most IPPONs.
  - Bravest Japanese: the most answers from memory plus encores.
  - Best Callback: the most votes on answers that used a callback tile.
  - Most Cushions Stolen: the player Pon stole from.

### Host cues

| Cue | When |
| --- | --- |
| `intro` | Intro |
| `prompt_read` | Each round card (with the prompt in round 3) |
| `say_it_first` | Each answer phase with any N5+ player |
| `reveal_react` (tier good) | Each reveal, with the prompt and the answers |
| `ippon` | An IPPON, with the winner's name and answer |
| `encore_invite` | Otherwise, with the winner's name and answer |
| `reveal_react` (tier flop) | No votes at all |
| `encore_cheer` | A spoken encore |
| `natural_version` | Each score phase |
| `cushion_steal` | The steal |

The engine adds `recap_award` at the end.

### Pacing (8 players, every timer running out)

| Phase | Length |
| --- | --- |
| Intro | 14 s |
| Prompt | 6 s |
| Answer | 20 s + 40 s per prompt the busiest player has (100 s in round 1, 60 s otherwise) |
| Reveal | 10 s + 3.5 s per answer, at most 40 s |
| Encore | 12 s |
| Score | 9 s |
| Steal | 6 s |

With 8 players and no phase ending early, the game takes about 13 minutes:

- Intro: 14 s.
- Round 1: 6 s + 100 s + 8 × 38 s = 410 s.
- Round 2: 6 s + 60 s + 4 × 38 s = 218 s.
- Round 3: 6 s + 60 s + 38 s + 12 s + 9 s = 125 s.
- Steal: 6 s.

Answer, reveal and encore phases end early once everyone is in, so real games run shorter. That
leaves room under the 18-minute target for host lines and slow phones.

### Privacy

The stage never sees authors before the encore, and never sees anyone's prompts, tiles or tips.
A phone sees only its own slot and tiles, a `mine` flag on its own answer, and its own tip.
Answer order is by random id.

### Late moves

Phones and bots echo the `round` (answers and tiles) and the matchup `id` (votes, hide, encore)
in their moves. The server treats a move that names an earlier round or matchup as `wrong-phase`,
a harmless race. This covers cases like a delayed "show me the tiles" request that lands in the
next round's answer phase.

## Engine change outside the mode

- `shared/src/modes/mode.ts`: `ModeContext` gained an optional `vipId?: string | null`.
  `shared/src/game.ts` `modeContext()` sets it from `state.vipId`. Oogiri needs it for the VIP's
  Hide button. The field is optional, so existing test contexts still compile.

## Decisions made on Ladi's behalf

1. **Round 1 has one prompt per player, not a fixed 3.** "Each prompt goes to 2 players" and
   "each player answers 2" only fit 3 prompts when there are 3 players. A ring
   (prompt i → players i and i+1) makes both true for any count from 3 to 8.
2. **Round 2 is head to head too, one photo per pair.** The brief says "head-to-head rounds"
   (plural). One answer per player keeps the round short. With an odd count, one player answers 2.
3. **With 3–4 players there is no IPPON in head-to-head rounds.** Only 1–2 players vote on each
   pair, and IPPON needs 3. IPPON is still possible in round 3 with 4+ players.
4. **The bonus cap is per answer**, at 30% of the vote points that answer could fairly win. Each
   answer's bonus is known as its matchup is scored, and the total can never pass 30% of the
   round's stake.
5. **Bonus shares** (memory spoken 50%, memory typed 30%, said to send it 35%, tried 25%, typed
   20%, tiles 10%, +5% per right form, encore 40/15% for the winner and 20/10% for others,
   comeback ×1.5). These are placeholders for playtests; they follow "saying it from memory
   earns the most" and "the quiet fallback earns less".
6. **A spoken lock-in that the recogniser heard differently still beats a quiet send**
   (`tried`). This follows "forgiving by design" and "praise for trying". Phase 1 records speech
   but doesn't score pronunciation.
7. **N4 players get tiles too.** The content comment says N4 gets "the N5 version with no tiles",
   but the design doc lists "a no-tiles mode for N4" as an open question. Until that is answered,
   N4 plays like N5, with their own N4 prompt version where one exists.
8. **"New players" get the same 6-tile hand as the Kana level** (3 fit, 2 swerve, 1 callback),
   because the game keeps no history yet. Kana-level verb tiles come in the ます form with no form
   quiz.
9. **Adjective tiles ask for plain, past or negative.** The brief's ます/ました/ません/たい are verb
   forms, and the packs store adjectives' past and negative forms.
10. **Up to 3 tiles per answer, joined with spaces**, matching how the packs space their phrases.
    The stage shows only the blank's filling in big type, with the prompt above it.
11. **The stage shows the N5 version of each prompt.** Most of the room reads it, and the Kana
    version would hint at who wrote what.
12. **English subtitles are built from tile glosses**, or the player's own English. Free Japanese
    shows in quotes inside the English sentence. This is "keep it simple" until the judge
    translates.
13. **Ties share the win.** Every answer tied on the most votes is a winner, and all of them are
    invited to encore.
14. **The steal is checked only after rounds 1 and 2**, so it can't decide the game in the final
    second. It compares the cushion leader with second place.
15. **The steal costs one vote's worth (100 points), not doubled**, and also removes one cushion.
16. **A matchup with only one answer still has a vote** (the lone answer is the only option). A
    matchup with no answers is skipped.
17. **Answers can't be edited once sent.** This is the same as the rest of the game.
18. **The VIP's Hide works only during the reveal**, can't be undone, and voters whose vote was
    dropped may vote again.
19. **The IPPON encore always runs its full 12 s**, so the animation isn't cut short when everyone
    has chosen quickly.
20. **Round count is fixed at 3** (`roundChoices: []`). The doc's three rounds are the show.
21. **Romaji follows the content's spacing** (ねこの → "nekono"), not word-by-word particles.

## Open questions

1. Is round 1 with 8 players (8 matchups) too long? About 5 minutes worst case. An option is 4
   prompts with 2 players each, and 4 players sitting it out as voters.
2. Should N4 players get no tiles for a bigger bonus (the design doc's open question)?
3. Should Kana-level players see English on tiles, or kana and romaji only?
4. Should the encore be winner-only? Others may encore now, which can make the phase busier.
5. Is the cushion steal funny or unfair in practice? It is easy to turn off or move to round 3.
6. Bonus shares and the 1.5× comeback need playtest tuning.
7. Photo Caption needs real art. The photo is a big caption card for now.

## Known gaps

- No AI judge: the natural version is the prompt's `exampleAnswer`, and there are no per-answer
  corrections beyond form picks.
- Fading tiles ("a word used from tiles 3 times must then be said or typed") is not built; it
  needs cross-game history.
- Encore speech is recorded and rewarded for trying, not checked against the answer.
- Caught yōkai as callbacks are not wired (no cross-mode history yet).
- Moderation is only the VIP's Hide button; there is no text filter yet.
