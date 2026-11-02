// How bots play Dub Club: one policy shared by every bot in the room, standing in for a room that
// listens. Each bot keeps the first card it's offered (or the second, by chance), rehearses the line
// (said right, or fluffed; offered the N4 ad-lib, it usually takes it and ad-libs a short casual line with the mission's word;
// in the Green Car it says its turn's model ad-lib, an N4 bot sometimes the N3 stretch), and sends a take that "plays from its phone": a bot has no voice, so no
// clip reaches the TV and the screening shows its name card over a silent scene. Guessers "hear" the
// actor's card with a fair chance, ask for もう いっかい now and then, and give their heart to a dub.
// Repeatable: every choice hashes the bot's id with the phase.

import { missionWord, type DubView } from '../../../shared/src/modes/dubClub/dubClub.js';
import { EPISODES, GREEN_CAR_EPISODES, type AdLib } from '../../../shared/src/modes/dubClub/scenes.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import type { ModePolicy } from '../bot.js';

export interface DubClubPolicyOptions {
  /** Chance a guesser reads the actor's card right. */
  ear?: number;
  /** Chance a bot fluffs its rehearsal. */
  fluffChance?: number;
  /** Green Car: chance an N4 bot goes for the scene's N3 stretch ad-lib. */
  stretchChance?: number;
  thinkMs?: number;
}

/** Every ad-lib by its mission: an N4 bot that takes the ad-lib says a short casual line with the mission's word. */
const ADLIBS = new Map<string, AdLib>(EPISODES.flatMap((e) => e.scenes.flatMap((sc) => [sc.adlib, sc.cheekyAdlib].filter((x): x is AdLib => !!x).map((x) => [x.mission, x] as const))));

/** The Green Car's ad-libs by mission (both levels, and Cheeky twists): a bot says the model line, as the sims need. */
const GC_ADLIBS = new Map<string, AdLib>(
  GREEN_CAR_EPISODES.flatMap((e) => e.scenes.flatMap((sc) => [sc.gc?.n4, sc.gc?.n3, sc.cheekyGc?.n4, sc.cheekyGc?.n3].filter((x): x is AdLib => !!x).map((x) => [x.mission, x] as const))),
);

function hash(...parts: (string | number)[]): number {
  let h = 2166136261;
  for (const ch of parts.join('|')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
}

export function dubClubPolicy(opts: DubClubPolicyOptions = {}): ModePolicy {
  const ear = opts.ear ?? 0.55;
  const fluff = opts.fluffChance ?? 0.25;
  const stretchChance = opts.stretchChance ?? 0.3;
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
      // Offered the ad-lib (N4): yes, more often than not.
      if ((view.phase === 'prompt' || view.phase === 'answer') && me.acting && !me.sent && me.adlib?.state === 'offered') {
        return [{ key: 'adlib', move: { kind: 'adlib', accept: r('adlib') < 0.6, round }, delayMs: delay('adlib') }];
      }
      // The Green Car: every bot ad-libs, saying its turn's model line (an N4 bot goes for the N3 stretch now and then).
      if (view.phase === 'answer' && me.acting && !me.sent && !me.passed && me.adlib?.state === 'accepted' && me.adlib.greenCar) {
        const own = GC_ADLIBS.get(me.adlib.mission);
        const stretch = me.adlib.greenCar.stretch ? GC_ADLIBS.get(me.adlib.greenCar.stretch.mission) : undefined;
        const pick = stretch && r('stretch') < stretchChance ? stretch : own;
        if (pick && (!me.rehearsal || (me.rehearsal.left > 0 && me.rehearsal.similarity < 0.8 && r('retry') < 0.5))) {
          const text = r(`fluff${me.rehearsal?.tries ?? 0}`) < fluff ? 'えっと…' : pick.model.kana;
          return [{ key: `rehearse:${me.rehearsal?.tries ?? 0}`, move: { kind: 'rehearse', utterance: { via: 'speech', text }, round }, delayMs: delay('rehearse') }];
        }
      }
      if (view.phase === 'answer' && me.acting && !me.sent && !me.passed && me.adlib?.state === 'accepted' && !me.adlib.greenCar) {
        const adlib = ADLIBS.get(me.adlib.mission);
        if (adlib && (!me.rehearsal || (me.rehearsal.left > 0 && me.rehearsal.similarity < 0.8 && r('retry') < 0.5))) {
          // Not the model line (a player only sees it after the take): the mission's word and a short casual end.
          const own = `${missionWord(adlib)}… もう いやだよ！`;
          const text = r(`fluff${me.rehearsal?.tries ?? 0}`) < fluff ? 'えっと…' : own;
          return [{ key: `rehearse:${me.rehearsal?.tries ?? 0}`, move: { kind: 'rehearse', utterance: { via: 'speech', text }, round }, delayMs: delay('rehearse') }];
        }
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
