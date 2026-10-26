import { h } from '../../../shared/src/dom.js';
import type { OogiriView } from '../../../shared/src/modes/views.js';
import type { StageMode } from './types.js';

// Placeholder until the mode is built.
export const oogiriStage: StageMode<OogiriView> = {
  render: () => h('div', { class: 'card' }, h('p', { class: 'big' }, 'Coming soon')),
};
