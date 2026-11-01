// Host lines that carry the N3 listening points (docs/n3-coverage.md, Plan B). The Limited Express marks these
// points "You'll hear these" on a player's station sheet, so the hosts have to actually say them.
//
// Each point goes to the host who already talks that way (the N3 coverage panel's story seat): Nobiko-san gossips
// (とか いってた, かしら, ものだ, ぎみ, て ごらん), Chōchin-san announces (おきに, ごとに, ようなら, から に かけて,
// おそれが ある), Pon is casual (じゃん, ようが ない) and Fude gives advice from above (ことだ).
//
// Every line is `level: 'n3'`: it plays only in a room where someone plays at N3, so a kana or N5 player is never
// expected to follow it. They're never aimed at a player's Japanese. Kana only, like the rest of the bank. Ids
// are stable. Every line is `draft` until a fluent check.

import type { HostLine } from '../types.js';

const n3 = (id: string, host: HostLine['host'], event: HostLine['event'], kana: string, en: string, tier?: HostLine['tier']): HostLine => ({
  id,
  host,
  event,
  ...(tier ? { tier } : {}),
  jp: { text: kana, kana, en },
  level: 'n3',
  status: 'draft',
});

export const n3ListeningLines: HostLine[] = [
  // Nobiko-san: ＿とか いってた (hearsay)
  n3('nobiko.lobby_welcome.n3.01', 'nobiko', 'lobby_welcome', 'となりの かっぱさん、けっこんする とか いってたわよ。', 'The kappa next door said something about getting married.'),
  n3('nobiko.intro.n3.01', 'nobiko', 'intro', 'ポンちゃん、こんやは かつ とか いってたけど…', "Pon said something about winning tonight, but…"),
  // Nobiko-san: ＿かしら
  n3('nobiko.intro.n3.02', 'nobiko', 'intro', 'こんやは だれが いちばんかしら。', "I wonder who'll come out on top tonight."),
  n3('nobiko.reveal_react.n3.01', 'nobiko', 'reveal_react', 'あら、すてきな こたえ。だれのかしら？', 'Oh, a lovely answer. Whose could it be?', 'good'),
  // Nobiko-san: ＿ものだ (fondly, I used to)
  n3('nobiko.play_again.n3.01', 'nobiko', 'play_again', 'むかしは よく みんなで あそんだ ものよ。もう いっかい！', 'We used to play like this all the time. Once more!'),
  n3('nobiko.lobby_welcome.n3.02', 'nobiko', 'lobby_welcome', 'わかい ころは よく おどった ものよ。', 'I used to dance all the time when I was young.'),
  // Nobiko-san: ＿ぎみ
  n3('nobiko.lobby_welcome.n3.03', 'nobiko', 'lobby_welcome', 'うちの だんな、さいきん つかれぎみなの。こたつだから。', "My husband's been a bit worn out lately. He's a kotatsu."),
  n3('nobiko.answer_hurry.n3.01', 'nobiko', 'answer_hurry', 'あらあら、みんな ねぶそくぎみ？　あと すこしよ！', 'Oh dear, a bit short on sleep? Almost there!'),
  // Nobiko-san: ＿て ごらん
  n3('nobiko.reveal_react.n3.02', 'nobiko', 'reveal_react', 'ほら、みて ごらん。にゅーっ！', 'Look, look at this! (neck stretches)', 'ippon'),
  n3('nobiko.say_it_first.n3.01', 'nobiko', 'say_it_first', 'こわく ないわよ。いって ごらん。', "Nothing to be scared of. Go on, say it."),
  // Chōchin-san: ＿おきに
  n3('chochin.train_departure.n3.01', 'chochin', 'train_departure', 'ゆうれい でんしゃは、じゅっぷん おきに はっしゃ いたします。', 'Ghost trains depart every ten minutes.'),
  n3('chochin.lobby_welcome.n3.01', 'chochin', 'lobby_welcome', 'あんないは、ごふん おきに くりかえします。', 'This announcement repeats every five minutes.'),
  // Chōchin-san: ＿ごとに
  n3('chochin.train_stop.n3.01', 'chochin', 'train_stop', 'えきに とまる ごとに、ゆうれいが ふえて まいります。', 'At every stop, a few more ghosts get on.'),
  n3('chochin.all_in.n3.01', 'chochin', 'all_in', 'いっかい ごとに、みなさま じょうずに なられますね。', 'You all get better every round.'),
  // Chōchin-san: ＿ようなら
  n3('chochin.intro.n3.01', 'chochin', 'intro', 'きぶんが わるい ようなら、おしらせ ください。', 'If you start to feel unwell, please let us know.'),
  n3('chochin.train_ghost.n3.01', 'chochin', 'train_ghost', 'まだ こわい ようなら、めを とじて ください。', "If it's still too scary, please close your eyes."),
  // Chōchin-san: ＿から ＿に かけて
  n3('chochin.train_departure.n3.02', 'chochin', 'train_departure', 'よなかから あさに かけて、こんざつ いたします。', 'From midnight through the morning, trains will be crowded.'),
  n3('chochin.prompt_read.n3.01', 'chochin', 'prompt_read', 'こんやから あしたに かけて、ゆうれいが おおく なります。', 'From tonight into tomorrow, expect a lot of ghosts.'),
  // Chōchin-san: ＿おそれが ある
  n3('chochin.train_departure.n3.03', 'chochin', 'train_departure', 'かけこみ じょうしゃは、ドアに はさまれる おそれが ございます。', "Don't rush for the train: the doors may close on you."),
  n3('chochin.train_stop.n3.02', 'chochin', 'train_stop', 'この さき、ゆうれいが でる おそれが ございます。', 'Ahead, there is a risk of ghosts.'),
  // Pon: ＿じゃん
  n3('pon.reveal_react.n3.01', 'pon', 'reveal_react', 'いいじゃん！　ポン！', 'Nice! Pon!', 'good'),
  n3('pon.reveal_react.n3.02', 'pon', 'reveal_react', 'やるじゃん！　しっぽ でちゃう！', "Not bad at all! My tail's popping out!", 'ippon'),
  // Pon: ＿ようが ない
  n3('pon.miss_kind.n3.01', 'pon', 'miss_kind', 'ヒントが ないと、こたえようが ないよね。つぎ いこう！', "No hint, no way to answer. Next one!"),
  n3('pon.play_again.n3.01', 'pon', 'play_again', 'たのしすぎて、とめようが ないね！　もう いっかい！', "Too much fun. There's no stopping it! Again!"),
  // Fude: ＿ことだ (advice)
  n3('fude.say_it_first.n3.01', 'fude', 'say_it_first', 'まず、こえに だして みる ことだ。シュッ！', "First, say it out loud. That's the way. (swish)"),
  n3('fude.retry_clue.n3.01', 'fude', 'retry_clue', 'まよったら、もう いちど よく きく ことだ。', 'When in doubt, listen once more, carefully.'),
];

/** The bank lines that carry each N3 listening point (n3Points.ts ids), so the station sheet's promise holds. */
export const N3_LISTEN_LINES: Record<string, string[]> = {
  'toka-hearsay': ['nobiko.lobby_welcome.n3.01', 'nobiko.intro.n3.01'],
  kashira: ['nobiko.intro.n3.02', 'nobiko.reveal_react.n3.01'],
  'mono-da': ['nobiko.play_again.n3.01', 'nobiko.lobby_welcome.n3.02'],
  gimi: ['nobiko.lobby_welcome.n3.03', 'nobiko.answer_hurry.n3.01'],
  'te-goran': ['nobiko.reveal_react.n3.02', 'nobiko.say_it_first.n3.01'],
  'oki-ni': ['chochin.train_departure.n3.01', 'chochin.lobby_welcome.n3.01'],
  'goto-ni': ['chochin.train_stop.n3.01', 'chochin.all_in.n3.01'],
  'you-nara': ['chochin.intro.n3.01', 'chochin.train_ghost.n3.01'],
  'kara-ni-kakete': ['chochin.train_departure.n3.02', 'chochin.prompt_read.n3.01'],
  'osore-ga-aru': ['chochin.train_departure.n3.03', 'chochin.train_stop.n3.02'],
  jan: ['pon.reveal_react.n3.01', 'pon.reveal_react.n3.02'],
  'you-ga-nai': ['pon.miss_kind.n3.01', 'pon.play_again.n3.01'],
  'koto-da': ['fude.say_it_first.n3.01', 'fude.retry_clue.n3.01'],
};
