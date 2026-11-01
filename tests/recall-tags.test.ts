// Recall is opt-in: an untagged phrase counts as read. So every phrase a mode can log as 'said' must say
// whether it was said from memory or read off the screen, or the learning path silently loses credit.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', 'shared', 'src', 'modes');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
  });
}

/** Each ctx.phrase( call with its argument text (to the matching close paren). */
function phraseCalls(src: string): string[] {
  const out: string[] = [];
  for (let i = src.indexOf('ctx.phrase('); i >= 0; i = src.indexOf('ctx.phrase(', i + 1)) {
    let depth = 0;
    let j = i + 'ctx.phrase'.length;
    for (; j < src.length; j++) {
      if (src[j] === '(') depth++;
      else if (src[j] === ')' && --depth === 0) break;
    }
    out.push(src.slice(i, j + 1));
  }
  return out;
}

describe('phrase recall tags', () => {
  it("every ctx.phrase that can log 'said' sets recall", () => {
    const untagged: string[] = [];
    for (const f of files(ROOT)) {
      const src = readFileSync(f, 'utf8');
      for (const call of phraseCalls(src)) {
        if (!/'said'|\boutcome\b(?!:)/.test(call)) continue;
        if (/recall\s*[:,}]|recall\(|phraseOf\(|entry\(|\.\.\.entry/.test(call)) continue;
        untagged.push(`${f.slice(ROOT.length + 1)}: ${call.slice(0, 120)}`);
      }
    }
    expect(untagged).toEqual([]);
  });
});
