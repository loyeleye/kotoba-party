// PLACEHOLDER CONTENT. A tiny built-in pack so Oogiri Night still runs end to end when the
// content library has no packs or prompts (tests, a broken content build). Not fluent-checked;
// real games use the content thread's packs (content/src/packs, content/src/oogiri).

import type { OogiriPrompt, SetPhraseTile, TopicPack } from '../../../../content/src/types.js';

export const FALLBACK_PACK: TopicPack = {
  id: 'oogiri-placeholder',
  title: { text: 'おためし', kana: 'おためし', en: 'Placeholder' },
  blurb: 'Built-in placeholder words, used only when no topic pack is loaded.',
  status: 'draft',
  baselineWordIds: [],
  phrases: [],
  words: [
    { id: 'ph.neko', jp: { text: 'ねこ', kana: 'ねこ', en: 'a cat' }, pos: 'noun', level: 'kana' },
    { id: 'ph.inu', jp: { text: 'いぬ', kana: 'いぬ', en: 'a dog' }, pos: 'noun', level: 'kana' },
    { id: 'ph.sushi', jp: { text: 'すし', kana: 'すし', en: 'sushi' }, pos: 'noun', level: 'kana' },
    { id: 'ph.ramen', jp: { text: 'ラーメン', kana: 'ラーメン', en: 'ramen' }, pos: 'noun', level: 'kana' },
    { id: 'ph.pan', jp: { text: 'パン', kana: 'パン', en: 'bread' }, pos: 'noun', level: 'kana' },
    { id: 'ph.kasa', jp: { text: 'かさ', kana: 'かさ', en: 'an umbrella' }, pos: 'noun', level: 'kana' },
    { id: 'ph.mizu', jp: { text: '水', kana: 'みず', en: 'water', furigana: [['水', 'みず']] }, pos: 'noun', level: 'kana' },
    { id: 'ph.kuruma', jp: { text: 'くるま', kana: 'くるま', en: 'a car' }, pos: 'noun', level: 'kana' },
    { id: 'ph.sensei', jp: { text: '先生', kana: 'せんせい', en: 'the teacher', furigana: [['先生', 'せんせい']] }, pos: 'noun', level: 'n5' },
    { id: 'ph.tomodachi', jp: { text: 'ともだち', kana: 'ともだち', en: 'a friend' }, pos: 'noun', level: 'n5' },
    { id: 'ph.robot', jp: { text: 'ロボット', kana: 'ロボット', en: 'a robot' }, pos: 'noun', level: 'kana', swerve: true },
    { id: 'ph.giant-octopus', jp: { text: '大きな タコ', kana: 'おおきな タコ', en: 'a giant octopus', furigana: [['大', 'おお'], ['きな タコ', '']] }, pos: 'noun', level: 'n5', swerve: true },
    { id: 'ph.old-sock', jp: { text: 'ふるい くつした', kana: 'ふるい くつした', en: 'an old sock' }, pos: 'noun', level: 'n5', swerve: true },
    { id: 'ph.ghost', jp: { text: 'おばけ', kana: 'おばけ', en: 'a ghost' }, pos: 'noun', level: 'kana', swerve: true },
    { id: 'ph.dancing-tofu', jp: { text: 'おどる とうふ', kana: 'おどる とうふ', en: 'dancing tofu' }, pos: 'noun', level: 'n5', swerve: true },
    { id: 'ph.ninja', jp: { text: 'にんじゃ', kana: 'にんじゃ', en: 'a ninja' }, pos: 'noun', level: 'kana', swerve: true, stereotype: true },
    {
      id: 'ph.taberu',
      jp: { text: '食べる', kana: 'たべる', en: 'to eat', furigana: [['食', 'た'], ['べる', '']] },
      pos: 'verb-ru',
      level: 'n5',
      forms: {
        masu: { text: '食べます', kana: 'たべます', en: 'eat' },
        mashita: { text: '食べました', kana: 'たべました', en: 'ate' },
        masen: { text: '食べません', kana: 'たべません', en: "don't eat" },
        tai: { text: '食べたい', kana: 'たべたい', en: 'want to eat' },
        'te-kudasai': { text: '食べて ください', kana: 'たべて ください', en: 'please eat' },
      },
    },
    {
      id: 'ph.neru',
      jp: { text: 'ねる', kana: 'ねる', en: 'to sleep' },
      pos: 'verb-ru',
      level: 'n5',
      forms: {
        masu: { text: 'ねます', kana: 'ねます', en: 'sleep' },
        mashita: { text: 'ねました', kana: 'ねました', en: 'slept' },
        masen: { text: 'ねません', kana: 'ねません', en: "don't sleep" },
        tai: { text: 'ねたい', kana: 'ねたい', en: 'want to sleep' },
        'te-kudasai': { text: 'ねて ください', kana: 'ねて ください', en: 'please sleep' },
      },
    },
    {
      id: 'ph.utau',
      jp: { text: 'うたう', kana: 'うたう', en: 'to sing' },
      pos: 'verb-u',
      level: 'n5',
      forms: {
        masu: { text: 'うたいます', kana: 'うたいます', en: 'sing' },
        mashita: { text: 'うたいました', kana: 'うたいました', en: 'sang' },
        masen: { text: 'うたいません', kana: 'うたいません', en: "don't sing" },
        tai: { text: 'うたいたい', kana: 'うたいたい', en: 'want to sing' },
      },
    },
    {
      id: 'ph.ookii',
      jp: { text: '大きい', kana: 'おおきい', en: 'big', furigana: [['大', 'おお'], ['きい', '']] },
      pos: 'adj-i',
      level: 'n5',
      forms: {
        past: { text: '大きかったです', kana: 'おおきかったです', en: 'was big' },
        negative: { text: '大きくないです', kana: 'おおきくないです', en: "isn't big" },
      },
    },
  ],
};

const jp = (text: string, kana: string, en: string) => ({ text, kana, en });

export const FALLBACK_PROMPTS: OogiriPrompt[] = [
  {
    id: 'ph.oogiri.cat-job',
    packId: FALLBACK_PACK.id,
    round: 'head-to-head',
    versions: {
      kana: jp('ねこの ひみつの しごとは ＿＿＿です。', 'ねこの ひみつの しごとは ＿＿＿です。', "The cat's secret job is ___."),
      n5: jp('ねこの ひみつの しごとは ＿＿＿です。', 'ねこの ひみつの しごとは ＿＿＿です。', "The cat's secret job is ___."),
    },
    fitTileIds: ['ph.sensei', 'ph.sushi', 'ph.ramen'],
    swerveTileIds: ['ph.robot', 'ph.ninja', 'ph.dancing-tofu'],
    exampleAnswer: jp('ねこの ひみつの しごとは すしやです。', 'ねこの ひみつの しごとは すしやです。', "The cat's secret job is running a sushi bar."),
    pattern: 'A の B: の links two nouns, like ’s.',
  },
  {
    id: 'ph.oogiri.fridge',
    packId: FALLBACK_PACK.id,
    round: 'head-to-head',
    versions: {
      kana: jp('れいぞうこに ＿＿＿が あります。', 'れいぞうこに ＿＿＿が あります。', 'In the fridge, there is ___.'),
      n5: jp('れいぞうこの 中に ＿＿＿が あります。', 'れいぞうこの なかに ＿＿＿が あります。', 'In the fridge, there is ___.'),
    },
    fitTileIds: ['ph.pan', 'ph.mizu', 'ph.sushi'],
    swerveTileIds: ['ph.old-sock', 'ph.kasa', 'ph.kuruma'],
    exampleAnswer: jp('れいぞうこの 中に ふるい くつしたが あります。', 'れいぞうこの なかに ふるい くつしたが あります。', 'In the fridge, there is an old sock.'),
    pattern: 'に … が あります: something is at a place.',
  },
  {
    id: 'ph.oogiri.teacher-every-day',
    packId: FALLBACK_PACK.id,
    round: 'head-to-head',
    versions: {
      kana: jp('せんせいは まいにち ＿＿＿。', 'せんせいは まいにち ＿＿＿。', 'Every day, the teacher ___.'),
      n5: jp('先生は 毎日 ＿＿＿。', 'せんせいは まいにち ＿＿＿。', 'Every day, the teacher ___.'),
    },
    fitTileIds: ['ph.taberu', 'ph.neru', 'ph.utau'],
    swerveTileIds: ['ph.ghost', 'ph.robot', 'ph.giant-octopus'],
    exampleAnswer: jp('先生は 毎日 三時間 うたいます。', 'せんせいは まいにち さんじかん うたいます。', 'Every day, the teacher sings for three hours.'),
    pattern: '毎日 + ます-form: the ます form also describes habits.',
  },
  {
    id: 'ph.oogiri.dog-loves',
    packId: FALLBACK_PACK.id,
    round: 'head-to-head',
    versions: {
      kana: jp('うちの いぬは ＿＿＿が だいすきです。', 'うちの いぬは ＿＿＿が だいすきです。', 'Our dog loves ___.'),
      n5: jp('うちの 犬は ＿＿＿が 大好きです。', 'うちの いぬは ＿＿＿が だいすきです。', 'Our dog loves ___.'),
    },
    fitTileIds: ['ph.pan', 'ph.tomodachi', 'ph.kuruma'],
    swerveTileIds: ['ph.ghost', 'ph.dancing-tofu', 'ph.old-sock'],
    exampleAnswer: jp('うちの 犬は おどる とうふが 大好きです。', 'うちの いぬは おどる とうふが だいすきです。', 'Our dog loves dancing tofu.'),
    pattern: 'N が 大好きです: が marks the thing you love.',
  },
  {
    id: 'ph.oogiri.photo-cat-umbrella',
    packId: FALLBACK_PACK.id,
    round: 'photo-caption',
    versions: {
      kana: jp('ねこ：「＿＿＿。」', 'ねこ：「＿＿＿。」', 'Cat: "___."'),
      n5: jp('ねこ：「＿＿＿。」', 'ねこ：「＿＿＿。」', 'Cat: "___."'),
    },
    photo: 'A soaking-wet cat sitting under a tiny umbrella at a bus stop, glaring at the camera.',
    fitTileIds: ['ph.kasa', 'ph.mizu', 'ph.neru'],
    swerveTileIds: ['ph.robot', 'ph.giant-octopus', 'ph.ramen'],
    exampleAnswer: jp('ねこ：「かさを ください。」', 'ねこ：「かさを ください。」', 'Cat: "An umbrella, please."'),
    pattern: 'N を ください: asking for something.',
  },
  {
    id: 'ph.oogiri.photo-robot-chef',
    packId: FALLBACK_PACK.id,
    round: 'photo-caption',
    versions: {
      kana: jp('ロボット：「＿＿＿。」', 'ロボット：「＿＿＿。」', 'Robot: "___."'),
      n5: jp('ロボット：「＿＿＿。」', 'ロボット：「＿＿＿。」', 'Robot: "___."'),
    },
    photo: 'A clunky robot in a chef’s hat proudly holding up a burnt loaf of bread, smoke everywhere.',
    fitTileIds: ['ph.pan', 'ph.taberu', 'ph.ookii'],
    swerveTileIds: ['ph.old-sock', 'ph.ghost', 'ph.dancing-tofu'],
    exampleAnswer: jp('ロボット：「どうぞ、食べて ください。」', 'ロボット：「どうぞ、たべて ください。」', 'Robot: "Here you go, please eat."'),
    pattern: '〜て ください: please do.',
  },
  {
    id: 'ph.oogiri.ippon-ghost',
    packId: FALLBACK_PACK.id,
    round: 'ippon',
    versions: {
      kana: jp('おばけの すきな たべものは ＿＿＿です。', 'おばけの すきな たべものは ＿＿＿です。', "A ghost's favourite food is ___."),
      n5: jp('おばけの 好きな 食べものは ＿＿＿です。', 'おばけの すきな たべものは ＿＿＿です。', "A ghost's favourite food is ___."),
    },
    fitTileIds: ['ph.sushi', 'ph.ramen', 'ph.pan'],
    swerveTileIds: ['ph.old-sock', 'ph.kuruma', 'ph.sensei'],
    exampleAnswer: jp('おばけの 好きな 食べものは 先生の パンです。', 'おばけの すきな たべものは せんせいの パンです。', "A ghost's favourite food is the teacher's bread."),
    pattern: '好きな N: a な-adjective takes な before a noun.',
  },
];

export const FALLBACK_SET_PHRASES: SetPhraseTile[] = [
  { id: 'ph.kudasai', frame: jp('＿＿＿を ください！', '＿＿＿を ください！', '___, please!'), level: 'kana', slot: 'noun', pattern: 'N を ください: asking for a thing.' },
  { id: 'ph.tai', frame: jp('＿＿＿たい！', '＿＿＿たい！', 'I want to ___!'), level: 'n5', slot: 'verb-stem', pattern: 'Verb stem + たい: "want to".' },
  { id: 'ph.te-kudasai', frame: jp('＿＿＿ください！', '＿＿＿ください！', 'Please ___!'), level: 'n5', slot: 'verb-te', pattern: 'Verb て-form + ください: please do.' },
];
