// Client side of the protocol, shared by the stage, the phone controller and the headless bots.
// Runs in browsers and in Node 22+ (both have fetch and WebSocket built in).

import {
  CLOSE,
  type ByeReason,
  type Command,
  type CommandResult,
  type CreateRoomResponse,
  type JoinError,
  type JoinRequest,
  type JoinResponse,
  type RoomView,
  type ServerMessage,
} from './protocol.js';

/** Distributive Omit, so each command keeps its own fields. */
export type CommandBody = Command extends infer C ? (C extends Command ? Omit<C, 'id'> : never) : never;

export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting' | 'seat-lost' | 'room-gone' | 'closed';

export interface RoomClientOptions {
  baseUrl: string;
  code: string;
  token: string;
  onState?: (view: RoomView, v: number) => void;
  onStatus?: (status: ConnectionStatus) => void;
  onBye?: (reason: ByeReason) => void;
}

const BACKOFF_MS = [250, 500, 1000, 2000, 3000];

export function newCommandId(): string {
  return globalThis.crypto.randomUUID();
}

export async function createRoom(baseUrl: string): Promise<CreateRoomResponse> {
  const res = await fetch(`${baseUrl}/api/rooms`, { method: 'POST' });
  if (!res.ok) throw new Error(`create room failed: ${res.status}`);
  return (await res.json()) as CreateRoomResponse;
}

export async function joinRoom(
  baseUrl: string,
  code: string,
  req: JoinRequest,
): Promise<JoinResponse | { error: JoinError | 'room-not-found' }> {
  const res = await fetch(`${baseUrl}/api/rooms/${encodeURIComponent(code)}/join`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(req),
  });
  return (await res.json()) as JoinResponse | { error: JoinError };
}

/**
 * One connection to a room: listens for pushed state on a WebSocket and sends commands
 * over HTTP. Older versions are dropped, so a late message can never roll the view back.
 */
export class RoomClient {
  view: RoomView | null = null;
  version = 0;
  status: ConnectionStatus = 'closed';
  /** server clock minus local clock, from the last state message */
  clockOffset = 0;
  /** Messages ignored because a newer version had already arrived. */
  staleDropped = 0;

  private ws: WebSocket | null = null;
  private attempts = 0;
  private wantOpen = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly opts: RoomClientOptions;

  constructor(opts: RoomClientOptions) {
    this.opts = opts;
  }

  get code(): string {
    return this.opts.code;
  }

  connect(): void {
    this.wantOpen = true;
    if (this.ws) return;
    this.open();
  }

  /** Cuts the socket and stops reconnecting (what a phone losing signal looks like to the server). */
  drop(): void {
    this.wantOpen = false;
    this.clearRetry();
    this.ws?.close();
    this.ws = null;
    this.setStatus('closed');
  }

  /** Reconnects now, skipping any backoff wait. */
  reconnectNow(): void {
    if (this.status === 'seat-lost' || this.status === 'room-gone') return;
    this.wantOpen = true;
    this.clearRetry();
    if (!this.ws) this.open();
  }

  close(): void {
    this.drop();
  }

  /** Remaining ms in the current phase, by the server's clock. */
  remainingMs(): number | null {
    if (!this.view || this.view.deadline === null) return null;
    return Math.max(0, this.view.deadline - (Date.now() + this.clockOffset));
  }

  /** Sends a command. Network failures are retried with the same id, which the server de-duplicates. */
  async send(body: CommandBody, id: string = newCommandId()): Promise<CommandResult> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const res = await fetch(`${this.opts.baseUrl}/api/rooms/${this.opts.code}/commands`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${this.opts.token}` },
          body: JSON.stringify({ ...body, id }),
        });
        if (res.status === 401) {
          this.setStatus('seat-lost');
          return { ok: false, error: 'not-allowed', v: this.version };
        }
        if (res.status === 404) {
          this.setStatus('room-gone');
          return { ok: false, error: 'not-allowed', v: this.version };
        }
        return (await res.json()) as CommandResult;
      } catch (err) {
        lastErr = err;
        await sleep(150 * (attempt + 1));
      }
    }
    throw lastErr;
  }

  private open(): void {
    this.setStatus(this.attempts === 0 && !this.view ? 'connecting' : 'reconnecting');
    const wsUrl = `${this.opts.baseUrl.replace(/^http/, 'ws')}/ws?code=${this.opts.code}&token=${encodeURIComponent(this.opts.token)}`;
    const ws = new WebSocket(wsUrl);
    this.ws = ws;

    ws.onmessage = (event) => {
      if (this.ws !== ws) return;
      const msg = JSON.parse(String(event.data)) as ServerMessage;
      if (msg.type === 'bye') {
        this.opts.onBye?.(msg.reason);
        return;
      }
      this.attempts = 0;
      if (this.status !== 'open') this.setStatus('open');
      if (msg.v <= this.version) {
        this.staleDropped += 1;
        return;
      }
      this.version = msg.v;
      this.view = msg.view;
      this.clockOffset = msg.now - Date.now();
      this.opts.onState?.(msg.view, msg.v);
    };

    ws.onclose = (event) => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (event.code === CLOSE.seatReleased || event.code === CLOSE.badToken) return this.setStatus('seat-lost');
      if (event.code === CLOSE.roomGone) return this.setStatus('room-gone');
      if (!this.wantOpen) return this.setStatus('closed');
      const delay = BACKOFF_MS[Math.min(this.attempts, BACKOFF_MS.length - 1)]!;
      this.attempts += 1;
      this.setStatus('reconnecting');
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        if (this.wantOpen && !this.ws) this.open();
      }, delay);
    };

    ws.onerror = () => {
      // onclose follows and handles the retry.
    };
  }

  private clearRetry(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  private setStatus(status: ConnectionStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.opts.onStatus?.(status);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
