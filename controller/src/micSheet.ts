// The header's 🎤 opens this sheet: two short choices for this phone, each applied the moment it's picked.
//   Your mic: on, or quiet mode (tap and type). Goes to the room, since games with speaking roles count mics.
//   Talk button: hold while speaking (the default), or tap to start and tap again to stop. Kept on this phone
//   only (speak.ts talkMode): it changes nothing for anyone else.
// One sheet rather than a three-way icon: a tap on the icon never changes anything by surprise mid-game, and
// both choices sit side by side with a line saying what each does.

import { h, mount } from '../../shared/src/dom.js';
import { getTalkMode, setTalkMode, type TalkMode } from './components/speak.js';

export interface MicSheetState {
  quiet: boolean;
  setQuiet(quiet: boolean): void;
  /** The talk mode changed: redraw the screen so its talk buttons follow. */
  talkModeChanged(): void;
}

let sheet: HTMLDialogElement | null = null;
let body: HTMLElement | null = null;
let opener: HTMLElement | null = null;
let state: MicSheetState | null = null;

interface Choice<T> {
  value: T;
  icon: string;
  title: string;
  line: string;
}

function group<T>(label: string, id: string, choices: Choice<T>[], current: T, pick: (v: T) => void): HTMLElement {
  const buttons = choices.map((c, i) =>
    h(
      'button',
      {
        type: 'button',
        role: 'radio',
        class: 'ms-choice',
        'aria-checked': String(c.value === current),
        tabindex: c.value === current ? '0' : '-1',
        onclick: () => c.value !== current && pick(c.value),
        onkeydown: (ev: Event) => {
          const e = ev as KeyboardEvent;
          const to = ({ ArrowDown: i + 1, ArrowRight: i + 1, ArrowUp: i - 1, ArrowLeft: i - 1 } as Record<string, number>)[e.key];
          if (to === undefined) return;
          e.preventDefault();
          const next = choices[(to + choices.length) % choices.length]!;
          if (next.value !== current) pick(next.value);
        },
      },
      h('span', { class: 'ms-icon', 'aria-hidden': 'true' }, c.icon),
      h('span', { class: 'ms-text' }, h('strong', {}, c.title), h('small', {}, c.line)),
    ),
  );
  return h('div', { class: 'ms-group' }, h('h3', { id }, label), h('div', { role: 'radiogroup', 'aria-labelledby': id, class: 'ms-choices' }, buttons));
}

const TALK: Choice<TalkMode>[] = [
  { value: 'hold', icon: '✊', title: 'Hold to talk', line: 'Press and hold while you speak, let go when you’re done.' },
  { value: 'tap', icon: '👆', title: 'Tap to talk', line: 'Tap to start, tap again to stop. Easier for longer answers, or if holding is hard.' },
];

function draw(): void {
  if (!body || !state) return;
  const s = state;
  // Keep the keyboard where it was across a redraw.
  const focused = (document.activeElement as HTMLElement | null)?.closest('.ms-group')?.querySelector('h3')?.id ?? null;
  const mic = group<boolean>(
    'Your mic',
    'ms-mic',
    [
      { value: false, icon: '🎤', title: 'Mic on', line: 'Say your answers out loud.' },
      { value: true, icon: '⌨️', title: 'Quiet mode', line: 'Tap and type instead. Turn it back on any time.' },
    ],
    s.quiet,
    (q) => s.setQuiet(q),
  );
  const talk = group<TalkMode>('Talk button', 'ms-talk', TALK, getTalkMode(), (m) => {
    setTalkMode(m);
    s.talkModeChanged();
    draw();
  });
  if (s.quiet) talk.classList.add('ms-idle');
  mount(
    body,
    mic,
    talk,
    s.quiet ? h('p', { class: 'hint ms-note' }, 'The talk button choice applies when your mic is on.') : null,
    h('p', { class: 'hint ms-note' }, 'Just for this phone. Everyone picks their own.'),
  );
  if (focused) body.querySelector<HTMLElement>(`[aria-labelledby="${focused}"] [aria-checked="true"]`)?.focus();
}

function build(): HTMLDialogElement {
  body = h('div', { class: 'ms-body' });
  const close = h('button', { type: 'button', class: 'gp-close', 'aria-label': 'Close', onclick: shut }, '✕');
  const d = h(
    'dialog',
    { class: 'gp-sheet mpb-sheet ms-sheet', 'aria-labelledby': 'ms-title' },
    h('div', { class: 'gp-head' }, h('h2', { id: 'ms-title' }, '🎤 Mic'), close),
    body,
    h('div', { class: 'ms-foot' }, h('button', { type: 'button', class: 'primary', onclick: shut }, 'Done')),
  ) as HTMLDialogElement;
  d.addEventListener('click', (e) => e.target === d && shut());
  d.addEventListener('cancel', (e) => {
    e.preventDefault();
    shut();
  });
  d.addEventListener('close', () => {
    if (opener?.isConnected) opener.focus();
    else document.querySelector<HTMLElement>('.me .mic-switch:not(.sound-switch)')?.focus();
  });
  document.body.append(d);
  return d;
}

export function openMicSheet(from: HTMLElement, s: MicSheetState): void {
  opener = from;
  state = s;
  sheet ??= build();
  sheet.classList.remove('closing');
  if (!sheet.open) sheet.showModal();
  draw();
}

/** The room changed this player's mic (their pick, or another phone of theirs): keep an open sheet true. */
export function refreshMicSheet(s: MicSheetState): void {
  if (!sheet?.open) return;
  state = s;
  draw();
}

function shut(): void {
  const d = sheet;
  if (!d?.open || d.classList.contains('closing')) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return d.close();
  d.classList.add('closing');
  setTimeout(() => {
    d.classList.remove('closing');
    d.close();
  }, 160);
}
