// A bot that plays Kotoba Concentration like a decent human: it remembers the cards it has
// seen turn over (forgetting some), flips a known pair when it has one, says the word right
// most of the time, sometimes tries to steal, and buzzes in on the picture now and then.

import type { CellView, ConcentrationView } from '../../../shared/src/modes/concentration/concentration.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import type { ModePolicy } from '../bot.js';

export interface ConcentrationBotOptions {
  /** Chance a remembered card is recalled when it matters (0–1). */
  recall?: number;
  /** Chance the bot says the word right when it tries. */
  sayRight?: number;
  /** Chance the bot tries to steal a pair. */
  stealRate?: number;
  /** Type instead of speak (quiet mode). */
  quiet?: boolean | ((playerId: string) => boolean);
  /** Buzz in on the picture once this share of it is uncovered. */
  guessAt?: number;
  /** Think time range in ms. */
  delayMs?: [number, number];
}

interface Memory {
  shuffleSeq: number;
  /** cell → pair id seen there */
  cells: Map<number, string>;
  /** pair id → the word's reading, once the word card has been seen */
  words: Map<string, string>;
  /** The one picture guess has been sent (keys are per phase, so remember it here). */
  guessed: boolean;
}

/** A repeatable 0–1 number for one decision. */
function chance(...parts: (string | number)[]): number {
  let h = 2166136261;
  for (const ch of parts.join('|')) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10_000) / 10_000;
}

export function concentrationPolicy(opts: ConcentrationBotOptions = {}): ModePolicy {
  const recall = opts.recall ?? 0.8;
  const sayRight = opts.sayRight ?? 0.85;
  const stealRate = opts.stealRate ?? 0.5;
  const guessAt = opts.guessAt ?? 0.55;
  const [minDelay, maxDelay] = opts.delayMs ?? [500, 1800];
  const memories = new Map<string, Memory>();

  return {
    act(view: RoomView, me: string) {
      const game = view.game as ConcentrationView | null;
      if (!game || game.mode !== 'concentration') return [];
      let mem = memories.get(me);
      if (!mem || view.phase === 'intro') memories.set(me, (mem = { shuffleSeq: game.shuffleSeq, cells: new Map(), words: new Map(), guessed: false }));
      // A yōkai moved the face-down cards: positions are worthless now.
      if (mem.shuffleSeq !== game.shuffleSeq) {
        mem.shuffleSeq = game.shuffleSeq;
        mem.cells.clear();
      }
      game.cells.forEach((c, i) => {
        if (c.state === 'cleared') mem.cells.delete(i);
        if (c.state === 'up' && c.pair) {
          mem.cells.set(i, c.pair);
          if (c.face?.kind === 'kana') mem.words.set(c.pair, c.face.text);
          if (c.face?.kind === 'word') mem.words.set(c.pair, c.face.sub ?? c.face.text);
        }
      });

      const seq = view.phaseSeq;
      const delay = (salt: string) => Math.round(minDelay + (maxDelay - minDelay) * chance(me, seq, salt, 'delay'));
      const mine = game.mine;
      if (!mine) return [];
      const out: { key: string; move: unknown; delayMs?: number }[] = [];

      if (view.phase === 'answer' && mine.canFlip && game.turn) {
        const cell = chooseFlip(game, mem, (cell) => chance(me, game.turn!.no, cell, 'recall') < recall, (salt) => chance(me, seq, salt));
        if (cell !== null) out.push({ key: `flip-${game.turn.flips}-${game.turn.specials}`, move: { kind: 'flip', cell }, delayMs: delay(`flip${game.turn.flips}`) });
      }

      if ((view.phase === 'reveal' || view.phase === 'encore') && mine.canSay) {
        const stealing = view.phase === 'encore';
        const tryNo = 2 - mine.attemptsLeft;
        const wants = !stealing || chance(me, seq, 'steal', tryNo) < stealRate;
        if (wants) {
          const pair = game.cells.find((c) => c.state === 'up' && c.pair)?.pair;
          const word = pair ? mem.words.get(pair) : undefined;
          const right = word !== undefined && chance(me, seq, 'say', tryNo) < sayRight;
          const quiet = typeof opts.quiet === 'function' ? opts.quiet(me) : !!opts.quiet;
          out.push({
            key: `say-${tryNo}`,
            move: { kind: 'say', utterance: { via: quiet ? 'typed' : 'speech', text: right ? word : 'えっと' } },
            delayMs: delay(`say${tryNo}`),
          });
        }
      }

      const pic = game.picture;
      if (pic.open && !mine.guess && !mem.guessed && pic.uncovered / pic.tiles.length >= guessAt * (0.7 + 0.6 * chance(me, 'guess-at'))) {
        const option = pic.options[Math.floor(chance(me, seq, 'guess') * pic.options.length)];
        mem.guessed = true;
        if (option) out.push({ key: 'guess', move: { kind: 'guess', optionId: option.id }, delayMs: delay('guess') });
      }
      return out;
    },
  };
}

function chooseFlip(game: ConcentrationView, mem: Memory, recalls: (cell: number) => boolean, rnd: (salt: string) => number): number | null {
  const row = (i: number) => Math.floor(i / game.cols);
  const open = game.cells.map((c, i) => (c.state === 'down' && row(i) !== game.fogRow ? i : -1)).filter((i) => i >= 0);
  if (!open.length) return null;
  const known = new Map<string, number[]>();
  for (const i of open) {
    const pair = mem.cells.get(i);
    if (pair && recalls(i)) known.set(pair, [...(known.get(pair) ?? []), i]);
  }
  const unknown = open.filter((i) => !mem.cells.has(i));
  const any = (list: number[], salt: string) => list[Math.floor(rnd(salt) * list.length)]!;

  const up = game.cells.findIndex((c: CellView) => c.state === 'up' && !!c.pair);
  if (game.turn && game.turn.flips === 1 && up >= 0) {
    const partner = known.get(game.cells[up]!.pair!)?.find((i) => i !== up);
    if (partner !== undefined) return partner;
    return unknown.length ? any(unknown, 'u2') : any(open, 'a2');
  }
  for (const cells of known.values()) if (cells.length >= 2) return cells[0]!;
  return unknown.length ? any(unknown, 'u1') : any(open, 'a1');
}
