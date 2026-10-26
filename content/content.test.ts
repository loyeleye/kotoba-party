// Structural checks for all content. Japanese readings are cross-checked
// against a dictionary separately (npm run content:readings), because a
// tokenizer can't settle ambiguous readings like 一日 on its own.

import { describe, expect, it } from 'vitest';
import {
  bossWords,
  hostLines,
  hostProfiles,
  kana,
  kanaById,
  kanaChapters,
  lastTrainMinigames,
  lastTrainScenarios,
  lookAlikeSets,
  minimalPairs,
  oogiriPrompts,
  setPhraseTiles,
  packs,
} from './src/index.js';
import { collectJpTexts, isKanaReading, toHiragana, stripForCompare, n4Markers } from './lint.js';

const all = {
  kana,
  kanaChapters,
  lookAlikeSets,
  minimalPairs,
  bossWords,
  setPhraseTiles,
  packs,
  oogiriPrompts,
  lastTrainMinigames,
  lastTrainScenarios,
  hostProfiles,
  hostLines,
};

const dupes = (ids: string[]) => ids.filter((id, i) => ids.indexOf(id) !== i);

describe('every JpText', () => {
  const texts = collectJpTexts(all);

  it('has a kana reading with no kanji or romaji', () => {
    const bad = texts.filter((t) => !isKanaReading(t.jp.kana)).map((t) => `${t.path}: ${t.jp.kana}`);
    expect(bad).toEqual([]);
  });

  it('has a reading that matches text when text is all kana', () => {
    const bad = texts
      .filter((t) => isKanaReading(t.jp.text))
      .filter((t) => toHiragana(stripForCompare(t.jp.text)) !== toHiragana(stripForCompare(t.jp.kana)))
      .map((t) => `${t.path}: ${t.jp.text} ≠ ${t.jp.kana}`);
    expect(bad).toEqual([]);
  });

  it('has furigana that rebuild text and reading exactly', () => {
    const bad = texts
      .filter((t) => t.jp.furigana)
      .filter((t) => {
        const f = t.jp.furigana!;
        const base = f.map(([b]) => b).join('');
        const reading = f.map(([b, r]) => r || b).join('');
        return base !== t.jp.text || toHiragana(stripForCompare(reading)) !== toHiragana(stripForCompare(t.jp.kana));
      })
      .map((t) => `${t.path}: ${t.jp.text}`);
    expect(bad).toEqual([]);
  });

  it('has an English subtitle', () => {
    expect(texts.filter((t) => !t.jp.en.trim()).map((t) => t.path)).toEqual([]);
  });
});

describe('kana decks', () => {
  it('covers about 230 kana with unique ids and two-way twins', () => {
    expect(kana.length).toBe(231);
    expect(dupes(kana.map((k) => k.id))).toEqual([]);
    for (const k of kana) if (k.twinId) expect(kanaById.get(k.twinId)?.twinId).toBe(k.id);
    expect(kana.filter((k) => k.kind === 'basic' && k.script === 'hiragana')).toHaveLength(46);
  });

  it('puts every kana in exactly one chapter', () => {
    const ids = kanaChapters.flatMap((c) => c.kanaIds);
    expect(dupes(ids)).toEqual([]);
    expect(ids.length).toBe(kana.length);
  });

  it('references real kana in look-alike sets', () => {
    for (const s of lookAlikeSets) for (const id of s.kanaIds) expect(kanaById.has(id), `${s.id}: ${id}`).toBe(true);
  });

  it('only deals minimal pairs and boss words once every kana in them is studied', () => {
    const chapterOf = (word: string) =>
      Math.max(...[...toHiragana(word)].map((c) => kana.find((k) => k.char === c)?.chapter ?? 0));
    for (const p of minimalPairs)
      expect(p.minChapter, p.id).toBeGreaterThanOrEqual(Math.max(chapterOf(p.a.kana), chapterOf(p.b.kana)));
    for (const b of bossWords) expect(b.pieces.join(''), b.id).toBe(b.word.text);
  });
});

describe('topic packs', () => {
  for (const pack of packs) {
    describe(pack.id, () => {
      const ids = pack.words.map((w) => w.id);

      it('is sized like the design doc says (40–80 words, 10–20 phrases)', () => {
        expect(pack.words.length).toBeGreaterThanOrEqual(40);
        expect(pack.words.length).toBeLessThanOrEqual(80);
        expect(pack.phrases.length).toBeGreaterThanOrEqual(10);
        expect(pack.phrases.length).toBeLessThanOrEqual(20);
      });

      it('has unique ids and real baseline words', () => {
        expect(dupes([...ids, ...pack.phrases.map((p) => p.id)])).toEqual([]);
        for (const id of pack.baselineWordIds) expect(ids, id).toContain(id);
      });

      it('has at most one stereotype word', () => {
        expect(pack.words.filter((w) => w.stereotype).length).toBeLessThanOrEqual(1);
      });

      it('gives verbs and adjectives their forms', () => {
        const conjugating = pack.words.filter((w) => /^(verb|adj)/.test(w.pos));
        expect(conjugating.filter((w) => !w.forms || Object.keys(w.forms).length === 0).map((w) => w.id)).toEqual([]);
        expect(pack.words.filter((w) => w.pos.startsWith('verb')).length).toBeGreaterThanOrEqual(8);
      });

      it('keeps N4 grammar out of kana and N5 items', () => {
        const low = [
          ...pack.words.filter((w) => w.level !== 'n4').map((w) => [w.id, w.jp.kana] as const),
          ...pack.phrases.filter((p) => p.level !== 'n4').map((p) => [p.id, p.jp.kana] as const),
        ];
        expect(low.filter(([, k]) => n4Markers(k).length).map(([id, k]) => `${id}: ${k}`)).toEqual([]);
      });
    });
  }
});

describe('Oogiri prompts', () => {
  it('have unique ids', () => {
    expect(dupes(oogiriPrompts.map((p) => p.id))).toEqual([]);
  });

  it('have an N5 version with a blank, and blanks in every version', () => {
    for (const p of oogiriPrompts) {
      expect(p.versions.n5, p.id).toBeDefined();
      for (const [level, v] of Object.entries(p.versions)) expect(v.text, `${p.id}.${level}`).toContain('＿＿＿');
    }
  });

  it('keep N4 grammar out of kana and N5 versions', () => {
    const bad = oogiriPrompts.flatMap((p) =>
      (['kana', 'n5'] as const)
        .map((l) => p.versions[l])
        .filter((v) => v && n4Markers(v.kana).length)
        .map((v) => `${p.id}: ${v!.kana} (${n4Markers(v!.kana).join(', ')})`),
    );
    expect(bad).toEqual([]);
  });

  it('only use tiles from their own pack, never baseline words', () => {
    for (const p of oogiriPrompts) {
      const pack = packs.find((t) => t.id === p.packId);
      expect(pack, p.id).toBeDefined();
      const ids = new Set(pack!.words.map((w) => w.id));
      for (const id of [...p.fitTileIds, ...p.swerveTileIds]) {
        expect(ids.has(id), `${p.id}: ${id}`).toBe(true);
        expect(pack!.baselineWordIds, `${p.id}: ${id} is a baseline word`).not.toContain(id);
      }
      expect(p.fitTileIds.length, p.id).toBeGreaterThanOrEqual(3);
      expect(p.swerveTileIds.length, p.id).toBeGreaterThanOrEqual(3);
    }
  });

  it('give each pack 50+ hand-written prompts (the AI fallback)', () => {
    for (const pack of packs) expect(oogiriPrompts.filter((p) => p.packId === pack.id).length).toBeGreaterThanOrEqual(50);
  });
});

describe('Last Train', () => {
  const items = [...lastTrainMinigames.flatMap((m) => m.items), ...lastTrainScenarios.flatMap((s) => s.platformDash)];

  it('has unique minigame and item ids', () => {
    expect(dupes(lastTrainMinigames.map((m) => m.id))).toEqual([]);
    expect(dupes(items.map((i) => i.id))).toEqual([]);
  });

  it('accepts only kana readings, with no punctuation or spaces', () => {
    const bad = items.flatMap((i) => i.accepted.filter((a) => !/^[ぁ-ゖァ-ヺー]+$/.test(a)).map((a) => `${i.id}: ${a}`));
    expect(bad).toEqual([]);
  });

  it('accepts its own model answer', () => {
    const bad = items
      .filter((i) => !i.accepted.map(toHiragana).includes(toHiragana(stripForCompare(i.model.kana))))
      .map((i) => `${i.id}: ${i.model.kana} not in [${i.accepted.join(', ')}]`);
    expect(bad).toEqual([]);
  });

  it('only stops at minigames that exist, and scenario 1 uses Phase 1 minigames only', () => {
    const ids = new Set(lastTrainMinigames.map((m) => m.id));
    for (const s of lastTrainScenarios) for (const stop of s.stops) expect(ids.has(stop.minigameId), stop.id).toBe(true);
    const phase1 = new Set(lastTrainMinigames.filter((m) => m.phase === 1).map((m) => m.id));
    for (const stop of lastTrainScenarios[0]!.stops) expect(phase1.has(stop.minigameId), stop.id).toBe(true);
  });
});

describe('host lines', () => {
  it('have unique ids', () => {
    expect(dupes(hostLines.map((l) => l.id))).toEqual([]);
  });

  it('stay under 12 words in the subtitle', () => {
    const bad = hostLines.filter((l) => l.jp.en.split(/\s+/).filter(Boolean).length > 12).map((l) => `${l.id}: ${l.jp.en}`);
    expect(bad).toEqual([]);
  });

  it('carry their slots through text, reading and subtitle', () => {
    for (const l of hostLines) {
      const found = new Set([...l.jp.text.matchAll(/\{\w+\}/g)].map((m) => m[0]));
      expect([...found].sort(), l.id).toEqual([...(l.slots ?? [])].sort());
      for (const s of l.slots ?? []) {
        expect(l.jp.kana, l.id).toContain(s);
        expect(l.jp.en, l.id).toContain(s);
      }
    }
  });

  it('only use tiers on reveal reactions', () => {
    expect(hostLines.filter((l) => l.tier && l.event !== 'reveal_react').map((l) => l.id)).toEqual([]);
    expect(hostLines.filter((l) => l.event === 'reveal_react' && !l.tier).map((l) => l.id)).toEqual([]);
  });

  it('give every host every shared event', () => {
    const shared = ['lobby_welcome', 'intro', 'prompt_read', 'reveal_react', 'natural_version', 'kakegoe_call', 'miss_kind', 'play_again'] as const;
    for (const h of hostProfiles)
      for (const e of shared) expect(hostLines.some((l) => l.host === h.id && l.event === e), `${h.id} ${e}`).toBe(true);
  });
});
