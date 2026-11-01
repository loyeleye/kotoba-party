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

## The path

`shared/src/path.ts`. Eight steps, one game each, with the frames it practises and a goal read from
what the account already saves (caught yōkai, games played, phrases said from memory):

| # | Step | Game | Frames | Done when |
| --- | --- | --- | --- | --- |
| 1 | Read and say the kana (Kana level only) | Kana Yōkai Raid | — | 20 yōkai caught |
| 2 | Introduce yourself | Nice to Meet You! | ＿は ＿です, ＿です | played once, and a ＿です sentence (＿が すきです counts) said 3 times |
| 3 | Ask for things and places | Last Train | ＿を ください, ＿は どこですか | played once, and 〜を ください said twice |
| 4 | Order with numbers | Bento Haus (or VS) | ＿を ください | one shift |
| 5 | Make your own sentences | Oogiri Night | ＿は ＿です, ＿が すきです, ＿たいです | 2 games |
| 6 | Times, prices and opinions | Narabete! | ＿です | 1 game |
| 7 | Ask and answer questions | Who's the Tourist? | ＿ですか／＿ますか, そうです／ちがいます | 1 game |
| 8 | Polite Japanese | Omiai Matchmaker | ＿は なんですか, ＿ませんか, ＿ても いいですか | 1 game |

N5 and N4 players skip step 1. The order follows the design doc's own (kana, then fixed frames in
real situations, then free sentences) and the video's (kana, then A は B です, then survival phrases,
then situations).

**Suggesting the next game.** The phone suggests the first step not yet done that tonight's room can
play (enough players, enough mics). If the path's next game doesn't fit (Nice to Meet You! needs 3
players), it suggests the next one that does and says so. Once every step is done, it suggests the
game with the most saved phrases due, so playing it brings them back. A suggestion never blocks
anything: it's one card, and anyone can ignore it.

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

- **Lobby:** under the level picker, a gold card: *Your learning path · step 2 of 7*, the game's
  name, the step, why this game now, its frames as chips, and what "done" means. The VIP gets *Put
  Nice to Meet You! on the menu* (it picks the game; they still press Start); anyone else gets *Fancy
  it? Ask the VIP.* Once it's the VIP's pick, the card says so.
- **Recap:** each phrase card in tonight's phrasebook gets its frame as a chip (「＿を ください」 ·
  ___, please; with rōmaji at the Kana level). The path card comes back above *Back to the menu*,
  reloaded once the finished game is saved, so a step done tonight moves the path on at once.
- **My progress → Path:** the switch; the steps with a ✓, ▶ (next) or a progress bar and what's
  left; and *Sentence frames*: every frame met so far with how many times it was said and the
  player's own most recent example, then the rest folded under *N more frames to meet*.

## How it works

- `POST /api/account/settings { path: boolean }` saves the switch and returns the account
  ([accounts.md](accounts.md#api)). `GET /api/account/me` now also returns `path` and `frames` (each
  frame met in the saved phrasebook: phrases, times said, three examples).
- The phone works the suggestion out itself (`suggest(factsOf(account), room)`), so nothing new is
  stored and the room never learns who is on the path. It loads the account when the lobby opens and
  1.5 s into each recap.

## Open questions

1. **The order and the goals** are a first guess. Should Nice to Meet You! come before Last Train for
   a pair who can't play it? Are 20 caught yōkai the right gate for a Kana-level player?
2. **A VIP badge.** The VIP's menu could mark each game with the players whose path suggests it
   ("Aki and Ken's next step"). It needs the room to read each signed-in player's save, so it's left
   for later.
3. **Frames in the middle of a game.** Frames show at the recap and on My progress, not during play,
   to keep eyes on the TV. Last Train's reveal and Oogiri's score card (which already shows its
   pattern) would be the first places to add a chip if they're wanted mid-game.
4. **Kanji as signs** (the video's third idea) is planned as a Last Train minigame, in its own PR.
