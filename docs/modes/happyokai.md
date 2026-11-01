# Happyōkai! (はっぴょうかい！), backlog

Host: Chōchin-san. Kana–N4. 3–8 players. A school recital night (発表会): each player in turn gives a
short talk in Japanese on slides they have never seen, picked live by another player, their assistant.
The rest of the room reacts with stamps, asks one question, and grades the talk with flowers. It is the
one game where you say several sentences in a row instead of one.

Code: `shared/src/modes/happyokai/` (rules and views in `happyokai.ts`; titles, slides, mishaps, frames,
ready sentences, questions and the report card in `content.ts`), `stage/src/modes/happyokai.{ts,css}`,
`controller/src/modes/happyokai.{ts,css}`, `tools/bots/policies/happyokai.ts`, `tests/happyokai.test.ts`,
pictures in `stage/assets/slides/` (drawn by `tools/art/slides.ts`). Design: the Happyōkai design doc
(v0.2) and its kotoba-panel reviews. The idea is Jackbox's Talking Points and the improv game
PowerPoint Karaoke; nothing else is borrowed (see [commercial-blockers.md](../commercial-blockers.md) row 12).

## Why it works for speaking

Every other mode asks for one sentence. Here the presenter has to keep going: an opening, something
about each slide, a recovery when a mishap hits, a closing, and an answer to a question. Scaffolding
keeps it possible at every level, and the scoring pays most for the presenter's own words:

- **Backstage**, the presenter rehearses the opening and closing (the ritual 「〜と もうします」,
  「いじょうです。ありがとうございました」), worded for their level.
- **On each picture slide**, the phone shows the word, two or three sentence frames for it (worded by
  the word's kind: a living thing, a place, a food or a thing) and ready sentences that tie it back to
  the talk's topic. Tapping a ready sentence counts a little; reading it out counts more; saying your
  own counts most.
- **Mishaps** give a fixed recovery line (「しつれいしました。」…) to say, a real presentation skill.
- **Question time** practises the other side: the room asks from three cards at the lower of the
  asker's and the presenter's levels, and the presenter answers with frames (「〜から です」), with
  「いい しつもんですね！」 to stall.

## How a game goes

Everyone presents. 3 players: two talks each, 3 picture slides. 4: two each, 2 slides. 5–6: one each,
3 slides. 7–8: one each, 2 slides. A Kana presenter's talk has one picture slide fewer (at least one), because
each slide is a bigger climb for them. The intro (16 s) explains it. Each talk:

**Kanji.** The content is written with kanji and their readings in brackets (`猫[ねこ]の 仕事[しごと]`, in
`content.ts`), and `ruby.ts` shows it at each player's level: kana only at Kana, N5 kanji with furigana at
N5, N5 and N4 kanji at N4. Any other kanji goes back to its kana. The TV shows the talk at the presenter's
level. Sentence patterns (frames) and answer patterns stay in kana. Speech is matched on the kana, so
reading a line aloud counts the same at every level.

1. **Backstage** (`prompt`, 30 s at Kana, 25 s otherwise). The presenter picks one of two titles (one
   about a creature or a thing, one about people) and taps 🙋 when ready. The TV shows who's up and
   their assistant (the next seat that has assisted least). On the first, middle and last talks,
   Chōchin-san shows his holiday photos instead (a running gag that pays off on the third).
2. **The talk** (`answer`, one phase; each slide runs on its own timer):
   - **Title slide** (15 s): say the opening.
   - **Picture slides** (20 / 25 / 30 s by level, plus a beat for the laugh): the assistant has three
     choices for each next slide: 🙂 one that fits the title, 🎲 a random one, 🤪 a wild one
     (むちゃぶり). Once a talk they can play a **mishap** instead: まっくら (blackout), まちがい
     (Chōchin-san's holiday photo), グラフ (a chart about the last word, up or down), さかさま (the
     last slide upside down) or メッセージ (a message from Mum pops up; in Cheeky, from an ex). The
     assistant can also push a cue card (one of the ready sentences) to the presenter's phone.
   - **Closing slide** (12 s): say the closing. Applause (👏) opens here.
   - The presenter taps ▶ Next after saying something (or after 5 s); a slide whose candle burns out
     moves on by itself. The phone talks by tap-to-start, tap-to-stop (up to 15 s), not hold.
   - The room stamps all the while: おもしろい！ へえー！ すごい！ なるほど えーっ？ (and パチパチ！, applause, at the
     end). They rise as paper stickers in the TV's side panel, one lane per kind (a burst of the same stamp shows once, ×N); at most one per second per player, and the phone's pad cools down in between.
   - Captions: what the presenter said shows under the slide; if they read a sentence off the phone,
     the TV shows that sentence, so a mis-hearing never shows. The presenter can hide their own
     caption, the VIP any caption.
3. **Question time** (`encore`, 30 s). Everyone else gets three question cards, picks one and asks it
   (out loud for more). The TV shows whose hands are up, not the questions. The presenter chooses one,
   Chōchin-san reads it out to the room (「〜さまからの しつもんです。」), and the presenter answers it.
4. **はなまる** (`reveal`, 12 s). The audience grades the talk: 🌼 よく できました, 🌸 たいへん よく
   できました or 💮 はなまる. The assistant grades too in a 3-player game.
5. **Report card** (`score`, 9 s). Flowers, the grade in red pen (a drawn はなまる for top marks), Chōchin-san's seal, a teacher's comment about the slide that got
   the most stamps (or the mishap), the number of sentences and the longest run, and the points.

**The best talk** (`finale`, 20 s, when there were two talks or more): everyone votes for a talk that
isn't their own.

## Points

- **Presenter.** はなまる: 700 × (average grade − 1) / 2, over the grades actually given (2 when nobody
  grades). Speaking: the opening (40 own / 20 read / 10 typed / 5 tapped), the closing (20/10/5/3), a
  mishap's recovery (20/10/5/3), up to 3 new sentences per picture slide (30/15/10/3 each; a sentence
  said twice counts once), a れんぞく bonus of 20 for 2 / 3 / 4 sentences said out loud on one slide
  (Kana / N5 / N4), and the answer in question time (60/30/15/5). Speaking is capped at 300.
- **Assistant.** 20 for each sentence said out loud on a slide they picked (up to 120), plus 50 when a
  mishap they played is recovered out loud (20 if typed or tapped).
- **Questions.** 15 for asking out loud, 5 tapped, +35 if the presenter chose yours.
- **Best talk.** 100 a vote to the presenter, 50 to their assistant.

**Awards.** ベストプレゼン賞 (the room's favourite talk; はなまる breaks ties), めいアシスタント賞 (most
assistant points), ノンストップ賞 (most sentences on one slide), ベストしつもん賞 (most questions asked out
loud), ハプニング賞 (most laughs on a mishap).

**Phrasebook.** The presenter's opening, closing and recovery lines, and every あいづち a player
stamped.

## Content

49 titles, noun phrases so they fit 「タイトルは「〜」です」: 12 for Kids and Family, 12 more for Family
and Cheeky, and 25 Cheeky-only; plus the N4 decks' 16 (below). 80 slides in three pools: everyday Japan played straight (おみくじ,
じはんき, ラッシュアワー, えきべん…), ridiculous ones (a grandma doing a kickflip, a sock in a museum, a
kappa at the laundrette…) and grown-up ones for Family and Cheeky rooms. Kids rooms see 12 titles and
48 slides; Cheeky rooms see all of them.

The Cheeky set (Ladi, 2026-10-28: the audience is half women; and add sets late-night adults find
funny) has four strands, never explicit. Ladi kept its tone as it is (2026-10-28):

- **Office and dating**, from both sides: the boss's karaoke, a ring in the ramen, locked out on the
  balcony, a 2 a.m. おきてる？, the dating-app fish photo.
- **Women's side**: girls' night, the group-date post-mortem, the mother-in-law's white glove, the bouquet
  scrum, eyeliner on a shaking train, the mummy's boy on the phone at dinner, a face mask that scares the
  delivery man, midnight cake.
- **College**: the all-nighter, a wall of cup noodles, the club drinking party, a lecture hall asleep,
  a part-time job in a mascot costume.
- **Yakuza who shouldn't be**: a primary-school gang boss in sunglasses on the slide, yakuza at a tea
  ceremony, a shiba-inu godfather, a yakuza maid café; and solo karaoke and the 3 a.m. konbini.

Every picture is a
320×240 PixelLab `pixflux` image with no text in it (row 6), drawn on the TV at exactly 2× (a 640×480
screen) so the pixels stay even. The grade flowers (`stage/assets/icons/hk-flower-{0..3}.png`, 24×24) are
drawn in code by a small PIL script, not by PixelLab. The stamps (`icons/hk-stamp-*.png`), the candle and its flame, and Chōchin-san's bow
(`anim/chochin-bow.png`, tipped forward in CSS) are PixelLab sprites in the manifest.

**Music.** Lobby Time (theme) and Pamgaea (second theme), Kevin MacLeod, CC BY 4.0. Backstage the
music sits under (the presenter rehearses aloud); during the talk and question time it drops to the
listening mix, because the whole room has to hear one voice. The TV plays a soft swish on a new slide,
static for a blackout, a phone trill for the message, a bwomp for the other mishaps, and a chime with
the hanko.

## The N4 decks (goals 4.12, 4.3, 4.7, 4.11)

An N4 presenter's talks alternate between two kinds of pair (Ladi's call): their first talk offers a
**deck pair**, one **Then and now** (昔と 今) title and one **If I were…** (もしも…) title; their next talk
offers a **mix**, one deck title (from the deck they didn't pick last time) and one usual title, in random
order; and so on (`n4Mix`). Deck titles are labelled with their deck on the phone. With 3 or 4 players
(two talks each) every N4 presenter gets one of each; with 5 or more (one talk each) they get the deck
pair. Everyone else keeps the usual titles. A usual title picked from a mix plays as a usual talk: usual
frames, ready sentences and question cards (no deck cards). The slides, mishaps and scoring are the same; what changes is the N4 presenter's
language:

| | Then and now | If I were… |
| --- | --- | --- |
| Titles (8 each, 1 Cheeky-only) | おじいちゃんの 昔と 今, うちの 猫の 成長, ロボットの 進化, かっぱの 新しい 生活… | もし 私が 猫だったら, もし 私が 総理大臣だったら, もし 私が 幽霊だったら… |
| Slide frames | まえは 〜でしたが、いまは 〜ように なりました。 / ＿が 〜られるように なりました。 / 〜ことに しました。 / 〜ことに なりました。 | もし ＿だったら、〜たいです。 / もし ＿が なかったら、〜。 / もし わたしが 〜だったら、〜と おもいます。 |
| Ready sentences (also the assistant's cue cards), three a slide | 今では 〔topic〕も 〔word〕が 食べられるように なりました。 / 〔word〕に ついて もっと しらべる ことに しました。 / 来月 〔topic〕と 〔word〕が 結婚する ことに なりました。 | もし 私が 〔topic〕だったら、毎日 〔word〕を 食べたいです。 / もし 〔word〕が なかったら、〔topic〕は こまると 思います。 / もし この 〔word〕が 〔topic〕だったら、みんな びっくりするでしょうね。 |
| Question cards (N4 askers) | 〔topic〕は 前は どうでしたか？ / どうして そう する ことに しましたか？ / 今は 何が できるように なりましたか？ | もし あなたが 〔word〕だったら、どう しますか？ / もし 〔topic〕に なれたら、何が したいですか？ |
| Answer frames | まえは 〜でしたが、いまは 〜ように なりました。 / 〜から、〜ことに しました。 / 〜ことに なりました。 | もし 〜だったら、〜たいです。 / 〜と おもいます。 / じつは、〜んです。 |

The ready sentences pick their verb by the slide's kind (遊べる for a living thing, 行ける for a place,
食べられる for food, 使える for a thing, 楽しめる for an event; If I were… uses いっしょに いたい, 住みたい,
食べたい, 使いたい and 楽しみたい the same way). A thing you don't 使う names its own verb (`use`:
おみくじが 引ける / を 引きたい, 電車に 乗れる / に 乗りたい). The big news fits the slide too: a place is
where 〔topic〕 and I move (〔topic〕と 〔word〕に 引っ越す), a food gets a shop (〔topic〕が 〔word〕の お店を
開く), and anything else gets married (〔topic〕と 〔word〕が 結婚する). An If I were… title is a clause, so the
opening quotes it: 「今日は 「もし 私が 猫だったら」に ついて 話したいと 思います」. The decks' frames
are in `DECKS` (by frame id), and both are `draft`. A Kana or N5 asker in an N4 deck talk still gets the
usual cards at their level. It is not a separate seat (the presenter's talk is the same seat), so there
is no offer to decline.

## Not built yet

- A private correction after each talk (an AI teacher's one-line note on one sentence).
- Speech-to-text confidence: a line that was misheard can only be hidden, not fixed.
- Nobiko-san's cameo and the ぷう mishap from the humor review.
- Pictures for the title and closing slides (they are drawn by the TV).

## Decisions made on Ladi's behalf

1. ~~N4 presenters get only the N4 decks' titles.~~ Superseded by Ladi's decision below. Their opening,
   closing, mishap recoveries and points are unchanged.
2. **The decks reuse the usual slides**; only the frames, ready sentences, deck question cards and answer
   frames change. A slide's word joins the topic in each deck sentence, so the joke still lands (「来月
   猫と パンツが 結婚する ことに なりました」).
3. **An N4 asker in a deck talk always gets one of the deck's own question cards** first.

## Decided by Ladi

1. **N4 presenters sometimes get a usual title too** (was open question 1): their pairs alternate, a deck
   pair on their 1st, 3rd… talk and a mix (one deck title, from the other deck than last time, plus one
   usual title) on their 2nd, 4th… talk. Alternating per presenter is simple and even: everyone who
   presents twice sees both kinds, and nobody's deck practice depends on the dice. The question cards
   follow the chosen title's deck.

## Open questions

1. Fluent check of the deck lines, especially the `use` verbs (引ける, 乗れる), 毎日 〜と いっしょに
   いたいです, and the moving and shop news lines.

