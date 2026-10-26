// Phrase Bingo Theater scenes: a setting, roles for the actors, a twist to spark the improv,
// and the secret phrases actors are dealt. Three scenes per topic pack.
//
// Draft content (status 'draft'): a fluent speaker should check every phrase, role and twist.
// Phrases marked `from` copy a topic-pack phrase; when that pack is loaded the pack's own text
// (and furigana) wins, so a fluent-checked pack fixes the scene too. The others are new,
// written alongside the packs at the same level bands: kana = short set phrases, n5 = です/ます
// sentences, n4 = one N4 pattern each (〜そう, 〜たら, potential, 〜てもらえますか, 〜ほうがいい).

import type { JpText, Level, ReviewStatus } from '../../../../content/src/types.js';

export interface ScenePhrase {
  /** Stable id, e.g. `pb.konbini.irasshaimase`. */
  id: string;
  jp: JpText;
  level: Level;
  /** A topic-pack phrase id this one copies. */
  from?: string;
  /** Other readings that count (casual or shortened forms), as kana. */
  accepted?: string[];
}

export interface Scene {
  id: string;
  packId: 'food' | 'family' | 'travel';
  emoji: string;
  setting: JpText;
  /** One line to get the improv going. English, so every level gets the joke. */
  twist: string;
  /** Roles handed out to the actors in order (at least 4). */
  roles: JpText[];
  phrases: ScenePhrase[];
  status: ReviewStatus;
}

const t = (text: string, kana: string, en: string): JpText => ({ text, kana, en });
const role = (kana: string, en: string): JpText => ({ text: kana, kana, en });

export const SCENES: readonly Scene[] = [
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
    roles: [role('てんちょう', 'the chef'), role('おきゃくさん', 'a hungry customer'), role('グルメの ひと', 'a ramen critic'), role('となりの ひと', 'the person in the next seat')],
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
      { id: 'pb.parents.mata-kitara', level: 'n4', jp: t('また 来たら うれしいです。', 'また きたら うれしいです。', "I'd be happy if you came again.") },
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
