// Built-in word lists for Word Gauntlet.
//
// STATUS: draft. Everything in this file needs a fluent speaker's check before it ships,
// like every topic pack (design doc, "Cast and tone"). The obscure words are the mode's own
// content (no topic pack has "real but obscure" words); the starters and shiritori nouns are
// placeholders, used only when the night's topic pack is missing or too thin.

import type { JpText, ReviewStatus } from '../../../../content/src/types.js';
import type { Audience } from '../../protocol.js';
import { shuffled } from '../mode.js';

export interface ObscureWord {
  id: string;
  /** The word as shown (kanji), its reading, and the real meaning in plain English. */
  jp: JpText;
  /** Literal gloss, shown after the reveal for the laugh ("cat tongue"). */
  literal?: string;
  /** Phrases that give the truth away: a fake containing one is refused as "too close to the truth". */
  close: string[];
  /** Kids rooms deal only words marked true; Family and Cheeky deal them all. */
  kids?: boolean;
}

export const OBSCURE_WORDS_STATUS: ReviewStatus = 'draft';

/**
 * Real, safe, funny-sounding words most learners have never met. Each meaning was checked
 * against standard dictionary senses (Daijirin / Jisho); still needs a fluent sign-off.
 */
export const OBSCURE_WORDS: readonly ObscureWord[] = [
  {
    id: 'komorebi',
    jp: { text: '木漏れ日', kana: 'こもれび', en: 'Sunlight filtering through the leaves of trees', furigana: [['木', 'こ'], ['漏', 'も'], ['れ', ''], ['日', 'び']] },
    literal: 'tree-leak-sun',
    close: ['through the leaves', 'through the trees', 'through leaves', 'through trees'],
    kids: true,
  },
  {
    id: 'tsundoku',
    jp: { text: '積ん読', kana: 'つんどく', en: 'Buying books and leaving them piled up, unread', furigana: [['積', 'つ'], ['ん', ''], ['読', 'どく']] },
    literal: 'pile-up-read',
    close: ['unread book', 'books unread', 'not reading them', 'never read'],
    kids: true,
  },
  {
    id: 'nekojita',
    jp: { text: '猫舌', kana: 'ねこじた', en: "Not being able to handle hot food or drinks", furigana: [['猫', 'ねこ'], ['舌', 'じた']] },
    literal: 'cat tongue',
    close: ['hot food', 'hot drink', 'hot things'],
    kids: true,
  },
  {
    id: 'kuchisabishii',
    jp: { text: '口寂しい', kana: 'くちさびしい', en: 'Wanting something in your mouth (snacking out of boredom)', furigana: [['口', 'くち'], ['寂', 'さび'], ['しい', '']] },
    literal: 'lonely mouth',
    close: ['in your mouth', 'out of boredom', 'bored eating', 'boredom snack'],
    kids: true,
  },
  {
    id: 'nekoze',
    jp: { text: '猫背', kana: 'ねこぜ', en: 'A hunched, slouching posture', furigana: [['猫', 'ねこ'], ['背', 'ぜ']] },
    literal: 'cat back',
    close: ['slouch', 'hunch'],
    kids: true,
  },
  {
    id: 'nidone',
    jp: { text: '二度寝', kana: 'にどね', en: 'Going back to sleep after you have already woken up', furigana: [['二', 'に'], ['度', 'ど'], ['寝', 'ね']] },
    literal: 'second sleep',
    close: ['back to sleep', 'sleep again', 'second sleep'],
    kids: true,
  },
  {
    id: 'kuidaore',
    jp: { text: '食い倒れ', kana: 'くいだおれ', en: 'Spending all your money on food (eating yourself broke)', furigana: [['食', 'く'], ['い', ''], ['倒', 'だお'], ['れ', '']] },
    literal: 'eat until you collapse',
    close: ['money on food', 'eating yourself broke', 'broke from eating', 'bankrupt'],
  },
  {
    id: 'harahachibu',
    jp: { text: '腹八分目', kana: 'はらはちぶんめ', en: 'Eating only until you are 80% full', furigana: [['腹', 'はら'], ['八', 'はち'], ['分', 'ぶん'], ['目', 'め']] },
    literal: 'belly eight-tenths',
    close: ['80%', '80 percent', 'eighty percent'],
    kids: true,
  },
  {
    id: 'tanukineiri',
    jp: { text: '狸寝入り', kana: 'たぬきねいり', en: 'Pretending to be asleep', furigana: [['狸', 'たぬき'], ['寝', 'ね'], ['入', 'い'], ['り', '']] },
    literal: 'tanuki falling asleep',
    close: ['pretend to sleep', 'pretending to sleep', 'pretend to be asleep', 'pretending to be asleep', 'fake sleep', 'faking sleep'],
    kids: true,
  },
  {
    id: 'nekonohitai',
    jp: { text: '猫の額', kana: 'ねこのひたい', en: 'A tiny piece of land (a very small garden or yard)', furigana: [['猫', 'ねこ'], ['の', ''], ['額', 'ひたい']] },
    literal: "a cat's forehead",
    close: ['piece of land', 'tiny garden', 'small garden', 'tiny yard', 'small yard'],
    kids: true,
  },
  {
    id: 'mikkabouzu',
    jp: { text: '三日坊主', kana: 'みっかぼうず', en: 'Someone who gives up on new things after a few days', furigana: [['三日', 'みっか'], ['坊', 'ぼう'], ['主', 'ず']] },
    literal: 'three-day monk',
    close: ['give up', 'gives up', 'giving up', 'quitter'],
    kids: true,
  },
  {
    id: 'sabawoyomu',
    jp: { text: '鯖を読む', kana: 'さばをよむ', en: 'To fudge the numbers (like lying about your age)', furigana: [['鯖', 'さば'], ['を', ''], ['読', 'よ'], ['む', '']] },
    literal: 'to count mackerel',
    close: ['fudge', 'about your age', 'lie about numbers'],
  },
  {
    id: 'kakashi',
    jp: { text: '案山子', kana: 'かかし', en: 'A scarecrow', furigana: [['案山子', 'かかし']] },
    literal: 'the kanji are an old Chinese word; the reading ignores them',
    close: ['scarecrow', 'scare crow'],
    kids: true,
  },
  {
    id: 'neguse',
    jp: { text: '寝癖', kana: 'ねぐせ', en: 'Bed hair (hair messed up from sleeping)', furigana: [['寝', 'ね'], ['癖', 'ぐせ']] },
    literal: 'sleep habit',
    close: ['bed hair', 'bedhead', 'bed head'],
    kids: true,
  },
  {
    id: 'madoromu',
    jp: { text: '微睡む', kana: 'まどろむ', en: 'To doze off lightly', furigana: [['微睡', 'まどろ'], ['む', '']] },
    literal: 'faint sleep',
    close: ['doze', 'dozing'],
    kids: true,
  },
  {
    id: 'abatamoekubo',
    jp: { text: '痘痕も靨', kana: 'あばたもえくぼ', en: 'Love is blind (even pockmarks look like dimples)', furigana: [['痘痕', 'あばた'], ['も', ''], ['靨', 'えくぼ']] },
    literal: 'pockmarks are dimples too',
    close: ['love is blind'],
  },
  {
    id: 'shinrinyoku',
    jp: { text: '森林浴', kana: 'しんりんよく', en: 'Forest bathing: relaxing by spending time among trees', furigana: [['森', 'しん'], ['林', 'りん'], ['浴', 'よく']] },
    literal: 'forest bath',
    close: ['forest bath'],
    kids: true,
  },
  {
    id: 'miyagebanashi',
    jp: { text: '土産話', kana: 'みやげばなし', en: 'Stories you bring home from a trip', furigana: [['土産', 'みやげ'], ['話', 'ばなし']] },
    literal: 'souvenir talk',
    close: ['travel stories', 'stories from a trip', 'trip stories', 'stories from your trip', 'travel tales'],
    kids: true,
  },
];

export const CHEEKY_WORDS_STATUS: ReviewStatus = 'draft';

/**
 * Cheeky-only words (drinking, nights out, office life, a little flirting; never explicit), dealt
 * when the room's Audience is Cheeky. Meanings checked against dictionary senses (Daijisen, Daijirin, Jisho,
 * Weblio, Kotobank); still needs the
 * fluent sign-off and Ladi's taste check.
 */
export const CHEEKY_WORDS: readonly ObscureWord[] = [
  {
    id: 'futsukayoi',
    jp: { text: '二日酔い', kana: 'ふつかよい', en: 'A hangover', furigana: [['二日', 'ふつか'], ['酔', 'よ'], ['い', '']] },
    literal: 'two-day drunk',
    close: ['hangover', 'hung over', 'hungover'],
  },
  {
    id: 'chidoriashi',
    jp: { text: '千鳥足', kana: 'ちどりあし', en: 'The wobbly, zigzag walk of someone who is drunk', furigana: [['千', 'ち'], ['鳥', 'どり'], ['足', 'あし']] },
    literal: 'plover feet',
    close: ['drunk walk', 'walking drunk', 'stagger', 'zigzag', 'totter', 'wobbly walk'],
  },
  {
    id: 'asagaeri',
    jp: { text: '朝帰り', kana: 'あさがえり', en: 'Getting home in the morning after staying out all night', furigana: [['朝', 'あさ'], ['帰', 'がえ'], ['り', '']] },
    literal: 'morning return',
    close: ['all night', 'home in the morning', 'home at dawn', 'stayed out', 'staying out'],
  },
  {
    id: 'gozensama',
    jp: { text: '午前様', kana: 'ごぜんさま', en: 'Someone who gets home after midnight from a night out', furigana: [['午', 'ご'], ['前', 'ぜん'], ['様', 'さま']] },
    literal: 'Mr. A.M.',
    close: ['after midnight', 'past midnight', 'home late'],
  },
  {
    id: 'hashigozake',
    jp: { text: '梯子酒', kana: 'はしござけ', en: 'Bar hopping: drinking at one place after another', furigana: [['梯子', 'はしご'], ['酒', 'ざけ']] },
    literal: 'ladder sake',
    close: ['bar hop', 'bar-hop', 'pub crawl', 'one bar to another', 'bar to bar'],
  },
  {
    id: 'nakijougo',
    jp: { text: '泣き上戸', kana: 'なきじょうご', en: 'Someone who starts crying when they get drunk', furigana: [['泣', 'な'], ['き', ''], ['上', 'じょう'], ['戸', 'ご']] },
    literal: 'crying drinker',
    close: ['cries when drunk', 'cry when drunk', 'crying drunk', 'weepy drunk', 'sad drunk'],
  },
  {
    id: 'hananoshitawonobasu',
    jp: { text: '鼻の下を伸ばす', kana: 'はなのしたをのばす', en: 'To make a dopey, lovestruck face at someone attractive (ogling)', furigana: [['鼻', 'はな'], ['の', ''], ['下', 'した'], ['を', ''], ['伸', 'の'], ['ばす', '']] },
    literal: 'to stretch the bit under your nose',
    close: ['lovestruck', 'smitten', 'infatuated', 'besotted', 'ogle'],
  },
  {
    id: 'madogiwazoku',
    jp: { text: '窓際族', kana: 'まどぎわぞく', en: 'Office workers pushed aside with nothing to do (given a desk by the window)', furigana: [['窓', 'まど'], ['際', 'ぎわ'], ['族', 'ぞく']] },
    literal: 'the window-seat tribe',
    close: ['nothing to do', 'sidelined', 'pushed aside', 'by the window'],
  },
];

export const GREEN_CAR_WORDS_STATUS: ReviewStatus = 'draft';

/**
 * Green Car (everyone N4 or N3): Fake Kanji deals everyday words written with N3 kanji (独, 寝, 迷, 癖, 眠, 忘,
 * 腹 …), the kind an N3 learner meets on a page before they know them. Only one a game (the round is short) and
 * not counted toward the path: the golden word is read, not said from memory. Kids rooms deal those marked
 * `kids`; Cheeky rooms deal GREEN_CAR_CHEEKY_WORDS first. Meanings from standard dictionary senses; draft until
 * the fluent check.
 */
export const GREEN_CAR_WORDS: readonly ObscureWord[] = [
  {
    id: 'gc-hitorigoto',
    jp: { text: '独り言', kana: 'ひとりごと', en: 'Talking to yourself', furigana: [['独', 'ひと'], ['り', ''], ['言', 'ごと']] },
    literal: 'alone-words',
    close: ['to yourself', 'to oneself', 'to himself', 'to herself', 'self talk', 'self-talk'],
    kids: true,
  },
  {
    id: 'gc-negoto',
    jp: { text: '寝言', kana: 'ねごと', en: 'Talking in your sleep', furigana: [['寝', 'ね'], ['言', 'ごと']] },
    literal: 'sleep-words',
    close: ['in your sleep', 'sleep talk', 'sleep-talk', 'sleeptalk', 'while asleep', 'talking asleep'],
    kids: true,
  },
  {
    id: 'gc-maigo',
    jp: { text: '迷子', kana: 'まいご', en: 'A child who has got lost', furigana: [['迷', 'まい'], ['子', 'ご']] },
    literal: 'lost child',
    close: ['lost child', 'lost kid', 'got lost', 'gets lost', 'lost'],
    kids: true,
  },
  {
    id: 'gc-hayakuchi',
    jp: { text: '早口', kana: 'はやくち', en: 'Talking very fast', furigana: [['早', 'はや'], ['口', 'くち']] },
    literal: 'fast mouth',
    close: ['talk fast', 'talking fast', 'talks fast', 'speak fast', 'speaking fast', 'fast talk', 'quickly'],
    kids: true,
  },
  {
    id: 'gc-kuchiguse',
    jp: { text: '口癖', kana: 'くちぐせ', en: 'A phrase someone always says (a verbal habit)', furigana: [['口', 'くち'], ['癖', 'ぐせ']] },
    literal: 'mouth habit',
    close: ['always say', 'catchphrase', 'catch phrase', 'pet phrase', 'verbal habit', 'habit of saying'],
    kids: true,
  },
  {
    id: 'gc-hitomishiri',
    jp: { text: '人見知り', kana: 'ひとみしり', en: 'Being shy around people you don’t know', furigana: [['人', 'ひと'], ['見', 'み'], ['知', 'し'], ['り', '']] },
    literal: 'people-see-know',
    close: ['shy', 'strangers', 'timid'],
    kids: true,
  },
  {
    id: 'gc-makezugirai',
    jp: { text: '負けず嫌い', kana: 'まけずぎらい', en: 'Hating to lose, whatever the game', furigana: [['負', 'ま'], ['け', ''], ['ず', ''], ['嫌', 'ぎら'], ['い', '']] },
    literal: 'hates not-losing',
    close: ['hate losing', 'hates losing', 'hating to lose', 'to lose', 'sore loser', 'competitive'],
    kids: true,
  },
  {
    id: 'gc-inemuri',
    jp: { text: '居眠り', kana: 'いねむり', en: 'Dozing off where you sit (in class, on a train)', furigana: [['居', 'い'], ['眠', 'ねむ'], ['り', '']] },
    literal: 'staying-sleep',
    close: ['doze', 'dozing', 'nodding off', 'nod off', 'falling asleep', 'fall asleep', 'nap'],
    kids: true,
  },
  {
    id: 'gc-yatsuatari',
    jp: { text: '八つ当たり', kana: 'やつあたり', en: 'Taking your bad mood out on someone who didn’t cause it', furigana: [['八', 'や'], ['つ', ''], ['当', 'あ'], ['た', ''], ['り', '']] },
    literal: 'hitting all eight',
    close: ['take it out', 'taking it out', 'takes it out', 'lash out', 'lashing out', 'bad mood'],
    kids: true,
  },
  {
    id: 'gc-haradokei',
    jp: { text: '腹時計', kana: 'はらどけい', en: 'Your stomach telling you it’s mealtime (a “belly clock”)', furigana: [['腹', 'はら'], ['時計', 'どけい']] },
    literal: 'belly clock',
    close: ['belly clock', 'stomach clock', 'tummy clock', 'mealtime', 'meal time', 'hungry'],
    kids: true,
  },
  {
    id: 'gc-yofukashi',
    jp: { text: '夜更かし', kana: 'よふかし', en: 'Staying up late at night', furigana: [['夜', 'よ'], ['更', 'ふ'], ['か', ''], ['し', '']] },
    literal: 'night-deepening',
    close: ['stay up', 'staying up', 'stays up', 'up late', 'late at night', 'night owl'],
  },
  {
    id: 'gc-monowasure',
    jp: { text: '物忘れ', kana: 'ものわすれ', en: 'Forgetting things (being forgetful)', furigana: [['物', 'もの'], ['忘', 'わす'], ['れ', '']] },
    literal: 'thing-forgetting',
    close: ['forget', 'forgetful', 'forgetting'],
  },
];

/** Green Car, Cheeky rooms: grown-up words with N3 kanji (nights out), dealt first. Draft. */
export const GREEN_CAR_CHEEKY_WORDS: readonly ObscureWord[] = [
  {
    id: 'gc-nomihoudai',
    jp: { text: '飲み放題', kana: 'のみほうだい', en: 'All you can drink (for a fixed price)', furigana: [['飲', 'の'], ['み', ''], ['放題', 'ほうだい']] },
    literal: 'drink as you please',
    close: ['all you can drink', 'all-you-can-drink', 'unlimited drink', 'drink as much', 'free-flow', 'free flow', 'bottomless'],
  },
  {
    id: 'gc-nijikai',
    jp: { text: '二次会', kana: 'にじかい', en: 'The after-party (the second party of the night)', furigana: [['二', 'に'], ['次', 'じ'], ['会', 'かい']] },
    literal: 'second meeting',
    close: ['after party', 'afterparty', 'after-party', 'second party', 'next bar'],
  },
  {
    id: 'gc-yopparai',
    jp: { text: '酔っ払い', kana: 'よっぱらい', en: 'A drunk (someone who has had too much)', furigana: [['酔', 'よ'], ['っ', ''], ['払', 'ぱら'], ['い', '']] },
    literal: 'drunk-swept',
    close: ['drunk', 'drunkard', 'too much to drink', 'tipsy'],
  },
];

/** Green Car: Fake Kanji plays this many words (a short round). */
export const GREEN_CAR_FAKE_WORDS = 1;

/**
 * The words a game can deal for this Audience. Kids get the gentle subset; Cheeky gets its own
 * words first, topped up with the rest so a short list never leaves a round empty. Family is the
 * whole base list. In the Green Car the lists are the N3 kanji ones.
 */
export function fakeWordPool(audience: Audience, random: () => number, count: number, greenCar = false): ObscureWord[] {
  const shuffle = (xs: readonly ObscureWord[]) => shuffled(xs, random);
  if (greenCar) {
    if (audience === 'kids') return shuffle(GREEN_CAR_WORDS.filter((w) => w.kids)).slice(0, count);
    if (audience === 'cheeky') return [...shuffle(GREEN_CAR_CHEEKY_WORDS), ...shuffle(GREEN_CAR_WORDS)].slice(0, count);
    return shuffle(GREEN_CAR_WORDS).slice(0, count);
  }
  if (audience === 'kids') return shuffle(OBSCURE_WORDS.filter((w) => w.kids)).slice(0, count);
  if (audience === 'cheeky') return [...shuffle(CHEEKY_WORDS), ...shuffle(OBSCURE_WORDS)].slice(0, count);
  return shuffle(OBSCURE_WORDS).slice(0, count);
}

/** Placeholder telephone starters (N5), used only when the pack has no phrases. */
export const FALLBACK_STARTERS: readonly { id: string; jp: JpText }[] = [
  { id: 'wg.starter.neko-sushi', jp: { text: 'ねこが すしを たべました。', kana: 'ねこが すしを たべました。', en: 'The cat ate the sushi.' } },
  { id: 'wg.starter.densha', jp: { text: 'でんしゃは もう きません。', kana: 'でんしゃは もう きません。', en: 'The train is not coming any more.' } },
  { id: 'wg.starter.ashita', jp: { text: 'あしたは うみへ いきたいです。', kana: 'あしたは うみへ いきたいです。', en: 'Tomorrow I want to go to the sea.' } },
  { id: 'wg.starter.okaasan', jp: { text: 'おかあさんの ケーキは おおきいです。', kana: 'おかあさんの ケーキは おおきいです。', en: "Mum's cake is big." } },
];

/**
 * Common nouns in hiragana, for shiritori: the fallback dictionary, the hint pool and the
 * bots' vocabulary. Placeholder until a fluent check; topic-pack nouns are always used too.
 */
export const SHIRITORI_NOUNS: readonly { kana: string; en: string }[] = [
  { kana: 'しりとり', en: 'shiritori (word chain)' },
  { kana: 'りんご', en: 'apple' },
  { kana: 'ごりら', en: 'gorilla' },
  { kana: 'らっぱ', en: 'trumpet' },
  { kana: 'ぱんだ', en: 'panda' },
  { kana: 'だるま', en: 'daruma doll' },
  { kana: 'まくら', en: 'pillow' },
  { kana: 'らくだ', en: 'camel' },
  { kana: 'たぬき', en: 'tanuki' },
  { kana: 'きつね', en: 'fox' },
  { kana: 'ねこ', en: 'cat' },
  { kana: 'こたつ', en: 'heated table' },
  { kana: 'つくえ', en: 'desk' },
  { kana: 'えき', en: 'station' },
  { kana: 'きって', en: 'stamp' },
  { kana: 'てがみ', en: 'letter' },
  { kana: 'みかん', en: 'mandarin orange' },
  { kana: 'かめ', en: 'turtle' },
  { kana: 'めがね', en: 'glasses' },
  { kana: 'ねずみ', en: 'mouse' },
  { kana: 'みず', en: 'water' },
  { kana: 'すいか', en: 'watermelon' },
  { kana: 'かさ', en: 'umbrella' },
  { kana: 'さかな', en: 'fish' },
  { kana: 'なす', en: 'aubergine' },
  { kana: 'すし', en: 'sushi' },
  { kana: 'しか', en: 'deer' },
  { kana: 'かき', en: 'persimmon' },
  { kana: 'きもの', en: 'kimono' },
  { kana: 'のり', en: 'seaweed' },
  { kana: 'りす', en: 'squirrel' },
  { kana: 'すずめ', en: 'sparrow' },
  { kana: 'めだか', en: 'killifish' },
  { kana: 'からす', en: 'crow' },
  { kana: 'すな', en: 'sand' },
  { kana: 'なつ', en: 'summer' },
  { kana: 'つき', en: 'moon' },
  { kana: 'きのこ', en: 'mushroom' },
  { kana: 'こども', en: 'child' },
  { kana: 'もも', en: 'peach' },
  { kana: 'もち', en: 'rice cake' },
  { kana: 'ちず', en: 'map' },
  { kana: 'ずぼん', en: 'trousers' },
  { kana: 'いぬ', en: 'dog' },
  { kana: 'ぬいぐるみ', en: 'stuffed toy' },
  { kana: 'みみ', en: 'ear' },
  { kana: 'みせ', en: 'shop' },
  { kana: 'せなか', en: 'back (of the body)' },
  { kana: 'なまえ', en: 'name' },
  { kana: 'えほん', en: 'picture book' },
  { kana: 'えだ', en: 'branch' },
  { kana: 'だいこん', en: 'daikon radish' },
  { kana: 'たまご', en: 'egg' },
  { kana: 'ごはん', en: 'rice, a meal' },
  { kana: 'ごま', en: 'sesame' },
  { kana: 'まど', en: 'window' },
  { kana: 'どあ', en: 'door' },
  { kana: 'あめ', en: 'rain, candy' },
  { kana: 'めいし', en: 'business card' },
  { kana: 'しお', en: 'salt' },
  { kana: 'おに', en: 'ogre' },
  { kana: 'にく', en: 'meat' },
  { kana: 'くつ', en: 'shoes' },
  { kana: 'つり', en: 'fishing' },
  { kana: 'りか', en: 'science' },
  { kana: 'かばん', en: 'bag' },
  { kana: 'かぞく', en: 'family' },
  { kana: 'くすり', en: 'medicine' },
  { kana: 'りょこう', en: 'trip' },
  { kana: 'うし', en: 'cow' },
  { kana: 'しま', en: 'island' },
  { kana: 'まつり', en: 'festival' },
  { kana: 'りゅう', en: 'dragon' },
  { kana: 'うみ', en: 'sea' },
  { kana: 'みち', en: 'road' },
  { kana: 'ちくわ', en: 'tube-shaped fish cake' },
  { kana: 'わに', en: 'crocodile' },
  { kana: 'にんじん', en: 'carrot' },
  { kana: 'はし', en: 'chopsticks, bridge' },
  { kana: 'はな', en: 'flower, nose' },
  { kana: 'なべ', en: 'hot pot' },
  { kana: 'べんとう', en: 'boxed lunch' },
  { kana: 'うどん', en: 'udon noodles' },
  { kana: 'とけい', en: 'clock' },
  { kana: 'いす', en: 'chair' },
  { kana: 'すいとう', en: 'water bottle' },
  { kana: 'とら', en: 'tiger' },
  { kana: 'らーめん', en: 'ramen' },
  { kana: 'ばなな', en: 'banana' },
  { kana: 'なみ', en: 'wave' },
  { kana: 'みそ', en: 'miso' },
  { kana: 'そら', en: 'sky' },
  { kana: 'らいおん', en: 'lion' },
  { kana: 'おちゃ', en: 'tea' },
  { kana: 'やま', en: 'mountain' },
  { kana: 'まめ', en: 'beans' },
  { kana: 'めろん', en: 'melon' },
  { kana: 'やさい', en: 'vegetables' },
  { kana: 'いちご', en: 'strawberry' },
  { kana: 'ごみ', en: 'rubbish' },
  { kana: 'みるく', en: 'milk' },
  { kana: 'くま', en: 'bear' },
  { kana: 'まち', en: 'town' },
  { kana: 'ちかてつ', en: 'subway' },
  { kana: 'つくし', en: 'horsetail shoot' },
  { kana: 'しんぶん', en: 'newspaper' },
  { kana: 'ふね', en: 'ship' },
  { kana: 'ねぎ', en: 'spring onion' },
  { kana: 'ぎゅうにゅう', en: 'milk' },
  { kana: 'うさぎ', en: 'rabbit' },
  { kana: 'ぎんこう', en: 'bank' },
  { kana: 'うた', en: 'song' },
  { kana: 'たこ', en: 'octopus, kite' },
  { kana: 'こめ', en: 'rice (uncooked)' },
  { kana: 'へや', en: 'room' },
  { kana: 'やね', en: 'roof' },
  { kana: 'ほし', en: 'star' },
  { kana: 'ひこうき', en: 'aeroplane' },
  { kana: 'きっぷ', en: 'ticket' },
  { kana: 'ぷりん', en: 'custard pudding' },
  { kana: 'ふゆ', en: 'winter' },
  { kana: 'ゆき', en: 'snow' },
  { kana: 'ゆめ', en: 'dream' },
  { kana: 'わたがし', en: 'candy floss' },
  { kana: 'よる', en: 'night' },
  { kana: 'るす', en: 'being out (not home)' },
  { kana: 'せみ', en: 'cicada' },
  { kana: 'へび', en: 'snake' },
  { kana: 'びーる', en: 'beer' },
  { kana: 'ほん', en: 'book' },
  { kana: 'ひと', en: 'person' },
  { kana: 'とり', en: 'bird' },
  { kana: 'てんぷら', en: 'tempura' },
  { kana: 'けいたい', en: 'mobile phone' },
  { kana: 'いえ', en: 'house' },
  { kana: 'おでん', en: 'oden stew' },
  { kana: 'ぱん', en: 'bread' },
  { kana: 'ろうそく', en: 'candle' },
  { kana: 'れいぞうこ', en: 'fridge' },
  { kana: 'ぬま', en: 'swamp' },
  { kana: 'むし', en: 'insect' },
  { kana: 'ちょうちん', en: 'paper lantern' },
  { kana: 'ちょきん', en: 'savings' },
  { kana: 'しゃしん', en: 'photo' },
  { kana: 'じしょ', en: 'dictionary' },
  { kana: 'よーよー', en: 'yo-yo' },
];
