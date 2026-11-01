# N4 hard roles and decks (Express Line, step 2)

Step 2 of the N4/N3 plan: harder scripts inside games the whole room already plays, so N4 players
practise Express Line frames without the other players' parts changing. Each game's doc under
`docs/modes/` has the details and its own decisions; this page is the overview.

Rules every role follows:

- **N4 only.** There is no N3 level until step 6. N3 lines from the plan are left as
  `// N3 (step 6)` comments.
- **Nothing changes without an N4 player.** A room with no N4 player gets no new state, views or
  timing, except the host stand-in (rooms of one or two, once a game: one voiced line and the few seconds it takes). Kana and N5 players' parts and scoring are the same in every room.
- **Offered, never forced.** A seat is offered on the N4 player's phone ("Take it" / "Not this
  time"), rotating among the room's N4 players. Each offer and its answer (accepted, declined,
  timed out) is kept in the mode's state for the step's gate (N4 players accept at least 60% of
  offers). The decks (Tourist, Nice to Meet You!, Happyōkai) aren't seats, so they have no offer.
- **One offer log.** Every game logs each offer as `accepted`, `declined`, `timeout` or `away`
  (`shared/src/modes/hardRoleLog.ts`). Gate = accepted ÷ (accepted + declined + timeout), per game;
  away is left out. Each mode's `offers()` hands a signed-in player's offers to their account progress at
  the end of the game (`Progress.roleOffers`, counts by role; `roleOfferRate()`), as Ladi asked.
- **The host says the line.** No player's recording plays on the TV. When an N4 line is accepted, the
  game's host voices the fixed model line (Last Train's announcer, lost and found and innkeeper items,
  the Onsen deputy's report, the Omiai go-between's keigo, the Narabete defence replay), with its subtitle.
  Lines in a player's own words are shown, never voiced.
- **What others do see in a mixed room.** Bento stations get 📋 requests to tap; Last Train swaps
  神社前 and 大学前 for Lost and Found; Narabete gains a 15 s encore when the N4 defence is taken;
  Omiai and Onsen phases wait a little for a role that was taken (Narabete's N4 defender whose card also moved
  most gives one defence, not two: `narabeteFold`); Dub Club ad-libs are captioned in
  English only. Their points, turns and tiles don't change. Playtests should check that none of these
  feels like waiting.
- **Draft.** Every new line is `status: 'draft'` until a fluent speaker checks it.
- **Frames by name.** New lines carry `frames: [...]` with the frame ids below as plain strings: the
  ids `shared/src/japanese/frames.ts` uses (PR #134), so a tag and the matcher agree. `sign-kanji` is
  not a frame: it marks the sign boards, which count toward goal 4.10 as kanji.

| Game | Hard role or deck | Goals | Where |
| --- | --- | --- | --- |
| Bento Haus (Co-op) | Manager: complaints and special orders | 4.1, 4.9 | `shared/src/modes/bentoHaus/hardRoles.ts` |
| Bento Haus (Co-op) | おもてなし shift (was Ryokan Front Desk) | 4.7, 4.9 | same |
| Last Train | Announcer items in Station Announcement | 4.9 | `content/src/last-train/station-announcement.ts`, `roles.ts` |
| Last Train | Lost and Found minigame (replaces two stops when an N4 player is in the room) | 4.6 | `content/src/last-train/lost-and-found.ts` |
| Last Train | Meet the Innkeeper N4 guest items and sign boards | 4.1, 4.10 | `content/src/last-train/meet-the-innkeeper.ts` |
| Murder at the Onsen | Deputy: reports what the suspect said | 4.13, 4.14 | `shared/src/modes/onsenMurder/deputy.ts`, `content/src/onsen/cases.ts` |
| Omiai Matchmaker | Go-between (なこうど) opening and closing lines in keigo | 4.9 | `shared/src/modes/omiai/cards.ts` |
| Dub Club | Ad-lib: a mission instead of a script, said casually | 4.8 | `shared/src/modes/dubClub/scenes.ts` |
| Narabete! | Rank and defend: ＿ので、これが いちばん さきです | 4.11 | `shared/src/modes/narabete/defence.ts` |
| Happyōkai! | "Then and now" and "If I were…" decks | 4.12, 4.3 | `shared/src/modes/happyokai/content.ts` |
| Who's the Tourist? | N4 question and answer deck | 4.2, 4.4 | `shared/src/modes/tourist/places.ts` |
| Nice to Meet You! | N4 experience cards | 4.3 | `shared/src/modes/hajimemashite/cards.ts` |

## How mixed rooms work (built after step 2)

The shared pieces are in `shared/src/modes/mixedRoom.ts`, with the phone side in
`controller/src/components/gallery.ts` and `roleOffer.ts` and the TV side in `stage/src/components/mixedRoom.ts`.
Every game with a hard role uses them the same way:

- **Offer card and rotation.** One offer card on every phone (`roleOffer`). `nextOfferee()` picks who is offered:
  fewest offers so far, then longest ago; a player who said no, or didn't answer, last time sits the next one out; in rooms of 4 or
  more, nobody holds the spotlight two rounds running.
- **Gallery.** While the N4 line is being said, each player without the seat gets one tile a round: four
  reactions (👏 すごい！, 💡 なるほど, 😮 へえ！, 📣 がんばれ！) that pop up on the TV as bubbles, unscored. Once per game, after the line has
  landed, a Kana or N5 player who hasn't reacted yet gets a curveball instead, "Which word did you hear?", with the line's key word and two
  others; +5 if right.
  - *Experiment `scaledCurveball` (round 5, on by default):* the curveball pays about a tenth of the game's basic right
    answer, rounded to 5 (`curveballPoints(game)`, table `BASIC_POINTS` in `mixedRoom.ts`): Bento Haus 15 (a perfect
    box, 3 × 50), Last Train 10 (an item first try, 100), Onsen 30 (the culprit, 300), Omiai 10 (a vote, 100),
    Dub Club 5 (a right guess, 50), Narabete 10 (a pair, 100). The phone's "Yes! +N" shows what was paid. Off:
    a flat +5 everywhere (for Ladi to confirm: Onsen's base is the culprit, its one big answer, so its curveball is the
    richest; a question's 20 would make it 5).
  - *Experiment `spokenReaction` (round 5, on by default):* a Gallery player may say their reaction instead of tapping.
    Phones with a mic on show a small "🎤 or say it" button under the four tiles (`speakBox` with `mini`, never
    docked; quiet or mic-less phones just see the tiles). The phone sends `{ kind: 'gallery', pick: 'say', utterance }`;
    `reactionSaid` checks the reading against each tile's kana (lenient, small kana and ー folded, one doubling or a
    little ending like ね/よ/ー allowed: すごいね, へー, がんばれー). A match picks that tile, pays
    `SPOKEN_REACTION_POINTS` (+2) into the game's ordinary score, shows the TV bubble with a 🎤, and logs the
    reaction to the phrasebook as `said` with recall `read` (the tile shows the kana while they say it, so it isn't
    from memory; for Ladi to confirm). A miss pays nothing, picks nothing, and the phone says "Didn't catch a reaction:
    say one of them, or tap." Tries aren't limited. Typed text can't be sent this way (tap instead). Off: the pick
    is refused and tiles show no mic. +2 is small on purpose so tappers aren't behind (for Ladi to confirm).
- **Commentary booth.** Once the N4 line lands, a 5–7 s instant replay on the TV: the line with its key word lit
  and one line of English colour, voiced by the host (the fixed model line, never the player's own words). Kana
  and N5 phones show the gist at their level (romaji for Kana). While a curveball on that word is open, the word
  isn't lit yet (`keyHeld`).
- **Host stand-in.** In a room of one or two players with nobody at N4, the host plays the hard role once per
  game: one model line, voiced, with the gist on the phones. Nobody is asked to say it and it scores nothing.
  This is the one thing that reaches rooms without an N4 player (for Ladi to confirm).
  Two experiments ride on it (`shared/src/modes/experiments.ts`, for the playtest sims; for Ladi to confirm):
  - `standInSetup`: the host first says a short setup line in character (Pon's ドロン！), its own bank-only event per
    game (`*_standin_setup`; Last Train's is `train_stand_in_setup`), where the model line used to start; the model
    line follows `STAND_IN_SETUP_MS` (2.5 s) later. Added time: none in Narabete!, 1.3 s in Bento Haus, 2.5 s in the
    others.
  - `standInCurveball`: every player in the room gets a Gallery tile while the host says the line, and once it has
    been said the once-a-game curveball is dealt on it (`openStandInGallery` with no key, then `dealStandIn`, i.e.
    `armCurveball` with the line's kana as heard), +5 if right. Until it's answered the key word isn't lit and
    the gist waits (`standInHoldKey`). The phase waits up to `STAND_IN_CURVEBALL_MS` (5 s) for the answer and
    ends once it's in (`standInDone`); Omiai and Narabete! fit it in time they already had.
  With both off, the stand-in is exactly as above.
- **Host reactions.** Each game's host reacts in one short line when a role lands.
- **The waiting check.** After a game in a mixed room (an N4 player and anyone below N4) where a hard role was offered, the recap asks each player below
  N4 one tap: "Was there a part of that game where you were just waiting?" (No / A bit / Yes). The server logs the answers
  with how long each phase ran (`[mixed-room]` in the server log) when the recap ends, for playtests. The
  answers aren't shown on any screen or kept in accounts. With the `waitCheckFirstTwo` experiment on (the
  default), only the first two qualifying recaps of a night ask it (`WAIT_CHECKS_A_NIGHT`); later ones still
  log their phases, with nobody asked. The count (`GameState.mixedChecks`, and `nth` on each check) runs across
  the night's games and starts again in a new room; a recap that doesn't qualify doesn't count. Off, every
  qualifying recap asks. Why: the same tap after every game nags, and two answers a night already say whether
  the roles made people wait (for Ladi to confirm).

Still to come: N3 lines (step 6), and bots taking hard roles.

## Playtest sims

`tools/sim/mixedRooms.ts` plays whole games of the six hard-role games in process, with no server: the room
state machine (`apply`), a fake clock, a seeded random, the bot policies in `tools/bots/policies/` for everyone's
ordinary play, and a mixed-room layer on top. It is for weighing the `EXPERIMENTS` switches
(`shared/src/modes/experiments.ts`) before a real playtest, not instead of one.

```
npm run sim:mixed                                         # every game × setup, 20 seeds (a few seconds)
npm run sim:mixed -- --seeds 5 --modes omiai,narabete --setups a,c
npm run sim:mixed -- --on standInSetup --off scaledCurveball
npm run sim:mixed -- --ab spokenReaction --out ab.json    # both ways, same seeds, then the difference
npm run sim:mixed -- --ab all --rounds last-train=6 --out ab.json   # every switch in turn (~2 min)
npm run sim:mixed -- --rounds last-train=6                # a mode's length, where the host can choose it
SIM_TRACE=1 npm run sim:mixed -- --seeds 1 --modes omiai --setups a   # every move and the game's answer
```

**Rooms.** a: 3 players, N4 + N5 + Kana. b: 5 players, one N4 and four below (2 N5, 2 Kana). c: 2 players,
N5 + Kana (the host stand-in's rooms). d: 3 players, all N5 (the control: nothing mixed-room should show). Dub
Club needs 3 players, so it has no row for c. Each seed plays one *night* per room: the chosen games back to back
in one room, the order rotated by the seed. Each game gets its own random stream, ids, clock and phase count, so
a switch that changes one game doesn't reshuffle the games after it (an A/B stays like for like).

**Simulated people.** The bot policies play each game's ordinary part. On top: an N4 player takes 70% of hard-role
offers and says a hard line right 60% of the time on the first try, 85% on later tries (a wrong try is
「えっと… あの…」; Narabete's one-try defence leaves out ので). A player with a Gallery tile (the round's, or the stand-in's with `standInCurveball`) taps a reaction 80% of
the time; with `spokenReaction` and a mic, half of them say it instead (matched 75% of the time; a miss taps after).
The curveball is right 60% of the time, answered in 2–5 s. A station sees to the deputy manager's 📋 request 90% of
the time. Think times are 1–6 s. The numbers are in `PERSONA` at the top of the file.

**What each column means** (mean ± spread over the seeds; "per player" is over players below N4):

| Column | Meaning |
| --- | --- |
| len s | Game length on the fake clock, start to recap. |
| idle s/p, idle% | Time a player below N4 had **nothing to do**: their phone's view offered no move. A move is an input, tile or button not yet used: an open answer, an untapped Gallery tile, an unanswered offer, a vote, a line to say (`hasInput()` lists them per game). Watching the TV, someone else's turn and phases with nothing for them count as idle. |
| max idle s | The longest such stretch in the game, per player: what is most likely to *feel* like waiting. |
| taps | Gallery reaction taps in the game (everyone). |
| curve games/hit | Share of games that dealt a curveball; right ÷ dealt over them. |
| stand-in cues | Host stand-in cues in the game (the line, and its setup line with `standInSetup`). |
| sg held/s/5s | Stand-in rooms with `standInCurveball`: per game, stand-in phases the curveball kept open past their own end, the seconds that added, and curveballs that ran the full 5 s unanswered. |
| say/match <N4 | `spokenReaction`: reactions said out loud per player below N4, and those that matched a tile. |
| spoken/p<N4 | Moves said out loud (speech) that the game took, per player below N4. |
| said/seen | Phrasebook rows per player at the end of the game: said (from memory or after a retry) and seen. |
| pts <N4 (seats) | Share of the game's points that went to players below N4, beside their share of the seats. |
| N4 accept | Hard-role offers taken ÷ offers answered or timed out (away left out), and offers per game. |
| wait? | The recap's waiting-check prompts this game (one per player below N4 asked). |
| By level | A second table: each level's share of the game's points and of its wins (ties split), beside its share of the seats. |

Under the table, **waiting-check prompts per night** adds them up over each room's night. With `--ab` the sim
plays both sides on the same seeds and prints on minus off. `--out` writes every number as JSON.

What it can't tell you: whether a stretch *feels* like waiting (the booth and the TV are worth watching), whether
a line is fun to say, or how real people take offers. A new switch that adds a move needs a line in `galleryMoves()`
or `hardMoves()` before the sim can weigh it. On the
default 4-stop line, Last Train never deals a Gallery role (only the innkeeper's guest is on it); use
`--rounds last-train=6` for the announcer.

## N4 frame ids used

| Goal | Ids |
| --- | --- |
| 4.1 Ask favours | `te-moraeru`, `te-kuremasen`, `ageru-kureru`, `te-itadakemasen` |
| 4.2 Must and needn't | `nakereba`, `nakutemo-ii`, `te-wa-ikenai` |
| 4.3 Experiences, tries, oops | `ta-koto`, `te-shimau`, `te-miru` |
| 4.4 Say what you can do | `potential` (たべられます and ＿ことが できます) |
| 4.5 If, when, even if | `tara`, `nara`, `ba`, `to-cond`, `toki`, `temo` |
| 4.6 Looks, hearsay, guesses | `sou-look`, `sou-hear`, `to-omou`, `kamo`, `hazu` |
| 4.7 Plans, advice, getting ready | `you-to-omou`, `hou-ga-ii`, `tsumori`, `tara-dou`, `te-oku`, `te-aru` |
| 4.8 Talk casually | `plain`, `n-da`, `teru` |
| 4.9 Polite to strangers | `o-kudasai`, `te-itadakemasen`, `o-ni-naru`, `o-suru`, `keigo` |
| 4.10 Sign kanji | `sign-kanji` |
| 4.11 Reasons and order | `node`, `sugiru`, `nagara`, `shi` |
| 4.12 Change and decisions | `you-ni-naru`, `koto-ni-suru`, `koto-ni-naru` |
| 4.13 Passive, causative, easy/hard | `passive`, `sasete-kudasai`, `yasui-nikui` |
| 4.14 Quote, purpose, embedded questions | `to-itte-ita`, `tame-ni`, `you-ni`, `ka-dou-ka`, `nani-ka` |

`keigo` covers the keigo verbs and set phrases (もうしわけ ございません, ごしょうかい いたします,
＿は ごえんりょ ください, いらっしゃいます, まいります, ございます).
