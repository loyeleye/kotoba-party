// The hosts follow the room's Audience setting: their LLM prompts, which written lines may play, the filter on
// their lines, and (in Kids rooms) a stricter filter on what players type.

import { describe, expect, it } from 'vitest';
import { audienceHostLines, hostLines } from '../content/src/hosts/index.js';
import { createHostVoice, LineBank, moderatorFor, ScriptedLlm, type BankLine } from '../server/ai/index.js';
import { hostSystemPrompt } from '../server/ai/hostVoice.js';
import { inkCoachSystemPrompt } from '../server/ai/inkCoach.js';
import { suspectSystemPrompt } from '../server/ai/suspect.js';
import { ManualClock } from '../server/src/clock.js';
import { bankVoice, hostDirector } from '../server/src/host.js';
import type { Room } from '../server/src/room.js';
import { AUDIENCE_CONTENT, audienceContentList } from '../shared/src/audience.js';
import type { CommandBody } from '../shared/src/client.js';
import { apply, createGame, type GameAction, type GameContext } from '../shared/src/game.js';
import { playerTextAllowed, textAllowed } from '../shared/src/moderation.js';
import { EMPTY_CONTENT, type HostCue } from '../shared/src/modes/mode.js';
import type { Audience, Command } from '../shared/src/protocol.js';
import { content } from './helpers.js';

describe('moderation by audience', () => {
  it('is stricter for Kids and leaves Family and Cheeky as they were', () => {
    for (const t of ['ビールを のみます', 'a stupid hat', 'くそ！', 'デブな ねこ', 'drunk uncle']) {
      expect(textAllowed(t, 'kids'), t).toBe(false);
      expect(textAllowed(t, 'family'), t).toBe(true);
      expect(textAllowed(t, 'cheeky'), t).toBe(true);
    }
    for (const t of ['しね', 'fuck', 'ばか']) for (const a of ['kids', 'family', 'cheeky'] as const) expect(textAllowed(t, a)).toBe(false);
  });

  it("doesn't catch everyday words that contain a blocked one", () => {
    for (const t of ['やくそくです', 'きものを きます', 'hello class', 'a skilled cat', 'うんこ']) expect(textAllowed(t, 'kids'), t).toBe(true);
  });

  it('checks typed player text only in Kids rooms', () => {
    expect(playerTextAllowed('ビール', 'kids')).toBe(false);
    expect(playerTextAllowed('ビール', 'family')).toBe(true);
    expect(playerTextAllowed('ばか', 'family')).toBe(true); // the VIP's Hide is the moderation there, as before
    expect(playerTextAllowed('ばか', undefined)).toBe(true);
  });

  it('composes with a custom moderator', () => {
    const ok = moderatorFor('kids', (t) => !t.includes('ねこ'));
    expect(ok('いぬ')).toBe(true);
    expect(ok('ねこ')).toBe(false);
    expect(ok('ビール')).toBe(false);
    expect(moderatorFor('cheeky')('ビール')).toBe(true);
  });
});

describe('AI prompts', () => {
  it('give the host, the suspects and the ink coach one audience line each', () => {
    expect(hostSystemPrompt('pon')).toBe(hostSystemPrompt('pon', 'family'));
    expect(hostSystemPrompt('pon', 'kids')).toContain('set to Kids');
    expect(hostSystemPrompt('pon', 'cheeky')).toContain('set to Cheeky');
    expect(hostSystemPrompt('pon', 'family')).not.toMatch(/set to (Kids|Cheeky)/);
    expect(hostSystemPrompt('chochin', 'kids').split('\n').length).toBe(hostSystemPrompt('chochin', 'family').split('\n').length);
    expect(suspectSystemPrompt('kids')).toContain('set to Kids');
    expect(suspectSystemPrompt('cheeky')).toContain('set to Cheeky');
    expect(inkCoachSystemPrompt('kids')).toContain('set to Kids');
    expect(inkCoachSystemPrompt('cheeky')).toContain('set to Cheeky');
  });

  it("send the room's audience with an LLM host line and filter it for Kids", async () => {
    const llm = new ScriptedLlm(() => ({ text: 'ビール、いっぱい！', kana: 'びーる、いっぱい！', en: 'Lots of beer!' }));
    const voice = createHostVoice({ llm, clock: new ManualClock() });
    const kids = await voice.prepare('R', { host: 'pon', event: 'reveal_react', tier: 'good', audience: 'kids' }).ready(100);
    expect(llm.calls[0]!.system).toContain('set to Kids');
    expect(kids?.source).toBe('bank'); // the beer line failed the Kids filter
    const cheeky = await voice.prepare('S', { host: 'pon', event: 'reveal_react', tier: 'good', audience: 'cheeky' }).ready(100);
    expect(llm.calls[1]!.system).toContain('set to Cheeky');
    expect(cheeky?.source).toBe('llm');
  });
});

describe('written lines', () => {
  const line = (id: string, audience?: 'kids' | 'cheeky'): BankLine => ({ id, host: 'pon', event: 'intro', jp: { text: id, kana: 'ぽん', en: id }, audience });
  const bank = () => new LineBank([line('shared'), line('kids', 'kids'), line('cheeky', 'cheeky')], () => 0);

  it("play the room's own lines first, then the shared ones, never another audience's", () => {
    const b = bank();
    expect(b.pick('pon', 'intro', undefined, {}, 'kids')?.id).toBe('kids');
    expect(b.pick('pon', 'intro', undefined, {}, 'kids')?.id).toBe('shared');
    for (let i = 0; i < 4; i++) expect(b.pick('pon', 'intro', undefined, {}, 'kids')?.id).not.toBe('cheeky');
    const family = bank();
    for (let i = 0; i < 4; i++) expect(family.pick('pon', 'intro')?.id).toBe('shared');
  });

  it('cover intro, IPPON, flop and awards for every host in both audiences', () => {
    for (const host of ['pon', 'chochin', 'fude'] as const)
      for (const audience of ['kids', 'cheeky'] as const) {
        const mine = audienceHostLines.filter((l) => l.host === host && l.audience === audience);
        expect(mine.length, `${host} ${audience}`).toBeGreaterThanOrEqual(12);
        for (const [event, tier] of [['intro'], ['reveal_react', 'ippon'], ['reveal_react', 'flop'], ['recap_award']] as const)
          expect(mine.some((l) => l.event === event && l.tier === tier), `${host} ${audience} ${event} ${tier ?? ''}`).toBe(true);
      }
  });

  it('pass their own audience filter, are kana only and have unique ids', () => {
    expect(new Set(hostLines.map((l) => l.id)).size).toBe(hostLines.length);
    for (const l of audienceHostLines) {
      const a: Audience = l.audience === 'kids' ? 'kids' : 'family';
      expect(textAllowed(l.jp.text, a) && textAllowed(l.jp.en, a), l.id).toBe(true);
      expect(l.jp.kana, l.id).toBe(l.jp.text);
      expect(/[一-鿿]/.test(l.jp.text), l.id).toBe(false);
    }
  });

  it('the plain bank voice skips the other audiences too', async () => {
    const cue: HostCue = { host: 'pon', event: 'intro', audience: 'family' };
    const lib = { ...EMPTY_CONTENT, hostLines: [{ ...line('cheeky', 'cheeky'), status: 'draft' as const }] };
    expect(await bankVoice(lib).speak('R', cue)).toBeNull();
    expect((await bankVoice(lib).speak('R', { ...cue, audience: 'cheeky' }))?.text).toBe('cheeky');
  });

  it("the director gives every cue the room's audience", async () => {
    const heard: HostCue[] = [];
    const direct = hostDirector({ speak: async (_code, c) => (heard.push(c), null), ahead: (_code, c) => void heard.push(c) });
    const room = { code: 'R', state: { audience: 'kids' }, say: () => {} } as unknown as Room;
    direct(room, [{ host: 'pon', event: 'intro', ahead: true }, { host: 'pon', event: 'intro' }], 1);
    expect(heard.map((c) => c.audience)).toEqual(['kids', 'kids']);
  });
});

describe('typed text in a Kids room', () => {
  let ids = 0;
  const gctx = (): GameContext => ({ now: 1_000_000, content, newId: () => `id${++ids}`, random: () => 0 });
  const as = (playerId: string) => ({ kind: 'player', playerId }) as const;

  function room(audience: Audience) {
    const s = createGame('BCDF');
    const act = (a: GameAction) => apply(s, a, gctx());
    let n = 0;
    const cmd = (actor: ReturnType<typeof as> | { kind: 'stage' }, command: CommandBody) => apply(s, { type: 'command', actor, command: { ...command, id: `c${++n}` } as Command }, gctx());
    for (let i = 1; i <= 4; i++) {
      act({ type: 'join', playerId: `p${i}`, name: `P${i}`, level: 'n5' });
      act({ type: 'connection', playerId: `p${i}`, connected: true });
    }
    cmd({ kind: 'stage' }, { type: 'settings', audience });
    return { s, cmd, tick: () => act({ type: 'timeout', phaseSeq: s.phaseSeq }), play: (pid: string, move: unknown) => cmd(as(pid), { type: 'play', move }) };
  }

  it("refuses a Word Gauntlet fake that isn't for children, only in Kids rooms", () => {
    for (const audience of ['kids', 'family'] as const) {
      const r = room(audience);
      r.cmd({ kind: 'stage' }, { type: 'start', mode: 'word-gauntlet', packId: 'food' });
      while (r.s.phase !== 'answer') r.tick();
      expect(r.play('p1', { kind: 'fake', text: 'A beer for ghosts' }).error).toBe(audience === 'kids' ? 'kids-words' : undefined);
      expect(r.play('p2', { kind: 'fake', text: 'A soup for ghosts' }).changed).toBe(true);
    }
  });
});

describe('settings copy', () => {
  it('lists the modes with their own Kids and Cheeky content', () => {
    expect(AUDIENCE_CONTENT['karaoke-duel']).toBeDefined();
    expect(audienceContentList()).toContain('Karaoke Duel');
  });
});
