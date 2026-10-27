import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { awardKana } from '../shared/src/dom.js';
import { autoFurigana } from '../shared/src/japanese/furigana.js';
import { hasKanji } from '../shared/src/japanese/kana.js';

// Every award title the modes hand out, read from their source.
const modesDir = new URL('../shared/src/modes/', import.meta.url);
const titles = [
  ...new Set(
    readdirSync(modesDir, { recursive: true, encoding: 'utf8' })
      .filter((f) => f.endsWith('.ts'))
      .flatMap((f) => [...readFileSync(new URL(f, modesDir), 'utf8').matchAll(/title: '([^']+)', en:/g)].map((m) => m[1]!)),
  ),
];

describe('award title furigana', () => {
  it('reads うそつき名人 as うそつきめいじん', () => {
    expect(awardKana('うそつき名人')).toBe('うそつきめいじん');
    expect(autoFurigana('うそつき名人', awardKana('うそつき名人'))).toContainEqual(['名人', 'めいじん']);
  });

  it('gives every award title a kana reading', () => {
    expect(titles).toContain('うそつき名人');
    for (const title of titles) expect(hasKanji(awardKana(title)), title).toBe(false);
  });
});
