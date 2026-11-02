// @vitest-environment happy-dom
// Katsuyō Raid's TV and phone screens draw every phase of a real Green Car game, through the kana raid's screens
// (which hand a Katsuyō view on), and the TV never shows a chunk or the boss line before it's caught.

import { describe, expect, it } from 'vitest';
import { KATSUYO_BOSS_LINES } from '../content/src/katsuyo/lines.js';
import type { CommandBody } from '../shared/src/client.js';
import { apply, createGame, type GameContext } from '../shared/src/game.js';
import type { KatsuyoRaidView, KatsuyoState } from '../shared/src/modes/kanaRaid/katsuyoRaid.js';
import type { Command, RoomView } from '../shared/src/protocol.js';
import { viewFor } from '../shared/src/view.js';
import { kanaRaidStage } from '../stage/src/modes/kanaRaid.js';
import { kanaRaidPhone } from '../controller/src/modes/kanaRaid.js';
import type { PhoneContext } from '../controller/src/modes/types.js';
import { loadContent } from '../server/src/content.js';

// helpers.ts finds the repo from import.meta.url, which isn't a file URL under happy-dom; vitest runs from the root.
const content = loadContent(`${process.cwd()}/`);
let now = 5_000_000;
let ids = 0;
let seed = 3;
const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const gctx = (): GameContext => ({ now, content, newId: () => `s${++ids}`, random });

describe('Katsuyō Raid screens', () => {
  it('draw every phase on the TV and the phone', () => {
    const s = createGame('SCRN');
    for (const [i, level] of (['n4', 'n3'] as const).entries()) {
      apply(s, { type: 'join', playerId: `p${i + 1}`, name: `P${i + 1}`, level }, gctx());
      apply(s, { type: 'connection', playerId: `p${i + 1}`, connected: true }, gctx());
    }
    let n = 0;
    const cmd = (actor: string | 'stage', command: CommandBody) =>
      apply(s, { type: 'command', actor: actor === 'stage' ? { kind: 'stage' } : { kind: 'player', playerId: actor }, command: { ...command, id: `k${++n}` } as Command }, gctx());
    expect(cmd('stage', { type: 'start', mode: 'kana-raid' }).error).toBeUndefined();
    const seen = new Set<string>();
    for (let step = 0; step < 40 && s.phase !== 'recap'; step++) {
      const stageView = viewFor(s, { kind: 'stage' }, content) as RoomView;
      const game = stageView.game as KatsuyoRaidView;
      expect(game.variant).toBe('katsuyo');
      const tv = kanaRaidStage.render(stageView, game);
      expect(tv.textContent?.length).toBeGreaterThan(0);
      const st = s.modeState as KatsuyoState;
      const line = st.boss ? KATSUYO_BOSS_LINES.find((l) => l.id === st.boss!.lineId) : undefined;
      if (line && !st.boss!.defeated && s.phase === 'finale') expect(tv.textContent).not.toContain(line.line.kana);
      const pv = viewFor(s, { kind: 'player', playerId: 'p2' }, content) as RoomView;
      const ctx: PhoneContext<KatsuyoRaidView> = {
        view: pv,
        game: pv.game as KatsuyoRaidView,
        me: pv.players.find((p) => p.id === 'p2')!,
        isVip: true,
        send: async () => true,
        flash: () => {},
        redraw: () => {},
        remainingMs: () => null,
      };
      const phone = kanaRaidPhone.render(ctx as never);
      expect(phone.textContent?.length).toBeGreaterThan(0);
      seen.add(`${s.phase}:${st.wave}`);
      // Answer the phone's attack once now and then, so the screens show results too.
      const a = st.players.p2?.attack;
      if (a && a.options.length) cmd('p2', { type: 'play', move: { kind: 'attack', attackId: a.id, pick: a.answer } });
      now += 500;
      apply(s, { type: 'timeout', phaseSeq: s.phaseSeq }, gctx());
    }
    for (const p of ['intro:0', 'answer:1', 'answer:2', 'answer:3', 'answer:4', 'finale:5', 'encore:6']) expect(seen).toContain(p);
  });
});
