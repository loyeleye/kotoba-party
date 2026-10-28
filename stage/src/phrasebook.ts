// The stage's Phrasebook (docs/accounts.md): in the lobby and the recap, a button next to Settings
// opens tonight's phrases from every finished game, with who said and who should practise each one,
// and a tab for each signed-in player's saved phrasebook. Read from GET /api/rooms/:code/phrasebook
// with the stage token, each time it opens. Watching screens don't get it: their token can't read it.
// Six cards a page, turned with big buttons or the arrow keys, since a host on a phone or a remote
// can't scroll (art panel, 2026-10-28).

import { h, mount, ruby, seatShape } from '../../shared/src/dom.js';
import { toRomaji } from '../../shared/src/japanese/romaji.js';
import { MODES } from '../../shared/src/modes/registry.js';
import type { ModeId, PhrasebookResponse, RoomView } from '../../shared/src/protocol.js';
import { TITLE_KANA } from './danmaku.js';
import { sfx } from './music/sfx.js';

const PAGE = 6;

let source: { base: string; code: string; token: string } | null = null;
let button: HTMLButtonElement | null = null;
let count: HTMLElement | null = null;
let panel: HTMLElement | null = null;
let scrim: HTMLElement | null = null;
let body: HTMLElement | null = null;
let tabs: HTMLElement | null = null;
let data: PhrasebookResponse | null = null;
/** Seats by name, for the players' badges. */
let seats = new Map<string, number>();
/** 'tonight', or a player id. */
let tab = 'tonight';
let page = 0;

/** The room the Phrasebook reads from (the main stage only). */
export function setPhrasebookSource(next: { base: string; code: string; token: string } | null): void {
  source = next;
  data = null;
}

export function mountPhrasebook(parent: HTMLElement): void {
  count = h('span', { class: 'spb-count', hidden: true });
  button = h(
    'button',
    { type: 'button', class: 'spb-open', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', hidden: true },
    h('img', { class: 'spb-book', src: '/stage/assets/icons/phrasebook.png', alt: '', onerror: (e: Event) => (e.target as HTMLElement).remove() }),
    'Phrasebook',
    count,
  ) as HTMLButtonElement;
  const close = h('button', { type: 'button', class: 'spb-close', 'aria-label': 'Close the phrasebook' }, '✕');
  tabs = h('div', { class: 'spb-tabs', role: 'tablist', 'aria-label': 'Whose phrases' });
  body = h('div', { class: 'spb-body', role: 'tabpanel', id: 'spb-body' });
  scrim = h('div', { class: 'spb-scrim', hidden: true, onclick: () => show(false) });
  panel = h(
    'div',
    { class: 'spb-panel', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'spb-title', hidden: true },
    h(
      'div',
      { class: 'spb-head' },
      h('img', { class: 'spb-fude', src: '/stage/assets/hosts/fude.png', alt: '', onerror: (e: Event) => (e.target as HTMLElement).remove() }),
      h('h2', { id: 'spb-title' }, 'Phrasebook ', ruby({ text: 'ことば帳', furigana: [['ことば', ''], ['帳', 'ちょう']] }, { class: 'spb-title-ja' })),
      close,
    ),
    tabs,
    body,
  );
  button.addEventListener('click', () => (sfx('tap'), show(panel!.hidden)));
  close.addEventListener('click', () => show(false));
  document.addEventListener('keydown', (e) => {
    if (!panel || panel.hidden) return;
    if (e.key === 'Escape') show(false);
    else if (e.key === 'PageDown' || (e.key === 'ArrowDown' && !e.altKey)) turn(1, e);
    else if (e.key === 'PageUp' || (e.key === 'ArrowUp' && !e.altKey)) turn(-1, e);
    // Focus stays in the panel: Tab from the last control goes back to the first.
    else if (e.key === 'Tab') {
      const all = [...panel.querySelectorAll<HTMLElement>('button:not([disabled]):not([tabindex="-1"])')];
      if (!all.length) return;
      const first = all[0]!;
      const last = all[all.length - 1]!;
      if (e.shiftKey && document.activeElement === first) (e.preventDefault(), last.focus());
      else if (!e.shiftKey && document.activeElement === last) (e.preventDefault(), first.focus());
    }
  });
  parent.append(button, scrim, panel);
}

/** Call on every render: the button shows between games only, and the panel closes when one starts. */
export function updatePhrasebook(view: RoomView): void {
  if (!button || !panel || !count) return;
  seats = new Map(view.players.map((p) => [p.name, p.seat]));
  const between = view.phase === 'lobby' || view.phase === 'recap';
  button.hidden = !source || !between;
  // Gold with a count once tonight has phrases (the count is from the last time it opened, or the recap's).
  button.classList.toggle('has', !!data?.tonight.length);
  if (!between && !panel.hidden) show(false);
  if (view.phase === 'recap' && between && panel.hidden && !button.dataset.loaded) {
    button.dataset.loaded = '1';
    void load(false);
  }
  if (view.phase !== 'recap') delete button.dataset.loaded;
}

function show(open: boolean): void {
  if (!panel || !button || !scrim) return;
  panel.hidden = !open;
  scrim.hidden = !open;
  button.setAttribute('aria-expanded', String(open));
  document.body.classList.toggle('spb-up', open);
  if (open) {
    page = 0;
    void load(true);
  } else button.focus();
}

async function load(draw: boolean): Promise<void> {
  if (!source || !body) return;
  if (draw && !data) mount(body, h('p', { class: 'spb-empty' }, 'Opening the phrasebook…'));
  try {
    const res = await fetch(`${source.base}/api/rooms/${source.code}/phrasebook`, { headers: { authorization: `Bearer ${source.token}` } });
    if (!res.ok) throw new Error(String(res.status));
    data = (await res.json()) as PhrasebookResponse;
  } catch {
    if (!data) return void (draw && mount(body, h('p', { class: 'spb-empty' }, 'The phrasebook didn’t load. Close it and try again.')));
  }
  if (count && button) {
    count.hidden = !data!.tonight.length;
    count.textContent = String(data!.tonight.length);
    button.classList.toggle('has', !!data!.tonight.length);
  }
  if (!draw) return;
  if (tab !== 'tonight' && !data!.saved.some((s) => s.playerId === tab)) tab = 'tonight';
  render();
  tabs?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus();
}

function turn(by: number, e?: Event): void {
  const total = pages();
  if (total <= 1) return;
  e?.preventDefault();
  const next = Math.min(total - 1, Math.max(0, page + by));
  if (next === page) return;
  page = next;
  sfx('tap');
  render();
}

function items(): number {
  if (!data) return 0;
  return tab === 'tonight' ? data.tonight.length : (data.saved.find((s) => s.playerId === tab)?.phrases.length ?? 0);
}
const pages = () => Math.max(1, Math.ceil(items() / PAGE));

function render(): void {
  if (!data || !tabs || !body) return;
  const all = [{ id: 'tonight', label: 'Tonight', seat: 0 }, ...data.saved.map((s) => ({ id: s.playerId, label: s.name, seat: seats.get(s.name) ?? 0 }))];
  const pick = (id: string) => {
    tab = id;
    page = 0;
    render();
    tabs!.querySelector<HTMLElement>('[aria-selected="true"]')?.focus();
  };
  mount(
    tabs,
    all.map((t, i) =>
      h(
        'button',
        {
          type: 'button',
          role: 'tab',
          class: 'spb-tab',
          'aria-selected': String(t.id === tab),
          'aria-controls': 'spb-body',
          tabindex: t.id === tab ? '0' : '-1',
          onclick: () => pick(t.id),
          onkeydown: (ev: Event) => {
            const e = ev as KeyboardEvent;
            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
            e.preventDefault();
            pick(all[(i + (e.key === 'ArrowRight' ? 1 : all.length - 1)) % all.length]!.id);
          },
        },
        t.seat ? badge(t.seat) : null,
        t.label,
      ),
    ),
  );
  const from = page * PAGE;
  if (tab === 'tonight') {
    const rows = data.tonight;
    mount(
      body,
      rows.length
        ? [h('p', { class: 'spb-lede' }, 'Tonight’s phrases, newest first. ', legend()), h('ul', { class: 'spb-grid' }, rows.slice(from, from + PAGE).map((r) => card(r, r.said, r.missed))), pager(rows.length)]
        : h('div', { class: 'spb-empty' }, h('p', {}, 'Nothing yet tonight.'), h('p', { class: 'spb-hint' }, 'Every game adds the phrases people said, retried and missed.')),
      data.saved.length ? null : h('p', { class: 'spb-hint' }, 'Sign in on your phone (under Join) to keep your phrases after tonight.'),
    );
    return;
  }
  const mine = data.saved.find((s) => s.playerId === tab)!;
  mount(
    body,
    h('p', { class: 'spb-lede' }, `${mine.name}’s saved phrases, most recent first. They practise these on their phone.`),
    mine.phrases.length ? [h('ul', { class: 'spb-grid' }, mine.phrases.slice(from, from + PAGE).map((p) => card(p))), pager(mine.phrases.length)] : h('div', { class: 'spb-empty' }, h('p', {}, 'No saved phrases yet.')),
  );
}

const badge = (seat: number) => h('span', { class: 'spb-seat', style: `color:var(--seat-${((seat - 1) % 8) + 1})`, 'aria-hidden': 'true' }, seatShape(seat));

const legend = () => h('span', { class: 'spb-legend' }, h('span', { class: 'spb-chip said' }, '✓ Said it'), h('span', { class: 'spb-chip practise' }, '↻ Practise'));

function pager(n: number): HTMLElement | null {
  const total = pages();
  if (total <= 1) return null;
  const prev = h('button', { type: 'button', class: 'spb-page', onclick: () => turn(-1), 'aria-label': 'Previous page' }, '◀ Prev') as HTMLButtonElement;
  const next = h('button', { type: 'button', class: 'spb-page', onclick: () => turn(1), 'aria-label': 'Next page' }, 'Next ▶') as HTMLButtonElement;
  prev.disabled = page === 0;
  next.disabled = page === total - 1;
  return h('div', { class: 'spb-pager' }, prev, h('span', { class: 'spb-where', role: 'status' }, `${page * PAGE + 1}–${Math.min(n, (page + 1) * PAGE)} of ${n}`), next);
}

function who(names: string[], kind: 'said' | 'practise'): HTMLElement {
  return h(
    'p',
    { class: `spb-who ${kind}` },
    h('span', { class: 'spb-who-label' }, kind === 'said' ? '✓ Said it' : '↻ Practise'),
    names.map((n) => h('span', { class: `spb-chip ${kind}` }, seats.has(n) ? badge(seats.get(n)!) : null, n)),
  );
}

function card(p: { text: string; kana: string; en: string; mode: ModeId }, said: string[] = [], missed: string[] = []): HTMLElement {
  const info = MODES[p.mode]?.info;
  return h(
    'li',
    { class: `spb-card${missed.length ? ' practise' : said.length ? ' said' : ''}` },
    h('p', { class: 'spb-jp', lang: 'ja' }, p.text),
    p.kana !== p.text ? h('p', { class: 'spb-kana', lang: 'ja' }, p.kana) : null,
    h('p', { class: 'spb-romaji' }, toRomaji(p.kana)),
    p.en ? h('p', { class: 'spb-en' }, p.en) : null,
    said.length ? who(said, 'said') : null,
    missed.length ? who(missed, 'practise') : null,
    h('p', { class: 'spb-mode' }, info?.titleJa ? ruby({ text: info.titleJa, kana: info.titleKana ?? TITLE_KANA[p.mode] ?? null }) : null, info?.titleJa ? ' · ' : null, info?.title ?? p.mode),
  );
}
