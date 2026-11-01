# Murder at the Onsen (interrogation whodunit)

Host: Chōchin-san, off duty at the inn. 1–8 players. The VIP picks 2, 3 or 1 questions each
(`roundChoices`). Mode id `onsen-murder`.

Code: `shared/src/modes/onsenMurder/` (rules; `questions.ts` question matching, tiles and the
accusation line; `deputy.ts` the N4 deputy's report tiles and check; `fallback.ts` placeholder case), `content/src/onsen/cases.ts` (8 draft N5
cases: 3 for everyone, 1 Kids, 4 Cheeky), `stage/src/modes/onsenMurder.ts` (+ `.css`), `controller/src/modes/onsenMurder.ts`
(+ `.css`), `tools/bots/policies/onsenMurder.ts`, `server/ai/suspect.ts` and
`server/src/onsen.ts` (optional LLM lead-ins), `tests/onsenMurder.test.ts`.

## Flow

| Phase | What happens | Host cue |
| --- | --- | --- |
| `intro` (Case file) | The victim (a thing, not a person), where it happened, the suspects with roles, the evidence item. 25 s. | `onsen_case` |
| `answer` (Question) | One player's turn, by seat. They pick a suspect on the phone and ask one question: said aloud, typed, or built from tiles. 40 s (50 s at Kana level). Ends as soon as a question lands. | `onsen_turn` (`name`) |
| `reveal` (Answer) | The suspect "thinks" for 1.8 s, then the scripted Japanese answer appears and is spoken (browser ja-JP voice, per-suspect pitch and rate); the English follows 2.5 s later. A new clue goes into the shared notebook. 10 s (12 s with a new clue). | `onsen_clue` on a new clue; `onsen_report` (`line`) when the deputy's report is accepted, then `onsen_deputy_cheer` (`name`); `onsen_standin` (`line`) once a game in a 1–2-player room with nobody at N4 |
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

### The deputy (N4 hard role)

When the room has an N4 player, each turn one of them (never the asker) is offered the deputy's part on
their phone while the question is asked, on the shared offer card (`roleOffer`: "🕵️ Chōchin-san needs a
deputy this turn.", じょしゅ / Deputy), with the two frames (＿と いっていました ／ ＿に ＿られました), the note on
みられました, and two equal buttons: "Take it" or "Not this time" (which keeps the ordinary part: just
watch). Who is offered follows the shared rotation (`nextOfferee` in `hardRoleLog.ts`): the N4 player
offered fewest times, then longest ago; a "not this time", or an offer left to run out, sits the next turn out; in a room of four or
more nobody is deputy two turns running. After the answer the deputy tells the room what the suspect
said:

- **Reported speech** (4.14 ＿と いっていました) for most answers: たなかさんは 12じに ねたと いっていました。
- **The passive** (4.13 ＿に ＿られました) for a sighting: さとうさんは 8じはんに だいどころの まえで いとうさんに みられました。
- A few also use ために, ＿そうでした and ので.

Every answer of all eight cases (the three for everyone, the Kids case and the four Cheeky ones) has
its report written beside it (`report` in `content/src/onsen/cases.ts`, draft). The phone's report box fades in once the answer and its subtitle
are up, and shows the frame (＿は ＿と いっていました) and its note over a speak box; the report's tiles,
shuffled, sit behind "Need the words? Build it from tiles (one is a spare)" (open after a miss), so the
line is checkable. **The tiles leave the polite→plain step to the deputy**: in reported speech the quoted
verb is a tile of its own in plain form (いた), と いっていました is one tile, and the suspect's own polite
form (いました, from `politeForm`) is a decoy beside it; only the plain form before と いっていました
builds the report. A passive report gets the active みました as its decoy beside みられました. The notes
under the frame: before a first try only the rule, "＿と いっていました takes the plain form, not the ます
form." (`reportRule`, so the note doesn't hand over the answer); after a try, "＿と いっていました takes the
plain form: they said いました, you report いたと". For a passive report it is always "みられました is the
passive of みる: “was seen” (by the one marked with に). Not the potential みられる, “can see”." (on the
offer card too). The nine passive reports carry the `passive` tag, but their kana ichidan みられました with
no を is never named passive by `framesOf`; the deputy is credited by the tag, not by the frame matcher.
Opening the tiles before a first try sends `report-peek`: the report that follows is still paid as usual,
but goes in the phrasebook as seen (`recall: 'read'`), not said from memory.
The deputy says or types it, or builds it (`deputy.ts`: the frame's last two words must be there, then
the whole line within a few kana or 70% of its words; a passive report fails if the one who saw is
marked with を or が instead of に, or if it has no られ: the active みました is near enough in sound to
slip through otherwise). Two tries; after a miss the whole line is shown. The stage shows the
report under the answer, and **Chōchin-san says it on the TV** (`onsen_report`): the deputy's own
recording never plays there. He always voices the model line (fixed, fluent and safe for the TTS),
whatever the deputy said, typed or built, with its subtitle. The cue carries the
line as the `{line}` slot with `line_kana` and `line_en` (bank line `chochin.onsen_report.01`). It
waits until 5.8 s into the answer (`REPORT_VOICE.after`: think + subtitle + 1.5 s), so it never talks
over the suspect's answer. Once he has said it (`reportVoiceMs`: 1.5 s + 0.11 s a kana, at most 7 s) he
reacts with one short bank line (`onsen_deputy_cheer`: おみごとです！, いい ほうこくでした, …), and the answer
stays up for the line, the reaction (`REPORT_VOICE.cheer`, 2.5 s) and the booth's replay, whichever is
longer, so the next turn's line doesn't cut them off. That time sits inside the deputy's extra 15 s; it
only exists when the part was taken and the report landed. The phase deadline still wins: a report in
the very last seconds can be cut short. A miss, a decline or no N4 player: nothing is said.

**Mixed rooms** (the shared pieces in `mixedRoom.ts`, docs/n4-hard-roles.md):

- **Gallery.** Once the deputy has taken the part (Take it, or a first try) and the answer has a report,
  every other connected player gets one reaction tile for the answer (👏 すごい！ 💡 なるほど 😮 へえ！ 📣 がんばれ！),
  shown as bubbles under the deputy's panel on the TV, never scored. Once a game, after the report has
  landed, a Kana or N5 player who hasn't reacted yet gets the curveball instead (who rotates with the
  turn): "Which word did you hear?", with the report's frame word and two near misses: いっていました
  among いっています, いいました, いきました, or みられました among みました, みせました, みえました (never a word
  the report itself contained). **+5 if right**, into the ordinary score (and the bonus pool's base, like
  any other points). A report that never lands deals none. While it is unanswered the booth on the TV
  doesn't light the word. Not for an untouched or declined offer.
- **Commentary booth.** Once the report lands, the deputy's panel on the TV adds the replay
  (`boothStrip`): the line with its frame word lit and one English note on the play (と いっていました =
  "said that…": the suspect's ます form made plain before と; みられました = "was seen", turned round with
  に). It appears as Chōchin-san starts the line and runs `commentaryMs` (5–7 s). Kana and N5 phones get
  the gist: the suspect's own N5 answer in kana (romaji for Kana) with the report's English. The host
  voices only the model line (`onsen_report`), never the deputy's words.
- **Host stand-in.** In a room of one or two players with nobody at N4 (`hostStandsIn`), there is never
  a deputy, so once a game, on the first answer that has a report, Chōchin-san gives the report himself
  (`onsen_standin`, bank-only `{line}`) 5.8 s in, with its subtitle on the TV ("🏮 Chōchin-san reports",
  frame word lit) and the gist on the phones. Nobody is asked to say anything; no points. That one
  answer may run a little past its usual 10–12 s, to at most 12.8 s (5.8 s + at most 7 s of voice).

| | Points |
| --- | --- |
| Report said or typed | 30 |
| Report built from tiles | 10 |
| Report said aloud | +40 speaking bonus (same pool and cap) |
| A player's fifth report a game and after | 0 (still voiced and replayed for the room) |
| Gallery curveball right (once a game, a Kana or N5 player) | 5 (30 with `scaledCurveball`: a tenth of the culprit's 300, for Ladi to confirm) |
| Gallery reaction said out loud (`spokenReaction`) | 2 |

The answer runs 15 s longer only for a deputy who tapped "Take it" before it came in (or has had a
try), and ends once they're done and the answer has had its usual 10–12 s (a `wake`). An offer nobody
answered adds no time, but the deputy can still report in the usual time, and a first try counts as
taking it. An answer with nothing to report (a shrug, the placeholder) voids the offer. Kids and
Cheeky rooms get the deputy like any other room. Every offer and its outcome (accepted, declined, timeout, away; the shared `OfferAnswer` in
`hardRoleLog.ts`) is in `deputyLog`; `deputyOffers()` sums it per player with the gate rate
(`offerRate`, "accept at least 60%"); `deputyOffered` keeps every offer made, voided ones too, for the
rotation. Phrasebook:
`onsen.report.<case>.<suspect>.<intent>`. Kana and N5 players' parts and scores don't change, and with no
N4 player nothing changes.

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
13. **Case choice:** a random case from `content.onsenCases` that suits the room's Audience, or
    `extra.caseId` if given; with no content, the placeholder towel case in `fallback.ts`. Cases
    without an `audience` play everywhere. A Kids room also gets the ice cream case (shorter, the
    inn's puppy did it) and a Cheeky room four grown-up cases: sake (a hungover new hire who
    "never drinks" and the boss's two-hour karaoke), smartphone (a first date who drowns her
    phone-obsessed date's phone), toupee (an employee fishes the credit-stealing president's
    toupee off his head) and candle, the spooky one (on a night of 100 ghost stories, a horror
    writer who is scared of everything blows out the 100th candle so the inn's real ghost can't
    appear; the ghost is a suspect, and innocent). Ladi asked that only one lean on drinking. A
    Kids or Cheeky room plays one of its own cases half the time, and a Family room never sees
    them (2026-10-27).
14. **English comes 2.5 s after the Japanese on the stage**; Kana-level phones also see kana and
    romaji.
15. **Phrasebook entries**: each intent asked (`onsen.q.<intent>`) and the player's accusation
    (`onsen.accuse.<case>.<suspect>`).
16. **The deputy (N4) is offered every turn to an N4 player who isn't asking** (by the shared rotation
    since round 4, see 25), with reports
    hand-written per answer rather than generated: turning a polite answer into a plain-form quote isn't
    safe to do by rule. Sightings (だれを みましたか) are reported in the passive, everything else in
    reported speech (2026-11-01).
17. **A polite direct quote passes the deputy's check** (いましたと いっていました): it is still correct
    Japanese, and the check leans towards accepting. Dropping a fact (both times) fails.
18. **Deputy points: 30 said or typed, 10 from tiles, +40 spoken bonus under the shared cap**
    (2026-11-01, down from 60 / 30, so saying it aloud is most of the reward and tiles are the fallback).
    A guess to tune in playtests; a clue is worth 100, so the deputy never outscores the detective.
19. **The deputy's answer time is +15 s, only when they took the part** ("Take it" before the answer)
    or have tried, ended early once they're done and the answer has had its usual time. An untouched
    offer doesn't hold the room up (2026-11-01).
20. **Spotlight: in a room of four or more, nobody is deputy two turns running** (a lone N4 player then
    gets every other turn), so the part isn't theirs on every turn (2026-11-01, for Ladi to confirm; now
    the shared rule in `nextOfferee`).
21. **Passive reports check the particle on the one who saw** (に, not を or が), since the lenient sound
    check would otherwise pass a sentence that says the opposite (2026-11-01).
22. **Some sightings are reported as speech** where the passive would lose a fact: Suzuki's sighting
    keeps the big pot (すずきさんは … たなかさんが おおきい なべを もって いたと いっていました), and
    Hayashi's keeps Tama asleep in the lobby. Others gain where (だいどころの まえで, おふろの まえで)
    (2026-11-01, draft).
23. **The Kids and Cheeky cases have deputy reports too** (decided by Ladi, 2026-11-01): all 90 are
    hand-written drafts in the same style, reported speech for most and the passive for a sighting
    (ポチは 2じはんに しょくどうで はなちゃんに みられました), keeping each answer's clue words. Sightings that
    hinge on more than where (Nishimura's red face, the flask in his hands, Morita angry, Miki going to
    the hot spring, Kudō shaking, Oyuki a guest since 1926) are reported as speech, as with Suzuki's.
    Kids reports stay gentle; Cheeky ones keep the cases' jokes (じぶんのか どうか わからない, あしは ない).
24. **The host says the deputy's line** (decided by Ladi, 2026-11-01: "Instead of the TV playing the N4
    player's recorded clip, have the host say the line"): Chōchin-san voices the accepted report's
    model line on the TV, after the suspect's answer, as one beat.
25. **Who is offered the deputy follows the shared rotation** (`nextOfferee`, round 4, 2026-11-01):
    fewest offers, then longest ago, instead of seat order; a "not this time", or an offer left to run
    out, sits the next turn out.
    Voided offers (nothing to report) still count as offers for the rotation, not for the gate rate.
26. **The tiles leave the polite→plain change to the deputy** (round 4, from the panel): the quoted verb
    is its own tile in plain form, と いっていました is one tile, and the suspect's polite form is a decoy
    beside it; only plain + と いっていました passes. The decoy comes from a small rule set
    (`politeForm`, checked against every report) rather than hand-written per answer; round 5 adds the
    ～かった verbs (かった → かいました, not an adjective's かったです), こない / こなかった, ～ていた, and the
    う-verbs that look like る-verbs (かえる → かえります, はいる, しる, はしる…). A passive report's
    decoy is the active みました. Spoken or typed reports are unchanged: a polite direct quote still passes
    (17).
27. **A spoken passive report needs られ** (round 4): みました for みられました is near enough in sound for the
    lenient check, and it says the opposite.
28. **Mixed rooms** (round 4, the shared pieces): the Gallery opens only once the deputy has taken the part
    (Take it or a first try); the curveball's word is the report's frame word (いっていました / みられました),
    +5, once a game, dealt only after the report has landed (round 5), with near-miss distractors. The booth's gist on Kana and N5 phones is the suspect's own N5 answer with the
    report's English, so they see the same news in Japanese they can read (for Ladi to confirm).
29. **Chōchin-san reacts to a landed report** with one short bank line (`onsen_deputy_cheer`) after he has
    said it, 2.5 s, inside the deputy's extra time (round 4, for Ladi to confirm).
30. **The host stand-in reports the first answer that has a report**, once a game, in a 1–2-player room
    with nobody at N4 (`onsen_standin`); the answer runs to at most 12.8 s for it (round 4, for Ladi to
    confirm).
31. **The ramen report reads じぶんの ラーメンが きらいだったと** (round 4, from the panel: きらい takes が; the
    line was ラーメンを きらいだった).
32. **Only a player's first four reports a game score** (`POINTS.reportsPaid`, round 5, from the panel): an N4
    player is deputy on most turns in a small room, so without a cap the reports alone could outscore the
    detectives. Later reports pay 0 points and no speaking bonus, and are still voiced and replayed.
33. **The notes before a first try give only the rule** (round 5): the full note names the plain verb
    (いたと), which is the answer.
34. **Opening the tiles before a first try counts the report as seen** (round 5): it is recorded as read in
    the phrasebook, not said from memory. Points don't change.
35. **Two answers reworded** (round 5, from the panel, draft): Tanaka's report says スープを つくる ために
    (ために after a verb, not スープの ために), and Nishimura's necktie answer is ぼくのか どうか わかりません
    (with ＿か どうか, `ka-dou-ka`) in place of ぼくのじゃ ありません。…たぶん.

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

- The deputy: should a 2-player room with one N4 player get a deputy every other turn only? (The
  recorded clip: decided by Ladi, the host says the line instead; see decision 24. Reports for the
  Kids and Cheeky cases: decided by Ladi, yes; see decision 23.)

## Known gaps

- The deputy: the bots never take the deputy's part (an N4 bot's offer just times out), nor tap Gallery
  tiles; the modes can't tell a bot from a player, so a bot in the room gets a Gallery tile and counts
  towards the stand-in's "one or two players". The 150 reports are draft and need the fluent check, the 90 Kids and
  Cheeky ones (2026-11-01) especially: もりたさんは しゃちょうが いつも もりたさんの しごとを じぶんの しごとだと
  いうと いっていました is long for a tile builder.

- The ice cream, sake, smartphone, toupee and candle cases have no pixel art yet: their suspects, victim and item show
  emoji until portraits and icons are made.
- All eight cases and the 32 host lines are `status: 'draft'` and need the fluent-speaker check
  (C1), especially the confessions and the lenient matching keys.
- Bot accusations are naive: with chance `sleuth` (default 0.75) a bot votes for the
  suspect named most in the notebook, otherwise for a random hunch.
- The stage's suspect voices depend on the browser having a ja-JP voice; without one, text only.
- Answers are not pre-rendered audio, so the "audio before text" content note is only met by
  the 1.8 s thinking beat.
