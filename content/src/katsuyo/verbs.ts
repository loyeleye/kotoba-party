// Katsuyō Raid's verbs (活用レイド, the Green Car Kana Yōkai Raid: docs/modes/kana-raid.md, "Green Car").
// The yōkai are verbs wearing a form badge: say the form and the yōkai goes down.
//
// Every badge form is spelled out here, so nothing conjugates at runtime (like PackWord.forms). A form is the
// plain, non-past shape (のまされる, たべずに, おきようと する); the mode accepts any tense or politeness of it
// (shared/src/modes/kanaRaid/katsuyoCheck.ts). The verbs are N5/N4 verbs the other games already use, so the
// verb is never the hard part, and each takes only the badges it takes naturally:
//   - 使役受身 (made to): godan verbs use the short form the `saserareru` matcher knows (のまされる, またされる);
//   - ＿たて: only the stems the `tate` matcher knows (やき, でき, ゆで, いれ, ぬり, うまれ…);
//   - ＿っぱなし: only verbs that take it (つける, あける, だす, おく, いれる, わすれる);
//   - ＿かける and ＿きる: only the stems with the half-done and to-the-end sense the matchers list;
//   - 迷惑の受身 (suffering passive): intransitive verbs only, and only in Wave 3 chunks and boss lines (it
//     needs someone who did it: あめに ふられた).
// tests/katsuyoRaid.test.ts checks each form against its frame.
//
// Audiences: verbs are the same for every audience except Kids, which leaves out のむ (drinking), ぬすむ,
// and money (はらう, かう). Everything is `draft` until the fluent check.

/** The room's Audience setting (shared/src/protocol.ts AUDIENCES). */
export type KatsuyoAudience = 'kids' | 'family' | 'cheeky';
import type { JpText, ReviewStatus } from '../types.js';

/** A form badge: one N4 or N3 frame (shared/src/japanese/frames.ts ids). */
export type BadgeId =
  | 'passive'
  | 'potential'
  | 'causative'
  | 'yasui-nikui'
  | 'saserareru'
  | 'suffering-passive'
  | 'zu-ni'
  | 'you-to-suru'
  | 'ppanashi'
  | 'kakeru'
  | 'kiru'
  | 'tate';

export interface Badge {
  id: BadgeId;
  /** The badge's name on the sash. */
  ja: string;
  jaKana: string;
  en: string;
  /** Placeholder icon until the badge art is drawn. */
  icon: string;
  /** N4 badges, and N3 badges (the N3 line's frames, ＿させられる and the suffering passive among them). */
  side: 'n4' | 'n3';
  /** The learning-path goal the frame counts for (shared/src/path.ts). */
  goal: string;
  example: JpText;
  /** Waves 1–2 and boss pieces can deal it as a bare form (the suffering passive needs a whole chunk). */
  drill: boolean;
}

export const BADGES: readonly Badge[] = [
  { id: 'passive', ja: '受身', jaKana: 'うけみ', en: 'passive', icon: '🫳', side: 'n4', goal: '4.13', example: { text: '叱られた', kana: 'しかられた', en: 'got told off' }, drill: true },
  { id: 'potential', ja: '可能', jaKana: 'かのう', en: 'can do', icon: '💪', side: 'n4', goal: '4.4', example: { text: '食べられる', kana: 'たべられる', en: 'can eat' }, drill: true },
  { id: 'causative', ja: '使役', jaKana: 'しえき', en: 'make / let', icon: '👉', side: 'n4', goal: '4.2', example: { text: '飲ませる', kana: 'のませる', en: 'make someone drink' }, drill: true },
  { id: 'yasui-nikui', ja: '＿やすい／にくい', jaKana: 'やすい・にくい', en: 'easy / hard to', icon: '⚖️', side: 'n4', goal: '4.13', example: { text: '読みやすい', kana: 'よみやすい', en: 'easy to read' }, drill: true },
  { id: 'saserareru', ja: '使役受身', jaKana: 'しえきうけみ', en: 'made to', icon: '😩', side: 'n3', goal: '3.2', example: { text: '飲まされた', kana: 'のまされた', en: 'was made to drink' }, drill: true },
  { id: 'suffering-passive', ja: '迷惑の受身', jaKana: 'めいわくの うけみ', en: 'it happened to me', icon: '☔', side: 'n3', goal: '3.2', example: { text: '雨に降られた', kana: 'あめに ふられた', en: 'got rained on' }, drill: false },
  { id: 'zu-ni', ja: '＿ずに', jaKana: 'ずに', en: 'without', icon: '🚫', side: 'n3', goal: '3.6', example: { text: '寝ずに', kana: 'ねずに', en: 'without sleeping' }, drill: true },
  { id: 'you-to-suru', ja: '＿ようと する', jaKana: 'ようと する', en: 'tried to', icon: '🏃', side: 'n3', goal: '3.6', example: { text: '起きようとした', kana: 'おきようと した', en: 'tried to get up' }, drill: true },
  { id: 'ppanashi', ja: '＿っぱなし', jaKana: 'っぱなし', en: 'left that way', icon: '💡', side: 'n3', goal: '3.2', example: { text: 'つけっぱなし', kana: 'つけっぱなし', en: 'left on' }, drill: true },
  { id: 'kakeru', ja: '＿かける', jaKana: 'かける', en: 'half-done', icon: '🌗', side: 'n3', goal: '3.2', example: { text: '読みかけの', kana: 'よみかけの', en: 'half-read' }, drill: true },
  { id: 'kiru', ja: '＿きる', jaKana: 'きる', en: 'all the way', icon: '🏁', side: 'n3', goal: '3.2', example: { text: '食べきれない', kana: 'たべきれない', en: "can't eat it all" }, drill: true },
  { id: 'tate', ja: '＿たて', jaKana: 'たて', en: 'fresh from', icon: '🍞', side: 'n3', goal: '3.11', example: { text: '焼きたて', kana: 'やきたて', en: 'fresh from the oven' }, drill: true },
];

export const BADGE_BY_ID: Readonly<Record<BadgeId, Badge>> = Object.fromEntries(BADGES.map((b) => [b.id, b])) as Record<BadgeId, Badge>;

/** One badge form: kana with spaces between words, as the game's lines are written. */
export interface KatsuyoForm {
  text: string;
  kana: string;
  en: string;
}

export interface KatsuyoVerb {
  id: string;
  /** The dictionary form, on the yōkai's talisman tag. */
  verb: JpText;
  group: 'godan' | 'ichidan' | 'suru' | 'kuru';
  level: 'n5' | 'n4';
  /** Left out: every audience. */
  audiences?: readonly KatsuyoAudience[];
  forms: Partial<Record<BadgeId, KatsuyoForm>>;
  status: ReviewStatus;
}

export const KATSUYO_VERBS: readonly KatsuyoVerb[] = [
  {
    id: 'nomu',
    verb: { text: '飲む', kana: 'のむ', en: 'drink' },
    group: 'godan',
    level: 'n5',
    audiences: ['family', 'cheeky'],
    forms: {
      potential: { text: '飲める', kana: 'のめる', en: 'can drink' },
      causative: { text: '飲ませる', kana: 'のませる', en: 'make or let someone drink' },
      'yasui-nikui': { text: '飲みやすい', kana: 'のみやすい', en: 'easy to drink' },
      saserareru: { text: '飲まされる', kana: 'のまされる', en: 'be made to drink' },
      'zu-ni': { text: '飲まずに', kana: 'のまずに', en: 'without drinking' },
      'you-to-suru': { text: '飲もうと する', kana: 'のもうと する', en: 'try to drink, be about to drink' },
      kakeru: { text: '飲みかける', kana: 'のみかける', en: 'half-drunk, nearly drink' },
      kiru: { text: '飲みきる', kana: 'のみきる', en: 'drink it all' },
    },
    status: 'draft',
  },
  {
    id: 'yomu',
    verb: { text: '読む', kana: 'よむ', en: 'read' },
    group: 'godan',
    level: 'n5',
    forms: {
      passive: { text: '読まれる', kana: 'よまれる', en: 'be read (by someone)' },
      potential: { text: '読める', kana: 'よめる', en: 'can read' },
      causative: { text: '読ませる', kana: 'よませる', en: 'make or let someone read' },
      'yasui-nikui': { text: '読みやすい', kana: 'よみやすい', en: 'easy to read' },
      saserareru: { text: '読まされる', kana: 'よまされる', en: 'be made to read' },
      'zu-ni': { text: '読まずに', kana: 'よまずに', en: 'without reading' },
      'you-to-suru': { text: '読もうと する', kana: 'よもうと する', en: 'try to read, be about to read' },
      kakeru: { text: '読みかける', kana: 'よみかける', en: 'half-read, nearly read' },
      kiru: { text: '読みきる', kana: 'よみきる', en: 'read it all' },
    },
    status: 'draft',
  },
  {
    id: 'kaku',
    verb: { text: '書く', kana: 'かく', en: 'write' },
    group: 'godan',
    level: 'n5',
    forms: {
      passive: { text: '書かれる', kana: 'かかれる', en: 'be written (by someone)' },
      causative: { text: '書かせる', kana: 'かかせる', en: 'make or let someone write' },
      'yasui-nikui': { text: '書きやすい', kana: 'かきやすい', en: 'easy to write' },
      saserareru: { text: '書かされる', kana: 'かかされる', en: 'be made to write' },
      'zu-ni': { text: '書かずに', kana: 'かかずに', en: 'without writing' },
      'you-to-suru': { text: '書こうと する', kana: 'かこうと する', en: 'try to write, be about to write' },
    },
    status: 'draft',
  },
  {
    id: 'matsu',
    verb: { text: '待つ', kana: 'まつ', en: 'wait' },
    group: 'godan',
    level: 'n5',
    forms: {
      potential: { text: '待てる', kana: 'まてる', en: 'can wait' },
      causative: { text: '待たせる', kana: 'またせる', en: 'keep someone waiting' },
      saserareru: { text: '待たされる', kana: 'またされる', en: 'be made to wait' },
      'zu-ni': { text: '待たずに', kana: 'またずに', en: 'without waiting' },
      'you-to-suru': { text: '待とうと する', kana: 'まとうと する', en: 'try to wait, be about to wait' },
      kiru: { text: '待ちきれない', kana: 'まちきれない', en: "can't wait any longer" },
    },
    status: 'draft',
  },
  {
    id: 'kiku',
    verb: { text: '聞く', kana: 'きく', en: 'listen, ask' },
    group: 'godan',
    level: 'n5',
    forms: {
      passive: { text: '聞かれる', kana: 'きかれる', en: 'be asked (by someone)' },
      potential: { text: '聞ける', kana: 'きける', en: 'can hear, can ask' },
      causative: { text: '聞かせる', kana: 'きかせる', en: 'make someone listen' },
      'yasui-nikui': { text: '聞きやすい', kana: 'ききやすい', en: 'easy to hear' },
      saserareru: { text: '聞かされる', kana: 'きかされる', en: 'be made to listen' },
      'zu-ni': { text: '聞かずに', kana: 'きかずに', en: 'without listening' },
      'you-to-suru': { text: '聞こうと する', kana: 'きこうと する', en: 'try to listen, ask, be about to listen, ask' },
    },
    status: 'draft',
  },
  {
    id: 'utau',
    verb: { text: '歌う', kana: 'うたう', en: 'sing' },
    group: 'godan',
    level: 'n5',
    forms: {
      potential: { text: '歌える', kana: 'うたえる', en: 'can sing' },
      causative: { text: '歌わせる', kana: 'うたわせる', en: 'make or let someone sing' },
      'yasui-nikui': { text: '歌いやすい', kana: 'うたいやすい', en: 'easy to sing' },
      saserareru: { text: '歌わされる', kana: 'うたわされる', en: 'be made to sing' },
      'zu-ni': { text: '歌わずに', kana: 'うたわずに', en: 'without singing' },
      'you-to-suru': { text: '歌おうと する', kana: 'うたおうと する', en: 'try to sing, be about to sing' },
      kiru: { text: '歌いきる', kana: 'うたいきる', en: 'sing it all' },
    },
    status: 'draft',
  },
  {
    id: 'hashiru',
    verb: { text: '走る', kana: 'はしる', en: 'run' },
    group: 'godan',
    level: 'n5',
    forms: {
      potential: { text: '走れる', kana: 'はしれる', en: 'can run' },
      causative: { text: '走らせる', kana: 'はしらせる', en: 'make or let someone run' },
      saserareru: { text: '走らされる', kana: 'はしらされる', en: 'be made to run' },
      'zu-ni': { text: '走らずに', kana: 'はしらずに', en: 'without running' },
      'you-to-suru': { text: '走ろうと する', kana: 'はしろうと する', en: 'try to run, be about to run' },
      kiru: { text: '走りきる', kana: 'はしりきる', en: 'run it all' },
    },
    status: 'draft',
  },
  {
    id: 'aruku',
    verb: { text: '歩く', kana: 'あるく', en: 'walk' },
    group: 'godan',
    level: 'n5',
    forms: {
      potential: { text: '歩ける', kana: 'あるける', en: 'can walk' },
      causative: { text: '歩かせる', kana: 'あるかせる', en: 'make or let someone walk' },
      'yasui-nikui': { text: '歩きやすい', kana: 'あるきやすい', en: 'easy to walk' },
      saserareru: { text: '歩かされる', kana: 'あるかされる', en: 'be made to walk' },
      'zu-ni': { text: '歩かずに', kana: 'あるかずに', en: 'without walking' },
    },
    status: 'draft',
  },
  {
    id: 'tsukuru',
    verb: { text: '作る', kana: 'つくる', en: 'make' },
    group: 'godan',
    level: 'n5',
    forms: {
      passive: { text: '作られる', kana: 'つくられる', en: 'be made (by someone)' },
      causative: { text: '作らせる', kana: 'つくらせる', en: 'make or let someone make' },
      'yasui-nikui': { text: '作りやすい', kana: 'つくりやすい', en: 'easy to make' },
      saserareru: { text: '作らされる', kana: 'つくらされる', en: 'be made to make' },
      'zu-ni': { text: '作らずに', kana: 'つくらずに', en: 'without making' },
      'you-to-suru': { text: '作ろうと する', kana: 'つくろうと する', en: 'try to make, be about to make' },
      kakeru: { text: '作りかける', kana: 'つくりかける', en: 'half-made, nearly make' },
      tate: { text: '作りたて', kana: 'つくりたて', en: 'freshly made' },
    },
    status: 'draft',
  },
  {
    id: 'arau',
    verb: { text: '洗う', kana: 'あらう', en: 'wash' },
    group: 'godan',
    level: 'n5',
    forms: {
      potential: { text: '洗える', kana: 'あらえる', en: 'can wash' },
      causative: { text: '洗わせる', kana: 'あらわせる', en: 'make or let someone wash' },
      saserareru: { text: '洗わされる', kana: 'あらわされる', en: 'be made to wash' },
      'zu-ni': { text: '洗わずに', kana: 'あらわずに', en: 'without washing' },
      tate: { text: '洗いたて', kana: 'あらいたて', en: 'freshly washed' },
    },
    status: 'draft',
  },
  {
    id: 'harau',
    verb: { text: '払う', kana: 'はらう', en: 'pay' },
    group: 'godan',
    level: 'n4',
    audiences: ['family', 'cheeky'],
    forms: {
      potential: { text: '払える', kana: 'はらえる', en: 'can pay' },
      causative: { text: '払わせる', kana: 'はらわせる', en: 'make or let someone pay' },
      saserareru: { text: '払わされる', kana: 'はらわされる', en: 'be made to pay' },
      'zu-ni': { text: '払わずに', kana: 'はらわずに', en: 'without paying' },
    },
    status: 'draft',
  },
  {
    id: 'tsukau',
    verb: { text: '使う', kana: 'つかう', en: 'use' },
    group: 'godan',
    level: 'n5',
    forms: {
      passive: { text: '使われる', kana: 'つかわれる', en: 'be used (by someone)' },
      potential: { text: '使える', kana: 'つかえる', en: 'can use' },
      causative: { text: '使わせる', kana: 'つかわせる', en: 'make or let someone use' },
      'yasui-nikui': { text: '使いやすい', kana: 'つかいやすい', en: 'easy to use' },
      'zu-ni': { text: '使わずに', kana: 'つかわずに', en: 'without using' },
      kiru: { text: '使いきる', kana: 'つかいきる', en: 'use it all up' },
    },
    status: 'draft',
  },
  {
    id: 'hakobu',
    verb: { text: '運ぶ', kana: 'はこぶ', en: 'carry' },
    group: 'godan',
    level: 'n4',
    forms: {
      potential: { text: '運べる', kana: 'はこべる', en: 'can carry' },
      causative: { text: '運ばせる', kana: 'はこばせる', en: 'make or let someone carry' },
      saserareru: { text: '運ばされる', kana: 'はこばされる', en: 'be made to carry' },
      kiru: { text: '運びきる', kana: 'はこびきる', en: 'carry it all' },
    },
    status: 'draft',
  },
  {
    id: 'suwaru',
    verb: { text: '座る', kana: 'すわる', en: 'sit' },
    group: 'godan',
    level: 'n5',
    forms: {
      potential: { text: '座れる', kana: 'すわれる', en: 'can sit' },
      causative: { text: '座らせる', kana: 'すわらせる', en: 'make or let someone sit' },
      'suffering-passive': { text: '座られる', kana: 'すわられる', en: 'have someone sit (in your seat) on you' },
      'zu-ni': { text: '座らずに', kana: 'すわらずに', en: 'without sitting' },
      'you-to-suru': { text: '座ろうと する', kana: 'すわろうと する', en: 'try to sit, be about to sit' },
    },
    status: 'draft',
  },
  {
    id: 'motsu',
    verb: { text: '持つ', kana: 'もつ', en: 'hold, carry' },
    group: 'godan',
    level: 'n5',
    forms: {
      causative: { text: '持たせる', kana: 'もたせる', en: 'make someone carry' },
      'yasui-nikui': { text: '持ちやすい', kana: 'もちやすい', en: 'easy to hold' },
      saserareru: { text: '持たされる', kana: 'もたされる', en: 'be made to carry' },
      'zu-ni': { text: '持たずに', kana: 'もたずに', en: 'without holding' },
    },
    status: 'draft',
  },
  {
    id: 'odoru',
    verb: { text: '踊る', kana: 'おどる', en: 'dance' },
    group: 'godan',
    level: 'n5',
    forms: {
      potential: { text: '踊れる', kana: 'おどれる', en: 'can dance' },
      causative: { text: '踊らせる', kana: 'おどらせる', en: 'make or let someone dance' },
      saserareru: { text: '踊らされる', kana: 'おどらされる', en: 'be made to dance' },
      'zu-ni': { text: '踊らずに', kana: 'おどらずに', en: 'without dancing' },
    },
    status: 'draft',
  },
  {
    id: 'naku',
    verb: { text: '泣く', kana: 'なく', en: 'cry' },
    group: 'godan',
    level: 'n4',
    forms: {
      causative: { text: '泣かせる', kana: 'なかせる', en: 'make someone cry' },
      saserareru: { text: '泣かされる', kana: 'なかされる', en: 'be made to cry (moved to tears)' },
      'suffering-passive': { text: '泣かれる', kana: 'なかれる', en: 'have someone cry on you' },
      'zu-ni': { text: '泣かずに', kana: 'なかずに', en: 'without crying' },
    },
    status: 'draft',
  },
  {
    id: 'warau',
    verb: { text: '笑う', kana: 'わらう', en: 'laugh' },
    group: 'godan',
    level: 'n5',
    forms: {
      passive: { text: '笑われる', kana: 'わらわれる', en: 'be laughed at (by someone)' },
      causative: { text: '笑わせる', kana: 'わらわせる', en: 'make someone laugh' },
      'zu-ni': { text: '笑わずに', kana: 'わらわずに', en: 'without laughing' },
    },
    status: 'draft',
  },
  {
    id: 'iku',
    verb: { text: '行く', kana: 'いく', en: 'go' },
    group: 'godan',
    level: 'n5',
    forms: {
      potential: { text: '行ける', kana: 'いける', en: 'can go' },
      causative: { text: '行かせる', kana: 'いかせる', en: 'make or let someone go' },
      saserareru: { text: '行かされる', kana: 'いかされる', en: 'be made to go' },
      'zu-ni': { text: '行かずに', kana: 'いかずに', en: 'without going' },
      'you-to-suru': { text: '行こうと する', kana: 'いこうと する', en: 'try to go, be about to go' },
    },
    status: 'draft',
  },
  {
    id: 'kaeru',
    verb: { text: '帰る', kana: 'かえる', en: 'go home' },
    group: 'godan',
    level: 'n5',
    forms: {
      potential: { text: '帰れる', kana: 'かえれる', en: 'can go home' },
      causative: { text: '帰らせる', kana: 'かえらせる', en: 'send someone home' },
      'suffering-passive': { text: '帰られる', kana: 'かえられる', en: 'have someone go home on you' },
      'zu-ni': { text: '帰らずに', kana: 'かえらずに', en: 'without going home' },
      'you-to-suru': { text: '帰ろうと する', kana: 'かえろうと する', en: 'try to go home, be about to go home' },
    },
    status: 'draft',
  },
  {
    id: 'furu',
    verb: { text: '降る', kana: 'ふる', en: 'fall (rain, snow)' },
    group: 'godan',
    level: 'n5',
    forms: {
      'suffering-passive': { text: '降られる', kana: 'ふられる', en: 'get rained (or snowed) on' },
    },
    status: 'draft',
  },
  {
    id: 'nusumu',
    verb: { text: '盗む', kana: 'ぬすむ', en: 'steal' },
    group: 'godan',
    level: 'n4',
    audiences: ['family', 'cheeky'],
    forms: {
      passive: { text: '盗まれる', kana: 'ぬすまれる', en: 'get (something) stolen' },
    },
    status: 'draft',
  },
  {
    id: 'shikaru',
    verb: { text: '叱る', kana: 'しかる', en: 'scold' },
    group: 'godan',
    level: 'n4',
    forms: {
      passive: { text: '叱られる', kana: 'しかられる', en: 'get told off' },
    },
    status: 'draft',
  },
  {
    id: 'fumu',
    verb: { text: '踏む', kana: 'ふむ', en: 'step on' },
    group: 'godan',
    level: 'n4',
    forms: {
      passive: { text: '踏まれる', kana: 'ふまれる', en: 'get stepped on' },
    },
    status: 'draft',
  },
  {
    id: 'yasumu',
    verb: { text: '休む', kana: 'やすむ', en: 'rest, take a day off' },
    group: 'godan',
    level: 'n5',
    forms: {
      causative: { text: '休ませる', kana: 'やすませる', en: 'let someone rest' },
      'suffering-passive': { text: '休まれる', kana: 'やすまれる', en: 'have someone take the day off on you' },
      'zu-ni': { text: '休まずに', kana: 'やすまずに', en: 'without resting' },
    },
    status: 'draft',
  },
  {
    id: 'hanasu',
    verb: { text: '話す', kana: 'はなす', en: 'talk' },
    group: 'godan',
    level: 'n5',
    forms: {
      potential: { text: '話せる', kana: 'はなせる', en: 'can talk' },
      'yasui-nikui': { text: '話しやすい', kana: 'はなしやすい', en: 'easy to talk to' },
      'zu-ni': { text: '話さずに', kana: 'はなさずに', en: 'without talking' },
      'you-to-suru': { text: '話そうと する', kana: 'はなそうと する', en: 'try to talk, be about to talk' },
    },
    status: 'draft',
  },
  {
    id: 'oku',
    verb: { text: '置く', kana: 'おく', en: 'put, leave' },
    group: 'godan',
    level: 'n5',
    forms: {
      ppanashi: { text: '置きっぱなし', kana: 'おきっぱなし', en: 'left lying out' },
    },
    status: 'draft',
  },
  {
    id: 'dasu',
    verb: { text: '出す', kana: 'だす', en: 'take out' },
    group: 'godan',
    level: 'n5',
    forms: {
      ppanashi: { text: '出しっぱなし', kana: 'だしっぱなし', en: 'left out (not put away)' },
      'zu-ni': { text: '出さずに', kana: 'ださずに', en: 'without taking out' },
    },
    status: 'draft',
  },
  {
    id: 'yaku',
    verb: { text: '焼く', kana: 'やく', en: 'bake, grill' },
    group: 'godan',
    level: 'n4',
    forms: {
      tate: { text: '焼きたて', kana: 'やきたて', en: 'fresh from the oven' },
    },
    status: 'draft',
  },
  {
    id: 'noru',
    verb: { text: '乗る', kana: 'のる', en: 'ride, get on' },
    group: 'godan',
    level: 'n5',
    forms: {
      potential: { text: '乗れる', kana: 'のれる', en: 'can ride, get on' },
      causative: { text: '乗らせる', kana: 'のらせる', en: 'let someone ride' },
      'zu-ni': { text: '乗らずに', kana: 'のらずに', en: 'without riding' },
      'you-to-suru': { text: '乗ろうと する', kana: 'のろうと する', en: 'try to ride, get on, be about to ride, get on' },
    },
    status: 'draft',
  },
  {
    id: 'au',
    verb: { text: '会う', kana: 'あう', en: 'meet' },
    group: 'godan',
    level: 'n5',
    forms: {
      potential: { text: '会える', kana: 'あえる', en: 'can meet' },
      'zu-ni': { text: '会わずに', kana: 'あわずに', en: 'without meeting' },
      'you-to-suru': { text: '会おうと する', kana: 'あおうと する', en: 'try to meet, be about to meet' },
    },
    status: 'draft',
  },
  {
    id: 'tetsudau',
    verb: { text: '手伝う', kana: 'てつだう', en: 'help' },
    group: 'godan',
    level: 'n4',
    forms: {
      causative: { text: '手伝わせる', kana: 'てつだわせる', en: 'make or let someone help' },
      saserareru: { text: '手伝わされる', kana: 'てつだわされる', en: 'be made to help' },
      'zu-ni': { text: '手伝わずに', kana: 'てつだわずに', en: 'without helping' },
    },
    status: 'draft',
  },
  {
    id: 'narabu',
    verb: { text: '並ぶ', kana: 'ならぶ', en: 'line up, queue' },
    group: 'godan',
    level: 'n4',
    forms: {
      causative: { text: '並ばせる', kana: 'ならばせる', en: 'make or let someone line up, queue' },
      saserareru: { text: '並ばされる', kana: 'ならばされる', en: 'be made to line up, queue' },
      'zu-ni': { text: '並ばずに', kana: 'ならばずに', en: 'without queuing' },
    },
    status: 'draft',
  },
  {
    id: 'kayou',
    verb: { text: '通う', kana: 'かよう', en: 'go regularly (to a class)' },
    group: 'godan',
    level: 'n4',
    forms: {
      causative: { text: '通わせる', kana: 'かよわせる', en: 'send someone (to a class)' },
      saserareru: { text: '通わされる', kana: 'かよわされる', en: 'be made to go (to a class)' },
      'zu-ni': { text: '通わずに', kana: 'かよわずに', en: 'without going' },
    },
    status: 'draft',
  },
  {
    id: 'yaru',
    verb: { text: 'やる', kana: 'やる', en: 'do' },
    group: 'godan',
    level: 'n4',
    forms: {
      saserareru: { text: 'やらされる', kana: 'やらされる', en: 'be made to do' },
      'zu-ni': { text: 'やらずに', kana: 'やらずに', en: 'without doing' },
      kakeru: { text: 'やりかける', kana: 'やりかける', en: 'half-done, nearly do' },
      kiru: { text: 'やりきる', kana: 'やりきる', en: 'see it through to the end' },
    },
    status: 'draft',
  },
  {
    id: 'nuru',
    verb: { text: '塗る', kana: 'ぬる', en: 'paint, spread' },
    group: 'godan',
    level: 'n4',
    forms: {
      tate: { text: '塗りたて', kana: 'ぬりたて', en: 'freshly painted (wet paint)' },
    },
    status: 'draft',
  },
  {
    id: 'kau',
    verb: { text: '買う', kana: 'かう', en: 'buy' },
    group: 'godan',
    level: 'n5',
    audiences: ['family', 'cheeky'],
    forms: {
      'zu-ni': { text: '買わずに', kana: 'かわずに', en: 'without buying' },
      'you-to-suru': { text: '買おうと する', kana: 'かおうと する', en: 'try to buy, be about to buy' },
      tate: { text: '買いたて', kana: 'かいたて', en: 'just bought, brand new' },
    },
    status: 'draft',
  },
  {
    id: 'korobu',
    verb: { text: '転ぶ', kana: 'ころぶ', en: 'fall over' },
    group: 'godan',
    level: 'n4',
    forms: {
      kakeru: { text: '転びかける', kana: 'ころびかける', en: 'nearly fall over' },
    },
    status: 'draft',
  },
  {
    id: 'taberu',
    verb: { text: '食べる', kana: 'たべる', en: 'eat' },
    group: 'ichidan',
    level: 'n5',
    forms: {
      passive: { text: '食べられる', kana: 'たべられる', en: 'be eaten (by someone)' },
      potential: { text: '食べられる', kana: 'たべられる', en: 'can eat' },
      causative: { text: '食べさせる', kana: 'たべさせる', en: 'make or let someone eat' },
      'yasui-nikui': { text: '食べやすい', kana: 'たべやすい', en: 'easy to eat' },
      saserareru: { text: '食べさせられる', kana: 'たべさせられる', en: 'be made to eat' },
      'zu-ni': { text: '食べずに', kana: 'たべずに', en: 'without eating' },
      'you-to-suru': { text: '食べようと する', kana: 'たべようと する', en: 'try to eat, be about to eat' },
      kakeru: { text: '食べかける', kana: 'たべかける', en: 'half-eaten, nearly eat' },
      kiru: { text: '食べきる', kana: 'たべきる', en: 'eat it all' },
    },
    status: 'draft',
  },
  {
    id: 'neru',
    verb: { text: '寝る', kana: 'ねる', en: 'sleep, go to bed' },
    group: 'ichidan',
    level: 'n5',
    forms: {
      potential: { text: '寝られる', kana: 'ねられる', en: 'can sleep' },
      'zu-ni': { text: '寝ずに', kana: 'ねずに', en: 'without sleeping' },
      'you-to-suru': { text: '寝ようと する', kana: 'ねようと する', en: 'try to sleep, go to bed, be about to sleep, go to bed' },
      kakeru: { text: '寝かける', kana: 'ねかける', en: 'nearly fall asleep' },
    },
    status: 'draft',
  },
  {
    id: 'okiru',
    verb: { text: '起きる', kana: 'おきる', en: 'get up' },
    group: 'ichidan',
    level: 'n5',
    forms: {
      potential: { text: '起きられる', kana: 'おきられる', en: 'can get up' },
      'zu-ni': { text: '起きずに', kana: 'おきずに', en: 'without getting up' },
      'you-to-suru': { text: '起きようと する', kana: 'おきようと する', en: 'try to get up, be about to get up' },
    },
    status: 'draft',
  },
  {
    id: 'miru',
    verb: { text: '見る', kana: 'みる', en: 'see, watch' },
    group: 'ichidan',
    level: 'n5',
    forms: {
      passive: { text: '見られる', kana: 'みられる', en: 'be seen (by someone)' },
      potential: { text: '見られる', kana: 'みられる', en: 'can see, watch' },
      'you-to-suru': { text: '見ようと する', kana: 'みようと する', en: 'try to see, watch, be about to see, watch' },
    },
    status: 'draft',
  },
  {
    id: 'wasureru',
    verb: { text: '忘れる', kana: 'わすれる', en: 'forget' },
    group: 'ichidan',
    level: 'n4',
    forms: {
      'zu-ni': { text: '忘れずに', kana: 'わすれずに', en: 'without forgetting' },
      kakeru: { text: '忘れかける', kana: 'わすれかける', en: 'half-forgotten, nearly forget' },
      ppanashi: { text: '忘れっぱなし', kana: 'わすれっぱなし', en: 'forgotten and left that way' },
    },
    status: 'draft',
  },
  {
    id: 'oboeru',
    verb: { text: '覚える', kana: 'おぼえる', en: 'learn, memorise' },
    group: 'ichidan',
    level: 'n4',
    forms: {
      potential: { text: '覚えられる', kana: 'おぼえられる', en: 'can learn, memorise' },
      causative: { text: '覚えさせる', kana: 'おぼえさせる', en: 'make or let someone learn, memorise' },
      'yasui-nikui': { text: '覚えやすい', kana: 'おぼえやすい', en: 'easy to learn, memorise' },
      saserareru: { text: '覚えさせられる', kana: 'おぼえさせられる', en: 'be made to learn, memorise' },
      kiru: { text: '覚えきれない', kana: 'おぼえきれない', en: "can't memorise it all" },
      tate: { text: '覚えたて', kana: 'おぼえたて', en: 'just learned' },
    },
    status: 'draft',
  },
  {
    id: 'dekiru',
    verb: { text: 'できる', kana: 'できる', en: 'be made, be ready' },
    group: 'ichidan',
    level: 'n5',
    forms: {
      tate: { text: 'できたて', kana: 'できたて', en: 'freshly made' },
    },
    status: 'draft',
  },
  {
    id: 'yuderu',
    verb: { text: 'ゆでる', kana: 'ゆでる', en: 'boil' },
    group: 'ichidan',
    level: 'n4',
    forms: {
      tate: { text: 'ゆでたて', kana: 'ゆでたて', en: 'freshly boiled' },
    },
    status: 'draft',
  },
  {
    id: 'ireru',
    verb: { text: '入れる', kana: 'いれる', en: 'put in, make (tea, coffee)' },
    group: 'ichidan',
    level: 'n5',
    forms: {
      'zu-ni': { text: '入れずに', kana: 'いれずに', en: 'without putting in' },
      ppanashi: { text: '入れっぱなし', kana: 'いれっぱなし', en: 'left in' },
      tate: { text: '入れたて', kana: 'いれたて', en: 'freshly made (tea, coffee)' },
    },
    status: 'draft',
  },
  {
    id: 'tsukeru',
    verb: { text: 'つける', kana: 'つける', en: 'turn on' },
    group: 'ichidan',
    level: 'n4',
    forms: {
      'zu-ni': { text: 'つけずに', kana: 'つけずに', en: 'without turning on' },
      'you-to-suru': { text: 'つけようと する', kana: 'つけようと する', en: 'try to turn on, be about to turn on' },
      ppanashi: { text: 'つけっぱなし', kana: 'つけっぱなし', en: 'left on' },
    },
    status: 'draft',
  },
  {
    id: 'akeru',
    verb: { text: '開ける', kana: 'あける', en: 'open' },
    group: 'ichidan',
    level: 'n5',
    forms: {
      potential: { text: '開けられる', kana: 'あけられる', en: 'can open' },
      'zu-ni': { text: '開けずに', kana: 'あけずに', en: 'without opening' },
      'you-to-suru': { text: '開けようと する', kana: 'あけようと する', en: 'try to open, be about to open' },
      ppanashi: { text: '開けっぱなし', kana: 'あけっぱなし', en: 'left open' },
    },
    status: 'draft',
  },
  {
    id: 'nigeru',
    verb: { text: '逃げる', kana: 'にげる', en: 'run away' },
    group: 'ichidan',
    level: 'n4',
    forms: {
      'suffering-passive': { text: '逃げられる', kana: 'にげられる', en: 'have someone run away on you' },
      'zu-ni': { text: '逃げずに', kana: 'にげずに', en: 'without running away' },
      'you-to-suru': { text: '逃げようと する', kana: 'にげようと する', en: 'try to run away, be about to run away' },
    },
    status: 'draft',
  },
  {
    id: 'kiru-wear',
    verb: { text: '着る', kana: 'きる', en: 'wear, put on' },
    group: 'ichidan',
    level: 'n5',
    forms: {
      potential: { text: '着られる', kana: 'きられる', en: 'can wear, put on' },
      'yasui-nikui': { text: '着やすい', kana: 'きやすい', en: 'easy to wear' },
      saserareru: { text: '着させられる', kana: 'きさせられる', en: 'be made to wear' },
    },
    status: 'draft',
  },
  {
    id: 'kieru',
    verb: { text: '消える', kana: 'きえる', en: 'go out (a light), vanish' },
    group: 'ichidan',
    level: 'n4',
    forms: {
      kakeru: { text: '消えかける', kana: 'きえかける', en: 'nearly go out, fading' },
    },
    status: 'draft',
  },
  {
    id: 'tokeru',
    verb: { text: '溶ける', kana: 'とける', en: 'melt' },
    group: 'ichidan',
    level: 'n4',
    forms: {
      kakeru: { text: '溶けかける', kana: 'とけかける', en: 'half-melted, nearly melt' },
    },
    status: 'draft',
  },
  {
    id: 'umareru',
    verb: { text: '生まれる', kana: 'うまれる', en: 'be born' },
    group: 'ichidan',
    level: 'n4',
    forms: {
      tate: { text: '生まれたて', kana: 'うまれたて', en: 'newborn' },
    },
    status: 'draft',
  },
  {
    id: 'souji',
    verb: { text: '掃除する', kana: 'そうじする', en: 'clean' },
    group: 'suru',
    level: 'n5',
    forms: {
      causative: { text: '掃除させる', kana: 'そうじさせる', en: 'make or let someone clean' },
      saserareru: { text: '掃除させられる', kana: 'そうじさせられる', en: 'be made to clean' },
      'zu-ni': { text: '掃除せずに', kana: 'そうじせずに', en: 'without cleaning' },
      'you-to-suru': { text: '掃除しようと する', kana: 'そうじしようと する', en: 'try to clean, be about to clean' },
    },
    status: 'draft',
  },
  {
    id: 'benkyou',
    verb: { text: '勉強する', kana: 'べんきょうする', en: 'study' },
    group: 'suru',
    level: 'n5',
    forms: {
      causative: { text: '勉強させる', kana: 'べんきょうさせる', en: 'make or let someone study' },
      saserareru: { text: '勉強させられる', kana: 'べんきょうさせられる', en: 'be made to study' },
      'zu-ni': { text: '勉強せずに', kana: 'べんきょうせずに', en: 'without studying' },
      'you-to-suru': { text: '勉強しようと する', kana: 'べんきょうしようと する', en: 'try to study, be about to study' },
    },
    status: 'draft',
  },
  {
    id: 'kuru',
    verb: { text: '来る', kana: 'くる', en: 'come' },
    group: 'kuru',
    level: 'n5',
    forms: {
      potential: { text: '来られる', kana: 'こられる', en: 'can come' },
      'suffering-passive': { text: '来られる', kana: 'こられる', en: 'have someone turn up on you' },
      'zu-ni': { text: '来ずに', kana: 'こずに', en: 'without coming' },
      'you-to-suru': { text: '来ようと する', kana: 'こようと する', en: 'try to come, be about to come' },
    },
    status: 'draft',
  },
];
