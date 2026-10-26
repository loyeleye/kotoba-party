import type { LastTrainView } from '../../../shared/src/modes/views.js';
import { waiting } from '../components/ui.js';
import type { PhoneMode } from './types.js';

// Placeholder until the mode is built.
export const lastTrainPhone: PhoneMode<LastTrainView> = {
  key: (view) => String(view.phaseSeq),
  render: () => waiting('Coming soon'),
};
