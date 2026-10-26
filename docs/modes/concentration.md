# Kotoba Concentration (ことば神経衰弱), v1.1

Host: Fude. 2–8 players. Kana–N5. Turn-based memory where every pair is two forms of one
word from the night's topic pack, and you only keep a pair by **saying the word**.

Code: `shared/src/modes/concentration/` (rules, board, emoji map, hidden-picture scenes,
romaji, placeholder words), `stage/src/modes/concentration.{ts,css}`,
`controller/src/modes/concentration.{ts,css}`, `tools/bots/policies/concentration.ts`,
`tests/concentration.test.ts`.

## How a game goes

1. **Intro** (9 s). The board appears face down; Fude explains the rules.
2. **Turn** (`answer`, 20 s, 25 s for a Kana-level player). Seats take turns in order,
   skipping anyone disconnected. The turn player taps two cards on the mini board on their
   phone; everyone else watches the TV (and their phone's read-only mini board).
   - Turn timer runs out: any lone face-up card goes back down and the turn passes.
   - The turn player drops: their turn ends at once.
3. **No match**: both cards stay up for a moment (`score`, 2.2 s) so everyone can memorise
   them, then flip back. Turn passes.
4. **Match**:
   - **Peek** (`prompt`, 1.8 s): both cards up, everyone sees the word.
   - **Say it** (`reveal`, 6 s: "5 seconds" plus a second for the recogniser): the word card
     turns away (shown as ？ on the stage and every phone); only the cue side stays up (the
     English, the kanji, the picture, or the speaker, which replays). The flipper says the
     word from memory on their phone (speakBox; typed or kana-pad fallback). Two tries.
     Kana-level flippers see the reading and romaji on their own phone as training wheels.
   - **Steal** (`encore`, 5 s) if they miss or time out: anyone else may say it, two tries
     each, first correct answer wins the pair.
   - **Result** (`score`, 3 s): who kept or stole it, with the word, reading and meaning.
   - Nobody said it: the pair flips back down where it was (everyone now knows where it is).
     On its second miss it leaves the board with no owner, so a hard word can't stall the game.
5. **Finale** (10 s) when every pair is gone, the 12-minute cap passes, or the turn cap
   (6 turns per pair + 12) is hit: the whole hidden picture, its name, and top scorer.
   Then the room's recap with awards and phrasebooks.

### Pairs

Each word becomes one of four pair kinds (the builder aims for a mix):

| Kind | Cue card | Word card | Eligible when |
|---|---|---|---|
| picture | emoji | word (kanji with its reading under it) | the word has an obvious emoji (`emoji.ts`, keyed by reading) |
| reading | kanji word, no furigana | kana reading | the word has kanji and someone at the table is N5+ |
| audio | 🔊 (the stage speaks it with `speechSynthesis` ja-JP; shows the kana if no Japanese voice) | word | always |
| meaning | English (first sense only) | kana | always |

Words come from the pack the VIP picked (or a random pack). Skipped: the pack's baseline
words (held back for the delayed spoken test), swerve and stereotype words, N4 words,
phrases, anything with spaces or over 7 kana. Picked words have distinct readings, texts,
meanings and pictures so no two cards can be confused. If the pack is too thin the board
is topped up from a small placeholder set (`fallback.ts`, clearly marked) and the stage notes it.

Board size by player count: 2–3 → 4×4 (7 pairs + 2 specials), 4–5 → 5×5 (11 + 3),
6–8 → 6×6 (16 + 4), one size smaller when most players are at the Kana level.

### Special tiles

Specials never count as one of your two flips; the tile is used up when flipped.

- 👹 **yōkai**: shuffles every face-down card among the face-down cells. The bots (and
  sharp humans) lose what they remembered.
- ⭐ **bonus**: you get another turn after this one.
- 🌫️ **fog**: picks a row with face-down cards; for the **next** player's turn that row is
  covered and can't be picked. Fog lifts early if it would leave nothing to pick.

### Hidden picture

Behind the board is an emoji scene (12 scenes in `scenes.ts`: summer festival, New Year,
hanami, the beach, a snow day, school, onsen, a station, a birthday, the zoo, camping, a
ramen shop). Each cell has one clue tile; a cleared card (pair or special) uncovers its
tile. Once 2 tiles are showing, any player can buzz in from their phone at any point in
the game (not intro or finale) and pick one of 4 names. One guess each; a right guess
earns 60–240 points (more the more is still hidden, rounded to 10), solves the picture
and shows it whole. The views only ever carry uncovered tiles, never the answer, until
it's solved or the game ends.

### Scoring

- Pair kept or stolen: **100**.
- Said aloud (`via: 'speech'`): **+40**. Typed or tapped: no bonus. 40 of 140 is 29%, so
  the speaking bonus is always inside the design doc's 30% pool.
- Hidden picture: 60–240, once per game.
- No points are ever taken away.

### Learning hooks

- Every pair said correctly goes in the sayer's phrasebook (`said`, or `retry` if it took the
  second try). A flipper who misses both tries gets a `missed` entry, which sticks (the room
  keeps the most telling outcome).
- The word is shown for a moment and then hidden, so the say-it is a short recall, not
  reading off the screen; reading pairs (kanji → reading) and meaning pairs (English →
  Japanese) are real retrieval.
- Answers are checked with `matchesAccepted` (lenient) against the kana reading and the
  written form; the server's `reading` covers kanji transcripts (水 → みず).

### Host cues (Fude)

`intro` · `say_it_first` (match found) · `reveal_react/good` (kept) · `answer_hurry` (steal
window opens) · `raid_catch` (stolen) · `miss_kind` (nobody said it) · `reveal_react/flop`
(no match) · `raid_escape` (yōkai) · `raid_combo` (bonus) · `raid_wave_start` (fog) ·
`reveal_react/ippon` (picture guessed) · `all_in` / `encore_cheer` (finale).

### Awards

きおく マスター (most pairs), よこどり キング (most steals), おおごえ しょう (most pairs
said aloud), えの たんてい (guessed the picture). Each needs at least one.

### Bots

`concentrationPolicy(opts)` remembers every card it sees turn over (cell → pair, pair →
reading), recalls each memory with probability `recall` (0.8), flips a known pair first, then
the partner of its first card if it knows it, otherwise an unseen card. It says the word right
with probability `sayRight` (0.85), tries to steal with `stealRate` (0.5), types instead of
speaking when `quiet`, and makes one picture guess (a random option) once about half the
picture is showing. A yōkai shuffle wipes its position memory.

## Decisions made on Ladi's behalf

1. **Phases**: one turn = `answer`; match peek = `prompt`; say-it = `reveal`; steal = `encore`;
   result/mismatch = `score`; end = `finale`. Real phases (not sub-deadlines) because only
   phase deadlines wake the server, so every window is timed and skippable by the VIP.
2. **The word card turns away during the say-it and steal windows** (after a 1.8 s peek), so
   saying it is short recall rather than reading aloud, and stealing isn't a reading race.
3. **The say-it window is 6 s**, not exactly 5, to give the browser recogniser a second to return.
4. **Two tries** for the flipper and for each stealer, so one misheard word isn't fatal.
5. **A match does not give another turn** (classic memory does); the turn always passes,
   so 8-player games keep moving and the ⭐ bonus tile means something.
6. **Unclaimed pairs flip back once, then clear with no owner** on the second miss.
7. **Specials never use up a flip**; yōkai doesn't end your turn; fog hits the next player.
8. **Hidden picture is an emoji scene, not a big kanji**: the view can hold only uncovered
   tiles, so nothing leaks to a stage's raw view or devtools. A big kanji would have to be
   sent whole and masked in CSS.
9. **Guessing opens after the first cleared pair**, one guess per player, worth 60–240
   by how much is still hidden; the first right guess solves it for everyone.
10. **Kana-level hint** (reading + romaji) only in the player's own say-it window, never for
    steals, so it doesn't tilt the race.
11. **Reading pairs only when someone is N5+**; an all-Kana table never gets kanji pairs and
    only gets non-kana-level words that have a picture.
12. **Meaning cards show the first English sense** ("water", not "water; a drink …"), and
    words with duplicate readings, texts, meanings or pictures are kept off the same board.
13. **12-minute time cap** (the doc's 15–20 minute night slot includes intro and recap), plus
    a turn cap as a backstop so a table of absent players can't loop forever.
14. **Awards** are mode-local titles (kana, draft) because Fude's award bank is raid-themed.
15. **Stage TTS**: the stage, not the phones, voices audio cards (everyone hears the same thing);
    with no Japanese voice the card shows its kana instead.

## Open questions

1. Should a successful claim also earn another turn (classic memory), perhaps capped at one?
2. Should the steal window go to the first *speaker* only (typed steals locked out) to keep
   the race about speaking? Today typed steals work but earn 40 less.
3. Is the 1.8 s peek right? Longer makes it easier for beginners; shorter makes it real recall.
4. The shared stage header labels phases with the shared names ("Reveal & vote", "Score"),
   which read oddly for this mode; a per-mode phase label hook would fix it (engine change,
   not made).
5. Big-kanji hidden pictures (a kanji drawn across the board) would suit N5 tables; it needs
   a way to send only the uncovered slices (pre-rendered tiles) to avoid leaking.
6. Fluent check needed: scene names, award titles, emoji choices.
