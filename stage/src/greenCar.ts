// Green Car on the TV (shared/src/greenCar.ts): a small green clover badge while the room rides in it, and a
// toast when the switch is on but a Kana or N5 player has boarded, so the next game plays the regular train.
// Nothing here changes mid-game: the server decides at game start.

import { h } from '../../shared/src/dom.js';
import { GREEN_CAR_OFF_TOAST } from '../../shared/src/greenCar.js';
import type { RoomView } from '../../shared/src/protocol.js';

let badge: HTMLElement | null = null;
let toast: HTMLElement | null = null;
let toastTimer: ReturnType<typeof setTimeout> | null = null;
/** The phase sequence the toast was last shown for, so it shows once per game start. */
let toastFor = -1;

export function mountGreenCar(canvas: HTMLElement): void {
  badge = h('div', { class: 'gc-badge', hidden: true, 'aria-label': 'Green Car: everyone here plays at N4 or N3' }, h('span', { 'aria-hidden': 'true' }, '🍀'), ' グリーン車');
  toast = h('div', { class: 'gc-toast', role: 'status', hidden: true });
  canvas.append(badge, toast);
}

export function updateGreenCar(v: RoomView): void {
  if (!badge || !toast) return;
  badge.hidden = !v.greenCar.on;
  // The switch is on, but someone below N4 is seated: tell the room once, as the game starts.
  const starting = v.phase === 'intro';
  if (starting && !v.greenCar.on && v.greenCar.setting === true && !v.greenCar.eligible && toastFor !== v.phaseSeq) {
    toastFor = v.phaseSeq;
    toast.textContent = `🍀 ${GREEN_CAR_OFF_TOAST}`;
    toast.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      if (toast) toast.hidden = true;
    }, 5000);
  }
}
