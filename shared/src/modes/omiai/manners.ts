// The manners meter: a pure, deterministic politeness check for Omiai Matchmaker answers, plus
// a rule-based "more polite version" for the private tip. No LLM, no dictionary I/O: the server
// adds kuromoji `tokens` to every utterance before the move reaches the rules (server/src/
// reading.ts), and the checker uses them where they help (is the last word a noun? is that お a
// prefix?). Everything also works with no tokens at all, on the kana alone.
//
// What it looks at (all on the kana reading, katakana folded to hiragana):
//   - how each sentence ends: です/ます (polite), だ/plain verb/plain adjective (plain), or a
//     casual ending (じゃん, だよね, っす …)
//   - set phrases: はじめまして, よろしくおねがいします, (name)ともうします
//   - keigo touches: honorific verbs (いらっしゃいます, めしあがります, お〜になります …) and humble
//     ones (もうします, まいります, いたします, おります …); でございます / ございます count as
//     extra-polite (ていねい), not humble: they lower nobody, they just raise the whole register
//   - beautifying お/ご on nouns (おしごと, ごしゅみ, おちゃ)
//   - aizuchi and cushion words (そうですね, なるほど, しつれいですが)
//   - casual words (うん, おれ, まじ, やばい, めっちゃ …), each with a polite swap
//
// Forgiving by design: nothing ever subtracts. A casual word costs no meter, it just earns a
// tip; the meter only counts what was done well. Sentences that are only a greeting or an
// aizuchi (はい！) don't need an ending. When the rewrite isn't sure what a word is (a noun that
// happens to end like a verb), it leaves it alone rather than "correct" good Japanese.

import type { Level } from '../../../../content/src/types.js';
import { toHiragana, type Utterance, type UtteranceToken } from '../../japanese/kana.js';

// ---- result ----

export type MannerKind = 'polite-end' | 'greeting' | 'closing' | 'name-intro' | 'honorific' | 'humble' | 'teinei' | 'prefix' | 'aizuchi' | 'cushion';

export interface MannerHit {
  kind: MannerKind;
  /** The words that earned it, as kana. */
  text: string;
}

export interface CasualHit {
  /** What was said (kana). */
  text: string;
  /** The polite swap. */
  polite: string;
  /** One short sentence naming the pattern. */
  note: string;
}

/** keigo: polite with honorific or humble verbs · polite: every sentence ends politely · mixed · plain · casual · none (no Japanese). */
export type Register = 'keigo' | 'polite' | 'mixed' | 'plain' | 'casual' | 'none';

export interface MannersResult {
  /** 0–100, level-scaled. Never lowered by a mistake. */
  meter: number;
  register: Register;
  hits: MannerHit[];
  casual: CasualHit[];
  /** Sentences that needed an ending, and how many ended politely. */
  clauses: number;
  politeClauses: number;
  /**
   * A more polite version made by rule, or null when there was nothing the rules could fix.
   * `text` puts the speaker's own katakana and kanji words back; `kana` is what an echo is checked against.
   */
  rewrite: { text: string; kana: string } | null;
  /** The pattern the rewrite (or upgrade) teaches, in one sentence. */
  note: string | null;
  /** For an answer that is already polite: one keigo step up (N4 material), or null. */
  upgrade: { text: string; kana: string; note: string } | null;
}

// ---- the verb table (plain → polite conjugation) ----

type VerbClass = 'u' | 'ru' | 'suru' | 'kuru';

/** Common first-year verbs, as kana, with their class. Longest match wins, so つくる beats くる. */
const VERBS: readonly [string, VerbClass][] = [
  // ichidan
  ['たべる', 'ru'], ['みる', 'ru'], ['ねる', 'ru'], ['おきる', 'ru'], ['いる', 'ru'], ['できる', 'ru'], ['でる', 'ru'], ['でかける', 'ru'],
  ['みせる', 'ru'], ['あける', 'ru'], ['しめる', 'ru'], ['おしえる', 'ru'], ['おぼえる', 'ru'], ['わすれる', 'ru'], ['かける', 'ru'], ['つける', 'ru'],
  ['きる', 'ru'], ['あびる', 'ru'], ['はじめる', 'ru'], ['つかれる', 'ru'], ['うまれる', 'ru'], ['すてる', 'ru'], ['かんがえる', 'ru'], ['こたえる', 'ru'],
  ['しらべる', 'ru'], ['つたえる', 'ru'], ['ながめる', 'ru'], ['あつめる', 'ru'], ['きめる', 'ru'], ['にげる', 'ru'], ['やめる', 'ru'], ['ほめる', 'ru'],
  ['とける', 'ru'], ['こげる', 'ru'], ['みつける', 'ru'], ['うける', 'ru'], ['たすける', 'ru'], ['つづける', 'ru'], ['あげる', 'ru'], ['くれる', 'ru'],
  // godan
  ['いく', 'u'], ['かく', 'u'], ['きく', 'u'], ['あるく', 'u'], ['はたらく', 'u'], ['ひく', 'u'], ['おく', 'u'], ['つく', 'u'], ['なく', 'u'], ['さく', 'u'], ['みがく', 'u'],
  ['およぐ', 'u'], ['いそぐ', 'u'], ['ぬぐ', 'u'],
  ['はなす', 'u'], ['かす', 'u'], ['さがす', 'u'], ['だす', 'u'], ['けす', 'u'], ['すごす', 'u'], ['なおす', 'u'],
  ['まつ', 'u'], ['もつ', 'u'], ['たつ', 'u'], ['かつ', 'u'], ['そだつ', 'u'],
  ['しぬ', 'u'],
  ['あそぶ', 'u'], ['よぶ', 'u'], ['とぶ', 'u'], ['ならぶ', 'u'], ['えらぶ', 'u'], ['まなぶ', 'u'],
  ['のむ', 'u'], ['よむ', 'u'], ['すむ', 'u'], ['やすむ', 'u'], ['たのしむ', 'u'], ['あむ', 'u'], ['すすむ', 'u'],
  ['かう', 'u'], ['あう', 'u'], ['いう', 'u'], ['ならう', 'u'], ['うたう', 'u'], ['つかう', 'u'], ['もらう', 'u'], ['てつだう', 'u'], ['わらう', 'u'], ['おもう', 'u'], ['あらう', 'u'], ['すう', 'u'],
  ['ある', 'u'], ['わかる', 'u'], ['かえる', 'u'], ['はいる', 'u'], ['はしる', 'u'], ['しる', 'u'], ['つくる', 'u'], ['のる', 'u'], ['とる', 'u'], ['おわる', 'u'],
  ['すわる', 'u'], ['まがる', 'u'], ['ふる', 'u'], ['なる', 'u'], ['おくる', 'u'], ['うる', 'u'], ['がんばる', 'u'], ['まわる', 'u'], ['ねむる', 'u'], ['おどる', 'u'],
  ['のぼる', 'u'], ['しゃべる', 'u'], ['すべる', 'u'], ['いのる', 'u'], ['さわる', 'u'], ['もどる', 'u'], ['こまる', 'u'], ['とまる', 'u'], ['あつまる', 'u'],
  // irregular (compounds such as べんきょうする end in these)
  ['する', 'suru'], ['くる', 'kuru'],
];

const GODAN: Record<string, { i: string; a: string; te: string; ta: string }> = {
  う: { i: 'い', a: 'わ', te: 'って', ta: 'った' },
  く: { i: 'き', a: 'か', te: 'いて', ta: 'いた' },
  ぐ: { i: 'ぎ', a: 'が', te: 'いで', ta: 'いだ' },
  す: { i: 'し', a: 'さ', te: 'して', ta: 'した' },
  つ: { i: 'ち', a: 'た', te: 'って', ta: 'った' },
  ぬ: { i: 'に', a: 'な', te: 'んで', ta: 'んだ' },
  ぶ: { i: 'び', a: 'ば', te: 'んで', ta: 'んだ' },
  む: { i: 'み', a: 'ま', te: 'んで', ta: 'んだ' },
  る: { i: 'り', a: 'ら', te: 'って', ta: 'った' },
};

interface Forms {
  stem: string; // ます-stem
  te: string;
  ta: string;
  nai: string; // plain negative stem + ない
  vol: string; // volitional
}

export function verbForms(dict: string, cls: VerbClass): Forms {
  if (cls === 'suru') {
    const base = dict.slice(0, -2);
    return { stem: `${base}し`, te: `${base}して`, ta: `${base}した`, nai: `${base}しない`, vol: `${base}しよう` };
  }
  if (cls === 'kuru') {
    const base = dict.slice(0, -2);
    return { stem: `${base}き`, te: `${base}きて`, ta: `${base}きた`, nai: `${base}こない`, vol: `${base}こよう` };
  }
  const base = dict.slice(0, -1);
  if (cls === 'ru') return { stem: base, te: `${base}て`, ta: `${base}た`, nai: `${base}ない`, vol: `${base}よう` };
  const last = dict.slice(-1);
  const g = GODAN[last]!;
  // いく is the one godan く verb with いって / いった.
  const te = dict.endsWith('いく') ? `${base}って` : `${base}${g.te}`;
  const ta = dict.endsWith('いく') ? `${base}った` : `${base}${g.ta}`;
  const oRow: Record<string, string> = { う: 'お', く: 'こ', ぐ: 'ご', す: 'そ', つ: 'と', ぬ: 'の', ぶ: 'ぼ', む: 'も', る: 'ろ' };
  // ある's plain negative is ない (handled with が/は/も ない below).
  return { stem: `${base}${g.i}`, te, ta, nai: dict === 'ある' ? 'ない' : `${base}${g.a}ない`, vol: `${base}${oRow[last]}う` };
}

/** Plain ending → polite ending, every verb and form, longest first. */
const VERB_ENDINGS: readonly { plain: string; polite: string; note: string }[] = (() => {
  const out: { plain: string; polite: string; note: string }[] = [];
  for (const [dict, cls] of VERBS) {
    const f = verbForms(dict, cls);
    const add = (plain: string, polite: string, note: string) => out.push({ plain, polite, note });
    add(`${f.te}いなかった`, `${f.te}いませんでした`, 'Past negative 〜ていなかった becomes 〜ていませんでした.');
    add(`${f.nai.slice(0, -2)}なかった`, `${f.stem}ませんでした`, 'Past negative 〜なかった becomes 〜ませんでした.');
    add(`${f.te}いる`, `${f.te}います`, '〜ている becomes 〜ています.');
    add(`${f.te}る`, `${f.te}います`, 'Casual 〜てる is 〜ています when you are being polite.');
    add(`${f.te}いた`, `${f.te}いました`, '〜ていた becomes 〜ていました.');
    add(`${f.te}た`, `${f.te}いました`, 'Casual 〜てた is 〜ていました when you are being polite.');
    // ある's plain negative is a bare ない: only after が / は / も (below), never on its own.
    if (dict !== 'ある') add(f.nai, `${f.stem}ません`, 'Plain negative 〜ない becomes 〜ません.');
    add(f.vol, `${f.stem}ましょう`, 'Let’s: 〜よう becomes 〜ましょう.');
    add(f.ta, `${f.stem}ました`, 'Plain past 〜た becomes 〜ました.');
    add(dict, `${f.stem}ます`, 'Use the ます form: it is the polite way to end with a verb.');
    add(f.te, `${f.te}ください`, 'A bare 〜て is a casual request: add ください.');
  }
  // ある / ない
  out.push({ plain: 'がない', polite: 'がありません', note: 'ない becomes ありません.' });
  out.push({ plain: 'はない', polite: 'はありません', note: 'ない becomes ありません.' });
  out.push({ plain: 'もない', polite: 'もありません', note: 'ない becomes ありません.' });
  return out.sort((a, b) => b.plain.length - a.plain.length);
})();

/** Nouns that end like a verb form (あした ends in した). Left alone when there are no tokens to tell. */
const VERB_LOOKALIKES = ['あした', 'きのした', 'ふた', 'うた', 'かた', 'もでる', 'ちゃんねる', 'とんねる', 'すたいる', 'ふぁいる', 'ぱねる'];

// ---- word lists (kana) ----

/** Endings that are already polite (optionally followed by か / ね / よ / よね). */
const POLITE_END = /(です|ます|でした|ました|ません|ませんでした|ましょう|でしょう|ください|くださいませ|ございます|ございました|ませ)(か|かね|ね|ねえ|よ|よね)?$/;

const GREETINGS: readonly [string, MannerKind][] = [
  ['はじめまして', 'greeting'],
  ['こんにちは', 'greeting'],
  ['こんばんは', 'greeting'],
  ['おはようございます', 'greeting'],
  ['よろしくおねがいいたします', 'closing'],
  ['よろしくおねがいします', 'closing'],
  ['どうぞよろしく', 'closing'],
  ['ありがとうございます', 'closing'],
  ['ありがとうございました', 'closing'],
  ['おねがいします', 'closing'],
];

const HONORIFIC: readonly RegExp[] = [
  /いらっしゃ[いるらっりれ]/,
  /おっしゃ[いるらっ]/,
  /めしあが[りるらっ]/,
  /ごらんに/,
  /なさ(る|って|います|いました|いませ)/,
  /くださ[るらっ]|くださいます/,
  /ごぞんじ/,
  /おいでに/,
  /お[^をがはにでともへ、]{1,6}になり/,
  /ご[^をがはにでともへ、]{1,6}になり/,
  // The plain forms too (おみえに なった, おかえりに なる), when the stem is a verb's (ends in an i- or e-row kana);
  // not おばけに なる (turn into a ghost) or おきに なる, which aren't keigo.
  /(?!おばけに|おきにな)お[^をがはにでともへ、]{0,5}[いきしちにひみりぎじびぴえけせてねへめれげぜでべぺ]にな[るっら]/,
  /お[^をがはにでともへ、]{1,5}ください/,
  /ご[^をがはにでともへ、]{1,5}ください/,
];

const HUMBLE: readonly RegExp[] = [
  /もうし(ます|ました|あげ)/,
  /まいり(ます|ました)/,
  /いたし(ます|ました|ましょう)/,
  /おり(ます|ました|ません)/,
  /うかが[いうっ]/,
  /いただ[きくけ]/,
  /はいけん/,
  /ぞんじ(て|ます|あげ)/,
  /おもち(です|でしょう|ください|に)/,
  /もうしわけ/,
  /お(?!ねがい)[^をがはにでともへ、]{2,5}(し|いたし)ます/,
];

const PREFIXED = [
  'おなまえ', 'おしごと', 'ごしゅみ', 'ごかぞく', 'おちゃ', 'おかし', 'おみず', 'おさけ', 'おげんき', 'おてんき', 'おくに', 'おすまい', 'おへや',
  'ごりょうしん', 'ごきょうだい', 'おやすみ', 'おでかけ', 'ごいっしょ', 'ごあんない', 'おくるま', 'おにわ', 'おはなし', 'おしょくじ', 'ごせんもん',
  'おともだち', 'おじかん', 'おすし', 'おべんとう', 'おみせ', 'おかお', 'ごしゅっしん', 'ごしゅうしょく', 'おすき', 'おじょうず', 'ごちそう',
  'おせわ', 'おかげ', 'おつかれ', 'ごめいわく', 'おいそがし', 'おきゅうり', 'おはな', 'おふろ', 'おまつり', 'おかいもの', 'おさら', 'ごしょうかい',
];

const AIZUCHI = ['そうですね', 'そうですか', 'なるほど', 'すてきですね', 'いいですね', 'ほんとうですか', 'すごいですね', 'たしかに', 'へえ', 'ええ', 'はい'];
const CUSHION = ['しつれいですが', 'おそれいりますが', 'すみませんが', 'もしよろしければ', 'よろしければ', 'ぜひ', 'せっかくですが', 'もうしわけありませんが'];

/** Words said at the start of a sentence that need no ending of their own. */
const OPENERS = ['はじめまして', 'こんにちは', 'こんばんは', 'おはようございます', 'そうですね', 'なるほど', 'ええと', 'えっと', 'あのう', 'あの', 'はい', 'ええ', 'いいえ', 'へえ', 'じつは', 'さあ', 'どうぞ', 'うーん', 'うん', 'ううん', 'やあ', 'おっす'];

interface Swap {
  re: RegExp;
  polite: string;
  note: string;
}

const SWAPS: readonly Swap[] = [
  { re: /^ううん(?=[、,]|$)/, polite: 'いいえ', note: 'ううん is casual "nope"; いいえ is the polite no.' },
  { re: /^うん(?=[、,]|$)/, polite: 'はい', note: 'うん is casual "yeah"; はい is the polite yes.' },
  { re: /^えっとね(?=[、,]|$)/, polite: 'ええと', note: 'えっとね is chatty; ええと is the polite "um".' },
  { re: /^やあ(?=[、,]|$)/, polite: 'こんにちは', note: 'やあ is a casual "hey"; こんにちは works with anyone.' },
  { re: /^おっす(?=[、,]|$)/, polite: 'こんにちは', note: 'おっす is a very casual "yo"; こんにちは works with anyone.' },
  { re: /(^|[、,])(おれ|あたし)(?=[はがのもを])/, polite: '$1わたし', note: 'おれ and あたし are casual; わたし is the polite "I".' },
  { re: /まじ(?!め)で?/, polite: 'ほんとうに', note: 'まじ is slang; ほんとうに means "really".' },
  { re: /めっちゃ/, polite: 'とても', note: 'めっちゃ is slang; とても means "very".' },
  { re: /ちょー/, polite: 'とても', note: 'ちょー is slang; とても means "very".' },
  { re: /すげ[ーえ]/, polite: 'すごい', note: 'すげー is slangy すごい.' },
  { re: /やば[いっ]/, polite: 'すごい', note: 'やばい is slang; すごい ("amazing") is safer with family.' },
  { re: /ありがとう(?!ござ)/, polite: 'ありがとうございます', note: 'Add ございます to ありがとう when being polite.' },
  { re: /おはよう(?!ござ)/, polite: 'おはようございます', note: 'Add ございます to おはよう when being polite.' },
  { re: /ごめん(?!なさい)(ね|な)?/, polite: 'すみません', note: 'ごめん is casual; すみません is the polite sorry.' },
  { re: /よろしく(?!おねがい)(ね|な)?/, polite: 'よろしくおねがいします', note: 'Say the whole よろしくおねがいします to people you have just met.' },
  { re: /(ばいばい|じゃあね|またね)/, polite: 'しつれいします', note: 'For a polite goodbye, しつれいします.' },
  { re: /っす(?=[よね]*$)/, polite: 'です', note: '〜っす is a slangy です; say the whole です.' },
];

/** Casual final particles peeled before the ending is checked, and what they become. */
const FINAL_PARTICLES: readonly { end: string; after: string; casual: boolean; note?: string }[] = [
  { end: 'じゃん', after: 'ね', casual: true, note: 'じゃん is casual; 〜ですね asks for agreement politely.' },
  { end: 'でしょ', after: 'でしょう', casual: true, note: 'でしょ is casual; でしょう is the polite "right?".' },
  { end: 'っしょ', after: 'でしょう', casual: true, note: 'っしょ is slang; でしょう is the polite "right?".' },
  { end: 'かな', after: 'でしょうか', casual: false, note: '〜かな is a casual "I wonder"; 〜でしょうか is polite.' },
  { end: 'よね', after: 'よね', casual: false },
  { end: 'よな', after: 'よね', casual: true },
  { end: 'っけ', after: '', casual: false },
  { end: 'ね', after: 'ね', casual: false },
  { end: 'よ', after: 'よ', casual: false },
  { end: 'な', after: 'ね', casual: true },
  { end: 'ぞ', after: 'よ', casual: true },
  { end: 'ぜ', after: 'よ', casual: true },
  { end: 'の', after: 'か', casual: false },
];

// ---- text helpers ----

const SENTENCE_END = /[。．.!！?？\n]+/;
const NOISE = /[\s　「」『』（）()・…"'“”‘’♪〜~～]/g;

/** Kana for analysis: NFKC, hiragana, no spaces or quotes. Punctuation that ends a sentence stays. */
export function analysisText(u: Utterance | string): string {
  const raw = typeof u === 'string' ? u : (u.reading ?? u.text);
  return toHiragana(raw.normalize('NFKC')).replace(NOISE, '').replace(/[，,]/g, '、');
}

const hasJapanese = (s: string) => /[ぁ-ゖァ-ヺ一-鿿]/.test(s);

interface Clause {
  text: string;
  question: boolean;
}

function clausesOf(text: string): Clause[] {
  const out: Clause[] = [];
  let rest = text;
  while (rest) {
    const m = SENTENCE_END.exec(rest);
    const body = m ? rest.slice(0, m.index) : rest;
    const punct = m ? m[0] : '';
    if (body.replace(/[、ー]/g, '')) out.push({ text: body.replace(/[、]+$/, ''), question: /[?？]/.test(punct) });
    rest = m ? rest.slice(m.index + punct.length) : '';
  }
  return out;
}

/** Peels openers (はい、 そうですね、 はじめまして、) off the front of a clause. */
function peelOpeners(text: string): { rest: string; peeled: string[] } {
  let rest = text;
  const peeled: string[] = [];
  for (let guard = 0; guard < 4; guard++) {
    const o = OPENERS.find((x) => rest.startsWith(x) && (rest.length === x.length || rest[x.length] === '、' || rest[x.length] === 'ー'));
    if (!o) break;
    peeled.push(o);
    rest = rest.slice(o.length).replace(/^[、ー]+/, '');
  }
  return { rest, peeled };
}

/** Facts from the server's tokens: what the last word is, and which お/ご were prefixes. */
interface TokenFacts {
  /** Reading of the last content token (not a symbol or sentence-final particle) and its POS. */
  last: { reading: string; pos: string; known: boolean } | null;
  prefixes: string[];
  nouns: string[];
}

function tokenFacts(tokens: readonly UtteranceToken[] | undefined): TokenFacts {
  if (!tokens?.length) return { last: null, prefixes: [], nouns: [] };
  const content = tokens.filter((t) => t.pos !== '記号' && !(t.pos === '助詞' && /^(ね|よ|よね|な|か|の|わ|ぞ|ぜ)$/.test(t.surface)));
  const lastTok = content.at(-1);
  const prefixes: string[] = [];
  tokens.forEach((t, i) => {
    const next = tokens[i + 1];
    if (t.pos === '接頭詞' && /^(お|ご|御)$/.test(t.surface) && next && next.pos === '名詞') prefixes.push(toHiragana(t.reading + next.reading));
  });
  // Only words the dictionary knows: kana-only text is often split oddly (ご|し|ゅみは).
  const nouns = tokens.filter((t) => t.pos === '名詞' && t.known && [...t.reading].length >= 2).map((t) => toHiragana(t.reading));
  return { last: lastTok ? { reading: toHiragana(lastTok.reading), pos: lastTok.pos, known: lastTok.known } : null, prefixes, nouns };
}

// ---- the ending ----

interface Ending {
  polite: boolean;
  /** The clause made polite, or null if it was polite already or the rules can't tell. */
  rewrite: string | null;
  note: string | null;
  casual: CasualHit | null;
}

/** What the tokens say about the clause's last word (the last clause only). */
interface LastWord {
  /**
   * Readings of words known to be nouns: dictionary nouns from the tokens, and every katakana
   * word in the answer (loanwords are nearly always nouns). A clause ending in one gets です.
   */
  nouns: string[];
  /** The clause ends in a verb or auxiliary. */
  verb: boolean;
}

/** Makes one clause polite, if the rules can. */
function politeEnding(clause: Clause, last: LastWord): Ending {
  let core = clause.text.replace(/[ー、]+$/, '');
  if (!core) return { polite: true, rewrite: null, note: null, casual: null };

  // Peel one final particle, when what is left ends in something the rules know.
  let after = '';
  let peeledNote: string | null = null;
  let peeledCasual: CasualHit | null = null;
  let tentative = false;
  for (const p of FINAL_PARTICLES) {
    if (!core.endsWith(p.end) || core.length === p.end.length) continue;
    let left = core.slice(0, -p.end.length);
    if (p.end === 'の' && clause.question) left = left.replace(/な$/, '');
    const always = p.end === 'じゃん' || p.end === 'でしょ' || p.end === 'っしょ' || p.end === 'かな' || (p.end === 'の' && clause.question);
    if (!always && !recognised(left, last)) continue;
    core = left;
    after = p.end === 'の' && !clause.question ? '' : p.after;
    peeledNote = p.note ?? null;
    tentative = p.end === 'でしょ' || p.end === 'っしょ' || p.end === 'かな';
    if (p.casual) peeledCasual = { text: p.end, polite: p.after || 'です', note: p.note ?? `${p.end} at the end is casual.` };
    break;
  }

  // 〜かな / 〜でしょ: でしょう(か) goes straight after the plain form (いくでしょうか, すきでしょう).
  if (tentative) {
    const base = core.replace(/だ$/, '').replace(/です$/, '');
    if (/ます$/.test(base)) return { polite: true, rewrite: null, note: null, casual: peeledCasual };
    return { polite: false, rewrite: `${base}${after}`, note: peeledNote, casual: peeledCasual };
  }

  const attach = (base: string): string => {
    const politeBase = /(ます|です|ません|ました|でした|ましょう)$/.test(base);
    if (after === 'か' || (clause.question && !after)) return politeBase ? `${base}か` : base;
    if (after === 'よ' && base.endsWith('ましょう')) return base;
    return `${base}${after}`;
  };

  // Already polite.
  if (POLITE_END.test(core)) {
    if (!peeledCasual) return { polite: true, rewrite: null, note: null, casual: null };
    return { polite: true, rewrite: attach(core), note: peeledNote, casual: peeledCasual };
  }

  const out = (polite: string, note: string): Ending => ({
    polite: false,
    rewrite: attach(polite),
    note: peeledCasual && peeledNote ? peeledNote : note,
    casual: peeledCasual,
  });

  // The copula.
  let m: RegExpExecArray | null;
  if ((m = /(じゃ|では)なかった$/.exec(core))) return out(`${core.slice(0, m.index)}じゃありませんでした`, 'じゃなかった becomes じゃありませんでした.');
  if ((m = /(じゃ|では)ない$/.exec(core))) return out(`${core.slice(0, m.index)}じゃありません`, 'じゃない becomes じゃありません.');

  // Verbs (the table, longest match first). A known noun that covers more of the ending than
  // the verb form wins (あした is a noun, not あ + した; モデル is not モ + でる).
  const noun = last.nouns.filter((n) => core.endsWith(n)).sort((a, b) => b.length - a.length)[0];
  if (!VERB_LOOKALIKES.some((n) => core === n || (core.endsWith(n) && !last.verb))) {
    for (const v of VERB_ENDINGS) {
      if (!core.endsWith(v.plain)) continue;
      if (noun && noun.length > v.plain.length) break;
      // たのしかった / よかった are adjectives, not 〜 + かった (勝つ).
      if (v.plain === 'かった' && core.length > 3) continue;
      const before = core.slice(0, -v.plain.length);
      return out(`${before}${v.polite}`, v.note);
    }
  }

  if (noun) return out(`${core}です`, 'Put です after a noun to say it politely.');
  // A clause ending in a particle is a fragment (すしを…): leave it.
  if (/[をがにはもとへ]$/.test(core)) return { polite: false, rewrite: null, note: null, casual: peeledCasual };

  if ((m = /だった$/.exec(core))) return out(`${core.slice(0, m.index)}でした`, 'だった becomes でした.');
  if ((m = /だ$/.exec(core)) && core.length > 1) return out(`${core.slice(0, m.index)}です`, 'だ is the plain "is"; です is the polite one.');

  // Verbs we don't know: plain negatives by their shape.
  if ((m = /(て|で)ない$/.exec(core))) return out(`${core.slice(0, m.index)}${m[1]}いません`, '〜てない is casual 〜ていない; politely, 〜ていません.');
  if ((m = /([あかがさざただなはばぱまやらわ])ない$/.exec(core))) {
    const iRow: Record<string, string> = { あ: 'い', わ: 'い', か: 'き', が: 'ぎ', さ: 'し', ざ: 'じ', た: 'ち', だ: 'ぢ', な: 'に', は: 'ひ', ば: 'び', ぱ: 'ぴ', ま: 'み', や: 'い', ら: 'り' };
    return out(`${core.slice(0, m.index)}${iRow[m[1]!] ?? m[1]}ません`, 'Plain negative 〜ない becomes 〜ません.');
  }
  if ((m = /([えけげせぜてでねへべぺめれ])ない$/.exec(core))) return out(`${core.slice(0, m.index)}${m[1]}ません`, 'Plain negative 〜ない becomes 〜ません.');

  // Adjectives: add です (i-adjectives keep their い / かった / くない).
  if (/(かった|くない|い)$/.test(core)) return out(`${core}です`, 'Add です after an adjective to say it politely.');

  // A bare noun or な-adjective. A clause ending in a particle is a fragment: leave it.
  if (/[をがにではもとへの]$/.test(core) || core.length < 2) return { polite: false, rewrite: null, note: null, casual: peeledCasual };
  return out(`${core}です`, 'Put です after a noun to say it politely.');
}

const endsWithNoun = (text: string, last: LastWord) => last.nouns.some((n) => text.endsWith(n));

/** Does this text end in a form the ending rules know (so a final ね / よ can be peeled)? */
function recognised(text: string, last: LastWord): boolean {
  if (POLITE_END.test(text) || /(だ|だった|じゃない|い|かった|ない)$/.test(text)) return true;
  if (endsWithNoun(text, last)) return true;
  return VERB_ENDINGS.some((v) => text.endsWith(v.plain) && v.plain.length >= 2);
}

// ---- keigo upgrades for answers that are already polite ----

/** Polite → one step up (humble when talking about yourself, which is what answers do). */
const UPGRADES: readonly { from: RegExp; to: string; note: string }[] = [
  { from: /([ぁ-ゖ]+)です(。|$)/, to: '$1ともうします$2', note: 'Introducing yourself? 〜ともうします is the humble way to say your name.' },
  // Each pattern starts a word (after a particle, a て-form or a known する-noun), so よみます
  // never turns into よ-はいけんします.
  { from: /(を|おねがい|べんきょう|りょうり|そうじ|さんぽ|うんどう|れんしゅう|あんない|しょうかい|でんわ|しつれい|しょくじ|しごと)します/, to: '$1いたします', note: 'いたします is the humble します, for things you do.' },
  { from: /(て|で|が|は|に|も)います/, to: '$1おります', note: 'おります is the humble います.' },
  { from: /(^|[にへ、。])いきます/, to: '$1まいります', note: 'まいります is the humble いきます (and きます).' },
  { from: /(^|[にへ、。])きます/, to: '$1まいります', note: 'まいります is the humble きます (and いきます).' },
  { from: /(^|[をとが、。])いいます/, to: '$1もうします', note: 'もうします is the humble いいます.' },
  { from: /(^|[をもは、。])たべます/, to: '$1いただきます', note: 'いただきます is the humble たべます.' },
  { from: /(^|[をもは、。])のみます/, to: '$1いただきます', note: 'いただきます is the humble のみます.' },
  { from: /(^|[をもは、。])もらいます/, to: '$1いただきます', note: 'いただきます is the humble もらいます.' },
  { from: /(^|[をもは、。])みます/, to: '$1はいけんします', note: 'はいけんします is the humble みます (for someone else’s things).' },
  { from: /(^|[がもは、。])あります/, to: '$1ございます', note: 'ございます is the extra-polite あります.' },
];

function upgradeFor(text: string, name: string | undefined, hits: MannerHit[]): { text: string; note: string } | null {
  if (hits.some((h) => h.kind === 'humble' || h.kind === 'honorific' || h.kind === 'teinei')) return null;
  for (const u of UPGRADES) {
    // ともうします only for the speaker's own name.
    if (u.to.includes('ともうします')) {
      if (!name) continue;
      const kanaName = toHiragana(name.normalize('NFKC').replace(NOISE, ''));
      const idx = text.indexOf(`${kanaName}です`);
      if (idx < 0) continue;
      return { text: `${text.slice(0, idx)}${kanaName}ともうします${text.slice(idx + kanaName.length + 2)}`, note: u.note };
    }
    if (u.from.test(text)) return { text: text.replace(u.from, u.to), note: u.note };
  }
  return null;
}

// ---- the meter ----

const LEVEL_SCALE: Record<Level, number> = { kana: 1.3, n5: 1.1, n4: 1 };

export const METER = {
  ending: 45,
  setPhrase: 10,
  setPhraseMax: 20,
  aizuchi: 10,
  cushion: 10,
  prefix: 10,
  keigoFirst: 20,
  keigoMore: 10,
  keigoMax: 30,
} as const;

export interface CheckOptions {
  /** The speaker's name, so 〜です / 〜ともうします after it counts as a self-introduction. */
  name?: string;
}

/** Checks an answer's manners. Pure and deterministic: the same utterance always gets the same result. */
export function checkManners(u: Utterance | string, level: Level, opts: CheckOptions = {}): MannersResult {
  const text = analysisText(u);
  const tokens = typeof u === 'string' ? undefined : u.tokens;
  const empty: MannersResult = { meter: 0, register: 'none', hits: [], casual: [], clauses: 0, politeClauses: 0, rewrite: null, note: null, upgrade: null };
  if (!hasJapanese(text)) return empty;

  const flat = text.replace(/[、。．.!！?？\n]/g, '');
  const facts = tokenFacts(tokens);
  const raw = (typeof u === 'string' ? u : u.text).normalize('NFKC');
  for (const run of raw.match(/[ァ-ヺー]{2,}/g) ?? []) facts.nouns.push(toHiragana(run));
  const hits: MannerHit[] = [];
  const hit = (kind: MannerKind, t: string) => {
    if (!hits.some((h) => h.kind === kind && h.text === t)) hits.push({ kind, text: t });
  };

  // Set phrases, keigo, prefixes, aizuchi, cushions: anywhere in the answer.
  for (const [g, kind] of GREETINGS) {
    if (flat.includes(g) && !hits.some((h) => h.text.includes(g))) hit(kind, g);
  }
  if (opts.name) {
    const kanaName = toHiragana(opts.name.normalize('NFKC').replace(NOISE, ''));
    if (kanaName && new RegExp(`${escape(kanaName)}(です|ともうします|でございます)`).test(flat)) hit('name-intro', `${kanaName}…`);
  }
  if (/ともうします/.test(flat) && !hits.some((h) => h.kind === 'name-intro')) hit('name-intro', 'ともうします');
  for (const re of HONORIFIC) {
    const m = re.exec(flat);
    if (m) hit('honorific', m[0]);
  }
  for (const re of HUMBLE) {
    const m = re.exec(flat);
    if (m && !hits.some((h) => h.kind === 'honorific' && h.text.includes(m[0]))) hit('humble', m[0]);
  }
  // ありがとう / おはよう ございます are set phrases, not a raised register.
  const teinei = /(?<!(?:ありがとう|おはよう|おめでとう)\s?)(で)?ございま/.exec(flat);
  if (teinei) hit('teinei', teinei[0]);
  for (const p of [...PREFIXED, ...facts.prefixes]) if (flat.includes(p)) hit('prefix', p);
  for (const a of AIZUCHI) {
    if (a === 'はい' || a === 'ええ' || a === 'へえ') {
      if (new RegExp(`(^|[、。！？!?])${a}([、。！？!?ー]|$)`).test(text)) hit('aizuchi', a);
    } else if (flat.includes(a)) hit('aizuchi', a);
  }
  for (const c of CUSHION) if (flat.includes(c) && !hits.some((h) => h.kind === 'cushion')) hit('cushion', c);

  // Casual words, each with its polite swap.
  const casual: CasualHit[] = [];
  const original = clausesOf(text);
  const swappedClauses = original.map((c) => {
    let t = c.text;
    for (const sw of SWAPS) {
      const m = sw.re.exec(t);
      if (!m) continue;
      if (!casual.some((x) => x.note === sw.note)) casual.push({ text: m[0].replace(/^[、,]/, ''), polite: sw.polite.replace('$1', ''), note: sw.note });
      t = t.replace(sw.re, sw.polite);
    }
    return { text: t, question: c.question };
  });

  // Endings, clause by clause. The tokens describe the last word of the whole answer, so they
  // only help with the last clause.
  let clauses = 0;
  let politeClauses = 0;
  let endingNote: string | null = null;
  const rewritten: string[] = [];
  swappedClauses.forEach((c, i) => {
    const mark = c.question ? '？' : '。';
    const lastClause = i === swappedClauses.length - 1;
    const last: LastWord = { nouns: facts.nouns, verb: lastClause && (facts.last?.pos === '動詞' || facts.last?.pos === '助動詞') };
    // Politeness is judged on what was said (ありがとう is not ありがとうございます); the rewrite
    // is built from the clause with its casual words already swapped.
    const said = peelOpeners(original[i]!.text).rest;
    // A short sound effect (ピピッ, あっ) is not a sentence and needs no ending.
    if (/^[^、]{1,4}っ$/.test(said)) {
      rewritten.push(`${original[i]!.text}${mark}`);
      return;
    }
    if (said) {
      clauses += 1;
      const e0 = politeEnding({ text: said, question: c.question }, last);
      if (e0.polite) politeClauses += 1;
      if (e0.casual && !casual.some((x) => x.text === e0.casual!.text)) casual.push(e0.casual);
    }
    const { rest, peeled } = peelOpeners(c.text);
    const lead = peeled.join('、');
    if (!rest) {
      rewritten.push(`${lead}${mark}`);
      return;
    }
    const e = politeEnding({ text: rest, question: c.question }, last);
    if (e.rewrite && !endingNote) endingNote = e.note;
    rewritten.push(`${lead ? `${lead}、` : ''}${e.rewrite ?? rest}${mark}`);
  });
  if (politeClauses > 0 || (clauses === 0 && hits.length)) hit('polite-end', 'です・ます');

  const before = original.map((c) => `${c.text}${c.question ? '？' : '。'}`).join('');
  const joined = rewritten.join('');
  // Kanji with no reading (the server's dictionary was unavailable): the endings can still be
  // judged, but a rewrite would guess at words it can't read (食べるです), so there is none.
  const blind = /[一-鿿]/.test(text);
  const rewrite = !blind && stripForCompare(joined) !== stripForCompare(before) ? joined : null;
  // The tip names one pattern: the ending first (です/ます matters most), else the first casual word.
  const note = rewrite ? (endingNote ?? casual[0]?.note ?? null) : null;

  // The meter.
  // An answer that is only a set phrase or an aizuchi (はい！) gets half the ending credit.
  const endingShare = clauses ? politeClauses / clauses : hits.length ? 0.5 : 0;
  let meter = METER.ending * endingShare;
  const sets = hits.filter((h) => h.kind === 'greeting' || h.kind === 'closing' || h.kind === 'name-intro').length;
  meter += Math.min(METER.setPhraseMax, sets * METER.setPhrase);
  if (hits.some((h) => h.kind === 'aizuchi')) meter += METER.aizuchi;
  if (hits.some((h) => h.kind === 'cushion')) meter += METER.cushion;
  if (hits.some((h) => h.kind === 'prefix')) meter += METER.prefix;
  const keigo = hits.filter((h) => h.kind === 'honorific' || h.kind === 'humble' || h.kind === 'teinei').length;
  if (keigo) meter += Math.min(METER.keigoMax, METER.keigoFirst + (keigo - 1) * METER.keigoMore);
  meter = Math.min(100, Math.round(meter * LEVEL_SCALE[level]));

  let register: Register;
  if (clauses === 0 && !hits.length) register = casual.length ? 'casual' : 'plain';
  else if (politeClauses === clauses) register = keigo ? 'keigo' : 'polite';
  else if (politeClauses > 0) register = 'mixed';
  else register = casual.length ? 'casual' : 'plain';

  const up = !rewrite && (register === 'polite' || register === 'keigo') ? upgradeFor(before, opts.name, hits) : null;
  return {
    meter,
    register,
    hits,
    casual,
    clauses,
    politeClauses,
    rewrite: rewrite ? { text: restoreScript(rewrite, u), kana: restoreScript(rewrite, u, false) } : null,
    note,
    upgrade: up ? { text: restoreScript(up.text, u), kana: restoreScript(up.text, u, false), note: up.note } : null,
  };
}

const stripForCompare = (s: string) => s.replace(/[、。．.!！?？\sー]/g, '');

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Puts the speaker's own spelling back into a kana rewrite: word spaces, katakana words (ゲーム)
 * and, when the server's tokens say how a kanji word reads, the kanji (明日は休みです, 食べます).
 * Without kanji it is the reading Kana players see (and get romaji for), spaced like the answer.
 */
export function restoreScript(kana: string, u: Utterance | string, kanji = true): string {
  const raw = (typeof u === 'string' ? u : u.text).normalize('NFKC');
  kana = restoreSpaces(kana, typeof u === 'string' ? u : (u.reading ?? u.text));
  const pairs: [string, string][] = [];
  for (const run of raw.match(/[ァ-ヺー]{2,}/g) ?? []) pairs.push([toHiragana(run), run]);
  if (kanji && typeof u !== 'string') {
    for (const t of u.tokens ?? []) {
      if (!/[一-鿿々]/.test(t.surface)) continue;
      // 食べる / たべる: keep the kanji stem plus the first kana after it (食べ / たべ), so a
      // changed ending (食べます) still gets its kanji.
      const tail = /[ぁ-ゖ]*$/.exec(t.surface)![0];
      const stem = t.surface.slice(0, t.surface.length - tail.length);
      const reading = toHiragana(t.reading);
      const stemReading = reading.slice(0, reading.length - tail.length);
      if (!stemReading || stemReading === stem) continue;
      if (tail) pairs.push([stemReading + tail[0], stem + tail[0]]);
      else if ([...stemReading].length >= 2) pairs.push([stemReading, stem]);
    }
  }
  let out = kana;
  for (const [from, to] of pairs.sort((a, b) => b[0].length - a[0].length)) out = out.split(from).join(to);
  return out;
}

/**
 * Copies the speaker's word spaces (tiles and some recognisers use them) into the rewrite. The two
 * are aligned by their longest common subsequence, so a swapped word (おれ → わたし) doesn't stop
 * the spaces after it from coming back.
 */
function restoreSpaces(rewrite: string, original: string): string {
  // Make the same word swaps in the spaced original, so swapped words line up too.
  let spaced = toHiragana(original.normalize('NFKC')).replace(/　/g, ' ');
  for (const sw of SWAPS) spaced = spaced.replace(sw.re, sw.polite);
  const orig = [...spaced];
  const o: string[] = [];
  const spaceAfter: boolean[] = [];
  for (const ch of orig) {
    if (ch === ' ') {
      if (o.length) spaceAfter[o.length - 1] = true;
    } else {
      o.push(ch);
      spaceAfter.push(false);
    }
  }
  if (!spaceAfter.some(Boolean)) return rewrite;
  const chars = [...rewrite];
  const n = chars.length;
  const m = o.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i]![j] = chars[i] === o[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }
  const spaceAt = new Set<number>();
  for (let i = 0, j = 0; i < n && j < m; ) {
    if (chars[i] === o[j]) {
      if (spaceAfter[j]) spaceAt.add(i);
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) i++;
    else j++;
  }
  const out = chars.map((ch, i) => (spaceAt.has(i) && i < n - 1 ? `${ch} ` : ch)).join('');
  return out.replace(/ +/g, ' ').replace(/ ?([、。！？]) ?/g, '$1');
}
