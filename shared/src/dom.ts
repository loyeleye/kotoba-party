// A tiny element builder for the stage and controller pages (no framework in Phase 0).

type Child = Node | string | number | null | undefined | false;
type Attrs = Record<string, string | number | boolean | EventListener | null | undefined>;

export function h(tag: string, attrs: Attrs = {}, ...children: (Child | Child[])[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
    else if (key === 'class') el.className = String(value);
    else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, String(value));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : String(child));
  }
  return el;
}

export function mount(root: HTMLElement, ...children: (Child | Child[])[]): void {
  root.replaceChildren(...children.flat().filter((c): c is Node | string => c !== null && c !== undefined && c !== false).map((c) => (c instanceof Node ? c : String(c))));
}

export function formatSeconds(ms: number | null): string {
  if (ms === null) return '';
  return String(Math.ceil(ms / 1000));
}

export const PHASE_LABELS: Record<string, string> = {
  lobby: 'Lobby',
  intro: 'Intro',
  prompt: 'Prompt',
  answer: 'Answer',
  reveal: 'Reveal & vote',
  encore: 'Encore',
  score: 'Score',
  recap: 'Recap',
};
