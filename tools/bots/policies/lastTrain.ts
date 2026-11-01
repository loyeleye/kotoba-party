// How a bot plays Last Train: answers its own item (mostly right, from the accepted list),
// sometimes wrong, mostly by voice, sometimes typed; votes on overrules (sometimes a
// thumbs-up); haunts as a ghost; says the natural version after a miss.

import type { ContentLibrary } from '../../../shared/src/modes/mode.js';
import { itemIndex, type LastTrainView } from '../../../shared/src/modes/lastTrain/lastTrain.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import type { ModePolicy } from '../bot.js';

export interface LastTrainPolicyOptions {
  content: Pick<ContentLibrary, 'lastTrainMinigames' | 'lastTrainScenarios'>;
  seed?: number;
  /** Share of answers that are right (default 0.75). */
  accuracy?: number;
  /** Share of overrule votes that are a thumbs-up (default 0.35). */
  overruleRate?: number;
  /** Think time in ms (default 40–240). */
  thinkMs?: [number, number];
}

/** A stable 0..1 number for a string, so a run is repeatable. */
function roll(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10_000) / 10_000;
}

export function lastTrainPolicy(opts: LastTrainPolicyOptions): ModePolicy {
  const items = itemIndex(opts.content);
  const seed = opts.seed ?? 1;
  const accuracy = opts.accuracy ?? 0.75;
  const overruleRate = opts.overruleRate ?? 0.35;
  const [lo, hi] = opts.thinkMs ?? [40, 240];
  const haunted = new Set<string>();
  const think = (key: string) => Math.round(lo + roll(`${seed}:think:${key}`) * (hi - lo));

  return {
    act(view: RoomView, playerId: string) {
      const game = view.game as LastTrainView | null;
      if (!game || game.mode !== 'last-train' || !game.me) return [];
      const me = game.me;
      const out: { key: string; move: unknown; delayMs?: number }[] = [];

      // An N4 bot takes most hard roles it is offered. It marks its answer as a bot's, so the server
      // logs it with `bot: true` and it stays out of the 60% acceptance gate.
      if (me.offer) {
        const accept = roll(`${seed}:${playerId}:role:${me.offer.key}`) < 0.7;
        out.push({ key: `role:${me.offer.key}`, move: { kind: 'role', key: me.offer.key, accept, bot: true }, delayMs: think(me.offer.key) });
      }

      const task = me.task;
      if (task) {
        const item = items.get(task.itemId);
        const right = roll(`${seed}:${playerId}:${task.key}`) < accuracy;
        const text = right && item ? (item.accepted[Math.floor(roll(`${seed}:pick:${task.key}`) * item.accepted.length)] ?? item.accepted[0]!) : 'ええと、わかりません';
        const via = roll(`${seed}:via:${task.key}`) < 0.8 ? 'speech' : 'typed';
        // Dash questions come fast: answer quicker there.
        const delay = task.kind === 'dash' ? Math.min(60, think(task.key)) : think(task.key);
        out.push({ key: `answer:${task.key}`, move: { kind: 'answer', key: task.key, utterance: { via, text } }, delayMs: delay });
      }

      for (const w of game.overrules) {
        if (!w.canVote) continue;
        const up = roll(`${seed}:${playerId}:${w.id}`) < overruleRate;
        out.push({ key: `overrule:${w.id}`, move: { kind: 'overrule', windowId: w.id, up }, delayMs: think(w.id) });
      }

      // Policies are asked per phase, so remember haunts across the stop's phases.
      const hauntKey = `${playerId}:${view.round}:${game.stopIndex}`;
      if (me.canHaunt && me.hauntTargets.length && !haunted.has(hauntKey) && roll(`${seed}:${playerId}:haunt:${game.stopIndex}`) < 0.6) {
        haunted.add(hauntKey);
        const target = me.hauntTargets[Math.floor(roll(`${seed}:target:${game.stopIndex}`) * me.hauntTargets.length)]!;
        out.push({ key: `haunt:${game.stopIndex}`, move: { kind: 'haunt', targetId: target.playerId }, delayMs: think(`haunt${game.stopIndex}`) });
      }

      if (me.canEcho && me.result) {
        out.push({ key: 'echo', move: { kind: 'echo', utterance: { via: 'speech', text: me.result.model.kana } }, delayMs: think('echo') });
      }
      return out;
    },
  };
}
