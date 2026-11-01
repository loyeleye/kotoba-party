// How bots play Ghost Advice Hotline: the caller says the problem (a typed stand-in for a clip) and reacts
// to each piece of advice, speaking advisers say they're ready and type Nobiko-san's version (bots can't
// record), Kana advisers pick a tile, the gallery bets, and everyone votes for a laugh.
// Repeatable: every choice hashes the bot's id with the phase, step and call.

import type { HotlineView, Reaction } from '../../../shared/src/modes/ghostHotline/hotline.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import type { ModePolicy } from '../bot.js';

export interface GhostHotlinePolicyOptions {
  /** Chance a speaking adviser uses the mic pass instead. */
  pass?: number;
  /** Chance the caller says the problem. */
  say?: number;
  thinkMs?: number;
  /** Speak the advice as a checked clip of Nobiko-san's version, as a speaker who knows it would (the path
   *  simulation, tools/sim). Off by default: live bots can't record. */
  speak?: boolean;
}

function hash(...parts: (string | number)[]): number {
  let h = 2166136261;
  for (const ch of parts.join('|')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
}

const pickOf = <T>(items: readonly T[], r: number): T | undefined => items[Math.floor(r * items.length)];
const REACTIONS: Reaction[] = ['chigau', 'oshii', 'soreda'];

export function ghostHotlinePolicy(opts: GhostHotlinePolicyOptions = {}): ModePolicy {
  const pass = opts.pass ?? 0.1;
  const say = opts.say ?? 0.8;
  const think = opts.thinkMs ?? 300;
  return {
    act(view: RoomView, playerId: string) {
      const game = view.game as HotlineView | null;
      if (!game || game.mode !== 'ghost-hotline' || !game.me) return [];
      const me = game.me;
      const at = `${view.phaseSeq}:${game.step}:${game.round}:${me.react?.index ?? ''}`;
      const r = (what: string) => hash(playerId, at, what);
      const delay = (what: string) => Math.floor(think * (0.3 + r(`${what}:delay`)));
      const out: { key: string; move: unknown; delayMs?: number }[] = [];
      const push = (key: string, move: Record<string, unknown>, extra = 0) => out.push({ key: `${key}:${at}`, move: { ...move, round: game.round }, delayMs: delay(key) + extra });

      if (view.phase === 'prompt' || view.phase === 'answer') {
        if (me.canSay && r('say?') < say) push('say', { kind: 'say', clipId: null });
        if (game.step === 'ring') return out;
        if (me.role === 'adviser' && me.tiles.length && !me.pick && view.phase === 'prompt') push('pick', { kind: 'pick', tileId: pickOf(me.tiles, r('pick'))!.id });
        if (me.role === 'adviser' && me.mission && !me.sent) {
          if (view.phase === 'prompt' && !me.ready) push('ready', { kind: 'ready' }, think);
          if (view.phase === 'answer') {
            if (me.micPassLeft && r('pass?') < pass) push('pass', { kind: 'pass' });
            else if (opts.speak) {
              const said = me.mission.model.kana;
              push('advice', { kind: 'advice', type: 'clip', clipId: `sim-${playerId}-${game.round}`, durMs: 4000, checked: true, heard: { via: 'speech', text: said, reading: said } }, think);
            } else push('advice', { kind: 'advice', type: 'typed', text: me.mission.model.kana }, think);
          }
        }
        if (me.role === 'gallery' && !me.bet && me.betTiles.length && view.phase === 'prompt') push('bet', { kind: 'bet', tileId: pickOf(me.betTiles, r('bet'))!.id });
        return out;
      }

      if (view.phase === 'reveal' && me.react?.canReact && !me.react.picked) push('react', { kind: 'react', index: me.react.index, reaction: pickOf(REACTIONS, r('react'))! }, think);
      if (view.phase === 'encore' && me.canVote && !me.vote && me.voteOptions.length) push('vote', { kind: 'vote', playerId: pickOf(me.voteOptions, r('vote'))!.playerId });
      return out;
    },
  };
}
