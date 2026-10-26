// The union of every mode's view, so RoomView.game is typed. Each mode exports its own.
import type { DebugView } from './debug/debug.js';
import type { KanaRaidView } from './kanaRaid/kanaRaid.js';
import type { LastTrainView } from './lastTrain/lastTrain.js';
import type { OogiriView } from './oogiri/oogiri.js';

export type { DebugView, KanaRaidView, LastTrainView, OogiriView };
export type GameView = OogiriView | LastTrainView | KanaRaidView | DebugView;
