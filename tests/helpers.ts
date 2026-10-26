import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { RoomView } from '../shared/src/protocol.js';
import { loadContent } from '../server/src/content.js';
import type { Room } from '../server/src/room.js';
import { createKotobaServer, type ServerConfig } from '../server/src/server.js';
import { createGame } from '../shared/src/game.js';
import { viewFor } from '../shared/src/view.js';

export const content = loadContent(fileURLToPath(new URL('../', import.meta.url)));

export const hashView = (view: RoomView): string => createHash('sha1').update(JSON.stringify(view)).digest('hex');

/**
 * Records, for every version a room commits, the hash of the view each seat and the stage
 * should see. A client is in sync when every version it accepted matches this record.
 */
export class TruthRecorder {
  readonly byVersion = new Map<number, Map<string, string>>();

  readonly onCommit = (room: Room, version: number): void => {
    // v0 is a fresh, empty lobby (never committed): a screen that opened before anyone joined saw it.
    if (version === 1) {
      this.byVersion.set(0, new Map([['stage', hashView(viewFor(createGame(room.code), { kind: 'stage' }, content))]]));
    }
    const hashes = new Map<string, string>();
    hashes.set('stage', hashView(room.viewFor({ kind: 'stage' })));
    for (const p of room.state.players) hashes.set(p.id, hashView(room.viewFor({ kind: 'player', playerId: p.id })));
    this.byVersion.set(version, hashes);
  };
}

export async function startServer(config: Partial<ServerConfig> = {}) {
  const truth = new TruthRecorder();
  const server = createKotobaServer({ content, pingIntervalMs: 0, roomIdleMs: 0, onCommit: truth.onCommit, ...config });
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
