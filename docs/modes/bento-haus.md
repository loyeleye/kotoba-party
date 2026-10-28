# Bento Haus (おべんとうハウス), backlog

Host: Pon. 1–8 players. Kana–N4. Co-op (a VS version is next). Pon runs a late-night bento shop for
yokai. A customer's order rings one player's phone; that player calls each thing out loud to the
kitchen, the phone holding that food reads the ticket back and sends it, and the order-taker serves
the box. Tips fill the tip jar for the whole team.

Code: `shared/src/modes/bentoHaus/` (rules and views in `bentoHaus.ts`; foods, counters, customers,
riddles and lines in `menu.ts`), `stage/src/modes/bentoHaus.{ts,css}`,
`controller/src/modes/bentoHaus.{ts,css}`, `tools/bots/policies/bentoHaus.ts`,
`tests/bentoHaus.test.ts`. Design: the Bento Haus and Narabe! design doc (v0.2) and its panel
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

## Not built yet

- Customer voices, and animated customers (the sprites are still busts in three moods).
- Patience that pauses while someone is mid-sentence.
- Stock-outs, positions and cooking steps.
- The VS version (two kitchens) and its character-bento round.

## Open questions

1. Is a 90–110 s shift the right length with real speech recognition on real phones?
2. Should patience pause while the order-taker is talking?
3. Is the personal bonus cap right, or does the team pay drown it out?
4. Kana players see pictures of the order: enough, or should they also get romaji?
5. Pon's disguise and taste-test: funny, or frustrating in a rush?
