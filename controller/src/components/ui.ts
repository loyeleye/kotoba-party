import { h } from '../../../shared/src/dom.js';

export function waiting(title: string, sub = ''): HTMLElement {
  return h('div', { class: 'screen' }, h('p', { class: 'big' }, title), sub ? h('p', { class: 'hint' }, sub) : null);
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
