// How a bot plays Omiai Matchmaker: answers the guest from memory in the say-it-first window
// (polite, casual or keigo, by chance), or waits for the tiles and picks a polite or a casual
// ending; sometimes reads its tile answer out loud; votes for someone else's answer; and says its
// polite version back in the encore (sometimes fluffing the first try, sometimes skipping).
// Repeatable: every choice hashes the bot's id with the phase.

import type { OmiaiView, TileView } from '../../../shared/src/modes/omiai/omiai.js';
import { SAY_FIRST_MS } from '../../../shared/src/modes/omiai/omiai.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import type { ModePolicy } from '../bot.js';

export interface OmiaiPolicyOptions {
  /** Chance a bot past the Kana level waits out the say-it-first window for tiles. */
  tilesChance?: number;
  /** Chance a bot picks a polite tile (opener and ending) over a casual one. */
  politeChance?: number;
  /** Chance a bot reads its tile answer out loud to send it. */
  speakChance?: number;
  /** Chance the encore's first try is said right. */
  echoRight?: number;
  /** Chance a bot skips the encore. */
  skipChance?: number;
  /** Type instead of speak (quiet mode). */
  quiet?: boolean | ((playerId: string) => boolean);
  /** Think time before each move, in ms. */
  thinkMs?: number;
}

/** Things a bot might say from memory: yes/no answers and "what" answers, at three registers. */
const MEMORY = {
  yesno: { polite: ['はい、すきです。', 'はい、だいすきです。', 'ええ、ときどき します。'], casual: ['うん、すきだよ', 'まじ だいすき！', 'うん、まあね'], keigo: ['はい、よく いただきます。', 'はい、まいにち いたします。'] },
  wh: { polite: ['そうですね、すしが すきです。', 'ええと、とうきょうに すんでいます。', 'さんぽを します。'], casual: ['すしだよ', 'ゲームするよ', 'ねこ、かな'], keigo: ['そうですね、ほんやに まいります。', 'とうきょうに すんでおります。'] },
  intro: { polite: ['はじめまして。{name}です。よろしく おねがいします。'], casual: ['やあ、{name}だよ。よろしく！'], keigo: ['はじめまして。{name}と もうします。よろしく おねがいいたします。'] },
};

function hash(...parts: (string | number)[]): number {
  let h = 2166136261;
  for (const ch of parts.join('|')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
}

const pickOf = <T>(items: readonly T[], r: number): T | undefined => items[Math.floor(r * items.length)];

/** A tile answer: an opener now and then, a fill, an ending, and a closer when there is one. */
export function tileAnswer(tiles: TileView[], r: (what: string) => number, politeChance: number): string[] {
  const polite = r('polite') < politeChance;
  const casualWord = (t: TileView) => /だよ|じゃん|うん|やあ|よろしく！|する。|するよ|てる|しよう|しない|たべる|のむ|おきる|いきたい！|いきたいな|もってる|まあ/.test(t.text);
  const of = (role: TileView['role']) => tiles.filter((t) => t.role === role);
  const choose = (role: TileView['role'], salt: string) => {
    const all = of(role);
    const wanted = all.filter((t) => casualWord(t) !== polite);
    return pickOf(wanted.length ? wanted : all, r(salt));
  };
  const out: (TileView | undefined)[] = [];
  if (r('opener?') < 0.6) out.push(choose('opener', 'opener'));
  out.push(of('lead')[0]);
  out.push(pickOf(of('fill'), r('fill')));
  out.push(choose('ending', 'ending'));
  if (of('closer').length && r('closer?') < 0.7) out.push(choose('closer', 'closer'));
  return out.filter((t): t is TileView => !!t).map((t) => t.key);
}

export function omiaiPolicy(opts: OmiaiPolicyOptions = {}): ModePolicy {
  const tilesChance = opts.tilesChance ?? 0.4;
  const politeChance = opts.politeChance ?? 0.7;
  const speakChance = opts.speakChance ?? 0.5;
  const echoRight = opts.echoRight ?? 0.8;
  const skipChance = opts.skipChance ?? 0.15;
  const think = opts.thinkMs ?? 300;

  return {
    act(view: RoomView, playerId: string) {
      const game = view.game as OmiaiView | null;
      if (!game || game.mode !== 'omiai' || !game.me) return [];
      const me = game.me;
      const round = game.round;
      const r = (what: string) => hash(playerId, view.phaseSeq, what);
      const delay = (what: string) => Math.floor(think * (0.3 + r(`${what}:delay`)));
      const quiet = typeof opts.quiet === 'function' ? opts.quiet(playerId) : !!opts.quiet;
      const via = quiet ? 'typed' : 'speech';
      const name = view.players.find((p) => p.id === playerId)?.name ?? 'ボット';

      if (view.phase === 'answer' && me.slot) {
        const slot = me.slot;
        if (slot.sayFirst && me.level !== 'kana') {
          if (r('tiles') < tilesChance) return [{ key: `tiles:${round}`, move: { kind: 'tiles', round }, delayMs: slot.sayFirstMs ?? SAY_FIRST_MS }];
          const kind = game.roundKind === 'intro' ? 'intro' : /(すき|します|たべます|のみます|ですか|ますか)。?$/.test(slot.question.kana) && !/(なに|なん|どこ|どんな|どの|どちら|いくつ|どう)/.test(slot.question.kana) ? 'yesno' : 'wh';
          const register = r('register') < politeChance ? (me.level === 'n4' && r('keigo') < 0.5 ? 'keigo' : 'polite') : 'casual';
          const text = pickOf(MEMORY[kind][register], r('memory'))!.split('{name}').join(name);
          return [{ key: `answer:${round}`, move: { kind: 'answer', utterance: { via, text }, round }, delayMs: delay('answer') }];
        }
        if (!slot.tiles.length) return [];
        const keys = tileAnswer(slot.tiles, r, politeChance);
        if (r('speak') < speakChance && !quiet) {
          // Spaced the way the phone joins tiles (a space after the lead), so it reads like a tile answer.
          const text = keys.map((k) => slot.tiles.find((t) => t.key === k)!).map((t, i, all) => t.text + (t.role === 'lead' && i < all.length - 1 ? ' ' : '')).join('');
          return [{ key: `answer:${round}`, move: { kind: 'answer', utterance: { via: 'speech', text }, round }, delayMs: delay('answer') }];
        }
        return [{ key: `answer:${round}`, move: { kind: 'answer', tiles: keys, round }, delayMs: delay('answer') }];
      }

      if (view.phase === 'reveal' && me.canVote) {
        const options = game.answers.filter((a) => !a.mine && !a.hidden);
        const pick = pickOf(options, r('vote'));
        if (pick) return [{ key: `vote:${round}`, move: { kind: 'vote', answerId: pick.id, round }, delayMs: delay('vote') }];
      }

      if (view.phase === 'encore' && me.encore?.canEncore) {
        const e = me.encore;
        if (e.triesLeft === 2 && r('skip') < skipChance) return [{ key: `encore:${round}:skip`, move: { kind: 'encore', pass: true, round }, delayMs: delay('skip') }];
        const right = e.triesLeft < 2 || r('echo') < echoRight;
        const text = right ? e.target.kana : 'えっと…';
        return [{ key: `encore:${round}:${e.triesLeft}`, move: { kind: 'encore', utterance: { via, text }, round }, delayMs: delay(`echo${e.triesLeft}`) }];
      }
      return [];
    },
  };
}
