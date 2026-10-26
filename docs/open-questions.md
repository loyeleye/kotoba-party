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

The biggest open item first, then the rest grouped by area. All content is marked
`status: 'draft'` until a fluent speaker has checked it.

### Needs Ladi

C1. **Who does the fluent-speaker check, and when?** The design doc says a fluent speaker checks
    every pack and host line before it ships, and the Phase 1 gate depends on it. Nothing here has
    had that check. Suggest one native reviewer pass over the food, family and travel packs, the
    Phase 1 Last Train minigames (Konbini Math, Meet the Innkeeper) and Pon's lines before the first
    game night (about 1,000 short items; the puns flagged below first). Who should that be?
C2. **Photo Caption needs photos.** The 24 photo prompts describe a funny photo (Bokete-style) but
    there are no images yet. Options: commission simple illustrations, licensed stock, or generated
    images. Recommend commissioned or generated illustrations in the show's art style, since
    stock photos of real people raise consent and tone issues.
C3. **Voice casting.** `hosts/profiles.ts` names VOICEVOX characters to audition for each host.
    Each voice's commercial-use and credit terms need checking before we pick.

### Shape and conventions

C4. **Content types live in `content/src/types.ts`**, not `shared/` (agreed with the Phase 0
    thread). The engine imports everything from `content/src/index.ts`.
C5. **Every Japanese string carries its own kana reading** (`JpText.kana`), which is what TTS voices
    and what the answer checker compares. `npm run content:readings` cross-checks every reading
    against the kuromoji dictionary: 161 of 882 kanji texts differ, and every one was reviewed by
    hand and is a dictionary miss (counters and numbers read digit by digit, 一日 as いちにち,
    行き as いき, 何と as なにと, made-up place names).
C6. **The `tai` tile form is stored bare** (食べたい), and prompts add です around the blank where
    they need it. Masu forms and adjective forms are polite (おいしかったです).
C7. **Only some verbs have a `te-kudasai` form** (all food verbs, three travel verbs, no family
    verbs), but two Photo Caption frames and one travel prompt want a て-form. Recommend adding
    `te` forms to every verb in a follow-up so the tile builder never has to conjugate.
C8. **Blanks can take more than one tile** (example answers like ゾンビの えいが combine tiles and
    particles). The tile builder should allow several tiles plus typed particles per blank.
C9. **Slots in host lines are written with braces** (`slots: ['{name}']`). `{award}` takes the
    award's `name.kana` and `{stop}` the stop's `name.kana`. A slotted line can't be fully
    pre-rendered; the voice pipeline either splits around the slot or voices the name live.

### Kana Yōkai Raid

C10. **231 kana:** 46 basic pairs, 25 voiced pairs, small っ/ッ, ヴ, 33 combination pairs, ー and
     19 special katakana (ファ フィ フェ フォ ティ ディ トゥ デュ ウィ ウェ ウォ シェ ジェ チェ ツァ
     ヴァ ヴィ ヴェ ヴォ). ぢゃ/ぢゅ/ぢょ are left out as too rare. Add or trim special katakana?
C11. **Same-sound kana:** お/を, じ/ぢ and ず/づ are one sound in the kana check (`homophoneIds`).
     **Should Shout accept ぶ for ヴ (and ば for ヴァ)?** Most speakers say them that way. I listed
     them as `confusableSounds`; recommend accepting them instead.
C12. **Chapter leaders are real folklore yōkai** with a one-line source each (からかさ小僧, 河童,
     猫又, 天狗, ろくろ首, 一反木綿, のっぺらぼう, 雪女, 座敷童子, 鬼, 狐, 鵺, 雲外鏡), per the
     story review. 提灯お化け is left for Chōchin-san.
C13. **Memory cards are original** and cover the 46 basic hiragana only; katakana cards come next.
     They avoid the published Tofugu pictures.
C14. **14 minimal pairs** for the Long and Short wave (おばさん/おばあさん, きて/きって, ビル/ビール,
     ちず/チーズ, しゅじん/しゅうじん, きねん/きんえん, てんき/でんき …). Some words (囚人, 作家) are
     above N5; they're for hearing the contrast, not for learning the word.
C15. **25 boss words** from menus, stations and shops; each boss's chapter is computed from its
     hardest kana.

### Topic packs and Oogiri Night

C16. **Three packs: food (73 words, 18 phrases), family (75, 17), travel (80, 20)**, each with
     50 prompts (36 Head to Head, 8 Photo Caption, 6 IPPON). Every prompt has an n5 and a kana
     version; 33 have an n4 version. Travel hit the 80-word cap; should travel split into two packs
     (getting around, staying over) later?
C17. **N4 grammar band.** The linter flags たら, ば, ては いけない, られる, そう and
     あげる/くれる/もらう in kana and n5 text; none remain. Treated as N5: て-form, 〜ないでください,
     〜てもいいですか, 〜ませんか, plain form + noun clauses, 〜て います. N4 grammar appears only in
     n4 versions. Speaker colons (兄：「…」) are used instead of と言う.
C18. **Some N5 prompts use everyday words that aren't on community N5 lists** (改札, 終電, ICカード,
     冷蔵庫, お会計, 会議, 実は). They have furigana and English, and travel ones are tagged
     `beyond-n5-list`. Keep, or swap for list words?
C19. **Baseline words** (10 per pack, for the delayed spoken test) are never used as tiles, and the
     food and travel packs also keep them out of all prompt text. Family keeps them out of tiles
     and prompts too. A cross-pack check is still needed (a word held back in one pack may be
     taught by another).
C20. **Stereotype words:** family and travel each have one (にんじゃ / 忍者, flagged, swerve-only,
     never in an example answer); food has none.
C21. **Swerve variety:** travel leans on かっぱ (27 of 50 prompts) and たこ (26). The engine should
     avoid dealing the same swerve twice in a game; the next content pass should spread them out.
C22. **住む** is in the family pack per the brief, but 住みます is rarely natural (住んでいます is).
     Swap it for another verb, or add a `te-iru` form?
C23. **Pitch accent** is filled in only where the writer was sure (12 travel words). The phrasebook's
     pitch line needs a reviewer pass or a licensed accent dictionary.

### Last Train

C24. **8 minigames, 135 items:** Konbini Math (25) and Meet the Innkeeper (20) for Phase 1; Station
     Announcement, What Time?, Order Up, Counter Chaos, Particle Panic and Calendar Crunch (15 each)
     for Phase 4. The other 9 of the 17 designed minigames come later as content.
C25. **3 scenarios**: the Chōchin Line (Phase 1 minigames only; twist: the train is inside
     Chōchin-san's lantern), the Obake Line (ghosts ride free) and the Hoshimidai Line (the last
     train turns out to be the first train of the morning). 10 Platform Dash items each.
C26. **Accepted answers lean generous** (with/without です, えん, ぜんぶで, a leading すみません;
     both しちじ/ななじ, じゅっぷん/じっぷん, はちじゅっさい/はちじゅうさい). Left out on purpose:
     いっせんえん, はちひき, なぬか and さんふん. Plain greetings (おはよう) are not
     accepted for the innkeeper but are in the Platform Dash. Too strict, or right?
C27. **Particle Panic** accepts the whole sentence or just the particle, and both へ and に for
     "go to". A one-sound answer is the recogniser's weakest case (language review), so the
     whole-sentence answer should be encouraged in the prompt UI.
C28. **Station Announcement must play the audio before showing the text**, or the text gives the
     answer away. The server needs to honour the item's `visual` note.
C29. **TTS needs the supplied kana** for 行き (ゆき in announcements), the made-up stops 港口
     (みなとぐち) and 星見台 (ほしみだい), and should skip or chime over ＿＿＿.

### Hosts

C30. **466 written lines** (Pon 188, Fude 139, Chōchin-san 139), all in kana so they suit
     kana-level players. The design target is about 30 lines per event per host; Pon has 8 per
     event and 12 per reveal tier, the others 5 and 8. The AI host fills the gap from Phase 2.
     Should N5 players see kanji versions later?
C31. **Puns and coined award names need a native check**: ふとんが ふっとんだ, いかが ですか？
     いかです！, the しょう-suffixed awards (ざぶとん さようならしょう, また でたしょう, which can
     be heard as また でたでしょう), and ごじょうしゃ かんりょうです (not a standard announcement).
     I replaced one Chōchin-san line that joked about rushing onto the train.
C32. **"Most Cushions Stolen"** goes to the player Pon stole from most (players never steal).
C33. **No Kotoba Concentration lines yet**: it's v1.1 and has no host events.

## AI and voice

(The host voice thread adds its questions here.)
