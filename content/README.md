# content/

Hand-written game content for Kotoba Party v1, as typed TypeScript data. Import everything from
`content/src/index.ts`; the schemas are in `content/src/types.ts`.

| Folder | What's in it |
|---|---|
| `src/kana/` | Kana Yōkai Raid: all 231 kana, 13 chapters with folklore yōkai, look-alike sets, minimal pairs, boss words, memory cards, and Ink Storm stroke references (`strokes.ts`, generated from KanjiVG, CC BY-SA 3.0, by `tools/content-strokes.ts`: don't edit by hand) |
| `src/packs/` | Topic packs (food, family, travel): words with kana readings and verb/adjective forms, phrases, baseline words for the spoken test |
| `src/oogiri/` | Oogiri Night prompts per pack (50 each) and Photo Caption set-phrase tiles |
| `src/last-train/` | Last Train minigames (8) and scenarios (3 for everyone, 1 Kids, 2 Cheeky) |
| `src/hosts/` | Host profiles, written line bank for Pon, Chōchin-san and Fude, recap awards |
| `media/photo-caption/` | Pixel-art pictures for the Photo Caption prompts (drawn by `tools/generate-caption-art.ts`) |
| `debug/` | Phase 0 placeholder prompts (owned by the server) |

Rules for every item:

- Every Japanese string is a `JpText`: `text` (what the stage shows), `kana` (the full reading,
  which TTS voices and the answer checker compares), `en` (subtitle), and optional `furigana`.
- Ids are stable. Audio is cached by id, so never renumber; add new items with new ids.
- Everything is `status: 'draft'` until a fluent speaker has checked it.
- Keep N4 grammar out of kana and n5 text (the test flags the common markers).

Checks:

- `npx vitest run content` — structure, readings vs text, furigana, tile references, N4 markers,
  accepted answers, host line length and slots.
- `npm run content:readings` — compares every kanji reading with the kuromoji dictionary and lists
  differences for a human to review (most are the dictionary misreading counters and dates).
