import type { ModeId } from '../../../shared/src/protocol.js';
import { debugPhone } from './debug.js';
import { kanaRaidPhone } from './kanaRaid.js';
import { lastTrainPhone } from './lastTrain.js';
import { oogiriPhone } from './oogiri.js';
import { wordGauntletPhone } from './wordGauntlet.js';
import { concentrationPhone } from './concentration.js';
import { phraseBingoPhone } from './phraseBingo.js';
import { karaokeDuelPhone } from './karaokeDuel.js';
import { onsenMurderPhone } from './onsenMurder.js';
import { touristPhone } from './tourist.js';
import { oekakiPhone } from './oekaki.js';
import { omiaiPhone } from './omiai.js';
import { shodoPhone } from './shodo.js';
import { narabetePhone } from './narabete.js';
import { bentoHausPhone, bentoHausVsPhone } from './bentoHaus.js';
import { dubClubPhone } from './dubClub.js';
import { hajimemashitePhone } from './hajimemashite.js';
import type { PhoneMode } from './types.js';

export const PHONE_MODES: Record<ModeId, PhoneMode<any>> = {
  debug: debugPhone,
  oogiri: oogiriPhone,
  'last-train': lastTrainPhone,
  'kana-raid': kanaRaidPhone,
  'word-gauntlet': wordGauntletPhone,
  concentration: concentrationPhone,
  'phrase-bingo': phraseBingoPhone,
  'karaoke-duel': karaokeDuelPhone,
  'onsen-murder': onsenMurderPhone,
  tourist: touristPhone,
  oekaki: oekakiPhone,
  omiai: omiaiPhone,
  shodo: shodoPhone,
  narabete: narabetePhone,
  'bento-haus': bentoHausPhone,
  'bento-haus-vs': bentoHausVsPhone,
  'dub-club': dubClubPhone,
  hajimemashite: hajimemashitePhone,
};
