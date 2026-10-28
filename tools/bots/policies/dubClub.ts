// How bots play Dub Club: one policy shared by every bot in the room, standing in for a room that
// listens. Each bot keeps the first card it's offered (or the second, by chance), rehearses the line
// (said right, or fluffed), and sends a take that "plays from its phone": a bot has no voice, so no
// clip reaches the TV and the screening shows its name card over a silent scene. Guessers "hear" the
// actor's card with a fair chance, ask for もう いっかい now and then, and give their heart to a dub.
// Repeatable: every choice hashes the bot's id with the phase.

import type { DubView } from '../../../shared/src/modes/dubClub/dubClub.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import type { ModePolicy } from '../bot.js';

export interface DubClubPolicyOptions {
  /** Chance a guesser reads the actor's card right. */
  ear?: number;
  /** Chance a bot fluffs its rehearsal. */
  fluffChance?: number;
  thinkMs?: number;
}

function hash(...parts: (string | number)[]): number {
  let h = 2166136261;
  for (const ch of parts.join('|')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
}

export function dubClubPolicy(opts: DubClubPolicyOptions = {}): ModePolicy {
  const ear = opts.ear ?? 0.55;
  const fluff = opts.fluffChance ?? 0.25;
  const think = opts.thinkMs ?? 400;
  // What each actor is "acting", by round: the room hears it in the dub.
  const acting = new Map<string, string>();

  return {
    act(view: RoomView, playerId: string) {
      const game = view.game as DubView | null;
      if (!game || game.mode !== 'dub-club' || !game.me) return [];
      const me = game.me;
      const round = game.round;
      const r = (what: string) => hash(playerId, view.phaseSeq, what);
      const delay = (what: string) => Math.floor(think * (0.3 + r(`${what}:delay`)));
      if (me.direction) acting.set(`${round}:${playerId}`, me.direction.id);

      if ((view.phase === 'prompt' || view.phase === 'answer') && me.acting && !me.sent && me.offered.length === 2) {
        const want = me.offered[r('card') < 0.7 ? 0 : 1]!.id;
        if (me.direction?.id !== want && view.phase === 'prompt') return [{ key: `pick:${want}`, move: { kind: 'pick', direction: want, round }, delayMs: delay('pick') }];
      }
      if (view.phase === 'answer' && me.acting && !me.sent && !me.passed) {
        const line = me.line;
        if (line && (!me.rehearsal || (me.rehearsal.left > 0 && me.rehearsal.similarity < 0.8 && r('retry') < 0.5))) {
          const text = r(`fluff${me.rehearsal?.tries ?? 0}`) < fluff ? line.kana.slice(0, Math.ceil(line.kana.length / 2)) : line.kana;
          return [{ key: `rehearse:${me.rehearsal?.tries ?? 0}`, move: { kind: 'rehearse', utterance: { via: 'speech', text }, round }, delayMs: delay('rehearse') }];
        }
        return [{ key: 'take', move: { kind: 'take', clipId: null, local: true, durMs: 1500 + Math.floor(r('dur') * 2500), heard: null, checked: false, round }, delayMs: delay('take') + think }];
      }

      if (view.phase === 'reveal' && game.now) {
        const now = game.now;
        const out: { key: string; move: unknown; delayMs?: number }[] = [];
        if (me.canGuess && !me.guess && me.grid.length) {
          const truth = acting.get(`${round}:${now.playerId}`);
          const right = truth && r(`ear:${now.index}`) < ear ? truth : undefined;
          const pick = right ?? me.grid[Math.floor(r(`guess:${now.index}`) * me.grid.length)]!.id;
          out.push({ key: `guess:${now.index}`, move: { kind: 'guess', actorId: now.playerId, direction: pick, round }, delayMs: delay(`guess${now.index}`) });
        }
        if (now.step === 'guess' && !me.askedAgain && now.playerId !== playerId && r(`again:${now.index}`) < 0.15) out.push({ key: `again:${now.index}`, move: { kind: 'again', actorId: now.playerId, round }, delayMs: delay('again') });
        if (!me.heart && me.heartable.length && r(`heart:${now.index}`) < 0.4) {
          const to = me.heartable[Math.floor(r('heart-to') * me.heartable.length)]!;
          out.push({ key: `heart:${to}`, move: { kind: 'heart', actorId: to, round }, delayMs: delay('heart') });
        }
        return out;
      }
      return [];
    },
  };
}
