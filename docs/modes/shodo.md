# Shodō Taikai (書道大会), the Calligraphy Contest, backlog

Ladi asked for handwriting practice on the phone: tracing and writing kana, and kanji for the
higher levels, with stroke order checked, fitting the party format and each player's level. This
mode is the "new mode" option (the Kakizome Contest design), reviewed by the expert panel and the
art and music panel on 2026-10-27 (reviews in the project files, `reviews/kakizome-panel-2026-10-27/`).
In code and on screen it is Shodō Taikai; the seasonal Kakizome skin is deferred (below).

Host: **Fude**, in a quiet teacher register (his own `shodo_*` lines, so his battle lines from Kana
Raid never leak in). Catchphrase: とめ・はね・はらい. Players: 1–8, each at their own level.

Code: `shared/src/modes/shodo/` (`shodo.ts` rules and view, `deck.ts` what each level writes),
`shared/src/brush.ts` (brush outlines), `content/src/kanji/` (the kanji list and its KanjiVG strokes,
built by `tools/content-kanji-strokes.ts`), `controller/src/components/brushPad.ts` (the writing pad),
`controller/src/modes/shodo.ts` + `.css`, `stage/src/modes/shodo.ts` + `.css`,
`tools/bots/policies/shodo.ts`, `tests/shodo.test.ts`.

## What each level writes

| Level | Practice (お手本) | Dictation (書き取り) | Gallery word |
| --- | --- | --- | --- |
| かな | hiragana | hiragana and katakana (the twin shown as a clue) | ねこ はな そら うみ やま |
| N5 | kanji steps 1–5 | kanji steps 1–7 | 山 川 木 雨 車 本 |
| N4 | two N4 kanji (steps 8–11) and one N5 review kanji (steps 3–7) | N5 and N4 kanji, and words with an N4 kanji in the middle item (会社, 教室, 天気…) | 春 冬 秋 花 犬 海 |
| N3 (step 6) | two sign kanji (steps 12–14) and one N4 review kanji | N4 and sign kanji, and the sign words in the middle item (非常口, 受付, 予約, 禁煙…) | 窓 煙 席 |

The kanji (70 N5, 61 N4, 30 sign kanji) and their order come from the Japanese expert's list, and the
PR #146 panel. Step 11 adds the N4 kanji the game's own N4 lines use (思 持 待 使 乗 着 終 写 会 教, and
夏 映 売 計 堂 発). Steps 12–14 are goal 3.12's 30 sign kanji: kanji read on station and inn signs, never
called "N3 kanji". The N3 deck is keyed by `DeckLevel` (`Level | 'n3'`) until N3 joins the level picker.

Each kanji has a word to say: the kanji itself where it stands alone (山 やま), otherwise a common word
with it (日 → 毎日 まいにち). A sign kanji says the sign it's on (常 → 非常口 ひじょうぐち). The words
(学生, 会社, 非常口 …) use only listed kanji.

At N4 and N3 the last "say it, then write it" item brings the second practice kanji back inside a word
when one has it (社 → 会社), never a word above the player's band. A practice deal never holds two kanji
with the same say-word (改 and 札 both say 改札).

What the path counts as read from memory (PR #147 panel): the practice say is read aloud off the card, so
it logs `read`; the memory rep logs `memory` only when the writing passes; "say it, then write it" logs
`memory` only when said before "show me the reading" and then written correctly (said after a peek, it
earns the plain speaking bonus, not the recall one). Its prompt shows the say-word's English ("an
emergency exit"), since that's the word it accepts.

The gallery adds one silly brief for the whole room, picked per game: ねむい (sleepy), おこった
(angry), つかれた (tired), こわい (scary), げんきな (lively) or おなかが すいた (hungry). Each player
writes their own word and makes it look like the brief, so the wall is a set of sleepy mountains
and sleepy cats; the sentence is 「ねむい やまです」 (the humor review, 2026-10-27).

## How a game goes

| Phase | Shared name | Stage header | What happens | Length |
| --- | --- | --- | --- | --- |
| Intro | `intro` | Intro | The three rounds on the TV. | 14 s |
| Practice | `prompt` | お手本 · Trace and write | Three targets each. Say each one first (aloud, typed, or skip), then the reps interleave: trace A B C over the model, trace A B C over a faint model, write A B C from memory. Traced strokes are checked one at a time as the finger lifts; a wrong one fades out with a tip ("Start at the red dot, from the top down"), so nobody practises a mistake. "I know this one" skips a target's tracing. The TV fills one shared scroll, a column per player, no names. | 100 s |
| Read the scroll | `score` | Read the scroll | Everyone reads the scroll aloud together (せーの!). | 12 s |
| *three items:* | | | | |
| Write | `answer` | 書き取り · Dictation | Items 1 and 3: the meaning is shown, say the word from memory (or "show me the reading"), then write it. Item 2: the phone voices the word (🔊, the player's own tap replays it), then write it. Items 1 and 3 come back to two of the player's practice targets (spacing). | 45 s |
| Synchro replay | `reveal` | Synchro replay | Every sheet brushes on at once, stroke by stroke, a little askew; "順 ×" marks a stroke out of order. Only clean writers are named. When a miss reads as a look-alike, Fude misreads it aloud and asks where the real word went, and 「…犬かな?」 pops up under that sheet. Fude has one line per replay: a misreading, else a stroke out of step (シンクロ！…あれ？), else a clean sheet. Each phone shows its own result with the model. | 10 s or more (the longest sheet's replay + 5 s) |
| Big sheet | `encore` | 展覧会 · Your big sheet | One big sheet: the player's word, shown but with no model under the pad, written to the room's brief; then say the sentence (ねむい やまです; without です, or the word alone, also counts). With the VIP's "Big sheet with the other hand" option ticked, Fude asks for the other hand and the phone and TV show it. | 60 s |
| Stamps | `finale` | Hanko stamps | The TV hangs every sheet, numbered in shuffled order, and brushes them all on together, stroke by stroke, with Fude's はなまる on each one's best stroke once it's done. Fude reacts as they appear, or calls back a misreading from earlier (「こんどは 犬じゃ ないですね」). Each player places three of the four kind stamps (たっぴつ賞, おしかったで賞, どうぶつに みえるで賞, すみだらけで賞) on others' sheets and may move them. Skipped with fewer than 3 players. | 35 s |
| Claim it | `penalty` | Claim it | Stamps show. The TV lists each stamp's winner by number and Fude reads one out (the funniest stamp given: どうぶつ, then すみ, おしい, たっぴつ); a winner's phone says what it won. Anyone may claim their sheet ("That one's mine!"); the first claim gets applause from Fude, and claimed winners are named. The room reads them all as a send-off. | 16 s |

With every timer running out, a game is about 7 minutes; most phases end early once everyone is in.

### Points

| What | Points |
| --- | --- |
| A trace rep, every stroke right | 10 |
| A faint trace rep, every stroke right | 15 |
| From memory: clean / it reads | 50 / 30 |
| Dictation: clean / it reads | 100 / 60, × 0.8 + 0.04 per stroke (1 to 1.6; kana × 1) |
| Gallery: per stamp received (cap 120) | 30 |
| Gallery: clean / it reads | 40 / 20 |
| Saying it before tracing: aloud / typed | 20 / 5 |
| Saying it from memory in items 1 and 3: aloud / typed | 40 / 5 |
| The gallery sentence: aloud / typed | 20 / 5 |

Writing never earns a speaking bonus. Speaking bonuses are settled when a phase ends and capped
at 30% of a player's points. Points are paid once per phase (not per stroke), so the score chime
rings once instead of all through a quiet round.

Recap awards: each stamp's winner, if they claimed their sheet (たっぴつ賞, おしかったで賞, どうぶつに みえるで賞,
すみだらけで賞), かきとり めいじん (the most clean sheets), どりょく賞 (kept at it after the most corrected
strokes). No "worst" award anywhere; an unclaimed winner stays anonymous (「かいた ひとは… しって いますね」).

## Sheets and the pad

- A sheet is a 3:4 sheet of paper with its characters stacked top to bottom, as kakizome is written:
  one square fills the width, two shrink to two thirds (art and Japanese panels).
- Free pads send the ink so far a moment after each stroke (a `draft` move). When time runs out, a
  dictation or big sheet with ink on it is handed in as it stands; recall still needs the reading
  shown first (UX panel).
- Hand-in sits right under the paper, above Undo and Clear, so it fits on a 390×844 phone.
- Finished strokes on the phone are drawn with the same brush outline as the TV.
- A wrong traced stroke's tip says where to go: "Start at the red dot and go down and to the left",
  or "Other way: this stroke goes …". `strokeWay` now names where a stroke starts by its place in the
  box (thirds), not by its direction.

## Privacy

- The phone never gets the written form before the sheet is graded: memory reps and items carry
  no model and a blank text; recall items blank the reading too until it is said. A kana's reading
  is the kana itself, so the phone only voices it and shows the romaji or the twin.
- The TV never shows who is still writing: counts only, scroll columns without names, the gallery
  in shuffled order, names only for clean replays and claimed sheets.

## Music and sound

The soft synth tune (`gentle`) for the writing rounds, under the whole time players write, say or
read, and at the listening level during dictation (each phone voices its own word). The gallery
switches to Japanese Lofi HipHop (pickentcode, koto over a lo-fi beat; Ladi's pick, 2026-10-27):
full while the big sheets are written, under once the first is in (players say their sentence into
the phone), full for the stamps, under for the claim and the read-aloud. Fude stays quiet on
dictation items, and the phones voice their words in seat order, 1.2 s apart, so nothing talks over
the word (music panel). No drum
roll, no score or finale tunes. Phones stay silent apart from the player's own 🔊 tap. The track's
rights are ❓ (commissioned on Fiverr; commercial blockers row 22); streamer mode plays the synth.

## Deferred from v1

- The seasonal Kakizome skin (Jan 1–15) and the bonfire (どんど焼き) finale; v1 has a simple send-off.
- An allow-list of alternate stroke orders (some kanji have two taught orders).
- Brush endings (とめ・はね・はらい) from KanjiVG's stroke types; the brush uses a heuristic for now.
- "Pick it instead" for players who can't write at all, and a left-hand layout setting (the
  other-hand option is a party twist, not this).
- Relay calligraphy (one character, a stroke per player).
- An Ink Storm retry with tracing in Kana Raid.

## Open questions

1. **Gallery music rights.** The chosen track was commissioned on Fiverr and uploaded as CC0; confirm
   the rights before selling, or fall back to Senbazuru (CC BY).
2. **Fluent check** of the kanji say-words (毎日 for 日, …), the gallery briefs and sentences
   (ねむい やまです), and Fude's lines.
3. **Real phones.** A traced stroke must stay within 0.085 of the pad at N5 and N4. Kana-level
   beginners get 0.125 (Ladi asked for a looser check for beginners), and "Steady hand" loosens
   either a step more (0.125, or 0.16 for beginners); the server re-checks at 0.16. These were
   tuned on synthetic strokes and need a try on small phones and with a stylus.
4. **Stroke counts.** `tests/shodo.test.ts` checks a sample against school charts; KanjiVG is
   the source for the rest.
