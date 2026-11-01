# Commercial blockers

A log of every decision, dependency, asset or service that would stop Kotoba Party from being sold,
or would add conditions or costs to selling it. The game is free and non-commercial today; this
file is here so that going commercial later is a checklist, not an archaeology dig.

**Add a row whenever you bring in something new** (a library, dataset, voice, font, image, model,
API, hosting plan or borrowed idea), or make a decision that limits selling. Update the row when its
status changes. See the rule in [CLAUDE.md](../CLAUDE.md).

This isn't legal advice. Terms change: each row says when its terms were
read. Re-read everything marked ⚠️ or ❓ before launch, and get a lawyer to look at the final list.

## Status key

| Status | Meaning |
| --- | --- |
| ✅ Clear | Allows commercial use. Nothing to do beyond normal notices. |
| 🟡 Conditions | Allows commercial use if we do something (credit, notice, share-alike, paid plan). |
| ⚠️ Risk | Allowed on paper, but there's a real cost or risk (copyright, reputation, scaling). |
| ❓ Unverified | Terms not read in full yet. Treat as a blocker until someone reads them. |
| ⛔ Blocker | Can't sell with this as it is. Must be replaced or licensed. |
| 🕓 Planned | Not in the game yet; check before it lands. |

## Summary

| # | Item | Where | Status | What it takes to sell |
| --- | --- | --- | --- | --- |
| 1 | VOICEVOX voices (白上虎太郎, ちび式じい, 春日部つむぎ, No.7, fallbacks) | `server/ai/hosts.ts` | 🟡 ❓ | Show `VOICEVOX:<name>` credits; read each character's full terms. **No.7 (Nobiko-san) read 2026-11-01: free only while the game is non-commercial; a sold game is "ゲームでの利用" and needs a paid VOICEVOX licence from No.7's team (from ¥15,000 with credit, ¥250,000 without)** |
| 2 | VOICEVOX engine | Docker image, separate service | 🟡 | Run unmodified as a service; LGPL/core terms if ever bundled into a download |
| 3 | KanjiVG stroke data | `content/src/kana/strokes.ts`, `content/src/kanji/strokes.ts` (Shodō Taikai) | 🟡 | Credited in the stage's recap credits strip; add it to a notices file; keep the derived data CC BY-SA 3.0 |
| 4 | kuromoji + IPADIC dictionary | `server/src/reading.ts`, reader service | 🟡 | Ship the Apache-2.0 and NAIST notices |
| 5 | npm dependencies | `package-lock.json` | ✅ | Ship a third-party notices file |
| 6 | AI art: PixelLab (all stage art: hosts, yōkai, the seven backdrop sets including the Last Train carriage and Ghost Advice Hotline's call-in booth (2026-11-01), Photo Caption pictures, 31 game icons, 54 Onsen and Omiai character portraits, 25 host and yōkai animation sheets (thinking and shocked added 2026-10-28), a smoke-puff effect, 56 Narabete! card pictures, 112 Narabete! answer pictures, 6 Bento Haus VS pieces, Dub Club's 13 anime sets, 14 characters and their 14 mouth sheets, 33 direction-card icons, 3 episode backdrops and 3 phone player icons, 83 Happyōkai! slide pictures, Happyōkai!'s 6 stamp icons, candle, flame and Chōchin-san bow sheet, Nice to Meet You!'s paw stamp and card-back medallion, and, for the phone's yōkai book and sign-in (2026-10-28), 10 yōkai book sprites and 4 icons: key, hanko, speaker and the stage Phrasebook's notebook, then 16 game icons and a stamp ring for the Phrasebook cards; Read the Signs' station-sign casing, arrow and hanger (2026-11-01), Late Again!'s 16 cause pictures, curveball, leaf, sash and certificate (2026-11-01), Ghost Advice Hotline's 26 advice tiles and 16 caller portraits (2026-11-01), and Yōkai Court's 7 clue, 6 place and 3 case-object pictures (2026-11-01)) | `stage/assets/`, `content/media/photo-caption/` | ⚠️ | Decided: placeholder until commercial, then commission the art |
| 7 | AI art: Gemini (source images for Pon, the lie tanuki cut from him, and one Ghost Advice Hotline picture: `caller-kodama`) | `tools/art/sources/`, `tools/art/sources/hotline/` | ❓ ⚠️ | Read Gemini API terms, or redraw these without a Gemini source |
| 8 | Claude API (host lines, answer judge, ink coach) | `server/ai/` | 🟡 ⚠️ | Commercial Terms on a business account; tell players AI can be wrong; per-game cost |
| 9 | Folklore yōkai and Japanese cultural content | `content/src/kana/`, host personas | ✅ ⚠️ | Folklore is public domain; don't copy modern designs; check the game and mode names |
| 10 | Kana course order and links (ToKini Andy) | `content/src/kana/raid.ts` | ✅ | Links only; ask before any paid tie-in or using his name in marketing |
| 11 | Fonts: Noto Sans JP, Noto Sans, Press Start 2P (Google Fonts CDN); Kotoba Pixel, our modified Pixelify Sans with 2, 3, 5, 6, 9, B, C and G redrawn (self-hosted) | `stage/index.html`, `controller/index.html`, `stage/assets/fonts/` | 🟡 ❓ | OFL 1.1 allows selling; ship the OFL notices. Self-host the fonts before an EU launch (the Google Fonts CDN's privacy terms weren't readable) |
| 12 | Game formats and names (Jackbox, Talking Points, oogiri, Shōten, ito, Overcooked, Rank5) | Docs, personas, borrowed mechanics | ⚠️ ❓ | Don't use "Jackbox" or TV show names in the product or marketing |
| 13 | Karaoke Duel songs | `shared/src/modes/karaokeDuel/songs.ts` | ✅ | Keep songs original; no covers without a music licence |
| 14 | Cloudflare Workers + Durable Objects | `wrangler.jsonc`, `cloudflare/` | ⚠️ | Paid plan once traffic grows; not a licence bar |
| 15 | ETL Character Database (handwriting grader) | Planned, Kana Yōkai Raid ML parts | 🕓 ⛔ | Likely research-only: don't train a shipped model on it without AIST's permission |
| 16 | Kuchibue handwriting database | Planned | 🕓 ❓ | Read TUAT's terms before use |
| 17 | Reference repos (job-hunt-agent, system-design-study, isekaid-into-the-cloud) | Ideas only | ✅ | Ladi's own repos; keep it to ideas, or check any third-party code they hold |
| 18 | Content reviewed by a fluent speaker | All content is `draft` | ⚠️ | Not a licence issue, but a paid product needs the reviewer pass (open question C1) |
| 19 | Repo licence | No `LICENSE` file | ✅ | All rights reserved by default. Keep it that way unless you choose to open-source |
| 20 | Speech to text: self-hosted Whisper (OpenAI weights, whisper.cpp or speaches) | `server/src/stt.ts`, separate service | ✅ ⚠️ | Ship MIT notices if ever bundled; stay on OpenAI's weights; privacy notice and a plan for under-13s before launch |
| 21 | Speech to text on Cloudflare Workers AI (`@cf/openai/whisper-large-v3-turbo`) | `server/src/stt.ts`, `wrangler.jsonc` `AI` binding | 🟡 ❓ | Read Cloudflare's service-specific terms for Workers AI; name Cloudflare as a processor in the privacy notice; per-minute cost |
| 22 | Music: recorded tracks (CC0, CC BY 4.0, CC BY 3.0), original synth tunes (Karaoke Duel's CC instrumentals are all gone: row 26) and synth sound effects | `stage/assets/music/`, `stage/src/music/` | 🟡 | Keep the CC BY credits on the stage (recap credits strip and now-playing line); or buy Kevin MacLeod's paid licence (terms ❓ unread) to drop his credits. Streamer mode plays only our own tunes. Japanese Lofi HipHop is split out as row 25 |
| 23 | Short link tanoshi.s.gy (s.gy, run on Short.io) | `wrangler.jsonc` `PUBLIC_URL`, `shared/src/share.ts` | ❓ | Read the s.gy / Short.io terms; before selling, move the short link to a domain we own |
| 24 | Reader service and VOICEVOX hosting: Oracle Cloud Always Free VM, addresses via sslip.io | `wrangler.jsonc` `READER_URL`, `VOICEVOX_URL`, separate services | ❓ ⚠️ | Read Oracle's Free Tier and Cloud Services terms; before selling, move to a paid plan or host with an SLA and a domain we own |
| 25 | Japanese Lofi HipHop (pickentcode, a Fiverr commission uploaded as CC0) | `stage/assets/music/japanese-lofi-hiphop.mp3`, Shodō Taikai's gallery | ❓ | Confirm with pickentcode the Fiverr order, that the gig kept no rights and that it uses no third-party samples; or swap the gallery to Senbazuru (CC BY 4.0) or the synth |
| 26 | Mureka (AI music generator: API credits and a Premium web plan, 2026-10-27) for Karaoke Duel backings and Dub Club's opening and ending | `stage/assets/music/night-drive-*.mp3`, `harbour-*.mp3`, `run-*.mp3`, `save-*.mp3`, `sleepless-*.mp3`, `monday-blues-*.mp3`, `self-intro-*.mp3`, `cheers-*.mp3`, `where-were-you-*.mp3`, `sparkle-idol-*.mp3`, `dub-opening.mp3`, `dub-opening-b.mp3`, `dub-ending.mp3` (tracks.ts licence `'Mureka'`): every grown-up song | ⚠️ ❓ | Paid output is ours but must be labelled AI (done in the credits). The terms also limit use of the *service* to personal, non-commercial use without Mureka's written consent: get that consent in writing, or replace the tracks with commissioned music, before selling. The API platform's own terms weren't readable |
| 27 | Karaoke Duel's Cheeky lyric sets (adult party humour: drinking, bad dates, bathroom jokes, innuendo; never explicit), behind the host's Audience setting (decision, 2026-10-27); Phrase Bingo's Cheeky scenes (an izakaya after work, a first date, coming home on the first train) and Word Gauntlet's Cheeky Fake Kanji words (hangovers, nights out, office life, ogling) follow the same setting (2026-10-27), as do Murder at the Onsen's four Cheeky cases (a hungover new hire, a bad first date, a president's toupee, a ghost-story night), Word Gauntlet's two Cheeky rumours and four Cheeky fins (an izakaya, a bar, drunk, hungover, skipping work, after a date; 2026-11-01), and Happyōkai!'s 25 Cheeky titles and 29 Cheeky slides (2026-10-28: office and dating life, women's side of nights out and weddings, college drinking parties, and comic yakuza who shouldn't be yakuza, including a primary-school "gang" in sunglasses and a shiba godfather; no violence, weapons or tattoos shown) | `shared/src/modes/happyokai/content.ts` (`audiences: C`), `shared/src/modes/karaokeDuel/lyrics/*.ts` (`audience: 'cheeky'`), `shared/src/modes/phraseBingo/scenes.ts` (`audience: 'cheeky'`), `shared/src/modes/wordGauntlet/words.ts` (`CHEEKY_WORDS`), `shared/src/modes/wordGauntlet/rumours.ts` (`audience: 'cheeky'`), `content/src/onsen/cases.ts` (`sakeCase`, `phoneCase`, `toupeeCase`, `candleCase`), `stage/src/settings.ts` | ⚠️ | Not a licence issue, but it sets the game's age rating and store listing. Before selling: rate the game with Cheeky in it (IARC / ESRB / PEGI questionnaires), or ship rated builds without the cheeky sets; keep Cheeky off by default and behind its warning; have the fluent reviewer check the cheeky sets, scenes, words and cases for anything cruder in Japanese than intended |
| 28 | Last Train's Cheeky lines: ほろ酔い線 (the real last train after drinks: izakaya, beer, a drunk boss, a missed stop) and きさらぎ線 (a creepy-funny take on the Kisaragi Station urban legend: a faceless passenger, a station not on the map; no gore), never explicit, played when the room's Audience is Cheeky (decision, 2026-10-27) | `content/src/last-train/scenarios.ts` (`audience: 'cheeky'`), `shared/src/modes/lastTrain/lastTrain.ts` (`chooseScenario`) | ⚠️ | Same as row 27: it adds alcohol references and mild horror to the age-rating answers. Before selling: include them in the rating questionnaire or leave them out of rated builds; have the fluent reviewer check them |
| 29 | The hosts' Kids and Cheeky voice in every mode: one Audience line each in the host, Onsen suspect and ink-coach AI prompts, 72 written Kids and Cheeky host lines, and a stricter Kids filter on typed player text (decision, 2026-10-27) | `server/ai/hostVoice.ts`, `server/ai/suspect.ts`, `server/ai/inkCoach.ts`, `content/src/hosts/audienceLines.ts`, `shared/src/moderation.ts`, `shared/src/audience.ts` | ⚠️ | Same age-rating question as rows 27 and 28, now across the whole night: with Cheeky on, the hosts joke about office life, dates and the odd drink in every mode, including the AI's own lines, which no one reviews line by line. Before selling: answer the rating questionnaires (IARC / ESRB / PEGI) with Cheeky in, or ship rated builds without it; keep Cheeky off by default and behind its warning; have the fluent reviewer check the Cheeky lines. A Kids setting doesn't make the game safe to market to children (COPPA / GDPR-K, row 20): the Kids filter is a word list, not a moderation service |
| 30 | Omiai Matchmaker's Cheeky guests (drinking, hangovers, bad habits, dating apps, overtime; never explicit, the prize is still a cup of tea), behind the host's Audience setting (decision, 2026-10-27) | `shared/src/modes/omiai/cards.ts` (`audience: 'cheeky'`) | ⚠️ | Same as rows 27 and 29: no licence issue, but it adds to the game's age rating. Before selling: include it in the rating questionnaires or leave it out of rated builds; have the fluent reviewer check the Cheeky guests' Japanese |
| 31 | Browser speech synthesis (the device's own ja-JP voices, Web Speech API) for host lines when VOICEVOX isn't set up or is late, as already used for Onsen suspects, Concentration cards and listening prompts, and (2026-11-01) for reading players' own words in Word Gauntlet's rumour round | `stage/src/hostSpeech.ts`, `stage/src/modes/onsenMurder.ts`, `stage/src/modes/concentration.ts`, `controller/src/components/voice.ts`, `stage/src/modes/wordGauntlet.ts` | 🟡 ❓ | Nothing is shipped: the voices belong to the player's OS or browser. Chrome's "Google" voices send the text to Google, so the host fallback prefers on-device voices. The rumour round sends players' own words to that voice, so the phone's voice now prefers on-device voices too (2026-11-01); a phone with only a network voice still sends the text to Google. Read Google's terms for Chrome's network voices and mention it in the privacy notice, or require on-device voices |
| 32 | Dub Club plays players' recorded voices back on the TV: each acted take is kept in the room's memory (Node, or the Cloudflare Durable Object) while the game needs it, then dropped; never written to disk | `server/src/room.ts` (`keepClip`), `server/src/server.ts`, `cloudflare/roomObject.ts`, `controller/src/modes/dubClub.ts` | ⚠️ ❓ | Privacy, not a licence: a voice played to the room is still personal data, and some players may be children. Before selling: say it in the privacy notice, decide on under-13/16 players (COPPA, GDPR-K: rules not read for this, ❓), keep the "play from my phone" option, and check Cloudflare's Durable Object terms for in-memory personal data (not read, ❓) |
| 33 | Dub Club's Cheeky episodes and cards (office overtime, a first date, Girls' Night, a cheap idol off stage, and the drunk, sexy, host-club, gyaru and mother-in-law cards), behind the host's Audience setting (decision, 2026-10-28) | `shared/src/modes/dubClub/scenes.ts` (`audience: 'cheeky'`) | ⚠️ | Same as rows 29 and 30: no licence issue, but it adds to the age rating. Include it in the rating questionnaires or leave it out of rated builds; have the fluent reviewer check the Cheeky lines |
| 34 | Optional sign-in: passkeys through SimpleWebAuthn (`@simplewebauthn/server` and `/browser`, MIT, plus MIT, Apache-2.0, 0BSD and BSD-3 dependencies), and each signed-in player's save (save name, game scores, kana practised) kept on one Cloudflare Durable Object (decision, 2026-10-28) | `server/src/accounts.ts`, `cloudflare/accountsObject.ts`, `controller/src/account.ts`, `shared/src/progress.ts` | 🟡 ⚠️ ❓ | Ship the MIT and Apache-2.0 notices (row 5). Privacy, not licence: a privacy notice for saves, a decision on under-13/16 players (COPPA, GDPR-K: not read, ❓), and Cloudflare's Durable Object storage named as a processor. Deleting a save is already in the game |
| 35 | The learning path names levels "N5", "N4" and "N3" (the JLPT's level names) and suggests a JLPT mock test; its lines use our own names (Kana Line, Local Line, Express Line, Limited Express Line) (decision, 2026-11-01; N3 added in step 6a) | `shared/src/path.ts`, `controller/src/path.ts`, the level picker in `controller/src/main.ts` | ⚠️ | JLPT site policy read 2026-11-01: it covers copying the site's works (questions, text), not naming the test or its levels, and carries no trademark notice. We copy none of its content. Keep "N5"/"N4"/"N3" descriptive, never claim endorsement or a result, and have a lawyer check whether "JLPT" or 日本語能力試験 is a registered mark before launch |
| 36 | VOICEVOX speaking player-written text in Word Gauntlet's rumour round (Nobiko-san = No.7) | the TV's reveal reads each relay as a Nobiko-san host line (`rumour_relay`, `shared/src/modes/wordGauntlet/wordGauntlet.ts`), voiced by VOICEVOX when the server has it, else browser speech; the relayer's phone always uses browser speech (`controller/src/modes/wordGauntlet.ts`) | 🟡 ⚠️ | No.7's terms read 2026-11-01 (https://voiceseven.com/): fine while the game is free; selling needs row 1's paid No.7 licence. No clause bans live user text, but the image clause applies: relays pass the Kids/Family word filter first. Before selling, also decide whether a word-list filter is enough for player text in a licensed voice |

## Details

### 1. VOICEVOX voices

- **What:** Each host is a VOICEVOX character voice. Pon = 白上虎太郎 (fallback 玄野武宏), Chōchin-san =
  ちび式じい (fallback 冥鳴ひまり), Fude = 春日部つむぎ, Nobiko-san = No.7 (fallback 九州そら, added
  2026-10-27). No.7's and 九州そら's terms pages (voicevox.hiroshiba.jp/product/no7/ and the
  character's own site) were unreachable from the session that added them on 2026-10-27, so their
  terms are unread ❓, like the others'. Auditioned but not chosen: 青山龍星, ユーレイちゃん,
  ずんだもん, 四国めたん.
- **Terms:** The short policies the engine reports (`/speaker_info`, read 2026-10-26 by the AI thread)
  allow commercial and non-commercial use if the credit `VOICEVOX:<name>` is shown. Each character also
  has detailed terms on its own site, with banned uses (typically: adult or political content,
  defamation, presenting the voice as a real person). **Nobody has read those in full.** The official
  terms pages were unreachable from this session.
- **Known traps:** 青山龍星 reportedly needs prior permission for any use by a company, so it was
  avoided. ずんだもん has separate character-image rules. Using a character's picture, not just their
  voice, usually has extra terms.
- **No.7 (Nobiko-san), read 2026-11-01** at https://voiceseven.com/ (the terms page No.7's VOICEVOX page
  links to; https://voicevox.hiroshiba.jp/product/number_seven/ and the VOICEVOX software terms at
  https://voicevox.hiroshiba.jp/term/ read the same day):
  - Non-commercial use needs no application. Free distribution and 同人ゲーム count as non-commercial.
  - **"ゲームでの利用" (use in a game) is listed as commercial: consult them first.** For VOICEVOX, commercial
    use with a credit is licensed (the guide price for unlimited characters with no time limit is from ¥15,000;
    terms vary by use). Without a credit it's ¥250,000 plus tax. Contact is by email.
  - Banned for every use: anything that seriously damages the character's image or the author's reputation,
    infringes others' rights, alters the character beyond recognition, exclusive use (trademarks), or use by
    antisocial forces. The VOICEVOX software also bans anything against public order (公序良俗).
  - Nothing restricts reading live, user-written text as such. Player text read in her voice is covered by the
    image clause, so it should pass the moderation filter first (row 36).
  - 九州そら (the fallback): its product page links only to the general VOICEVOX terms; its own character
    terms weren't found, still ❓.
- **To sell:** Credits screen shows `HOSTS[h].credit` for every voice used (it's in the code, the screen
  isn't built yet). Buy a No.7 commercial licence (or swap Nobiko-san's voice). Read each other chosen
  character's full terms and record the date and URL here. If a voice
  needs a contract for commercial use, swap it for one that doesn't.

### 2. VOICEVOX engine

- **Terms:** The engine's terms (bundled in the Docker image) allow commercial use and redistribution,
  require following each voice's terms, and ban reverse engineering. The engine source is LGPL-3.0 and
  the core library has its own licence.
- **Today:** We run the official image unmodified, as a separate container, so none of our code is
  affected.
- **To sell:** Fine as a hosted service. If the game ever ships as a download (Steam, app store) with
  the engine inside, bundle it per its licence (LGPL notices, core library terms), or pre-render all
  audio so the engine never ships.

### 3. KanjiVG

- **Terms:** CC BY-SA 3.0, © Ulrich Apel and contributors. Commercial use is allowed.
- **Read:** https://github.com/KanjiVG/kanjivg/blob/master/COPYING, 2026-10-27.
- **Conditions:** Attribution, and anything derived from it stays CC BY-SA. Both `strokes.ts` files
  (kana, and the 111 kanji Shodō Taikai uses) are derived, and their headers say so. The share-alike applies to that data, not to the rest of the game, as long
  as it stays a separate data file.
- **Credited:** since 2026-10-27 the stage's recap credits strip includes "Stroke order data:
  KanjiVG, © Ulrich Apel and contributors, CC BY-SA 3.0" (`creditLines` in `stage/src/main.ts`).
- **To sell:** Keep that credit, add it to the notices file, and accept that anyone may reuse the
  stroke data.

### 4. kuromoji and IPADIC

- **Terms:** kuromoji is Apache-2.0. Its bundled dictionary is mecab-ipadic-2.7.0 (© NAIST), which
  permits use, reproduction and distribution if the copyright notice and disclaimer travel with it
  (see `node_modules/kuromoji/NOTICE.md`).
- **To sell:** Include both notices in the third-party notices file. If we ever switch to UniDic or
  JMdict, log it: JMdict is CC BY-SA 4.0 (attribution plus share-alike on the dictionary data).

### 5. npm dependencies

- **Checked 2026-10-26** from `package-lock.json`: runtime deps (`@anthropic-ai/sdk`, `kuromoji`,
  `qrcode`, `ws`, `zod`) are MIT or Apache-2.0. The whole tree is MIT, ISC, Apache-2.0, BSD, 0BSD,
  CC0 or Unlicense, except `@img/sharp-libvips-*` (LGPL-3.0), which is a dev-only dependency of
  wrangler and never ships.
- **2026-10-31:** added `happy-dom` (MIT, read in its `package.json` and npm listing on 2026-10-31)
  as a dev-only test dependency (a browser DOM for `tests/domPatch.test.ts`). Its own dependencies
  (`entities`, `buffer-image-size`, `whatwg-mimetype`, `ws`) are MIT or BSD-2-Clause. It never ships.
- **To sell:** Generate a third-party notices file at release. Re-run the check when adding packages
  (a GPL or AGPL runtime dependency would be a blocker for a closed-source game).

### 6. AI art from PixelLab

- **What:** Everything on the stage: the four host portraits, five yōkai sprites, the backdrop sets,
  the 24 Photo Caption pictures, and (since 2026-10-26) 31 icons in `stage/assets/icons/` (places,
  scenes, Onsen victims and evidence, Last Train, trophy) plus the 42 character portraits in
  `stage/assets/portraits/onsen/` and `portraits/omiai/` (two expressions each) that replaced emoji in
  Murder at the Onsen, Omiai Matchmaker, Who's the Tourist? and Phrase Bingo. Since 2026-10-26 also
  the 25 animation sheets in `stage/assets/anim/` (host idle, cheer and oops loops; yōkai hit and
  boss defeat; Nobiko-san's three added 2026-10-27; a thinking and a shocked sheet for each host added 2026-10-28, same endpoint, terms unchanged since the 2026-10-26 read), made by PixelLab's `animate-with-text-v3` endpoint from our own host and yōkai
  sprites as the first and last frame, and the smoke puff in `stage/assets/fx/`. Since 2026-10-28 also the 56 Narabete! card pictures in
  `stage/assets/cards/` and the 112 Feelings answer pictures in `stage/assets/answers/` (`pixflux`, text
  only, prompts and seeds in the manifest), Happyōkai!'s 80 slide pictures and Chōchin-san's three
  holiday photos in `stage/assets/slides/` (`pixflux`, text only, prompts and seed in `tools/art/slides.ts`), and Bento Haus's
  food sprites and 10 customers in three moods (`stage/assets/bento/`, `pixflux`, text only; のり and
  うめぼし are drawn in our own code), and Bento Haus VS's team crests, box lid, わけあり sticker,
  へんきん stamp and Pon with flags (`stage/assets/bento/vs/`, 2026-10-28, `pixflux`; Pon with flags
  starts from a layout sketch painted onto our own Pon sprite, and its red flag is touched up by hand). Narabete!'s knot
  sheet and clothes peg are hand-drawn by `tools/art/sources/narabete-art.py` (no model, no PixelLab).
  Nice to Meet You!'s lie tanuki (`stage/assets/fx/tanuki-doron.png`, 2026-10-28) is Pon's head cut from his
  idle sheet with a hand-drawn leaf by `tools/art/sources/tanuki-doron.py` (no new model), so it carries Pon's row 7 caveat.
  Its paw stamp and card-back medallion (`stage/assets/fx/paw-hanko.png`, `card-medallion.png`, 2026-10-28) are
  text-only `pixflux` images. Read the Signs' station boards (`stage/assets/signs/`, 2026-11-01) come from three
  text-only `pixflux` images (sign casing, arrow, hanger; raws in `tools/art/sources/signs/`), cropped, recoloured
  and scaled by `tools/art/sources/signs.py` (no other model). Same endpoint; the terms were not re-read for this
  pass, so they rest on the 2026-10-26 read.
  Late Again!'s pictures (`stage/assets/late/`, 2026-11-01) are 20 text-only `pixflux` images: 16 cause
  tiles, the tanuki-leaf curveball tile, the vote-counting leaf, the acting chief's sash and the delay
  certificate (prompts and seeds in the manifest). Same endpoint; the terms were not re-read for this pass,
  so they rest on the 2026-10-26 read.
  Ghost Advice Hotline's pictures (`stage/assets/hotline/`, 2026-11-01) are 42 text-only `pixflux` images:
  26 advice tiles and 16 caller portraits (prompts and seeds in the manifest). Same endpoint; the terms
  rest on the 2026-10-26 read and are unchanged.
  Yōkai Court's pictures (`stage/assets/court/`, 2026-11-01) are 16 text-only `pixflux` images: 7 clues,
  6 alibi places and 3 case objects (prompts and seeds in the manifest; the footprints have a 1px outline added by the post step). Its yōkai, the inkstone, the leaf and the bento
  and tea cards reuse art already logged here. Same endpoint; the terms were not re-read for this pass, so
  they rest on the 2026-10-26 read.
  The four lip-sync
  mouth sheets are edited from our own host portraits by `tools/art/polish.ts`, and Nobiko-san's neck-stretch sheet (2026-10-28) is cut from her portrait by `tools/art/sources/nobiko-peek.py` with a hand-drawn neck, as are the body and head the stage draws her long reach from and her chorus sway sheet (no new model). Apart from those, text-to-image only, no reference images. Most come from PixelLab's `pixflux` endpoint; Pon
  comes from its `image-to-pixelart` endpoint (see row 7). Nobiko-san (2026-10-27) is `pixflux` with
  an `init_image`: a layout sketch (`tools/art/sources/nobiko-sketch.png`, made by
  `nobiko-sketch.py`) cut and rearranged from another of our own `pixflux` outputs with a hand-drawn
  neck, so she traces back only to PixelLab and our own edits. Prompts, sources and params are
  recorded in `stage/assets/manifest.json` and `tools/generate-caption-art.ts`.
  Since 2026-10-27 the stage draws one of its sets from `stage/assets/scenes/`
  ([graphics.md](graphics.md#backdrop)): the studio, comedy stage, karaoke box, onsen inn, tea room,
  train carriage and (2026-11-01) Ghost Advice Hotline's call-in booth. All seven are text-only `pixflux`
  images (the booth's raw draft is `tools/art/sources/hotline/booth-draft.png`; its unlit call-light
  overlay is cut from it by our own script, with no generator), so the backdrop no longer traces back
  to Gemini; the old converted backdrop and its Gemini source were deleted. The three page sprites
  are drawn by hand, with no generator. The effects (mist, spotlights, rain,
  confetti, steam, the town past the train windows) are drawn by our own code, not generated.
- **Terms (read 2026-10-26, <https://www.pixellab.ai/termsofservice>):** "You own the copyrights to your
  creations, permitting usage for both commercial and non-commercial purposes." Limits: don't train
  other models on the outputs, use only the official API, and ask before building a reselling service.
  We are responsible for not infringing anyone else's rights.
- **Risks:** see [AI art: non-commercial vs commercial](#ai-art-non-commercial-vs-commercial) below.

### 7. AI art from Gemini

- **What:** Since 2026-10-26 no shipped file is raw Gemini output: the hosts and backdrop moved to
  PixelLab pixel art (see [graphics.md](graphics.md)). But PixelLab drew Pon by converting an earlier
  Gemini image (`gemini-3-pro-image`), kept in `tools/art/sources/` and not served. So Pon is derived
  from Gemini output and its terms still apply to him, and to the lie tanuki cut from his sheet
  (`stage/assets/fx/tanuki-doron.png`). The backdrop was redrawn from text alone on
  2026-10-27 and its Gemini source deleted.
- **Ghost Advice Hotline (2026-11-01):** one hotline picture is also a PixelLab `image-to-pixelart`
  conversion of a Gemini image (`gemini-3-pro-image-preview`): `stage/assets/hotline/caller-kodama.png`.
  Its source is in `tools/art/sources/hotline/` (not served) and listed in the manifest. `pixflux`
  couldn't draw the kodama's bark body from text alone. Ladi approved using Gemini for it, with the
  terms still unread. `advice-dont-move.png` was a Gemini conversion too, but the art panel found it
  showed a moving kid, so it was redrawn from text alone with `pixflux` and its Gemini source deleted.
- **Terms: unverified.** The Gemini API Additional Terms page was unreachable from these sessions. From
  memory, to be checked: Google doesn't claim ownership of generated content, the Generative AI
  Prohibited Use Policy applies, free-tier prompts and outputs may be used to improve Google's
  products, and in some regions (EEA, UK, Switzerland) only the paid tier may be used. Images carry an
  invisible SynthID watermark.
- **To sell:** Read the terms and record them here. Prefer paid-tier keys for any art that ships.
  Same copyright caveats as PixelLab. Or close the row: redraw Pon with `pixflux` from text only, or
  include him in the commissioned art, then delete `tools/art/sources/pon-gemini.png`. Do the same for
  the two hotline pictures and delete `tools/art/sources/hotline/`.

### 8. Claude API

- **What:** Live host lines, the answer judge's second look, and the Ink Storm coach (`server/ai/`).
  Everything has a written or offline fallback, so the game runs without it.
- **Terms (read 2026-10-26, <https://www.anthropic.com/legal/commercial-terms>):** the customer owns its
  outputs, and Anthropic assigns its rights in them. Anthropic doesn't train on API content. Two
  conditions matter for us: follow the Usage Policy, and **tell players that factual statements from
  the AI may be wrong** (section D.3), which matters for a game that grades Japanese.
- **To sell:** Use a business API account under the Commercial Terms, not a personal key. Add a short
  "AI hosts can make mistakes" line (credits or settings). Check the Usage Policy's rules for products
  that minors may use if the game is marketed to schools or under-18s. Budget the cost: the default cap
  is $0.10 per game, which a paid price has to cover.

### 9. Folklore yōkai and cultural content

- **Clear:** Traditional yōkai (kappa, chōchin-obake, kasa-obake, tanuki, tsukumogami) are public-domain
  folklore. Our designs and mnemonics are original (`content/src/kana/mnemonics.ts` links Tofugu and
  ToKini Andy instead of copying them).
- **Risks:** Don't copy modern, copyrighted yōkai designs (Mizuki Shigeru's *GeGeGe no Kitarō*, Level-5's
  *Yo-kai Watch*). "Yo-kai Watch" is a trademark, so avoid a "Yo-kai" spelling in titles. Run a
  trademark search on "Kotoba Party" and each mode name before launch.

### 10. Kana course order (ToKini Andy)

- Kana Yōkai Raid follows the chapter order of ToKini Andy's free YouTube course and links to its
  timestamps. Linking is fine, and an order of kana isn't protectable. Don't embed his videos in a paid
  product or use his name in marketing without asking.

### 11. Fonts

- **What (since 2026-10-26):** Noto Sans JP for all Japanese, Noto Sans for English body text and romaji
  (Noto Sans JP lacks some macron vowels such as ō), and Pixelify Sans, a pixel face, for English
  titles and numbers (timer, scores). Since 2026-10-27, Press Start 2P, a blockier pixel face, for
  the room code only, because Pixelify's G, Z, S and B read as 6, 2, 5 and 8. Both pages load them from the Google
  Fonts CDN (`fonts.googleapis.com`, `fonts.gstatic.com`), with system fonts as the fallback.
- **Kotoba Pixel (since 2026-10-28 as Kotoba Five; renamed and extended 2026-11-01):** from the couch
  Pixelify's 5 read as S or 8, its 2, 3, 6 and 9 as 8, its C as O ("Yōkai Oourt"), its G as a boxed 6
  and its bold B as G ("Gento Haus"), and its fi ligature drew "file" as "Ale". So
  `tools/fonts/build-kotoba-pixel.py` takes Pixelify Sans v3 (Latin and Latin Extended, as Google
  serves it, pinned by hash), redraws those glyphs, drops the ligatures and renames the result Kotoba
  Pixel (`stage/assets/fonts/kotoba-pixel{,-ext}-{500,700}.woff2`). Since 2026-11-01 it is the whole
  face, self-hosted, and the pages no longer load Pixelify from Google Fonts. That is a
  Modified Version under the OFL: allowed, it must stay under OFL 1.1, and it can't use a Reserved
  Font Name (Pixelify Sans reserves none; renamed anyway). The licence text ships beside it as
  `stage/assets/fonts/OFL.txt` (copied from the Pixelify OFL.txt URL below, read 2026-10-28 and
  re-read 2026-11-01: unchanged, still no Reserved Font Name).
- **Terms (read 2026-10-26; Press Start 2P read 2026-10-27):** all four are under the SIL Open Font License 1.1
  (<https://raw.githubusercontent.com/google/fonts/main/ofl/notosansjp/OFL.txt>,
  <https://raw.githubusercontent.com/google/fonts/main/ofl/notosans/OFL.txt>,
  <https://raw.githubusercontent.com/google/fonts/main/ofl/pixelifysans/OFL.txt>,
  <https://raw.githubusercontent.com/google/fonts/main/ofl/pressstart2p/OFL.txt>, which reserves the
  font name "Press Start 2P", so a modified copy must be renamed; licence text at
  <https://openfontlicense.org>). OFL allows commercial use, embedding and bundling; the fonts can't
  be sold on their own, and the copyright and licence notice must travel with any copy we ship.
- **❓ The CDN:** loading fonts from Google's servers sends each player's IP address to Google. A
  German court (LG München, 2022) found that a GDPR breach without consent. Google's Fonts privacy
  FAQ (<https://developers.google.com/fonts/faq/privacy>) was blocked from this session, so its
  terms are unread.
- **To sell:** Self-host WOFF2 subsets of the other three fonts too (Kotoba Pixel already is, since
  2026-11-01), so there is no third-party request at all, and add the OFL notices to the third-party notices file. Any new font gets a row here.

### 12. Game formats and names

- Party-game mechanics, oogiri and TV quiz formats aren't protected by copyright, but names and
  branding are. Keep "Jackbox", "Quiplash", "Shōten" (笑点) and other show names out of the product,
  store page and marketing; "a party game" is enough. Pon's cushion gag is a nod to Shōten, which is
  fine as long as it isn't named.
- Narabete! (added 2026-10-28) uses the hidden-number ordering idea of the card games ito (Arclight)
  and The Mind: secret numbers, opinion themes, ordering by talk. Game mechanics aren't protected by
  copyright, but the names, card text and art are. Our themes, cards and the neck ruler are our own;
  don't use "ito" or "The Mind" in the product, store page or marketing.
- Nice to Meet You! / はじめまして！ (added 2026-10-28) merges the classroom activity 他己紹介 (introducing
  someone else; a teaching staple, no owner) with the ranking idea of **Rank5** (rank5.io): one player
  per turn is the subject, and everyone ranks cards about them. Our twist (one true card, the rest lies
  that score when ranked above it), the cards, tiles, Pon's lines and the look are our own. ❓ Rank5's
  terms are **unread**: rank5.io was blocked from this session (2026-10-28). Only its "How to Play" and
  FAQ pages, uploaded by Ladi, were read (2026-10-28), and they say nothing about licensing. Before
  launch, read rank5.io's terms and check whether "Rank5" is a registered mark. Either way, don't use
  "Rank5" in the product, store page or marketing. Music: two Kevin MacLeod tracks the game already
  uses (Local Forecast - Elevator, Carefree; see row 22), so nothing new there.
- Bento Haus (added 2026-10-28) borrows the idea of Overcooked (Ghost Town Games / Team17): a co-op
  kitchen where the team has to talk to fill orders against the clock. Bento Haus VS (2026-10-28)
  is the same idea with two teams racing; nothing new is borrowed. Only the idea; the menu,
  yokai customers, counters, riddles, look and every line are our own. Don't use "Overcooked" in the
  product, store page or marketing ("a co-op cooking party game" is enough).
- Happyōkai! (added 2026-10-28) borrows the idea of Jackbox's Talking Points and the improv game
  PowerPoint Karaoke: a talk on slides the presenter hasn't seen, picked by an assistant. Only the idea; the
  titles, slides, mishaps, lines and pictures are our own, and the frame is a Japanese school 発表会 with a
  report card. Joking Hazard (Ladi's suggestion) inspired the tone of some Cheeky slides; no card,
  panel or art from it is used. Don't use "Talking Points", "Jackbox" or "Joking Hazard" in the product,
  store page or marketing ("a surprise-presentation party game" is enough).

### 13. Karaoke Duel songs

- Songs are original, lyrics and melodies alike, including the nine grown-up songs added on
  2026-10-27 and their full-length versions (verse, chorus, verse 2) written the same day. Those
  are sung over licensed instrumentals (row 22); the vocal lines on top are ours. They borrow genres (city pop, enka, anime rock, izakaya chant, blues, Shōwa duet,
  rap, idol pop, R&B), never a real song's tune or words. The enka's さよなら あなた was
  dropped because it is also the hook of a well-known hit. Chord progressions are common stock
  patterns. Keep it that way: no "in the style of <artist>" melodies.
- Any real song (even a nursery song still in copyright, or a well-known
  arrangement) needs a music licence. Old folk songs (e.g. さくらさくら) are public domain, but a
  specific recording or arrangement may not be.

### 14. Cloudflare

- The game runs on Workers with one Durable Object per room. Cloudflare's terms allow commercial use on
  the free plan, as far as we know (unverified: the terms page was blocked). The real limit is quota:
  the free plan's daily request and Durable Object limits would be hit by a paid audience. Budget for
  the Workers Paid plan (about $5/month plus usage). The reader service and VOICEVOX need their own
  always-on host.

### 15. ETL Character Database

- **Planned** for training the Kana Yōkai Raid handwriting grader.
- **Terms (from memory, unverified):** AIST distributes ETLCDB free for research use after registration,
  and commercial use needs separate permission. A model trained on it and shipped in a sold game is
  likely commercial use.
- **To sell:** Either get AIST's written permission, or train on data we can use commercially: KanjiVG
  strokes with synthetic augmentation, or players' own drawings collected with consent. The current
  offline stroke check doesn't use ETL, so nothing is blocked today.

### 16. Kuchibue

- **Planned** as pen-stroke training data. Terms unread. Treat like ETL until someone reads TUAT's
  terms.

### 17. Reference repos

- `job-hunt-agent`, `system-design-study` and `isekaid-into-the-cloud` are Ladi's own repos and are used
  as reference only (for example, the judge's "points count only with a quote" rule came from Isekai'd).
  No code from third parties has been copied from them. If code is ever copied, check its origin first.

### 18. Fluent-speaker review

- Not a legal blocker, but selling learning content that hasn't been checked is a refund and reputation
  risk. Every item is `status: 'draft'` until a reviewer passes it (open question C1).

### 19. Repo licence

- There is no `LICENSE` file, so the code is all rights reserved, which is what a commercial game wants.
  If the repo is public, people can read it but have no right to reuse it. Adding an open-source licence
  later is a business decision; log it here if it happens.

### 20. Speech to text (Whisper)

- **What:** Spoken answers go from the phone to our game server and on to a Whisper server we run
  (`STT_URL`, see [speech.md](speech.md) and ADR 0004). It replaced Chrome's Web Speech API, which sent
  audio to Google.
- **Model:** OpenAI Whisper weights, `large-v3-turbo` recommended. MIT licence on the
  [model card](https://huggingface.co/openai/whisper-large-v3-turbo) and in
  [openai/whisper](https://github.com/openai/whisper/blob/main/LICENSE) (read 2026-10-26, via search
  results quoting both; the pages themselves weren't opened). The ggml conversions for whisper.cpp
  ([ggerganov/whisper.cpp](https://huggingface.co/ggerganov/whisper.cpp)) are MIT too.
- **Engine:** whisper.cpp ([MIT](https://github.com/ggml-org/whisper.cpp/blob/master/LICENSE)) or
  speaches / faster-whisper / CTranslate2 (MIT). We run them unmodified as a separate service; no code
  is copied into the game.
- **Dataset:** none of ours. OpenAI hasn't published Whisper's training data; its MIT licence covers
  using the weights.
- **Avoid for a sold game, or check first:** Japanese-tuned models trained on the **ReazonSpeech**
  corpus (kotoba-whisper, ReazonSpeech's own models). The models are Apache-2.0, but the corpus is
  CDLA-Sharing-1.0 and reportedly limited to the research use allowed by Japan's Copyright Act article
  30-4 ([ReazonSpeech](https://research.reazon.jp/projects/ReazonSpeech/), terms not read in full,
  2026-10-26). ❓ until someone reads them.
- **Privacy (⚠️, not a licence issue):** players' voices are personal data and players may be minors.
  Audio is recorded only while the button is held, goes only to our own server, and isn't stored; only
  the text is kept, for the game. Before a paid or public launch: a privacy notice saying so, a decision
  on under-13/16 players (COPPA, GDPR-K parental consent), and making sure nothing in front of the
  Whisper server (tunnel, proxy) logs request bodies.
- **Cost:** an always-on machine with enough CPU (or a GPU) for the player count. Not a licence bar.
- **To sell:** keep to OpenAI's weights (or check any other model's data terms first), include the MIT
  notices if the engine is ever shipped in a download, and do the privacy items above.

### 21. Speech to text on Cloudflare Workers AI

- **What:** On the live game, the room's Durable Object sends each spoken clip to OpenAI's
  `whisper-large-v3-turbo` on Cloudflare Workers AI through the Worker's `AI` binding (`STT_URL` =
  `workers-ai`, [speech.md](speech.md), ADR 0005). Replaces the need to run row 20's server.
- **Model licence:** the same OpenAI Whisper weights as row 20 (MIT). Cloudflare says it doesn't make
  or train the models and that each keeps its own licence.
- **Data use:** Cloudflare's [Workers AI data usage page](https://developers.cloudflare.com/workers-ai/privacy/)
  says prompts and outputs are Customer Content that we own, that it doesn't use them to train models
  or improve its or third parties' services without our consent, and that they're stored only if we
  store them in R2, KV, Durable Objects and the like. We don't store clips. (Read 2026-10-26 through
  search results quoting the page; the page itself couldn't be opened from the build machine.)
- **Commercial terms:** ❓ The Workers AI section of Cloudflare's
  [service-specific terms](https://www.cloudflare.com/service-specific-terms-developer-platform/)
  wasn't read: the page couldn't be opened 2026-10-26. Read it before selling.
- **Cost (🟡):** $0.0005 per audio minute (46.63 neurons a minute) on the
  [pricing page](https://developers.cloudflare.com/workers-ai/platform/pricing/), as quoted in search
  results 2026-10-26; a free daily 10,000-neuron allowance, then $0.011 per 1,000 neurons (reported by a
  review site, not confirmed on Cloudflare's page). Small per game, but it grows with players.
- **Privacy (⚠️):** voices go to Cloudflare as a processor. The privacy items in row 20 apply, and the
  notice should name Cloudflare.
- **To sell:** read the service-specific terms, confirm pricing on a paid plan, and name Cloudflare in
  the privacy notice. If the terms don't fit, switch `STT_URL` to a self-hosted server (row 20).

### 22. Music

- **What:** recorded tracks in `stage/assets/music/` (listed with author, licence and source in
  `stage/src/music/tracks.ts`), plus original tunes played by our own Web Audio synth
  (`stage/src/music/songs.ts`, written by Claude, no third-party samples). See [music.md](music.md).
- **CC0, no conditions:** Determination (HydroGene,
  [OGA](https://opengameart.org/content/determination-anime-style-music)); Bouncing, Love Love Love and
  Happy Dance (Holizna, [OGA](https://opengameart.org/content/happy-pop-electronic-collection)).
  Licences as stated on those pages, read 2026-10-26.
- **CC BY 4.0, credit required (🟡):** Monkeys Spinning Monkeys, Hep Cats, Carefree, Investigations,
  Funkorama and Sneaky Snitch, plus the second themes added 2026-10-26: Quirky Dog, Life of Riley,
  Wallpaper, Off to Osaka, Local Forecast - Elevator, Cipher, Kool Kats, Ishikari Lore and Ouroboros;
  Narabete!'s Daily Beetle and Easy Lemon, added 2026-10-28 (Daily Beetle is cut just after its loop and
  both are re-encoded at 128 kbps, "cut for the game" in their credits; licence page re-read 2026-10-28:
  Creative Commons, free, credit required, or a paid Standard License);
  Bento Haus's Kawai Kitsune and Feelin Good, added 2026-10-28 (both cut just after their loops and
  re-encoded at 128 kbps, "cut for the game" in their credits; same licence page, read 2026-10-28);
  Happyōkai!'s Lobby Time and Pamgaea, added 2026-10-28 (both cut just after their loops and re-encoded at
  128 kbps, "cut for the game" in their credits; licence page re-read 2026-10-28: Creative Commons, free,
  credit required, or a paid Standard License)
  (Kevin MacLeod, each credited with its incompetech ISRC page, [incompetech.com](https://incompetech.com/music/royalty-free/licenses/),
  read 2026-10-26: free under Creative Commons with credit, or a paid Standard License with no credit);
  Take a Trip (genaralskar, [OGA](https://opengameart.org/content/take-a-trip), read 2026-10-26). CC BY
  allows commercial use, and asks for title, author, source, the licence with a link, and a note of
  any changes.
- **Karaoke Duel instrumentals (added 2026-10-27, Ladi's request for real instrumentals):** each
  grown-up song is sung over one track, cut to the bars it uses and re-encoded ("cut and filtered
  for the game" in its credit). Licences as stated on each page, read 2026-10-27:
  - None are in the game now: every grown-up song has two Mureka backings (row 26).
  - Nights In June (KLY, CC BY 3.0) was Night Drive's track until 2026-10-27; it was replaced by
    two Mureka backings (row 26) and its file removed. Past Sadness (Kevin MacLeod, CC BY 4.0) was
    Harbour in the Rain's track until the same day; it went the same way, and so did JRPG Epic Rock
    Battle Theme (HydroGene, CC0, [OGA](https://opengameart.org/content/jrpg-epic-rock-battle-theme-1)),
    Run!'s track, Slow Jam (Kevin MacLeod, CC BY 4.0), Sleepless Night's track, Hustle (Kevin
    MacLeod, CC BY 4.0), Monday Blues' track, and Lazy Saturday (vandalorum, CC BY 4.0, from
    [Hip Hop Old School Chill Themes](https://opengameart.org/content/hiphop-old-school-chill-themes)),
    Self-Intro Rap's track. The last three went the same way on the same day: Hot Springs Town
    (Kistol, CC0, [OGA](https://opengameart.org/content/hot-springs-town)), Cheers!'s track; In Your
    Arms (Kevin MacLeod, CC BY 4.0), Where Were You?'s; and Cheers For Starlight (Chloe Wolfe, CC BY
    4.0, [OGA](https://opengameart.org/content/cute-bytes-ost-cheers-for-starlight)), Sparkle Idol's.
  - Skipped as candidates: anything CC BY-SA or GPL (Cheerful Upbeat Tune, Cuddle Puzzle), because
    share-alike could reach the game itself.
  - Lyrics and melodies sung over them are ours (row 13). Before selling, Ladi plans to commission
    songs written for the game; until then these tracks need the same credits as the other CC BY music.
- **Japanese Lofi HipHop (pickentcode, ❓, row 25):** Shodō Taikai's gallery track, added 2026-10-27 at
  Ladi's pick. Its [OGA page](https://opengameart.org/content/japanese-lofi-hiphop-track), read
  2026-10-27, says CC0 and "Ordered from Fiverr for a project that never got finished". Fiverr's
  [commercial-use licence page](https://help.fiverr.com/hc/en-us/articles/37555186939921--For-Commercial-Use-license-details)
  says a delivery's IP is assigned to the buyer unless the gig says otherwise, so the buyer could
  release it as CC0. Not verified: that the uploader is the buyer, that the gig didn't keep rights,
  and that the seller used no licensed or third-party samples. **To sell:** ask pickentcode for the
  Fiverr order and the seller's name and confirm, or swap the gallery to Senbazuru (Kevin MacLeod, CC BY
  4.0, the runner-up) or the synth. In code its stand-in (streamer mode, or a file that won't load) is
  the `gentle` synth tune, not Senbazuru: swapping for sale means changing `SHODO_GALLERY` in
  `stage/src/music/cues.ts`.
- **How we credit:** the stage names each recorded track, author and licence beside the sound button
  while it plays, and during the recap a strip along the foot of the screen cycles through every track
  grouped by author with the licence link and "looped and filtered for the game" (`creditSummary()` in
  `stage/src/music/tracks.ts`). Full per-track
  lines with each track's own page are `TRACK_CREDITS`. The VOICEVOX voice credits (row 1) are on the
  recap screen too. The public build has played these tracks since 2026-10-26, so the credits shipped
  in the follow-up PR the same day.
- **MacLeod's paid Standard License (❓):** incompetech points to filmmusic.io for it; that site
  didn't load from here on 2026-10-26 (checked twice; blocked by this environment's network). The
  [incompetech licences page](https://incompetech.com/music/royalty-free/licenses/), read 2026-10-26,
  only says the Standard License is "for projects where attribution is not wanted or is impossible",
  bought per production by picking titles and downloading a licence PDF; it shows no prices, and
  doesn't mention games. Someone needs to open it in a browser and read the PDF terms before relying on it.
- **Risks (⚠️, small):** OpenGameArt licences are what the uploader states; there's no proof they wrote
  the track. Holizna and HydroGene publish widely under these licences, so the risk is low. Kevin
  MacLeod's tracks are used in many games and videos, so players may recognise them, and a streamer
  playing the game could get an automated copyright claim if a third party has wrongly registered one
  (not checked). Streamer mode (settings panel, built 2026-10-26) swaps every recorded track for our
  own synth tune to avoid that. The synth tunes were
  AI-written with no human composer, so their copyright may be weak (like row 6).
- **Sound effects:** synthesised in the browser by our own code (`stage/src/music/sfx.ts`), no samples
  or files, so nothing to license.
- **Provenance:** files downloaded 2026-10-26 from the pages above (MacLeod's from incompetech's own
  MP3 links) and re-encoded to MP3 (128 kbps; Determination 160 kbps). The game plays them looped between beat points and, while players speak,
  filtered; that's the "change" the credit mentions.
- **To sell:** keep the credits on screen in every build (store page and app credits too, if it ships
  outside the browser), or buy MacLeod's Standard License once its terms are read and keep the CC BY
  credit for Take a Trip. Any new track gets its own line here.

### 23. Short link (tanoshi.s.gy)

- **What:** since 2026-10-27 the QR code and every invite link use `https://tanoshi.s.gy`
  (`PUBLIC_URL` in `wrangler.jsonc`). It sends a 302 to `https://kotoba-party.isekaid.workers.dev` and
  keeps the path and `?code=` (checked 2026-10-27). The invite card reads it as a joke, 楽しすぎ！
  The redirect headers say `x-powered-by: Short.io/Edge`, and `www.s.gy` sends you to short.io.
- **Terms: unread (❓).** On 2026-10-27, `s.gy` and `short.io` were blocked from here, and
  `www.s.gy/terms` redirects to `terms.s.gy`, which says "Domain not found". Not known: whether a free shared-domain
  link can be used for a commercial game, whether it can expire, be taken down or show an interstitial,
  and any click limits.
- **Risks:** a third party owns the address on every QR code. If the link stops working, players can't
  join from the QR code or the links until `PUBLIC_URL` is changed back (empty uses the game's own
  address).
- **To sell:** read the terms and record them here; or move the short link to a domain we own (for
  example a `tanoshi.` subdomain), so the QR codes don't depend on someone else's service.
### 24. Reader service (and VOICEVOX) on Oracle Cloud

- **What:** since 2026-10-27 the kanji reader (`npm run reader`, kuromoji) runs on an Oracle Cloud
  Always Free Ampere A1 VM (US West, Phoenix) behind Caddy. The Worker reaches it at
  `https://141-148-186-1.sslip.io` (`READER_URL`); sslip.io is a free DNS service that maps the
  hostname to the VM's reserved IP. Setup guide: the "Set up the kanji reader on Oracle Cloud" doc in
  the project. Since 2026-10-28 the VOICEVOX engine (row 2, Docker image `cpu-0.26.0`) runs on the same
  VM at `https://voicevox.141-148-186-1.sslip.io` (`VOICEVOX_URL`), behind a Caddy token check
  (`VOICEVOX_TOKEN`); guide: the "Set up VOICEVOX for the host voices" doc. If it goes away, the TV
  reads host lines with the browser's voice (row 31).
- **Terms: unread (❓).** On 2026-10-27 the Oracle Free Tier FAQ (https://www.oracle.com/cloud/free/faq/)
  and the Always Free resources page (https://docs.oracle.com/en-us/iaas/Content/FreeTier/resourceref.htm)
  refused automated reads (403 / blocked), so nothing here is checked against Oracle's own text. Not
  known: whether Always Free may serve a commercial product, and what notice Oracle gives before
  reclaiming or ending free resources. sslip.io's terms were not read either.
- **Risks:** secondary sources say Oracle reclaims Always Free instances that stay idle for 7 days on
  a free-only account, so the account is being upgraded to Pay As You Go ($0 within the free limits).
  If the reader goes away, the game keeps working: answers with kanji are compared as written and the
  かな "Heard:" line shows no romaji for kanji.
- **To sell:** read Oracle's terms and record them here, or move the reader to a paid host with an SLA;
  give it a hostname on a domain we own instead of sslip.io.

### 26. Mureka (AI music)

- **What:** Ladi bought Mureka Premium (web) on 2026-10-27, then API credits (1,000 credits, 30 per
  request, two takes each). Karaoke Duel's backings are generated through the API (prompts approved by
  Ladi). In the game: `stage/assets/music/night-drive-satnav.mp3` and `night-drive-asleep.mp3`
  (Night Drive versions A and B: Mureka task 168616599289857's two takes, model mureka-9.5), and
  `harbour-ferry.mp3` and `harbour-ticket.mp3` (Harbour in the Rain versions A and B: task
  168620097273857's two takes, model mureka-9.5), `run-footsteps.mp3` and `run-melonpan.mp3`
  (Run! versions A and B: task 168626183208962's two takes, model mureka-9.5), `sleepless-caller.mp3` and
  `sleepless-coffee.mp3` (Sleepless Night versions A and B: task 168626718048257's takes 2 and 1,
  model mureka-9.5), `monday-blues-1.mp3` and `monday-blues-2.mp3`
  (Monday Blues: task 168628653850625's two takes, model mureka-9.5), and `self-intro-faster.mp3` and
  `self-intro-questions.mp3` (Self-Intro Rap versions A and B: task 168631340105729's two takes, model
  mureka-9.5), `cheers-toast.mp3` and `cheers-starters.mp3` (Cheers! versions A and B: task
  168631050829825's takes 1 and 2), `where-were-you-1.mp3` and `where-were-you-2.mp3` (Where Were
  You?: task 168631185047554's two takes) and `sparkle-idol-1.mp3` and `sparkle-idol-2.mp3`
  (Sparkle Idol: task 168628473495553's two takes), `dub-opening.mp3` and `dub-opening-b.mp3` (Dub Club's opening: task 168823271587841's takes 1 and 2, each cut to 48 bars; games alternate) and `dub-ending.mp3` (Dub Club's ending: task 168823407771649's take 1, cut to 64 bars), both generated 2026-10-28 with Ladi's go-ahead (up to 200 credits; 60 used), all model mureka-9.5 and made from takes already
  generated (no new requests); generation records are kept in project files `tools/mureka/takes/` and `tools/mureka/run/`). Each new Mureka file must be
  listed in `tracks.ts` with licence `'Mureka'` and added here.
- **Terms read (2026-10-27):** Mureka Terms of Service, released and effective May 13, 2026
  (https://www.mureka.ai/static/terms-20260513.pdf), read in full. The API platform
  (https://platform.mureka.ai) has no separate terms page that loads without a browser, so it's
  assumed to fall under the same terms (❓ until confirmed). What matters for us:
  - **Ownership (§3(e)):** a user who bought credits or a paid plan owns the output, including any
    IP in it. Free-tier output belongs to Mureka and is for non-commercial use with attribution. We
    generate only on the paid API.
  - **Mureka's licence to our output (§3(e)):** we grant Mureka an unrestricted, irrevocable,
    royalty-free licence to use our output, including commercially. So Mureka could reuse or
    publish our tracks.
  - **AI label (§3(e)):** we must disclose or label AI-generated output where laws and platform
    policies require it. The credits say "AI-generated music made for Kotoba Party with mureka.ai",
    and stores such as Steam also ask for an AI-content disclosure.
  - **Not unique and maybe not copyrightable (§3(f), (g)):** output may resemble other users'
    tracks, and copyright registration isn't guaranteed.
  - **⚠️ Commercial use of the service (§3(a), §5(14)):** the licence to *use the service* is "for
    your personal, non-commercial use", and users may not use the service "for any commercial or
    unauthorized purpose" without Mureka's express written consent. This sits awkwardly with the
    ownership clause. For a free game it's fine; before selling, get written consent from Mureka
    (or confirm the API terms allow it), or replace the tracks.
- **Other risks for a sold game:** purely AI-made music generally can't be copyrighted in the US, so
  others could reuse it. Don't register the tracks with Content ID, so that streamers don't get claims.
- **To sell:** get Mureka's written OK for commercial use (or API terms that grant it), keep the
  AI label and the generation records, and file the store's AI disclosure. Ladi plans to commission
  human-made songs before selling (see the commission briefs), which would replace these tracks.

## AI art: non-commercial vs commercial

Ladi asked (2026-10-26): is AI art a problem for a non-commercial game, and what if we go commercial?

**Non-commercial: no real problem.** Both providers' terms let us use what they generate, and nothing
we've generated copies an existing character. The only things to keep doing: don't prompt for a named
artist's style or an existing character, check every image by eye before committing (already the rule),
and keep the provenance in `stage/assets/manifest.json` (already done).

**Commercial: allowed, with four things to plan for.**

1. **The provider's terms.** PixelLab says outright that you own the outputs and can sell them (read
   2026-10-26). Gemini's terms still need reading (row 7). PixelLab is the safer choice today, which
   lines up with going pixel art.
2. **You may not own the art in a way you can defend.** The US Copyright Office's position, upheld by
   the courts in *Thaler v. Perlmutter* (2025), is that purely AI-generated images aren't protected by
   copyright. Japan's Agency for Cultural Affairs takes a similar view: protection depends on human
   creative input. So a competitor could copy Pon's sprite and we couldn't stop them with copyright.
   Fixes: hand-edit or redraw the key art (hosts, logo, title screen) so there's human authorship on top,
   or commission an artist for those pieces, and trademark the game name and host names, since
   trademark protects identity regardless of how the art was made.
3. **Store rules.** Steam allows AI-generated content but requires a disclosure on the store page, and
   live in-game generation needs extra guardrails. itch.io asks creators to tag AI-generated assets.
   Some players and press react badly to AI art, so a disclosure plus hand-finished hero art reads
   better than all-AI.
4. **Infringement is on us.** If a generated image happens to look like someone else's character, the
   provider's terms put that risk on the user. The eye check before committing covers most of it.

**Decision (Ladi, 2026-10-26):** use PixelLab pixel art while the game is non-commercial, and
commission the art before going commercial. Done for the stage on 2026-10-26: the hosts and backdrop
are now PixelLab pixel art. Only Pon's Gemini source image remains (row 7); the backdrop's was
dropped on 2026-10-27.

**Recommendation:** keep using AI pixel art (PixelLab) for now. Before selling, have the three hosts,
the logo and the title screen hand-finished or commissioned, keep the AI sprites and Photo Caption
pictures if they still look right, and add the Steam/itch disclosure.

### 32. Players' voices played back (Dub Club)

- **What:** In Dub Club a phone records the player's acted line (raw, up to 12 s) and posts it to the room
  (`POST /api/rooms/:code/clip`). The room keeps it in memory, owned by that seat, and only the main TV's
  token can fetch it (`GET …/clip/:id`; watching screens and phones can't). The mode lists the clips it
  still needs (`Mode.clipsInUse`): the current scene's, and each scene's chosen dub for the closing
  episode. The room drops every other clip after each phase change, all of them when the game ends,
  and holds at most 8 MB. Nothing is written to disk or logged. A player can tick "Play my voice from
  this phone instead": then the clip only goes to the speech check (as in row 20) and the phone plays it
  itself.
- **Status:** ⚠️ ❓. No licence is involved; it is a privacy question. Voices are personal data, and
  playing one back to a room is more than transcribing it. The COPPA and GDPR-K rules weren't read for
  this decision (2026-10-28), nor Cloudflare's terms on personal data held in Durable Object memory: ❓
  until someone reads them.
- **To sell:** a privacy notice that says the TV plays your recorded line to the room and keeps it only
  for the game; a decision on under-13/16 players (parental consent, or Dub Club off for them); keep the
  play-from-phone option; read the Durable Object data terms.

### 33. Dub Club's Cheeky content

- **What:** Cheeky rooms get four episodes (Overtime Warrior, Date Night, Girls' Night from her side
  of the table, per Ladi's note that the audience is about half women, and Idol, Backstage) and five Cheeky direction cards.
  One drinking joke at most (the よっぱらって card); nothing explicit.
- **Status:** ⚠️, same as rows 29 and 30: it adds to the age rating, nothing to license.

### 34. Optional sign-in and saved progress

- **What:** Players can sign in with a passkey (no email, no password) to keep their yōkai cards and the
  scores of the games they finish ([accounts.md](accounts.md)). The phone uses `@simplewebauthn/browser`
  14.0.0 and the server `@simplewebauthn/server` 14.0.3, both MIT (© 2020 Matthew Miller), read in their
  `LICENSE.md` and at https://github.com/MasterKale/SimpleWebAuthn/blob/master/LICENSE.md on 2026-10-28.
  The server package pulls in `@peculiar/*`, `@hexagon/base64`, `@levischuck/tiny-cbor`, `pvtsutils`,
  `pvutils` and `tsyringe` (MIT), `asn1js` (BSD-3-Clause), `reflect-metadata` (Apache-2.0) and `tslib`
  (0BSD), per their `package.json` licence fields (read 2026-10-28).
- **What's stored:** the save name the player types, their passkey's public key, hashed sign-in tokens,
  each finished game (mode, date, score, place, awards) and each kana's review state. It lives on one
  Cloudflare Durable Object (`AccountsObject`). No email, real name, address, voice or IP is stored with it.
  A player can delete the whole save from the phone.
- **Status:** 🟡 for the libraries (notices only). ⚠️ ❓ for privacy: this is the game's first lasting
  personal data, and some players may be children. The COPPA and GDPR-K rules weren't read for this
  decision (2026-10-28), nor Cloudflare's terms for personal data stored in Durable Objects: ❓.
- **To sell:** a privacy notice covering saves (what's kept, where, how to delete it); a decision on
  under-13/16 players (parental consent, or no saves for them); name Cloudflare as a processor; ship the
  notices with the third-party list (row 5).

### 35. JLPT level names in the learning path

- **What:** The level picker already says New, N5 and N4. The learning path (version 2,
  [progressive-learning.md](progressive-learning.md)) builds its goals from the JLPT's public level summaries
  and the Japan Foundation's JF Standard can-dos, taking their shape, not their text, and its cleared screen
  suggests a JLPT mock test. Every goal, example and line is our own; the lines carry our own names.
- **Terms:** read 2026-11-01: the JLPT site policy, https://www.jlpt.jp/e/policy.html (Japan Foundation
  and JEES). It governs the site's copyrighted works: personal study use and cited excerpts (with the source
  line "Source: Official Worldwide Japanese-Language Proficiency Test Website (https://www.jlpt.jp/)") are
  free; other uses, including a paid product reproducing its works or sample questions, need permission via
  Inquiries. It says nothing about naming the test or its levels, and has no trademark notice. We reproduce
  none of its works: the goals are our own, shaped by the level summary
  (https://www.jlpt.jp/e/about/levelsummary.html). Trademark registration wasn't checked: ⚠️.
- **To sell:** check (J-PlatPat or a lawyer) whether "JLPT" or 日本語能力試験 is a registered mark; never
  copy the site's text or sample questions without permission; keep
  "N5"/"N4" descriptive (never "JLPT certified" or a score); if the names aren't allowed, rename the picker
  and the path to our own level names.
- **Also:** each sentence frame carries a level tag, `n5`, `n4` or `n3` (`shared/src/japanese/frames.ts`,
  N4/N3 step 1). The tags are internal; the same terms decide whether players may see them.

### 36. VOICEVOX reading players' words aloud (rumour round)

- **What:** Word Gauntlet's rumour round replays each relay in Nobiko-san's voice, so no player's voice moves
  between phones. Unlike row 1's fixed host lines, that text is what players said.
- **Terms read 2026-11-01:** No.7's terms at https://voiceseven.com/ (see row 1 for the full summary). First
  attempt the same morning was blocked by the session's network policy; Ladi allowed the domains and they were
  read. Non-commercial use is free with no application; a game is commercial use and needs a licence. No clause
  addresses live, user-written text; the bans that could bite are "seriously damaging the character's image"
  and the software's 公序良俗 rule.
- **Decision (2026-11-01):** the TV's reveal reads each relay as a Nobiko-san host line (VOICEVOX when the server
  has it, browser speech otherwise). Relays already pass `playerTextAllowed` (the Kids or Family word list)
  before they're accepted, and a relay that names a player is refused. The relayer's phone uses the browser's
  own voice (on-device first, row 31), so no extra server traffic per relay.
- **Status:** 🟡 ⚠️: allowed while the game is free; selling needs row 1's No.7 licence, and a sharper moderation
  plan for player text in a licensed voice (a word list isn't a moderation service).
