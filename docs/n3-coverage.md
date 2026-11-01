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
| speak | said in a party; counts on its goal once it has a matcher | 91 (69 with a matcher, 22 without yet) |
| listen | heard in the hosts' lines, shown with a HEAR tag, **never counted** | 13 |
| unchecked | spoken, but the game can't tell it apart from a look-alike yet | 4 |
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
- **The 通過 sign** below the last station: "通過 Passing through · 15 N3 points this train doesn't stop for ·
  What's here?". It opens a sheet where Chōchin-san says 「この とっきゅうは、ここには とまりません。」 and lists the
  points in two groups (spoken but not told apart yet, and mostly written), then the kanji, word list and timed
  test sections.
- **Cleared screen:** "All 12 N3 speaking goals, said from memory, spaced over days.", then two plain counts:
  how many of the spoken N3 patterns the game can hear you've said, and what the line passed by. No empty bars.
  Then: "That's spoken N3 grammar, by our list: not a JLPT result."

## New frames in this change

26 matchers for speak points, each optional on its goal, with the 10 positive and 10 look-alike bar
(`tests/frame-cases/n3-e.ts`). See docs/n4-n3-frames.md, "Spoken N3 frames".

## Not built yet

- Matchers for the 22 speak points that have none.
- N3 game lines (Late Again!, Ghost Advice Hotline, Yōkai Court, Bento Haus first), then a `sim:limited`
  simulation, so the Limited Express can rank its suggestions by pace.
- Host lines for each listening point, and any listening credit (a quick-response check), if Ladi wants one.
- Pixel icons to replace the HEAR and 通過 text tags.

The open questions from this decision are in the open questions doc.
