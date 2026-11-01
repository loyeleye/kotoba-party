# Last Train (spoken survival)

Host: Chōchin-san, the paper-lantern ghost conductor. 1–8 players. The VIP picks 4 or 6 stops.

Code: `shared/src/modes/lastTrain/` (rules, `check.ts` answer checking and romaji, `fallback.ts`
placeholder content), `stage/src/modes/lastTrain.ts`, `controller/src/modes/lastTrain.ts`,
`tools/bots/policies/lastTrain.ts`, `tests/lastTrain.test.ts`.

## Flow

| Phase | What happens | Host cue |
| --- | --- | --- |
| `intro` (Departure) | Scenario title, departure line, the route with every stop named. | `train_departure` (slots `title`, `stops`) |
| `prompt` (each stop) | The stop's name and announcement, the minigame's shared situation. The last stop also shows the twist. | `train_stop` (`stop`), last stop `train_last_stop_twist` |
| `answer` | Every phone gets its own item from that stop's minigame at the player's level. Spoken (or typed) answer; one private retry with the hint; room overrule votes. Ends early when everyone is resolved and no vote is open. | `room_overrule` (`name`) on a successful overrule |
| `reveal` | The stage shows each player's prompt, what they said, the natural version and the points. A player who missed is asked to say the natural version once (no points). | `reveal_react` (tier: all right = ippon, half = good, else flop); `train_revive` (`name`) |
| `penalty` | Only if a living player missed twice, at a stop whose minigame isn't `forgiving` (Read the Signs is). One item from a `penalty: true` minigame (Calendar Crunch, Counter Chaos, Particle Panic), one attempt; the room can still overrule. Failing makes a ghost. | `miss_kind`, then `train_ghost` (`name`) per new ghost |
| `finale` (Platform Dash) | Rapid questions from `scenario.platformDash`; each right answer is one step; 6 steps to the door. Ghosts start 2 steps back. First aboard wins. Ends early when everyone is aboard. | `platform_dash` |
| `score` | Dash results and the twist line. | |
| `recap` | Room standings, awards and each player's phrasebook ("travel survival kit"). | `recap_award` (room) |

### Building the line

- Stops come from a `LastTrainScenario` whose minigames all exist. Prefer one with exactly the
  chosen number of stops; else the shortest longer one (trimmed, keeping its last stop so the
  twist stays last); else the longest shorter one, padded with stops built from available
  minigames (placeholder station names, inserted before the last stop).
- Minigames come from `ctx.content.lastTrainMinigames`. With no content at all, the mode uses a
  tiny placeholder set in `fallback.ts` (Konbini Math, Meet the Innkeeper, a Counter Chaos
  penalty and a 6-item dash) so it always runs end to end.
- The template engine is generic: any minigame works from its `promptType`, `visual`,
  `accepted`, `hint`, `model` and `timeLimit`. Special handling by prompt type:
  - `fill-particle` (and `particle-panic`): は / へ / を said as わ / え / お are accepted.
  - `listen-and-answer` (Station Announcement): the phone reads the prompt aloud with
    `speechSynthesis` (ja-JP) and hides the text until the retry; with no voice available it
    shows the text after 2.5 s.
  - `read-aloud`: the speech bonus is halved (reading, not from memory).
  - Items with `signs` (Read the Signs): the phone draws each as a station board, only the kanji
    and a drawn arrow on it, with no reading (reading it is the task). Exits are yellow, toilets
    blue and red, other signs dark. A pair of boards always shares one row, and is drawn plain on
    the first try, since colour would give the answer away. The TV reveal shows the boards too,
    with the asked-about sign outlined, and so does the overrule vote.

### Read the Signs (看板を読もう)

Kanji as icons, the way a traveller first meets them: read like traffic signs long before anyone
writes one (from the learning path's ideas, [progressive-learning.md](../progressive-learning.md)).
17 items in `content/src/last-train/read-the-signs.ts`:

- **Kana:** 駅, 出口, 入口, 男, 女 read out loud, then "Where's the exit?" with 出口 and 入口,
  and "Where's the women's toilet?" with 男 and 女 (answer ひだりです / みぎです, or 出口は左です).
  Kana phones show a "← ひだり · ↑ まっすぐ · みぎ →" strip under a pair of boards.
- **N5:** the four station exits 北口, 南口, 東口, 西口, and 切符, then which way to the south exit
  and to the ticket office (↑: まっすぐです).
- **N4:** 改札, 乗換, and which way to the east exit (東口は右のほうです).

Direction questions are written in kana only, so the sign they ask about never appears in them,
and half the deals come mirrored (`mirror` on the item; the dealt id ends in `~mirrored`, and
`itemIndex` has both). A one-sign item is never dealt at a stop whose name or announcement spells
it (no 北口 at Kitaguchi).

N5 and N4 hints are pictures to remember a kanji by (駅's horse, 男's rice field over strength,
北's two people back to back), never the reading. A Kana player may never have heard the word, so a
Kana retry gives the reading to say ("It reads えき (eki). Say it!") with the picture for next time.
Models quote the sign (「男」です。), since 男です。 can mean "I'm a man". The minigame is
`forgiving`: these are first meetings with kanji, so a miss never sends anyone to the penalty car.
The stop rides the Obake Line as 北口 (Kitaguchi), just before its last stop.

The reader fixes one dictionary slip for it: IPADIC reads 出口 alone as いでぐち, so
`server/src/reading.ts` reads it でぐち.

### Hard roles (N4)

A hard role is a harder script inside a stop the whole room already plays (the N4/N3 doc's "Hard roles
in existing games", Express Line goals 4.1, 4.6, 4.9, 4.10). Items with a `role` (all N4, each tagged
with the `frames` it practises) are never dealt as ordinary items. At a stop whose minigame has some,
one connected N4 player is offered one: whoever has been offered fewest so far, then longest ago, so it
rotates. The phone shows the role and its pitch with two equal buttons, **Take it** and **Not this
time**, for 8 s (`RULES.offerMs`), counted down to the server's deadline (`offer.deadline`, read against the
client's server-clock offset), so a reconnect or rebuilt screen doesn't restart it. Taking it starts the item's clock; "not this time", or no answer,
deals the ordinary item (an N4 player's usual N5 one). The offer is private: the TV shows the player as
answering, and only the reveal names the role (⭐ under their name). Every offer goes in `roleLog`
(`accepted`, `declined`, `timeout`, or `away` if the stop ended first), for the step's gate of N4
players taking at least 60% of offers (the answers are `OfferAnswer` from
`shared/src/modes/hardRoleLog.ts`). A bot's answer (tools/bots sends `bot: true` on its `role` move) is
logged with `bot: true` so it can be left out of the gate. A taken hard role pays +20 (decision 17), and missing it twice never
sends anyone to the penalty car. With no N4 player in the room nothing changes: no offers, the same
stops, the same items.

- **The announcer** (Station Announcement, 4.9): six items where the N4 player makes the announcement
  instead of hearing one, so the line is shown, not played. まもなく、三番線に電車がまいります。,
  黄色い線の内側までお下がりください。, ドアが閉まります。ご注意ください。, both sentences at once, and
  電車がおくれて、もうしわけございません。 Frames `keigo-verb`, `o-kudasai`.
- **Lost and Found** (忘れ物センター, 4.6), `content/src/last-train/lost-and-found.ts`: a new minigame
  that rides a line only in a room with an N4 player. The Obake Line's 神社前 becomes 忘れ野 (Wasureno)
  and the Hoshimidai line's 大学前 becomes 音無 (Otonashi) through the stop's `withN4`; both swapped-out
  minigames are penalty ones, so they still ride in the penalty car. It is never a padding stop
  (`n4Stop`). Kana players say what is in the picture (かさです), N5 players say where, when and what
  colour (電車に忘れました, 黒いかばんです). Two N4 roles: the forgetful passenger (電車に忘れたかもしれません,
  `kamo`) and the lost property staff (重そうなかばんですね, 元気そうなかさですね, `sou-look`).
- **The guest at the front desk** (Meet the Innkeeper, 4.1, 4.10): favours with ＿て いただけますか
  (call a taxi, keep the luggage, a wake-up call, speak more slowly, check the booking again;
  `te-itadakemasu-ka`, with いただけませんか accepted too) and three inn signs drawn as boards, 受付,
  予約 and 食堂 (`sign-kanji`, hints are pictures, never the reading).

**Chōchin-san says the line** (decided by Ladi, 2026-11-01: the host says the line, the player's recording
never plays on the TV). When a taken hard role is answered right (first try, retry or overruled), Chōchin-san
says that item's model line on the TV at the reveal, with its subtitle, once (`train_role_read`, a bank line
that is just `{line}`, filled with `line`/`line_kana`/`line_en`; bank only, never rewritten by the LLM). It's
cued `RULES.roleReadAtMs` (4.5 s) into the reveal, after his `reveal_react` reaction, and the longest model
line fits in the 12 s reveal. All three roles get it, not only the announcer: the same one cue, and a
passenger's or a guest's line said back by the conductor is the same "here's how it sounds" beat. The reveal
row (⭐ and the role) and the model answer stay as they were. A missed, declined or timed-out role says nothing.

### Items and levels

Each player gets their own item at their level (Kana → kana then n5; N5 → n5 then kana; N4 →
n4, n5, kana), never one already dealt this game while unused ones remain. Hard-role items are
the exception: they are only ever offered (above). Kana-level phones
show the kana reading and romaji of the prompt and, on the retry, the first sound of the answer.
N5+ phones show the Japanese with furigana and put the English one tap away.

### Answering, retry, timers

- Answers are `{ kind: 'answer', key, utterance }`; the key names the attempt, so a late answer
  to an old attempt is a harmless `wrong-phase` race. Checked with `matchesAccepted` on the
  utterance's reading (the server adds readings for kanji and digits) and on the raw text.
- Each attempt has its own clock (`item.timeLimit`). The mode has no timers: the phone sends
  `{ kind: 'tick' }` when its clock runs out, and every move first sweeps anything overdue
  (deadline + 1.5 s grace). An early tick does nothing. `{ kind: 'pass', key }` gives up.
- A miss (wrong, passed or timed out) opens attempt 2 with the hint, privately. A second miss
  marks the player `missed`, which sends a living player to the penalty car.

### Room overrule

Any rejected answer with words in it opens a 7-second window. The other connected players
(ghosts included) see the prompt and what was heard and vote 👍 / 👎. A strict majority of
👍 counts the attempt as correct (never as a miss), even mid-retry, and logs it in
`overruleLog` (stop, player, item, heard, votes). The window closes early once the outcome is
decided. The stage only shows the tally, never the words, until the stop resolves.

### Ghosts

Ghosts still get an item every stop and earn half points. Once per stop a ghost can haunt a
living player: 2 seconds off that player's next timer (floor 4 s). Two correct stops in a row
(including via overrule or retry) revive a ghost. Ghosts start 2 steps back in the dash.

### Scoring

- Stop: 100 first try, 60 on the retry (+20 on a hard role the player took); ghosts half; the last stop is worth double.
- Speech bonus (spoken, not typed): 25% of the answer's points; players below the room's average
  score get the cap. The bonus never exceeds 3/7 of base, i.e. 30% of base + bonus. Typed
  answers work everywhere but earn no bonus.
- Penalty: no points, it is survival.
- Dash: 1st 400, 2nd 250, 3rd 150, others aboard 100, not aboard 15 per step.
- Every award goes into `ledger` (shown in the view), which always sums to the room scores.

### Phrasebook and awards

Every item a player saw goes to their phrasebook with its natural version: `said`, `retry` or
`missed` (stop items, penalty items and dash questions). Awards use Chōchin-san's bank in
`content/src/hosts/awards.ts` by id (First Aboard, Last One Aboard, Best Ghost, Welcome Back,
Perfect Passenger), with built-in names as a fallback.

### Privacy

The stage view never carries anyone's words or hints before `reveal`. A phone sees its own
task, hint and last heard text, plus the words of rejected answers it may vote on (needed to
judge an overrule). Accepted answers are never sent to any client; bots look items up by
`itemId` in the content. A sign's `target` mark is stripped from every phone's view too.

## Decisions made on Ladi's behalf

1. Retry, penalty and overrule happen inside the stop: `answer` holds both attempts and the
   overrule windows, then `penalty` is a room-wide phase so the stage can show the penalty car.
   Why: the room shares one phase clock, and the penalty car is a good stage moment.
2. Personal timers are enforced lazily (phone tick + sweep on every move, 1.5 s grace). Why: modes
   cannot set timers, and the phase deadline still caps everything.
3. The phone starts each attempt's countdown when it first sees the attempt, not from a server
   timestamp. Why: phones are not given the server clock offset; latency is small and the server
   enforces the real deadline.
4. Overrule needs a strict majority of the other connected players, has a 7 s window and
   👎 votes too (so it can close early). With one player there is no overrule.
5. A rejected answer's words and prompt are shown to the other phones during the window. Why:
   they cannot judge it otherwise; the stage still shows only the tally.
6. Ghosts earn half points and revive after 2 correct stops in a row; a miss resets the streak.
7. Ghosts get retries too but never the penalty car.
8. Penalty is one attempt, worth no points; a disconnected player is never penalised or ghosted
   for a stop they were away for.
9. Haunts are allowed from the stop's announcement to its penalty car, once per ghost per stop,
   and stack on a target (2 s each, 4 s floor). Haunts are shown on the stage.
10. Speech bonus 25% (cap 3/7 of base = 30% of the total) for trailing players; read-aloud
    items get half. Last stop doubles, per the shared scoring rule.
11. Dash: 6 steps, ghosts start at −2, no retries or overrules (pace), wrong answers just move
    on to the next question. Dash points are large (400/250/150) so first aboard matters.
12. Players who missed are invited to say the natural version once at the reveal; it is
    checked but earns nothing (the design doc's "say it aloud once").
13. N5+ players see English behind a tap on attempt 1 and openly on the retry; Kana players see
    it always, plus kana and romaji.
14. Station Announcement: the phone speaks the prompt with the browser's ja-JP voice (not the
    host's TTS) and hides the text until the retry.
15. Scenario choice prefers an exact stop count; trimming keeps the final stop so the twist
    stays last; padding uses placeholder station names.
16. Hard roles: one offer per stop, to the N4 player offered fewest (then longest ago); 8 s to
    choose, and no answer is "not this time". Why: one spotlight a stop, and nobody is pushed into it.
17. A hard role the player took adds 20 to the answer's base points (`RULES.roleBonus`: 120 first
    try, 80 on the retry, before the ghost share, speech bonus and last-stop double), and a double miss
    never sends anyone to the penalty car. Why: taking the harder line should never be the risky
    choice, and should pay a little, or the 60% gate fails.
18. Lost and Found is swapped in for a penalty-minigame stop (Obake 神社前, Hoshimidai 大学前) rather
    than added, so the line's length and the scenario choice stay the same; Kids and Cheeky lines
    keep their stops (their Station Announcement and Meet the Innkeeper stops still offer roles).
19. The announcer's lines are separate items (arrival, yellow line, doors, apology) plus one with both
    sentences, rather than one long announcement. Why: shorter lines survive speech recognition.
20. 女湯 was left out of the inn signs: the reader reads it じょゆ, so a right answer would be rejected.
21. Chōchin-san saying a taken role's line (decided by Ladi, above) covers Lost and Found's two roles and the
    guest at the inn too, not just the announcer. Why: it's the same cue at no extra cost, and every role gets
    the same payoff. He says the model line, not the player's words: it's fixed, fluent and safe for TTS.

## Open questions

- Should the overrule window be longer for 8 players, or should 👎 be removed (thumbs-up only)?
- Ghost points at 50%: too generous, or should ghosts earn nothing until revived?
- The dash track length (6) and ghost head start (−2) need a playtest; with Kana-level
  dash content most players answer in about 3 s, so the dash lasts 20–30 s.
- ~~Should the recap title the phrasebook "travel survival kit"?~~ Done: the recap reads
  `ModeInfo.phrasebookTitle`, so it says "Your travel survival kit".
- Phone audio for Station Announcement uses the device voice; the host pipeline could pre-render
  item audio instead (content notes say audio must play before text).
- Read the Signs: are the kanji pictures (in each hint) memorable and right? They need the fluent
  check with the rest. A Kids line could use the kana-level signs too.
- Overrule logs live in the mode state only; the false-reject metric needs them persisted.
- Hard roles: `roleLog` is mode state only too; the 60% acceptance gate needs it persisted.
- Hard roles not built yet: the host playing the role when nobody is N4, the commentary booth's replay
  of a Star line, and the Gallery. N3 lines (＿で ございます, ＿させて いただけますか, 非常口, 禁煙) wait
  for step 6. Every hard-role line is a draft for the fluent check.
- ~~Should the announcer's clip play on the TV (the doc's "records a clip … the TV plays it"), or is the
  reveal row enough?~~ Decided by Ladi (2026-11-01): no clip; Chōchin-san says the model line at the reveal
  (see Hard roles).
