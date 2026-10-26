// A bot that plays Phrase Bingo Theater like a decent human. As an actor it memorises its lines
// while studying, says each one during the scene (sometimes peeking first, sometimes fluffing a
// try), and wraps some in filler the way a real line would be. In the audience it buzzes after
// the TV rings: bots sharing one policy "hear" what the actor bots said, so they catch some
// lines and guess the rest. Everyone shouts the encore phrase back.

import type { PhraseBingoView } from '../../../shared/src/modes/phraseBingo/phraseBingo.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import type { ModePolicy } from '../bot.js';

export interface PhraseBingoBotOptions {
  /** Chance an actor peeks at a line before saying it. */
  peekRate?: number;
  /** Chance a try is said right (a wrong first try is followed by a right one). */
  sayRight?: number;
  /** Chance an audience bot buzzes after a slip. */
  buzzRate?: number;
  /** Chance an audience bot "heard" the line right (knows which one it was). */
  hearRate?: number;
  /** Type instead of speak (quiet mode). */
  quiet?: boolean | ((playerId: string) => boolean);
  /** Think time range in ms; lines are spread over the scene within it. */
  delayMs?: [number, number];
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

const FILLERS = ['', 'えっと、', 'あ、', '', 'ねえ、'];

export function phraseBingoPolicy(opts: PhraseBingoBotOptions = {}): ModePolicy {
  const peekRate = opts.peekRate ?? 0.3;
  const sayRight = opts.sayRight ?? 0.85;
  const buzzRate = opts.buzzRate ?? 0.7;
  const hearRate = opts.hearRate ?? 0.6;
  const [minDelay, maxDelay] = opts.delayMs ?? [3_000, 40_000];
  /** bot → phrase id → kana, learnt while studying. */
  const lines = new Map<string, Map<string, string>>();
  /** "The room": per scene, actor id → the phrase ids they said, in order. */
  const ear = new Map<string, string[]>();
  let earRound = -1;

  return {
    act(view: RoomView, me: string) {
      const game = view.game as PhraseBingoView | null;
      if (!game || game.mode !== 'phrase-bingo' || !game.me) return [];
      if (earRound !== game.round) {
        earRound = game.round;
        ear.clear();
      }
      const seq = view.phaseSeq;
      const quiet = typeof opts.quiet === 'function' ? opts.quiet(me) : !!opts.quiet;
      const via = quiet ? 'typed' : 'speech';
      const delay = (salt: string) => Math.round(minDelay + (maxDelay - minDelay) * chance(me, seq, salt, 'delay'));
      const out: { key: string; move: unknown; delayMs?: number }[] = [];
      const mine = game.me;
      const round = game.round;

      if (mine.actor) {
        let memory = lines.get(me);
        if (!memory) lines.set(me, (memory = new Map()));
        for (const x of mine.actor.secrets) if (x.jp) memory.set(x.id, x.jp.kana);

        if (view.phase === 'prompt' && !mine.actor.ready) out.push({ key: 'ready', move: { kind: 'ready', round }, delayMs: delay('ready') / 4 });

        if (view.phase === 'answer') {
          mine.actor.secrets.forEach((x, i) => {
            if (x.said) return;
            const at = delay(`line${i}`);
            const known = memory.get(x.id);
            const peek = !known || chance(me, round, x.id, 'peek') < peekRate;
            if (peek && !x.peeked) out.push({ key: `peek-${x.id}`, move: { kind: 'peek', phraseId: x.id, round }, delayMs: Math.max(0, at - 5) });
            const kana = x.jp?.kana ?? known;
            if (!kana) return;
            const filler = FILLERS[Math.floor(chance(me, round, x.id, 'filler') * FILLERS.length)]!;
            const right = chance(me, round, x.id, 'right') < sayRight;
            const said = () => {
              const list = ear.get(me) ?? [];
              if (!list.includes(x.id)) ear.set(me, [...list, x.id]);
            };
            if (right) {
              out.push({ key: `say-${x.id}-0`, move: { kind: 'say', utterance: { via, text: `${filler}${kana}` }, round }, delayMs: at });
              said();
            } else {
              out.push({ key: `say-${x.id}-0`, move: { kind: 'say', utterance: { via, text: 'えっと、なんだっけ' }, round }, delayMs: at });
              out.push({ key: `say-${x.id}-1`, move: { kind: 'say', utterance: { via, text: kana }, round }, delayMs: at + 10 });
              said();
            }
          });
        }
      }

      if (mine.card && view.phase === 'answer') {
        const slips = game.ticker.filter((t) => t.kind === 'slip');
        const buzzed = new Set(mine.card.cells.filter((c) => c.buzz).map((c) => c.id));
        let left = mine.card.buzzesLeft;
        const perActor = new Map<string, number>();
        slips.forEach((slip, i) => {
          const k = perActor.get(slip.playerId) ?? 0;
          perActor.set(slip.playerId, k + 1);
          if (left <= 0 || chance(me, round, i, 'buzz') >= buzzRate) return;
          const heard = ear.get(slip.playerId)?.[k];
          const knows = heard && !buzzed.has(heard) && chance(me, round, i, 'hear') < hearRate;
          const open = mine.card!.cells.filter((c) => !buzzed.has(c.id));
          const phraseId = knows ? heard : open[Math.floor(chance(me, round, i, 'cell') * open.length)]?.id;
          if (!phraseId) return;
          buzzed.add(phraseId);
          left -= 1;
          out.push({ key: `buzz-${i}`, move: { kind: 'buzz', phraseId, actorId: slip.playerId, round }, delayMs: Math.round(delay(`buzz${i}`) / 10) });
        });
      }

      if (view.phase === 'encore' && mine.echo?.canEcho && game.highlight) {
        const right = chance(me, round, 'echo') < sayRight;
        out.push({ key: `echo-${mine.echo.triesLeft}`, move: { kind: 'echo', utterance: { via, text: right || mine.echo.triesLeft < 2 ? game.highlight.kana : 'せーの' }, round }, delayMs: delay('echo') / 4 });
      }
      return out;
    },
  };
}
