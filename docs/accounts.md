# Optional sign-in and saved progress

Signing in is optional. It is never needed to join a game, open the stage or host. A signed-in player
keeps three things between game nights:

- **Yōkai cards.** Each kana they meet in Kana Yōkai Raid becomes a card in a Leitner queue (boxes of
  1, 3, 7, 14 and 30 days). Only a right answer from memory moves a card up: said, typed or drawn, not
  picked from options (design doc). A miss sends it back to tomorrow. A kana recalled right on **3
  different days** (in the player's own time zone) is *caught* and sealed with a 封印 hanko in their
  yōkai book. Each kana has its own yōkai, from the Raid's four and ten drawn for the book.
- **A saved phrasebook.** Every game's phrasebook (said, retried, missed or just seen) is saved too,
  up to 600 phrases, each in its own Leitner queue: said from memory moves it up a box, a retry or a
  miss brings it back tomorrow, seen only adds it. Kana Raid's kana stay yōkai cards, not phrases.
- **Scores from every game.** Each finished game's mode, date, score, place, player count and awards.
  My progress shows the best score per game and the last 30 games.

Decided by Ladi on 2026-10-28 (the Kana Raid saved-progress question in
[open-questions.md](open-questions.md)): optional sign-in, button under Join on the phone.

## On the phone

- **Join screen:** under Join, two quiet outline chips side by side: *Sign in to save* (pixel key) and
  *Host a game* (Pon). Join stays the one heavy button. Signed in, the first chip turns green and reads
  *Aki · Progress*. One status line under the chips holds notices ("✓ Signed in as Aki. Now join a
  room.", "You were signed out on this phone…") and *Not Aki? Sign out* when the typed name differs.
  On an invite link Host is left out and the sign-in chip takes the row. The typed room code and name
  survive the trip to the sign-in page. Chosen by the art panel on 2026-10-28 (all five picked it over
  top-corner chips, side-by-side tiles and a ☰ menu) after Ladi found the stacked buttons busy;
  reviews in `/mnt/project-files/sign-in/join-layout/`.
- **Sign-in page:** *Sign in with a passkey* (signed in before, on any phone the passkey syncs to) or
  *Create a passkey* with a name for the save. Cancelling is calm ("Cancelled. Nothing was saved.").
  On an http LAN address or a browser without passkeys the buttons are off and the page says why.
- **My progress:** four tabs: *Path* (the optional learning path and the sentence frames met so far,
  see [progressive-learning.md](progressive-learning.md)), *Yōkai cards* (review button with the number due, caught and met counts,
  the book), *Phrasebook* (the 200 most recent phrases with how each last went, and *Practise now* for
  the due ones) and *Scores*. At the bottom: *Sign out on this phone* and *Delete my saved progress* (asks
  first). Deleting also asks the phone to forget the passkey where the browser supports it.
- **Review:** one due card at a time (up to 12, about 3 minutes): type its sound in romaji (Hepburn or
  the usual variants: si, tu, hu, or the romaji the card shows, with long vowels single or doubled),
  or *I don't know*. Right answers count towards catching. The yōkai hops when you're right and drifts
  off when you're not; a catch stamps 封印 on the card and buzzes once.
- **Phrase practice:** one due phrase at a time: the English, *Show the Japanese* (with kana, romaji
  and *Hear it*), then *I said it* or *Not yet*. Self-graded, because a phrase said out loud can't be
  checked by typing, and a generous mark only costs the player.
- **Recap:** a signed-in player sees *✓ Saved to Aki's progress*. Kana Raid's recap note says the
  cards were saved, or that signing in keeps them.

## On the stage

In the lobby and the recap a *Phrasebook* button sits beside *⚙ Settings*. It opens a panel (ことば帳)
with a *Tonight* tab, every phrase from tonight's finished games (newest first, up to 300) with who
said it (✓) and who should practise it (↻), and one tab per signed-in player with their 40 most recent
saved phrases. Each card carries its game's pixel icon, and a phrase someone missed gets a もう一回 stamp. It reads `GET /api/rooms/:code/phrasebook` with the stage token each time it opens and
closes itself when a game starts. Watching screens don't show it. Tonight's list lives in the room
(`GameState.tonight`), so it works for everyone, signed in or not.

## On the phone

In the lobby and the recap a round book icon in the phone's header, beside the points and the mic
switch, opens *My phrasebook*: a sheet with *Tonight* (only the phrases this player said, ✓ *Said it*,
or missed, ↻ *To practise*, listed first with a もう一回 stamp) and, signed in, *Saved* (their 40 most
recent). Each card has kana, English, its game and *Hear it*; at かな the spaced kana leads, with the
kanji under it and romaji. Signed out, a note at the top says tonight's phrases go when the room closes.
During a game the icon stays where it is, dark with a key badge, and a tap says it opens after the game: mid-game it would pull eyes off the stage and work as a cheat
sheet for answers said from memory. A game starting closes the sheet.

## How it works

- **Passkeys (WebAuthn)** through SimpleWebAuthn, MIT ([commercial-blockers.md](commercial-blockers.md)
  row 34). No email, password or third-party login: nothing to send, nothing to leak, and kids can use
  the device's lock. Discoverable credentials, so signing in on a new phone needs no name. No
  attestation (we don't need to know the authenticator's maker).
- **Sessions:** a random token the phone keeps in `localStorage` (`kotoba:account`), sent as
  `Authorization: Bearer`. The server stores only its SHA-256 hash, for a year, up to 20 per save.
- **Challenges** are one-use and live 5 minutes; the challenge a response signed is looked up from its
  client data and used up.
- **Saving games:** a phone joins with its session token (`JoinRequest.account`). The room keeps it
  next to the seat (never in any view) and, when a game reaches its recap, sends each signed-in
  player's `GameResult` (`gameResults` in `shared/src/game.ts`, cards from `Mode.practice`) to the
  account service. An unknown or expired token is skipped. Signing in or out between games takes
  effect from the next game.
- **Where:** `server/src/accounts.ts` is one service for both runtimes. On Node it keeps saves in
  memory (a local `npm start` forgets them when it stops). On Cloudflare it runs inside one Durable
  Object, `AccountsObject` (binding `ACCOUNTS`, migration `v2`), which takes one request at a time.
- **Passkeys belong to a host name.** A passkey made on one address doesn't work on another. The
  Worker uses the address the phone actually opened (after the tanoshi.s.gy redirect), not
  `PUBLIC_URL`. Moving the game to a new domain means everyone creates a new passkey, so pick the
  final domain before many people sign in.

## API

All under `/api/account/`, JSON. See also [protocol.md](protocol.md).

| Method & path | Auth | Body | Returns |
| --- | --- | --- | --- |
| `POST register/options` | — | `{ name }` | `{ options }` for `navigator.credentials.create`; 400 `bad-name` |
| `POST register/verify` | — | `{ response, tz }` | `{ token, account }`; 400 `expired`, `not-verified` |
| `POST login/options` | — | `{}` | `{ options }` for `navigator.credentials.get` |
| `POST login/verify` | — | `{ response, tz }` | `{ token, account }`; 400 `expired`, `not-verified`; 404 `unknown-passkey` (its save was deleted) |
| `GET me?tz=` | Bearer | — | `{ account: { name, cards, due, games, bests, phrases, duePhrases, path, frames } }`; 401 `signed-out` |
| `POST review` | Bearer | `{ itemId, answer }` | `{ right, expected, card, caught }`; 404 `no-card` |
| `POST review` | Bearer | `{ kind: 'phrase', itemId, knew }` | `{ phrase }`; 404 `no-card` |
| `POST settings` | Bearer | `{ path: boolean }` | `{ account }`: the learning path's switch ([progressive-learning.md](progressive-learning.md)); 400 `bad-settings` |
| `POST signout` | Bearer | `{}` | `{ ok }` (ends this phone's session only) |
| `POST delete` | Bearer | `{}` | `{ ok, credentials }`: the save, its passkeys and every session are gone |

`tz` is the phone's `Date.getTimezoneOffset()`, used to tell which day a right answer falls on.

The stage reads `GET /api/rooms/:code/phrasebook` (stage token): `{ tonight, saved }`, where `saved` is
each seated, signed-in player's `{ playerId, name, phrases }` ([protocol.md](protocol.md)). A phone
can read it with its player token and gets only the `tonight` rows it said or missed, and only its own
save (`Room.phrasebookFor`). On
Cloudflare the room's Durable Object asks `AccountsObject` for them (`POST /phrasebooks`).

## Open questions

- **Privacy notice and children (before launch).** Saves are the game's first lasting personal data.
  We keep only the save name, scores and kana practised, and deletion is built in, but a public launch
  needs a privacy notice and a decision for under-13/16 players (COPPA, GDPR-K). Row 34.
- **Abuse.** Anyone with a passkey can make saves; nothing limits how many. Add Cloudflare Turnstile or a
  rate limit on `register/options` if junk saves show up.
- **One object for every account** is plenty for now (a few requests per finished game). Shard by
  account id if it ever gets busy.
- **Phones without passkeys** (old browsers, http LAN play) can't sign in. A typed "save code" could be
  a fallback if that turns out to matter.
- **More modes:** only Kana Raid adds cards today. Next: a saved phrasebook from every game (Ladi said
  yes, 2026-10-28), so phrases said, retried and missed in any mode become review cards too.
