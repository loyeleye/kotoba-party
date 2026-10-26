// Readings on Cloudflare. The kuromoji dictionary doesn't fit in a Worker, so a play command's
// utterances go to the reader service (server/src/readerMain.ts) when READER_URL is set. Without
// it, or when the reader is slow or down, answers are compared as written, like the Node server
// when its dictionary fails to load.

import type { UtteranceToken } from '../shared/src/japanese/kana.js';
import { setReading, utterancesIn } from '../server/src/utterances.js';

export interface RemoteReaderOptions {
  url: string;
  token?: string;
  /** Give up after this long and send the command on without readings. */
  timeoutMs?: number;
}

export async function addReadingsRemote(move: unknown, opts: RemoteReaderOptions | null): Promise<void> {
  const utterances = utterancesIn(move).filter((u) => u.text);
  if (!opts || utterances.length === 0) return;
  try {
    const res = await fetch(`${opts.url.replace(/\/$/, '')}/read`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}) },
      body: JSON.stringify({ texts: utterances.map((u) => u.text) }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 1500),
    });
    if (!res.ok) return;
    const { results } = (await res.json()) as { results?: { reading: string; tokens: UtteranceToken[] }[] };
    utterances.forEach((u, i) => {
      const r = results?.[i];
      if (r && typeof r.reading === 'string' && Array.isArray(r.tokens)) setReading(u, r.reading, r.tokens);
    });
  } catch {
    // Compared as written.
  }
}
