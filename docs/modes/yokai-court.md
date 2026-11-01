# Yōkai Court (妖怪裁判)

Host: Fude-san, the presiding judge. Kana–N3. 4–8 players. A studio mystery goes to trial: Fude-san reads
the case, asks the witness one question, and two lawyers, paired by level, argue at the same time on missions
written for that testimony. Everyone else (the witness too) answers one question about the arguments, then
votes: who won you over? A tie is not guilty (疑わしきは罰せず). Step 6 of the N4/N3 learning plan.

Code: `shared/src/modes/yokaiCourt/` (rules and views in `court.ts`; cases, lines, tiles, gists, checks and
chunks in `cases.ts`), `stage/src/modes/yokaiCourt.{ts,css}`, `controller/src/modes/yokaiCourt.{ts,css}`,
`tools/bots/policies/yokaiCourt.ts`, `tests/yokaiCourt.test.ts`, pictures in `stage/assets/court/` (and
reused yōkai portraits from `hotline/`, `late/` and `fx/`). Design: the plan doc's "Yōkai Court" section,
the v2 storyboard (`learning-path/storyboards/v2/yokai-court.html`, frames 01–10) and its panel notes.
Every line is `draft` until a fluent check.

## Why it works for speaking

Arguing a case is quoting, concluding and denying: と いって いました, なければ なりません and なくても いいです
at N4, に よると, に ちがいありません and わけでは ありません at N3, ＿が ありました, ＿に いました and ＿じゃ
ありません at N5. Each lawyer gets private evidence (the prosecution a clue left behind, the defence where the
accused really was), so the judges' check is about something only the argument said. Lawyers are paired by
the closest level, so the better idea wins, not the bigger vocabulary. Kana lawyers pick one or two of three
tiles (a claim, their evidence, an answer to the testimony) and can say them, or let Fude-san read them.

## A case

| Phase | Beat | Length | What happens |
|---|---|---|---|
| prompt | case | 7 s | The case scroll (title in kanji with furigana), the accused and the evidence line. Phones: role cards. |
| prompt | ask | 6 s | Fude-san asks なにか 見ましたか？ The witness taps one of four answers: みました, みていません, it was another yōkai, or the curveball (a second suspect, with a leaf). No answer in time: みていません. |
| prompt | testify | 6 s | The answer on the TV (Fude-san says it unless the witness said it out loud). A curveball adds a NEW SUSPECT card. Lawyers get their mission and evidence; judges a private hunch (no points). |
| prompt | plan | 8 s | Both lawyers plan in private ("Need a hint?" shows Fude-san's way). Kana lawyers pick tiles. Ends early when both are in. |
| answer | record | 6 s Kana, 9 s N5, 12 s N4/N3, then 3.5 s to upload and 1.5 s grace | Both record at once. Typing works from the plan beat (quiet mode, no mic). The mic pass lets Fude-san read the level line once a game, for half points; a blocked mic gets a free read that scores nothing. Nothing in: Fude-san stands in and the seat scores nothing. |
| reveal | play ×2 | each clip + 0.5 s; Fude-san's reading 4.5–9 s | Prosecution, then defence. The TV shows only who is talking and a playhead (typed words show, since they have no sound). Judges' phones show the Listening card: the main claim at their level, never the detail the check asks about. |
| reveal | check | 4 s, ends when every judge is in | One question about one side's evidence (the side alternates by case): "What did the prosecution say was left behind?" or "Where did the defence say the accused was?", three pictures. +50 if right; a wrong answer never voids the vote. |
| encore | gist → vote | 4 s + 8 s | Both arguments side by side: pictures, the line with furigana, English. One vote from every judge; change it until the timer ends. |
| score | verdict | 8 s | Tokens drop into two pans, Fude-san's brush writes 有罪 or 無罪 and the hanko lands, then the points (checks, then lawyers) at 4.4 s and the case's real story. |
| score | booth | 7 s | Only when a lawyer's own words used a chunk, and never two cases in a row. |

Cases: 3 for 4–6 players, 4 for 7–8, so everyone argues at least once. Typical case ≈ 80 s, worst 99 s.

## Roles

- **Lawyers:** whoever has argued least, paired by the closest level; the one with fewer prosecutions
  prosecutes. Prosecution is always left, vermilion, ⛓; defence right, sky blue, 🕊, a dashed edge.
- **Witness:** whoever has been witness least. Answers, then judges with everyone else.
- **Judges:** everyone who isn't a lawyer. Lawyers never vote in their own case.

## Scoring

| Who | Points |
|---|---|
| Lawyer | 200 for winning the vote (a tie goes to the defence; nothing when nobody voted) |
| Lawyer | 50 per vote for their side |
| Lawyer | Half of both on a mic pass; none for a stand-in, a free read, or an argument the VIP hid |
| Judge | 100 for voting with the majority (three voters or more, never on a tie) |
| Judge | 50 for a right check, unless the side's argument is known not to have said its evidence (then nobody scores it) |
| Witness | Scores as a judge. The curveball scores nothing: it changes the case. |

## Learning path

A speaking lawyer's level line goes in the phrasebook (`court:<case>:<testimony>:<side>:<level>`). It counts
as said only when their own clip used one of their level's chunks (naming the alibi alone doesn't say
わけでは ありません); said is from memory, or read if they opened the hint. A clip with no speech-to-text is
said but read. Typing, Fude-san's reading and a hidden argument are seen. A Kana lawyer's tiles are said
(read) when their own take used them, else seen. The witness's answer is said (read) when they said it out
loud too, else seen. Frames are found from the line's kana (`framesOf`), so the N4 lines feed 4.2 (なければ,
なくても いい) and 4.6's と いって いました; the N3 lines feed 4.13, 4.14 and Limited Express once those goals land.

Path goals: 4.2 today. TODO(n3): 4.13, 4.14, 3.1, 3.2, 3.3, 3.4, 3.7 and 3.10 once the progressive-learning
work adds them, and `CourtLevel` (`Level | 'n3'`) becomes `Level`.

## Open, for playtests

- The reconnect hold (the TV waits up to 10 s for a lawyer whose clip is still uploading) isn't built: a
  phone that drops keeps its take and retries until the record beat ends, then Fude-san stands in.
- The check side alternates by case; a playtest decides whether judges learn to listen only for that side.
- Courtroom facts (who sits where, what a lay judge 裁判員 does) to check against courts.go.jp before the
  lines leave draft.
- The courtroom set (`scenes/yokai-court.png`) isn't drawn: the tea room stands in.
