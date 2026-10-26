import { h } from '../../../shared/src/dom.js';
import { waitQuips } from '../../../content/src/hosts/quips.js';
import type { HostId, JpText } from '../../../content/src/types.js';

let quipHost: HostId | null = null;

/** The host whose asides fill the waits: the current mode's, or none in the lobby. */
export function setQuipHost(host: HostId | null): void {
  quipHost = host;
}

/** A host aside in Japanese with its English underneath, for dead air. */
export function quip(line: JpText): HTMLElement {
  return h('div', { class: 'quip' }, h('p', { class: 'quip-jp', lang: 'ja' }, line.text), h('p', { class: 'quip-en' }, line.en));
}

/** A random wait aside from the current host, or null outside a game. */
export function waitQuip(): HTMLElement | null {
  const lines = quipHost ? waitQuips[quipHost] : [];
  return lines.length ? quip(lines[Math.floor(Math.random() * lines.length)]!) : null;
}

export function waiting(title: string, sub = ''): HTMLElement {
  return h('div', { class: 'screen' }, h('p', { class: 'big' }, title), sub ? h('p', { class: 'hint' }, sub) : null, waitQuip());
}

/** Japanese with its reading and English underneath. */
export function jp(text: { text: string; kana?: string; en?: string }, opts: { showKana?: boolean; showEn?: boolean } = {}): HTMLElement {
  return h(
    'div',
    { class: 'jp' },
    h('p', { class: 'jp-text', lang: 'ja' }, text.text),
    opts.showKana !== false && text.kana && text.kana !== text.text ? h('p', { class: 'jp-kana', lang: 'ja' }, text.kana) : null,
    opts.showEn !== false && text.en ? h('p', { class: 'jp-en' }, text.en) : null,
  );
}

/** A button that fires only after a steady hold, for moves that are hard to take back. */
export function holdButton(label: string, cls: string, onConfirm: () => void, holdMs = 1000): HTMLElement {
  const fill = h('span', { class: 'hold-fill', 'aria-hidden': 'true' });
  const b = h('button', { type: 'button', class: `hold ${cls}`, style: `--hold:${holdMs}ms` }, fill, h('span', { class: 'hold-label' }, label), h('small', { class: 'hold-sub' }, 'hold to confirm')) as HTMLButtonElement;
  let t: ReturnType<typeof setTimeout> | null = null;
  const cancel = () => {
    if (t) clearTimeout(t);
    t = null;
    b.classList.remove('holding');
  };
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    b.classList.add('holding');
    t = setTimeout(() => {
      cancel();
      onConfirm();
    }, holdMs);
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave'] as const) b.addEventListener(ev, cancel);
  b.addEventListener('contextmenu', (e) => e.preventDefault());
  // Keyboard and switch users: Enter or Space twice within 2 s.
  let armed = 0;
  b.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    if (Date.now() - armed < 2000) onConfirm();
    else armed = Date.now();
  });
  return b;
}
