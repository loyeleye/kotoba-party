# N4 and N3 sentence frames (matching groundwork)

Step 1 of the N4/N3 learning paths plan (the "Kotoba Party: N4 and N3 learning paths and new games" doc).
It teaches the game to recognise the sentence frames the Express Line (N4) and the first Limited Express
(N3) goals are built on, before any game asks players to say them. Nothing a player sees changes yet.

Code: `shared/src/japanese/frames.ts`. Tests: `tests/frames.test.ts`, lines in `tests/frame-cases/`.

## What's new

- **`framesOf(phrase, tokens?)`** names every frame in a line, N5 to N3, sentence by sentence:
  「あめに ふられたので、おくれました」 is the passive, ので and ＿ました. `frameOf` is unchanged: it still names
  the one N5 frame a phrase is built on, from the original sixteen, for the chips and the path.
- **87 frames.** The sixteen N5 frames (`FRAMES`), 17 more N5 frames the tiered path's goals need
  (`MORE_N5_FRAMES`), 50 N4 frames for goals 4.1 to 4.14 (`N4_FRAMES`, including the keigo-verb matcher),
  and the four N3 frames that need part of speech (`N3_FRAMES`: らしい, のに, うちに, reason ため).
  `FRAME_BY_ID` and `ALL_FRAMES` cover them all. Ids match the tiered path's goal list.
- **Part of speech.** The server's kuromoji tokens now carry the finer part of speech, the dictionary form
  and the conjugation (`detail`, `base`, `ctype`, `cform` on `UtteranceToken`).
- Every new frame and example is `status: 'draft'` until a fluent speaker checks it.

## How matching works

Each matcher is a regex on the kana and on the written text, with `not` for look-alikes. Some also read
the tokens:

- **Needs tokens** (`pos: 'need'`): ＿の＿, adjective + です, と as "if", ＿し、＿し, the ichidan passive,
  ＿させて ください. Without tokens (the phone) they're left out. Missing a frame is fine; naming the wrong
  one isn't.
- **Tokens can veto** (`pos: 'veto'`): the spelling decides, and the tokens can only say no.
- **Spelling only**: everything else.

**kuromoji misreads kana-only text** (やさい as an adjective, うち always "home", ため as ためる, ふるそう
as "looks old"). So a token hit on a line with no kanji must also pass a kana check (`kanaOnly`), and some
frames the plan named for part of speech go by spelling instead:

| Frame | How it's told apart |
| --- | --- |
| そう (looks / I hear) | The kana before そう: a plain form (ふる, たべた, だ, ない) is hearsay, a stem (ふり, おいし, なさ) looks. An い ending (かいそう / おいしいそう) needs the tokens |
| Passive | Tokens when the line has kanji. In kana: a godan or する passive after someone who did it (みんなに わらわれた), minus ichidan verbs that end in あ-row + れる (わかれる, うまれる). Ichidan られる needs a を object to rule out "can" |
| らしい | After a plain form, not the adjectives (あたらしい) or おとこらしい. Nらしい only at the very end |
| のに | After a plain form, not purpose のに (きるのに つかう) |
| うちに | After ない, ている, な or an adjective, not before going home or living (おおきい うちに すむ) |
| ため | Purpose after a non-past verb or Nの ために "for"; reason after た, an adjective, な or a cause (あめの ため). Other Nの ため is left out: it reads both ways |

When two frames hit the same sentence and one says more (＿て もらえますか is also a ＿ますか question),
only the more specific one is named (`hides`).

## The precision bar

Every matcher finds its frame in at least 10 positive lines and in none of 10 look-alikes. The N5 lines
are real game lines where the game has them (probes are marked). The N4 and N3 lines are written for the
test: there's little N4 content yet. A sweep over all ~10,000 Japanese strings in the game's content found
and fixed more misfires (かんとく as 〜とく, なんと いいますか as a report, かしら as an embedded question).

## Known gaps (on purpose)

- Plain requests (もらえる？) and casual forms beyond 〜てる／〜とく, ＿んだ and ＿よ／ね／の are thin.
- ご＿ください is left out of お＿ください (it's the N3 service frame).
- `frameStats` and the path still use `frameOf`. Switching them to `framesOf` (with the server's tokens)
  is step 2's job, with the hard roles that produce N4 lines.
