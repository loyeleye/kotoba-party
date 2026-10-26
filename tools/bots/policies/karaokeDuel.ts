// A bot that sings Karaoke Duel like an eager beginner: its transcript is the line's kana with
// the odd mora dropped or swapped, its pitch contour is the melody in its own key (sometimes an
// octave down) with a little wobble, and it comes in near the beat. Some bots have phones
// that can't measure pitch; quiet bots type. Audience bots sing along now and then and vote
// for a duelist.

import type { KaraokeDuelView } from '../../../shared/src/modes/karaokeDuel/karaokeDuel.js';
import { FRAME_MS, MAX_FRAMES } from '../../../shared/src/modes/karaokeDuel/scoring.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import type { ModePolicy } from '../bot.js';

export interface KaraokeBotOptions {
  /** Varies each bot's voice and mistakes. */
  seed?: number;
  /** Chance each mora is sung wrong (dropped or swapped). */
  slip?: number;
  /** This bot's phone can't measure pitch. */
  noPitch?: boolean | ((playerId: string) => boolean);
  /** Type instead of sing (quiet mode). */
  quiet?: boolean | ((playerId: string) => boolean);
  /** Chance an audience bot sings along on a line. */
  chorusRate?: number;
  /** Think time range in ms before a move is sent. */
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

const SWAPS: Record<string, string> = { つ: 'す', ら: 'だ', り: 'い', る: 'う', ょ: 'よ', っ: '', ー: '', う: '', ん: 'む' };

/** The line as a beginner might sing it: each mora kept, dropped or swapped for a near miss. */
export function sungKana(morae: string[], slip: number, rnd: (salt: string) => number): string {
  return morae
    .map((m, i) => {
      if (rnd(`slip${i}`) >= slip) return m;
      const last = m.at(-1)!;
      return rnd(`how${i}`) < 0.5 ? '' : m.slice(0, -1) + (SWAPS[last] ?? last);
    })
    .join('');
}

export function karaokeDuelPolicy(opts: KaraokeBotOptions = {}): ModePolicy {
  const seed = opts.seed ?? 1;
  // Each bot has its own skill: some slip twice as often as others.
  const slip = opts.slip ?? 0.1 + 0.15 * chance(seed, 'skill');
  const chorusRate = opts.chorusRate ?? 0.5;
  const [minDelay, maxDelay] = opts.delayMs ?? [400, 1200];
  const flag = (v: boolean | ((id: string) => boolean) | undefined, id: string) => (typeof v === 'function' ? v(id) : !!v);

  return {
    act(view: RoomView, me: string) {
      const game = view.game as KaraokeDuelView | null;
      if (!game || game.mode !== 'karaoke-duel' || !game.mine) return [];
      const mine = game.mine;
      const seq = view.phaseSeq;
      const rnd = (salt: string) => chance(seed, me, seq, salt);
      const delay = (salt: string) => Math.round(minDelay + (maxDelay - minDelay) * rnd(`${salt}-delay`));
      const out: { key: string; move: unknown; delayMs?: number }[] = [];

      if (view.phase === 'answer' && game.turn && game.song) {
        const turn = game.turn;
        const line = game.song.lines[turn.line]!;
        const morae = line.words.flat();
        if (mine.canSing) {
          if (flag(opts.quiet, me)) {
            out.push({ key: `sing-${turn.no}`, move: { kind: 'sing', turn: turn.no, utterance: { via: 'typed', text: line.kana } }, delayMs: delay('typed') });
          } else {
            const text = sungKana(morae, slip, rnd);
            const onsetMs = Math.round((rnd('onset') - 0.4) * 900);
            const durMs = Math.round(line.ms * (0.85 + 0.3 * rnd('dur')));
            let pitch: (number | null)[] | null = null;
            if (!flag(opts.noPitch, me)) {
              // The melody in the bot's own key (an octave down for some), a little sharp or flat.
              const key = Math.round((rnd('key') - 0.5) * 8) - (rnd('octave') < 0.4 ? 12 : 0);
              pitch = [];
              for (let t = 0; t < onsetMs + durMs && pitch.length < MAX_FRAMES; t += FRAME_MS) {
                const at = ((t - onsetMs) / durMs) * line.ms;
                const i = line.notes.findIndex((n) => at >= n.startMs && at < n.startMs + n.ms);
                if (t < onsetMs || i < 0 || morae[i] === 'っ' || morae[i] === 'ッ') pitch.push(null);
                else pitch.push(Math.round((line.notes[i]!.midi + key + (rnd(`wob${t}`) - 0.5) * 2.4) * 10) / 10);
              }
            }
            out.push({
              key: `sing-${turn.no}`,
              move: { kind: 'sing', turn: turn.no, utterance: { via: 'speech', text }, pitch, onsetMs, durMs, timing: pitch ? 'mic' : 'button' },
              delayMs: delay('sing'),
            });
          }
        } else if (mine.canChorus && !flag(opts.quiet, me) && rnd('chorus') < chorusRate) {
          out.push({ key: `chorus-${turn.no}`, move: { kind: 'chorus', turn: turn.no, utterance: { via: 'speech', text: sungKana(morae, slip * 1.5, rnd) } }, delayMs: delay('chorus') });
        }
      }

      if (view.phase === 'reveal' && mine.canVote && game.duel) {
        const pickA = rnd('vote') < 0.5;
        out.push({ key: 'vote', move: { kind: 'vote', playerId: pickA ? game.duel.a : game.duel.b }, delayMs: delay('vote') });
      }
      return out;
    },
  };
}
