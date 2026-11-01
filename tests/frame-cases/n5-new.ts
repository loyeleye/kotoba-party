// Test lines for sentence frames (tests/frames.test.ts). Positives contain the frame; look-alikes don't.
import type { FrameCases } from './types.js';

export const cases: FrameCases = {
  'ikura': {
    pos: [
      'いくらですか。',
      'きっぷは、いくらですか。',
      { text: 'お会計は、いくらですか。', kana: 'おかいけいは、いくらですか。' },
      { text: 'お弁当は650円です。1000円を出しました。おつりはいくらですか。', kana: 'おべんとうはろっぴゃくごじゅうえんです。せんえんをだしました。おつりはいくらですか。' },
      'この ちょうちんは いくらですか？', // (probe)
      { text: 'すみません、この お守りは いくらですか。', kana: 'すみません、この おまもりは いくらですか。' }, // (probe)
      'おとなは いくらですか。こどもは？', // (probe)
      'ろてんぶろは いくらですか', // (probe)
      { text: '東京まで いくらですか。', kana: 'とうきょうまで いくらですか。' }, // (probe)
      'ラーメンと ぎょうざで いくらですか。', // (probe)
    ],
    neg: [
      ['いくらの おすしを ください。', 'いくら = salmon roe, a food'], // (probe)
      [{ text: 'いくら丼が 大好きです。', kana: 'いくらどんが だいすきです。' }, 'salmon-roe bowl, not a price question'], // (probe)
      ['この いくら、おいしいですね！', 'いくら = salmon roe, followed by an adjective + です'], // (probe)
      ['いくらと うにが のって います。', 'salmon roe and sea urchin on top'], // (probe)
      ['りんごは いくつですか。', 'いくつ = how many, one kana off'], // (probe)
      ['おいくつですか。', 'おいくつ = how old / how many, not price'], // (probe)
      ['いくらでも たべて ください。', 'いくらでも = as much as you like'], // (probe)
      ['いくら よんでも、おきません。', 'いくら〜ても = no matter how much'], // (probe)
      ['いくらか おかねが あります。', 'いくらか = some, a little'], // (probe)
      ['ポンは ラーメンやに いくらしいです。', 'いく + らしい (apparently goes); いくら only as a substring'], // (probe)
    ],
  },
  'ji-fun': {
    pos: [
      'いまさんじはんです',
      'くじはんに コーヒーを のみます。',
      '11じはんに、えんかいの へやに いました。',
      'さんじ じゅっぷんです。', // (probe)
      { text: '7時半です。', kana: 'しちじはんです。' }, // (probe)
      { text: '電車は 8時15分に 来ます。', kana: 'でんしゃは はちじじゅうごふんに きます。' }, // (probe)
      'いま なんじ なんぷんですか。', // (probe)
      'ごぜん じゅうじ よんじゅっぷんに おきました。', // (probe)
      { text: '終電は 0時5分です！', kana: 'しゅうでんは れいじごふんです！' }, // (probe)
      'くじ ろっぷんの でんしゃに のりましょう。', // (probe)
    ],
    neg: [
      ['じぶんで つくりました。', 'じぶん = oneself; じ + ぶ, not a clock time'], // (probe)
      ['この かんじは むずかしいです。', 'じ inside かんじ'], // (probe)
      ['じしょを かして ください。', 'じ inside じしょ'], // (probe)
      ['ふんすいの まえで まって います。', 'ふん inside ふんすい (fountain)'], // (probe)
      ['ふんいきが いいですね。', 'ふん inside ふんいき (atmosphere)'], // (probe)
      ['ごふんだけ まって ください。', 'ふん as a duration (five minutes), no hour: not a clock time'], // (probe)
      ['さんじかん ねました。', 'じかん = hours (duration), not o’clock'], // (probe)
      ['すごい すごい！　インクで にじを かきます！', 'にじ = rainbow, homophone of 2時'],
      ['すうじを かいて ください。', 'じ inside すうじ (number)'], // (probe)
      ['じゅうぶんです、ありがとう。', 'じゅうぶん = enough; じゅう + ぶん is not じ + ふん'], // (probe)
    ],
  },
  'ni-masu': {
    pos: [
      'こうえんに いきます。',
      'しちじに おきます。',
      'ごぜん くじに かいしゃに きます。',
      'この でんしゃは しんじゅくに いきますか。',
      { text: '毎晩 11時に 寝ます。', kana: 'まいばん じゅういちじに ねます。' }, // (probe)
      { text: 'あした 京都に 行きます。', kana: 'あした きょうとに いきます。' }, // (probe)
      { text: '夜 ろうそくの 部屋に 入ります。', kana: 'よる ろうそくの へやに はいります。' }, // (probe)
      'ろくじに ばんごはんを たべます。', // (probe)
      'ゆうれいは まいばん にかいに あがります。', // (probe)
      'くじはんに しゅっぱつします。', // (probe)
    ],
    neg: [
      ['えきの まえに あります。', 'に + あります is existence, a different frame'],
      ['ねこが へやに います。', 'に + います is existence, a different frame'], // (probe)
      ['しんごうが あおに なりました。', '〜に なる = become (excluded)'], // (probe)
      ['にほんごが じょうずに なりたいです。', '〜に なる = become, and たいです, not a polite verb'], // (probe)
      ['ともだちと いっしょに いきます。', 'いっしょに is an adverb, not a destination'],
      ['しずかに たべます。', 'na-adjective + に used as an adverb'], // (probe)
      ['きょうは ほんとうに たのしかったです。', 'ほんとうに is an adverb; no ます verb'], // (probe)
      ['ともだちに あいます。', 'に marks the person met, not a destination or time'], // (probe)
      ['にほんで にくを たべます。', 'に only inside にほん and にく; no に particle'], // (probe)
      ['あしたは ろくじに おきる。', 'time に with a plain verb, not a polite ます verb'], // (probe)
    ],
  },
  'youbi': {
    pos: [
      'きょうはげつようびです。あしたはなんようびですか。',
      'げつようびから きんようびまで いきます。',
      'あれ？ きょうは どようびだ。',
      'きょうが なんようびか わかりませんでした。',
      { text: '金曜日の 夜、ひまですか。', kana: 'きんようびの よる、ひまですか。' }, // (probe)
      { text: '水曜日に 会いましょう。', kana: 'すいようびに あいましょう。' }, // (probe)
      { text: '日曜日は 休みです。', kana: 'にちようびは やすみです。' }, // (probe)
      'もくようびの テストは むずかしかった。', // (probe)
      'かようびに おばけが でます。', // (probe)
      { text: '火曜日と木曜日に ジムに 行きます。', kana: 'かようびともくようびに ジムに いきます。' }, // (probe)
    ],
    neg: [
      ['ことばの ようかいです！　ひとり ひとつ！', 'よう inside ようかい'],
      ['こんにちは。ぼくの ほしへ ようこそ。', 'よう inside ようこそ'],
      ['どうようを うたいましょう。', 'どうよう (children’s song) looks like どようび'], // (probe)
      ['ちょっと ようじが あります。', 'よう inside ようじ (errand)'], // (probe)
      ['ようふくを かいました。', 'よう inside ようふく (clothes)'], // (probe)
      ['ひようは いくらですか。', 'よう inside ひよう (cost)'], // (probe)
      ['たいようが まぶしい！', 'よう inside たいよう (sun)'], // (probe)
      ['まいにち たのしいです。', 'にち inside まいにち, not a weekday'], // (probe)
      [{ text: '月が きれいですね。', kana: 'つきが きれいですね。' }, '月 = moon, not 月曜日'], // (probe)
      [{ text: '土の 中に います。', kana: 'つちの なかに います。' }, '土 = soil, not 土曜日'], // (probe)
    ],
  },
  'gatsu-nichi': {
    pos: [
      'いちがつ ついたちに おもちを たべすぎます。',
      'ごがつ いつかに こいのぼりに なります。',
      'しがつ ついたちに うそを つきます。',
      'くがつここのかです',
      { text: '誕生日は 7月7日です。', kana: 'たんじょうびは しちがつなのかです。' }, // (probe)
      { text: 'きょうは 何月何日ですか。', kana: 'きょうは なんがつなんにちですか。' }, // (probe)
      'じゅうにがつ にじゅうよっかに パーティーを します。', // (probe)
      { text: '3月20日に 日本へ 来ました。', kana: 'さんがつはつかに にほんへ きました。' }, // (probe)
      'はちがつ じゅうごにちは おぼんです。', // (probe)
      'ろくがつ ふつかの よる、ゆうれいを みました。', // (probe)
    ],
    neg: [
      ['まいにち べんきょうします。', 'にち inside まいにち (every day)'], // (probe)
      ['にちようびは やすみです。', 'a weekday, not a date'], // (probe)
      ['がっこうに いきます。', 'がっ inside がっこう'], // (probe)
      ['さいあくの いちにち、はじまり はじまり！', 'いちにち = one (whole) day, not the 1st'],
      ['おしょうがつに おもちを たべます。', 'がつ inside おしょうがつ (New Year)'], // (probe)
      ['こんにちは。つきから きました、うさぎの モチです。', 'にち inside こんにちは'],
      ['ふつかよいです…', 'ふつかよい = hangover; ふつか inside a word'], // (probe)
      ['がっかりしました。', 'がっ inside がっかり'], // (probe)
      [{ text: '日本の 月は きれいです。', kana: 'にほんの つきは きれいです。' }, '日 and 月 as kanji, but Japan and the moon'], // (probe)
      ['みっかかん かかりました。', 'みっかかん = three days (duration), not the 3rd'], // (probe)
    ],
  },
  'wa-ni-aru': {
    pos: [
      '2じはん：ポチは しょくどうに いた。',
      'トイレは どこに ありますか。', // (probe)
      { text: '駅は 公園の 前に あります。', kana: 'えきは こうえんの まえに あります。' }, // (probe)
      'ポンは いま ロビーに います。', // (probe)
      { text: '先生は 二階に いますか。', kana: 'せんせいは にかいに いますか。' }, // (probe)
      'かぎは かばんの なかに ありました。', // (probe)
      { text: 'お風呂は 一階に あります。', kana: 'おふろは いっかいに あります。' }, // (probe)
      'ゆうれいは にわに いません。', // (probe)
      'わたしの へやは さんがいに あります。', // (probe)
      { text: '犯人は この部屋に います！', kana: 'はんにんは このへやに います！' }, // (probe)
    ],
    neg: [
      ['つくえの うえに ほんが あります。', '＿に ＿が あります (there is), the neighbouring frame'], // (probe)
      ['にわに ねこが います。', '＿に ＿が います (there is), the neighbouring frame'], // (probe)
      ['ポンは テレビを みて います。', 'は + 〜て います (ongoing), not existence'], // (probe)
      ['かいさつの まえで まって います。', 'で + 〜て います, not に + いる'],
      ['ゆうれいは にわで あそんで います。', 'は ＿で 〜て います; place marked by で, verb is ている'], // (probe)
      ['わたしは いもうとが います。', 'は ＿が います (have a sibling), no location に'], // (probe)
      ['あしたは しごとが あります。', 'は … あります (have work), no location に'], // (probe)
      ['ポンは いしゃに なります。', 'は ＿に なります (become)'], // (probe)
      ['こどもは こうえんに いきます。', 'は ＿に いきます (goes to), motion not existence'], // (probe)
      ['しゅくだいは ありますか。', 'は あります with no location'], // (probe)
    ],
  },
  'migi-hidari': {
    pos: [
      'えきの まえに あります。',
      'がっこうの となりに あります。',
      'となりの ひとの かたで ねないで ください。',
      { text: '次の 角を 右に 曲がって ください。', kana: 'つぎの かどを みぎに まがって ください。' }, // (probe)
      { text: 'かばんは 机の 上に あります。', kana: 'かばんは つくえの うえに あります。' }, // (probe)
      'ひだりの ドアから でて ください。', // (probe)
      'ベッドの したに おばけが いる！', // (probe)
      { text: '箱の 中に 何が ありますか。', kana: 'はこの なかに なにが ありますか。' }, // (probe)
      'ポンの うしろに だれか いますよ。', // (probe)
      'みぎの ボタンを おして ください。', // (probe)
    ],
    neg: [
      ['あなたの なまえは', 'まえ inside なまえ'],
      ['おなかが いっぱいです。', 'なか inside おなか'],
      ['しゅくだいを もう した？', 'した = past of する'], // (probe)
      ['カラオケが したいです。', 'した inside したい (want to do)'], // (probe)
      ['うえだせんせいは やさしいです。', 'うえ inside the name うえだ'], // (probe)
      ['もう まえに いいました。', 'まえに = before (time), not a position'], // (probe)
      ['なかなか おいしいです。', 'なか inside なかなか'], // (probe)
      ['したしい ともだちです。', 'した inside したしい (close)'], // (probe)
      ['なかまに なりました。', 'なか inside なかま (companion), followed by に'], // (probe)
      ['うえきに みずを あげます。', 'うえ inside うえき (potted plant), followed by に'], // (probe)
    ],
  },
  'hoshii': {
    pos: [
      'みずがほしいです。てんいんさんに？',
      { text: '終点、星見台です。時間がほしい……星だけに。', kana: 'しゅうてん、ほしみだいです。じかんがほしい……ほしだけに。' },
      'こわがらないで。サインが ほしい だけ なんです。',
      { text: '新しい 傘が ほしいです。', kana: 'あたらしい かさが ほしいです。' }, // (probe)
      'なにが ほしいですか。', // (probe)
      { text: '誕生日に 何が ほしい？', kana: 'たんじょうびに なにが ほしい？' }, // (probe)
      'ゆうれいの ともだちが ほしいなあ。', // (probe)
      'おみやげが ほしいです。', // (probe)
      'ちいさい いぬが ほしいです。', // (probe)
      'あたらしい くつが ほしい。', // (probe)
    ],
    neg: [
      ['ほしが きれいですね。', 'ほし = star; ほし + が looks like the frame'], // (probe)
      ['こんにちは。ぼくの ほしへ ようこそ。', 'ほし = planet/star'],
      ['ほしいもを たべました。', 'ほしいも = dried sweet potato; ほしい as a substring'], // (probe)
      ['ほしがきを ください。', 'ほしがき = dried persimmon; ほしが as a substring'], // (probe)
      ['せんたくものを ほします。', 'ほします = hang out to dry'], // (probe)
      ['まどを しめて ほしいです。', '〜て ほしい = want someone to do, a different frame'], // (probe)
      ['ほしぞらの したで あいましょう。', 'ほし inside ほしぞら (starry sky)'], // (probe)
      ['おしい！　つぎ、いきましょう！', 'おしい (so close), one kana off ほしい'],
      ['ゆうれいが ほしを みて います。', 'ほし = star, object of みる'], // (probe)
      ['ほしくずが おちました！', 'ほし inside ほしくず (stardust)'], // (probe)
    ],
  },
  'de-o': {
    pos: [
      'ごぜん にじに コンビニで アイスを かいます。',
      'ここで なにを まちますか。',
      { text: 'ここで 何を しますか。', kana: 'ここで なにを しますか。' },
      'すごい すごい！　インクで にじを かきます！',
      'こうえんで おべんとうを たべます。', // (probe)
      { text: '箸で すしを 食べます。', kana: 'はしで すしを たべます。' }, // (probe)
      { text: '駅で 友だちを 待ちました。', kana: 'えきで ともだちを まちました。' }, // (probe)
      'ろてんぶろで おさけを のみましょう。', // (probe)
      'でんわで ピザを ちゅうもんします。', // (probe)
      { text: '図書館で 日本語を 勉強します。', kana: 'としょかんで にほんごを べんきょうします。' }, // (probe)
    ],
    neg: [
      ['ほんを よんで ください。', 'よんで is a て-form, not the particle で'], // (probe)
      ['ジュースを のんで、ねました。', 'を + て-form のんで, no place/means で'], // (probe)
      ['でんしゃを まちます。', 'で inside でんしゃ'], // (probe)
      ['でも、おすしを たべません。', 'でも = but'], // (probe)
      ['すしでは ありません。', 'では ありません = is not'], // (probe)
      ['ねこを なでました。', 'で inside なでる'], // (probe)
      ['テレビを みないで ねます。', 'ないで = without doing'], // (probe)
      ['でぐちを さがします。', 'で inside でぐち + を + ます'], // (probe)
      ['くるまで えきまで いきます。', 'means で but no を object'], // (probe)
      ['あめで しあいが なくなりました。', 'cause で, no を object'], // (probe)
    ],
  },
  'te-iru': {
    pos: [
      'かいさつの まえで まって います。',
      '10じから、へやで ねて いました。',
      { text: '今、雨が 降って います。', kana: 'いま、あめが ふって います。' }, // (probe)
      'ポンは けっこん して います。', // (probe)
      { text: '先生は 東京に 住んでいます。', kana: 'せんせいは とうきょうに すんでいます。' }, // (probe)
      'なにを して いるの？', // (probe)
      { text: 'おばけが 来ています！', kana: 'おばけが きています！' }, // (probe)
      'でんしゃが こんで いますね。', // (probe)
      'まどが あいて いる。', // (probe)
      { text: 'その 人を 知っていますか。', kana: 'その ひとを しっていますか。' }, // (probe)
    ],
    neg: [
      ['ねこが にわに います。', 'に います = existence, no て-form'], // (probe)
      ['いもうとが ふたり います。', 'います = existence/have, no て-form'], // (probe)
      ['ポンを つれて いきます。', '〜て いく, not いる'], // (probe)
      ['ていねいに かいて ください。', 'てい inside ていねい; 〜て ください'], // (probe)
      ['ていしょくを ください。', 'てい inside ていしょく'], // (probe)
      ['まどを あけて おきます。', '〜て おく'], // (probe)
      ['ちょっと まって ください。', '〜て ください'], // (probe)
      ['ここに いて ください。', 'いて = て-form of いる itself, not 〜て いる'], // (probe)
      ['さいふを わすれて きました。', '〜て くる'], // (probe)
      ['たべて みます。', '〜て みる'], // (probe)
    ],
  },
  'no': {
    pos: [
      'あなたの なまえは',
      'となりの ひとの かたで ねないで ください。',
      'あしたの てんきは どうですか。',
      'あれれ？　ポンの おなかが ぐう…',
      'わたしの かばんです。', // (probe)
      { text: '日本の 車は 高いですか。', kana: 'にほんの くるまは たかいですか。' }, // (probe)
      { text: '駅の 前に あります。', kana: 'えきの まえに あります。' }, // (probe)
      'ゆうれいの ともだちが います。', // (probe)
      { text: 'これは 先生の 傘ですか。', kana: 'これは せんせいの かさですか。' }, // (probe)
      'にほんごの せんせいです。', // (probe)
    ],
    neg: [
      ['あたまが いたいのです。', 'explanatory の (のです)'], // (probe)
      ['なにを たべたの？', 'sentence-final question の'], // (probe)
      ['どこに いくの？', 'sentence-final question の after a verb'], // (probe)
      ['のみものは なにが いいですか。', 'の inside のみもの'], // (probe)
      ['でんしゃに のります。', 'の inside のります'], // (probe)
      ['あおいのを ください。', 'pronoun の after an adjective (the blue one), not N の N'], // (probe)
      ['たべるのが すきです。', 'nominalising の after a verb'], // (probe)
      ['のんびり しましょう。', 'の inside のんびり'], // (probe)
      ['きのう ともだちに あいました。', 'の inside きのう'], // (probe)
      ['たのしかったです。', 'の inside たのしい'], // (probe)
    ],
  },
  'adj-desu': {
    pos: [
      'おいしいです！',
      'しずかです。',
      'ひるやすみは うるさいです。',
      'たかいですか。',
      'げんきですか。',
      { text: 'この ラーメンは 本当に おいしいです。', kana: 'この ラーメンは ほんとうに おいしいです。' }, // (probe)
      { text: '部屋は とても きれいです。', kana: 'へやは とても きれいです。' }, // (probe)
      { text: '今日は 暑いですね。', kana: 'きょうは あついですね。' }, // (probe)
      'ちょうちんは やさしいです。', // (probe)
      { text: '駅は 遠いですか。', kana: 'えきは とおいですか。' }, // (probe)
    ],
    neg: [
      ['つめたかったです。', 'past adjective (かったです): excluded, plain present only'], // (probe)
      ['きれいでした。', 'past na-adjective'], // (probe)
      ['おおきくないです', 'negative adjective (the kunai frame)'],
      ['しずかじゃないです。', 'negative na-adjective'], // (probe)
      ['ことばの ようかいです！　ひとり ひとつ！', 'noun + です'],
      ['がくせいです。', 'noun + です'], // (probe)
      ['ここは とうきょうです。', 'place noun + です'], // (probe)
      ['すしが たべたいです。', '〜たいです: たい looks like an i-adjective ending'], // (probe)
      ['おいしそうです。', '〜そうです (looks tasty), not the adjective itself + です'], // (probe)
      ['きれいな ひとです。', 'na-adjective modifies a noun; です follows the noun'], // (probe)
    ],
  },
  'kunai': {
    pos: [
      'おおきくないです',
      { text: '大きくないです', kana: 'おおきくないです' },
      'こわくないですよ。ちょうちんは やさしい おばけです。',
      { text: 'このカレーは 辛くないです。', kana: 'このカレーは からくないです。' }, // (probe)
      'よくないです。', // (probe)
      { text: '今日は 寒くありません。', kana: 'きょうは さむくありません。' }, // (probe)
      'ぜんぜん たかくないですよ。', // (probe)
      'この へやは ひろくありません。', // (probe)
      { text: 'その 映画は 面白くないですか。', kana: 'その えいがは おもしろくないですか。' }, // (probe)
      'いたくないです！ だいじょうぶ！', // (probe)
    ],
    neg: [
      ['ああ いきたくない', '〜たくない = don’t want to, a different frame'],
      ['たべたくありません。', '〜たくありません = don’t want to'], // (probe)
      ['しずかじゃないです。', 'na-adjective negative じゃないです'], // (probe)
      ['きれいでは ありません。', 'na-adjective negative では ありません'], // (probe)
      ['がくせいじゃ ありません。', 'noun negative'], // (probe)
      ['あかちゃんが よく ないて います。', 'よく (often) + ないて (crying); looks like よくない'], // (probe)
      ['あつく なりました。', 'adjective く-form + なる, no negative'], // (probe)
      ['さむくて、ねむいです。', 'adjective くて-form, no negative'], // (probe)
      ['みずが ないです。', 'ない = there isn’t, no adjective'], // (probe)
      ['わかりません。', 'verb negative ません'], // (probe)
    ],
  },
  'kara': {
    pos: [
      'ごめん。おいしそう だったから、ぜんぶ たべちゃった。',
      'めが ひとつだから、ぜんぶ ひとつずつ！',
      'しゃしん とるから、かわいく してね！',
      'あついから、まどを あけます。', // (probe)
      { text: '雨ですから、タクシーで 行きましょう。', kana: 'あめですから、タクシーで いきましょう。' }, // (probe)
      { text: '電車が 遅れたから、遅刻しました。', kana: 'でんしゃが おくれたから、ちこくしました。' }, // (probe)
      'おなかが すいたから、おべんとうを かいます。', // (probe)
      { text: '眠いですから、もう 寝ます。', kana: 'ねむいですから、もう ねます。' }, // (probe)
      'ゆうれいが こわいから いきたくない。', // (probe)
      'しずかだから、ここで よみましょう。', // (probe)
    ],
    neg: [
      ['こんにちは。つきから きました、うさぎの モチです。', 'から = from (a place)'],
      ['10じから、へやで ねて いました。', 'から = from (a time), even with a comma after it'],
      ['げつようびから きんようびまで いきます。', 'から〜まで = from … to'],
      ['「ななばんせんから、でんしゃがでます。」なんばんせんですか。', 'から = from (a platform)'],
      ['はじめて あった ときから、ずっと すきでした。', 'ときから = since; after a noun, not a reason'],
      ['てを あらってから、たべます。', '〜てから = after doing'], // (probe)
      ['このカレーは からいです。', 'から inside からい (spicy)'], // (probe)
      ['からだに いいです。', 'から inside からだ (body)'], // (probe)
      ['からあげを ください。', 'から inside からあげ'], // (probe)
      ['さいふが からっぽです。', 'から inside からっぽ (empty)'], // (probe)
    ],
  },
  'hou-ga': {
    pos: [
      'はじめまして。のっぺらぼうの ノッペです。しゃしんより じつぶつの ほうが いいですよ。',
      'ねこより いぬの ほうが すきです。', // (probe)
      { text: 'バスより 電車の ほうが 速いです。', kana: 'バスより でんしゃの ほうが はやいです。' }, // (probe)
      { text: '夏より 冬の ほうが 好きです。', kana: 'なつより ふゆの ほうが すきです。' }, // (probe)
      'ポンより ノッペの ほうが ハンサムです。', // (probe)
      'きのうより きょうの ほうが さむいね。', // (probe)
      { text: '東京より 大阪の ほうが 安いですか。', kana: 'とうきょうより おおさかの ほうが やすいですか。' }, // (probe)
      'ゆうれいより にんげんの ほうが こわい。', // (probe)
      'すしより ラーメンの ほうが たべたいです。', // (probe)
      'わたしより あなたの ほうが にほんごが じょうずです。', // (probe)
    ],
    neg: [
      ['はやく ねた ほうが いいです。', '〜た ほうが いい = advice, a different frame'], // (probe)
      ['くすりを のんだ ほうが いいですよ。', '〜た ほうが いい = advice'], // (probe)
      ['いかない ほうが いいです。', '〜ない ほうが いい = negative advice'], // (probe)
      ['かっこいい！　ポンより かっこいい！', 'より without の ほうが'],
      ['おもったより いいですよ。', 'より (than expected) without ほうが'],
      ['えきの ほうへ あるいて ください。', 'ほう = direction, no より or が'], // (probe)
      ['ほうがくを まちがえました。', 'ほうが inside ほうがく (direction)'], // (probe)
      ['ほうれんそうが すきです。', 'ほう inside ほうれんそう'], // (probe)
      ['ほうちょうで やさいを きります。', 'ほう inside ほうちょう (kitchen knife)'], // (probe)
      ['ほうほう、なるほど。', 'ほうほう = interjection'], // (probe)
    ],
  },
  'mashou': {
    pos: [
      'みんなで よみましょう。せーの！',
      { text: 'また あした 会いましょう', kana: 'また あした あいましょう' },
      'さあ、こたえを みましょうか。',
      'ひきわけです！ ざぶとんを はんぶんに しましょうか。',
      'だいじょうぶ！　つぎ、いきましょう！',
      { text: '一緒に 写真を 撮りましょう！', kana: 'いっしょに しゃしんを とりましょう！' }, // (probe)
      { text: '荷物を 持ちましょうか。', kana: 'にもつを もちましょうか。' }, // (probe)
      { text: '早く 帰りましょう。', kana: 'はやく かえりましょう。' }, // (probe)
      'また きましょうね！', // (probe)
      'まどを あけましょうか？', // (probe)
    ],
    neg: [
      ['あしたは あめでしょう。', 'でしょう = probably'], // (probe)
      ['いや、へんでしょう！', 'でしょう = surely/isn’t it'],
      ['いち… に… さん… これは なんでしょう？', 'なんでしょう = what could it be'],
      ['それは だめでしょうか。', 'でしょうか = polite question'], // (probe)
      ['しょうゆを ください。', 'しょう inside しょうゆ'], // (probe)
      ['しょうがっこうの せんせいです。', 'しょう inside しょうがっこう'], // (probe)
      ['しょうらい いしゃに なりたい。', 'しょう inside しょうらい'], // (probe)
      ['しょうかいします。', 'しょう inside しょうかい + ます'], // (probe)
      ['まいしゅう しょうせつを よみます。', 'しょう inside しょうせつ; ま…ます elsewhere'], // (probe)
      ['もう たべました。', 'ました (past), not ましょう'], // (probe)
    ],
  },
  'naide-kudasai': {
    pos: [
      'となりの ひとの かたで ねないで ください。',
      'スマホは だれにも みせないで ください。',
      { text: '皆さん、最終電車です。乗り遅れないでくださいね……ふふふ。', kana: 'みなさん、さいしゅうでんしゃです。のりおくれないでくださいね……ふふふ。' },
      'つまの ははの ぶんです。まちがえないで ください。',
      'フデは きのう デートでした。きかないで ください。',
      { text: 'ここで 写真を 撮らないで ください。', kana: 'ここで しゃしんを とらないで ください。' }, // (probe)
      { text: 'まだ 帰らないでください。', kana: 'まだ かえらないでください。' }, // (probe)
      'しんぱい しないで ください。', // (probe)
      'こないで ください！', // (probe)
      'おふろで およがないで ください。', // (probe)
    ],
    neg: [
      ['まどを あけて ください。', '〜て ください (please do)'], // (probe)
      ['ここで まって ください。', '〜て ください (please do)'], // (probe)
      ['この ほんを よんで ください。', 'よんで ください: で is a て-form, not ないで'], // (probe)
      ['でんきを けして ください。', '〜て ください (please do)'], // (probe)
      ['おしえて くださいませんか。', '〜て くださいませんか (polite request)'], // (probe)
      ['じかんが ないです。', 'ないです = there isn’t'], // (probe)
      ['だれも いないです。', 'いないです = nobody is here'], // (probe)
      ['あぶないですよ。', 'ない inside あぶない'], // (probe)
      ['あさごはんを たべないで きました。', '〜ないで = without doing, no ください'], // (probe)
      ['たべなくても いいです。', '〜なくても いい = don’t have to'], // (probe)
    ],
  },
};
