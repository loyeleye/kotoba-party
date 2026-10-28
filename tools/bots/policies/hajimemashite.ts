// How bots play はじめまして！: the guest writes its name and greets the room, everyone answers こちらこそ;
// in the write step the guest picks a tile (or types one) as its truth, tanuki pick a tile from their
// hand, detectives guess; the introducer reads each line (now and then asking Pon for help); rankers
// order the cards at random but lean on a hunch; the guest picks a wish; after the flip, tanuki claim
// their lie and the guest refutes and says the truth; at the end everyone recalls. Repeatable: every
// choice hashes the bot's id with the phase.

import type { HajimeView } from '../../../shared/src/modes/hajimemashite/hajimemashite.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import type { ModePolicy } from '../bot.js';

export interface HajimePolicyOptions {
  /** Type instead of speak (quiet mode). */
  quiet?: boolean | ((playerId: string) => boolean);
  /** Chance the introducer hands a line to Pon. */
  helpChance?: number;
  /** Chance a bot types its own word instead of picking a tile. */
  typeChance?: number;
  thinkMs?: number;
}

function hash(...parts: (string | number)[]): number {
  let h = 2166136261;
  for (const ch of parts.join('|')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
}

const pickOf = <T>(items: readonly T[], r: number): T | undefined => items[Math.floor(r * items.length)];
const TYPED = ['すいか', 'ぎんなん', 'ねぎ', 'おでん'];

export function hajimemashitePolicy(opts: HajimePolicyOptions = {}): ModePolicy {
  const think = opts.thinkMs ?? 300;
  const helpChance = opts.helpChance ?? 0.15;
  const typeChance = opts.typeChance ?? 0.1;
  return {
    act(view: RoomView, playerId: string) {
      const game = view.game as HajimeView | null;
      if (!game || game.mode !== 'hajimemashite' || !game.me) return [];
      const me = game.me;
      const turn = game.turn;
      const r = (what: string) => hash(playerId, view.phaseSeq, what);
      const delay = (what: string) => Math.floor(think * (0.3 + r(`${what}:delay`)));
      const quiet = typeof opts.quiet === 'function' ? opts.quiet(playerId) : !!opts.quiet;
      const via = quiet ? 'typed' : 'speech';
      const say = (text: string) => ({ via, text });

      switch (view.phase) {
        case 'prompt':
          if (me.role === 'guest') {
            if (!me.nameSet) return [{ key: 'name', move: { kind: 'name', text: me.nameSuggest.replace(/[^ァ-ヺー・ぁ-ゖ]/g, '') || 'ボット', turn }, delayMs: delay('name') }];
            if (!me.greeted) return [{ key: 'greet', move: { kind: 'greet', utterance: say(`はじめまして。${me.name}です。よろしく おねがいします。`), turn }, delayMs: delay('greet') }];
            return [];
          }
          if (!me.kochira) return [{ key: 'kochira', move: { kind: 'kochira', utterance: say('こちらこそ、よろしく おねがいします'), turn }, delayMs: delay('kochira') }];
          return [];
        case 'answer': {
          if (me.written || !me.role) return [];
          if (me.canType && r('type?') < typeChance) return [{ key: 'write', move: { kind: 'write', utterance: { via: 'typed', text: pickOf(TYPED, r('typed'))! }, turn }, delayMs: delay('write') }];
          const tile = pickOf(me.hand, r('tile'));
          return tile ? [{ key: 'write', move: { kind: 'write', tileId: tile.id, turn }, delayMs: delay('write') }] : [];
        }
        case 'reveal': {
          if (me.script && me.scriptAt >= 0 && me.scriptAt < me.script.length) {
            const line = me.script[me.scriptAt]!;
            if (r(`help${me.scriptAt}`) < helpChance) return [{ key: `read:${me.scriptAt}`, move: { kind: 'read', pon: true, turn }, delayMs: delay(`read${me.scriptAt}`) }];
            return [{ key: `read:${me.scriptAt}`, move: { kind: 'read', utterance: say(line.text), turn }, delayMs: delay(`read${me.scriptAt}`) }];
          }
          return [];
        }
        case 'encore': {
          if (me.role === 'guest') {
            const w = pickOf(me.wishable, r('wish'));
            return w && !me.wish ? [{ key: 'wish', move: { kind: 'wish', factId: w.id, turn }, delayMs: delay('wish') }] : [];
          }
          const out: { key: string; move: unknown; delayMs?: number }[] = [];
          if (!me.ballot && me.rankable.length) {
            const order = [...me.rankable].map((c) => c.id).sort((a, b) => hash(playerId, turn, a) - hash(playerId, turn, b));
            out.push({ key: 'rank', move: { kind: 'rank', order, turn }, delayMs: delay('rank') + think });
          }
          if (me.argued < 1 && r('argue?') < 0.5) out.push({ key: 'argue', move: { kind: 'argue', utterance: say('あやしい！'), turn }, delayMs: delay('argue') });
          return out;
        }
        case 'score': {
          const out: { key: string; move: unknown; delayMs?: number }[] = [];
          if (me.claim && !me.claim.done) out.push({ key: 'claim', move: { kind: 'claim', utterance: say('ドロン！ わたしでした！'), turn }, delayMs: delay('claim') + think * 2 });
          if (me.truth && !me.truth.done) out.push({ key: 'truth', move: { kind: 'truth', utterance: say(me.truth.line), turn }, delayMs: delay('truth') + think * 3 });
          for (const f of me.refute) if (!f.done) out.push({ key: `refute:${f.factId}`, move: { kind: 'refute', factId: f.factId, utterance: say(`${f.word}？ ちがいます！`), turn }, delayMs: delay(`refute${f.factId}`) + think * 2 });
          return out;
        }
        case 'finale': {
          const todo = me.recall.find((x) => !x.done);
          if (!todo) return [];
          const pick = pickOf(todo.options, r(`recall${todo.turn}`))!;
          if (r(`recall-say${todo.turn}`) < 0.5) return [{ key: `recall:${todo.turn}`, move: { kind: 'recall', turn: todo.turn, utterance: say(todo.frame.replace('＿', pick.word)) }, delayMs: delay(`recall${todo.turn}`) }];
          return [{ key: `recall:${todo.turn}`, move: { kind: 'recall', turn: todo.turn, factId: pick.id }, delayMs: delay(`recall${todo.turn}`) }];
        }
        default:
          return [];
      }
    },
  };
}
