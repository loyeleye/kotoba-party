import { afterEach, describe, expect, it, vi } from 'vitest';
import { addReadingsRemote } from './reading.js';

describe('readings from the reader service', () => {
  afterEach(() => vi.unstubAllGlobals());

  const move = () => ({
    kind: 'answer',
    say: { via: 'speech', text: '三百円', reading: 'ずる', tokens: [] },
    extra: { inner: { via: 'typed', text: 'すし' } },
  });

  it('asks for every utterance and fills reading only where the text has kanji or digits', async () => {
    const fetch = vi.fn(async (_url: string, init: RequestInit) => {
      const { texts } = JSON.parse(String(init.body)) as { texts: string[] };
      expect(texts).toEqual(['三百円', 'すし']);
      expect((init.headers as Record<string, string>).authorization).toBe('Bearer secret');
      return Response.json({ results: [{ reading: 'さんびゃくえん', tokens: [{ surface: '三百円', reading: 'さんびゃくえん', pos: '名詞', known: true }] }, { reading: 'すし', tokens: [] }] });
    });
    vi.stubGlobal('fetch', fetch);
    const m = move();
    await addReadingsRemote(m, { url: 'https://reader.example/', token: 'secret' });
    expect(fetch).toHaveBeenCalledWith('https://reader.example/read', expect.anything());
    expect(m.say.reading).toBe('さんびゃくえん');
    expect(m.say.tokens).toHaveLength(1);
    expect(m.extra.inner).toEqual({ via: 'typed', text: 'すし', tokens: [] });
  });

  it('strips client-set readings and carries on without the service', async () => {
    const m = move();
    await addReadingsRemote(m, null);
    expect(m.say).toEqual({ via: 'speech', text: '三百円' });
  });

  it('carries on without readings when the service fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })));
    const m = move();
    await addReadingsRemote(m, { url: 'https://reader.example' });
    expect(m.say).toEqual({ via: 'speech', text: '三百円' });
  });
});
