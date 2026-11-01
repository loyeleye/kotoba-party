// Nobiko-san (rokurokubi matchmaking auntie): Omiai Matchmaker, Karaoke Duel.
//
// Written fallback host lines (Phase 1 host bank). All lines are kana-only so
// kana-level players can read them; `kana` is exactly what TTS voices.
// Ids are stable: never renumber or reuse an id. Add new lines at the end of
// an event with the next number. Every line is `draft` until a fluent check.
//
// Her voice: a warm, nosy おばちゃん. Soft feminine endings (〜わよ, 〜わね, あらまあ), kept to
// simple kana. Her gags: the neck stretches out to eavesdrop (にゅーっ), the husband is a こたつむり
// (kotatsu-snail) who never leaves the kotatsu, sometimes called the kotatsu itself (うちの だんな), and she matchmakes everyone (おにあいね！).
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
  // omiai_nakodo_cheer: あらまあ, delighted, once she has said the go-between's opening (about the play, never mistakes)
  { id: 'nobiko.omiai_nakodo_cheer.01', host: 'nobiko', event: 'omiai_nakodo_cheer', jp: { text: 'あらまあ！　じょうずね、{name}さん。', kana: 'あらまあ！　じょうずね、{name}さん。', en: 'Oh my! Beautifully done, {name}.' }, slots: ['{name}'], status: 'draft' },
  { id: 'nobiko.omiai_nakodo_cheer.02', host: 'nobiko', event: 'omiai_nakodo_cheer', jp: { text: 'あらまあ、わたしより じょうずだわ。', kana: 'あらまあ、わたしより じょうずだわ。', en: 'Oh my, better than me.' }, status: 'draft' },
  { id: 'nobiko.omiai_nakodo_cheer.03', host: 'nobiko', event: 'omiai_nakodo_cheer', jp: { text: 'あらまあ、りっぱな けいご！', kana: 'あらまあ、りっぱな けいご！', en: 'Oh my, what splendid keigo!' }, status: 'draft' },
  { id: 'nobiko.omiai_nakodo_cheer.04', host: 'nobiko', event: 'omiai_nakodo_cheer', jp: { text: 'あらまあ。わたしの しごとが なくなっちゃう。', kana: 'あらまあ。わたしの しごとが なくなっちゃう。', en: "Oh my. I'll be out of a job." }, status: 'draft' },
  { id: 'nobiko.omiai_nakodo_cheer.05', host: 'nobiko', event: 'omiai_nakodo_cheer', jp: { text: 'あらまあ！　うれしくて くびが のびちゃうわ。', kana: 'あらまあ！　うれしくて くびが のびちゃうわ。', en: "Oh my! My neck's stretching with joy!" }, status: 'draft' },
  // omiai_standin: a 2-player room with nobody at N4 has no go-between: she gives the keigo opening herself, once a game, as is
  { id: 'nobiko.omiai_standin.01', host: 'nobiko', event: 'omiai_standin', jp: { text: '{line}', kana: '{line}', en: '{line}' }, slots: ['{line}'], status: 'draft' },
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
  { id: 'nobiko.narabete_hard.01', host: 'nobiko', event: 'narabete_hard', jp: { text: '{name}さん、どうして そこなの？　おばちゃんに おしえて！', kana: '{name}さん、どうして そこなの？　おばちゃんに おしえて！', en: '{name}, why there? Tell Auntie!' }, slots: ['{name}'], status: 'draft' },
  { id: 'nobiko.narabete_hard.02', host: 'nobiko', event: 'narabete_hard', jp: { text: 'あらまあ、{name}さんの カード、そこで いいの？', kana: 'あらまあ、{name}さんの カード、そこで いいの？', en: 'Oh my, {name}, is that the spot for your card?' }, slots: ['{name}'], status: 'draft' },
  { id: 'nobiko.narabete_hard.03', host: 'nobiko', event: 'narabete_hard', jp: { text: '{name}さん、りゆうを きかせて ちょうだい。', kana: '{name}さん、りゆうを きかせて ちょうだい。', en: "{name}, let's hear your reason, dear." }, slots: ['{name}'], status: 'draft' },
  // narabete_replay: the commentary booth's instant replay: she says the N4 defence's line herself, as is
  { id: 'nobiko.narabete_replay.01', host: 'nobiko', event: 'narabete_replay', jp: { text: '{line}', kana: '{line}', en: '{line}' }, slots: ['{line}'], status: 'draft' },
  // narabete_hooray: the N4 defence landed, before she replays it
  { id: 'nobiko.narabete_hooray.01', host: 'nobiko', event: 'narabete_hooray', jp: { text: 'あらまあ！　じょうずねえ！', kana: 'あらまあ！　じょうずねえ！', en: 'Oh my! How clever!' }, status: 'draft' },
  { id: 'nobiko.narabete_hooray.02', host: 'nobiko', event: 'narabete_hooray', jp: { text: 'あらまあ、{name}さん！　なるほどねえ。', kana: 'あらまあ、{name}さん！　なるほどねえ。', en: 'Oh my, {name}! I see, dear.' }, slots: ['{name}'], status: 'draft' },
  { id: 'nobiko.narabete_hooray.03', host: 'nobiko', event: 'narabete_hooray', jp: { text: 'あらまあ！　おばちゃん、わかったわ！', kana: 'あらまあ！　おばちゃん、わかったわ！', en: 'Oh my! Auntie gets it now!' }, status: 'draft' },
  // narabete_standin: the host stand-in, a small room with no N4 player: she gives one model defence herself, as is
  { id: 'nobiko.narabete_standin.01', host: 'nobiko', event: 'narabete_standin', jp: { text: '{line}', kana: '{line}', en: '{line}' }, slots: ['{line}'], status: 'draft' },
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
  { id: 'nobiko.rumour_intro.03', host: 'nobiko', event: 'rumour_intro', jp: { text: 'ここだけの はなしよ。スマホを みみに あてて、そっと きいてね。', kana: 'ここだけの はなしよ。スマホを みみに あてて、そっと きいてね。', en: 'Between us: phone to your ear, and listen closely.' }, status: 'draft' },
  { id: 'nobiko.rumour_intro.04', host: 'nobiko', event: 'rumour_intro', jp: { text: 'うわさには おひれが つくものよ。ひとつ たして、つぎの ひとに つたえてね。', kana: 'うわさには おひれが つくものよ。ひとつ たして、つぎの ひとに つたえてね。', en: 'Rumours always grow fins. Add one, then pass it on.' }, status: 'draft' },
  // rumour_line: the game writes the line ({quip}): the rumour's truth, from shared/src/modes/wordGauntlet/rumours.ts. Never player text
  // rumour_relay: she reads one relay aloud at the reveal ({quip}): a player's words, which passed the moderation filter (docs/commercial-blockers.md row 36)
  { id: 'nobiko.rumour_relay.01', host: 'nobiko', event: 'rumour_relay', jp: { text: '{quip}', kana: '{quip}', en: '{quip}' }, slots: ['{quip}'], status: 'draft' },
  // rumour_react: after the last relay, she hears what her rumour became
  { id: 'nobiko.rumour_react.01', host: 'nobiko', event: 'rumour_react', jp: { text: 'ちょっと！ わたし、そこまで いって ないわよ！', kana: 'ちょっと！ わたし、そこまで いって ないわよ！', en: "Hey! I never said all that!" }, status: 'draft' },
  { id: 'nobiko.rumour_react.02', host: 'nobiko', event: 'rumour_react', jp: { text: 'えー！ そんなに おおきく なっちゃったの？', kana: 'えー！ そんなに おおきく なっちゃったの？', en: 'Whoa! It got that big?' }, status: 'draft' },
  { id: 'nobiko.rumour_react.03', host: 'nobiko', event: 'rumour_react', jp: { text: 'あらあら、おひれが いっぱい ついたわね。', kana: 'あらあら、おひれが いっぱい ついたわね。', en: 'Oh my, it grew plenty of fins.' }, status: 'draft' },
  // rumour_tease: the score opens, before the truth
  { id: 'nobiko.rumour_tease.01', host: 'nobiko', event: 'rumour_tease', jp: { text: 'さあ、ほんとうは どうだったと おもう？', kana: 'さあ、ほんとうは どうだったと おもう？', en: 'So, what do you think really happened?' }, status: 'draft' },
  { id: 'nobiko.rumour_tease.02', host: 'nobiko', event: 'rumour_tease', jp: { text: 'じつはね…ほんとうの はなし、きく？', kana: 'じつはね…ほんとうの はなし、きく？', en: 'Actually… want to hear the real story?' }, status: 'draft' },
  { id: 'nobiko.rumour_line.01', host: 'nobiko', event: 'rumour_line', jp: { text: '{quip}', kana: '{quip}', en: '{quip}' }, slots: ['{quip}'], status: 'draft' },
  { id: 'nobiko.play_again.05', host: 'nobiko', event: 'play_again', jp: { text: 'つぎは だれと だれが おにあいかしら？', kana: 'つぎは だれと だれが おにあいかしら？', en: 'I wonder who makes a lovely pair next time?' }, status: 'draft' },
  // Ghost Advice Hotline (おばけの おなやみ そうだんしつ): Nobiko-san answers the yōkai's late-night advice line.
  // hotline_intro: Nobiko-san opens the late-night advice line (the こたつむり husband sets up in .05; score.01 calls back to him)
  { id: 'nobiko.hotline_intro.01', host: 'nobiko', event: 'hotline_intro', jp: { text: 'こんばんは〜。おなやみ そうだんしつ、はじまるわよ！', kana: 'こんばんは〜。おなやみ そうだんしつ、はじまるわよ！', en: 'Good evening~ The advice line is open!' }, status: 'draft' },
  { id: 'nobiko.hotline_intro.02', host: 'nobiko', event: 'hotline_intro', jp: { text: 'よなかに おばけから でんわが くるの。みんなで アドバイスよ！', kana: 'よなかに おばけから でんわが くるの。みんなで アドバイスよ！', en: 'Yōkai phone in the night. Everyone gives advice!' }, status: 'draft' },
  { id: 'nobiko.hotline_intro.03', host: 'nobiko', event: 'hotline_intro', jp: { text: 'おばけの おなやみ、きいて あげて ちょうだいね。', kana: 'おばけの おなやみ、きいて あげて ちょうだいね。', en: 'Lend the yōkai an ear, dears.' }, status: 'draft' },
  { id: 'nobiko.hotline_intro.04', host: 'nobiko', event: 'hotline_intro', jp: { text: 'でんわが なったら、くびを ながーく して きくわよ。', kana: 'でんわが なったら、くびを ながーく して きくわよ。', en: 'When the phone rings, I stretch my neck to listen.' }, status: 'draft' },
  { id: 'nobiko.hotline_intro.05', host: 'nobiko', event: 'hotline_intro', jp: { text: 'うちの だんなは こたつむり。でんわにも でないの。だから わたしが でるのよ！', kana: 'うちの だんなは こたつむり。でんわにも でないの。だから わたしが でるのよ！', en: 'Husband’s a kotatsu-snail: never comes out for calls. So I answer!' }, status: 'draft' },
  // hotline_coop: two players, a scripted yōkai calls and both advise
  { id: 'nobiko.hotline_coop.01', host: 'nobiko', event: 'hotline_coop', jp: { text: 'きょうは ふたりとも アドバイザーよ！', kana: 'きょうは ふたりとも アドバイザーよ！', en: 'Tonight, you’re both advisers!' }, status: 'draft' },
  { id: 'nobiko.hotline_coop.02', host: 'nobiko', event: 'hotline_coop', jp: { text: 'おばけから でんわ！ ふたりで ちえを だしてね。', kana: 'おばけから でんわ！ ふたりで ちえを だしてね。', en: 'A yōkai’s calling! Put your heads together.' }, status: 'draft' },
  { id: 'nobiko.hotline_coop.03', host: 'nobiko', event: 'hotline_coop', jp: { text: 'ふたりの アドバイス、たのしみだわ〜。', kana: 'ふたりの アドバイス、たのしみだわ〜。', en: 'I can’t wait to hear you both~' }, status: 'draft' },
  { id: 'nobiko.hotline_coop.04', host: 'nobiko', event: 'hotline_coop', jp: { text: 'おばけが まってるわ。ふたりとも、たのむわよ！', kana: 'おばけが まってるわ。ふたりとも、たのむわよ！', en: 'A yōkai’s waiting. I’m counting on you both!' }, status: 'draft' },
  // hotline_ring: {name} is calling as {caller}
  { id: 'nobiko.hotline_ring.01', host: 'nobiko', event: 'hotline_ring', jp: { text: 'はい、おなやみ そうだんしつです〜。', kana: 'はい、おなやみ そうだんしつです〜。', en: 'Hello, you’re through to the advice line~' }, status: 'draft' },
  { id: 'nobiko.hotline_ring.02', host: 'nobiko', event: 'hotline_ring', jp: { text: 'あら、でんわ！ {name}さんは きょう {caller}よ。', kana: 'あら、でんわ！ {name}さんは きょう {caller}よ。', en: 'Oh, the phone! {name} is {caller} tonight.' }, slots: ['{name}', '{caller}'], status: 'draft' },
  { id: 'nobiko.hotline_ring.03', host: 'nobiko', event: 'hotline_ring', jp: { text: 'もしもし？ {caller}ね… なかみは {name}さん！', kana: 'もしもし？ {caller}ね… なかみは {name}さん！', en: 'Hello? It’s {caller}… with {name} inside!' }, slots: ['{name}', '{caller}'], status: 'draft' },
  { id: 'nobiko.hotline_ring.04', host: 'nobiko', event: 'hotline_ring', jp: { text: 'りりりん！ {caller}から おでんわ。こえは {name}さんよ。', kana: 'りりりん！ {caller}から おでんわ。こえは {name}さんよ。', en: 'Ring ring! It’s {caller}, in {name}’s voice.' }, slots: ['{name}', '{caller}'], status: 'draft' },
  { id: 'nobiko.hotline_ring.05', host: 'nobiko', event: 'hotline_ring', jp: { text: 'はい、そうだんしつです〜。あら、{caller}？ {name}さんね！', kana: 'はい、そうだんしつです〜。あら、{caller}？ {name}さんね！', en: 'Advice line~ Oh, {caller}? That’s {name}!' }, slots: ['{name}', '{caller}'], status: 'draft' },
  { id: 'nobiko.hotline_ring.06', host: 'nobiko', event: 'hotline_ring', jp: { text: 'りりりん！ あら、{caller}から おでんわよ。', kana: 'りりりん！ あら、{caller}から おでんわよ。', en: 'Ring ring! Oh, a call from {caller}.' }, slots: ['{caller}'], status: 'draft' },
  // hotline_read: Nobiko-san says the caller's problem for them ({line}, as is)
  { id: 'nobiko.hotline_read.01', host: 'nobiko', event: 'hotline_read', jp: { text: '{line}', kana: '{line}', en: '{line}' }, slots: ['{line}'], status: 'draft' },
  { id: 'nobiko.hotline_read.02', host: 'nobiko', event: 'hotline_read', jp: { text: 'かわりに よむわね。「{line}」', kana: 'かわりに よむわね。「{line}」', en: 'I’ll read it for you. “{line}”' }, slots: ['{line}'], status: 'draft' },
  { id: 'nobiko.hotline_read.03', host: 'nobiko', event: 'hotline_read', jp: { text: '「{line}」…ですって！', kana: '「{line}」…ですって！', en: '“{line}”… they say!' }, slots: ['{line}'], status: 'draft' },
  // hotline_chigau: the caller tapped ちがう！
  { id: 'nobiko.hotline_chigau.01', host: 'nobiko', event: 'hotline_chigau', jp: { text: 'あらら、ちがうって。', kana: 'あらら、ちがうって。', en: 'Oh dear, that’s a no.' }, status: 'draft' },
  { id: 'nobiko.hotline_chigau.02', host: 'nobiko', event: 'hotline_chigau', jp: { text: 'ざんねん！ おばけって、きびしいのね。', kana: 'ざんねん！ おばけって、きびしいのね。', en: 'Too bad! Yōkai are a tough crowd.' }, status: 'draft' },
  { id: 'nobiko.hotline_chigau.03', host: 'nobiko', event: 'hotline_chigau', jp: { text: 'ちがう、ちがう〜。つぎ、いってみましょ！', kana: 'ちがう、ちがう〜。つぎ、いってみましょ！', en: 'Nope, nope~ On to the next!' }, status: 'draft' },
  { id: 'nobiko.hotline_chigau.04', host: 'nobiko', event: 'hotline_chigau', jp: { text: 'くびを かしげちゃうわね。', kana: 'くびを かしげちゃうわね。', en: 'That one makes my neck tilt.' }, status: 'draft' },
  // hotline_oshii: the caller tapped おしい！
  { id: 'nobiko.hotline_oshii.01', host: 'nobiko', event: 'hotline_oshii', jp: { text: 'おしい！ あと ちょっと！', kana: 'おしい！ あと ちょっと！', en: 'So close! Just a bit more!' }, status: 'draft' },
  { id: 'nobiko.hotline_oshii.02', host: 'nobiko', event: 'hotline_oshii', jp: { text: 'にゅーっ… おしいわね〜！', kana: 'にゅーっ… おしいわね〜！', en: '(Neck stretches.) Ooh, so close~!' }, status: 'draft' },
  { id: 'nobiko.hotline_oshii.03', host: 'nobiko', event: 'hotline_oshii', jp: { text: 'いい せん いってるわよ！', kana: 'いい せん いってるわよ！', en: 'You’re on the right track!' }, status: 'draft' },
  { id: 'nobiko.hotline_oshii.04', host: 'nobiko', event: 'hotline_oshii', jp: { text: 'あら、おしい！ もう ひといき！', kana: 'あら、おしい！ もう ひといき！', en: 'Ooh, close! One more push!' }, status: 'draft' },
  // hotline_soreda: the caller tapped それだ！
  { id: 'nobiko.hotline_soreda.01', host: 'nobiko', event: 'hotline_soreda', jp: { text: 'あら、それだわ〜！', kana: 'あら、それだわ〜！', en: 'Ooh, that’s the one~!' }, status: 'draft' },
  { id: 'nobiko.hotline_soreda.02', host: 'nobiko', event: 'hotline_soreda', jp: { text: 'それよ、それ！ さすが！', kana: 'それよ、それ！ さすが！', en: 'That’s it, that’s it! Brilliant!' }, status: 'draft' },
  { id: 'nobiko.hotline_soreda.03', host: 'nobiko', event: 'hotline_soreda', jp: { text: 'まあ！ ぴったりの アドバイス！', kana: 'まあ！ ぴったりの アドバイス！', en: 'My! Advice that fits perfectly!' }, status: 'draft' },
  { id: 'nobiko.hotline_soreda.04', host: 'nobiko', event: 'hotline_soreda', jp: { text: 'それだわ！ おにあいね〜！', kana: 'それだわ！ おにあいね〜！', en: 'That’s it! A perfect match~!' }, status: 'draft' },
  // hotline_knot: a third ちがう！ in a row ties her neck in a knot
  { id: 'nobiko.hotline_knot.01', host: 'nobiko', event: 'hotline_knot', jp: { text: 'あらまあ、くびに むすびめが できちゃった！', kana: 'あらまあ、くびに むすびめが できちゃった！', en: 'Oh my, there’s a knot in my neck!' }, status: 'draft' },
  { id: 'nobiko.hotline_knot.02', host: 'nobiko', event: 'hotline_knot', jp: { text: 'ちがう、ちがう、ちがう… くびが ぐるぐる！', kana: 'ちがう、ちがう、ちがう… くびが ぐるぐる！', en: 'No, no, no… my neck’s going round and round!' }, status: 'draft' },
  { id: 'nobiko.hotline_knot.03', host: 'nobiko', event: 'hotline_knot', jp: { text: 'あらら… ちょうちょ むすびに なったわ。', kana: 'あらら… ちょうちょ むすびに なったわ。', en: 'Oh dear… it’s tied in a bow now.' }, status: 'draft' },
  { id: 'nobiko.hotline_knot.04', host: 'nobiko', event: 'hotline_knot', jp: { text: 'ほどくから、ちょっと まってね。', kana: 'ほどくから、ちょっと まってね。', en: 'Let me untie it. One moment.' }, status: 'draft' },
  // hotline_secret: what would really have helped is shown
  { id: 'nobiko.hotline_secret.01', host: 'nobiko', event: 'hotline_secret', jp: { text: 'じつは… これが ひみつよ！', kana: 'じつは… これが ひみつよ！', en: 'Actually… here’s the secret!' }, status: 'draft' },
  { id: 'nobiko.hotline_secret.02', host: 'nobiko', event: 'hotline_secret', jp: { text: 'にゅーっ… ほんとうに ほしかったのは、これ！', kana: 'にゅーっ… ほんとうに ほしかったのは、これ！', en: '(Neck stretches.) What they really needed was this!' }, status: 'draft' },
  { id: 'nobiko.hotline_secret.03', host: 'nobiko', event: 'hotline_secret', jp: { text: 'こたえあわせよ〜。ひみつは…', kana: 'こたえあわせよ〜。ひみつは…', en: 'Time to check~ The secret is…' }, status: 'draft' },
  { id: 'nobiko.hotline_secret.04', host: 'nobiko', event: 'hotline_secret', jp: { text: 'みんな、みて！ おばけの ほんねよ！', kana: 'みんな、みて！ おばけの ほんねよ！', en: 'Look, everyone! What the yōkai really wanted!' }, status: 'draft' },
  // hotline_vote: which idea was funniest? (the idea, never how it was said)
  { id: 'nobiko.hotline_vote.01', host: 'nobiko', event: 'hotline_vote', jp: { text: 'どの アイデアが いちばん おもしろかった？', kana: 'どの アイデアが いちばん おもしろかった？', en: 'Which idea was the funniest?' }, status: 'draft' },
  { id: 'nobiko.hotline_vote.02', host: 'nobiko', event: 'hotline_vote', jp: { text: 'いちばん わらったのは どれ？', kana: 'いちばん わらったのは どれ？', en: 'Which one made you laugh most?' }, status: 'draft' },
  { id: 'nobiko.hotline_vote.03', host: 'nobiko', event: 'hotline_vote', jp: { text: 'おもしろい アイデアに いっぴょう！', kana: 'おもしろい アイデアに いっぴょう！', en: 'One vote for the funniest idea!' }, status: 'draft' },
  { id: 'nobiko.hotline_vote.04', host: 'nobiko', event: 'hotline_vote', jp: { text: 'じぶんのには いれないでね〜。', kana: 'じぶんのには いれないでね〜。', en: 'Not your own, dears~' }, status: 'draft' },
  // hotline_sweep: every vote to one adviser ({name} when the game gives it): おおウケ！
  { id: 'nobiko.hotline_sweep.01', host: 'nobiko', event: 'hotline_sweep', jp: { text: 'おおウケ！ みんな わらったわね〜！', kana: 'おおウケ！ みんな わらったわね〜！', en: 'A smash hit! Everyone laughed~!' }, status: 'draft' },
  { id: 'nobiko.hotline_sweep.02', host: 'nobiko', event: 'hotline_sweep', jp: { text: 'おおウケ！ ぜんぶ {name}さんに！', kana: 'おおウケ！ ぜんぶ {name}さんに！', en: 'A smash hit! Every vote for {name}!' }, slots: ['{name}'], status: 'draft' },
  { id: 'nobiko.hotline_sweep.03', host: 'nobiko', event: 'hotline_sweep', jp: { text: 'まあ！ みんな {name}さんよ。おおウケ！', kana: 'まあ！ みんな {name}さんよ。おおウケ！', en: 'My! Everyone picked {name}. A smash hit!' }, slots: ['{name}'], status: 'draft' },
  { id: 'nobiko.hotline_sweep.04', host: 'nobiko', event: 'hotline_sweep', jp: { text: 'おおウケ！ くびが のびすぎちゃう〜！', kana: 'おおウケ！ くびが のびすぎちゃう〜！', en: 'A smash hit! My neck’s stretching too far~!' }, status: 'draft' },
  // hotline_score: the points land
  { id: 'nobiko.hotline_score.01', host: 'nobiko', event: 'hotline_score', jp: { text: 'うちの だんなにも きかせたいわ。こたつから でて こないけど。', kana: 'うちの だんなにも きかせたいわ。こたつから でて こないけど。', en: 'I wish my husband heard this. He never leaves the kotatsu.' }, status: 'draft' },
  { id: 'nobiko.hotline_score.02', host: 'nobiko', event: 'hotline_score', jp: { text: 'いい アドバイスばかり。メモ しなくちゃ。', kana: 'いい アドバイスばかり。メモ しなくちゃ。', en: 'Such good advice. I must take notes.' }, status: 'draft' },
  { id: 'nobiko.hotline_score.03', host: 'nobiko', event: 'hotline_score', jp: { text: 'てんすうよ〜！ みんな すてき！', kana: 'てんすうよ〜！ みんな すてき！', en: 'Here come the points~! You’re all lovely!' }, status: 'draft' },
  { id: 'nobiko.hotline_score.04', host: 'nobiko', event: 'hotline_score', jp: { text: 'そうだんしつの スター、たんじょうね！', kana: 'そうだんしつの スター、たんじょうね！', en: 'A star of the advice line is born!' }, status: 'draft' },
  { id: 'nobiko.hotline_score.05', host: 'nobiko', event: 'hotline_score', jp: { text: 'おばけも にっこり。わたしも にっこり。', kana: 'おばけも にっこり。わたしも にっこり。', en: 'The yōkai’s smiling. So am I.' }, status: 'draft' },
  // hotline_booth: the replay booth opens on the advice that used its chunk ({chunk} when given)
  { id: 'nobiko.hotline_booth.02', host: 'nobiko', event: 'hotline_booth', jp: { text: 'もう いちど きいて みましょ。', kana: 'もう いちど きいて みましょ。', en: 'Let’s hear that one again.' }, status: 'draft' },
  { id: 'nobiko.hotline_booth.03', host: 'nobiko', event: 'hotline_booth', jp: { text: 'リプレイよ〜！ ここが いいのよ。', kana: 'リプレイよ〜！ ここが いいのよ。', en: 'Replay time~! This is the good bit.' }, status: 'draft' },
  { id: 'nobiko.hotline_booth.04', host: 'nobiko', event: 'hotline_booth', jp: { text: 'あら、すてきな いいかた！ もう いっかい！', kana: 'あら、すてきな いいかた！ もう いっかい！', en: 'Ooh, a lovely way to say it! Once more!' }, status: 'draft' },
  { id: 'nobiko.hotline_booth.05', host: 'nobiko', event: 'hotline_booth', jp: { text: 'でたわね〜、「{chunk}」！', kana: 'でたわね〜、「{chunk}」！', en: 'There it is~ “{chunk}”!' }, slots: ['{chunk}'], status: 'draft' },
  // hotline_mic_pass: Nobiko-san says {name}'s advice for them ({line}, as is)
  { id: 'nobiko.hotline_mic_pass.01', host: 'nobiko', event: 'hotline_mic_pass', jp: { text: 'わたしが いうわね。{name}さんの アドバイス… 「{line}」', kana: 'わたしが いうわね。{name}さんの アドバイス… 「{line}」', en: 'I’ll say it. {name}’s advice… “{line}”' }, slots: ['{name}', '{line}'], status: 'draft' },
  { id: 'nobiko.hotline_mic_pass.02', host: 'nobiko', event: 'hotline_mic_pass', jp: { text: 'まかせて！ {name}さんから… 「{line}」', kana: 'まかせて！ {name}さんから… 「{line}」', en: 'Leave it to me! From {name}… “{line}”' }, slots: ['{name}', '{line}'], status: 'draft' },
  { id: 'nobiko.hotline_mic_pass.03', host: 'nobiko', event: 'hotline_mic_pass', jp: { text: '{name}さんの かわりに。「{line}」', kana: '{name}さんの かわりに。「{line}」', en: 'For {name}: “{line}”' }, slots: ['{name}', '{line}'], status: 'draft' },
  // hotline_skip: {name}'s advice didn't come in (blame the line, never the player)
  { id: 'nobiko.hotline_skip.01', host: 'nobiko', event: 'hotline_skip', jp: { text: 'あら、でんぱが わるいみたい。{name}さんは つぎね。', kana: 'あら、でんぱが わるいみたい。{name}さんは つぎね。', en: 'Oh, bad signal. {name}, next time, then.' }, slots: ['{name}'], status: 'draft' },
  { id: 'nobiko.hotline_skip.02', host: 'nobiko', event: 'hotline_skip', jp: { text: 'でんわが ちょっと とおいわね。つぎ、いきましょ！', kana: 'でんわが ちょっと とおいわね。つぎ、いきましょ！', en: 'The line’s gone a bit faint. On we go!' }, status: 'draft' },
  { id: 'nobiko.hotline_skip.03', host: 'nobiko', event: 'hotline_skip', jp: { text: 'おばけの でんわは、ときどき きれるのよ〜。', kana: 'おばけの でんわは、ときどき きれるのよ〜。', en: 'Yōkai phones cut out sometimes~' }, status: 'draft' },
  { id: 'nobiko.hotline_skip.04', host: 'nobiko', event: 'hotline_skip', jp: { text: 'あらら、おばけが {name}さんの でんわを とっちゃった！', kana: 'あらら、おばけが {name}さんの でんわを とっちゃった！', en: 'Oh dear, a yōkai has run off with {name}’s phone line!' }, slots: ['{name}'], status: 'draft' },
  // hotline_line: Nobiko-san says a line the game wrote ({quip}): a caller's reveal, see shared/src/modes/ghostHotline/problems.ts
  { id: 'nobiko.hotline_line.01', host: 'nobiko', event: 'hotline_line', jp: { text: '{quip}', kana: '{quip}', en: '{quip}' }, slots: ['{quip}'], status: 'draft' },
];
