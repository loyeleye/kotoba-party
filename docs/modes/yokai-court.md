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

Arguing a case is quoting, concluding and denying: と いって いました, に よると, なければ なりません and
なくても いいです at N4 (the N4 lines put a new verb in なければ / なくても each case: 作ら, 買わ, 直さ, 入れ, 返さ,
探さ), に ちがいありません and わけでは ありません at N3, ＿が ありました, ＿に いました and ＿じゃ ありません at N5. Each lawyer gets private evidence (the prosecution a clue left behind, the defence where the
accused really was), so the judges' check is about something only the argument said. Lawyers are paired by
the closest level, so the better idea wins, not the bigger vocabulary. Kana lawyers pick one or two of three
tiles (a claim, their evidence, an answer to the testimony) and can say them, or let Fude-san read them.

## A case

| Phase | Beat | Length | What happens |
|---|---|---|---|
| prompt | case | 7 s | The case scroll (title in kanji with furigana), the accused and the evidence line (the damage only, never the clue the check asks about). Phones: role cards. |
| prompt | ask | 6 s | Fude-san asks なにか 見ましたか？ The witness taps one of four answers: みました, みていません, it was another yōkai, or the curveball (a second suspect, with a leaf). No answer in time: みていません. |
| prompt | testify | 6 s | The answer on the TV (Fude-san says it unless the witness said it out loud). A curveball adds a NEW SUSPECT card. Lawyers get their mission and evidence; judges a private hunch (no points). |
| prompt | plan | 8 s | Both lawyers plan in private ("Need a hint?" shows Fude-san's way). Kana lawyers pick tiles and tap Done. Ends early when both are in. |
| answer | record | 6 s Kana, 9 s N5, 14 s N4, 15 s N3, then 3.5 s to upload and 1.5 s grace | Both record at once. Typing works from the plan beat (quiet mode, no mic). The mic pass lets Fude-san read the level line once a game, for half points; a blocked mic gets a free read that scores nothing. Nothing in: Fude-san stands in and the seat scores nothing. |
| reveal | play ×2 | each clip + 0.5 s; Fude-san's reading 4.5–9 s | Prosecution, then defence. The TV shows only who is talking and a playhead (typed words show, since they have no sound; Fude-san's reading shows no English until the gist). Judges' phones show the Listening card: the main claim at their level, never the detail the check asks about. |
| reveal | check | 4 s, ends when every judge is in | One question about one side's evidence (the side is drawn by chance every case): "What did the prosecution say was left behind?" or "Where did the defence say the accused was?", three pictures. +100 if right; a wrong answer never voids the vote. The alibis aren't the yōkai's folklore home (that's a decoy), so lore can't answer it. |
| encore | gist → vote | 4 s + 8 s | Both arguments side by side: pictures, the line with furigana, English. One vote from every judge; change it until the timer ends. |
| score | verdict | 8 s | Tokens drop into both pans in turn, each pan's count pops by 1.3 s, the scroll unrolls and Fude-san's brush writes 有罪 or 無罪 top to bottom from 1.66 s (her host row is kept up for the whole beat, so nothing moves), then the 筆 seal lands at 2.3 s with her verdict line, the reading and the English (never before), then the points at 4.4 s and Fude-san tells the case's real story at 5.0 s. Two codas convict the accused, two blame someone else, two blame nobody, and each explains the clue. |
| score | booth | 7 s | Only when a lawyer's own words used a chunk, and never two cases in a row. |

Cases: 4 for 4 players (everyone argues twice), 3 for 5–6, 4 for 7–8, so everyone argues at least once. Typical
case ≈ 80 s, worst 102 s.

Every timed beat (case, ask, testify, plan, record, check, gist, vote) has a gold bar on the TV that runs out, and
the phones show the same clock as a thin bar under the role band on case, ask, testify, plan, check, gist and vote
(the record button keeps its own ring). The view carries `stepEndsAt` for beats with their own timer, and the
corner clocks on the TV and phones count down to it, so the clock and the bar agree; the rest run to the phase's
deadline.

## Roles

- **Lawyers:** whoever has argued least, paired by the closest level; the one with fewer prosecutions
  prosecutes. Prosecution is always left, vermilion, with a sealed scroll; defence right, sky blue, with a sunflower
  badge (the Japanese lawyer's badge) and a dashed edge. Role icons are 32×32 pixel art (`stage/assets/court/role-*.png`),
  with 📜 🌻 ⚖ 👁 standing in if a picture is missing. No chains: nobody goes to prison here.
- **Witness:** whoever has been witness least. Answers, then judges with everyone else.
- **Judges:** everyone who isn't a lawyer. Lawyers never vote in their own case. A VIP who is arguing can't hide
  the other side's argument.

## Scoring

| Who | Points |
|---|---|
| Lawyer | 200 for winning the vote (a tie is 無罪 but splits the 200 between both lawyers; nothing when nobody voted) |
| Lawyer | 50 per vote for their side |
| Lawyer | 25 per judge who got the check right, for the checked side's lawyer: their evidence got through |
| Lawyer | Half of all that on a mic pass; none for a stand-in, a free read, or an argument the VIP hid. The phone says why |
| Judge | 100 for a right check, unless the side's argument is known not to have said its evidence (then nobody scores it) |
| Judge | 50 for voting with the majority (three voters or more, never on a tie): listening pays more than guessing the crowd |
| Witness | Scores as a judge. The curveball scores nothing: it changes the case. |

## Learning path

A speaking lawyer's entry goes in the phrasebook (`court:<case>:<testimony>:<side>:<level>`). It counts as said
only when their own clip used a chunk at their level or above (naming the alibi alone doesn't say わけでは
ありません), and then the entry is their own words, so the path credits only the frames they really said (one
chunk never credits Fude-san's whole line). Said is from memory, or read if they opened the hint. A clip with
no speech-to-text is said but read, and logs Fude-san's line. Typing, Fude-san's reading and a hidden
argument are seen. Typed kanji are read by the server (池に いました matches いけに). A Kana lawyer's tiles are
said (read) when their own take has every picked tile in it, else seen. The witness's answer is said (read)
when their take has the answer in it (any try counts with no speech-to-text), else seen. "The recogniser heard
it" is all the game knows: it doesn't check pronunciation.

A Kana judge who checked or voted keeps one word: the check's answer (the clue or the alibi place), with its
picture, kana, romaji and English on the verdict card, logged as seen (`court:word:<thing>`). A Kana lawyer's
verdict card is a recap of their tiles in the order sent (kana, romaji, English, the evidence tile marked),
whether they said every tile, some, none, or Fude-san read them, and whether the evidence went out (or was picked
but not heard). A tile counts as said only when the take has the kana after the yōkai's name, so saying only
ざしきわらし doesn't count. The keep word is logged with a plain gloss (cucumber, pond), not the sentence English.

Frames are found from the kana (`framesOf`). Path goals: 4.2 (なければ, なくても いい), 4.6 (に よると, そうです),
4.14 (と いって いました), and on the Limited Express 3.1 (に よると, optional there), 3.7 (わけでは ありません)
and 3.10 (に ちがいありません).

## Open, for playtests

- The reconnect hold (the TV waits up to 10 s for a lawyer whose clip is still uploading) isn't built: a
  phone that drops keeps its take and retries until the record beat ends, then Fude-san stands in.
- Log judges' check accuracy by side in playtests.
- Romaji: the court spaces に and じゃ before `toRomaji` (Kappa ja nai, yane ni ita). The shared `toRomaji` still
  glues them elsewhere, for its own fix.
- Pixelify's 2 reads as 8, so the court's numbers (case number, scores, seats, the record timer) use the
  body face. Its C read as O ("Yōkai Oourt") until Kotoba Pixel redrew it (2026-11-01); the word labels
  are back on the pixel face.
- Courtroom facts (who sits where, what a lay judge 裁判員 does) to check against courts.go.jp before the
  lines leave draft.
- The courtroom set (`scenes/yokai-court.png`, 2026-11-01) seats nine on the bench, as a lay-judge trial
  (裁判員裁判) does (three judges, six lay judges). Check its layout (which side the prosecution sits, the
  witness stand) against courts.go.jp with the other courtroom facts.
