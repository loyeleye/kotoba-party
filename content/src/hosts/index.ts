// Host bank: profiles, written lines and awards for the three hosts.

import type { HostLine } from '../types.js';
import { ponLines } from './pon.js';
import { chochinLines } from './chochin.js';
import { fudeLines } from './fude.js';

export { hostProfiles } from './profiles.js';
export { hostAwards } from './awards.js';
export { waitQuips, reconnectQuips, vipIdleQuip } from './quips.js';
export { ponLines, chochinLines, fudeLines };

export const hostLines: HostLine[] = [...ponLines, ...chochinLines, ...fudeLines];
