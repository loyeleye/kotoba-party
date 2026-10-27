// "Invite friends": the room's two links, each with Copy and Share buttons, on the phones and
// the stage. The phone link joins the game (a fallback when the QR code won't scan); the stage
// link opens another stage screen for friends playing from somewhere else.
//
// Screens re-render on every change to the room, so the "Copied" state lives here, not in the
// button: a row drawn again within COPIED_MS of a copy still shows it.

import { h, ruby } from './dom.js';

export interface InviteLinks {
  phone: string;
  stage: string;
}

const COPIED_MS = 2000;

/**
 * Short-link hosts that are also a joke when read aloud: tanoshi.s.gy is たのしすぎ, "way too
 * fun" (s.gy read as すぎ). The invite card says it in front of the links that use one.
 */
const PUNS: Record<string, { jp: { text: string; furigana: [string, string][] }; en: string }> = {
  'tanoshi.s.gy': { jp: { text: '楽しすぎ！', furigana: [['楽', 'たの'], ['しすぎ！', '']] }, en: 'Way too fun!' },
};

/** The joke for the links' host, if it has one. */
export function pun(links: InviteLinks): HTMLElement | null {
  let host: string;
  try {
    host = new URL(links.phone).host;
  } catch {
    return null;
  }
  const p = PUNS[host];
  if (!p) return null;
  return h('p', { class: 'inv-pun' }, h('span', { class: 'inv-pun-host', translate: 'no' }, host), h('span', { 'aria-hidden': 'true' }, ' = '), ruby(p.jp, { class: 'inv-pun-jp' }), ' ', h('span', { class: 'inv-pun-en' }, p.en));
}
let copied: { url: string; ok: boolean; at: number } | null = null;

/** The room's links on `origin` (for example https://kotoba.party). */
export function inviteLinks(origin: string, code: string): InviteLinks {
  const base = origin.replace(/\/+$/, '');
  return { phone: `${base}/?code=${code}`, stage: `${base}/stage/?code=${code}` };
}

function canShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

/**
 * One link: its name, what it's for, the address (selectable, for copying by hand) and the
 * buttons. Share leads where the device has a share sheet (phones); Copy leads everywhere else.
 */
export function shareRow(label: string, purpose: string, url: string, shareText: string): HTMLElement {
  const recent = copied && copied.url === url && performance.now() - copied.at < COPIED_MS ? copied : null;
  const share = canShare();
  const copy = h(
    'button',
    { type: 'button', class: `inv-btn ${share ? '' : 'inv-main'} ${recent ? (recent.ok ? 'inv-done' : 'inv-fail') : ''}`, 'aria-label': `Copy ${label.toLowerCase()}` },
    h('span', { class: 'inv-icon', 'aria-hidden': 'true' }, recent?.ok ? '✓' : '⧉'),
    recent ? (recent.ok ? 'Copied' : 'Copy failed') : 'Copy',
  ) as HTMLButtonElement;
  copy.addEventListener('click', () => void copyText(url, copy));
  const shareBtn = share
    ? h('button', { type: 'button', class: 'inv-btn inv-main', 'aria-label': `Share ${label.toLowerCase()}` }, h('span', { class: 'inv-icon', 'aria-hidden': 'true' }, '↗'), 'Share')
    : null;
  shareBtn?.addEventListener('click', () => void navigator.share({ title: 'Kotoba Party', text: shareText, url }).catch(() => {}));
  return h(
    'div',
    { class: 'inv-row' },
    h('div', { class: 'inv-text' }, h('span', { class: 'inv-label' }, label), h('span', { class: 'inv-purpose' }, purpose)),
    h('span', { class: 'inv-url', translate: 'no' }, url.replace(/^https?:\/\//, '')),
    h('div', { class: 'inv-btns' }, shareBtn, copy),
  );
}

/**
 * Both links as a card. `heading` false leaves out the card's own title, for a place that
 * already has one (the stage's settings panel).
 */
export function invite(links: InviteLinks, code: string, heading = true): HTMLElement {
  return h(
    'section',
    { class: 'inv', 'aria-label': 'Invite friends' },
    heading ? h('h3', { class: 'inv-title' }, 'Invite friends') : null,
    heading ? h('p', { class: 'inv-lead' }, 'For friends who can’t scan the code, or are playing from somewhere else.') : null,
    pun(links),
    shareRow('Phone link', 'Joins the game as a player', links.phone, `Join my Kotoba Party game: room ${code}`),
    shareRow('Stage screen link', 'Shows the game on their own screen', links.stage, `Watch our Kotoba Party game on your own screen: room ${code}`),
    h('p', { class: 'inv-status', role: 'status', 'aria-live': 'polite' }),
  );
}

async function copyText(text: string, button: HTMLButtonElement): Promise<void> {
  let ok = false;
  try {
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch {
    // No clipboard API (or it was refused): copy through a hidden field instead.
    const field = h('textarea', { 'aria-hidden': 'true', style: 'position:fixed;opacity:0;pointer-events:none' }) as HTMLTextAreaElement;
    field.value = text;
    document.body.append(field);
    field.select();
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    field.remove();
  }
  copied = { url: text, ok, at: performance.now() };
  // Show it on the button now (the next render redraws it the same way until COPIED_MS).
  const row = button.closest('.inv-row');
  button.classList.add(ok ? 'inv-done' : 'inv-fail');
  button.lastChild!.textContent = ok ? 'Copied' : 'Copy failed';
  button.querySelector('.inv-icon')!.textContent = ok ? '✓' : '⧉';
  const status = button.closest('.inv')?.querySelector('.inv-status');
  if (status) status.textContent = ok ? 'Link copied' : 'Couldn’t copy: select the link and copy it';
  // If copying failed, select the address so a long-press or Ctrl+C finishes the job.
  if (!ok && row) {
    const url = row.querySelector('.inv-url');
    if (url) getSelection()?.selectAllChildren(url);
  }
  setTimeout(() => {
    if (!button.isConnected) return;
    button.classList.remove('inv-done', 'inv-fail');
    button.lastChild!.textContent = 'Copy';
    button.querySelector('.inv-icon')!.textContent = '⧉';
  }, COPIED_MS);
}
