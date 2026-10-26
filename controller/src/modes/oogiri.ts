import type { OogiriView } from '../../../shared/src/modes/views.js';
import { waiting } from '../components/ui.js';
import type { PhoneMode } from './types.js';

// Placeholder until the mode is built.
export const oogiriPhone: PhoneMode<OogiriView> = {
  key: (view) => String(view.phaseSeq),
  render: () => waiting('Coming soon'),
};
