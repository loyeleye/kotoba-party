// Word Gauntlet (v1.1). Placeholder until the mode is built; see docs/modes/word-gauntlet.md.
import type { Mode } from '../mode.js';
import { stubMode } from '../stub.js';

export interface WordGauntletView {
  mode: 'word-gauntlet';
}

export const wordGauntletMode: Mode<unknown, WordGauntletView> = stubMode('word-gauntlet', {
  title: 'Word Gauntlet',
  titleJa: 'ことばの関門',
  blurb: 'Fake meanings, a telephone of translations, then a spoken shiritori showdown.',
  host: 'pon',
  minPlayers: 4,
  maxPlayers: 8,
  roundChoices: [],
  usesPack: true,
});
