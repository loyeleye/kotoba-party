// Omiai Matchmaker character cards: the guests who come on the show to meet everyone, the
// questions they ask, answer tiles, stock polite answers and the keigo pairs the show teaches.
//
// Draft content (status 'draft'): a fluent speaker should check every line. Everything is kana
// (text === kana) so Kana-level players can read it with romaji; katakana loanwords stay
// katakana. The guests are yōkai and objects from the studio's world, not people, and nobody's
// gender matters: the show is a formal "meet the family" introduction, so the prize is an
// invitation to tea, not a date.
//
// The room's Audience setting picks the guest: Family guests (the first eight) by default, Kids guests
// who want to make a friend and invite you to play, or Cheeky guests with dating-show energy (still
// only a cup of tea, never a date). The keigo pairs, shared tiles and manners meter are the same
// for everyone.
//
// Round 1 is always the self-introduction and the last round is always the closing appeal
// (both built from the card below); the rounds between ask the card's own questions in order.

import type { JpText, Level, ReviewStatus } from '../../../../content/src/types.js';
import type { Audience } from '../../protocol.js';

export interface KeigoPair {
  id: string;
  en: string;
  plain: string;
  polite: string;
  /** Raising the other person (尊敬語): what you say about the guest. */
  honorific: string;
  /** Lowering yourself (謙譲語): what you say about yourself. Same as polite when there is none in common use. */
  humble: string;
}

export interface TileSpec {
  jp: JpText;
  /** Only dealt to players at this level or above (an N4 keigo ending). */
  minLevel?: Level;
}

export interface OmiaiQuestion {
  id: string;
  /** What the guest asks. Kana players see the N5 version with romaji; N4 hears more keigo. */
  ask: { n5: JpText; n4: JpText };
  /** yes/no questions get はい / うん / いいえ openers, others そうですね / ええと. */
  kind: 'yesno' | 'wh';
  /** An optional tile that starts the answer (わたしの ゆめは). */
  lead?: JpText;
  /** The answer words: the funny choices. */
  fills: JpText[];
  /** Endings that attach straight to the fill (です, だよ, すんでいます …). */
  endings: { polite: TileSpec[]; casual: TileSpec[] };
  /** Stock polite answers: the fallback tip and the natural version on the stage. */
  example: Record<Level, JpText>;
  /** The keigo pair this question shows off (the N4 ask uses it). */
  keigo: string;
}

export interface CharacterCard {
  id: string;
  emoji: string;
  name: JpText;
  job: JpText;
  hobbies: JpText[];
  /** One funny line about them, in English so every level gets the joke. */
  quirk: string;
  /** How they introduce themselves (modelling the self-introduction). */
  greeting: JpText;
  /** Asked in rounds 2…, in order. */
  questions: OmiaiQuestion[];
  /** Things to invite them to in the closing appeal, each ending in を (つりを). */
  appeal: JpText[];
  /** What they say when they accept someone ({name} is filled in). */
  accept: JpText;
  /** Who this guest is for (the room's Audience setting). Kids guests invite you to play, not to tea. */
  audience: Audience;
  status: ReviewStatus;
}

const k = (kana: string, en: string): JpText => ({ text: kana, kana, en });
const polite = (...xs: (JpText | [JpText, Level])[]): TileSpec[] => xs.map((x) => (Array.isArray(x) ? { jp: x[0], minLevel: x[1] } : { jp: x }));

export const KEIGO_PAIRS: readonly KeigoPair[] = [
  { id: 'iru', en: 'to be (somewhere)', plain: 'いる', polite: 'います', honorific: 'いらっしゃいます', humble: 'おります' },
  { id: 'iku', en: 'to go', plain: 'いく', polite: 'いきます', honorific: 'いらっしゃいます', humble: 'まいります' },
  { id: 'kuru', en: 'to come', plain: 'くる', polite: 'きます', honorific: 'いらっしゃいます', humble: 'まいります' },
  { id: 'taberu', en: 'to eat', plain: 'たべる', polite: 'たべます', honorific: 'めしあがります', humble: 'いただきます' },
  { id: 'nomu', en: 'to drink', plain: 'のむ', polite: 'のみます', honorific: 'めしあがります', humble: 'いただきます' },
  { id: 'suru', en: 'to do', plain: 'する', polite: 'します', honorific: 'なさいます', humble: 'いたします' },
  { id: 'iu', en: 'to say, to be called', plain: 'いう', polite: 'いいます', honorific: 'おっしゃいます', humble: 'もうします' },
  { id: 'miru', en: 'to see', plain: 'みる', polite: 'みます', honorific: 'ごらんに なります', humble: 'はいけんします' },
  { id: 'kiku', en: 'to ask, to hear', plain: 'きく', polite: 'ききます', honorific: 'おききに なります', humble: 'うかがいます' },
  { id: 'sumu', en: 'to live (somewhere)', plain: 'すんでいる', polite: 'すんでいます', honorific: 'おすまいです', humble: 'すんでおります' },
  { id: 'motsu', en: 'to have', plain: 'もっている', polite: 'もっています', honorific: 'おもちです', humble: 'もっております' },
  { id: 'okiru', en: 'to get up', plain: 'おきる', polite: 'おきます', honorific: 'おおきに なります', humble: 'おきます' },
  { id: 'da', en: 'to be (is)', plain: 'だ', polite: 'です', honorific: 'で いらっしゃいます', humble: 'で ございます' },
  { id: 'aru', en: 'to have, there is', plain: 'ある', polite: 'あります', honorific: 'おありです', humble: 'ございます' },
];

// ---- shared tiles ----

export const OPENERS = {
  wh: { polite: [k('そうですね、', 'Let me see,'), k('ええと、', 'Um,')], casual: [k('えっとね、', 'Um, so, like… (chatty)')] },
  yesno: { polite: [k('はい、', 'Yes,'), k('ええ、', 'Yes, indeed,')], casual: [k('うん、', 'Yeah,')] },
  intro: { polite: [k('はじめまして。', 'Nice to meet you.')], casual: [k('やあ！', 'Hey!')] },
} as const;

export const CLOSERS = { polite: [k('よろしく おねがいします。', 'I look forward to knowing you.')], casual: [k('よろしく！', 'Cheers!')] } as const;

const DESU = k('です。', '(polite “is”)');
const DAYO = k('だよ。', '(casual “is”, you know)');
const JAN = k('じゃん。', '(slangy “right?”)');
const nounEndings = (slang = true) => ({ polite: polite(DESU), casual: slang ? [{ jp: DAYO }, { jp: JAN }] : [{ jp: DAYO }] });

// ---- the self-introduction and the closing appeal (built from each card) ----

/** Round 1: the guest introduces themselves and asks your name. {name} is the player's own name. */
export function introQuestion(card: CharacterCard): OmiaiQuestion {
  return {
    id: `${card.id}.intro`,
    ask: {
      n5: { text: `${card.greeting.text} おなまえを おしえて ください。`, kana: `${card.greeting.kana} おなまえを おしえて ください。`, en: `${card.greeting.en} Please tell me your name.` },
      n4: { text: `${card.greeting.text} おなまえを うかがっても よろしいですか。`, kana: `${card.greeting.kana} おなまえを うかがっても よろしいですか。`, en: `${card.greeting.en} May I ask your name?` },
    },
    kind: 'wh',
    fills: [k('{name}', 'your name')],
    endings: { polite: polite(DESU, [k('と もうします。', '(humble “I am called”)'), 'n4']), casual: [{ jp: DAYO }] },
    example: {
      kana: k('はじめまして。{name}です。よろしく おねがいします。', "Nice to meet you. I'm {name}. I look forward to knowing you."),
      n5: k('はじめまして。{name}です。よろしく おねがいします。', "Nice to meet you. I'm {name}. I look forward to knowing you."),
      n4: k('はじめまして。{name}と もうします。どうぞ よろしく おねがいいたします。', 'Nice to meet you. My name is {name}. I humbly look forward to knowing you.'),
    },
    keigo: 'iu',
  };
}

/** The last round: one closing line, an invitation, the guest's choice right after. */
export function appealQuestion(card: CharacterCard): OmiaiQuestion {
  const first = card.appeal[0]!;
  return {
    id: `${card.id}.appeal`,
    ask: {
      n5: k('さいごに、ひとこと おねがいします！', 'Finally, one last word, please!'),
      n4: k('さいごに、ひとこと いただけますか。', 'Finally, may we have a last word from you?'),
    },
    kind: 'wh',
    lead: k('こんど、', 'Next time,'),
    fills: card.appeal,
    endings: { polite: polite(k('しませんか。', 'shall we …?'), k('しましょう。', "let's …")), casual: [{ jp: k('しようよ！', "let's …! (casual)") }, { jp: k('しない？', 'wanna …? (casual)') }] },
    example: {
      kana: k(`${first.kana} しませんか。`, `Shall we do this together: ${first.en}?`),
      n5: k(`こんど、${first.kana} しませんか。よろしく おねがいします。`, `Next time, shall we do this together: ${first.en}? I look forward to it.`),
      n4: k(`こんど、ぜひ ${first.kana} しませんか。どうぞ よろしく おねがいいたします。`, `Next time, would you do this with me: ${first.en}? I humbly look forward to it.`),
    },
    keigo: 'suru',
  };
}

// ---- the cards ----

export const CARDS: readonly CharacterCard[] = [
  {
    id: 'kappa',
    emoji: '🥒',
    name: k('かっぱの キュウリさん', 'Kyūri the Kappa'),
    job: k('きゅうり のうか', 'cucumber farmer'),
    hobbies: [k('すもう', 'sumo'), k('およぐ こと', 'swimming')],
    quirk: 'Must keep the water dish on their head full, so every bow is very, very careful.',
    greeting: k('はじめまして。かっぱの キュウリです。', "Nice to meet you. I'm Kyūri the kappa."),
    questions: [
      {
        id: 'kappa.food',
        ask: { n5: k('すきな たべものは なんですか。', "What's your favourite food?"), n4: k('どんな ものを よく めしあがりますか。', 'What do you usually eat? (honorific)') },
        kind: 'wh',
        fills: [k('すし', 'sushi'), k('カレー', 'curry'), k('きゅうり', 'cucumbers'), k('ラーメン', 'ramen')],
        endings: nounEndings(),
        example: { kana: k('すしです。', "It's sushi."), n5: k('そうですね、すしが すきです。', 'Let me see, I like sushi.'), n4: k('そうですね、すしを よく いただきます。', 'Let me see, I often have sushi. (humble)') },
        keigo: 'taberu',
      },
      {
        id: 'kappa.cucumber',
        ask: { n5: k('きゅうりは すきですか。', 'Do you like cucumbers?'), n4: k('きゅうりは おすきですか。', 'Are you fond of cucumbers? (with お)') },
        kind: 'yesno',
        fills: [k('だいすき', 'love them'), k('すき', 'like them'), k('ちょっと にがて', 'not really my thing')],
        endings: nounEndings(),
        example: { kana: k('はい、だいすきです。', 'Yes, I love them.'), n5: k('はい、きゅうりが だいすきです。', 'Yes, I love cucumbers.'), n4: k('はい、きゅうりは よく いただきます。', 'Yes, I often have cucumbers. (humble)') },
        keigo: 'taberu',
      },
      {
        id: 'kappa.weekend',
        ask: { n5: k('やすみの ひは なにを しますか。', 'What do you do on your days off?'), n4: k('おやすみの ひは なにを なさいますか。', 'What do you do on your days off? (honorific)') },
        kind: 'wh',
        fills: [k('ゲームを', 'games'), k('りょうりを', 'cooking'), k('さんぽを', 'walks'), k('ひるねを', 'naps')],
        endings: { polite: polite(k('します。', 'do (polite)'), [k('いたします。', 'do (humble)'), 'n4']), casual: [{ jp: k('する。', 'do (plain)') }, { jp: k('するよ。', 'do, you know') }] },
        example: { kana: k('さんぽを します。', 'I go for walks.'), n5: k('そうですね、よく さんぽを します。', 'Let me see, I often go for walks.'), n4: k('そうですね、よく さんぽを いたします。', 'Let me see, I often go for walks. (humble)') },
        keigo: 'suru',
      },
    ],
    appeal: [k('いっしょに すもうを', 'sumo together'), k('いっしょに さんぽを', 'a walk together'), k('いっしょに つりを', 'fishing together')],
    accept: k('{name}さん、こんど いっしょに きゅうりを たべましょう！', "{name}, let's eat cucumbers together sometime!"),
    audience: 'family',
    status: 'draft',
  },
  {
    id: 'nurikabe',
    emoji: '🧱',
    name: k('ぬりかべの カベさん', 'Kabe the Wall Spirit'),
    job: k('けんちくか', 'architect'),
    hobbies: [k('ペンキぬり', 'painting walls'), k('かくれんぼ', 'hide and seek')],
    quirk: 'Stands in doorways. Very hard to get past, very easy to talk to.',
    greeting: k('はじめまして。ぬりかべの カベです。', "Nice to meet you. I'm Kabe the wall spirit."),
    questions: [
      {
        id: 'nurikabe.home',
        ask: { n5: k('どこに すんでいますか。', 'Where do you live?'), n4: k('どちらに おすまいですか。', 'Where do you live? (honorific)') },
        kind: 'wh',
        fills: [k('とうきょうに', 'in Tokyo'), k('うみの ちかくに', 'near the sea'), k('やまの なかに', 'in the mountains'), k('かべの なかに', 'inside a wall')],
        endings: { polite: polite(k('すんでいます。', 'live (polite)'), [k('すんでおります。', 'live (humble)'), 'n4']), casual: [{ jp: k('すんでる。', 'live (casual)') }, { jp: k('すんでるよ。', 'live, you know') }] },
        example: { kana: k('とうきょうに すんでいます。', 'I live in Tokyo.'), n5: k('わたしは とうきょうに すんでいます。', 'I live in Tokyo.'), n4: k('とうきょうに すんでおります。', 'I live in Tokyo. (humble)') },
        keigo: 'sumu',
      },
      {
        id: 'nurikabe.house',
        ask: { n5: k('どんな いえが すきですか。', 'What kind of house do you like?'), n4: k('どのような おうちが おすきですか。', 'What sort of home do you prefer? (with お)') },
        kind: 'wh',
        fills: [k('おおきい いえ', 'a big house'), k('ちいさい いえ', 'a small house'), k('ふるい いえ', 'an old house'), k('かべが ない いえ', 'a house with no walls')],
        endings: nounEndings(),
        example: { kana: k('ちいさい いえです。', 'A small house.'), n5: k('そうですね、ふるい いえが すきです。', 'Let me see, I like old houses.'), n4: k('そうですね、ふるい おうちが すきです。', 'Let me see, I like old homes. (with お)') },
        keigo: 'da',
      },
      {
        id: 'nurikabe.job',
        ask: { n5: k('しごとは なんですか。', 'What do you do for work?'), n4: k('おしごとは なにを なさって いますか。', 'What work do you do? (honorific)') },
        kind: 'wh',
        fills: [k('がくせい', 'a student'), k('かいしゃいん', 'an office worker'), k('せんせい', 'a teacher'), k('ゆうれい', 'a ghost')],
        endings: nounEndings(false),
        example: { kana: k('がくせいです。', "I'm a student."), n5: k('わたしは かいしゃいんです。', "I'm an office worker."), n4: k('かいしゃで はたらいて おります。', 'I work at a company. (humble)') },
        keigo: 'suru',
      },
    ],
    appeal: [k('いっしょに ペンキぬりを', 'wall painting together'), k('いっしょに かくれんぼを', 'hide and seek together'), k('いっしょに おさんぽを', 'a stroll together')],
    accept: k('{name}さん、わたしの いえに ぜひ あそびに きて ください。', '{name}, please do come and visit my house.'),
    audience: 'family',
    status: 'draft',
  },
  {
    id: 'karakasa',
    emoji: '☂️',
    name: k('からかさの ポツリさん', 'Potsuri the Umbrella Ghost'),
    job: k('てんき よほうし', 'weather forecaster'),
    hobbies: [k('あまやどり', 'sheltering from rain'), k('かたあし ジャンプ', 'one-legged hopping')],
    quirk: 'Hops everywhere on one leg. Has very strong opinions about drizzle.',
    greeting: k('はじめまして。からかさの ポツリです。', "Nice to meet you. I'm Potsuri the umbrella ghost."),
    questions: [
      {
        id: 'karakasa.rain',
        ask: { n5: k('あめの ひは すきですか。', 'Do you like rainy days?'), n4: k('あめの ひは おすきですか。', 'Are you fond of rainy days? (with お)') },
        kind: 'yesno',
        fills: [k('だいすき', 'I love them'), k('すき', 'I like them'), k('ふつう', "they're OK")],
        endings: nounEndings(),
        example: { kana: k('はい、すきです。', 'Yes, I like them.'), n5: k('はい、あめの ひが すきです。', 'Yes, I like rainy days.'), n4: k('ええ、あめの ひは だいすきです。', 'Oh yes, I love rainy days.') },
        keigo: 'da',
      },
      {
        id: 'karakasa.colour',
        ask: { n5: k('なにいろが すきですか。', 'What colour do you like?'), n4: k('なにいろが おすきですか。', 'What colour do you prefer? (with お)') },
        kind: 'wh',
        fills: [k('あか', 'red'), k('あお', 'blue'), k('きいろ', 'yellow'), k('みずたまもよう', 'polka dots')],
        endings: nounEndings(),
        example: { kana: k('あおです。', "It's blue."), n5: k('そうですね、あおが すきです。', 'Let me see, I like blue.'), n4: k('そうですね、あおが いちばん すきです。', 'Let me see, I like blue best.') },
        keigo: 'da',
      },
      {
        id: 'karakasa.umbrellas',
        ask: { n5: k('かさを いくつ もっていますか。', 'How many umbrellas do you have?'), n4: k('かさは いくつ おもちですか。', 'How many umbrellas do you have? (honorific)') },
        kind: 'wh',
        fills: [k('ひとつ', 'one'), k('みっつ', 'three'), k('ひゃっこ', 'a hundred'), k('ゼロこ', 'zero')],
        endings: { polite: polite(k('もっています。', 'have (polite)'), [k('もっております。', 'have (humble)'), 'n4']), casual: [{ jp: k('もってる。', 'have (casual)') }, { jp: k('もってるよ。', 'have, you know') }] },
        example: { kana: k('ひとつ もっています。', 'I have one.'), n5: k('ええと、みっつ もっています。', 'Um, I have three.'), n4: k('ええと、みっつ もっております。', 'Um, I have three. (humble)') },
        keigo: 'motsu',
      },
    ],
    appeal: [k('いっしょに あまやどりを', 'sheltering from the rain together'), k('いっしょに さんぽを', 'a walk together'), k('いっしょに てるてるぼうずづくりを', 'making rain charms together')],
    accept: k('{name}さん、あめの ひも はれの ひも、よろしく おねがいします！', '{name}, rain or shine, I look forward to it!'),
    audience: 'family',
    status: 'draft',
  },
  {
    id: 'manekineko',
    emoji: '🐱',
    name: k('まねきねこの フクさん', 'Fuku the Lucky Cat'),
    job: k('おみせの うけつけ', 'shop greeter'),
    hobbies: [k('てを ふる こと', 'waving'), k('おひるね', 'naps')],
    quirk: 'Has waved one paw non-stop since 1987. Says いらっしゃいませ in their sleep.',
    greeting: k('いらっしゃいませ！　あ、しつれいしました。まねきねこの フクです。', "Welcome in! Oh, excuse me. I'm Fuku the lucky cat."),
    questions: [
      {
        id: 'manekineko.shop',
        ask: { n5: k('どんな おみせが すきですか。', 'What kind of shops do you like?'), n4: k('どのような おみせに よく いらっしゃいますか。', 'What shops do you often go to? (honorific)') },
        kind: 'wh',
        fills: [k('コンビニ', 'convenience stores'), k('ほんや', 'bookshops'), k('ケーキや', 'cake shops'), k('ひゃくえんショップ', '100-yen shops')],
        endings: nounEndings(),
        example: { kana: k('コンビニです。', 'Convenience stores.'), n5: k('そうですね、コンビニが すきです。', 'Let me see, I like convenience stores.'), n4: k('そうですね、よく ほんやに まいります。', 'Let me see, I often go to bookshops. (humble)') },
        keigo: 'iku',
      },
      {
        id: 'manekineko.cats',
        ask: { n5: k('ねこは すきですか。', 'Do you like cats?'), n4: k('ねこは おすきですか。', 'Are you fond of cats? (with お)') },
        kind: 'yesno',
        fills: [k('だいすき', 'I love them'), k('すき', 'I like them'), k('いぬの ほうが すき', 'I prefer dogs')],
        endings: nounEndings(),
        example: { kana: k('はい、だいすきです。', 'Yes, I love them.'), n5: k('はい、ねこが だいすきです。', 'Yes, I love cats.'), n4: k('ええ、ねこが とても すきです。', 'Oh yes, I like cats very much.') },
        keigo: 'da',
      },
      {
        id: 'manekineko.morning',
        ask: { n5: k('あさは なんじに おきますか。', 'What time do you get up?'), n4: k('あさは なんじに おおきに なりますか。', 'What time do you get up? (honorific)') },
        kind: 'wh',
        fills: [k('ろくじに', 'at six'), k('しちじに', 'at seven'), k('くじに', 'at nine'), k('おひるに', 'at noon')],
        endings: { polite: polite(k('おきます。', 'get up (polite)')), casual: [{ jp: k('おきる。', 'get up (plain)') }, { jp: k('おきるよ。', 'get up, you know') }] },
        example: { kana: k('しちじに おきます。', 'I get up at seven.'), n5: k('ええと、まいあさ しちじに おきます。', 'Um, I get up at seven every morning.'), n4: k('ええと、まいあさ しちじに おきて おります。', 'Um, I get up at seven every morning. (humble)') },
        keigo: 'okiru',
      },
    ],
    appeal: [k('いっしょに おかいものを', 'shopping together'), k('いっしょに おひるねを', 'a nap together'), k('いっしょに てを ふる れんしゅうを', 'waving practice together')],
    accept: k('{name}さん、また おこし ください！　ずっと てを ふって まって います。', "{name}, please come again! I'll be waving the whole time."),
    audience: 'family',
    status: 'draft',
  },
  {
    id: 'tengu',
    emoji: '👺',
    name: k('てんぐの タカハナさん', 'Takahana the Tengu'),
    job: k('やまの ガイド', 'mountain guide'),
    hobbies: [k('やまのぼり', 'mountain climbing'), k('はなの ていれ', 'nose grooming')],
    quirk: 'Very proud of their long nose. Secretly a little afraid of heights.',
    greeting: k('はじめまして。てんぐの タカハナと もうします。', 'Nice to meet you. My name is Takahana, the tengu.'),
    questions: [
      {
        id: 'tengu.mountains',
        ask: { n5: k('やまは すきですか。', 'Do you like mountains?'), n4: k('やまのぼりは なさいますか。', 'Do you go mountain climbing? (honorific)') },
        kind: 'yesno',
        fills: [k('だいすき', 'I love them'), k('すき', 'I like them'), k('ちょっと こわい', "they're a bit scary")],
        endings: nounEndings(),
        example: { kana: k('はい、すきです。', 'Yes, I like them.'), n5: k('はい、やまが すきです。', 'Yes, I like mountains.'), n4: k('はい、ときどき やまに まいります。', 'Yes, I go to the mountains now and then. (humble)') },
        keigo: 'suru',
      },
      {
        id: 'tengu.pride',
        ask: { n5: k('じまんは なんですか。', 'What are you proud of?'), n4: k('なにか じまんの ものは ございますか。', 'Is there something you are proud of? (extra polite)') },
        kind: 'wh',
        fills: [k('りょうり', 'my cooking'), k('うた', 'my singing'), k('はやおき', 'getting up early'), k('はなの かたち', 'the shape of my nose')],
        endings: nounEndings(),
        example: { kana: k('りょうりです。', 'My cooking.'), n5: k('そうですね、りょうりが じまんです。', "Let me see, I'm proud of my cooking."), n4: k('そうですね、りょうりが すこし とくいです。', "Let me see, I'm a little good at cooking.") },
        keigo: 'aru',
      },
      {
        id: 'tengu.travel',
        ask: { n5: k('どこに いきたいですか。', 'Where would you like to go?'), n4: k('どちらへ おでかけに なりたいですか。', 'Where would you like to go? (honorific)') },
        kind: 'wh',
        fills: [k('うみに', 'to the sea'), k('きょうとに', 'to Kyoto'), k('おんせんに', 'to a hot spring'), k('つきに', 'to the moon')],
        endings: { polite: polite(k('いきたいです。', 'want to go (polite)'), [k('まいりたいです。', 'want to go (humble)'), 'n4']), casual: [{ jp: k('いきたい！', 'wanna go!') }, { jp: k('いきたいな。', 'wanna go, I think') }] },
        example: { kana: k('おんせんに いきたいです。', 'I want to go to a hot spring.'), n5: k('そうですね、おんせんに いきたいです。', 'Let me see, I want to go to a hot spring.'), n4: k('そうですね、おんせんに まいりたいです。', 'Let me see, I would like to go to a hot spring. (humble)') },
        keigo: 'iku',
      },
    ],
    appeal: [k('いっしょに やまのぼりを', 'mountain climbing together'), k('いっしょに ハイキングを', 'hiking together'), k('いっしょに おちゃを', 'tea together')],
    accept: k('{name}さん、こんど いっしょに やまに のぼりましょう。ゆっくり おねがいします。', "{name}, let's climb a mountain together sometime. Slowly, please."),
    audience: 'family',
    status: 'draft',
  },
  {
    id: 'yukidaruma',
    emoji: '⛄',
    name: k('ゆきだるまの シロさん', 'Shiro the Snow Daruma'),
    job: k('アイスクリームやさん', 'ice-cream seller'),
    hobbies: [k('ゆきあそび', 'playing in the snow'), k('スキー', 'skiing')],
    quirk: 'Melts a little when embarrassed. Please keep the compliments cool.',
    greeting: k('はじめまして。ゆきだるまの シロです。さむい ところから まいりました。', "Nice to meet you. I'm Shiro the snow daruma. I've come from somewhere cold."),
    questions: [
      {
        id: 'yukidaruma.season',
        ask: { n5: k('すきな きせつは なんですか。', "What's your favourite season?"), n4: k('どの きせつが おすきですか。', 'Which season do you prefer? (with お)') },
        kind: 'wh',
        fills: [k('ふゆ', 'winter'), k('はる', 'spring'), k('なつ', 'summer'), k('あき', 'autumn')],
        endings: nounEndings(),
        example: { kana: k('ふゆです。', "It's winter."), n5: k('そうですね、ふゆが すきです。', 'Let me see, I like winter.'), n4: k('そうですね、ふゆが いちばん すきです。', 'Let me see, I like winter best.') },
        keigo: 'da',
      },
      {
        id: 'yukidaruma.icecream',
        ask: { n5: k('アイスクリームは よく たべますか。', 'Do you often eat ice cream?'), n4: k('アイスクリームは よく めしあがりますか。', 'Do you often have ice cream? (honorific)') },
        kind: 'yesno',
        fills: [k('まいにち', 'every day'), k('ときどき', 'sometimes'), k('よる おそくに', 'late at night')],
        endings: { polite: polite(k('たべます。', 'eat (polite)'), [k('いただきます。', 'eat (humble)'), 'n4']), casual: [{ jp: k('たべる。', 'eat (plain)') }, { jp: k('たべるよ。', 'eat, you know') }] },
        example: { kana: k('はい、ときどき たべます。', 'Yes, I eat it sometimes.'), n5: k('はい、ときどき たべます。', 'Yes, I eat it sometimes.'), n4: k('はい、ときどき いただきます。', 'Yes, I have some now and then. (humble)') },
        keigo: 'taberu',
      },
      {
        id: 'yukidaruma.heat',
        ask: { n5: k('あついのは だいじょうぶですか。', 'Are you OK with hot weather?'), n4: k('あつい ところは おすきですか。', 'Do you like hot places? (polite)') },
        kind: 'yesno',
        fills: [k('だいじょうぶ', "I'm fine with it"), k('ちょっと にがて', "it's not for me"), k('だいすき', 'I love it')],
        endings: nounEndings(),
        example: { kana: k('ちょっと にがてです。', "It's not really for me."), n5: k('ええと、ちょっと にがてです。', "Um, it's not really for me."), n4: k('ええと、すこし にがてで ございます。', 'Um, I am not very good with it. (extra polite)') },
        keigo: 'da',
      },
    ],
    appeal: [k('いっしょに ゆきあそびを', 'playing in the snow together'), k('いっしょに スキーを', 'skiing together'), k('いっしょに かまくらづくりを', 'building a snow hut together')],
    accept: k('{name}さん、うれしくて ちょっと とけそうです！　ぜひ また あいましょう。', "{name}, I'm so happy I might melt! Let's meet again."),
    audience: 'family',
    status: 'draft',
  },
  {
    id: 'daruma',
    emoji: '🔴',
    name: k('だるまの コロリンさん', 'Kororin the Daruma'),
    job: k('ライフコーチ', 'life coach'),
    hobbies: [k('おきあがる こと', 'getting back up'), k('ジョギング', 'jogging')],
    quirk: 'Falls down seven times, gets up eight. Only one eye is painted in: they are waiting for a wish to come true.',
    greeting: k('はじめまして！　だるまの コロリンです。ななころびやおきです！', "Nice to meet you! I'm Kororin the daruma. Fall seven times, get up eight!"),
    questions: [
      {
        id: 'daruma.dream',
        ask: { n5: k('ゆめは なんですか。', "What's your dream?"), n4: k('しょうらいの ゆめを うかがっても いいですか。', 'May I ask about your dream for the future? (humble)') },
        kind: 'wh',
        lead: k('わたしの ゆめは', 'my dream is'),
        fills: [k('せかいりょこう', 'travelling the world'), k('にほんごの せんせい', 'being a Japanese teacher'), k('ラーメンやさん', 'running a ramen shop'), k('うちゅうひこうし', 'being an astronaut')],
        endings: nounEndings(),
        example: { kana: k('せかいりょこうです。', "It's travelling the world."), n5: k('わたしの ゆめは せかいりょこうです。', 'My dream is to travel the world.'), n4: k('そうですね、わたしの ゆめは せかいりょこうで ございます。', 'Let me see, my dream is to travel the world. (extra polite)') },
        keigo: 'kiku',
      },
      {
        id: 'daruma.effort',
        ask: { n5: k('いま なにを がんばって いますか。', 'What are you working hard at right now?'), n4: k('いま なにを がんばって いらっしゃいますか。', 'What are you working hard at right now? (honorific)') },
        kind: 'wh',
        fills: [k('にほんごを', 'Japanese'), k('しごとを', 'my job'), k('はやおきを', 'getting up early'), k('ダンスを', 'dancing')],
        endings: { polite: polite(k('がんばっています。', 'working hard (polite)'), [k('がんばっております。', 'working hard (humble)'), 'n4']), casual: [{ jp: k('がんばってる。', 'working hard (casual)') }, { jp: k('がんばってるよ！', 'working hard, you know!') }] },
        example: { kana: k('にほんごを がんばっています。', "I'm working hard at Japanese."), n5: k('いま、にほんごを がんばっています。', "Right now I'm working hard at Japanese."), n4: k('いま、にほんごを がんばって おります。', "Right now I'm working hard at Japanese. (humble)") },
        keigo: 'iru',
      },
      {
        id: 'daruma.fall',
        ask: { n5: k('ころんだら どう しますか。', 'What do you do when you fall over?'), n4: k('ころんだ とき、どう なさいますか。', 'What do you do when you fall over? (honorific)') },
        kind: 'wh',
        fills: [k('すぐ', 'right away'), k('ゆっくり', 'slowly'), k('わらって', 'laughing')],
        endings: { polite: polite(k('おきます。', 'get up (polite)')), casual: [{ jp: k('おきる。', 'get up (plain)') }, { jp: k('おきるよ！', 'get up, you know!') }] },
        example: { kana: k('すぐ おきます。', 'I get up right away.'), n5: k('そうですね、わらって おきます。', 'Let me see, I get up laughing.'), n4: k('そうですね、わらって おきあがります。', 'Let me see, I pick myself up laughing.') },
        keigo: 'suru',
      },
    ],
    appeal: [k('いっしょに ジョギングを', 'jogging together'), k('いっしょに たいそうを', 'exercises together'), k('いっしょに おまいりを', 'a shrine visit together')],
    accept: k('{name}さん、もう かたほうの めも かきました！　ゆめが かないました！', "{name}, I've painted in my other eye! My wish came true!"),
    audience: 'family',
    status: 'draft',
  },
  {
    id: 'robot',
    emoji: '🤖',
    name: k('ロボットの ピカピカさん', 'Pikapika the Robot'),
    job: k('おちゃの せいと', 'tea-ceremony student (retired robot vacuum)'),
    hobbies: [k('おそうじ', 'cleaning'), k('さどう', 'tea ceremony')],
    quirk: 'A retired robot vacuum. Beeps when nervous and quietly cleans the floor during conversations.',
    greeting: k('はじめまして。ロボットの ピカピカです。ピピッ。', "Nice to meet you. I'm Pikapika the robot. Beep boop."),
    questions: [
      {
        id: 'robot.cleaning',
        ask: { n5: k('そうじは すきですか。', 'Do you like cleaning?'), n4: k('おそうじは よく なさいますか。', 'Do you clean often? (honorific)') },
        kind: 'yesno',
        fills: [k('だいすき', 'I love it'), k('すき', 'I like it'), k('ちょっと にがて', "it's not for me")],
        endings: nounEndings(),
        example: { kana: k('はい、すきです。', 'Yes, I like it.'), n5: k('はい、そうじが すきです。', 'Yes, I like cleaning.'), n4: k('はい、まいにち いたします。', 'Yes, I do it every day. (humble)') },
        keigo: 'suru',
      },
      {
        id: 'robot.tea',
        ask: { n5: k('おちゃは よく のみますか。', 'Do you often drink tea?'), n4: k('おちゃは よく めしあがりますか。', 'Do you often have tea? (honorific)') },
        kind: 'yesno',
        fills: [k('まいにち', 'every day'), k('ときどき', 'sometimes'), k('あさに', 'in the morning')],
        endings: { polite: polite(k('のみます。', 'drink (polite)'), [k('いただきます。', 'drink (humble)'), 'n4']), casual: [{ jp: k('のむ。', 'drink (plain)') }, { jp: k('のむよ。', 'drink, you know') }] },
        example: { kana: k('はい、まいにち のみます。', 'Yes, I drink it every day.'), n5: k('はい、まいにち のみます。', 'Yes, I drink it every day.'), n4: k('はい、まいにち いただきます。', 'Yes, I have some every day. (humble)') },
        keigo: 'nomu',
      },
      {
        id: 'robot.music',
        ask: { n5: k('すきな おんがくは なんですか。', 'What music do you like?'), n4: k('どんな おんがくを おききに なりますか。', 'What music do you listen to? (honorific)') },
        kind: 'wh',
        fills: [k('ジャズ', 'jazz'), k('ロック', 'rock'), k('アニメの うた', 'anime songs'), k('でんしおん', 'electronic beeps')],
        endings: nounEndings(),
        example: { kana: k('ジャズです。', "It's jazz."), n5: k('そうですね、ジャズが すきです。', 'Let me see, I like jazz.'), n4: k('そうですね、よく ジャズを ききます。', 'Let me see, I often listen to jazz.') },
        keigo: 'kiku',
      },
    ],
    appeal: [k('いっしょに おちゃかいを', 'a tea party together'), k('いっしょに おそうじを', 'cleaning together'), k('いっしょに ダンスを', 'dancing together')],
    accept: k('{name}さん、ピピッ！　うれしいです！　よろしく おねがいします。', '{name}, beep! I am delighted! I look forward to it.'),
    audience: 'family',
    status: 'draft',
  },
  // ---- Kids: the guest wants to make a friend, and invites you to play ----

  {
    id: 'zashiki',
    emoji: '🎎',
    name: k('ざしきわらしの ワラシちゃん', 'Warashi the House Spirit'),
    job: k('おうちの まもりがみ', 'guardian of the house'),
    hobbies: [k('かくれんぼ', 'hide and seek'), k('おてだま', 'juggling beanbags')],
    quirk: 'A little house spirit who brings good luck to whoever plays with them. Hides in cupboards and giggles.',
    greeting: k('こんにちは！　ざしきわらしの ワラシです。', "Hello! I'm Warashi the house spirit."),
    questions: [
      {
        id: 'zashiki.play',
        ask: { n5: k('すきな あそびは なんですか。', "What's your favourite game to play?"), n4: k('どんな あそびを よく なさいますか。', 'What games do you often play? (honorific)') },
        kind: 'wh',
        fills: [k('おにごっこ', 'tag'), k('かくれんぼ', 'hide and seek'), k('なわとび', 'jump rope'), k('ゲーム', 'video games')],
        endings: nounEndings(false),
        example: { kana: k('おにごっこです。', "It's tag."), n5: k('そうですね、おにごっこが すきです。', 'Let me see, I like tag.'), n4: k('そうですね、よく おにごっこを いたします。', 'Let me see, I often play tag. (humble)') },
        keigo: 'suru',
      },
      {
        id: 'zashiki.snack',
        ask: { n5: k('すきな おやつは なんですか。', "What's your favourite snack?"), n4: k('どんな おやつを よく めしあがりますか。', 'What snacks do you usually have? (honorific)') },
        kind: 'wh',
        fills: [k('プリン', 'pudding'), k('ドーナツ', 'doughnuts'), k('おにぎり', 'rice balls'), k('わたあめ', 'candy floss')],
        endings: nounEndings(false),
        example: { kana: k('プリンです。', "It's pudding."), n5: k('そうですね、プリンが すきです。', 'Let me see, I like pudding.'), n4: k('そうですね、プリンを よく いただきます。', 'Let me see, I often have pudding. (humble)') },
        keigo: 'taberu',
      },
      {
        id: 'zashiki.school',
        ask: { n5: k('がっこうは すきですか。', 'Do you like school?'), n4: k('がっこうは おすきですか。', 'Are you fond of school? (with お)') },
        kind: 'yesno',
        fills: [k('だいすき', 'I love it'), k('すき', 'I like it'), k('やすみじかんが すき', 'I like break time')],
        endings: nounEndings(false),
        example: { kana: k('はい、すきです。', 'Yes, I like it.'), n5: k('はい、がっこうが すきです。', 'Yes, I like school.'), n4: k('ええ、がっこうは とても たのしいです。', 'Oh yes, school is a lot of fun.') },
        keigo: 'da',
      },
    ],
    appeal: [k('いっしょに かくれんぼを', 'hide and seek together'), k('いっしょに おにごっこを', 'tag together'), k('いっしょに おえかきを', 'drawing together')],
    accept: k('{name}さん、きょうから ともだちです！　いっしょに あそびましょう！', "{name}, we're friends from today! Let's play together!"),
    audience: 'kids',
    status: 'draft',
  },
  {
    id: 'ryu',
    emoji: '🐉',
    name: k('りゅうの タツくん', 'Tatsu the Little Dragon'),
    job: k('そらを とぶ れんしゅうちゅう', 'still learning to fly'),
    hobbies: [k('えほん', 'picture books'), k('たんけん', 'exploring')],
    quirk: 'A very small dragon. Sneezes little sparks when excited, and mostly hops instead of flying.',
    greeting: k('はじめまして！　りゅうの タツです。まだ ちいさい りゅうです。', "Nice to meet you! I'm Tatsu the dragon. I'm still a little dragon."),
    questions: [
      {
        id: 'ryu.animal',
        ask: { n5: k('すきな どうぶつは なんですか。', "What's your favourite animal?"), n4: k('どんな どうぶつが おすきですか。', 'What animals are you fond of? (with お)') },
        kind: 'wh',
        fills: [k('いぬ', 'dogs'), k('ねこ', 'cats'), k('パンダ', 'pandas'), k('きょうりゅう', 'dinosaurs')],
        endings: nounEndings(false),
        example: { kana: k('いぬです。', 'Dogs.'), n5: k('そうですね、いぬが すきです。', 'Let me see, I like dogs.'), n4: k('そうですね、いぬが いちばん すきです。', 'Let me see, I like dogs best.') },
        keigo: 'da',
      },
      {
        id: 'ryu.breakfast',
        ask: { n5: k('あさごはんは なにを たべますか。', 'What do you eat for breakfast?'), n4: k('あさごはんは なにを めしあがりますか。', 'What do you have for breakfast? (honorific)') },
        kind: 'wh',
        fills: [k('パンを', 'bread'), k('ごはんを', 'rice'), k('たまごを', 'eggs'), k('ケーキを', 'cake')],
        endings: { polite: polite(k('たべます。', 'eat (polite)'), [k('いただきます。', 'eat (humble)'), 'n4']), casual: [{ jp: k('たべる。', 'eat (plain)') }, { jp: k('たべるよ。', 'eat, you know') }] },
        example: { kana: k('パンを たべます。', 'I eat bread.'), n5: k('ええと、まいあさ パンを たべます。', 'Um, I eat bread every morning.'), n4: k('ええと、まいあさ パンを いただきます。', 'Um, I have bread every morning. (humble)') },
        keigo: 'taberu',
      },
      {
        id: 'ryu.outing',
        ask: { n5: k('やすみの ひは どこに いきますか。', 'Where do you go on your days off?'), n4: k('おやすみの ひは どちらへ いらっしゃいますか。', 'Where do you go on your days off? (honorific)') },
        kind: 'wh',
        fills: [k('こうえんに', 'to the park'), k('うみに', 'to the sea'), k('どうぶつえんに', 'to the zoo'), k('おばあちゃんの いえに', "to Grandma's house")],
        endings: { polite: polite(k('いきます。', 'go (polite)'), [k('まいります。', 'go (humble)'), 'n4']), casual: [{ jp: k('いく。', 'go (plain)') }, { jp: k('いくよ。', 'go, you know') }] },
        example: { kana: k('こうえんに いきます。', 'I go to the park.'), n5: k('そうですね、よく こうえんに いきます。', 'Let me see, I often go to the park.'), n4: k('そうですね、よく こうえんに まいります。', 'Let me see, I often go to the park. (humble)') },
        keigo: 'iku',
      },
    ],
    appeal: [k('いっしょに たんけんを', 'exploring together'), k('いっしょに ボールあそびを', 'playing ball together'), k('いっしょに すなあそびを', 'playing in the sand together')],
    accept: k('{name}さん、きょうから ともだちです！　こんど せなかに のせて あげますね。', "{name}, we're friends from today! Next time I'll give you a ride on my back."),
    audience: 'kids',
    status: 'draft',
  },
  {
    id: 'usagi',
    emoji: '🐰',
    name: k('つきの うさぎの モチちゃん', 'Mochi the Moon Rabbit'),
    job: k('おもちやさん', 'rice-cake maker'),
    hobbies: [k('もちつき', 'pounding rice cakes'), k('ジャンプ', 'jumping')],
    quirk: 'Lives on the moon and pounds mochi all night. Has hopped down for the day and is a little bit lost.',
    greeting: k('こんにちは。つきから きました、うさぎの モチです。', "Hello. I'm Mochi the rabbit, and I've come from the moon."),
    questions: [
      {
        id: 'usagi.friends',
        ask: { n5: k('ともだちは なんにん いますか。', 'How many friends do you have?'), n4: k('おともだちは なんにん いらっしゃいますか。', 'How many friends do you have? (honorific)') },
        kind: 'wh',
        fills: [k('ひとり', 'one'), k('さんにん', 'three'), k('じゅうにん', 'ten'), k('ひゃくにん', 'a hundred')],
        endings: { polite: polite(k('います。', 'there are (polite)'), [k('おります。', 'there are (humble)'), 'n4']), casual: [{ jp: k('いる。', 'there are (plain)') }, { jp: k('いるよ。', 'there are, you know') }] },
        example: { kana: k('さんにん います。', 'I have three.'), n5: k('ええと、ともだちが さんにん います。', 'Um, I have three friends.'), n4: k('ええと、ともだちが さんにん おります。', 'Um, I have three friends. (humble)') },
        keigo: 'iru',
      },
      {
        id: 'usagi.sport',
        ask: { n5: k('スポーツは すきですか。', 'Do you like sports?'), n4: k('スポーツは なさいますか。', 'Do you play any sports? (honorific)') },
        kind: 'yesno',
        fills: [k('だいすき', 'I love them'), k('すき', 'I like them'), k('ちょっと にがて', 'not really my thing')],
        endings: nounEndings(false),
        example: { kana: k('はい、すきです。', 'Yes, I like them.'), n5: k('はい、スポーツが すきです。', 'Yes, I like sports.'), n4: k('はい、ときどき サッカーを いたします。', 'Yes, I play football now and then. (humble)') },
        keigo: 'suru',
      },
      {
        id: 'usagi.mochi',
        ask: { n5: k('おもちは すきですか。', 'Do you like mochi?'), n4: k('おもちは よく めしあがりますか。', 'Do you often have mochi? (honorific)') },
        kind: 'yesno',
        fills: [k('だいすき', 'I love it'), k('すき', 'I like it'), k('あんこの ほうが すき', 'I prefer the bean paste')],
        endings: nounEndings(false),
        example: { kana: k('はい、だいすきです。', 'Yes, I love it.'), n5: k('はい、おもちが だいすきです。', 'Yes, I love mochi.'), n4: k('はい、おしょうがつに よく いただきます。', 'Yes, I often have it at New Year. (humble)') },
        keigo: 'taberu',
      },
    ],
    appeal: [k('いっしょに もちつきを', 'pounding mochi together'), k('いっしょに おつきみを', 'moon-viewing together'), k('いっしょに なわとびを', 'jump rope together')],
    accept: k('{name}さん、つきに あそびに きて ください！　おもちを たくさん つくって まって います。', "{name}, please come and play on the moon! I'll make lots of mochi and wait for you."),
    audience: 'kids',
    status: 'draft',
  },

  // ---- Cheeky: dating-show energy, grown-up questions, still only a cup of tea ----

  {
    id: 'tokkuri',
    emoji: '🍶',
    name: k('とっくりの トックリさん', 'Tokkuri the Sake Flask'),
    job: k('いざかやの てんちょう', 'izakaya manager'),
    hobbies: [k('カラオケ', 'karaoke'), k('はしござけ', 'bar hopping')],
    quirk: 'A sake flask who knows every izakaya in town. Says "just one more" (もう いっぱい) and means five.',
    greeting: k('はじめまして。とっくりの トックリです。もう いっぱい いかがですか。', "Nice to meet you. I'm Tokkuri the sake flask. How about one more?"),
    questions: [
      {
        id: 'tokkuri.drink',
        ask: { n5: k('すきな のみものは なんですか。', "What's your favourite drink?"), n4: k('どんな おさけを よく めしあがりますか。', 'What do you usually like to drink? (honorific)') },
        kind: 'wh',
        fills: [k('ビール', 'beer'), k('にほんしゅ', 'sake'), k('ハイボール', 'whisky highballs'), k('おみず', 'water, honestly')],
        endings: nounEndings(),
        example: { kana: k('ビールです。', "It's beer."), n5: k('そうですね、ビールが すきです。', 'Let me see, I like beer.'), n4: k('そうですね、にほんしゅを よく いただきます。', 'Let me see, I often have sake. (humble)') },
        keigo: 'nomu',
      },
      {
        id: 'tokkuri.howmany',
        ask: { n5: k('いつも なんばい のみますか。', 'How many drinks do you usually have?'), n4: k('いつも なんばいぐらい めしあがりますか。', 'About how many do you usually have? (honorific)') },
        kind: 'wh',
        fills: [k('いっぱい だけ', 'just the one'), k('にはい', 'two'), k('ごはい', 'five'), k('ボトル いっぽん', 'a whole bottle')],
        endings: { polite: polite(k('のみます。', 'drink (polite)'), [k('いただきます。', 'drink (humble)'), 'n4']), casual: [{ jp: k('のむ。', 'drink (plain)') }, { jp: k('のむよ。', 'drink, you know') }] },
        example: { kana: k('にはい のみます。', 'I have two.'), n5: k('ええと、いつも にはい のみます。', 'Um, I usually have two.'), n4: k('ええと、いつも にはいほど いただきます。', 'Um, I usually have about two. (humble)') },
        keigo: 'nomu',
      },
      {
        id: 'tokkuri.morning',
        ask: { n5: k('のんだ つぎの ひは なんじに おきますか。', 'What time do you get up the morning after drinking?'), n4: k('のんだ つぎの ひは なんじに おおきに なりますか。', 'What time do you get up the morning after? (honorific)') },
        kind: 'wh',
        fills: [k('しちじに', 'at seven'), k('じゅうじに', 'at ten'), k('おひるに', 'at noon'), k('ゆうがたに', 'in the evening')],
        endings: { polite: polite(k('おきます。', 'get up (polite)')), casual: [{ jp: k('おきる。', 'get up (plain)') }, { jp: k('おきるよ。', 'get up, you know') }] },
        example: { kana: k('じゅうじに おきます。', 'I get up at ten.'), n5: k('ええと、たいてい じゅうじに おきます。', 'Um, I usually get up at ten.'), n4: k('ええと、たいてい じゅうじに おきて おります。', 'Um, I usually get up at ten. (humble)') },
        keigo: 'okiru',
      },
    ],
    appeal: [k('いっしょに かんぱいを', 'a toast together'), k('いっしょに カラオケを', 'karaoke together'), k('いっしょに はしござけを', 'bar hopping together')],
    accept: k('{name}さん、かんぱい！　こんどは わたしの おごりです……たぶん。', "{name}, cheers! Next round's on me… probably."),
    audience: 'cheeky',
    status: 'draft',
  },
  {
    id: 'noppera',
    emoji: '😶',
    name: k('のっぺらぼうの ノッペさん', 'Noppe the Faceless'),
    job: k('マッチングアプリの ユーザー', 'dating-app regular'),
    hobbies: [k('じぶんさがし', 'finding myself'), k('ヨガ', 'yoga')],
    quirk: 'Has no face, so every dating-app photo is the back of their head. Swears they have a great personality.',
    greeting: k('はじめまして。のっぺらぼうの ノッペです。しゃしんより じつぶつの ほうが いいですよ。', "Nice to meet you. I'm Noppe the faceless. I'm better in person than in my photos."),
    questions: [
      {
        id: 'noppera.habit',
        ask: { n5: k('わるい くせは なんですか。', "What's your worst habit?"), n4: k('なにか わるい くせは ございますか。', 'Do you have any bad habits? (extra polite)') },
        kind: 'wh',
        fills: [k('ねぼう', 'oversleeping'), k('むだづかい', 'wasting money'), k('ながでんわ', 'endless phone calls'), k('いびき', 'snoring')],
        endings: nounEndings(),
        example: { kana: k('ねぼうです。', "It's oversleeping."), n5: k('ええと、ねぼうです。すみません。', "Um, it's oversleeping. Sorry."), n4: k('おはずかしいですが、ねぼうで ございます。', "I'm embarrassed to say it's oversleeping. (extra polite)") },
        keigo: 'aru',
      },
      {
        id: 'noppera.date',
        ask: { n5: k('さいきん デートを しましたか。', 'Have you been on a date lately?'), n4: k('さいきん デートは なさいましたか。', 'Have you been on a date lately? (honorific)') },
        kind: 'yesno',
        fills: [k('きのう', 'yesterday'), k('せんしゅう', 'last week'), k('きょねん', 'last year'), k('じゅうねん まえに', 'ten years ago')],
        endings: { polite: polite(k('しました。', 'did (polite)'), [k('いたしました。', 'did (humble)'), 'n4']), casual: [{ jp: k('した。', 'did (plain)') }, { jp: k('したよ。', 'did, you know') }] },
        example: { kana: k('はい、せんしゅう しました。', 'Yes, last week.'), n5: k('はい、せんしゅう デートを しました。', 'Yes, I went on a date last week.'), n4: k('ええ、せんしゅう いたしました。', 'Yes, last week. (humble)') },
        keigo: 'suru',
      },
      {
        id: 'noppera.type',
        ask: { n5: k('どんな ひとが タイプですか。', "What's your type?"), n4: k('どのような かたが おすきですか。', 'What sort of person are you fond of? (with お)') },
        kind: 'wh',
        fills: [k('やさしい ひと', 'someone kind'), k('おもしろい ひと', 'someone funny'), k('おかねもち', 'someone rich'), k('かおが ある ひと', 'someone with a face')],
        endings: nounEndings(false),
        example: { kana: k('やさしい ひとです。', 'Someone kind.'), n5: k('そうですね、やさしい ひとが タイプです。', 'Let me see, kind people are my type.'), n4: k('そうですね、やさしい かたが すきです。', 'Let me see, I like kind people.') },
        keigo: 'da',
      },
    ],
    appeal: [k('いっしょに おちゃを', 'tea together'), k('いっしょに ヨガを', 'yoga together'), k('いっしょに ドライブを', 'a drive together')],
    accept: k('{name}さん、かおは ないけど、むねが ドキドキして います！', "{name}, I don't have a face, but my heart is pounding!"),
    audience: 'cheeky',
    status: 'draft',
  },
  {
    id: 'rokuro',
    emoji: '💼',
    name: k('ろくろくびの ノビさん', 'Nobi the Long-Necked'),
    job: k('かいしゃいん（ざんぎょうちゅう）', 'office worker (on overtime)'),
    hobbies: [k('サウナ', 'sauna'), k('ざんぎょう', 'overtime, apparently')],
    quirk: 'Works so late their neck has stretched from watching the clock. Checks work email under the table.',
    greeting: k('はじめまして。ろくろくびの ノビです。きょうも ざんぎょうでした。', "Nice to meet you. I'm Nobi the long-necked. Overtime again today."),
    questions: [
      {
        id: 'rokuro.overtime',
        ask: { n5: k('ざんぎょうは よく しますか。', 'Do you work overtime a lot?'), n4: k('ざんぎょうは よく なさいますか。', 'Do you often work overtime? (honorific)') },
        kind: 'yesno',
        fills: [k('まいにち', 'every day'), k('ときどき', 'sometimes'), k('しゅうまつも', 'weekends too')],
        endings: { polite: polite(k('します。', 'do (polite)'), [k('いたします。', 'do (humble)'), 'n4']), casual: [{ jp: k('する。', 'do (plain)') }, { jp: k('するよ。', 'do, you know') }] },
        example: { kana: k('はい、ときどき します。', 'Yes, sometimes.'), n5: k('はい、ときどき ざんぎょうを します。', 'Yes, I work overtime sometimes.'), n4: k('はい、ときどき いたします。', 'Yes, now and then. (humble)') },
        keigo: 'suru',
      },
      {
        id: 'rokuro.boss',
        ask: { n5: k('じょうしは どんな ひとですか。', "What's your boss like?"), n4: k('じょうしは どのような かたで いらっしゃいますか。', 'What sort of person is your boss? (honorific)') },
        kind: 'wh',
        fills: [k('やさしい ひと', 'a kind person'), k('こわい ひと', 'a scary person'), k('いつも ねむい ひと', 'always sleepy'), k('ねこ', 'a cat')],
        endings: nounEndings(false),
        example: { kana: k('やさしい ひとです。', 'A kind person.'), n5: k('そうですね、とても やさしい ひとです。', 'Let me see, a very kind person.'), n4: k('そうですね、たいへん やさしい ひとです。', 'Let me see, a most kind person.') },
        keigo: 'da',
      },
      {
        id: 'rokuro.stress',
        ask: { n5: k('ストレスが ある とき、なにを しますか。', 'What do you do when you are stressed?'), n4: k('ストレスが ある とき、なにを なさいますか。', 'What do you do when you are stressed? (honorific)') },
        kind: 'wh',
        fills: [k('カラオケを', 'karaoke'), k('ジョギングを', 'jogging'), k('やけぐいを', 'stress-eating'), k('かいものを', 'shopping')],
        endings: { polite: polite(k('します。', 'do (polite)'), [k('いたします。', 'do (humble)'), 'n4']), casual: [{ jp: k('する。', 'do (plain)') }, { jp: k('するよ。', 'do, you know') }] },
        example: { kana: k('カラオケを します。', 'I do karaoke.'), n5: k('そうですね、よく カラオケを します。', 'Let me see, I often do karaoke.'), n4: k('そうですね、よく カラオケを いたします。', 'Let me see, I often do karaoke. (humble)') },
        keigo: 'suru',
      },
    ],
    appeal: [k('いっしょに のみかいを', 'a drinks night together'), k('いっしょに カラオケを', 'karaoke together'), k('いっしょに ずるやすみを', 'skiving off work together')],
    accept: k('{name}さん、あした ゆうきゅうを とります！　いっしょに おちゃを のみましょう。', "{name}, I'm taking tomorrow off! Let's have tea together."),
    audience: 'cheeky',
    status: 'draft',
  },
];

/** The guests a game can draw for the room's Audience setting (Family when there are none). */
export function cardsFor(audience: Audience): readonly CharacterCard[] {
  const mine = CARDS.filter((c) => c.audience === audience);
  return mine.length ? mine : CARDS.filter((c) => c.audience === 'family');
}

/** Fills {name} in a line. */
export function withName(jp: JpText, name: string): JpText {
  const f = (s: string) => s.split('{name}').join(name);
  return { text: f(jp.text), kana: f(jp.kana), en: f(jp.en) };
}

export const keigoPair = (id: string): KeigoPair | undefined => KEIGO_PAIRS.find((p) => p.id === id);

// ---- the go-between (なこうど), the N4 hard role ----
//
// When the room has an N4 player, one of them may take Nobiko-san's introduction and closing lines
// for a round: the opening as the guest asks (prompt) and the closing as the round's score comes up.
// The lines are keigo templates filled in from the guest's card. Draft, like the cards.
// N3 (step 6): ＿で ございます / ＿て おります lines.

export interface NakodoLine {
  /** Stable per template, for the phrasebook: intro, profile, ask, appeal, next, leave. */
  id: string;
  jp: JpText;
  /** The N4 frames this line practises, by id (shared/src/japanese/frames.ts). */
  frames: readonly string[];
}

interface NakodoTemplate {
  id: string;
  /** {full} the guest's full name, {short} the name alone, {job} the job. */
  kana: string;
  en: string;
  frames: readonly string[];
}

export const NAKODO: { status: ReviewStatus; open: Record<'intro' | 'profile' | 'ask' | 'appeal', NakodoTemplate>; close: Record<'next' | 'leave', NakodoTemplate> } = {
  status: 'draft',
  open: {
    intro: { id: 'intro', kana: 'みなさま、{full}が おみえに なりました。ごしょうかい いたします。', en: 'Everyone, {full} has arrived. Allow me to introduce them.', frames: ['o-ni-naru', 'keigo'] },
    profile: { id: 'profile', kana: 'こちらは {job}の {short}で いらっしゃいます。', en: 'This is {short}, {job}.', frames: ['keigo'] },
    ask: { id: 'ask', kana: '{short}が みなさまに おききに なります。', en: '{short} has a question for you all.', frames: ['o-ni-naru'] },
    appeal: { id: 'appeal', kana: '{short}から さいごの しつもんが ございます。', en: '{short} has one last question.', frames: ['keigo'] },
  },
  close: {
    next: { id: 'next', kana: '{short}、ありがとう ございました。つぎの しつもんに まいります。', en: 'Thank you, {short}. On to the next question.', frames: ['keigo'] },
    leave: { id: 'leave', kana: '{short}は そろそろ おかえりに なります。', en: '{short} will be leaving soon.', frames: ['o-ni-naru'] },
  },
};

/** The name on its own: かっぱの キュウリさん → キュウリさん (and the English before " the "). */
export function shortName(card: Pick<CharacterCard, 'name'>): JpText {
  const kana = card.name.kana.split('の ').at(-1)!;
  const en = card.name.en.split(' the ')[0]!;
  return { text: kana, kana, en };
}

/** Next to keigo, a ちゃん or くん name takes さん (ワラシちゃん → ワラシさん); the English stays. */
const politeName = (k: string) => k.replace(/(ちゃん|くん)$/, 'さん');

function fill(t: NakodoTemplate, card: CharacterCard): NakodoLine {
  const job = card.job.kana.replace(/（.*?）/g, '');
  const jobEn = card.job.en.replace(/\s*\(.*?\)/g, '');
  const short = shortName(card);
  const f = (x: string, en: boolean) =>
    x
      .split('{full}')
      .join(en ? card.name.en : politeName(card.name.kana))
      .split('{short}')
      .join(en ? short.en : politeName(short.kana))
      .split('{job}')
      .join(en ? `the ${jobEn}` : job);
  const kana = f(t.kana, false);
  return { id: t.id, jp: { text: kana, kana, en: f(t.en, true) }, frames: t.frames };
}

/**
 * The go-between's two lines for a round: the opening (the guest arrives in round 1, their
 * profile in round 2, their question after that, the last question in the closing round) and the
 * closing (on to the next question, or the guest will soon be leaving).
 */
export function nakodoLines(card: CharacterCard, round: number, total: number): { open: NakodoLine; close: NakodoLine } {
  const o = NAKODO.open;
  const open = round <= 1 ? o.intro : round >= total ? o.appeal : round === 2 ? o.profile : o.ask;
  return { open: fill(open, card), close: fill(round >= total ? NAKODO.close.leave : NAKODO.close.next, card) };
}
