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

## The path (version 2: Kana → N5 → N4 → N3)

`shared/src/path.ts`, from the tiers doc v2 (Claude Doc, 2026-11-01, after the game design, JLPT and
learning-science reviews). Four lines of can-do goals, worked back from the N5, N4 and N3 syllabus:

- **Kana Line** (かな線, the New level): K1 hiragana, K2 katakana, K3 greet/thank/apologise, K4 say who
  you are.
- **Local Line** (各駅停車, N5): 5.1 introduce yourself and others, 5.2 shop and order, 5.3 times and
  dates, 5.4 find your way, 5.5 likes and wants, 5.6 your day, 5.7 ask and answer, 5.8 describe and give
  reasons, 5.9 invite/offer/ask, 5.10 N5 kanji.
- **Express Line** (急行, N4): 4.1 favours (＿て ほしい counts too), 4.2 may/must/mustn't (the causative and
  ＿させて ください count too), 4.3 experiences (＿ば よかった and ＿たり ＿たり count too), 4.4 potential, 4.5 if
  and when (のに counts too), 4.6 guess/hearsay/opinion (＿みたいです／＿ようです counts too), 4.7 plans and advice
  (shown as 工事中, under construction, and not counted: Ghost Advice Hotline gives advice with ＿た ほうが いいです
  and ＿たら どうですか, but no game asks for plans yet), 4.8 casual speech, 4.9 polite requests
  (polite ＿んです counts too), 4.10 N4 kanji, 4.11 reasons and too much (＿ので, ＿すぎる), 4.12 change and
  decisions (＿ように なりました, ＿ことに しました), 4.13 the passive (＿やすい／＿にくい count too) and 4.14 quoting,
  purpose and embedded questions (＿と いって いました, ＿ために／＿ように; Ghost Advice Hotline's callers pass on what
  they were told). 4.11 to 4.14 joined at step 6 of the N4/N3
  plan: their frames have been in frames.ts since step 1, and Late Again! (4.11, 4.13), Happyōkai (4.11, 4.12),
  Murder at the Onsen's deputy (4.13, 4.14) and the Word Gauntlet rumour round (4.14) already ask for them.
- **Limited Express Line** (特急, N3): 3.1 rumours and reported speech, 3.2 what happened to me, 3.3 reasons and
  blame, 3.4 contrast, 3.5 what-ifs, 3.6 intentions and attempts, 3.7 explaining, 3.8 service Japanese, 3.9 time
  and change, 3.10 opinions and debate, 3.11 casual nuance, 3.12 30 sign kanji. It's the last line. Most of its
  frames are still coming to frames.ts, so its goals show as coming soon and count once their matchers land;
  3.12 is hidden until the N3 sign kanji are in Shodō and Read the Signs. One rule for frames shared across the boundary: a frame
  tagged N4 in frames.ts may count on an N3 goal only as optional, never required, and every N3 goal requires
  at least one frame no N4 goal offers (both are tests). So 3.1 requires らしい (に よると and ＿んだって count too,
  as on 4.6), 3.4 requires ＿わりに and ＿くせに (のに counts too, as on 4.5), and the N4 frames Ladi made optional
  (Nov 1) stay off the N3 goals' requirements: 3.5 asks for ＿としたら and 4.13 for the passive alone. Frames that
  exist only as N3 ids, such as らしい and させられる, stay required. The line can't clear while any of its
  stations is still coming soon. An N3 player gets the N4 hard roles, decks and hints in every game until a
  game has its own N3 script (`n4Up` in shared/src/level.ts), and N3 joins the level picker once the N3 decks
  are in (`N3_IN_PICKER` in shared/src/protocol.ts).

Yōkai Court (docs/modes/yokai-court.md, step 6) plays on 4.2, 4.6 and 4.14: its N4 lawyers say ＿なければ
なりません and ＿なくても いいです (with a new verb each case), quote the witness with ＿と いって いました, and
its N3 lines use に よると and ＿そうです. On the Limited Express it plays on 3.1 (に よると, optional there),
3.7 (＿わけでは ありません) and 3.10 (＿に ちがいありません). No court line uses the passive, so it isn't on 4.13.

The N4 frames the plan's goals first left out (みたい／ようです, polite ＿んです, the causative, ＿て ほしい,
＿ば よかった, ＿たり ＿たり; Ladi, Nov 1) are optional frames, never required ones. The causative comes in two
frames: a statement (こどもに たべさせました: made or let someone do it) and the "let me" request
(＿させて ください／いただけませんか). Both sit on 4.2, since asking to be let do something is asking
permission and letting or making someone do it is giving permission or setting an obligation; the
いただけませんか half of the request already counts for 4.9. ＿ば よかった (what you should have done) sits with
＿て しまいました on 4.3, and ＿たり ＿たり with ＿た ことが あります, as Minna no Nihongo L19 teaches them.
Polite ＿んです sits on 4.9 because ＿んですが is how you open a polite ask (すみません、きっぷを なくしたんですが…);
casual ＿んだ stays on 4.8. Three of them (polite ＿んです, both causative frames) need the dictionary's part of
speech, and the path still counts without tokens, so they show on their goals but won't move until the
path counts with the server's tokens (docs/n4-n3-frames.md, "For step 2").

Each goal lists its **required frames** (all must be met; one may be "any of", as 5.7's question frame),
frames that **count too**, and the games where players actually say them. The frame, not the game, is
what counts: ＿が すきです said in Oogiri counts for 5.5 as much as in Omiai. The level picker keeps New, N5
and N4; cleared screens use only the line names.

A goal whose required frame frames.ts can't find yet shows its frame as *coming soon* (dashed) and can't
be met or suggested until the matcher lands; `FRAME_TEXT` in path.ts names each with its own label and
hand-written rōmaji, so it lights up with no other change.

For the path, a phrase counts toward every frame in it, N5 to N3 (`framesOf` with `keepHidden`, through
`phraseFrames` in progress.ts), so この ケーキ、おいしそうです counts for both ＿そうです and ＿です. The recap's
"Tonight on your path" box names only the most specific ones. The N4 hard roles and decks from PR #133 are
listed in their goals' games: the Bento Haus manager (4.1, 4.9), Last Train's announcer, Lost and Found
and innkeeper (4.1, 4.6, 4.9), the Dub Club ad-lib (4.8), the Omiai go-between (4.9) and the Tourist N4
deck (4.2, 4.4, already listed). 4.2 still has only Tourist, and 4.7 stays 工事中 (the おもてなし shift's
＿て あります isn't one of its frames).

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
  the memory answers in Oogiri, Phrase Bingo and Happyōkai. Nice to Meet You!'s own true word, spoken, is memory too. Read is a line on the screen (Nice to Meet
  You!'s greeting and こちらこそ), an echo, a tile answer or encore, a typed answer, a script line or a lyric.
  `tests/recall-tags.test.ts` fails if any phrase a game can log as said leaves `recall` out. Each saved
  phrase keeps `recall` and the days it was said from memory (`memory`).
- **The re-checks:** 21 days after a frame is met, and once more 60 days after that check passes, one of its phrases (the one said least, then the
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
  どうぞ。」, the frames, phrases and kanji used, and for the Local, Express and Limited Express Lines a note that
  the JLPT also tests reading and listening (a mock test shows where you stand). Then *Change to the Express
  Line* / *Stay on the Local Line* at the same weight. Until N3 is in the level picker, the Express card offers
  no move: the chōchin says 「とっきゅうの ホームは ただいま こうじちゅうです。」 and there's a single OK. The
  Limited Express Line is the end of the line: 「しゅうてん、 しゅうてんです。 ごじょうしゃ ありがとう ございました。」
  ("Last stop. Thanks for riding.").
  Shown once per line on that phone, below Start or on the recap; it never changes the level by itself.
- **My progress → Path:** a one-row switch, then four route signs, two by two (かな線 · 各駅停車 · 急行 · 特急, furigana over each
  kanji, the count, and ↻ N when a return trip is due) that show one line at a time, opening on the line
  the suggestion is on. Line colours are their own (Kana sky blue, Local green, Express orange, Limited Express rose); gold and
  white only mark states. A met station is a solid disc with a check; a started one fills like a clock; a
  return trip due adds a second ring, and fading ink hatches the disc with a dashed edge. Coming-soon
  stations are small grey diamonds on a dashed stretch, and 4.7 is a striped 工事中 barrier. Every state
  also has a pill in words. Tapping a station opens its sheet (the game's bottom sheet): the red 済 hanko
  and date when met, then its frames with tallies, the rule and the games. A のりかえ button at the end of a
  line goes to the next. Lines below the player's level say "Optional · filled in by what you've said".
  Nothing appears on the TV, and there are no streaks.

## How it works

- `GET /api/account/me` returns `pathStatus` (every goal, frame and line, from the whole save) beside
  `path` and `frames`. The account service runs `markPath` after each saved game, phrase review and kana
  review, so frames and goals are stamped on the server.
- The room only ever sees wish counts. It never learns who is on the path.
- `npm run sim:express` measures how many nights the Express Line takes, with bots playing the real games
  and the real path rules. The results, and the goals no game carries yet, are in
  [path-simulation.md](path-simulation.md).

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
