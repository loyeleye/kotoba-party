// How a bot plays Katsuyō Raid (the Green Car Kana Yōkai Raid): says the right form with a set chance (a
// sibling form otherwise, so tips and retries get exercised), taps a badge by "hearing" the form, builds Wave 3
// chunks from Fude's model with a noun of its own from a list (so a new noun is a new filler), writes kanji by
// "hand" from the stroke references, and says the boss line from its gist. It works only from its own view and
// the public deck, like a phone with a memory, so `sim:limited` can measure what the raid yields.

import { BADGE_BY_ID, KATSUYO_VERBS, type BadgeId, type KatsuyoVerb } from '../../../content/src/katsuyo/verbs.js';
import { KATSUYO_BOSS_LINES, KATSUYO_CHUNKS } from '../../../content/src/katsuyo/lines.js';
import { kanjiStrokes } from '../../../content/src/kanji/strokes.js';
import { writeKanji } from '../../../content/src/kanji/kanji.js';
import { normalizeReading } from '../../../shared/src/japanese/kana.js';
import { formVariants } from '../../../shared/src/modes/kanaRaid/katsuyoCheck.js';
import type { KatsuyoAttackView, KatsuyoRaidView } from '../../../shared/src/modes/kanaRaid/katsuyoRaid.js';
import type { RoomView } from '../../../shared/src/protocol.js';
import type { ModePolicy } from '../bot.js';
import { handDraw, scribble } from '../ink.js';

export interface KatsuyoRaidPolicyOptions {
  /** Share of answers the bot gets right (default 0.8). */
  accuracy?: number;
  /** Share of answers spoken rather than typed or tapped (default 0.8). */
  speak?: number;
  /** Share of chunks said with a noun of the bot's own instead of Fude's (default 0.6). */
  ownWord?: number;
  minDelayMs?: number;
  maxDelayMs?: number;
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

function seeded(text: string): () => number {
  let s = Math.floor(hash(text) * 2147483646) + 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

/** Nouns a bot swaps in for a chunk's first noun (kid-safe, so they pass any room). */
const NOUNS = ['かばん', 'ノート', 'ほん', 'えんぴつ', 'ケーキ', 'りんご', 'くつ', 'まど', 'テレビ', 'ゲーム', 'おにぎり', 'しゅくだい'];
/** Badges whose chunk survives a swapped first noun (the suffering passive needs its rain or its someone). */
const SWAPPABLE: ReadonlySet<BadgeId> = new Set(['potential', 'yasui-nikui', 'zu-ni', 'you-to-suru', 'ppanashi', 'kakeru', 'kiru', 'tate']);

const STROKES = new Map(kanjiStrokes.map((k) => [k.char, k.strokes]));

const verbOf = (kana: string | undefined): KatsuyoVerb | undefined => KATSUYO_VERBS.find((v) => v.verb.kana === kana);

/** The verb and badge a heard form belongs to (Wave 2), as a bot that knows its forms would work it out. */
function formOwner(heard: string): { verb: KatsuyoVerb; badge: BadgeId } | null {
  const h = normalizeReading(heard);
  for (const verb of KATSUYO_VERBS)
    for (const [badge, f] of Object.entries(verb.forms) as [BadgeId, { kana: string }][]) if (formVariants(badge, f.kana).includes(h)) return { verb, badge };
  return null;
}

/** A form in its past (or plain) shape, as people say it. */
function pastOf(badge: BadgeId, kana: string): string {
  const v = formVariants(badge, kana);
  return v.find((x) => x.endsWith('た')) ?? v[0] ?? kana;
}

export function katsuyoRaidPolicy(opts: KatsuyoRaidPolicyOptions = {}): ModePolicy {
  const accuracy = opts.accuracy ?? 0.8;
  const speakShare = opts.speak ?? 0.8;
  const ownShare = opts.ownWord ?? 0.6;
  const lo = opts.minDelayMs ?? 600;
  const hi = opts.maxDelayMs ?? 1800;
  return {
    act(view: RoomView, playerId: string) {
      const game = view.game as KatsuyoRaidView | null;
      if (!game || game.mode !== 'kana-raid' || game.variant !== 'katsuyo' || !game.me) return [];
      const delay = (key: string) => Math.round(lo + hash(`${playerId}:${key}`) * (hi - lo));

      if (view.phase === 'intro') {
        if (game.me.ready) return [];
        const moves: { key: string; move: unknown; delayMs: number }[] = [];
        // Some N4 bots tick a couple of N3 badges as stretch.
        if (game.me.level === 'n4' && hash(`${playerId}:stretch`) < 0.5) moves.push({ key: 'badges', move: { kind: 'badges', badges: [...game.me.badges, 'zu-ni', 'tate'] }, delayMs: delay('badges') });
        moves.push({ key: 'ready', move: { kind: 'ready' }, delayMs: delay('badges') + 80 });
        return moves;
      }

      const a = game.me.attack;
      if (!a || (view.phase !== 'answer' && view.phase !== 'finale')) return [];
      const key = `${a.id}:${a.step ?? ''}`;
      const right = hash(key) < accuracy;
      const spoken = hash(`${key}:style`) < speakShare;
      const say = (text: string, via: 'speech' | 'typed' = spoken ? 'speech' : 'typed') => ({ kind: 'attack', attackId: a.id, say: { via, text } });
      const tap = (id: string | undefined) => ({ kind: 'attack', attackId: a.id, pick: id ?? a.options[0]?.id ?? '0' });
      const pass = { kind: 'attack', attackId: a.id, pass: true };

      // Waves 1–2: now and then pick a yōkai further back.
      if (game.me.canAim && !a.retry && hash(`${key}:aim`) < 0.2) {
        const mine = new Set(game.me.aimable);
        const here = game.horde.filter((y) => mine.has(y.id) && y.state === 'alive' && y.spawnAt <= game.at && y.escapeAt > game.at + 2_000 && y.id !== a.yokaiId);
        const pickY = here[Math.floor(hash(`${key}:which`) * here.length)];
        if (pickY) return [{ key: `${key}:aim`, move: { kind: 'aim', yokaiId: pickY.id }, delayMs: delay(`${key}:aim`) }];
      }

      const move = moveFor(a, right, spoken, say, tap, pass, key, ownShare);
      return move ? [{ key, move, delayMs: delay(key) }] : [];
    },
  };
}

function moveFor(
  a: KatsuyoAttackView,
  right: boolean,
  spoken: boolean,
  say: (text: string, via?: 'speech' | 'typed') => unknown,
  tap: (id: string | undefined) => unknown,
  pass: unknown,
  key: string,
  ownShare: number,
): unknown {
  switch (a.kind) {
    case 'form':
    case 'piece': {
      const v = verbOf(a.verb?.kana);
      const badge = a.badge?.id;
      const form = v && badge ? v.forms[badge] : undefined;
      if (!v || !badge || !form) return tap(undefined);
      const sibling = Object.entries(v.forms).find(([b]) => b !== badge)?.[1]?.kana ?? v.verb.kana;
      // Mostly said; a stretch badge is tapped more often.
      if (spoken && !(a.stretch && hash(`${key}:tapstretch`) < 0.4)) return say(right ? pastOf(badge, form.kana) : sibling);
      const good = a.options.find((o) => normalizeReading(o.label) === normalizeReading(form.kana))?.id;
      return tap(right ? good : a.options.find((o) => o.id !== good)?.id);
    }
    case 'badge': {
      const owner = formOwner(a.hear ?? '');
      if (a.step === 'tap') {
        const good = owner ? a.options.find((o) => o.label.endsWith(` ${BADGE_BY_ID[owner.badge].ja}`))?.id : undefined;
        return tap(right ? good : a.options.find((o) => o.id !== good)?.id);
      }
      if (!spoken && hash(`${key}:skip`) < 0.5) return pass;
      return say(right && owner ? owner.verb.verb.kana : 'えっと');
    }
    case 'chunk': {
      const c = KATSUYO_CHUNKS.find((x) => x.gist === a.gist && x.badge === a.badge?.id);
      if (!c) return pass;
      if (!right) return say(c.model.kana.split(' ').at(-1) ?? 'えっと');
      let text = c.model.kana;
      if (SWAPPABLE.has(c.badge) && hash(`${key}:own`) < ownShare) {
        const noun = NOUNS[Math.floor(hash(`${key}:noun`) * NOUNS.length)]!;
        text = text.replace(/^[ぁ-んァ-ヶー]+(?=(を|が|は|の) )/, noun);
      }
      return say(text);
    }
    case 'draw': {
      if (a.step === 'say') return spoken ? say(right ? (a.word?.kana ?? '') : 'えっと', 'speech') : pass;
      const k = writeKanji.find((x) => x.say.kana === a.write?.kana && (a.write?.blanked === '□' || x.say.text.replace(x.char, '□') === a.write?.blanked));
      const ref = k ? STROKES.get(k.char) : undefined;
      const random = seeded(key);
      const ink = right && ref ? handDraw(ref, random, { wobble: 0.015 }) : scribble(random);
      return { kind: 'attack', attackId: a.id, ink };
    }
    case 'blow': {
      const line = KATSUYO_BOSS_LINES.find((l) => l.gist === a.gist);
      if (!line) return pass;
      return say(right ? line.line.kana : 'えっと、わすれた');
    }
  }
}

/** The raid's policy: the kana raid's, or this one when the room rides in the Green Car. */
export function raidPolicy(kana: ModePolicy, katsuyo: ModePolicy = katsuyoRaidPolicy()): ModePolicy {
  return {
    act(view, playerId) {
      const game = view.game as { variant?: string } | null;
      return (game?.variant === 'katsuyo' ? katsuyo : kana).act(view, playerId);
    },
  };
}
