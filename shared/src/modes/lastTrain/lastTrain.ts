// Last Train. Placeholder until the mode is built; see docs/modes/last-train.md.
import type { Mode } from '../mode.js';
import { stubMode } from '../stub.js';

export interface LastTrainView {
  mode: 'last-train';
}

export const lastTrainMode: Mode<unknown, LastTrainView> = stubMode('last-train', {
  title: 'Last Train',
  titleJa: '終電',
  blurb: 'Race for the last train: answer every stop out loud, or become a ghost.',
  host: 'chochin',
  minPlayers: 1,
  maxPlayers: 8,
  roundChoices: [4, 6],
  usesPack: false,
});
