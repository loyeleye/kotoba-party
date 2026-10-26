# Oekaki (お絵かき), backlog

Design doc line: "Oekaki: Drawful-style drawing and fake answers in Japanese."

Every player privately gets a Japanese word or phrase from the night's topic pack and draws it
on their phone. Then the TV shows the drawings one at a time. Everyone except the artist writes a
fake title **in Japanese** (said aloud, typed, kana pad, or built from word tiles); the real
title is mixed in; everyone votes for the one they think is real. Points for finding the real
title, for every player your fake fools, and for the artist when people read their drawing. Then
the room says the real title together, and it goes in everyone's phrasebook ("Sketchbook").

Host: **Fude**, the living brush (see decision 1). Players: 3–8. Rounds: 1 (default) or 2; each
round everyone draws once.

Code: `shared/src/modes/oekaki/` (`oekaki.ts` rules and view, `drawing.ts` wire format and
palette, `fakes.ts` fake titles and the too-close check, `prompts.ts` what players draw and the
word tiles), `stage/src/modes/oekaki.ts` + `.css`, `controller/src/modes/oekaki.ts` + `.css`,
`tools/bots/policies/oekaki.ts`, `tests/oekaki.test.ts`.

## How a game goes

| Phase | Shared name | Stage header | What happens | Length |
| --- | --- | --- | --- | --- |
| Intro | `intro` | Intro | The four steps on the TV. | 12 s |
| Draw | `prompt` | Draw! | Each phone shows its secret word (kana reading, romaji at Kana level, English) above a drawing pad with six colours, Undo and Clear. The TV shows who has sent a drawing. Ends when every connected player has drawn. | 80 s |
| *per drawing, in shuffled order:* | | | | |
| Fake titles | `answer` | Fake titles | The TV replays the drawing stroke by stroke (about 5 s) and asks これは なに？. Every non-artist writes a fake title. The artist's phone shows their own word ("keep a straight face"). Ends when every connected writer is in. | 50 s (+15 s if a writer plays at Kana level) |
| Vote | `reveal` | Find the real one | The real title joins the fakes in an anonymous order (by random id). Every title is shown **in kana** so kanji can't give the real one away. Everyone but the artist picks one (not their own). Ends when every connected voter is in. | 25 s |
| Say it together | `score` | Say it together | The real title big (kanji with furigana, romaji if anyone is at Kana level, English), who found it, and every fake with its author and who fell for it. Every phone offers "Say it with the room" (hold to talk, or type). Fude calls みんなで！ せーの！ | 16 s |

A one-round game with 8 players runs about 80 s + 8 × ~90 s ≈ 13–14 minutes if every timer runs
out (phases end early when everyone is in, so it's usually shorter). With 3 players, about 5.

A player who never sends a drawing is simply skipped; a drawing whose artist has left is still
shown (it earns nothing). A drawing the VIP hides goes straight to its score beat.

### Points

| What | Points |
| --- | --- |
| Finding the real title | 100 |
| Each player your fake fools | 50 (two players who wrote the same fake both get it) |
| The artist, per player who found the real title | 50 |
| Last round, when there are 2 | all of the above ×2 |
| Speaking bonus (capped pool): sending your fake by voice / typed | 20 / 10 (tiles: 0) |
| Speaking bonus (capped pool): saying the real title at the score beat / typing it | 30 / 10 |

Speaking bonuses come from one pool per drawing, at most 30% of that drawing's points (the design
doc's rule; the same formula as Word Gauntlet). The fake-title voice bonuses are paid when the
drawing is scored, scaled down together if the pool can't cover them; the say-it bonuses are
first come, first served from what is left. Nothing ever costs points: a wrong say-it attempt
just gets a kind "Not quite: it's からい すし. Try again!".

### What players draw (`prompts.ts`)

- The pool is the chosen pack's **nouns**, minus the pack's baseline words (held back for the
  delayed spoken test), stereotype words, and tags that don't draw (`directions`, `position`,
  `time`, `own-family`, `others-family`). The pack's funny "swerve" phrases (ねこの シェフ,
  なっとうアイス, おばけ電車) are in, and are the best prompts.
- **Kana level:** one kana-level word (a pack with none, like family, gives N5 words shown in
  kana with romaji).
- **N5 and N4:** any kana or N5 word, or half the time an **い-adjective + noun pair** from a
  built-in list of 14 drawable adjectives (からい すし "spicy sushi", 青い ねこ "blue cat",
  ねむい ラーメン "sleepy ramen"). Pairs practise the adjective-before-noun pattern and are funnier
  to draw. N4 players get N5 content (no N4 pack content until after v1).
- No word (or reading) is dealt twice in a game; when a small pack runs out it repeats rather
  than stopping. With no packs at all a 12-word built-in list keeps the game running.

Phrasebook item ids are the pack word's id, or `oekaki.<adjective>+<word id>` for a pair.

### Fake titles (`fakes.ts`)

- **Say it / type it** (`{ kind: 'fake', utterance }`): at most 30 characters, must contain
  kana or kanji (`not-japanese` otherwise). The server adds the kana reading for kanji
  (`server/src/reading.ts`), so 拉麺 compares as らーめん.
- **Word tiles** (`{ kind: 'fake', tiles: [indexes] }`): each writer gets a hand of 7 for each
  drawing: 4 nouns and 2 adjectives from the pack that share **no reading** with the real title
  (tiles must never hand out a piece of the answer), and の. Up to 4 tiles; の joins its
  neighbours (ねこ + の + ラーメン → ねこの ラーメン, "cat's ramen"); a stray の at either end is
  dropped. Open by default at Kana level, one tap away for everyone else. A Kana-level writer's
  tile title is written in kana (their tiles show kana).
- **Too close** (`too-close`): the same reading however it's spelt (katakana = hiragana, ー =
  the vowel, づ/ず, を/お via `soundKey`), the real title with something added, or one kana
  away from it when the title has 3+ kana (a typo of the answer). Only *part* of the real
  title (ねこ for ねこの シェフ) is allowed: that's a fair bluff.
- Two fakes that read the same share one option, and both authors earn when it fools someone.
- **Fude's decoys:** if fewer than 2 fakes come in, Fude adds other pack words (never too close
  to the real title) so there's always something to vote between. A decoy fools nobody into
  points.

### Drawings on the wire (`drawing.ts`)

`{ kind: 'draw', strokes, colors }`: Ink Storm's format (strokes of `[x, y]` in 0–1, start to end)
read by the same `readInk`, with free-drawing limits: 48 strokes, 96 points a stroke, 720 in all
(about 10 KB at 3 decimals, under the server's 16 KB command limit). `colors` is one palette index
(0–5) per stroke; the palette itself lives in the code, so the server never stores a colour
string. Anything malformed, over the limits, or less ink than 5% of the pad (a tap) is refused
with `bad-drawing`. The phone thins long drawings to fit before sending (`thinToLimits`, which
gives long strokes more points than dots).

**Payload size:** the drawing on show is sent in the **stage's** view only, and only during its
fake/vote/score phases (at most about 10 KB). Phones never get drawings (they say "Look at the
TV"), so the eight phone views stay around 1–2 KB.

### Moderation (VIP)

The VIP's phone has **Hide this drawing** (fake titles, vote and score beats) and **Hide "…"** for
each title (vote and score beats), using `ctx.vipId` like Oogiri's Hide. A hidden title shows as
"[hidden]" on every screen, can't be picked, and anyone who had picked it picks again. A hidden
drawing disappears from the TV ("Fude painted over this one"), its turn jumps to the score beat
with no points, and the real title is still said together. There is no automatic text filter for
player text yet (same as every other mode; see open-questions 26).

### The TV

Intro steps; the draw screen (an easel per player that stops wiggling when their drawing is in);
then a framed drawing on the left (replayed stroke by stroke during fake titles, the replay timed
from when the phase first showed so a redraw never restarts it) with the question, the
anonymous kana titles, or the reveal on the right. Romaji appears on the TV only when someone at
the table plays at Kana level. Checked at 1920×1080 and 1280×720 (at 720p the frame shrinks and
the result list scrolls a little; the host bar takes a lot of the height). All CSS is scoped under
`.oek`; the pad and replay reuse Ink Storm's `.ink-*` classes.

### The phone (360 px)

Draw: secret word card, a square pad (`inkPad` with Oekaki's limits, palette and a thinner line),
six colour swatches, Undo / Clear / Send. Fake titles: hold to say it, "Can't talk right now?
Type it" (with the kana pad), and the word tiles. Vote: the titles as big buttons (kana, romaji at
Kana level), your own greyed out. Score: the real title, your points, a one-line summary, and
"Say it with the room".

### Bots

`oekakiPolicy({ seed, delayMs })`: draws a wobbly coloured blob with two eyes, a mouth and a few
loose lines (`botScribble`), writes a fake from its tiles (an adjective + noun, noun の noun, or
one noun; even seats send the tiles, odd seats say or type the same words), picks a title by
seat, and says the real title at the score beat (speech or typed by seat). `npm run bots --
--mode oekaki` plays whole games on the stage.

### Host cues (Fude)

Only `kakegoe_call` at each score beat, with the real title as the prompt (bank: "みんなで！
せーの！"; an LLM host gets the title to call out), plus the shared `recap_award`. See decision 1.

### Awards

がはく "Master Painter" (most players read your drawings), うそつき名人 "Master Fibber" (fooled
the most players), めいたんてい "Great Detective" (found the most real titles). Each needs at
least one.

## Decisions made on Ladi's behalf

1. **Host: Fude.** A living brush hosting the drawing show is the obvious fit. Fude's written
   bank is Raid-themed ("Next kana! Here we go!", "Everyone attacked!"), so the mode cues only the
   generic call-and-response at each score beat; no intro, prompt or reveal cues. Oekaki-specific
   Fude lines are an open question.
2. **Real titles come from the topic pack** (nouns and the pack's swerve phrases), plus
   adjective + noun pairs for N5/N4, not from an LLM. No round waits on an LLM; this is also the
   non-AI fallback, so there's nothing to fall back from. The 14 adjectives and the 12 fallback
   words live in `prompts.ts` (mode folder, draft, need the fluent check), keeping
   `ContentLibrary` unchanged.
3. **Fakes must be Japanese.** English fakes are refused (`not-japanese`, with a nudge to the
   tiles) because the mode exists to get people producing Japanese. Kanji are fine.
4. **The vote shows every title in kana.** The real title often has kanji (古い カレー) and
   typed fakes rarely do, which would give it away. The written form (with furigana) appears at
   the score beat.
5. **Word tiles for everyone, open by default only at Kana level**, as the quiet fallback and the
   beginner scaffold. Tiles never contain any piece of the real title. Tile fakes earn no voice
   bonus (tapping is a scaffold; the design doc's ladder rewards saying).
6. **Too-close rules** as listed above (same reading, the answer plus extra, one kana off for 3+
   kana). A partial title is allowed. Compared as kana readings, so it's forgiving of spelling
   but catches ラーメン/らあめん/拉麺.
7. **Points: 100 find, 50 per fooled player, 50 to the artist per finder**, the same scale as
   Word Gauntlet's Fake Kanji. Drawful's own numbers are 10× bigger; the ratios are similar.
8. **One 30% speaking pool per drawing.** Saying your fake aloud (20) or the real title at the
   score beat (30) are bonuses; typed earns 10 each. A drawing nobody scored on (everyone fell
   for a decoy, or it was hidden) has an empty pool, so its say-it is worth only the phrasebook
   entry. That's the shared rule applied strictly.
9. **Last round double only when there are 2 rounds.** In a one-round game every drawing is its
   own mini-round with a different artist, and doubling the last artist alone would be unfair.
10. **Everyone draws at once** (Drawful's way), then drawings are shown in a shuffled order, so the
    TV never hints whose drawing is whose by seat. The artist is named at the score beat.
11. **Drawings go to the stage only.** Phones never get the strokes, which keeps every phone view
    small (stage views are sent to every client on every change; the drawing rides only on the
    stage's). Remote players see the drawing through the shared stage tab, like every other mode.
12. **Free-drawing limits: 48 strokes, 96 points a stroke, 720 points in all, 6 colours, no
    eraser or brush sizes.** Big enough for a doodle in 80 seconds, small enough to fit a 16 KB
    command and a compact view. Undo removes the last stroke.
13. **Fude's decoys** when fewer than 2 fakes come in, so a quiet table still gets a real vote.
14. **VIP moderation:** hide a drawing (skips to its score, no points) or a title ("[hidden]",
    picks undone). The VIP can't see fakes before the vote, so titles can only be hidden from the
    vote on.
15. **The artist can't write a fake or vote** on their own drawing, but does say the title with the
    room.
16. **Sketchbook:** every player gets every real title as `seen`; saying (or typing) it at the
    score beat makes it `said`. Fakes don't go in the phrasebook (they may be wrong Japanese).
17. **Romaji** only for Kana-level players on their phone, and on the TV when anyone at the table
    is Kana level (as Concentration and Karaoke Duel do).
18. **3–8 players.** With 2 there's only one voter per drawing and no one to fool.

## Open questions

1. **Oekaki lines for Fude.** Intro, "これは なに？" at each drawing, a reaction when everyone (or
   nobody) found the real title, and an artist cheer. About 30 lines; needs the fluent check.
2. **Should phones show the drawing too?** Useful for remote players without a shared screen and
   for small TVs; costs up to 10 KB per phone per update while a drawing is up. Could be sent once
   per drawing outside the view.
3. **Draw time.** 80 s is a guess (Drawful uses 90 s). Kana-level players get no extra drawing
   time; their extra time is for writing fakes.
4. **Pairs for N5:** half the prompts are adjective + noun pairs. More, fewer, or only in round 2?
   Should N5 also get the pack's short phrases (〜を たべる)? They're hard to draw.
5. **Should "Lie for me" exist?** Drawful offers ready-made lies. The tiles do this job now; a
   "suggest one" button would be faster but teaches less.
6. **Should the artist get a bonus for saying their own title first** (a say-it-first moment from
   memory before the reveal)? Not built.
7. **Is a partial-title fake fair?** ねこ for ねこの シェフ is allowed now. Fibbage would refuse it.

## Known gaps

- **No automatic text filter** for fakes: only the VIP's Hide (same as every mode but Oogiri's
  host lines; open-questions 26).
- **No drawing moderation beyond Hide.** Nothing checks what was drawn.
- **A drawing in progress is lost if the timer runs out** before Send (the phone keeps the
  strokes across redraws, but doesn't auto-send at the deadline).
- **The pad has no eraser, fill or brush size**, and hasn't been tried with a thumb on a real
  phone (same caveat as Ink Storm).
- **Never tested with real speech**: headless Chromium has no recogniser, so the smoke test typed.
- **The adjective list, fallback words and award titles are draft** and need the fluent check.
- **At 1280×720 the score beat scrolls slightly** below the fold with 3+ fakes (the host bar,
  header and player list take most of the height).
