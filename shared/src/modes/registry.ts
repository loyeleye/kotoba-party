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
import { happyokaiMode } from './happyokai/happyokai.js';
import { shodoMode } from './shodo/shodo.js';
import { dubClubMode } from './dubClub/dubClub.js';
import { hajimemashiteMode } from './hajimemashite/hajimemashite.js';
import { lateAgainMode } from './lateAgain/lateAgain.js';
import { ghostHotlineMode } from './ghostHotline/hotline.js';
import { yokaiCourtMode } from './yokaiCourt/court.js';

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
  happyokai: happyokaiMode,
  shodo: shodoMode,
  'dub-club': dubClubMode,
  hajimemashite: hajimemashiteMode,
  'late-again': lateAgainMode,
  'ghost-hotline': ghostHotlineMode,
  'yokai-court': yokaiCourtMode,
  debug: debugMode,
};

/** Modes on the VIP's menu (the debug round stays hidden): fewest players needed first, then A–Z by title. */
export const MENU: ModeInfo[] = [kanaRaidMode.info, oogiriMode.info, hajimemashiteMode.info, lastTrainMode.info, wordGauntletMode.info, concentrationMode.info, phraseBingoMode.info, karaokeDuelMode.info, onsenMurderMode.info, touristMode.info, oekakiMode.info, omiaiMode.info, shodoMode.info, narabeteMode.info, bentoHausMode.info, bentoHausVsMode.info, dubClubMode.info, happyokaiMode.info, lateAgainMode.info, ghostHotlineMode.info, yokaiCourtMode.info].sort(
  (a, b) => a.minPlayers - b.minPlayers || a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }),
);

/** Why a room can't start this game, or null if it can: `speakers` is how many players have their mic on. */
export function noFit(m: Pick<ModeInfo, 'minPlayers' | 'maxPlayers' | 'minSpeakers'>, players: number, speakers = players): 'not-enough-players' | 'too-many-players' | 'not-enough-mics' | null {
  if (players < m.minPlayers) return 'not-enough-players';
  if (players > m.maxPlayers) return 'too-many-players';
  if (speakers < (m.minSpeakers ?? 0)) return 'not-enough-mics';
  return null;
}

/** Players with their mic on: everyone not in quiet mode. */
export const speakersIn = (players: readonly { mic?: 'ok' | 'quiet' | null }[]): number => players.filter((p) => p.mic !== 'quiet').length;

/** The menu games a room of `players` can start: what Surprise Me! rolls between. */
export const surprisePool = (players: number, speakers = players): ModeInfo[] => MENU.filter((m) => !noFit(m, players, speakers));
