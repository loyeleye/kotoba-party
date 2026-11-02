// How a bot plays Word Gauntlet: writes silly fakes, guesses, echoes its telephone step, retells a rumour (at
// N4, in a reporting frame other than the one it heard), and plays shiritori from the topic packs' nouns until
// its (seat-based) nerve runs out.

import type { ContentLibrary } from '../../../shared/src/modes/mode.js';
import { lexiconFor, type WordGauntletView } from '../../../shared/src/modes/wordGauntlet/wordGauntlet.js';
import { follows, repeatKey } from '../../../shared/src/modes/wordGauntlet/shiritori.js';
import { RUMOUR_FINS, RUMOUR_SEEDS, addFin, finKept, keptParts, rumourFin, rumourFrameOf, rumourLine, type RumourFrameId } from '../../../shared/src/modes/wordGauntlet/rumours.js';
import { n4Up } from '../../../shared/src/level.js';
import { fillModel, modelsFor, SENTENCE_CARD_BY_FRAME, startsWithLink } from '../../../shared/src/modes/wordGauntlet/sentences.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import type { ModePolicy } from '../bot.js';

/** The reporting frames an N4 bot retells a rumour in: never the one it heard, so the retelling is its own. */
const RETELL: readonly RumourFrameId[] = ['sou-hear', 'ni-yoru', 'to-itte-ita', 'n-datte'];

/**
 * An N4 bot's retelling: the rumour it heard (who, where, what and every detail, all kept) with its fin added, passed on in a
 * reporting frame other than the one it heard, as a player does who isn't just saying it back. Null when the
 * heard line lost a part, so the bot falls back to echoing it.
 */
export function retell(subject: string, heard: { text: string; kana: string }, fin: string | null, pick: number): string | null {
  const seed = RUMOUR_SEEDS.find((sd) => sd.who.kana === subject && Object.values(keptParts(sd, heard.kana)).every(Boolean));
  if (!seed) return null;
  const was = rumourFrameOf({ text: heard.text, reading: heard.kana });
  const frames = RETELL.filter((f) => f !== was);
  // Keep every detail the rumour already carried (an earlier player's おひれ), then add this bot's own.
  const carried = RUMOUR_FINS.filter((f) => finKept(f, heard.kana));
  const added = fin ? rumourFin(fin) : undefined;
  return rumourLine(seed, added ? addFin(carried, added) : carried, frames[pick % frames.length]!).kana;
}

/** A repeatable pick for one retelling, so the frames vary from bot to bot and rumour to rumour. */
function pickOf(...parts: (string | number)[]): number {
  let h = 2166136261;
  for (const ch of parts.join('|')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

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

      const r = game.rumour;
      if (r?.mine) {
        const m = r.mine;
        if (view.phase === 'answer' && m.heard && !m.sent) {
          const fin = m.fins[seat % Math.max(1, m.fins.length)];
          if (!m.fin && !m.ownFin && fin) out.push({ key: `fin${r.current}`, move: { kind: 'fin', fin: fin.id }, delayMs: later() });
          else if (m.fin || m.ownFin) {
            const chosen = m.fins.find((f) => f.id === m.fin);
            const move =
              m.level === 'kana'
                ? { kind: 'relay', utterance: { via: 'speech', text: chosen?.tile ?? 'うわさ' } }
                : { kind: 'relay', utterance: { via: seat % 2 ? 'typed' : 'speech', text: (n4Up(m.level) && retell(r.subject.kana, m.heard, m.fin, pickOf(playerId, r.subject.kana, r.current))) || `${chosen?.kana ?? ''} ${m.heard.text}` } };
            out.push({ key: `relay${r.current}`, move, delayMs: later() });
          }
        }
        if (view.phase === 'reveal' && r.reveal && m.vote === null) {
          const options = r.reveal.steps.filter((st) => st.text !== null && st.playerId !== playerId);
          const pick = options[(seat * 5) % Math.max(1, options.length)];
          if (pick) out.push({ key: 'rvote', move: { kind: 'vote', step: pick.index }, delayMs: later() });
        }
      }

      // Sentence Shiritori (Green Car round 3): a model line of the card's frame, starting with the link word when it's
      // a noun the bot knows, else a noun on the link kana. An N4 bot takes the N3 stretch card every other turn.
      const st = game.sentences;
      if (st?.mine) {
        const m = st.mine;
        if (view.phase === 'answer' && st.turn === playerId && (m.card || m.stretch)) {
          const useStretch = !!m.stretch && (seat + st.current) % 2 === 0;
          const card = SENTENCE_CARD_BY_FRAME[(useStretch ? m.stretch : m.card)!.frame];
          const models = card ? modelsFor(card, view.audience) : [];
          const model = models[(seat + st.current) % Math.max(1, models.length)];
          const said = st.chain.map((c) => c.text).join(' ');
          const link = st.link;
          const noun = (link.word && nouns.find((n) => n.kana === link.word)) || nouns.filter((n) => follows(link.kana, n.kana) && !said.includes(n.kana))[(seat + st.current) % 7];
          if (model && noun) {
            const line = fillModel(model, noun).text;
            if (startsWithLink(line, link)) out.push({ key: `sentence${st.current}`, move: { kind: 'sentence', utterance: { via: 'speech', text: line } }, delayMs: later() });
          }
        }
        if (view.phase === 'reveal' && m.vote === null) {
          const options = st.chain.map((c, i) => ({ c, i })).filter(({ c }) => c.playerId && c.playerId !== playerId);
          const pick = options[(seat * 5) % Math.max(1, options.length)];
          if (pick) out.push({ key: 'svote', move: { kind: 'vote', step: pick.i }, delayMs: later() });
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
