# Word Gauntlet (v1.1)

Host: Pon. Players: 4–8. Three rounds that build up to a spoken finale, about 12–15 minutes.

Code: `shared/src/modes/wordGauntlet/` (rules, kana rules, romaji, word lists),
`stage/src/modes/wordGauntlet.ts`, `controller/src/modes/wordGauntlet.ts`,
`tools/bots/policies/wordGauntlet.ts`, `tests/wordGauntlet.test.ts`.

## Flow

`intro` → each round runs `prompt → answer → reveal → score` → `recap`.

| Round | Phases | What happens |
| --- | --- | --- |
| 1. Fake Kanji (×2 words) | prompt → answer → reveal → score | A real, obscure word (kanji + reading) is shown. Everyone writes a fake English meaning in private. At the reveal, the fakes and the real meaning are listed anonymously and everyone picks the one they think is real (not their own). Score: who wrote what, who picked what, then the real word becomes the **golden word**: the room says it together, and each phone can say it for a small bonus. It goes in everyone's phrasebook. |
| 2. Lost in Translation | prompt → answer × N → reveal → score | An N5 phrase from the night's topic pack passes around in a seat rotation starting at a random player: step 1 turns it into English, step 2 back into Japanese (spoken, typed fallback), and so on. Each step is its own `answer` phase and the phone shows only the step before. The reveal shows the drift one step at a time; everyone votes for a favourite step (not their own). Double points. |
| 2b. Rumour Relay (うわさの でんごん), in place of round 2 when anyone in the room plays at N4 | prompt → answer × N → reveal → score | Nobiko-san whispers a rumour about a studio yōkai to the first phone. Each relayer hears the previous relay in Nobiko-san's voice, passes it on, and adds one fin (うわさに おひれが つく). The reveal reads the whole relay in her voice; everyone votes for the juiciest relay; then she tells what really happened. Double points. See below. |
| 3. Shiritori Showdown | prompt → (answer ↔ reveal)… → score | A spoken word chain that starts with Pon's しりとり. Each turn is its own `answer` phase, so the room's phase clock is the turn clock. A word nobody can vouch for opens a short `reveal` phase where judges vote. The last player standing takes the crown. |

### Fake Kanji scoring
- Finding the real meaning: 100. Each player who picks your fake: 50 (two players who typed the same fake share one option and both score).
- A fake that gives the truth away is refused (`too-close`): it matches the real meaning, or contains one of the word's give-away phrases.
- Golden word said aloud: +30 (typed: +10), from the round's capped bonus pool.

### Lost in Translation scoring
- 100 × 2 per vote for your step.
- Japanese steps: +50 × 2 spoken, +20 × 2 typed, all scaled down together if they would pass the 30% bonus pool.
- A stepper who is disconnected when their step starts, or who runs out of time, is skipped ("lost in the post"); the next step sees the last step that was done.

### Rumour Relay (うわさの でんごんゲーム, N4 and up)

Host: Nobiko-san, the studio's gossip (her neck reaches everywhere). Code: `shared/src/modes/wordGauntlet/rumours.ts`
(rumours, fins, frames, model lines), the rumour section of `wordGauntlet.ts`, the phone's `rumourScreen`, the TV's
`rumour`. Tests: `tests/wordGauntletRumour.test.ts`, plus a bot game with N4 bots in `tests/wordGauntlet.test.ts`.

- **When:** round 2 is the rumour round if anyone in the room plays at N4 when round 2 starts; otherwise it stays
  Lost in Translation. Players at every level take part.
- **The rumour:** who (a studio yōkai or a host), where, and what they're up to, plus who saw it (the source
  for ＿に よると and ＿と いって いました). 9 rumours for every room and 2 more for Cheeky rooms. Rumours are about
  the studio's yōkai, **never about players**: a relay or a fin that contains a player's name is refused
  (`names-player`).
- **A relay:** one `answer` phase per player in seat order from a random seat (35 s Kana, 50 s N5, 60 s N4). The
  relayer's phone plays what they heard in Nobiko-san's voice (🔊 Listen) and hides the words until they tap
  "Show the words" (shown at once when the phone has no voice or sound is off). Each relayer is dealt 3 fin cards
  and must add one:
  - **Kana:** tap a fin tile and say it (or pass it on without saying it). The rumour travels on as Nobiko-san's
    line with that fin added.
  - **N5:** pick a fin card and say the whole rumour (typed works). "Need a hint?" shows Nobiko-san's polite
    version (＿て います), with their fin.
  - **N4:** pick a fin card or write their own (Japanese, 30 characters), and pass the rumour on as something they
    heard. The mission never names the grammar. Hint 1 shows a frame to try (each N4 relayer gets the next of
    ＿そうです, ＿と いって いました, ＿んだって, ＿に よると ＿そうです, ＿らしいです, plain form + よ／ね／の); hint 2 shows
    Nobiko-san's line in that frame.
  - The rumour keeps its newest three fins; older ones fall off, as in real gossip.
- **No player's voice moves between phones.** The next phone gets the relay's words (the transcript or the typed
  text) and reads them in Nobiko-san's voice with the browser's own speech synthesis. Players' words never go to
  VOICEVOX, because its character terms for live, player-made text are unread (commercial-blockers row 36). The
  fixed lines (her opener, the truths, the intro) are ordinary host lines.
- **Ran out of time:** with a fin picked, Nobiko-san passes it on for them (her line, no points); with nothing
  picked, the phone is skipped and the next relayer hears the relay before.
- **Reveal:** the TV shows Nobiko-san's opener and each relay in turn, each read in her voice, with the fin it
  added and the frame it used. Everyone votes for the juiciest relay (not their own).
- **Score:** "The rumour now" (Nobiko-san's version with the last three fins), then "What really happened…", the
  rumour's truth in her voice (mundane, or now and then stranger than the rumour).

#### Rumour Relay scoring (all doubled, like the telephone)
- Passing it on: 50. Kept who, where and what (N5 and N4, checked by key words in the reading): +50. Used a rumour
  frame (N4): +50. Each vote: 100. Speaking bonus +50 (typed +20) from the round's 30% pool. A stand-in earns no
  relay points.

#### Rumour Relay and the learning path
- Each N5 and N4 relay goes in the relayer's phrasebook as what they said (`said` when spoken, `seen` when
  typed), from memory unless they opened the words or Nobiko-san's line. So frames in it count toward the goals
  through the path's own matchers: ＿そうです (4.6), ＿と いって いました and ＿って いって いました (4.14), ＿らしいです
  (3.1), plain form (4.8). The round also recognises ＿に よると and ＿んだって, which the path has no frames for yet
  (open question below).
- Kana relayers' fins go in as tiles (`read`). Everyone gets the opener as `seen`.

### Shiritori rules (house rules from the design doc)
- The next word starts with the last kana of the one before. ー continues from the kana before it (コーヒー → ひ). Small kana count as full size (きしゃ → や). Dakuten and handakuten may be added or dropped (か ↔ が, は ↔ ば ↔ ぱ).
- A word ending in ん knocks you out (it never joins the chain, so the next player carries on from the word before). No repeats (compared by sound, so こうひい and コーヒー are the same).
- A wrong first kana, a repeat, or a word that isn't kana or readable kanji is refused with a message and the player can try again until their timer runs out. Running out of time knocks you out; a dropped phone's turn simply times out.
- Timer: 15 s per turn, shrinking 1 s per lap to a floor of 10 s (Kana level), 6 s (N5) or 5 s (N4).
- Earlier points become advantages: a time bank of 1 s per 100 points (max 20 s), used only after the base timer, and hint tokens (Kana 3, N5 1, N4 0, plus 1 per 400 points, max 4). A hint shows three unused pack nouns (then built-in nouns) that fit, privately.
- Word validity, in order: in any topic pack or the built-in noun list → accepted; the server's dictionary (kuromoji) says it is one known noun → accepted (split words are never trusted, because kuromoji splits hiragana-only words badly: ごりら → ご + り + ら); otherwise a challenge. Judges are the knocked-out players (or, if nobody is out yet, everyone else still in). Majority accepts, ties and silence accept, a strict majority of rejects knocks the player out. 8 s.
- 50 points per accepted word, +20 if spoken. The crown is 500, or more if needed so the winner leads the board by 100. At 60 turns the chain stops and the survivor with the most words (then points) wins.

### Learning moments
- Golden words: say-it-together beat, phrasebook entry (`said` if spoken or typed correctly, otherwise `seen`).
- Telephone: N5 phrase in everyone's phrasebook; Japanese steps are spoken (typed fallback earns less).
- Shiritori: every word is said from memory; pack and built-in words go into the phrasebook (`said`, or `seen` when it came from a hint).
- Kana-level phones show romaji under the word, the prompt and the needed kana, and open the kana pad by default.

### Privacy
- Fakes are hidden until the reveal; the reveal lists options by random id (the real one included) with no authors; authors and picks appear at the score.
- Telephone texts are hidden from the stage and from everyone but the current stepper (who sees only the previous step) until the reveal.
- Hints and judge votes are private to the phone.

### Host cues (Pon)
`intro`; `prompt_read` (each prompt); `reveal_react` (reveals); `kakegoe_call` (golden word); `encore_cheer` (telephone favourite); `miss_kind` (knock-out); `room_overrule` (challenged word accepted); `ippon` (crown); `recap_award` (by the room).

### Awards
しりとり王 (showdown winner), うそつき名人 (fooled the most players), ほんやく大賞 (most telephone votes), おひれ大賞 (most rumour votes).

### Content
`words.ts` holds the mode's own **draft** content (`OBSCURE_WORDS_STATUS = 'draft'`): 18 real obscure words with meanings checked against standard dictionary senses (needs a fluent sign-off before shipping), 15 of them marked `kids` as the gentle set, 8 Cheeky-only words (`CHEEKY_WORDS`: 二日酔い, 千鳥足, 朝帰り, 午前様, 梯子酒, 泣き上戸, 鼻の下を伸ばす, 窓際族), plus placeholder N5 telephone starters and ~150 common hiragana nouns used only as a shiritori dictionary, hint pool and bot vocabulary. With no topic packs at all the mode still runs end to end.

## Decisions made on Ladi's behalf
1. Round 1 plays two obscure words, not one: one word felt too short for a Fibbage round and two keep the game near 15 minutes.
2. Fake Kanji points: 100 for the real one, 50 per player fooled (Fibbage's 2:1 ratio), so good lies pay but finding the truth pays more.
3. Fakes that give the truth away are refused with a hand-written list of give-away phrases per word, since there is no fuzzy matcher for English yet.
4. The golden word is said on the phone during the score phase (not a separate encore phase), to keep the round to four phases as briefed.
5. Telephone runs as one chain in seat order from a random starting player, one `answer` phase per step, as briefed; a disconnected stepper is skipped at once rather than waited for, since everyone else is idle while they wait.
6. Telephone needs 4 seated players; if leavers drop the room below 4 it is skipped and the showdown follows.
7. The telephone vote waits until the stage has revealed every step before it can end early.
8. Shiritori turns are separate `answer` phases (with a `reveal` phase for challenges) so the room's deadline is the turn timer and disconnects need no extra handling.
9. A wrong first kana or a repeat is a free retry (until the timer runs out), not a knock-out: speech recognition misfires shouldn't end your game.
10. A word ending in ん knocks you out and stays off the chain, so the next player follows the previous word.
11. A rejected challenge knocks the player out (forgiving enough already: ties and silence accept).
12. Trailing players go first in the showdown (design doc, Comebacks).
13. "Earlier points become extra seconds and tokens" is a time bank (1 s per 100 points, max 20 s) used only after the base timer, plus 1 token per 400 points; base tokens by level (Kana 3, N5 1, N4 0).
14. The showdown "decides the winner": the crown is 500 or enough to lead by 100, whichever is more. Round 3 is therefore not also doubled.
15. Speaking bonuses use one pool per round capped so bonuses are at most 30% of the round's total points; shiritori's +20 per spoken word fits under the cap by construction (20 / 70).
16. Shiritori accepts any topic-pack word (any part of speech), not only nouns, as the brief says; hints and bots use nouns only.
17. The dictionary is trusted only for a single known noun of 2+ kana; one-kana words and split words go to the judges.
18. A 60-turn cap ends a showdown that never ends (most words, then points, wins).
19. Fake Kanji follows the room's Audience setting: Kids deals only the 15 gentle words (no lying about your age, pockmarks or going broke), Family deals the 18-word base list, and Cheeky deals its own 8 words first (topped up from the base list). Shiritori and Telephone stay the same in every audience.

20. The rumour round replaces Lost in Translation when anyone in the room plays at N4, rather than adding a fourth round: the game stays near 15 minutes and Lost in Translation is an N5 round.
21. The rumour structure (who, where, what, fins) drives Nobiko-san's model lines and the "kept it" check, so Kana and N5 players can relay without parsing free speech.
22. Nobiko-san reads players' relays with the browser's voice, never VOICEVOX, until the VOICEVOX terms for live player text are read (commercial-blockers row 36).

## Open questions
1. A fluent check of the 18 obscure words and the 8 Cheeky words (plus Ladi's taste check on the Cheeky ones), the placeholder starters and the shiritori noun list (all `draft`).
2. ~~Done: the shell's `ERRORS` map now has wording for these codes.~~ Should the phone's error flashes get proper wording in the shell's `ERRORS` map? The phone shows its own message after a refused move, but the shell first flashes the raw code (`too-close`, `wrong-start`, `repeat`, `not-japanese`…). Adding these to `controller/src/main.ts` would fix it.
3. Player text (fakes, telephone steps, challenged words) should pass the moderation filter before the stage shows it, and the VIP should be able to hide one; neither hook exists for modes yet.
4. Mode-specific host events (e.g. `gauntlet_golden_word`, `shiritori_out`) would let Pon react more precisely than the shared events used now.
5. Should a challenged word that is accepted be added to a room-wide "house words" list for later games?
6. Comeback boosts to speaking bonuses (design doc) are not applied.
7. The learning path has no frames for ＿に よると ＿そうです or ＿んだって, so the rumour round scores them but the path doesn't count them. Add them as N3 (3.1) matchers at step 6, with the usual 10 real lines and 10 look-alikes.
8. Every rumour, fin, truth and Nobiko-san line in `rumours.ts` and her `rumour_*` lines is `draft` until a fluent check.
