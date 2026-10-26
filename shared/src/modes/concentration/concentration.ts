// Kotoba Concentration (v1.1). Placeholder until the mode is built; see docs/modes/concentration.md.
import type { Mode } from '../mode.js';
import { stubMode } from '../stub.js';

export interface ConcentrationView {
  mode: 'concentration';
}

export const concentrationMode: Mode<unknown, ConcentrationView> = stubMode('concentration', {
  title: 'Kotoba Concentration',
  titleJa: 'ことば神経衰弱',
  blurb: 'Flip pairs, then say the word to keep them. Anyone can steal.',
  host: 'fude',
  minPlayers: 2,
  maxPlayers: 8,
  roundChoices: [],
  usesPack: true,
});
