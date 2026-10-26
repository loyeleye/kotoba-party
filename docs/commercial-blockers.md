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
| 3 | KanjiVG stroke data | `content/src/kana/strokes.ts` | 🟡 | Credit KanjiVG; keep the derived data CC BY-SA 3.0 |
| 4 | kuromoji + IPADIC dictionary | `server/src/reading.ts`, reader service | 🟡 | Ship the Apache-2.0 and NAIST notices |
| 5 | npm dependencies | `package-lock.json` | ✅ | Ship a third-party notices file |
| 6 | AI art: PixelLab (all stage art: hosts, yōkai, backdrop, Photo Caption pictures, 31 game icons, 42 Onsen and Omiai character portraits) | `stage/assets/`, `content/media/photo-caption/` | ⚠️ | Decided: placeholder until commercial, then commission the art |
| 7 | AI art: Gemini (source images for Pon and the backdrop) | `tools/art/sources/` | ❓ ⚠️ | Read Gemini API terms, or redraw Pon and the backdrop without a Gemini source |
| 8 | Claude API (host lines, answer judge, ink coach) | `server/ai/` | 🟡 ⚠️ | Commercial Terms on a business account; tell players AI can be wrong; per-game cost |
| 9 | Folklore yōkai and Japanese cultural content | `content/src/kana/`, host personas | ✅ ⚠️ | Folklore is public domain; don't copy modern designs; check the game and mode names |
| 10 | Kana course order and links (ToKini Andy) | `content/src/kana/raid.ts` | ✅ | Links only; ask before any paid tie-in or using his name in marketing |
| 11 | Fonts: Noto Sans JP, Noto Sans, Pixelify Sans (Google Fonts CDN) | `stage/index.html`, `controller/index.html` | 🟡 ❓ | OFL 1.1 allows selling; ship the OFL notices. Self-host the fonts before an EU launch (the Google Fonts CDN's privacy terms weren't readable) |
| 12 | Game formats and names (Jackbox, oogiri, Shōten) | Docs, personas | ⚠️ | Don't use "Jackbox" or TV show names in the product or marketing |
| 13 | Karaoke Duel songs | `shared/src/modes/karaokeDuel/songs.ts` | ✅ | Keep songs original; no covers without a music licence |
| 14 | Cloudflare Workers + Durable Objects | `wrangler.jsonc`, `cloudflare/` | ⚠️ | Paid plan once traffic grows; not a licence bar |
| 15 | ETL Character Database (handwriting grader) | Planned, Kana Yōkai Raid ML parts | 🕓 ⛔ | Likely research-only: don't train a shipped model on it without AIST's permission |
| 16 | Kuchibue handwriting database | Planned | 🕓 ❓ | Read TUAT's terms before use |
| 17 | Reference repos (job-hunt-agent, system-design-study, isekaid-into-the-cloud) | Ideas only | ✅ | Ladi's own repos; keep it to ideas, or check any third-party code they hold |
| 18 | Content reviewed by a fluent speaker | All content is `draft` | ⚠️ | Not a licence issue, but a paid product needs the reviewer pass (open question C1) |
| 19 | Repo licence | No `LICENSE` file | ✅ | All rights reserved by default. Keep it that way unless you choose to open-source |
| 20 | Speech to text: self-hosted Whisper (OpenAI weights, whisper.cpp or speaches) | `server/src/stt.ts`, separate service | ✅ ⚠️ | Ship MIT notices if ever bundled; stay on OpenAI's weights; privacy notice and a plan for under-13s before launch |

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
- **Conditions:** Attribution, and anything derived from it stays CC BY-SA. `strokes.ts` is derived, and
  its header already says so. The share-alike applies to that data, not to the rest of the game, as long
  as it stays a separate data file.
- **To sell:** Credit KanjiVG on the credits screen and in the notices file. Accept that anyone may
  reuse the stroke data.

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

- **What:** Everything on the stage: the three host portraits, five yōkai sprites, the studio backdrop
  the 24 Photo Caption pictures, and (since 2026-10-26) 31 icons in `stage/assets/icons/` (places,
  scenes, Onsen victims and evidence, Last Train, trophy) plus the 42 character portraits in
  `stage/assets/portraits/onsen/` and `portraits/omiai/` (two expressions each) that replaced emoji in
  Murder at the Onsen, Omiai Matchmaker, Who's the Tourist? and Phrase Bingo. Text-to-image only, no
  reference images. Most come from PixelLab's `pixflux` endpoint; Pon and the
  backdrop come from its `image-to-pixelart` endpoint (see row 7). Prompts, sources and params are
  recorded in `stage/assets/manifest.json` and `tools/generate-caption-art.ts`.
- **Terms (read 2026-10-26, <https://www.pixellab.ai/termsofservice>):** "You own the copyrights to your
  creations, permitting usage for both commercial and non-commercial purposes." Limits: don't train
  other models on the outputs, use only the official API, and ask before building a reselling service.
  We are responsible for not infringing anyone else's rights.
- **Risks:** see [AI art: non-commercial vs commercial](#ai-art-non-commercial-vs-commercial) below.

### 7. AI art from Gemini

- **What:** Since 2026-10-26 no shipped file is raw Gemini output: the hosts and backdrop moved to
  PixelLab pixel art (see [graphics.md](graphics.md)). But PixelLab drew Pon and the backdrop by
  converting the earlier Gemini images (`gemini-3-pro-image`), kept in `tools/art/sources/` and not
  served. So those two are derived from Gemini output and its terms still apply to them.
- **Terms: unverified.** The Gemini API Additional Terms page was unreachable from these sessions. From
  memory, to be checked: Google doesn't claim ownership of generated content, the Generative AI
  Prohibited Use Policy applies, free-tier prompts and outputs may be used to improve Google's
  products, and in some regions (EEA, UK, Switzerland) only the paid tier may be used. Images carry an
  invisible SynthID watermark.
- **To sell:** Read the terms and record them here. Prefer paid-tier keys for any art that ships.
  Same copyright caveats as PixelLab. Or close the row: redraw Pon and the backdrop with `pixflux`
  from text only, or include them in the commissioned art, then delete `tools/art/sources/`.

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
  titles and numbers (room code, timer, scores). Both pages load them from the Google
  Fonts CDN (`fonts.googleapis.com`, `fonts.gstatic.com`), with system fonts as the fallback.
- **Terms (read 2026-10-26):** all three are under the SIL Open Font License 1.1
  (<https://raw.githubusercontent.com/google/fonts/main/ofl/notosansjp/OFL.txt>,
  <https://raw.githubusercontent.com/google/fonts/main/ofl/notosans/OFL.txt>,
  <https://raw.githubusercontent.com/google/fonts/main/ofl/pixelifysans/OFL.txt>; licence text at
  <https://openfontlicense.org>). OFL allows commercial use, embedding and bundling; the fonts can't
  be sold on their own, and the copyright and licence notice must travel with any copy we ship.
- **❓ The CDN:** loading fonts from Google's servers sends each player's IP address to Google. A
  German court (LG München, 2022) found that a GDPR breach without consent. Google's Fonts privacy
  FAQ (<https://developers.google.com/fonts/faq/privacy>) was blocked from this session, so its
  terms are unread.
- **To sell:** Self-host WOFF2 subsets of the three fonts (no third-party request at all), and add the
  OFL notices to the third-party notices file. Any new font gets a row here.

### 12. Game formats and names

- Party-game mechanics, oogiri and TV quiz formats aren't protected by copyright, but names and
  branding are. Keep "Jackbox", "Quiplash", "Shōten" (笑点) and other show names out of the product,
  store page and marketing; "a party game" is enough. Pon's cushion gag is a nod to Shōten, which is
  fine as long as it isn't named.

### 13. Karaoke Duel songs

- Songs are original. Any real song (even a nursery song still in copyright, or a well-known
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
are now PixelLab pixel art. Only Pon's and the backdrop's Gemini source images remain (row 7).

**Recommendation:** keep using AI pixel art (PixelLab) for now. Before selling, have the three hosts,
the logo and the title screen hand-finished or commissioned, keep the AI sprites and Photo Caption
pictures if they still look right, and add the Steam/itch disclosure.
