import type { WordGauntletView } from '../../../shared/src/modes/views.js';
import { waiting } from '../components/ui.js';
import type { PhoneMode } from './types.js';

// Placeholder until the mode is built.
export const wordGauntletPhone: PhoneMode<WordGauntletView> = {
  key: (view) => String(view.phaseSeq),
  render: () => waiting('Coming soon'),
};
