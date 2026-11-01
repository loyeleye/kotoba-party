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
- **N5:** the four station exits 北口, 南口, 東口, 西口, then which way to the south exit.
- **N4:** 中央口 (央 is N4), 切符, 改札, 乗換, which way to the ticket office (↑: まっすぐです) and to the east
  exit (東口は右のほうです). 切符, 改札 and 乗換 aren't on the N4 kanji lists: they're station icons, read as whole
  signs the way 出口 is, and not counted as N4 kanji.

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
one connected N4 player is offered one, chosen by `nextOfferee` (shared/src/modes/hardRoleLog.ts, the same in
every game): whoever has been offered fewest so far, then longest ago; a player who said no or let it time out last time sits the
next offer out (no offer that stop if nobody else is N4); in a room of 4 or more connected players, a player who took it last time
is passed over. "Last time" counts offer stops, not stops, so a line whose role stops aren't next to each other
still rotates the same way. The phone shows the offer card (controller/src/components/roleOffer.ts): the role
and its pitch with two equal buttons, **Take it** and **Not this time**, under a kicker in the scene's voice for each role (📢 Chōchin-san holds
out his megaphone. / 🧳 Oh no, you've lost something! / 🔎 The lost property counter needs you. / 🛎️ The front desk is
all yours.), for 6 s (`RULES.offerMs`), counted down to the server's deadline (`offer.deadline`, read against the
client's server-clock offset), so a reconnect or rebuilt screen doesn't restart it. Taking it starts the item's clock; "not this time", or no answer,
deals the ordinary item (an N4 player's usual N5 one). The offer is private: the TV shows the player as
answering, and only the reveal names the role (⭐ under their name). Every offer goes in `roleLog`
(`accepted`, `declined`, `timeout`, or `away` if the stop ended first), for the step's gate of N4
players taking at least 60% of offers (the answers are `OfferAnswer` from
`shared/src/modes/hardRoleLog.ts`). A bot's answer (tools/bots sends `bot: true` on its `role` move) is
logged with `bot: true` so it can be left out of the gate. A taken hard role pays +20 (decision 17), and missing it twice never
sends anyone to the penalty car. With no N4 player in the room nothing changes: no offers, the same
stops, the same items.

- **The announcer** (Station Announcement, 4.9): seven items where the N4 player makes the announcement
  instead of hearing one, so the line is shown, not played. まもなく、三番線に電車がまいります。,
  黄色い線の内側までお下がりください。, ドアが閉まります。お気をつけください。, both sentences at once,
  電車がおくれて、もうしわけございません。, and the yōkai platform's ghost train, まもなく、ゆうれい れっしゃが
  まいります。 (`station-announcement.22-announce-yuurei`, `keigo`; ゆうれいでんしゃ is accepted too). Frames
  `keigo`, `o-kudasai`.
- **Lost and Found** (忘れ物センター, 4.6), `content/src/last-train/lost-and-found.ts`: a new minigame
  that rides a line only in a room with an N4 player. The Obake Line's 神社前 becomes 忘れ野 (Wasureno)
  and the Hoshimidai line's 大学前 becomes 音無 (Otonashi) through the stop's `withN4`; both swapped-out
  minigames are penalty ones, so they still ride in the penalty car. It is never a padding stop
  (`n4Stop`). Kana players say what is in the picture (かさです), N5 players say where, when and what
  colour (電車に忘れました, 黒いかばんです). Two N4 roles: the forgetful passenger (電車に忘れたかもしれません,
  `kamo`) and the lost property staff (重そうなかばんですね, 元気そうなかさですね, `sou-look`).
- **The guest at the front desk** (Meet the Innkeeper, 4.1, 4.10): favours with ＿て いただけますか
  (call a taxi, keep the luggage, a wake-up call, speak more slowly, check the booking again;
  `te-itadakemasen`, with いただけませんか accepted too) and three inn signs drawn as boards, 売店,
  会計 and 食堂 (`sign-kanji`, hints are pictures, never the reading).
- **Yōkai lost property** (Lost and Found, 4.6), three more N4 items in the same two roles: Pon's leaf, with
  ポン written on it (staff: ポンと書いてあります, `te-aru`); a kappa's missing dish (passenger: 頭の上にあったはずです,
  `hazu`); Chōchin-san's candle, as heard on the phone (staff: ちょうちんさんのろうそくだそうです, `sou-hear`).
  When the candle item lands, Chōchin-san sees it's his own, once a game: 「あっ、わたしの ろうそく！　ゆらゆら…」
  ("Oh, my candle! Sway…", `train_candle`, bank only, `RULES.candleAtMs` = 8.5 s into the reveal, after he has
  said the staff's line; no time added).

**Chōchin-san says the line** (decided by Ladi, 2026-11-01: the host says the line, the player's recording
never plays on the TV). When a taken hard role is answered right (first try, retry or overruled), Chōchin-san
says that item's model line on the TV at the reveal, with its subtitle, once (`train_role_read`, a bank line
that is just `{line}`, filled with `line`/`line_kana`/`line_en`; bank only, never rewritten by the LLM). It's
cued `RULES.roleReadAtMs` (4.5 s) into the reveal, after his `reveal_react` reaction, and the longest model
line fits in the 12 s reveal. All three roles get it, not only the announcer: the same one cue, and a
passenger's or a guest's line said back by the conductor is the same "here's how it sounds" beat. The reveal
row (⭐ and the role) and the model answer stay as they were. A missed, declined or timed-out role says nothing.

### Mixed rooms (shared/src/modes/mixedRoom.ts)

What the players without the hard role get, the same way in every game. None of it changes anyone's points,
turns or items except the curveball's +5, and none of it happens in a room without an N4 player, except the host
stand-in.

- **Gallery** (the announcer and Lost and Found's two roles; not the guest at the inn, whose favours are quieter
  and come mixed with sign reading): once the role is taken, each other connected player gets one tile for the
  stop, on their phone's live box so a tap never rebuilds their own talk button: four reactions (👏 すごい！,
  💡 なるほど, 😮 へえ！, 📣 がんばれ！), shown on the TV as bubbles through the answer and the reveal, never scored. Once
  a game, at the reveal, once the role line has landed, a Kana or N5 player who hasn't reacted yet (picked by the
  game's seed, so it rotates) gets the curveball in place of their tile, "Which word did you hear?": the line's key
  word (its frame word: まいります, おさがりください, おきをつけください, ございません, かもしれません, そうな,
  だそうです, はずです, てあります) and two others, +5 into the ledger (`reason: 'curveball'`) if right. The move is
  `{ kind: 'gallery', pick }` (a reaction id, or the kana picked), in the answer or the reveal.
- **Commentary booth** (all three roles): when a taken role lands (right on the first try, the retry or by
  overrule), the reveal carries an instant replay: 📺 REPLAY · name, the model line with its key word lit, one
  line of English colour about the frame (never about the player's mistakes). It fades in at
  `RULES.roleReadAtMs`, as Chōchin-san says the line (`train_role_read`, the one voice: the fixed model line,
  never the player's words), and runs `commentaryMs` (5–7 s), inside the 12 s reveal: no time added. Kana and N5
  phones show its gist under their own result (kana, English, an emoji for the role; romaji for Kana). While the
  curveball is unanswered the TV doesn't light the key word (`keyHeld`), and the curveball player's phone holds
  back the gist until they've picked, so neither gives the answer away.
- **Host reaction**: a landed announcer line gets Chōchin-san's own short reaction (`train_announcer_react`, five
  bank lines, e.g. ホームランです！　…ホームだけに。) in place of the room's `reveal_react`, then he says the line. No time added.
- **Host stand-in**: in a room of one or two with nobody at N4 (`hostStandsIn`), at the first Station
  Announcement stop, Chōchin-san makes the platform announcement himself, once a game: the minigame's first
  announcer line, まもなく、三番線に電車がまいります。 (`train_stand_in`, bank only, `{line}` as is), 3.5 s
  (`RULES.standInAtMs`) into the stop's announcement, subtitled on the TV and with its gist on the phones. That
  announcement phase runs on until the line is said (about 2.5 s longer, once a game). Nobody is asked to say
  anything and nobody scores. The line is fixed, not drawn, so the game deals exactly as it would without it.

The mode can't tell a bot from a player (`ModePlayer` has no bot flag), so a bot in the room gets a Gallery tile
and counts for the stand-in like anyone else.

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
- Gallery curveball: +5 if right, once a game (mixed rooms only).
- Speech bonus (spoken, not typed): 25% of the answer's points; players below the room's average
  score get the cap. The bonus never exceeds 3/7 of base, i.e. 30% of base + bonus. Typed
  answers work everywhere but earn no bonus.
- Penalty: no points, it is survival.
- Dash: 1st 400, 2nd 250, 3rd 150, others aboard 100, not aboard 15 per step.
- Every award goes into `ledger` (shown in the view), which always sums to the room scores (`stop`, `dash`,
  `curveball`).

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
16. Hard roles: one offer per stop, to the N4 player offered fewest (then longest ago); 6 s to
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
22. The Gallery runs on the announcer and Lost and Found's roles only (as briefed), from the moment the role is
    taken until the reveal ends, so a player busy with their own item can still react once they're done, or
    during Chōchin-san's reading. The curveball is dealt at the reveal, once the role line has landed, to a Kana
    or N5 player who hasn't reacted yet; a line that doesn't land deals none. It is spent when it's dealt,
    answered or not. (for Ladi to confirm)
23. The curveball's key word is the line's frame word, picked from a fixed list by where it comes first in the
    reading (the announcement with both sentences asks まいります). Distractors come from the same list and the
    shared N4 key words. (for Ladi to confirm)
24. The booth lives inside the reveal, fading in as Chōchin-san starts the line (4.5 s), rather than in a phase
    of its own: Last Train's reveal already has the time, and its one voice is the existing `train_role_read`.
    It runs for all three roles, like the reading. (for Ladi to confirm)
25. The announcer's reaction replaces `reveal_react` that stop (the host says one plain line a phase) rather
    than following the reading, so the reveal keeps its 12 s. Only the announcer gets one, as briefed.
    (for Ladi to confirm)
26. The host stand-in makes the announcement during the stop's own announcement, not when the items are dealt:
    Station Announcement phones read their own announcement aloud then, and two voices would clash. It is always
    the first announcer line, and adds about 2.5 s to that one stop. (for Ladi to confirm)
27. Offers now follow the shared `nextOfferee`: a "not this time" sits the next offer out, and in rooms of 4+ the
    same player never gets it two offers running (a lone N4 player then gets every other one). Counted in offer
    stops, not stops. (for Ladi to confirm)
28. Yōkai lost property: Pon's leaf (`te-aru`) and Chōchin-san's candle (`sou-hear`) are the staff's, the kappa's
    dish (`hazu`) the passenger's, so each role gains a new frame. Drafts for the fluent check. (for Ladi to confirm)
29. The candle reaction (`train_candle`) fires only when item 21 is taken and lands (the same moment as his
    `train_role_read`), once a game, timed after the model line rather than in place of `reveal_react`, so the
    room still hears its own reaction. The ghost-train announcement is an ordinary announcer item, dealt like
    the others, not a special stop. (for Ladi to confirm)

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
- ~~Hard roles not built yet: the host playing the role when nobody is N4, the commentary booth's replay
  of a Star line, and the Gallery.~~ Built (see Mixed rooms). Should the Gallery cover the guest at the inn too,
  and should the stand-in also play the guest when a room of one or two reaches the inn (Lost and Found never rides without an N4 player)? N3 lines (＿で ございます, ＿させて いただけますか, 非常口, 禁煙) wait
  for step 6. Every hard-role line is a draft for the fluent check.
- ~~Should the announcer's clip play on the TV (the doc's "records a clip … the TV plays it"), or is the
  reveal row enough?~~ Decided by Ladi (2026-11-01): no clip; Chōchin-san says the model line at the reveal
  (see Hard roles).
