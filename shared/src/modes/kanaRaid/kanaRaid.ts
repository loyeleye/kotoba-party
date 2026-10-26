// Kana Yōkai Raid. Placeholder until the mode is built; see docs/modes/kana-raid.md.
import type { Mode } from '../mode.js';
import { stubMode } from '../stub.js';

export interface KanaRaidView {
  mode: 'kana-raid';
}

export const kanaRaidMode: Mode<unknown, KanaRaidView> = stubMode('kana-raid', {
  title: 'Kana Yōkai Raid',
  titleJa: 'かな妖怪レイド',
  blurb: 'Kana-shaped yōkai invade the studio. Shout their sounds to catch them.',
  host: 'fude',
  minPlayers: 1,
  maxPlayers: 8,
  roundChoices: [],
  usesPack: false,
});
