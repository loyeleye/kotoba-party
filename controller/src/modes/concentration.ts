import type { ConcentrationView } from '../../../shared/src/modes/views.js';
import { waiting } from '../components/ui.js';
import type { PhoneMode } from './types.js';

// Placeholder until the mode is built.
export const concentrationPhone: PhoneMode<ConcentrationView> = {
  key: (view) => String(view.phaseSeq),
  render: () => waiting('Coming soon'),
};
