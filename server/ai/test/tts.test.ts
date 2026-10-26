import { describe, expect, it } from 'vitest';
import { AudioStore, VoicevoxTts, mouthTrack, wavMs } from '../tts.js';

const speakers = [
  { name: '玄野武宏', styles: [{ name: 'ノーマル', id: 11 }, { name: '喜び', id: 39 }] },
  { name: 'ちび式じい', styles: [{ name: 'ノーマル', id: 42 }] },
  { name: '春日部つむぎ', styles: [{ name: 'ノーマル', id: 8 }] },
];

function fakeEngine() {
  const calls: string[] = [];
  const wav = new Uint8Array(44 + 48000);
  wav.set([0x52, 0x49, 0x46, 0x46]);
  new DataView(wav.buffer).setUint32(28, 48000, true);
  const f = (async (url: string | URL, init?: RequestInit) => {
    const u = new URL(String(url));
    calls.push(`${init?.method ?? 'GET'} ${u.pathname}${u.search}`);
    if (u.pathname === '/speakers') return Response.json(speakers);
    if (u.pathname === '/audio_query') return Response.json({ accent_phrases: [], speedScale: 1 });
    if (u.pathname === '/synthesis') {
      const body = JSON.parse(String(init?.body));
      calls.push(`speed=${body.speedScale}`);
      return new Response(wav);
    }
    return new Response('no', { status: 404 });
  }) as typeof fetch;
  return { f, calls };
}

describe('VOICEVOX adapter', () => {
  it('resolves voices by name and style, applies the host settings and returns a WAV', async () => {
    const { f, calls } = fakeEngine();
    const tts = new VoicevoxTts({ baseUrl: 'http://vv:50021', fetch: f });
    expect(await tts.check()).toEqual({ ok: true });
    const a = await tts.speak({ host: 'pon', kana: 'いっぽん！', tier: 'ippon' });
    expect(calls).toContain(`POST /audio_query?text=${encodeURIComponent('いっぽん！')}&speaker=39`);
    expect(calls).toContain('speed=1.1');
    expect(a.mime).toBe('audio/wav');
    expect(a.ms).toBe(1000);
    await tts.speak({ host: 'chochin', kana: 'しゅっぱつ' });
    expect(calls.filter((c) => c.startsWith('GET /speakers'))).toHaveLength(1);
    expect(calls).toContain('POST /synthesis?speaker=42');
  });

  it('reports a missing voice', async () => {
    const f = (async () => Response.json([{ name: '四国めたん', styles: [{ name: 'ノーマル', id: 2 }] }])) as unknown as typeof fetch;
    const r = await new VoicevoxTts({ fetch: f }).check();
    expect(r.ok).toBe(false);
  });
});

describe('audio store', () => {
  it('evicts the oldest unpinned audio past its size', () => {
    const s = new AudioStore(10);
    const a = (id: string) => ({ id, mime: 'audio/wav', bytes: new Uint8Array(4) });
    s.put(a('pinned'), true);
    s.put(a('one'));
    s.put(a('two'));
    expect(s.has('pinned')).toBe(true);
    expect(s.has('one')).toBe(false);
    expect(s.has('two')).toBe(true);
  });

  it('reads WAV length', () => {
    expect(wavMs(new Uint8Array(3))).toBeUndefined();
  });
});

// Runs against a real engine when one is up (docker run -p 50021:50021 voicevox/voicevox_engine:cpu-latest).
const live = process.env.VOICEVOX_URL;
describe.skipIf(!live)('VOICEVOX engine (live)', () => {
  it('voices a line for every host', async () => {
    const tts = new VoicevoxTts({ baseUrl: live });
    expect(await tts.check()).toEqual({ ok: true });
    for (const host of ['pon', 'chochin', 'fude'] as const) {
      const a = await tts.speak({ host, kana: 'いっぽん！すごい！', tier: 'ippon' });
      expect(a.bytes.length).toBeGreaterThan(10_000);
      expect(a.ms).toBeGreaterThan(300);
    }
  });
});

describe('lip sync from VOICEVOX timing', () => {
  it('opens wide for あ and お, half for い, う and え, and closes for ん, pauses and lips', () => {
    // ぽん、こんにちは at double speed: every length halves.
    const query = {
      speedScale: 2,
      prePhonemeLength: 0.1,
      postPhonemeLength: 0.2,
      accent_phrases: [
        { moras: [{ consonant: 'p', consonant_length: 0.06, vowel: 'o', vowel_length: 0.1 }, { vowel: 'N', vowel_length: 0.08 }], pause_mora: { vowel: 'pau', vowel_length: 0.2 } },
        { moras: [{ consonant: 'k', consonant_length: 0.04, vowel: 'o', vowel_length: 0.1 }, { vowel: 'N', vowel_length: 0.06 }, { consonant: 'n', consonant_length: 0.04, vowel: 'i', vowel_length: 0.08 }] },
      ],
    };
    expect(mouthTrack(query)).toEqual([
      [0, 80], // pre-phoneme + p
      [2, 50], // o
      [0, 140], // ん + pause
      [1, 20], // k
      [2, 50], // o
      [0, 30], // ん
      [1, 60], // n + i
      [0, 100], // post-phoneme
    ]);
  });
});
