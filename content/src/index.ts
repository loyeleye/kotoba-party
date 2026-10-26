// Entry point for Kotoba Party content. The server, stage and controller
// import from here; nothing else in content/src should be imported directly.

import type { HostEvent, HostId, HostLine, LastTrainMinigame, Level, OogiriPrompt, OogiriRound, TopicPack } from './types.js';
import { foodPack } from './packs/food.js';
import { familyPack } from './packs/family.js';
import { travelPack } from './packs/travel.js';
import { foodPrompts } from './oogiri/food.js';
import { familyPrompts } from './oogiri/family.js';
import { travelPrompts } from './oogiri/travel.js';
import { lastTrainMinigames } from './last-train/index.js';
import { hostLines } from './hosts/index.js';

export type * from './types.js';

export { kana, kanaById } from './kana/kana.js';
export { kanaChapters, lookAlikeSets, minimalPairs, bossWords } from './kana/raid.js';
export { kanaMnemonics } from './kana/mnemonics.js';
export { kanaStrokes } from './kana/strokes.js';
export { setPhraseTiles } from './oogiri/set-phrases.js';
export { lastTrainMinigames, lastTrainScenarios } from './last-train/index.js';
export { hostLines, hostProfiles, hostAwards } from './hosts/index.js';
export { onsenCases } from './onsen/cases.js';

/** The Phase 1 topic packs, in the order the VIP's picker shows them. */
export const packs: TopicPack[] = [foodPack, familyPack, travelPack];

export const oogiriPrompts: OogiriPrompt[] = [...foodPrompts, ...familyPrompts, ...travelPrompts];

export function getPack(id: string): TopicPack | undefined {
  return packs.find((p) => p.id === id);
}

/** Packs with at least one word at or below the given level. */
export function listPacks(level: Level): TopicPack[] {
  const rank: Record<Level, number> = { kana: 0, n5: 1, n4: 2 };
  return packs.filter((p) => p.words.some((w) => rank[w.level] <= rank[level]));
}

export function oogiriPromptsFor(packId: string, round?: OogiriRound): OogiriPrompt[] {
  return oogiriPrompts.filter((p) => p.packId === packId && (round === undefined || p.round === round));
}

export function getMinigame(id: string): LastTrainMinigame | undefined {
  return lastTrainMinigames.find((m) => m.id === id);
}

export function hostLinesFor(host: HostId, event: HostEvent, tier?: HostLine['tier']): HostLine[] {
  return hostLines.filter((l) => l.host === host && l.event === event && (tier === undefined || l.tier === tier));
}
