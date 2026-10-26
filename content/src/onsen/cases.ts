// Murder at the Onsen: three hand-written whodunits (backlog mode, shared/src/modes/onsenMurder).
//
// Every fact a suspect can say is written here, so the game never needs an LLM to answer.
// Japanese is N5 level, kana with spaces between words (kana-level players can read it),
// with digits for clock times; `kana` is the full reading the stage voices. The "victims"
// are things, not people (a snowman, a pudding, a rubber duck): the show's tone puts the
// joke on the situation. Every case is `draft` until a fluent speaker checks it.
//
// How a case is built: each suspect answers the six questions (where / what / who / when /
// victim / item). Some answers put a clue in the shared notebook; the key clues together
// point at one culprit, who lies about one thing. Two answers may give the same clue.

import type { JpText, OnsenCase } from '../types.js';

const t = (text: string, kana: string, en: string): JpText => ({ text, kana, en });
/** Kana-only Japanese: text and reading are the same. */
const k = (text: string, en: string): JpText => ({ text, kana: text, en });

const SHRUG = k('すみません、わかりません。', "Sorry, I don't know.");

export const snowmanCase: OnsenCase = {
  id: 'snowman',
  status: 'draft',
  title: k('ゆきだるま じけん', 'The Snowman Case'),
  setting: k('ふゆの よる、りょかん「ゆけむり」。', 'A winter night at the Yukemuri inn.'),
  victim: {
    name: k('ゆきだるまさん', 'Mr. Snowman'),
    emoji: '⛄',
    found: t('11じに、ろてんぶろで とけて いました。', 'じゅういちじに、ろてんぶろで とけて いました。', 'At 11 pm he was found melted in the outdoor bath.'),
  },
  item: { name: k('あかい マフラー', 'red scarf'), emoji: '🧣', keys: ['まふらー'] },
  culpritId: 'tanaka',
  suspects: [
    {
      id: 'tanaka',
      name: k('たなか', 'Tanaka'),
      role: k('りょかんの コック', "the inn's cook"),
      emoji: '👨‍🍳',
      voice: { pitch: 0.7, rate: 0.9 },
      persona: 'A proud, gruff ramen cook who sweats a lot and gets defensive about his cooking.',
      answers: {
        where: { jp: t('10じから 11じまで、だいどころに いました。', 'じゅうじから じゅういちじまで、だいどころに いました。', 'From 10 to 11, I was in the kitchen.'), clueId: 'kitchen' },
        what: { jp: k('おゆを たくさん つくりました。 ラーメンの スープです。', 'I made lots of hot water. For the ramen soup.'), clueId: 'hot-water' },
        who: { jp: k('だれも みませんでした。 ひとりでした。', "I didn't see anyone. I was alone.") },
        when: { jp: t('12じに ねました。 しごとが たくさん ありました。', 'じゅうにじに ねました。 しごとが たくさん ありました。', 'I went to bed at 12. I had lots of work.') },
        victim: { jp: k('つめたい ひとでした。 わたしの ラーメンが きらいでした。', 'He was a cold person. He hated my ramen.'), clueId: 'motive' },
        item: { jp: k('その マフラー？ しりません。', "That scarf? I don't know it.") },
      },
    },
    {
      id: 'suzuki',
      name: k('すずき', 'Suzuki'),
      role: k('おんせんが すきな おきゃくさん', 'a guest who loves hot springs'),
      emoji: '🧖',
      voice: { pitch: 1.3, rate: 1.05 },
      persona: 'A cheerful, chatty guest who has been in the hot spring so long she is pink. Loves gossip.',
      answers: {
        where: { jp: t('10じはんに、ろてんぶろに いました。', 'じゅうじはんに、ろてんぶろに いました。', 'At 10:30 I was in the outdoor bath.') },
        what: { jp: t('10じ45ふんまで おんせんに いました。 ゆきだるまさんは げんきでした。', 'じゅうじよんじゅうごふんまで おんせんに いました。 ゆきだるまさんは げんきでした。', 'I was in the hot spring until 10:45. Mr. Snowman was fine.'), clueId: 'fine' },
        who: { jp: t('10じ50ぷんに たなかさんを みました。 おおきい なべを もって いました。', 'じゅうじごじゅっぷんに たなかさんを みました。 おおきい なべを もって いました。', 'At 10:50 I saw Tanaka. He was carrying a big pot.'), clueId: 'saw-tanaka' },
        when: { jp: t('11じに ねました。', 'じゅういちじに ねました。', 'I went to bed at 11.') },
        victim: { jp: k('しずかな ひとでした。 いつも わらって いました。', 'He was a quiet one. He was always smiling.') },
        item: { jp: k('あかい マフラー？ やまださんの です。', "The red scarf? It's Yamada's."), clueId: 'scarf' },
      },
    },
    {
      id: 'yamada',
      name: k('やまだ', 'Yamada'),
      role: k('おばあさんの おきゃくさん', 'an elderly guest'),
      emoji: '👵',
      voice: { pitch: 1.1, rate: 0.8 },
      persona: 'A kind, sleepy grandmother who knits and worries that everyone is cold.',
      answers: {
        where: { jp: t('10じに、ゆきだるまさんの ところに いきました。', 'じゅうじに、ゆきだるまさんの ところに いきました。', 'At 10 I went to see Mr. Snowman.') },
        what: { jp: k('マフラーを あげました。 ゆきだるまさんは さむかったです。', 'I gave him my scarf. Mr. Snowman was cold.'), clueId: 'scarf' },
        who: { jp: k('すずきさんを みました。 おんせんに いました。', 'I saw Suzuki. She was in the hot spring.') },
        when: { jp: t('10じ15ふんに ねました。 おばあさんですから。', 'じゅうじじゅうごふんに ねました。 おばあさんですから。', "I went to bed at 10:15. I'm a grandma, after all."), clueId: 'yamada-bed' },
        victim: { jp: k('やさしい ひとでした。 かなしいです。', 'He was a kind soul. I am sad.') },
        item: { jp: k('はい、わたしの マフラーです。', "Yes, it's my scarf.") },
      },
    },
  ],
  clues: [
    { id: 'kitchen', jp: t('たなかさんは 10じ〜11じ、だいどころに いた？', 'たなかさんは じゅうじから じゅういちじ、だいどころに いた？', 'Tanaka says he was in the kitchen from 10 to 11.'), key: true },
    { id: 'hot-water', jp: k('たなかさんは おゆを たくさん つくった。', 'Tanaka made lots of hot water.'), key: true },
    { id: 'motive', jp: k('ゆきだるまさんは たなかさんの ラーメンが きらいだった。', "Mr. Snowman hated Tanaka's ramen."), key: true },
    { id: 'fine', jp: t('10じ45ふん：ゆきだるまさんは げんきだった。', 'じゅうじよんじゅうごふん、ゆきだるまさんは げんきだった。', 'At 10:45 Mr. Snowman was still fine.') },
    { id: 'saw-tanaka', jp: t('10じ50ぷん：たなかさんが なべを もって ろてんぶろに いた。', 'じゅうじごじゅっぷん、たなかさんが なべを もって ろてんぶろに いた。', 'At 10:50 Tanaka was at the outdoor bath with a pot.'), key: true },
    { id: 'scarf', jp: k('マフラーは やまださんの。 ゆきだるまさんに あげた。', 'The scarf is Yamada’s. She gave it to Mr. Snowman.') },
    { id: 'yamada-bed', jp: t('やまださんは 10じ15ふんに ねた。', 'やまださんは じゅうじじゅうごふんに ねた。', 'Yamada went to bed at 10:15.') },
  ],
  confession: [
    k('はい… わたしです。', 'Yes… it was me.'),
    k('ゆきだるまさんは、わたしの ラーメンは つめたいと いいました。', 'Mr. Snowman said my ramen was cold.'),
    k('だから、あつい おゆを かけました… ごめんなさい！', 'So I poured hot water on him… I’m sorry!'),
  ],
  solution: 'Tanaka said he was in the kitchen until 11, but Suzuki saw him at the outdoor bath at 10:50 with a big pot. He had made lots of hot water, and Mr. Snowman hated his ramen. The red scarf was only Yamada’s kind gift.',
  shrug: SHRUG,
};

export const puddingCase: OnsenCase = {
  id: 'pudding',
  status: 'draft',
  title: k('プリン じけん', 'The Pudding Case'),
  setting: k('りょかん「つきみ」の ばんごはんの あと。', 'After dinner at the Tsukimi inn.'),
  victim: {
    name: k('プリンさん', 'Purin-san, the famous pudding'),
    emoji: '🍮',
    found: t('9じに、れいぞうこから いなく なりました。', 'くじに、れいぞうこから いなく なりました。', 'At 9 pm he vanished from the fridge.'),
  },
  item: { name: k('ピンクの スプーン', 'pink spoon'), emoji: '🥄', keys: ['すぷーん'] },
  culpritId: 'sato',
  suspects: [
    {
      id: 'kimura',
      name: k('きむら', 'Kimura'),
      role: k('りょかんの おかみさん', 'the innkeeper'),
      emoji: '👘',
      voice: { pitch: 1.2, rate: 0.9 },
      persona: 'The elegant, dramatic innkeeper. The pudding was her pride and joy; she is heartbroken.',
      answers: {
        where: { jp: t('8じまで、だいどころに いました。', 'はちじまで、だいどころに いました。', 'I was in the kitchen until 8.') },
        what: { jp: t('8じに、プリンさんを れいぞうこに いれました。', 'はちじに、プリンさんを れいぞうこに いれました。', 'At 8 I put Purin-san in the fridge.'), clueId: 'fridge-8' },
        who: { jp: t('8じに もりくんを みました。 おふろに いきました。', 'はちじに もりくんを みました。 おふろに いきました。', 'At 8 I saw Mori. He went to the bath.'), clueId: 'mori-bath' },
        when: { jp: t('12じに ねました。', 'じゅうにじに ねました。', 'I went to bed at 12.') },
        victim: { jp: k('とても あまい ひとでした。 ゆうめいでした。', 'He was very sweet. He was famous.') },
        item: { jp: k('へやの スプーンです。 ピンクは にかいの へやです。', "It's a guest-room spoon. Pink ones are for the second-floor rooms."), clueId: 'pink-floor' },
      },
    },
    {
      id: 'mori',
      name: k('もり', 'Mori'),
      role: k('おとこのこの おきゃくさん', 'a young guest (a boy)'),
      emoji: '👦',
      voice: { pitch: 1.6, rate: 1.15 },
      persona: 'An excitable little boy who loves sweets and says everything with too much energy.',
      answers: {
        where: { jp: k('おふろに いました。 おとうさんと いっしょでした。', 'I was in the bath, with my dad.'), clueId: 'mori-bath' },
        what: { jp: k('おふろで うたを うたいました。', 'I sang songs in the bath.') },
        who: { jp: k('いとうさんを みました。 ろうかを そうじして いました。', 'I saw Itō. She was cleaning the hallway.'), clueId: 'ito-hall' },
        when: { jp: t('9じはんに ねました。', 'くじはんに ねました。', 'I went to bed at 9:30.') },
        victim: { jp: k('プリンさん、だいすきでした！ たべたかったです…', 'I loved Purin-san! I wanted to eat him…') },
        item: { jp: k('ぼくの スプーンは あおです。', 'My spoon is blue.'), clueId: 'mori-blue' },
      },
    },
    {
      id: 'ito',
      name: k('いとう', 'Itō'),
      role: k('そうじの ひと', 'the cleaner'),
      emoji: '🧹',
      voice: { pitch: 0.95, rate: 1.0 },
      persona: 'A sharp-eyed, matter-of-fact cleaner who notices everything and approves of nothing.',
      answers: {
        where: { jp: t('8じから 9じまで、にかいの ろうかに いました。', 'はちじから くじまで、にかいの ろうかに いました。', 'From 8 to 9 I was in the second-floor hallway.'), clueId: 'ito-hall' },
        what: { jp: k('ろうかを そうじしました。 ピカピカです。', 'I cleaned the hallway. It sparkles.') },
        who: { jp: t('8じはんに さとうさんを みました。 だいどころから でました。', 'はちじはんに さとうさんを みました。 だいどころから でました。', 'At 8:30 I saw Satō. She came out of the kitchen.'), clueId: 'sato-kitchen' },
        when: { jp: t('10じに ねました。', 'じゅうじに ねました。', 'I went to bed at 10.') },
        victim: { jp: k('きいろくて、かわいかったです。', 'He was yellow and cute.') },
        item: { jp: k('ピンクの スプーンですね。 さとうさんの へやは にかいです。', "A pink spoon, huh. Satō's room is on the second floor."), clueId: 'sato-floor' },
      },
    },
    {
      id: 'sato',
      name: k('さとう', 'Satō'),
      role: k('おいしゃさんの おきゃくさん', 'a guest who is a doctor'),
      emoji: '🩺',
      voice: { pitch: 1.0, rate: 0.95 },
      persona: 'A serious doctor on a strict diet who protests a little too much. Nervous, very polite.',
      answers: {
        where: { jp: k('ずっと へやに いました。', 'I was in my room the whole time.'), clueId: 'sato-room' },
        what: { jp: k('ほんを よみました。', 'I read a book.') },
        who: { jp: k('だれも みませんでした。', "I didn't see anyone.") },
        when: { jp: t('9じに ねました。', 'くじに ねました。', 'I went to bed at 9.') },
        victim: { jp: k('あまい ものは たべません。 ダイエット ちゅうです。', "I don't eat sweets. I'm on a diet."), clueId: 'sato-diet' },
        item: { jp: k('わたしの スプーン？ ちがいます！', "My spoon? It isn't!") },
      },
    },
  ],
  clues: [
    { id: 'fridge-8', jp: t('8じ：プリンさんは れいぞうこに いた。', 'はちじ、プリンさんは れいぞうこに いた。', 'At 8 Purin-san was in the fridge.') },
    { id: 'mori-bath', jp: k('もりくんは おとうさんと おふろに いた。', 'Mori was in the bath with his dad.') },
    { id: 'pink-floor', jp: k('ピンクの スプーンは にかいの へやの スプーン。', 'Pink spoons belong to the second-floor rooms.'), key: true },
    { id: 'mori-blue', jp: k('もりくんの スプーンは あお。', "Mori's spoon is blue.") },
    { id: 'ito-hall', jp: k('いとうさんは にかいの ろうかを そうじして いた。', 'Itō was cleaning the second-floor hallway.') },
    { id: 'sato-kitchen', jp: t('8じはん：さとうさんが だいどころから でた。', 'はちじはん、さとうさんが だいどころから でた。', 'At 8:30 Satō came out of the kitchen.'), key: true },
    { id: 'sato-floor', jp: k('さとうさんの へやは にかい。', "Satō's room is on the second floor."), key: true },
    { id: 'sato-room', jp: k('さとうさん：「ずっと へやに いました」', 'Satō: "I was in my room the whole time."'), key: true },
    { id: 'sato-diet', jp: k('さとうさんは ダイエット ちゅう。', 'Satō is on a diet.') },
  ],
  confession: [
    k('はい… わたしが たべました。', 'Yes… I ate him.'),
    k('ダイエットは とても たいへんでした。', 'The diet was very hard.'),
    k('プリンさん、おいしかったです。 ごめんなさい！', 'Purin-san was delicious. I’m sorry!'),
  ],
  solution: 'Satō said she never left her room, but Itō saw her come out of the kitchen at 8:30. The pink spoon belongs to the second-floor rooms, and Satō’s room is on the second floor. Mori was in the bath with his dad, and his spoon is blue.',
  shrug: SHRUG,
};

export const duckCase: OnsenCase = {
  id: 'duck',
  status: 'draft',
  title: k('アヒル じけん', 'The Rubber Duck Case'),
  setting: k('りょかん「はなび」の よる。', 'Night at the Hanabi inn.'),
  victim: {
    name: k('アヒルくん', 'Ahiru-kun, the bath duck'),
    emoji: '🦆',
    found: t('12じに、おおきい おふろで ぺちゃんこでした。', 'じゅうにじに、おおきい おふろで ぺちゃんこでした。', 'At midnight he was found flattened in the big bath.'),
  },
  item: { name: k('フォーク', 'fork'), emoji: '🍴', keys: ['ふぉーく'] },
  culpritId: 'matsuda',
  suspects: [
    {
      id: 'hayashi',
      name: k('はやし', 'Hayashi'),
      role: k('がくせい', 'a student'),
      emoji: '🏓',
      voice: { pitch: 1.15, rate: 1.1 },
      persona: 'A sporty, slightly bored university student obsessed with ping-pong. Honest and blunt.',
      answers: {
        where: { jp: t('11じから、ロビーに いました。', 'じゅういちじから、ロビーに いました。', 'From 11 I was in the lobby.') },
        what: { jp: k('ピンポンを しました。 となりの へやの ギターの おとは ありませんでした。', "I played ping-pong. There was no guitar sound from the room next door."), clueId: 'no-guitar' },
        who: { jp: t('11じに タマを みました。 ロビーで ねて いました。', 'じゅういちじに タマを みました。 ロビーで ねて いました。', 'At 11 I saw Tama. She was asleep in the lobby.'), clueId: 'tama-sleep' },
        when: { jp: t('12じはんに ねました。', 'じゅうにじはんに ねました。', 'I went to bed at 12:30.') },
        victim: { jp: k('アヒルくんは うるさかったです。 ピー ピー！', 'Ahiru-kun was noisy. Squeak, squeak!') },
        item: { jp: k('その フォーク、まつださんの です。 ばんごはんで つかって いました。', "That fork is Matsuda's. He was using it at dinner."), clueId: 'fork' },
      },
    },
    {
      id: 'matsuda',
      name: k('まつだ', 'Matsuda'),
      role: k('ギターの ひと', 'a guitarist'),
      emoji: '🎸',
      voice: { pitch: 0.8, rate: 0.85 },
      persona: 'A moody, dramatic singer-songwriter who thinks every noise ruins his art. Speaks slowly and sighs.',
      answers: {
        where: { jp: t('11じから 12じまで、へやで ギターを ひきました。', 'じゅういちじから じゅうにじまで、へやで ギターを ひきました。', 'From 11 to 12 I played guitar in my room.'), clueId: 'matsuda-room' },
        what: { jp: k('あたらしい うたを つくって いました。', 'I was writing a new song.') },
        who: { jp: k('だれも みませんでした。', "I didn't see anyone.") },
        when: { jp: t('12じに ねました。', 'じゅうにじに ねました。', 'I went to bed at 12.') },
        victim: { jp: k('アヒルくん？ うるさかったです。 ぼくの うたより うるさかった。', 'Ahiru-kun? He was noisy. Noisier than my songs.'), clueId: 'motive' },
        item: { jp: k('フォーク？ ぼくのじゃ ありません。', "A fork? It's not mine.") },
      },
    },
    {
      id: 'tama',
      name: k('タマ', 'Tama'),
      role: k('りょかんの ねこ', "the inn's cat"),
      emoji: '🐱',
      voice: { pitch: 1.8, rate: 1.0 },
      persona: 'The inn’s sleepy, smug cat. Ends sentences with にゃ. Thinks she is the real owner of the inn.',
      answers: {
        where: { jp: k('ロビーに いました。 にゃ。', 'I was in the lobby. Meow.') },
        what: { jp: k('ねて いました。 にゃー。', 'I was sleeping. Meow.') },
        who: { jp: t('11じはんに まつださんを みました。 おおきい おふろに いきました。 にゃ。', 'じゅういちじはんに まつださんを みました。 おおきい おふろに いきました。 にゃ。', 'At 11:30 I saw Matsuda. He went to the big bath. Meow.'), clueId: 'matsuda-bath' },
        when: { jp: k('ねこは いつも ねて います。 にゃ。', 'Cats are always asleep. Meow.') },
        victim: { jp: k('アヒルくんは ともだちでした。 にゃ…', 'Ahiru-kun was my friend. Meow…') },
        item: { jp: k('ねこは フォークを つかいません。 にゃ。', "Cats don't use forks. Meow.") },
      },
    },
  ],
  clues: [
    { id: 'no-guitar', jp: k('11じすぎ、まつださんの へやから ギターの おとは なかった。', "After 11 there was no guitar sound from Matsuda's room."), key: true },
    { id: 'tama-sleep', jp: t('11じ：タマは ロビーで ねて いた。', 'じゅういちじ、タマは ロビーで ねて いた。', 'At 11 Tama was asleep in the lobby.') },
    { id: 'fork', jp: k('フォークは まつださんの。', "The fork is Matsuda's."), key: true },
    { id: 'matsuda-room', jp: t('まつださん：「11じ〜12じ、へやで ギターを ひいた」', 'まつださん、じゅういちじから じゅうにじ、へやで ギターを ひいた。', 'Matsuda: "From 11 to 12 I played guitar in my room."'), key: true },
    { id: 'motive', jp: k('まつださんは アヒルくんが うるさいと おもって いた。', 'Matsuda thought Ahiru-kun was too noisy.'), key: true },
    { id: 'matsuda-bath', jp: t('11じはん：まつださんが おおきい おふろに いった。', 'じゅういちじはん、まつださんが おおきい おふろに いった。', 'At 11:30 Matsuda went to the big bath.'), key: true },
  ],
  confession: [
    k('…はい、ぼくです。', '…Yes. It was me.'),
    k('アヒルくんは まいばん ピー ピー うるさかったです。', 'Ahiru-kun squeaked loudly every single night.'),
    k('フォークで… ごめんなさい！', 'With a fork… I’m sorry!'),
  ],
  solution: 'Matsuda said he played guitar in his room from 11 to 12, but Hayashi heard no guitar, and Tama saw him go to the big bath at 11:30. The fork is his, and he thought Ahiru-kun was too noisy. Tama was asleep in the lobby.',
  shrug: SHRUG,
};

export const onsenCases: OnsenCase[] = [snowmanCase, puddingCase, duckCase];
