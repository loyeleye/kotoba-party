import { afterEach, describe, expect, it } from 'vitest';
import { AudioTabs, type Page, type PageEvent } from '../shared/src/audioTabs.js';

/** A tab: a page we can show, hide, focus and close, on its own BroadcastChannel. */
class Tab {
  shown: boolean;
  private fn: ((e: PageEvent) => void) | null = null;
  tabs: AudioTabs;
  readonly page: Page = {
    visible: () => this.shown,
    watch: (fn) => ((this.fn = fn), () => (this.fn = null)),
  };
  constructor(name: string, shown: boolean, channel = 'kotoba:audio:stage:ABCD') {
    this.shown = shown;
    this.tabs = new AudioTabs(new BroadcastChannel(channel), this.page, () => {}, name);
  }
  show(): void {
    this.shown = true;
    this.fn?.('shown');
  }
  hide(): void {
    this.shown = false;
    this.fn?.('hidden');
  }
  focus(): void {
    this.fn?.('focus');
  }
  leave(): void {
    this.fn?.('close');
    this.tabs.close();
  }
  get active(): boolean {
    return this.tabs.active();
  }
}

const open: Tab[] = [];
const tab = (name: string, shown: boolean, channel?: string): Tab => {
  const t = new Tab(name, shown, channel);
  open.push(t);
  return t;
};
const settle = (ms = 30) => new Promise((r) => setTimeout(r, ms));

afterEach(() => {
  for (const t of open.splice(0)) t.tabs.close();
});

describe('audio follows the tab in front', () => {
  it('a tab on its own has the sound, even opened in the background', async () => {
    const a = tab('a', true);
    expect(a.active).toBe(true);
    const b = tab('b', false, 'kotoba:audio:stage:WXYZ');
    expect(b.active).toBe(false);
    await settle(400);
    expect(b.active).toBe(true);
  });

  it('switching tabs hands the sound over, and back', async () => {
    const a = tab('a', true);
    await settle();
    a.hide();
    const b = tab('b', true);
    await settle();
    expect([a.active, b.active]).toEqual([false, true]);
    b.hide();
    a.show();
    await settle();
    expect([a.active, b.active]).toEqual([true, false]);
  });

  it('a tab opened in the background stays quiet while another has the sound', async () => {
    const a = tab('a', true);
    await settle();
    const b = tab('b', false);
    await settle(400);
    expect([a.active, b.active]).toEqual([true, false]);
  });

  it('a hidden tab keeps playing when no game tab is on screen', async () => {
    const a = tab('a', true);
    const b = tab('b', false);
    await settle(400);
    a.hide();
    await settle();
    expect([a.active, b.active]).toEqual([true, false]);
  });

  it('hiding the tab with the sound passes it to a game tab still on screen (two windows)', async () => {
    const a = tab('a', true);
    await settle();
    const b = tab('b', true);
    await settle();
    a.focus();
    await settle();
    expect([a.active, b.active]).toEqual([true, false]);
    a.hide();
    await settle();
    expect([a.active, b.active]).toEqual([false, true]);
  });

  it('closing the tab with the sound passes it on, even to a hidden tab', async () => {
    const a = tab('a', true);
    await settle();
    const b = tab('b', false);
    await settle(400);
    a.leave();
    await settle(300);
    expect(b.active).toBe(true);
  });

  it('two background tabs left alone agree on one', async () => {
    const a = tab('a', true);
    await settle();
    const b = tab('b', false);
    const c = tab('c', false);
    await settle(400);
    a.leave();
    await settle(400);
    expect([b.active, c.active].filter(Boolean)).toHaveLength(1);
  });

  it('other rooms and screens are separate', async () => {
    const a = tab('a', true, 'kotoba:audio:stage:ABCD');
    const b = tab('b', true, 'kotoba:audio:phone:ABCD');
    const c = tab('c', true, 'kotoba:audio:stage:WXYZ');
    await settle();
    expect([a.active, b.active, c.active]).toEqual([true, true, true]);
  });
});
