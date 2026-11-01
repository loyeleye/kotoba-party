# Nice to Meet You! (はじめまして！), backlog

Host: Pon. 3–8 players. Kana–N4. Each turn one player is the guest on 「ポンの はじめまして コーナー」.
They write one true thing about themselves; three others secretly write lies about them (each lie is a
tanuki in disguise); the previous guest introduces them by reading every card aloud; everyone ranks the
cards from "surely true" to "surely a lie". Every lie ranked above the truth scores for its tanuki.

It merges the classroom activity 他己紹介 (introducing someone else, the step every course takes after
自己紹介) with the ranking idea of Rank5 (see [commercial-blockers](../commercial-blockers.md#12-game-formats-and-names):
the name stays out of the product). Ladi's twist: one card is true, the rest are lies, and lies above
the truth score.

Code: `shared/src/modes/hajimemashite/` (rules and views in `hajimemashite.ts`, the 26 draft cards in
`cards.ts`), `shared/src/japanese/toKana.ts` (romaji to kana, names to katakana),
`stage/src/modes/hajimemashite.{ts,css}`, `controller/src/modes/hajimemashite.{ts,css}`,
`tools/bots/policies/hajimemashite.ts`, `tests/hajimemashite.test.ts`.
Design: `hajimemashite/design.md` (v0.2) in the project files, with the kotoba panel's reviews; built
screenshots in `hajimemashite/shots/`.

## Why it works for speaking

- 自己紹介 and 他己紹介 are the first speaking tasks of every beginner course. Every turn drills
  はじめまして／こちらこそ, 〜が だいすきです, しゅみは 〜です, こちらは 〜さんです, in both persons.
- The introducer switches person themselves: N5 phones show the third-person frame with the word,
  N4 only the word; Kana players get the full line with romaji.
- **A card goes up on the TV only when its line is read** (Ladi's call): there's no free reveal to lean
  on. 「ポン、たすけて！」 or 12 s of silence has Pon read the line instead: the card goes up with a
  paw stamp and that line earns nothing.
- Writing is silent (anyone speaking would give the truth away); talking comes in the introduction,
  the argue phrases while ranking, the tanuki's 「ドロン！ わたしでした！」, the guest's
  「〇〇？ ちがいます！」 and truth, and the closing おぼえてる？ round.

## How a turn goes

1. **The guest** (`prompt`, 12 s; 18 s the first time, for the name; ends when the guest has greeted
   and everyone has answered). First time only, the guest writes their name in katakana (the phone
   suggests one: Aki → アキ, Ladi → ラディ, Lee → リー). The guest says 「はじめまして。アキです。よろしく
   おねがいします。」; everyone else 「こちらこそ、よろしく おねがいします」 (Kana: よろしく). Each pops a bubble.
2. **Write** (`answer`, 40 s, in silence). The guest writes the truth (any of the card's 16 tiles, or
   typed); three tanuki write a lie each from a private hand of 4 tiles (or typed); the rest are
   detectives and write a hidden guess. Kids rooms and cheeky-only cards are tiles only. Typed romaji
   becomes kana, kanji becomes its reading, and a typed whole sentence is cut down to the blank.
   A lie that is the truth isn't shown: its writer gets しってた！ and Pon fills in. Twin lies merge.
3. **The introduction** (`reveal`, reader-paced). The introducer reads the opener, each card, and the
   closer. The guest can veto an unread lie (it's swapped for one of Pon's).
4. **Rank it** (`encore`, 30 s). Everyone but the guest taps the cards in order (a tanuki's own card
   isn't on their list) and can argue out loud; the guest picks the lie they wish were true.
5. **The truth** (`score`, 1.2 s + 2.2 s a card + a 1 s held breath + 6 s). The lies flip from least to
   most believed, each puffing into a tanuki with its writer's seat colour and name; then a beat, and
   the truth turns last, gold with a red ほんとう！ stamp. Each phone's line comes up as its card turns:
   the tanuki's 「ドロン！　わたしでした！」, the guest's 「〇〇？　ちがいます！」, then the guest's truth.

After the last turn, **おぼえてる？** (`finale`, 40 s): say what's true about each other guest (or tap
it), then the recap.

## Scoring

Per ballot (one player's ranking).

| Who | What | Points |
| --- | --- | --- |
| Ranker | the truth is your #1 / #2 / #3 | 200 / 100 / 40 |
| Tanuki | each other ballot with your lie above the truth | 60 |
| Tanuki | the lie with the most #1 places (tie: best average place) | +100 |
| Tanuki | the guest's wish pick | 80 |
| Tanuki or detective | しってた！ you wrote the truth | 120 |
| Guest | some rankers, but not all, put the truth first | 250 |

Speaking (said / tried / tapped): greeting 40/20/12, こちらこそ 10/3, each introduction line 20/10/6
(Pon's lines 0), claim 20/6, each refutation 25/8, the truth 45/25/14, argue 10 (two a turn), recall
50 said / 20 tapped plus 20 to the guest remembered.

Awards: たぬき賞, めいたんてい賞, らしさ賞, なぞの ゲスト賞, いいこえ賞.

VIP extras: みじかめ (4 guests only) and 5まい (five cards a turn).

## Content

26 draft cards (`cards.ts`): すきな たべもの, きらいな たべもの, しゅみ, いきたい ところ, できること, こわい もの,
まいあさ, かいたい ペット, こどもの ころの ゆめ, ねる まえに, six N4 cards for N4 guests (the N4 deck, below),
three Kids N4 cards and three Cheeky N4 cards (below), and four Cheeky cards (はつデート, よっぱらうと, スマホの しゃしん, じつは すき) written
for women and men alike (もとカレ and もとカノ, かれの いえ and かのじょの いえ). 28 draft Pon lines
(`content/src/hosts/pon.ts`, `hajime_*`). All `draft` until the fluent check.

## The N4 deck (goal 4.3)

Six N4 cards, so N4 guests write their truth, and the tanuki their lies, in the experience frames:

| Card | First person | Frame |
| --- | --- | --- |
| たべた ことが ある もの | ＿を たべた ことが あります | ta-koto |
| いった ことが ある ところ | ＿に いった ことが あります | ta-koto |
| わすれて しまった もの | でんしゃに ＿を わすれて しまいました | te-shimau |
| こわして しまった もの | ＿を こわして しまいました | te-shimau |
| さいきん やって みた こと | さいきん ＿を やって みました | te-miru |
| いつか やって みたい こと | いつか やって みたい ことは ＿です | te-miru |

The blank is always a noun, so tiles and typed lies work as on every card; the frame carries the
grammar, and the introducer says it in the third person (「アキさんは でんしゃに かさを わすれて
しまいました」). 〜て みたい can't take someone else as its subject, so that card is a noun sentence like
いきたい ところ. Each card has `frames` and `status: 'draft'`.

Kids and Cheeky rooms add three N4 cards of their own, one per frame (Ladi's call), so their N4 guests
don't miss the room's set:

| Room | Card | First person | Frame |
| --- | --- | --- | --- |
| Kids | みた ことが ある どうぶつ | ＿を みた ことが あります | ta-koto |
| Kids | こぼして しまった もの | ＿を こぼして しまいました | te-shimau |
| Kids | つくって みた もの | ＿を つくって みました | te-miru |
| Cheeky | ねた ことが ある ところ | ＿で ねた ことが あります | ta-koto |
| Cheeky | よっぱらって でんわした ひと | よっぱらって ＿に でんわして しまいました | te-shimau |
| Cheeky | デートで いって みたい ところ | デートで いって みたい ところは ＿です | te-miru |

They have 16 tiles and a Pon tile like every card (Kids: animals, spills, things to make; Cheeky: places
you nodded off, who you drunk-called, date spots, both ex tiles as on the other Cheeky cards) and are
tiles only, like every Kids-room card and every Cheeky-only card.

An N4 guest draws the N4 cards first, in every room: the room's own N4 cards (Kids, Cheeky) first, then
the shared N4 deck, then the usual cards once they've had them all. Kana and N5 guests never get them. It isn't a separate seat: the tanuki and
detectives play the guest's card as always, so there's no offer to decline.

## Music and sound

Placeholders until the art panel's pick: **Local Forecast - Elevator** and **Carefree** (Kevin MacLeod,
both already in the game). The music ducks under the introduction. Sounds: a puff per lie, a chime for
the truth.

## Decisions made on Ladi's behalf

1. The introducer is the previous guest, so introductions run round the room as a relay.
2. With 3 players there are two tanuki, and Pon adds his own joke lie once a game.
3. A guest who writes nothing gets a random tile as their truth, so the turn still plays.
4. The prompt ends as soon as the guest has greeted and everyone has answered こちらこそ (not on a
   fixed timer).
5. Points are paid when the score phase ends, after the flip; speaking bonuses are paid at once.
6. The guest's tanuki claim, refutations and truth come one line at a time on the phone, so there is
   only ever one talk button.
7. The truth always turns last (the art panel's call, for suspense), not in the room's belief order as
   the design doc had it.
8. Ranking locks with an explicit きめた！ button, not on the last tap.
9. The kana-level reply is 「こちらこそ！」, and the introducer closes with 「〇〇さんを どうぞ よろしく
   おねがいします！」, the usual end of a 他己紹介 (the Japanese panel's notes).
10. Music: the Art Director preferred Wallpaper as the second theme, but each mode's second theme must
    be unique and Wallpaper is Oekaki's, so it stays Carefree.
11. Each lie turns into a pixel tanuki with a leaf on its head (`stage/assets/fx/tanuki-doron.png`), cut
    from Pon's own sprite, not the 🦝 emoji (a raccoon). Pon's paw stamp is a red ink paw hanko and face-down
    cards show a gold leaf medallion (both PixelLab, Ladi's call).

12. N4 guests draw the N4 deck first, even in a Cheeky room (where everyone else gets the Cheeky
    cards first): the N4 deck is the point of their turn.
13. The N4 cards' blanks are nouns with the verb in the frame (でんしゃに ＿を わすれて しまいました), not a
    verb phrase in the blank, so typed lies stay one word and are cut down the usual way.

## Decided by Ladi

1. **Kids and Cheeky rooms have their own N4 cards** (was open question 7): three each, one per frame,
   which N4 guests in those rooms draw first, before the shared N4 deck.

## Open questions

1. Is a tutorial turn worth adding (Pon as the first guest, nobody scores) if first games confuse?
2. Should the last turn pay double (ラストゲスト) to keep the end close?
3. Is 60 a ballot for a lie above the truth the right size next to 200 for finding the truth?
4. Pon reads a line after 12 s of silence: too long for the room, too short for a nervous reader?
5. Pon's English captions show a guest's name in katakana (マット… even better than Pon); host-line slots
   carry one value for both languages.
6. Fluent check of every frame, tile, Pon line and argue phrase.
