// A bot that plays Who's the Tourist? like a decent human. On its turn it picks someone and asks,
// mixing its own words (a tile's text said without the tile), a tile said aloud, and a plain tap.
// An N4 bot gets cues (English and frame) instead of tiles: it mostly asks from memory, sometimes peeks
// at the Japanese first, now and then taps. Asked, it answers the same way as with tiles. Locals watch the log: a player whose answers never fit the place
// is a suspect, and a local may call a vote on them. The tourist counts which place the answers
// fit and guesses once one place is clearly ahead. Everyone votes; the tourist votes to blend in.

import { ALL_LINES, PLACES } from '../../../shared/src/modes/tourist/places.js';
import type { TouristView } from '../../../shared/src/modes/tourist/tourist.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import type { ModePolicy } from '../bot.js';

export interface TouristBotOptions {
  seed?: number;
  /** Type instead of speak (quiet mode). */
  quiet?: boolean | ((playerId: string) => boolean);
  /** Chance a local calls a vote on a clear suspect (checked once per turn). */
  callRate?: number;
  /** Clues (answers that fit one place) the tourist wants before guessing. */
  guessAt?: number;
  /** Think time range in ms. */
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

/** Every line by id: a bot knows the Japanese behind a cue (a player would recall it, or peek). */
const LINES = new Map(ALL_LINES.map((l) => [l.id, l]));

const PLACE_LINES = new Map(PLACES.map((p) => [p.id, new Set(p.answers.map((a) => a.jp.text))]));

/** For each place in play, how many logged answers only someone there would give. */
function clues(game: TouristView): Map<string, number> {
  const out = new Map<string, number>(game.places.map((p) => [p.id, 0]));
  for (const x of game.log) {
    if (!x.answer) continue;
    for (const p of game.places) if (PLACE_LINES.get(p.id)?.has(x.answer.text)) out.set(p.id, out.get(p.id)! + 1);
  }
  return out;
}

/** A local's suspect: the player (not me) whose answers fit the place least, with the most answers. */
function suspect(game: TouristView, me: string, players: readonly string[]): { id: string; fits: number; answers: number } | null {
  const placeId = game.me?.card?.place.id;
  const lines = placeId ? PLACE_LINES.get(placeId) : undefined;
  const rows = players
    .filter((id) => id !== me)
    .map((id) => {
      const answers = game.log.filter((x) => x.targetId === id && x.answer);
      return { id, fits: answers.filter((x) => lines?.has(x.answer!.text)).length, answers: answers.length };
    })
    .sort((a, b) => a.fits - b.fits || b.answers - a.answers || a.id.localeCompare(b.id));
  return rows[0] ?? null;
}

export function touristPolicy(opts: TouristBotOptions = {}): ModePolicy {
  const seed = opts.seed ?? 1;
  const callRate = opts.callRate ?? 0.25;
  const guessAt = opts.guessAt ?? 2;
  const [minDelay, maxDelay] = opts.delayMs ?? [1_500, 8_000];
  // Question tiles this bot has been dealt before: its own words are one of these, remembered, when it isn't on screen.
  const remembered = new Map<string, { id: string; text: string; kana: string }>();

  return {
    act(view: RoomView, me: string) {
      const game = view.game as TouristView | null;
      if (!game || game.mode !== 'tourist' || !game.me) return [];
      const mine = game.me;
      const seq = view.phaseSeq;
      const round = game.round;
      const quiet = typeof opts.quiet === 'function' ? opts.quiet(me) : !!opts.quiet;
      const via = quiet ? ('typed' as const) : ('speech' as const);
      const delay = (salt: string) => Math.round(minDelay + (maxDelay - minDelay) * chance(seed, me, seq, salt));
      const out: { key: string; move: unknown; delayMs?: number }[] = [];
      const others = view.players.filter((p) => p.id !== me).map((p) => p.id);

      if (view.phase === 'prompt' && !mine.ready) out.push({ key: 'ready', move: { kind: 'ready', round }, delayMs: delay('ready') / 4 });

      if (view.phase === 'answer' && game.turn) {
        const t = game.turn;
        const say = (list: { id: string; text: string; kana: string }[], salt: string) => {
          const tile = list[Math.floor(chance(seed, me, seq, salt, 'tile') * list.length)];
          if (!tile) return { utterance: { via, text: 'えっと…' } };
          const r = chance(seed, me, seq, salt, 'how');
          if (r < 0.35) {
            // From memory: a question it was dealt on an earlier turn, not one on screen now (saying a tile
            // that's on screen is reading it). Answers have to fit tonight's place, so they're said off the tile.
            const on = new Set(list.map((l) => l.id));
            const past = salt === 'q' ? [...remembered.values()].filter((l) => !on.has(l.id)).sort((x, y) => x.id.localeCompare(y.id)) : [];
            const own = past[Math.floor(chance(seed, me, seq, salt, 'past') * past.length)];
            return { utterance: { via, text: (own ?? tile).kana } };
          }
          if (r < 0.8) return { utterance: { via, text: tile.kana }, lineId: tile.id }; // took the tile and said it
          return { utterance: { via: 'tap' as const, text: tile.text }, lineId: tile.id };
        };
        for (const q of mine.questions ?? []) remembered.set(q.id, q);
        if (t.askerId === me && !t.question) {
          const options = view.players.filter((p) => p.id !== me && p.id !== t.noAskBack && p.connected).map((p) => p.id);
          const targetId = t.targetId ?? options[Math.floor(chance(seed, me, seq, 'who') * options.length)];
          if (targetId) {
            const at = delay('ask');
            if (!t.targetId) out.push({ key: 'pick', move: { kind: 'pick', targetId, round, turn: t.seq }, delayMs: Math.round(at / 3) });
            const cue = mine.cues?.length ? mine.cues[Math.floor(chance(seed, me, seq, 'q', 'tile') * mine.cues.length)] : undefined;
            const line = cue && LINES.get(cue.id);
            if (line) {
              // From a cue: 60% from memory, 25% after a peek at the Japanese, 15% a tap.
              const r = chance(seed, me, seq, 'q', 'how');
              if (r >= 0.6 && r < 0.85) out.push({ key: 'peek', move: { kind: 'peek', lineId: line.id, round, turn: t.seq }, delayMs: Math.round(at / 2) });
              const utterance = r < 0.85 ? { via, text: line.jp.kana } : { via: 'tap' as const, text: line.jp.text };
              out.push({ key: 'ask', move: { kind: 'ask', targetId, utterance, lineId: line.id, round, turn: t.seq }, delayMs: at });
            } else out.push({ key: 'ask', move: { kind: 'ask', targetId, ...say(mine.questions ?? [], 'q'), round, turn: t.seq }, delayMs: at });
          }
        }
        if (t.targetId === me && t.question && !t.answer) {
          out.push({ key: 'reply', move: { kind: 'reply', ...say(mine.answers ?? [], 'a'), round, turn: t.seq }, delayMs: delay('reply') });
        }
        if (mine.tourist && mine.canGuess) {
          const c = [...clues(game)].sort((a, b) => b[1] - a[1]);
          const [best, second] = c;
          if (best && best[1] >= guessAt && (!second || second[1] < best[1])) {
            const place = game.places.find((p) => p.id === best[0])!;
            out.push({ key: 'guess', move: { kind: 'guess', placeId: place.id, utterance: { via, text: `ここは ${place.kana} ですか` }, round }, delayMs: delay('guess') / 2 });
          }
        }
        if (!mine.tourist && mine.canCall && t.n >= 4) {
          const sus = suspect(game, me, others);
          if (sus && sus.fits === 0 && sus.answers >= 2 && chance(seed, me, seq, 'call') < callRate) out.push({ key: 'call', move: { kind: 'call', round }, delayMs: delay('call') });
        }
      }

      if (view.phase === 'reveal' && game.vote?.voters.includes(me) && !mine.myVote) {
        const voters = others.filter((id) => view.players.some((p) => p.id === id));
        const pickId = mine.tourist ? voters[Math.floor(chance(seed, me, seq, 'vote') * voters.length)] : suspect(game, me, voters)?.id;
        if (pickId) out.push({ key: 'vote', move: { kind: 'vote', suspectId: pickId, round }, delayMs: delay('vote') / 2 });
      }

      if (view.phase === 'encore' && mine.canGuess) {
        const c = [...clues(game)].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
        const place = game.places.find((p) => p.id === c[0]?.[0]) ?? game.places[0];
        if (place) out.push({ key: 'last', move: { kind: 'guess', placeId: place.id, utterance: { via, text: `ここは ${place.kana} ですか` }, round }, delayMs: delay('last') / 2 });
      }
      return out;
    },
  };
}
