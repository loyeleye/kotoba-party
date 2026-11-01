// How bots play Bento Haus: as a kitchen that talks. An order-taker bot calls each thing the customer
// wants (working out round 2's riddles), now and then fluffing a call into radio static; a station bot
// reads each ticket back and sends it; the order-taker tosses anything that doesn't belong and serves
// the box once it matches. Repeatable: every choice hashes the bot's id with what it's about.

import type { BentoView } from '../../../shared/src/modes/bentoHaus/bentoHaus.js';
import { compareBox } from '../../../shared/src/modes/bentoHaus/bentoHaus.js';
import { countWord, foodOf, RIDDLES } from '../../../shared/src/modes/bentoHaus/menu.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import type { ModePolicy } from '../bot.js';

export interface BentoPolicyOptions {
  /** Chance a call comes out as static (nothing on the menu heard). */
  fluffChance?: number;
  /** Chance a station reads a ticket back before sending it. */
  readbackChance?: number;
  /** Type instead of speak (quiet mode). */
  quiet?: boolean;
  thinkMs?: number;
  /** An N4 bot takes the hard roles it's offered and says each line Pon's way (the path simulation, tools/sim). */
  hardRoles?: boolean;
}

function hash(...parts: (string | number)[]): number {
  let h = 2166136261;
  for (const ch of parts.join('|')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
}

const riddleFood = (riddle: string): string | undefined => Object.keys(RIDDLES).find((id) => RIDDLES[id] === riddle);

export function bentoHausPolicy(opts: BentoPolicyOptions = {}): ModePolicy {
  const fluff = opts.fluffChance ?? 0.12;
  const readback = opts.readbackChance ?? 0.7;
  const think = opts.thinkMs ?? 900;
  const via = opts.quiet ? 'typed' : 'speech';
  return {
    act(view: RoomView, playerId: string) {
      const game = view.game as BentoView | null;
      if (!game || (game.mode !== 'bento-haus' && game.mode !== 'bento-haus-vs') || !game.me || view.phase !== 'answer') return [];
      const me = game.me;
      const out: { key: string; move: unknown; delayMs?: number }[] = [];
      const delay = (what: string, extra = 0) => Math.floor(think * (0.5 + hash(playerId, what, 'delay')) + extra);

      // N4 hard roles: take the offer, say the deputy manager's and the おもてなし lines, and see to requests.
      if (opts.hardRoles && me.hard) {
        const hr = me.hard;
        if (hr.offer) out.push({ key: `role:${hr.offer.role}`, move: { kind: 'role', accept: true }, delayMs: delay('role') });
        for (const d of hr.desk) {
          const step = d.steps[d.step];
          if (step && !step.ok && !step.skipped) out.push({ key: `mgr:${d.id}:${d.step}`, move: { kind: 'manager', incidentId: d.id, utterance: { via, text: step.model.kana } }, delayMs: delay(`mgr${d.id}${d.step}`) });
        }
        for (const [visitId, g] of Object.entries(hr.guests)) {
          const step = g.steps[g.step];
          if (step && !step.ok && !step.skipped) out.push({ key: `omo:${visitId}:${g.step}`, move: { kind: 'omotenashi', visitId, utterance: { via, text: step.model.kana } }, delayMs: delay(`omo${visitId}${g.step}`) });
        }
        for (const q of hr.requests) out.push({ key: `req:${q.incidentId}`, move: { kind: 'request-done', incidentId: q.incidentId }, delayMs: delay(`req${q.incidentId}`) });
      }

      // Stations: read back, then send; ask again when the number didn't come through.
      for (const t of me.tickets) {
        if (t.state !== 'open' || !t.foodId) continue;
        if (t.n === null) {
          if (!t.asked) out.push({ key: `ask:${t.id}`, move: { kind: 'ask', ticketId: t.id, utterance: { via, text: 'いくつですか？' } }, delayMs: delay(`ask${t.id}`) });
          continue;
        }
        const f = foodOf(t.foodId)!;
        const rb = hash(playerId, t.id, 'rb') < readback;
        if (rb && !t.readback) out.push({ key: `rb:${t.id}`, move: { kind: 'readback', ticketId: t.id, utterance: { via, text: `はい、${f.kana} ${t.reading}ですね！` } }, delayMs: delay(`rb${t.id}`) });
        out.push({ key: `send:${t.id}`, move: { kind: 'send', ticketId: t.id }, delayMs: delay(`send${t.id}`, rb ? think : 0) });
      }

      // Order-takers: call what's missing, toss what doesn't belong, serve when it matches.
      for (const o of me.taking) {
        // VS: a sent-back order on offer. Take it on more often than not.
        if (o.offer) {
          const kind = hash(playerId, o.visitId, 'offer') < 0.65 ? 'accept' : 'refuse';
          out.push({ key: `${kind}:${o.visitId}`, move: { kind, visitId: o.visitId }, delayMs: delay(`offer${o.visitId}`, think) });
          continue;
        }
        const visit = game.visits.find((v) => v.id === o.visitId);
        if (!visit) continue;
        const lines = o.lines.map((l) => ({ foodId: l.foodId ?? riddleFood(l.riddle ?? '') ?? '', n: l.n, riddle: false })).filter((l) => l.foodId);
        const box: Record<string, number> = Object.fromEntries(visit.box.map((b) => [b.foodId, b.n]));
        const off = compareBox(lines, box);
        if (!off.length) {
          out.push({ key: `serve:${o.visitId}`, move: { kind: 'serve', visitId: o.visitId, utterance: { via, text: 'おまたせしました！' } }, delayMs: delay(`serve${o.visitId}`) });
          continue;
        }
        const pending = new Set(me.calls.filter((c) => c.state === 'open' && c.foodId && c.n !== null).map((c) => c.foodId));
        for (const x of off) {
          if (x.how === 'extra' || x.how === 'many') {
            out.push({ key: `toss:${o.visitId}:${x.foodId}:${box[x.foodId]}`, move: { kind: 'toss', visitId: o.visitId, foodId: x.foodId }, delayMs: delay(`toss${x.foodId}`) });
            continue;
          }
          if (pending.has(x.foodId)) continue;
          const want = lines.find((l) => l.foodId === x.foodId)!.n - (box[x.foodId] ?? 0);
          const f = foodOf(x.foodId)!;
          const attempt = `${o.visitId}:${x.foodId}:${box[x.foodId] ?? 0}`;
          const text = hash(playerId, attempt, 'fluff') < fluff ? 'えっと… あれ…' : `${f.kana} ${countWord(f, want, game.ownCounter)}、おねがいします！`;
          out.push({ key: `call:${attempt}`, move: { kind: 'call', utterance: { via, text } }, delayMs: delay(`call${attempt}`) });
          // A fluffed call is tried again, said properly, a moment later.
          if (text.startsWith('えっと')) out.push({ key: `call2:${attempt}`, move: { kind: 'call', utterance: { via, text: `${f.kana} ${countWord(f, want, game.ownCounter)}、おねがいします！` } }, delayMs: delay(`call2${attempt}`, think * 2) });
        }
      }
      return out;
    },
  };
}
