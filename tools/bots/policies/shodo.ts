// How a bot plays Shodō Taikai: says each target (by seat: aloud, typed or skipped), traces over
// the model with a little wobble, writes from memory with a hand-drawn copy of what it traced,
// writes dictation from the content library (the phone never sees the written form), hangs a
// sheet in the gallery, stamps other sheets and, on even seats, claims its own.

import type { InkPoint, InkStroke } from '../../../shared/src/japanese/strokes.js';
import type { ContentLibrary } from '../../../shared/src/modes/mode.js';
import { AWARDS, type ShodoView, type TargetView } from '../../../shared/src/modes/shodo/shodo.js';
import { buildDeck, type Target } from '../../../shared/src/modes/shodo/deck.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import type { ModePolicy } from '../bot.js';
import { handDraw } from '../ink.js';

export interface ShodoPolicyOptions {
  content: ContentLibrary;
  seed?: number;
  delayMs?: number;
}

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r3 = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 1000) / 1000;

/** Traced over the model where it stands: a steady hand, a little wobble. */
export function traceOver(strokes: readonly InkStroke[], random: () => number, wobble = 0.012): InkPoint[][] {
  return strokes.map((s) => s.map(([x, y]): InkPoint => [r3(x + (random() - 0.5) * 2 * wobble), r3(y + (random() - 0.5) * 2 * wobble)]));
}

export function shodoPolicy(opts: ShodoPolicyOptions): ModePolicy {
  const random = rng(opts.seed ?? 1);
  const delayMs = opts.delayMs ?? 30;
  const deck = buildDeck(opts.content);
  const all: Target[] = [...deck.kana, ...deck.kanji, ...deck.words];
  // What the bot traced, by meaning, for writing it from memory.
  const traced = new Map<string, InkPoint[][][]>();
  /** The target a blanked view stands for: same kind, meaning and (when shown) reading. */
  const lookup = (t: TargetView): Target | undefined => all.find((x) => x.kind === t.kind && x.meaning === t.meaning && (!t.say.kana || x.say.kana === t.say.kana));
  const write = (t: TargetView): InkPoint[][][] => (t.cells ?? lookup(t)?.cells ?? Array.from({ length: t.count }, () => [])).map((c) => handDraw(c, random, { wobble: 0.01 }));
  const via = (seat: number) => (seat % 3 === 1 ? 'speech' : 'typed');

  return {
    act(view: RoomView, playerId: string) {
      const game = view.game as ShodoView | null;
      if (!game || game.mode !== 'shodo' || !game.me) return [];
      const seat = view.players.find((p) => p.id === playerId)?.seat ?? 1;
      const later = (n = 1) => delayMs * n + seat * 3;
      const out: { key: string; move: unknown; delayMs?: number }[] = [];
      const m = game.me;
      const seq = view.phaseSeq;

      const p = m.practice;
      if (view.phase === 'prompt' && p?.target && p.rep) {
        const t = p.target;
        const key = `${seq}-${p.at}-${p.of}`;
        if (p.sayFirst) {
          out.push({ key: `say-${key}`, move: seat % 3 === 0 ? { kind: 'say-skip' } : { kind: 'say', utterance: { via: via(seat), text: t.say.kana } }, delayMs: later() });
        } else if (p.rep !== 'memory' && t.cells) {
          traced.set(t.meaning, t.cells);
          // The last seat knows its first target already.
          if (seat === view.players.length && p.at === 1 && view.players.length > 1) out.push({ key: `skip-${key}`, move: { kind: 'skip-trace' }, delayMs: later() });
          else out.push({ key: `rep-${key}`, move: { kind: 'rep', strokes: traceOver(t.cells[0] ?? [], random), corrections: seat % 2 }, delayMs: later() });
        } else if (p.rep === 'memory') {
          const cells = traced.get(t.meaning) ?? lookup(t)?.cells ?? [[]];
          out.push({ key: `rep-${key}`, move: { kind: 'rep', strokes: handDraw(cells[0] ?? [], random, { wobble: 0.01 }) }, delayMs: later(2) });
        }
      }

      const it = m.item;
      if (view.phase === 'answer' && it && !it.handedIn) {
        if (game.itemKind === 'recall' && !it.shown) {
          const t = lookup(it.target);
          out.push({ key: `say-${seq}`, move: seat % 2 === 1 && t ? { kind: 'say', utterance: { via: via(seat), text: t.say.kana } } : { kind: 'say-skip' }, delayMs: later() });
        } else {
          out.push({ key: `sheet-${seq}`, move: { kind: 'sheet', cells: write(it.target) }, delayMs: later(2) });
        }
      }

      const g = m.gallery;
      if (view.phase === 'encore' && g) {
        if (!g.handedIn) out.push({ key: `gal-${seq}`, move: { kind: 'sheet', cells: write(g.target) }, delayMs: later(2) });
        else if (g.said === undefined) out.push({ key: `gsay-${seq}`, move: seat % 3 === 0 ? { kind: 'say-skip' } : { kind: 'say', utterance: { via: via(seat), text: g.target.say.kana } }, delayMs: later() });
      }

      if (view.phase === 'finale' && game.voting && game.sheets) {
        const others = game.sheets.map((s, i) => (s.name === 'you' ? -1 : i)).filter((i) => i >= 0);
        if (others.length) {
          AWARDS.slice(0, 3).forEach((a, k) => {
            if (m.stamps[a.id] === undefined) out.push({ key: `stamp-${seq}-${a.id}`, move: { kind: 'stamp', award: a.id, sheet: others[(seat + k) % others.length]! }, delayMs: later(k + 1) });
          });
        }
      }

      if (view.phase === 'penalty' && g?.sheet && !g.claimed && seat % 2 === 0) out.push({ key: `claim-${seq}`, move: { kind: 'claim' }, delayMs: later() });
      return out;
    },
  };
}
