// How bots play Happyōkai!: the presenter picks a title, says it's ready, and on each slide says a
// sentence or two (its own, a ready sentence read out, or one tapped), then moves on; it chooses a
// question and answers it; Chōchin-san's "Have you ever…?" card it answers yes or no with the frame, from
// memory or after a peek at the Japanese. The assistant picks each next slide (sometimes the wild one, once a mishap)
// and now and then pushes a cue card. Everyone else stamps, asks a question (out loud or tapped),
// grades the talk and votes for the best one.
// Repeatable: every choice hashes the bot's id with the phase and slide.

import { haveYouCard, haveYouOf } from '../../../shared/src/modes/happyokai/content.js';
import type { HappyokaiView } from '../../../shared/src/modes/happyokai/happyokai.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import type { ModePolicy } from '../bot.js';

export interface HappyokaiPolicyOptions {
  /** Chance the presenter reads a ready sentence out instead of making one up. */
  readChance?: number;
  /** Chance the assistant plays its mishap on a slide. */
  mishapChance?: number;
  /** Chance the presenter opens the Japanese of Chōchin-san's card before answering it. */
  peekChance?: number;
  /** Type instead of speak (quiet mode). */
  quiet?: boolean;
  thinkMs?: number;
}

function hash(...parts: (string | number)[]): number {
  let h = 2166136261;
  for (const ch of parts.join('|')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
}

const pickOf = <T>(items: readonly T[], r: number): T | undefined => items[Math.floor(r * items.length)];

const STAMPS = ['omoshiroi', 'hee', 'sugoi', 'naruhodo', 'ee'] as const;

export function happyokaiPolicy(opts: HappyokaiPolicyOptions = {}): ModePolicy {
  const readChance = opts.readChance ?? 0.4;
  const mishapChance = opts.mishapChance ?? 0.3;
  const peekChance = opts.peekChance ?? 0.25;
  const think = opts.thinkMs ?? 300;
  return {
    act(view: RoomView, playerId: string) {
      const game = view.game as HappyokaiView | null;
      if (!game || game.mode !== 'happyokai' || !game.me) return [];
      const me = game.me;
      const at = `${view.phaseSeq}:${game.step}`;
      const r = (what: string) => hash(playerId, at, what);
      const delay = (what: string) => Math.floor(think * (0.3 + r(`${what}:delay`)));
      const via = opts.quiet ? 'typed' : 'speech';
      const out: { key: string; move: unknown; delayMs?: number }[] = [];

      if (view.phase === 'prompt' && me.role === 'presenter') {
        if (me.titleChoices.length && !game.title) out.push({ key: 'title', move: { kind: 'title', key: Math.floor(r('title') * me.titleChoices.length) }, delayMs: delay('title') });
        else if (game.title && !game.backstage?.ready) out.push({ key: 'go', move: { kind: 'go' }, delayMs: delay('go') + think });
        return out;
      }

      if (view.phase === 'answer') {
        if (me.role === 'presenter') {
          const said = me.lines.length;
          if (said === 0) {
            if (me.script) out.push({ key: `say:${at}`, move: { kind: 'say', utterance: { via, text: me.script.text } }, delayMs: delay('say') });
            else if (me.ready.length && r('read?') < readChance) {
              const line = pickOf(me.ready, r('ready'))!;
              out.push(opts.quiet ? { key: `ready:${at}`, move: { kind: 'ready', key: line.key }, delayMs: delay('say') } : { key: `say:${at}`, move: { kind: 'say', utterance: { via: 'speech', text: line.text } }, delayMs: delay('say') });
            } else if (me.word) out.push({ key: `say:${at}`, move: { kind: 'say', utterance: { via, text: `これは ${me.word.kana} です。` } }, delayMs: delay('say') });
          } else if (said === 1 && me.ready.length > 1 && r('two?') < 0.6) {
            out.push({ key: `say2:${at}`, move: { kind: 'say', utterance: { via, text: me.ready[1]!.text } }, delayMs: delay('say2') + think });
          } else if (me.canNext) out.push({ key: `next:${at}`, move: { kind: 'next' }, delayMs: delay('next') + think });
          return out;
        }
        if (me.role === 'assistant') {
          if (me.choices.length && !me.picked) {
            if (me.mishaps.length && r('mishap?') < mishapChance) out.push({ key: `pick:${at}`, move: { kind: 'pick', mishapId: pickOf(me.mishaps, r('which'))!.id }, delayMs: delay('pick') });
            else out.push({ key: `pick:${at}`, move: { kind: 'pick', slideId: pickOf(me.choices, r('slide'))!.id }, delayMs: delay('pick') });
          }
          if (me.cueCards.length && r('kanpe?') < 0.3) out.push({ key: `kanpe:${at}`, move: { kind: 'kanpe', key: pickOf(me.cueCards, r('cue'))!.key }, delayMs: delay('kanpe') + think });
          return out;
        }
        if (r('stamp?') < 0.7) out.push({ key: `stamp:${at}`, move: { kind: 'stamp', stamp: game.slide?.kind === 'close' ? 'hakushu' : pickOf(STAMPS, r('stamp'))! }, delayMs: delay('stamp') });
        return out;
      }

      if (view.phase === 'encore') {
        if (me.role === 'presenter') {
          // Chōchin-san's card first: a bot knows the Japanese behind the English (a player recalls it, or peeks).
          const topic = me.haveYou ? haveYouOf(me.haveYou.id) : undefined;
          if (me.haveYou && topic) {
            if (me.lines.length) return out;
            const card = haveYouCard(topic, me.level);
            const peek = r(`peek?:${topic.id}`) < peekChance;
            if (peek && !me.haveYou.peek) out.push({ key: 'peek', move: { kind: 'peek' }, delayMs: delay('peek') });
            out.push({ key: 'have-you', move: { kind: 'say', utterance: { via, text: (r(`yes?:${topic.id}`) < 0.5 ? card.yes : card.no).kana } }, delayMs: delay('have-you') + think });
            return out;
          }
          if (me.pickQuestion.length) out.push({ key: 'choose', move: { kind: 'choose', playerId: pickOf(me.pickQuestion, r('choose'))!.playerId }, delayMs: delay('choose') + think });
          else if (me.answerFrames.length && !me.lines.length) out.push({ key: 'answer', move: { kind: 'say', utterance: { via, text: 'いい しつもんですね。おいしい から です。' } }, delayMs: delay('answer') });
          return out;
        }
        if (me.questions.length && !me.asked) {
          const q = pickOf(me.questions, r('q'))!;
          out.push({ key: 'ask', move: r('aloud?') < 0.6 && !opts.quiet ? { kind: 'ask', key: q.key, utterance: { via: 'speech', text: q.text } } : { kind: 'ask', key: q.key }, delayMs: delay('ask') });
        }
        if (game.question?.answered && r('clap?') < 0.8) out.push({ key: 'clap', move: { kind: 'stamp', stamp: 'hakushu' }, delayMs: delay('clap') });
        return out;
      }

      if (view.phase === 'reveal' && me.canGrade) {
        const n = r('grade') < 0.5 ? 3 : r('grade2') < 0.7 ? 2 : 1;
        return [{ key: 'grade', move: { kind: 'grade', n }, delayMs: delay('grade') }];
      }

      if (view.phase === 'finale' && me.canVote && game.vote) {
        const pick = pickOf(
          game.vote.talks.filter((t) => t.presenterId !== playerId),
          r('vote'),
        );
        if (pick) return [{ key: 'vote', move: { kind: 'vote', talk: pick.index }, delayMs: delay('vote') }];
      }
      return [];
    },
  };
}
