// Chōchin-san (lantern ghost conductor): Last Train.
//
// Written fallback host lines (Phase 1 host bank). All lines are kana-only so
// kana-level players can read them; `kana` is exactly what TTS voices.
// Ids are stable: never renumber or reuse an id. Add new lines at the end of
// an event with the next number. Every line is `draft` until a fluent check.

import type { HostLine } from '../types.js';

export const chochinLines: HostLine[] = [
  // lobby_welcome
  { id: 'chochin.lobby_welcome.01', host: 'chochin', event: 'lobby_welcome', jp: { text: 'ごじょうしゃ ありがとう ございます。', kana: 'ごじょうしゃ ありがとう ございます。', en: 'Thank you for riding with us.' }, status: 'draft' },
  { id: 'chochin.lobby_welcome.02', host: 'chochin', event: 'lobby_welcome', jp: { text: 'しゅうでんへ ようこそ。ゆらゆら。', kana: 'しゅうでんへ ようこそ。ゆらゆら。', en: 'Welcome aboard the last train. Sway, sway.' }, status: 'draft' },
  { id: 'chochin.lobby_welcome.03', host: 'chochin', event: 'lobby_welcome', jp: { text: 'こんばんは。しゃしょうの ちょうちんです。', kana: 'こんばんは。しゃしょうの ちょうちんです。', en: "Good evening. I'm Chōchin, your conductor." }, status: 'draft' },
  { id: 'chochin.lobby_welcome.04', host: 'chochin', event: 'lobby_welcome', jp: { text: 'きっぷを はいけん します。', kana: 'きっぷを はいけん します。', en: 'Tickets, please.' }, status: 'draft' },
  { id: 'chochin.lobby_welcome.05', host: 'chochin', event: 'lobby_welcome', jp: { text: 'よる おそく、ようこそ。ゆらゆら。', kana: 'よる おそく、ようこそ。ゆらゆら。', en: 'Welcome, so late at night. Sway, sway.' }, status: 'draft' },
  // mic_check_ok
  { id: 'chochin.mic_check_ok.01', host: 'chochin', event: 'mic_check_ok', jp: { text: '{name}さま、こえが きこえました。', kana: '{name}さま、こえが きこえました。', en: 'I heard your voice, {name}.' }, slots: ['{name}'], status: 'draft' },
  { id: 'chochin.mic_check_ok.02', host: 'chochin', event: 'mic_check_ok', jp: { text: '{name}さま、ごじょうしゃ ありがとう ございます。', kana: '{name}さま、ごじょうしゃ ありがとう ございます。', en: 'Thank you for riding, {name}.' }, slots: ['{name}'], status: 'draft' },
  { id: 'chochin.mic_check_ok.03', host: 'chochin', event: 'mic_check_ok', jp: { text: 'はい、{name}さま。きっぷ、オーケーです。', kana: 'はい、{name}さま。きっぷ、オーケーです。', en: 'Yes, {name}. Your ticket is fine.' }, slots: ['{name}'], status: 'draft' },
  { id: 'chochin.mic_check_ok.04', host: 'chochin', event: 'mic_check_ok', jp: { text: '{name}さま、こんばんは。ゆらゆら。', kana: '{name}さま、こんばんは。ゆらゆら。', en: 'Good evening, {name}. Sway, sway.' }, slots: ['{name}'], status: 'draft' },
  { id: 'chochin.mic_check_ok.05', host: 'chochin', event: 'mic_check_ok', jp: { text: '{name}さまの こえ、とどきました。', kana: '{name}さまの こえ、とどきました。', en: 'Your voice came through, {name}.' }, slots: ['{name}'], status: 'draft' },
  // mic_check_quiet
  { id: 'chochin.mic_check_quiet.01', host: 'chochin', event: 'mic_check_quiet', jp: { text: 'だいじょうぶです。タップで ごじょうしゃ ください。', kana: 'だいじょうぶです。タップで ごじょうしゃ ください。', en: 'No problem. Please ride along by tapping.' }, status: 'draft' },
  { id: 'chochin.mic_check_quiet.02', host: 'chochin', event: 'mic_check_quiet', jp: { text: 'しずかな おきゃくさまですね。タップで どうぞ。', kana: 'しずかな おきゃくさまですね。タップで どうぞ。', en: 'A quiet passenger. Please tap instead.' }, status: 'draft' },
  { id: 'chochin.mic_check_quiet.03', host: 'chochin', event: 'mic_check_quiet', jp: { text: 'マイクは おやすみです。ゆらゆら。', kana: 'マイクは おやすみです。ゆらゆら。', en: 'The mic is resting. Sway, sway.' }, status: 'draft' },
  { id: 'chochin.mic_check_quiet.04', host: 'chochin', event: 'mic_check_quiet', jp: { text: 'こえは あとで けっこうです。', kana: 'こえは あとで けっこうです。', en: 'Your voice can wait until later.' }, status: 'draft' },
  { id: 'chochin.mic_check_quiet.05', host: 'chochin', event: 'mic_check_quiet', jp: { text: 'タイプでも だいじょうぶです。', kana: 'タイプでも だいじょうぶです。', en: 'Typing is perfectly fine too.' }, status: 'draft' },
  // intro
  { id: 'chochin.intro.01', host: 'chochin', event: 'intro', jp: { text: 'この でんしゃは しゅうでんです。', kana: 'この でんしゃは しゅうでんです。', en: 'This train is the last train.' }, status: 'draft' },
  { id: 'chochin.intro.02', host: 'chochin', event: 'intro', jp: { text: 'えきで もんだいが あります。こたえて ください。', kana: 'えきで もんだいが あります。こたえて ください。', en: 'Each station has a question. Please answer.' }, status: 'draft' },
  { id: 'chochin.intro.03', host: 'chochin', event: 'intro', jp: { text: 'ミスは だいじょうぶ。チャンスは にかいです。', kana: 'ミスは だいじょうぶ。チャンスは にかいです。', en: 'Misses are fine. You get two chances.' }, status: 'draft' },
  { id: 'chochin.intro.04', host: 'chochin', event: 'intro', jp: { text: 'のりおくれた ひとは、ゆうれいに なります。ゆらゆら。', kana: 'のりおくれた ひとは、ゆうれいに なります。ゆらゆら。', en: 'Miss the train, and you become a ghost. Sway, sway.' }, status: 'draft' },
  { id: 'chochin.intro.05', host: 'chochin', event: 'intro', jp: { text: 'しゅっぱつまで、もう すこしです。', kana: 'しゅっぱつまで、もう すこしです。', en: 'Departure is very soon.' }, status: 'draft' },
  // prompt_read
  { id: 'chochin.prompt_read.01', host: 'chochin', event: 'prompt_read', jp: { text: 'おきゃくさまに、もんだいです。', kana: 'おきゃくさまに、もんだいです。', en: 'A question for our passengers.' }, status: 'draft' },
  { id: 'chochin.prompt_read.02', host: 'chochin', event: 'prompt_read', jp: { text: 'では、もんだいです。ゆらゆら。', kana: 'では、もんだいです。ゆらゆら。', en: 'Now, the question. Sway, sway.' }, status: 'draft' },
  { id: 'chochin.prompt_read.03', host: 'chochin', event: 'prompt_read', jp: { text: 'よく おききください。', kana: 'よく おききください。', en: 'Please listen carefully.' }, status: 'draft' },
  { id: 'chochin.prompt_read.04', host: 'chochin', event: 'prompt_read', jp: { text: 'つぎの もんだいは こちらです。', kana: 'つぎの もんだいは こちらです。', en: 'Here is the next question.' }, status: 'draft' },
  { id: 'chochin.prompt_read.05', host: 'chochin', event: 'prompt_read', jp: { text: 'さあ、こたえて ください。もんだいです。', kana: 'さあ、こたえて ください。もんだいです。', en: 'Now, please answer. Here is the question.' }, status: 'draft' },
  // say_it_first
  { id: 'chochin.say_it_first.01', host: 'chochin', event: 'say_it_first', jp: { text: 'こえで おこたえください。', kana: 'こえで おこたえください。', en: 'Please answer out loud.' }, status: 'draft' },
  { id: 'chochin.say_it_first.02', host: 'chochin', event: 'say_it_first', jp: { text: 'まず、いって ください。', kana: 'まず、いって ください。', en: 'First, please say it.' }, status: 'draft' },
  { id: 'chochin.say_it_first.03', host: 'chochin', event: 'say_it_first', jp: { text: 'はっしゃまえに、どうぞ！', kana: 'はっしゃまえに、どうぞ！', en: 'Before departure, go ahead!' }, status: 'draft' },
  { id: 'chochin.say_it_first.04', host: 'chochin', event: 'say_it_first', jp: { text: 'ごびょうです。どうぞ。', kana: 'ごびょうです。どうぞ。', en: 'Five seconds. Go ahead.' }, status: 'draft' },
  { id: 'chochin.say_it_first.05', host: 'chochin', event: 'say_it_first', jp: { text: 'こえが きっぷです。どうぞ！', kana: 'こえが きっぷです。どうぞ！', en: 'Your voice is your ticket. Go!' }, status: 'draft' },
  // answer_hurry
  { id: 'chochin.answer_hurry.01', host: 'chochin', event: 'answer_hurry', jp: { text: 'まもなく、ドアが しまります！', kana: 'まもなく、ドアが しまります！', en: 'The doors are closing soon!' }, status: 'draft' },
  { id: 'chochin.answer_hurry.02', host: 'chochin', event: 'answer_hurry', jp: { text: 'おいそぎください！', kana: 'おいそぎください！', en: 'Please hurry!' }, status: 'draft' },
  { id: 'chochin.answer_hurry.03', host: 'chochin', event: 'answer_hurry', jp: { text: 'はっしゃまで、あと すこし！', kana: 'はっしゃまで、あと すこし！', en: 'Almost time to depart!' }, status: 'draft' },
  { id: 'chochin.answer_hurry.04', host: 'chochin', event: 'answer_hurry', jp: { text: 'ドアが しまります！　おこたえ、おいそぎください！', kana: 'ドアが しまります！　おこたえ、おいそぎください！', en: 'The doors are closing! Answer quickly, please!' }, status: 'draft' },
  { id: 'chochin.answer_hurry.05', host: 'chochin', event: 'answer_hurry', jp: { text: 'ゆらゆら… じかんが ありません！', kana: 'ゆらゆら… じかんが ありません！', en: "Sway, sway… we're out of time!" }, status: 'draft' },
  // all_in
  { id: 'chochin.all_in.01', host: 'chochin', event: 'all_in', jp: { text: 'みなさま、ごじょうしゃ かんりょうです。', kana: 'みなさま、ごじょうしゃ かんりょうです。', en: 'All passengers are aboard.' }, status: 'draft' },
  { id: 'chochin.all_in.02', host: 'chochin', event: 'all_in', jp: { text: 'ぜんいん、こたえました。ありがとう ございます。', kana: 'ぜんいん、こたえました。ありがとう ございます。', en: 'Everyone has answered. Thank you.' }, status: 'draft' },
  { id: 'chochin.all_in.03', host: 'chochin', event: 'all_in', jp: { text: 'きっぷ、ぜんぶ はいけん しました。', kana: 'きっぷ、ぜんぶ はいけん しました。', en: 'All tickets have been checked.' }, status: 'draft' },
  { id: 'chochin.all_in.04', host: 'chochin', event: 'all_in', jp: { text: 'はやいですね。すばらしい。', kana: 'はやいですね。すばらしい。', en: 'So quick. Wonderful.' }, status: 'draft' },
  { id: 'chochin.all_in.05', host: 'chochin', event: 'all_in', jp: { text: 'みなさま、そろいました。', kana: 'みなさま、そろいました。', en: 'Everyone is here.' }, status: 'draft' },
  // reveal_react.flop
  { id: 'chochin.reveal_react.flop.01', host: 'chochin', event: 'reveal_react', tier: 'flop', jp: { text: 'おや？　ゆうれいさんが よろこんで います…', kana: 'おや？　ゆうれいさんが よろこんで います…', en: 'Oh? The ghosts seem rather pleased…' }, status: 'draft' },
  { id: 'chochin.reveal_react.flop.02', host: 'chochin', event: 'reveal_react', tier: 'flop', jp: { text: 'おしい！　でんしゃは まだ まちます。', kana: 'おしい！　でんしゃは まだ まちます。', en: 'Close! The train will wait a little.' }, status: 'draft' },
  { id: 'chochin.reveal_react.flop.03', host: 'chochin', event: 'reveal_react', tier: 'flop', jp: { text: 'あらら、つぎの えきで がんばりましょう。', kana: 'あらら、つぎの えきで がんばりましょう。', en: "Oh dear. Let's try at the next station." }, status: 'draft' },
  { id: 'chochin.reveal_react.flop.04', host: 'chochin', event: 'reveal_react', tier: 'flop', jp: { text: 'ゆらゆら… むずかしい えきでした。', kana: 'ゆらゆら… むずかしい えきでした。', en: 'Sway, sway… that was a tough station.' }, status: 'draft' },
  { id: 'chochin.reveal_react.flop.05', host: 'chochin', event: 'reveal_react', tier: 'flop', jp: { text: 'だいじょうぶです。しゅうでんは ながいです。', kana: 'だいじょうぶです。しゅうでんは ながいです。', en: "It's fine. The last train is a long ride." }, status: 'draft' },
  { id: 'chochin.reveal_react.flop.06', host: 'chochin', event: 'reveal_react', tier: 'flop', jp: { text: 'ちょうちんが ゆれました！　ドキドキ。', kana: 'ちょうちんが ゆれました！　ドキドキ。', en: 'My lantern shook! My heart is racing.' }, status: 'draft' },
  { id: 'chochin.reveal_react.flop.07', host: 'chochin', event: 'reveal_react', tier: 'flop', jp: { text: 'ふとんが ふっとんだ… いえ、こたえが ふっとんだ。', kana: 'ふとんが ふっとんだ… いえ、こたえが ふっとんだ。', en: 'The futon flew off… no, the answer did.' }, status: 'draft' },
  { id: 'chochin.reveal_react.flop.08', host: 'chochin', event: 'reveal_react', tier: 'flop', jp: { text: 'まだ チャンスは ありますよ。', kana: 'まだ チャンスは ありますよ。', en: 'There is still a chance.' }, status: 'draft' },
  // reveal_react.good
  { id: 'chochin.reveal_react.good.01', host: 'chochin', event: 'reveal_react', tier: 'good', jp: { text: 'おみごと！', kana: 'おみごと！', en: 'Splendid!' }, status: 'draft' },
  { id: 'chochin.reveal_react.good.02', host: 'chochin', event: 'reveal_react', tier: 'good', jp: { text: 'せいかいです。ゆらゆら。', kana: 'せいかいです。ゆらゆら。', en: 'Correct. Sway, sway.' }, status: 'draft' },
  { id: 'chochin.reveal_react.good.03', host: 'chochin', event: 'reveal_react', tier: 'good', jp: { text: 'すばらしい おこたえです。', kana: 'すばらしい おこたえです。', en: 'A splendid answer.' }, status: 'draft' },
  { id: 'chochin.reveal_react.good.04', host: 'chochin', event: 'reveal_react', tier: 'good', jp: { text: 'つぎの えきへ、ごあんない します。', kana: 'つぎの えきへ、ごあんない します。', en: 'Allow me to guide you to the next station.' }, status: 'draft' },
  { id: 'chochin.reveal_react.good.05', host: 'chochin', event: 'reveal_react', tier: 'good', jp: { text: 'はい、きっぷ オーケーです！', kana: 'はい、きっぷ オーケーです！', en: 'Yes, your ticket is good!' }, status: 'draft' },
  { id: 'chochin.reveal_react.good.06', host: 'chochin', event: 'reveal_react', tier: 'good', jp: { text: 'いかがですか？　いかです！', kana: 'いかがですか？　いかです！', en: 'How about that? Squid! (A pun.)' }, status: 'draft' },
  { id: 'chochin.reveal_react.good.07', host: 'chochin', event: 'reveal_react', tier: 'good', jp: { text: 'ちょうちんが あかるく なりました！', kana: 'ちょうちんが あかるく なりました！', en: 'My lantern got brighter!' }, status: 'draft' },
  { id: 'chochin.reveal_react.good.08', host: 'chochin', event: 'reveal_react', tier: 'good', jp: { text: 'よろしい！　ごじょうしゃ ください！', kana: 'よろしい！　ごじょうしゃ ください！', en: 'Very good! All aboard!' }, status: 'draft' },
  // reveal_react.ippon
  { id: 'chochin.reveal_react.ippon.01', host: 'chochin', event: 'reveal_react', tier: 'ippon', jp: { text: 'ブラボー！　ちょうちんが もえて います！', kana: 'ブラボー！　ちょうちんが もえて います！', en: 'Bravo! My lantern is on fire!' }, status: 'draft' },
  { id: 'chochin.reveal_react.ippon.02', host: 'chochin', event: 'reveal_react', tier: 'ippon', jp: { text: 'これは とっきゅうです！', kana: 'これは とっきゅうです！', en: 'This answer is express class!' }, status: 'draft' },
  { id: 'chochin.reveal_react.ippon.03', host: 'chochin', event: 'reveal_react', tier: 'ippon', jp: { text: 'しんかんせんより はやい！', kana: 'しんかんせんより はやい！', en: 'Faster than the shinkansen!' }, status: 'draft' },
  { id: 'chochin.reveal_react.ippon.04', host: 'chochin', event: 'reveal_react', tier: 'ippon', jp: { text: 'パーフェクトな おこたえ！　ゆらゆら！', kana: 'パーフェクトな おこたえ！　ゆらゆら！', en: 'A perfect answer! Sway, sway!' }, status: 'draft' },
  { id: 'chochin.reveal_react.ippon.05', host: 'chochin', event: 'reveal_react', tier: 'ippon', jp: { text: 'ゆうれいさんも はくしゅ して います！', kana: 'ゆうれいさんも はくしゅ して います！', en: 'Even the ghosts are clapping!' }, status: 'draft' },
  { id: 'chochin.reveal_react.ippon.06', host: 'chochin', event: 'reveal_react', tier: 'ippon', jp: { text: 'グリーンしゃへ どうぞ！', kana: 'グリーンしゃへ どうぞ！', en: 'Right this way to the Green Car!' }, status: 'draft' },
  { id: 'chochin.reveal_react.ippon.07', host: 'chochin', event: 'reveal_react', tier: 'ippon', jp: { text: 'すばらしい！　ふとんが ふっとんだ！', kana: 'すばらしい！　ふとんが ふっとんだ！', en: 'Amazing! The futon flew away! (A pun.)' }, status: 'draft' },
  { id: 'chochin.reveal_react.ippon.08', host: 'chochin', event: 'reveal_react', tier: 'ippon', jp: { text: 'かんどう しました！', kana: 'かんどう しました！', en: 'I am deeply moved!' }, status: 'draft' },
  // encore_invite
  { id: 'chochin.encore_invite.01', host: 'chochin', event: 'encore_invite', jp: { text: '{name}さま、どうぞ アナウンスを！', kana: '{name}さま、どうぞ アナウンスを！', en: '{name}, please make the announcement!' }, slots: ['{name}'], status: 'draft' },
  { id: 'chochin.encore_invite.02', host: 'chochin', event: 'encore_invite', jp: { text: 'もう いちど、おねがい します。', kana: 'もう いちど、おねがい します。', en: 'Once more, please.' }, status: 'draft' },
  { id: 'chochin.encore_invite.03', host: 'chochin', event: 'encore_invite', jp: { text: 'みなさまの まえで、どうぞ。', kana: 'みなさまの まえで、どうぞ。', en: 'In front of everyone, please.' }, status: 'draft' },
  { id: 'chochin.encore_invite.04', host: 'chochin', event: 'encore_invite', jp: { text: 'アンコール、おねがい します！　ゆらゆら。', kana: 'アンコール、おねがい します！　ゆらゆら。', en: 'An encore, please! Sway, sway.' }, status: 'draft' },
  { id: 'chochin.encore_invite.05', host: 'chochin', event: 'encore_invite', jp: { text: '{name}さま、マイクを どうぞ。', kana: '{name}さま、マイクを どうぞ。', en: '{name}, the microphone is yours.' }, slots: ['{name}'], status: 'draft' },
  // encore_cheer
  { id: 'chochin.encore_cheer.01', host: 'chochin', event: 'encore_cheer', jp: { text: 'ブラボー！', kana: 'ブラボー！', en: 'Bravo!' }, status: 'draft' },
  { id: 'chochin.encore_cheer.02', host: 'chochin', event: 'encore_cheer', jp: { text: 'すばらしい ゆうきです！', kana: 'すばらしい ゆうきです！', en: 'Splendid courage!' }, status: 'draft' },
  { id: 'chochin.encore_cheer.03', host: 'chochin', event: 'encore_cheer', jp: { text: 'はくしゅを おねがい します！', kana: 'はくしゅを おねがい します！', en: 'A round of applause, please!' }, status: 'draft' },
  { id: 'chochin.encore_cheer.04', host: 'chochin', event: 'encore_cheer', jp: { text: 'ちょうちんも ゆらゆら おどって います！', kana: 'ちょうちんも ゆらゆら おどって います！', en: 'My lantern is swaying and dancing!' }, status: 'draft' },
  { id: 'chochin.encore_cheer.05', host: 'chochin', event: 'encore_cheer', jp: { text: 'ありがとう ございます！', kana: 'ありがとう ございます！', en: 'Thank you very much!' }, status: 'draft' },
  // natural_version
  { id: 'chochin.natural_version.01', host: 'chochin', event: 'natural_version', jp: { text: 'しぜんな いいかたを ごあんない します。', kana: 'しぜんな いいかたを ごあんない します。', en: 'Allow me to show the natural way.' }, status: 'draft' },
  { id: 'chochin.natural_version.02', host: 'chochin', event: 'natural_version', jp: { text: 'えきいんは こう いいます。', kana: 'えきいんは こう いいます。', en: 'A station attendant would say this.' }, status: 'draft' },
  { id: 'chochin.natural_version.03', host: 'chochin', event: 'natural_version', jp: { text: 'こう いうと、もっと しぜんです。', kana: 'こう いうと、もっと しぜんです。', en: 'Saying it this way is more natural.' }, status: 'draft' },
  { id: 'chochin.natural_version.04', host: 'chochin', event: 'natural_version', jp: { text: 'おてほんは こちらです。', kana: 'おてほんは こちらです。', en: 'Here is the model answer.' }, status: 'draft' },
  { id: 'chochin.natural_version.05', host: 'chochin', event: 'natural_version', jp: { text: 'よく おききください。こうです。', kana: 'よく おききください。こうです。', en: 'Please listen carefully. Like this.' }, status: 'draft' },
  // kakegoe_call
  { id: 'chochin.kakegoe_call.01', host: 'chochin', event: 'kakegoe_call', jp: { text: 'みなさま、ごいっしょに！　せーの！', kana: 'みなさま、ごいっしょに！　せーの！', en: 'Everyone, together! Ready, go!' }, status: 'draft' },
  { id: 'chochin.kakegoe_call.02', host: 'chochin', event: 'kakegoe_call', jp: { text: 'しゃないの みなさま、どうぞ！', kana: 'しゃないの みなさま、どうぞ！', en: 'All passengers aboard, please!' }, status: 'draft' },
  { id: 'chochin.kakegoe_call.03', host: 'chochin', event: 'kakegoe_call', jp: { text: 'さん、はい！　ゆらゆら！', kana: 'さん、はい！　ゆらゆら！', en: 'One, two, go! Sway, sway!' }, status: 'draft' },
  { id: 'chochin.kakegoe_call.04', host: 'chochin', event: 'kakegoe_call', jp: { text: 'おおきな こえで おねがい します！　せーの！', kana: 'おおきな こえで おねがい します！　せーの！', en: 'Loud voices, please! Ready, go!' }, status: 'draft' },
  { id: 'chochin.kakegoe_call.05', host: 'chochin', event: 'kakegoe_call', jp: { text: 'ちょうちんの あとに どうぞ！', kana: 'ちょうちんの あとに どうぞ！', en: 'Please say it after me!' }, status: 'draft' },
  // retry_clue
  { id: 'chochin.retry_clue.01', host: 'chochin', event: 'retry_clue', jp: { text: 'ヒントを ごらんください。', kana: 'ヒントを ごらんください。', en: 'Please take a look at the hint.' }, status: 'draft' },
  { id: 'chochin.retry_clue.02', host: 'chochin', event: 'retry_clue', jp: { text: 'もう いちど、どうぞ。だいじょうぶです。', kana: 'もう いちど、どうぞ。だいじょうぶです。', en: "Once more, please. You're fine." }, status: 'draft' },
  { id: 'chochin.retry_clue.03', host: 'chochin', event: 'retry_clue', jp: { text: 'おしい！　ヒントが あります。', kana: 'おしい！　ヒントが あります。', en: 'So close! There is a hint.' }, status: 'draft' },
  { id: 'chochin.retry_clue.04', host: 'chochin', event: 'retry_clue', jp: { text: 'ゆっくりで けっこうです。', kana: 'ゆっくりで けっこうです。', en: 'Please take your time.' }, status: 'draft' },
  { id: 'chochin.retry_clue.05', host: 'chochin', event: 'retry_clue', jp: { text: 'でんしゃは まって います。ヒントを どうぞ。', kana: 'でんしゃは まって います。ヒントを どうぞ。', en: "The train is waiting. Here's a hint." }, status: 'draft' },
  // miss_kind
  { id: 'chochin.miss_kind.01', host: 'chochin', event: 'miss_kind', jp: { text: 'だいじょうぶです。つぎの えきが あります。', kana: 'だいじょうぶです。つぎの えきが あります。', en: "It's fine. There's another station ahead." }, status: 'draft' },
  { id: 'chochin.miss_kind.02', host: 'chochin', event: 'miss_kind', jp: { text: 'ナイス チャレンジです！', kana: 'ナイス チャレンジです！', en: 'A fine attempt!' }, status: 'draft' },
  { id: 'chochin.miss_kind.03', host: 'chochin', event: 'miss_kind', jp: { text: 'ちょうちんも よく まちがえます。ゆらゆら。', kana: 'ちょうちんも よく まちがえます。ゆらゆら。', en: 'I make mistakes all the time. Sway, sway.' }, status: 'draft' },
  { id: 'chochin.miss_kind.04', host: 'chochin', event: 'miss_kind', jp: { text: 'ゆうきに、はくしゅ！', kana: 'ゆうきに、はくしゅ！', en: 'Applause for your courage!' }, status: 'draft' },
  { id: 'chochin.miss_kind.05', host: 'chochin', event: 'miss_kind', jp: { text: 'おてほんを みて、おぼえましょう。', kana: 'おてほんを みて、おぼえましょう。', en: "Let's look at the model and remember it." }, status: 'draft' },
  // recap_award
  { id: 'chochin.recap_award.01', host: 'chochin', event: 'recap_award', jp: { text: '{award}は… {name}さまです！', kana: '{award}は… {name}さまです！', en: 'The {award} goes to… {name}!' }, slots: ['{award}', '{name}'], status: 'draft' },
  { id: 'chochin.recap_award.02', host: 'chochin', event: 'recap_award', jp: { text: 'おめでとう ございます！ {award}、{name}さま！', kana: 'おめでとう ございます！ {award}、{name}さま！', en: 'Congratulations! The {award}: {name}!' }, slots: ['{award}', '{name}'], status: 'draft' },
  { id: 'chochin.recap_award.03', host: 'chochin', event: 'recap_award', jp: { text: 'つぎは {award}。 {name}さま！　ゆらゆら！', kana: 'つぎは {award}。 {name}さま！　ゆらゆら！', en: 'Next, the {award}. {name}! Sway, sway!' }, slots: ['{award}', '{name}'], status: 'draft' },
  { id: 'chochin.recap_award.04', host: 'chochin', event: 'recap_award', jp: { text: 'アナウンス します。 {award}は {name}さま！', kana: 'アナウンス します。 {award}は {name}さま！', en: 'An announcement. The {award}: {name}!' }, slots: ['{award}', '{name}'], status: 'draft' },
  { id: 'chochin.recap_award.05', host: 'chochin', event: 'recap_award', jp: { text: '{award}… {name}さま、おみごと！', kana: '{award}… {name}さま、おみごと！', en: 'The {award}… {name}, splendid!' }, slots: ['{award}', '{name}'], status: 'draft' },
  // play_again
  { id: 'chochin.play_again.01', host: 'chochin', event: 'play_again', jp: { text: 'もう いちど、ごじょうしゃ ください！', kana: 'もう いちど、ごじょうしゃ ください！', en: 'Please ride with us again!' }, status: 'draft' },
  { id: 'chochin.play_again.02', host: 'chochin', event: 'play_again', jp: { text: 'つぎの しゅうでんも ありますよ。', kana: 'つぎの しゅうでんも ありますよ。', en: "There's another last train, too." }, status: 'draft' },
  { id: 'chochin.play_again.03', host: 'chochin', event: 'play_again', jp: { text: 'また のって くださいね。', kana: 'また のって くださいね。', en: 'Please ride again sometime.' }, status: 'draft' },
  { id: 'chochin.play_again.04', host: 'chochin', event: 'play_again', jp: { text: 'ちょうちんは まだ あかるいです！', kana: 'ちょうちんは まだ あかるいです！', en: 'My lantern is still bright!' }, status: 'draft' },
  { id: 'chochin.play_again.05', host: 'chochin', event: 'play_again', jp: { text: 'もう いっぽん、いかがですか？', kana: 'もう いっぽん、いかがですか？', en: 'How about one more train?' }, status: 'draft' },
  // room_overrule
  { id: 'chochin.room_overrule.01', host: 'chochin', event: 'room_overrule', jp: { text: 'みなさまが オーケーと いいました。せいかいです！', kana: 'みなさまが オーケーと いいました。せいかいです！', en: 'Everyone said OK. Correct!' }, status: 'draft' },
  { id: 'chochin.room_overrule.02', host: 'chochin', event: 'room_overrule', jp: { text: 'しつれい しました！　わたしの まちがいです。', kana: 'しつれい しました！　わたしの まちがいです。', en: 'My apologies! The mistake was mine.' }, status: 'draft' },
  { id: 'chochin.room_overrule.03', host: 'chochin', event: 'room_overrule', jp: { text: 'じょうきゃくの みなさまが きめました！', kana: 'じょうきゃくの みなさまが きめました！', en: 'The passengers have decided!' }, status: 'draft' },
  { id: 'chochin.room_overrule.04', host: 'chochin', event: 'room_overrule', jp: { text: 'はい、きっぷ オーケーです！', kana: 'はい、きっぷ オーケーです！', en: 'Yes, your ticket is good!' }, status: 'draft' },
  { id: 'chochin.room_overrule.05', host: 'chochin', event: 'room_overrule', jp: { text: 'セーフ！　ごじょうしゃ ください！', kana: 'セーフ！　ごじょうしゃ ください！', en: 'Safe! All aboard!' }, status: 'draft' },
  // train_departure
  { id: 'chochin.train_departure.01', host: 'chochin', event: 'train_departure', jp: { text: 'しゅっぱつ しんこう！', kana: 'しゅっぱつ しんこう！', en: 'All clear, departing!' }, status: 'draft' },
  { id: 'chochin.train_departure.02', host: 'chochin', event: 'train_departure', jp: { text: 'ドアが しまります。ごちゅうい ください。', kana: 'ドアが しまります。ごちゅうい ください。', en: 'The doors are closing. Please be careful.' }, status: 'draft' },
  { id: 'chochin.train_departure.03', host: 'chochin', event: 'train_departure', jp: { text: 'しゅうでん、まもなく はっしゃ します。', kana: 'しゅうでん、まもなく はっしゃ します。', en: 'The last train departs shortly.' }, status: 'draft' },
  { id: 'chochin.train_departure.04', host: 'chochin', event: 'train_departure', jp: { text: 'きっぷを はいけん します。ゆらゆら。', kana: 'きっぷを はいけん します。ゆらゆら。', en: 'Tickets, please. Sway, sway.' }, status: 'draft' },
  { id: 'chochin.train_departure.05', host: 'chochin', event: 'train_departure', jp: { text: 'では、まいりましょう！', kana: 'では、まいりましょう！', en: 'Now then, let us go!' }, status: 'draft' },
  // train_stop
  { id: 'chochin.train_stop.01', host: 'chochin', event: 'train_stop', jp: { text: 'まもなく、{stop}です。', kana: 'まもなく、{stop}です。', en: 'Arriving shortly at {stop}.' }, slots: ['{stop}'], status: 'draft' },
  { id: 'chochin.train_stop.02', host: 'chochin', event: 'train_stop', jp: { text: 'つぎは {stop}、{stop}です。', kana: 'つぎは {stop}、{stop}です。', en: 'The next stop is {stop}, {stop}.' }, slots: ['{stop}'], status: 'draft' },
  { id: 'chochin.train_stop.03', host: 'chochin', event: 'train_stop', jp: { text: '{stop}に つきました。おりる まえに、もんだいです！', kana: '{stop}に つきました。おりる まえに、もんだいです！', en: "We've reached {stop}. A question before you get off!" }, slots: ['{stop}'], status: 'draft' },
  { id: 'chochin.train_stop.04', host: 'chochin', event: 'train_stop', jp: { text: '{stop}です。おわすれもの ありませんか？', kana: '{stop}です。おわすれもの ありませんか？', en: '{stop}. Have you forgotten anything?' }, slots: ['{stop}'], status: 'draft' },
  { id: 'chochin.train_stop.05', host: 'chochin', event: 'train_stop', jp: { text: '{stop}、{stop}。ドアが ひらきます。', kana: '{stop}、{stop}。ドアが ひらきます。', en: '{stop}, {stop}. The doors will open.' }, slots: ['{stop}'], status: 'draft' },
  // train_ghost
  { id: 'chochin.train_ghost.01', host: 'chochin', event: 'train_ghost', jp: { text: '{name}さま、ゆうれいに なりました… ようこそ！', kana: '{name}さま、ゆうれいに なりました… ようこそ！', en: '{name} is now a ghost… welcome!' }, slots: ['{name}'], status: 'draft' },
  { id: 'chochin.train_ghost.02', host: 'chochin', event: 'train_ghost', jp: { text: '{name}さま、ゆうれいの せきは こちらです。', kana: '{name}さま、ゆうれいの せきは こちらです。', en: '{name}, the ghost seats are this way.' }, slots: ['{name}'], status: 'draft' },
  { id: 'chochin.train_ghost.03', host: 'chochin', event: 'train_ghost', jp: { text: 'おや、{name}さま。すけて いますよ。', kana: 'おや、{name}さま。すけて いますよ。', en: "Oh, {name}. You're see-through." }, slots: ['{name}'], status: 'draft' },
  { id: 'chochin.train_ghost.04', host: 'chochin', event: 'train_ghost', jp: { text: '{name}さま、ゆうれいも まだ あそびます！', kana: '{name}さま、ゆうれいも まだ あそびます！', en: '{name}, ghosts still get to play!' }, slots: ['{name}'], status: 'draft' },
  { id: 'chochin.train_ghost.05', host: 'chochin', event: 'train_ghost', jp: { text: '{name}さま… ないしょですが、おうえん して います。', kana: '{name}さま… ないしょですが、おうえん して います。', en: "{name}… between us, I'm rooting for you." }, slots: ['{name}'], status: 'draft' },
  // train_revive
  { id: 'chochin.train_revive.01', host: 'chochin', event: 'train_revive', jp: { text: 'おかえりなさい！　もう いちど ごじょうしゃ ください！', kana: 'おかえりなさい！　もう いちど ごじょうしゃ ください！', en: 'Welcome back! Please climb aboard again!' }, status: 'draft' },
  { id: 'chochin.train_revive.02', host: 'chochin', event: 'train_revive', jp: { text: 'ゆうれいさん、ふっかつです！', kana: 'ゆうれいさん、ふっかつです！', en: 'Our ghost is back!' }, status: 'draft' },
  { id: 'chochin.train_revive.03', host: 'chochin', event: 'train_revive', jp: { text: 'すごい！　からだが もどりました！', kana: 'すごい！　からだが もどりました！', en: 'Amazing! Your body is back!' }, status: 'draft' },
  { id: 'chochin.train_revive.04', host: 'chochin', event: 'train_revive', jp: { text: 'ゆらゆら… よかった！　ほんとうに よかった！', kana: 'ゆらゆら… よかった！　ほんとうに よかった！', en: "Sway, sway… I'm so glad! So glad!" }, status: 'draft' },
  { id: 'chochin.train_revive.05', host: 'chochin', event: 'train_revive', jp: { text: 'また にんげんに なりましたね！', kana: 'また にんげんに なりましたね！', en: "You're human again!" }, status: 'draft' },
  // train_last_stop_twist
  { id: 'chochin.train_last_stop_twist.01', host: 'chochin', event: 'train_last_stop_twist', jp: { text: 'じつは… この でんしゃは わたしの ちょうちんです。', kana: 'じつは… この でんしゃは わたしの ちょうちんです。', en: 'Actually… this train is my lantern.' }, status: 'draft' },
  { id: 'chochin.train_last_stop_twist.02', host: 'chochin', event: 'train_last_stop_twist', jp: { text: 'ゆうれいの きっぷは ただです。', kana: 'ゆうれいの きっぷは ただです。', en: 'Ghosts ride free.' }, status: 'draft' },
  { id: 'chochin.train_last_stop_twist.03', host: 'chochin', event: 'train_last_stop_twist', jp: { text: 'しゅうてんです… でも、まだ おわりません！', kana: 'しゅうてんです… でも、まだ おわりません！', en: "Last stop… but it's not over yet!" }, status: 'draft' },
  { id: 'chochin.train_last_stop_twist.04', host: 'chochin', event: 'train_last_stop_twist', jp: { text: 'ひみつを いいます。わたしも ゆうれいです。', kana: 'ひみつを いいます。わたしも ゆうれいです。', en: "Here's a secret. I'm a ghost too." }, status: 'draft' },
  { id: 'chochin.train_last_stop_twist.05', host: 'chochin', event: 'train_last_stop_twist', jp: { text: 'ゆらゆら… ほんとうの しゅうてんは、ホームの むこうです！', kana: 'ゆらゆら… ほんとうの しゅうてんは、ホームの むこうです！', en: 'Sway, sway… the real last stop is past the platform!' }, status: 'draft' },
  // platform_dash
  { id: 'chochin.platform_dash.01', host: 'chochin', event: 'platform_dash', jp: { text: 'プラットホーム ダッシュ！　はしって ください！', kana: 'プラットホーム ダッシュ！　はしって ください！', en: 'Platform Dash! Run!' }, status: 'draft' },
  { id: 'chochin.platform_dash.02', host: 'chochin', event: 'platform_dash', jp: { text: 'さいごの でんしゃです！　おいそぎください！', kana: 'さいごの でんしゃです！　おいそぎください！', en: 'The very last train! Please hurry!' }, status: 'draft' },
  { id: 'chochin.platform_dash.03', host: 'chochin', event: 'platform_dash', jp: { text: 'いちばんのりは だれですか？', kana: 'いちばんのりは だれですか？', en: 'Who will be first aboard?' }, status: 'draft' },
  { id: 'chochin.platform_dash.04', host: 'chochin', event: 'platform_dash', jp: { text: 'ゆうれいさんも、まだ チャンスが あります！', kana: 'ゆうれいさんも、まだ チャンスが あります！', en: 'Ghosts, you still have a chance!' }, status: 'draft' },
  { id: 'chochin.platform_dash.05', host: 'chochin', event: 'platform_dash', jp: { text: 'ドアが しまります！　はしって ください！', kana: 'ドアが しまります！　はしって ください！', en: 'The doors are closing! Run!' }, status: 'draft' },
  // Murder at the Onsen: Chōchin-san is off duty at the inn and plays detective's narrator.
  // onsen_case
  { id: 'chochin.onsen_case.01', host: 'chochin', event: 'onsen_case', jp: { text: 'じけんです！　ゆらゆら。', kana: 'じけんです！　ゆらゆら。', en: 'We have a case! Sway, sway.' }, status: 'draft' },
  { id: 'chochin.onsen_case.02', host: 'chochin', event: 'onsen_case', jp: { text: 'おんせんで、じけんが ありました。', kana: 'おんせんで、じけんが ありました。', en: 'Something happened at the hot spring.' }, status: 'draft' },
  { id: 'chochin.onsen_case.03', host: 'chochin', event: 'onsen_case', jp: { text: 'はんにんは この なかに います。', kana: 'はんにんは この なかに います。', en: 'The culprit is among them.' }, status: 'draft' },
  { id: 'chochin.onsen_case.04', host: 'chochin', event: 'onsen_case', jp: { text: 'みなさま、たんていに なって ください。', kana: 'みなさま、たんていに なって ください。', en: 'Everyone, please be detectives.' }, status: 'draft' },
  { id: 'chochin.onsen_case.05', host: 'chochin', event: 'onsen_case', jp: { text: 'しつもんは にほんごで おねがいします。', kana: 'しつもんは にほんごで おねがいします。', en: 'Ask your questions in Japanese, please.' }, status: 'draft' },
  // onsen_turn
  { id: 'chochin.onsen_turn.01', host: 'chochin', event: 'onsen_turn', jp: { text: '{name}さま、しつもん どうぞ。', kana: '{name}さま、しつもん どうぞ。', en: '{name}, your question, please.' }, slots: ['{name}'], status: 'draft' },
  { id: 'chochin.onsen_turn.02', host: 'chochin', event: 'onsen_turn', jp: { text: '{name}さま、だれに ききますか？', kana: '{name}さま、だれに ききますか？', en: '{name}, who will you ask?' }, slots: ['{name}'], status: 'draft' },
  { id: 'chochin.onsen_turn.03', host: 'chochin', event: 'onsen_turn', jp: { text: 'つぎは {name}さまの ばんです。', kana: 'つぎは {name}さまの ばんです。', en: "Next, it's {name}'s turn." }, slots: ['{name}'], status: 'draft' },
  { id: 'chochin.onsen_turn.04', host: 'chochin', event: 'onsen_turn', jp: { text: '{name}さま、なんでも きいて ください。', kana: '{name}さま、なんでも きいて ください。', en: '{name}, ask them anything.' }, slots: ['{name}'], status: 'draft' },
  { id: 'chochin.onsen_turn.05', host: 'chochin', event: 'onsen_turn', jp: { text: '{name}さま、ゆっくり どうぞ。ゆらゆら。', kana: '{name}さま、ゆっくり どうぞ。ゆらゆら。', en: '{name}, take your time. Sway, sway.' }, slots: ['{name}'], status: 'draft' },
  // onsen_clue
  { id: 'chochin.onsen_clue.01', host: 'chochin', event: 'onsen_clue', jp: { text: 'おや？　だいじな てがかりです！', kana: 'おや？　だいじな てがかりです！', en: 'Oh? An important clue!' }, status: 'draft' },
  { id: 'chochin.onsen_clue.02', host: 'chochin', event: 'onsen_clue', jp: { text: 'それは あやしいですね…', kana: 'それは あやしいですね…', en: 'Now that is suspicious…' }, status: 'draft' },
  { id: 'chochin.onsen_clue.03', host: 'chochin', event: 'onsen_clue', jp: { text: 'メモ しましょう！', kana: 'メモ しましょう！', en: "Let's write that down!" }, status: 'draft' },
  { id: 'chochin.onsen_clue.04', host: 'chochin', event: 'onsen_clue', jp: { text: 'いい しつもんでした！', kana: 'いい しつもんでした！', en: 'That was a good question!' }, status: 'draft' },
  { id: 'chochin.onsen_clue.05', host: 'chochin', event: 'onsen_clue', jp: { text: 'ゆらゆら… なにか みえて きました。', kana: 'ゆらゆら… なにか みえて きました。', en: 'Sway, sway… something is coming to light.' }, status: 'draft' },
  // onsen_accuse
  { id: 'chochin.onsen_accuse.01', host: 'chochin', event: 'onsen_accuse', jp: { text: 'はんにんは だれですか？', kana: 'はんにんは だれですか？', en: 'Who is the culprit?' }, status: 'draft' },
  { id: 'chochin.onsen_accuse.02', host: 'chochin', event: 'onsen_accuse', jp: { text: 'おおきな こえで どうぞ！', kana: 'おおきな こえで どうぞ！', en: 'Say it nice and loud!' }, status: 'draft' },
  { id: 'chochin.onsen_accuse.03', host: 'chochin', event: 'onsen_accuse', jp: { text: 'さあ、きめて ください。', kana: 'さあ、きめて ください。', en: 'Now, please decide.' }, status: 'draft' },
  { id: 'chochin.onsen_accuse.04', host: 'chochin', event: 'onsen_accuse', jp: { text: 'よく かんがえて ください。ゆらゆら。', kana: 'よく かんがえて ください。ゆらゆら。', en: 'Think carefully. Sway, sway.' }, status: 'draft' },
  { id: 'chochin.onsen_accuse.05', host: 'chochin', event: 'onsen_accuse', jp: { text: 'メモを みて ください。はんにんは…？', kana: 'メモを みて ください。はんにんは…？', en: 'Look at your notes. The culprit is…?' }, status: 'draft' },
  // onsen_reveal
  { id: 'chochin.onsen_reveal.01', host: 'chochin', event: 'onsen_reveal', jp: { text: 'はんにんは… この ひとです！', kana: 'はんにんは… この ひとです！', en: 'The culprit is… this one!' }, status: 'draft' },
  { id: 'chochin.onsen_reveal.02', host: 'chochin', event: 'onsen_reveal', jp: { text: 'じけん かいけつです！', kana: 'じけん かいけつです！', en: 'Case closed!' }, status: 'draft' },
  { id: 'chochin.onsen_reveal.03', host: 'chochin', event: 'onsen_reveal', jp: { text: 'ゆらゆら… ほんとうの ことを はなして ください。', kana: 'ゆらゆら… ほんとうの ことを はなして ください。', en: 'Sway, sway… please tell us the truth.' }, status: 'draft' },
  { id: 'chochin.onsen_reveal.04', host: 'chochin', event: 'onsen_reveal', jp: { text: 'みなさま、おみごとでした。', kana: 'みなさま、おみごとでした。', en: 'Splendid work, everyone.' }, status: 'draft' },
  { id: 'chochin.onsen_reveal.05', host: 'chochin', event: 'onsen_reveal', jp: { text: 'さあ、こたえあわせです！', kana: 'さあ、こたえあわせです！', en: "Now, let's check the answer!" }, status: 'draft' },
  // Who's the Tourist?: Chōchin-san guides the tour, and admires a good disguise.
  // tourist_intro
  { id: 'chochin.tourist_intro.01', host: 'chochin', event: 'tourist_intro', jp: { text: 'かんこうきゃくは だれでしょう？　ゆらゆら。', kana: 'かんこうきゃくは だれでしょう？　ゆらゆら。', en: 'Who could the tourist be? Sway, sway.' }, status: 'draft' },
  { id: 'chochin.tourist_intro.02', host: 'chochin', event: 'tourist_intro', jp: { text: 'ひとりだけ、ばしょを しりません。', kana: 'ひとりだけ、ばしょを しりません。', en: "Only one of you doesn't know where we are." }, status: 'draft' },
  { id: 'chochin.tourist_intro.03', host: 'chochin', event: 'tourist_intro', jp: { text: 'しつもんは にほんごで どうぞ。', kana: 'しつもんは にほんごで どうぞ。', en: 'Ask your questions in Japanese, please.' }, status: 'draft' },
  { id: 'chochin.tourist_intro.04', host: 'chochin', event: 'tourist_intro', jp: { text: 'ばしょの なまえは、ないしょですよ。', kana: 'ばしょの なまえは、ないしょですよ。', en: "The place's name is a secret, remember." }, status: 'draft' },
  { id: 'chochin.tourist_intro.05', host: 'chochin', event: 'tourist_intro', jp: { text: 'たびの はじまりです。ゆらゆら。', kana: 'たびの はじまりです。ゆらゆら。', en: 'Our trip begins. Sway, sway.' }, status: 'draft' },
  // tourist_deal
  { id: 'chochin.tourist_deal.01', host: 'chochin', event: 'tourist_deal', jp: { text: 'カードを みて ください。ないしょですよ。', kana: 'カードを みて ください。ないしょですよ。', en: "Look at your card. It's a secret." }, status: 'draft' },
  { id: 'chochin.tourist_deal.02', host: 'chochin', event: 'tourist_deal', jp: { text: 'きょうは どこでしょう？', kana: 'きょうは どこでしょう？', en: 'Where are we today?' }, status: 'draft' },
  { id: 'chochin.tourist_deal.03', host: 'chochin', event: 'tourist_deal', jp: { text: 'ひとりだけ、かんこうきゃくです。', kana: 'ひとりだけ、かんこうきゃくです。', en: 'Just one of you is the tourist.' }, status: 'draft' },
  { id: 'chochin.tourist_deal.04', host: 'chochin', event: 'tourist_deal', jp: { text: 'スマホは だれにも みせないで ください。', kana: 'スマホは だれにも みせないで ください。', en: "Don't show anyone your phone." }, status: 'draft' },
  { id: 'chochin.tourist_deal.05', host: 'chochin', event: 'tourist_deal', jp: { text: 'しずかに カードを みて ください。', kana: 'しずかに カードを みて ください。', en: 'Look at your card quietly.' }, status: 'draft' },
  // tourist_vote
  { id: 'chochin.tourist_vote.01', host: 'chochin', event: 'tourist_vote', jp: { text: 'とうひょうの じかんです！', kana: 'とうひょうの じかんです！', en: 'Time to vote!' }, status: 'draft' },
  { id: 'chochin.tourist_vote.02', host: 'chochin', event: 'tourist_vote', jp: { text: 'かんこうきゃくは だれですか？', kana: 'かんこうきゃくは だれですか？', en: 'Who is the tourist?' }, status: 'draft' },
  { id: 'chochin.tourist_vote.03', host: 'chochin', event: 'tourist_vote', jp: { text: 'あやしい ひとは だれですか？', kana: 'あやしい ひとは だれですか？', en: "Who's acting suspicious?" }, status: 'draft' },
  { id: 'chochin.tourist_vote.04', host: 'chochin', event: 'tourist_vote', jp: { text: 'よく かんがえて ください。ゆらゆら。', kana: 'よく かんがえて ください。ゆらゆら。', en: 'Think carefully. Sway, sway.' }, status: 'draft' },
  { id: 'chochin.tourist_vote.05', host: 'chochin', event: 'tourist_vote', jp: { text: 'さあ、えらんで ください。', kana: 'さあ、えらんで ください。', en: 'Now, please choose.' }, status: 'draft' },
  // tourist_last_chance
  { id: 'chochin.tourist_last_chance.01', host: 'chochin', event: 'tourist_last_chance', jp: { text: '{name}さま、ここは どこですか？', kana: '{name}さま、ここは どこですか？', en: '{name}, where are we?' }, slots: ['{name}'], status: 'draft' },
  { id: 'chochin.tourist_last_chance.02', host: 'chochin', event: 'tourist_last_chance', jp: { text: '{name}さま、さいごの チャンスです！', kana: '{name}さま、さいごの チャンスです！', en: '{name}, this is your last chance!' }, slots: ['{name}'], status: 'draft' },
  { id: 'chochin.tourist_last_chance.03', host: 'chochin', event: 'tourist_last_chance', jp: { text: '{name}さま、ばしょを あてて ください。', kana: '{name}さま、ばしょを あてて ください。', en: '{name}, guess the place.' }, slots: ['{name}'], status: 'draft' },
  { id: 'chochin.tourist_last_chance.04', host: 'chochin', event: 'tourist_last_chance', jp: { text: 'まだ おわりでは ありません。{name}さま、どうぞ！', kana: 'まだ おわりでは ありません。{name}さま、どうぞ！', en: "It's not over yet. Go ahead, {name}!" }, slots: ['{name}'], status: 'draft' },
  { id: 'chochin.tourist_last_chance.05', host: 'chochin', event: 'tourist_last_chance', jp: { text: '{name}さま、ゆっくり どうぞ。ゆらゆら。', kana: '{name}さま、ゆっくり どうぞ。ゆらゆら。', en: 'Take your time, {name}. Sway, sway.' }, slots: ['{name}'], status: 'draft' },
  // tourist_caught
  { id: 'chochin.tourist_caught.01', host: 'chochin', event: 'tourist_caught', jp: { text: 'つかまえました！', kana: 'つかまえました！', en: 'Caught!' }, status: 'draft' },
  { id: 'chochin.tourist_caught.02', host: 'chochin', event: 'tourist_caught', jp: { text: 'おみごと！　みなさま、めいたんていです。', kana: 'おみごと！　みなさま、めいたんていです。', en: "Splendid! You're all great detectives." }, status: 'draft' },
  { id: 'chochin.tourist_caught.03', host: 'chochin', event: 'tourist_caught', jp: { text: '{name}さまが かんこうきゃくでした！', kana: '{name}さまが かんこうきゃくでした！', en: '{name} was the tourist!' }, slots: ['{name}'], status: 'draft' },
  { id: 'chochin.tourist_caught.04', host: 'chochin', event: 'tourist_caught', jp: { text: 'ゆらゆら… {name}さま、ばれて しまいましたね。', kana: 'ゆらゆら… {name}さま、ばれて しまいましたね。', en: 'Sway, sway… they found you out, {name}.' }, slots: ['{name}'], status: 'draft' },
  { id: 'chochin.tourist_caught.05', host: 'chochin', event: 'tourist_caught', jp: { text: 'じもとの みなさまの かちです！', kana: 'じもとの みなさまの かちです！', en: 'The locals win!' }, status: 'draft' },
  // tourist_escaped
  { id: 'chochin.tourist_escaped.01', host: 'chochin', event: 'tourist_escaped', jp: { text: 'かんこうきゃくの かちです！', kana: 'かんこうきゃくの かちです！', en: 'The tourist wins!' }, status: 'draft' },
  { id: 'chochin.tourist_escaped.02', host: 'chochin', event: 'tourist_escaped', jp: { text: '{name}さま、みごとな へんそうでした。', kana: '{name}さま、みごとな へんそうでした。', en: 'A splendid disguise, {name}.' }, slots: ['{name}'], status: 'draft' },
  { id: 'chochin.tourist_escaped.03', host: 'chochin', event: 'tourist_escaped', jp: { text: 'ゆらゆら… だれも きづきませんでした。', kana: 'ゆらゆら… だれも きづきませんでした。', en: 'Sway, sway… nobody noticed.' }, status: 'draft' },
  { id: 'chochin.tourist_escaped.04', host: 'chochin', event: 'tourist_escaped', jp: { text: '{name}さまに にげられました！', kana: '{name}さまに にげられました！', en: '{name} got away!' }, slots: ['{name}'], status: 'draft' },
  { id: 'chochin.tourist_escaped.05', host: 'chochin', event: 'tourist_escaped', jp: { text: '{name}さま、じょうずでしたね！', kana: '{name}さま、じょうずでしたね！', en: 'Nicely done, {name}!' }, slots: ['{name}'], status: 'draft' },
];
