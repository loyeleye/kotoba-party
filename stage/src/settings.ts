// The stage's settings panel: the four volumes, streamer mode, background effects and, on the
// main stage, whether watching screens (friends' laptops on ?code=) may run the game. A watching
// screen that has been given control gets the game buttons here instead. Volumes, streamer mode
// and background effects belong to this screen; remote control belongs to the room.

import { h, mount } from '../../shared/src/dom.js';
import { invite, inviteLinks } from '../../shared/src/share.js';
import type { ModeId, RoomView } from '../../shared/src/protocol.js';
import { isAmbientOn, setAmbient } from './backdrop.js';
import { isDanmakuOn, setDanmaku } from './danmaku.js';
import { isStreamerMode, setStreamerMode } from './music/index.js';
import { sfx } from './music/sfx.js';
import { getVolumes, setVolume, type VolumeId } from './sound.js';

type Send = (body: { type: 'start'; mode: ModeId; rounds?: number } | { type: 'skip'; phaseSeq: number } | { type: 'playAgain' } | { type: 'settings'; remoteControl: boolean }) => Promise<void>;

const VOLUMES: [VolumeId, string][] = [
  ['master', 'Master volume'],
  ['host', 'Host voice volume'],
  ['sfx', 'Sound effects volume'],
  ['music', 'Background music volume'],
];

let panel: HTMLElement | null = null;
let room: HTMLElement | null = null;
let opts: { watch: boolean; send: Send; site: () => string } | null = null;
let view: RoomView | null = null;
let roomKey = '';

/** Puts the settings button on the stage; the panel opens over the canvas. */
export function mountSettings(parent: HTMLElement, options: { watch: boolean; send: Send; site: () => string }): void {
  opts = options;
  const button = h('button', { type: 'button', class: 'st-open', 'aria-haspopup': 'dialog', 'aria-expanded': 'false' }, '⚙ Settings') as HTMLButtonElement;
  room = h('div', { class: 'st-room' });
  const close = h('button', { type: 'button', class: 'st-close', 'aria-label': 'Close settings' }, '✕');
  panel = h(
    'div',
    { class: 'st-panel', role: 'dialog', 'aria-label': 'Settings', hidden: true },
    h('div', { class: 'st-head' }, h('h2', {}, 'Settings'), close),
    h('section', { class: 'st-sec' }, h('h3', {}, 'Sound on this screen'), VOLUMES.map(([id, label]) => slider(id, label))),
    h(
      'section',
      { class: 'st-sec' },
      toggle('Streamer mode', "Plays only the game's own music, so a stream or video of this screen doesn't pick up copyright claims.", isStreamerMode(), (on) => setStreamerMode(on)),
    ),
    h(
      'section',
      { class: 'st-sec' },
      toggle('Background effects', 'Mist, spotlights and confetti behind the game. Off shows a still set. Calm motion on the VIP’s phone also holds them still.', isAmbientOn(), (on) => setAmbient(on)),
    ),
    h(
      'section',
      { class: 'st-sec' },
      toggle('Flying titles', 'Game titles drifting across the lobby. Off shows the still list of games. Calm motion on the VIP’s phone also stops them.', isDanmakuOn(), (on) => setDanmaku(on)),
    ),
    room,
  );
  const show = (open: boolean) => {
    panel!.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    if (open) renderRoom(true);
  };
  button.addEventListener('click', () => (sfx('tap'), show(panel!.hidden)));
  close.addEventListener('click', () => show(false));
  document.addEventListener('keydown', (e) => e.key === 'Escape' && !panel!.hidden && show(false));
  parent.append(button, panel);
}

/** Call on every render: keeps the room section in step with the game. */
export function updateSettings(next: RoomView): void {
  view = next;
  renderRoom(false);
}

function slider(id: VolumeId, label: string): HTMLElement {
  const value = Math.round(getVolumes()[id] * 100);
  const out = h('output', { class: 'st-val' }, `${value}%`);
  const input = h('input', { type: 'range', min: '0', max: '100', step: '5', value: String(value), 'aria-label': label }) as HTMLInputElement;
  input.addEventListener('input', () => {
    setVolume(id, Number(input.value) / 100);
    out.textContent = `${input.value}%`;
  });
  // A sample at the new level, so the sound effects slider can be heard as it moves.
  if (id === 'sfx' || id === 'master') input.addEventListener('change', () => sfx('right'));
  return h('label', { class: 'st-slider' }, h('span', { class: 'st-label' }, label), input, out);
}

function toggle(label: string, help: string, on: boolean, change: (on: boolean) => void): HTMLElement {
  const box = h('input', { type: 'checkbox' }) as HTMLInputElement;
  box.checked = on;
  box.addEventListener('change', () => change(box.checked));
  return h('label', { class: 'st-toggle' }, box, h('span', {}, h('span', { class: 'st-label' }, label), h('span', { class: 'st-help' }, help)));
}

/** The room part: the main stage's remote-control switch, or a watching screen's game buttons. */
function renderRoom(force: boolean): void {
  if (!room || !opts || !panel || panel.hidden) return;
  const v = view;
  const key = v ? `${opts.watch}:${v.remoteControl}:${v.phase}:${v.phaseSeq}:${v.deadline !== null}:${v.modes.map((m) => m.id).join()}` : 'none';
  if (!force && key === roomKey) return;
  roomKey = key;
  if (!v) return void mount(room);
  const share = h('section', { class: 'st-sec' }, h('h3', {}, 'Invite friends'), invite(inviteLinks(opts.site(), v.code), v.code, false));
  if (!opts.watch) {
    mount(
      room,
      share,
      h(
        'section',
        { class: 'st-sec' },
        toggle(
          'Let other screens control the game',
          `Friends watching on their own screen (${inviteLinks(opts.site(), v.code).stage.replace(/^https?:\/\//, '')}) can start a game, skip ahead and play again.`,
          v.remoteControl,
          (on) => void opts!.send({ type: 'settings', remoteControl: on }),
        ),
      ),
    );
    return;
  }
  if (!v.remoteControl) {
    mount(room, share, h('section', { class: 'st-sec' }, h('h3', {}, 'Game controls'), h('p', { class: 'st-help' }, "The main screen runs this game. Ask them to turn on “Let other screens control the game” in their settings.")));
    return;
  }
  const send = opts.send;
  const buttons: HTMLElement[] = [];
  if (v.phase === 'lobby' && v.modes.length) {
    const pick = h('select', { 'aria-label': 'Game' }, v.modes.map((m) => h('option', { value: m.id }, m.title))) as HTMLSelectElement;
    buttons.push(pick, button('Start', () => send({ type: 'start', mode: pick.value as ModeId })));
  }
  if (v.deadline !== null && v.phase !== 'lobby') buttons.push(button('Skip ahead', () => send({ type: 'skip', phaseSeq: v.phaseSeq })));
  if (v.phase === 'recap') buttons.push(button('Play again', () => send({ type: 'playAgain' })));
  mount(room, share, h('section', { class: 'st-sec' }, h('h3', {}, 'Game controls'), buttons.length ? h('div', { class: 'st-row' }, buttons) : h('p', { class: 'st-help' }, 'Nothing to do right now.')));
}

function button(label: string, onClick: () => Promise<void>): HTMLElement {
  const b = h('button', { type: 'button', class: 'st-btn' }, label) as HTMLButtonElement;
  b.addEventListener('click', () => (sfx('tap'), void onClick()));
  return b;
}
