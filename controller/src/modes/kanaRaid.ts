import type { KanaRaidView } from '../../../shared/src/modes/views.js';
import { waiting } from '../components/ui.js';
import type { PhoneMode } from './types.js';

// Placeholder until the mode is built.
export const kanaRaidPhone: PhoneMode<KanaRaidView> = {
  key: (view) => String(view.phaseSeq),
  render: () => waiting('Coming soon'),
};
