// The phone's own Phrasebook in the room (docs/accounts.md): an icon in the header that opens in the
// lobby and the recap only (mid-game it would distract and give away answers said from memory),
// opens a sheet over the screen with the phrases this player said or missed tonight and, signed in,
// their saved ones. The sheet is a <dialog> on <body>, so the room's redraws don't close it; it closes
// itself when a game starts.

import { modeIconSrc } from '../../shared/src/art.js';
import { h, mount, ruby } from '../../shared/src/dom.js';
import { toRomaji } from '../../shared/src/japanese/romaji.js';
import { MODES } from '../../shared/src/modes/registry.js';
import type { Level, ModeId, PhrasebookResponse, Phase } from '../../shared/src/protocol.js';
import { account } from './account.js';
import { hearButton } from './components/voice.js';

let sheet: HTMLDialogElement | null = null;
let body: HTMLElement | null = null;
let tabs: HTMLElement | null = null;
let opener: HTMLElement | null = null;
let source: { base: string; code: string; token: string; name: string; level: Level } | null = null;
let data: PhrasebookResponse | null = null;
let tab: 'tonight' | 'saved' = 'tonight';

/**
 * The header's phrasebook icon. In the lobby and the recap it opens the sheet. Mid-game it stays in its
 * place, dimmed (so the header doesn't jump), and a tap says when it opens; a game starting closes the sheet.
 */
export function phrasebookButton(phase: Phase, from: { base: string; code: string; token: string; name: string; level: Level }, flash: (text: string) => void): HTMLElement {
  if (source?.token !== from.token) data = null;
  source = from;
  const between = phase === 'lobby' || phase === 'recap';
  if (!between && sheet?.open) shut();
  const button = h(
    'button',
    {
      type: 'button',
      class: `mpb-switch${between ? '' : ' locked'}`,
      'aria-label': between ? 'My phrasebook' : 'My phrasebook: opens after this game',
      'aria-haspopup': between ? 'dialog' : null,
      'aria-disabled': between ? null : 'true',
      title: between ? 'My phrasebook' : 'Opens after this game',
      onclick: () => (between ? open(button) : flash('Your phrasebook opens after this game, so the answers stay yours.')),
    },
    h('img', { src: '/stage/assets/icons/phrasebook.png', alt: '', width: 19, height: 25, onerror: (e: Event) => (e.target as HTMLElement).replaceWith('📖') }),
    // A key badge says "not now" without fading the icon into the header.
    between ? null : h('img', { class: 'mpb-lock', src: '/stage/assets/icons/key.png', alt: '', width: 7, height: 19 }),
  );
  return button;
}

function build(): HTMLDialogElement {
  tabs = h('div', { class: 'mpb-tabs', role: 'tablist', 'aria-label': 'Which phrases' });
  body = h('div', { class: 'mpb-body', id: 'mpb-sheet-body', role: 'tabpanel' });
  const close = h('button', { type: 'button', class: 'gp-close', 'aria-label': 'Close', onclick: shut }, '✕');
  const d = h(
    'dialog',
    { class: 'gp-sheet mpb-sheet', 'aria-labelledby': 'mpb-sheet-title' },
    h('div', { class: 'gp-head' }, h('h2', { id: 'mpb-sheet-title' }, ruby({ text: 'ことば帳', kana: 'ことばちょう' }, { class: 'mpb-title-ja' }), h('span', {}, 'My phrasebook')), close),
    tabs,
    body,
  ) as HTMLDialogElement;
  // A tap on the dimmed backdrop (the dialog itself, outside its content) closes it, as the game picker does.
  d.addEventListener('click', (e) => e.target === d && shut());
  // Escape closes through the same short drop as the ✕.
  d.addEventListener('cancel', (e) => {
    e.preventDefault();
    shut();
  });
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
  sheet.classList.remove('closing');
  if (!sheet.open) sheet.showModal();
  // Last time's phrases show at once while the fresh ones load, from the top.
  render();
  if (body) body.scrollTop = 0;
  void load();
}

/** Closes the sheet with a short stepped drop (none with reduced motion). */
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
  const all: { id: typeof tab; label: string; spoken: string }[] = [
    { id: 'tonight', label: `Tonight · ${data.tonight.length}`, spoken: `Tonight, ${data.tonight.length} phrases` },
    ...(saved ? [{ id: 'saved' as const, label: `Saved · ${saved.length}`, spoken: `Saved, ${saved.length} phrases` }] : []),
  ];
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
          'aria-label': t.spoken,
          onclick: () => pick(t.id),
          onkeydown: (ev: Event) => {
            const e = ev as KeyboardEvent;
            const to = ({ ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: all.length - 1 } as Record<string, number>)[e.key];
            if (to === undefined) return;
            e.preventDefault();
            pick(all[(to + all.length) % all.length]!.id);
          },
        },
        t.label,
      ),
    ),
  );
  const { name, level } = source;
  if (tab === 'tonight') {
    // The ones to practise first, then the ones said.
    const rows = data.tonight.map((r) => ({ r, how: r.missed.includes(name) ? ('practise' as const) : ('said' as const) }));
    const practise = rows.filter((x) => x.how === 'practise');
    const said = rows.filter((x) => x.how === 'said');
    mount(
      body,
      // Signed out, the warning goes first: below the cards nobody reads it.
      account() ? null : h('p', { class: 'mpb-note' }, 'These go when the room closes. Sign in on the join screen to keep them.'),
      rows.length ? h('p', { class: 'mpb-count' }, [practise.length ? `${practise.length} to practise` : '', said.length ? `${said.length} said` : ''].filter(Boolean).join(' · ')) : null,
      rows.length
        ? h('ul', { class: 'mpb-cards' }, [...practise, ...said].map((x) => card(x.r, x.how, level)))
        : empty('Nothing yet tonight.', 'Play a game and the phrases you say land here.'),
      account() ? h('p', { class: 'hint small' }, 'Saved to your progress after each game. Practise them under My progress on the join screen.') : null,
    );
  } else {
    mount(
      body,
      saved!.length ? h('ul', { class: 'mpb-cards' }, saved!.map((p) => card(p, null, level))) : empty('No saved phrases yet.', 'Finish a game signed in and they land here.'),
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

function card(p: { text: string; kana: string; en: string; mode: ModeId }, how: 'said' | 'practise' | null, level: Level): HTMLElement {
  const info = MODES[p.mode]?.info;
  const kanji = p.kana !== p.text;
  // かな players read the spaced kana first, with the kanji as a small reference. Romaji is theirs only,
  // as everywhere else on the phone (docs/design-doc-snapshot.md).
  const lines =
    level === 'kana'
      ? [h('p', { class: 'mpb-jp', lang: 'ja' }, p.kana), kanji ? h('p', { class: 'mpb-kana', lang: 'ja' }, p.text) : null, h('p', { class: 'mpb-romaji', lang: 'ja-Latn' }, toRomaji(p.kana))]
      : [h('p', { class: 'mpb-jp', lang: 'ja' }, p.text), kanji ? h('p', { class: 'mpb-kana', lang: 'ja' }, p.kana) : null];
  // The spaces between words are for reading; the voice shouldn't pause at them.
  const hear = hearButton(p.kana.replace(/\s+/g, ''), 'Hear it', 'raid-hear mpb-hear');
  hear?.setAttribute('aria-label', `Hear ${p.text}`);
  return h(
    'li',
    { class: `mpb-card${how ? ` ${how}` : ''}` },
    // A phrase to practise gets the stage's もう一回 ("once more") stamp.
    how === 'practise' ? h('span', { class: 'mpb-again', lang: 'ja', 'aria-hidden': 'true' }, h('span', {}, 'もう'), h('span', {}, '一回')) : null,
    ...lines,
    p.en ? h('p', { class: 'mpb-en' }, p.en) : null,
    h(
      'div',
      { class: 'mpb-foot' },
      how ? h('span', { class: `mpb-chip ${how}` }, how === 'said' ? '✓ Said it' : '↻ To practise') : null,
      h('span', { class: 'mpb-game' }, h('img', { src: modeIconSrc(p.mode), alt: '', width: 24, height: 24, onerror: (e: Event) => (e.target as HTMLElement).remove() }), info?.title ?? p.mode),
      hear,
    ),
  );
}
