// Kana helpers shared by the host voice and the judge: script conversion, the "is this speakable kana" check
// the host's LLM lines must pass, reading numbers aloud (三百五十円 → さんびゃくごじゅうえん), and the
// normalisation the offline judge compares answers with.

const KATA_START = 0x30a1;
const KATA_END = 0x30f6;
const KATA_TO_HIRA = 0x60;

export const toHiragana = (s: string): string =>
  s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - KATA_TO_HIRA));

export const toKatakana = (s: string): string =>
  s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + KATA_TO_HIRA));

export const isKatakanaChar = (c: string): boolean => {
  const n = c.charCodeAt(0);
  return n >= KATA_START && n <= KATA_END;
};

/** Kana, the long-vowel mark, spaces and the punctuation a line may carry. No kanji, no Latin, no digits. */
const SPEAKABLE = /^[ぁ-ゖァ-ヺー゛゜\s、。，．,.!?！？〜～…・「」『』（）()ー　]+$/u;
export const isSpeakableKana = (s: string): boolean => SPEAKABLE.test(s) && /[ぁ-ゖァ-ヺ]/.test(s);

export const hasKanji = (s: string): boolean => /[一-鿿㐀-䶿]/.test(s);

// ---------- Vowels and the long-vowel mark ----------

const ROWS: Record<string, string> = {
  あ: 'あかがさざただなはばぱまやらわぁゃゎ',
  い: 'いきぎしじちぢにひびぴみりぃ',
  う: 'うくぐすずつづぬふぶぷむゆるぅゅゔ',
  え: 'えけげせぜてでねへべぺめれぇ',
  お: 'おこごそぞとどのほぼぽもよろをぉょ',
};
const VOWEL = new Map<string, string>();
for (const [v, chars] of Object.entries(ROWS)) for (const c of chars) VOWEL.set(c, v);

/** The vowel a hiragana ends in, or undefined (ん, っ, punctuation). */
export const vowelOf = (c: string): string | undefined => VOWEL.get(c);

/** コーヒー → こおひい: each ー becomes the vowel before it. Expects hiragana. */
export function expandLongMarks(s: string): string {
  let out = '';
  for (const c of s) {
    if (c === 'ー' || c === '〜' || c === '～') {
      const prev = out.slice(-1);
      out += vowelOf(prev) ?? '';
    } else out += c;
  }
  return out;
}

/** Spelling variants of the same long vowel: とおきょう / とうきょう, せんせえ / せんせい. Lossy on purpose. */
export function foldLongVowelSpelling(s: string): string {
  let out = '';
  for (const c of s) {
    const v = vowelOf(out.slice(-1));
    if (c === 'う' && v === 'お') out += 'お';
    else if (c === 'い' && v === 'え') out += 'え';
    else out += c;
  }
  return out;
}

/** The particles は, へ, を are said わ, え, お. Folds both spellings to the sound (lossy on purpose). */
export const foldParticles = (s: string): string => s.replace(/は/g, 'わ').replace(/へ/g, 'え').replace(/を/g, 'お');

/** Sounds the design doc counts as one: じ/ぢ, ず/づ (お/を is folded with the particles). */
export const foldSameSounds = (s: string): string => s.replace(/ぢ/g, 'じ').replace(/づ/g, 'ず');

// ---------- Numbers ----------

const DIGIT_KANA = ['ぜろ', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう'];
const KANJI_DIGITS: Record<string, number> = { 〇: 0, 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
const KANJI_UNITS: Record<string, number> = { 十: 10, 百: 100, 千: 1000 };

/** 0 to 9999: 300 → さんびゃく, 600 → ろっぴゃく, 3000 → さんぜん, 1000 → せん. */
function belowMan(n: number): string {
  if (n === 0) return '';
  const th = Math.floor(n / 1000), hu = Math.floor((n % 1000) / 100), te = Math.floor((n % 100) / 10), on = n % 10;
  let out = '';
  if (th) out += th === 1 ? 'せん' : th === 3 ? 'さんぜん' : th === 8 ? 'はっせん' : DIGIT_KANA[th] + 'せん';
  if (hu) out += hu === 1 ? 'ひゃく' : hu === 3 ? 'さんびゃく' : hu === 6 ? 'ろっぴゃく' : hu === 8 ? 'はっぴゃく' : DIGIT_KANA[hu] + 'ひゃく';
  if (te) out += (te === 1 ? '' : DIGIT_KANA[te]) + 'じゅう';
  if (on) out += DIGIT_KANA[on];
  return out;
}

/** Reads a whole number aloud in kana, up to 9999万9999. */
export function numberToKana(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n >= 1e8) return String(n);
  if (n === 0) return 'ぜろ';
  const man = Math.floor(n / 10000), rest = n % 10000;
  return (man ? belowMan(man) + 'まん' : '') + belowMan(rest);
}

/** Counters whose reading changes with the number. Only the ones first-year topics use. */
const COUNTERS: Record<string, (n: number) => string> = {
  円: (n) => (n % 10 === 4 && n % 100 !== 14 ? numberToKana(n).replace(/よん$/, 'よ') : numberToKana(n)) + 'えん',
  時: (n) => ({ 4: 'よじ', 7: 'しちじ', 9: 'くじ' } as Record<number, string>)[n] ?? numberToKana(n) + 'じ',
  分: (n) => {
    const special: Record<number, string> = { 1: 'いっぷん', 3: 'さんぷん', 4: 'よんぷん', 6: 'ろっぷん', 8: 'はっぷん', 10: 'じゅっぷん' };
    return special[n] ?? numberToKana(n) + 'ふん';
  },
  人: (n) => ({ 1: 'ひとり', 2: 'ふたり', 4: 'よにん' } as Record<number, string>)[n] ?? numberToKana(n) + 'にん',
  歳: (n) => ({ 1: 'いっさい', 8: 'はっさい', 10: 'じゅっさい', 20: 'はたち' } as Record<number, string>)[n] ?? numberToKana(n) + 'さい',
  個: (n) => ({ 1: 'いっこ', 6: 'ろっこ', 8: 'はっこ', 10: 'じゅっこ' } as Record<number, string>)[n] ?? numberToKana(n) + 'こ',
};

/** 三百五十 → 350. Returns NaN for anything that isn't a kanji numeral. */
export function parseKanjiNumber(s: string): number {
  let total = 0, section = 0, digit = -1;
  for (const c of s) {
    if (c in KANJI_DIGITS) digit = KANJI_DIGITS[c]!;
    else if (c in KANJI_UNITS) { section += (digit < 0 ? 1 : digit) * KANJI_UNITS[c]!; digit = -1; }
    else if (c === '万') { total += (section + Math.max(digit, 0) || 1) * 10000; section = 0; digit = -1; }
    else return NaN;
  }
  return total + section + Math.max(digit, 0);
}

const NUMBER_RUN = /([0-9０-９][0-9０-９,，]*|[〇零一二三四五六七八九十百千万]+)(円|時|分|人|歳|個)?/g;

/** Replaces every number (and the counter after it) with its kana reading. */
export function readNumbers(s: string): string {
  return s.replace(NUMBER_RUN, (all, num: string, counter: string | undefined) => {
    const ascii = num.normalize('NFKC').replace(/[,，]/g, '');
    const n = /^[0-9]+$/.test(ascii) ? Number(ascii) : parseKanjiNumber(num);
    if (!Number.isFinite(n)) return all;
    // A lone 一 inside a word (一緒, 一つ) isn't a number we can read; leave single kanji digits without a counter.
    if (!/^[0-9]/.test(ascii) && !counter && num.length === 1 && num !== '十') return all;
    return counter ? COUNTERS[counter]!(n) : numberToKana(n);
  });
}

// ---------- Normalising answers ----------

/** Punctuation, spaces and symbols that never change what an answer says. */
const NOISE = /[\s　、。，．,.!?！？・「」『』（）()〜～…:：;；"'“”‘’]/g;

/** One step of comparison: script, width, numbers, long marks, punctuation. Keeps kanji as they are. */
export function normalizeKana(s: string): string {
  const nfkc = readNumbers(s.normalize('NFKC'));
  return expandLongMarks(toHiragana(nfkc).replace(/[〜～]/g, '')).replace(NOISE, '').toLowerCase();
}

/** The forgiving form: particles said as written sounds, long-vowel spellings and じ/ぢ, ず/づ folded. */
export const looseKana = (s: string): string => foldSameSounds(foldLongVowelSpelling(foldParticles(normalizeKana(s))));

/** Levenshtein distance by code point. */
export function editDistance(a: string, b: string): number {
  const x = [...a], y = [...b];
  let prev = Array.from({ length: y.length + 1 }, (_, i) => i);
  for (let i = 1; i <= x.length; i++) {
    const cur = [i];
    for (let j = 1; j <= y.length; j++) cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (x[i - 1] === y[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[y.length]!;
}

/**
 * The difference between two readings is only vowel length or a small っ (おばさん / おばあさん, きて / きって).
 * Those change the meaning, so the judge never accepts them as a typo.
 */
export function differsOnlyInLength(a: string, b: string): boolean {
  if (a === b) return false;
  const strip = (s: string) => {
    let out = '';
    for (const c of s) {
      const v = vowelOf(out.slice(-1));
      if (c === 'っ') continue;
      if ((c === 'あ' || c === 'い' || c === 'う' || c === 'え' || c === 'お') && v && (c === v || (c === 'う' && v === 'お') || (c === 'い' && v === 'え'))) continue;
      out += c;
    }
    return out;
  };
  return strip(a) === strip(b);
}

// ---------- Names ----------

const ROMAJI: [string, string][] = Object.entries({
  kya: 'キャ', kyu: 'キュ', kyo: 'キョ', sha: 'シャ', shu: 'シュ', sho: 'ショ', she: 'シェ', cha: 'チャ', chu: 'チュ', cho: 'チョ', che: 'チェ',
  nya: 'ニャ', nyu: 'ニュ', nyo: 'ニョ', hya: 'ヒャ', hyu: 'ヒュ', hyo: 'ヒョ', mya: 'ミャ', myu: 'ミュ', myo: 'ミョ', rya: 'リャ', ryu: 'リュ', ryo: 'リョ',
  gya: 'ギャ', gyu: 'ギュ', gyo: 'ギョ', bya: 'ビャ', byu: 'ビュ', byo: 'ビョ', pya: 'ピャ', pyu: 'ピュ', pyo: 'ピョ', tsu: 'ツ', shi: 'シ', chi: 'チ',
  ja: 'ジャ', ju: 'ジュ', jo: 'ジョ', je: 'ジェ', ji: 'ジ', fa: 'ファ', fi: 'フィ', fu: 'フ', fe: 'フェ', fo: 'フォ', ti: 'ティ', di: 'ディ', tu: 'トゥ', du: 'ドゥ',
  wi: 'ウィ', we: 'ウェ', wo: 'ウォ', va: 'ヴァ', vi: 'ヴィ', vu: 'ヴ', ve: 'ヴェ', vo: 'ヴォ', si: 'シ', ce: 'セ', ci: 'シ', qu: 'ク', th: 'ス', ph: 'フ',
  ka: 'カ', ki: 'キ', ku: 'ク', ke: 'ケ', ko: 'コ', ga: 'ガ', gi: 'ギ', gu: 'グ', ge: 'ゲ', go: 'ゴ', sa: 'サ', su: 'ス', se: 'セ', so: 'ソ',
  za: 'ザ', zi: 'ジ', zu: 'ズ', ze: 'ゼ', zo: 'ゾ', ta: 'タ', te: 'テ', to: 'ト', da: 'ダ', de: 'デ', do: 'ド', na: 'ナ', ni: 'ニ', nu: 'ヌ', ne: 'ネ', no: 'ノ',
  ha: 'ハ', hi: 'ヒ', he: 'ヘ', ho: 'ホ', ba: 'バ', bi: 'ビ', bu: 'ブ', be: 'ベ', bo: 'ボ', pa: 'パ', pi: 'ピ', pu: 'プ', pe: 'ペ', po: 'ポ',
  ma: 'マ', mi: 'ミ', mu: 'ム', me: 'メ', mo: 'モ', ya: 'ヤ', yu: 'ユ', yo: 'ヨ', ra: 'ラ', ri: 'リ', ru: 'ル', re: 'レ', ro: 'ロ', wa: 'ワ',
  la: 'ラ', li: 'リ', lu: 'ル', le: 'レ', lo: 'ロ', ca: 'カ', cu: 'ク', co: 'コ', xa: 'ザ', a: 'ア', i: 'イ', u: 'ウ', e: 'エ', o: 'オ', y: 'イ',
}).sort((p, q) => q[0].length - p[0].length);
const LONE: Record<string, string> = { k: 'ク', g: 'グ', s: 'ス', z: 'ズ', t: 'ト', d: 'ド', h: 'フ', b: 'ブ', p: 'プ', m: 'ム', r: 'ル', l: 'ル', f: 'フ', v: 'ヴ', w: 'ウ', j: 'ジ', c: 'ク', x: 'クス', q: 'ク' };

/**
 * A best guess at how a player's nickname sounds in katakana, so the host can say it ("Ladi" → ラディ).
 * Names already in kana are kept; anything else unreadable is dropped. A player-supplied reading beats this.
 */
export function nameToKana(name: string): string {
  const s = name.normalize('NFKC').trim();
  if (isSpeakableKana(s)) return s;
  const lower = s.toLowerCase();
  let out = '';
  for (let i = 0; i < lower.length; ) {
    const c = lower[i]!;
    if (!/[a-z]/.test(c)) { if (/[ぁ-ヺー]/.test(c)) out += c; i++; continue; }
    const next = lower[i + 1];
    if (c === 'n' && (!next || !/[aiueoy]/.test(next))) { out += 'ン'; i++; continue; }
    if (next === c && !/[aiueon]/.test(c)) { out += 'ッ'; i++; continue; }
    const hit = ROMAJI.find(([r]) => lower.startsWith(r, i));
    if (hit) { out += hit[1]; i += hit[0].length; continue; }
    out += LONE[c] ?? '';
    i++;
  }
  return out;
}
