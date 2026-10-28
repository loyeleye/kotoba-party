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
import { touristMode } from './tourist/tourist.js';
import { oekakiMode } from './oekaki/oekaki.js';
import { omiaiMode } from './omiai/omiai.js';
import { narabeteMode } from './narabete/narabete.js';
import { bentoHausMode } from './bentoHaus/bentoHaus.js';
import { bentoHausVsMode } from './bentoHaus/bentoHausVs.js';
import { shodoMode } from './shodo/shodo.js';
import { dubClubMode } from './dubClub/dubClub.js';

export const MODES: Record<ModeId, Mode<any, any>> = {
  oogiri: oogiriMode,
  'last-train': lastTrainMode,
  'kana-raid': kanaRaidMode,
  'word-gauntlet': wordGauntletMode,
  concentration: concentrationMode,
  'phrase-bingo': phraseBingoMode,
  'karaoke-duel': karaokeDuelMode,
  'onsen-murder': onsenMurderMode,
  tourist: touristMode,
  oekaki: oekakiMode,
  omiai: omiaiMode,
  narabete: narabeteMode,
  'bento-haus': bentoHausMode,
  'bento-haus-vs': bentoHausVsMode,
  shodo: shodoMode,
  'dub-club': dubClubMode,
  debug: debugMode,
};

/** Modes on the VIP's menu, in show order (the debug round stays hidden). */
export const MENU: ModeInfo[] = [kanaRaidMode.info, oogiriMode.info, lastTrainMode.info, wordGauntletMode.info, concentrationMode.info, phraseBingoMode.info, karaokeDuelMode.info, onsenMurderMode.info, touristMode.info, oekakiMode.info, omiaiMode.info, shodoMode.info, narabeteMode.info, bentoHausMode.info, bentoHausVsMode.info, dubClubMode.info];

/** The menu games a room of `players` can start: what Surprise Me! rolls between. */
export const surprisePool = (players: number): ModeInfo[] => MENU.filter((m) => players >= m.minPlayers && players <= m.maxPlayers);
