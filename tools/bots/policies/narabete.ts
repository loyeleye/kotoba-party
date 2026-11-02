// How bots play Narabete!: one policy shared by every bot in the room, standing in for a room that
// listens. Each bot says its card (from memory, with the hint, typed, or a ready answer tapped or
// read out, by chance), and the policy remembers what each bot "heard" of the others: their values,
// a little blurred, as a room that mishears now and then. In the line, a bot steps its own card
// toward where it thinks it belongs among the cards it heard of, then locks. It may ask for a card
// again, defends its card, votes for someone else's answer and reads its story line.
// Repeatable: every choice hashes the bot's id with the phase.

import type { NarabeteView } from '../../../shared/src/modes/narabete/narabete.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import { framesOf } from '../../../shared/src/japanese/frames.js';
import type { ModePolicy } from '../bot.js';

export interface NarabetePolicyOptions {
  /** Chance a bot past the Kana level asks for the hint first. */
  hintChance?: number;
  /** Chance a Time Line card is said with its time missing (a fluffed first try). */
  fluffChance?: number;
  /** Feelings: chance a bot picks a ready answer instead of making one up. */
  readyChance?: number;
  /** How far, out of 100, the room mishears a value (0: perfect ears). */
  blur?: number;
  /** Type instead of speak (quiet mode). */
  quiet?: boolean | ((playerId: string) => boolean);
  thinkMs?: number;
}

function hash(...parts: (string | number)[]): number {
  let h = 2166136261;
  for (const ch of parts.join('|')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
}

const pickOf = <T>(items: readonly T[], r: number): T | undefined => items[Math.floor(r * items.length)];

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/**
 * A Time card's label as a number that sorts the way a listener would guess: minutes (small hours
 * after midnight count as the next day), yen, or the day of the year.
 */
export function labelValue(label: string): number {
  const yen = /¥([\d,]+)/.exec(label);
  if (yen) return Number(yen[1]!.replace(/,/g, ''));
  const date = /^([A-Za-z]{3})\s+(\d+)/.exec(label);
  if (date) return MONTHS.indexOf(date[1]!.toLowerCase()) * 31 + Number(date[2]);
  const t = /(\d+):(\d+)\s*(am|pm|noon|midnight)/.exec(label);
  if (!t) return 0;
  let hour = Number(t[1]) % 12;
  const min = Number(t[2]);
  if (t[3] === 'pm' || t[3] === 'noon') hour += 12;
  if (t[3] === 'midnight' || (t[3] === 'am' && hour < 5)) hour += 24;
  return hour * 60 + min;
}

/**
 * A defence line in the bot's own words: ほんとうに added inside the reason (after its first word, or a later one),
 * so it isn't the model read out, while every frame the line carried still comes through. Null if none keeps them.
 */
export function ownWords(kana: string): string | null {
  const want = framesOf({ text: kana, kana }, undefined, { keepHidden: true });
  const words = kana.split(' ');
  for (let i = 1; i < Math.min(words.length, 5); i++) {
    const text = [...words.slice(0, i), 'ほんとうに', ...words.slice(i)].join(' ');
    const got = new Set(framesOf({ text, kana: text }, undefined, { keepHidden: true }));
    if (want.every((f) => got.has(f))) return text;
  }
  return null;
}

/** Answers a bot makes up for a Feelings theme, by how high its number is. */
const MADE_UP = { low: ['ちょっとだけ です', 'ぜんぜん だいじょうぶ'], mid: ['まあまあ です', 'ふつう かな'], high: ['すごく ひどい です', 'もう だめ です'] };

export function narabetePolicy(opts: NarabetePolicyOptions = {}): ModePolicy {
  const hintChance = opts.hintChance ?? 0.3;
  const fluffChance = opts.fluffChance ?? 0.15;
  const readyChance = opts.readyChance ?? 0.5;
  const blur = opts.blur ?? 8;
  const think = opts.thinkMs ?? 300;
  // What the room heard: card id → value, per round.
  const heard = new Map<string, number>();
  let heardRound = -1;

  return {
    act(view: RoomView, playerId: string) {
      const game = view.game as NarabeteView | null;
      if (!game || game.mode !== 'narabete' || !game.me) return [];
      const me = game.me;
      const round = game.round;
      if (heardRound !== round) {
        heard.clear();
        heardRound = round;
      }
      const r = (what: string) => hash(playerId, view.phaseSeq, what);
      const delay = (what: string) => Math.floor(think * (0.3 + r(`${what}:delay`)));
      const quiet = typeof opts.quiet === 'function' ? opts.quiet(playerId) : !!opts.quiet;
      const via = quiet ? 'typed' : 'speech';
      const myValue = me.time ? labelValue(me.time.label) : (me.secret ?? 0);
      if (me.cardId) heard.set(me.cardId, myValue + (hash(playerId, round, 'blur') - 0.5) * 2 * blur * (me.time ? 10 : 1));

      if (view.phase === 'answer' && me.cardId && !me.said?.ok) {
        if (me.time) {
          const t = me.time;
          // A bot can say its sentence only once it can see it: it asks for the hint, or first fluffs a
          // try from memory (the time doesn't come through) and then asks.
          if (!t.jp) {
            if (me.said || r('hint?') < hintChance) return [{ key: 'hint', move: { kind: 'hint', round }, delayMs: delay('hint') }];
            return [{ key: 'say:first', move: { kind: 'say', utterance: { via, text: 'えっと…' }, round }, delayMs: delay('say') }];
          }
          const text = me.said || r('fluff') >= fluffChance ? t.jp.kana : 'えっと…';
          return [{ key: `say:${me.said ? 'again' : 'first'}`, move: { kind: 'say', utterance: { via, text }, round }, delayMs: delay('say') }];
        }
        if (me.said) return [];
        if (me.offers.length && r('ready?') < readyChance) {
          const near = [...me.offers].sort((a, b) => a.key - b.key)[Math.min(me.offers.length - 1, Math.floor((myValue / 101) * me.offers.length))]!;
          if (r('read?') < 0.5 && !quiet) return [{ key: 'say', move: { kind: 'say', utterance: { via: 'speech', text: near.text }, round }, delayMs: delay('say') }];
          return [{ key: 'ready', move: { kind: 'ready', key: near.key, round }, delayMs: delay('ready') }];
        }
        const band = myValue < 34 ? MADE_UP.low : myValue < 67 ? MADE_UP.mid : MADE_UP.high;
        return [{ key: 'say', move: { kind: 'say', utterance: { via, text: pickOf(band, r('made-up'))! }, round }, delayMs: delay('say') }];
      }

      if (view.phase === 'reveal' && me.cardId) {
        const out: { key: string; move: unknown; delayMs?: number }[] = [];
        if (me.againFrom.length && me.said) out.push({ key: `again-say:${me.againFrom.length}`, move: { kind: 'say', utterance: { via, text: me.said.text }, round }, delayMs: delay('again-say') });
        if (game.kind === 'time' && r('ask?') < 0.2) {
          const other = pickOf(
            game.line.filter((c) => !c.mine),
            r('ask'),
          );
          if (other) out.push({ key: 'ask', move: { kind: 'again', cardId: other.id, round }, delayMs: delay('ask') });
        }
        // Where my card belongs among the cards I heard of, in the line's own order.
        const known = game.line.filter((c) => heard.has(c.id));
        const rank = known.filter((c) => heard.get(c.id)! < heard.get(me.cardId!)!).length;
        const before = known[rank - 1];
        const after = known.find((c, i) => i >= rank && c.id !== me.cardId);
        const pos = me.position;
        const wantRight = before && game.line.findIndex((c) => c.id === before.id) > pos;
        const wantLeft = after && game.line.findIndex((c) => c.id === after.id) < pos;
        // One step per spot: a bot never steps from the same spot twice, so two bots can't swap forever.
        if (wantRight && me.canMove.right) out.push({ key: `move:${pos}:right`, move: { kind: 'move', dir: 1, round }, delayMs: delay(`move${pos}`) });
        else if (wantLeft && me.canMove.left) out.push({ key: `move:${pos}:left`, move: { kind: 'move', dir: -1, round }, delayMs: delay(`move${pos}`) });
        else if (!me.locked) out.push({ key: `lock:${pos}:${game.line.map((c) => c.id).join(',')}`, move: { kind: 'lock', locked: true, round }, delayMs: delay(`lock${pos}`) + think });
        return out;
      }

      if (view.phase === 'encore' && me.defending) {
        // Green Car: the scripted defence in the bot's own words (a model line with a word added, so it isn't read
        // off the phone), N3 when its script is N3, and for an N4 bot the N3 stretch about half the time.
        const hard = me.hard;
        if (hard?.script && view.greenCar?.on) {
          const script = hard.stretch && r('stretch') < 0.5 ? hard.stretch : hard.script;
          const line = pickOf(script.lines, r('line'));
          const own = line ? ownWords(line.kana) : null;
          if (own) return [{ key: 'defend', move: { kind: 'defend', utterance: { via: 'speech', text: own }, round }, delayMs: delay('defend') }];
        }
        if (r('pass') < 0.2) return [{ key: 'defend', move: { kind: 'defend', pass: true, round }, delayMs: delay('defend') }];
        return [{ key: 'defend', move: { kind: 'defend', utterance: { via, text: 'ほんとうに そう おもうから です。' }, round }, delayMs: delay('defend') }];
      }

      if (view.phase === 'score' && me.canVote) {
        const pick = pickOf(
          game.line.filter((c) => !c.mine && c.text && !c.hidden),
          r('vote'),
        );
        if (pick) return [{ key: 'vote', move: { kind: 'vote', cardId: pick.id, round }, delayMs: delay('vote') }];
      }

      if (view.phase === 'finale' && me.performing) {
        if (r('skip') < 0.1) return [{ key: 'perform', move: { kind: 'perform', pass: true, round }, delayMs: delay('perform') }];
        return [{ key: 'perform', move: { kind: 'perform', utterance: { via, text: `そして ${me.performing.text}` }, round }, delayMs: delay('perform') }];
      }
      return [];
    },
  };
}
