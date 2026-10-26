// The union of every mode's view, so RoomView.game is typed. Each mode exports its own.
import type { DebugView } from './debug/debug.js';
import type { KanaRaidView } from './kanaRaid/kanaRaid.js';
import type { LastTrainView } from './lastTrain/lastTrain.js';
import type { OogiriView } from './oogiri/oogiri.js';
import type { WordGauntletView } from './wordGauntlet/wordGauntlet.js';
import type { ConcentrationView } from './concentration/concentration.js';
import type { PhraseBingoView } from './phraseBingo/phraseBingo.js';
import type { KaraokeDuelView } from './karaokeDuel/karaokeDuel.js';

export type { ConcentrationView, DebugView, KaraokeDuelView, KanaRaidView, LastTrainView, OogiriView, PhraseBingoView, WordGauntletView };
export type GameView = OogiriView | LastTrainView | KanaRaidView | WordGauntletView | ConcentrationView | PhraseBingoView | KaraokeDuelView | DebugView;

