# N4 hard roles and decks (Express Line, step 2)

Step 2 of the N4/N3 plan: harder scripts inside games the whole room already plays, so N4 players
practise Express Line frames without the other players' parts changing. Each game's doc under
`docs/modes/` has the details and its own decisions; this page is the overview.

Rules every role follows:

- **N4 only.** There is no N3 level until step 6. N3 lines from the plan are left as
  `// N3 (step 6)` comments.
- **Nothing changes without an N4 player.** A room with no N4 player gets no new state, views or
  timing. Kana and N5 players' parts and scoring are the same in every room.
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
  Omiai and Onsen phases wait a little for a role that was taken; Dub Club ad-libs are captioned in
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

Not built in this step (from the plan's "How mixed rooms work"): the host playing a hard role when
nobody in the room is N4, the Gallery, Kana curveball tiles, and the commentary booth everywhere but
Narabete.

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
