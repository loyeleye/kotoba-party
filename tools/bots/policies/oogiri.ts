// How a bot plays Oogiri Night: answers each prompt (from memory in the say-it-first window,
// or with tiles and a picked form, sometimes saying it to send it, sometimes in English where
// allowed), votes, and sometimes takes the encore. Repeatable: every choice hashes the bot's
// id with the phase, so the same run makes the same moves.

import type { OogiriView, SlotView } from '../../../shared/src/modes/oogiri/oogiri.js';
import { SAY_FIRST_MS } from '../../../shared/src/modes/oogiri/oogiri.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import type { ModePolicy } from '../bot.js';

export interface OogiriPolicyOptions {
  /** Chance (0–1) a bot past the Kana level waits out the say-it-first window for tiles. */
  tilesChance?: number;
  /** Chance a bot says its tile answer to send it (the rest send quietly). */
  speakChance?: number;
  /** Chance of an English answer where English is allowed. */
  englishChance?: number;
  /** Chance the winner takes the encore (others half as often). */
  encoreChance?: number;
  /** Think time before each move, in ms. */
  thinkMs?: number;
}

const MEMORY_ANSWERS = ['ねこ', 'すし', 'ラーメン', 'おばけ', '大きな タコ', 'ふるい くつした', 'ロボット', 'せんせい'];
const ENGLISH_ANSWERS = ['a very confused octopus', 'my landlord', 'three raccoons in a coat'];

function hash(...parts: (string | number)[]): number {
  let h = 2166136261;
  for (const ch of parts.join('|')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
}

function answerWithTiles(slot: SlotView, r: number, speak: boolean, english: boolean): unknown {
  if (english && slot.englishOk) return { kind: 'answer', slot: slot.index, typed: { via: 'typed', text: ENGLISH_ANSWERS[Math.floor(r * ENGLISH_ANSWERS.length)]! } };
  const tiles = slot.tiles;
  const tile = tiles[Math.floor(r * tiles.length)];
  if (!tile) return { kind: 'answer', slot: slot.index, typed: { via: 'typed', text: 'ねこ' } };
  // Usually the form the tile asks for; sometimes a slip (which earns a private tip).
  const form = tile.options ? (r < 0.8 ? tile.ask?.form : tile.options[0]!.form) ?? tile.options[0]!.form : undefined;
  const pick = { key: tile.key, form };
  const text = tile.options?.find((o) => o.form === form)?.text ?? tile.text;
  // Photo Caption: wrap a noun in a noun frame now and then.
  const frame = !tile.options && r > 0.5 ? slot.frames.find((f) => f.slot === 'noun') : undefined;
  const move: Record<string, unknown> = { kind: 'answer', slot: slot.index, tiles: [pick] };
  if (frame) move.frame = frame.id;
  if (speak) move.said = { via: 'speech', text };
  return move;
}

export function oogiriPolicy(opts: OogiriPolicyOptions = {}): ModePolicy {
  const tilesChance = opts.tilesChance ?? 0.35;
  const speakChance = opts.speakChance ?? 0.5;
  const englishChance = opts.englishChance ?? 0.15;
  const encoreChance = opts.encoreChance ?? 0.7;
  const think = opts.thinkMs ?? 300;

  return {
    act(view: RoomView, playerId: string) {
      const game = view.game as OogiriView | null;
      if (!game || game.mode !== 'oogiri' || !game.me) return [];
      const me = game.me;
      const r = (what: string) => hash(playerId, view.phaseSeq, what);
      const delay = (what: string) => Math.floor(think * (0.3 + r(`${what}:delay`)));

      if (view.phase === 'answer' && me.slot) {
        const slot = me.slot;
        const tag = `${slot.index}`;
        if (slot.sayFirst) {
          if (r(`tiles:${tag}`) < tilesChance) return [{ key: `tiles:${tag}`, move: { kind: 'tiles', slot: slot.index }, delayMs: slot.sayFirstMs ?? SAY_FIRST_MS }];
          const text = MEMORY_ANSWERS[Math.floor(r(`mem:${tag}`) * MEMORY_ANSWERS.length)]!;
          const via = r(`via:${tag}`) < 0.6 ? 'speech' : 'typed';
          return [{ key: `answer:${tag}`, move: { kind: 'answer', slot: slot.index, said: { via, text } }, delayMs: delay(tag) }];
        }
        const move = answerWithTiles(slot, r(`pick:${tag}`), r(`speak:${tag}`) < speakChance, r(`en:${tag}`) < englishChance);
        return [{ key: `answer:${tag}`, move, delayMs: delay(tag) }];
      }

      if (view.phase === 'reveal' && me.canVote && game.matchup) {
        const options = game.matchup.answers.filter((a) => !a.mine && !a.hidden);
        const pick = options[Math.floor(r('vote') * options.length)];
        if (pick) return [{ key: 'vote', move: { kind: 'vote', answerId: pick.id }, delayMs: delay('vote') }];
      }

      if (view.phase === 'encore' && (me.encore === 'winner' || me.encore === 'author') && game.matchup) {
        const mine = game.matchup.answers.find((a) => a.mine);
        const chance = me.encore === 'winner' ? encoreChance : encoreChance / 2;
        const move = mine && r('encore') < chance ? { kind: 'encore', said: { via: r('encore:via') < 0.8 ? 'speech' : 'typed', text: mine.text } } : { kind: 'encore', pass: true };
        return [{ key: 'encore', move, delayMs: delay('encore') }];
      }
      return [];
    },
  };
}
