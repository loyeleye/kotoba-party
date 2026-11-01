// How bots play Late Again!: the latecomer picks one of the witness's three causes, says it's ready, and
// types Pon's version of the excuse (bots can't record; a Kana bot taps the apology and the cause tiles).
// The witness backs a cause up (now and then swears it was a tanuki), the gallery bets, listeners answer
// the check or tap the words they catch, voters give a leaf when they have one and like the excuse, and
// the acting chief calls Safe when the room has leaves to spend.
// Repeatable: every choice hashes the bot's id with the phase, step and round.

import type { LateView } from '../../../shared/src/modes/lateAgain/lateAgain.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import type { ModePolicy } from '../bot.js';

export interface LateAgainPolicyOptions {
  /** Chance the witness plays the tanuki curveball. */
  curveball?: number;
  /** Chance a voter with a leaf gives it. */
  generous?: number;
  /** Chance the latecomer uses its one mic pass instead of answering. */
  pass?: number;
  thinkMs?: number;
  /** Speak the excuse as a checked clip of Pon's version, as a speaker who knows it would (the path
   *  simulation, tools/sim). Off by default: live bots can't record. */
  speak?: boolean;
}

function hash(...parts: (string | number)[]): number {
  let h = 2166136261;
  for (const ch of parts.join('|')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
}

const pickOf = <T>(items: readonly T[], r: number): T | undefined => items[Math.floor(r * items.length)];

export function lateAgainPolicy(opts: LateAgainPolicyOptions = {}): ModePolicy {
  const curveball = opts.curveball ?? 0.2;
  const generous = opts.generous ?? 0.6;
  const pass = opts.pass ?? 0.1;
  const think = opts.thinkMs ?? 300;
  return {
    act(view: RoomView, playerId: string) {
      const game = view.game as LateView | null;
      if (!game || game.mode !== 'late-again' || !game.me) return [];
      const me = game.me;
      const round = game.round;
      const at = `${view.phaseSeq}:${game.step}:${round}`;
      const r = (what: string) => hash(playerId, at, what);
      const delay = (what: string) => Math.floor(think * (0.3 + r(`${what}:delay`)));
      const out: { key: string; move: unknown; delayMs?: number }[] = [];
      const push = (key: string, move: Record<string, unknown>, extra = 0) => out.push({ key: `${key}:${at}`, move: { ...move, round }, delayMs: delay(key) + extra });

      if (view.phase === 'prompt' || view.phase === 'answer') {
        if (game.step === 'scene') return out;
        // The witness and the gallery lock in before the call starts.
        const planning = view.phase === 'prompt';
        if (me.role === 'latecomer' && !me.sent) {
          if (me.level === 'kana') {
            const cause = me.tiles.find((t) => t.id !== 'sorry' && t.id !== 'tanuki' && (!me.cause || t.id === me.cause)) ?? me.tiles[1];
            const tiles = ['sorry', ...(cause ? [cause.id] : [])];
            if (me.draft.join() !== tiles.join()) push('tiles', { kind: 'tiles', tiles });
            else push('send', { kind: 'excuse', type: 'tiles', tiles }, think);
            return out;
          }
          if (me.canPick && !me.cause) push('cause', { kind: 'cause', causeId: pickOf(game.options, r('cause'))!.id });
          if (view.phase === 'prompt' && !me.ready) push('ready', { kind: 'ready' }, think);
          if (view.phase === 'answer') {
            if (me.micPassLeft && r('pass?') < pass) push('pass', { kind: 'micPass' });
            else if (me.mission && opts.speak) {
              const said = me.mission.model.kana;
              push('excuse', { kind: 'excuse', type: 'clip', clipId: `sim-${playerId}-${game.round}`, durMs: 4000, checked: true, heard: { via: 'speech', text: said, reading: said } }, think);
            } else if (me.mission) push('excuse', { kind: 'excuse', type: 'typed', text: me.mission.model.kana }, think);
          }
          return out;
        }
        if (planning && me.role === 'witness' && !me.alibi && me.alibiTiles.length) {
          const tanuki = me.alibiTiles.find((t) => t.id === 'tanuki');
          const pick = tanuki && r('curve?') < curveball ? tanuki : pickOf(me.alibiTiles.filter((t) => t.id !== 'tanuki'), r('alibi'));
          if (pick) push('alibi', { kind: 'alibi', tileId: pick.id });
        }
        if (planning && me.role === 'gallery' && !me.bet && game.options.length) push('bet', { kind: 'bet', causeId: pickOf(game.options, r('bet'))!.id });
        return out;
      }

      if (view.phase === 'reveal' && game.step === 'play' && me.role !== 'latecomer') {
        if (me.check && me.check.picked === null) push('check', { kind: 'check', option: Math.floor(r('check') * me.check.options.length) });
        for (const t of me.catchTiles) if (!t.tapped && r(`catch:${t.id}`) < 0.7) push(`catch-${t.id}`, { kind: 'catch', wordId: t.id }, Math.floor(think * r(`catch-at:${t.id}`)));
        return out;
      }

      if (view.phase === 'encore') {
        if (me.role === 'chief') {
          // Co-op: naming the cause is the whole call.
          if (game.coop) {
            if (!me.coopPick && game.options.length) push('pick', { kind: 'pick', causeId: pickOf(game.options, r('pick'))!.id });
          } else if (!me.call) {
            // Read the room: leaves held say who can still vote Safe.
            const spendable = game.holders;
            const safe = game.voters.length === 0 ? r('call') < 0.5 : spendable / game.voters.length >= 0.5 ? r('call') < 0.75 : r('call') < 0.3;
            push('rule', { kind: 'rule', call: safe ? 'safe' : 'out' }, think);
          }
          return out;
        }
        if (me.canVote && me.gave === null) push('leaf', { kind: 'leaf', give: me.leaves > 0 && r('give?') < generous });
      }
      return out;
    },
  };
}
