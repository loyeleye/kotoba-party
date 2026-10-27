// The written line bank: the host's voice when the LLM is slow, over budget, or off. Lines come from the content
// thread (content/src/hosts/), keyed by host, event and tier. Picking avoids repeating a line within a game.

import { nameToKana } from './kana.js';
import type { BankLine, HostEvent, HostId, JpText, ReactionTier } from './types.js';

export interface SlotValue {
  /** As shown in text and subtitles. */
  text: string;
  /** As voiced. */
  kana?: string;
}

export type Slots = Record<string, string | SlotValue>;

export interface PickedLine extends JpText {
  id: string;
}

/**
 * Fills {slot} markers. A slot without a kana reading is voiced as nameToKana guesses it. Plain string slots
 * may come with `{key}_kana` and `{key}_en` siblings for the voiced and subtitle forms.
 */
export function fillSlots(jp: JpText, slots: Slots = {}): JpText {
  const sub = (s: string, field: 'text' | 'kana' | 'en') =>
    s.replace(/\{(\w+)\}/g, (all, key: string, at: number) => {
      const v = slots[key];
      if (v === undefined) return all;
      const sibling = field === 'text' ? undefined : slots[`${key}_${field}`];
      if (typeof sibling === 'string') return field === 'en' ? capitalizeAtStart(sibling, s, at) : sibling;
      const text = typeof v === 'string' ? v : v.text;
      if (field !== 'kana') return text;
      return typeof v === 'string' ? nameToKana(v) : (v.kana ?? nameToKana(v.text));
    });
  return { text: sub(jp.text, 'text'), kana: sub(jp.kana, 'kana'), en: sub(jp.en, 'en') };
}

/** An English gloss that opens a sentence ("{tile} wins!") starts with a capital: "An octopus wins!". */
export function capitalizeAtStart(value: string, line: string, at: number): string {
  return /^\W*$|[.!?…]\s+$/.test(line.slice(0, at)) ? value.replace(/^(\W*)([a-z])/, (_, pre: string, c: string) => pre + c.toUpperCase()) : value;
}

/** '{name}' or 'name' → 'name'. */
export const slotName = (s: string): string => s.replace(/^\{|\}$/g, '');

export class LineBank {
  private readonly byKey = new Map<string, BankLine[]>();
  private readonly used = new Set<string>();

  constructor(
    readonly lines: readonly BankLine[],
    private readonly random: () => number = Math.random,
  ) {
    for (const l of lines) {
      const k = LineBank.key(l.host, l.event, l.tier);
      let list = this.byKey.get(k);
      if (!list) this.byKey.set(k, (list = []));
      list.push(l);
    }
  }

  private static key(host: HostId, event: HostEvent, tier?: ReactionTier): string {
    return `${host}|${event}|${tier ?? ''}`;
  }

  /** Lines for this host and event; an exact tier match first, then untiered lines for the event. */
  candidates(host: HostId, event: HostEvent, tier?: ReactionTier): BankLine[] {
    const exact = this.byKey.get(LineBank.key(host, event, tier)) ?? [];
    if (exact.length || !tier) return exact;
    return this.byKey.get(LineBank.key(host, event)) ?? [];
  }

  /**
   * A line nobody has heard this game, if there is one; otherwise any. Lines whose slots aren't all supplied
   * are skipped. Undefined only when the bank has nothing for this host and event.
   */
  pick(host: HostId, event: HostEvent, tier?: ReactionTier, slots: Slots = {}): (PickedLine & { line: BankLine }) | undefined {
    let usable = this.candidates(host, event, tier).filter((l) => (l.slots ?? []).every((s) => slotName(s) in slots));
    // When the cue names the answer ({tile}), lines that react to it beat the ones that could follow anything.
    if ('tile' in slots) {
      const named = usable.filter((l) => (l.slots ?? []).some((s) => slotName(s) === 'tile'));
      if (named.length) usable = named;
    }
    if (!usable.length) return undefined;
    const fresh = usable.filter((l) => !this.used.has(l.id));
    const pool = fresh.length ? fresh : usable;
    const line = pool[Math.floor(this.random() * pool.length)] ?? pool[0]!;
    this.used.add(line.id);
    return { id: line.id, ...fillSlots(line.jp, slots), line };
  }

  /** A new game: every line is fresh again. */
  reset(): void {
    this.used.clear();
  }
}

/** A tiny bank so the pipeline always has something to say before the content thread's lines land. */
export const STARTER_LINES: BankLine[] = [
  { id: 'pon.reveal_react.flop.starter', host: 'pon', event: 'reveal_react', tier: 'flop', jp: { text: 'えっ、それ？', kana: 'えっ、それ？', en: 'Wait, that?' } },
  { id: 'pon.reveal_react.good.starter', host: 'pon', event: 'reveal_react', tier: 'good', jp: { text: 'いいね！ざぶとん一まい！', kana: 'いいね！ざぶとんいちまい！', en: 'Nice! One cushion!' } },
  { id: 'pon.reveal_react.ippon.starter', host: 'pon', event: 'reveal_react', tier: 'ippon', jp: { text: 'いっぽん！すごい！', kana: 'いっぽん！すごい！', en: 'IPPON! Amazing!' } },
  { id: 'pon.prompt_read.starter', host: 'pon', event: 'prompt_read', jp: { text: 'さあ、こたえて！', kana: 'さあ、こたえて！', en: 'Come on, answer!' } },
  { id: 'chochin.train_stop.starter', host: 'chochin', event: 'train_stop', jp: { text: 'つぎは…しゅうてん、かも。', kana: 'つぎは…しゅうてん、かも。', en: 'Next stop... maybe the last.' } },
  { id: 'chochin.reveal_react.good.starter', host: 'chochin', event: 'reveal_react', tier: 'good', jp: { text: 'おみごと！', kana: 'おみごと！', en: 'Splendid!' } },
  { id: 'chochin.reveal_react.flop.starter', host: 'chochin', event: 'reveal_react', tier: 'flop', jp: { text: 'おや、おや…', kana: 'おや、おや…', en: 'Oh dear, oh dear...' } },
  { id: 'fude.raid_combo.starter', host: 'fude', event: 'raid_combo', jp: { text: 'コンボ！いけいけ！', kana: 'コンボ！いけいけ！', en: 'Combo! Go go!' } },
  { id: 'fude.reveal_react.good.starter', host: 'fude', event: 'reveal_react', tier: 'good', jp: { text: 'やった！', kana: 'やった！', en: 'Yes!' } },
  { id: 'fude.reveal_react.flop.starter', host: 'fude', event: 'reveal_react', tier: 'flop', jp: { text: 'おしい！', kana: 'おしい！', en: 'So close!' } },
];
