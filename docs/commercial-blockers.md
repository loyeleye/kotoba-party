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
| 1 | VOICEVOX voices (白上虎太郎, ちび式じい, 春日部つむぎ, fallbacks) | `server/ai/hosts.ts` | 🟡 ❓ | Show `VOICEVOX:<name>` credits; read each character's full terms |
| 2 | VOICEVOX engine | Docker image, separate service | 🟡 | Run unmodified as a service; LGPL/core terms if ever bundled into a download |
| 3 | KanjiVG stroke data | `content/src/kana/strokes.ts`, `content/src/kanji/strokes.ts` (Shodō Taikai) | 🟡 | Credited in the stage's recap credits strip; add it to a notices file; keep the derived data CC BY-SA 3.0 |
| 4 | kuromoji + IPADIC dictionary | `server/src/reading.ts`, reader service | 🟡 | Ship the Apache-2.0 and NAIST notices |
| 5 | npm dependencies | `package-lock.json` | ✅ | Ship a third-party notices file |
| 6 | AI art: PixelLab (all stage art: hosts, yōkai, the six backdrop sets including the Last Train carriage, Photo Caption pictures, 31 game icons, 42 Onsen and Omiai character portraits, 14 host and yōkai animation sheets and a smoke-puff effect) | `stage/assets/`, `content/media/photo-caption/` | ⚠️ | Decided: placeholder until commercial, then commission the art |
| 7 | AI art: Gemini (source image for Pon) | `tools/art/sources/` | ❓ ⚠️ | Read Gemini API terms, or redraw Pon without a Gemini source |
| 8 | Claude API (host lines, answer judge, ink coach) | `server/ai/` | 🟡 ⚠️ | Commercial Terms on a business account; tell players AI can be wrong; per-game cost |
| 9 | Folklore yōkai and Japanese cultural content | `content/src/kana/`, host personas | ✅ ⚠️ | Folklore is public domain; don't copy modern designs; check the game and mode names |
| 10 | Kana course order and links (ToKini Andy) | `content/src/kana/raid.ts` | ✅ | Links only; ask before any paid tie-in or using his name in marketing |
| 11 | Fonts: Noto Sans JP, Noto Sans, Pixelify Sans, Press Start 2P (Google Fonts CDN) | `stage/index.html`, `controller/index.html` | 🟡 ❓ | OFL 1.1 allows selling; ship the OFL notices. Self-host the fonts before an EU launch (the Google Fonts CDN's privacy terms weren't readable) |
| 12 | Game formats and names (Jackbox, oogiri, Shōten) | Docs, personas | ⚠️ | Don't use "Jackbox" or TV show names in the product or marketing |
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
| 24 | Reader service hosting: Oracle Cloud Always Free VM, address via sslip.io | `wrangler.jsonc` `READER_URL`, separate service | ❓ ⚠️ | Read Oracle's Free Tier and Cloud Services terms; before selling, move to a paid plan or host with an SLA and a domain we own |
| 25 | Japanese Lofi HipHop (pickentcode, a Fiverr commission uploaded as CC0) | `stage/assets/music/japanese-lofi-hiphop.mp3`, Shodō Taikai's gallery | ❓ | Confirm with pickentcode the Fiverr order, that the gig kept no rights and that it uses no third-party samples; or swap the gallery to Senbazuru (CC BY 4.0) or the synth |
| 26 | Mureka (AI music generator: API credits and a Premium web plan, 2026-10-27) for Karaoke Duel backings | `stage/assets/music/night-drive-*.mp3`, `harbour-*.mp3`, `run-*.mp3`, `save-*.mp3`, `sleepless-*.mp3`, `monday-blues-*.mp3`, `self-intro-*.mp3`, `cheers-*.mp3`, `where-were-you-*.mp3`, `sparkle-idol-*.mp3` (tracks.ts licence `'Mureka'`): every grown-up song | ⚠️ ❓ | Paid output is ours but must be labelled AI (done in the credits). The terms also limit use of the *service* to personal, non-commercial use without Mureka's written consent: get that consent in writing, or replace the tracks with commissioned music, before selling. The API platform's own terms weren't readable |
| 27 | Karaoke Duel's Cheeky lyric sets (adult party humour: drinking, bad dates, bathroom jokes, innuendo; never explicit), behind the host's Audience setting (decision, 2026-10-27) | `shared/src/modes/karaokeDuel/lyrics/*.ts` (`audience: 'cheeky'`), `stage/src/settings.ts` | ⚠️ | Not a licence issue, but it sets the game's age rating and store listing. Before selling: rate the game with Cheeky in it (IARC / ESRB / PEGI questionnaires), or ship rated builds without the cheeky sets; keep Cheeky off by default and behind its warning; have the fluent reviewer check the cheeky sets for anything cruder in Japanese than intended |
| 29 | The hosts' Kids and Cheeky voice in every mode: one Audience line each in the host, Onsen suspect and ink-coach AI prompts, 72 written Kids and Cheeky host lines, and a stricter Kids filter on typed player text (decision, 2026-10-27) | `server/ai/hostVoice.ts`, `server/ai/suspect.ts`, `server/ai/inkCoach.ts`, `content/src/hosts/audienceLines.ts`, `shared/src/moderation.ts`, `shared/src/audience.ts` | ⚠️ | Same age-rating question as rows 27 and 28, now across the whole night: with Cheeky on, the hosts joke about office life, dates and the odd drink in every mode, including the AI's own lines, which no one reviews line by line. Before selling: answer the rating questionnaires (IARC / ESRB / PEGI) with Cheeky in, or ship rated builds without it; keep Cheeky off by default and behind its warning; have the fluent reviewer check the Cheeky lines. A Kids setting doesn't make the game safe to market to children (COPPA / GDPR-K, row 20): the Kids filter is a word list, not a moderation service |

## Details

### 1. VOICEVOX voices

- **What:** Each host is a VOICEVOX character voice. Pon = 白上虎太郎 (fallback 玄野武宏), Chōchin-san =
  ちび式じい (fallback 冥鳴ひまり), Fude = 春日部つむぎ. Auditioned but not chosen: 青山龍星, ユーレイちゃん,
  ずんだもん, 四国めたん.
- **Terms:** The short policies the engine reports (`/speaker_info`, read 2026-10-26 by the AI thread)
  allow commercial and non-commercial use if the credit `VOICEVOX:<name>` is shown. Each character also
  has detailed terms on its own site, with banned uses (typically: adult or political content,
  defamation, presenting the voice as a real person). **Nobody has read those in full.** The official
  terms pages were unreachable from this session.
- **Known traps:** 青山龍星 reportedly needs prior permission for any use by a company, so it was
  avoided. ずんだもん has separate character-image rules. Using a character's picture, not just their
  voice, usually has extra terms.
- **To sell:** Credits screen shows `HOSTS[h].credit` for every voice used (it's in the code, the screen
  isn't built yet). Read each chosen character's full terms and record the date and URL here. If a voice
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
- **To sell:** Generate a third-party notices file at release. Re-run the check when adding packages
  (a GPL or AGPL runtime dependency would be a blocker for a closed-source game).

### 6. AI art from PixelLab

- **What:** Everything on the stage: the three host portraits, five yōkai sprites, the backdrop sets,
  the 24 Photo Caption pictures, and (since 2026-10-26) 31 icons in `stage/assets/icons/` (places,
  scenes, Onsen victims and evidence, Last Train, trophy) plus the 42 character portraits in
  `stage/assets/portraits/onsen/` and `portraits/omiai/` (two expressions each) that replaced emoji in
  Murder at the Onsen, Omiai Matchmaker, Who's the Tourist? and Phrase Bingo. Since 2026-10-26 also
  the 14 animation sheets in `stage/assets/anim/` (host idle, cheer and oops loops; yōkai hit and
  boss defeat), made by PixelLab's `animate-with-text-v3` endpoint from our own host and yōkai
  sprites as the first and last frame, and the smoke puff in `stage/assets/fx/`. The three lip-sync
  mouth sheets are edited from our own host portraits by `tools/art/polish.ts` (no new model). Apart from those, text-to-image only, no reference images. Most come from PixelLab's `pixflux` endpoint; Pon
  comes from its `image-to-pixelart` endpoint (see row 7). Prompts, sources and params are
  recorded in `stage/assets/manifest.json` and `tools/generate-caption-art.ts`.
  Since 2026-10-27 the stage draws one of six sets from `stage/assets/scenes/`
  ([graphics.md](graphics.md#backdrop)): the studio, comedy stage, karaoke box, onsen inn, tea room
  and train carriage. All six are text-only `pixflux` images, so the backdrop no longer traces back
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
  from Gemini output and its terms still apply to him. The backdrop was redrawn from text alone on
  2026-10-27 and its Gemini source deleted.
- **Terms: unverified.** The Gemini API Additional Terms page was unreachable from these sessions. From
  memory, to be checked: Google doesn't claim ownership of generated content, the Generative AI
  Prohibited Use Policy applies, free-tier prompts and outputs may be used to improve Google's
  products, and in some regions (EEA, UK, Switzerland) only the paid tier may be used. Images carry an
  invisible SynthID watermark.
- **To sell:** Read the terms and record them here. Prefer paid-tier keys for any art that ships.
  Same copyright caveats as PixelLab. Or close the row: redraw Pon with `pixflux` from text only, or
  include him in the commissioned art, then delete `tools/art/sources/pon-gemini.png`.

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
- **To sell:** Self-host WOFF2 subsets of the four fonts (no third-party request at all), and add the
  OFL notices to the third-party notices file. Any new font gets a row here.

### 12. Game formats and names

- Party-game mechanics, oogiri and TV quiz formats aren't protected by copyright, but names and
  branding are. Keep "Jackbox", "Quiplash", "Shōten" (笑点) and other show names out of the product,
  store page and marketing; "a party game" is enough. Pon's cushion gag is a nod to Shōten, which is
  fine as long as it isn't named.

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
  Wallpaper, Off to Osaka, Local Forecast - Elevator, Cipher, Kool Kats, Ishikari Lore and Ouroboros
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
### 24. Reader service on Oracle Cloud

- **What:** since 2026-10-27 the kanji reader (`npm run reader`, kuromoji) runs on an Oracle Cloud
  Always Free Ampere A1 VM (US West, Phoenix) behind Caddy. The Worker reaches it at
  `https://141-148-186-1.sslip.io` (`READER_URL`); sslip.io is a free DNS service that maps the
  hostname to the VM's reserved IP. Setup guide: the "Set up the kanji reader on Oracle Cloud" doc in
  the project.
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
  (Sparkle Idol: task 168628473495553's two takes), all model mureka-9.5 and made from takes already
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
