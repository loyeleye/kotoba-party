// How a bot plays Word Gauntlet: writes silly fakes, guesses, echoes its telephone step,
// and plays shiritori from the topic packs' nouns until its (seat-based) nerve runs out.

import type { ContentLibrary } from '../../../shared/src/modes/mode.js';
import { lexiconFor, type WordGauntletView } from '../../../shared/src/modes/wordGauntlet/wordGauntlet.js';
import { follows, repeatKey } from '../../../shared/src/modes/wordGauntlet/shiritori.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import type { ModePolicy } from '../bot.js';

const FAKE_ENDINGS = ['a soup for sad ghosts', 'a hat that sneezes', 'dancing badly at weddings', 'a polite fight between cats', 'the noise a fridge makes at 3 am', 'losing one sock'];

export interface WordGauntletPolicyOptions {
  /** Think time before each move. */
  delayMs?: number;
  /** A bot stops answering in shiritori once the chain is this long plus 3 × its seat. */
  nerve?: number;
  /** At this chain length the bot on turn tries a made-up word, so the room has to judge it. */
  bluffAt?: number;
}

export function wordGauntletPolicy(content: ContentLibrary, opts: WordGauntletPolicyOptions = {}): ModePolicy {
  const nouns = lexiconFor(content).nouns;
  const delayMs = opts.delayMs ?? 30;
  const nerve = opts.nerve ?? 6;
  const bluffAt = opts.bluffAt ?? 3;

  return {
    act(view: RoomView, playerId: string) {
      const game = view.game as WordGauntletView | null;
      if (!game || game.mode !== 'word-gauntlet') return [];
      const seat = view.players.find((p) => p.id === playerId)?.seat ?? 1;
      const out: { key: string; move: unknown; delayMs?: number }[] = [];
      const later = (n = 1) => delayMs * n + seat * 3;

      const f = game.fake;
      if (f?.mine) {
        if (view.phase === 'answer' && !f.mine.fake) {
          out.push({ key: 'fake', move: { kind: 'fake', text: FAKE_ENDINGS[(seat + f.index) % FAKE_ENDINGS.length]! }, delayMs: later() });
        }
        if (view.phase === 'reveal' && !f.mine.pick && f.options) {
          const options = f.options.filter((o) => o.id !== f.mine!.optionId);
          const pick = options[(seat * 7 + f.index) % options.length];
          if (pick) out.push({ key: 'pick', move: { kind: 'pick', optionId: pick.id }, delayMs: later() });
        }
        if (view.phase === 'score' && !f.mine.said && f.golden) {
          out.push({ key: 'say', move: { kind: 'say', utterance: { via: seat % 2 ? 'typed' : 'speech', text: f.golden.jp.kana } }, delayMs: later() });
        }
      }

      const t = game.telephone;
      if (t?.mine) {
        const prev = t.mine.prev;
        if (view.phase === 'answer' && prev && !t.mine.sent) {
          const move =
            t.mine.to === 'en'
              ? { kind: 'step', utterance: { via: 'typed', text: `Maybe: ${prev.text}` } }
              : { kind: 'step', utterance: { via: seat % 2 ? 'typed' : 'speech', text: `ええと、${prev.text}` } };
          out.push({ key: 'step', move, delayMs: later() });
        }
        if (view.phase === 'reveal' && t.reveal && t.mine.vote === null) {
          const options = t.reveal.steps.filter((st) => st.text !== null && st.playerId !== playerId);
          const pick = options[(seat * 5) % Math.max(1, options.length)];
          if (pick) out.push({ key: 'vote', move: { kind: 'vote', step: pick.index }, delayMs: later() });
        }
      }

      const sh = game.shiritori;
      if (sh?.mine) {
        if (view.phase === 'answer' && sh.turn === playerId) {
          const length = sh.chain.length;
          if (length === bluffAt) {
            out.push({ key: 'word', move: { kind: 'word', utterance: { via: 'speech', text: `${sh.need}ぽぽぺ` } }, delayMs: later() });
          } else if (length < nerve + seat * 3) {
            const used = new Set(sh.chain.map((w) => repeatKey(w.reading)));
            const fits = nouns.filter((n) => follows(sh.need, n.kana) && !used.has(repeatKey(n.kana)));
            const word = fits[(seat + length) % Math.max(1, fits.length)];
            if (word) out.push({ key: 'word', move: { kind: 'word', utterance: { via: seat % 2 ? 'speech' : 'typed', text: word.kana } }, delayMs: later() });
            else if (sh.mine.tokens > 0 && !sh.mine.hint) out.push({ key: 'hint', move: { kind: 'hint' }, delayMs: later() });
          }
          // Otherwise the bot freezes and its turn times out.
        }
        if (view.phase === 'reveal' && sh.challenge && sh.challenge.voters.includes(playerId) && sh.mine.vote === null) {
          out.push({ key: 'judge', move: { kind: 'judge', accept: seat % 2 === 0 }, delayMs: later() });
        }
      }
      return out;
    },
  };
}
