// @vitest-environment happy-dom
// patch() must not move elements it doesn't have to: moving an element restarts its CSS
// animations, which made every Kana Raid yōkai behind a caught one vanish and restart its march.

import { describe, expect, it, vi } from 'vitest';
import { h, patch } from '../shared/src/dom.js';

const ghosts = (ids: string[]) => [h('div', { class: 'gate' }, '⛩'), ids.map((id) => h('div', { class: 'yokai', 'data-key': id, style: `--delay:-${id}ms` }, id))];

describe('patch() with keyed children', () => {
  for (const [label, gone] of [
    ['the first', 'a'],
    ['a middle one', 'c'],
    ['the last', 'e'],
  ] as const) {
    it(`removes ${label} without moving the others`, () => {
      const root = document.createElement('div');
      const ids = ['a', 'b', 'c', 'd', 'e'];
      patch(root, ...ghosts(ids));
      const before = new Map([...root.querySelectorAll('.yokai')].map((el) => [el.getAttribute('data-key'), el]));
      const insert = vi.spyOn(root, 'insertBefore');
      patch(root, ...ghosts(ids.filter((x) => x !== gone)));
      expect(insert).not.toHaveBeenCalled();
      const after = [...root.querySelectorAll('.yokai')];
      expect(after.map((el) => el.getAttribute('data-key'))).toEqual(ids.filter((x) => x !== gone));
      for (const el of after) expect(el).toBe(before.get(el.getAttribute('data-key')));
    });
  }

  it('still reorders, adds and removes in one pass', () => {
    const root = document.createElement('div');
    patch(root, ...ghosts(['a', 'b', 'c', 'd']));
    const b = root.querySelector('[data-key="b"]');
    patch(root, ...ghosts(['d', 'b', 'x']));
    expect([...root.querySelectorAll('.yokai')].map((el) => el.getAttribute('data-key'))).toEqual(['d', 'b', 'x']);
    expect(root.querySelector('[data-key="b"]')).toBe(b);
    expect(root.firstElementChild?.className).toBe('gate');
  });
});
