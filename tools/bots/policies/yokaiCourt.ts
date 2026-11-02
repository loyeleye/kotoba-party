// How bots play Yōkai Court: the witness taps an answer (now and then the curveball), Kana lawyers pick tiles
// and leave them to Fude-san, speaking lawyers say they're ready and type Fude-san's line (bots can't
// record), judges make a hunch, answer the check and vote. With `speak`, lawyers "say" the model line as a
// simulated clip the server checked, so the path simulation sees spoken credit.
// Repeatable: every choice hashes the bot's id with the phase, step and case.

import type { Testimony } from '../../../shared/src/modes/yokaiCourt/cases.js';
import type { CourtView } from '../../../shared/src/modes/yokaiCourt/court.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import type { ModePolicy } from '../bot.js';

export interface YokaiCourtPolicyOptions {
  /** Chance a speaking lawyer uses the mic pass instead. */
  pass?: number;
  /** Chance the witness plays the curveball. */
  curve?: number;
  /** Lawyers send a simulated, server-checked clip of the model line instead of typing it. */
  speak?: boolean;
  thinkMs?: number;
}

function hash(...parts: (string | number)[]): number {
  let h = 2166136261;
  for (const ch of parts.join('|')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
}

const pickOf = <T>(items: readonly T[], r: number): T | undefined => items[Math.floor(r * items.length)];
const PLAIN: Testimony[] = ['saw', 'unseen', 'other'];

export function yokaiCourtPolicy(opts: YokaiCourtPolicyOptions = {}): ModePolicy {
  const pass = opts.pass ?? 0.1;
  const curve = opts.curve ?? 0.2;
  const think = opts.thinkMs ?? 300;
  return {
    act(view: RoomView, playerId: string) {
      const game = view.game as CourtView | null;
      if (!game || game.mode !== 'yokai-court' || !game.me) return [];
      const me = game.me;
      const at = `${view.phaseSeq}:${game.step}:${game.round}`;
      const r = (what: string) => hash(playerId, at, what);
      const delay = (what: string) => Math.floor(think * (0.3 + r(`${what}:delay`)));
      const out: { key: string; move: unknown; delayMs?: number }[] = [];
      const push = (key: string, move: Record<string, unknown>, extra = 0) => out.push({ key: `${key}:${at}`, move: { ...move, round: game.round }, delayMs: delay(key) + extra });
      const lawyer = me.role === 'pros' || me.role === 'def';

      if (view.phase === 'prompt' || view.phase === 'answer') {
        if (me.canTestify) push('testify', { kind: 'testify', testimony: r('curve?') < curve ? 'curve' : pickOf(PLAIN, r('testimony'))! });
        // Green Car, with `speak`: the witness passes their answer on out loud (a checked take of the line).
        if (game.greenCar && opts.speak && me.role === 'witness' && me.testified && game.testimony && !game.testimony.said && !game.testimony.auto && view.phase === 'prompt') {
          const said = game.testimony.line.kana;
          push('said', { kind: 'said', checked: true, heard: { via: 'speech', text: said, reading: said } });
        }
        if (me.hunchOptions.length && !me.hunch) push('hunch', { kind: 'hunch', yokaiId: pickOf(me.hunchOptions, r('hunch'))!.id });
        if (!lawyer || me.sent) return out;
        if (me.level === 'kana') {
          if (view.phase === 'prompt' && me.tiles.length && !me.picks.length) push('pick', { kind: 'pick', tiles: r('two?') < 0.5 ? [me.tiles[0]!.id, me.tiles[1]!.id] : [pickOf(me.tiles, r('pick'))!.id] });
          if (view.phase === 'answer') push('fude', { kind: 'fude' }, think);
          return out;
        }
        if (!me.mission) return out;
        if (view.phase === 'prompt' && game.step === 'plan' && !me.ready) push('ready', { kind: 'ready' }, think);
        if (view.phase === 'answer') {
          const said = me.mission.model.kana;
          if (me.micPassLeft && r('pass?') < pass) push('pass', { kind: 'pass' });
          else if (opts.speak) push('argue', { kind: 'argue', type: 'clip', clipId: `sim-${playerId}-${game.round}`, durMs: 6000, checked: true, heard: { via: 'speech', text: said, reading: said } }, think);
          else push('argue', { kind: 'argue', type: 'typed', text: { via: 'typed', text: said } }, think);
        }
        return out;
      }

      if (view.phase === 'reveal' && me.check?.open && !me.check.picked) push('check', { kind: 'check', thingId: pickOf(me.check.options, r('check'))!.id }, think);
      if (view.phase === 'encore' && me.canVote && !me.vote && game.step === 'vote') push('vote', { kind: 'vote', side: r('vote') < 0.5 ? 'pros' : 'def' });
      return out;
    },
  };
}
