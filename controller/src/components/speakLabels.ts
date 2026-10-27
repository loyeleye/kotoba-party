// Speaking-prompt wording matched to the player's level, so the "hold and say" button itself
// teaches a little Japanese:
//   kana: English only (these players can't read kana yet), with romaji for any word to say.
//   n5:   hiragana with spaces between words, English underneath.
//   n4:   plain Japanese with kanji, no English.
// Labels the table doesn't know stay as written.

import type { Level } from '../../../shared/src/protocol.js';
import { hasKanji, type Utterance } from '../../../shared/src/japanese/kana.js';
import { toRomaji } from '../../../shared/src/japanese/romaji.js';

export interface LevelText {
  /** The big line. */
  main: string;
  /** Small helper line under it, if any. */
  sub?: string;
  /** True when the big line is Japanese. */
  ja: boolean;
}

interface Phrase {
  n5: string;
  n4: string;
  /** Kana-level English, when it differs from the label (e.g. romaji for the word). */
  en?: string;
}

// Greetings whose は is read わ, which a plain kana-to-romaji pass gets wrong.
const SAID_AS: Record<string, string> = { こんにちは: 'konnichiwa', こんばんは: 'konbanwa' };

/** Romaji for a word to say, for players who can't read kana yet. */
export const romajiFor = (kana: string): string => SAID_AS[kana] ?? toRomaji(kana);

const EXACT: Record<string, Phrase> = {
  'Hold to talk': { n5: 'おしながら はなして', n4: '押しながら話して' },
  'Hold and say it': { n5: 'おしながら いって', n4: '押しながら言って' },
  'Hold and say your answer': { n5: 'おしながら こたえを いって', n4: '押しながら答えを言って' },
  'Hold and say the word': { n5: 'おしながら ことばを いって', n4: '押しながら言葉を言って' },
  'Hold and say its sound': { n5: 'おしながら おとを いって', n4: '押しながら音を言って' },
  'Hold and say it in Japanese': { n5: 'おしながら にほんごで いって', n4: '押しながら日本語で言って' },
  'Hold and say it to send it': { n5: 'おしながら いうと おくれるよ', n4: '押しながら言うと送れるよ' },
  'Hold and try again': { n5: 'おしながら もういちど', n4: '押しながらもう一度' },
  Send: { n5: 'おくる', n4: '送る' },
  'Say it again': { n5: 'もういちど', n4: 'もう一度' },
};

const PATTERNS: { re: RegExp; phrase: (x: string) => Phrase }[] = [
  {
    re: /^Hold and say a word starting with (.+)$/,
    phrase: (x) => ({
      n5: `おしながら「${x}」で はじまる ことばを いって`,
      n4: `押しながら「${x}」で始まる言葉を言って`,
      en: `Hold and say a word starting with “${romajiFor(x)}”`,
    }),
  },
  {
    // "Hold and say こんにちは": only when the thing to say is itself Japanese.
    re: /^Hold and say ([\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}ー〜！？!?、。]+)$/u,
    phrase: (x) => ({ n5: `おしながら「${x}」と いって`, n4: `押しながら「${x}」と言って`, en: `Hold and say “${romajiFor(x)}”` }),
  },
];

const EMOJI_TAIL = /(\s*\p{Extended_Pictographic}+)$/u;

function lookup(text: string): Phrase | undefined {
  if (EXACT[text]) return EXACT[text];
  for (const p of PATTERNS) {
    const m = p.re.exec(text);
    if (m) return p.phrase(m[1]!);
  }
  return undefined;
}

/** The button wording for this level. */
export function levelText(text: string, level: Level): LevelText {
  const tail = EMOJI_TAIL.exec(text)?.[1] ?? '';
  const english = tail ? text.slice(0, -tail.length) : text;
  const phrase = lookup(english);
  if (!phrase) return { main: text, ja: false };
  if (level === 'kana') return { main: (phrase.en ?? english) + tail, ja: false };
  if (level === 'n5') return { main: phrase.n5 + tail, sub: english, ja: true };
  return { main: phrase.n4 + tail, ja: true };
}

/** "Heard: …" line under the button. */
export const heardPrefix = (level: Level): string => (level === 'kana' ? 'Heard' : level === 'n5' ? 'きこえた' : '聞こえた');

// Endings that join the word before them: ます and た after a verb (たべ・まし・た → tabemashita), て after a verb
// (いっ・て → itte). です after a noun stays its own word (gakusei desu).
const JOINS_VERB = new Set(['動詞', '形容詞', '助動詞']);
const joinsPrevious = (pos: string, surface: string, prev: string | undefined): boolean =>
  pos === '記号' || (!!prev && JOINS_VERB.has(prev) && (pos === '助動詞' || (pos === '助詞' && ['て', 'で', 'ば'].includes(surface))));

/**
 * Romaji for what the mic heard, for かな players: "Heard: こんにちは (konnichiwa)". Uses the server's word split
 * (with readings for any kanji) when it sent one. Undefined when kanji are left that nothing read.
 */
export function heardRomaji(heard: Pick<Utterance, 'text' | 'tokens'>): string | undefined {
  let kana = heard.text;
  if (heard.tokens?.length) {
    kana = '';
    heard.tokens.forEach((t, i) => {
      const said = t.pos === '記号' ? t.surface : t.reading;
      kana += (i && !joinsPrevious(t.pos, t.surface, heard.tokens![i - 1]!.pos) ? ' ' : '') + said;
    });
  }
  if (hasKanji(kana)) return undefined;
  // Greetings whose は is read わ.
  const out = toRomaji(kana.replace(/(こんにち|こんばん)は/g, '$1わ'));
  return /[a-zA-Zāīūēō]/.test(out) ? out : undefined;
}
