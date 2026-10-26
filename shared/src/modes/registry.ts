import type { ModeId } from '../protocol.js';
import { debugMode } from './debug/debug.js';
import { kanaRaidMode } from './kanaRaid/kanaRaid.js';
import { lastTrainMode } from './lastTrain/lastTrain.js';
import type { Mode, ModeInfo } from './mode.js';
import { oogiriMode } from './oogiri/oogiri.js';
import { wordGauntletMode } from './wordGauntlet/wordGauntlet.js';
import { concentrationMode } from './concentration/concentration.js';
import { phraseBingoMode } from './phraseBingo/phraseBingo.js';
import { karaokeDuelMode } from './karaokeDuel/karaokeDuel.js';
import { onsenMurderMode } from './onsenMurder/onsenMurder.js';

export const MODES: Record<ModeId, Mode<any, any>> = {
  oogiri: oogiriMode,
  'last-train': lastTrainMode,
  'kana-raid': kanaRaidMode,
  'word-gauntlet': wordGauntletMode,
  concentration: concentrationMode,
  'phrase-bingo': phraseBingoMode,
  'karaoke-duel': karaokeDuelMode,
  'onsen-murder': onsenMurderMode,
  debug: debugMode,
};

/** Modes on the VIP's menu, in show order (the debug round stays hidden). */
export const MENU: ModeInfo[] = [kanaRaidMode.info, oogiriMode.info, lastTrainMode.info, wordGauntletMode.info, concentrationMode.info, phraseBingoMode.info, karaokeDuelMode.info, onsenMurderMode.info];
