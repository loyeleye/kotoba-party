# Phrase Bingo Theater (フレーズビンゴ劇場), backlog

Host: Pon. 3–8 players. Kana–N4. Improv scenes where each actor secretly slips assigned
Japanese lines into the scene, out loud, while the audience plays bingo trying to catch them.
The design doc's one line: "improv scenes where each player secretly slips in assigned phrases."

Code: `shared/src/modes/phraseBingo/` (rules and views in `phraseBingo.ts`, the lenient line
check in `check.ts`, draft scenes in `scenes.ts`), `stage/src/modes/phraseBingo.{ts,css}`,
`controller/src/modes/phraseBingo.{ts,css}`, `tools/bots/policies/phraseBingo.ts`,
`tests/phraseBingo.test.ts`.

## Why it works for speaking

Every actor has to produce 2–3 set phrases aloud, from memory, inside a made-up situation
(a konbini at night, a family dinner, a ryokan check-in). That is retrieval plus use in
context, not reading aloud. The audience listens for the lines, which is a listening rep on
every line in the scene, and then the whole room shouts the scene's best line back.

## How a game goes

Four scenes by default (the VIP can pick 3, 4 or 6). Each scene runs through the shared phases:

1. **Scene card** (`prompt`, 18 s, 24 s if an actor is at the Kana level; ends early when every
   actor taps *I'm ready*). The stage shows the setting (emoji, Japanese, English), a twist to
   get the improv going ("There is one pudding left on the shelf, and everybody wants it.") and
   the cast with their roles (てんいん *the clerk*, おばけ *a ghost who loves pudding* …).
   - **Actors** see their secret lines in full on their phone: Japanese, kana, English, and
     romaji at the Kana level. Study time.
   - **Audience** sees their own 3×3 bingo card: every secret line in the scene plus decoys,
     shuffled differently on each phone, with no clue who holds which.
2. **ACTION!** (`answer`, 60 s + 10 s per actor). The cast plays the scene out loud in the room.
   - An actor **scores a line by saying it into the phone** (hold-to-talk, as part of the scene;
     typed or kana-pad fallback for quiet players). The server checks the transcript leniently
     against that actor's own unsaid lines (see *The check*). The phone says *Slipped in!* or
     *Heard "…": not one of your lines. Keep acting!*
   - During the scene the actor's lines **hide**: the phone shows the English and the first sound
     (お…). *Peek* shows the Japanese again but gives up that line's memory bonus.
   - The **stage ticker** rings 🔔 "*Aki slipped one in!*" the moment a line lands, and shows
     🔔 counts per actor, but never which line. The audience phone flashes the same alert.
   - **Audience** members buzz: tap a cell, then pick who said it. Three buzzes per scene. A
     buzz shows on the ticker as "*Ben buzzed!*" with no target; results wait until the scene ends.
   - The scene ends early only when every actor has said every line *and* every audience member
     has used every buzz; otherwise the timer (or the VIP's skip) ends it.
3. **Secrets revealed** (`reveal`, 14 s). Each actor's lines with ⭐ *smooth* (said, never caught),
   🎯 *caught by …*, or *not said*, and whether they were said from memory. The ticker now shows
   the lines in the order they were said, and every buzz with its target and ✓/✗. Points are paid
   here.
4. **Shout it back** (`encore`, 10 s; ends early when everyone has answered). Pon calls the
   scene's highlight line (the first smooth line, else the first said, else the first dealt) with
   a kakegoe line (みんなで！ せーの！) and the whole room, actors and audience, says it into their
   phones for a small bonus. Two tries each.
5. **Bingo** (`score`, 9 s). Every card is daubed with every line that was said in the scene (not
   just the lines you caught). A full row, column or diagonal is **BINGO!**: the stage shouts the
   names, the phone shows the winning line in gold. Then the scene's points, and the next scene.

The last scene is worth double. After the last scene, the shared recap: standings, awards,
phrasebook ("Your lines").

### Casting and dealing

- **Cast size**: 3–4 players → 2 actors, 5–7 → 3, 8 → 4. There is always at least one person in
  the audience. Connected players first; whoever has acted least goes next, avoiding last scene's
  actors, so in a 4-player, 4-scene game everyone acts exactly twice (tested).
- **Lines per actor**: 3, or 2 at the Kana level or in a four-actor scene (so a 3×3 card always
  holds every secret line).
- **Levels**: Kana actors get short set phrases (おいしい！, すみません！, いらっしゃいませ！);
  N5 actors get です/ます sentences (ふくろは いりません。); N4 actors get one N4 pattern per line
  (〜そう, 〜たら, potential, 〜てもらえますか, 〜ほうがいい), falling back to N5. A scene that
  runs out at a level borrows lines from other scenes.
- **No clashing lines**: no two lines in play in a scene (secrets or decoys) where one's sound
  contains the other's (すみません！ next to すみません、トイレは どこですか。), so neither the
  check nor a catch can confuse them.
- **Scenes**: 9 draft scenes, 3 per topic pack (food: konbini, ramen shop, hanami picnic;
  family: family dinner, meeting a friend's family, the morning rush; travel: ryokan check-in,
  station platform, taxi sightseeing). The night's pack plays first, then the others. Each has
  4–5 roles, a twist and 15 lines (4–5 Kana, 7–8 N5, 3 N4). Lines marked `from` copy a topic-pack
  phrase; when that pack is loaded the pack's text (and furigana) is used, so the fluent check
  of the packs carries over.

### The check

`check.ts`. Transcript and line are compared as sound keys (kana; long vowels, じ/ぢ, ず/づ,
お/を folded) with は/へ/を also read as わ/え/お. A line counts when it is inside the transcript
(filler around it is fine: えっと、おいしい！ですね) or when some stretch of the transcript is within
a few kana edits of it: one edit per five kana (one per four at the Kana level), none for lines
of three kana or fewer. The server's kana reading of kanji transcripts is used first, then the
raw text. If several of the actor's lines fit, the closest wins. A miss costs nothing.

### Scoring

| What | Points | Who |
| --- | --- | --- |
| Slip a line in (said and matched) | 100 | actor |
| Smooth: said and nobody caught it | +100 | actor |
| Catch: right line and right actor | 100 | each catcher |
| Bingo line on your card | 50 (once per scene) | card holder |
| Said from memory (no peek), bonus pool | +40 spoken / +20 typed | actor |
| Shout it back, bonus pool | +20 spoken / +10 typed | anyone |

- **Slipping it in naturally is what pays**: an uncaught line is worth 200 (240 from memory), a
  caught one 100 (140). A caught actor never loses points, they just miss the smooth bonus.
- **Catch window**: a buzz is right if the actor holds that line and the line reached the server
  no later than 5 s after the buzz (recogniser lag). A buzz made earlier than that is a guess
  and misses. Every correct catcher scores, not just the first.
- **Bonus pool**: memory and shout-back bonuses come from one pool per player per scene, capped
  at 30% of the points that player had at stake (actor: 200 per line; audience: 100 per buzz).
  Players below the average score get bonuses ×1.5 (comeback), never past the cap.
- **Last scene ×2** (everything above).

### Learning hooks

- Phrasebook: an actor's line said from memory → `said`; said after peeking → `retry`; never
  said → `missed` (feeds review). A caught line → `seen` for the catcher. The shout-back line →
  `said` (spoken) or `seen` for everyone.
- Lines hide during the scene, so saying them is recall; peeking is allowed but visible to the
  scoring.
- Every scene ends with the call and response the design doc asks for.

### Host cues (Pon)

`intro` · `prompt_read` (the setting) · `reveal_react` (flop: nothing said; good: some lines;
ippon: every line said and smooth) · `kakegoe_call` (the shout-back line) · `reveal_react/ippon`
with the name on a bingo. No line during the scene itself (the room is talking).

### Awards (draft titles)

だいめいゆう *Star Actor* (most lines slipped in), さりげない しょう *Smooth Operator* (most lines
nobody caught), じごくみみ *Sharp Ears* (most catches; 地獄耳 is the idiom for someone who hears
everything), ビンゴ キング *Bingo King* (most bingo lines).

### Bots

`phraseBingoPolicy(opts)`: actors memorise lines while studying and tap ready, then say each line
at a random time in the scene, peeking first with `peekRate` (0.3), wrapping it in filler
(えっと、…) sometimes, fluffing a first try with `1 − sayRight`. Audience bots buzz after each 🔔
with `buzzRate` (0.7). Bots that share one policy object "hear" what the actor bots said and pick
the right line with `hearRate` (0.6), otherwise a random cell. Everyone shouts the line back.
`npm run bots -- --mode phrase-bingo --bots 5` shares one policy across the bots for this mode.

## Decisions made on Ladi's behalf

1. **Phases**: scene card = `prompt`, the scene = `answer`, secrets revealed = `reveal`, shout it
   back = `encore`, bingo = `score`, with stage labels via `phaseLabels`. Real phases so every
   window is timed and VIP-skippable.
2. **Scenes live in the mode folder** (`scenes.ts`, `status: 'draft'`), not as a new content type
   in `content/src/types.ts` with a `ContentLibrary` field. That avoids engine and loader changes
   for a backlog mode. Lines copied from packs resolve to the pack's text at runtime. Moving
   scenes into `content/` (and its linter and reading checks) is the right home once the mode is
   accepted.
3. **Saying the line into the phone is what scores.** The phone can't hear the whole scene
   (hold-to-talk, 6 s max), so the actor says the line into the phone *as* they say it in the
   scene. Saying it aloud to the room is on the honour system.
4. **The ticker names who slipped a line in, live, but never which.** That makes the audience's
   job "which of the 9 lines was that?", which is a listening task, and keeps whispering into the
   phone from paying off.
5. **Catches resolve after the scene**, not live: suspense for the reveal, and no live feedback that
   would let the audience brute-force the card.
6. **A caught actor loses nothing**; the catch just costs them the smooth bonus. The brief allowed
   a "smaller smooth penalty or reward"; the design doc's pillar is that mistakes never cost points.
7. **Every correct catcher scores 100**, not just the first, so a slow phone doesn't decide it.
8. **Three buzzes per audience member per scene**, wrong buzzes are free otherwise.
9. **5-second catch grace** for the recogniser and network lag between saying a line and it
   landing; a buzz earlier than that is a guess.
10. **Bingo daubs every line said in the scene**, not only your catches: bingo is the luck-and-cheer
    moment, catching is the skill. 50 points, once per card per scene.
11. **Lines hide during the scene** (English + first sound shown); peeking shows them again and
    gives up that line's memory bonus. The view withholds the Japanese, so it is enforced by the
    server, not CSS.
12. **The line check is a lenient approximate substring match** (decision list in *The check*).
    Unlike the room's rule 22, vowel length and small っ are forgiven within the tolerance: here the
    check only identifies which of the actor's own 2–3 known lines was said; it isn't grading
    pronunciation.
13. **Typed lines count in full** (the quiet fallback) but earn half the memory bonus; shout-back
    typed earns half too.
14. **Bonus pool cap is per player per scene**: 30% of what that player had at stake, with the
    ×1.5 comeback clamped to it (tested).
15. **Cast rotation**: fewest scenes acted first, avoiding the last scene's cast, connected
    players first. Cast sizes 2/2/3/3/3/4 for 3–8 players.
16. **Durations**: intro 16 s, scene card 18 s (24 s with a Kana actor), scene 60 s + 10 s per
    actor, reveal 14 s, shout-back 10 s, bingo 9 s. Four scenes ≈ 9–10 minutes. Round choices 4,
    6, 3.
17. **The night's pack plays first** (its 3 scenes), then scenes from the other packs; with no pack
    picked, one is chosen at random. The scenes carry their own lines, so the mode works with no
    pack content loaded (tested).
18. **Host lines reuse Pon's existing events** (`intro`, `prompt_read`, `reveal_react`,
    `kakegoe_call`); no new `HostEvent`s or line-bank entries.
19. **Awards are mode-local draft titles** (Pon's award bank is Oogiri-themed).
20. **Actors don't get the kana pad open by default**, even at the Kana level: speaking is the
    point and the pad would push the talk button off a small screen. The quiet fallback has it.

## Open questions

1. **Honour system.** An actor can mumble a line into the phone without really using it in the
   scene. Should the audience be able to challenge ("we didn't hear that!") with a room vote, like
   Last Train's overrule?
2. **Is the live 🔔 with the actor's name too big a clue?** Options: ring without the name, or ring
   a few seconds late.
3. **Caught = no loss.** Does the audience still feel rewarded enough, and do actors still try to
   be sneaky? A small actor penalty (e.g. −25) would sharpen it, against the pillar.
4. **Should bingo count only lines you caught?** More skill, far fewer bingos.
5. **Scene length** (80–100 s) and **three buzzes**: playtest numbers.
6. **Pon's line bank** has no Phrase Bingo lines; his `intro` lines talk about Oogiri and cushions
   and `prompt_read` says お題. Write a small set (scene start, ACTION!, caught, bingo) as new host
   events?
7. **Fluent check** of all 135 scene lines, roles, twists and award titles, especially the N4 lines
   and casual forms (うまい！, よろしく！).
8. **Audience-only spectators** (the design doc's up-to-8 audience) would be perfect bingo players
   here; the room doesn't support non-seated players yet.

## Known gaps

- Nothing has been tried with real phones in a real room: whether the browser recogniser picks a
  line out of a noisy scene, and whether 6-second hold-to-talk feels natural mid-improv.
- No sound effects (the 🔔 ring, the bingo fanfare) and no TTS of the shout-back line on the stage.
- Scene lines aren't covered by the content linter or `npm run content:readings` (they live in
  the mode folder; see decision 2).
- Pon's `intro` and `prompt_read` lines are Oogiri-flavoured (see open question 6).
- The bingo moment on the stage lists names but doesn't draw the winning cards.
