// Builds the content library the modes draw on from content/src (the content thread's packs)
// plus the Phase 0 debug prompts.

import { readFileSync } from 'node:fs';
import * as content from '../../content/src/index.js';
import type { ContentLibrary } from '../../shared/src/modes/mode.js';

const KEYS = [
  'packs',
  'oogiriPrompts',
  'setPhraseTiles',
  'kana',
  'kanaChapters',
  'lookAlikeSets',
  'minimalPairs',
  'bossWords',
  'lastTrainMinigames',
  'lastTrainScenarios',
  'hostLines',
  'hostAwards',
] as const satisfies readonly (keyof ContentLibrary)[];

export function loadContent(root: string): ContentLibrary {
  const exported = content as unknown as Record<string, unknown>;
  const lib = { debugPrompts: [] } as unknown as Record<string, unknown>;
  for (const key of KEYS) {
    const value = exported[key];
    lib[key] = Array.isArray(value) ? value : [];
  }
  const debug = JSON.parse(readFileSync(`${root}content/debug/prompts.json`, 'utf8')) as { prompts: ContentLibrary['debugPrompts'] };
  lib.debugPrompts = debug.prompts;
  return lib as unknown as ContentLibrary;
}
