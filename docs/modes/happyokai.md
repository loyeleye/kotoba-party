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
   Once a game, the first N4 presenter's question time opens with Chōchin-san's own "Have you ever…?"
   card (below).
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
  (Kana / N5 / N4), the answer in question time (60/30/15/5), and the answer to Chōchin-san's "Have you
  ever…?" card with the frame in it (40 from memory / 15 after a peek / 10 typed / 5 tapped; tries without
  the frame pay 5). Speaking is capped at 300.
- **Assistant.** 20 for each sentence said out loud on a slide they picked (up to 120), plus 50 when a
  mishap they played is recovered out loud (20 if typed or tapped).
- **Questions.** 15 for asking out loud, 5 tapped, +35 if the presenter chose yours.
- **Best talk.** 100 a vote to the presenter, 50 to their assistant.

**Awards.** ベストプレゼン賞 (the room's favourite talk; はなまる breaks ties), めいアシスタント賞 (most
assistant points), ノンストップ賞 (most sentences on one slide), ベストしつもん賞 (most questions asked out
loud), ハプニング賞 (most laughs on a mishap).

**Phrasebook.** The presenter's opening, closing and recovery lines, their answer to Chōchin-san's card
(their own words when they said it with the frame, else his model answer, seen), and every あいづち a player
stamped. In a deck talk (step 5b-2), a sentence of the presenter's own in one of the deck's frames, on a picture
slide or as the answer in question time, puts the deck's ready sentence in that frame in their phrasebook as
said from memory: 「…ように なりました」 of their own logs 「今では 〔topic〕も 〔word〕が …ように なりました」. One card
per line: the ready sentence (on that slide, or on any picture slide for an answer) that shares the most deck
frames with it, counting only the frames heard in the line (`happyokai:<deck>:<slide>:<frames>:<level>`), and a
frame once a talk (panel on #160). A line close to a ready sentence on the slide (words 75% the same) was read
off the card, so it earns nothing here. What was heard has no English to practise from, so the card is the
deck's version, as Late Again! logs Pon's model line. Before this, a Then and now presenter's own sentences
counted toward nothing, which is why 4.12 never moved.

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
(two talks each) every N4 presenter gets one of each; with 5 or more (one talk each) every other talk
in the running order is a mix, so N4 presenters get a deck pair or a mix by seat. Everyone else keeps the usual titles. A usual title picked from a mix plays as a usual talk: usual
frames, ready sentences and question cards (no deck cards). The slides, mishaps and scoring are the same; what changes is the N4 presenter's
language:

| | Then and now | If I were… |
| --- | --- | --- |
| Titles (11 and 8, 1 Cheeky-only each) | おじいちゃんの 昔と 今, うちの 猫の 成長, ロボットの 進化, かっぱの 新しい 生活…, and three places: 私の 町の 昔と 今, おばあちゃんの 村の 今, 商店街の 復活 (Family and Cheeky) | もし 私が 猫だったら, もし 私が 総理大臣だったら, もし 私が 幽霊だったら… |
| Slide frames | まえは 〜でしたが、いまは 〜ように なりました。 / ＿が 〜られるように なりました。 / 〜ことに しました。 / 〜ことに なりました。 | もし ＿だったら、〜たいです。 / もし ＿が なかったら、〜。 (いなかったら for a living thing) / もし わたしが 〜だったら、〜と おもいます。 |
| Ready sentences (also the assistant's cue cards), three a slide | 今では 〔topic〕も 〔word〕が 食べられるように なりました。 / 〔word〕に ついて もっと しらべる ことに しました。 / 来月 〔topic〕と 〔word〕が 結婚する ことに なりました。 | もし 私が 〔topic〕だったら、毎日 〔word〕を 食べたいです。 / もし 〔word〕が なかったら、〔topic〕は こまると 思います。 / もし この 〔word〕が 〔topic〕だったら、みんな びっくりするでしょうね。 |
| Question cards (N4 askers) | 〔topic〕は 前は どうでしたか？ / どうして そう する ことに しましたか？ / 今は 何が できるように なりましたか？ | もし あなたが 〔word〕だったら、どう しますか？ / もし 〔topic〕に なれたら、何が したいですか？ |
| Answer frames | まえは 〜でしたが、いまは 〜ように なりました。 / 〜から、〜ことに しました。 / 〜ことに なりました。 | もし 〜だったら、〜たいです。 / 〜と おもいます。 / じつは、〜んです。 |

The ready sentences pick their verb by the slide's kind (遊べる for a living thing, 行ける for a place
(or its own verb: 温泉・銭湯に 入れる, 富士山に 登れる, 海で 泳げる, ベランダに 出られる, カプセルホテルに 泊まれる),
食べられる for food, 使える for a thing, 楽しめる for an event; If I were… uses いっしょに いたい, 住みたい,
食べたい, 使いたい and 楽しみたい the same way). A thing you don't 使う names its own verb (`use`:
おみくじが 引ける / を 引きたい, 電車に 乗れる / に 乗りたい). The big news fits the slide too: a place is
where 〔topic〕 and I move (〔topic〕と 〔word〕に 引っ越す), a food gets a shop (〔topic〕が 〔word〕の お店を
開く), and anything else gets married (〔topic〕と 〔word〕が 結婚する). An If I were… title is a clause, so the
opening quotes it: 「今日は 「もし 私が 猫だったら」に ついて 話したいと 思います」. A living slide word is
いなかったら (not なかったら) in the If I were… frame, line and question card.

**Place titles.** A Then and now title about a place (`place` on the title) can't go anywhere alone,
move house or marry, and must never "become a town" when it already is one, so its three sentences are
its own (`placeSentences`). Each place title brings its own "before" (町: 静かでした, 村: 人が
少なかったです, 商店街: 誰も いませんでした), never the place's own noun:

- 〔place〕は 前は 〔before〕が、今では 〔what you can do there〕ように なりました。 The verb by slide kind:
  〔word〕が 見られる (living), 〔word〕まで バスで 行ける (place), or the place's own verb (海で 泳げる, 富士山に
  登れる), 〔word〕が 食べられる (food), 〔word〕が 買える or the thing's own verb (おみくじが 引ける), 〔word〕が
  楽しめる (event).
- 〔word〕に ついて もっと しらべる ことに しました。 (as for every topic)
- The news: 来月 〔place〕から 〔word〕まで 新しい バスが 走る (a place, except the balcony), 〔place〕に 〔word〕の
  お店が できる (a food), 〔place〕で 〔word〕の お祭りを する (anything else, and the balcony).

A place topic is never asked 「〔topic〕は 今 どこですか？」 (`notPlace`). Tests render every Then and now
title through every slide.

**Swapping a deck title.** An N4 presenter can tap 🔄 under a deck title, backstage, to swap it for a
usual title (move `swap`), once a turn and before 🙋 ready. The new title is drawn the usual way (a
usual title the room hasn't had, not already on offer); if they had picked the deck title, the pick
moves to the new one and Chōchin-san announces it. The mix still gives them usual titles on its own. The decks' frames
are in `DECKS` (by frame id), and both are `draft`. A Kana or N5 asker in an N4 deck talk still gets the
usual cards at their level. It is not a separate seat (the presenter's talk is the same seat), so there
is no offer to decline.

## Chōchin-san's "Have you ever…?" card (goal 4.3)

The path's 4.3 needs ＿た ことが あります said from memory, and no game asked for it (0.2 a Hajimemashite
game). So once a game, question time for the **first N4 (or N3) presenter** opens with a card of
Chōchin-san's own, before the room's cards come out (`HAVE_YOU` in `content.ts`, `dealHaveYou` in
`happyokai.ts`):

- Chōchin-san announces it without saying it (`happyokai_have_you`: 「まず、わたくしから ひとつ しつもんが
  ございます。」). The presenter's phone and the TV show the question **in English** ("Have you ever eaten
  nattō?") with the frame chip ＿た ことが あります／ありません. The TV adds the frame's English under the chip
  ("I've (done) … / I've never (done) …", `HAVE_YOU_GLOSS`) and "Answer on your phone!"; the phone adds the
  noun (納豆) in a quieter "Words: …" line, a countdown, and the tries left. The presenter answers yes or no
  in a full sentence ("The truth is optional."); either way it's the frame.
- The Japanese (the question and both answers) is behind **👀 Peek at the Japanese (fewer points)** (move
  `peek`). Said after a peek, the answer counts as read; said without one, from memory.
- After a try without the frame, the phone says how many tries are left and asks for the whole ＿た ことが
  あります sentence. The answer box keeps its own draft (not shared with the room's question).
- The card ends when they say a line with the frame, after two tries without it, when they tap Pass
  (`next`), or after 25 s (`HAVE_YOU_MS`). Chōchin-san then **reacts to the answer**
  (`happyokai_have_you_react`, the tier picks the pool: `ippon` yes 「えっ！ ほんとうで ございますか！」, `good`
  no 「わたくしも ございません。なかまで ございますね。」, `flop` passed or out of time 「ひみつで ございますね。
  かしこまりました。」; a yes to the ghost topic gets `happyokai_have_you_ghost` 「…いま、見て いらっしゃいますよ。」).
  Yes or no is read with the phrasebook's test (ありません／ないです, or a bare いいえ). The card stays on the
  TV for 3 s (`HAVE_YOU_HOLD_MS`) with the presenter's caption and the answer in English ("Yes, I have!",
  "Never!", "It's a secret!"); if their answer never had the frame, the presenter's phone shows
  Chōchin-san's model answer (and keeps it under the question picker). Then the question-time line plays
  and the room's cards come out as usual. Until then the askers wait, so only one voice is heard, but
  their phones keep the stamp pad ("Chōchin-san is asking … a question first").
- The phrasebook gets **what the presenter said** (so the path credits the frames they used), from
  memory unless they peeked; if they never said the frame, Chōchin-san's model answer, seen.
- The topic is drawn at random each game from 12, all `draft`: 富士山に 登った, 納豆を 食べた, 幽霊を
  見た, かっぱに きゅうりを あげた, 一人で カラオケに 行った, 電車で 寝て、終点まで 行った, パジャマで 外に 出た,
  先生を 「お母さん」と 呼んだ, ユーフォーを 見た, サルと 温泉に 入った, 回転ずしで 二十皿 食べた, おばけ屋敷で
  泣いた. One a game is enough: the path counts at most two says of a frame a day.

Bots answer it yes or no with the frame, peeking first a quarter of the time. `npm run sim:yields`
(32 games): ＿た ことが あります went from 0 to 0.39 a game for an N4 seat in Happyōkai (the most it can be
is 0.5 in the four-seat room with two N4 seats, one card a game).

## Green Car (goals 3.2, 3.5, 3.6, 3.9; 4.3, 4.12)

When the room rides in the Green Car (`ctx.greenCar`: everyone N4 or N3), every talk is a deck talk. Nothing moved
out of mixed rooms: the N4 decks, the swap and Chōchin-san's card play there as before, and the three new decks
play only here.

- **Three N3 decks** (`DECKS`, `level: 'n3'`, `greenCar`, all `draft`), on the usual slides:

  | | What happened to me (ひどい 目に あった 話) | How it's changed (あれから) | If… (もしも…と したら) |
  | --- | --- | --- | --- |
  | Frames | suffering passive, ＿させられる; ＿ずに 〜ようと した (3.6) | ＿たびに, ＿うちに, ＿て いらい + ＿ことに して いる (3.6), ＿ぶり, ＿に つれて | ＿と したら |
  | Ready sentences | あの 日、〔word〕の 前で 〔topic〕に 泣かれて… (鳴かれて, all night, for an animal) / それから、〔topic〕に 〔word〕の 前で 歌を 歌わされました (or the title's own: 待たされ, 聞かされ, 飲まされ) / それで、〔word〕を 見ずに 逃げようと しました | 〔topic〕を 見る たびに、〔word〕を 思い出します / 今の うちに、〔word〕の 写真を… とって おく ことに しました / 〔word〕を 見て 以来、毎朝 早く 起きる ことに して います | もし 〔title's clause〕と したら、まず 〔word〕… / もし 〔word〕が なかったと したら… / もし この 〔word〕が 話せると したら… |
  | Kids | 弟の いたずら, うちの 猫の いたずら, かっぱと 行った 遠足 (+ 鬼コーチ in Kids and Family) | 何年ぶりの おばあちゃんの 村, うちの 猫が 大きく なるまで, たぬきが 町に 来て から (+ 新しい 学校) | 透明人間に なれる, 動物と 話せる, 妖怪の 友だちが いる (+ 空を 飛べる) |
  | Family adds | ツアーガイドの 田中さん, となりの おばさん | 十年ぶりの ふるさと, パパが ジムに 通い始めて から | 人生を やり直せる, 無人島に 住む |
  | Cheeky adds | 忘年会の 部長 (飲まされ), 合コンの 幹事 | 元カレと 別れて から, 新入社員の 一年 | 宝くじが 当たった, 元カノから 電話が 来た |

  The topic of a What happened to me title is who did it, so no line aims ＿くせに-style blame at anyone; the
  stinging frames aren't in these decks at all.
- **The pair.** Each presenter gets one N4 deck title (Then and now, If I were…) and one N3 deck title, no usual
  titles and no swap (`not-in-green-car`). An N3 presenter gets them in random order (their picks come out about
  half and half); an N4 presenter sees the N4 title first and the N3 one tagged **N3**, as stretch.
- **Aim the deal** (`greenPair`): within each level, the deck whose required frames (`DECKS[deck].aim`) the presenter
  needs most: `aimWeight` (tonight's earlier games, `ctx.frameNeed`) over this game's own says (`gcSaid`, counted
  from the deck credit, Chōchin-san's card said from memory, and questions asked aloud), averaged over the deck's
  frames; ties go to a random deck.
- **The question from the floor uses an N3 frame.** An N3 asker's first card is an N3 one (`level: 'n3'` in
  `QUESTIONS`: その とき、何を させられたんですか？, 逃げようと しなかったんですか？, 元気な うちに…, それ以来…,
  もし 一日だけ 〔word〕に なれると したら…), the talk's deck's own first, else one any talk can take (〔word〕を 見る
  たびに…, もし 〔word〕が 話せると したら…, もし 明日 何でも できると したら…), the one whose frames the asker needs
  most. An N4 asker gets it as their second card, tagged N3. Askers keep their own level here (not the lower of
  theirs and the presenter's).
- **Credit** is the deck rule above: a line of the presenter's own in a deck frame logs the deck's closest ready
  sentence, from memory, for the frames heard in it.
- **Bots** speak the N3 decks' frames on their own lines and answers (`tools/bots/policies/happyokai.ts`).

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
4. **The deck-title swap is once a turn, for either deck title, before ready** (for Ladi to confirm). It
   draws from the same usual pool as the title pairs, without the creature/people split; it costs
   nothing and changes no points. A swapped-in title plays as a usual talk.
5. **Place titles are back in Then and now with their own sentences** (for Ladi to confirm): 私の 町,
   おばあちゃんの 村 (every room) and 商店街の 復活 (Family and Cheeky). The news for a place slide is a new
   bus to it, so every place slide reads as a sentence; the absurd pairs are the joke. The balcony gets a
   festival instead (no bus runs to a balcony), and a place with its own verb says what you can do there
   now (海で 泳げる) rather than the bus.
6. **The place slides name their own verb** in Then and now (入れる, 登れる, 泳げる, 出られる, 泊まれる)
   instead of 一人で 行ける for all of them.
7. **The "Have you ever…?" card is Chōchin-san's, and the presenter answers it** (for Ladi to confirm), so
   the answerer's line is what counts, cued in English, and the asker isn't credited for reading a card.
   It goes to the first N4 presenter of the game (not every N4 talk: two a night already fill the path's
   daily cap), comes before the room's cards rather than among them (so it's always asked), and pays
   like a smaller question-time answer.

## Decided by Ladi

1. **N4 presenters sometimes get a usual title too** (was open question 1): their pairs alternate, a deck
   pair on their 1st, 3rd… talk and a mix (one deck title, from the other deck than last time, plus one
   usual title) on their 2nd, 4th… talk. Alternating per presenter is simple and even: everyone who
   presents twice sees both kinds, and nobody's deck practice depends on the dice. The question cards
   follow the chosen title's deck.

## Open questions

1. Fluent check of the "Have you ever…?" topics (`HAVE_YOU`), especially 電車で 寝て、終点まで 行った,
   回転ずしで 二十皿 食べた and the negative 〜ことは ありません.
2. Fluent check of the deck lines, especially the `use` verbs (引ける, 乗れる, 入れる, 登れる, 泳げる,
   出られる, 泊まれる), 毎日 〜と いっしょに いたいです, the moving and shop news lines, and the place lines
   (〔place〕は 前は 人が 少なかったですが、 and the bus news).

