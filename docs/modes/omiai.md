# Omiai Matchmaker (おみあい マッチメーカー), backlog

Host: Pon, as the matchmaker (なこうど). 2–8 players. Kana–N4. A very formal "meet the family"
introduction show: one guest (a kappa cucumber farmer, a retired robot vacuum …) asks everyone the
same question each round, everyone answers in Japanese, the room votes for the most charming
answer, and a manners meter scores how polite it was. At the end the guest invites one
contestant to tea. It's a light parody of an omiai introduction. The guests are yōkai and
oddballs with no gender, and the prize is a cup of tea, not a date.

Code: `shared/src/modes/omiai/` (rules and views in `omiai.ts`, the politeness checker in
`manners.ts`, draft guests, questions and keigo pairs in `cards.ts`),
`stage/src/modes/omiai.{ts,css}`, `controller/src/modes/omiai.{ts,css}`,
`tools/bots/policies/omiai.ts`, `tests/omiai.test.ts`.

## Why it works for speaking

Every round, every player produces one short answer to a real question (what do you do at the
weekend, may I ask your name), about themselves, out loud. It's the most common conversation a
learner will actually have in Japan, and it makes them choose a register: です/ます or casual, and
at N4 keigo. Answering from memory pays most. Tiles are the fallback, and even the tiles force a
choice, because polite and casual endings sit side by side. After the vote, every phone shows its
own answer said more politely, and saying that back is the encore. So each round is two speaking
reps, the second one a corrected version of your own sentence.

## How a game goes

Four rounds by default (the VIP can pick 4, 5 or 3). The guest card shows during the `intro`
(16 s): emoji, name, job, hobbies, a quirk, and the guest's greeting. Then each round:

1. **The guest asks** (`prompt`, 8 s). The stage shows the question (N5 version, with English).
   N4 phones see the keigo version (おしごとは なにを なさって いますか。), and Kana phones get romaji.
2. **Your answer** (`answer`, 55 s; ends early when every connected player has answered).
   - From N5 up, the first 5 s are **say it first**: the phone shows only the question, a
     countdown and the talk button. Answering in that window is *from memory*.
   - After that the **tiles** appear: openers (はい、 / うん、), the question's fills, polite and casual
     endings mixed together (〜です。 / 〜だよ。), and closers on the first and last rounds
     (よろしく おねがいします。 / よろしく！). One tile per role (openers can stack), up to 6 in all,
     then Send. Kana players get their tiles straight away.
   - Speaking or typing stays possible the whole time. English is accepted (no bonus).
3. **Charm vote** (`reveal`, 10 s + 3.5 s per answer, at most 40 s). Every answer is shown
   anonymously in a shuffled order. Everyone votes for the most charming one (not their own).
   The VIP can hide an answer, and any votes for it are returned.
4. **Manners meter** (`encore`, 15 s). Authors, votes, meters and register chips appear on the
   stage, and the guest reacts to each register (🫖 まあ、ごていねいに！ for keigo, 😳 あらまあ… for
   casual). Points are paid here. Each phone privately shows its **tip** (below). Saying the tip's
   target back earns the encore bonus, with two tries, or Skip.
5. **Score** (`score`, 9 s). Points for the round, and the winning answer's polite version (or the
   stock answer) on the stage as *the natural version*.

Round 1 is always the self-introduction (はじめまして… {name}です), the last round is the closing
appeal (こんど、いっしょに 〜を しませんか。, ×2), and the rounds between ask the guest's own
questions. With five rounds all three of the guest's questions are used.

**The invitation** (`finale`, 14 s): the guest invites the contestant with the most **hearts**
(votes received plus one ⭐ per round with a meter of 70 or more). A spotlight sweeps the line-up,
stops on the chosen player at 4 s, and the guest's own invitation line fades in (the kappa:
アキさん、こんど いっしょに きゅうりを たべましょう！). The invited player gets +200. A tie goes to the higher total meter, then to
a coin flip. If nobody has a heart, nobody is invited.

### The guests

8 draft cards, all kana: a kappa cucumber farmer 🥒, a nurikabe wall 🧱, a karakasa umbrella ☂️, a
manekineko shopkeeper 🐱, a proud tengu 👺, a yukidaruma snowman ⛄, a daruma 🔴 and a retired robot
vacuum 🤖. Each card has 3 questions (N5 and N4 asks, a yes/no or wh kind, fills, polite and casual
endings, a stock polite answer per level, and a keigo pair), 3 appeal activities for the last
round, and an invitation line. `cards.ts` also holds 14 keigo pairs (いる, いく, くる, たべる, のむ,
する, いう, みる, きく, すむ, もつ, おきる, だ, ある). Each pair has plain → polite → honorific
(them) / humble (you), and N4 players get the round's pair in their phrasebook.

### The manners checker

`manners.ts`, `checkManners(utterance, level, {name})`. It is pure and deterministic, with no
LLM. It reads the server's kana reading of the answer when there is one, and the kuromoji `tokens`
for nouns and お/ご prefixes. kuromoji misparses kana-only text, so it uses only the tokens the
dictionary knows.

- **Endings, clause by clause** (the most important part). Each sentence is checked after peeling
  openers (はい、, ええと、, そうですね、) and a final particle (ね, よ, よね, か).
  - **Polite** endings are です / ます / でした / ましょう / ません and the like.
  - **Plain** endings get a rewrite:
    - a verb table of about 110 verbs, in all their plain forms (たべる → たべます, いかない →
      いきません, すんでいる → すんでいます, みた → みました);
    - だ / だった → です / でした, and じゃない → じゃありません;
    - adjectives + です (おいしい, たのしかった);
    - nouns + です.
  - Nouns come from the dictionary tokens and from every katakana word, so ゲーム and コンビニ get
    です and aren't read as verbs.
  - Lookalikes (あした, うた, モデル …) aren't conjugated.
  - A fragment ending in a particle (すしを…) is left alone.
- **Casual words** are swapped with a note: うん → はい, おれ / あたし → わたし, まじ → ほんとうに,
  めっちゃ → とても, やばい → すごい, ありがとう → ありがとうございます, ごめん → すみません,
  よろしく → よろしく おねがいします, じゃん / でしょ / かな → ですね / でしょう / でしょうか,
  〜っす → です, and others. Politeness is judged on what was said, not on the swap.
- **Extras**: greetings (はじめまして, こんにちは), the closing (よろしく おねがいします),
  introducing yourself by name (〜です / 〜ともうします), aizuchi (そうですね, すてきですね),
  cushion words (しつれいですが, もしよろしければ), お/ご words (おしごと, ごしゅみ), and keigo:
  honorific (いらっしゃる, なさる, めしあがる, おっしゃる, おもちです …) and humble (まいります,
  いたします, おります, いただきます, もうします, ございます …).
- **Register**: keigo (every clause polite, with keigo), polite, mixed, plain, casual, or none
  (no Japanese).
- **The rewrite** is in kana, with the speaker's katakana, spaces and (when the tokens give
  readings) kanji put back (明日は休みです). If an answer has kanji and the server couldn't
  read it, there is no rewrite. Guessing would give 食べるです.
- **The step up**: for an answer that is already polite, one keigo upgrade (〜です →
  〜ともうします, します → いたします, ています → ております, いきます → まいります,
  たべます → いただきます, あります → ございます …).
- **A short sound effect** (ピピッ, あっ) isn't a sentence and needs no ending.

**The meter** (0–100):

| What | Points |
| --- | --- |
| Polite endings, as a share of clauses | 45 |
| Greeting / closing / self-introduction | 10 each, at most 20 |
| An aizuchi | 10 |
| A cushion word | 10 |
| An お/ご word | 10 |
| Keigo | 20 for the first, +10 per more, at most 30 |

That total is ×1.3 at Kana, ×1.1 at N5 and ×1.0 at N4, capped at 100. An answer that is only a
set phrase (はい！) gets half the ending credit. The meter never subtracts: a casual word just
misses points.

### The tip (private, on each phone)

- **rewrite**: your answer, said politely, with the pattern's note (*だ is the plain "is"; です is
  the polite one*). This is the encore target.
- **upgrade** (N4, already polite): the keigo step up as the target.
- **perfect**: already polite, so say it once more, with a bow. N5 players see the step up as a
  bonus line.
- **stock**: the question's stock polite answer at your level, used when there is no rule-made
  rewrite (English, unreadable kanji, nothing to fix but not polite).

The score screen also shows the stock example and, for N4, the round's keigo pair.

### Scoring

| What | Points | Who |
| --- | --- | --- |
| A vote for your answer | 100 | author |
| Manners bonus (bonus pool) | cap × meter × style share | author |
| Encore: said your polite version back (bonus pool) | 35% of cap if your answer won the vote, otherwise 25%; typed 10% | author |
| The tea invitation | 200 | the invited player |

- **Bonus pool cap**: 30% of the vote points at stake (100 × other players, ×2 in the last round).
  The manners bonus and the encore share it, and neither can push past it.
- **Style share** of the manners bonus: from memory and spoken 1.0, from memory and typed 0.7,
  spoken after the tiles appeared 0.85, typed 0.55, tiles 0.45. An English answer gets 0.
- **Comeback**: a player below the mean score gets ×1.5 on the manners bonus, never past the cap.
- **Last round ×2** (votes and cap). The invitation is a flat 200.
- **Hearts** (for the invitation only): votes received + manners stars (meter ≥ 70).

### Learning hooks

- **Phrasebook** ("Your polite phrases"):
  - your tip's target is `said` when you said it back, `seen` when you typed it back, and
    `missed` when a correction went unsaid (it feeds review);
  - a polite answer you didn't repeat is `seen`;
  - the question's stock answer is `seen` for everyone;
  - the keigo pair is `seen` for N4 players.
- Say it first: the first 5 s reward recall over recognition.
- Tiles always offer a casual ending next to the polite one, so tapping is still a choice.

### Host cues (Pon)

`prompt_read` (the question) · `say_it_first` · `reveal_react` (the answers) ·
`encore_invite` (the vote winner) or `miss_kind` (no votes) · `encore_cheer` (a spoken encore,
and the invitation) · `natural_version` (the stock answer). There's no `intro` cue (see decision
2).

### Awards (draft titles)

おちゃの しょうたい *Invited to Tea* (the guest's choice), おもてなし しょう *Best Manners*
(highest total meter), にんきもの *Most Charming* (most votes), けいご マスター *Keigo Master*
(most keigo answers), ゆうき しょう *Bravest* (most answers from memory).

### Bots

`omiaiPolicy(opts)` decides how often to use tiles (`tilesChance`), how often to be polite
(`politeChance`), how often to speak instead of type (`speakChance`), how often an encore is
said right (`echoRight`), how often to skip (`skipChance`), and quiet mode. Bots answer from
canned memory answers (by question kind and register) or build a tile answer. They vote for a random answer that isn't their own, and they say their tip target back in the encore. Run them with
`npm run bots -- --mode omiai --bots 4`.

## Decisions made on Ladi's behalf

1. **Pon is the matchmaker.** His lively, theatrical voice suits a show host. Chōchin-san (Last
   Train) and Fude (kana) fit less well.
2. **No `intro` cue.** Pon's intro lines in the bank are about Oogiri and cushions. The mode uses
   only his generic events, so there are no new `HostEvent`s or line-bank entries.
3. **Guests, questions and keigo pairs live in the mode folder** (`cards.ts`, `status: 'draft'`).
   That keeps the mode free of content-loader and linter changes, as with Phrase Bingo's scenes.
4. **All card content is kana.** Kana–N4 players can all read it, the checker works best on kana,
   and the fluent check is easier.
5. **No gender and no romance.** The guests are yōkai and objects, every player is addressed as
   〜さん, and the prize is a tea invitation. "Charming" and "polite" are the only axes.
6. **The room votes for charm and the meter scores manners.** Kept separate, so a funny casual
   answer can win votes while a polite one wins stars. Both feed the hearts.
7. **Hearts = votes + manners stars (meter ≥ 70).** The invitation needs both. Ties go to the
   higher total meter, then a coin flip.
8. **The invitation is worth 200**, like an Oogiri IPPON. It's a guess to tune in playtests.
9. **Tiles mix polite and casual endings**, so even a tile answer is a register choice. The style
   share lowers the tile bonus (0.45) but doesn't make it zero.
10. **Say it first (5 s) from N5 up**, as in the design doc's speaking ladder. Kana players get
    tiles at once.
11. **The checker is rule-based and never subtracts.** Casual words, English and mistakes just
    earn less. Nothing waits on an LLM.
12. **The rewrite is in kana, with the speaker's katakana, spaces and kanji put back.** If the
    kanji couldn't be read, there's no rewrite and the stock answer is the tip.
13. **The encore is "say your own polite version back"**, checked by Phrase Bingo's lenient
    `saidPhrase` against the tip's kana, with two tries. A spoken encore earns more than a typed
    one.
14. **English answers are accepted** (the vote still counts) but earn no manners bonus and no
    star. The guest reacts with …にほんごで どうぞ！
15. **`usesPack: false`.** The questions come from the guest card, not the night's topic pack.
16. **2–8 players.** Two players can play, since each votes for the other. Rounds are 4 by
    default, with 5 and 3 as options.
17. **Durations**: intro 16 s, prompt 8 s, answer 55 s, reveal 10 s + 3.5 s per answer (at most
    40 s), encore 15 s, score 9 s, finale 14 s. Four rounds take about 7–8 minutes.
18. **The VIP can hide an answer** during the vote (as in Oogiri), and votes for it are returned.
19. **The guest is random** unless `extra.cardId` names one.
20. **N4 players hear the keigo question** and get the keigo upgrade as their tip when they're
    already polite. N5 players see it as a bonus line only.

## Open questions

1. **Is the manners meter fair to a funny answer?** Votes and stars are separate on purpose; should
   a star need a vote too?
2. **Hearts mix two scales.** Six votes beat three stars, but with 8 players votes swamp stars.
   Should stars count double?
3. **The invitation (+200)**: too big a swing for the last moment, or just the right drama?
4. **Pon's line bank** has no matchmaker lines. Write a small set of new host events (intro, the
   guest arrives, the invitation)?
5. **Should the VIP pick the guest** in the lobby? Today it's random (or `extra.cardId` from the
   debug tools).
6. **Fluent check** of all 8 cards, the 14 keigo pairs, the swaps and their notes, the reactions
   and the award titles. Are the N4 asks natural keigo, and is ゆうき しょう a natural title?
7. **Should a casual answer to a casual guest score well?** Every guest is formal for now; a
   relaxed guest (a festival tanuki) would flip the register as a twist.
8. **Say-it-first length** (5 s) and the 0.45 tile share: playtest numbers.

## Known gaps

- **No LLM tips.** The rewrite is rule-based, so an answer it can't parse falls back to the
  stock answer. Free answers have no English subtitle on the stage.
- **The checker is heuristic.** Possible misses:
  - a hiragana noun that ends like a verb form, with no dictionary token (for example きた from
    北 written in kana);
  - unusual verbs that aren't in the table;
  - long multi-clause answers where the tokens only describe the last word.
  The unit tests cover the common answer shapes and every card's tiles and examples.
- Nothing has been tried with real phones: whether the speech recogniser keeps です/ます
  endings, and whether 5 s is enough to start talking.
- No sound effects (the teacup rattle, the spotlight drum roll).
- The VIP can't choose the guest in the UI.
- Card content isn't covered by the content linter or `npm run content:readings` (see decision 3).
