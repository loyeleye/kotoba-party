// The learning path, version 2 (docs/progressive-learning.md): four lines, Kana → N5 → N4 → N3, made of 40
// can-do goals worked back from the N5 and N4 syllabus. A goal is met when the player has said its core
// sentence frames from memory, with their own words in the gaps, on more than one day. It's opt-in,
// signed-in only, and shows on that player's phone only: the TV and the games don't change for anyone.
//
// Pure rules. The account service (server/src/accounts.ts) marks frames and goals as games and reviews are
// saved (markPath), and sends the result with My progress (pathStatus). The phone only draws it.

import { kana } from '../../content/src/kana/kana.js';
import { writeKanji } from '../../content/src/kanji/kanji.js';
import { readTheSigns } from '../../content/src/last-train/read-the-signs.js';
import { FRAME_BY_ID } from './japanese/frames.js';
import { toRomaji } from './japanese/romaji.js';
import { MODES, noFit } from './modes/registry.js';
import { YIELDS } from './pathYields.js';
import { DAY_MS, FRAME_FILLERS, FRAME_GAP_DAYS, FRAME_SAYS, dayOf, frameRules, markFrames, ruleMet, ruleProgress, type FrameMark, type FrameRule, type Progress } from './progress.js';
import type { Level, ModeId } from './protocol.js';

// ---- lines ----

export type LineId = 'kana' | 'local' | 'express' | 'limited';

export interface Line {
  id: LineId;
  /** Our own names only (the level picker keeps New, N5 and N4). */
  name: string;
  ja: string;
  /** The level this line belongs to, and the level clearing it offers. */
  level: Level;
  up: Level | null;
}

export const LINES: readonly Line[] = [
  { id: 'kana', name: 'Kana Line', ja: 'かな線', level: 'kana', up: 'n5' },
  { id: 'local', name: 'Local Line', ja: '各駅停車', level: 'n5', up: 'n4' },
  { id: 'express', name: 'Express Line', ja: '急行', level: 'n4', up: 'n3' },
  { id: 'limited', name: 'Limited Express Line', ja: '特急', level: 'n3', up: null },
];
export const LINE_BY_ID: Readonly<Record<LineId, Line>> = Object.fromEntries(LINES.map((l) => [l.id, l])) as Record<LineId, Line>;
export const lineFor = (level: Level): Line => LINES.find((l) => l.level === level)!;

// ---- frames the goals name ----

/**
 * Every frame a goal names, with its own label and hand-written rōmaji (the Kana level reads rōmaji on all
 * three surfaces). Ids not yet in frames.ts show as "coming soon": a goal that needs one can't be met until
 * its matcher lands. frames.ts's own text wins once it has the id.
 */
export const FRAME_TEXT: Readonly<Record<string, { ja: string; en: string; romaji: string }>> = {
  // In frames.ts today.
  'wa-desu': { ja: '＿は ＿です', en: 'A is B', romaji: '___ wa ___ desu' },
  desu: { ja: '＿です', en: "It's ___", romaji: '___ desu' },
  ka: { ja: '＿ですか ／ ＿ますか', en: 'Is it ___? / Do you ___?', romaji: '___ desu ka / ___ masu ka' },
  'ja-nai': { ja: '＿は ＿じゃないです', en: "A isn't B", romaji: '___ wa ___ ja nai desu' },
  sou: { ja: 'そうです ／ ちがいます', en: "That's right / That's not it", romaji: 'sō desu / chigaimasu' },
  kudasai: { ja: '＿を ください', en: '___, please', romaji: '___ o kudasai' },
  doko: { ja: '＿は どこですか', en: 'Where is ___?', romaji: '___ wa doko desu ka' },
  nan: { ja: '＿は なんですか', en: 'What is ___?', romaji: '___ wa nan desu ka' },
  suki: { ja: '＿が すきです', en: 'I like ___', romaji: '___ ga suki desu' },
  'ni-aru': { ja: '＿に ＿が あります', en: 'There is ___ (at ___)', romaji: '___ ni ___ ga arimasu' },
  'o-masu': { ja: '＿を ＿ます', en: 'I do ___ (to something)', romaji: '___ o ___ masu' },
  mashita: { ja: '＿ました', en: 'I did ___', romaji: '___ mashita' },
  tai: { ja: '＿たいです', en: 'I want to ___', romaji: '___ tai desu' },
  'te-kudasai': { ja: '＿て ください', en: 'Please ___', romaji: '___ te kudasai' },
  'masen-ka': { ja: '＿ませんか', en: "Won't you ___?", romaji: '___ masen ka' },
  'te-mo-ii': { ja: '＿ても いいですか', en: 'May I ___?', romaji: '___ te mo ii desu ka' },
  // N5, coming in frames.ts.
  ikura: { ja: '＿は いくらですか', en: 'How much is ___?', romaji: '___ wa ikura desu ka' },
  'ji-fun': { ja: '＿じ ＿ふん／ぷんです', en: "It's ___:___", romaji: '___ ji ___ fun/pun desu' },
  'ni-masu': { ja: '＿じに ＿ます', en: "I ___ at ___ o'clock", romaji: '___ ji ni ___ masu' },
  youbi: { ja: '＿ようび', en: '___day', romaji: '___ yōbi' },
  'gatsu-nichi': { ja: '＿がつ ＿にち', en: 'month ___, day ___', romaji: '___ gatsu ___ nichi' },
  'wa-ni-aru': { ja: '＿は ＿に あります', en: '___ is at ___', romaji: '___ wa ___ ni arimasu' },
  'migi-hidari': { ja: 'みぎ ／ ひだり', en: 'right / left', romaji: 'migi / hidari' },
  hoshii: { ja: '＿が ほしいです', en: 'I want ___', romaji: '___ ga hoshii desu' },
  'de-o': { ja: '＿で ＿を ＿ます', en: 'I do ___ at ___', romaji: '___ de ___ o ___ masu' },
  'te-iru': { ja: '＿て います', en: "I'm ___ing", romaji: '___ te imasu' },
  no: { ja: '＿の ＿', en: "A's B", romaji: '___ no ___' },
  'adj-desu': { ja: '＿いです ／ ＿です（な-adj.）', en: "It's ___ (adjective)", romaji: '___i desu / ___ desu (na-adj.)' },
  kunai: { ja: '＿くないです', en: "It isn't ___", romaji: '___ kunai desu' },
  kara: { ja: '＿から', en: 'because ___', romaji: '___ kara' },
  'hou-ga': { ja: '＿の ほうが ＿', en: 'A is more …', romaji: '___ no hō ga ___' },
  mashou: { ja: '＿ましょう', en: "Let's ___", romaji: '___ mashō' },
  'naide-kudasai': { ja: '＿ないで ください', en: "Please don't ___", romaji: '___ naide kudasai' },
  // N4, coming in frames.ts.
  'te-moraeru': { ja: '＿て もらえますか', en: 'Could you ___ for me?', romaji: '___ te moraemasu ka' },
  'te-kuremasen': { ja: '＿て くれませんか', en: 'Would you ___ for me?', romaji: '___ te kuremasen ka' },
  'ageru-kureru': { ja: 'あげます ／ くれます ／ もらいます', en: 'give / give me / get', romaji: 'agemasu / kuremasu / moraimasu' },
  'te-wa-ikenai': { ja: '＿ては いけません', en: "You mustn't ___", romaji: '___ te wa ikemasen' },
  nakereba: { ja: '＿なければ なりません', en: 'I must ___', romaji: '___ nakereba narimasen' },
  'nakutemo-ii': { ja: '＿なくても いいです', en: "You don't have to ___", romaji: '___ nakute mo ii desu' },
  'ta-koto': { ja: '＿た ことが あります', en: "I've ___ before", romaji: '___ ta koto ga arimasu' },
  'te-miru': { ja: '＿て みたいです', en: 'I want to try ___', romaji: '___ te mitai desu' },
  'te-shimau': { ja: '＿て しまいました', en: 'I ended up ___', romaji: '___ te shimaimashita' },
  potential: { ja: '＿られます ／ ＿えます', en: 'I can ___', romaji: '___ raremasu / ___ emasu' },
  tara: { ja: '＿たら', en: 'if / when ___', romaji: '___ tara' },
  ba: { ja: '＿ば', en: 'if ___', romaji: '___ ba' },
  toki: { ja: '＿とき', en: 'when ___', romaji: '___ toki' },
  nara: { ja: '＿なら', en: 'if it’s ___', romaji: '___ nara' },
  'to-cond': { ja: '＿と', en: 'whenever ___', romaji: '___ to' },
  'sou-look': { ja: '＿そうです（おいしそう）', en: 'It looks ___', romaji: '___ sō desu (oishisō)' },
  'sou-hear': { ja: '＿いそうです／＿るそうです（おいしいそう）', en: 'I hear ___', romaji: '___ i sō desu / ___ ru sō desu (oishii sō)' },
  'ni-yoru': { ja: '＿に よると ＿そうです', en: 'According to ___, I hear ___', romaji: '___ ni yoru to ___ sō desu' },
  'n-datte': { ja: '＿んだって（してるんだって）', en: 'They say ___ (casual)', romaji: '___ n datte (shiteru n datte)' },
  'to-omou': { ja: '＿と おもいます', en: 'I think ___', romaji: '___ to omoimasu' },
  kamo: { ja: '＿かもしれません', en: 'It might be ___', romaji: '___ kamo shiremasen' },
  'you-to-omou': { ja: '＿(よ)うと おもいます', en: "I'm thinking of ___ing", romaji: '___ (y)ō to omoimasu' },
  tsumori: { ja: '＿つもりです', en: 'I plan to ___', romaji: '___ tsumori desu' },
  'hou-ga-ii': { ja: '＿た ほうが いいです', en: 'You should ___', romaji: '___ ta hō ga ii desu' },
  plain: { ja: '＿（だ）よ ／ ＿ね ／ ＿の？', en: 'Casual: plain form + よ, ね, の?', romaji: '___ (da) yo / ___ ne / ___ no?' },
  'n-da': { ja: '＿んだ', en: "it's that ___", romaji: '___ n da' },
  teru: { ja: '＿てる', en: "___ing (casual)", romaji: '___ teru' },
  'o-kudasai': { ja: 'お／ご＿ください', en: 'Please ___ (polite)', romaji: 'o/go ___ kudasai' },
  'te-itadakemasen': { ja: '＿て いただけませんか', en: 'Could you kindly ___?', romaji: '___ te itadakemasen ka' },
  'o-suru': { ja: 'お／ご＿します', en: "I'll ___ for you (humble)", romaji: 'o/go ___ shimasu' },
  // N4 the goals left out at first, optional on their goals (Ladi, Nov 1).
  'te-hoshii': { ja: '＿て ほしいです', en: 'I want you to ___', romaji: '___ te hoshii desu' },
  causative: { ja: '＿させます ／ ＿せます', en: 'make / let ___ do it', romaji: '___ sasemasu / ___ semasu' },
  'sasete-kudasai': { ja: '＿させて ください', en: 'Let me ___', romaji: '___ sasete kudasai' },
  'ba-yokatta': { ja: '＿ば よかったです', en: 'I should have ___', romaji: '___ ba yokatta desu' },
  'tari-tari': { ja: '＿たり ＿たり します', en: 'do things like ___ and ___', romaji: '___ tari ___ tari shimasu' },
  'mitai-you': { ja: '＿みたいです ／ ＿ようです', en: "It seems ___ / It's like ___", romaji: '___ mitai desu / ___ yō desu' },
  'n-desu': { ja: '＿んです', en: "It's that ___ (explaining)", romaji: '___ n desu' },
  // N3, the Limited Express Line: coming in frames.ts. Draft, for a fluent check.
  'mitai-casual': { ja: '＿みたい（だよ）', en: 'Seems ___ (casual)', romaji: '___ mitai (da yo)' },
  'suffering-passive': { ja: '＿に ＿(ら)れて', en: '___ did it to me (and I suffered), as in あめに ふられて', romaji: '___ ni ___ (ra)rete' },
  saserareru: { ja: '＿させられました', en: 'I was made to ___', romaji: '___ saseraremashita' },
  'tokoro-deshita': { ja: '（もうすこしで）＿る ところでした', en: 'I nearly ___ (but didn’t)', romaji: '(mō sukoshi de) ___ ru tokoro deshita' },
  'sasete-morau': { ja: '＿させて もらいました', en: 'I was allowed to ___', romaji: '___ sasete moraimashita' },
  'sei-de': { ja: '＿せいで', en: 'because of ___ (blame)', romaji: '___ sei de' },
  'okage-de': { ja: '＿おかげで', en: 'thanks to ___', romaji: '___ okage de' },
  'wake-desu': { ja: '＿わけです', en: "That's why ___", romaji: '___ wake desu' },
  'wari-ni': { ja: '＿わりに', en: 'for ___, considering ___', romaji: '___ wari ni' },
  'kuse-ni': { ja: '＿くせに', en: 'even though ___ (and I resent it)', romaji: '___ kuse ni' },
  'ni-kurabete': { ja: '＿に くらべて', en: 'compared with ___', romaji: '___ ni kurabete' },
  // The twelve more N3 points, optional on their goals (Ladi, Nov 1).
  'you-ni-iwareta': { ja: '＿ように いわれました', en: 'I was told / asked to ___', romaji: '___ yō ni iwaremashita' },
  'mono-de': { ja: '＿もので', en: 'because ___ (an excuse)', romaji: '___ mono de' },
  'kakeru': { ja: '＿かけの ／ ＿かけました', en: 'half-___ / nearly ___', romaji: '___ kake no / ___ kakemashita' },
  'kiru': { ja: '＿きる ／ ＿きれない', en: "___ it all / can't ___ it all", romaji: '___ kiru / ___ kirenai' },
  'dasu': { ja: '＿だす', en: 'suddenly start ___ing', romaji: '___ dasu' },
  'totan': { ja: '＿た とたん（に）', en: 'the moment ___', romaji: '___ ta totan (ni)' },
  'wake-niwa-ikanai': { ja: '＿わけには いきません', en: "I can't very well ___", romaji: '___ wake ni wa ikimasen' },
  'hazu-ga-nai': { ja: '＿はずが ありません', en: "There's no way ___", romaji: '___ hazu ga arimasen' },
  'ni-totte': { ja: '＿に とって', en: "for ___ / in ___'s eyes", romaji: '___ ni totte' },
  'sae': { ja: '＿さえ ＿ば', en: 'as long as ___ / even ___', romaji: '___ sae ___ ba' },
  'koso': { ja: '＿こそ', en: '___, and no other / this time for sure (こんどこそ)', romaji: '___ koso' },
  'bakari': { ja: '＿ばかり ／ ＿て ばかり', en: 'nothing but ___', romaji: '___ bakari / ___ te bakari' },
  'to-shitara': { ja: '＿としたら', en: 'supposing ___', romaji: '___ to shitara' },
  'ba-hodo': { ja: '＿ば ＿ほど', en: 'the more you ___, the more … (たべれば たべるほど)', romaji: '___ ba ___ hodo' },
  'you-to-suru': { ja: '＿(よ)うと しました', en: 'I tried to ___', romaji: '___ (y)ō to shimashita' },
  'zu-ni': { ja: '＿ずに', en: 'without ___ing', romaji: '___ zu ni' },
  'koto-ni-shiteiru': { ja: '＿ことに して います', en: 'I make a point of ___', romaji: '___ koto ni shite imasu' },
  'ta-tsumori': { ja: '＿た つもりでした', en: 'I thought I had ___', romaji: '___ ta tsumori deshita' },
  'wake-dewa-nai': { ja: '＿わけでは ありません', en: "It's not that ___", romaji: '___ wake de wa arimasen' },
  beki: { ja: '＿べきです', en: 'You ought to ___', romaji: '___ beki desu' },
  'to-iu-koto': { ja: '＿と いう ことです', en: 'That means ___ / I hear ___', romaji: '___ to iu koto desu' },
  'to-shite': { ja: '＿として', en: 'as ___ (in the role of)', romaji: '___ to shite' },
  'toori-ni': { ja: '＿とおりに', en: 'just as ___', romaji: '___ tōri ni' },
  'sasete-itadaku': { ja: '＿させて いただきます', en: "I'll ___ (humbly)", romaji: '___ sasete itadakimasu' },
  'de-gozaimasu': { ja: '＿で ございます', en: 'It is ___ (formal)', romaji: '___ de gozaimasu' },
  'te-orimasu': { ja: '＿て おります', en: "We're ___ing (humble)", romaji: '___ te orimasu' },
  'go-kudasai': { ja: 'ご＿ください', en: 'Please ___ (formal)', romaji: 'go ___ kudasai' },
  kashikomarimashita: { ja: 'かしこまりました', en: 'Certainly', romaji: 'kashikomarimashita' },
  'tabi-ni': { ja: '＿たびに', en: 'every time ___', romaji: '___ tabi ni' },
  'saichuu-ni': { ja: '＿さいちゅうに', en: 'in the middle of ___', romaji: '___ saichū ni' },
  'te-kita': { ja: '＿て きました', en: "It's been getting ___ (change up to now)", romaji: '___ te kimashita' },
  'you-na-ki': { ja: '＿ような きが します', en: 'I have a feeling ___', romaji: '___ yō na ki ga shimasu' },
  'ni-chigainai': { ja: '＿に ちがい ありません', en: 'It must be ___ / I bet ___', romaji: '___ ni chigai arimasen' },
  'ni-taishite': { ja: '＿に たいして', en: 'towards ___ / against ___', romaji: '___ ni taishite' },
  'shika-nai': { ja: '＿る しか ありません', en: 'There’s no choice but to ___', romaji: '___ ru shika arimasen' },
  sorenanoni: { ja: 'それなのに', en: 'and yet', romaji: 'sorenanoni' },
  tsumari: { ja: 'つまり', en: 'in other words', romaji: 'tsumari' },
  ppoi: { ja: '＿っぽい', en: '___-ish', romaji: '___ ppoi' },
  nante: { ja: '＿なんて', en: 'something like ___ (!)', romaji: '___ nante' },
  toka: { ja: '＿とか', en: '___ and stuff', romaji: '___ toka' },
};

/** A frame's text for the phone: frames.ts's own when it has the id, else ours. */
export function frameText(id: string): { ja: string; en: string; romaji: string } {
  const ours = FRAME_TEXT[id];
  const theirs = (FRAME_BY_ID as Readonly<Record<string, { ja: string; en: string } | undefined>>)[id];
  if (theirs) return { ja: theirs.ja, en: theirs.en, romaji: ours?.romaji ?? toRomaji(theirs.ja.replace(/＿/g, ' ___ ')) };
  return ours ?? { ja: id, en: id, romaji: id };
}

/** frames.ts can find this frame in a phrase today. */
export const frameReady = (id: string): boolean => id in FRAME_BY_ID;

// ---- goals ----

/** One required frame, or any one of a few (5.7's question: か, なんですか or どこですか). */
export type FrameNeed = string | readonly string[];
const needIds = (n: FrameNeed): readonly string[] => (typeof n === 'string' ? [n] : n);

export type GoalKind = 'frames' | 'kana' | 'set' | 'kanji';

export interface Goal {
  id: string;
  line: LineId;
  title: string;
  /** Why this goal, in one line. */
  why: string;
  kind: GoalKind;
  /** Required frames (bold in the tiers doc): all must be met. */
  need: readonly FrameNeed[];
  /** Frames that count toward it but aren't required. */
  also: readonly string[];
  /** Games where players actually say this, best first. */
  games: readonly ModeId[];
  /** No content yet: hidden on the map and left out of clearing its line. */
  gap?: string;
  /** Thin content (one game only): shown, with this note. */
  thin?: string;
}

/** Kana goals are met at 90% of the script, so nobody has to hunt the last ヂ. */
export const KANA_SHARE = 0.9;
/** Kanji goals: this many read on 2 days. */
export const KANJI_GOAL = 30;
/** Set phrases (K3): this many of the 8, each said on 2 days. */
export const SET_GOAL = 6;
/** Kana, kanji and set phrases count once said from memory on this many days. */
export const ITEM_DAYS = 2;

/**
 * K3's set phrases, with the everyday variants that count too. A phrase matches at the start of a line or
 * after a space or punctuation, with spaces inside ignored. Draft: needs a fluent check.
 */
export const SET_PHRASES: readonly { ja: string; romaji: string; en: string; also?: readonly string[] }[] = [
  { ja: 'おはようございます', romaji: 'ohayō gozaimasu', en: 'Good morning', also: ['おはよう'] },
  { ja: 'こんにちは', romaji: 'konnichiwa', en: 'Hello' },
  { ja: 'こんばんは', romaji: 'konbanwa', en: 'Good evening' },
  { ja: 'ありがとうございます', romaji: 'arigatō gozaimasu', en: 'Thank you', also: ['ありがとうございました', 'ありがとう'] },
  { ja: 'すみません', romaji: 'sumimasen', en: 'Excuse me / sorry', also: ['すいません'] },
  { ja: 'ごめんなさい', romaji: 'gomen nasai', en: "I'm sorry", also: ['ごめん'] },
  { ja: 'はじめまして', romaji: 'hajimemashite', en: 'Nice to meet you' },
  { ja: 'よろしく おねがいします', romaji: 'yoroshiku onegai shimasu', en: "Glad to know you (lit. 'please be good to me')", also: ['よろしくおねがいいたします'] },
];

const g = (id: string, line: LineId, title: string, why: string, need: FrameNeed[], also: string[], games: ModeId[], more: Partial<Goal> = {}): Goal => ({
  id,
  line,
  title,
  why,
  kind: 'frames',
  need,
  also,
  games,
  ...more,
});

/** The 40 goals in order, from the tiers doc (v2). Frame first, not game: any game that uses a frame counts. */
export const GOALS: readonly Goal[] = [
  g('K1', 'kana', 'Read and say hiragana', 'Every other game is easier once kana stop being squiggles.', [], [], ['kana-raid', 'shodo', 'concentration'], { kind: 'kana' }),
  g('K2', 'kana', 'Read and say katakana', 'Menus, names and loanwords: コーヒー, ティー, ファン.', [], [], ['kana-raid', 'shodo'], { kind: 'kana' }),
  g('K3', 'kana', 'Greet, thank, apologise', 'Eight set phrases get you through any first meeting.', [], [], ['last-train', 'hajimemashite', 'happyokai'], { kind: 'set' }),
  g('K4', 'kana', 'Say who you are', 'Your first frame: put your name or job in the gap.', ['desu'], ['wa-desu'], ['hajimemashite', 'omiai']),
  g('5.1', 'local', 'Introduce yourself and others', '＿は ＿です and its opposite say almost anything about anyone.', ['wa-desu', 'ja-nai'], ['no'], ['hajimemashite', 'omiai', 'happyokai']),
  g('5.2', 'local', 'Shop and order, with how many', 'Ask for things and ask the price: ふたつ, さんこ, いっぽん.', ['kudasai', 'ikura'], [], ['bento-haus', 'bento-haus-vs', 'last-train', 'phrase-bingo']),
  g('5.3', 'local', 'Times, days and dates', 'Say when: the time, the day, the date.', ['ji-fun', 'ni-masu'], ['youbi', 'gatsu-nichi'], ['last-train', 'narabete']),
  g('5.4', 'local', 'Find your way', 'Ask where something is and understand the answer.', ['doko', ['wa-ni-aru', 'ni-aru']], ['migi-hidari'], ['last-train', 'tourist', 'oogiri']),
  g('5.5', 'local', 'Likes and wants', 'Say what you like and what you want to do.', ['suki', 'tai'], ['hoshii'], ['hajimemashite', 'omiai', 'oogiri', 'tourist']),
  g('5.6', 'local', 'Talk about your day', 'Say what you do and what you did.', ['o-masu', 'mashita'], ['de-o', 'te-iru'], ['happyokai', 'narabete', 'oogiri']),
  g('5.7', 'local', 'Ask and answer', 'Turn any sentence into a question, and answer one.', [['ka', 'nan', 'doko'], 'sou'], [], ['tourist', 'onsen-murder', 'omiai']),
  g('5.8', 'local', 'Describe and give reasons', 'Say what something is like, and why.', ['adj-desu', ['kunai', 'ja-nai']], ['kara', 'hou-ga'], ['happyokai', 'tourist', 'narabete', 'omiai']),
  g('5.9', 'local', 'Invite, offer, ask', 'Invite softly, and ask someone to do something.', ['masen-ka', 'te-kudasai'], ['mashou', 'naide-kudasai'], ['omiai', 'phrase-bingo', 'oogiri']),
  g('5.10', 'local', 'Read N5 kanji', 'The kanji on signs, menus and calendars.', [], [], ['shodo', 'last-train'], { kind: 'kanji' }),
  g('4.1', 'express', 'Ask favours', 'Ask someone to do something for you.', ['te-moraeru'], ['ageru-kureru', 'te-kuremasen', 'te-hoshii'], ['phrase-bingo', 'bento-haus', 'last-train']),
  g('4.2', 'express', "May, must, mustn't", 'Ask permission, and say what you must or mustn’t do.', ['te-mo-ii'], ['te-wa-ikenai', 'nakereba', 'nakutemo-ii', 'sasete-kudasai', 'causative'], ['tourist', 'yokai-court', 'phrase-bingo']),
  g('4.3', 'express', 'Experiences and tries', "Say what you've done, and what you'd like to try.", ['ta-koto'], ['te-miru', 'te-shimau', 'ba-yokatta', 'tari-tari'], ['hajimemashite', 'happyokai', 'phrase-bingo']),
  g('4.4', 'express', 'Say what you can do', 'たべられます, はなせます: say what you can and can’t.', ['potential'], [], ['phrase-bingo', 'tourist', 'late-again']),
  g('4.5', 'express', 'If and when', 'Say what happens if, and when.', ['tara'], ['ba', 'toki', 'nara', 'to-cond', 'noni'], ['phrase-bingo', 'tourist', 'happyokai', 'oogiri', 'late-again']),
  g('4.6', 'express', 'Guess, hearsay, opinion', 'Say how it looks, what you heard and what you think.', ['sou-look', 'to-omou', ['sou-hear', 'ni-yoru', 'n-datte']], ['kamo', 'mitai-you'], ['phrase-bingo', 'happyokai', 'tourist', 'last-train', 'word-gauntlet', 'yokai-court', 'hajimemashite']),
  g('4.7', 'express', 'Plans and advice', 'Say what you plan to do, and give advice.', ['you-to-omou'], ['tsumori', 'hou-ga-ii', 'tara-dou'], ['ghost-hotline'], { gap: 'Ghost Advice Hotline gives advice (＿た ほうが いいです, ＿たら どうですか), but no game asks for plans yet.' }),
  g('4.8', 'express', 'Talk casually with friends', 'Plain form with よ, ね and の: how friends talk.', ['plain'], ['n-da', 'teru'], ['omiai', 'dub-club']),
  g('4.9', 'express', 'Speak politely to strangers', 'The extra-polite asks for shops, stations and offices.', ['te-itadakemasen', ['o-kudasai', 'o-suru']], ['n-desu'], ['omiai', 'happyokai', 'bento-haus', 'last-train']),
  g('4.10', 'express', 'Read N4 kanji', 'The next kanji up: verbs, places and time words.', [], [], ['shodo', 'last-train'], { kind: 'kanji' }),
  g('4.11', 'express', 'Reasons and too much', 'Give reasons politely, say what was too much, and do two things at once.', ['node', 'sugiru'], ['nagara', 'shi'], ['late-again', 'happyokai', 'narabete']),
  g('4.12', 'express', 'Change and decisions', 'Say what changed, and what you or others decided.', ['you-ni-naru', 'koto-ni-suru'], ['koto-ni-naru'], ['happyokai', 'ghost-hotline', 'oogiri']),
  g('4.13', 'express', 'Passive, easy and hard', 'Say what was done to you, and how easy or hard something is to do.', ['passive'], ['yasui-nikui'], ['late-again', 'onsen-murder']),
  g('4.14', 'express', 'Quote, purpose, embedded questions', 'Pass on what someone said, say what it’s for, and fold a question into a sentence.', ['to-itte-ita', ['tame-ni', 'you-ni']], ['ka-dou-ka', 'nani-ka', 'tte-quote'], ['ghost-hotline', 'word-gauntlet', 'onsen-murder', 'yokai-court']),
  // The Limited Express Line (特急, N3): the plan's 12 goals. Their frames come in frames.ts as their matchers land;
  // until then a goal shows as coming soon (missingFrames) and doesn't count toward clearing the line.
  g('3.1', 'limited', 'Rumours and reported speech', 'Pass on what you heard, and say where you heard it.', ['rashii'], ['ni-yoru', 'n-datte', 'mitai-casual', 'you-ni-iwareta'], ['word-gauntlet', 'onsen-murder', 'yokai-court']),
  g('3.2', 'limited', 'What happened to me', 'Complain about what was done to you, what you were made to do, and what nearly happened.', ['suffering-passive', 'saserareru'], ['tokoro-deshita', 'sasete-morau', 'kakeru', 'kiru', 'bakari'], ['late-again', 'dub-club']),
  g('3.3', 'limited', 'Reasons, results and blame', 'Say who or what to blame or thank, and why.', ['sei-de', 'okage-de'], ['wake-desu', 'tame-reason', 'mono-de'], ['late-again', 'ghost-hotline']),
  g('3.4', 'limited', 'Contrast and concession', 'Say it turned out otherwise, or better than expected.', ['wari-ni', 'kuse-ni'], ['noni', 'ni-kurabete'], ['late-again', 'oogiri']),
  g('3.5', 'limited', 'What-ifs', 'Suppose something were true, and say “the more…, the more…”.', ['to-shitara'], ['ba-hodo', 'sae'], ['ghost-hotline', 'oogiri', 'happyokai']),
  g('3.6', 'limited', 'Intentions and attempts', 'Say what you tried to do, what you did without doing, and what you make a habit of.', ['you-to-suru', 'zu-ni'], ['koto-ni-shiteiru', 'ta-tsumori'], ['ghost-hotline', 'happyokai', 'hajimemashite']),
  g('3.7', 'limited', 'Explaining and clarifying', 'Say what you don’t mean, what should be done, and what it comes down to.', ['wake-dewa-nai', 'beki'], ['to-iu-koto', 'to-shite', 'toori-ni', 'wake-niwa-ikanai', 'koso'], ['ghost-hotline', 'tourist', 'yokai-court']),
  g('3.8', 'limited', 'Service Japanese', 'How staff speak to guests: humble, formal, and at your service.', ['sasete-itadaku', ['de-gozaimasu', 'te-orimasu']], ['go-kudasai', 'kashikomarimashita'], ['bento-haus', 'omiai', 'last-train']),
  g('3.9', 'limited', 'Time and change', 'Do it while you can, say what happens every time, and how things have changed.', ['uchi-ni', 'tabi-ni'], ['saichuu-ni', 'te-kita', 'totan', 'dasu'], ['happyokai', 'late-again', 'word-gauntlet']),
  g('3.10', 'limited', 'Opinions and debate', 'Say what you feel, what must be true, and argue it.', ['you-na-ki', 'ni-chigainai'], ['ni-taishite', 'shika-nai', 'sorenanoni', 'tsumari', 'hazu-ga-nai', 'ni-totte'], ['ghost-hotline', 'narabete', 'yokai-court']),
  g('3.11', 'limited', 'Casual nuance', 'How friends really talk: ＿っぽい, ＿なんて, ＿とか.', ['ppoi', 'nante'], ['toka'], ['phrase-bingo', 'dub-club', 'word-gauntlet']),
  g('3.12', 'limited', 'Read 30 sign kanji', 'The kanji on everyday signs: 受付, 予約, 非常口, 禁煙.', [], [], ['shodo', 'last-train'], { kind: 'kanji', gap: 'The N3 sign kanji are coming to Shodō and Read the Signs.' }),
];
export const GOAL_BY_ID: Readonly<Record<string, Goal>> = Object.fromEntries(GOALS.map((x) => [x.id, x]));

/** A goal's frames that can't be found in phrases yet (no matcher in frames.ts). */
export const missingFrames = (goal: Goal): string[] => goal.need.filter((n) => !needIds(n).some(frameReady)).flatMap((n) => [...needIds(n)]);

// ---- counting kana, kanji and set phrases ----

const SCRIPT_IDS = {
  hiragana: new Set(kana.filter((k) => k.script === 'hiragana').map((k) => k.id)),
  katakana: new Set(kana.filter((k) => k.script === 'katakana').map((k) => k.id)),
};
const KANJI = {
  n5: new Set(writeKanji.filter((k) => k.level === 'n5').map((k) => k.char)),
  n4: new Set(writeKanji.filter((k) => k.level === 'n4').map((k) => k.char)),
  n3: new Set(writeKanji.filter((k) => (k.level as string) === 'n3').map((k) => k.char)),
};
/** The kanji level a kanji goal counts. */
const KANJI_LEVEL: Readonly<Record<string, 'n5' | 'n4' | 'n3'>> = { '5.10': 'n5', '4.10': 'n4', '3.12': 'n3' };
/** How many of each a goal asks for. */
export const KANA_TARGET = { hiragana: Math.ceil(SCRIPT_IDS.hiragana.size * KANA_SHARE), katakana: Math.ceil(SCRIPT_IDS.katakana.size * KANA_SHARE) };

const squash = (s: string): string => s.replace(/[\s　、。！？!?「」]/g, '');

/** Items said on enough days: each item's days, capped, then summed into a count and a 0–1 share. */
function itemCount(daysByItem: Map<string, Set<string>>, target: number): { have: number; need: number; progress: number } {
  let have = 0;
  let part = 0;
  for (const days of daysByItem.values()) {
    if (days.size >= ITEM_DAYS) have += 1;
    part += Math.min(days.size, ITEM_DAYS) / ITEM_DAYS;
  }
  return { have, need: target, progress: Math.min(1, part / target) };
}

const addDays = (m: Map<string, Set<string>>, key: string, days: Iterable<string>): void => {
  const s = m.get(key) ?? new Set<string>();
  for (const d of days) s.add(d);
  m.set(key, s);
};

/** Kana recalled (yōkai cards), by script. */
function kanaDays(p: Progress, script: 'hiragana' | 'katakana'): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const c of Object.values(p.cards)) if (SCRIPT_IDS[script].has(c.itemId) && c.days.length) addDays(m, c.itemId, c.days);
  return m;
}

/** The kanji a Read the Signs item asks for: its one sign, or the target sign when there are several. */
const SIGN_KANJI: Map<string, string[]> = new Map(
  readTheSigns.items.map((it) => {
    const signs = it.signs ?? [];
    const sign = signs.length === 1 ? signs[0] : signs.find((g) => g.target);
    return [it.id, [...(sign?.text ?? '')]];
  }),
);

/**
 * Kanji read from memory in a game: Shodō's kanji (kj-<char>) and the target sign of a Read the Signs
 * item. Other characters in the model answer, and phone-review days, don't count.
 */
function kanjiDays(p: Progress, level: 'n5' | 'n4' | 'n3'): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const c of Object.values(p.phrases ?? {})) {
    if (!c.memory?.length) continue;
    const chars = c.itemId.startsWith('kj-') ? [c.itemId.slice(3)] : SIGN_KANJI.get(c.itemId);
    if (!chars) continue;
    const days = c.memory.filter((d) => d.game).map((d) => d.day);
    for (const ch of chars) if (KANJI[level].has(ch)) addDays(m, ch, days);
  }
  return m;
}

const BOUNDARY = '[\\s　、。！？!?「」]';
/** One pattern per set phrase: any of its forms, at a boundary, spaces inside optional. */
const SET_MATCH: readonly RegExp[] = SET_PHRASES.map((x) => {
  const forms = [x.ja, ...(x.also ?? [])].map((f) => [...squash(f)].join('[\\s　]*'));
  return new RegExp(`(?:^|${BOUNDARY})(?:${forms.join('|')})`);
});

/** Set phrases said from memory, inside any saved phrase. */
function setDays(p: Progress): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const c of Object.values(p.phrases ?? {})) {
    if (!c.memory?.length) continue;
    SET_PHRASES.forEach((x, i) => {
      if (SET_MATCH[i]!.test(c.kana)) addDays(m, x.ja, c.memory!.map((d) => d.day));
    });
  }
  return m;
}

// ---- status ----

export type Recheck = 'waiting' | 'due' | 'passed' | 'fading';

export interface FrameState {
  id: string;
  ready: boolean;
  met: boolean;
  progress: number;
  rule: FrameRule | null;
  /** Null until met. */
  recheck: Recheck | null;
  /**
   * Only the 3-day gap is missing: the day (YYYY-MM-DD) a say starts counting again. Null otherwise.
   * Saying it again before then adds nothing.
   */
  waitUntil: string | null;
}

export interface GoalState {
  id: string;
  /** Hidden: no content yet (a gap). */
  hidden: boolean;
  /** Every required frame has a matcher, so the goal can be met. */
  ready: boolean;
  met: boolean;
  metAt: number | null;
  progress: number;
  /** For kana, kanji and set phrases: how many of how many. */
  count: { have: number; need: number } | null;
  /** Some frame is due for its re-check, or faded. */
  recheck: 'due' | 'fading' | null;
  /** Open, and every need left is only waiting on the 3-day gap: the day it can move again. */
  waitUntil: string | null;
  /**
   * Some game on the goal gives its line's players every required frame from memory (measured, see
   * goalCarried). False: no game counts this yet, so it's never suggested and the phone says why.
   */
  carried: boolean;
}

export interface LineState {
  id: LineId;
  cleared: boolean;
  /** Goals met, out of the visible ones that can be met today. */
  met: number;
  of: number;
  /** Visible goals still waiting on a frame matcher ("coming soon"): not counted until they're ready. */
  soon: number;
}

/** What My progress gets (AccountView.pathStatus): every goal, frame and line, worked out on the server. */
export interface PathStatus {
  goals: GoalState[];
  frames: FrameState[];
  lines: LineState[];
  /** For the cleared screen: frames met, words (phrases) said from memory, kanji read. */
  stats: { frames: number; words: number; kanji: number };
  /** Today, as a day number: slow stops take turns by it. */
  day: number;
}

const NO_RULE: FrameRule = { says: 0, fillers: 0, days: 0, spaced: false, inGame: false, firstDay: null, lastDay: null };

function recheckOf(m: FrameMark | undefined, now: number): Recheck | null {
  if (!m) return null;
  if (m.recheck === 'waiting') return now >= m.recheckAt ? 'due' : 'waiting';
  return m.recheck;
}

/** Every frame any goal names. */
export const GOAL_FRAMES: readonly string[] = [...new Set(GOALS.flatMap((x) => [...x.need.flatMap((n) => [...needIds(n)]), ...x.also]))];

const plusDays = (day: string, n: number): string => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

/** The day a frame can move again, when the 3-day gap is all it lacks. */
function waitOf(rule: FrameRule | null, met: boolean, today: string): string | null {
  if (met || !rule?.firstDay || rule.spaced) return null;
  if (rule.says < FRAME_SAYS || rule.fillers < FRAME_FILLERS || !rule.inGame) return null;
  const from = plusDays(rule.firstDay, FRAME_GAP_DAYS);
  return today < from ? from : null;
}

/** The whole path, from a save. `tzOffsetMin` is the player's (Date#getTimezoneOffset), for "today". */
export function pathStatus(p: Progress, now: number, tzOffsetMin = 0): PathStatus {
  const today = dayOf(now, tzOffsetMin);
  const rules = frameRules(p);
  const marks = p.frameMarks ?? {};
  const frames: FrameState[] = GOAL_FRAMES.map((id) => {
    const rule = rules.get(id) ?? null;
    const met = !!marks[id];
    return { id, ready: frameReady(id), met, progress: met ? 1 : ruleProgress(rule ?? NO_RULE), rule, recheck: recheckOf(marks[id], now), waitUntil: waitOf(rule, met, today) };
  });
  const byId = new Map(frames.map((f) => [f.id, f]));
  // A need with several frames takes the best of them.
  const needState = (n: FrameNeed) => {
    const fs = needIds(n).map((id) => byId.get(id)!);
    return { met: fs.some((f) => f.met), progress: Math.max(...fs.map((f) => f.progress)) };
  };
  const goals: GoalState[] = GOALS.map((goal) => {
    const metAt = p.goalsMet?.[goal.id] ?? null;
    let progress = 0;
    let count: GoalState['count'] = null;
    let met = false;
    let waitUntil: string | null = null;
    if (goal.kind === 'frames') {
      const ns = goal.need.map(needState);
      met = ns.every((n) => n.met);
      progress = ns.reduce((a, n) => a + n.progress, 0) / ns.length;
      // Waiting only when every need left has a frame that's just waiting on the gap.
      const left = goal.need.filter((_, i) => !ns[i]!.met);
      const waits = left.map((n) => needIds(n).map((id) => byId.get(id)!.waitUntil).filter((d): d is string => !!d).sort()[0] ?? null);
      if (!met && waits.length && waits.every((d) => d)) waitUntil = (waits as string[]).sort()[waits.length - 1]!;
    } else {
      const c =
        goal.kind === 'kana'
          ? itemCount(kanaDays(p, goal.id === 'K1' ? 'hiragana' : 'katakana'), goal.id === 'K1' ? KANA_TARGET.hiragana : KANA_TARGET.katakana)
          : goal.kind === 'kanji'
            ? itemCount(kanjiDays(p, KANJI_LEVEL[goal.id] ?? 'n4'), KANJI_GOAL)
            : itemCount(setDays(p), SET_GOAL);
      count = { have: Math.min(c.have, c.need), need: c.need };
      met = c.have >= c.need;
      progress = met ? 1 : c.progress;
    }
    const mine = goal.need.flatMap((n) => [...needIds(n)]).map((id) => byId.get(id)!);
    const recheck = mine.some((f) => f.recheck === 'fading') ? 'fading' : mine.some((f) => f.recheck === 'due') ? 'due' : null;
    const stamped = metAt !== null;
    // The ring is for met goals only: an open goal's bar already says how far along it is.
    const done = stamped || met;
    return { id: goal.id, hidden: !!goal.gap, ready: missingFrames(goal).length === 0, met: done, metAt, progress: done ? 1 : progress, count, recheck: done ? recheck : null, waitUntil: done ? null : waitUntil, carried: goalCarried(goal) };
  });
  // A line clears when every goal it shows is open and met: one with coming-soon stations is still being
  // built, so it can't end (the Limited Express would otherwise "clear" on its one open station).
  const lines: LineState[] = LINES.map((l) => {
    const visible = goals.filter((x) => GOAL_BY_ID[x.id]!.line === l.id && !x.hidden);
    const ready = visible.filter((x) => x.ready);
    const met = ready.filter((x) => x.met).length;
    return { id: l.id, cleared: ready.length > 0 && met === ready.length && visible.length === ready.length, met, of: ready.length, soon: visible.length - ready.length };
  });
  const words = Object.values(p.phrases ?? {}).filter((c) => c.recall === 'memory').length;
  const kanji = new Set([...kanjiDays(p, 'n5').keys(), ...kanjiDays(p, 'n4').keys(), ...kanjiDays(p, 'n3').keys()]).size;
  return { goals, frames, lines, stats: { frames: Object.keys(marks).length, words, kanji }, day: Math.floor(now / DAY_MS) };
}

/**
 * After a game or a review is saved: marks frames that now meet the rule, and stamps goals newly met.
 * Returns the goals stamped now (for the recap's hanko).
 */
export function markPath(p: Progress, now: number, tzOffsetMin = 0): string[] {
  markFrames(p, now);
  const st = pathStatus(p, now, tzOffsetMin);
  const met = (p.goalsMet ??= {});
  const fresh: string[] = [];
  for (const x of st.goals) {
    if (x.met && met[x.id] === undefined && x.ready) {
      met[x.id] = now;
      fresh.push(x.id);
    }
  }
  return fresh;
}

// ---- what each game gives ----

/**
 * Frames real players say from memory in a game that its bots can't (so the measured yield is 0): Word
 * Gauntlet's rumour round counts a retelling from memory, but the bots only echo what they heard. Unmeasured,
 * so they count as a slow stop (BOT_GAP_YIELD), never a fast one: guessed high, 4.6 outranked every measured
 * goal and held rooms in the simulation, where the bots really can't say them.
 */
export const BOT_GAPS: Readonly<Partial<Record<ModeId, readonly string[]>>> = {
  'word-gauntlet': ['sou-hear', 'ni-yoru', 'n-datte', 'to-itte-ita'],
};
/** What a bot gap counts as: carried, but slow (half of SLOW_YIELD). */
export const BOT_GAP_YIELD = 0.075;
/** The level whose yields a goal is measured at (N3 frames earn no credit until N3 opens, so N3 reads N4). */
const yieldLevel = (level: Level): Level => (level === 'n3' ? 'n4' : level);
/** Says from memory per game of one frame (or kanji:<level>) in a game, at a level; a bot gap counts as BOT_GAP_YIELD. */
export function frameYield(mode: ModeId, key: string, level: Level): number {
  const y = YIELDS[yieldLevel(level)]?.[mode]?.[key] ?? 0;
  return y > 0 ? y : BOT_GAPS[mode]?.includes(key) ? BOT_GAP_YIELD : 0;
}
const KANJI_KEY: Readonly<Record<string, string>> = { '5.10': 'kanji:n5', '4.10': 'kanji:n4', '3.12': 'kanji:n3' };
/** Whether yields say anything about this goal (frames and kanji goals); kana and set phrases aren't measured. */
const measured = (goal: Goal): boolean => goal.kind === 'frames' || goal.kind === 'kanji';

/**
 * Lines whose yields rank the suggestion and mark stops no game carries. The Express Line's were checked
 * against the step 5 simulation. The Local Line's say 7 of its 10 goals have no game an N5 player says them in
 * from memory (most N5 lines are logged as read, with the frame on screen), which needs its own simulation
 * before the phone acts on it, so the Local and Kana Lines keep list order. The Limited Express waits for N3:
 * its frames earn no credit until N3 opens.
 */
export const RANKED_LINES: readonly LineId[] = ['express'];
/** Below this many says a game, a stop is slow: it's offered only after the faster ones, taking turns by day. */
export const SLOW_YIELD = 0.15;

/**
 * One goal's pace in one game: says from memory per game of a required frame not met yet, for each open need
 * (an either-or need takes its best frame). For a kanji goal, kanji of its level, scaled to frame units: the
 * goal needs KANJI_GOAL kanji on FRAME_GAP_DAYS-spaced days, where a frame needs FRAME_SAYS says.
 */
function needYields(st: PathStatus, goal: Goal, mode: ModeId, level: Level): number[] {
  if (goal.kind === 'kanji') return [(frameYield(mode, KANJI_KEY[goal.id] ?? 'kanji:n4', level) * FRAME_SAYS) / (2 * KANJI_GOAL)];
  const open = (id: string) => !st.frames.find((f) => f.id === id)?.met;
  return goal.need.filter((n) => needIds(n).every(open)).map((n) => Math.max(...needIds(n).map((id) => frameYield(mode, id, level))));
}

/**
 * Some game on the goal gives every required frame (each need, from any of its games) from memory to its
 * line's players. Only judged on ranked lines; kana and set-phrase goals, and goals not ready yet, count as
 * carried.
 */
export function goalCarried(goal: Goal): boolean {
  if (!measured(goal) || missingFrames(goal).length || !RANKED_LINES.includes(goal.line)) return true;
  const level = LINE_BY_ID[goal.line].level;
  if (goal.kind === 'kanji') return goal.games.some((m) => frameYield(m, KANJI_KEY[goal.id] ?? 'kanji:n4', level) > 0);
  return goal.need.every((n) => needIds(n).some((id) => goal.games.some((m) => frameYield(m, id, level) > 0)));
}

/**
 * Tonight's pace on a goal: its scarcest open required frame, at the best game for that frame among the ones
 * that fit the room (a goal stamps only when every required frame is met, so the bottleneck sets the pace;
 * summing let 4.11's plentiful ＿すぎる hide its rare ＿ので). Each frame may come from a different game, as
 * goalCarried judges it, so 4.6's three frames from three games still make it a stop. The game sent to is the
 * bottleneck frame's best. Optional frames only break ties, and only where a required frame moves. Null for
 * goals the yields don't measure.
 */
export function goalPace(st: PathStatus, goal: Goal, level: Level, room: RoomFit | null): { y: number; mode: ModeId | null } | null {
  if (!measured(goal)) return null;
  const games = goal.games.filter((m) => fitsRoom(m, room));
  if (!games.length) return { y: 0, mode: null };
  const per = games.map((m) => needYields(st, goal, m, level));
  const needs = per[0]!.length;
  if (!needs) return { y: 0, mode: games[0]! };
  // Each need's best game; the slowest need decides.
  let slow = { y: Infinity, mode: games[0]! };
  for (let k = 0; k < needs; k++) {
    let best = { y: -1, mode: games[0]! };
    games.forEach((m, i) => {
      const y = per[i]![k]!;
      if (y > best.y || (y === best.y && y > 0 && alsoYield(st, goal, m, level) > alsoYield(st, goal, best.mode, level))) best = { y, mode: m };
    });
    if (best.y < slow.y) slow = best;
  }
  return slow.y > 0 ? { y: slow.y + alsoYield(st, goal, slow.mode, level) / 10, mode: slow.mode } : { y: 0, mode: slow.mode };
}

const alsoYield = (st: PathStatus, goal: Goal, mode: ModeId, level: Level): number => {
  const open = (id: string) => !st.frames.find((f) => f.id === id)?.met;
  return goal.also.filter(open).reduce((sum, id) => sum + frameYield(mode, id, level), 0);
};

/** What one game gives a goal's open required frames together, for ordering "Practise in". Null if unmeasured. */
export function goalYield(st: PathStatus, goal: Goal, mode: ModeId, level: Level): number | null {
  if (!measured(goal)) return null;
  return needYields(st, goal, mode, level).reduce((a, b) => a + b, 0);
}

/**
 * A goal's games for "Practise in": on a ranked line, those that give its open required frames most first
 * (a tenth of a say a game counts as a tie, so noise doesn't reshuffle the list); otherwise the goal's own
 * order.
 */
export function gamesByYield(st: PathStatus, goal: Goal, level: Level): ModeId[] {
  if (!RANKED_LINES.includes(goal.line)) return [...goal.games];
  return [...goal.games]
    .map((m, i) => ({ m, i, y: Math.round((goalYield(st, goal, m, level) ?? 0) * 10) }))
    .sort((a, b) => b.y - a.y || a.i - b.i)
    .map((x) => x.m);
}

// ---- what to play next ----

/** Tonight's room, as far as the suggestion cares. */
export interface RoomFit {
  players: number;
  speakers: number;
}

const fitsRoom = (mode: ModeId, room: RoomFit | null): boolean => !room || !noFit(MODES[mode].info, room.players, room.speakers);

/** A goal that can be worked on today: visible, ready, not met. */
const openGoal = (st: PathStatus, goal: Goal): boolean => {
  const s = st.goals.find((y) => y.id === goal.id)!;
  return !goal.gap && goal.games.length > 0 && s.ready && !s.met;
};

/**
 * The line a player is working on: their level's, or the next one up with something open (a line that's
 * cleared, or has only coming-soon goals left, is passed over). Their level's line when nothing is open.
 */
export function currentLine(st: PathStatus, level: Level): Line {
  const start = LINES.indexOf(lineFor(level));
  for (let i = start; i < LINES.length; i++) if (GOALS.some((x) => x.line === LINES[i]!.id && openGoal(st, x))) return LINES[i]!;
  return LINES[start]!;
}

export interface Suggestion {
  line: Line;
  goal: Goal;
  mode: ModeId;
  /**
   * The open stop before this one that was passed over, and why: no game on it fits tonight's room, or
   * tonight's games move this one faster. Null when this is the first open stop.
   */
  skipped: { goal: Goal; why: 'room' | 'pace' } | null;
}

/**
 * What to play next on the player's line. A goal with a faded frame comes first. On a ranked line (the
 * Express), the open goal tonight's games move fastest, by the measured yields (shared/src/pathYields.ts),
 * at the game that moves its scarcest frame; slow stops (under SLOW_YIELD) come after every faster one and
 * take turns day by day, so no single slow stop holds a room. Elsewhere, the first open goal in line order with
 * a game that fits. Goals waiting on a matcher, waiting only on the 3-day gap, or carried by no game are
 * skipped. Null when nothing fits.
 */
export function suggest(st: PathStatus, level: Level, room: RoomFit | null): Suggestion | null {
  const line = currentLine(st, level);
  const state = (goal: Goal) => st.goals.find((y) => y.id === goal.id)!;
  // A goal only waiting on the 3-day gap is skipped: saying it again today adds nothing.
  const open = GOALS.filter((x) => x.line === line.id && openGoal(st, x) && !state(x).waitUntil && state(x).carried);
  // A faded frame's goal comes first: say it again and the ring goes.
  const fading = GOALS.filter((x) => x.line === line.id && state(x).recheck === 'fading');
  const fit = (goal: Goal): ModeId | null => goal.games.find((m) => fitsRoom(m, room)) ?? null;
  const head = open[0] ?? null;
  const done = (goal: Goal, mode: ModeId): Suggestion => ({
    line,
    goal,
    mode,
    skipped: head && head !== goal && !fading.includes(goal) ? { goal: head, why: fit(head) ? 'pace' : 'room' } : null,
  });
  for (const goal of fading) {
    if (!RANKED_LINES.includes(line.id)) {
      const mode = fit(goal);
      if (mode) return done(goal, mode);
      continue;
    }
    // Score it by its faded frames (they still count as met), and go first only at a game that gives one.
    const faded = goal.need.flatMap((n) => needIds(n)).filter((id) => st.frames.find((f) => f.id === id)?.recheck === 'fading');
    const games = goal.games.filter((m) => fitsRoom(m, room));
    const best = games.map((m) => ({ m, y: Math.max(0, ...faded.map((id) => frameYield(m, id, level))) })).sort((x, y) => y.y - x.y)[0];
    if (best && best.y > 0) return done(goal, best.m);
  }
  if (!RANKED_LINES.includes(line.id)) {
    for (const goal of open) {
      const mode = fit(goal);
      if (mode) return done(goal, mode);
    }
    return null;
  }
  const paced = open
    .map((goal, i) => ({ goal, i, ...(goalPace(st, goal, level, room) ?? { y: 0, mode: fit(goal) }) }))
    .filter((x): x is typeof x & { mode: ModeId } => x.mode !== null);
  const fast = paced.filter((x) => x.y >= SLOW_YIELD).sort((a, b) => b.y - a.y || a.i - b.i);
  const slow = paced.filter((x) => x.y > 0 && x.y < SLOW_YIELD);
  const best = fast[0] ?? slow[st.day % Math.max(1, slow.length)] ?? paced[0];
  return best ? done(best.goal, best.mode) : null;
}

/** The goal's place in its line, for "5.4 Find your way". */
export const goalLabel = (goal: Goal): string => `${goal.id} ${goal.title}`;
