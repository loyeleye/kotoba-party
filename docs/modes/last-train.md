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
| `penalty` | Only if a living player missed twice. One item from a `penalty: true` minigame (Calendar Crunch, Counter Chaos, Particle Panic), one attempt; the room can still overrule. Failing makes a ghost. | `miss_kind`, then `train_ghost` (`name`) per new ghost |
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
    and its arrow on it, with no reading (reading it is the task). Exits are yellow, toilets blue
    and red, other signs dark.

### Read the Signs (看板を読もう)

Kanji as icons, the way a traveller first meets them: read like traffic signs long before anyone
writes one (from the learning path's ideas, [progressive-learning.md](../progressive-learning.md)).
17 items in `content/src/last-train/read-the-signs.ts`:

- **Kana:** 駅, 出口, 入口, 男, 女 read out loud, then "Where's the exit?" with ←出口 and 入口→,
  and "Where's the women's toilet?" with ←男 and 女→ (answer ひだりです / みぎです).
- **N5:** the four station exits 北口, 南口, 東口, 西口, and 切符, then which way to the south exit
  and to the ticket machines (↑: まっすぐです).
- **N4:** 改札, 乗換, and which way to the east exit (みぎのほうです).

Each hint is a picture to remember the kanji by (駅's horse, 男's rice field over strength, 北's two
people back to back), never the reading; the retry still gives Kana players the first sound. The
stop rides the Obake Line as 北口 (Kitaguchi), just before its last stop.

### Items and levels

Each player gets their own item at their level (Kana → kana then n5; N5 → n5 then kana; N4 →
n4, n5, kana), never one already dealt this game while unused ones remain. Kana-level phones
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

- Stop: 100 first try, 60 on the retry; ghosts half; the last stop is worth double.
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
`itemId` in the content.

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
