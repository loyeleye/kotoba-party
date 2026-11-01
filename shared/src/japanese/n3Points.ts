// Every N3 grammar point, and how Kotoba Party covers it: the Limited Express is "spoken N3" (docs/n3-coverage.md,
// Plan B, chosen by both panels on Nov 1, 2026).
//
// There's no official N3 grammar list: the JLPT stopped publishing one in 2010. This list is the union of the N3
// grammar in Shin Kanzen Master N3, Try! N3, Sō-matome N3 and the JLPT Sensei N3 list, with the JLPT and Japanese
// seats' corrections, all from memory (jlpt.jp and the publishers' sites are blocked from here). A teacher should
// check the bands before any count is shown as a fact.
//
// `fit` says how well the point suits a spoken party game:
// - 'speak': a short line a player says out loud in a 9–12 s turn. With a matcher (`frame`), it counts on its goal.
// - 'listen': common in what people hear (announcements, casual talk, the hosts), rare or odd in what a learner
//   says. It's in the hosts' lines and marked on the station sheet; it never counts toward a goal, and it's
//   credited only once a listening check asks about it (none does yet).
// - 'unchecked': spoken, but its meaning turns on a nuance no matcher can judge from one line (男らしい looks like
//   hearsay らしい). Named on the 通過 card, not taught.
// - 'written': lives in notices, news and essays. Named on the 通過 card, not taught.
//
// `band` is where the textbooks put it. Only band 'n3' points count as N3: the 'n4' ones are N4 review that the
// Limited Express's goals also use (most of 3.8's keigo, the causative-passive), and 'n2' ones sit past N3.
// `edge` flags a point the books disagree on.

import type { FrameId } from './frames.js';

export type N3Fit = 'speak' | 'listen' | 'unchecked' | 'written';
export type N3Band = 'n4' | 'n3' | 'n2';

export interface N3Point {
  /** The frame id when the point has a matcher, else a slug of its own. */
  id: string;
  ja: string;
  en: string;
  fit: N3Fit;
  band: N3Band;
  /** The Limited Express goal it sits on ('' for unchecked and written points). */
  goal: string;
  /** The frame in frames.ts that counts it. */
  frame?: FrameId;
  /** Where the books disagree on its band. */
  edge?: N3Band;
  /** For listen, unchecked and written points: why it isn't a spoken frame. */
  why?: string;
}

type More = Partial<Pick<N3Point, 'band' | 'edge' | 'frame'>>;
const s = (id: string, goal: string, ja: string, en: string, more: More = {}): N3Point => ({ id, ja, en, fit: 'speak', band: 'n3', goal, ...more });
/** A speakable point with a matcher under its own id. */
const f = (id: FrameId, goal: string, ja: string, en: string, more: More = {}): N3Point => s(id, goal, ja, en, { frame: id, ...more });
const l = (id: string, goal: string, ja: string, en: string, why: string, more: More = {}): N3Point => ({ id, ja, en, fit: 'listen', band: 'n3', goal, why, ...more });
const u = (id: string, ja: string, en: string, why: string, more: More = {}): N3Point => ({ id, ja, en, fit: 'unchecked', band: 'n3', goal: '', why, ...more });
const w = (id: string, ja: string, en: string, why: string = WRITTEN, more: More = {}): N3Point => ({ id, ja, en, fit: 'written', band: 'n3', goal: '', why, ...more });

const WRITTEN = 'Mostly written: notices, news and essays.';
const LOOKALIKE = 'Spoken, but it looks just like another pattern, so the game can’t tell when you’ve said it.';
const N4 = { band: 'n4' } as const;

/** In the order of the Limited Express goals, then the points the line passes by. */
export const N3_POINTS: readonly N3Point[] = [
  // 3.1 Rumours and reported speech
  f('rashii', '3.1', '＿らしい', 'apparently (hearsay)', { edge: 'n4' }),
  f('mitai-casual', '3.1', '＿みたい（だ）', 'seems like (casual)', N4),
  f('you-ni-iwareta', '3.1', '＿ように いわれた', 'I was told to', N4),
  l('toka-hearsay', '3.1', '＿とか いってた', 'said something like ___', 'Said with a shrug; it looks just like ＿とか ＿とか. Nobiko-san says it.'),
  // 3.2 What happened to me
  f('suffering-passive', '3.2', '＿に ＿(ら)れて', 'I had ___ happen to me', N4),
  f('saserareru', '3.2', '＿させられた', 'I was made to', { band: 'n4', edge: 'n3' }),
  f('tokoro-deshita', '3.2', '＿ところだった', 'I nearly'),
  f('sasete-morau', '3.2', '＿させて もらう', 'I was allowed to', N4),
  f('kakeru', '3.2', '＿かける ／ ＿かけの', 'half-done, about to'),
  f('kiru', '3.2', '＿きる ／ ＿きれない', 'all of it / can’t all'),
  f('bakari', '3.2', '＿ばかり ／ ＿て ばかり', 'nothing but', { edge: 'n4' }),
  f('ppanashi', '3.2', '＿っぱなし', 'left ___ on, left open', { edge: 'n2' }),
  f('mama', '3.2', '＿た まま', 'still ___, left as it was', { edge: 'n4' }),
  f('darake', '3.2', '＿だらけ', 'covered in, full of'),
  // 3.3 Reasons, results and blame
  f('sei-de', '3.3', '＿せいで', 'because of (blame)'),
  f('okage-de', '3.3', '＿おかげで', 'thanks to'),
  f('tame-reason', '3.3', '＿ため（に）', 'due to (formal)'),
  f('mono-de', '3.3', '＿もので ／ ＿ものだから', 'because (an excuse)'),
  f('wake-desu', '3.3', '＿わけだ', 'no wonder, that’s why'),
  f('n-dakara', '3.3', '＿んだから', 'since (you know very well)'),
  f('gachi', '3.3', '＿がち', 'tend to, prone to'),
  f('datte-mon', '3.3', 'だって ＿もん', 'but… (a childish excuse)'),
  // 3.4 Contrast and concession
  f('wari-ni', '3.4', '＿わりに', 'for (what it is)'),
  f('kuse-ni', '3.4', '＿くせに', 'even though (and yet!)'),
  f('ni-kurabete', '3.4', '＿に くらべて', 'compared with'),
  f('ni-shite-wa', '3.4', '＿に しては', 'for a ___ (it’s surprising)'),
  f('kawari-ni', '3.4', '＿かわりに', 'instead of, in return for'),
  f('dake-de-naku', '3.4', '＿だけで なく ／ ＿だけじゃ なくて', 'not only… but also'),
  f('to-itte-mo', '3.4', '＿と いっても', 'even so, though I say'),
  f('wa-mochiron', '3.4', '＿は もちろん', 'not to mention'),
  f('ue-ni', '3.4', '＿うえに', 'on top of that'),
  // 3.5 What-ifs
  f('to-shitara', '3.5', '＿と したら ／ ＿と すれば', 'supposing'),
  f('ba-hodo', '3.5', '＿ば ＿ほど', 'the more…, the more…'),
  f('sae', '3.5', '＿さえ ＿ば', 'as long as, even'),
  f('to-shitemo', '3.5', '＿と しても', 'even if (supposing)'),
  f('tatoe-temo', '3.5', 'たとえ ＿ても', 'even if'),
  l('you-nara', '3.5', '＿ようなら', 'if it looks like', 'Heard from staff and doctors (つづく ようなら また きて ください). Chōchin-san says it.'),
  // 3.6 Intentions and attempts
  f('you-to-suru', '3.6', '＿ようと する', 'try to, be about to'),
  f('zu-ni', '3.6', '＿ずに', 'without'),
  f('koto-ni-shiteiru', '3.6', '＿ことに して いる', 'I make a point of', N4),
  f('ta-tsumori', '3.6', '＿た つもり', 'I thought I had'),
  s('you-ni-suru', '3.6', '＿ように する ／ して いる', 'make sure to, make a habit of', N4),
  f('zu-ni-sumu', '3.6', '＿ずに すむ ／ ＿なくて すむ', 'get away without having to'),
  f('furi', '3.6', '＿ふりを する', 'pretend to'),
  f('hazu-datta', '3.6', '＿はずだった', 'was supposed to'),
  f('te-kara-de-nai-to', '3.6', '＿てからで ないと', 'not until'),
  f('wo-komete', '3.6', '＿を こめて', 'with (feeling)'),
  // 3.7 Explaining and clarifying
  f('wake-dewa-nai', '3.7', '＿わけでは ない', 'it’s not that'),
  f('beki', '3.7', '＿べきだ', 'should'),
  f('to-iu-koto', '3.7', '＿と いう ことだ', 'I hear / that means'),
  f('to-shite', '3.7', '＿として', 'as a'),
  f('toori-ni', '3.7', '＿とおりに', 'just as', N4),
  f('wake-niwa-ikanai', '3.7', '＿わけには いかない', 'can’t very well'),
  f('koso', '3.7', '＿こそ', 'this one (and no other)'),
  f('to-iu-no-wa', '3.7', '＿と いうのは', '___ means, what ___ is'),
  f('koto-wa-nai', '3.7', '＿ことは ない', 'there’s no need to'),
  f('koto-ni-natteiru', '3.7', '＿ことに なって いる', 'it’s the rule that'),
  f('temo-kamawanai', '3.7', '＿ても かまわない', 'it’s fine if'),
  f('ta-you-ni', '3.7', '＿た ように', 'as (I said), the way'),
  l('mono-da', '3.7', '＿ものだ', 'you ought to / I used to (fondly)', 'Two meanings told apart only by context. Nobiko-san says it.'),
  l('koto-da', '3.7', '＿ことだ', 'the thing to do is', 'Advice from above (teacher to student). Fude says it.'),
  // 3.8 Service Japanese
  f('sasete-itadaku', '3.8', '＿させて いただく', 'I will humbly', { edge: 'n4' }),
  f('de-gozaimasu', '3.8', '＿で ございます', 'it is (very polite)', N4),
  f('te-orimasu', '3.8', '＿て おります', 'we are ___ing (humble)', N4),
  f('go-kudasai', '3.8', 'ご＿ください', 'please (formal)', N4),
  f('kashikomarimashita', '3.8', 'かしこまりました', 'certainly (a set phrase)', N4),
  f('te-itadakitai', '3.8', '＿て いただきたい ／ ＿て もらいたい', 'I’d like you to (politely)'),
  // 3.9 Time and change
  f('uchi-ni', '3.9', '＿うちに', 'while still'),
  f('tabi-ni', '3.9', '＿たびに', 'every time'),
  f('saichuu-ni', '3.9', '＿さいちゅうに', 'right in the middle of'),
  f('te-kita', '3.9', '＿て きた', 'has been ___ing (until now)', { edge: 'n4' }),
  f('totan', '3.9', '＿た とたん', 'the moment'),
  f('dasu', '3.9', '＿だす', 'suddenly start', { edge: 'n4' }),
  f('te-iku', '3.9', '＿て いく', 'will keep ___ing (from now)', { edge: 'n4' }),
  f('ni-tsurete', '3.9', '＿に つれて', 'as (one changes, so does the other)'),
  f('tsuide-ni', '3.9', '＿ついでに', 'while you’re at it'),
  f('te-hajimete', '3.9', '＿て はじめて', 'only after'),
  f('buri', '3.9', '＿ぶり', 'for the first time in (ごねんぶり)'),
  f('te-irai', '3.9', '＿て いらい', 'ever since'),
  l('oki-ni', '3.9', '＿おきに', 'every other, at intervals of', 'Timetables and announcements (ごふん おきに). Chōchin-san says it.'),
  l('goto-ni', '3.9', '＿ごとに', 'each, every', 'Timetables, rules and notices. Chōchin-san says it.'),
  l('kara-ni-kakete', '3.9', '＿から ＿に かけて', 'from… through…', 'Weather reports and announcements.'),
  l('osore-ga-aru', '3.9', '＿おそれが ある', 'there’s a risk of', 'Weather and news warnings.', { edge: 'n2' }),
  // 3.10 Opinions and debate
  f('you-na-ki', '3.10', '＿ような きが する', 'I have a feeling'),
  f('ni-chigainai', '3.10', '＿に ちがいない', 'it must be'),
  f('ni-taishite', '3.10', '＿に たいして', 'towards, against'),
  f('shika-nai', '3.10', '＿る しか ない', 'no choice but to'),
  f('sorenanoni', '3.10', 'それなのに', 'and yet'),
  f('tsumari', '3.10', 'つまり', 'in other words'),
  f('hazu-ga-nai', '3.10', '＿はずが ない', 'there’s no way'),
  f('ni-totte', '3.10', '＿に とって', 'for, in ___’s eyes'),
  f('ni-kimatteiru', '3.10', '＿に きまって いる', 'it’s bound to be, of course'),
  f('to-wa-kagiranai', '3.10', '＿とは かぎらない', 'not necessarily', { edge: 'n2' }),
  f('ni-yotte', '3.10', '＿に よって（ちがう）', 'depending on'),
  f('to-iu-yori', '3.10', '＿と いうより', 'rather than, more like'),
  f('nai-koto-wa-nai', '3.10', '＿ない ことは ない', 'it’s not that ___ not'),
  f('wake-ga-nai', '3.10', '＿わけが ない', 'no way (that could be)'),
  f('n-janai', '3.10', '＿んじゃ ない？', 'isn’t it? (I think so)'),
  f('hodo-wa-nai', '3.10', '＿ほど ＿は ない', 'nothing is as ___ as'),
  f('sou-ni-nai', '3.10', '＿そうに ない', 'doesn’t look like it will'),
  l('you-ga-nai', '3.10', '＿ようが ない', 'there’s no way to', 'Heard in complaints; it follows the ます stem (なおしようが ない).', { edge: 'n2' }),
  // 3.11 Casual nuance
  f('ppoi', '3.11', '＿っぽい', '-ish'),
  f('nante', '3.11', '＿なんて ／ ＿なんか', 'something like (!)'),
  f('toka', '3.11', '＿とか ＿とか', 'things like', N4),
  f('kke', '3.11', '＿っけ', 'what was it again?'),
  f('te-shouganai', '3.11', '＿て しょうがない ／ ＿て たまらない', 'so ___ I can’t stand it'),
  f('hodo-degree', '3.11', '＿ほど ／ ＿くらい', 'so much that (なみだが でる ほど)'),
  s('nakya', '3.11', '＿なきゃ ／ ＿なくちゃ', 'gotta (casual must)', N4),
  f('you-ni-wish', '3.11', '＿ますように', 'I hope that (a wish)'),
  f('muke-muki', '3.11', '＿むけ ／ ＿むき', 'meant for, suited to'),
  f('tate', '3.11', '＿たて', 'fresh from (やきたて)'),
  f('to-ieba', '3.11', '＿と いえば ／ ＿と いうと', 'speaking of'),
  l('jan', '3.11', '＿じゃん', 'isn’t it? (casual)', 'Normal among friends, but too casual for anyone older. Pon says it.', { frame: 'jan' }),
  l('kashira', '3.11', '＿かしら', 'I wonder', 'Sounds feminine or older. Nobiko-san says it.'),
  l('gimi', '3.11', '＿ぎみ', 'a touch of (かぜぎみ)', 'A handful of fixed words (かぜぎみ, つかれぎみ). Nobiko-san says it.'),
  l('te-goran', '3.11', '＿て ごらん', 'try ___ing (to a child)', 'Said by grown-ups to children.'),
  // Passed by: spoken, but a look-alike no matcher can tell apart.
  f('rashii-typical', '3.11', '＿らしい（あなたらしい）', 'typical of, true to'),
  f('tokoro-ni', '3.9', '＿ところに ／ ＿ところへ', 'just as (someone came)', { edge: 'n2' }),
  f('kiri', '3.9', '＿きり', 'only, ever since', { edge: 'n2' }),
  f('gurai-at-least', '3.11', '＿ぐらい', 'at least (それぐらい わかる)'),
  f('tte-topic', '3.11', '＿って', 'as for ___ (casual topic)'),
  f('noun-sa-mi', '3.11', '＿さ ／ ＿み', 'making nouns (たかさ, おもみ)'),
  // Passed by: written Japanese.
  w('ni-kanshite', '＿に かんして', 'concerning, about'),
  w('wo-hajime', '＿を はじめ', 'starting with, including'),
  w('wo-chuushin', '＿を ちゅうしんに', 'centred on'),
  w('wo-moto-ni', '＿を もとに', 'based on', WRITTEN, { edge: 'n2' }),
  w('to-tomo-ni', '＿と ともに', 'together with, as'),
  w('koto-kara', '＿ことから', 'from the fact that', WRITTEN, { edge: 'n2' }),
  w('kekka', '＿けっか', 'as a result of'),
  w('zu-written', '＿ず（、）', 'not (written)'),
  w('koto-instruction', '＿こと', 'you must (on notices)', 'Rules on notices (ろうかを はしらない こと).'),
  w('ni-shitagatte', '＿に したがって', 'as, in step with', 'A formal ＿に つれて, mostly written.', { edge: 'n2' }),
  w('wo-tsuujite', '＿を つうじて ／ ＿を とおして', 'through, by way of'),
  // Past N3 (the JLPT and Japanese seats): kept so the counts show where they went.
  w('ippou-de', '＿いっぽうで', 'while, on the other hand', 'Mostly heard in the news. N2 in most books.', { band: 'n2' }),
  w('koto-ni-emotion', '＿ことに（ざんねんな ことに）', 'to my ___', 'Written. N2 in most books.', { band: 'n2' }),
];

export const N3_POINT_BY_ID: Readonly<Record<string, N3Point>> = Object.fromEntries(N3_POINTS.map((x) => [x.id, x]));

const n3 = N3_POINTS.filter((x) => x.band === 'n3');
/**
 * The counts the phone shows. Only band 'n3' points count; N4 review and N2 points are left out. `said` is the
 * speakable N3 points that have a matcher, the most a player can be told they've said.
 */
export const N3_COUNTS = {
  speak: n3.filter((x) => x.fit === 'speak').length,
  said: n3.filter((x) => x.fit === 'speak' && x.frame).length,
  listen: n3.filter((x) => x.fit === 'listen').length,
  unchecked: n3.filter((x) => x.fit === 'unchecked').length,
  written: n3.filter((x) => x.fit === 'written').length,
  /** Passed by: the 通過 card. */
  passed: n3.filter((x) => x.fit === 'unchecked' || x.fit === 'written').length,
  n4Review: N3_POINTS.filter((x) => x.band === 'n4').length,
  all: n3.length,
};

/** About how many N3 kanji the line passes by: the band's ~370 (from memory) less the 30 sign kanji on 3.12. */
export const N3_KANJI_PASSED = 340;

/** A goal's listening points, for its station sheet. */
export const listenPointsOf = (goal: string): N3Point[] => N3_POINTS.filter((x) => x.goal === goal && x.fit === 'listen');
/** The points the 通過 card names, in two groups. */
export const passedPoints = (): { unchecked: N3Point[]; written: N3Point[] } => ({
  unchecked: n3.filter((x) => x.fit === 'unchecked'),
  written: n3.filter((x) => x.fit === 'written'),
});
/** The N3 frames that count as band N3 (the cleared screen's "said" count). */
export const N3_BAND_FRAMES: ReadonlySet<string> = new Set(n3.filter((x) => x.fit === 'speak' && x.frame).map((x) => x.frame!));
