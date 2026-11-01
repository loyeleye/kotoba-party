import { describe, expect, it } from 'vitest';
import { createGame, apply, type GameAction, type GameContext } from '../shared/src/game.js';
import type { CommandBody } from '../shared/src/client.js';
import type { Command } from '../shared/src/protocol.js';
import { EMPTY_CONTENT, type ContentLibrary } from '../shared/src/modes/mode.js';
import { viewFor } from '../shared/src/view.js';
import {
  POINTS_PER_TELEPHONE_VOTE,
  RUMOUR_FRAME_POINTS,
  RUMOUR_KEPT_POINTS,
  RUMOUR_RELAY_POINTS,
  TELEPHONE_MULTIPLIER,
  type WordGauntletState,
  type WordGauntletView,
} from '../shared/src/modes/wordGauntlet/wordGauntlet.js';
import { keptParts, RUMOUR_FINS, RUMOUR_SEEDS, rumourFrameOf, rumourLine, rumourOpener, rumourSeeds, type RumourFrameId } from '../shared/src/modes/wordGauntlet/rumours.js';
import type { Level } from '../content/src/types.js';

let ids = 0;
const now = 1_000_000;
const content: ContentLibrary = EMPTY_CONTENT;
const gctx = (): GameContext => ({ now, content, newId: () => `id${String(++ids).padStart(5, '0')}`, random: () => 0 });
let cmdId = 0;
const as = (playerId: string) => ({ kind: 'player', playerId }) as const;
const stage = { kind: 'stage' } as const;

function room(levels: Level[]) {
  const s = createGame('BCDF');
  const act = (a: GameAction) => apply(s, a, gctx());
  const cmd = (actor: ReturnType<typeof as> | typeof stage, command: CommandBody) => apply(s, { type: 'command', actor, command: { ...command, id: `c${++cmdId}` } as Command }, gctx());
  const play = (pid: string, move: unknown) => cmd(as(pid), { type: 'play', move });
  const tick = () => act({ type: 'timeout', phaseSeq: s.phaseSeq });
  const ms = () => s.modeState as WordGauntletState;
  const view = (viewer: ReturnType<typeof as> | typeof stage) => viewFor(s, viewer, content).game as WordGauntletView;
  levels.forEach((level, i) => {
    act({ type: 'join', playerId: `p${i + 1}`, name: `Player${i + 1}`, level });
    act({ type: 'connection', playerId: `p${i + 1}`, connected: true });
  });
  cmd(stage, { type: 'start', mode: 'word-gauntlet' });
  while (ms().segment !== 'rumour' && ms().segment !== 'telephone' && s.phase !== 'recap') tick();
  return { s, play, tick, ms, view };
}

const playerOf = (r: ReturnType<typeof room>) => r.ms().rumour!.steps[r.ms().rumour!.current]!;

describe('rumour round content', () => {
  it('keeps every rumour about a yōkai or a host, with a truth and keys that its own line keeps', () => {
    expect(RUMOUR_SEEDS.length).toBeGreaterThanOrEqual(8);
    for (const seed of RUMOUR_SEEDS) {
      for (const frame of ['n5', 'sou-hear', 'to-itte-ita', 'ni-yoru', 'rashii', 'n-datte', 'plain'] as const) {
        const line = rumourLine(seed, [RUMOUR_FINS[0]!], frame);
        expect(keptParts(seed, line.kana), `${seed.id} ${frame}`).toEqual({ who: true, where: true, what: true });
      }
      expect(seed.truth.kana.length).toBeGreaterThan(5);
    }
    const ids = new Set(RUMOUR_FINS.map((f) => f.id));
    expect(ids.size).toBe(RUMOUR_FINS.length);
  });

  it('recognises each frame in Nobiko-san’s own model lines', () => {
    const seed = RUMOUR_SEEDS[0]!;
    for (const frame of ['sou-hear', 'to-itte-ita', 'ni-yoru', 'rashii', 'n-datte', 'plain'] as RumourFrameId[]) {
      const line = rumourLine(seed, [RUMOUR_FINS[1]!], frame);
      expect(rumourFrameOf({ text: line.text, reading: line.kana }), line.kana).toBe(frame);
    }
    expect(rumourFrameOf({ text: rumourLine(seed, [], 'n5').kana })).toBeNull();
    // Adjectives ending in らしい aren't hearsay.
    expect(rumourFrameOf({ text: 'ちょうちんさんは あたらしい かさを かいました。' })).toBeNull();
  });

  it('keeps Cheeky rumours and fins out of Family and Kids rooms', () => {
    expect(rumourSeeds('family').some((x) => x.audience)).toBe(false);
    expect(rumourSeeds('kids').some((x) => x.audience)).toBe(false);
    expect(rumourSeeds('cheeky').some((x) => x.audience === 'cheeky')).toBe(true);
    expect(rumourOpener(RUMOUR_SEEDS[0]!).kana).toContain('ないしょ');
  });
});

describe('rumour round', () => {
  it('stays Lost in Translation in a room with no N4 player', () => {
    const r = room(['n5', 'n5', 'kana', 'n5']);
    expect(r.ms().segment).toBe('telephone');
  });

  it('whispers only to the relayer, refuses names, and scores who, where, what and the frame', () => {
    const r = room(['n4', 'n5', 'kana', 'n4']);
    expect(r.ms().segment).toBe('rumour');
    expect(r.view(stage).round2).toBe('rumour');
    r.tick(); // prompt → first relay
    const first = playerOf(r);
    const seed = r.ms().rumour!.seed;
    const others = ['p1', 'p2', 'p3', 'p4'].filter((p) => p !== first.playerId);
    expect(r.view(as(first.playerId)).rumour!.mine!.heard!.opener).toBe(true);
    for (const p of others) expect(r.view(as(p)).rumour!.mine!.heard).toBeNull();
    expect(r.view(stage).rumour!.reveal).toBeNull();

    // Relays go round the table; play each by level.
    const said: Record<string, string> = {};
    for (let i = 0; i < 4; i++) {
      const step = playerOf(r);
      const pid = step.playerId;
      const mine = r.view(as(pid)).rumour!.mine!;
      expect(mine.fins.length).toBe(3);
      expect(r.play(pid, { kind: 'relay', utterance: { via: 'speech', text: 'うわさ' } }).error).toBeTruthy();
      expect(r.play(pid, { kind: 'fin', fin: mine.fins[0]!.id }).error).toBeUndefined();
      if (step.level === 'kana') {
        expect(r.play(pid, { kind: 'relay', utterance: { via: 'speech', text: mine.fins[0]!.tile } }).error).toBeUndefined();
      } else {
        expect(r.play(pid, { kind: 'relay', utterance: { via: 'speech', text: 'Player2さんが こうえんで おどって いるそうです。' } }).error).toBeTruthy();
        const line = step.level === 'n4' ? rumourLine(seed, [], 'sou-hear').kana : rumourLine(seed, [], 'n5').kana;
        said[pid] = line;
        expect(r.play(pid, { kind: 'relay', utterance: { via: 'speech', text: line } }).error).toBeUndefined();
      }
      // A relay that's in ends the turn at once.
    }
    expect(r.s.phase).toBe('reveal');
    const steps = r.ms().rumour!.steps;
    for (const st of steps) if (st.level !== 'kana') expect(st.kept).toEqual({ who: true, where: true, what: true });
    for (const st of steps) if (st.level === 'n4') expect(st.frame).toBe('sou-hear');
    // The relay heard by each step after the first is the step before it.
    expect(r.view(stage).rumour!.reveal!.steps.every((st) => st.text)).toBe(true);

    // Everyone votes for the first N4 relayer (who can't vote for themselves).
    const n4 = steps.findIndex((st) => st.level === 'n4');
    const before = Object.fromEntries(r.s.players.map((p) => [p.id, p.score]));
    for (const p of r.s.players) if (p.id !== steps[n4]!.playerId) expect(r.play(p.id, { kind: 'vote', step: n4 }).error).toBeUndefined();
    expect(r.play(steps[n4]!.playerId, { kind: 'vote', step: n4 }).error).toBeTruthy();
    r.tick(); // → score
    const x = TELEPHONE_MULTIPLIER;
    const n4id = steps[n4]!.playerId;
    const base = (RUMOUR_RELAY_POINTS + RUMOUR_KEPT_POINTS + RUMOUR_FRAME_POINTS + 3 * POINTS_PER_TELEPHONE_VOTE) * x;
    const gained = r.s.players.find((p) => p.id === n4id)!.score - before[n4id]!;
    expect(gained).toBeGreaterThanOrEqual(base);
    expect(r.view(stage).rumour!.truth).toEqual(seed.truth);
    // The scoreboard matches the mode's own ledger.
    for (const p of r.s.players) expect(p.score).toBe(r.ms().earned[p.id] ?? 0);
  });

  it('has Nobiko-san pass it on for a relayer who picked a fin but ran out of time, and skips one who did nothing', () => {
    const r = room(['n4', 'n4', 'n5', 'n5']);
    r.tick();
    const a = playerOf(r);
    r.play(a.playerId, { kind: 'fin', fin: r.view(as(a.playerId)).rumour!.mine!.fins[1]!.id });
    r.tick(); // time up
    const st = r.ms().rumour!.steps[0]!;
    expect(st.standIn).toBe(true);
    expect(st.text).toContain(r.ms().rumour!.seed.who.kana);
    r.tick(); // second relayer does nothing
    expect(r.ms().rumour!.steps[1]!.skipped).toBe(true);
    // The third relayer hears Nobiko-san's stand-in line.
    const third = playerOf(r);
    expect(r.view(as(third.playerId)).rumour!.mine!.heard!.text).toBe(st.text);
  });

  it('shows N4 hints in order: the frame, then Nobiko-san’s line', () => {
    const r = room(['n4', 'n5', 'n5', 'kana']);
    r.tick();
    const pid = playerOf(r).playerId;
    expect(playerOf(r).level).toBe('n4');
    const v0 = r.view(as(pid)).rumour!.mine!;
    expect(v0.frame).toBeNull();
    expect(v0.models).toBeNull();
    r.play(pid, { kind: 'hint' });
    expect(r.view(as(pid)).rumour!.mine!.frame?.ja).toBe('＿そうです');
    r.play(pid, { kind: 'hint' });
    expect(Object.keys(r.view(as(pid)).rumour!.mine!.models ?? {})).toHaveLength(4);
    expect(r.play(pid, { kind: 'hint' }).error).toBeTruthy();
    // An own fin is N4 only, and must be Japanese with no player's name.
    expect(r.play(pid, { kind: 'fin', own: 'every day' }).error).toBeTruthy();
    expect(r.play(pid, { kind: 'fin', own: 'Player3と' }).error).toBeTruthy();
    expect(r.play(pid, { kind: 'fin', own: 'まいにち' }).error).toBeUndefined();
  });
});

describe('rumour round: names', () => {
  it('refuses a relay that names a player, but not a word that sounds like one', () => {
    const r = room(['n4', 'n4', 'n5', 'n5']);
    r.tick();
    const pid = r.ms().rumour!.steps[r.ms().rumour!.current]!.playerId;
    r.play(pid, { kind: 'fin', fin: r.view(as(pid)).rumour!.mine!.fins[0]!.id });
    // Players are Player1…Player4: in kana, プレイヤーワン is a long name, so particles count too.
    expect(r.play(pid, { kind: 'relay', utterance: { via: 'typed', text: 'player3が こうえんで おどって いるそうです。' } }).error).toBe('names-player');
    expect(r.play(pid, { kind: 'relay', utterance: { via: 'typed', text: 'ちょうちんさんは こうえんで ダンスを ならって いるそうです。' } }).error).toBeUndefined();
  });
});
