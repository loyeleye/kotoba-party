# Bento Haus (おべんとうハウス), backlog

Host: Pon. Kana–N4. Two ways to play: **Co-op** (1–8 players, one kitchen) and **VS** (4–8 players,
two kitchens racing for the same customers; see [Bento Haus VS](#bento-haus-vs)). Pon runs a late-night bento shop for
yokai. A customer's order rings one player's phone; that player calls each thing out loud to the
kitchen, the phone holding that food reads the ticket back and sends it, and the order-taker serves
the box. Tips fill the tip jar for the whole team.

Code: `shared/src/modes/bentoHaus/` (rules and views in `bentoHaus.ts`; foods, counters, customers,
riddles and lines in `menu.ts`), `stage/src/modes/bentoHaus.{ts,css}`,
`controller/src/modes/bentoHaus.{ts,css}`, `tools/bots/policies/bentoHaus.ts`,
`tests/bentoHaus.test.ts`; the N4 hard roles in `shared/src/modes/bentoHaus/hardRoles.ts` and
`tests/bentoHausHard.test.ts`. Design: the Bento Haus and Narabe! design doc (v0.2) and its panel
reviews. The co-op kitchen that has to talk is the idea of Overcooked; nothing else is borrowed (see
[commercial-blockers.md](../commercial-blockers.md) row 12).

## Why it works for speaking

Only the order-taker's phone shows the order, and only the right shelf can make each food, so the
order has to travel by voice: hear it (the words fade after 6 s for N5 and up; 🔊 replays it), say it
to the kitchen (「いなりを みっつ、おねがいします！」), hear it back (「はい、いなり みっつですね！」).
Counting is the target: つ in shift 1, then each food's own counter (〜ほん, 〜まい, 〜こ) with its
sound changes (いっぽん, さんぼん). A call that doesn't come through costs time, never points.

## How a game goes

Three shifts. The intro (14 s) explains it. Each shift:

1. **Next shift** (`prompt`, 8 s). The TV shows the shift's name and tonight's menu; each phone gets
   its shelf (the menu dealt out round-robin).
2. **Open!** (`answer`, 90 / 100 / 110 s, one phase; customers come and go on timers inside it).
   - A customer arrives every few seconds while a seat at the counter is free (1–3 seats, by players
     and shift). Each order rings one player (round-robin), whose phone shows it; the TV shows the
     customer, a line, a patience bar and the empty box, never the order.
   - **Call** (order-taker): say or type 「〜 ふたつ、おねがいします！」, or tap a food and a count.
     The call is parsed from the speech server's reading (with fixed spellings for kanji it misreads,
     like 唐揚げ). Each food heard becomes a ticket on the phone holding it; a call with a food but no
     number comes through as static (ザザッ).
   - **Ticket** (station): read it back (bonus), then できました！ sends it into the box. A static
     ticket can ask 「いくつですか？」.
   - **Serve** (order-taker): toss anything wrong (🗑), then 「おまたせしました！」 serves. Tips:
     perfect 3, close 2, off 1; a customer whose bar runs out leaves with nothing (💨).
   - **Pon's mischief**: once a shift he disguises himself as a missing food (ばけた, a dashed tile:
     the box is one thing short); on the third send he eats one thing (あじみ).
   - Last orders 20 s before close (a chime); served and walked-out customers keep their seat 2.6 s.
3. **Closing time** (`score`, 12 s). Stars (0–3) from tips, the orders with their tips, and the pay:
   every tip is 50 points for everyone, plus a capped personal bonus for calls said out loud,
   read-backs, asking again and serving.

**Shifts.** ① ランチラッシュ: plain orders, つ counting. ② なぞなぞちゅうもん: some orders are
riddles (「かっぱが だいすきな みどりの やさい」) or change their mind mid-order (「みっつ… やっぱり
ふたつ」), and each food takes its own counter. ③ ラッシュアワー: いそいで！ customers pay double, and
more sit at once. Solo players get 1.4× patience.

**Customers** (10 yōkai, pixel busts in three moods, with rules): the one-eyed boy wants one of each, the kappa always wants
cucumber, the snow woman nothing hot, the kitsune on a date exactly three inari, and so on.

**Recap.** A team game: the recap shows the team's points together, not a podium.

**Awards.** こえかけ賞 (most calls said out loud), おへんじ賞 (most read-backs), かんぺき賞 (most
perfect boxes served).

**Music and sound.** Kawai Kitsune (shift theme) and Feelin Good (second theme), Kevin MacLeod, CC BY
4.0; under the shift the music sits low so calls are heard. The TV plays synth effects for the shop
(a phone trill when an order rings, a ticket tick, a send, the counter bell and a bell per tip, a
toss, a sigh when a customer leaves, static, Pon's ドロン and もぐもぐ, a last-orders chime) and bells in
the track's key for the stars. Phones buzz when they ring and when a ticket lands. Pon waits 7 s
between lines so he doesn't talk over the calls.

## Hard roles (N4)

From the N4/N3 doc's hard roles, step 2. Co-op only; they ride on the same shift. A room with no N4
player never sees them (no state, no view fields; the host stand-in below is the one exception). All lines
are draft, in kana, and tagged by name with the N4 frames they practise (`hardRoles.ts`).

- **Offers.** At each shift's title card, the room's N4 players are offered a role on their phone, on the
  shared offer card (`controller/src/components/roleOffer.ts`): two equal buttons, Take it (やります) or Not
  this time (こんかいは いいです: the ordinary part). One deputy manager seat a shift, for the N4 player the
  shared `nextOfferee` picks (`hardRoleLog.ts`): fewest offers of the seat so far, then the one offered
  longest ago; a player who declined the seat last shift sits this one out; in a room of 4 or more, nobody
  holds it two shifts running. Every other N4 player is offered the おもてなし shift. So a lone N4 player in a
  room of 1–3 is offered the seat every shift (おもてなし after a decline), and in a room of 4 or more every
  other shift (for Ladi to confirm: before round 4 a lone N4 player alternated in every room). A declined
  seat passes for that shift to the next N4 player (Ladi, 2026-11-01), now picked by `nextOfferee` among
  those not yet offered the seat this shift and not already on the おもてなし shift, as a new logged offer;
  that player's still-open おもてなし offer is withdrawn (unanswered, so never counted), so the phone shows
  one choice at a time. Once nobody is left to ask, the seat stays empty. The offer stays open into the
  shift, below the order and call box. Every offer and its answer is kept in mode state (`hard.offers`) with
  the shared offer log's answers: accepted, declined, timeout (still open at closing time) or away (the
  player left with it open). Gate = accepted ÷ (accepted + declined + timeout), per game; away is left out
  (`offerStats().rate`).
- **Deputy manager (📋 ふくてんちょう)**, goals 4.1 and 4.9. Pon is busy "tasting" (his words), so
  complaints and special orders come to this player. While holding the seat they take no ordinary orders:
  the customers they'd have taken go to the other players in turn (open question 10, decided for Ladi
  2026-11-01, for Ladi to confirm). Alone in the room, they still take every order. They keep their shelf and
  are still sent tickets. Incidents come one at a time, for 30 s each:
  - a **complaint**: a box served with something off (not Pon's disguise). The deputy manager says sorry and
    asks the customer to wait (「もうしわけ ございません。すこし まって いただけますか。」, or
    「もうしわけ ございません。しょうしょう おまちください。」), then asks the station that holds the food
    (「からあげを もう ひとつ つくって もらえますか。」, or 「おべんとうを つくりなおして もらえますか。」 when
    there's too much of something).
  - a **special order**: every third customer while the deputy manager is free (no wasabi, warm it up, a big
    helping of rice, chopsticks, sauce on the side; the influencer wants a cuter box; the baku wants a
    dream, which the shop can't do: もうしわけ ございません and 「おにぎりに して いただけますか。」).
    The deputy manager answers the customer (かしこまりました。〜て いただけますか, or かしこまりました。
    しょうしょう おまちください), then asks the station (〜て もらえますか, or 〜て くれませんか).
  The station gets a 📋 card with the deputy manager's line and taps はい、できました！; a missing food goes
  into the box on the TV and the customer thanks the shop (Pon cheers: `bento_manager_win`).
  - **Winning back tips.** A complaint's fix that lands (the station taps できました！) wins back half the
    tips the box lost against a perfect one, rounded up, for the whole team: a one-thing-off box (2 of 3)
    gets its 1 back, a sloppy one (1 of 3) gets 1 of its 2, a rush order's 2 of 6 gets 2 of its 4 (Ladi's
    later list, 2026-11-01: "say half"; rounding up is for Ladi to confirm). The TV's desk shows +N 💰. A
    special order loses nothing, so it wins nothing back; a missed fix wins nothing.
  - **Need the words?** opens by itself on the deputy manager's first incident of the game (both lines),
    so a first-timer sees the model lines. Lines read off it before their first try are logged as seen, as
    before (for Ladi to confirm: the first incident's lines then count as seen, not said).
- **おもてなし shift** (was Ryokan Front Desk), goals 4.7 and 4.9. A variant of the order-taker's job:
  each guest this player takes has a strip on the order card. Seat them (おすわりください /
  おまちください), then answer their question: turn a house rule down with ＿は ごえんりょ ください
  (pets for anyone; smoking and calls from Cheeky customers only, photos of other guests from the
  influencer, sleeping in the shop from the baku and the tanuki cub), never ＿ては いけません, or
  say it's ready with ＿は よういして あります (chopsticks, a hand towel, cold tea, a booked seat). Once the
  answer lands the guest replies with a short line on the TV (「あ、そうですか。わかりました。」,
  「よかった！　ありがとう。」; draft). The guest gives a star for each line said right and one for being
  served (0–3); the TV shows a 🌸 tag, the question once seated, the reply, and the stars as they go;
  closing time adds the shift's おもてなし stars. Both lines right: Pon cheers (`bento_omotenashi_win`,
  inside his usual 7 s gap, so he may stay quiet in a rush).
- **Checking.** Each line is checked for its frame (and for the thing named, so the station knows what
  is needed), on the speech server's reading. The phone's input shows the frame (「〜て いただけますか」,
  「＿は ごえんりょ ください」), not the line; the line is under "Need the words?", and a line whose words
  were opened before its first try goes in the phrasebook as seen, not said. A miss gets a private hint on the speaker's phone
  (「〜て もらえますか is for your own kitchen」, 「never 〜ては いけません」) and they can try again or skip;
  only lines said right reach the TV.
  - **Accepted forms.** To the customer: 〜て いただけますか / いただけませんか, or (at the ask step, and at a
    complaint's sorry step, which asks them to wait) しょうしょう おまちください (お〜ください). To the kitchen:
    〜て もらえますか, 〜て くれますか / くれませんか, or 〜て いただけますか (too polite for your own kitchen,
    but not wrong).
  - **Credit only the frames used.** A line accepted in another form goes in the phrasebook (and on the TV
    and the station's card) as the model line in that form, with its own item id: a kitchen line said with
    くれますか is logged 「〜て くれますか。」 (te-kuremasen, not te-moraeru); with いただけますか,
    te-itadakemasen; an ask said with おまちください, 「かしこまりました。しょうしょう おまちください。」 (o-kudasai,
    not te-itadakemasen). Always a fixed line, never the player's own words.
- **Pay.** A line said right earns the speaker a speaking bonus (20 out loud, 8 typed) from the same
  capped pool as Co-op's other bonuses, and goes in their phrasebook. Team tips are as before, except the
  tips a deputy manager's fix wins back.
- **Not built:** N3 lines (step 6), bots taking the roles, and VS (left unchanged).

### Mixed rooms

The shared pieces in `shared/src/modes/mixedRoom.ts`, Bento's way. Nothing changes for Kana or N5 players'
points, turns or tiles except the curveball's +5, and nothing here adds time: it all runs inside the shift (or
the title card).

- **Commentary booth.** Once a shift, when the deputy manager's first line to a customer lands (the sorry
  or ask step said right), the TV shows a 📺 REPLAY strip under the counter for 5–7 s (`commentaryMs`): the
  line with its key word lit (いただけますか, or おまちください), and one line of English colour about the
  play. Pon voices the fixed line it was credited as (`bento_replay`, bank only, `{line}`), never the
  player's words. Kana and N5 phones get the gist (「ごめんなさい。ちょっと まって ください。」 and plain
  English, romaji for Kana). A skipped or missed line gets no booth.
- **Gallery.** At the same moment, every other connected phone gets one tile for the shift, for 12 s
  (`GALLERY_MS`): four reactions (すごい！ なるほど えっ？ あはは), shown on the TV as bubbles, never scored.
  Once a game, the first Kana or N5 player's tile is the curveball instead: "Which word did you hear?", the
  line's key word and two other request endings (もらえますか, くれませんか, おねがいします…, never one in the
  line), +5 to their score if right. Bots can't be told apart from players in the mode, so a bot gets a
  tile too (it never taps it).
- **Host stand-in.** In a room of 1–2 connected players with nobody at N4 (`hostStandsIn`), on the first
  shift's title card, 1.5 s in: Pon plays the deputy manager for one line. The TV shows the customer's ask
  (「おべんとうを あたためて ください。」) and Pon's answer lit (「かしこまりました。こちらで すこし まって
  いただけますか。」, `bento_standin`, bank only, with its subtitle); Kana and N5 phones get the gist. Nobody is
  asked to say anything; no points; once a game, under 7 s, inside the 8 s title card.

## Not built yet

- Customer voices, and animated customers (the sprites are still busts in three moods).
- Patience that pauses while someone is mid-sentence.
- Stock-outs, positions and cooking steps.
- VS: the customer role for 5 or 7 players (one player reads the order to both kitchens; for now
  the teams are one apart), the character-bento round, and the soft catch-up (the team behind is
  offered the next rush order first).

## Bento Haus VS

Code: `shared/src/modes/bentoHaus/bentoHausVs.ts` (mode `bento-haus-vs`), the VS parts of
`stage/src/modes/bentoHaus.ts` and `controller/src/modes/bentoHaus.ts`, `tests/bentoHausVs.test.ts`.
Each team is a whole Co-op kitchen; the two share only the customers.

- **Teams.** あかチーム (red, a noren crest) and あおチーム (blue, a wave crest), dealt at the start by level (strongest first, snaking
  A B B A), so each gets a similar mix of Kana, N5 and N4; kept for the game. Anyone who joins later
  goes to the smaller team. 4–8 players; with 5 or 7 the teams are one apart.
- **Kitchens.** Both have the same menu, spread across each team's own phones. A call only makes
  tickets in your own kitchen, so you call your own team.
- **Customers.** Each customer phones both kitchens at once with the same order (a Kana order if
  either order-taker is Kana), one order-taker per team, round-robin within the team. Seats at the
  counter are counted from the smaller team, as in Co-op.
- **First served wins.** The first box served gets the customer's tips (3 / 2 / 1, doubled for a rush
  order). The other kitchen's box goes as a わけあり bento: 1 tip if it has anything in it, so the
  effort is never wasted. A box can't be served empty. Moves on a customer who has gone come back
  "too late". A customer who runs out of patience leaves both kitchens (わけあり 1 tip each for a
  part-filled box).
- **Mistake meter (ミス).** Each kitchen has one, shown on the TV beside its tip jar and on its
  phones' team bar. A sloppy box fills it: +10 with one thing off, +25 with two, +40 worse; a perfect
  box (or Pon's disguise) adds nothing. It empties at the start of each shift. When it reaches 100,
  that box is sent back: the customer asks for a refund (its tips are taken back, 0) and the meter
  empties.
- **Sent-back orders.** The customer then phones the other kitchen with the order changed a little
  (one food's count up or down by one; no riddles, no rush), and Pon calls it out
  (`bento_vs_sendback`). That kitchen's next order-taker has 25 s to accept (うけます) or refuse
  (ことわります); no answer is a refusal. Accepted, they have 35 s: a perfect box earns 5 tips,
  anything else 0 (no わけあり). It never fills the meter. It isn't offered to a kitchen already 8 or
  more tips ahead over the game, or within 25 s of last orders.
- **Pay.** Each tip is 50 points to everyone in that kitchen, plus the same capped speaking bonus as
  Co-op. The shift goes to the kitchen with more tips (Pon names it; a tie is a draw).
- **TV.** One counter: each customer once, picture and name beside their line (no English name, to
  keep the card short enough to show at full size), with a red and a blue box filling side by side
  under them. Each box has a solid team tab with its order-taker. The served box gets the lid, then
  a gold ring, then 「〜が さき！」; the other box fades and gets a わけあり paper sticker. A sent-back
  box gets a へんきん (refund) sticker; a sent-back order shows only the kitchen it's offered to, with
  a 🔁 banner (うけますか？ / ぴったりなら +5). One lane per team above the counter: tip jar, mistake
  meter and the last two calls. Pon's taste test names the team. Closing time names the shift's
  winner beside both jars (the winner's ringed) and shows each order's tips for both teams. Player
  tiles sit red then blue, with a team band along the bottom, and Pon's row keeps one height during a
  shift so the counter doesn't jump when he talks. With three at the counter the bubble's English goes.
- **Phone.** The Co-op kitchen, with a team bar (your team, this shift's tips with yours first, your
  mistake meter). An order you took ends with a short note: your team served first, the other did
  (わけあり +1), or it was sent back; it buzzes short for a win and long for a loss. A sent-back
  order on offer shows うけます / ことわります; once accepted, the order card says it's perfect or
  nothing. The order card shows how full the other team's box is (a slot per food), each ticket says
  which customer it's for (and a 🎫 pill jumps down to them), a ticket voided because the other team
  served first says so, and serving a lost customer says the other kitchen served first. The team
  bar adds the game's totals from shift 2. Closing leads with whether your team won, then both teams' tips, and buzzes when the TV
  stamps the result.
- **Sound.** Red's sounds come from the left speaker and blue's from the right, the わけあり box gets
  a low thunk just after the serve, a sent-back box a falling sting. The shift winner gets their own jingle from their side (taiko for
  red, bells for blue), a draw gets its own, and a close race (3 tips or fewer apart) gets a quiet
  heartbeat under the last 20 seconds. Art: PixelLab team crests, the lacquer lid, the わけあり sticker,
  the へんきん stamp and Pon waving both flags (see [graphics.md](../graphics.md#bento-haus)).
  Pon names the order-takers only for the shift's first customer, so he doesn't talk over them.
- **Recap.** A team line above the podium (each team's shifts won and tips, the winner ringed; the
  phone leads with your team's result), then a podium of players (teammates tie, and ties stand
  level). After the last shift Pon crowns the game's champions (`bento_vs_final`) instead of naming
  the shift's winner. はんじょう賞 goes to the kitchen with the most tips, beside the Co-op awards.
- **Music.** The same two themes the other way round: Feelin Good opens the shifts, Kawai Kitsune is
  the second theme. Across both modes a screen plays whichever of the two the last Bento game didn't.
  Last orders rings twice when the teams are within 3 tips.

## Open questions

1. Is a 90–110 s shift the right length with real speech recognition on real phones?
2. Should patience pause while the order-taker is talking?
3. Is the personal bonus cap right, or does the team pay drown it out?
4. Kana players see pictures of the order: enough, or should they also get romaji?
5. Pon's disguise and taste-test: funny, or frustrating in a rush?
6. VS: is first-served-wins right, or should a perfect box beat an earlier sloppy one? (The mistake
   meter now punishes a run of sloppy boxes; Ladi kept the わけあり tip for the slower box, 2026-10-28.)
7. VS: are the meter steps (+10 / +25 / +40), the 5-tip sent-back order and the 8-tip lead limit
   right, once played?
8. ~~Hard roles: should a deputy manager's fix win back a tip?~~ Decided by Ladi, 2026-11-01: a fix that
   lands wins back half the tips the box lost (rounded up, for Ladi to confirm). Should the おもてなし stars
   pay the team too? (For now they don't.)
9. ~~Hard roles: does a declined deputy manager seat stay empty for the shift?~~ Decided by Ladi,
   2026-11-01: it passes to the next N4 player in turn for that shift, each pass a new logged offer; it
   stays empty only once every N4 player has declined it (see Offers).
10. ~~Hard roles: is a special order every third customer, and 30 s on the desk, too much on top of a
    deputy manager's own orders?~~ Decided 2026-11-01 (Ladi's later list): the deputy manager stops taking
    ordinary orders while holding the seat, unless they're alone in the room. Is every third customer now
    too few, with their hands free?
12. Mixed rooms: is once a shift right for the booth and the Gallery, or should every landed line get its
    replay? Do players at their stations have a hand free to tap a reaction mid-rush?
11. Hard roles: should the kitchen line accept 〜て いただけますか too (it does now: too polite for your
    own kitchen, but not wrong)?

## Decisions

- 2026-11-01 (Ladi): a declined deputy manager seat passes to the next N4 player for the shift (open
  question 9); since round 4, "next" is the shared `nextOfferee`.
- 2026-11-01 (Ladi's later list): a complaint's fix that lands wins back half the tips the box lost,
  rounded up (rounding up: for Ladi to confirm). Specials win nothing back.
- 2026-11-01 (Ladi's later list): the deputy manager takes no ordinary orders while holding the seat;
  alone in the room, they keep taking them (open question 10).
- 2026-11-01 (Ladi's later list): "Need the words?" opens by itself on the deputy manager's first incident
  of the game; those lines are then logged as seen (for Ladi to confirm).
- 2026-11-01 (Ladi's later list): guests reply with a short line once a decline or よういして あります line
  lands; the ask step (and a complaint's sorry step) accepts しょうしょう おまちください, tagged o-kudasai.
- 2026-11-01 (Ladi's later list): only the frames actually used are credited: a line accepted in another
  form is logged as the model line in that form (くれますか: te-kuremasen; いただけますか: te-itadakemasen;
  おまちください: o-kudasai).
- 2026-11-01 (decided for Ladi, for Ladi to confirm): the seat's offers follow the shared `nextOfferee`, so a
  lone N4 player in a room of 1–3 is offered the seat every shift (おもてなし after a decline) instead of
  alternating.
- 2026-11-01 (decided for Ladi, for Ladi to confirm): the booth and the Gallery come once a shift, on the
  deputy manager's first landed line to a customer; Gallery tiles stay 12 s; the curveball's key word is
  the line's ending (いただけますか or おまちください).
- 2026-11-01 (decided for Ladi, for Ladi to confirm): the host stand-in is the warm-up special's polite ask,
  1.5 s into the first shift's title card.
- 2026-11-01 (decided for Ladi, for Ladi to confirm): Pon cheers every request done (even inside his 7 s
  gap); his おもてなし cheer keeps the gap.
