# Open questions and decisions made on Ladi's behalf

Every call Claude made without asking goes here, so Ladi can review them in one place.
Each entry says what was decided, why, and what would change it. Mark an entry **OK** to accept
it, or write your answer under it and the next build pass will act on it.

Sections: Phase 0 (multiplayer), Content, AI and voice. Threads add to their own section.

## Phase 0 (multiplayer)

1. **Repo layout: one root package, no workspaces.** One `package.json` and `tsconfig.json` at
   the root; server, stage, controller, shared, content and tools import each other by relative
   path. Simplest thing that shares types across all of them. Revisit if a part needs its own
   release cycle.
2. **Level names are lowercase: `kana`, `n5`, `n4`.** Agreed with the content and AI threads so
   the three line up.
3. **IPPON means every voter except the author picked the answer, with at least 3 such voters.**
   The design doc says "every other voter"; the author can't vote for themselves, so they're
   left out of the count. The bonus is +200 (doubled in the last round, like everything else).
   The 200 is a guess; tune it in Phase 1 playtests.
4. **Points:** 100 per vote, last round doubled. Speaking bonuses (capped at 30%) arrive with
   speech in Phase 3.
5. **Room codes use 20 consonants only** (`BCDFGHJKLMNPQRSTVWXZ`): no vowels means no
   accidental words, and dropping I/O/U/Y avoids 1/0/V mix-ups. 160,000 codes.
6. **New players can join only in the lobby.** Held seats can come back any time. Joining
   mid-game would arrive with audience mode (design doc: up to 8 audience members).
7. **A dropped phone doesn't hold up the round.** The answer and vote phases end early once every
   *connected* player is in; a dropped player can still answer when back if the phase is open.
8. **A reveal with no answers is skipped** straight to the encore.
9. **A reloaded page finds its seat by saved token, or by its anonymous device id alone.** Someone
   who copied another phone's device id could take that seat; acceptable for a party game.
10. **Answers can't be edited once sent** (matches "say it to send it").
11. **Names are unique per room, ignoring case**, 1 to 12 characters.
12. **The stage can also start, skip and play again**, not only the VIP. Useful on the debug
    stage; should the real stage keep these buttons in Phase 1?
13. **Rooms close after 10 minutes with nobody connected.**
14. **Default phase lengths:** intro 8 s, prompt 4 s, answer 60 s, vote 30 s, encore 6 s,
    score 6 s. Placeholders until Phase 1 pacing work (target: Oogiri Night under 18 minutes).
15. **QR join URL:** uses `PUBLIC_URL` when set; on localhost it swaps in the machine's LAN IP so
    a phone on the same Wi-Fi can scan it.
16. **Hosting is undecided.** The server is one Node process with static pages, so Fly.io,
    Render or a small VM all work. Which do you want, and on what domain?
17. **Phase 0 debug prompts** (`content/debug/prompts.json`) have Japanese subtitles that no
    fluent speaker has checked. They are throwaway and will be replaced by Phase 1 packs.

## Content

(The content thread adds its questions here.)

## AI and voice

(The host voice thread adds its questions here.)
