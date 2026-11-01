// One place that knows which policy plays which mode, for the bot CLI and the path simulation.

import type { ContentLibrary } from '../../../shared/src/modes/mode.js';
import type { ModeId } from '../../../shared/src/protocol.js';
import type { ModePolicy } from '../bot.js';
import { bentoHausPolicy } from './bentoHaus.js';
import { concentrationPolicy } from './concentration.js';
import { dubClubPolicy } from './dubClub.js';
import { ghostHotlinePolicy } from './ghostHotline.js';
import { hajimemashitePolicy } from './hajimemashite.js';
import { happyokaiPolicy } from './happyokai.js';
import { kanaRaidPolicy } from './kanaRaid.js';
import { karaokeDuelPolicy } from './karaokeDuel.js';
import { lastTrainPolicy } from './lastTrain.js';
import { lateAgainPolicy } from './lateAgain.js';
import { narabetePolicy } from './narabete.js';
import { oekakiPolicy } from './oekaki.js';
import { omiaiPolicy } from './omiai.js';
import { onsenMurderPolicy } from './onsenMurder.js';
import { oogiriPolicy } from './oogiri.js';
import { phraseBingoPolicy } from './phraseBingo.js';
import { shodoPolicy } from './shodo.js';
import { touristPolicy } from './tourist.js';
import { wordGauntletPolicy } from './wordGauntlet.js';

/**
 * A policy maker for one room: a fresh policy per bot (each keeps its own memory, as Concentration's cards),
 * except the modes where bots "hear" each other through one shared policy (Phrase Bingo, Narabete, Dub Club).
 */
export function policyMaker(content: () => ContentLibrary, opts: { thinkMs?: number; speak?: boolean } = {}): (seat: number, id: ModeId) => ModePolicy | undefined {
  let sharedNarabete: ModePolicy | undefined;
  let sharedDubClub: ModePolicy | undefined;
  let sharedPhraseBingo: ModePolicy | undefined;
  const fast = opts.thinkMs !== undefined;
  return (seat, id) => {
    switch (id) {
      case 'oogiri':
        return oogiriPolicy();
      case 'last-train':
        return lastTrainPolicy({ content: content(), seed: seat, ...(fast ? { thinkMs: [0, 0] as [number, number] } : {}) });
      case 'kana-raid':
        return kanaRaidPolicy();
      case 'word-gauntlet':
        return wordGauntletPolicy(content());
      case 'onsen-murder':
        return onsenMurderPolicy();
      case 'concentration':
        return concentrationPolicy();
      case 'phrase-bingo':
        return (sharedPhraseBingo ??= phraseBingoPolicy());
      case 'karaoke-duel':
        return karaokeDuelPolicy({ seed: seat });
      case 'tourist':
        return touristPolicy({ seed: seat });
      case 'oekaki':
        return oekakiPolicy({ seed: seat });
      case 'omiai':
        return omiaiPolicy();
      case 'shodo':
        return shodoPolicy({ content: content(), seed: seat });
      case 'narabete':
        return (sharedNarabete ??= narabetePolicy());
      case 'bento-haus':
      case 'bento-haus-vs':
        return bentoHausPolicy(opts.speak ? { hardRoles: true, ...(fast ? { thinkMs: opts.thinkMs } : {}) } : {});
      case 'dub-club':
        return (sharedDubClub ??= dubClubPolicy());
      case 'hajimemashite':
        return hajimemashitePolicy();
      case 'happyokai':
        return happyokaiPolicy();
      case 'late-again':
        return lateAgainPolicy({ ...(fast ? { thinkMs: opts.thinkMs } : {}), ...(opts.speak ? { speak: true } : {}) });
      case 'ghost-hotline':
        return ghostHotlinePolicy({ ...(fast ? { thinkMs: opts.thinkMs } : {}), ...(opts.speak ? { speak: true } : {}) });
      default:
        return undefined;
    }
  };
}
