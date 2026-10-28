# Optional sign-in and saved progress

Signing in is optional. It is never needed to join a game, open the stage or host. A signed-in player
keeps two things between game nights:

- **Yōkai cards.** Each kana they meet in Kana Yōkai Raid becomes a card in a Leitner queue (boxes of
  1, 3, 7, 14 and 30 days). Only a right answer from memory moves a card up: said, typed or drawn, not
  picked from options (design doc). A miss sends it back to tomorrow. A kana recalled right on **3
  different days** (in the player's own time zone) is *caught* and stamped 封 in their yōkai book.
- **Scores from every game.** Each finished game's mode, date, score, place, player count and awards.
  My progress shows the best score per game and the last 30 games.

Decided by Ladi on 2026-10-28 (the Kana Raid saved-progress question in
[open-questions.md](open-questions.md)): optional sign-in, button under Join on the phone.

## On the phone

- **Join screen:** under Join, *🔑 Sign in to save progress* with a one-line note ("Optional…"). Once
  signed in it becomes *✓ Saving as Aki · My progress*. The join name is filled from the save if empty.
- **Sign-in page:** *Sign in with a passkey* (signed in before, on any phone the passkey syncs to) or
  *Create a passkey* with a name for the save. Cancelling is calm ("Cancelled. Nothing was saved.").
  On an http LAN address or a browser without passkeys the buttons are off and the page says why.
- **My progress:** two tabs, *Yōkai cards* (review button with the number due, caught and met counts,
  the book) and *Scores*. At the bottom: *Sign out on this phone* and *Delete my saved progress* (asks
  first). Deleting also asks the phone to forget the passkey where the browser supports it.
- **Review:** one due card at a time (up to 12, about 3 minutes): type its sound in romaji (Hepburn or
  the usual variants: si, tu, hu), or *I don't know*. Right answers count towards catching.
- **Recap:** a signed-in player sees *✓ Saved to Aki's progress*. Kana Raid's recap note says the
  cards were saved, or that signing in keeps them.

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
| `GET me?tz=` | Bearer | — | `{ account: { name, cards, due, games, bests } }`; 401 `signed-out` |
| `POST review` | Bearer | `{ itemId, answer }` | `{ right, expected, card, caught }`; 404 `no-card` |
| `POST signout` | Bearer | `{}` | `{ ok }` (ends this phone's session only) |
| `POST delete` | Bearer | `{}` | `{ ok, credentials }`: the save, its passkeys and every session are gone |

`tz` is the phone's `Date.getTimezoneOffset()`, used to tell which day a right answer falls on.

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
