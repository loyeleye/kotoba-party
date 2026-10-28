// The phone's own Phrasebook in the room (docs/accounts.md): an icon in the header that opens in the
// lobby and the recap only (mid-game it would distract and give away answers said from memory),
// opens a sheet over the screen with the phrases this player said or missed tonight and, signed in,
// their saved ones. The sheet is a <dialog> on <body>, so the room's redraws don't close it; it closes
// itself when a game starts.

import { modeIconSrc } from '../../shared/src/art.js';
import { h, mount } from '../../shared/src/dom.js';
import { toRomaji } from '../../shared/src/japanese/romaji.js';
import { MODES } from '../../shared/src/modes/registry.js';
import type { ModeId, PhrasebookResponse, Phase } from '../../shared/src/protocol.js';
import { account } from './account.js';
import { hearButton } from './components/voice.js';

let sheet: HTMLDialogElement | null = null;
let body: HTMLElement | null = null;
let tabs: HTMLElement | null = null;
let opener: HTMLElement | null = null;
let source: { base: string; code: string; token: string; name: string } | null = null;
let data: PhrasebookResponse | null = null;
let tab: 'tonight' | 'saved' = 'tonight';

/**
 * The header's phrasebook icon. In the lobby and the recap it opens the sheet. Mid-game it stays in its
 * place, dimmed (so the header doesn't jump), and a tap says when it opens; a game starting closes the sheet.
 */
export function phrasebookButton(phase: Phase, from: { base: string; code: string; token: string; name: string }, flash: (text: string) => void): HTMLElement {
  if (source?.token !== from.token) data = null;
  source = from;
  const between = phase === 'lobby' || phase === 'recap';
  if (!between && sheet?.open) sheet.close();
  const button = h(
    'button',
    {
      type: 'button',
      class: `mpb-switch${between ? '' : ' locked'}`,
      'aria-label': between ? 'My phrasebook' : 'My phrasebook: opens after this game',
      'aria-haspopup': between ? 'dialog' : null,
      'aria-disabled': between ? null : 'true',
      title: between ? 'My phrasebook' : 'Opens after this game',
      onclick: () => (between ? open(button) : flash('📖 Your phrasebook opens after this game, so the answers stay yours.')),
    },
    h('img', { src: '/stage/assets/icons/phrasebook.png', alt: '', width: 19, height: 25, onerror: (e: Event) => (e.target as HTMLElement).replaceWith('📖') }),
  );
  return button;
}

function build(): HTMLDialogElement {
  tabs = h('div', { class: 'mpb-tabs', role: 'tablist', 'aria-label': 'Which phrases' });
  body = h('div', { class: 'mpb-body', id: 'mpb-sheet-body', role: 'tabpanel' });
  const close = h('button', { type: 'button', class: 'gp-close', 'aria-label': 'Close', onclick: () => sheet?.close() }, '✕');
  const d = h(
    'dialog',
    { class: 'gp-sheet mpb-sheet', 'aria-labelledby': 'mpb-sheet-title' },
    h('div', { class: 'gp-head' }, h('h2', { id: 'mpb-sheet-title' }, 'My phrasebook'), close),
    tabs,
    body,
  ) as HTMLDialogElement;
  // A tap on the dimmed backdrop (the dialog itself, outside its content) closes it, as the game picker does.
  d.addEventListener('click', (e) => e.target === d && d.close());
  d.addEventListener('close', () => {
    if (opener?.isConnected) opener.focus();
    else document.querySelector<HTMLElement>('.mpb-switch')?.focus();
  });
  document.body.append(d);
  return d;
}

function open(from: HTMLElement): void {
  opener = from;
  sheet ??= build();
  tab = 'tonight';
  if (!sheet.open) sheet.showModal();
  void load();
}

async function load(): Promise<void> {
  if (!source || !body) return;
  if (!data) mount(body, h('p', { class: 'hint' }, 'Opening your phrasebook…'));
  try {
    const res = await fetch(`${source.base}/api/rooms/${source.code}/phrasebook`, { headers: { authorization: `Bearer ${source.token}` } });
    if (!res.ok) throw new Error(String(res.status));
    data = (await res.json()) as PhrasebookResponse;
  } catch {
    if (!data) return void mount(body, h('p', { class: 'hint' }, 'Your phrasebook didn’t load. Close it and try again.'));
  }
  render();
}

function render(): void {
  if (!data || !tabs || !body || !source) return;
  const saved = data.saved[0]?.phrases ?? null;
  if (!saved) tab = 'tonight';
  const all: { id: typeof tab; label: string }[] = [{ id: 'tonight', label: `Tonight · ${data.tonight.length}` }, ...(saved ? [{ id: 'saved' as const, label: `Saved · ${saved.length}` }] : [])];
  // One tab needs no tab bar.
  tabs.hidden = all.length < 2;
  mount(
    tabs,
    all.map((t, i) =>
      h(
        'button',
        {
          type: 'button',
          role: 'tab',
          class: 'mpb-tab',
          'aria-selected': String(t.id === tab),
          'aria-controls': 'mpb-sheet-body',
          tabindex: t.id === tab ? '0' : '-1',
          onclick: () => pick(t.id),
          onkeydown: (ev: Event) => {
            const e = ev as KeyboardEvent;
            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
            e.preventDefault();
            pick(all[(i + 1) % all.length]!.id);
          },
        },
        t.label,
      ),
    ),
  );
  const name = source.name;
  if (tab === 'tonight') {
    const rows = data.tonight;
    mount(
      body,
      rows.length
        ? h('ul', { class: 'mpb-cards' }, rows.map((r) => card(r, r.missed.includes(name) ? 'practise' : 'said')))
        : empty('Nothing yet tonight.', 'Play a game and the phrases you say land here.'),
      account()
        ? h('p', { class: 'hint small' }, 'Saved to your progress after each game. Practise them under My progress on the join screen.')
        : h('p', { class: 'hint small' }, 'These go when the room closes. Sign in on the join screen to keep them.'),
    );
  } else {
    mount(
      body,
      saved!.length ? h('ul', { class: 'mpb-cards' }, saved!.map((p) => card(p, null))) : empty('No saved phrases yet.', 'Finish a game signed in and they land here.'),
      h('p', { class: 'hint small' }, 'Your 40 most recent. All of them, with practice, are under My progress on the join screen.'),
    );
  }
}

function pick(id: typeof tab): void {
  tab = id;
  render();
  tabs?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus();
}

const empty = (title: string, hint: string) =>
  h('div', { class: 'mpb-empty' }, h('img', { src: '/stage/assets/hosts/fude.png', alt: '', width: 96, height: 96, onerror: (e: Event) => (e.target as HTMLElement).remove() }), h('p', { class: 'big' }, title), h('p', { class: 'hint' }, hint));

function card(p: { text: string; kana: string; en: string; mode: ModeId }, how: 'said' | 'practise' | null): HTMLElement {
  const info = MODES[p.mode]?.info;
  return h(
    'li',
    { class: `mpb-card${how ? ` ${how}` : ''}` },
    h('p', { class: 'mpb-jp', lang: 'ja' }, p.text),
    p.kana !== p.text ? h('p', { class: 'mpb-kana', lang: 'ja' }, p.kana) : null,
    h('p', { class: 'mpb-romaji' }, toRomaji(p.kana)),
    p.en ? h('p', { class: 'mpb-en' }, p.en) : null,
    h(
      'div',
      { class: 'mpb-foot' },
      how ? h('span', { class: `mpb-chip ${how}` }, how === 'said' ? '✓ Said it' : '↻ Practise') : null,
      h('span', { class: 'mpb-game' }, h('img', { src: modeIconSrc(p.mode), alt: '', width: 20, height: 20, onerror: (e: Event) => (e.target as HTMLElement).remove() }), info?.title ?? p.mode),
      hearButton(p.kana, 'Hear it', 'raid-hear mpb-hear'),
    ),
  );
}
