// How a bot plays Kana Yōkai Raid: marks a few chapters, then attacks whatever its phone
// shows. Mostly right, sometimes wrong (so misses, tips and retries get exercised too), and
// a mix of shouting, typing and tapping. It works only from its own view, like a phone. In
// Ink Storm it draws the kana by "hand" from the stroke references (sometimes the wrong kana,
// or a stroke backwards), then says it.

import { kanaStrokes } from '../../../content/src/kana/strokes.js';
import { normalizeReading, soundKey, toHiragana, toKatakana } from '../../../shared/src/japanese/kana.js';
import type { KanaRaidView } from '../../../shared/src/modes/kanaRaid/kanaRaid.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import type { ModePolicy } from '../bot.js';
import { handDraw } from '../ink.js';

export interface KanaRaidPolicyOptions {
  /** Share of attacks the bot gets right (default 0.8). */
  accuracy?: number;
  /** Think time range in ms (default 500–1500; tests use much less). */
  minDelayMs?: number;
  maxDelayMs?: number;
}

/** A small stable hash, so a bot's choices repeat run to run. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

const same = (a: string, b: string) => soundKey(a) === soundKey(b);

/** A seeded random source, so a bot's drawing repeats run to run. */
function seeded(text: string): () => number {
  let s = Math.floor(hash(text) * 2147483646) + 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

const STROKES = new Map(kanaStrokes.map((k) => [k.char, k.strokes]));

export function kanaRaidPolicy(opts: KanaRaidPolicyOptions = {}): ModePolicy {
  const accuracy = opts.accuracy ?? 0.8;
  const lo = opts.minDelayMs ?? 500;
  const hi = opts.maxDelayMs ?? 1500;
  return {
    act(view: RoomView, playerId: string) {
      const game = view.game as KanaRaidView | null;
      if (!game || game.mode !== 'kana-raid' || !game.me) return [];
      const seat = view.players.find((p) => p.id === playerId)?.seat ?? 1;
      const delay = (key: string) => Math.round(lo + hash(`${playerId}:${key}`) * (hi - lo));

      if (view.phase === 'intro') {
        if (game.me.ready) return [];
        const numbers = game.chapters.map((c) => c.number);
        // Seat 1 is a first-timer; later seats have studied further.
        const upTo = numbers[Math.min(numbers.length - 1, (seat - 1) * 2)] ?? 1;
        const chapters = numbers.filter((n) => n <= upTo);
        return [
          { key: 'chapters', move: { kind: 'chapters', chapters }, delayMs: delay('chapters') },
          { key: 'ready', move: { kind: 'ready' }, delayMs: delay('chapters') + 50 },
        ];
      }

      const a = game.me.attack;
      if (!a || (view.phase !== 'answer' && view.phase !== 'finale')) return [];
      const key = `${a.id}:${a.step ?? ''}`;
      const roll = hash(key);
      const right = roll < accuracy;
      const style = hash(`${key}:style`);
      const say = (text: string) => ({ kind: 'attack', attackId: a.id, say: { via: style < 0.75 ? 'speech' : 'typed', text } });
      const tap = (id: string | undefined) => ({ kind: 'attack', attackId: a.id, pick: id ?? a.options[0]?.id ?? '0' });
      const wrongOption = (good: string | undefined) => a.options.find((o) => o.id !== good)?.id;
      const matching = (target: string) => a.options.find((o) => same(normalizeReading(o.label), normalizeReading(target)))?.id;

      // Waves 1–2: now and then pick a yōkai further back instead of the one dealt.
      if (game.me.canAim && !a.retry && hash(`${key}:aim`) < 0.3) {
        const mine = new Set(game.me.aimable);
        const here = game.horde.filter((y) => mine.has(y.id) && y.state === 'alive' && y.spawnAt <= game.at && y.escapeAt > game.at + 2_000 && y.id !== a.yokaiId);
        const pickY = here[Math.floor(hash(`${key}:which`) * here.length)];
        if (pickY) return [{ key: `${key}:aim`, move: { kind: 'aim', yokaiId: pickY.id }, delayMs: delay(`${key}:aim`) }];
      }

      let move: unknown;
      switch (a.kind) {
        case 'shout': {
          const show = a.show ?? '';
          if (style < 0.85) move = say(right ? show : same(show, 'ん') ? 'あ' : 'ん');
          else {
            const good = matching(show);
            move = tap(right ? good : wrongOption(good));
          }
          break;
        }
        case 'twin':
        case 'lookalike': {
          const good = matching(a.show ?? '');
          move = tap(right ? good : wrongOption(good));
          break;
        }
        case 'echo': {
          // Numbered voices: the one whose sound is the yōkai's.
          const good = a.options.find((o) => o.hear && same(o.hear, a.show ?? ''))?.id;
          move = tap(right ? good : wrongOption(good));
          break;
        }
        case 'pair': {
          if (a.step === 'tap') {
            const good = a.options.find((o) => normalizeReading(o.label) === normalizeReading(a.hear ?? ''))?.id;
            move = tap(right ? good : wrongOption(good));
          } else move = style < 0.9 ? say(right ? (a.word?.kana ?? '') : 'えっと') : { kind: 'attack', attackId: a.id, pass: true };
          break;
        }
        case 'piece': {
          const show = a.show ?? '';
          if (show === 'ー' || show === 'ッ' || show === 'っ') {
            const good = a.options.find((o) => (show === 'ー' ? /^Stretch/ : /pause/).test(o.label))?.id;
            move = tap(right ? good : wrongOption(good));
          } else if (style < 0.8) move = say(right ? show : 'ん');
          else {
            const good = matching(show);
            move = tap(right ? good : wrongOption(good));
          }
          break;
        }
        case 'draw': {
          if (a.step === 'say') {
            move = style < 0.85 ? say(right ? (a.word?.text ?? '') : 'ん') : { kind: 'attack', attackId: a.id, pass: true };
            break;
          }
          // The mask is the twin: the true form is the same sound in the asked-for script.
          const target = a.script === 'katakana' ? toKatakana(a.show ?? '') : toHiragana(a.show ?? '');
          const random = seeded(key);
          const ref = STROKES.get(target) ?? kanaStrokes[0]!.strokes;
          let ink;
          if (right) ink = handDraw(ref, random, { wobble: 0.02 });
          else if (style < 0.5) ink = handDraw(ref, random, { reverse: ref.length - 1 });
          else ink = handDraw(kanaStrokes[Math.floor(random() * kanaStrokes.length)]!.strokes, random);
          move = { kind: 'attack', attackId: a.id, ink };
          break;
        }
        case 'blow':
          move = say(right || roll > 0.95 ? (a.word?.text ?? '') : 'えっと');
          break;
      }
      return move ? [{ key, move, delayMs: delay(key) }] : [];
    },
  };
}
