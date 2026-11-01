// Who's the Tourist? content: the secret places, question frames, answer frames and the
// tourist's bluffing phrases.
//
// Draft content (status 'draft'): a fluent speaker should check every line, role and place.
// Level bands follow the topic packs: kana = short set phrases (all kana, romaji shown at the
// Kana level), n5 = です/ます sentences, n4 = one N4 pattern each (〜たら, potential, 〜ても
// いい, 〜ほうがいい, 〜そう, 〜ておく, 〜てもらう).
//
// The N4 deck (goals 4.2 and 4.4): questions in ＿なければ なりませんか, ＿なくても いいですか,
// ＿られますか (potential) and ＿ことが できますか, with answers in the same frames (＿なければ
// なりません, ＿なくても いいです, ＿られます). Those lines carry `frames` (frame ids by name), and an
// answerer's tiles put answers in the question's frame family first.
//
// Every question and answer has a `kind` (what / when / who / like / how / where / yes-no), so an
// answerer's phone can suggest answers that fit the question. Place answers are things a local
// would say; generic answers fit every place, so the tourist can use them safely (and locals
// may too, which keeps them from being a giveaway).

import type { JpText, Level, ReviewStatus } from '../../../../content/src/types.js';

export const KINDS = ['what', 'when', 'who', 'like', 'how', 'where', 'yesno'] as const;
export type Kind = (typeof KINDS)[number];

export interface Line {
  /** Stable id, e.g. `tourist.q.nani-shimasu` or `tourist.onsen.a.how.n5`. */
  id: string;
  jp: JpText;
  level: Level;
  /** What the question asks, or which questions the answer fits. Bluffs fit any question. */
  kind: Kind | 'any';
  /** Other readings that count (kana). */
  accepted?: string[];
  /** The N4 frames the line practises, by frame id (N4 deck lines). */
  frames?: readonly string[];
  /** Set on the N4 deck's generic lines; place lines take their place's status. */
  status?: ReviewStatus;
}

export interface Place {
  id: string;
  packId: 'food' | 'family' | 'travel';
  emoji: string;
  name: JpText;
  /** Other ways to say the name (kana), for the tourist's spoken guess. */
  accepted?: string[];
  /** Roles handed to the locals in order (at least 5). */
  roles: JpText[];
  /** Questions a local might ask here (they know the place). */
  questions: Line[];
  /** Answers a local might give here. */
  answers: Line[];
  status: ReviewStatus;
}

const t = (text: string, kana: string, en: string): JpText => ({ text, kana, en });
const k = (kana: string, en: string): JpText => ({ text: kana, kana, en });
/** An N4 deck line: draft, tagged with its frames. */
const n4 = (id: string, kind: Kind, jp: JpText, frames: string[]): Line => ({ id, level: 'n4', kind, jp, frames, status: 'draft' });

// ---- generic question frames (every place) ----

export const QUESTIONS: readonly Line[] = [
  // kana
  { id: 'tourist.q.suki', level: 'kana', kind: 'like', jp: k('すきですか。', 'Do you like it?') },
  { id: 'tourist.q.nani-shimasu', level: 'kana', kind: 'what', jp: k('なにを しますか。', 'What do you do?') },
  { id: 'tourist.q.dare-to', level: 'kana', kind: 'who', jp: k('だれと きますか。', 'Who do you come with?') },
  { id: 'tourist.q.itsu', level: 'kana', kind: 'when', jp: k('いつ きますか。', 'When do you come?') },
  { id: 'tourist.q.tanoshii', level: 'kana', kind: 'how', jp: k('たのしいですか。', 'Is it fun?') },
  { id: 'tourist.q.takai', level: 'kana', kind: 'yesno', jp: k('たかいですか。', 'Is it expensive?') },
  // n5
  { id: 'tourist.q.koko-nani', level: 'n5', kind: 'what', jp: t('ここで 何を しますか。', 'ここで なにを しますか。', 'What do you do here?') },
  { id: 'tourist.q.yoku', level: 'n5', kind: 'when', jp: t('よく 来ますか。', 'よく きますか。', 'Do you come here often?') },
  { id: 'tourist.q.koko-suki', level: 'n5', kind: 'like', jp: t('ここは すきですか。', 'ここは すきですか。', 'Do you like it here?') },
  { id: 'tourist.q.kimasu', level: 'n5', kind: 'what', jp: t('何を 着ますか。', 'なにを きますか。', 'What do you wear?') },
  { id: 'tourist.q.okane', level: 'n5', kind: 'yesno', jp: t('お金が いりますか。', 'おかねが いりますか。', 'Do you need money?') },
  { id: 'tourist.q.urusai', level: 'n5', kind: 'how', jp: t('うるさいですか。', 'うるさいですか。', 'Is it noisy?') },
  { id: 'tourist.q.nani-arimasu', level: 'n5', kind: 'what', jp: t('何が ありますか。', 'なにが ありますか。', 'What is there?') },
  { id: 'tourist.q.doko', level: 'n5', kind: 'where', jp: t('どこに ありますか。', 'どこに ありますか。', 'Where is it?') },
  { id: 'tourist.q.nanji', level: 'n5', kind: 'when', jp: t('何時に 行きますか。', 'なんじに いきますか。', 'What time do you go?') },
  { id: 'tourist.q.douyatte', level: 'n5', kind: 'how', jp: t('どうやって 行きますか。', 'どうやって いきますか。', 'How do you get there?') },
  // n4
  { id: 'tourist.q.dekimasu', level: 'n4', kind: 'what', jp: t('ここで 何が できますか。', 'ここで なにが できますか。', 'What can you do here?') },
  { id: 'tourist.q.hitori', level: 'n4', kind: 'yesno', jp: t('一人で 行っても いいですか。', 'ひとりで いっても いいですか。', 'Is it OK to go alone?') },
  { id: 'tourist.q.kodomo', level: 'n4', kind: 'yesno', jp: t('子どもも 行けますか。', 'こどもも いけますか。', 'Can children go too?'), frames: ['potential'], status: 'draft' },
  { id: 'tourist.q.ittara', level: 'n4', kind: 'what', jp: t('行ったら、まず 何を しますか。', 'いったら、まず なにを しますか。', 'When you get there, what do you do first?') },
  { id: 'tourist.q.motte', level: 'n4', kind: 'what', jp: t('何を 持って 行ったら いいですか。', 'なにを もって いったら いいですか。', 'What should I bring?') },
  // n4 deck: must and needn't (4.2), can (4.4)
  n4('tourist.q.nani-nakereba', 'what', t('ここで 何を しなければ なりませんか。', 'ここで なにを しなければ なりませんか。', 'What do you have to do here?'), ['nakereba']),
  n4('tourist.q.shizuka', 'yesno', k('しずかに しなければ なりませんか。', 'Do you have to be quiet?'), ['nakereba']),
  n4('tourist.q.harawanakute', 'yesno', t('お金を はらわなくても いいですか。', 'おかねを はらわなくても いいですか。', 'Is it OK not to pay?'), ['nakutemo-ii']),
  n4('tourist.q.taberaremasu', 'yesno', t('ここで 食べられますか。', 'ここで たべられますか。', 'Can you eat here?'), ['potential']),
  n4('tourist.q.neraremasu', 'yesno', k('ここで ねられますか。', 'Can you sleep here?'), ['potential']),
  n4('tourist.q.miraremasu', 'what', t('ここで 何が 見られますか。', 'ここで なにが みられますか。', 'What can you see here?'), ['potential']),
  n4('tourist.q.shashin', 'yesno', k('ここで しゃしんを とる ことが できますか。', 'Can you take photos here?'), ['potential']),
  n4('tourist.q.kaimono', 'yesno', t('ここで 買いものを する ことが できますか。', 'ここで かいものを する ことが できますか。', 'Can you go shopping here?'), ['potential']),
];

// ---- generic answers (any place: safe for the tourist) ----

export const SAFE_ANSWERS: readonly Line[] = [
  { id: 'tourist.a.iroiro', level: 'kana', kind: 'what', jp: k('いろいろです。', 'All sorts of things.') },
  { id: 'tourist.a.iroiro-shimasu', level: 'n5', kind: 'what', jp: t('いろいろな ことを します。', 'いろいろな ことを します。', 'I do all sorts of things.') },
  { id: 'tourist.a.hito-ni-yoru', level: 'n4', kind: 'what', jp: t('人に よりますね。', 'ひとに よりますね。', 'It depends on the person.') },
  { id: 'tourist.a.tomodachi', level: 'kana', kind: 'who', jp: k('ともだちです。', 'Friends.') },
  { id: 'tourist.a.tomodachi-to', level: 'n5', kind: 'who', jp: t('ともだちと 行きます。', 'ともだちと いきます。', 'I go with friends.') },
  { id: 'tourist.a.tokidoki', level: 'kana', kind: 'when', jp: k('ときどきです。', 'Sometimes.') },
  { id: 'tourist.a.shuumatsu', level: 'n5', kind: 'when', jp: t('しゅうまつに 行きます。', 'しゅうまつに いきます。', 'I go at weekends.') },
  { id: 'tourist.a.hima', level: 'n4', kind: 'when', jp: t('ひまが あったら 行きます。', 'ひまが あったら いきます。', "If I have free time, I go.") },
  { id: 'tourist.a.maamaa', level: 'kana', kind: 'like', jp: k('まあまあです。', "It's OK.") },
  { id: 'tourist.a.suki', level: 'n5', kind: 'like', jp: t('はい、すきです。', 'はい、すきです。', 'Yes, I like it.') },
  { id: 'tourist.a.suki-ni-natta', level: 'n4', kind: 'like', jp: t('すきに なりました。', 'すきに なりました。', "I've come to like it.") },
  { id: 'tourist.a.futsuu', level: 'kana', kind: 'how', jp: k('ふつうです。', "It's normal.") },
  { id: 'tourist.a.tanoshii', level: 'n5', kind: 'how', jp: t('たのしいですよ。', 'たのしいですよ。', "It's fun!") },
  { id: 'tourist.a.omotta-yori', level: 'n4', kind: 'how', jp: t('思ったより いいですよ。', 'おもったより いいですよ。', "It's better than you'd think.") },
  { id: 'tourist.a.asoko', level: 'kana', kind: 'where', jp: k('あそこです。', 'Over there.') },
  { id: 'tourist.a.machi', level: 'n5', kind: 'where', jp: t('まちに あります。', 'まちに あります。', "It's in town.") },
  { id: 'tourist.a.iroiro-tokoro', level: 'n4', kind: 'where', jp: t('いろいろな ところに ありますよ。', 'いろいろな ところに ありますよ。', 'There are lots of them around.') },
  { id: 'tourist.a.hai', level: 'kana', kind: 'yesno', jp: k('はい！', 'Yes!') },
  { id: 'tourist.a.iie', level: 'kana', kind: 'yesno', jp: k('いいえ。', 'No.') },
  { id: 'tourist.a.tabun', level: 'kana', kind: 'yesno', jp: k('たぶん。', 'Probably.') },
  { id: 'tourist.a.sou-desu', level: 'n5', kind: 'yesno', jp: t('はい、そうです。', 'はい、そうです。', "Yes, that's right.") },
  { id: 'tourist.a.chigaimasu', level: 'n5', kind: 'yesno', jp: t('いいえ、ちがいます。', 'いいえ、ちがいます。', "No, it isn't.") },
  { id: 'tourist.a.kamo', level: 'n4', kind: 'yesno', jp: t('そうかも しれません。', 'そうかも しれません。', 'Maybe so.') },
  // n4 deck
  n4('tourist.a.nakereba', 'yesno', k('そう しなければ なりません。', 'You have to.'), ['nakereba']),
  n4('tourist.a.nakute-mo-ii', 'yesno', k('しなくても いいですよ。', "You don't have to."), ['nakutemo-ii']),
  n4('tourist.a.koraremasu', 'yesno', t('はい、いつでも 来られますよ。', 'はい、いつでも こられますよ。', 'Yes, you can come any time.'), ['potential']),
  n4('tourist.a.dekiru', 'yesno', k('ええ、だれでも する ことが できます。', 'Sure, anyone can do it.'), ['potential']),
  n4('tourist.a.mirareru', 'what', t('いろいろな ものが 見られますよ。', 'いろいろな ものが みられますよ。', 'You can see all sorts of things.'), ['potential']),
  n4('tourist.a.rule', 'what', k('ルールを まもらなければ なりません。', 'You have to follow the rules.'), ['nakereba']),
];

/** The tourist's cheat sheet: helpful-but-safe phrases that fit any question. */
export const BLUFFS: readonly Line[] = [
  { id: 'tourist.bluff.sou-desu-ne', level: 'kana', kind: 'any', jp: k('そうですね…', 'Hmm, let me think…'), accepted: ['そうですね'] },
  { id: 'tourist.bluff.himitsu', level: 'kana', kind: 'any', jp: k('ひみつです！', "It's a secret!") },
  { id: 'tourist.bluff.tabun', level: 'kana', kind: 'any', jp: k('たぶん…', 'Maybe…') },
  { id: 'tourist.bluff.ii-shitsumon', level: 'n5', kind: 'any', jp: t('いい しつもんですね！', 'いい しつもんですね！', 'Good question!') },
  { id: 'tourist.bluff.onaji', level: 'n5', kind: 'any', jp: t('みんなと おなじです。', 'みんなと おなじです。', 'Same as everyone.') },
  { id: 'tourist.bluff.anata-wa', level: 'n5', kind: 'any', jp: t('あなたは どうですか。', 'あなたは どうですか。', 'What about you?') },
  { id: 'tourist.bluff.nanto', level: 'n4', kind: 'any', jp: t('何と 言ったら いいかな…', 'なんと いったら いいかな…', 'How should I put it…') },
];

// ---- the places ----

/** A place's line: level, kind, Japanese, and (N4 deck lines) the frames it practises. */
type Row = [Level, Kind, JpText, string[]?];
type Draft = Omit<Place, 'questions' | 'answers' | 'status'> & {
  questions: Row[];
  answers: Row[];
};

function place(d: Draft): Place {
  const count = new Map<string, number>();
  const id = (part: string, level: Level, kind: Kind) => {
    const base = `tourist.${d.id}.${part}.${kind}.${level}`;
    const n = (count.get(base) ?? 0) + 1;
    count.set(base, n);
    return n === 1 ? base : `${base}.${n}`;
  };
  return {
    ...d,
    questions: d.questions.map(([level, kind, jp, frames]) => ({ id: id('q', level, kind), level, kind, jp, ...(frames ? { frames } : {}) })),
    answers: d.answers.map(([level, kind, jp, frames]) => ({ id: id('a', level, kind), level, kind, jp, ...(frames ? { frames } : {}) })),
    status: 'draft',
  };
}

export const PLACES: readonly Place[] = [
  // ---- food ----
  place({
    id: 'konbini',
    packId: 'food',
    emoji: '🏪',
    name: k('コンビニ', 'convenience store'),
    roles: [k('てんいん', 'the clerk'), k('てんちょう', 'the manager'), k('がくせい', 'a student on a snack run'), k('はいたついん', 'a delivery driver'), k('よるの おきゃくさん', 'a late-night customer')],
    questions: [
      ['kana', 'yesno', k('よる いきますか。', 'Do you go at night?')],
      ['n5', 'what', t('よく 何を 買いますか。', 'よく なにを かいますか。', 'What do you often buy?')],
      ['n4', 'yesno', t('お金を おろせますか。', 'おかねを おろせますか。', 'Can you take out money there?'), ['potential']],
      ['n4', 'yesno', k('にもつを おくる ことが できますか。', 'Can you send parcels from there?'), ['potential']],
    ],
    answers: [
      ['kana', 'what', k('おにぎりです。', 'Onigiri.')],
      ['n5', 'what', t('おべんとうを 買います。', 'おべんとうを かいます。', 'I buy a bento.')],
      ['n4', 'what', t('あたためて もらいます。', 'あたためて もらいます。', 'I get it heated up for me.')],
      ['kana', 'when', k('よるです。', 'At night.')],
      ['n5', 'when', t('まいにち 行きます。', 'まいにち いきます。', 'I go every day.')],
      ['n4', 'when', t('おなかが すいたら 行きます。', 'おなかが すいたら いきます。', 'Whenever I get hungry.')],
      ['kana', 'who', k('ひとりで。', 'On my own.')],
      ['n5', 'who', t('たいてい 一人です。', 'たいてい ひとりです。', "I'm usually alone.")],
      ['kana', 'like', k('だいすき！', 'I love it!')],
      ['n5', 'like', t('べんりだから すきです。', 'べんりだから すきです。', "I like it because it's handy.")],
      ['kana', 'how', k('あかるいです。', "It's bright.")],
      ['n5', 'how', t('いつも あいて います。', 'いつも あいて います。', "It's always open.")],
      ['kana', 'where', k('どこでも！', 'Everywhere!')],
      ['n5', 'where', t('えきの ちかくに あります。', 'えきの ちかくに あります。', "There's one near the station.")],
      ['n4', 'yesno', k('はい、いつでも だせますよ。', 'Yes, you can send them any time.'), ['potential']],
      ['n4', 'what', t('コンサートの チケットも 買えます。', 'コンサートの チケットも かえます。', 'You can even buy concert tickets there.'), ['potential']],
    ],
  }),
  place({
    id: 'restaurant',
    packId: 'food',
    emoji: '🍽️',
    name: k('レストラン', 'restaurant'),
    roles: [k('シェフ', 'the chef'), k('ウェイター', 'the waiter'), k('デートの ひと', 'someone on a date'), k('グルメの ひと', 'a food critic'), k('さらあらい', 'the dishwasher')],
    questions: [
      ['kana', 'what', k('なにを たべますか。', 'What do you eat?')],
      ['n5', 'yesno', t('よやくが いりますか。', 'よやくが いりますか。', 'Do you need a reservation?')],
      ['n4', 'yesno', t('ドレスを 着て 行った ほうが いいですか。', 'ドレスを きて いった ほうが いいですか。', 'Should I wear a dress?')],
      ['n4', 'yesno', k('よやく しなければ なりませんか。', 'Do you have to book?'), ['nakereba']],
    ],
    answers: [
      ['kana', 'what', k('ステーキです。', 'Steak.')],
      ['n5', 'what', t('パスタを 食べます。', 'パスタを たべます。', 'I eat pasta.')],
      ['n4', 'what', t('シェフの おすすめを たのみます。', 'シェフの おすすめを たのみます。', "I order the chef's special.")],
      ['kana', 'when', k('たんじょうび！', 'Birthdays!')],
      ['n5', 'when', t('とくべつな 日に 行きます。', 'とくべつな ひに いきます。', 'I go on special days.')],
      ['kana', 'who', k('こいびとと。', 'With my partner.')],
      ['n5', 'who', t('かぞくと 行きます。', 'かぞくと いきます。', 'I go with my family.')],
      ['kana', 'like', k('おいしいです！', "It's delicious!")],
      ['n5', 'like', t('ちょっと たかいけど すきです。', 'ちょっと たかいけど すきです。', "It's a bit pricey, but I like it.")],
      ['kana', 'how', k('しずかです。', "It's quiet.")],
      ['n5', 'how', t('きれいで しずかです。', 'きれいで しずかです。', "It's nice and quiet.")],
      ['n4', 'how', t('ちょっと きんちょう しそうです。', 'ちょっと きんちょう しそうです。', 'I might get a bit nervous.')],
      ['kana', 'where', k('まちの なか。', 'In town.')],
      ['n5', 'where', t('ホテルの 中にも あります。', 'ホテルの なかにも あります。', 'There are some inside hotels too.')],
      ['n4', 'yesno', k('しゅうまつは よやく しなければ なりません。', 'At weekends you have to book.'), ['nakereba']],
      ['n4', 'like', k('ここの パスタは わすれられません。', "I can't forget the pasta here."), ['potential']],
    ],
  }),
  place({
    id: 'ramen',
    packId: 'food',
    emoji: '🍜',
    name: { text: 'ラーメン屋', kana: 'ラーメンや', en: 'ramen shop', furigana: [['ラーメン', ''], ['屋', 'や']] },
    accepted: ['ラーメン'],
    roles: [k('たいしょう', 'the owner (the boss of a ramen counter)'), k('アルバイト', 'the part-timer'), k('おなかが すいた ひと', 'a starving customer'), k('ラーメン マニア', 'a ramen fanatic'), k('となりの ひと', 'the person in the next seat')],
    questions: [
      ['kana', 'how', k('あついですか。', 'Is it hot?')],
      ['n5', 'yesno', t('ならびますか。', 'ならびますか。', 'Do you have to queue?')],
      ['n4', 'yesno', t('大もりに できますか。', 'おおもりに できますか。', 'Can you get a large serving?')],
      ['n4', 'yesno', k('めんの かたさを えらべますか。', 'Can you choose how firm the noodles are?'), ['potential']],
    ],
    answers: [
      ['kana', 'what', k('ずるずる！', 'Slurp, slurp!')],
      ['n5', 'what', t('めんを 食べます。', 'めんを たべます。', 'I eat noodles.')],
      ['kana', 'when', k('よる おそく。', 'Late at night.')],
      ['n5', 'when', t('のみかいの あとで 行きます。', 'のみかいの あとで いきます。', 'I go after a night out.')],
      ['n4', 'when', t('さむく なったら 行きたく なります。', 'さむく なったら いきたく なります。', 'When it gets cold, I want to go.')],
      ['kana', 'who', k('ひとりで！', 'Alone!')],
      ['n5', 'who', { ...t('かいしゃの 人と 行きます。', 'かいしゃの ひとと いきます。', 'I go with people from work.'), furigana: [['かいしゃの ', ''], ['人', 'ひと'], ['と ', ''], ['行', 'い'], ['きます。', '']] }],
      ['kana', 'like', k('だいすき！', 'I love it!')],
      ['n5', 'like', t('しょうゆあじが いちばん すきです。', 'しょうゆあじが いちばん すきです。', 'I like soy-sauce flavour best.')],
      ['kana', 'how', k('うるさいです。', "It's loud.")],
      ['n5', 'how', t('せまくて にぎやかです。', 'せまくて にぎやかです。', "It's small and lively.")],
      ['kana', 'where', k('えきの ちかく。', 'Near the station.')],
      ['n5', 'where', t('みちの かどに あります。', 'みちの かどに あります。', "It's on the street corner.")],
      ['n4', 'yesno', k('はい、かたい めんも やわらかい めんも えらべます。', 'Yes, you can have them firm or soft.'), ['potential']],
      ['n4', 'what', k('スープは ぜんぶ のまなくても いいですよ。', "You don't have to drink all the soup."), ['nakutemo-ii']],
    ],
  }),
  place({
    id: 'supermarket',
    packId: 'food',
    emoji: '🛒',
    name: k('スーパー', 'supermarket'),
    accepted: ['スーパーマーケット'],
    roles: [k('レジの ひと', 'the cashier'), k('てんいん', 'a shelf stacker'), k('おかあさん', 'a parent with a long list'), k('がくせい', 'a student'), k('ししょくの ファン', 'a free-samples fan')],
    questions: [
      ['kana', 'yesno', k('まいにち いきますか。', 'Do you go every day?')],
      ['n5', 'yesno', t('ふくろを 持って 行きますか。', 'ふくろを もって いきますか。', 'Do you bring your own bag?')],
      ['n4', 'when', t('安く なるのは 何時ごろですか。', 'やすく なるのは なんじごろですか。', 'Around what time do things get cheaper?')],
      ['n4', 'yesno', k('ふくろを かわなければ なりませんか。', 'Do you have to buy a bag?'), ['nakereba']],
    ],
    answers: [
      ['kana', 'what', k('やさいです。', 'Vegetables.')],
      ['n5', 'what', t('やさいと にくを 買います。', 'やさいと にくを かいます。', 'I buy vegetables and meat.')],
      ['n4', 'what', t('あしたの ぶんも 買って おきます。', 'あしたの ぶんも かって おきます。', "I buy tomorrow's too, while I'm there.")],
      ['kana', 'when', k('ゆうがたです。', 'In the evening.')],
      ['n5', 'when', t('しごとの あとで 行きます。', 'しごとの あとで いきます。', 'I go after work.')],
      ['kana', 'who', k('かぞくと。', 'With my family.')],
      ['n5', 'who', t('いもうとと 行きます。', 'いもうとと いきます。', 'I go with my little sister.')],
      ['kana', 'like', k('まあまあ。', "It's OK.")],
      ['n5', 'like', t('やすい ものが 多いから すきです。', 'やすい ものが おおいから すきです。', 'I like it, lots of things are cheap.')],
      ['kana', 'how', k('ひろいです。', "It's big.")],
      ['n5', 'how', t('ゆうがたは こんで います。', 'ゆうがたは こんで います。', "It's crowded in the evening.")],
      ['kana', 'where', k('うちの ちかく。', 'Near my house.')],
      ['n5', 'where', t('うちの ちかくに あります。', 'うちの ちかくに あります。', "There's one near my house.")],
      ['n4', 'yesno', k('じぶんの ふくろが あったら、かわなくても いいです。', "If you've got your own bag, you don't need to buy one."), ['tara', 'nakutemo-ii']],
      ['n4', 'when', t('ゆうがたに なったら、やすく 買えますよ。', 'ゆうがたに なったら、やすく かえますよ。', 'Once it gets to evening, you can buy things cheap.'), ['tara', 'potential']],
    ],
  }),

  // ---- travel ----
  place({
    id: 'eki',
    packId: 'travel',
    emoji: '🚉',
    name: { text: '駅', kana: 'えき', en: 'train station', furigana: [['駅', 'えき']] },
    roles: [k('えきいん', 'the station attendant'), k('りょこうしゃ', 'a traveller'), k('サラリーマン', 'a commuter'), k('がくせい', 'a student'), k('えきべんやさん', 'the station-bento seller')],
    questions: [
      ['kana', 'yesno', k('まいあさ いきますか。', 'Do you go every morning?')],
      ['n5', 'what', t('ここで 何を 待ちますか。', 'ここで なにを まちますか。', 'What do you wait for here?')],
      ['n4', 'what', t('のりおくれたら どう しますか。', 'のりおくれたら どう しますか。', 'What do you do if you miss it?')],
      ['n4', 'yesno', k('きっぷを かわなければ なりませんか。', 'Do you have to buy a ticket?'), ['nakereba']],
    ],
    answers: [
      ['kana', 'what', k('まちます。', 'I wait.')],
      ['n5', 'what', t('きっぷを 買います。', 'きっぷを かいます。', 'I buy a ticket.')],
      ['n4', 'what', t('のりかえを しらべて おきます。', 'のりかえを しらべて おきます。', 'I look up my transfers first.')],
      ['kana', 'when', k('あさです。', 'In the morning.')],
      ['n5', 'when', t('まいあさ 八時ごろ 行きます。', 'まいあさ はちじごろ いきます。', 'Every morning around eight.')],
      ['kana', 'who', k('ひとりで。', 'On my own.')],
      ['n5', 'who', t('みんな 一人で 来ます。', 'みんな ひとりで きます。', 'Everyone comes on their own.')],
      ['kana', 'like', k('まあまあ。', "It's OK.")],
      ['n5', 'like', t('べんりですが、あさは きらいです。', 'べんりですが、あさは きらいです。', "It's handy, but I hate it in the morning.")],
      ['kana', 'how', k('ひとが おおい！', 'So many people!')],
      ['n5', 'how', t('いつも こんで います。', 'いつも こんで います。', "It's always crowded.")],
      ['kana', 'where', k('まちの まんなか。', 'In the middle of town.')],
      ['n5', 'where', t('まちの まんなかに あります。', 'まちの まんなかに あります。', "It's right in the middle of town.")],
      ['n4', 'yesno', k('カードが あれば、かわなくても いいです。', "If you've got a travel card, you don't need one."), ['ba', 'nakutemo-ii']],
      ['n4', 'what', t('ここで えきべんが 買えます。', 'ここで えきべんが かえます。', 'You can buy station bento here.'), ['potential']],
    ],
  }),
  place({
    id: 'onsen',
    packId: 'travel',
    emoji: '♨️',
    name: { text: '温泉', kana: 'おんせん', en: 'hot spring', furigana: [['温泉', 'おんせん']] },
    roles: [k('りょかんの ひと', 'the innkeeper'), k('おきゃくさん', 'a guest'), k('おさるさん', 'a snow monkey'), k('そうじの ひと', 'the cleaner'), k('しゃしんか', 'a photographer')],
    questions: [
      ['kana', 'yesno', k('タオルは いりますか。', 'Do you need a towel?')],
      ['n5', 'when', t('どのぐらい 入りますか。', 'どのぐらい はいりますか。', 'How long do you stay in?')],
      ['n4', 'what', t('入る まえに 何を したら いいですか。', 'はいる まえに なにを したら いいですか。', 'What should I do before going in?')],
      ['n4', 'yesno', t('みずぎを 着なければ なりませんか。', 'みずぎを きなければ なりませんか。', 'Do you have to wear a swimsuit?'), ['nakereba']],
    ],
    answers: [
      ['kana', 'what', k('はいります。', 'I get in.')],
      ['n5', 'what', t('ゆっくり やすみます。', 'ゆっくり やすみます。', 'I take it easy.')],
      ['n4', 'what', t('からだを あらってから 入ります。', 'からだを あらってから はいります。', 'I wash before I get in.')],
      ['kana', 'when', k('よるです。', 'At night.')],
      ['n5', 'when', t('ふゆに よく 行きます。', 'ふゆに よく いきます。', 'I often go in winter.')],
      ['kana', 'who', k('かぞくと。', 'With my family.')],
      ['n5', 'who', t('おばあちゃんと 行きます。', 'おばあちゃんと いきます。', 'I go with my grandma.')],
      ['kana', 'like', k('だいすき！', 'I love it!')],
      ['n5', 'like', t('きもちが いいから すきです。', 'きもちが いいから すきです。', 'I like it because it feels so good.')],
      ['kana', 'how', k('あついです！', "It's hot!")],
      ['n5', 'how', t('ちょっと あついです。', 'ちょっと あついです。', "It's a little hot.")],
      ['n4', 'how', t('のぼせそうです。', 'のぼせそうです。', "I feel like I'll get light-headed.")],
      ['kana', 'where', k('やまの なか。', 'In the mountains.')],
      ['n5', 'where', t('やまの ちかくに あります。', 'やまの ちかくに あります。', "It's near the mountains.")],
      ['n4', 'yesno', t('いいえ、みずぎは 着ては いけません。', 'いいえ、みずぎは きては いけません。', "No, you're not allowed to wear one."), ['te-wa-ikenai']],
      ['n4', 'what', t('そとの おふろで ゆきを 見る ことが できます。', 'そとの おふろで ゆきを みる ことが できます。', 'From the outdoor bath you can see the snow.'), ['potential']],
    ],
  }),
  place({
    id: 'kuukou',
    packId: 'travel',
    emoji: '✈️',
    name: { text: '空港', kana: 'くうこう', en: 'airport', furigana: [['空港', 'くうこう']] },
    roles: [k('パイロット', 'the pilot'), k('フライトアテンダント', 'a flight attendant'), k('りょこうしゃ', 'a traveller'), k('けいびいん', 'a security guard'), k('おみやげやさん', 'the souvenir seller')],
    questions: [
      ['kana', 'how', k('にもつは おおきいですか。', 'Is your luggage big?')],
      ['n5', 'yesno', t('パスポートが いりますか。', 'パスポートが いりますか。', 'Do you need a passport?')],
      ['n4', 'when', t('何時間ぐらい 前に 着いたら いいですか。', 'なんじかんぐらい まえに ついたら いいですか。', 'How many hours early should I get there?')],
      ['n4', 'yesno', k('みずを もって いく ことが できますか。', 'Can you take water through?'), ['potential']],
    ],
    answers: [
      ['kana', 'what', k('おみやげ！', 'Souvenirs!')],
      ['n5', 'what', t('にもつを あずけます。', 'にもつを あずけます。', 'I check in my bags.')],
      ['n4', 'what', t('ひまだったら おみやげを 見ます。', 'ひまだったら おみやげを みます。', 'If I have time, I look at souvenirs.')],
      ['kana', 'when', k('なつやすみ。', 'Summer holidays.')],
      ['n5', 'when', t('やすみの 日に 行きます。', 'やすみの ひに いきます。', 'I go on my days off.')],
      ['kana', 'who', k('かぞくと。', 'With my family.')],
      ['n5', 'who', t('ともだちと いっしょに 行きます。', 'ともだちと いっしょに いきます。', 'I go together with friends.')],
      ['kana', 'like', k('わくわく！', "It's exciting!")],
      ['n5', 'like', t('わくわく するから すきです。', 'わくわく するから すきです。', 'I like it, it gets me excited.')],
      ['kana', 'how', k('ひろいです。', "It's big.")],
      ['n5', 'how', t('とても ひろくて、とおいです。', 'とても ひろくて、とおいです。', "It's huge and far away.")],
      ['kana', 'where', k('まちの そと。', 'Outside town.')],
      ['n5', 'where', t('まちから ちょっと とおいです。', 'まちから ちょっと とおいです。', "It's a bit far from town.")],
      ['n4', 'yesno', k('いいえ、すてなければ なりません。', 'No, you have to throw it away.'), ['nakereba']],
      ['n4', 'when', { ...t('二時間 前に 着かなければ なりません。', 'にじかん まえに つかなければ なりません。', 'You have to be there two hours early.'), furigana: [['二時間', 'にじかん'], [' ', ''], ['前', 'まえ'], ['に ', ''], ['着', 'つ'], ['かなければ なりません。', '']] }, ['nakereba']],
    ],
  }),
  place({
    id: 'hotel',
    packId: 'travel',
    emoji: '🏨',
    name: k('ホテル', 'hotel'),
    roles: [k('フロントの ひと', 'the front-desk clerk'), k('ベルボーイ', 'the bellhop'), k('おきゃくさん', 'a guest'), k('そうじの ひと', 'the housekeeper'), k('シェフ', 'the chef')],
    questions: [
      ['kana', 'when', k('なんにち いますか。', 'How many days are you there?')],
      ['n5', 'how', t('へやは ひろいですか。', 'へやは ひろいですか。', 'Is the room big?')],
      ['n4', 'yesno', t('ルームサービスを たのんでも いいですか。', 'ルームサービスを たのんでも いいですか。', 'Can I order room service?')],
      ['n4', 'yesno', k('チェックアウトを おそく する ことが できますか。', 'Can you check out late?'), ['potential']],
    ],
    answers: [
      ['kana', 'what', k('ねます。', 'I sleep.')],
      ['n5', 'what', t('チェックインを します。', 'チェックインを します。', 'I check in.')],
      ['n4', 'what', t('にもつを あずかって もらいます。', 'にもつを あずかって もらいます。', 'I have them look after my bags.')],
      ['kana', 'when', k('りょこうの とき。', "When I'm travelling.")],
      ['n5', 'when', t('りょこうの とき 行きます。', 'りょこうの とき いきます。', 'I go when I travel.')],
      ['kana', 'who', k('ともだちと。', 'With friends.')],
      ['n5', 'who', t('しごとで 一人で とまります。', 'しごとで ひとりで とまります。', 'I stay alone, for work.')],
      ['kana', 'like', k('すきです。', 'I like it.')],
      ['n5', 'like', t('ベッドが 大きくて すきです。', 'ベッドが おおきくて すきです。', 'I like it, the beds are big.')],
      ['kana', 'how', k('しずかです。', "It's quiet.")],
      ['n5', 'how', t('へやが きれいです。', 'へやが きれいです。', 'The rooms are clean.')],
      ['kana', 'where', k('えきの まえ。', 'In front of the station.')],
      ['n5', 'where', t('えきの まえに あります。', 'えきの まえに あります。', "It's in front of the station.")],
      ['n4', 'yesno', k('はい、じゅうにじまで いられます。', 'Yes, you can stay until twelve.'), ['potential']],
      ['n4', 'what', k('へやで ゆっくり ねられます。', 'You can sleep in peace in your room.'), ['potential']],
    ],
  }),

  // ---- family ----
  place({
    id: 'gakkou',
    packId: 'family',
    emoji: '🏫',
    name: { text: '学校', kana: 'がっこう', en: 'school', furigana: [['学校', 'がっこう']] },
    roles: [k('せんせい', 'the teacher'), k('せいと', 'a pupil'), k('こうちょう せんせい', 'the head teacher'), k('きゅうしょくの ひと', 'the lunch cook'), k('てんこうせい', 'the new kid')],
    questions: [
      ['kana', 'yesno', k('べんきょう しますか。', 'Do you study?')],
      ['n5', 'yesno', t('せいふくを 着ますか。', 'せいふくを きますか。', 'Do you wear a uniform?')],
      ['n4', 'what', t('しゅくだいを わすれたら どう なりますか。', 'しゅくだいを わすれたら どう なりますか。', 'What happens if you forget your homework?')],
      ['n4', 'yesno', t('せいふくを 着なければ なりませんか。', 'せいふくを きなければ なりませんか。', 'Do you have to wear a uniform?'), ['nakereba']],
    ],
    answers: [
      ['kana', 'what', k('べんきょう！', 'Studying!')],
      ['n5', 'what', t('ともだちと 話します。', 'ともだちと はなします。', 'I talk with friends.')],
      ['n4', 'what', t('テストが あったら べんきょう します。', 'テストが あったら べんきょう します。', "If there's a test, I study.")],
      ['kana', 'when', k('あさです。', 'In the morning.')],
      ['n5', 'when', t('月曜日から 金曜日まで 行きます。', 'げつようびから きんようびまで いきます。', 'Monday to Friday.')],
      ['kana', 'who', k('ともだちと。', 'With friends.')],
      ['n5', 'who', t('クラスの みんなと います。', 'クラスの みんなと います。', "I'm there with my whole class.")],
      ['kana', 'like', k('まあまあ。', "It's OK.")],
      ['n5', 'like', t('きゅうしょくが すきです。', 'きゅうしょくが すきです。', 'I like the lunches.')],
      ['kana', 'how', k('にぎやかです。', "It's lively.")],
      ['n5', 'how', t('ひるやすみは うるさいです。', 'ひるやすみは うるさいです。', "It's noisy at lunchtime.")],
      ['kana', 'where', k('うちの ちかく。', 'Near my house.')],
      ['n5', 'where', t('こうえんの となりに あります。', 'こうえんの となりに あります。', "It's next to the park.")],
      ['n4', 'yesno', t('はい、まいにち 着なければ なりません。', 'はい、まいにち きなければ なりません。', 'Yes, every day.'), ['nakereba']],
      ['n4', 'what', k('あさ はちじまでに こなければ なりません。', 'You have to be in by eight in the morning.'), ['nakereba']],
    ],
  }),
  place({
    id: 'kouen',
    packId: 'family',
    emoji: '🌳',
    name: { text: '公園', kana: 'こうえん', en: 'park', furigana: [['公園', 'こうえん']] },
    roles: [k('こども', 'a kid'), k('おじいさん', 'a grandpa feeding pigeons'), k('いぬの さんぽの ひと', 'a dog walker'), k('ジョギングの ひと', 'a jogger'), k('アイスやさん', 'the ice-cream seller')],
    questions: [
      ['kana', 'who', k('いぬと いきますか。', 'Do you go with a dog?')],
      ['n5', 'yesno', t('てんきが いい 日に 行きますか。', 'てんきが いい ひに いきますか。', 'Do you go when the weather is nice?')],
      ['n4', 'what', t('雨が ふったら どう しますか。', 'あめが ふったら どう しますか。', 'What do you do if it rains?')],
      ['n4', 'yesno', k('よる おそくまで あそべますか。', 'Can you play there until late?'), ['potential']],
    ],
    answers: [
      ['kana', 'what', k('あそびます。', 'I play.')],
      ['n5', 'what', t('さんぽを します。', 'さんぽを します。', 'I go for a walk.')],
      ['n4', 'what', t('ベンチで 本を 読んだり します。', 'ベンチで ほんを よんだり します。', 'I read on a bench, that kind of thing.')],
      ['kana', 'when', k('にちようび。', 'Sundays.')],
      ['n5', 'when', t('はれの 日に 行きます。', 'はれの ひに いきます。', 'I go on sunny days.')],
      ['kana', 'who', k('いぬと！', 'With my dog!')],
      ['n5', 'who', t('こどもと いっしょに 行きます。', 'こどもと いっしょに いきます。', 'I go with my kids.')],
      ['kana', 'like', k('すきです。', 'I like it.')],
      ['n5', 'like', t('ひろくて きもちが いいです。', 'ひろくて きもちが いいです。', "It's big and it feels nice.")],
      ['kana', 'how', k('みどりです。', "It's green.")],
      ['n5', 'how', t('しずかで、木が 多いです。', 'しずかで、きが おおいです。', "It's quiet, with lots of trees.")],
      ['kana', 'where', k('まちの なか。', 'In town.')],
      ['n5', 'where', t('学校の となりに あります。', 'がっこうの となりに あります。', "It's next to the school.")],
      ['n4', 'yesno', k('いいえ、くらく なる まえに かえらなければ なりません。', 'No, you have to go home before it gets dark.'), ['nakereba']],
      ['n4', 'how', k('ただで あそべますよ。', 'You can play there for free.'), ['potential']],
    ],
  }),
  place({
    id: 'ie',
    packId: 'family',
    emoji: '🏠',
    name: { text: '家', kana: 'いえ', en: 'home', furigana: [['家', 'いえ']] },
    accepted: ['うち'],
    roles: [k('おかあさん', 'mum'), k('おとうさん', 'dad'), k('おばあちゃん', 'grandma'), k('ねこ', 'the cat'), k('おきゃくさん', 'a visiting guest')],
    questions: [
      ['kana', 'yesno', k('まいにち かえりますか。', 'Do you go back every day?')],
      ['n5', 'yesno', t('くつを ぬぎますか。', 'くつを ぬぎますか。', 'Do you take your shoes off?')],
      ['n4', 'what', t('つかれたら 何を しますか。', 'つかれたら なにを しますか。', 'What do you do when you are tired?')],
      ['n4', 'yesno', k('くつを ぬがなければ なりませんか。', 'Do you have to take your shoes off?'), ['nakereba']],
    ],
    answers: [
      ['kana', 'what', k('ごはん！', 'Dinner!')],
      ['n5', 'what', t('テレビを 見ます。', 'テレビを みます。', 'I watch TV.')],
      ['n4', 'what', t('ソファーで ごろごろ します。', 'ソファーで ごろごろ します。', 'I laze around on the sofa.')],
      ['kana', 'when', k('まいにち。', 'Every day.')],
      ['n5', 'when', t('まいばん かえります。', 'まいばん かえります。', 'I go back every night.')],
      ['kana', 'who', k('かぞくと。', 'With my family.')],
      ['n5', 'who', t('かぞく みんなと います。', 'かぞく みんなと います。', "I'm there with the whole family.")],
      ['kana', 'like', k('だいすき！', 'I love it!')],
      ['n5', 'like', t('いちばん おちつきます。', 'いちばん おちつきます。', "It's where I relax most.")],
      ['kana', 'how', k('せまいです。', "It's small.")],
      ['n5', 'how', t('ちょっと せまいですが、あたたかいです。', 'ちょっと せまいですが、あたたかいです。', "It's a bit small, but cosy.")],
      ['kana', 'where', k('ひみつ！', 'Secret!')],
      ['n5', 'where', t('駅から あるいて 10分です。', 'えきから あるいて じゅっぷんです。', "It's ten minutes' walk from the station.")],
      ['n4', 'yesno', k('はい、げんかんで ぬがなければ なりません。', 'Yes, you have to take them off at the door.'), ['nakereba']],
      ['n4', 'what', k('なにも しなくても いいです。', "You don't have to do a thing."), ['nakutemo-ii']],
    ],
  }),
  place({
    id: 'byouin',
    packId: 'family',
    emoji: '🏥',
    name: { text: '病院', kana: 'びょういん', en: 'hospital', furigana: [['病院', 'びょういん']] },
    roles: [k('いしゃ', 'the doctor'), k('かんごし', 'a nurse'), k('かんじゃ', 'a patient'), k('おみまいの ひと', 'a visitor'), k('うけつけの ひと', 'the receptionist')],
    questions: [
      ['kana', 'how', k('げんきですか。', 'Are you well?')],
      ['n5', 'yesno', t('ながく 待ちますか。', 'ながく まちますか。', 'Do you wait a long time?')],
      ['n4', 'yesno', t('ねつが あったら 行きますか。', 'ねつが あったら いきますか。', 'Do you go if you have a fever?')],
      ['n4', 'yesno', k('よやく しなくても いいですか。', 'Is it OK not to book?'), ['nakutemo-ii']],
    ],
    answers: [
      ['kana', 'what', k('まちます。', 'I wait.')],
      ['n5', 'what', t('くすりを もらいます。', 'くすりを もらいます。', 'I get medicine.')],
      ['n4', 'what', t('みて もらいます。', 'みて もらいます。', 'I get checked over.')],
      ['kana', 'when', k('かぜの とき。', 'When I have a cold.')],
      ['n5', 'when', t('ぐあいが わるい とき 行きます。', 'ぐあいが わるい とき いきます。', "I go when I'm feeling ill.")],
      ['kana', 'who', k('ひとりで。', 'On my own.')],
      ['n5', 'who', t('おかあさんと 行きます。', 'おかあさんと いきます。', 'I go with my mum.')],
      ['kana', 'like', k('きらい！', 'I hate it!')],
      ['n5', 'like', t('あまり すきじゃ ないです。', 'あまり すきじゃ ないです。', "I don't like it much.")],
      ['kana', 'how', k('しろいです。', "It's white.")],
      ['n5', 'how', t('しずかで、きれいです。', 'しずかで、きれいです。', "It's quiet and clean.")],
      ['kana', 'where', k('まちの なか。', 'In town.')],
      ['n5', 'where', t('おおきい みちの ちかくに あります。', 'おおきい みちの ちかくに あります。', "It's near the main road.")],
      ['n4', 'yesno', k('はい、よやく しなくても いいですよ。', "Yes, you don't need to book."), ['nakutemo-ii']],
      ['n4', 'what', t('ほけんしょうを 見せなければ なりません。', 'ほけんしょうを みせなければ なりません。', 'You have to show your insurance card.'), ['nakereba']],
    ],
  }),
];

/** Every line a question or answer could match, for subtitles and the phrasebook. */
export const ALL_LINES: readonly Line[] = [...QUESTIONS, ...SAFE_ANSWERS, ...BLUFFS, ...PLACES.flatMap((p) => [...p.questions, ...p.answers])];

/** The tourist's own card. */
export const TOURIST_ROLE: JpText = { text: '観光客', kana: 'かんこうきゃく', en: 'the tourist', furigana: [['観光客', 'かんこうきゃく']] };
