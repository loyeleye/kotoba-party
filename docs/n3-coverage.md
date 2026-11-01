# How much of N3 the Limited Express covers

Decided Nov 1, 2026. Ladi asked for two plans: cover all of N3 on the Limited Express (Plan A), or only the parts
this game format teaches well (Plan B). Both were storyboarded and reviewed by the kotoba panel (8 seats) and the
art panel (5 seats). **All 13 seats picked Plan B, "spoken N3"**: Plan A averaged about 3.4/10 and Plan B about
7.5/10.

The plans, storyboards and reviews are in the project files (`n3-coverage/plans.md`, `n3-coverage/storyboards/`,
`n3-coverage/reviews/`).

## The decision

The Limited Express (特急) stops only at the N3 a player says. It doesn't grow a 13th goal and doesn't add
reading or written grammar stations. What it passes by is shown, plainly, on a 通過 (passing through) sign at the
end of the line, so nobody thinks the game covers it.

Why Plan B, in the panels' words:

- **Game design, UX, beginner:** Plan A adds about 40 stops nobody can say in a party, and a long wall of grey
  stations. That takes away from the party, which Ladi's rule forbids.
- **Learning science:** recall only counts when the player says the line from memory. Written grammar can't meet
  that bar here, so Plan A's extra stations would be ticked by reading, which the path doesn't count.
- **JLPT:** a cleared Plan A screen would read as "you know N3", which the game can't back up. Plan B's claim
  ("spoken N3 grammar, by our list") is one it can.
- **Art:** the 通過 sign is a real thing on Japanese rail lines, needs no new art beyond a tag, and keeps the map
  short.

## The inventory (`shared/src/japanese/n3Points.ts`)

Every N3 grammar point we know of has one entry, with a **fit** and a **band**:

| Fit | Meaning | Band N3 count |
| --- | --- | --- |
| speak | said in a party; counts on its goal (every one has a matcher) | 95 |
| listen | heard in the hosts' lines, shown with a HEAR tag, **never counted** | 13 |
| unchecked | spoken, but the game can't tell it apart from a look-alike yet | 0 |
| written | mostly written N3; passed by | 11 |

- **Band** is where the point sits: `n3`, or `n4` (N4 review, such as most of 3.8's keigo, the suffering passive,
  させられる) or `n2`. Only band N3 points are counted anywhere a player sees a number (`N3_COUNTS`). 14 points
  are N4 review and 2 written points are N2.
- **Kanji:** the line passes by about 340 N3 kanji (`N3_KANJI_PASSED`). 3.12 still counts its 30 sign kanji.
- A test (`tests/n3-points.test.ts`) checks that every N3 frame is in the inventory once, on the goal and fit
  frames.ts gives it, that speakable frames are on their goal and listening ones are on none, and that the
  counts include only band N3.

## Rules

- **Required frames are frozen.** Each Limited Express goal keeps the required frames it had on Nov 1 (a test
  pins them). New frames go on goals as optional (`also`), never required. This replaces "a frame becomes
  required once a game carries it". Moving a required frame is Ladi's call (open questions doc).
- **Optional frames fold.** A station sheet shows up to 4 optional frames; more fold under "Also counts (N)",
  with "Optional: never needed for the stamp".
- **Listening points are marked, never counted.** They show under "You'll hear these" with a HEAR tag and a
  dotted border.
- **No path info on the TV.** Everything here is on the player's own phone.

## What the player sees

- **Station sheet:** required frames, then the folded "Also counts", then "You'll hear these".
- **The 通過 sign** below the last station: "通過 Passing through · 11 N3 points this train doesn't stop for ·
  What's here?". It opens a sheet where Chōchin-san says 「この とっきゅうは、ここには とまりません。」 and lists the
  mostly written points (a "spoken, but not told apart yet" group shows only if one comes back), then the kanji, word
  list and timed test sections.
- **Cleared screen:** "All 12 N3 speaking goals, said from memory, spaced over days.", then two plain counts:
  how many of the spoken N3 patterns the game can hear you've said, and what the line passed by. No empty bars.
  Then: "That's spoken N3 grammar, by our list: not a JLPT result."

## New frames in this change

52 matchers for speak points, each optional on its goal, with the 10 positive and 10 look-alike bar
(`tests/frame-cases/n3-e.ts`, `n3-f.ts` and `n3-g.ts`). See docs/n4-n3-frames.md, "Spoken N3 frames". The last six
(＿らしい as "typical of", ＿ところに, ＿きり, ＿ぐらい as "at least", casual ＿って, ＿さ／＿み) look like other patterns,
so their matchers are narrow guesses. Ladi chose to put them in and have a fluent speaker check them in the playtest
rather than hold N3 back: the list is `docs/n3-fluent-check.md`.

## Hearing the listening points

Each of the 13 listening points has two host lines that say it (`content/src/hosts/n3Listening.ts`), given to the
host who already talks that way: Nobiko-san gossips (とか いってた, かしら, ものだ, ぎみ, て ごらん), Chōchin-san
announces (おきに, ごとに, ようなら, から に かけて, おそれが ある), Pon is casual (じゃん, ようが ない), and Fude gives advice
(ことだ). They're tagged `level: 'n3'` and play only in a room where someone plays at N3 (the director sets
`HostCue.n3`; the written bank and the AI's fallback bank both filter). A test checks every point has its lines.

## N3 lines in the games

- **Late Again!:** every cause has an N3 excuse whose chunk is an N3 frame: ＿せいで, ＿た まま, ＿おかげで, ＿うちに,
  ＿させられる, the suffering passive, ＿ずに, ＿ようと する, ＿たびに, だって ＿もん, ＿た とたん, ＿くせに (with
  教えさせられました, so ＿させられる has a second word), ＿に しては, ＿わりに, ＿わけでは ない, ＿しか ない.
- **Ghost Advice Hotline:** every problem has N3 advice (＿べき, ＿さえ ＿ば, ＿んじゃ ない？, ＿に ちがいない, ＿と したら,
  ＿ような 気が する, ＿ことは ない, ＿ずに すむ, ＿しか ない, ＿ても かまわない), and the commentary booth credits those 10
  chunks, the higher level first.
- **Bento Haus:** an N3 おもてなし order-taker's lines are ＿させて いただきます (the welcome, ごあんない or おあずかり in turn),
  ＿は ごえんりょ いただいて おります and ＿は ごよういして おります. Anyone may say them and is credited with the N3 line; the N4
  lines stay accepted for an N3 player and are credited as themselves.
- **Yōkai Court:** N3 lawyers say ＿に ちがいない, ＿わけでは ない, ＿らしい, ＿っぽい and ＿なんて, and Yōkai Court is now on
  3.11 too.
- **Tone:** ＿くせに and ＿わりに are aimed at a kappa and Nobiko-san, never at a player.

## The simulation (`npm run sim:limited`)

The Express Line simulation, run for the Limited Express (2 N3, an N4 and an N5 in a room; N3 frames credited for
the run). 200 rooms, weekly nights, games only, Nov 1, after the game lines above:

- **3.5 stamps in 56% of rooms, 3.7 in 48% and 3.10 in 21%.** Before them only 3.7 stamped (53%). The other goals
  stamp in no room, so the line doesn't clear in 60 nights.
- An N3 seat says Limited Express frames from memory per game: Bento Haus 9.7, Ghost Advice Hotline 6.0, Yōkai Court
  2.0, Late Again! 1.1, every other game 0.
- Why the rest don't stamp: Late Again! gives an N3 seat about one excuse a game spread over 16 causes, so a cause's
  frame comes round too rarely to be said on enough days. 3.1, 3.2, 3.6, 3.9 and 3.11 rest on it or on games with no
  N3 lines yet (Word Gauntlet, Dub Club, Happyōkai, Phrase Bingo). 3.8's ＿させて いただきます is said about once a game,
  short of its spaced says.

## Not built yet

- N3 lines in Word Gauntlet, Dub Club, Happyōkai and Phrase Bingo, and more N3 turns in Late Again!, so the goals
  above can stamp.
- Any listening credit (a quick-response check), if Ladi wants one.
- Pixel icons to replace the HEAR and 通過 text tags.

The open questions from this decision are in the open questions doc.
