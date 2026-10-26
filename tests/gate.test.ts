// Phase 0 gate, part 1: 8 bots play 100 scripted rounds with no desyncs.
//
// "No desync" is checked four ways:
//  1. Every state a client accepted is byte-for-byte the view the server committed for that
//     client at that version.
//  2. When play ends, every client holds the room's latest version.
//  3. Every vote the server acknowledged is counted exactly once in that round's results,
//     even though bots fire duplicate requests and vote at the same moment.
//  4. Every final score equals the sum of the round points shown on the stage.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRoom } from '../shared/src/client.js';
import type { DebugResult, DebugView } from '../shared/src/modes/debug/debug.js';
import type { RoomView } from '../shared/src/protocol.js';

type RoundResult = { answers: DebugResult[] };
import { Bot, Director, type BotScript } from '../tools/bots/bot.js';
import { hashView, startServer, until } from './helpers.js';

const BOTS = 8;
const ROUNDS = 100;
const ROUNDS_PER_GAME = 10;

// Mischief, spread so most rounds have some: skipped answers and votes force the phase
// timers, duplicates test idempotency, and seat 8 loses signal every few answer phases.
const chaosScript: BotScript = {
  skipAnswer: (turn, seat) => (turn * 7 + seat * 3) % 29 === 0,
  skipVote: (turn, seat) => (turn * 5 + seat) % 31 === 0,
  duplicate: (turn, seat) => (turn + seat) % 4 === 0,
  dropMs: (turn, seat) => (seat === 8 && turn % 9 === 0 ? 40 : 0),
  pickVote: (turn, seat, options) => options[(turn * 31 + seat * 7) % options.length]!,
  delayMs: (turn, seat) => (turn * 13 + seat * 29) % 15,
};

describe('Phase 0 gate: 8 bots × 100 rounds', () => {
  let ctx: Awaited<ReturnType<typeof startServer>>;

  beforeAll(async () => {
    ctx = await startServer({
      durations: { intro: 5, prompt: 5, answer: 400, reveal: 400, encore: 5, score: 5 },
    });
  });
  afterAll(async () => {
    await ctx.server.close();
  });

  it('plays 100 rounds with every client in sync', async () => {
    const { baseUrl, truth, server } = ctx;
    const created = await createRoom(baseUrl);
    const room = server.rooms.get(created.code)!;

    const seen = new Map<string, { v: number; hash: string }[]>();
    const record = (id: string, view: RoomView, v: number) => {
      let list = seen.get(id);
      if (!list) seen.set(id, (list = []));
      list.push({ v, hash: hashView(view) });
    };

    const results = new Map<number, RoundResult>(); // keyed by the reveal phase's phaseSeq
    const gameScores: { standings: { playerId: string; name: string; score: number }[]; rounds: RoundResult[] }[] = [];
    let currentGame: RoundResult[] = [];
    let finished = false;

    const director = new Director(baseUrl, created.code, created.stageToken, {
      players: BOTS,
      roundsPerGame: ROUNDS_PER_GAME,
      totalRounds: ROUNDS,
      onDone: () => (finished = true),
      onState: (view, v) => {
        record('stage', view, v);
        const game = view.game as DebugView | null;
        if (view.phase === 'encore' && game?.results && !results.has(view.phaseSeq - 1)) {
          const result = { answers: game.results };
          results.set(view.phaseSeq - 1, result);
          currentGame.push(result);
        }
        if (view.phase === 'recap' && view.recap && currentGame.length) {
          gameScores.push({ standings: view.recap.standings, rounds: currentGame });
          currentGame = [];
        }
      },
    });
    director.start();

    const bots: Bot[] = [];
    for (let i = 1; i <= BOTS; i++) {
      bots.push(
        await Bot.join({
          baseUrl,
          code: created.code,
          name: `bot${i}`,
          script: chaosScript,
          onState: (bot, view, v) => record(bot.playerId, view, v),
        }),
      );
    }

    await until(() => finished, 110_000, '100 rounds');
    // Let the last pushes land, then check everyone holds the latest version.
    await until(() => [director.client, ...bots.map((b) => b.client)].every((c) => c.version === room.version), 5_000, 'quiescence');

    expect(director.roundsPlayed).toBe(ROUNDS);
    expect(results.size).toBe(ROUNDS);
    expect(gameScores.length).toBe(ROUNDS / ROUNDS_PER_GAME);

    // 1. Every accepted state matches what the server committed for that viewer.
    let checked = 0;
    for (const [id, list] of seen) {
      for (const { v, hash } of list) {
        expect(truth.byVersion.get(v)?.get(id), `${id} at v${v}`).toBe(hash);
        checked++;
      }
      // Versions only ever go up.
      for (let i = 1; i < list.length; i++) expect(list[i]!.v).toBeGreaterThan(list[i - 1]!.v);
    }
    expect(checked).toBeGreaterThan(ROUNDS * BOTS * 5);

    // 2. Everyone ends on the room's version.
    for (const c of [director.client, ...bots.map((b) => b.client)]) expect(c.version).toBe(room.version);

    // 3. Each acknowledged vote counted exactly once.
    const expected = new Map<number, Map<string, number>>();
    for (const bot of bots) {
      for (const vote of bot.votes) {
        let round = expected.get(vote.revealSeq);
        if (!round) expected.set(vote.revealSeq, (round = new Map()));
        round.set(vote.answerId, (round.get(vote.answerId) ?? 0) + 1);
      }
    }
    let votesCounted = 0;
    for (const [revealSeq, result] of results) {
      for (const a of result.answers) {
        expect(a.votes, `votes for ${a.answerId} in phase ${revealSeq}`).toBe(expected.get(revealSeq)?.get(a.answerId) ?? 0);
        votesCounted += a.votes;
      }
    }
    expect(votesCounted).toBe(bots.reduce((n, b) => n + b.votes.length, 0));

    // 4. Final scores add up.
    for (const game of gameScores) {
      for (const s of game.standings) {
        const sum = game.rounds.flatMap((r) => r.answers).filter((a) => a.authorId === s.playerId).reduce((n, a) => n + a.points, 0);
        expect(s.score, `${s.name}'s score`).toBe(sum);
      }
    }

    // No command failed for a reason other than losing a race with a phase timer.
    expect(bots.flatMap((b) => b.unexpected)).toEqual([]);
    // The chaos actually happened.
    expect(bots.reduce((n, b) => n + b.drops, 0)).toBeGreaterThan(0);

    for (const b of bots) b.stop();
    director.client.close();
  });
});
