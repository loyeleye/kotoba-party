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

| Level | Practice (お手本) | Dictation (書き取り) | Gallery theme |
| --- | --- | --- | --- |
| かな | hiragana | hiragana and katakana (the twin shown as a clue) | ねこ はな そら うみ やま |
| N5 | kanji steps 1–5 | kanji steps 1–7 | 山 川 木 雨 車 本 |
| N4 | kanji steps 3–9 | kanji steps 1–10, and two-kanji words in the middle item | 春 冬 秋 花 犬 海 |

The kanji (66 N5, 45 N4) and their order come from the Japanese expert's list. Each kanji has a
word to say: the kanji itself where it stands alone (山 やま), otherwise a common word with it
(日 → 毎日 まいにち). Fourteen two-kanji words (学生, 先生, 日本, 火山, 花火 …) use only listed kanji.

## How a game goes

| Phase | Shared name | Stage header | What happens | Length |
| --- | --- | --- | --- | --- |
| Intro | `intro` | Intro | The three rounds on the TV. | 14 s |
| Practice | `prompt` | お手本 · Trace and write | Three targets each. Say each one first (aloud, typed, or skip), then the reps interleave: trace A B C over the model, trace A B C over a faint model, write A B C from memory. Traced strokes are checked one at a time as the finger lifts; a wrong one fades out with a tip ("Start at the red dot, from the top down"), so nobody practises a mistake. "I know this one" skips a target's tracing. The TV fills one shared scroll, a column per player, no names. | 100 s |
| Read the scroll | `score` | Read the scroll | Everyone reads the scroll aloud together (せーの!). | 12 s |
| *three items:* | | | | |
| Write | `answer` | 書き取り · Dictation | Items 1 and 3: the meaning is shown, say the word from memory (or "show me the reading"), then write it. Item 2: the phone voices the word (🔊, the player's own tap replays it), then write it. Items 1 and 3 come back to two of the player's practice targets (spacing). | 45 s |
| Synchro replay | `reveal` | Synchro replay | Every sheet brushes on at once, stroke by stroke, a little askew; "順 ×" marks a stroke out of order. Only clean writers are named. When a miss reads as a look-alike, Fude misreads it aloud (「犬」…かな?). Each phone shows its own result with the model. | 10 s or more (the longest sheet's replay + 5 s) |
| Big sheet | `encore` | 展覧会 · Your big sheet | One big sheet from the theme "something I love", with a faint guide, then say the sentence (やまが すきです). | 60 s |
| Stamps | `finale` | Hanko stamps | The TV hangs every sheet, numbered in shuffled order, with Fude's はなまる on its best stroke. Each player places three of the four kind stamps (たっぴつ賞, おしかったで賞, どうぶつに みえるで賞, すみだらけで賞) on others' sheets and may move them. Skipped with fewer than 3 players. | 35 s |
| Claim it | `penalty` | Claim it | Stamps show. Anyone may claim their sheet ("That one's mine!") and the room reads them all as a send-off. | 16 s |

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

Recap awards: たっぴつ (the most たっぴつ stamps), かきとり めいじん (the most clean sheets), どりょく賞 (kept at
it after the most corrected strokes). No "worst" award anywhere.

## Privacy

- The phone never gets the written form before the sheet is graded: memory reps and items carry
  no model and a blank text; recall items blank the reading too until it is said. A kana's reading
  is the kana itself, so the phone only voices it and shows the romaji or the twin.
- The TV never shows who is still writing: counts only, scroll columns without names, the gallery
  in shuffled order, names only for clean replays and claimed sheets.

## Music and sound

One soft synth tune (`gentle`) throughout, under the whole time players write, say or read, and at
the listening level during dictation (each phone voices its own word). Full only for the stamp vote.
No drum roll, no score or finale tunes. Phones stay silent apart from the player's own 🔊 tap.

## Deferred from v1

- The seasonal Kakizome skin (Jan 1–15) and the bonfire (どんど焼き) finale; v1 has a simple send-off.
- An allow-list of alternate stroke orders (some kanji have two taught orders).
- Brush endings (とめ・はね・はらい) from KanjiVG's stroke types; the brush uses a heuristic for now.
- "Pick it instead" for players who can't write at all, and a left-hand layout setting.
- Relay calligraphy (one character, a stroke per player).
- An Ink Storm retry with tracing in Kana Raid.

## Open questions

1. **Gallery music.** Ladi's call is pending: Hot Springs Town (CC0), Senbazuru (CC BY), or keep
   the synth. v1 plays the synth.
2. **Fluent check** of the kanji say-words (毎日 for 日, …), the gallery sentences and Fude's lines.
3. **Real phones.** A traced stroke must stay within 0.085 of the pad at N5 and N4. Kana-level
   beginners get 0.125 (Ladi asked for a looser check for beginners), and "Steady hand" loosens
   either a step more (0.125, or 0.16 for beginners); the server re-checks at 0.16. These were
   tuned on synthetic strokes and need a try on small phones and with a stylus.
4. **Stroke counts.** `tests/shodo.test.ts` checks a sample against school charts; KanjiVG is
   the source for the rest.
