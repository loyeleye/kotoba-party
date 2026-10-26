import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Prompt, RoomView } from '../shared/src/protocol.js';
import { viewFor } from '../shared/src/view.js';
import type { Room } from '../server/src/room.js';
import { createKotobaServer, type ServerConfig } from '../server/src/server.js';

export const prompts: Prompt[] = (
  JSON.parse(readFileSync(new URL('../content/debug/prompts.json', import.meta.url), 'utf8')) as { prompts: Prompt[] }
).prompts;

export const hashView = (view: RoomView): string => createHash('sha1').update(JSON.stringify(view)).digest('hex');

/**
 * Records, for every version a room commits, the hash of the view each seat and the stage
 * should see. A client is in sync when every version it accepted matches this record.
 */
export class TruthRecorder {
  readonly byVersion = new Map<number, Map<string, string>>();

  readonly onCommit = (room: Room, version: number): void => {
    const hashes = new Map<string, string>();
    hashes.set('stage', hashView(viewFor(room.state, { kind: 'stage' })));
    for (const p of room.state.players) hashes.set(p.id, hashView(viewFor(room.state, { kind: 'player', playerId: p.id })));
    this.byVersion.set(version, hashes);
  };
}

export async function startServer(config: Partial<ServerConfig> = {}) {
  const truth = new TruthRecorder();
  const server = createKotobaServer({ prompts, pingIntervalMs: 0, roomIdleMs: 0, onCommit: truth.onCommit, ...config });
  const baseUrl = await server.listen(0, '127.0.0.1');
  return { server, baseUrl, truth };
}

export async function until(check: () => boolean, timeoutMs = 10_000, label = 'condition'): Promise<void> {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeoutMs) throw new Error(`timed out waiting for ${label}`);
    await new Promise((r) => setTimeout(r, 5));
  }
}
