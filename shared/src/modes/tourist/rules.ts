// Who's the Tourist? in the Green Car: the rules deck (docs/modes/tourist.md, "Green Car"). Every place has its
// rules and habits, and in the Green Car the questions and answers are about them: what you're supposed to do here
// (＿ことに なって いる), what you should do (＿べき), what's fine (＿ても かまわない), what it isn't (＿わけでは ない),
// all N3 (goal 3.7); may and mustn't (＿ても いいですか, ＿ては いけない, goal 4.2), can (the potential, 4.4) and
// why (purpose ＿ために / ＿ように, and ＿と いって いました, goal 4.14) at N4.
//
// Three kinds of line, all draft, all Green Car only (`greenCar`), each tagged with its frames:
// - generic questions and answers any place can take (the tourist's safe ones too), and two N3 bluffs;
// - each of the twelve places' own rules (one question, three or four answers);
// - four places of their own: the aquarium (every room, a Kids place with the school), and the izakaya, the
//   karaoke box and the office year-end party (Cheeky rooms only).

import type { JpText, Level } from '../../../../content/src/types.js';
import { place, type Kind, type Line, type Place, type Row } from './places.js';

const t = (text: string, kana: string, en: string): JpText => ({ text, kana, en });
const k = (kana: string, en: string): JpText => ({ text: kana, kana, en });

/** A Green Car line: draft, Green Car only, tagged with its frames. */
const g = (id: string, level: 'n4' | 'n3', kind: Kind, jp: JpText, frames: string[]): Line => ({ id: `tourist.gc.${id}`, level, kind, jp, frames, status: 'draft', greenCar: true });

// ---- generic questions (any place) ----

export const GREEN_QUESTIONS: readonly Line[] = [
  // N3: the rule here, what you should do, what's all right (3.7)
  g('q.kimari', 'n3', 'what', t('ここでは 何を する ことに なって いますか。', 'ここでは なにを する ことに なって いますか。', 'What are you supposed to do here?'), ['koto-ni-natteiru']),
  g('q.ki-wo-tsukeru', 'n3', 'what', t('ここでは 何に 気を つけるべきですか。', 'ここでは なにに きを つけるべきですか。', 'What should you be careful about here?'), ['beki']),
  g('q.kiru-beki', 'n3', 'what', t('ここには 何を 着て 行くべきですか。', 'ここには なにを きて いくべきですか。', 'What should you wear to go here?'), ['beki']),
  g('q.koe', 'n3', 'yesno', t('ここで 大きい 声で 話しても かまいませんか。', 'ここで おおきい こえで はなしても かまいませんか。', 'Is it all right to talk loudly here?'), ['temo-kamawanai']),
  g('q.hitori', 'n3', 'yesno', t('一人で 来ても かまいませんか。', 'ひとりで きても かまいませんか。', 'Is it all right to come on your own?'), ['temo-kamawanai']),
  // N4: mustn't (4.2), why (purpose, 4.14)
  g('q.denwa', 'n4', 'yesno', t('ここで 電話を しては いけませんか。', 'ここで でんわを しては いけませんか。', "Aren't you allowed to make phone calls here?"), ['te-wa-ikenai']),
  g('q.nan-no-tame', 'n4', 'what', t('みんな 何の ために ここに 来るんですか。', 'みんな なんの ために ここに くるんですか。', 'What do people come here for?'), ['tame-ni']),
  g('q.okurenai', 'n4', 'when', t('おくれない ように、何時に 出たら いいですか。', 'おくれない ように、なんじに でたら いいですか。', "What time should I leave so I'm not late?"), ['you-ni']),
];

// ---- generic answers (any place: safe for the tourist) ----

export const GREEN_ANSWERS: readonly Line[] = [
  g('a.kimari', 'n3', 'yesno', k('はい、そう する ことに なって います。', "Yes, that's the rule."), ['koto-ni-natteiru']),
  g('a.mamoru-beki', 'n3', 'what', k('ここの ルールは まもるべきですね。', 'You really should keep to the rules here.'), ['beki']),
  g('a.kamawanai', 'n3', 'yesno', k('ええ、そう しても かまいませんよ。', "Sure, that's fine."), ['temo-kamawanai']),
  g('a.dame-wake', 'n3', 'yesno', k('だめな わけでは ありませんが…', "It's not that you can't, but…"), ['wake-dewa-nai']),
  g('a.minna-wake', 'n3', 'how', k('みんなが そう する わけでは ありません。', 'Not everyone does that.'), ['wake-dewa-nai']),
  g('a.itsu-kamawanai', 'n3', 'when', t('いつ 来ても かまいませんよ。', 'いつ きても かまいませんよ。', 'You can come whenever you like.'), ['temo-kamawanai']),
  g('a.dare-kamawanai', 'n3', 'who', t('だれと 来ても かまいません。', 'だれと きても かまいません。', 'You can come with anyone.'), ['temo-kamawanai']),
  g('a.suki-wake', 'n3', 'like', k('とくに すきな わけでは ありません。', "It's not that I especially like it."), ['wake-dewa-nai']),
  g('a.doko-wake', 'n3', 'where', k('どこにでも ある わけでは ありません。', "They're not just anywhere."), ['wake-dewa-nai']),
  g('a.kimochi', 'n4', 'what', t('みんなが 気持ちよく すごせる ように、しずかに します。', 'みんなが きもちよく すごせる ように、しずかに します。', 'You keep quiet, so everyone can have a nice time.'), ['you-ni']),
  g('a.kega', 'n4', 'what', t('けがを しない ために、走っては いけません。', 'けがを しない ために、はしっては いけません。', "So nobody gets hurt, you mustn't run."), ['tame-ni', 'te-wa-ikenai']),
  g('a.itte-ita', 'n4', 'yesno', t('お店の 人が だめだと 言って いました。', 'おみせの ひとが だめだと いって いました。', "The staff said you can't."), ['to-itte-ita']),
];

/** The tourist's Green Car bluffs (with the N4 one from BLUFFS). */
export const GREEN_BLUFFS: readonly Line[] = [
  { id: 'tourist.gc.bluff.wake', level: 'n3', kind: 'any', jp: k('そう いう わけでは ないんですけど…', "It's not quite like that, but…"), frames: ['wake-dewa-nai'], status: 'draft', greenCar: true },
  { id: 'tourist.gc.bluff.kimari', level: 'n3', kind: 'any', jp: k('ここでは そう いう ことに なって いるんです。', "That's just how it's done here."), frames: ['koto-ni-natteiru'], status: 'draft', greenCar: true },
];

// ---- each place's own rules ----

/** A place's Green Car lines, as rows: level, kind, Japanese, frames. */
type GreenRows = { questions: Row[]; answers: Row[] };

const RULES: Record<string, GreenRows> = {
  konbini: {
    questions: [['n3', 'yesno', t('お店の 前で 食べても かまいませんか。', 'おみせの まえで たべても かまいませんか。', 'Is it all right to eat in front of the shop?'), ['temo-kamawanai']]],
    answers: [
      ['n3', 'what', t('ゴミは 分けて すてる ことに なって います。', 'ゴミは わけて すてる ことに なって います。', "You're supposed to sort your rubbish."), ['koto-ni-natteiru']],
      ['n3', 'yesno', t('入り口の 前に すわるべきでは ありませんね。', 'いりぐちの まえに すわるべきでは ありませんね。', "You really shouldn't sit in front of the door."), ['beki']],
      ['n4', 'when', t('夜中でも 買い物が できる ように、ずっと あいて います。', 'よなかでも かいものが できる ように、ずっと あいて います。', "It's open all the time, so you can shop even at midnight."), ['you-ni']],
    ],
  },
  restaurant: {
    questions: [['n3', 'yesno', k('よやく するべきですか。', 'Should you book?'), ['beki']]],
    answers: [
      ['n3', 'yesno', t('はい、週末は よやく するべきです。', 'はい、しゅうまつは よやく するべきです。', 'Yes, at weekends you should book.'), ['beki']],
      ['n3', 'what', k('ぜんぶ たべなくても かまいません。', "You don't have to finish it all."), ['temo-kamawanai']],
      ['n4', 'yesno', t('いいえ、お店の 中で 走っては いけません。', 'いいえ、おみせの なかで はしっては いけません。', "No, you mustn't run inside."), ['te-wa-ikenai']],
    ],
  },
  ramen: {
    questions: [['n3', 'yesno', t('音を 立てて 食べても かまいませんか。', 'おとを たてて たべても かまいませんか。', 'Is it all right to slurp?'), ['temo-kamawanai']]],
    answers: [
      ['n3', 'yesno', t('ええ、すすって 食べても かまいませんよ。', 'ええ、すすって たべても かまいませんよ。', 'Sure, you can slurp.'), ['temo-kamawanai']],
      ['n3', 'what', t('食べたら すぐ 出る ことに なって います。', 'たべたら すぐ でる ことに なって います。', "You're supposed to leave as soon as you've eaten."), ['koto-ni-natteiru']],
      ['n4', 'how', t('おいしく 食べられる ように、すぐ 食べます。', 'おいしく たべられる ように、すぐ たべます。', 'You eat it straight away, so it tastes its best.'), ['you-ni']],
    ],
  },
  supermarket: {
    questions: [['n3', 'yesno', t('ふくろは 自分で 持って 来るべきですか。', 'ふくろは じぶんで もって くるべきですか。', 'Should you bring your own bag?'), ['beki']]],
    answers: [
      ['n3', 'yesno', t('はい、ふくろは 自分で 持って 来る ことに なって います。', 'はい、ふくろは じぶんで もって くる ことに なって います。', "Yes, you're supposed to bring your own."), ['koto-ni-natteiru']],
      ['n3', 'how', t('いつも 安い わけでは ありません。', 'いつも やすい わけでは ありません。', "It's not always cheap."), ['wake-dewa-nai']],
      ['n4', 'when', t('安く 買える ように、夜 行きます。', 'やすく かえる ように、よる いきます。', 'I go at night, so I can buy things cheap.'), ['you-ni']],
    ],
  },
  eki: {
    questions: [['n3', 'yesno', t('電車の 中で 電話しても かまいませんか。', 'でんしゃの なかで でんわしても かまいませんか。', 'Is it all right to make calls on the train?'), ['temo-kamawanai']]],
    answers: [
      ['n3', 'yesno', t('いいえ、電車の 中では 電話しない ことに なって います。', 'いいえ、でんしゃの なかでは でんわしない ことに なって います。', "No, you're not supposed to make calls on the train."), ['koto-ni-natteiru']],
      ['n3', 'who', t('お年よりには せきを ゆずるべきです。', 'おとしよりには せきを ゆずるべきです。', 'You should give your seat up to older people.'), ['beki']],
      ['n4', 'when', t('おくれない ように、早めに 来ます。', 'おくれない ように、はやめに きます。', "I come early, so I'm not late."), ['you-ni']],
    ],
  },
  onsen: {
    questions: [['n3', 'what', t('お湯に 入る 前に、何を するべきですか。', 'おゆに はいる まえに、なにを するべきですか。', 'What should you do before you get in the water?'), ['beki']]],
    answers: [
      ['n3', 'what', t('入る 前に 体を あらう ことに なって います。', 'はいる まえに からだを あらう ことに なって います。', "You're supposed to wash before you get in."), ['koto-ni-natteiru']],
      ['n4', 'yesno', t('タオルを お湯に 入れては いけません。', 'タオルを おゆに いれては いけません。', "You mustn't put your towel in the water."), ['te-wa-ikenai']],
      ['n4', 'what', t('お湯を きれいに 使う ために、体を あらいます。', 'おゆを きれいに つかう ために、からだを あらいます。', 'You wash, to keep the water clean.'), ['tame-ni']],
    ],
  },
  kuukou: {
    questions: [['n3', 'yesno', t('水を 持って 入っても かまいませんか。', 'みずを もって はいっても かまいませんか。', 'Is it all right to take water through?'), ['temo-kamawanai']]],
    answers: [
      ['n3', 'yesno', t('いいえ、水は すてる ことに なって います。', 'いいえ、みずは すてる ことに なって います。', "No, you're supposed to throw it away."), ['koto-ni-natteiru']],
      ['n3', 'how', k('いつも こんで いる わけでは ありません。', "It isn't always crowded."), ['wake-dewa-nai']],
      ['n4', 'when', t('ひこうきに おくれない ように、早く 来ます。', 'ひこうきに おくれない ように、はやく きます。', "I come early, so I don't miss the plane."), ['you-ni']],
    ],
  },
  hotel: {
    questions: [['n3', 'when', t('チェックアウトは 何時に する ことに なって いますか。', 'チェックアウトは なんじに する ことに なって いますか。', 'What time are you supposed to check out?'), ['koto-ni-natteiru']]],
    answers: [
      ['n3', 'when', t('十一時までに 出る ことに なって います。', 'じゅういちじまでに でる ことに なって います。', "You're supposed to be out by eleven."), ['koto-ni-natteiru']],
      ['n3', 'yesno', t('へやで 食べても かまいませんよ。', 'へやで たべても かまいませんよ。', "It's fine to eat in your room."), ['temo-kamawanai']],
      ['n4', 'what', t('ゆっくり ねられる ように、しずかに します。', 'ゆっくり ねられる ように、しずかに します。', 'You keep quiet, so people can sleep.'), ['you-ni']],
    ],
  },
  // The school: a Kids place (Kids, Family and Cheeky, Kids rooms see it first).
  gakkou: {
    questions: [['n3', 'yesno', t('ろうかを 走っても かまいませんか。', 'ろうかを はしっても かまいませんか。', 'Is it all right to run in the corridor?'), ['temo-kamawanai']]],
    answers: [
      ['n3', 'yesno', t('いいえ、ろうかは 歩く ことに なって います。', 'いいえ、ろうかは あるく ことに なって います。', "No, you're supposed to walk in the corridor."), ['koto-ni-natteiru']],
      ['n3', 'who', t('先生には ていねいに 話すべきです。', 'せんせいには ていねいに はなすべきです。', 'You should talk politely to the teachers.'), ['beki']],
      ['n4', 'yesno', k('じゅぎょうちゅうに スマホを つかっては いけません。', "You mustn't use your phone in class."), ['te-wa-ikenai']],
      ['n4', 'what', t('けがを しない ように、ろうかは 歩きます。', 'けがを しない ように、ろうかは あるきます。', 'You walk in the corridor, so nobody gets hurt.'), ['you-ni']],
    ],
  },
  kouen: {
    questions: [['n3', 'yesno', t('しばふに 入っても かまいませんか。', 'しばふに はいっても かまいませんか。', 'Is it all right to go on the grass?'), ['temo-kamawanai']]],
    answers: [
      ['n3', 'what', k('ボールあそびは しない ことに なって います。', "You're not supposed to play ball games."), ['koto-ni-natteiru']],
      ['n3', 'what', t('ゴミは 持って かえるべきです。', 'ゴミは もって かえるべきです。', 'You should take your rubbish home.'), ['beki']],
      ['n4', 'yesno', t('ここで 花を とっては いけません。', 'ここで はなを とっては いけません。', "You mustn't pick the flowers here."), ['te-wa-ikenai']],
    ],
  },
  ie: {
    questions: [['n3', 'what', t('ごはんの 前に 何を する ことに なって いますか。', 'ごはんの まえに なにを する ことに なって いますか。', 'What are you supposed to do before a meal?'), ['koto-ni-natteiru']]],
    answers: [
      ['n3', 'what', t('ごはんの 前に 手を あらう ことに なって います。', 'ごはんの まえに てを あらう ことに なって います。', "You're supposed to wash your hands before a meal."), ['koto-ni-natteiru']],
      ['n3', 'yesno', k('くつは ぬぐべきです。', 'You should take your shoes off.'), ['beki']],
      ['n4', 'what', k('たたみが よごれない ように、くつを ぬぎます。', "You take your shoes off, so the tatami doesn't get dirty."), ['you-ni']],
    ],
  },
  byouin: {
    questions: [['n3', 'yesno', t('まちあいしつで 電話を しても かまいませんか。', 'まちあいしつで でんわを しても かまいませんか。', 'Is it all right to make calls in the waiting room?'), ['temo-kamawanai']]],
    answers: [
      ['n3', 'yesno', t('いいえ、電話は 外で する ことに なって います。', 'いいえ、でんわは そとで する ことに なって います。', "No, you're supposed to make calls outside."), ['koto-ni-natteiru']],
      ['n3', 'when', t('早めに 来るべきです。', 'はやめに くるべきです。', 'You should come early.'), ['beki']],
      ['n4', 'what', t('病気が うつらない ように、マスクを します。', 'びょうきが うつらない ように、マスクを します。', "You wear a mask, so you don't catch anything."), ['you-ni']],
    ],
  },
};

/** The rows as lines, with ids like the places' own (`tourist.gc.<place>.q.<kind>.<level>`). */
function linesOf(placeId: string, part: 'q' | 'a', rows: readonly Row[]): Line[] {
  const count = new Map<string, number>();
  return rows.map(([level, kind, jp, frames]) => {
    const base = `tourist.gc.${placeId}.${part}.${kind}.${level}`;
    const n = (count.get(base) ?? 0) + 1;
    count.set(base, n);
    return { id: n === 1 ? base : `${base}.${n}`, level, kind, jp, frames: frames ?? [], status: 'draft', greenCar: true };
  });
}

/** Each of the twelve places' own Green Car questions and answers. */
export const GREEN_PLACE_LINES: Readonly<Record<string, { questions: readonly Line[]; answers: readonly Line[] }>> = Object.fromEntries(
  Object.entries(RULES).map(([id, r]) => [id, { questions: linesOf(id, 'q', r.questions), answers: linesOf(id, 'a', r.answers) }]),
);

// ---- the Green Car's own places ----

/** A Green Car place: N4/N3 lines only (the Green Car has no Kana or N5 tiles), Green Car only. */
const greenPlace = (d: Parameters<typeof place>[0], audiences?: Place['audiences']): Place => {
  const p = place(d);
  const mark = (l: Line): Line => ({ ...l, status: 'draft', greenCar: true });
  return { ...p, questions: p.questions.map(mark), answers: p.answers.map(mark), greenCar: true, ...(audiences ? { audiences } : {}) };
};

const R = (level: Level, kind: Kind, jp: JpText, frames: string[]): Row => [level, kind, jp, frames];

export const GREEN_PLACES: readonly Place[] = [
  // Every room (a Kids place, with the school).
  greenPlace({
    id: 'suizokukan',
    packId: 'family',
    emoji: '🐠',
    name: { text: '水族館', kana: 'すいぞくかん', en: 'aquarium', furigana: [['水族館', 'すいぞくかん']] },
    roles: [k('いるかの トレーナー', 'the dolphin trainer'), k('しいくいん', 'the keeper'), k('ペンギン', 'a penguin'), k('えんそくの こども', 'a kid on a school trip'), k('おみやげやさん', 'the gift-shop clerk')],
    questions: [
      R('n3', 'yesno', k('フラッシュで しゃしんを とっても かまいませんか。', 'Is it all right to take photos with the flash?'), ['temo-kamawanai']),
      R('n4', 'yesno', k('さかなに さわっても いいですか。', 'May I touch the fish?'), ['te-mo-ii']),
      R('n4', 'when', t('イルカショーは 何時から 見られますか。', 'イルカショーは なんじから みられますか。', 'What time can you see the dolphin show?'), ['potential']),
    ],
    answers: [
      R('n3', 'yesno', k('いいえ、フラッシュは つかわない ことに なって います。', "No, you're not supposed to use the flash."), ['koto-ni-natteiru']),
      R('n3', 'what', k('ガラスを たたくべきでは ありません。', "You really shouldn't bang on the glass."), ['beki']),
      R('n3', 'like', k('さかなが とくに すきな わけでは ありませんが、きれいです。', "It's not that I love fish, but it's beautiful."), ['wake-dewa-nai']),
      R('n4', 'yesno', k('さかなに えさを やっては いけません。', "You mustn't feed the fish."), ['te-wa-ikenai']),
      R('n4', 'what', k('さかなが びっくりしない ように、しずかに 見ます。', "You watch quietly, so the fish don't get a fright."), ['you-ni']),
      R('n4', 'when', t('イルカショーは 毎日 見られますよ。', 'イルカショーは まいにち みられますよ。', 'You can see the dolphin show every day.'), ['potential']),
    ],
  }),
  // Cheeky rooms only.
  greenPlace(
    {
      id: 'izakaya',
      packId: 'food',
      emoji: '🏮',
      name: { text: '居酒屋', kana: 'いざかや', en: 'izakaya', furigana: [['居酒屋', 'いざかや']] },
      roles: [k('てんちょう', 'the manager'), k('アルバイトの てんいん', 'a part-time waiter'), k('よっぱらいの サラリーマン', 'a drunk office worker'), k('じょうれんさん', 'a regular'), k('かんじ', 'the party organiser')],
      questions: [
        R('n3', 'yesno', t('さいしょの 一ぱいは ビールに するべきですか。', 'さいしょの いっぱいは ビールに するべきですか。', 'Should the first round be beer?'), ['beki']),
        R('n4', 'yesno', k('おとおしは ことわっては いけませんか。', "Aren't you allowed to turn down the table snack?"), ['te-wa-ikenai']),
      ],
      answers: [
        R('n3', 'yesno', k('ええ、とりあえず ビールに する ことに なって います。', "Yes, it's beer to start with. That's the rule."), ['koto-ni-natteiru']),
        R('n3', 'what', t('上司より 先に 飲むべきでは ありません。', 'じょうしより さきに のむべきでは ありません。', "You really shouldn't drink before your boss does."), ['beki']),
        R('n3', 'like', t('ビールが 好きな わけでは ありませんが、飲みます。', 'ビールが すきな わけでは ありませんが、のみます。', "It's not that I like beer, but I drink it."), ['wake-dewa-nai']),
        R('n3', 'how', k('のみほうだいでも、のまなくても かまいません。', "Even with all-you-can-drink, you don't have to drink."), ['temo-kamawanai']),
        R('n4', 'when', t('終電に 間に合う ように、早めに 帰ります。', 'しゅうでんに まにあう ように、はやめに かえります。', 'I leave early, so I make the last train.'), ['you-ni']),
        R('n4', 'yesno', t('よっぱらって ここで 寝ては いけません。', 'よっぱらって ここで ねては いけません。', "You mustn't get drunk and fall asleep here."), ['te-wa-ikenai']),
      ],
    },
    ['cheeky'],
  ),
  greenPlace(
    {
      id: 'karaoke',
      packId: 'food',
      emoji: '🎤',
      name: k('カラオケボックス', 'karaoke box'),
      accepted: ['カラオケ'],
      roles: [k('てんいん', 'the staff'), k('じゅうはちばんを うたう ぶちょう', 'the boss singing his party piece'), k('タンバリンの ひと', 'the tambourine person'), k('マイクを はなさない ひと', 'the mic hog'), k('ドリンクを はこぶ ひと', 'the one fetching drinks')],
      questions: [
        R('n3', 'yesno', t('同じ 曲を 二回 歌っても かまいませんか。', 'おなじ きょくを にかい うたっても かまいませんか。', 'Is it all right to sing the same song twice?'), ['temo-kamawanai']),
        R('n4', 'yesno', t('ここで 朝まで 歌えますか。', 'ここで あさまで うたえますか。', 'Can you sing here until morning?'), ['potential']),
      ],
      answers: [
        R('n3', 'yesno', t('ええ、何回 歌っても かまいませんよ。', 'ええ、なんかい うたっても かまいませんよ。', 'Sure, sing it as many times as you like.'), ['temo-kamawanai']),
        R('n3', 'what', t('部長の 歌の あとは、はくしゅを する ことに なって います。', 'ぶちょうの うたの あとは、はくしゅを する ことに なって います。', "After the boss sings, you're supposed to clap."), ['koto-ni-natteiru']),
        R('n3', 'like', t('歌が うまい わけでは ありませんが、たのしいです。', 'うたが うまい わけでは ありませんが、たのしいです。', "It's not that I'm a good singer, but it's fun."), ['wake-dewa-nai']),
        R('n4', 'yesno', k('マイクを ひとりじめしては いけません。', "You mustn't hog the mic."), ['te-wa-ikenai']),
        R('n4', 'when', t('フリータイムなら、朝まで 歌えます。', 'フリータイムなら、あさまで うたえます。', 'On the all-night deal you can sing till morning.'), ['potential']),
        R('n4', 'what', t('声が かれない ように、水を 飲みます。', 'こえが かれない ように、みずを のみます。', "I drink water, so I don't lose my voice."), ['you-ni']),
      ],
    },
    ['cheeky'],
  ),
  greenPlace(
    {
      id: 'bounenkai',
      packId: 'food',
      emoji: '🍻',
      name: { text: '会社の 忘年会', kana: 'かいしゃの ぼうねんかい', en: 'office year-end party', furigana: [['会社', 'かいしゃ'], ['の ', ''], ['忘年会', 'ぼうねんかい']] },
      accepted: ['ぼうねんかい'],
      roles: [k('ぶちょう', 'the boss'), k('かんじ', 'the organiser'), k('しんにゅうしゃいん', 'the new hire'), k('しゃちょう', 'the company president'), k('となりの ぶしょの ひと', 'someone from the next department')],
      questions: [
        R('n3', 'what', t('新入社員は 何を する ことに なって いますか。', 'しんにゅうしゃいんは なにを する ことに なって いますか。', 'What is the new hire supposed to do?'), ['koto-ni-natteiru']),
        R('n3', 'yesno', t('途中で 帰っても かまいませんか。', 'とちゅうで かえっても かまいませんか。', 'Is it all right to leave partway through?'), ['temo-kamawanai']),
      ],
      answers: [
        R('n3', 'what', t('新入社員が 一曲 歌う ことに なって います。', 'しんにゅうしゃいんが いっきょく うたう ことに なって います。', 'The new hire is supposed to sing a song.'), ['koto-ni-natteiru']),
        R('n3', 'yesno', t('部長の グラスが あいたら、すぐ つぐべきです。', 'ぶちょうの グラスが あいたら、すぐ つぐべきです。', "When the boss's glass is empty, you should top it up right away."), ['beki']),
        R('n3', 'like', k('のみかいが きらいな わけでは ありません。', "It's not that I hate drinking parties."), ['wake-dewa-nai']),
        R('n4', 'yesno', t('ぶれいこうでも、部長に ため口を きいては いけません。', 'ぶれいこうでも、ぶちょうに ためぐちを きいては いけません。', "Even when rank doesn't count, you mustn't talk to the boss like a mate."), ['te-wa-ikenai']),
        R('n4', 'what', t('一年の つかれを わすれる ために、飲みます。', 'いちねんの つかれを わすれる ために、のみます。', 'We drink to forget the year.'), ['tame-ni']),
        R('n4', 'when', t('部長が 早く 帰っても いいと 言って いました。', 'ぶちょうが はやく かえっても いいと いって いました。', 'The boss said we could go home early.'), ['to-itte-ita']),
      ],
    },
    ['cheeky'],
  ),
];

/** Every Green Car line, for matching what was said and for the bots. */
export const GREEN_LINES: readonly Line[] = [
  ...GREEN_QUESTIONS,
  ...GREEN_ANSWERS,
  ...GREEN_BLUFFS,
  ...Object.values(GREEN_PLACE_LINES).flatMap((x) => [...x.questions, ...x.answers]),
  ...GREEN_PLACES.flatMap((p) => [...p.questions, ...p.answers]),
];
