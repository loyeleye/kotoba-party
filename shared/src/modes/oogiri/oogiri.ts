// Oogiri Night. Placeholder until the mode is built; see docs/modes/oogiri.md.
import type { Mode } from '../mode.js';
import { stubMode } from '../stub.js';

export interface OogiriView {
  mode: 'oogiri';
}

export const oogiriMode: Mode<unknown, OogiriView> = stubMode('oogiri', {
  title: 'Oogiri Night',
  titleJa: '大喜利ナイト',
  blurb: 'Fill in the blank, vote for the funniest, say the winner out loud.',
  host: 'pon',
  minPlayers: 3,
  maxPlayers: 8,
  roundChoices: [3],
  usesPack: true,
});
