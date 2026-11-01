// The N3 listening points are marked "You'll hear these" on the Limited Express (docs/n3-coverage.md), so each one
// has host lines that say it, and those lines play only in a room where someone plays at N3.
import { describe, expect, it } from 'vitest';
import { hostLines, N3_LISTEN_LINES, n3ListeningLines } from '../content/src/hosts/index.js';
import { LineBank, type BankLine } from '../server/ai/index.js';
import { bankVoice, hostDirector } from '../server/src/host.js';
import type { Room } from '../server/src/room.js';
import { N3_POINTS } from '../shared/src/japanese/n3Points.js';
import { EMPTY_CONTENT, type HostCue } from '../shared/src/modes/mode.js';

/** What each listening point sounds like in a line. */
const SAYS: Record<string, RegExp> = {
  'toka-hearsay': /とか\s*いって/,
  kashira: /かしら/,
  'mono-da': /もの(よ|だ)/,
  gimi: /ぎみ/,
  'te-goran': /ごらん/,
  'oki-ni': /おきに/,
  'goto-ni': /ごとに/,
  'you-nara': /ようなら/,
  'kara-ni-kakete': /から[^。]*に\s*かけて/,
  'osore-ga-aru': /おそれが/,
  jan: /じゃん/,
  'you-ga-nai': /ようが\s*ない/,
  'koto-da': /ことだ/,
};

describe('host lines for the N3 listening points', () => {
  it('give every listening point at least two lines that say it', () => {
    const byId = new Map(hostLines.map((l) => [l.id, l]));
    for (const p of N3_POINTS.filter((x) => x.fit === 'listen')) {
      const ids = N3_LISTEN_LINES[p.id] ?? [];
      expect([p.id, ids.length >= 2]).toEqual([p.id, true]);
      for (const id of ids) {
        const l = byId.get(id);
        expect([p.id, id, !!l && SAYS[p.id]!.test(l.jp.kana)]).toEqual([p.id, id, true]);
      }
    }
  });

  it('are N3-only, kana only, and every one is listed under its point', () => {
    const listed = new Set(Object.values(N3_LISTEN_LINES).flat());
    for (const l of n3ListeningLines) {
      expect([l.id, l.level, l.jp.kana === l.jp.text, /[一-鿿]/.test(l.jp.text), listed.has(l.id)]).toEqual([l.id, 'n3', true, false, true]);
    }
  });

  it('play only in a room where someone plays at N3', async () => {
    const line = { ...n3ListeningLines[0]! };
    const lib = { ...EMPTY_CONTENT, hostLines: [line] };
    const cue: HostCue = { host: line.host, event: line.event };
    expect(await bankVoice(lib).speak('R', cue)).toBeNull();
    expect((await bankVoice(lib).speak('R', { ...cue, n3: true }))?.text).toBe(line.jp.text);
    const bank = new LineBank([line as BankLine]);
    expect(bank.pick(line.host, line.event as BankLine['event'])).toBeUndefined();
    expect(bank.pick(line.host, line.event as BankLine['event'], undefined, {}, 'family', true)?.id).toBe(line.id);
  });

  it('the director marks a room with an N3 player', () => {
    const heard: HostCue[] = [];
    const direct = hostDirector({ speak: async (_code, c) => (heard.push(c), null) });
    const room = (levels: string[]) => ({ code: 'R', state: { audience: 'family', players: levels.map((level) => ({ level })) }, say: () => {} }) as unknown as Room;
    direct(room(['kana', 'n5']), [{ host: 'pon', event: 'intro' }], 1);
    direct(room(['n5', 'n3']), [{ host: 'pon', event: 'intro' }], 1);
    expect(heard.map((c) => c.n3)).toEqual([false, true]);
  });
});
