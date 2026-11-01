// Nobiko-san (rokurokubi matchmaking auntie): Omiai Matchmaker, Karaoke Duel.
//
// Written fallback host lines (Phase 1 host bank). All lines are kana-only so
// kana-level players can read them; `kana` is exactly what TTS voices.
// Ids are stable: never renumber or reuse an id. Add new lines at the end of
// an event with the next number. Every line is `draft` until a fluent check.
//
// Her voice: a warm, nosy おばちゃん. Soft feminine endings (〜わよ, 〜わね, あらまあ), kept to
// simple kana. Her gags: the neck stretches out to eavesdrop (にゅーっ), the husband is a living
// kotatsu who never leaves the house (うちの だんな), and she matchmakes everyone (おにあいね！).
// Kids and Cheeky lines for the big moments are in audienceLines.ts. Karaoke Duel cues encore_invite,
// encore_cheer, reveal_react (good, ippon) and miss_kind too, so keep those free of politeness talk.

import type { HostLine } from '../types.js';

export const nobikoLines: HostLine[] = [
  // lobby_welcome
  { id: 'nobiko.lobby_welcome.01', host: 'nobiko', event: 'lobby_welcome', jp: { text: 'あらまあ、いらっしゃい！　のびこです。', kana: 'あらまあ、いらっしゃい！　のびこです。', en: "Oh my, welcome! I'm Nobiko." }, status: 'draft' },
  { id: 'nobiko.lobby_welcome.02', host: 'nobiko', event: 'lobby_welcome', jp: { text: 'みんな すてきね。だれか いい ひと いる？', kana: 'みんな すてきね。だれか いい ひと いる？', en: "Aren't you all lovely. Seeing anyone?" }, status: 'draft' },
  { id: 'nobiko.lobby_welcome.03', host: 'nobiko', event: 'lobby_welcome', jp: { text: 'くびを ながーく して まってたわよ！', kana: 'くびを ながーく して まってたわよ！', en: "I've been waiting with my neck stretched out! (Japanese for 'waiting eagerly'.)" }, status: 'draft' },
  { id: 'nobiko.lobby_welcome.04', host: 'nobiko', event: 'lobby_welcome', jp: { text: 'さあ さあ、すわって。おちゃ どうぞ。', kana: 'さあ さあ、すわって。おちゃ どうぞ。', en: 'Come in, sit down. Have some tea.' }, status: 'draft' },
  { id: 'nobiko.lobby_welcome.05', host: 'nobiko', event: 'lobby_welcome', jp: { text: 'こんばんは！　うちの だんなは おるすばんよ。', kana: 'こんばんは！　うちの だんなは おるすばんよ。', en: "Good evening! My husband is minding the house." }, status: 'draft' },
  // mic_check_ok
  { id: 'nobiko.mic_check_ok.01', host: 'nobiko', event: 'mic_check_ok', jp: { text: '{name}さん、きこえたわよ！', kana: '{name}さん、きこえたわよ！', en: 'I heard you, {name}!' }, slots: ['{name}'], status: 'draft' },
  { id: 'nobiko.mic_check_ok.02', host: 'nobiko', event: 'mic_check_ok', jp: { text: 'まあ、{name}さん、いい こえ！', kana: 'まあ、{name}さん、いい こえ！', en: 'My, {name}, what a nice voice!' }, slots: ['{name}'], status: 'draft' },
  { id: 'nobiko.mic_check_ok.03', host: 'nobiko', event: 'mic_check_ok', jp: { text: '{name}さん、ばっちり きこえるわ。', kana: '{name}さん、ばっちり きこえるわ。', en: 'I can hear you perfectly, {name}.' }, slots: ['{name}'], status: 'draft' },
  { id: 'nobiko.mic_check_ok.04', host: 'nobiko', event: 'mic_check_ok', jp: { text: 'にゅーっ！　{name}さんの こえ、きこえた！', kana: 'にゅーっ！　{name}さんの こえ、きこえた！', en: '(Neck stretches.) Heard you, {name}!' }, slots: ['{name}'], status: 'draft' },
  { id: 'nobiko.mic_check_ok.05', host: 'nobiko', event: 'mic_check_ok', jp: { text: '{name}さん、よろしくね。', kana: '{name}さん、よろしくね。', en: 'Nice to meet you, {name}.' }, slots: ['{name}'], status: 'draft' },
  // mic_check_quiet
  { id: 'nobiko.mic_check_quiet.01', host: 'nobiko', event: 'mic_check_quiet', jp: { text: 'だいじょうぶよ。タップで いいわよ。', kana: 'だいじょうぶよ。タップで いいわよ。', en: "It's fine. Tapping is fine." }, status: 'draft' },
  { id: 'nobiko.mic_check_quiet.02', host: 'nobiko', event: 'mic_check_quiet', jp: { text: 'はずかしがりやさんね。もじで どうぞ。', kana: 'はずかしがりやさんね。もじで どうぞ。', en: 'A shy one. Write it instead, dear.' }, status: 'draft' },
  { id: 'nobiko.mic_check_quiet.03', host: 'nobiko', event: 'mic_check_quiet', jp: { text: 'マイクは おやすみね。うちの だんなと おなじ。', kana: 'マイクは おやすみね。うちの だんなと おなじ。', en: "The mic is napping. Just like my husband." }, status: 'draft' },
  { id: 'nobiko.mic_check_quiet.04', host: 'nobiko', event: 'mic_check_quiet', jp: { text: 'こえは あとで いいわよ。', kana: 'こえは あとで いいわよ。', en: 'Your voice can come later.' }, status: 'draft' },
  { id: 'nobiko.mic_check_quiet.05', host: 'nobiko', event: 'mic_check_quiet', jp: { text: 'しずかな ひとも、すてきよ。', kana: 'しずかな ひとも、すてきよ。', en: 'Quiet people are lovely too.' }, status: 'draft' },
  // intro
  { id: 'nobiko.intro.01', host: 'nobiko', event: 'intro', jp: { text: 'なこうどの のびこです。よろしくね！', kana: 'なこうどの のびこです。よろしくね！', en: "I'm Nobiko, your matchmaker. Pleased to meet you!" }, status: 'draft' },
  { id: 'nobiko.intro.02', host: 'nobiko', event: 'intro', jp: { text: 'こたえは ぜんぶ きこえるわよ。くびが ながいから。', kana: 'こたえは ぜんぶ きこえるわよ。くびが ながいから。', en: 'I hear every answer. My neck is long, you see.' }, status: 'draft' },
  { id: 'nobiko.intro.03', host: 'nobiko', event: 'intro', jp: { text: 'まちがえても いいの。たのしく いきましょう！', kana: 'まちがえても いいの。たのしく いきましょう！', en: "Mistakes are fine. Let's have fun!" }, status: 'draft' },
  { id: 'nobiko.intro.04', host: 'nobiko', event: 'intro', jp: { text: 'こんやは だれと だれが おにあいかしら？', kana: 'こんやは だれと だれが おにあいかしら？', en: 'I wonder who makes a lovely pair tonight?' }, status: 'draft' },
  { id: 'nobiko.intro.05', host: 'nobiko', event: 'intro', jp: { text: 'うちの だんなも テレビで みてるわよ。こたつから。', kana: 'うちの だんなも テレビで みてるわよ。こたつから。', en: 'My husband is watching on TV. From the kotatsu.' }, status: 'draft' },
  // prompt_read
  { id: 'nobiko.prompt_read.01', host: 'nobiko', event: 'prompt_read', jp: { text: 'では、しつもんよ。', kana: 'では、しつもんよ。', en: "Now, here's the question." }, status: 'draft' },
  { id: 'nobiko.prompt_read.02', host: 'nobiko', event: 'prompt_read', jp: { text: 'よく きいてね。', kana: 'よく きいてね。', en: 'Listen closely, dear.' }, status: 'draft' },
  { id: 'nobiko.prompt_read.03', host: 'nobiko', event: 'prompt_read', jp: { text: 'あら、いい しつもん！', kana: 'あら、いい しつもん！', en: 'Oh, a good question!' }, status: 'draft' },
  { id: 'nobiko.prompt_read.04', host: 'nobiko', event: 'prompt_read', jp: { text: 'つぎの しつもんは こちら。', kana: 'つぎの しつもんは こちら。', en: "Here's the next question." }, status: 'draft' },
  { id: 'nobiko.prompt_read.05', host: 'nobiko', event: 'prompt_read', jp: { text: 'わたしも ききたいわ。しつもんです！', kana: 'わたしも ききたいわ。しつもんです！', en: "I want to know too. Here's the question!" }, status: 'draft' },
  // say_it_first
  { id: 'nobiko.say_it_first.01', host: 'nobiko', event: 'say_it_first', jp: { text: 'まず、こえで いって みて。', kana: 'まず、こえで いって みて。', en: 'First, try saying it out loud.' }, status: 'draft' },
  { id: 'nobiko.say_it_first.02', host: 'nobiko', event: 'say_it_first', jp: { text: 'じぶんの ことばで どうぞ。', kana: 'じぶんの ことばで どうぞ。', en: 'In your own words, please.' }, status: 'draft' },
  { id: 'nobiko.say_it_first.03', host: 'nobiko', event: 'say_it_first', jp: { text: 'くびを のばして きいて いるわよ。', kana: 'くびを のばして きいて いるわよ。', en: "I'm stretching my neck to listen." }, status: 'draft' },
  { id: 'nobiko.say_it_first.04', host: 'nobiko', event: 'say_it_first', jp: { text: 'ごびょうよ。どうぞ！', kana: 'ごびょうよ。どうぞ！', en: 'Five seconds. Go ahead!' }, status: 'draft' },
  { id: 'nobiko.say_it_first.05', host: 'nobiko', event: 'say_it_first', jp: { text: 'えんりょ しないで、いって ごらん。', kana: 'えんりょ しないで、いって ごらん。', en: "Don't be shy, go on and say it." }, status: 'draft' },
  // answer_hurry
  { id: 'nobiko.answer_hurry.01', host: 'nobiko', event: 'answer_hurry', jp: { text: 'あらあら、いそいで！', kana: 'あらあら、いそいで！', en: 'Oh dear, hurry!' }, status: 'draft' },
  { id: 'nobiko.answer_hurry.02', host: 'nobiko', event: 'answer_hurry', jp: { text: 'おちゃが さめちゃうわよ！', kana: 'おちゃが さめちゃうわよ！', en: 'The tea is getting cold!' }, status: 'draft' },
  { id: 'nobiko.answer_hurry.03', host: 'nobiko', event: 'answer_hurry', jp: { text: 'あと すこし！　まってるわよ！', kana: 'あと すこし！　まってるわよ！', en: "Almost out of time! I'm waiting!" }, status: 'draft' },
  { id: 'nobiko.answer_hurry.04', host: 'nobiko', event: 'answer_hurry', jp: { text: 'くびが どんどん のびちゃう！', kana: 'くびが どんどん のびちゃう！', en: 'My neck keeps stretching!' }, status: 'draft' },
  { id: 'nobiko.answer_hurry.05', host: 'nobiko', event: 'answer_hurry', jp: { text: 'はやく、はやく！　じかんよ！', kana: 'はやく、はやく！　じかんよ！', en: "Quick, quick! Time's up soon!" }, status: 'draft' },
  // all_in
  { id: 'nobiko.all_in.01', host: 'nobiko', event: 'all_in', jp: { text: 'みんな こたえたわね。えらい！', kana: 'みんな こたえたわね。えらい！', en: 'Everyone answered. Well done!' }, status: 'draft' },
  { id: 'nobiko.all_in.02', host: 'nobiko', event: 'all_in', jp: { text: 'はやいわね！　すてき。', kana: 'はやいわね！　すてき。', en: 'So quick! Lovely.' }, status: 'draft' },
  { id: 'nobiko.all_in.03', host: 'nobiko', event: 'all_in', jp: { text: 'はい、ぜんいん そろいました。', kana: 'はい、ぜんいん そろいました。', en: "Right, everyone's in." }, status: 'draft' },
  { id: 'nobiko.all_in.04', host: 'nobiko', event: 'all_in', jp: { text: 'うちの だんなより ずっと はやいわ。', kana: 'うちの だんなより ずっと はやいわ。', en: 'Much faster than my husband.' }, status: 'draft' },
  { id: 'nobiko.all_in.05', host: 'nobiko', event: 'all_in', jp: { text: 'さあ、こたえを みましょうか。', kana: 'さあ、こたえを みましょうか。', en: "Now, shall we see the answers?" }, status: 'draft' },
  // reveal_react.flop
  { id: 'nobiko.reveal_react.flop.01', host: 'nobiko', event: 'reveal_react', tier: 'flop', jp: { text: 'あらまあ… でも、げんきが いいわね！', kana: 'あらまあ… でも、げんきが いいわね！', en: 'Oh my… but what spirit!' }, status: 'draft' },
  { id: 'nobiko.reveal_react.flop.02', host: 'nobiko', event: 'reveal_react', tier: 'flop', jp: { text: 'くびが ちぢんじゃった…', kana: 'くびが ちぢんじゃった…', en: 'My neck just shrank…' }, status: 'draft' },
  { id: 'nobiko.reveal_react.flop.03', host: 'nobiko', event: 'reveal_react', tier: 'flop', jp: { text: 'おしい！　つぎは きっと だいじょうぶ。', kana: 'おしい！　つぎは きっと だいじょうぶ。', en: "So close! Next time you'll be fine." }, status: 'draft' },
  { id: 'nobiko.reveal_react.flop.04', host: 'nobiko', event: 'reveal_react', tier: 'flop', jp: { text: 'うーん、おみあいなら「また こんど」ね。', kana: 'うーん、おみあいなら「また こんど」ね。', en: "Hmm, at an omiai that's a 'maybe next time'." }, status: 'draft' },
  { id: 'nobiko.reveal_react.flop.05', host: 'nobiko', event: 'reveal_react', tier: 'flop', jp: { text: 'だいじょうぶ。わたしも わかい ころは そうだった。', kana: 'だいじょうぶ。わたしも わかい ころは そうだった。', en: 'It’s fine. I was like that when I was young too.' }, status: 'draft' },
  { id: 'nobiko.reveal_react.flop.06', host: 'nobiko', event: 'reveal_react', tier: 'flop', jp: { text: 'あらら。おちゃでも のんで、もう いちど。', kana: 'あらら。おちゃでも のんで、もう いちど。', en: 'Oh dear. Have some tea, and try again.' }, status: 'draft' },
  { id: 'nobiko.reveal_react.flop.07', host: 'nobiko', event: 'reveal_react', tier: 'flop', jp: { text: 'まあ、ゆうきは まんてんよ！', kana: 'まあ、ゆうきは まんてんよ！', en: 'Well, full marks for courage!' }, status: 'draft' },
  { id: 'nobiko.reveal_react.flop.08', host: 'nobiko', event: 'reveal_react', tier: 'flop', jp: { text: 'しーん… こたつの だんなも おきないわ。', kana: 'しーん… こたつの だんなも おきないわ。', en: "Silence… not even my kotatsu husband woke up." }, status: 'draft' },
  // reveal_react.good
  { id: 'nobiko.reveal_react.good.01', host: 'nobiko', event: 'reveal_react', tier: 'good', jp: { text: 'まあ、すてき！', kana: 'まあ、すてき！', en: 'Oh, lovely!' }, status: 'draft' },
  { id: 'nobiko.reveal_react.good.02', host: 'nobiko', event: 'reveal_react', tier: 'good', jp: { text: 'いいわね！　おにあいよ！', kana: 'いいわね！　おにあいよ！', en: 'Nice! What a match!' }, status: 'draft' },
  { id: 'nobiko.reveal_react.good.03', host: 'nobiko', event: 'reveal_react', tier: 'good', jp: { text: 'にゅーっ！　もっと ききたいわ！', kana: 'にゅーっ！　もっと ききたいわ！', en: '(Neck stretches.) I want to hear more!' }, status: 'draft' },
  { id: 'nobiko.reveal_react.good.04', host: 'nobiko', event: 'reveal_react', tier: 'good', jp: { text: 'じょうずね！　おばちゃん、ほめちゃう！', kana: 'じょうずね！　おばちゃん、ほめちゃう！', en: "You're good! Auntie can't help praising you!" }, status: 'draft' },
  { id: 'nobiko.reveal_react.good.05', host: 'nobiko', event: 'reveal_react', tier: 'good', jp: { text: 'あら、センスが いいわね。', kana: 'あら、センスが いいわね。', en: 'Oh, you have good taste.' }, status: 'draft' },
  { id: 'nobiko.reveal_react.good.06', host: 'nobiko', event: 'reveal_react', tier: 'good', jp: { text: 'あら、ドキドキ しちゃう。', kana: 'あら、ドキドキ しちゃう。', en: 'Oh, my heart is fluttering.' }, status: 'draft' },
  { id: 'nobiko.reveal_react.good.07', host: 'nobiko', event: 'reveal_react', tier: 'good', jp: { text: 'その こたえ、ともだちに はなしちゃおう。', kana: 'その こたえ、ともだちに はなしちゃおう。', en: "I'm telling all my friends about that answer." }, status: 'draft' },
  { id: 'nobiko.reveal_react.good.08', host: 'nobiko', event: 'reveal_react', tier: 'good', jp: { text: 'はなまる！　おちゃ おかわり どうぞ！', kana: 'はなまる！　おちゃ おかわり どうぞ！', en: 'Gold star! Have another cup of tea!' }, status: 'draft' },
  // reveal_react.ippon
  { id: 'nobiko.reveal_react.ippon.01', host: 'nobiko', event: 'reveal_react', tier: 'ippon', jp: { text: 'あらまあ！　くびが てんじょうまで のびた！', kana: 'あらまあ！　くびが てんじょうまで のびた！', en: 'Oh my! My neck stretched up to the ceiling!' }, status: 'draft' },
  { id: 'nobiko.reveal_react.ippon.02', host: 'nobiko', event: 'reveal_react', tier: 'ippon', jp: { text: 'すばらしい！　すぐ けっこん できるわよ！', kana: 'すばらしい！　すぐ けっこん できるわよ！', en: "Wonderful! You'll be married in no time!" }, status: 'draft' },
  { id: 'nobiko.reveal_react.ippon.03', host: 'nobiko', event: 'reveal_react', tier: 'ippon', jp: { text: 'まあ まあ まあ！　まんてんよ！', kana: 'まあ まあ まあ！　まんてんよ！', en: 'My my my! Full marks!' }, status: 'draft' },
  { id: 'nobiko.reveal_react.ippon.04', host: 'nobiko', event: 'reveal_react', tier: 'ippon', jp: { text: 'すてき！　だんなも こたつから でて きたわ！', kana: 'すてき！　だんなも こたつから でて きたわ！', en: 'Lovely! Even my husband came out of the kotatsu!' }, status: 'draft' },
  { id: 'nobiko.reveal_react.ippon.05', host: 'nobiko', event: 'reveal_react', tier: 'ippon', jp: { text: 'きいた？　みんな、いまの きいた？', kana: 'きいた？　みんな、いまの きいた？', en: 'Did you hear? Everyone, did you hear that?' }, status: 'draft' },
  { id: 'nobiko.reveal_react.ippon.06', host: 'nobiko', event: 'reveal_react', tier: 'ippon', jp: { text: 'さいこう！　あしたの おちゃかいで はなすわ！', kana: 'さいこう！　あしたの おちゃかいで はなすわ！', en: "The best! I'm telling everyone at tomorrow's tea party!" }, status: 'draft' },
  { id: 'nobiko.reveal_react.ippon.07', host: 'nobiko', event: 'reveal_react', tier: 'ippon', jp: { text: 'こんな こたえ、はじめて！　にゅーっ！', kana: 'こんな こたえ、はじめて！　にゅーっ！', en: 'Never heard an answer like it! (Neck stretches.)' }, status: 'draft' },
  { id: 'nobiko.reveal_react.ippon.08', host: 'nobiko', event: 'reveal_react', tier: 'ippon', jp: { text: 'しゃしんを とらせて！　おみあい しゃしんに するわ！', kana: 'しゃしんを とらせて！　おみあい しゃしんに するわ！', en: "Let me take your picture! It's going in my matchmaking album!" }, status: 'draft' },
  // encore_invite
  { id: 'nobiko.encore_invite.01', host: 'nobiko', event: 'encore_invite', jp: { text: '{name}さん、もう いちど きかせて！', kana: '{name}さん、もう いちど きかせて！', en: '{name}, let me hear it once more!' }, slots: ['{name}'], status: 'draft' },
  { id: 'nobiko.encore_invite.02', host: 'nobiko', event: 'encore_invite', jp: { text: 'アンコール！　みんなの まえで どうぞ。', kana: 'アンコール！　みんなの まえで どうぞ。', en: 'Encore! In front of everyone, please.' }, status: 'draft' },
  { id: 'nobiko.encore_invite.03', host: 'nobiko', event: 'encore_invite', jp: { text: '{name}さん、マイクを どうぞ。', kana: '{name}さん、マイクを どうぞ。', en: '{name}, the microphone is yours.' }, slots: ['{name}'], status: 'draft' },
  { id: 'nobiko.encore_invite.04', host: 'nobiko', event: 'encore_invite', jp: { text: '{name}さん、みんな まってるわよ！', kana: '{name}さん、みんな まってるわよ！', en: "{name}, everyone's waiting for you!" }, slots: ['{name}'], status: 'draft' },
  { id: 'nobiko.encore_invite.05', host: 'nobiko', event: 'encore_invite', jp: { text: 'さあ、{name}さんの ばんよ！', kana: 'さあ、{name}さんの ばんよ！', en: "Now, it's {name}'s turn!" }, slots: ['{name}'], status: 'draft' },
  // encore_cheer
  { id: 'nobiko.encore_cheer.01', host: 'nobiko', event: 'encore_cheer', jp: { text: 'すてき！　はくしゅ！', kana: 'すてき！　はくしゅ！', en: 'Lovely! A round of applause!' }, status: 'draft' },
  { id: 'nobiko.encore_cheer.02', host: 'nobiko', event: 'encore_cheer', jp: { text: 'まあ、じょうず！', kana: 'まあ、じょうず！', en: 'My, how skilful!' }, status: 'draft' },
  { id: 'nobiko.encore_cheer.03', host: 'nobiko', event: 'encore_cheer', jp: { text: 'くびが ゆらゆら おどって いるわ！', kana: 'くびが ゆらゆら おどって いるわ！', en: 'My neck is swaying and dancing!' }, status: 'draft' },
  { id: 'nobiko.encore_cheer.04', host: 'nobiko', event: 'encore_cheer', jp: { text: 'ゆうきが ある ひと、だいすき！', kana: 'ゆうきが ある ひと、だいすき！', en: 'I love people with courage!' }, status: 'draft' },
  { id: 'nobiko.encore_cheer.05', host: 'nobiko', event: 'encore_cheer', jp: { text: 'ありがとう！　しびれたわ！', kana: 'ありがとう！　しびれたわ！', en: 'Thank you! That gave me chills!' }, status: 'draft' },
  // natural_version
  { id: 'nobiko.natural_version.01', host: 'nobiko', event: 'natural_version', jp: { text: 'こう いうと、もっと すてきよ。', kana: 'こう いうと、もっと すてきよ。', en: 'Say it like this. Even lovelier.' }, status: 'draft' },
  { id: 'nobiko.natural_version.02', host: 'nobiko', event: 'natural_version', jp: { text: 'おみあいなら、こう いうのよ。', kana: 'おみあいなら、こう いうのよ。', en: "At an omiai, you'd say it like this." }, status: 'draft' },
  { id: 'nobiko.natural_version.03', host: 'nobiko', event: 'natural_version', jp: { text: 'ちょっと ていねいに すると…', kana: 'ちょっと ていねいに すると…', en: 'A little more polite, and…' }, status: 'draft' },
  { id: 'nobiko.natural_version.04', host: 'nobiko', event: 'natural_version', jp: { text: 'おばちゃんの おてほん、きいてね。', kana: 'おばちゃんの おてほん、きいてね。', en: "Listen to auntie's example." }, status: 'draft' },
  { id: 'nobiko.natural_version.05', host: 'nobiko', event: 'natural_version', jp: { text: 'ひみつを おしえて あげる。こうよ。', kana: 'ひみつを おしえて あげる。こうよ。', en: "I'll tell you a secret. Like this." }, status: 'draft' },
  // omiai_tease (Cheeky rooms only): scandalised by the most casual answer, which is still anonymous
  // omiai_nakodo_read: the N4 go-between's keigo line was accepted; Nobiko-san says it as is (the filled template)
  { id: 'nobiko.omiai_nakodo_read.01', host: 'nobiko', event: 'omiai_nakodo_read', jp: { text: '{line}', kana: '{line}', en: '{line}' }, slots: ['{line}'], status: 'draft' },
  { id: 'nobiko.omiai_tease.01', host: 'nobiko', event: 'omiai_tease', jp: { text: 'あらまあ… ずいぶん くだけてるわね！', kana: 'あらまあ… ずいぶん くだけてるわね！', en: "Oh my… aren't we casual!" }, audience: 'cheeky', status: 'draft' },
  { id: 'nobiko.omiai_tease.02', host: 'nobiko', event: 'omiai_tease', jp: { text: 'あらまあ。おみあいで その ことばづかい？', kana: 'あらまあ。おみあいで その ことばづかい？', en: "Oh my. Talking like that, at an omiai?" }, audience: 'cheeky', status: 'draft' },
  { id: 'nobiko.omiai_tease.03', host: 'nobiko', event: 'omiai_tease', jp: { text: 'ちょっと、これ だれ？　おかあさんに いいつけるわよ。', kana: 'ちょっと、これ だれ？　おかあさんに いいつけるわよ。', en: "Excuse me, whose is this? I'm telling your mother." }, audience: 'cheeky', status: 'draft' },
  { id: 'nobiko.omiai_tease.04', host: 'nobiko', event: 'omiai_tease', jp: { text: 'あらあら、ともだちと はなしてるんじゃ ないのよ？', kana: 'あらあら、ともだちと はなしてるんじゃ ないのよ？', en: "Oh dear, you're not chatting with your friends, you know?" }, audience: 'cheeky', status: 'draft' },
  { id: 'nobiko.omiai_tease.05', host: 'nobiko', event: 'omiai_tease', jp: { text: 'くびを のばして みちゃった。…あらまあ。', kana: 'くびを のばして みちゃった。…あらまあ。', en: "I stretched my neck for a look… oh my." }, audience: 'cheeky', status: 'draft' },
  // narabete_intro
  { id: 'nobiko.narabete_intro.01', host: 'nobiko', event: 'narabete_intro', jp: { text: 'きょうは わたしの くびに ならべる ゲームよ！', kana: 'きょうは わたしの くびに ならべる ゲームよ！', en: 'Tonight we line things up along my neck!' }, status: 'draft' },
  { id: 'nobiko.narabete_intro.02', host: 'nobiko', event: 'narabete_intro', jp: { text: 'みんな なかまよ。いっしょに ならべてね。', kana: 'みんな なかまよ。いっしょに ならべてね。', en: "You're all one team. Line them up together." }, status: 'draft' },
  { id: 'nobiko.narabete_intro.03', host: 'nobiko', event: 'narabete_intro', jp: { text: 'くびを ながーく して まってたわ。さあ、ならべて！', kana: 'くびを ながーく して まってたわ。さあ、ならべて！', en: "I've waited with my neck stretched out. Line them up!" }, status: 'draft' },
  // narabete_deal
  { id: 'nobiko.narabete_deal.01', host: 'nobiko', event: 'narabete_deal', jp: { text: 'カードを くばるわよ。だれにも みせないでね！', kana: 'カードを くばるわよ。だれにも みせないでね！', en: "Dealing the cards. Don't show anyone!" }, status: 'draft' },
  { id: 'nobiko.narabete_deal.02', host: 'nobiko', event: 'narabete_deal', jp: { text: 'はい、カード。こっそり みてね。', kana: 'はい、カード。こっそり みてね。', en: "Here's your card. Take a sneaky look." }, status: 'draft' },
  { id: 'nobiko.narabete_deal.03', host: 'nobiko', event: 'narabete_deal', jp: { text: 'くびを のばしても みないわよ。たぶん。', kana: 'くびを のばしても みないわよ。たぶん。', en: "I won't peek, even with my neck. Probably." }, status: 'draft' },
  { id: 'nobiko.narabete_deal.04', host: 'nobiko', event: 'narabete_deal', jp: { text: 'あらまあ、たのしい おだいね！', kana: 'あらまあ、たのしい おだいね！', en: 'Oh my, what a fun theme!' }, status: 'draft' },
  // narabete_say
  { id: 'nobiko.narabete_say.01', host: 'nobiko', event: 'narabete_say', jp: { text: 'じぶんの カード、こえに だして いってね。', kana: 'じぶんの カード、こえに だして いってね。', en: 'Say your card out loud.' }, status: 'draft' },
  { id: 'nobiko.narabete_say.02', host: 'nobiko', event: 'narabete_say', jp: { text: 'さあ、ひとりずつ どうぞ。きいてるわよ。', kana: 'さあ、ひとりずつ どうぞ。きいてるわよ。', en: "Go on, one at a time. I'm listening." }, status: 'draft' },
  { id: 'nobiko.narabete_say.03', host: 'nobiko', event: 'narabete_say', jp: { text: 'ちいさい こえでも いいのよ。', kana: 'ちいさい こえでも いいのよ。', en: 'A quiet voice is fine too.' }, status: 'draft' },
  { id: 'nobiko.narabete_say.04', host: 'nobiko', event: 'narabete_say', jp: { text: 'ねえねえ、みんな なにを もってるの？', kana: 'ねえねえ、みんな なにを もってるの？', en: "Oh my, what's everyone holding?" }, status: 'draft' },
  // narabete_order
  { id: 'nobiko.narabete_order.01', host: 'nobiko', event: 'narabete_order', jp: { text: 'ならべて！　じぶんの カードを うごかしてね。', kana: 'ならべて！　じぶんの カードを うごかしてね。', en: 'Line them up! Move your own card.' }, status: 'draft' },
  { id: 'nobiko.narabete_order.02', host: 'nobiko', event: 'narabete_order', jp: { text: 'ひだりから じゅんばんに ならべてね！', kana: 'ひだりから じゅんばんに ならべてね！', en: 'Line them up in order, starting from the left!' }, status: 'draft' },
  { id: 'nobiko.narabete_order.03', host: 'nobiko', event: 'narabete_order', jp: { text: 'わたしの くびが ものさしよ。', kana: 'わたしの くびが ものさしよ。', en: 'My neck is the ruler.' }, status: 'draft' },
  { id: 'nobiko.narabete_order.04', host: 'nobiko', event: 'narabete_order', jp: { text: 'そうだん しても いいのよ。', kana: 'そうだん しても いいのよ。', en: 'You can talk it over.' }, status: 'draft' },
  // narabete_defence
  { id: 'nobiko.narabete_defence.01', host: 'nobiko', event: 'narabete_defence', jp: { text: '{name}さん、なんで そこなの？　おしえて！', kana: '{name}さん、なんで そこなの？　おしえて！', en: '{name}, why there? Tell me!' }, slots: ['{name}'], status: 'draft' },
  { id: 'nobiko.narabete_defence.02', host: 'nobiko', event: 'narabete_defence', jp: { text: '{name}さんの カード、ずいぶん うごいたわね。', kana: '{name}さんの カード、ずいぶん うごいたわね。', en: "Oh my, {name}'s card moved a lot." }, slots: ['{name}'], status: 'draft' },
  { id: 'nobiko.narabete_defence.03', host: 'nobiko', event: 'narabete_defence', jp: { text: '{name}さん、ひとこと どうぞ！', kana: '{name}さん、ひとこと どうぞ！', en: '{name}, a word, please!' }, slots: ['{name}'], status: 'draft' },
  { id: 'nobiko.narabete_defence.04', host: 'nobiko', event: 'narabete_defence', jp: { text: 'ちょっと {name}さん、いいわけ きかせて。', kana: 'ちょっと {name}さん、いいわけ きかせて。', en: "Now then, {name}, let's hear your excuse." }, slots: ['{name}'], status: 'draft' },
  // narabete_hard: the N4 defence (rank and defend): their own card, wherever it sits
  { id: 'nobiko.narabete_hard.01', host: 'nobiko', event: 'narabete_hard', jp: { text: '{name}さん、どうして そこなの？　おばさんに おしえて！', kana: '{name}さん、どうして そこなの？　おばさんに おしえて！', en: '{name}, why there? Tell Auntie!' }, slots: ['{name}'], status: 'draft' },
  { id: 'nobiko.narabete_hard.02', host: 'nobiko', event: 'narabete_hard', jp: { text: 'あらまあ、{name}さんの カード、そこで いいの？', kana: 'あらまあ、{name}さんの カード、そこで いいの？', en: 'Oh my, {name}, is that the spot for your card?' }, slots: ['{name}'], status: 'draft' },
  { id: 'nobiko.narabete_hard.03', host: 'nobiko', event: 'narabete_hard', jp: { text: '{name}さん、りゆうを きかせて ちょうだい。', kana: '{name}さん、りゆうを きかせて ちょうだい。', en: "{name}, let's hear your reason, dear." }, slots: ['{name}'], status: 'draft' },
  // narabete_replay: the commentary booth's instant replay: she says the N4 defence's line herself, as is
  { id: 'nobiko.narabete_replay.01', host: 'nobiko', event: 'narabete_replay', jp: { text: '{line}', kana: '{line}', en: '{line}' }, slots: ['{line}'], status: 'draft' },
  // narabete_perfect
  { id: 'nobiko.narabete_perfect.01', host: 'nobiko', event: 'narabete_perfect', jp: { text: 'あらまあ！　ぴったり ならんだわ！', kana: 'あらまあ！　ぴったり ならんだわ！', en: 'Oh my! Perfectly in line!' }, status: 'draft' },
  { id: 'nobiko.narabete_perfect.02', host: 'nobiko', event: 'narabete_perfect', jp: { text: 'くびが まっすぐ！　かんぺきよ！', kana: 'くびが まっすぐ！　かんぺきよ！', en: "My neck's dead straight! Perfect!" }, status: 'draft' },
  { id: 'nobiko.narabete_perfect.03', host: 'nobiko', event: 'narabete_perfect', jp: { text: 'すごいわね。だんなにも みせたいわ。', kana: 'すごいわね。だんなにも みせたいわ。', en: 'Amazing. I want to show my husband.' }, status: 'draft' },
  { id: 'nobiko.narabete_perfect.04', host: 'nobiko', event: 'narabete_perfect', jp: { text: 'にゅーっ！　ぜんぶ じゅんばん どおり！', kana: 'にゅーっ！　ぜんぶ じゅんばん どおり！', en: 'Nyuu! All in order!' }, status: 'draft' },
  // narabete_knot
  { id: 'nobiko.narabete_knot.01', host: 'nobiko', event: 'narabete_knot', jp: { text: 'あらまあ、くびが からまっちゃった！', kana: 'あらまあ、くびが からまっちゃった！', en: 'Oh my, my neck got tangled!' }, status: 'draft' },
  { id: 'nobiko.narabete_knot.02', host: 'nobiko', event: 'narabete_knot', jp: { text: 'いたた… ここ、ぎゃくよ！', kana: 'いたた… ここ、ぎゃくよ！', en: 'Ouch… these two are backwards!' }, status: 'draft' },
  { id: 'nobiko.narabete_knot.03', host: 'nobiko', event: 'narabete_knot', jp: { text: 'だいじょうぶ。むすびめも かわいいわよ。', kana: 'だいじょうぶ。むすびめも かわいいわよ。', en: "It's fine. Knots are cute too." }, status: 'draft' },
  { id: 'nobiko.narabete_knot.04', host: 'nobiko', event: 'narabete_knot', jp: { text: 'あらら、ちょっと こんがらがったわね。', kana: 'あらら、ちょっと こんがらがったわね。', en: 'Oops, we got a bit muddled.' }, status: 'draft' },
  // narabete_story
  { id: 'nobiko.narabete_story.01', host: 'nobiko', event: 'narabete_story', jp: { text: 'さいあくの いちにち、はじまり はじまり！', kana: 'さいあくの いちにち、はじまり はじまり！', en: 'The worst day ever: once upon a time!' }, status: 'draft' },
  { id: 'nobiko.narabete_story.02', host: 'nobiko', event: 'narabete_story', jp: { text: 'じゅんばんに よんでね。「そして…」で つなぐのよ。', kana: 'じゅんばんに よんでね。「そして…」で つなぐのよ。', en: "Read in order. Join them with 'and then…'." }, status: 'draft' },
  { id: 'nobiko.narabete_story.03', host: 'nobiko', event: 'narabete_story', jp: { text: 'さあ、おはなしの じかんよ。', kana: 'さあ、おはなしの じかんよ。', en: "Now, it's story time." }, status: 'draft' },
  { id: 'nobiko.narabete_story.04', host: 'nobiko', event: 'narabete_story', jp: { text: 'ひどい いちにちね。きかせて！', kana: 'ひどい いちにちね。きかせて！', en: 'What an awful day. Tell me!' }, status: 'draft' },
  // kakegoe_call
  { id: 'nobiko.kakegoe_call.01', host: 'nobiko', event: 'kakegoe_call', jp: { text: 'みんなで いっしょに！　せーの！', kana: 'みんなで いっしょに！　せーの！', en: 'Everyone together! Ready, go!' }, status: 'draft' },
  { id: 'nobiko.kakegoe_call.02', host: 'nobiko', event: 'kakegoe_call', jp: { text: 'おおきな こえで！　さん、はい！', kana: 'おおきな こえで！　さん、はい！', en: 'Nice and loud! One, two, go!' }, status: 'draft' },
  { id: 'nobiko.kakegoe_call.03', host: 'nobiko', event: 'kakegoe_call', jp: { text: 'だんなを おこす くらい おおきく！', kana: 'だんなを おこす くらい おおきく！', en: 'Loud enough to wake my husband!' }, status: 'draft' },
  { id: 'nobiko.kakegoe_call.04', host: 'nobiko', event: 'kakegoe_call', jp: { text: 'わたしの あとに どうぞ！', kana: 'わたしの あとに どうぞ！', en: 'Say it after me!' }, status: 'draft' },
  { id: 'nobiko.kakegoe_call.05', host: 'nobiko', event: 'kakegoe_call', jp: { text: 'はい、みなさん、ごいっしょに！', kana: 'はい、みなさん、ごいっしょに！', en: 'Right, everyone, all together!' }, status: 'draft' },
  // retry_clue
  { id: 'nobiko.retry_clue.01', host: 'nobiko', event: 'retry_clue', jp: { text: 'ヒント、こっそり おしえるわね。', kana: 'ヒント、こっそり おしえるわね。', en: "I'll slip you a hint." }, status: 'draft' },
  { id: 'nobiko.retry_clue.02', host: 'nobiko', event: 'retry_clue', jp: { text: 'おしい！　もう いちど どうぞ。', kana: 'おしい！　もう いちど どうぞ。', en: 'So close! Once more, please.' }, status: 'draft' },
  { id: 'nobiko.retry_clue.03', host: 'nobiko', event: 'retry_clue', jp: { text: 'ゆっくりで いいのよ。', kana: 'ゆっくりで いいのよ。', en: 'Take your time, dear.' }, status: 'draft' },
  { id: 'nobiko.retry_clue.04', host: 'nobiko', event: 'retry_clue', jp: { text: 'ヒントを みて。だいじょうぶ。', kana: 'ヒントを みて。だいじょうぶ。', en: "Look at the hint. You're fine." }, status: 'draft' },
  { id: 'nobiko.retry_clue.05', host: 'nobiko', event: 'retry_clue', jp: { text: 'まだ まにあうわよ。がんばって！', kana: 'まだ まにあうわよ。がんばって！', en: 'There’s still time. You can do it!' }, status: 'draft' },
  // miss_kind
  { id: 'nobiko.miss_kind.01', host: 'nobiko', event: 'miss_kind', jp: { text: 'だいじょうぶ。つぎが あるわよ。', kana: 'だいじょうぶ。つぎが あるわよ。', en: "It's fine. There's always next time." }, status: 'draft' },
  { id: 'nobiko.miss_kind.02', host: 'nobiko', event: 'miss_kind', jp: { text: 'まちがえながら おぼえるのよ。', kana: 'まちがえながら おぼえるのよ。', en: 'We learn as we make mistakes.' }, status: 'draft' },
  { id: 'nobiko.miss_kind.03', host: 'nobiko', event: 'miss_kind', jp: { text: 'わたしも だんなの なまえを よく まちがえるわ。', kana: 'わたしも だんなの なまえを よく まちがえるわ。', en: "I often get my husband's name wrong too." }, status: 'draft' },
  { id: 'nobiko.miss_kind.04', host: 'nobiko', event: 'miss_kind', jp: { text: 'ゆうきに はくしゅ！', kana: 'ゆうきに はくしゅ！', en: 'Applause for your courage!' }, status: 'draft' },
  { id: 'nobiko.miss_kind.05', host: 'nobiko', event: 'miss_kind', jp: { text: 'おてほんを きいて、もう いちど ね。', kana: 'おてほんを きいて、もう いちど ね。', en: 'Listen to the example, and once more, OK?' }, status: 'draft' },
  // recap_award
  { id: 'nobiko.recap_award.01', host: 'nobiko', event: 'recap_award', jp: { text: '{award}は… {name}さん！', kana: '{award}は… {name}さん！', en: 'The {award} goes to… {name}!' }, slots: ['{award}', '{name}'], status: 'draft' },
  { id: 'nobiko.recap_award.02', host: 'nobiko', event: 'recap_award', jp: { text: 'おめでとう！　{award}、{name}さん！', kana: 'おめでとう！　{award}、{name}さん！', en: 'Congratulations! The {award}: {name}!' }, slots: ['{award}', '{name}'], status: 'draft' },
  { id: 'nobiko.recap_award.03', host: 'nobiko', event: 'recap_award', jp: { text: 'まあ まあ！　{award}は {name}さんよ！', kana: 'まあ まあ！　{award}は {name}さんよ！', en: 'My my! The {award} is {name}’s!' }, slots: ['{award}', '{name}'], status: 'draft' },
  { id: 'nobiko.recap_award.04', host: 'nobiko', event: 'recap_award', jp: { text: '{name}さん、{award}！　おみあい しゃしんに いれるわ！', kana: '{name}さん、{award}！　おみあい しゃしんに いれるわ！', en: "{name}, the {award}! You're going in my matchmaking album!" }, slots: ['{award}', '{name}'], status: 'draft' },
  { id: 'nobiko.recap_award.05', host: 'nobiko', event: 'recap_award', jp: { text: 'つぎは {award}。{name}さん、はくしゅ！', kana: 'つぎは {award}。{name}さん、はくしゅ！', en: 'Next, the {award}. {name}, a round of applause!' }, slots: ['{award}', '{name}'], status: 'draft' },
  // play_again
  { id: 'nobiko.play_again.01', host: 'nobiko', event: 'play_again', jp: { text: 'もう いっかい、どう？', kana: 'もう いっかい、どう？', en: 'One more round?' }, status: 'draft' },
  { id: 'nobiko.play_again.02', host: 'nobiko', event: 'play_again', jp: { text: 'おちゃ、もう いっぱい いかが？', kana: 'おちゃ、もう いっぱい いかが？', en: 'Another cup of tea?' }, status: 'draft' },
  { id: 'nobiko.play_again.03', host: 'nobiko', event: 'play_again', jp: { text: 'まだ かえらないで！　だんなが まってるけど。', kana: 'まだ かえらないで！　だんなが まってるけど。', en: "Don't go home yet! Though my husband's waiting." }, status: 'draft' },
  { id: 'nobiko.play_again.04', host: 'nobiko', event: 'play_again', jp: { text: 'たのしかったわ。また やりましょう！', kana: 'たのしかったわ。また やりましょう！', en: "That was fun. Let's do it again!" }, status: 'draft' },
  // rumour_intro: Word Gauntlet's rumour round opens. She has heard something (her neck reaches everywhere).
  { id: 'nobiko.rumour_intro.01', host: 'nobiko', event: 'rumour_intro', jp: { text: 'ちょっと ちょっと！ すごい うわさを きいちゃったの。', kana: 'ちょっと ちょっと！ すごい うわさを きいちゃったの。', en: "Psst, psst! I've heard the most amazing rumour." }, status: 'draft' },
  { id: 'nobiko.rumour_intro.02', host: 'nobiko', event: 'rumour_intro', jp: { text: 'くびが ながいと、いろいろ きこえるのよ。ないしょよ？', kana: 'くびが ながいと、いろいろ きこえるのよ。ないしょよ？', en: "With a neck this long, you hear things. It's a secret, OK?" }, status: 'draft' },
  { id: 'nobiko.rumour_intro.03', host: 'nobiko', event: 'rumour_intro', jp: { text: 'ここだけの はなしよ。となりの ひとに だけ、そっと つたえてね。', kana: 'ここだけの はなしよ。となりの ひとに だけ、そっと つたえてね。', en: 'This stays between us. Just pass it quietly to the next person.' }, status: 'draft' },
  // rumour_line: the game writes the line ({quip}): the rumour's truth, from shared/src/modes/wordGauntlet/rumours.ts. Never player text
  { id: 'nobiko.rumour_line.01', host: 'nobiko', event: 'rumour_line', jp: { text: '{quip}', kana: '{quip}', en: '{quip}' }, slots: ['{quip}'], status: 'draft' },
  { id: 'nobiko.play_again.05', host: 'nobiko', event: 'play_again', jp: { text: 'つぎは だれと だれが おにあいかしら？', kana: 'つぎは だれと だれが おにあいかしら？', en: 'I wonder who makes a lovely pair next time?' }, status: 'draft' },
];
