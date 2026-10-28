// Dub Club's content: the episodes (three scenes each, a line per level) and the direction cards.
// All draft until a fluent check. See docs/modes/dub-club.md.

import type { JpText, Level } from '../../../../content/src/types.js';
import type { Audience } from '../../protocol.js';

export interface Scene {
  id: string;
  /** Background set (stage/assets/dub/bg-<bg>.png). */
  bg: string;
  /** The speaking character (stage/assets/dub/char-<char>.png and its talk sheet). */
  char: string;
  /** Who's speaking, for the TV's caption. */
  who: JpText;
  /** What's going on, one English line for the scene card. */
  setup: string;
  /** The line, one per level: Kana a word or two, N5 one sentence, N4 one sentence with an N4 point. */
  lines: Record<Level, JpText>;
  /** Cheeky rooms' version of the line, where the twist differs. */
  cheeky?: Record<Level, JpText>;
}

export interface Episode {
  id: string;
  title: JpText;
  /** Left out: plays in every room. */
  audience?: 'kids' | 'family' | 'cheeky';
  scenes: [Scene, Scene, Scene];
}

export interface Direction {
  id: string;
  /** The card: an adverb form (〜く, 〜そうに, 〜みたいに, 〜て, 〜で, 〜ながら). */
  jp: JpText;
  /** The word it comes from, shown at the cast notes (かなしい → かなしそうに). */
  root: JpText | null;
  /** A small picture for the card. */
  emoji: string;
  /** Cards in one family are never dealt in the same scene (sad and crying sound alike). */
  family: string;
  /** Kana that give the direction away if heard in the take (the spoiler rule). */
  spoil: string[];
  /** How to act it, one line on the phone. */
  tip: string;
  /** Changes or adds sounds on purpose (crying, singing, a whisper): Whisper hears it badly. */
  distorts?: boolean;
  /** Stretches the take: it may record half as long again. */
  slow?: boolean;
  audience?: 'kids' | 'cheeky';
}

const jp = (text: string, en: string, kana = text): JpText => ({ text, kana, en });

/** A scene's lines for the room: Cheeky rooms get their own twist where a scene has one. */
export const sceneLines = (scene: Scene, audience: Audience): Record<Level, JpText> => (audience === 'cheeky' && scene.cheeky) || scene.lines;

const card = (id: string, text: string, en: string, root: JpText | null, emoji: string, family: string, spoil: string[], tip: string, extra: Partial<Direction> = {}): Direction => ({
  id,
  jp: jp(text, en),
  root,
  emoji,
  family,
  spoil,
  tip,
  ...extra,
});

// Families group cards by how they SOUND, not what they mean (the humor and JLPT seats): slow, sleepy
// and old all sound slow, so a scene never deals two of them. Levels: 〜く, 〜て, 〜で are N5;
// 〜そうに, 〜みたいに, 〜ながら are N4 (Genki II), learnt as set phrases from the picture below that.
export const DIRECTIONS: Direction[] = [
  card('happy', 'うれしそうに', 'happily', jp('うれしい', 'happy'), '😆', 'happy', ['うれしそう'], 'Big smile; your voice goes up at the end.'),
  card('laughing', 'わらいながら', 'laughing', jp('わらう', 'to laugh'), '🤣', 'happy', ['わらいながら'], 'Laugh between the words.', { distorts: true }),
  card('sad', 'かなしそうに', 'sadly', jp('かなしい', 'sad'), '😢', 'sad', ['かなしそう'], 'Slow and falling. Sigh first.'),
  card('crying', 'ないて', 'crying', jp('なく', 'to cry'), '😭', 'sad', ['ないて', 'なきながら'], 'Sob. Break the words up.', { distorts: true }),
  card('angry', 'おこって', 'angrily', jp('おこる', 'to get angry'), '😠', 'loud', ['おこって'], 'Hit every word hard.'),
  card('loud', 'おおきな こえで', 'loudly', jp('おおきい', 'big'), '📢', 'loud', ['おおきなこえ'], 'Shout, like across a field.'),
  card('quiet', 'ちいさな こえで', 'quietly, under your breath', jp('ちいさい', 'small'), '🤫', 'quiet', ['ちいさなこえ'], 'A tiny voice, like a mouse.', { distorts: true }),
  card('secret', 'ひみつの はなしみたいに', 'like telling a secret', jp('ひみつ', 'secret'), '🙊', 'quiet', ['ひみつのはなし'], 'Whisper, close to the phone.', { distorts: true }),
  card('shy', 'はずかしそうに', 'shyly', jp('はずかしい', 'embarrassed'), '😳', 'quiet', ['はずかしそう'], 'Mumble and trail off.'),
  card('ghost', 'おばけみたいに', 'like a ghost', jp('おばけ', 'ghost'), '👻', 'quiet', ['おばけみたい'], 'Breathy. A long ううう… first.'),
  card('slow', 'ゆっくり', 'slowly', null, '🐢', 'slow', ['ゆっくり'], 'Stretch every sound.', { slow: true }),
  card('sleepy', 'ねむそうに', 'sleepily', jp('ねむい', 'sleepy'), '😪', 'slow', ['ねむそう'], 'Yawn in the middle.', { slow: true }),
  card('grandpa', 'おじいさんみたいに', 'like an old man', jp('おじいさん', 'old man'), '👴', 'slow', ['おじいさんみたい'], 'Shaky and slow. えー… first.', { slow: true }),
  card('drunk', 'よっぱらって', 'drunk', jp('よっぱらう', 'to get drunk (N3)'), '🥴', 'slow', ['よっぱら'], 'Wobbly. Hiccup.', { audience: 'cheeky', distorts: true, slow: true }),
  card('fast', 'はやくちで', 'fast-talking', jp('はやい', 'fast'), '💨', 'fast', ['はやくち'], 'As fast as you can.'),
  card('running', 'はしりながら', 'while running', jp('はしる', 'to run'), '🏃', 'fast', ['はしりながら'], 'Out of breath, puffing.', { distorts: true }),
  card('robot', 'ロボットみたいに', 'like a robot', jp('ロボット', 'robot', 'ろぼっと'), '🤖', 'strange', ['ろぼっと'], 'Every sound the same. ピピッ at the end.', { distorts: true }),
  card('alien', 'うちゅうじんみたいに', 'like an alien', jp('うちゅうじん', 'alien'), '👽', 'strange', ['うちゅうじん'], 'Weird and wobbly.', { distorts: true }),
  card('baby', 'あかちゃんみたいに', 'like a baby', jp('あかちゃん', 'baby'), '👶', 'cute', ['あかちゃん'], 'High and babbly.', { distorts: true }),
  card('cat', 'ねこみたいに', 'like a cat', jp('ねこ', 'cat'), '🐱', 'cute', ['ねこみたい'], 'Add にゃ to the end.', { distorts: true }),
  card('dog', 'いぬみたいに', 'like a dog', jp('いぬ', 'dog'), '🐶', 'cute', ['いぬみたい'], 'Pant, and add わん.', { audience: 'kids', distorts: true }),
  card('cool', 'かっこよく', 'coolly, like a hero', jp('かっこいい', 'cool (いい → よく)'), '😎', 'cool', ['かっこよく'], 'Low voice. Pause before the last word.'),
  card('narcissist', 'ナルシストみたいに', 'like a narcissist', jp('ナルシスト', 'narcissist', 'なるしすと'), '🪞', 'cool', ['なるしすと'], 'Admire yourself. ふっ at the end.'),
  card('sexy', 'セクシーに', 'sexily', jp('セクシー', 'sexy', 'せくしー'), '💋', 'cool', ['せくしー'], 'Slow, low and breathy.', { audience: 'cheeky' }),
  card('gal', 'ギャルみたいに', 'like a gyaru', jp('ギャル', 'gyaru, a flashy party girl', 'ぎゃる'), '💅', 'cute', ['ぎゃる'], 'Bright and bouncy. ウケる！ at the end.', { audience: 'cheeky' }),
  card('host', 'ホストみたいに', 'like a host-club host', jp('ホスト', 'host', 'ほすと'), '🥂', 'cool', ['ほすと'], 'Smooth and flattering. ね？ at the end.', { audience: 'cheeky' }),
  card('singing', 'うたって', 'singing it', jp('うたう', 'to sing'), '🎤', 'song', ['うたって'], 'Any tune, like an opera.', { distorts: true }),
  card('boss', 'しゃちょうみたいに', 'like a company boss', jp('しゃちょう', 'company president'), '💼', 'boss', ['しゃちょう'], 'Slow and important. うむ first.'),
  card('teacher', 'せんせいみたいに', 'like a teacher', jp('せんせい', 'teacher'), '👩‍🏫', 'boss', ['せんせいみたい'], 'Like telling off a class.'),
  card('motherinlaw', 'おしゅうとめさんみたいに', 'like a mother-in-law', jp('しゅうとめ', 'mother-in-law'), '🧐', 'boss', ['しゅうとめ'], 'Sweet on top, a needle underneath. あら… first.', { audience: 'cheeky' }),
  card('mum', 'おかあさんみたいに', 'like a mum', jp('おかあさん', 'mother'), '🍳', 'boss', ['おかあさんみたい'], 'Like calling everyone down for dinner.'),
  card('eating', 'たべながら', 'with your mouth full', jp('たべる', 'to eat'), '🍙', 'mouth', ['たべながら'], 'もぐもぐ while you talk.', { distorts: true }),
  card('toilet', 'トイレに いきたそうに', 'needing the toilet', jp('いきたい', 'want to go'), '🚽', 'body', ['といれ'], 'In a hurry. Wriggle!'),
];

const lines = (kana: JpText, n5: JpText, n4: JpText): Record<Level, JpText> => ({ kana, n5, n4 });

// Every episode is setup, build, twist: scene 3 is the punchline, and it counts double. Kana lines are at
// least four morae (Whisper misses lone short words); each N4 line has an N4 grammar point (in `point`).
export const EPISODES: Episode[] = [
  {
    id: 'onigiri',
    title: jp('おにぎり どろぼう', 'The Onigiri Thief'),
    scenes: [
      {
        id: 'onigiri.1',
        bg: 'classroom',
        char: 'hero',
        who: jp('ヒロイン', 'the heroine', 'ひろいん'),
        setup: 'Lunchtime. Her lunch box is open. It is empty.',
        lines: lines(jp('あれ？ ない！', 'Huh? It’s gone!'), jp('わたしの おにぎりが ない！', 'My onigiri is gone!'), jp('わたしの おにぎり、だれが たべちゃったの？', 'Who ate my onigiri? (〜ちゃう)')),
      },
      {
        id: 'onigiri.2',
        bg: 'classroom',
        char: 'rival',
        who: jp('ライバル', 'the rival', 'らいばる'),
        setup: 'The rival turns round, chewing. There is rice on his cheek.',
        lines: lines(jp('しらない… もぐもぐ', 'Dunno… munch munch'), jp('ぼくじゃ ないよ。…もぐもぐ。', 'It wasn’t me. …munch munch.'), jp('しらないよ。おなか すいて ないし。…もぐもぐ。', 'Dunno. I’m not even hungry. …munch. (〜し)')),
      },
      {
        id: 'onigiri.3',
        bg: 'roof',
        char: 'pon',
        who: jp('ポン', 'Pon', 'ぽん'),
        setup: 'On the roof at sunset, the real thief confesses.',
        lines: lines(jp('おいしかった！', 'It was delicious!'), jp('ごめんね。とても おいしかった！', 'Sorry. It was really tasty!'), jp('ごめん。おいしそう だったから、ぜんぶ たべちゃった。', 'Sorry. It looked tasty, so I ate it all. (〜そう, 〜ちゃう)')),
      },
    ],
  },
  {
    id: 'magical',
    title: jp('まほうしょうじょ ポン', 'Magical Girl Pon'),
    scenes: [
      {
        id: 'magical.1',
        bg: 'city',
        char: 'magical',
        who: jp('まほうしょうじょ', 'the magical girl'),
        setup: 'A giant monster attacks the city. Time to transform!',
        lines: lines(jp('へんしん！', 'Transform!'), jp('いくよ！ へんしん！', 'Here I go! Transform!'), jp('みんなを まもるために… へんしん！', 'To protect everyone… transform! (ために)')),
      },
      {
        id: 'magical.2',
        bg: 'city',
        char: 'monster',
        who: jp('かいじゅう', 'the monster'),
        setup: 'The monster laughs and stomps closer. (おまえ: rough, monster talk.)',
        lines: lines(jp('まけないぞ！', 'I won’t lose!'), jp('おまえには まけないぞ！', 'I won’t lose to you!'), jp('おまえには この まちを まもれない！', 'You can’t protect this town! (potential)')),
      },
      {
        id: 'magical.3',
        bg: 'city',
        char: 'mum',
        who: jp('かいじゅう…？', 'the monster…?'),
        setup: 'The monster takes off its mask. It’s Pon’s mum, in an apron.',
        lines: lines(jp('ごはんよ！', 'Dinner’s ready!'), jp('ポン！ もう ごはんの じかんですよ！', 'Pon! It’s dinner time!', 'ぽん！ もう ごはんの じかんですよ！'), jp('ポン！ しゅくだいを してから あそびなさい！', 'Pon! Homework first, then play! (〜なさい)', 'ぽん！ しゅくだいを してから あそびなさい！')),
      },
    ],
  },
  {
    id: 'spacecat',
    title: jp('うちゅうねこ', 'Space Cat'),
    audience: 'kids',
    scenes: [
      {
        id: 'spacecat.1',
        bg: 'space',
        char: 'cat',
        who: jp('うちゅうねこ', 'Space Cat'),
        setup: 'Alarms! The spaceship is breaking down.',
        lines: lines(jp('たすけて！', 'Help!'), jp('たすけて！ ふねが こわれた！', 'Help! The ship is broken!'), jp('だれか たすけて！ ふねが こわれちゃった！', 'Somebody help! The ship broke! (〜ちゃう)')),
      },
      {
        id: 'spacecat.2',
        bg: 'planet',
        char: 'alien',
        who: jp('うちゅうじん', 'the alien'),
        setup: 'The ship lands on a purple planet. A small alien waves.',
        lines: lines(jp('こんにちは', 'Hello'), jp('こんにちは。ぼくの ほしへ ようこそ。', 'Hello. Welcome to my planet.'), jp('こんにちは。ぼくの ほしに すんで みない？', 'Hello. Want to try living on my planet? (〜てみる)')),
      },
      {
        id: 'spacecat.3',
        bg: 'planet',
        char: 'cat',
        who: jp('うちゅうねこ', 'Space Cat'),
        setup: 'The alien holds out a fish. The rescue is cancelled.',
        lines: lines(jp('さかなだ！', 'A fish!'), jp('さかな！？ ここに すみます！', 'Fish?! I’ll live here!'), jp('さかなが あるなら、ずっと ここに いる！', 'If there’s fish, I’m staying here forever! (〜なら)')),
      },
    ],
  },
  {
    id: 'studio',
    title: jp('スタジオの おばけ', 'The Studio Ghost', 'すたじおの おばけ'),
    scenes: [
      {
        id: 'studio.1',
        bg: 'studio',
        char: 'guard',
        who: jp('けいびいん', 'the night guard'),
        setup: 'Midnight. The guard hears something in the empty studio.',
        lines: lines(jp('だれか いる？', 'Anyone there?'), jp('だれか いますか？', 'Is anyone there?'), jp('こんな じかんに、だれが いるんですか？', 'Who’s here at this hour? (〜んです)')),
      },
      {
        id: 'studio.2',
        bg: 'studio',
        char: 'guard',
        who: jp('けいびいん', 'the night guard'),
        setup: 'A white shape floats out from behind the curtain.',
        lines: lines(jp('おばけだ！', 'A ghost!'), jp('おばけだ！ にげて！', 'A ghost! Run!'), jp('おばけが でた！ はやく にげよう！', 'A ghost! Let’s run, quick! (volitional)')),
      },
      {
        id: 'studio.3',
        bg: 'studio',
        char: 'ghost',
        who: jp('おばけ', 'the ghost'),
        setup: 'The ghost holds out a notebook and a pen. It’s a fan.',
        lines: lines(jp('サイン ください', 'Autograph, please', 'さいん ください'), jp('あの… サインを ください。', 'Um… may I have your autograph?', 'あの… さいんを ください。'), jp('こわがらないで。サインが ほしい だけ なんです。', 'Don’t be scared. I just want an autograph. (〜だけ)', 'こわがらないで。さいんが ほしい だけ なんです。')),
      },
    ],
  },
  {
    id: 'sakura',
    title: jp('さくらの したで', 'Under the Cherry Tree'),
    audience: 'family',
    scenes: [
      {
        id: 'sakura.1',
        bg: 'sakura',
        char: 'hero',
        who: jp('こうはい', 'the junior student'),
        setup: 'Graduation day. She finally says it.',
        lines: lines(jp('すきです', 'I like you'), jp('せんぱい、ずっと すきでした。', 'Senpai, I’ve always liked you.'), jp('はじめて あった ときから、ずっと すきでした。', 'I’ve liked you since the day we met. (〜とき)')),
      },
      {
        id: 'sakura.2',
        bg: 'sakura',
        char: 'senpai',
        who: jp('せんぱい', 'the senior student'),
        setup: 'Senpai drops his diploma.',
        lines: lines(jp('ほんとう？', 'Really?'), jp('えっ、ぼくの ことが？', 'Huh, me?'), jp('えっ、ぼくの ことが すきだって？', 'Huh, you said you like me? (〜って)')),
      },
      {
        id: 'sakura.3',
        bg: 'sakura',
        char: 'senpai',
        who: jp('せんぱい', 'the senior student'),
        setup: 'She runs off. He shouts after her, with a confession of his own.',
        lines: lines(jp('おばけです', 'I’m a ghost'), jp('まって！ ぼくは… おばけです。', 'Wait! I’m… a ghost.'), jp('まって！ じつは ぼく、おばけ なんだ。', 'Wait! The truth is, I’m a ghost. (〜んだ)')),
        cheeky: lines(jp('おくさんが…', 'My wife…'), jp('まって！ ぼく、おくさんが います。', 'Wait! I have a wife.'), jp('まって！ じつは らいげつ けっこん するんだ。', 'Wait! Actually, I’m getting married next month. (〜んだ)')),
      },
    ],
  },
  {
    id: 'overtime',
    title: jp('ざんぎょう せんし', 'Overtime Warrior'),
    audience: 'cheeky',
    scenes: [
      {
        id: 'overtime.1',
        bg: 'office',
        char: 'salaryman',
        who: jp('かいしゃいん', 'the office worker'),
        setup: '11 p.m. The boss drops another pile of files on his desk.',
        lines: lines(jp('また ざんぎょう？', 'Overtime again?'), jp('きょうも ざんぎょう ですか？', 'Overtime again today?'), jp('また ざんぎょう しなければ ならないんですか？', 'Do I have to do overtime again? (〜なければならない)')),
      },
      {
        id: 'overtime.2',
        bg: 'office',
        char: 'salaryman',
        who: jp('かいしゃいん', 'the office worker'),
        setup: 'He stands up. The whole office goes quiet.',
        lines: lines(jp('かえります！', 'I’m going home!'), jp('ぶちょう、きょうは かえります！', 'Boss, I’m going home today!'), jp('ぶちょう、すみません。きょうは かえる ことに します！', 'Sorry, boss. I’ve decided to go home today! (〜ことにする)')),
      },
      {
        id: 'overtime.3',
        bg: 'street',
        char: 'salaryman',
        who: jp('かいしゃいん', 'the office worker'),
        setup: 'Outside, he checks his phone. Oh no.',
        lines: lines(jp('きょう どようび？', 'Today’s Saturday?'), jp('あれ？ きょうは どようび です。', 'Huh? Today is Saturday.'), jp('きょうは どようび なのに、どうして かいしゃに いるの？', 'It’s Saturday, so why am I at work? (のに)')),
      },
    ],
  },
  {
    id: 'date',
    title: jp('デートの よる', 'Date Night', 'でーとの よる'),
    audience: 'cheeky',
    scenes: [
      {
        id: 'date.1',
        bg: 'restaurant',
        char: 'dater',
        who: jp('デートの あいて', 'the date', 'でーとの あいて'),
        setup: 'A fancy restaurant. He has practised this line all week.',
        lines: lines(jp('きれいだね', 'You look lovely'), jp('きょうの ふく、とても きれい ですね。', 'Your outfit is really lovely today.'), jp('きょうの ために、あたらしい ふくを かいました。', 'I bought new clothes for today. (ために)')),
      },
      {
        id: 'date.2',
        bg: 'restaurant',
        char: 'dater',
        who: jp('デートの あいて', 'the date', 'でーとの あいて'),
        setup: 'His phone rings. It’s his mum. Again.',
        lines: lines(jp('もしもし？', 'Hello?'), jp('もしもし、おかあさん？ いま、いそがしい です！', 'Hello, Mum? I’m busy right now!'), jp('おかあさん、デートちゅうに でんわ しないでって いったのに！', 'Mum, I told you not to call during my date! (〜って, のに)', 'おかあさん、でーとちゅうに でんわ しないでって いったのに！')),
      },
      {
        id: 'date.3',
        bg: 'restaurant',
        char: 'dater',
        who: jp('デートの あいて', 'the date', 'でーとの あいて'),
        setup: 'The bill arrives. He pats every pocket.',
        lines: lines(jp('さいふが…', 'My wallet…'), jp('あ… さいふが ありません。', 'Ah… I don’t have my wallet.'), jp('ごめん、さいふを いえに わすれて きちゃった。', 'Sorry, I left my wallet at home. (〜てくる, 〜ちゃう)')),
      },
    ],
  },
  {
    // From her side of the table (Ladi: Cheeky jokes from women's perspective too).
    id: 'girlsnight',
    title: jp('じょしかい', 'Girls’ Night'),
    audience: 'cheeky',
    scenes: [
      {
        id: 'girlsnight.1',
        bg: 'izakaya',
        char: 'ol',
        who: jp('かのじょ', 'her'),
        setup: 'Girls’ night. She holds up her phone: his reply to her long message.',
        lines: lines(jp('おやすみ だけ？', 'Just “good night”?'), jp('みて！ かれの へんじ、「おやすみ」だけ です。', 'Look! His reply is just “good night”.'), jp('みて！ かれ、「おやすみ」しか かいて こないの。', 'Look! He never writes anything but “good night”. (しか〜ない)')),
      },
      {
        id: 'girlsnight.2',
        bg: 'izakaya',
        char: 'ol',
        who: jp('かのじょ', 'her'),
        setup: 'Her friends ask about the first date. She swipes to his dating-app photo.',
        lines: lines(jp('しゃしんと ちがう！', 'Not like his photo!'), jp('かれ、しゃしんと ぜんぜん ちがいました。', 'He looked nothing like his photo.'), jp('しゃしんより じゅっさい ぐらい うえに みえたの。', 'He looked about ten years older than his photo. (より, 〜に みえる)')),
      },
      {
        id: 'girlsnight.3',
        bg: 'izakaya',
        char: 'ol',
        who: jp('かのじょ', 'her'),
        setup: 'Her phone rings. It’s him. Her friends go quiet.',
        lines: lines(jp('わたしも あいたい！', 'I miss you too!'), jp('もしもし？ うん、わたしも あいたい です！', 'Hello? Yes, I miss you too!'), jp('もしもし？ ちょうど あなたの こと、かんがえて いたの！', 'Hello? I was just thinking about you! (〜ていた)')),
      },
    ],
  },
  {
    // A really cheap idol (Ladi): perfect on stage, perfect at the handshake, not perfect backstage.
    id: 'idol',
    title: jp('アイドルの うらがわ', 'Idol, Backstage', 'あいどるの うらがわ'),
    audience: 'cheeky',
    scenes: [
      {
        id: 'idol.1',
        bg: 'concert',
        char: 'idol',
        who: jp('アイドル', 'the idol', 'あいどる'),
        setup: 'Her first big concert. Twelve fans, one glow stick each.',
        lines: lines(jp('みんな だいすき！', 'I love you all!'), jp('みなさん、きょうは ありがとう！ だいすき です！', 'Thank you all for today! I love you!'), jp('みんなの おかげで、ここまで これたよ！', 'Thanks to all of you, I made it this far! (おかげで, 〜られる)')),
      },
      {
        id: 'idol.2',
        bg: 'concert',
        char: 'idol',
        who: jp('アイドル', 'the idol', 'あいどる'),
        setup: 'The handshake event. This fan queued six hours to propose.',
        lines: lines(jp('つぎの かた どうぞ', 'Next, please'), jp('うれしい！ …はい、つぎの かた どうぞ。', 'I’m so happy! …OK, next please.'), jp('ずっと まって いて くれたの？ …はい、つぎの かた。', 'You waited all this time for me? …OK, next. (〜てくれる)')),
      },
      {
        id: 'idol.3',
        bg: 'studio',
        char: 'idol',
        who: jp('アイドル', 'the idol', 'あいどる'),
        setup: 'Backstage. The door shuts. The smile drops.',
        lines: lines(jp('あー、つかれた', 'Ugh, I’m wiped'), jp('あー、つかれた。ラーメン たべたい。', 'Ugh, I’m wiped. I want ramen.', 'あー、つかれた。らーめん たべたい。'), jp('あー、わらいすぎて かおが いたい。', 'Ugh, my face hurts from smiling so much. (〜すぎる)')),
      },
    ],
  },
];

/** The episodes a room can play: Kids gets the all-ages and kids ones, Family adds family, Cheeky prefers its own. */
export function episodesFor(audience: Audience): Episode[] {
  if (audience === 'kids') return EPISODES.filter((e) => !e.audience || e.audience === 'kids');
  if (audience === 'cheeky') return EPISODES.filter((e) => e.audience === 'cheeky' || e.audience === 'family');
  return EPISODES.filter((e) => !e.audience || e.audience === 'family');
}

export function directionsFor(audience: Audience): Direction[] {
  return DIRECTIONS.filter((d) => !d.audience || d.audience === audience);
}

/** How long a take may record: 6 s, or about 0.45 s a mora for long lines, half as long again for slow cards; 12 s at most. */
export function takeLimitMs(kana: string, slow: boolean): number {
  const morae = [...kana.replace(/[\s、。！？!?…・「」]/g, '')].filter((c) => !/[ゃゅょぁぃぅぇぉゎャュョァィゥェォヮ]/.test(c)).length;
  return Math.min(12_000, Math.round(Math.max(6_000, morae * 450) * (slow ? 1.5 : 1)));
}

export const directionOf = (id: string): Direction | undefined => DIRECTIONS.find((d) => d.id === id);
export const episodeOf = (id: string): Episode | undefined => EPISODES.find((e) => e.id === id);
