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

- **Kana Line** (かな線, the New level): K1 hiragana, K2 katakana, K3 greet/thank/apologise, K4 say who
  you are.
- **Local Line** (各駅停車, N5): 5.1 introduce yourself and others, 5.2 shop and order, 5.3 times and
  dates, 5.4 find your way, 5.5 likes and wants, 5.6 your day, 5.7 ask and answer, 5.8 describe and give
  reasons, 5.9 invite/offer/ask, 5.10 N5 kanji.
- **Express Line** (急行, N4): 4.1 favours, 4.2 may/must/mustn't, 4.3 experiences, 4.4 potential, 4.5 if
  and when, 4.6 guess/hearsay/opinion, 4.7 plans and advice (shown as 工事中, under construction: no content yet, not counted), 4.8 casual speech,
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
  goals:** 30 kanji read from memory on 2 game days, in Shodō (the kanji itself) or Read the Signs (only
  the sign asked about: the single sign, or the target one when there are several). K3 also counts the
  everyday forms (ありがとう, ありがとうございました, すいません, ごめん, おはよう, よろしく おねがい いたします), at the
  start of a line or after a space or punctuation.
- **Only true recall counts, and it's opt-in.** A phrasebook entry carries `recall: 'memory' | 'read'`, and
  an untagged entry is read. A game tags `memory` only for a line spoken (not typed or tapped) without it
  on the screen: Last Train's answers, Shodō's spoken readings, Kana Raid's spoken kana, Bento Haus calls,
  Concentration pairs, Narabete time cards, shiritori words, Onsen questions, Tourist's own lines, and
  the memory answers in Oogiri, Phrase Bingo and Happyōkai. Read is a line on the screen (every line in
  Nice to Meet You!), an echo, a tile answer or encore, a typed answer, a script line or a lyric.
  `tests/recall-tags.test.ts` fails if any phrase a game can log as said leaves `recall` out. Each saved
  phrase keeps `recall` and the days it was said from memory (`memory`).
- **The 21-day re-check:** 21 days after a frame is met, one of its phrases (the one said least, then the
  longest ago) comes first in the phone's phrase review. Only that phrase decides: known, it passes;
  missed, the frame **fades** (a dashed ring on its station) until it's said from memory again on a later
  day, in a game or a review. The 済 stamp stays.
- **Resting:** when a frame lacks only the 3-day gap, saying it again early adds nothing, so its goal
  shows "say it again from Nov 4" and the suggestion moves on to another goal.

A line is **cleared** when all its visible goals that can be met today are met; coming-soon goals (no
matcher yet) don't block it, and the map counts them apart. Players who start at N5 or N4 don't have to
clear the lines below, and what they've said fills those maps in.

**Suggesting the next game.** The first goal on the player's line (their level's, or the next one up with
anything open) that isn't met, can be met today and isn't resting, with a faded goal first, and the first
of its games that fits tonight's room. With nothing to suggest, the strip shows the resting goal's date or
the phrase review instead. A suggestion never blocks anything.

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

- **Lobby:** a two-row strip under Start (under *Waiting for the VIP* on other phones), game first:
  `Next stop: Last Train` over `5.4 Find your way · Local Line`. The VIP gets a small *Put it on the menu*; everyone
  else gets *♡ Wish for it*. Tapping the strip opens why, the frames (with rōmaji at the Kana level),
  a short rule and where to practise. Its height is held while the save loads, so Start doesn't
  jump.
- **VIP's game list:** each game shows its wish count (♡ 2), with no names. A wish is one per phone,
  lobby only, and they all clear when a game starts (the `wish` command; `RoomView.wishes`).
- **Recap:** a *Tonight on your path* box above the phrasebook lists each frame said from memory
  tonight, once, with how many different phrases used it, and a hanko 済 for each goal met tonight
  ("Station stamped on the Local Line"). The strip comes back with no button.
- **Line cleared:** "Local Line cleared!" with the hanko first, the chōchin's 「のりかえです！ つぎの せんへ
  どうぞ。」, the frames, phrases and kanji used, and for the Local and Express Lines a note that the JLPT also
  tests reading and listening (a mock test shows where you stand). Then *Change to the Express Line* /
  *Stay on the Local Line* at the same weight. The Express Line ends with しゅうてん and "Thanks for riding".
  Shown once per line on that phone, below Start or on the recap; it never changes the level by itself.
- **My progress → Path:** the switch, then a train map: three coloured lines (furigana on 各駅停車 and 急行),
  one station per goal, 済 on met goals, a solid ring when the return trip is due and a dashed one when
  the ink is fading, a percentage on started stations and a bar on the current one. Lines below the
  player's level are muted ("Optional · filled in by what you've said"). Tapping a station opens its
  frames, each with its tally ("2 of 3 says · say it again from Nov 4 · needs a game day"), right under
  it. Each station's state is also in text for screen readers, and the current one is `aria-current`. Nothing appears on the TV, and there are no streaks.

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
