// How a bot plays Murder at the Onsen: on its turn it questions the suspect it knows least
// about, asking something not yet asked (built from the phone's own tiles, so it never needs
// the case), sometimes mumbling first to use the retry; at the accusation it names the suspect
// the notebook mentions most (sometimes a hunch instead) and says the sentence aloud.

import type { OnsenIntent } from '../../../content/src/types.js';
import type { OnsenView } from '../../../shared/src/modes/onsenMurder/onsenMurder.js';
import { bareName, joinTiles, type QuestionTile } from '../../../shared/src/modes/onsenMurder/questions.js';
import { normalizeReading } from '../../../shared/src/japanese/kana.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import type { ModePolicy } from '../bot.js';

export interface OnsenBotOptions {
  /** Chance the first try at a question is a mumble the matcher can't place (default 0.2). */
  mumble?: number;
  /** Chance the accusation follows the notebook rather than a random hunch (default 0.75). */
  sleuth?: number;
  /** Type instead of speak (quiet mode). */
  quiet?: boolean | ((playerId: string) => boolean);
  /** Build questions from tiles (sent as taps) instead of saying them. */
  tiles?: boolean | ((playerId: string) => boolean);
  /** Think time range in ms. */
  delayMs?: [number, number];
}

/** Which tiles make each question. */
const RECIPES: Record<OnsenIntent, string[]> = {
  where: ['doko', 'ni', 'imashita'],
  what: ['nani', 'wo', 'shiteimashita'],
  who: ['dare', 'wo', 'mimashita'],
  when: ['nanji', 'ni', 'nemashita'],
  victim: ['victim', 'wa', 'donna', 'hito', 'deshita'],
  item: ['kono', 'item', 'wa', 'dare', 'no', 'desu'],
};
const ORDER: OnsenIntent[] = ['where', 'who', 'item', 'what', 'when', 'victim'];

function chance(...parts: (string | number)[]): number {
  let h = 2166136261;
  for (const ch of parts.join('|')) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10_000) / 10_000;
}

export function buildQuestion(tiles: readonly QuestionTile[], intent: OnsenIntent): string {
  const pieces = RECIPES[intent].map((id) => tiles.find((t) => t.id === id)).filter((t): t is QuestionTile => !!t);
  return joinTiles(pieces);
}

export function onsenMurderPolicy(opts: OnsenBotOptions = {}): ModePolicy {
  const mumble = opts.mumble ?? 0.2;
  const sleuth = opts.sleuth ?? 0.75;
  const [lo, hi] = opts.delayMs ?? [400, 1500];
  const flag = (v: OnsenBotOptions['quiet'], me: string) => (typeof v === 'function' ? v(me) : !!v);

  return {
    act(view: RoomView, me: string) {
      const game = view.game as OnsenView | null;
      if (!game || game.mode !== 'onsen-murder' || !game.mine) return [];
      const mine = game.mine;
      const seq = view.phaseSeq;
      const delay = (salt: string) => Math.round(lo + (hi - lo) * chance(me, seq, salt, 'delay'));
      const via = flag(opts.quiet, me) ? 'typed' : 'speech';

      if (view.phase === 'answer' && mine.isTurn) {
        const tryNo = 2 - mine.triesLeft;
        // The suspect we know least about, then a question nobody has asked them.
        const suspects = [...game.suspects].sort((a, b) => a.asked.length - b.asked.length || chance(me, seq, a.id) - chance(me, seq, b.id));
        const suspect = mine.miss ? game.suspects.find((s) => s.id === mine.miss!.suspectId)! : suspects[0]!;
        const intent = ORDER.find((i) => !suspect.asked.includes(i)) ?? ORDER[Math.floor(chance(me, seq, 'any') * ORDER.length)]!;
        const text = buildQuestion(mine.tiles, intent);
        const useTiles = flag(opts.tiles, me);
        const garble = tryNo === 0 && chance(me, seq, 'mumble') < mumble;
        return [
          {
            key: `ask-${seq}-${tryNo}`,
            move: { kind: 'ask', suspectId: suspect.id, utterance: { via: garble ? via : useTiles ? 'tap' : via, text: garble ? 'えっと…' : text } },
            delayMs: delay(`ask${tryNo}`),
          },
        ];
      }

      if (view.phase === 'encore' && !mine.accusation) {
        // Count how often the notebook names each suspect; the culprit is usually the busiest.
        const counts = game.suspects.map((s) => ({
          s,
          n: game.notebook.filter((c) => normalizeReading(c.jp.kana).includes(bareName(s.name.kana))).length,
        }));
        counts.sort((a, b) => b.n - a.n || chance(me, a.s.id) - chance(me, b.s.id));
        const hunch = game.suspects[Math.floor(chance(me, seq, 'hunch') * game.suspects.length)]!;
        const target = chance(me, seq, 'sleuth') < sleuth ? counts[0]!.s : hunch;
        const tryNo = mine.accuseTry ? 1 : 0;
        const garble = tryNo === 0 && chance(me, seq, 'mumble-acc') < mumble;
        const line = mine.lines.find((l) => l.suspectId === target.id)!.line;
        return [
          {
            key: `accuse-${tryNo}`,
            move: { kind: 'accuse', suspectId: target.id, utterance: { via, text: garble ? 'はんにんは… えっと' : line.kana } },
            delayMs: delay(`acc${tryNo}`),
          },
        ];
      }
      return [];
    },
  };
}
