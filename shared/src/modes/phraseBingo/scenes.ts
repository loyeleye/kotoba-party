// Phrase Bingo Theater scenes: a setting, roles for the actors, a twist to spark the improv,
// and the secret phrases actors are dealt. Three scenes per topic pack, plus one Kids and one
// Cheeky scene per pack for the host's Audience setting. Those reuse the family scenes' phrases
// (same ids, same text), so only the setting, roles and twist change: the Japanese drilled is
// the same whoever is in the room.
//
// Draft content (status 'draft'): a fluent speaker should check every phrase, role and twist.
// Phrases marked `from` copy a topic-pack phrase; when that pack is loaded the pack's own text
// (and furigana) wins, so a fluent-checked pack fixes the scene too. The others are new,
// written alongside the packs at the same level bands: kana = short set phrases, n5 = です/ます
// sentences, n4 = one N4 pattern each (〜そう, 〜たら, potential, 〜てもらえますか, 〜ほうがいい).

import type { JpText, Level, ReviewStatus } from '../../../../content/src/types.js';
import type { Audience } from '../../protocol.js';

export interface ScenePhrase {
  /** Stable id, e.g. `pb.konbini.irasshaimase`. */
  id: string;
  jp: JpText;
  level: Level;
  /** A topic-pack phrase id this one copies. */
  from?: string;
  /** Other readings that count (casual or shortened forms), as kana. */
  accepted?: string[];
  /**
   * Green Car lines: the frames the line carries (frames.ts ids). The first is the one the bingo card shows instead of
   * the sentence (＿て もらえますか), so the audience listens for the grammar.
   */
  frames?: readonly string[];
}

export interface Scene {
  id: string;
  packId: 'food' | 'family' | 'travel';
  /** Who the scene is for (family when left out). */
  audience?: Audience;
  emoji: string;
  setting: JpText;
  /** One line to get the improv going. English, so every level gets the joke. */
  twist: string;
  /** Roles handed out to the actors in order (at least 4). */
  roles: JpText[];
  phrases: ScenePhrase[];
  status: ReviewStatus;
  /** Green Car only (shared/src/greenCar.ts): N4 and N3 frame lines, never dealt in a mixed room. */
  greenCar?: true;
}

const t = (text: string, kana: string, en: string): JpText => ({ text, kana, en });
const role = (kana: string, en: string): JpText => ({ text: kana, kana, en });

const FAMILY_SCENES: readonly Scene[] = [
  // ---- food ----
  {
    id: 'konbini',
    packId: 'food',
    emoji: '🏪',
    setting: t('よるの コンビニ', 'よるの コンビニ', 'A konbini, late at night'),
    twist: 'There is one pudding left on the shelf, and everybody wants it.',
    roles: [role('てんいん', 'the clerk'), role('おきゃくさん', 'a customer'), role('おばけ', 'a ghost who loves pudding'), role('ポンの ファン', "Pon's biggest fan")],
    status: 'draft',
    phrases: [
      { id: 'pb.konbini.irasshaimase', level: 'kana', jp: t('いらっしゃいませ！', 'いらっしゃいませ！', 'Welcome! (what shop staff say)') },
      { id: 'pb.konbini.ikura', level: 'kana', from: 'food.phrase.ikura', jp: t('いくらですか。', 'いくらですか。', 'How much is it?') },
      { id: 'pb.konbini.oishii', level: 'kana', from: 'food.phrase.oishii', jp: t('おいしい！', 'おいしい！', "It's delicious!") },
      { id: 'pb.konbini.sumimasen', level: 'kana', jp: t('すみません！', 'すみません！', 'Excuse me!') },
      { id: 'pb.konbini.arigatou', level: 'kana', jp: t('ありがとう！', 'ありがとう！', 'Thanks!'), accepted: ['ありがとうございます'] },
      { id: 'pb.konbini.atatame', level: 'n5', from: 'food.phrase.atatame', jp: t('お弁当、あたためますか。', 'おべんとう、あたためますか。', 'Shall I heat up your bento?') },
      { id: 'pb.konbini.fukuro', level: 'n5', from: 'food.phrase.fukuro', jp: t('ふくろは いりません。', 'ふくろは いりません。', "I don't need a bag.") },
      { id: 'pb.konbini.onaka', level: 'n5', from: 'food.phrase.onaka-suita', jp: t('おなかが すきました。', 'おなかが すきました。', "I'm hungry.") },
      { id: 'pb.konbini.nodo', level: 'n5', from: 'food.phrase.nodo', jp: t('のどが かわきました。', 'のどが かわきました。', "I'm thirsty.") },
      { id: 'pb.konbini.tabete-ii', level: 'n5', from: 'food.phrase.tabete-ii', jp: t('これ、食べても いいですか。', 'これ、たべても いいですか。', 'Can I eat this?') },
      { id: 'pb.konbini.purin-doko', level: 'n5', jp: t('プリンは どこですか。', 'プリンは どこですか。', 'Where is the pudding?') },
      { id: 'pb.konbini.point', level: 'n5', jp: t('ポイントカードは ありますか。', 'ポイントカードは ありますか。', 'Do you have a point card?') },
      { id: 'pb.konbini.oishisou', level: 'n4', jp: t('おいしそうですね。', 'おいしそうですね。', 'That looks delicious.') },
      { id: 'pb.konbini.atatamete-moraeru', level: 'n4', jp: t('あたためて もらえますか。', 'あたためて もらえますか。', 'Could you heat it up for me?') },
      { id: 'pb.konbini.yasukattara', level: 'n4', jp: t('安かったら 買います。', 'やすかったら かいます。', "If it's cheap, I'll buy it.") },
    ],
  },
  {
    id: 'ramen',
    packId: 'food',
    emoji: '🍜',
    setting: t('ラーメンやさん', 'ラーメンやさん', 'A tiny ramen shop'),
    twist: 'The chef only serves people who say the secret words. Nobody knows what they are.',
    roles: [role('たいしょう', 'the chef (the boss of a ramen counter)'), role('おきゃくさん', 'a hungry customer'), role('グルメの ひと', 'a ramen critic'), role('となりの ひと', 'the person in the next seat')],
    status: 'draft',
    phrases: [
      { id: 'pb.ramen.itadakimasu', level: 'kana', from: 'food.phrase.itadakimasu', jp: t('いただきます。', 'いただきます。', "Let's eat. (said before eating)") },
      { id: 'pb.ramen.gochisousama', level: 'kana', from: 'food.phrase.gochisousama', jp: t('ごちそうさまでした。', 'ごちそうさまでした。', 'Thank you for the meal.'), accepted: ['ごちそうさま'] },
      { id: 'pb.ramen.umai', level: 'kana', jp: t('うまい！', 'うまい！', 'Tasty! (casual)') },
      { id: 'pb.ramen.hai', level: 'kana', jp: t('はい、どうぞ。', 'はい、どうぞ。', 'Here you go.') },
      { id: 'pb.ramen.futari', level: 'n5', from: 'food.phrase.futari', jp: t('二人です。', 'ふたりです。', 'Two people, please.') },
      { id: 'pb.ramen.osusume', level: 'n5', from: 'food.phrase.osusume', jp: t('おすすめは 何ですか。', 'おすすめは なんですか。', 'What do you recommend?') },
      { id: 'pb.ramen.kore-nan', level: 'n5', from: 'food.phrase.kore-nan', jp: t('これは 何ですか。', 'これは なんですか。', 'What is this?') },
      { id: 'pb.ramen.karai', level: 'n5', from: 'food.phrase.kore-karai', jp: t('これ、からいですか。', 'これ、からいですか。', 'Is this spicy?') },
      { id: 'pb.ramen.okaikei', level: 'n5', from: 'food.phrase.okaikei', jp: t('お会計、お願いします。', 'おかいけい、おねがいします。', 'The bill, please.') },
      { id: 'pb.ramen.ippai', level: 'n5', from: 'food.phrase.onaka-ippai', jp: t('おなかが いっぱいです。', 'おなかが いっぱいです。', "I'm full.") },
      { id: 'pb.ramen.mizu', level: 'n5', jp: t('お水を ください。', 'おみずを ください。', 'Water, please.') },
      { id: 'pb.ramen.issho', level: 'n5', from: 'food.phrase.issho', jp: t('いっしょに 食べませんか。', 'いっしょに たべませんか。', "Won't you eat with me?") },
      { id: 'pb.ramen.karasou', level: 'n4', jp: t('からそうですね。', 'からそうですね。', 'That looks spicy.') },
      { id: 'pb.ramen.taberaremasu', level: 'n4', jp: t('もっと 食べられます。', 'もっと たべられます。', 'I can eat more.') },
      { id: 'pb.ramen.tabetara', level: 'n4', jp: t('食べたら ねます。', 'たべたら ねます。', "Once I've eaten, I'm going to sleep.") },
    ],
  },
  {
    id: 'hanami',
    packId: 'food',
    emoji: '🌸',
    setting: t('おはなみ ピクニック', 'おはなみ ピクニック', 'A cherry-blossom picnic'),
    twist: 'Someone brought only dessert, and it is starting to rain.',
    roles: [role('ばしょとりの ひと', 'the one who saved the spot'), role('おべんとうの ひと', 'the one who cooked'), role('おくれた ひと', 'the late friend'), role('さくらの せい', 'a cherry-tree spirit')],
    status: 'draft',
    phrases: [
      { id: 'pb.hanami.kirei', level: 'kana', jp: t('きれい！', 'きれい！', 'So pretty!') },
      { id: 'pb.hanami.kanpai', level: 'kana', jp: t('かんぱい！', 'かんぱい！', 'Cheers!') },
      { id: 'pb.hanami.oishii', level: 'kana', from: 'food.phrase.oishii', jp: t('おいしい！', 'おいしい！', "It's delicious!") },
      { id: 'pb.hanami.itadakimasu', level: 'kana', from: 'food.phrase.itadakimasu', jp: t('いただきます。', 'いただきます。', "Let's eat.") },
      { id: 'pb.hanami.sakura', level: 'n5', jp: t('さくらが きれいですね。', 'さくらが きれいですね。', 'The cherry blossoms are beautiful.') },
      { id: 'pb.hanami.bentou', level: 'n5', jp: t('お弁当を 作りました。', 'おべんとうを つくりました。', 'I made a bento.') },
      { id: 'pb.hanami.suwatte', level: 'n5', jp: t('ここに すわっても いいですか。', 'ここに すわっても いいですか。', 'May I sit here?') },
      { id: 'pb.hanami.shashin', level: 'n5', jp: t('写真を とりましょう。', 'しゃしんを とりましょう。', "Let's take a photo.") },
      { id: 'pb.hanami.nodo', level: 'n5', from: 'food.phrase.nodo', jp: t('のどが かわきました。', 'のどが かわきました。', "I'm thirsty.") },
      { id: 'pb.hanami.onaka', level: 'n5', from: 'food.phrase.onaka-suita', jp: t('おなかが すきました。', 'おなかが すきました。', "I'm hungry.") },
      { id: 'pb.hanami.juice', level: 'n5', jp: t('ジュースを ください。', 'ジュースを ください。', 'Juice, please.') },
      { id: 'pb.hanami.okureta', level: 'n5', jp: t('おそく なって、すみません。', 'おそく なって、すみません。', "Sorry I'm late.") },
      { id: 'pb.hanami.ame', level: 'n4', jp: t('雨が ふったら こまります。', 'あめが ふったら こまります。', 'It would be bad if it rained.') },
      { id: 'pb.hanami.oishisou', level: 'n4', jp: t('おいしそうな お弁当ですね。', 'おいしそうな おべんとうですね。', 'What a delicious-looking bento.') },
      { id: 'pb.hanami.dare', level: 'n4', jp: t('だれが 作ったんですか。', 'だれが つくったんですか。', 'Who made it?') },
    ],
  },
  // ---- family ----
  {
    id: 'dinner',
    packId: 'family',
    emoji: '🍲',
    setting: t('かぞくの ばんごはん', 'かぞくの ばんごはん', 'Family dinner'),
    twist: "Someone ate Grandpa's pudding. Grandpa wants answers.",
    roles: [role('おかあさん', 'Mum'), role('おとうさん', 'Dad'), role('こども', 'the kid'), role('おじいちゃん', 'Grandpa'), role('ねこ', 'the cat')],
    status: 'draft',
    phrases: [
      { id: 'pb.dinner.itadakimasu', level: 'kana', from: 'family.phrase.itadakimasu', jp: t('いただきます。', 'いただきます。', "Let's eat. (Thank you for the food.)") },
      { id: 'pb.dinner.gochisousama', level: 'kana', from: 'family.phrase.gochisousama', jp: t('ごちそうさまでした。', 'ごちそうさまでした。', 'Thank you for the meal.'), accepted: ['ごちそうさま'] },
      { id: 'pb.dinner.oishii', level: 'kana', jp: t('おいしい！', 'おいしい！', "It's delicious!") },
      { id: 'pb.dinner.dame', level: 'kana', jp: t('だめ！', 'だめ！', 'No! Not allowed!') },
      { id: 'pb.dinner.tadaima', level: 'n5', from: 'family.phrase.tadaima', jp: t('ただいま。', 'ただいま。', "I'm home.") },
      { id: 'pb.dinner.okaeri', level: 'n5', from: 'family.phrase.okaerinasai', jp: t('おかえりなさい。', 'おかえりなさい。', 'Welcome home.'), accepted: ['おかえり'] },
      { id: 'pb.dinner.ippai', level: 'n5', jp: t('おなかが いっぱいです。', 'おなかが いっぱいです。', "I'm full.") },
      { id: 'pb.dinner.shukudai', level: 'n5', jp: t('しゅくだいは おわりました。', 'しゅくだいは おわりました。', 'My homework is done.') },
      { id: 'pb.dinner.dare', level: 'n5', jp: t('だれが 食べましたか。', 'だれが たべましたか。', 'Who ate it?') },
      { id: 'pb.dinner.mou-hitotsu', level: 'n5', jp: t('もう 一つ ください。', 'もう ひとつ ください。', 'One more, please.') },
      { id: 'pb.dinner.terebi', level: 'n5', jp: t('テレビを 見ても いいですか。', 'テレビを みても いいですか。', 'May I watch TV?') },
      { id: 'pb.dinner.yasai', level: 'n5', jp: t('やさいが きらいです。', 'やさいが きらいです。', "I don't like vegetables.") },
      { id: 'pb.dinner.taberarenai', level: 'n4', jp: t('もう 食べられません。', 'もう たべられません。', "I can't eat any more.") },
      { id: 'pb.dinner.neko-ageta', level: 'n4', jp: t('ねこに あげました。', 'ねこに あげました。', 'I gave it to the cat.') },
      { id: 'pb.dinner.oishisou', level: 'n4', jp: t('おいしそう！', 'おいしそう！', 'That looks delicious!') },
    ],
  },
  {
    id: 'meet-parents',
    packId: 'family',
    emoji: '🎎',
    setting: t('はじめての ごあいさつ', 'はじめての ごあいさつ', "Meeting a friend's family for the first time"),
    twist: 'The guest is secretly a tanuki in disguise, and the tail keeps slipping out.',
    roles: [role('おきゃくさん', 'the guest'), role('おとうさん', 'the dad'), role('おかあさん', 'the mum'), role('いもうと', 'the little sister')],
    status: 'draft',
    phrases: [
      { id: 'pb.parents.hajimemashite', level: 'kana', from: 'family.phrase.hajimemashite', jp: t('はじめまして。', 'はじめまして。', 'Nice to meet you.') },
      { id: 'pb.parents.yoroshiku', level: 'kana', jp: t('よろしく！', 'よろしく！', 'Nice to meet you! (casual)') },
      { id: 'pb.parents.douzo', level: 'kana', jp: t('どうぞ。', 'どうぞ。', 'Please, go ahead.') },
      { id: 'pb.parents.sugoi', level: 'kana', jp: t('すごい！', 'すごい！', 'Amazing!') },
      { id: 'pb.parents.yoroshiku-onegai', level: 'n5', from: 'family.phrase.yoroshiku', jp: t('よろしくおねがいします。', 'よろしくおねがいします。', 'Nice to meet you. (Please treat me kindly.)') },
      { id: 'pb.parents.yonin', level: 'n5', from: 'family.phrase.yonin-kazoku', jp: t('四人家族です。', 'よにんかぞくです。', 'There are four of us in my family.') },
      { id: 'pb.parents.ane', level: 'n5', from: 'family.phrase.ane-hitori', jp: t('姉が 一人 います。', 'あねが ひとり います。', 'I have one older sister.') },
      { id: 'pb.parents.kyoudai', level: 'n5', from: 'family.phrase.kyoudai-imasu-ka', jp: t('兄弟が いますか。', 'きょうだいが いますか。', 'Do you have any brothers or sisters?') },
      { id: 'pb.parents.sunde', level: 'n5', from: 'family.phrase.doko-sunde', jp: t('どこに 住んでいますか。', 'どこに すんでいますか。', 'Where do you live?') },
      { id: 'pb.parents.inu', level: 'n5', from: 'family.phrase.inu-katte', jp: t('犬を かっています。', 'いぬを かっています。', 'I have a dog.') },
      { id: 'pb.parents.shumi', level: 'n5', jp: t('しゅみは 何ですか。', 'しゅみは なんですか。', 'What are your hobbies?') },
      { id: 'pb.parents.omiyage', level: 'n5', jp: t('おみやげを 持って きました。', 'おみやげを もって きました。', 'I brought you a gift.') },
      { id: 'pb.parents.hanasemasu', level: 'n4', jp: t('日本語が 少し 話せます。', 'にほんごが すこし はなせます。', 'I can speak a little Japanese.') },
      { id: 'pb.parents.oishisou-cake', level: 'n4', jp: t('おいしそうな ケーキですね。', 'おいしそうな ケーキですね。', 'What a delicious-looking cake.') },
      { id: 'pb.parents.mata-kitara', level: 'n4', jp: t('また 来て くれたら うれしいです。', 'また きて くれたら うれしいです。', "I'd be happy if you came again.") },
    ],
  },
  {
    id: 'morning',
    packId: 'family',
    emoji: '⏰',
    setting: t('あさの じゅんび', 'あさの じゅんび', 'The morning rush at home'),
    twist: 'Everyone overslept. The train leaves in five minutes and one shoe is missing.',
    roles: [role('おかあさん', 'Mum'), role('こども', 'the kid'), role('おとうさん', 'Dad'), role('ねぼうした おばけ', 'a ghost who overslept')],
    status: 'draft',
    phrases: [
      { id: 'pb.morning.ohayou', level: 'kana', jp: t('おはよう！', 'おはよう！', 'Morning! (casual)') },
      { id: 'pb.morning.hayaku', level: 'kana', jp: t('はやく！', 'はやく！', 'Hurry up!') },
      { id: 'pb.morning.chotto-matte', level: 'kana', jp: t('ちょっと まって！', 'ちょっと まって！', 'Wait a second!') },
      { id: 'pb.morning.nemui', level: 'kana', jp: t('ねむい…', 'ねむい…', "I'm sleepy…") },
      { id: 'pb.morning.ohayou-gozaimasu', level: 'n5', from: 'family.phrase.ohayou', jp: t('おはようございます。', 'おはようございます。', 'Good morning.') },
      { id: 'pb.morning.ittekimasu', level: 'n5', from: 'family.phrase.ittekimasu', jp: t('いってきます。', 'いってきます。', "I'm off. (See you later.)") },
      { id: 'pb.morning.itterasshai', level: 'n5', from: 'family.phrase.itterasshai', jp: t('いってらっしゃい。', 'いってらっしゃい。', 'Have a good day. (See you later.)') },
      { id: 'pb.morning.kasa', level: 'n5', jp: t('かさを 持ちましたか。', 'かさを もちましたか。', 'Did you take an umbrella?') },
      { id: 'pb.morning.jikan', level: 'n5', jp: t('時間が ありません！', 'じかんが ありません！', "There's no time!") },
      { id: 'pb.morning.asagohan', level: 'n5', jp: t('あさごはんを 食べましたか。', 'あさごはんを たべましたか。', 'Did you eat breakfast?') },
      { id: 'pb.morning.kutsu', level: 'n5', jp: t('くつが ありません。', 'くつが ありません。', "I can't find my shoes.") },
      { id: 'pb.morning.nanji', level: 'n5', jp: t('いま 何時ですか。', 'いま なんじですか。', 'What time is it now?') },
      { id: 'pb.morning.isoida-hou', level: 'n4', jp: t('いそいだ ほうが いいです。', 'いそいだ ほうが いいです。', "You'd better hurry.") },
      { id: 'pb.morning.okirareru', level: 'n4', jp: t('あしたは はやく おきられます。', 'あしたは はやく おきられます。', 'I can get up early tomorrow.') },
      { id: 'pb.morning.furisou', level: 'n4', jp: t('雨が ふりそうです。', 'あめが ふりそうです。', 'It looks like rain.') },
    ],
  },
  // ---- travel ----
  {
    id: 'ryokan',
    packId: 'travel',
    emoji: '♨️',
    setting: t('りょかんの チェックイン', 'りょかんの チェックイン', 'Checking in at a ryokan'),
    twist: 'The only room left is room 4, and the guest in it is a little bit see-through.',
    roles: [role('おかみさん', 'the innkeeper'), role('りょこうしゃ', 'the traveller'), role('にもつもち', 'the one carrying all the luggage'), role('ゆうれいの おきゃくさん', 'a ghost guest')],
    status: 'draft',
    phrases: [
      { id: 'pb.ryokan.konbanwa', level: 'kana', jp: t('こんばんは。', 'こんばんは。', 'Good evening.'), accepted: ['こんばんわ'] },
      { id: 'pb.ryokan.onsen', level: 'kana', jp: t('おんせん！', 'おんせん！', 'A hot spring!') },
      { id: 'pb.ryokan.douzo', level: 'kana', jp: t('どうぞ こちらへ。', 'どうぞ こちらへ。', 'This way, please.'), accepted: ['どうぞこちらえ'] },
      { id: 'pb.ryokan.hiroi', level: 'kana', jp: t('ひろい！', 'ひろい！', "It's so big!") },
      { id: 'pb.ryokan.checkin', level: 'n5', from: 'travel.p.checkin', jp: t('チェックインを おねがいします。', 'チェックインを おねがいします。', "I'd like to check in, please.") },
      { id: 'pb.ryokan.nimotsu', level: 'n5', from: 'travel.p.nimotsu', jp: t('荷物を ここに おいても いいですか。', 'にもつを ここに おいても いいですか。', 'May I leave my luggage here?') },
      { id: 'pb.ryokan.tenki', level: 'n5', from: 'travel.p.tenki', jp: t('明日の 天気は どうですか。', 'あしたの てんきは どうですか。', "How's the weather tomorrow?") },
      { id: 'pb.ryokan.yuushoku', level: 'n5', jp: t('ばんごはんは 何時ですか。', 'ばんごはんは なんじですか。', 'What time is dinner?') },
      { id: 'pb.ryokan.onsen-doko', level: 'n5', jp: t('おんせんは どこですか。', 'おんせんは どこですか。', 'Where is the hot spring?') },
      { id: 'pb.ryokan.taoru', level: 'n5', jp: t('タオルを ください。', 'タオルを ください。', 'A towel, please.') },
      { id: 'pb.ryokan.wifi', level: 'n5', jp: t('ワイファイは ありますか。', 'ワイファイは ありますか。', 'Is there Wi-Fi?') },
      { id: 'pb.ryokan.heya', level: 'n5', jp: t('へやが きれいですね。', 'へやが きれいですね。', 'The room is lovely.') },
      { id: 'pb.ryokan.hairemasu', level: 'n4', jp: t('いま おんせんに 入れますか。', 'いま おんせんに はいれますか。', 'Can I get in the hot spring now?') },
      { id: 'pb.ryokan.yukata', level: 'n4', jp: t('ゆかたを きて みたいです。', 'ゆかたを きて みたいです。', "I'd like to try on a yukata.") },
      { id: 'pb.ryokan.oshiete', level: 'n4', jp: t('おすすめを 教えて もらえますか。', 'おすすめを おしえて もらえますか。', 'Could you tell me what you recommend?') },
    ],
  },
  {
    id: 'platform',
    packId: 'travel',
    emoji: '🚉',
    setting: t('えきの ホーム', 'えきの ホーム', 'A station platform, just before the last train'),
    twist: "The last train leaves in two minutes, and nobody knows which platform it's on.",
    roles: [role('えきいん', 'the station attendant'), role('りょこうしゃ', 'a lost traveller'), role('まいごの こども', 'a lost kid'), role('ちょうちんさん', 'Chōchin-san the conductor')],
    status: 'draft',
    phrases: [
      { id: 'pb.platform.sumimasen', level: 'kana', jp: t('すみません！', 'すみません！', 'Excuse me!') },
      { id: 'pb.platform.hai', level: 'kana', jp: t('はい、そうです。', 'はい、そうです。', "Yes, that's right.") },
      { id: 'pb.platform.iie', level: 'kana', jp: t('いいえ、ちがいます。', 'いいえ、ちがいます。', "No, that's wrong.") },
      { id: 'pb.platform.abunai', level: 'kana', jp: t('あぶない！', 'あぶない！', 'Watch out!') },
      { id: 'pb.platform.eki-doko', level: 'n5', from: 'travel.p.eki-doko', jp: t('すみません、駅は どこですか。', 'すみません、えきは どこですか。', 'Excuse me, where is the station?') },
      { id: 'pb.platform.shinjuku', level: 'n5', from: 'travel.p.shinjuku', jp: t('この 電車は 新宿に 行きますか。', 'この でんしゃは しんじゅくに いきますか。', 'Does this train go to Shinjuku?') },
      { id: 'pb.platform.shuuden', level: 'n5', from: 'travel.p.shuuden-nanji', jp: t('終電は 何時ですか。', 'しゅうでんは なんじですか。', 'What time is the last train?') },
      { id: 'pb.platform.kippu', level: 'n5', from: 'travel.p.kippu-ichimai', jp: t('切符を 一枚 ください。', 'きっぷを いちまい ください。', 'One ticket, please.') },
      { id: 'pb.platform.charge', level: 'n5', from: 'travel.p.charge', jp: t('ICカードに チャージ したいです。', 'アイシーカードに チャージ したいです。', 'I want to top up my IC card.') },
      { id: 'pb.platform.toire', level: 'n5', from: 'travel.p.toire-doko', jp: t('すみません、トイレは どこですか。', 'すみません、トイレは どこですか。', 'Excuse me, where is the toilet?') },
      { id: 'pb.platform.oriru', level: 'n5', from: 'travel.p.tsugi-oriru', jp: t('つぎの 駅で 降ります。', 'つぎの えきで おります。', "I'm getting off at the next station.") },
      { id: 'pb.platform.matsu', level: 'n5', from: 'travel.p.kaisatsu-matsu', jp: t('改札の 前で 待って います。', 'かいさつの まえで まって います。', "I'm waiting in front of the ticket gate.") },
      { id: 'pb.platform.norikae', level: 'n4', jp: t('乗りかえたら すぐです。', 'のりかえたら すぐです。', "Once you change trains, it's right there.") },
      { id: 'pb.platform.kisou', level: 'n4', jp: t('電車が 来そうです。', 'でんしゃが きそうです。', 'Looks like the train is coming.') },
      { id: 'pb.platform.ikikata', level: 'n4', jp: t('行き方を 教えて もらえますか。', 'いきかたを おしえて もらえますか。', 'Could you tell me how to get there?') },
    ],
  },
  {
    id: 'taxi',
    packId: 'travel',
    emoji: '🚕',
    setting: t('タクシーで かんこう', 'タクシーで かんこう', 'Sightseeing by taxi'),
    twist: 'The driver is a tanuki who only knows two directions: right, and more right.',
    roles: [role('うんてんしゅ', 'the driver'), role('かんこうきゃく', 'a tourist'), role('ガイド', 'the tour guide'), role('しゃしんずき', 'someone who photographs everything')],
    status: 'draft',
    phrases: [
      { id: 'pb.taxi.migi', level: 'kana', jp: t('みぎ！', 'みぎ！', 'Right!') },
      { id: 'pb.taxi.hidari', level: 'kana', jp: t('ひだり！', 'ひだり！', 'Left!') },
      { id: 'pb.taxi.koko', level: 'kana', jp: t('ここです！', 'ここです！', "It's here!") },
      { id: 'pb.taxi.sugoi', level: 'kana', jp: t('すごい！', 'すごい！', 'Amazing!') },
      { id: 'pb.taxi.hotel', level: 'n5', from: 'travel.p.hoteru-made', jp: t('ホテルまで おねがいします。', 'ホテルまで おねがいします。', 'To the hotel, please.') },
      { id: 'pb.taxi.magatte', level: 'n5', from: 'travel.p.migi-magaru', jp: t('右に 曲がってください。', 'みぎに まがってください。', 'Please turn right.') },
      { id: 'pb.taxi.massugu', level: 'n5', from: 'travel.p.massugu', jp: t('まっすぐ 行ってください。', 'まっすぐ いってください。', 'Please go straight.') },
      { id: 'pb.taxi.shashin', level: 'n5', from: 'travel.p.shashin', jp: t('写真を とっても いいですか。', 'しゃしんを とっても いいですか。', 'May I take a photo?') },
      { id: 'pb.taxi.issho-shashin', level: 'n5', from: 'travel.p.issho-shashin', jp: t('いっしょに 写真を とりませんか。', 'いっしょに しゃしんを とりませんか。', 'Shall we take a photo together?') },
      { id: 'pb.taxi.kyouto', level: 'n5', from: 'travel.p.kyouto-ikitai', jp: t('京都に 行きたいです。', 'きょうとに いきたいです。', 'I want to go to Kyoto.') },
      { id: 'pb.taxi.ikura', level: 'n5', from: 'travel.p.ikura', jp: t('これは いくらですか。', 'これは いくらですか。', 'How much is this?') },
      { id: 'pb.taxi.tomete', level: 'n5', jp: t('ここで とめて ください。', 'ここで とめて ください。', 'Please stop here.') },
      { id: 'pb.taxi.kaado', level: 'n4', from: 'travel.p.kaado', jp: t('カードは 使えますか。', 'カードは つかえますか。', 'Can I pay by card?') },
      { id: 'pb.taxi.yukkuri', level: 'n4', jp: t('もっと ゆっくり 走って もらえますか。', 'もっと ゆっくり はしって もらえますか。', 'Could you drive more slowly?') },
      { id: 'pb.taxi.konde', level: 'n4', jp: t('道が こんで いるそうです。', 'みちが こんで いるそうです。', 'I hear the roads are busy.') },
    ],
  },
];

const FAMILY_PHRASES = new Map(FAMILY_SCENES.flatMap((x) => x.phrases).map((p) => [p.id, p]));

/** Phrases from the family scenes, by id. */
function reuse(...ids: string[]): ScenePhrase[] {
  return ids.map((id) => {
    const p = FAMILY_PHRASES.get(id);
    if (!p) throw new Error(`Phrase Bingo: no family scene phrase ${id}`);
    return p;
  });
}

const AUDIENCE_SCENES: readonly Scene[] = [
  // ---- kids ----
  {
    id: 'kyuushoku',
    packId: 'food',
    audience: 'kids',
    emoji: '🍛',
    setting: t('がっこうの きゅうしょく', 'がっこうの きゅうしょく', 'School lunch'),
    twist: "It's curry day, the pot is empty, and somebody has an orange moustache.",
    roles: [role('きゅうしょく とうばん', 'the lunch monitor'), role('せんせい', 'the teacher'), role('くいしんぼう', 'the kid who is always hungry'), role('てんこうせい', 'the new kid')],
    status: 'draft',
    phrases: reuse(
      'pb.dinner.itadakimasu', 'pb.dinner.gochisousama', 'pb.dinner.oishii', 'pb.dinner.dame',
      'pb.dinner.dare', 'pb.dinner.mou-hitotsu', 'pb.dinner.yasai', 'pb.konbini.onaka', 'pb.ramen.mizu', 'pb.ramen.issho', 'pb.dinner.shukudai', 'pb.konbini.tabete-ii',
      'pb.dinner.taberarenai', 'pb.ramen.taberaremasu', 'pb.dinner.oishisou',
    ),
  },
  {
    id: 'tanjoubi',
    packId: 'family',
    audience: 'kids',
    emoji: '🎂',
    setting: t('たんじょうび パーティー', 'たんじょうび パーティー', 'A birthday party'),
    twist: "The candles won't blow out, and the cat is wearing the party hat.",
    roles: [role('たんじょうびの こ', 'the birthday kid'), role('おかあさん', 'Mum'), role('ともだち', 'a friend who came early'), role('ねこ', 'the cat in the party hat')],
    status: 'draft',
    phrases: reuse(
      'pb.parents.sugoi', 'pb.konbini.arigatou', 'pb.parents.douzo', 'pb.dinner.oishii',
      'pb.parents.omiyage', 'pb.hanami.shashin', 'pb.hanami.juice', 'pb.dinner.mou-hitotsu', 'pb.dinner.ippai', 'pb.parents.inu', 'pb.parents.shumi', 'pb.hanami.okureta',
      'pb.parents.oishisou-cake', 'pb.hanami.dare', 'pb.parents.mata-kitara',
    ),
  },
  {
    id: 'ensoku',
    packId: 'travel',
    audience: 'kids',
    emoji: '🐼',
    setting: t('どうぶつえんへ えんそく', 'どうぶつえんへ えんそく', 'A class trip to the zoo'),
    twist: 'A panda has climbed onto the bus and wants to be in the class photo.',
    roles: [role('せんせい', 'the teacher'), role('はんちょう', 'the group leader'), role('まいごの こ', 'the kid who keeps getting lost'), role('パンダ', 'the panda')],
    status: 'draft',
    phrases: reuse(
      'pb.taxi.sugoi', 'pb.platform.abunai', 'pb.taxi.migi', 'pb.taxi.hidari', 'pb.platform.sumimasen',
      'pb.platform.toire', 'pb.taxi.shashin', 'pb.taxi.issho-shashin', 'pb.taxi.tomete', 'pb.taxi.ikura', 'pb.platform.oriru', 'pb.ryokan.tenki',
      'pb.platform.ikikata', 'pb.platform.kisou', 'pb.morning.furisou',
    ),
  },
  // ---- cheeky ----
  {
    id: 'izakaya',
    packId: 'food',
    audience: 'cheeky',
    emoji: '🍺',
    setting: t('しごとの あとの いざかや', 'しごとの あとの いざかや', 'The izakaya after work'),
    twist: 'The boss said "tonight is on me", went to the toilet, and has not come back. The bill is here.',
    roles: [role('ぶちょう', 'the boss'), role('しんにゅうしゃいん', 'the new hire'), role('てんいん', 'the server'), role('よっぱらい', 'the one who has had a few too many')],
    status: 'draft',
    phrases: reuse(
      'pb.hanami.kanpai', 'pb.ramen.umai', 'pb.konbini.sumimasen', 'pb.dinner.dame',
      'pb.ramen.okaikei', 'pb.ramen.osusume', 'pb.ramen.mizu', 'pb.konbini.nodo', 'pb.ramen.kore-nan', 'pb.ramen.ippai', 'pb.konbini.tabete-ii', 'pb.platform.toire',
      'pb.dinner.taberarenai', 'pb.ramen.taberaremasu', 'pb.ramen.tabetara',
    ),
  },
  {
    id: 'date',
    packId: 'family',
    audience: 'cheeky',
    emoji: '💘',
    setting: t('はじめての デート', 'はじめての デート', 'An awkward first date'),
    twist: 'The date brought their mum along. Mum has a lot of questions.',
    roles: [role('デートの あいて', 'the date'), role('おくれて きた ひと', 'the one who showed up late'), role('ついて きた おかあさん', 'the mum who came along'), role('てんいん', 'a waiter listening to everything')],
    status: 'draft',
    phrases: reuse(
      'pb.parents.hajimemashite', 'pb.parents.yoroshiku', 'pb.parents.sugoi', 'pb.konbini.sumimasen',
      'pb.parents.shumi', 'pb.parents.sunde', 'pb.parents.kyoudai', 'pb.parents.inu', 'pb.parents.yonin', 'pb.hanami.okureta', 'pb.hanami.suwatte', 'pb.ramen.okaikei',
      'pb.parents.hanasemasu', 'pb.parents.mata-kitara', 'pb.hanami.dare',
    ),
  },
  {
    id: 'asagaeri',
    packId: 'travel',
    audience: 'cheeky',
    emoji: '🌅',
    setting: t('あさがえりの でんしゃ', 'あさがえりの でんしゃ', 'The first train home, the morning after'),
    twist: 'Nobody remembers last night, someone is still holding a karaoke mic, and this train is going the wrong way.',
    roles: [role('かいしゃいん', "an office worker in last night's suit"), role('えきいん', 'the station attendant'), role('マイクを もった ひと', 'someone still holding a karaoke mic'), role('ゆうべの ともだち', 'a best friend met last night')],
    status: 'draft',
    phrases: reuse(
      'pb.platform.sumimasen', 'pb.platform.iie', 'pb.platform.hai', 'pb.morning.nemui',
      'pb.platform.shuuden', 'pb.platform.shinjuku', 'pb.platform.eki-doko', 'pb.platform.oriru', 'pb.platform.toire', 'pb.taxi.hotel', 'pb.morning.nanji', 'pb.morning.kutsu',
      'pb.platform.norikae', 'pb.platform.ikikata', 'pb.morning.isoida-hou',
    ),
  },
];

export const SCENES: readonly Scene[] = [...FAMILY_SCENES, ...AUDIENCE_SCENES];

// ---- the Green Car (shared/src/greenCar.ts; design: project files n3-coverage/green-car/design.md) ----
//
// Green Car scenes: every secret line is an N4 or N3 frame, written for the scene, and the bingo card shows the frame
// (＿て もらえますか), not the sentence. Each scene has the same ten frames, one line each: N4 ＿て もらえますか (4.1),
// ＿ても いいですか and ＿ては いけません (4.2), ＿たら and ＿ば (4.5); N3 ＿わりに, ＿くせに and ＿に しては (3.4), ＿っぽい and
// ＿なんて (3.11). Polite N4, casual N3. ＿くせに, ＿わりに and ＿に しては are aimed at props, animals, yōkai or Pon, never at
// a role a player plays. Kids get the school play and the pet shop; Family scenes are kid-safe (a Kids room fills
// with them); Cheeky gets the izakaya and the first date. All draft until the fluent and taste checks.

const gcLine = (scene: string, key: string, level: 'n4' | 'n3', frame: string, text: string, en: string): ScenePhrase => ({ id: `pb.gc.${scene}.${key}`, level, jp: t(text, text, en), frames: [frame] });
const four = (scene: string, lines: [string, string, string, string][]) => lines.map(([key, frame, text, en]) => gcLine(scene, key, 'n4', frame, text, en));
const three = (scene: string, lines: [string, string, string, string][]) => lines.map(([key, frame, text, en]) => gcLine(scene, key, 'n3', frame, text, en));

export const GREEN_CAR_SCENES: readonly Scene[] = [
  // ---- kids ----
  {
    id: 'gc-gakugeikai',
    packId: 'family',
    audience: 'kids',
    greenCar: true,
    emoji: '🎭',
    setting: t('がくげいかいの リハーサル', 'がくげいかいの リハーサル', 'The school play rehearsal'),
    twist: 'The ogre costume is too small, the cardboard tree keeps falling over, and the narrator has forgotten the story.',
    roles: [role('かんとくの こ', 'the kid directing'), role('ももたろう', 'Momotarō'), role('おに', 'the ogre'), role('ナレーター', 'the narrator')],
    status: 'draft',
    phrases: [
      ...four('gakugeikai', [
        ['moraeru', 'te-moraeru', 'せりふを もう いちど いって もらえますか。', 'Could you say your line once more?'],
        ['kabuttemo', 'te-mo-ii', 'おにの おめんを かぶっても いいですか。', 'May I put on the ogre mask?'],
        ['aitara', 'tara', 'まくが あいたら、はしって ください。', 'When the curtain opens, run.'],
        ['warattewa', 'te-wa-ikenai', 'ぶたいで わらっては いけません。', "You mustn't laugh on stage."],
        ['ieba', 'ba', 'もっと おおきい こえで いえば、きこえます。', "If you say it louder, they'll hear you."],
      ]),
      ...three('gakugeikai', [
        ['warini', 'wari-ni', 'この おめん、かみの わりに じょうぶだね。', "This mask is tough, for paper."],
        ['kuseni', 'kuse-ni', 'この きの セット、きの くせに すぐ たおれる。', 'This cardboard tree is meant to be a tree, and it keeps falling over.'],
        ['nishitewa', 'ni-shite-wa', 'はじめての リハーサルに しては、いいね。', 'Not bad, for a first rehearsal.'],
        ['ppoi', 'ppoi', 'その こえ、ほんとうの おにっぽい！', 'That voice sounds just like a real ogre!'],
        ['nante', 'nante', 'おになんて こわく ないよ。', 'Ogres? Not scary at all.'],
      ]),
    ],
  },
  {
    id: 'gc-petshop',
    packId: 'food',
    audience: 'kids',
    greenCar: true,
    emoji: '🐹',
    setting: t('ペットショップ', 'ペットショップ', 'The pet shop'),
    twist: 'The parrot repeats everything anyone says, and a hamster has escaped into the till.',
    roles: [role('てんいんさん', 'the shop assistant'), role('おきゃくさんの こ', 'a kid choosing a pet'), role('おかあさん', 'the mum paying'), role('じゅういさん', 'the vet')],
    status: 'draft',
    phrases: [
      ...four('petshop', [
        ['moraeru', 'te-moraeru', 'この ハムスターを みせて もらえますか。', 'Could you show me this hamster?'],
        ['sawattemo', 'te-mo-ii', 'ちょっと さわっても いいですか。', 'May I touch it a little?'],
        ['kaettara', 'tara', 'いえに かえったら、なまえを つけます。', "When we get home, I'll give it a name."],
        ['iretewa', 'te-wa-ikenai', 'ゆびを いれては いけません。', "You mustn't put your finger in."],
        ['asobeba', 'ba', 'まいにち あそべば、なかよく なります。', "If you play every day, you'll become friends."],
      ]),
      ...three('petshop', [
        ['warini', 'wari-ni', 'この インコ、ちいさい わりに こえが おおきいね。', 'This parrot is loud, for something so small.'],
        ['kuseni', 'kuse-ni', 'ハムスターの くせに、レジに かくれてる！', "It's only a hamster, and it's hiding in the till!"],
        ['nishitewa', 'ni-shite-wa', 'インコに しては、にほんごが じょうずだね。', 'Its Japanese is good, for a parrot.'],
        ['ppoi', 'ppoi', 'この こ、ちょっと ねこっぽい。', 'This one is a bit like a cat.'],
        ['nante', 'nante', 'ハムスターが レジに いるなんて！', "A hamster in the till? Unbelievable!"],
      ]),
    ],
  },
  // ---- family (kid-safe: Kids rooms fill with these) ----
  {
    id: 'gc-konbini',
    packId: 'food',
    greenCar: true,
    emoji: '🏪',
    setting: t('よるの コンビニ', 'よるの コンビニ', 'A konbini, late at night'),
    twist: 'The new robot till is very slow, and a ghost who loves pudding has hidden the last one.',
    roles: [role('てんいん', 'the clerk'), role('おきゃくさん', 'a customer'), role('ねむい アルバイト', 'the sleepy part-timer'), role('ポンの ファン', "Pon's biggest fan")],
    status: 'draft',
    phrases: [
      ...four('konbini', [
        ['moraeru', 'te-moraeru', 'おべんとうを あたためて もらえますか。', 'Could you heat up my bento?'],
        ['tabetemo', 'te-mo-ii', 'この プリン、たべても いいですか。', 'May I eat this pudding?'],
        ['attara', 'tara', 'プリンが あったら、ぜんぶ ください。', "If there's any pudding, I'll take it all."],
        ['netewa', 'te-wa-ikenai', 'みせの なかで ねては いけません。', "You mustn't sleep in the shop."],
        ['oseba', 'ba', 'ボタンを おせば、ドアが あきます。', 'If you press the button, the door opens.'],
      ]),
      ...three('konbini', [
        ['warini', 'wari-ni', 'この プリン、やすい わりに おいしいね。', "This pudding is good, for the price."],
        ['kuseni', 'kuse-ni', 'この レジ、ロボットの くせに けいさんが おそい。', "This till is a robot, and yet it's slow at sums."],
        ['nishitewa', 'ni-shite-wa', 'コンビニの プリンに しては、すごく おいしい。', 'Really good, for konbini pudding.'],
        ['ppoi', 'ppoi', 'この おにぎり、なんか おもちゃっぽい。', 'This onigiri looks kind of like a toy.'],
        ['nante', 'nante', 'プリンが ないなんて、しんじられない！', "No pudding? I can't believe it!"],
      ]),
    ],
  },
  {
    id: 'gc-dinner',
    packId: 'family',
    greenCar: true,
    emoji: '🍲',
    setting: t('かぞくの ばんごはん', 'かぞくの ばんごはん', 'Family dinner'),
    twist: "The grilled fish has vanished from the plate, and the house's ghost looks very full.",
    roles: [role('おとうさん', 'Dad'), role('おかあさん', 'Mum'), role('おばあちゃん', 'Grandma'), role('いもうと', 'the little sister')],
    status: 'draft',
    phrases: [
      ...four('dinner', [
        ['moraeru', 'te-moraeru', 'しょうゆを とって もらえますか。', 'Could you pass the soy sauce?'],
        ['tsuketemo', 'te-mo-ii', 'テレビを つけても いいですか。', 'May I turn on the TV?'],
        ['tabetara', 'tara', 'ごはんを たべたら、しゅくだいを します。', "Once I've eaten, I'll do my homework."],
        ['mitewa', 'te-wa-ikenai', 'たべながら スマホを みては いけません。', "You mustn't look at your phone while you eat."],
        ['tabereba', 'ba', 'はやく たべれば、デザートが もらえます。', 'If you eat quickly, you get dessert.'],
      ]),
      ...three('dinner', [
        ['warini', 'wari-ni', 'この さかな、ちいさい わりに ほねが おおいね。', 'This fish has a lot of bones, for a small one.'],
        ['kuseni', 'kuse-ni', 'この いえの おばけ、おばけの くせに おなかが すくの？', "This house's ghost gets hungry? It's a ghost!"],
        ['nishitewa', 'ni-shite-wa', 'レンジの ごはんに しては、おいしいね。', 'Tasty, for microwave rice.'],
        ['ppoi', 'ppoi', 'この スープ、ちょっと カレーっぽい。', 'This soup is a bit curry-ish.'],
        ['nante', 'nante', 'さかなが きえるなんて、へんだね。', 'A fish vanishing? That’s weird.'],
      ]),
    ],
  },
  {
    id: 'gc-ryokan',
    packId: 'travel',
    greenCar: true,
    emoji: '🏯',
    setting: t('りょかんの チェックイン', 'りょかんの チェックイン', 'Checking in at a ryokan'),
    twist: 'There is a tanuki asleep in the futon, and the onsen closes in five minutes.',
    roles: [role('おかみさん', 'the innkeeper'), role('おきゃくさん', 'a guest'), role('にもつを もつ ひと', 'the porter'), role('おんせんが すきな ひと', 'an onsen fanatic')],
    status: 'draft',
    phrases: [
      ...four('ryokan', [
        ['moraeru', 'te-moraeru', 'にもつを へやまで はこんで もらえますか。', 'Could you carry my bags to the room?'],
        ['haittemo', 'te-mo-ii', 'いま おんせんに はいっても いいですか。', 'May I go in the onsen now?'],
        ['detara', 'tara', 'おんせんから でたら、ごはんに しましょう。', "When we're out of the onsen, let's eat."],
        ['oyoidewa', 'te-wa-ikenai', 'おんせんで およいでは いけません。', "You mustn't swim in the onsen."],
        ['isogeba', 'ba', 'いそげば、まだ まにあいます。', "If we hurry, we'll still make it."],
      ]),
      ...three('ryokan', [
        ['warini', 'wari-ni', 'この へや、たかい わりに せまいね。', 'This room is small, for the price.'],
        ['kuseni', 'kuse-ni', 'この たぬき、たぬきの くせに ふとんで ねてる！', "This tanuki is sleeping in the futon, and it's a tanuki!"],
        ['nishitewa', 'ni-shite-wa', 'やすい りょかんに しては、きれいだね。', "It's clean, for a cheap ryokan."],
        ['ppoi', 'ppoi', 'この ゆかた、なんか パジャマっぽい。', 'This yukata looks kind of like pyjamas.'],
        ['nante', 'nante', 'ふとんに たぬきが いるなんて！', 'A tanuki in the futon? No way!'],
      ]),
    ],
  },
  // ---- cheeky ----
  {
    id: 'gc-izakaya',
    packId: 'food',
    audience: 'cheeky',
    greenCar: true,
    emoji: '🍺',
    setting: t('しごとの あとの いざかや', 'しごとの あとの いざかや', 'The izakaya after work'),
    twist: 'The boss said "tonight is on me", went to the toilet, and has not come back. The bill is here.',
    roles: [role('かかりちょう', 'the section chief'), role('しんにゅうしゃいん', 'the new hire'), role('てんいん', 'the server'), role('よっぱらい', 'the one who has had a few too many')],
    status: 'draft',
    phrases: [
      ...four('izakaya', [
        ['moraeru', 'te-moraeru', 'おかいけいを わけて もらえますか。', 'Could you split the bill?'],
        ['kaettemo', 'te-mo-ii', 'もう かえっても いいですか。', 'May I go home now?'],
        ['modottara', 'tara', 'ぶちょうが もどったら、かんぱいしましょう。', "When the boss gets back, let's do a toast."],
        ['netewa', 'te-wa-ikenai', 'ここで ねては いけません。', "You mustn't sleep here."],
        ['nomeba', 'ba', 'みずを のめば、だいじょうぶです。', "If you drink some water, you'll be fine."],
      ]),
      ...three('izakaya', [
        ['warini', 'wari-ni', 'この ビール、たかい わりに ぬるいね。', 'This beer is warm, for the price.'],
        ['kuseni', 'kuse-ni', 'ポンの くせに、いい みせ しってるね。', "Pon, of all people, knows a good place."],
        ['nishitewa', 'ni-shite-wa', 'のみほうだいに しては、いい おさけだね。', 'Good sake, for all-you-can-drink.'],
        ['ppoi', 'ppoi', 'この カクテル、ジュースっぽい。', 'This cocktail tastes like juice.'],
        ['nante', 'nante', 'ぶちょうが にげるなんて、さいあく！', 'The boss running off? The worst!'],
      ]),
    ],
  },
  {
    id: 'gc-date',
    packId: 'family',
    audience: 'cheeky',
    greenCar: true,
    emoji: '💘',
    setting: t('はじめての デート', 'はじめての デート', 'An awkward first date'),
    twist: 'The date brought their mum along. Mum has a lot of questions, and Pon is the waiter.',
    roles: [role('デートの あいて', 'the date'), role('おくれて きた ひと', 'the one who showed up late'), role('ついて きた おかあさん', 'the mum who came along'), role('となりの せきの ひと', 'the nosy diner at the next table')],
    status: 'draft',
    phrases: [
      ...four('date', [
        ['moraeru', 'te-moraeru', 'しゃしんを とって もらえますか。', 'Could you take our photo?'],
        ['suwattemo', 'te-mo-ii', 'となりに すわっても いいですか。', 'May I sit next to you?'],
        ['owattara', 'tara', 'たべおわったら、カラオケに いきませんか。', 'Once we finish eating, shall we go to karaoke?'],
        ['mitewa', 'te-wa-ikenai', 'デートで スマホを みては いけません。', "You mustn't look at your phone on a date."],
        ['yameba', 'ba', 'あめが やめば、さんぽしましょう。', "If the rain stops, let's go for a walk."],
      ]),
      ...three('date', [
        ['warini', 'wari-ni', 'この みせ、おしゃれな わりに やすいね。', "This place is cheap, for somewhere so stylish."],
        ['kuseni', 'kuse-ni', 'ポンの くせに、ワインに くわしいね。', 'Pon, of all people, knows his wine.'],
        ['nishitewa', 'ni-shite-wa', 'はじめての デートに しては、もりあがってるね。', "It's going well, for a first date."],
        ['ppoi', 'ppoi', 'この ふんいき、ちょっと おみあいっぽい。', 'This feels a bit like an arranged-marriage meeting.'],
        ['nante', 'nante', 'デートに おかあさんが くるなんて！', 'Bringing your mum on a date? Unbelievable!'],
      ]),
    ],
  },
];

/** Every scene, mixed-room and Green Car, for looking one up by id. */
export const ALL_SCENES: readonly Scene[] = [...SCENES, ...GREEN_CAR_SCENES];

/**
 * The scenes for an audience: Kids and Cheeky rooms get their own scenes first, then the family ones. In the Green Car,
 * only Green Car scenes, the same way.
 */
export function scenesFor(audience: Audience, greenCar = false): { own: Scene[]; fill: Scene[] } {
  const all = greenCar ? GREEN_CAR_SCENES : SCENES;
  const own = all.filter((x) => (x.audience ?? 'family') === audience);
  return { own, fill: audience === 'family' ? [] : all.filter((x) => !x.audience) };
}
