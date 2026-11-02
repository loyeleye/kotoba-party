// Sentence Shiritori (ぶんしょう しりとり): Word Gauntlet's round 3 in the Green Car (design: project files
// n3-coverage/green-car/design.md, "Game by game"). Each sentence starts with the last word (or the last kana) of
// the sentence before, and must carry the frame on the speaker's dealt card: ＿たびに, ＿うちに, ＿っぽい,
// ＿なんて, ＿らしい (N3) or ＿ために, ＿ように, ＿られた, ＿そう, ＿と おもう, ＿と いって いた (N4).
//
// Every card is a frame some path goal requires (shared/src/path.ts GOALS `need`), so aiming the deal at it can
// move a stamp. Each card has model lines for every audience with {x} where the link word goes: the hint fills it
// with a noun that can follow the chain, and the bots say them. All Japanese here is draft until the fluent check.

import type { ReviewStatus } from '../../../../content/src/types.js';
import type { FrameId } from '../../japanese/frames.js';
import type { Audience } from '../../protocol.js';
import { follows, lastKana, startOptions, wordReading } from './shiritori.js';

export const SENTENCE_STATUS: ReviewStatus = 'draft';

/** A model line with {x} for the link word (a noun): kana-first, spaced. */
export interface SentenceModel {
  text: string;
  /** English, with {x} for the noun's English. */
  en: string;
  /** Kids rooms deal only lines marked for Kids; Family adds Family; Cheeky adds Cheeky. */
  audience: Audience;
}

export interface SentenceCard {
  /** Also the frame id it asks for. */
  frame: FrameId;
  level: 'n4' | 'n3';
  /** The goal whose required frame this is. */
  goal: string;
  /** The card face: the frame with ＿, and what it says. */
  ja: string;
  en: string;
  models: readonly SentenceModel[];
}

const m = (text: string, en: string, audience: Audience = 'kids'): SentenceModel => ({ text, en, audience });

/** The cards, N3 first. Every frame has models for every audience (Kids lines play everywhere). */
export const SENTENCE_CARDS: readonly SentenceCard[] = [
  {
    frame: 'tabi-ni',
    level: 'n3',
    goal: '3.9',
    ja: '＿たびに',
    en: 'every time ___',
    models: [
      m('{x}の ことを かんがえる たびに、 おなかが すく。', 'Every time I think about {x}, I get hungry.'),
      m('{x}を みる たびに、 わらって しまう。', 'Every time I see {x}, I can’t help laughing.'),
      m('{x}の はなしを きく たびに、 ねむく なる。', 'Every time I hear about {x}, I get sleepy.', 'family'),
      m('{x}の はなしを きく たびに、 のみに いきたく なる。', 'Every time I hear about {x}, I want to go for a drink.', 'cheeky'),
    ],
  },
  {
    frame: 'uchi-ni',
    level: 'n3',
    goal: '3.9',
    ja: '＿うちに',
    en: 'while ___ (before it changes)',
    models: [
      m('{x}の ことを わすれない うちに、 ノートに かいて おこう。', 'Before I forget about {x}, I’ll write it in my notebook.'),
      m('{x}が みつからない うちに、 はやく かくそう。', 'Let’s hide {x}, quick, while nobody has found it.'),
      m('{x}が やすい うちに、 たくさん かって おこう。', 'While {x} is cheap, let’s buy lots.', 'family'),
      m('{x}の ことが ばれない うちに、 にげよう。', 'Let’s run before anyone finds out about {x}.', 'cheeky'),
    ],
  },
  {
    frame: 'ppoi',
    level: 'n3',
    goal: '3.11',
    ja: '＿っぽい',
    en: '___-ish, kind of like ___',
    models: [
      m('{x}は ちょっと おばけっぽい。', '{x} is a bit ghost-like.'),
      m('{x}は なんだか こどもっぽい。', '{x} is kind of childish.'),
      m('{x}は なんだか おとなっぽい。', '{x} feels kind of grown-up.', 'family'),
      m('{x}は ちょっと おじさんっぽい。', '{x} is a bit middle-aged-man-ish.', 'cheeky'),
    ],
  },
  {
    frame: 'nante',
    level: 'n3',
    goal: '3.11',
    ja: '＿なんて',
    en: 'something like ___ (brushing it off)',
    models: [
      m('{x}なんて、 ぜんぜん こわくないよ。', '{x}? Not scary at all.'),
      m('{x}なんて、 もう いらない！', '{x}? I don’t need it any more!'),
      m('{x}なんて、 はじめて ききました。', 'I’ve never even heard of {x}.', 'family'),
      m('{x}なんて、 のみかいで いう ことじゃ ない。', 'You don’t bring up {x} at a drinking party.', 'cheeky'),
    ],
  },
  {
    frame: 'rashii',
    level: 'n3',
    goal: '3.1',
    ja: '＿らしい',
    en: 'apparently ___ (I heard)',
    models: [
      m('{x}は よるに なると うごく らしい。', 'Apparently {x} moves around at night.'),
      m('{x}は カッパの たからものだった らしい。', 'Apparently {x} was a kappa’s treasure.'),
      m('{x}は ことし にんきが ある らしい。', 'Apparently {x} is popular this year.', 'family'),
      m('{x}は ぶちょうが ひみつで あつめて いる らしい。', 'Apparently the boss secretly collects {x}.', 'cheeky'),
    ],
  },
  {
    frame: 'tame-ni',
    level: 'n4',
    goal: '4.14',
    ja: '＿ために',
    en: 'in order to ___',
    models: [
      m('{x}を かう ために、 おこづかいを ためて いる。', 'I’m saving my pocket money to buy {x}.'),
      m('{x}を みる ために、 はやく おきた。', 'I got up early to see {x}.'),
      m('{x}を かう ために、 まいにち はたらいて いる。', 'I work every day to buy {x}.', 'family'),
      m('{x}を わすれる ために、 カラオケで うたった。', 'I sang at karaoke to forget about {x}.', 'cheeky'),
    ],
  },
  {
    frame: 'you-ni',
    level: 'n4',
    goal: '4.14',
    ja: '＿ように',
    en: 'so that ___',
    models: [
      m('{x}を わすれない ように、 てに かいた。', 'I wrote it on my hand so I wouldn’t forget {x}.'),
      m('{x}が こわれない ように、 そっと はこんだ。', 'I carried {x} gently so it wouldn’t break.'),
      m('{x}に まにあう ように、 タクシーで いった。', 'I went by taxi to be in time for {x}.', 'family'),
      m('{x}が ばれない ように、 スマホを かくした。', 'I hid my phone so {x} wouldn’t come out.', 'cheeky'),
    ],
  },
  {
    frame: 'passive',
    level: 'n4',
    goal: '4.13',
    ja: '＿に ＿られた',
    en: 'I was ___ by ___ (the passive)',
    models: [
      m('{x}に わらわれた ゆめを みた。', 'I dreamed I was laughed at by {x}.'),
      m('{x}に おやつを たべられた。', 'My snack was eaten by {x}.'),
      m('{x}に しゃしんを とられた。', 'I had my photo taken by {x}.', 'family'),
      m('{x}の ことで ぶちょうに おこられた。', 'I got told off by the boss about {x}.', 'cheeky'),
    ],
  },
  {
    frame: 'sou-look',
    level: 'n4',
    goal: '4.6',
    ja: '＿そう',
    en: 'it looks ___',
    models: [
      m('{x}は とても おいしそうです。', '{x} looks really tasty.'),
      m('{x}は ちょっと おもそうだね。', '{x} looks a bit heavy.'),
      m('{x}は たかそうですね。', '{x} looks expensive.', 'family'),
      m('{x}は ちょっと あやしそうだね。', '{x} looks a bit fishy.', 'cheeky'),
    ],
  },
  {
    frame: 'to-omou',
    level: 'n4',
    goal: '4.6',
    ja: '＿と おもう',
    en: 'I think ___',
    models: [
      m('{x}は きっと おばけが すきだと おもう。', 'I think {x} must like ghosts.'),
      m('{x}は あしたも ここに あると おもう。', 'I think {x} will still be here tomorrow.'),
      m('{x}は ことし はやると おもいます。', 'I think {x} will catch on this year.', 'family'),
      m('{x}は デートには むかないと おもう。', 'I don’t think {x} is good for a date.', 'cheeky'),
    ],
  },
  {
    frame: 'to-itte-ita',
    level: 'n4',
    goal: '4.14',
    ja: '＿と いって いた',
    en: '(someone) said that ___',
    models: [
      m('{x}の ことを、 せんせいは だいじだと いって いた。', 'The teacher said {x} is important.'),
      m('{x}の ことを、 いもうとは すきだと いって いた。', 'My little sister said she likes {x}.'),
      m('{x}の ことを、 ちちは たかいと いって いました。', 'My dad said {x} is expensive.', 'family'),
      m('{x}の ことを、 ぶちょうは もう いやだと いって いた。', 'The boss said he’s sick of {x}.', 'cheeky'),
    ],
  },
];

export const SENTENCE_CARD_BY_FRAME: Readonly<Record<string, SentenceCard>> = Object.fromEntries(SENTENCE_CARDS.map((c) => [c.frame, c]));

/** The model lines an audience may see: Kids lines everywhere, Family's in Family and Cheeky, Cheeky's in Cheeky. */
export function modelsFor(card: SentenceCard, audience: Audience): SentenceModel[] {
  const ok: Record<Audience, readonly Audience[]> = { kids: ['kids'], family: ['kids', 'family'], cheeky: ['kids', 'family', 'cheeky'] };
  return card.models.filter((x) => ok[audience].includes(x.audience));
}

/** A model line filled in with a noun (kana) and its English. */
export function fillModel(model: SentenceModel, noun: { kana: string; en: string }): { text: string; en: string } {
  return { text: model.text.replace('{x}', noun.kana), en: model.en.replace('{x}', noun.en) };
}

/** Squash a reading for comparing starts: hiragana, no spaces or punctuation. Null if not kana. */
export const squashReading = (raw: string): string | null => wordReading(raw);

/**
 * What the next sentence must start with: the last word of the sentence before (its last spaced chunk, as kana), or
 * its last kana. A last kana of ん falls back to the kana before it. `word` is null when the last chunk isn't kana.
 */
export function linkOf(sentenceKana: string): { word: string | null; kana: string; options: string[] } {
  const chunks = sentenceKana.replace(/[、。！？!?「」]/g, ' ').trim().split(/\s+/).filter(Boolean);
  const last = chunks.at(-1) ?? '';
  const word = squashReading(last);
  const all = squashReading(sentenceKana) ?? word ?? '';
  let kana = lastKana(all);
  if (kana === 'ん') kana = lastKana(all.replace(/ん+$/, '')) || 'あ';
  // One chunk is the whole sentence (a reading with no spaces): there is no last word to start with.
  return { word: word && word.length >= 2 && chunks.length > 1 ? word : null, kana, options: startOptions(kana) };
}

/** Does this reading start the way the link asks: with the last word, or with the last kana (か = が)? */
export function startsWithLink(reading: string, link: { word: string | null; kana: string }): boolean {
  const r = squashReading(reading);
  if (!r) return false;
  if (link.word && r.startsWith(link.word)) return true;
  return follows(link.kana, r);
}
