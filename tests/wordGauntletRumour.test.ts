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
import { addFin, finKept, keptParts, RUMOUR_FINS, RUMOUR_FRAME_FINS, RUMOUR_SEEDS, rumourFin, rumourFrameOf, rumourFrames, rumourLine, rumourOpener, rumourSeeds, type RumourFrameId } from '../shared/src/modes/wordGauntlet/rumours.js';
import { n4Up } from '../shared/src/level.js';
import type { Level } from '../content/src/types.js';

let ids = 0;
const now = 1_000_000;
const content: ContentLibrary = EMPTY_CONTENT;
const gctx = (): GameContext => ({ now, content, newId: () => `id${String(++ids).padStart(5, '0')}`, random: () => 0 });
let cmdId = 0;
const as = (playerId: string) => ({ kind: 'player', playerId }) as const;
const stage = { kind: 'stage' } as const;

/** A room at these levels. An all-N4+ room rides in the Green Car unless `greenCar` is false. */
function room(levels: Level[], greenCar = true) {
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
  cmd(stage, { type: 'settings', greenCar });
  cmd(stage, { type: 'start', mode: 'word-gauntlet' });
  while (ms().segment !== 'rumour' && ms().segment !== 'telephone' && s.phase !== 'recap') tick();
  return { s, play, tick, ms, view };
}

const playerOf = (r: ReturnType<typeof room>) => r.ms().rumour!.steps[r.ms().rumour!.current]!;

describe('rumour round content', () => {
  it('keeps every rumour about a yōkai or a host, with a truth and keys that its own line keeps', () => {
    expect(RUMOUR_SEEDS.length).toBeGreaterThanOrEqual(8);
    for (const seed of RUMOUR_SEEDS) {
      for (const frame of ['n5', 'sou-hear', 'to-itte-ita', 'ni-yoru', 'rashii', 'n-datte', 'plain', 'toka-itteta'] as const) {
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
    for (const frame of ['sou-hear', 'to-itte-ita', 'ni-yoru', 'rashii', 'n-datte', 'plain', 'toka-itteta'] as RumourFrameId[]) {
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

  it('is a Green Car move-out: a mixed room with N4 players gets Lost in Translation back', () => {
    const r = room(['n4', 'n5', 'kana', 'n3']);
    expect(r.s.greenCarOn).toBe(false);
    expect(r.ms().segment).toBe('telephone');
    expect(r.view(stage).round2).toBe('telephone');
  });

  it('stays Lost in Translation in an all-N4+ room with the Green Car switched off', () => {
    const r = room(['n4', 'n4', 'n3', 'n4'], false);
    expect(r.s.greenCarOn).toBe(false);
    expect(r.ms().segment).toBe('telephone');
  });

  it('whispers only to the relayer, refuses names, and scores who, where, what and the frame', () => {
    const r = room(['n4', 'n3', 'n4', 'n3']);
    expect(r.s.greenCarOn).toBe(true);
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
    // Each N4 relayer uses a frame they didn't hear (an echoed frame earns nothing), and says their fin.
    const n4Frames = ['rashii', 'to-itte-ita', 'sou-hear', 'n-datte'] as const;
    let n4Seen = 0;
    for (let i = 0; i < 4; i++) {
      const step = playerOf(r);
      const pid = step.playerId;
      const mine = r.view(as(pid)).rumour!.mine!;
      expect(mine.fins.length).toBe(3);
      expect(r.play(pid, { kind: 'relay', utterance: { via: 'speech', text: 'うわさ' } }).error).toBeTruthy();
      expect(r.play(pid, { kind: 'fin', fin: mine.fins[0]!.id }).error).toBeUndefined();
      expect(r.play(pid, { kind: 'relay', utterance: { via: 'speech', text: 'Player2さんが こうえんで おどって いるそうです。' } }).error).toBeTruthy();
      const fin = rumourFin(mine.fins[0]!.id)!;
      const line = rumourLine(seed, [fin], n4Frames[n4Seen++]!).kana;
      said[pid] = line;
      expect(r.play(pid, { kind: 'relay', utterance: { via: 'speech', text: line } }).error).toBeUndefined();
      // A relay that's in ends the turn at once.
    }
    expect(r.s.phase).toBe('reveal');
    const steps = r.ms().rumour!.steps;
    for (const st of steps) expect(st.kept).toEqual({ who: true, where: true, what: true });
    expect(steps.filter((st) => n4Up(st.level)).map((st) => st.frame)).toEqual([...n4Frames]);
    for (const st of steps) expect(st.finSaid).toBe(true);
    for (const st of steps) expect(st.echoed).toBe(false);
    // The relay heard by each step after the first is the step before it.
    expect(r.view(stage).rumour!.reveal!.steps.every((st) => st.text)).toBe(true);

    // Everyone votes for the first N4 relayer (who can't vote for themselves).
    const n4 = steps.findIndex((st) => n4Up(st.level));
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
    const r = room(['n4', 'n4', 'n3', 'n3']);
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
    const r = room(['n4', 'n3', 'n3', 'n4']);
    r.tick();
    const pid = playerOf(r).playerId;
    expect(playerOf(r).level).toBe('n4');
    const v0 = r.view(as(pid)).rumour!.mine!;
    expect(v0.frame).toBeNull();
    expect(v0.models).toBeNull();
    r.play(pid, { kind: 'hint' });
    const heardFrame = r.ms().rumour!.steps[0]!.heardFrame;
    const tried = r.view(as(pid)).rumour!.mine!.frame;
    // A frame from the list, with the story's source filled in where it needs one; never the one they just heard.
    const seed = r.ms().rumour!.seed;
    const shown = (id: string, ja: string) => (id === 'ni-yoru' ? `${seed.source.kana}に よると、＿そうです` : id === 'to-itte-ita' ? `${seed.source.kana}は、＿と いって いました` : ja);
    const labels = rumourFrames(true).map((f) => shown(f.id, f.ja));
    expect(labels).toContain(tried?.ja);
    const heard = rumourFrames(true).find((f) => f.id === heardFrame);
    if (heard) expect(tried?.ja).not.toBe(shown(heard.id, heard.ja));
    r.play(pid, { kind: 'hint' });
    expect(Object.keys(r.view(as(pid)).rumour!.mine!.models ?? {})).toHaveLength(4);
    expect(r.play(pid, { kind: 'hint' }).error).toBeTruthy();
    // An own fin is N4 only, and must be Japanese with no player's name.
    expect(r.play(pid, { kind: 'fin', own: 'every day' }).error).toBeTruthy();
    expect(r.play(pid, { kind: 'fin', own: 'Player3と' }).error).toBeTruthy();
    expect(r.play(pid, { kind: 'fin', own: 'まいにち' }).error).toBeUndefined();
  });
});

describe('rumour round: fins, echoes and the reveal', () => {
  it('keeps one time fin at a time, and only the newest three', () => {
    const f = (id: string) => rumourFin(id)!;
    expect(addFin([f('every-night')], f('five-am')).map((x) => x.id)).toEqual(['five-am']);
    expect(addFin([f('alone'), f('secretly'), f('barefoot')], f('banana')).map((x) => x.id)).toEqual(['secretly', 'barefoot', 'banana']);
  });

  it('counts a fin only when it was said, gives no frame for an echo, and logs said-from-memory relays', () => {
    const r = room(['n4', 'n4', 'n3', 'n3']);
    r.tick();
    const seed = r.ms().rumour!.seed;
    // Relayer 1 says a frame line but leaves the fin out: kept who/where/what, but the fin falls off.
    const a = playerOf(r);
    r.play(a.playerId, { kind: 'fin', fin: r.view(as(a.playerId)).rumour!.mine!.fins[0]!.id });
    expect(r.play(a.playerId, { kind: 'relay', utterance: { via: 'speech', text: rumourLine(seed, [], 'rashii').kana } }).error).toBeUndefined();
    const s0 = r.ms().rumour!.steps[0]!;
    expect(s0.finSaid).toBe(false);
    expect(r.ms().rumour!.fins).toHaveLength(0);
    // Relayer 2 echoes the らしい they heard: no frame of their own.
    const b = playerOf(r);
    const fin = rumourFin(r.view(as(b.playerId)).rumour!.mine!.fins[0]!.id)!;
    r.play(b.playerId, { kind: 'fin', fin: fin.id });
    expect(r.play(b.playerId, { kind: 'relay', utterance: { via: 'speech', text: rumourLine(seed, [fin], 'rashii').kana } }).error).toBeUndefined();
    const s1 = r.ms().rumour!.steps[1]!;
    expect(s1.echoed).toBe(true);
    expect(s1.finSaid).toBe(true);
    expect(r.ms().rumour!.fins.map((x) => x.id)).toEqual([fin.id]);
    // Said from memory with everything kept: in the phrasebook as such.
    const entries = r.s.phrasebook[b.playerId] ?? [];
    expect(entries.length).toBeGreaterThan(0);
  });

  it('ends on the last relay passed on, refuses votes for Nobiko-san’s stand-ins, and times the reveal by line length', () => {
    const r = room(['n4', 'n3', 'n3', 'n3']);
    r.tick();
    const seed = r.ms().rumour!.seed;
    for (let i = 0; i < 4; i++) {
      const st = playerOf(r);
      const fin = rumourFin(r.view(as(st.playerId)).rumour!.mine!.fins[0]!.id)!;
      r.play(st.playerId, { kind: 'fin', fin: fin.id });
      if (i < 2) r.play(st.playerId, { kind: 'relay', utterance: { via: 'speech', text: rumourLine(seed, [fin], i === 0 ? 'to-itte-ita' : 'sou-hear').kana } });
      else r.tick(); // time up with a fin picked: Nobiko-san stands in
    }
    expect(r.s.phase).toBe('reveal');
    const steps = r.ms().rumour!.steps;
    expect(steps[2]!.standIn && steps[3]!.standIn).toBe(true);
    const view = r.view(stage).rumour!;
    // Stand-ins pass it on too (with their fin tacked on), so the rumour ends on the last one.
    expect(view.reveal!.final.text).toBe(steps[3]!.text);
    expect(view.reveal!.final.text).toContain('しかも');
    expect(view.readAt).toHaveLength(5);
    for (let i = 1; i < view.readAt.length; i++) expect(view.readAt[i]!).toBeGreaterThan(view.readAt[i - 1]!);
    const voter = steps[0]!.playerId;
    expect(r.play(voter, { kind: 'vote', step: 2 }).error).toBeTruthy();
    expect(r.play(voter, { kind: 'vote', step: 1 }).error).toBeUndefined();
  });
});

describe('rumour round: names', () => {
  it('refuses a relay that names a player, but not a word that sounds like one', () => {
    const r = room(['n4', 'n4', 'n3', 'n3']);
    r.tick();
    const pid = r.ms().rumour!.steps[r.ms().rumour!.current]!.playerId;
    r.play(pid, { kind: 'fin', fin: r.view(as(pid)).rumour!.mine!.fins[0]!.id });
    // Players are Player1…Player4: in kana, プレイヤーワン is a long name, so particles count too.
    expect(r.play(pid, { kind: 'relay', utterance: { via: 'typed', text: 'player3が こうえんで おどって いるそうです。' } }).error).toBe('names-player');
    expect(r.play(pid, { kind: 'relay', utterance: { via: 'typed', text: 'ちょうちんさんは こうえんで ダンスを ならって いるそうです。' } }).error).toBeUndefined();
  });
});

describe("rumour round: the Green Car's N3 frame fins", () => {
  it('deals one N3 frame fin into every hand, taking turns round the table, tagged N3', () => {
    const r = room(['n4', 'n3', 'n4', 'n3']);
    const steps = r.ms().rumour!.steps;
    const frames = steps.map((st) => st.offered.map((id) => rumourFin(id)!).filter((f) => f.kind === 'frame'));
    for (const f of frames) expect(f).toHaveLength(1);
    const ids = frames.map((f) => f[0]!.id);
    expect(new Set(ids)).toEqual(new Set(RUMOUR_FRAME_FINS.map((f) => f.id)));
    for (let i = 1; i < ids.length; i++) expect(ids[i]).not.toBe(ids[i - 1]);
    // Every hand still has three cards, one of them a big one.
    for (const st of steps) {
      expect(st.offered).toHaveLength(3);
      expect(st.offered.some((id) => rumourFin(id)!.big)).toBe(true);
    }
    const mine = r.view(as(steps[0]!.playerId)).rumour!.mine!;
    expect(mine.fins.filter((f) => f.n3)).toHaveLength(1);
    expect(mine.fins.filter((f) => f.n3)[0]!.id).toBe(frames[0]![0]!.id);
  });

  it('only suggests ＿とか いってた as a hint in the Green Car', () => {
    expect(rumourFrames(false).map((f) => f.id)).not.toContain('toka-itteta');
    expect(rumourFrames(true).map((f) => f.id)).toContain('toka-itteta');
    expect(RUMOUR_FRAME_FINS.every((f) => f.frame && rumourFrames(true).some((x) => x.id === f.frame))).toBe(true);
  });

  it('says the rumour in the frame fin’s frame, keeps the fin only while the relays say it, and never on あたらしい', () => {
    const seed = RUMOUR_SEEDS[0]!;
    const toka = rumourFin('gc-toka')!;
    const rashii = rumourFin('gc-rashii')!;
    const line = rumourLine(seed, [rumourFin('alone')!, toka], 'sou-hear');
    expect(line.kana).toContain('とか いってた');
    expect(line.kana).toContain('ひとりで');
    expect(rumourFrameOf({ text: line.kana })).toBe('toka-itteta');
    expect(finKept(toka, line.kana)).toBe(true);
    expect(finKept(toka, rumourLine(seed, [], 'sou-hear').kana)).toBe(false);
    expect(finKept(rashii, rumourLine(seed, [rashii], 'plain').kana)).toBe(true);
    expect(finKept(rashii, 'ちょうちんさんは あたらしい ダンスを ならって いるそうです。')).toBe(false);
    // One frame fin at a time.
    expect(addFin([rashii, rumourFin('alone')!], toka).map((f) => f.id)).toEqual(['alone', 'gc-toka']);
    // The N5 line never takes a frame from a fin.
    expect(rumourLine(seed, [toka], 'n5').kana).not.toContain('とか');
  });

  it('scores a relay said in its frame fin, hints that frame, and drops the fin when the next relay leaves it out', () => {
    const r = room(['n3', 'n4', 'n3', 'n4']);
    r.tick();
    const seed = r.ms().rumour!.seed;
    const a = playerOf(r);
    const frameFin = r.view(as(a.playerId)).rumour!.mine!.fins.find((f) => f.n3)!;
    const fin = rumourFin(frameFin.id)!;
    r.play(a.playerId, { kind: 'fin', fin: fin.id });
    r.play(a.playerId, { kind: 'hint' });
    expect(r.ms().rumour!.steps[0]!.hintFrame).toBe(fin.frame);
    expect(r.play(a.playerId, { kind: 'relay', utterance: { via: 'speech', text: rumourLine(seed, [fin], 'sou-hear').kana } }).error).toBeUndefined();
    const s0 = r.ms().rumour!.steps[0]!;
    expect(s0.frame).toBe(fin.frame);
    expect(s0.finSaid).toBe(true);
    expect(r.ms().rumour!.fins.map((f) => f.id)).toEqual([fin.id]);
    // The next relayer passes it on with ＿そうです and an ordinary fin: the frame fin falls off.
    const b = playerOf(r);
    const plain = rumourFin(r.view(as(b.playerId)).rumour!.mine!.fins.find((f) => !f.n3)!.id)!;
    r.play(b.playerId, { kind: 'fin', fin: plain.id });
    expect(r.play(b.playerId, { kind: 'relay', utterance: { via: 'speech', text: rumourLine(seed, [plain], 'sou-hear').kana } }).error).toBeUndefined();
    expect(r.ms().rumour!.fins.map((f) => f.id)).toEqual([plain.id]);
  });

  it('has a stand-in pass on what was heard when the fin picked was a frame fin (no frame for free)', () => {
    const r = room(['n4', 'n3', 'n3', 'n4']);
    r.tick();
    const a = playerOf(r);
    const frameFin = r.view(as(a.playerId)).rumour!.mine!.fins.find((f) => f.n3)!;
    r.play(a.playerId, { kind: 'fin', fin: frameFin.id });
    r.tick(); // time up
    const st = r.ms().rumour!.steps[0]!;
    expect(st.standIn).toBe(true);
    expect(st.finSaid).toBe(false);
    expect(st.text).not.toContain('しかも');
    expect(st.text).toContain(r.ms().rumour!.seed.who.kana);
    expect(r.ms().rumour!.fins).toHaveLength(0);
  });
});
