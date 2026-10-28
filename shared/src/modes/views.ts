// The union of every mode's view, so RoomView.game is typed. Each mode exports its own.
import type { DebugView } from './debug/debug.js';
import type { KanaRaidView } from './kanaRaid/kanaRaid.js';
import type { LastTrainView } from './lastTrain/lastTrain.js';
import type { OogiriView } from './oogiri/oogiri.js';
import type { WordGauntletView } from './wordGauntlet/wordGauntlet.js';
import type { ConcentrationView } from './concentration/concentration.js';
import type { PhraseBingoView } from './phraseBingo/phraseBingo.js';
import type { KaraokeDuelView } from './karaokeDuel/karaokeDuel.js';
import type { OnsenView } from './onsenMurder/onsenMurder.js';
import type { TouristView } from './tourist/tourist.js';
import type { OekakiView } from './oekaki/oekaki.js';
import type { OmiaiView } from './omiai/omiai.js';
import type { ShodoView } from './shodo/shodo.js';
import type { NarabeteView } from './narabete/narabete.js';
import type { BentoView } from './bentoHaus/bentoHaus.js';
import type { DubView } from './dubClub/dubClub.js';
import type { HajimeView } from './hajimemashite/hajimemashite.js';
import type { HappyokaiView } from './happyokai/happyokai.js';

export type { ConcentrationView, DebugView, KaraokeDuelView, KanaRaidView, LastTrainView, OogiriView, PhraseBingoView, WordGauntletView, OnsenView, TouristView, OekakiView, OmiaiView, ShodoView, NarabeteView, BentoView, DubView, HajimeView, HappyokaiView };
export type GameView = OogiriView | LastTrainView | KanaRaidView | WordGauntletView | ConcentrationView | PhraseBingoView | KaraokeDuelView | OnsenView | TouristView | OekakiView | OmiaiView | ShodoView | NarabeteView | BentoView | DubView | HajimeView | HappyokaiView | DebugView;
