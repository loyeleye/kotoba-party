import type { ModeId } from '../../../shared/src/protocol.js';
import { debugPhone } from './debug.js';
import { kanaRaidPhone } from './kanaRaid.js';
import { lastTrainPhone } from './lastTrain.js';
import { oogiriPhone } from './oogiri.js';
import { wordGauntletPhone } from './wordGauntlet.js';
import { concentrationPhone } from './concentration.js';
import type { PhoneMode } from './types.js';

export const PHONE_MODES: Record<ModeId, PhoneMode<any>> = {
  debug: debugPhone,
  oogiri: oogiriPhone,
  'last-train': lastTrainPhone,
  'kana-raid': kanaRaidPhone,
  'word-gauntlet': wordGauntletPhone,
  concentration: concentrationPhone,
};
