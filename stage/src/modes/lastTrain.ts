import { h } from '../../../shared/src/dom.js';
import type { LastTrainView } from '../../../shared/src/modes/views.js';
import type { StageMode } from './types.js';

// Placeholder until the mode is built.
export const lastTrainStage: StageMode<LastTrainView> = {
  render: () => h('div', { class: 'card' }, h('p', { class: 'big' }, 'Coming soon')),
};
