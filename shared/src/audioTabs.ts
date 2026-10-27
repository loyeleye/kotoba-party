// Which of this browser's tabs on a room makes the sound. Two tabs showing the same game (two
// stage tabs, or two phone tabs) would otherwise play every song and line twice, a beat apart.
// The tabs talk over a BroadcastChannel: a tab claims the sound when it's shown or focused and
// the others go quiet; a tab that's hidden or closed hands it to one that's still on screen, and
// if none is, the hidden one keeps playing. The channel only reaches tabs of this browser, so
// other devices and remote stages are never affected. A stage and a phone are separate channels:
// clicking into your phone tab doesn't stop the stage's music.

type Claim = { id: string; at: number };
type Msg = { t: 'claim'; id: string; at: number } | { t: 'who' } | { t: 'away'; id: string; closing: boolean };

export type PageEvent = 'shown' | 'hidden' | 'focus' | 'close';

/** What the election needs from the page: whether it's on screen, and when that changes. */
export interface Page {
  visible(): boolean;
  watch(fn: (e: PageEvent) => void): () => void;
}

/** What it needs from a BroadcastChannel. */
export type Channel = Pick<BroadcastChannel, 'postMessage' | 'close' | 'onmessage'>;

/** How long a tab opened in the background waits to hear from a tab that already has the sound. */
const ASK_MS = 300;
/** How long hidden tabs wait, after the sound's tab closes, for one on screen to take it. */
const ORPHAN_MS = 200;

const newer = (a: Claim, b: Claim | null): boolean => !b || a.at > b.at || (a.at === b.at && a.id > b.id);

/** One tab's view of the election on one channel. */
export class AudioTabs {
  readonly id: string;
  private owner: Claim | null = null;
  private wasActive = false;
  private started = false;
  private readonly unwatch: () => void;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly channel: Channel,
    private readonly page: Page,
    private readonly onChange: (active: boolean) => void,
    id = Math.random().toString(36).slice(2) + Date.now().toString(36),
  ) {
    this.id = id;
    channel.onmessage = (e) => this.receive(e.data as Msg);
    this.unwatch = page.watch((e) => this.pageEvent(e));
    this.post({ t: 'who' });
    if (page.visible()) this.claim();
    else this.later(ASK_MS);
    this.wasActive = this.active();
    this.started = true;
  }

  /** True when this tab should make sound. */
  active(): boolean {
    return this.owner?.id === this.id;
  }

  close(): void {
    clearTimeout(this.timer);
    this.unwatch();
    if (this.active()) this.post({ t: 'away', id: this.id, closing: true });
    this.channel.onmessage = null;
    this.channel.close();
  }

  private claim(): void {
    const c = { id: this.id, at: Math.max(Date.now(), (this.owner?.at ?? 0) + 1) };
    this.owner = c;
    this.post({ t: 'claim', ...c });
    this.changed();
  }

  /** Claims after `ms` unless someone has the sound by then. */
  private later(ms: number): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      if (!this.owner) this.claim();
    }, ms);
  }

  private pageEvent(e: PageEvent): void {
    if (e === 'close') {
      // Leaving (or going into the back/forward cache): hand the sound on. Coming back shows the page, which claims it.
      if (this.active()) this.post({ t: 'away', id: this.id, closing: true });
      this.owner = null;
      return this.changed();
    }
    if (e === 'shown' || e === 'focus') {
      if (!this.active()) this.claim();
    } else if (this.active()) this.post({ t: 'away', id: this.id, closing: false });
  }

  private receive(m: Msg): void {
    if (m.t === 'who') {
      if (this.active()) this.post({ t: 'claim', ...this.owner! });
    } else if (m.t === 'claim') {
      const c = { id: m.id, at: m.at };
      if (newer(c, this.owner)) {
        this.owner = c;
        this.changed();
      }
    } else if (m.t === 'away' && m.id === this.owner?.id) {
      if (m.closing) this.owner = null;
      if (this.page.visible()) this.claim();
      else if (m.closing) this.later(ORPHAN_MS);
    }
  }

  private post(m: Msg): void {
    try {
      this.channel.postMessage(m);
    } catch {
      // channel already closed
    }
  }

  private changed(): void {
    const now = this.active();
    if (!this.started || now === this.wasActive) return;
    this.wasActive = now;
    this.onChange(now);
  }
}

// ---- this page ----

let tabs: AudioTabs | null = null;
let joined = '';
const listeners: ((active: boolean) => void)[] = [];

const browserPage: Page = {
  visible: () => document.visibilityState === 'visible',
  watch(fn) {
    const vis = () => fn(document.visibilityState === 'visible' ? 'shown' : 'hidden');
    const focus = () => fn('focus');
    const close = () => fn('close');
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('focus', focus);
    window.addEventListener('pagehide', close);
    return () => {
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('focus', focus);
      window.removeEventListener('pagehide', close);
    };
  },
};

/**
 * Joins the other tabs of this browser showing room `code` as a `screen`, so only one plays sound.
 * Call again when the room changes. Without BroadcastChannel every tab keeps its sound.
 */
export function joinAudioTabs(screen: 'stage' | 'phone', code: string): void {
  const name = `kotoba:audio:${screen}:${code}`;
  if (name === joined || typeof BroadcastChannel !== 'function' || typeof document === 'undefined') return;
  const before = hasTabAudio();
  tabs?.close();
  joined = name;
  tabs = new AudioTabs(new BroadcastChannel(name), browserPage, (a) => listeners.forEach((f) => f(a)));
  if (hasTabAudio() !== before) listeners.forEach((f) => f(hasTabAudio()));
}

/** False while another tab of this game, in this browser, has the sound. */
export const hasTabAudio = (): boolean => !tabs || tabs.active();

/** Runs `fn` when this tab gains or loses the sound. */
export function onTabAudio(fn: (active: boolean) => void): void {
  listeners.push(fn);
}
