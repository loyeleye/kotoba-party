// Frame Concentration's deck (Green Car only; docs/modes/concentration.md, "Green Car"). Each gist is one
// situation: a picture (emoji for now) and a short English gist on one card, and the frame chunk that says it on
// its partner (＿ふりを する). To keep the pair a player says the whole sentence in their own words; `model` is
// the line we show on the TV and phones afterwards, never what was heard.
//
// 27 frames (12 N4, 15 N3), six gists each: two Kids, three Family, one Cheeky. Kids pools are school, pets,
// siblings, snacks and yōkai; lines that blame someone point at a yōkai, the weather or a prop. Cheeky is
// grown-up humour, never explicit, never aimed at a player.
//
// `anchor` lists the kana stems of the gist's key word: a say counts when framesOf finds the frame AND one stem is
// in what was heard, in any form (ねた, ねて, ねる). `anchorEn` names it for the miss tip and keeps two gists with
// the same key word off one board.
//
// Every line is draft until the fluent and taste checks. tests/frameConcentration.test.ts checks each model
// line against framesOf, its anchor, and that pictures and gists are unique.

import type { JpText } from '../../../../content/src/types.js';
import type { FrameId } from '../../japanese/frames.js';

export type GistAudience = 'kids' | 'family' | 'cheeky';

export interface Gist {
  id: string;
  frame: FrameId;
  audience: GistAudience;
  /** The picture: 2–3 emoji. Unique in the deck. */
  pic: string;
  /** The English gist on the card, 3–8 words. Unique in the deck. */
  en: string;
  /** The key word, in English, for the tip ("I heard ふり, but not *asleep*"). */
  anchorEn: string;
  /** Kana stems of the key word; any one in the heard reading counts. */
  anchor: readonly string[];
  /** Our model sentence, kana with spaces. */
  model: JpText;
  status: 'draft';
}

/** The frames on the deck, by side (ids from frames.ts; goals from path.ts). */
export const N4_DECK_FRAMES = ['ta-koto', 'te-shimau', 'potential', 'sou-look', 'you-to-omou', 'hou-ga-ii', 'node', 'sugiru', 'nagara', 'passive', 'yasui-nikui', 'tame-ni'] as const satisfies readonly FrameId[];
export const N3_DECK_FRAMES = [
  'furi',
  'hazu-datta',
  'zu-ni',
  'you-to-suru',
  'saserareru',
  'suffering-passive',
  'ppanashi',
  'tokoro-deshita',
  'sei-de',
  'okage-de',
  'tabi-ni',
  'totan',
  'buri',
  'ni-chigainai',
  'te-shouganai',
] as const satisfies readonly FrameId[];

let n = 0;
const g = (frame: FrameId, audience: GistAudience, pic: string, en: string, anchorEn: string, anchor: string[], kana: string): Gist => ({
  id: `${frame}.${audience[0]}${++n}`,
  frame,
  audience,
  pic,
  en,
  anchorEn,
  anchor,
  model: { text: kana, kana, en },
  status: 'draft',
});

export const GISTS: readonly Gist[] = [
  // ---- N4 ----
  // ＿た ことが あります (4.3)
  g('ta-koto', 'kids', '🐍✋', "I've touched a snake", 'snake', ['へび'], 'へびを さわった ことが あります。'),
  g('ta-koto', 'kids', '⛄🧤', "I've made a snowman", 'snowman', ['ゆきだるま'], 'ゆきだるまを つくった ことが あります。'),
  g('ta-koto', 'family', '🗻🥾', "I've climbed Mount Fuji", 'Mount Fuji', ['ふじさん'], 'ふじさんに のぼった ことが あります。'),
  g('ta-koto', 'family', '🐴🤠', "I've ridden a horse", 'horse', ['うま'], 'うまに のった ことが あります。'),
  g('ta-koto', 'family', '🫘🥢', "I've eaten natto", 'natto', ['なっとう'], 'なっとうを たべた ことが あります。'),
  g('ta-koto', 'cheeky', '👕💘', "I've gone on a date in pyjamas", 'pyjamas', ['ぱじゃま'], 'デートに パジャマで いった ことが あります。'),
  // ＿て しまいました (4.3)
  g('te-shimau', 'kids', '✏️❓', 'I lost my pencil case', 'pencil case', ['ふでばこ'], 'ふでばこを なくして しまいました。'),
  g('te-shimau', 'kids', '🍮😋', "I ate my brother's pudding", 'pudding', ['ぷりん'], 'おとうとの プリンを たべて しまいました。'),
  g('te-shimau', 'family', '☂️🚉', 'I left my umbrella at the station', 'umbrella', ['かさ'], 'えきに かさを わすれて しまいました。'),
  g('te-shimau', 'family', '📱🛁', 'I dropped my phone in the bath', 'phone', ['すまほ', 'けいたい'], 'スマホを おふろに おとして しまいました。'),
  g('te-shimau', 'family', '🎂😳', 'I ate the whole cake', 'cake', ['けえき'], 'ケーキを ぜんぶ たべて しまいました。'),
  g('te-shimau', 'cheeky', '💨👔', 'I farted in front of the boss', 'fart', ['おなら'], 'ぶちょうの まえで おならを して しまいました。'),
  // たべられます ／ よめます (4.4)
  g('potential', 'kids', '🚲😄', 'I can ride a bike', 'bike', ['じてんしゃ'], 'じてんしゃに のれます。'),
  g('potential', 'kids', '🏊2️⃣', 'I can swim twenty metres', 'swim', ['およ'], 'にじゅう メートル およげます。'),
  g('potential', 'family', '🍛🔥', 'I can eat spicy curry', 'curry', ['かれえ'], 'からい カレーが たべられます。'),
  g('potential', 'family', '🎹🎶', 'I can play the piano', 'piano', ['ぴあの'], 'ピアノが ひけます。'),
  g('potential', 'family', '⏰5️⃣', 'I can get up at five', 'five o’clock', ['ごじ'], 'あさ ごじに おきられます。'),
  g('potential', 'cheeky', '🍺💪', 'I can down a beer in one', 'beer', ['びいる'], 'ビールを いっきに のめます。'),
  // ＿そうです (4.6)
  g('sou-look', 'kids', '🐶💤', 'That dog looks sleepy', 'sleepy', ['ねむ'], 'あの いぬ、ねむそうです。'),
  g('sou-look', 'kids', '👻🏚️', 'This haunted house looks scary', 'haunted house', ['おばけやしき'], 'この おばけやしき、こわそうです。'),
  g('sou-look', 'family', '🎒🏋️', 'That bag looks heavy', 'heavy', ['おも'], 'あの かばん、おもそうです。'),
  g('sou-look', 'family', '🍜🌶️', 'This ramen looks spicy', 'ramen', ['らあめん'], 'この ラーメン、からそうです。'),
  g('sou-look', 'family', '❄️☁️', 'It looks like it will snow', 'snow', ['ゆき'], 'ゆきが ふりそうです。'),
  g('sou-look', 'cheeky', '👔😠', 'The boss looks grumpy today', 'mood', ['きげん'], 'ぶちょう、きょうは きげんが わるそうです。'),
  // ＿(よ)うと おもいます (4.7)
  g('you-to-omou', 'kids', '👵🏡', "I'm thinking of visiting Grandma", 'Grandma', ['おばあちゃん', 'そぼ'], 'なつやすみに おばあちゃんの いえに いこうと おもいます。'),
  g('you-to-omou', 'kids', '🐰🏠', "I'm thinking of getting a rabbit", 'rabbit', ['うさぎ'], 'うさぎを かおうと おもいます。'),
  g('you-to-omou', 'family', '⚽🚪', "I'm thinking of quitting the club", 'club', ['くらぶ', 'ぶかつ'], 'クラブを やめようと おもいます。'),
  g('you-to-omou', 'family', '📦🚚', "I'm thinking of moving house", 'move', ['ひっこ'], 'らいねん ひっこしを しようと おもいます。'),
  g('you-to-omou', 'family', '🏃👟', "I'm thinking of taking up jogging", 'jogging', ['じょぎんぐ'], 'ジョギングを はじめようと おもいます。'),
  g('you-to-omou', 'cheeky', '🏮🍻', "I'm thinking of hitting the izakaya", 'izakaya', ['いざかや'], 'こんやは いざかやに いこうと おもいます。'),
  // ＿た ほうが いいです (4.7)
  g('hou-ga-ii', 'kids', '🪥🦷', 'You should brush your teeth', 'brush', ['みが'], 'はを みがいた ほうが いいです。'),
  g('hou-ga-ii', 'kids', '🧢☀️', 'You should wear a hat', 'hat', ['ぼうし'], 'ぼうしを かぶった ほうが いいです。'),
  g('hou-ga-ii', 'family', '🥦🥕', 'You should eat your vegetables', 'vegetables', ['やさい'], 'やさいを たべた ほうが いいです。'),
  g('hou-ga-ii', 'family', '🏥🤒', 'You should see a doctor', 'doctor', ['びょういん', 'いしゃ'], 'びょういんに いった ほうが いいです。'),
  g('hou-ga-ii', 'family', '🎮🙅', "You'd better not game so much", 'games', ['げえむ'], 'あまり ゲームを しない ほうが いいです。'),
  g('hou-ga-ii', 'cheeky', '🍶🛑', "You'd better not drink any more", 'drink', ['のま', 'のみ', 'のむ', 'のん'], 'もう のまない ほうが いいです。'),
  // ＿ので (4.11)
  g('node', 'kids', '☔🏠', "It's raining, so I'll play inside", 'rain', ['あめ'], 'あめが ふって いるので、うちで あそびます。'),
  g('node', 'kids', '🤢🛌', 'My tummy hurts, so I’m staying home', 'tummy', ['おなか'], 'おなかが いたいので、きょうは やすみます。'),
  g('node', 'family', '🚃⏰', 'The train was late, so I was late', 'train', ['でんしゃ'], 'でんしゃが おくれたので、ちこくしました。'),
  g('node', 'family', '😩🛏️', "I'm tired, so I'll go to bed early", 'tired', ['つかれ'], 'つかれたので、はやく ねます。'),
  g('node', 'family', '🥶🪟', "It's cold, so please shut the window", 'window', ['まど'], 'さむいので、まどを しめて ください。'),
  g('node', 'cheeky', '🤕🍺', "I'm hungover, so please be quiet", 'hangover', ['ふつかよい'], 'ふつかよいなので、しずかに して ください。'),
  // ＿すぎます ／ ＿すぎて (4.11)
  g('sugiru', 'kids', '📺👀', 'Too much TV made my eyes hurt', 'TV', ['てれび'], 'テレビを みすぎて、めが いたいです。'),
  g('sugiru', 'kids', '👟📏', 'These shoes are too big', 'shoes', ['くつ'], 'この くつは おおきすぎます。'),
  g('sugiru', 'family', '☕🍬', 'This coffee is too sweet', 'coffee', ['こおひい'], 'この コーヒーは あますぎます。'),
  g('sugiru', 'family', '🏃🦵', 'I ran too much; my legs hurt', 'run', ['はしり', 'はしっ', 'はしる'], 'きのう はしりすぎて、あしが いたいです。'),
  g('sugiru', 'family', '🥵🏠', 'This room is too hot', 'hot', ['あつ'], 'この へやは あつすぎます。'),
  g('sugiru', 'cheeky', '🍻🤯', 'I drank too much last night', 'drank', ['のみ', 'のん', 'のむ'], 'ゆうべ のみすぎて、あたまが いたいです。'),
  // ＿ながら (4.11)
  g('nagara', 'kids', '🎧📝', 'I do homework listening to music', 'music', ['おんがく'], 'おんがくを ききながら、しゅくだいを します。'),
  g('nagara', 'kids', '🍦🚶', 'I walked along eating ice cream', 'ice cream', ['あいす'], 'アイスを たべながら、あるきました。'),
  g('nagara', 'family', '📻🍳', 'I cook while listening to the radio', 'radio', ['らじお'], 'ラジオを ききながら、りょうりを します。'),
  g('nagara', 'family', '☕📰', 'I read the paper over coffee', 'newspaper', ['しんぶん'], 'コーヒーを のみながら、しんぶんを よみます。'),
  g('nagara', 'family', '🚿🎤', 'I sing in the shower', 'shower', ['しゃわあ'], 'うたいながら、シャワーを あびます。'),
  g('nagara', 'cheeky', '💻🍺', 'I joined the meeting drinking beer', 'meeting', ['かいぎ'], 'ビールを のみながら、かいぎに でました。'),
  // ＿れました ／ ＿られました (4.13)
  g('passive', 'kids', '🧑‍🏫👏', 'The teacher praised my essay', 'praised', ['ほめ'], 'せんせいに さくぶんを ほめられました。'),
  g('passive', 'kids', '🐕👞', 'A dog hid my shoe', 'hid', ['かくさ', 'かくし', 'かくす'], 'いぬに くつを かくされました。'),
  g('passive', 'family', '🐝😖', 'A bee stung me', 'bee', ['はち'], 'ハチに さされました。'),
  g('passive', 'family', '🗺️🙋', 'A stranger asked me the way', 'the way', ['みち'], 'しらない ひとに みちを きかれました。'),
  g('passive', 'family', '🏫📣', 'The head teacher called me in', 'called', ['よば'], 'こうちょう せんせいに よばれました。'),
  g('passive', 'cheeky', '💔😭', 'My girlfriend dumped me', 'dumped', ['ふら'], 'かのじょに ふられました。'),
  // ＿やすい ／ ＿にくい (4.13)
  g('yasui-nikui', 'kids', '📘👍', 'This book is easy to read', 'book', ['ほん'], 'この ほんは よみやすいです。'),
  g('yasui-nikui', 'kids', '🍙😣', 'This rice ball is hard to eat', 'rice ball', ['おにぎり'], 'この おにぎりは たべにくいです。'),
  g('yasui-nikui', 'family', '🪑😌', 'This chair is easy to sit in', 'chair', ['いす'], 'この いすは すわりやすいです。'),
  g('yasui-nikui', 'family', '💊😖', 'This medicine is hard to swallow', 'medicine', ['くすり'], 'この くすりは のみにくいです。'),
  g('yasui-nikui', 'family', '🏘️😊', 'This town is easy to live in', 'town', ['まち'], 'この まちは すみやすいです。'),
  g('yasui-nikui', 'cheeky', '👔🧊', 'My boss is hard to talk to', 'boss', ['ぶちょう', 'じょうし'], 'うちの ぶちょうは はなしかけにくいです。'),
  // ＿ために (4.14)
  g('tame-ni', 'kids', '⚽📅', 'I practise daily to play in the match', 'football', ['さっかあ', 'しあい'], 'サッカーの しあいに でる ために、まいにち れんしゅうします。'),
  g('tame-ni', 'kids', '🏃🏅', 'I train to win sports day', 'sports day', ['うんどうかい'], 'うんどうかいで かつ ために、はしる れんしゅうを します。'),
  g('tame-ni', 'family', '💴✈️', "I'm saving up to go to Japan", 'Japan', ['にほん'], 'にほんに いく ために、おかねを ためて います。'),
  g('tame-ni', 'family', '🚶⚖️', 'I walk every morning for my diet', 'diet', ['だいえっと'], 'ダイエットの ために、まいあさ あるきます。'),
  g('tame-ni', 'family', '📚✅', "I'm studying to get into a good university", 'university', ['だいがく'], 'いい だいがくに はいる ために、べんきょうして います。'),
  g('tame-ni', 'cheeky', '💪😍', 'I go to the gym to be popular', 'gym', ['じむ'], 'もてる ために、ジムに かよって います。'),

  // ---- N3 ----
  // ＿ふりを する (3.6)
  g('furi', 'kids', '😴🍽️', 'I pretended to be asleep (no dishes!)', 'asleep', ['ねた', 'ねて', 'ねる', 'ねむ'], 'おさらを あらいたく なくて、ねた ふりを しました。'),
  g('furi', 'kids', '🙈📝', "I pretended I didn't know about the test", 'test', ['てすと'], 'テストの ことを しらない ふりを しました。'),
  g('furi', 'family', '📞🙉', "I pretended I didn't hear the phone", 'phone call', ['でんわ'], 'でんわに きづかない ふりを しました。'),
  g('furi', 'family', '😊🤒', 'I pretended to be fine', 'fine', ['げんき', 'だいじょうぶ'], 'げんきな ふりを しました。'),
  g('furi', 'family', '👨🤣', "I pretended Dad's joke was funny", 'joke', ['ぎゃぐ', 'じょうだん'], 'おとうさんの ギャグが おもしろい ふりを しました。'),
  g('furi', 'cheeky', '💘🥱', 'I pretended to like my date', 'date', ['でえと'], 'デートの あいてに きょうみが ある ふりを しました。'),
  // ＿はずだった (3.6)
  g('hazu-datta', 'kids', '🚌☔', 'Today was meant to be the school trip', 'school trip', ['えんそく'], 'きょうは えんそくの はずだったのに、あめでした。'),
  g('hazu-datta', 'kids', '🥒👹', 'The kappa was supposed to come and play', 'kappa', ['かっぱ'], 'かっぱが あそびに くる はずでした。'),
  g('hazu-datta', 'family', '🚏🕙', 'The bus was supposed to come at ten', 'bus', ['ばす'], 'バスは じゅうじに くる はずでした。'),
  g('hazu-datta', 'family', '📅😩', 'Today was supposed to be my day off', 'day off', ['やすみ'], 'きょうは やすみの はずだったのに、しごとに よばれました。'),
  g('hazu-datta', 'family', '📦❓', 'The parcel was due yesterday', 'parcel', ['にもつ'], 'にもつは きのう とどく はずでした。'),
  g('hazu-datta', 'cheeky', '🥂💔', 'Tonight was meant to be a group date', 'group date', ['ごうこん'], 'こんやは ごうコンの はずだったのに、だれも きませんでした。'),
  // ＿ずに (3.6)
  g('zu-ni', 'kids', '🦷🛌', 'I went to bed without brushing my teeth', 'teeth', ['はみがき', 'みがか'], 'はみがきを せずに ねて しまいました。'),
  g('zu-ni', 'kids', '📒⚽', 'I went to play without doing homework', 'homework', ['しゅくだい'], 'しゅくだいを せずに あそびに いきました。'),
  g('zu-ni', 'family', '📕🚫', 'I read it without a dictionary', 'dictionary', ['じしょ'], 'じしょを つかわずに よみました。'),
  g('zu-ni', 'family', '🔑🚪', 'I went out without locking up', 'lock', ['かぎ'], 'かぎを かけずに でかけました。'),
  g('zu-ni', 'family', '📝❔', 'I handed in the test without my name', 'name', ['なまえ'], 'なまえを かかずに テストを だしました。'),
  g('zu-ni', 'cheeky', '💍🤫', 'I got married without telling my parents', 'married', ['けっこん'], 'りょうしんに いわずに けっこんしました。'),
  // ＿ようと しました (3.6)
  g('you-to-suru', 'kids', '🐈🤲', 'I tried to hold the cat; it ran off', 'cat', ['ねこ'], 'ねこを だっこしようと しましたが、にげられました。'),
  g('you-to-suru', 'kids', '👻📷', 'I tried to take a photo of a ghost', 'ghost', ['ゆうれい', 'おばけ'], 'ゆうれいの しゃしんを とろうと しました。'),
  g('you-to-suru', 'family', '🚪🌧️', 'Just as I went out, it rained', 'go out', ['でかけ'], 'でかけようと したら、あめが ふって きました。'),
  g('you-to-suru', 'family', '🚪🔒', "I tried to open the door; it wouldn't", 'door', ['どあ'], 'ドアを あけようと しましたが、あきませんでした。'),
  g('you-to-suru', 'family', '🍞🔥', 'I tried to bake bread and burnt it', 'bread', ['ぱん'], 'パンを やこうと しましたが、こがして しまいました。'),
  g('you-to-suru', 'cheeky', '💌😵', 'I tried to confess my love and fluffed it', 'confess', ['こくはく'], 'こくはくしようと しましたが、かんで しまいました。'),
  // ＿させられました (3.2)
  g('saserareru', 'kids', '🫑😖', 'I was made to eat green peppers', 'green peppers', ['ぴいまん'], 'ピーマンを たべさせられました。'),
  g('saserareru', 'kids', '🥒🤼', 'A kappa made me do sumo', 'sumo', ['すもう'], 'かっぱに すもうを させられました。'),
  g('saserareru', 'family', '🧹🛏️', 'Mum made me tidy my room', 'tidy', ['かたづけ'], 'ははに へやを かたづけさせられました。'),
  g('saserareru', 'family', '⏳🌧️', 'I was kept waiting an hour in the rain', 'wait', ['またさ', 'まって', 'まった', 'まつ'], 'あめの なか、いちじかん またされました。'),
  g('saserareru', 'family', '✍️📚', 'I was made to write kanji every day', 'kanji', ['かんじ'], 'まいにち かんじを かかされました。'),
  g('saserareru', 'cheeky', '🎤🍻', 'I was made to sing at the work party', 'sing', ['うた'], 'のみかいで うたわされました。'),
  // ＿に ＿(ら)れて (3.2)
  g('suffering-passive', 'kids', '🍪👧', 'My little sister ate my snacks', 'snacks', ['おかし'], 'いもうとに おかしを たべられました。'),
  g('suffering-passive', 'kids', '🐦🍙', 'A crow took my rice ball', 'crow', ['からす'], 'からすに おにぎりを とられました。'),
  g('suffering-passive', 'family', '☔😫', 'I got caught in the rain', 'caught in rain', ['ふら', 'ふって'], 'かえりに あめに ふられました。'),
  g('suffering-passive', 'family', '🔊🌙', 'The neighbours were noisy all night', 'noisy', ['さわが'], 'となりの ひとに よる おそくまで さわがれました。'),
  g('suffering-passive', 'family', '👶🌙', "The baby cried and I couldn't sleep", 'baby', ['あかちゃん'], 'あかちゃんに よなかに なかれて、ねられませんでした。'),
  g('suffering-passive', 'cheeky', '🍺😤', 'My boyfriend drank all my beer', 'beer', ['びいる'], 'かれしに ビールを ぜんぶ のまれました。'),
  // ＿っぱなし (3.2)
  g('ppanashi', 'kids', '🧊🚪', 'I left the fridge open and got told off', 'fridge', ['れいぞうこ'], 'れいぞうこを あけっぱなしに して、おこられました。'),
  g('ppanashi', 'kids', '🚰💦', 'I left the tap running', 'tap water', ['みず', 'すいどう'], 'すいどうの みずを だしっぱなしに して しまいました。'),
  g('ppanashi', 'family', '❄️🧳', 'I went away with the air con on', 'air con', ['えあこん'], 'エアコンを つけっぱなしで りょこうに いきました。'),
  g('ppanashi', 'family', '🧍🦵', 'I was on my feet all day', 'standing', ['たちっ', 'たちっぱなし'], 'いちにちじゅう たちっぱなしで、あしが いたいです。'),
  g('ppanashi', 'family', '⚾📉', 'This team keeps on losing', 'losing', ['まけ'], 'この チームは まけっぱなしです。'),
  g('ppanashi', 'cheeky', '🥴💡', 'I got drunk and slept with the light on', 'drunk', ['よっぱら'], 'よっぱらって、でんきを つけっぱなしで ねました。'),
  // ＿ところでした (3.2)
  g('tokoro-deshita', 'kids', '🤸💥', 'I nearly fell over', 'fall over', ['ころ'], 'もう すこしで ころぶ ところでした。'),
  g('tokoro-deshita', 'kids', '🐈👣', 'I nearly stepped on the cat', 'step on', ['ふみ', 'ふむ', 'ふん'], 'もう すこしで ねこを ふむ ところでした。'),
  g('tokoro-deshita', 'family', '👛😅', 'I nearly forgot my wallet', 'wallet', ['さいふ'], 'もう すこしで さいふを わすれる ところでした。'),
  g('tokoro-deshita', 'family', '⏰😱', 'I nearly overslept', 'oversleep', ['ねすご', 'ねぼう'], 'あぶなく ねすごす ところでした。'),
  g('tokoro-deshita', 'family', '🚗😨', 'A car nearly hit me', 'car', ['くるま'], 'もう すこしで くるまに ぶつかる ところでした。'),
  g('tokoro-deshita', 'cheeky', '📧😳', 'I nearly sent the boss a weird message', 'message', ['めえる', 'めっせえじ'], 'もう すこしで ぶちょうに へんな メールを おくる ところでした。'),
  // ＿せいで (3.3)
  g('sei-de', 'kids', '🌬️🧢', 'The wind blew my hat away', 'wind', ['かぜ'], 'かぜの せいで、ぼうしが とんで いきました。'),
  g('sei-de', 'kids', '👹👟', 'A prank yōkai took one of my shoes', 'yōkai', ['ようかい'], 'いたずら ようかいの せいで、くつが かたほう ありません。'),
  g('sei-de', 'family', '🌀✈️', 'The typhoon grounded the plane', 'typhoon', ['たいふう'], 'たいふうの せいで、ひこうきが とびませんでした。'),
  g('sei-de', 'family', '☕😳', "Coffee kept me awake all night", 'coffee', ['こおひい'], 'コーヒーの せいで、ねられませんでした。'),
  g('sei-de', 'family', '🚧🚃', 'An accident stopped the train', 'accident', ['じこ'], 'じこの せいで、でんしゃが とまりました。'),
  g('sei-de', 'cheeky', '🧄😷', "Last night's garlic keeps people away", 'garlic', ['にんにく'], 'ゆうべの にんにくの せいで、だれも ちかくに きません。'),
  // ＿おかげで (3.3)
  g('okage-de', 'kids', '🐕🌳', 'Thanks to the dog, I walk every day', 'dog', ['いぬ'], 'いぬの おかげで、まいにち さんぽして います。'),
  g('okage-de', 'kids', '🏠✨', 'Thanks to the house spirit, I got 100%', '100 points', ['ひゃくてん'], 'ざしきわらしの おかげで、テストで ひゃくてんを とりました。'),
  g('okage-de', 'family', '🗺️👍', "Thanks to the map, I didn't get lost", 'map', ['ちず'], 'ちずの おかげで、みちに まよいませんでした。'),
  g('okage-de', 'family', '💨😴', 'Thanks to the fan, I slept well', 'fan', ['せんぷうき'], 'せんぷうきの おかげで、よく ねられました。'),
  g('okage-de', 'family', '🧑‍🏫🎓', 'Thanks to my teacher, I passed', 'teacher', ['せんせい'], 'せんせいの おかげで、しけんに うかりました。'),
  g('okage-de', 'cheeky', '💧🍻', 'Thanks to water, no hangover', 'hangover', ['ふつかよい'], 'みずを たくさん のんだ おかげで、ふつかよいに なりませんでした。'),
  // ＿たびに (3.9)
  g('tabi-ni', 'kids', '🎵💃', 'Every time I hear this song, I dance', 'song', ['うた'], 'この うたを きく たびに、おどりたく なります。'),
  g('tabi-ni', 'kids', '🛝🤕', 'Every time I go to the park, I fall', 'park', ['こうえん'], 'こうえんに いく たびに、ころびます。'),
  g('tabi-ni', 'family', '🧳☂️', 'Every trip, I lose an umbrella', 'trip', ['りょこう'], 'りょこうに いく たびに、かさを なくします。'),
  g('tabi-ni', 'family', '🖼️😂', 'Every time I see this photo, I laugh', 'photo', ['しゃしん'], 'この しゃしんを みる たびに、わらって しまいます。'),
  g('tabi-ni', 'family', '📦📈', 'Every move, I end up with more stuff', 'move', ['ひっこ'], 'ひっこす たびに、ものが ふえます。'),
  g('tabi-ni', 'cheeky', '🍻🔁', 'Every work party, the boss tells the same story', 'work party', ['のみかい'], 'のみかいの たびに、ぶちょうが おなじ はなしを します。'),
  // ＿た とたん（に） (3.9)
  g('totan', 'kids', '🏠🌧️', 'The moment I left home, it rained', 'home', ['いえ', 'うち'], 'いえを でた とたん、あめが ふって きました。'),
  g('totan', 'kids', '🐶📢', 'The moment it saw the cat, the dog barked', 'barked', ['ほえ'], 'いぬは ねこを みた とたん、ほえました。'),
  g('totan', 'family', '🛋️😴', 'The moment I sat down, I fell asleep', 'sat down', ['すわ'], 'すわった とたん、ねて しまいました。'),
  g('totan', 'family', '☂️☀️', 'The moment I bought an umbrella, it cleared', 'cleared up', ['はれ'], 'かさを かった とたん、はれました。'),
  g('totan', 'family', '🚉😱', 'Off the train, I remembered my bag', 'left something', ['わすれもの', 'わすれ'], 'でんしゃを おりた とたん、わすれものに きづきました。'),
  g('totan', 'cheeky', '🍺😳', 'One sip of beer and my face went red', 'red', ['まっか', 'あか'], 'ビールを のんだ とたん、かおが まっかに なりました。'),
  // ＿ぶり (3.9)
  g('buri', 'kids', '👫📅', 'First time seeing my cousin in a year', 'cousin', ['いとこ'], 'いちねんぶりに いとこに あいました。'),
  g('buri', 'kids', '🎡🎉', 'Back at the funfair after two years', 'funfair', ['ゆうえんち'], 'にねんぶりに ゆうえんちに いきました。'),
  g('buri', 'family', '🤝⏳', 'I met my friend after three years', 'friend', ['ともだち'], 'さんねんぶりに ともだちに あいました。'),
  g('buri', 'family', '🚴⌛', 'On a bike again after eight years', 'bike', ['じてんしゃ'], 'はちねんぶりに じてんしゃに のりました。'),
  g('buri', 'family', '🏡🚄', 'Home again after five years', 'hometown', ['ふるさと', 'じっか'], 'ごねんぶりに ふるさとに かえりました。'),
  g('buri', 'cheeky', '💑🗓️', 'My first date in three years', 'date', ['でえと'], 'さんねんぶりに デートを しました。'),
  // ＿に ちがいありません (3.10)
  g('ni-chigainai', 'kids', '🦊🍮', 'The fox must have eaten the pudding', 'fox', ['きつね'], 'プリンを たべたのは きつねに ちがいありません。'),
  g('ni-chigainai', 'kids', '👻🔊', 'That noise must be a ghost', 'ghost', ['おばけ', 'ゆうれい'], 'あの おとは おばけに ちがいありません。'),
  g('ni-chigainai', 'family', '🔑👜', 'The keys must be in my bag', 'keys', ['かぎ'], 'かぎは かばんの なかに あるに ちがいありません。'),
  g('ni-chigainai', 'family', '💎🏬', 'That shop must be expensive', 'shop', ['みせ'], 'あの みせは たかいに ちがいありません。'),
  g('ni-chigainai', 'family', '🌅📅', 'Tomorrow will surely be sunny', 'sunny', ['はれ'], 'あしたは はれるに ちがいありません。'),
  g('ni-chigainai', 'cheeky', '📧🥴', 'This email must have been written drunk', 'drunk', ['よっぱら'], 'この メールは よっぱらって かいたに ちがいありません。'),
  // ＿て しょうがない (3.11)
  g('te-shouganai', 'kids', '🏖️🤩', "I can't wait for the summer holidays", 'summer holidays', ['なつやすみ'], 'なつやすみが たのしみで しょうがないです。'),
  g('te-shouganai', 'kids', '🦟😖', 'My leg is so itchy', 'itchy', ['かゆ'], 'あしが かゆくて しょうがないです。'),
  g('te-shouganai', 'family', '🌞🥵', "It's unbearably hot", 'hot', ['あつ'], 'あつくて しょうがないです。'),
  g('te-shouganai', 'family', '🍽️😩', "I'm starving", 'hungry', ['おなか', 'はら'], 'おなかが すいて しょうがないです。'),
  g('te-shouganai', 'family', '📄😬', "I can't stop worrying about my results", 'results', ['けっか'], 'しけんの けっかが きに なって しょうがないです。'),
  g('te-shouganai', 'cheeky', '🚽😣', "I'm dying for the loo", 'loo', ['といれ'], 'トイレに いきたくて しょうがないです。'),
];
