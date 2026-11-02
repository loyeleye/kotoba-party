// @vitest-environment happy-dom
// Frame Concentration's TV and phone screens render every phase, and the TV never shows what anyone said.

import { describe, expect, it } from 'vitest';
import type { CommandBody } from '../shared/src/client.js';
import { apply, createGame, type GameAction, type GameContext, type GameState } from '../shared/src/game.js';
import type { ConcentrationState, ConcentrationView } from '../shared/src/modes/concentration/concentration.js';
import { GIST_BY_ID } from '../shared/src/modes/concentration/greenBoard.js';
import { EMPTY_CONTENT } from '../shared/src/modes/mode.js';
import type { Command, RoomView } from '../shared/src/protocol.js';
import { viewFor } from '../shared/src/view.js';
import { concentrationStage } from '../stage/src/modes/concentration.js';
import { concentrationPhone } from '../controller/src/modes/concentration.js';

let seed = 3;
const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

function table() {
  const s: GameState = createGame('BCDF');
  let now = 1_000_000;
  let ids = 0;
  let n = 0;
  const ctx = (): GameContext => ({ now, content: EMPTY_CONTENT, newId: () => `id${++ids}`, random });
  const act = (a: GameAction) => apply(s, a, ctx());
  const cmd = (actor: string | 'stage', command: CommandBody) =>
    act({ type: 'command', actor: actor === 'stage' ? { kind: 'stage' } : { kind: 'player', playerId: actor }, command: { ...command, id: `c${++n}` } as Command });
  for (const [i, level] of (['n3', 'n4', 'n3'] as const).entries()) {
    act({ type: 'join', playerId: `p${i + 1}`, name: `P${i + 1}`, level });
    act({ type: 'connection', playerId: `p${i + 1}`, connected: true });
  }
  const timeout = () => {
    now = Math.max(now, s.deadline ?? 0);
    act({ type: 'timeout', phaseSeq: s.phaseSeq });
  };
  return { s, cmd, timeout, st: () => s.modeState as ConcentrationState };
}

function screens(s: GameState): { tv: string; phones: string[] } {
  const stageView = viewFor(s, { kind: 'stage' }, EMPTY_CONTENT) as RoomView;
  const tv = concentrationStage.render(stageView, stageView.game as ConcentrationView).textContent ?? '';
  const phones = ['p1', 'p2', 'p3'].map((id) => {
    const view = viewFor(s, { kind: 'player', playerId: id }, EMPTY_CONTENT) as RoomView;
    const game = view.game as ConcentrationView;
    const me = view.players.find((p) => p.id === id)!;
    concentrationPhone.key(view, game, id);
    const el = concentrationPhone.render({ view, game, me, isVip: false, send: async () => true, flash: () => {}, redraw: () => {}, remainingMs: () => null });
    return el.textContent ?? '';
  });
  return { tv, phones };
}

describe('Frame Concentration screens', () => {
  it('render every phase; the TV shows the model line, never the heard sentence', () => {
    const t = table();
    t.cmd('stage', { type: 'start', mode: 'concentration' });
    expect(screens(t.s).tv).toContain('フレーム神経衰弱');
    t.timeout();
    const st = t.st();
    const player = st.turn!.playerId!;
    const pair = st.pairs.find((p) => !p.gist!.hard)!;
    const cells = st.cards.map((c, i) => (c.pairId === pair.id ? i : -1)).filter((i) => i >= 0);
    const gist = GIST_BY_ID.get(pair.gist!.id)!;
    screens(t.s);
    for (const c of cells) t.cmd(player, { type: 'play', move: { kind: 'flip', cell: c } });
    expect(t.s.phase).toBe('prompt');
    expect(screens(t.s).tv).toContain('Match!');
    t.timeout();
    const say = screens(t.s);
    expect(say.tv).toContain(gist.en);
    const own = `ほんとに ${gist.model.kana}`;
    t.cmd(player, { type: 'play', move: { kind: 'say', utterance: { via: 'typed', text: 'えっと' } } });
    const tip = screens(t.s);
    const flipperPhone = tip.phones[Number(player.slice(1)) - 1]!;
    expect(flipperPhone).toMatch(/I didn't hear|I heard/);
    expect(tip.tv).not.toContain('えっと');
    t.cmd(player, { type: 'play', move: { kind: 'say', utterance: { via: 'typed', text: own } } });
    const chorus = screens(t.s);
    expect(chorus.tv).not.toContain('ほんとに');
    expect(chorus.phones.filter((x) => x.includes('+30')).length).toBeGreaterThan(0);
    t.timeout();
    expect(t.s.phase).toBe('score');
    const result = screens(t.s);
    expect(result.tv).toContain(gist.model.kana.split(' ')[0]!);
    expect(result.tv).not.toContain('ほんとに');
    for (let i = 0; i < 3_000 && t.s.phase !== 'recap'; i++) {
      t.timeout();
      if ((t.s.phase as string) !== 'recap') screens(t.s);
    }
  });
});
