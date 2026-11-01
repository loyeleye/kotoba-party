// Hard-role and N4 deck lines tag their frames by id (docs/n4-hard-roles.md). Every tag must be a frame
// frames.ts knows, so the tag and the matcher agree; sign-kanji marks the sign boards (kanji, not a frame).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FRAME_BY_ID } from '../shared/src/japanese/frames.js';

const FILES = [
  'shared/src/modes/bentoHaus/hardRoles.ts',
  'content/src/last-train/station-announcement.ts',
  'content/src/last-train/lost-and-found.ts',
  'content/src/last-train/meet-the-innkeeper.ts',
  'content/src/onsen/cases.ts',
  'shared/src/modes/omiai/cards.ts',
  'shared/src/modes/dubClub/scenes.ts',
  'shared/src/modes/narabete/defence.ts',
  'shared/src/modes/happyokai/content.ts',
  'shared/src/modes/tourist/places.ts',
  'shared/src/modes/hajimemashite/cards.ts',
];

describe('hard-role frame tags', () => {
  it('name only frames that frames.ts knows', () => {
    const unknown: string[] = [];
    let seen = 0;
    for (const f of FILES) {
      const src = readFileSync(join(__dirname, '..', f), 'utf8');
      for (const m of src.matchAll(/frames: \[([^\]]*)\]/g)) {
        for (const id of m[1]!.matchAll(/'([a-z-]+)'/g)) {
          seen++;
          if (id[1] !== 'sign-kanji' && !(id[1]! in FRAME_BY_ID)) unknown.push(`${f}: ${id[1]}`);
        }
      }
    }
    expect(seen).toBeGreaterThan(50);
    expect(unknown).toEqual([]);
  });
});
