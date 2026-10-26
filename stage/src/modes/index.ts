import type { ModeId } from '../../../shared/src/protocol.js';
import { debugStage } from './debug.js';
import { kanaRaidStage } from './kanaRaid.js';
import { lastTrainStage } from './lastTrain.js';
import { oogiriStage } from './oogiri.js';
import { wordGauntletStage } from './wordGauntlet.js';
import { concentrationStage } from './concentration.js';
import { phraseBingoStage } from './phraseBingo.js';
import { karaokeDuelStage } from './karaokeDuel.js';
import { onsenMurderStage } from './onsenMurder.js';
import { touristStage } from './tourist.js';
import { oekakiStage } from './oekaki.js';
import type { StageMode } from './types.js';

export const STAGE_MODES: Record<ModeId, StageMode<any>> = {
  debug: debugStage,
  oogiri: oogiriStage,
  'last-train': lastTrainStage,
  'kana-raid': kanaRaidStage,
  'word-gauntlet': wordGauntletStage,
  concentration: concentrationStage,
  'phrase-bingo': phraseBingoStage,
  'karaoke-duel': karaokeDuelStage,
  'onsen-murder': onsenMurderStage,
  tourist: touristStage,
  oekaki: oekakiStage,
};
