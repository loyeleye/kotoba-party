# Murder at the Onsen (interrogation whodunit)

Host: Chōchin-san, off duty at the inn. 1–8 players. The VIP picks 2, 3 or 1 questions each
(`roundChoices`). Mode id `onsen-murder`.

Code: `shared/src/modes/onsenMurder/` (rules; `questions.ts` question matching, tiles and the
accusation line; `fallback.ts` placeholder case), `content/src/onsen/cases.ts` (3 draft N5
cases), `stage/src/modes/onsenMurder.ts` (+ `.css`), `controller/src/modes/onsenMurder.ts`
(+ `.css`), `tools/bots/policies/onsenMurder.ts`, `server/ai/suspect.ts` and
`server/src/onsen.ts` (optional LLM lead-ins), `tests/onsenMurder.test.ts`.

## Flow

| Phase | What happens | Host cue |
| --- | --- | --- |
| `intro` (Case file) | The victim (a thing, not a person), where it happened, the suspects with roles, the evidence item. 25 s. | `onsen_case` |
| `answer` (Question) | One player's turn, by seat. They pick a suspect on the phone and ask one question: said aloud, typed, or built from tiles. 40 s (50 s at Kana level). Ends as soon as a question lands. | `onsen_turn` (`name`) |
| `reveal` (Answer) | The suspect "thinks" for 1.8 s, then the scripted Japanese answer appears and is spoken (browser ja-JP voice, per-suspect pitch and rate); the English follows 2.5 s later. A new clue goes into the shared notebook. 10 s (12 s with a new clue). | `onsen_clue` on a new clue |
| … | `answer` → `reveal` repeats for every turn: players × questions each, clamped to 6–14 turns. | |
| `encore` (Accuse) | Everyone picks a suspect and says 「はんにんは ○○さんです！」. 50 s. Ends when everyone has voted. | `onsen_accuse` |
| `finale` (Confession) | Votes per suspect, the はんにん stamp on the culprit, their confession, the English solution, and any key clues nobody found. 30 s. | `onsen_reveal` |
| `recap` | Standings, awards and the phrasebook ("Detective notebook"). | |

### Asking

- Six question intents: `where` (どこにいましたか), `what` (なにをしていましたか), `who`
  (だれをみましたか), `when` (なんじにねましたか), `victim` (about the victim), `item` (whose is
  the evidence).
- Matching is lenient: `soundKey` of the utterance's reading (the server adds readings) is
  scored against weighted keys per intent (どこ 3; なに 2; なんじ 3; どんな 3; だれの 3; the item's
  keys 3; …). A score of 2 or more places the question; ties go to an intent not yet asked of
  that suspect. Politeness, particles and word order don't matter.
- A question the matcher can't place gets one private retry with a hint ("Did you mean:"
  the closest question, or a list of question words). After a second miss the mode takes its closest guess and the suspect
  answers that, so the turn is never wasted.
- Tiles: Kana-level phones get the tile builder straight away, with romaji. N5+ phones get it
  after a 5 s "say it first" wait. A "What could I ask?" menu lists the six questions (Japanese
  shown only at Kana level).
- Each suspect has an answer for every intent. Asking the same suspect the same thing again
  gets the same answer and no question points.

### Scoring

| | Points |
| --- | --- |
| Understood question (not a repeat, not a guess) | 20 |
| Question that put a new clue in the notebook | 100 (counts on a guess too) |
| Naming the culprit | 300 |
| Question asked aloud | +40 speaking bonus |
| Accusation said aloud in full | +60 speaking bonus |

Speaking bonuses go into a pool that pays out at most 3/7 of the player's other points, so the
bonus is never more than 30% of their score. The pool settles whenever base points grow.

Awards: めいたんてい (most clues found), こえの たんてい (most questions asked aloud), みぬいた！
(first to name the culprit).

### The optional LLM

With `ANTHROPIC_API_KEY` set, `suspectDirector` (in `server/src/main.ts`, alongside Ink Storm's
coach, sharing the game's LLM budget) asks for a short in-character lead-in (for example
「えっと…」「うーん、そうですね。」) for each fresh answer and injects it as a
`{ kind: 'suspect-line', key, lead }` move. The rules accept it only before the thinking beat
ends (`askedAt + 1.8 s`), so text never changes once it is shown, and `cleanLead` rejects
anything that could add a fact: non-kana, text and kana that disagree, names, item keys, はんにん,
digits or English culprit words. The scripted answer is already in the state, so nothing waits
on the LLM. At most 16 lead-ins per game.

## Decisions made on Ladi's behalf

1. **The "victims" are things, not people** (a snowman, a pudding, a rubber duck). Why: a
   party game for learners, family-friendly, and confessions can be silly. The title stays.
2. **One player asks per turn, by seat order**; disconnected players are skipped. Why: the
   room needs to hear one question and one answer at a time.
3. **Turns are players × questions each, clamped to 6–14.** Why: a 2-player table still gets
   enough clues; 8 players don't drag past ~15 minutes.
4. **Six fixed question intents, all hand-written answers.** Why: N5 learners ask a small set
   of questions, and scripted answers keep every clue fair and checkable.
5. **The LLM only writes a kana lead-in, never the answer.** Why: it must never block the turn
   or change a clue; a rephrase could leak or drop facts.
6. **A second miss falls back to the closest guess** (clue points still count, no question
   points). Why: a whole turn lost to recognition is worse than a slightly wrong question.
7. **Tapping a suspect counts as a vote with no bonus**, and a garbled spoken accusation gets
   one retry. A pick still counts when the phase ends. Why: speaking is rewarded, never required.
8. **The accusation check needs はんにん and the suspect's name**; the rest of the line is lenient.
9. **Speaking bonus 40 / 60 under the shared 30% cap** (pool of 3/7 of base points).
10. **The notebook is shared and on the stage**; key-clue flags are shown only in the finale,
    and the culprit only in `finale` views. Why: no spoilers in views (tested).
11. **Suspects are voiced with the browser's ja-JP `speechSynthesis` on the stage**, with
    per-suspect pitch and rate, not VOICEVOX. Why: no new audio pipeline for the backlog; can be
    swapped later.
12. **Chōchin-san hosts**, with five new host events (`onsen_case`, `onsen_turn`, `onsen_clue`,
    `onsen_accuse`, `onsen_reveal`) and 25 draft lines.
13. **Case choice:** a random case from `content.onsenCases`, or `extra.caseId` if given; with no
    content, the placeholder towel case in `fallback.ts`.
14. **English comes 2.5 s after the Japanese on the stage**; Kana-level phones also see kana and
    romaji.
15. **Phrasebook entries**: each intent asked (`onsen.q.<intent>`) and the player's accusation
    (`onsen.accuse.<case>.<suspect>`).

## Open questions

- Only the asker speaks each turn. Should the others get something to do (a "suspicious!"
  reaction, or a guess at what the suspect will say)?
- Player text (what was heard) is shown on the stage. It goes through `cleanText`, but there is
  no moderation; is that fine for party rooms?
- The lead-in window is 1.8 s minus latency. Opus is often too slow for it; Haiku should fit.
  Use a separate fast model for suspects?
- Should the VIP pick the case? Today only `extra.caseId` selects one (no menu yet).
- 3 cases is about one evening. How many cases for launch, and at which levels (N4 cases with
  conditional clues)?

## Known gaps

- All three cases and the 25 host lines are `status: 'draft'` and need the fluent-speaker check
  (C1), especially the confessions and the lenient matching keys.
- Bot accusations are naive: with chance `sleuth` (default 0.75) a bot votes for the
  suspect named most in the notebook, otherwise for a random hunch.
- The stage's suspect voices depend on the browser having a ja-JP voice; without one, text only.
- Answers are not pre-rendered audio, so the "audio before text" content note is only met by
  the 1.8 s thinking beat.
