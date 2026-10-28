// Pixel art in place of emoji (stage/assets/manifest.json lists every file and its prompt). Each
// picture keeps its emoji as a fallback, so a missing file shows the old glyph, never a broken
// image.

import { h } from './dom.js';

const ASSETS = '/stage/assets';

/** An <img> that turns back into its emoji if the file doesn't load. */
export function pic(src: string, emoji: string, cls: string, alt = ''): HTMLElement {
  return h('img', {
    class: `pix ${cls}`,
    src,
    alt,
    draggable: 'false',
    onerror: (e: Event) => (e.target as HTMLElement).replaceWith(h('span', { class: cls }, emoji)),
  });
}

export const icon = (name: string, emoji: string, cls: string, alt = ''): HTMLElement => pic(`${ASSETS}/icons/${name}.png`, emoji, cls, alt);

/** The icon a lookup table names for this id, or the plain emoji. */
function mapped(table: Record<string, string>, id: string, emoji: string, cls: string): HTMLElement {
  const name = table[id];
  return name ? icon(name, emoji, cls) : h('span', { class: cls }, emoji);
}

// ---- Murder at the Onsen ----

const ONSEN_VICTIM: Record<string, string> = { snowman: 'victim-snowman', pudding: 'victim-pudding', duck: 'victim-duck', fallback: 'victim-towel' };
const ONSEN_ITEM: Record<string, string> = { snowman: 'item-scarf', pudding: 'item-spoon', duck: 'item-fork', fallback: 'item-shoe' };

export const suspectPic = (s: { id: string; emoji: string }, cls: string, mood: 'calm' | 'shock' = 'calm'): HTMLElement =>
  pic(`${ASSETS}/portraits/onsen/${s.id}-${mood}.png`, s.emoji, cls);
export const victimPic = (caseId: string, emoji: string, cls: string): HTMLElement => mapped(ONSEN_VICTIM, caseId, emoji, cls);
export const itemPic = (caseId: string, emoji: string, cls: string): HTMLElement => mapped(ONSEN_ITEM, caseId, emoji, cls);

// ---- Omiai Matchmaker ----

export const guestPic = (g: { id: string; emoji: string }, cls: string, mood: 'calm' | 'blush' = 'calm'): HTMLElement =>
  pic(`${ASSETS}/portraits/omiai/${g.id}-${mood}.png`, g.emoji, cls);

// ---- places and scenes (Who's the Tourist?, Phrase Bingo Theater) ----

const PLACE: Record<string, string> = {
  konbini: 'place-konbini', restaurant: 'place-restaurant', ramen: 'place-ramen', supermarket: 'place-supermarket', eki: 'place-station', onsen: 'place-onsen',
  kuukou: 'place-airport', hotel: 'place-hotel', gakkou: 'place-school', kouen: 'place-park', ie: 'place-home', byouin: 'place-hospital',
};
const SCENE: Record<string, string> = {
  konbini: 'place-konbini', ramen: 'place-ramen', hanami: 'scene-hanami', dinner: 'scene-nabe', 'meet-parents': 'scene-family', morning: 'scene-morning',
  ryokan: 'place-onsen', platform: 'place-station', taxi: 'scene-taxi',
  kyuushoku: 'place-school', ensoku: 'place-park', izakaya: 'place-restaurant', date: 'place-restaurant', asagaeri: 'place-station',
};

export const placePic = (p: { id: string; emoji: string }, cls: string): HTMLElement => mapped(PLACE, p.id, p.emoji, cls);
export const scenePic = (s: { id: string; emoji: string }, cls: string): HTMLElement => mapped(SCENE, s.id, s.emoji, cls);

// ---- Phrasebook ----

/** Each game's pixel icon (the Phrasebook cards on the stage and the phone). */
export const modeIconSrc = (mode: string): string =>
  `${ASSETS}/icons/${mode === 'last-train' ? 'lt-train' : mode === 'bento-haus-vs' ? 'mode-bento-haus' : `mode-${mode}`}.png`;
