# Kana Yōkai Raid (かな妖怪レイド)

The co-op on-ramp, hosted by Fude, the living brush. 1–8 players. Kana-shaped yōkai march
across the stage towards the gate (⛩) and the team knocks them out from their phones. It
follows the design doc's "Kana Yōkai Raid (on-ramp)" section.

Code:

- Rules: `shared/src/modes/kanaRaid/kanaRaid.ts` (state, phases, scoring, views) and
  `shared/src/modes/kanaRaid/deck.ts` (decks from `ctx.content`, the built-in placeholder
  set, the kana sound check, tips).
- Stage: `stage/src/modes/kanaRaid.ts` + `.css`. Phone: `controller/src/modes/kanaRaid.ts` + `.css`.
- Bot: `tools/bots/policies/kanaRaid.ts` (`kanaRaidPolicy()`). Tests: `tests/kanaRaid.test.ts`.

## How a game runs

| Room phase | Raid beat | Default length |
|---|---|---|
| `intro` | **Chapter pick.** Each phone lists the 13 chapters (ToKini Andy's pairs course). Players tick the chapters they've studied (default: chapter 1) and press Ready. Ends when everyone is ready or the timer runs out, so it never holds up the room. | 30 s |
| `prompt` | Wave banner (Fude cues `raid_wave_start`). | 5 s |
| `answer` | **The battle.** The horde walks on; each player gets attack after attack. | until the last yōkai would reach the gate (≈35–60 s), or earlier when none are left |
| `reveal` | Wave results: caught, escaped, best combo. | 9 s |
| `score` | Points per player this wave, with the speaking share. | 7 s |
| … | Waves 1–3 repeat prompt → answer → reveal → score. | |
| … | **Wave 4, Ink Storm** (on by default; see below): draw each kana on the phone, then say it. | ≈45–60 s |
| `finale` | **Boss: Word Yōkai.** | 75 s, or earlier when everyone has read the word |
| `encore` | **The raid's recap**: what the team got right, the haunted list, each phone's own tally. | 25 s |
| `recap` | The room's recap: standings, Fude's awards, the phrasebook (memory cards). | |

`progress()` reports waves as rounds: 1–3 (1–4 with Ink Storm), then one more for the boss.

### The horde

When a wave starts the server lays out the whole horde: each yōkai has a kana (or, in Wave 3,
a minimal pair), HP, a spawn time and an escape time. The horde mixes everyone's chapters
(round-robin over players' pools), but each player is only ever attacked with kana from their
own chapters. The last yōkai in Waves 1–2 is the chapter leader (the folklore yōkai from
`kanaChapters[].leaderYokai` for the highest chapter in play) with double HP.

Mode rules are pure (no timers), so an escape is settled at the next move or when the wave
ends: a yōkai whose escape time has passed goes on the haunted list and Fude cues
`raid_escape`. The stage animates from the same spawn and escape times, so what it shows
matches what the rules settle. The stage lines its clock up with the server's using the
view's `at` (the server time of the last change).

Size and toughness: 5 + 2 per player yōkai per wave (max 18; Wave 3: 3 + 1 per player, max
10). Hits to knock one out: 1 solo, 2 for 2–3 players, 3 for 4–6, 4 for 7–8.

### Attacks (per player, one at a time)

Each player has their own attack queue: the current attack targets the yōkai from their
chapters that is closest to the gate (and least targeted by others). When they answer, the
next attack is dealt at once. If the target is gone by then, a hit splashes onto the yōkai
closest to the gate.

| Wave | Attack | What the phone shows | Answer |
|---|---|---|---|
| 1 Night Parade | **Shout** | The yōkai's kana, big. Chapter-1 kana show romaji underneath (training wheels, Wave 1 only). | Say its sound (hold to talk). Quiet fallback: type it in kana, or tap its sound among 4 (written in the *other* script so tapping isn't copying). |
| 1 | **Twin Strike** | The kana. | Tap its twin from the other script among 4. |
| 2 Shapeshifters | **Look-alike** | The kana's twin (other script) and 🔊. | Tap the right one among its look-alike set (シ/ツ/ソ/ン, ぬ/め, わ/ね/れ …), padded to 4. |
| 2 | **Echo** | 🔊 (ja-JP speech synthesis on the phone); the sound in the other script when the phone has no Japanese voice. | Tap the kana among 4 (its known confusions first). |
| 3 Long and Short | **Minimal pair** | 🔊 one word of the pair. | Tap which word you heard, then **say it** (or type it, or skip). |
| Boss | **Piece** | One character of the katakana word. | Say its sound (or tap among 4). ー and ッ ask what they do in a word (tap). |
| Boss | **Finishing blow** | The whole word. | Everyone reads it aloud together (typed works; "let the others read it" passes). |

The kana sound check (`checkSound`) is the design doc's closed-set check: it listens for the
target and its `confusableSounds` only. じ/ぢ, ず/づ and お/を count as one sound
(`homophoneIds`), a stretched vowel (かー) or trailing っ still counts, one extra mora after the
target is accepted (leaning towards yes), and romaji is never accepted. Minimal pairs
(`checkWord`) are strict about length and small っ, and a word that matches the *other* word
of the pair is refused.

### Misses

Misses never cost points. The phone shows the kana, one kind tip and a 🔊 button: the
look-alike set's tip when the mix-up was within a set, otherwise a twin or sound hint
(romaji only for chapter 1). The same item comes straight back once as a retry; after that
it moves on and stays on the haunted list. No host cue fires on a miss (corrections stay
private).

### Scoring

- A correct attack earns `100 × levelScale` points and deals the same damage.
  `levelScale = 0.6 + 0.4 × min(1, kana difficulty / difficulty of the player's top chapter)`,
  so a first-timer's あ (1/1) hits as hard as an expert's ヴォ (5/5): both 1.0. An expert's
  あ hits for 0.68.
- A quiet Shout (typed or tapped) earns the same hit points but deals 70% damage and no
  speaking bonus.
- Speaking bonus: +30% of the hit's points for a spoken Shout, a spoken boss piece, the Wave 3
  say step (flat 30) and a spoken finishing blow. Paid from a pool capped at 30% of the
  player's points in that wave (`payBonus`).
- Team combo: hits from 2+ different players within 4 s chain a combo; each hit in it deals
  +10% damage per step (max +50%). Fude cues `raid_combo` at ×3, ×6, ×10, ×15, ×20.
- Boss pieces are worth double (last round). Reading the word right: 100. Beating the boss:
  +100 to everyone who broke a piece or read it.

### Host cues (Fude)

`intro` (chapter pick), `raid_wave_start` (each wave), `raid_hit` (a yōkai knocked out or a
boss piece broken, at most one line per 2.5 s), `raid_combo`, `raid_escape`, `raid_boss`,
`kakegoe_call` (all pieces broken: "read it together!"), `raid_catch` (boss beaten and at the
raid recap), `recap_award` (the room).

### Recap

The design doc says a yōkai is truly *caught* after 3 correct answers on separate days. Catching
lives in a signed-in player's saved yōkai cards ([accounts.md](../accounts.md)): `practice` gives
one card per kana with how often it was seen, recalled from memory (said, typed or drawn, never
picked) and missed. The raid recap itself shows **seen tonight / right tonight** per player, the
team's correct kana with counts, and the **haunted list** (kana missed and yōkai that
escaped), with a note that the cards were saved (or that signing in keeps them). Every attacked
kana, pair word and the boss word go into the phrasebook (`ctx.phrase`) as memory cards:
`said` when spoken right, `seen` when tapped or typed, `retry` when right on the retry,
`missed` otherwise.

Awards (Fude's, names from `hostAwards` when present): Page Hunter (most different kana right),
Combo Champion (most combo hits), Battle Cry (most spoken Shouts), Boss Breaker (most pieces),
Exorcist (most kana got right after missing them earlier tonight).

### Privacy

The stage view never has attacks. A phone sees only its own attack, never the right option
(options carry opaque ids). In Wave 3 the word to say appears only after the tap. The
heard-sound text shown when a phone has no Japanese voice gives the answer away in Echo and
Wave 3; that's the accepted cost of the fallback.

### Thin content

If `ctx.content.kana` is empty the raid runs on a built-in placeholder set in `deck.ts` (the
five vowels plus す, the pair いえ/いいえ, the boss アイス); missing chapters, look-alike sets,
pairs or bosses fall back separately. The stage notes when the placeholder set is in use.

## Ink Storm (墨の嵐): the drawing wave (v1.1, "Brush")

The design doc's Brush mode, played as a fourth wave between Wave 3 and the boss. It is **on by
default** whenever the content has stroke references; the VIP can switch it off on the chapter
pick screen (a toggle on the VIP's phone) or start with `extra: { ink: false }`. With it off, or
with no stroke data (test fixtures, the placeholder set), the raid is the three waves as before.
`waves` in the view says how many waves come before the boss (3 or 4), so the boss is wave
`waves + 1` and the raid recap `waves + 2`.

Code:

- Stroke references: `content/src/kana/strokes.ts` (`kanaStrokes`, in `ContentLibrary.kanaStrokes`),
  **generated from KanjiVG** by `tools/content-strokes.ts` (`npx tsx tools/content-strokes.ts`,
  fetches the 92 SVGs with curl, or reads them from a folder). Each stroke is a simplified
  polyline (Ramer–Douglas–Peucker, 0–1 box, start → end). KanjiVG is © Ulrich Apel and
  contributors, CC BY-SA 3.0 (https://kanjivg.tagaini.net); the generated file carries the
  attribution and is shared under the same licence.
- The offline check: `shared/src/japanese/strokes.ts` (`gradeInk`, `inkTipText`, `readInk`).
- Mode: the `draw` attack in `kanaRaid.ts`; phone pad `controller/src/components/inkPad.ts`;
  replays `shared/src/inkSvg.ts`; stage strip in `stage/src/modes/kanaRaid.ts`.
- Vision coach: `server/ai/inkCoach.ts` (rasteriser, PNG encoder, closed-set question) wired by
  `server/src/ink.ts` in `server/src/main.ts`, only when an LLM key is configured.
- Bots draw with `tools/bots/ink.ts` (`handDraw`: the reference moved, resized, tilted and
  wobbled). Tests: `tests/brush.test.ts`.

### How it plays

The yōkai walk on **wearing their twins' masks**: a ぬ yōkai's tag shows ヌ. Each phone gets the
mask, "→ draw it in hiragana" (or katakana), a 🔊 button, and romaji for kana-level players and
chapter-1 kana (the answer is a drawing, so romaji gives nothing away). The player draws on a
rice-paper pad (pointer events, `touch-action: none`, Undo, Clear, "Cast it!"), and the server
grades the strokes. The stage never sees the true form; it shows the masks, and under the arena
the team's last four drawings brushed on stroke by stroke (✦ clean, ✓ hit, ✗ miss).

| Result | What happens |
|---|---|
| **Clean** (right count, order and direction, shape close) | Hit: `100 × levelScale` points and the same damage. |
| **Messy pass** (strokes out of order, or one stroke too many / too few with a clearly right shape) | Hit: full points, 70% damage (like a quiet Shout), and a tip ("ア's first stroke starts at the top-left…") with a replay of how it's written. |
| **Miss** (wrong shape, a long stroke backwards, scribble, a tap) | No points lost. Tip, your drawing next to the numbered stroke-order replay, and one retry. |

After a hit the phone asks **"Now say what you drew!"**: a spoken, correct sound (the closed-set
`checkSound`) earns the speaking bonus (+30% of the hit's points), paid from the same pool capped
at 30% of the player's points that wave; typing or skipping moves on with no bonus. Drawing is not
speaking, so the drawing itself never earns the bonus.

Toughness: one hit fewer per yōkai than the other waves (min 1); 3 + players yōkai (max 12); walk
34 s, 3 s apart. Each drawing goes in the phrasebook like a tapped kana (`said` if you then said it).

### The offline check (`gradeInk`)

Both drawings are fitted into the same box (centred, longest side 1: size and position on the pad
don't matter) and every stroke is resampled to 24 evenly spaced points.

- **Count:** equal, or one off. One off is tried as two neighbouring strokes joined in one go
  (き and さ are often written that way); it passes only with a shape score ≥ 0.62.
- **Order:** every assignment of drawn strokes to reference strokes (up to 6 strokes) is tried;
  the order is wrong when a reshuffle fits clearly better than stroke-for-stroke.
- **Direction:** each stroke at least 0.3 long is compared forwards and backwards. A reversed long
  stroke fails, because for ソ/ン and シ/ツ the direction *is* the letter. Dots and ticks are never
  checked.
- **Shape score** (0–1): half the two-way mean nearest-point distance between the inks, half the
  matched per-stroke distance. Pass ≥ 0.5.
- **Rejected outright:** a drawing smaller than 6% of the pad, more than 2.6× the reference's ink,
  or 4+ strokes too many.

Measured on synthetic handwriting (`handDraw`, tests): the reference with 0.025 wobble passes
cleanly for all 92 kana; 98% pass at 0.06 wobble; every reversed long stroke is caught; random
scribbles never pass; one kana drawn as another passes 0.8% of the time, almost all genuine
look-alikes (ぬ/め/ね/れ/わ, は/ほ, エ/ユ/ニ, へ/ヘ), which is what the vision second look is for.

Wire limits (`readInk`, validated in the mode): at most 12 strokes, 64 points per stroke, 400
points in all, every coordinate a finite number in 0–1 (±0.1 is clamped). The phone thins its
strokes to fit before sending.

### The vision second look (optional)

When `ANTHROPIC_API_KEY` is set, `server/src/ink.ts` watches commits for drawings the Raid has
queued (every miss, and passes of a look-alike scoring under 0.85). It rasterises the strokes to a
96×96 grayscale PNG (no native dependencies), asks the judge model through `server/ai/llm.ts`
(same model config, same per-game budget as the host) a closed-set question — "They were asked
to write ぬ. Is this drawing め, ぬ, ね?" — the target, its look-alike sets, then the nearest shapes
by the stroke check — and gets back `{ looksLike, tip }`. The line (moderated, ≤ 120 characters,
"Looks like め! …" when it read as another kana) goes back to the mode as an `ink-tip` move on the
player's behalf (`Room.inject`) and shows on that phone only, as "🖌 ぬ: …".

It never decides a hit or blocks the game: the move is graded and landed before the question is
asked, the key the tip must echo exists only in the server's mode state (never in a view), lines
older than 15 s are not asked for, a look gets up to 12 s (from Cloudflare the vision call takes
2–5 s), and at most 12 looks per game. Without a key nothing changes.

## Ink Storm decisions made on Ladi's behalf

1. **Ink Storm is wave 4, just before the boss, and on by default.** Waves 1–3 keep their numbers; the VIP turns it off at the chapter pick (no lobby UI exists for mode options yet).
2. **The prompt is the twin, not the sound alone.** A sound alone can't say which script to draw; the twin (ヌ for ぬ) plus "draw it in hiragana" and 🔊 does, and it's the Raid's own twin idea. The stage shows only the mask, so the TV never gives the answer away.
3. **Romaji shows for kana-level players and chapter-1 kana** in Ink Storm, since a drawing can't be romaji'd. Elsewhere decision 10 stands.
4. **Stroke references come from KanjiVG** (CC BY-SA 3.0), generated, not hand-authored; the counts are checked against the school table in tests.
5. **A reversed long stroke is a miss; a wrong order is a softer hit.** Order is a habit to build; direction changes the letter (ソ/ン, シ/ツ).
6. **One stroke too many or too few can still pass** when the shape is clearly right (joined strokes are normal handwriting), never cleanly.
7. **Messy hits deal 70% damage**, reusing the quiet-Shout rule, with full points: fair to beginners, and the yōkai feels it.
8. **The speaking bonus comes from a "say it" step after a hit**, paid from the usual capped pool; drawing alone earns none.
9. **One fewer hit per yōkai and fewer, slower yōkai** in Ink Storm, tuned by eye from the time a drawing takes (~5–8 s).
10. **The vision coach only adds a tip, never changes the result**, runs on misses and doubtful look-alikes only, and has its own cap of 12 looks per game inside the $0.10 budget.
11. **Look-alike kana that share a shape (へ/ヘ, り/リ) both pass**: drawing へ for ヘ is right in all but name.
12. **Phones replay the reference with numbered strokes** after any non-clean drawing, as the "one private clue" before the retry.

## Ink Storm open questions

- **Small phones (design doc):** the pad is `min(100%, 340px, 52vh)` and works at 320–360 px wide in headless Chromium, but nobody has drawn on a real 4-inch phone yet. Is a 300 px pad enough for ほ or ね with a thumb? Should small phones get a "draw bigger" zoom?
- Are the thresholds right for real fingers? Synthetic handwriting is tidier than a party's. Log grades (shape score, tip) in playtests and retune `INK_PASS`.
- Should the room see whose drawing it is on the TV? It's fun, but a bad drawing on the big screen may sting; a "hide my ink" option?
- Should katakana and hiragana alternate, or follow the yōkai mix (now: the player's chapters, either script)?
- Voiced kana (が, ぱ) and combinations are not drawn yet: references would be the base kana plus ゛/゜ (KanjiVG has them).
- An on-device classifier (design doc: ETL handwriting set) to replace most LLM calls.

## Ink Storm known gaps

- The vision coach is wired and tested with a scripted model, not yet run against the real API.
- No lobby control for the toggle; it lives on the VIP's chapter-pick screen.
- Stage layout was checked at 1280×720, where the ink strip sits partly below the fold; it is laid out for 1080p TVs.
- No stroke references for voiced, small or special kana; a player whose chapters are only those draws from the basic kana up to their top chapter.

## Decisions made on Ladi's behalf

1. **Chapter 1 is the default for everyone, whatever their level band.** The brief said so; N5 players tick more chapters in a few taps.
2. **The chapter pick has no placement check yet.** The 60-second placement is optional in the design doc; chapter ticks are enough to start.
3. **Escapes are settled lazily (at the next move or the wave's end).** Modes have no timers; the stage animation hides the gap.
4. **The battle ends early when every yōkai is caught or gone**, otherwise at the last yōkai's escape time. Keeps waves snappy.
5. **The quiet Shout fallback shows the four sounds in the other script.** Writing a hiragana yōkai's sound in hiragana would let you tap by matching shapes; romaji is not allowed.
6. **Quiet Shouts earn full hit points but deal 70% damage and no speaking bonus.** The design doc says the fallback "earns smaller bonuses but never blocks play"; points stay fair, the yōkai feels it.
7. **Damage scale is based on the player's top chapter**, not their level band: finer, and it makes あ for a beginner equal ヴォ for an expert.
8. **A miss brings the same item back once as a retry** (the design doc's "one private clue and one retry"), which also blunts random tapping.
9. **Wave 3's say step happens after a wrong tap too** (with the right word shown): saying it is the out-loud moment either way.
10. **Romaji appears only on chapter-1 kana in Wave 1** (training wheels) and in chapter-1 tips; never as an answer.
11. **The boss word is picked from words whose `minChapter` fits the team's top chapter**, preferring words with at least one piece per player; pieces go to players who know them. If nobody's chapters fit any word, the easiest word is used.
12. **ー and ッ boss pieces are tap questions** ("what does it do in a word?") since they have no sound of their own.
13. **The boss is beaten when every piece is broken and at least one player reads the word right**; the finale still waits for everyone to read or pass.
14. **The raid's own recap uses the `encore` phase after the finale**, because the room's recap view carries no mode view.
15. **Fude's line throttle is 2.5 s for hits and escapes**; wave starts, the boss, combos and the call to read always speak.
16. **Combos need two or more different players** ("several players hit in a short window"); a solo player never gets a combo.
17. **Horde size and toughness formulas** (above) were tuned by eye in bot runs, not by playtest.
18. **Look-alike sets whose members share a sound (へ/ヘ, り/リ, か/カ) are not used for the look-alike attack**, since "tap the one you heard" can't tell them apart.
19. **Yōkai sprites are picked per yōkai at random (stable by id)**; the chapter leader is always the umbrella spirit with a 👑 name tag; the kana is drawn on a paper talisman tag so it reads from 3 m over any sprite. A CSS ghost is the fallback if the art is missing.

## Open questions

- ~~Persistence~~: done with optional sign-in ([accounts.md](../accounts.md)). Signed-in players keep their yōkai cards: catching (right from memory on 3 different days), the Leitner queue, a review on the phone and the yōkai book. Signed-out players still get tonight's tally.
- Should the horde slow down for a team of first-timers (adaptive speed), or should a solo player face fewer yōkai?
- Server-side speech-to-text (design doc Phase 3) should replace the browser recogniser for single kana; the closed-set check is ready for it.
- The Wave 3 no-voice fallback shows the word in text, which turns listening into reading. Pre-rendered audio for pair words would fix it.
- Should the room be able to overrule a rejected shout (thumbs-up vote), as the design doc suggests for skill modes?
- The 60-second placement check in the chapter pick.
- Catching all 46 basic hiragana should switch a player's Oogiri tiles from romaji to kana; that needs persistence too.
- Kana mnemonics (`content/src/kana/mnemonics.ts`) aren't in the `ContentLibrary` yet; memory cards could show them once they are.
