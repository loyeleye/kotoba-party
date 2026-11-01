# Learning path and sentence frames

An optional mode for signed-in players: the phone suggests what to play next, in an order that builds
up, and names the **sentence frames** each phrase is built on. It's for players who want Kotoba Party
to work more like a course, without making the party feel like one: everything new shows on that
player's phone only. The TV, the other phones and the games themselves don't change.

Asked for by Ladi on 2026-11-01, after a beginner masterclass video (Chloe DY He's "learn Japanese
from zero") argued that learners give up when they don't know their next step, and that a few
plug-in frames (A は B です, 〜を ください, 〜は どこですか) carry a beginner a long way. We took the
ideas, not her material: the frames are standard beginner Japanese, and every example here is our
own. Ladi's limit: it must not take away from the party for anyone, and Kotoba Party doesn't have to
be anyone's main way to learn.

## Turning it on

My progress has a **Path** tab (first of four). Its switch, *Turn on* / *Turn off*, is saved on the
account (`Progress.path`), so it follows the player to any phone. It's off until they turn it on.
Signed-out players never see any of this. With the path on, My progress opens on the Path tab.

## The path (version 2: Kana → N5 → N4)

`shared/src/path.ts`, from the tiers doc v2 (Claude Doc, 2026-11-01, after the game design, JLPT and
learning-science reviews). Three lines of can-do goals, worked back from the N5 and N4 syllabus:

- **Kana Line** (かなせん, the New level): K1 hiragana, K2 katakana, K3 greet/thank/apologise, K4 say who
  you are.
- **Local Line** (各駅停車, N5): 5.1 introduce yourself and others, 5.2 shop and order, 5.3 times and
  dates, 5.4 find your way, 5.5 likes and wants, 5.6 your day, 5.7 ask and answer, 5.8 describe and give
  reasons, 5.9 invite/offer/ask, 5.10 N5 kanji.
- **Express Line** (急行, N4): 4.1 favours, 4.2 may/must/mustn't, 4.3 experiences, 4.4 potential, 4.5 if
  and when, 4.6 guess/hearsay/opinion, 4.7 plans and advice (hidden: no content yet), 4.8 casual speech,
  4.9 polite requests, 4.10 N4 kanji.

Each goal lists its **required frames** (all must be met; one may be "any of", as 5.7's question frame),
frames that **count too**, and the games where players actually say them. The frame, not the game, is
what counts: ＿が すきです said in Oogiri counts for 5.5 as much as in Omiai. The level picker keeps New, N5
and N4; cleared screens use only the line names.

A goal whose required frame frames.ts can't find yet shows its frame as *coming soon* (dashed) and can't
be met or suggested until the matcher lands; `FRAME_TEXT` in path.ts names each with its own label and
hand-written rōmaji, so it lights up with no other change.

### When a goal is met

- **A frame** is met when it's been said **from memory** 3 times, with 2 different phrases (fillers), on 2
  days at least 3 days apart. At most 2 says a day count, and at least one of the days must be in a game,
  not a phone review (`frameRule`, `ruleMet` in progress.ts).
- **A goal** is met when all its required frames are. Its 済 stamp (`Progress.goalsMet`) and each met frame
  (`Progress.frameMarks`) are kept, so they stay met when old phrases leave the 600-phrase phrasebook.
- **Kana goals:** 90% of the script (95 of 105 hiragana, 114 of 126 katakana), each yōkai card recalled on
  2 days; the bar moves from the first night. **K3:** 6 of 8 set phrases, each said on 2 days. **Kanji
  goals:** 30 kanji read from memory on 2 days, in Shodō or Read the Signs.
- **Only true recall counts.** A phrasebook entry carries `recall: 'memory' | 'read'`; read is a line on
  the screen (Nice to Meet You!'s greeting), an echo (Phrase Bingo), a tile answer or encore (Oogiri), a
  typed answer, a script line (Dub Club) or a lyric (Karaoke Duel). Each saved phrase keeps `recall` and
  the days it was said from memory (`memory`).
- **The 21-day re-check:** 21 days after a frame is met, one of its phrases comes first in the phone's
  phrase review. Known, it passes. Missed, the frame **fades** (a ring on its station) until it's said from
  memory again, in a game or a review. The 済 stamp stays.

A line is **cleared** when all its visible goals are met. Players who start at N5 or N4 don't have to
clear the lines below, and what they've said fills those maps in.

**Suggesting the next game.** The first goal on the player's line (their level's, or the next one once
it's cleared) that isn't met and can be met today, with a faded goal first, and the first of its games
that fits tonight's room. A suggestion never blocks anything.

## Sentence frames

`shared/src/japanese/frames.ts`. Sixteen frames, in the order a beginner meets them: ＿は ＿です,
＿です, ＿ですか／＿ますか, ＿は ＿じゃないです, そうです／ちがいます, ＿を ください, ＿は どこですか, ＿は なんですか,
＿が すきです, ＿に ＿が あります, ＿を ＿ます, ＿ました, ＿たいです, ＿て ください, ＿ませんか,
＿ても いいですか. Each has its English, one line on what it's for, and an example.

A phrase's frame is found from its own words (`frameOf`), so every game's phrasebook is covered
without tagging any content by hand. Each phrase gets at most one frame. A line is split into
sentences (on 。！？, dropping quotes and a speaker's name), and each is matched on its own: the
sentence with the player's ＿ blank wins if it has a frame, otherwise the most specific frame in any
sentence. So はじめまして。アキです。よろしく おねがいします。 is a ＿です line. The matchers ask for clear
signs (a spaced topic は, or an unspaced one after a pronoun or kanji noun as in わたしは学生です; a
fixed ending) and rule out the look-alikes found in the game's own lines: いたい (it hurts) and
つめたくない (isn't cold) aren't 〜たい, おなかが すきました isn't 〜が すき, そうですね isn't a yes,
よろしく おねがいします and はい、おねがいします aren't orders, 〜ないで ください (please don't) isn't
〜て ください, hearsay 〜るそうです isn't ＿は ＿です, 〜て います isn't ＿を ＿ます, a plain ある in a
relative clause isn't ＿に ＿が あります, and past or negative adjectives (〜かったです, 〜くないです) aren't
"It's ___". Missing a frame is fine; naming the wrong one isn't. `tests/frames.test.ts` keeps both
lists, including every misfire the Japanese review found.

## On the phone

- **Lobby:** a one-row strip under Start (under *Waiting for the VIP* on other phones):
  `Local Line · 5.4 Find your way · Last Train`. The VIP gets a small *Put it on the menu*; everyone
  else gets *♡ Wish for it*. Tapping the strip opens why, the frames (with rōmaji at the Kana level),
  how the goal is met and where to practise. Its height is held while the save loads, so Start doesn't
  jump.
- **VIP's game list:** each game shows its wish count (♡ 2), with no names. A wish is one per phone,
  lobby only, and they all clear when a game starts (the `wish` command; `RoomView.wishes`).
- **Recap:** a *Tonight on your path* box above the phrasebook lists each frame said from memory
  tonight, once, with how many different phrases used it, and a hanko 済 for each goal met tonight. The
  strip comes back with no button.
- **Line cleared:** "Local Line cleared", with the frames, phrases and kanji used, a note that the JLPT
  also tests reading and listening (try a mock test), and *Move me up* / *Not yet* at the same weight.
  Shown once per line on that phone; it never changes the level by itself.
- **My progress → Path:** the switch, then a train map: three coloured lines, one station per goal, 済 on
  met goals, a ring on goals due for their re-check or faded, and a bar on the current station only.
  Tapping a station opens its frames and rule. Nothing appears on the TV, and there are no streaks.

## How it works

- `GET /api/account/me` returns `pathStatus` (every goal, frame and line, from the whole save) beside
  `path` and `frames`. The account service runs `markPath` after each saved game, phrase review and kana
  review, so frames and goals are stamped on the server.
- The room only ever sees wish counts. It never learns who is on the path.

## Open questions

1. **The goals and thresholds** come from the tiers doc v2 and need a playtest: 3 to 4 groups for 4 weeks,
   watching nights to the first stamp, how many frames pass their re-check, and whether VIPs pick the
   path's game more than half the time.
2. **A VIP badge.** The VIP's menu could mark each game with the players whose path suggests it
   ("Aki and Ken's next step"). It needs the room to read each signed-in player's save, so it's left
   for later.
3. **Frames in the middle of a game.** Frames show at the recap and on My progress, not during play,
   to keep eyes on the TV. Last Train's reveal and Oogiri's score card (which already shows its
   pattern) would be the first places to add a chip if they're wanted mid-game.
4. **Kanji as signs** (the video's third idea) is planned as a Last Train minigame, in its own PR.
