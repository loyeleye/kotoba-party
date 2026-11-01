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
- **Draft.** Every new line is `status: 'draft'` until a fluent speaker checks it.
- **Frames by name.** New lines carry `frames: [...]` with the frame ids below as plain strings.
  They aren't `FrameId`s yet: the frame matchers for N4 are a separate step, and these names are
  the proposal for them.

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
nobody in the room is N4, the commentary booth, the Gallery, Kana curveball tiles, and saving the
offer log beyond the game (the gate needs it stored somewhere).

## Proposed N4 frame ids

| Goal | Ids |
| --- | --- |
| 4.1 Ask favours | `te-moraemasu-ka`, `te-kuremasen-ka`, `te-ageru-kureru-morau`, `te-itadakemasu-ka` |
| 4.2 Must and needn't | `nakereba-narimasen`, `nakute-mo-ii`, `te-wa-ikemasen` |
| 4.3 Experiences, tries, oops | `ta-koto-ga-aru`, `te-shimau`, `te-miru` |
| 4.4 Say what you can do | `potential`, `koto-ga-dekiru` |
| 4.5 If, when, even if | `tara`, `nara`, `ba`, `to-conditional`, `toki`, `te-mo` |
| 4.6 Looks, hearsay, guesses | `sou-looks`, `sou-hearsay`, `to-omoimasu`, `kamo-shiremasen`, `hazu` |
| 4.7 Plans, advice, getting ready | `you-to-omou`, `hou-ga-ii`, `tsumori`, `tara-dou`, `te-oku`, `te-aru` |
| 4.8 Talk casually | `casual-plain`, `n-da`, `casual-contraction` |
| 4.9 Polite to strangers | `o-kudasai`, `te-itadakemasen-ka`, `o-ni-naru`, `o-shimasu`, `keigo-verb` |
| 4.10 Sign kanji | `sign-kanji` |
| 4.11 Reasons and order | `node`, `sugite`, `nagara`, `shi-shi` |
| 4.12 Change and decisions | `you-ni-naru`, `koto-ni-suru`, `koto-ni-naru` |
| 4.13 Passive, causative, easy/hard | `passive`, `sasete-kudasai`, `yasui-nikui` |
| 4.14 Quote, purpose, embedded questions | `to-itte-imashita`, `tame-ni`, `you-ni-purpose`, `ka-dou-ka`, `embedded-question` |

`keigo-verb` covers set keigo that no frame matcher finds today (もうしわけ ございません,
ごしょうかい いたします, ＿は ごえんりょ ください, いらっしゃいます, まいります, ございます).
