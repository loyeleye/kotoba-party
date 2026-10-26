import { h } from '../../../shared/src/dom.js';
import type { KanaRaidView } from '../../../shared/src/modes/views.js';
import type { StageMode } from './types.js';

// Placeholder until the mode is built.
export const kanaRaidStage: StageMode<KanaRaidView> = {
  render: () => h('div', { class: 'card' }, h('p', { class: 'big' }, 'Coming soon')),
};
