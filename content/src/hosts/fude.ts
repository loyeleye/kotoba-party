// Fude (brush tsukumogami): Kana Yōkai Raid, Kotoba Concentration, Oekaki, Shodō Taikai.
// The shodo_* lines are Fude's quiet register: an over-serious calligraphy teacher who whispers
// and takes the blame for slipped strokes (story panel, 2026-10-27).
//
// Written fallback host lines (Phase 1 host bank). All lines are kana-only so
// kana-level players can read them; `kana` is exactly what TTS voices.
// Ids are stable: never renumber or reuse an id. Add new lines at the end of
// an event with the next number. Every line is `draft` until a fluent check.

import type { HostLine } from '../types.js';

export const fudeLines: HostLine[] = [
  // lobby_welcome
  { id: 'fude.lobby_welcome.01', host: 'fude', event: 'lobby_welcome', jp: { text: 'ようこそ！　フデです！　シュッ！', kana: 'ようこそ！　フデです！　シュッ！', en: "Welcome! I'm Fude! Swish!" }, status: 'draft' },
  { id: 'fude.lobby_welcome.02', host: 'fude', event: 'lobby_welcome', jp: { text: 'みなさん、こんにちは！　バトルの じかんです！', kana: 'みなさん、こんにちは！　バトルの じかんです！', en: "Hello, everyone! It's battle time!" }, status: 'draft' },
  { id: 'fude.lobby_welcome.03', host: 'fude', event: 'lobby_welcome', jp: { text: 'きょうも かなを つかまえましょう！', kana: 'きょうも かなを つかまえましょう！', en: "Let's catch some kana today!" }, status: 'draft' },
  { id: 'fude.lobby_welcome.04', host: 'fude', event: 'lobby_welcome', jp: { text: 'ようこそ、スタジオへ！　ズバッ！', kana: 'ようこそ、スタジオへ！　ズバッ！', en: 'Welcome to the studio! Slash!' }, status: 'draft' },
  { id: 'fude.lobby_welcome.05', host: 'fude', event: 'lobby_welcome', jp: { text: 'なかまが きました！　うれしい！', kana: 'なかまが きました！　うれしい！', en: "Teammates are here! I'm so happy!" }, status: 'draft' },
  // mic_check_ok
  { id: 'fude.mic_check_ok.01', host: 'fude', event: 'mic_check_ok', jp: { text: '{name}さん、きこえます！　シュッ！', kana: '{name}さん、きこえます！　シュッ！', en: 'I hear you, {name}! Swish!' }, slots: ['{name}'], status: 'draft' },
  { id: 'fude.mic_check_ok.02', host: 'fude', event: 'mic_check_ok', jp: { text: '{name}さん、いい こえ！　バトル オーケー！', kana: '{name}さん、いい こえ！　バトル オーケー！', en: 'Great voice, {name}! Ready for battle!' }, slots: ['{name}'], status: 'draft' },
  { id: 'fude.mic_check_ok.03', host: 'fude', event: 'mic_check_ok', jp: { text: '{name}さん、こんにちは！　ズバッ！', kana: '{name}さん、こんにちは！　ズバッ！', en: 'Hello, {name}! Slash!' }, slots: ['{name}'], status: 'draft' },
  { id: 'fude.mic_check_ok.04', host: 'fude', event: 'mic_check_ok', jp: { text: '{name}さんの こえ、とどきました！', kana: '{name}さんの こえ、とどきました！', en: "{name}'s voice reached me!" }, slots: ['{name}'], status: 'draft' },
  { id: 'fude.mic_check_ok.05', host: 'fude', event: 'mic_check_ok', jp: { text: '{name}さん、マイク ばっちり！', kana: '{name}さん、マイク ばっちり！', en: '{name}, your mic is perfect!' }, slots: ['{name}'], status: 'draft' },
  // mic_check_quiet
  { id: 'fude.mic_check_quiet.01', host: 'fude', event: 'mic_check_quiet', jp: { text: 'だいじょうぶ！　タップで たたかいましょう！', kana: 'だいじょうぶ！　タップで たたかいましょう！', en: "No problem! Let's battle by tapping!" }, status: 'draft' },
  { id: 'fude.mic_check_quiet.02', host: 'fude', event: 'mic_check_quiet', jp: { text: 'マイクは おやすみ。タップで どうぞ！', kana: 'マイクは おやすみ。タップで どうぞ！', en: 'The mic is resting. Tap instead!' }, status: 'draft' },
  { id: 'fude.mic_check_quiet.03', host: 'fude', event: 'mic_check_quiet', jp: { text: 'しずかな せんしですね！　タップで オーケー！', kana: 'しずかな せんしですね！　タップで オーケー！', en: 'A quiet warrior! Tapping works!' }, status: 'draft' },
  { id: 'fude.mic_check_quiet.04', host: 'fude', event: 'mic_check_quiet', jp: { text: 'だいじょうぶ、タップでも つよいです！', kana: 'だいじょうぶ、タップでも つよいです！', en: 'No worries, tapping is strong too!' }, status: 'draft' },
  { id: 'fude.mic_check_quiet.05', host: 'fude', event: 'mic_check_quiet', jp: { text: 'こえは あとで！　いまは タップ！　シュッ！', kana: 'こえは あとで！　いまは タップ！　シュッ！', en: 'Voice later! Tap for now! Swish!' }, status: 'draft' },
  // intro
  { id: 'fude.intro.01', host: 'fude', event: 'intro', jp: { text: 'かな ようかいが にげました！', kana: 'かな ようかいが にげました！', en: 'The kana yōkai have escaped!' }, status: 'draft' },
  { id: 'fude.intro.02', host: 'fude', event: 'intro', jp: { text: 'じしょの ページが おちました！　つかまえましょう！', kana: 'じしょの ページが おちました！　つかまえましょう！', en: "Dictionary pages fell out! Let's catch them!" }, status: 'draft' },
  { id: 'fude.intro.03', host: 'fude', event: 'intro', jp: { text: 'かなの おとを いって、こうげき！', kana: 'かなの おとを いって、こうげき！', en: "Say the kana's sound to attack!" }, status: 'draft' },
  { id: 'fude.intro.04', host: 'fude', event: 'intro', jp: { text: 'みんなで おおきな こえで！　シュッ！', kana: 'みんなで おおきな こえで！　シュッ！', en: 'All together, nice and loud! Swish!' }, status: 'draft' },
  { id: 'fude.intro.05', host: 'fude', event: 'intro', jp: { text: 'フデが そらに かきます！　よく みて ください！', kana: 'フデが そらに かきます！　よく みて ください！', en: 'Fude writes in the air! Watch closely!' }, status: 'draft' },
  // prompt_read
  { id: 'fude.prompt_read.01', host: 'fude', event: 'prompt_read', jp: { text: 'これは なんですか？　シュッ！', kana: 'これは なんですか？　シュッ！', en: "What's this one? Swish!" }, status: 'draft' },
  { id: 'fude.prompt_read.02', host: 'fude', event: 'prompt_read', jp: { text: 'きました！　よんで ください！', kana: 'きました！　よんで ください！', en: 'Here it comes! Read it!' }, status: 'draft' },
  { id: 'fude.prompt_read.03', host: 'fude', event: 'prompt_read', jp: { text: 'フデが かきます！　ズバッ！', kana: 'フデが かきます！　ズバッ！', en: 'Fude writes it! Slash!' }, status: 'draft' },
  { id: 'fude.prompt_read.04', host: 'fude', event: 'prompt_read', jp: { text: 'よく みて… これです！', kana: 'よく みて… これです！', en: 'Look closely… this one!' }, status: 'draft' },
  { id: 'fude.prompt_read.05', host: 'fude', event: 'prompt_read', jp: { text: 'つぎの かな！　いきます！', kana: 'つぎの かな！　いきます！', en: 'Next kana! Here we go!' }, status: 'draft' },
  // say_it_first
  { id: 'fude.say_it_first.01', host: 'fude', event: 'say_it_first', jp: { text: 'こえで こうげき！　いって ください！', kana: 'こえで こうげき！　いって ください！', en: 'Attack with your voice! Say it!' }, status: 'draft' },
  { id: 'fude.say_it_first.02', host: 'fude', event: 'say_it_first', jp: { text: 'さけんで ください！', kana: 'さけんで ください！', en: 'Shout it!' }, status: 'draft' },
  { id: 'fude.say_it_first.03', host: 'fude', event: 'say_it_first', jp: { text: 'おとを いって ください！　はやく！', kana: 'おとを いって ください！　はやく！', en: 'Say the sound! Quick!' }, status: 'draft' },
  { id: 'fude.say_it_first.04', host: 'fude', event: 'say_it_first', jp: { text: 'みんなで いっしょに！　ズバッ！', kana: 'みんなで いっしょに！　ズバッ！', en: 'All together! Slash!' }, status: 'draft' },
  { id: 'fude.say_it_first.05', host: 'fude', event: 'say_it_first', jp: { text: 'こえが けんです！　どうぞ！', kana: 'こえが けんです！　どうぞ！', en: 'Your voice is your sword! Go!' }, status: 'draft' },
  // answer_hurry
  { id: 'fude.answer_hurry.01', host: 'fude', event: 'answer_hurry', jp: { text: 'ようかいが にげます！　いそいで ください！', kana: 'ようかいが にげます！　いそいで ください！', en: "The yōkai's getting away! Hurry!" }, status: 'draft' },
  { id: 'fude.answer_hurry.02', host: 'fude', event: 'answer_hurry', jp: { text: 'あと すこし！　シュッ！', kana: 'あと すこし！　シュッ！', en: 'Almost! Swish!' }, status: 'draft' },
  { id: 'fude.answer_hurry.03', host: 'fude', event: 'answer_hurry', jp: { text: 'じかんが ありません！', kana: 'じかんが ありません！', en: 'No time left!' }, status: 'draft' },
  { id: 'fude.answer_hurry.04', host: 'fude', event: 'answer_hurry', jp: { text: 'はやく、はやく！　ズバッ！', kana: 'はやく、はやく！　ズバッ！', en: 'Quick, quick! Slash!' }, status: 'draft' },
  { id: 'fude.answer_hurry.05', host: 'fude', event: 'answer_hurry', jp: { text: 'ラスト チャンス！', kana: 'ラスト チャンス！', en: 'Last chance!' }, status: 'draft' },
  // all_in
  { id: 'fude.all_in.01', host: 'fude', event: 'all_in', jp: { text: 'ぜんいん こうげき しました！', kana: 'ぜんいん こうげき しました！', en: 'Everyone attacked!' }, status: 'draft' },
  { id: 'fude.all_in.02', host: 'fude', event: 'all_in', jp: { text: 'チーム ぜんいん、オーケー！', kana: 'チーム ぜんいん、オーケー！', en: 'The whole team is in!' }, status: 'draft' },
  { id: 'fude.all_in.03', host: 'fude', event: 'all_in', jp: { text: 'はやい！　ズバッ！', kana: 'はやい！　ズバッ！', en: 'Fast! Slash!' }, status: 'draft' },
  { id: 'fude.all_in.04', host: 'fude', event: 'all_in', jp: { text: 'みんなの こえ、きこえました！', kana: 'みんなの こえ、きこえました！', en: "I heard everyone's voices!" }, status: 'draft' },
  { id: 'fude.all_in.05', host: 'fude', event: 'all_in', jp: { text: 'そろいました！　いきましょう！', kana: 'そろいました！　いきましょう！', en: "Everyone's in! Let's go!" }, status: 'draft' },
  // reveal_react.flop
  { id: 'fude.reveal_react.flop.01', host: 'fude', event: 'reveal_react', tier: 'flop', jp: { text: 'あれっ？　ようかいが かくれました！', kana: 'あれっ？　ようかいが かくれました！', en: 'Huh? The yōkai hid!' }, status: 'draft' },
  { id: 'fude.reveal_react.flop.02', host: 'fude', event: 'reveal_react', tier: 'flop', jp: { text: 'むずかしい ようかいですね！', kana: 'むずかしい ようかいですね！', en: "That's a tricky yōkai!" }, status: 'draft' },
  { id: 'fude.reveal_react.flop.03', host: 'fude', event: 'reveal_react', tier: 'flop', jp: { text: 'あっ、フデが すべりました！', kana: 'あっ、フデが すべりました！', en: "Whoops! Fude's brush slipped!" }, status: 'draft' },
  { id: 'fude.reveal_react.flop.04', host: 'fude', event: 'reveal_react', tier: 'flop', jp: { text: 'おしい！　つぎ、いきましょう！', kana: 'おしい！　つぎ、いきましょう！', en: 'So close! On to the next!' }, status: 'draft' },
  { id: 'fude.reveal_react.flop.05', host: 'fude', event: 'reveal_react', tier: 'flop', jp: { text: 'その ようかい、ずるいです！', kana: 'その ようかい、ずるいです！', en: 'That yōkai is sneaky!' }, status: 'draft' },
  { id: 'fude.reveal_react.flop.06', host: 'fude', event: 'reveal_react', tier: 'flop', jp: { text: 'インクが たりません！', kana: 'インクが たりません！', en: "Fude's out of ink!" }, status: 'draft' },
  { id: 'fude.reveal_react.flop.07', host: 'fude', event: 'reveal_react', tier: 'flop', jp: { text: 'だいじょうぶ！　まだ ページは あります！', kana: 'だいじょうぶ！　まだ ページは あります！', en: 'No problem! There are more pages!' }, status: 'draft' },
  { id: 'fude.reveal_react.flop.08', host: 'fude', event: 'reveal_react', tier: 'flop', jp: { text: 'うわっ、かぜで ページが とびました！', kana: 'うわっ、かぜで ページが とびました！', en: 'Whoa, the wind blew the page away!' }, status: 'draft' },
  // reveal_react.good
  { id: 'fude.reveal_react.good.01', host: 'fude', event: 'reveal_react', tier: 'good', jp: { text: 'いいですね！　シュッ！', kana: 'いいですね！　シュッ！', en: 'Nice! Swish!' }, status: 'draft' },
  { id: 'fude.reveal_react.good.02', host: 'fude', event: 'reveal_react', tier: 'good', jp: { text: 'ナイス！　ズバッ！', kana: 'ナイス！　ズバッ！', en: 'Nice! Slash!' }, status: 'draft' },
  { id: 'fude.reveal_react.good.03', host: 'fude', event: 'reveal_react', tier: 'good', jp: { text: 'あたり！', kana: 'あたり！', en: 'Hit!' }, status: 'draft' },
  { id: 'fude.reveal_react.good.04', host: 'fude', event: 'reveal_react', tier: 'good', jp: { text: 'いい チームです！', kana: 'いい チームです！', en: 'What a team!' }, status: 'draft' },
  { id: 'fude.reveal_react.good.05', host: 'fude', event: 'reveal_react', tier: 'good', jp: { text: 'ようかい、びっくり！', kana: 'ようかい、びっくり！', en: 'The yōkai is shocked!' }, status: 'draft' },
  { id: 'fude.reveal_react.good.06', host: 'fude', event: 'reveal_react', tier: 'good', jp: { text: 'フデも うれしい！　シュッ、シュッ！', kana: 'フデも うれしい！　シュッ、シュッ！', en: 'Fude is happy! Swish, swish!' }, status: 'draft' },
  { id: 'fude.reveal_react.good.07', host: 'fude', event: 'reveal_react', tier: 'good', jp: { text: 'その ちょうし！', kana: 'その ちょうし！', en: "That's the way!" }, status: 'draft' },
  { id: 'fude.reveal_react.good.08', host: 'fude', event: 'reveal_react', tier: 'good', jp: { text: 'つよい！', kana: 'つよい！', en: 'So strong!' }, status: 'draft' },
  // reveal_react.ippon
  { id: 'fude.reveal_react.ippon.01', host: 'fude', event: 'reveal_react', tier: 'ippon', jp: { text: 'パーフェクト！', kana: 'パーフェクト！', en: 'Perfect!' }, status: 'draft' },
  { id: 'fude.reveal_react.ippon.02', host: 'fude', event: 'reveal_react', tier: 'ippon', jp: { text: 'ぜんぶ あたり！　すごい！', kana: 'ぜんぶ あたり！　すごい！', en: 'All hits! Amazing!' }, status: 'draft' },
  { id: 'fude.reveal_react.ippon.03', host: 'fude', event: 'reveal_react', tier: 'ippon', jp: { text: 'ズバッ、ズバッ、ズバーッ！', kana: 'ズバッ、ズバッ、ズバーッ！', en: 'Slash, slash, SLASH!' }, status: 'draft' },
  { id: 'fude.reveal_react.ippon.04', host: 'fude', event: 'reveal_react', tier: 'ippon', jp: { text: 'さいこうの チームです！', kana: 'さいこうの チームです！', en: 'The best team ever!' }, status: 'draft' },
  { id: 'fude.reveal_react.ippon.05', host: 'fude', event: 'reveal_react', tier: 'ippon', jp: { text: 'じしょが よろこんで います！', kana: 'じしょが よろこんで います！', en: 'The dictionary is overjoyed!' }, status: 'draft' },
  { id: 'fude.reveal_react.ippon.06', host: 'fude', event: 'reveal_react', tier: 'ippon', jp: { text: 'フデの けが たちました！', kana: 'フデの けが たちました！', en: "Fude's bristles are standing on end!" }, status: 'draft' },
  { id: 'fude.reveal_react.ippon.07', host: 'fude', event: 'reveal_react', tier: 'ippon', jp: { text: 'でんせつの バトルです！', kana: 'でんせつの バトルです！', en: 'A legendary battle!' }, status: 'draft' },
  { id: 'fude.reveal_react.ippon.08', host: 'fude', event: 'reveal_react', tier: 'ippon', jp: { text: 'イッポン！　ぜんぶ もどりました！', kana: 'イッポン！　ぜんぶ もどりました！', en: 'IPPON! Every page is back!' }, status: 'draft' },
  // encore_invite
  { id: 'fude.encore_invite.01', host: 'fude', event: 'encore_invite', jp: { text: '{name}さん、もう いちど どうぞ！', kana: '{name}さん、もう いちど どうぞ！', en: '{name}, once more, please!' }, slots: ['{name}'], status: 'draft' },
  { id: 'fude.encore_invite.02', host: 'fude', event: 'encore_invite', jp: { text: 'アンコール！　もう いちど さけんで ください！', kana: 'アンコール！　もう いちど さけんで ください！', en: 'Encore! Shout it again!' }, status: 'draft' },
  { id: 'fude.encore_invite.03', host: 'fude', event: 'encore_invite', jp: { text: 'みんなの まえで、どうぞ！', kana: 'みんなの まえで、どうぞ！', en: 'In front of everyone, go!' }, status: 'draft' },
  { id: 'fude.encore_invite.04', host: 'fude', event: 'encore_invite', jp: { text: 'スポットライト！　シュッ！', kana: 'スポットライト！　シュッ！', en: 'Spotlight! Swish!' }, status: 'draft' },
  { id: 'fude.encore_invite.05', host: 'fude', event: 'encore_invite', jp: { text: 'ステージへ どうぞ！　ズバッ！', kana: 'ステージへ どうぞ！　ズバッ！', en: 'Step up to the stage! Slash!' }, status: 'draft' },
  // encore_cheer
  { id: 'fude.encore_cheer.01', host: 'fude', event: 'encore_cheer', jp: { text: 'はくしゅ！　シュッ！', kana: 'はくしゅ！　シュッ！', en: 'Applause! Swish!' }, status: 'draft' },
  { id: 'fude.encore_cheer.02', host: 'fude', event: 'encore_cheer', jp: { text: 'かっこいい！', kana: 'かっこいい！', en: 'So cool!' }, status: 'draft' },
  { id: 'fude.encore_cheer.03', host: 'fude', event: 'encore_cheer', jp: { text: 'ゆうき、ありがとう！', kana: 'ゆうき、ありがとう！', en: 'Thanks for being brave!' }, status: 'draft' },
  { id: 'fude.encore_cheer.04', host: 'fude', event: 'encore_cheer', jp: { text: 'ブラボー！　ズバッ！', kana: 'ブラボー！　ズバッ！', en: 'Bravo! Slash!' }, status: 'draft' },
  { id: 'fude.encore_cheer.05', host: 'fude', event: 'encore_cheer', jp: { text: 'チームの ヒーロー！', kana: 'チームの ヒーロー！', en: 'Team hero!' }, status: 'draft' },
  // natural_version
  { id: 'fude.natural_version.01', host: 'fude', event: 'natural_version', jp: { text: 'フデが かきます。こうです！', kana: 'フデが かきます。こうです！', en: 'Fude writes it. Like this!' }, status: 'draft' },
  { id: 'fude.natural_version.02', host: 'fude', event: 'natural_version', jp: { text: 'ただしい おとは こちら！', kana: 'ただしい おとは こちら！', en: "Here's the sound!" }, status: 'draft' },
  { id: 'fude.natural_version.03', host: 'fude', event: 'natural_version', jp: { text: 'よく きいて ください。こうです！', kana: 'よく きいて ください。こうです！', en: "Listen closely. It's this!" }, status: 'draft' },
  { id: 'fude.natural_version.04', host: 'fude', event: 'natural_version', jp: { text: 'みて ください！　こう かきます！　シュッ！', kana: 'みて ください！　こう かきます！　シュッ！', en: 'Look! You write it like this! Swish!' }, status: 'draft' },
  { id: 'fude.natural_version.05', host: 'fude', event: 'natural_version', jp: { text: 'この おと、おぼえましょう！', kana: 'この おと、おぼえましょう！', en: "Let's remember this sound!" }, status: 'draft' },
  // kakegoe_call
  { id: 'fude.kakegoe_call.01', host: 'fude', event: 'kakegoe_call', jp: { text: 'みんなで！　せーの！', kana: 'みんなで！　せーの！', en: 'Everyone! Ready, go!' }, status: 'draft' },
  { id: 'fude.kakegoe_call.02', host: 'fude', event: 'kakegoe_call', jp: { text: 'チームで！　さん、はい！', kana: 'チームで！　さん、はい！', en: 'As a team! One, two, go!' }, status: 'draft' },
  { id: 'fude.kakegoe_call.03', host: 'fude', event: 'kakegoe_call', jp: { text: 'おおきな こえで！　せーの！　ズバッ！', kana: 'おおきな こえで！　せーの！　ズバッ！', en: 'Nice and loud! Ready, go! Slash!' }, status: 'draft' },
  { id: 'fude.kakegoe_call.04', host: 'fude', event: 'kakegoe_call', jp: { text: 'フデの あとに、どうぞ！', kana: 'フデの あとに、どうぞ！', en: 'Say it after Fude!' }, status: 'draft' },
  { id: 'fude.kakegoe_call.05', host: 'fude', event: 'kakegoe_call', jp: { text: 'もう いっかい！　もっと おおきく！　シュッ！', kana: 'もう いっかい！　もっと おおきく！　シュッ！', en: 'Once more! Louder! Swish!' }, status: 'draft' },
  // retry_clue
  { id: 'fude.retry_clue.01', host: 'fude', event: 'retry_clue', jp: { text: 'ヒントを みて ください！　シュッ！', kana: 'ヒントを みて ください！　シュッ！', en: 'Check the hint! Swish!' }, status: 'draft' },
  { id: 'fude.retry_clue.02', host: 'fude', event: 'retry_clue', jp: { text: 'もう いっかい！　だいじょうぶ！', kana: 'もう いっかい！　だいじょうぶ！', en: "One more try! You've got this!" }, status: 'draft' },
  { id: 'fude.retry_clue.03', host: 'fude', event: 'retry_clue', jp: { text: 'フデが ヒントを かきました！', kana: 'フデが ヒントを かきました！', en: 'Fude wrote you a hint!' }, status: 'draft' },
  { id: 'fude.retry_clue.04', host: 'fude', event: 'retry_clue', jp: { text: 'おしい！　ヒント、どうぞ！', kana: 'おしい！　ヒント、どうぞ！', en: "So close! Here's a hint!" }, status: 'draft' },
  { id: 'fude.retry_clue.05', host: 'fude', event: 'retry_clue', jp: { text: 'ゆっくりで いいですよ。ヒントです！', kana: 'ゆっくりで いいですよ。ヒントです！', en: "Take your time. Here's a hint!" }, status: 'draft' },
  // miss_kind
  { id: 'fude.miss_kind.01', host: 'fude', event: 'miss_kind', jp: { text: 'ナイス チャレンジ！', kana: 'ナイス チャレンジ！', en: 'Nice try!' }, status: 'draft' },
  { id: 'fude.miss_kind.02', host: 'fude', event: 'miss_kind', jp: { text: 'だいじょうぶ！　ようかいは また きます！', kana: 'だいじょうぶ！　ようかいは また きます！', en: 'No worries! The yōkai will be back!' }, status: 'draft' },
  { id: 'fude.miss_kind.03', host: 'fude', event: 'miss_kind', jp: { text: 'ナイス ファイト！', kana: 'ナイス ファイト！', en: 'Nice fight!' }, status: 'draft' },
  { id: 'fude.miss_kind.04', host: 'fude', event: 'miss_kind', jp: { text: 'フデも よく まちがえます！', kana: 'フデも よく まちがえます！', en: 'Fude gets things wrong all the time!' }, status: 'draft' },
  { id: 'fude.miss_kind.05', host: 'fude', event: 'miss_kind', jp: { text: 'つぎは きっと できます！　ズバッ！', kana: 'つぎは きっと できます！　ズバッ！', en: "You'll get the next one! Slash!" }, status: 'draft' },
  // recap_award
  { id: 'fude.recap_award.01', host: 'fude', event: 'recap_award', jp: { text: '{award}は… {name}さん！　シュッ！', kana: '{award}は… {name}さん！　シュッ！', en: 'The {award} goes to… {name}! Swish!' }, slots: ['{award}', '{name}'], status: 'draft' },
  { id: 'fude.recap_award.02', host: 'fude', event: 'recap_award', jp: { text: '{award}！ {name}さん、おめでとう！', kana: '{award}！ {name}さん、おめでとう！', en: '{award}! Congratulations, {name}!' }, slots: ['{award}', '{name}'], status: 'draft' },
  { id: 'fude.recap_award.03', host: 'fude', event: 'recap_award', jp: { text: 'じゃーん！ {award}は {name}さん！', kana: 'じゃーん！ {award}は {name}さん！', en: 'Ta-da! The {award}: {name}!' }, slots: ['{award}', '{name}'], status: 'draft' },
  { id: 'fude.recap_award.04', host: 'fude', event: 'recap_award', jp: { text: 'フデが かきます… {award}、{name}さん！　ズバッ！', kana: 'フデが かきます… {award}、{name}さん！　ズバッ！', en: 'Fude writes… {award}: {name}! Slash!' }, slots: ['{award}', '{name}'], status: 'draft' },
  { id: 'fude.recap_award.05', host: 'fude', event: 'recap_award', jp: { text: '{award}、{name}さんです！　はくしゅ！', kana: '{award}、{name}さんです！　はくしゅ！', en: 'The {award}: {name}! Applause!' }, slots: ['{award}', '{name}'], status: 'draft' },
  // play_again
  { id: 'fude.play_again.01', host: 'fude', event: 'play_again', jp: { text: 'もう いっかい たたかいましょう！', kana: 'もう いっかい たたかいましょう！', en: "Let's battle again!" }, status: 'draft' },
  { id: 'fude.play_again.02', host: 'fude', event: 'play_again', jp: { text: 'まだ ページが ありますよ！', kana: 'まだ ページが ありますよ！', en: 'There are still pages out there!' }, status: 'draft' },
  { id: 'fude.play_again.03', host: 'fude', event: 'play_again', jp: { text: 'つぎの チャプターへ いきますか？', kana: 'つぎの チャプターへ いきますか？', en: 'On to the next chapter?' }, status: 'draft' },
  { id: 'fude.play_again.04', host: 'fude', event: 'play_again', jp: { text: 'フデは まだ げんきです！　シュッ！', kana: 'フデは まだ げんきです！　シュッ！', en: 'Fude still has energy! Swish!' }, status: 'draft' },
  { id: 'fude.play_again.05', host: 'fude', event: 'play_again', jp: { text: 'また あそびましょう！', kana: 'また あそびましょう！', en: "Let's play again!" }, status: 'draft' },
  // room_overrule
  { id: 'fude.room_overrule.01', host: 'fude', event: 'room_overrule', jp: { text: 'みんなが オーケーと いいました！　ヒット！', kana: 'みんなが オーケーと いいました！　ヒット！', en: "Everyone said OK! It's a hit!" }, status: 'draft' },
  { id: 'fude.room_overrule.02', host: 'fude', event: 'room_overrule', jp: { text: 'ごめんなさい！　フデの まちがいです！', kana: 'ごめんなさい！　フデの まちがいです！', en: "Sorry! That was Fude's mistake!" }, status: 'draft' },
  { id: 'fude.room_overrule.03', host: 'fude', event: 'room_overrule', jp: { text: 'チームが きめました。あたり！', kana: 'チームが きめました。あたり！', en: 'The team has decided. Hit!' }, status: 'draft' },
  { id: 'fude.room_overrule.04', host: 'fude', event: 'room_overrule', jp: { text: 'セーフ！　ズバッ！', kana: 'セーフ！　ズバッ！', en: 'Safe! Slash!' }, status: 'draft' },
  { id: 'fude.room_overrule.05', host: 'fude', event: 'room_overrule', jp: { text: 'はい、あたりに します！', kana: 'はい、あたりに します！', en: "Okay, I'll count it as a hit!" }, status: 'draft' },
  // raid_wave_start
  { id: 'fude.raid_wave_start.01', host: 'fude', event: 'raid_wave_start', jp: { text: 'ウェーブ スタート！　シュッ！', kana: 'ウェーブ スタート！　シュッ！', en: 'Wave start! Swish!' }, status: 'draft' },
  { id: 'fude.raid_wave_start.02', host: 'fude', event: 'raid_wave_start', jp: { text: 'ようかいが きます！　じゅんびは いいですか？', kana: 'ようかいが きます！　じゅんびは いいですか？', en: 'Yōkai incoming! Are you ready?' }, status: 'draft' },
  { id: 'fude.raid_wave_start.03', host: 'fude', event: 'raid_wave_start', jp: { text: 'つぎの ウェーブです！　いきましょう！', kana: 'つぎの ウェーブです！　いきましょう！', en: "Next wave! Let's go!" }, status: 'draft' },
  { id: 'fude.raid_wave_start.04', host: 'fude', event: 'raid_wave_start', jp: { text: 'ページが とんで きました！', kana: 'ページが とんで きました！', en: 'Pages are flying in!' }, status: 'draft' },
  { id: 'fude.raid_wave_start.05', host: 'fude', event: 'raid_wave_start', jp: { text: 'さあ、バトルの はじまりです！　ズバッ！', kana: 'さあ、バトルの はじまりです！　ズバッ！', en: 'Now, the battle begins! Slash!' }, status: 'draft' },
  // raid_hit
  { id: 'fude.raid_hit.01', host: 'fude', event: 'raid_hit', jp: { text: 'ヒット！　ズバッ！', kana: 'ヒット！　ズバッ！', en: 'Hit! Slash!' }, status: 'draft' },
  { id: 'fude.raid_hit.02', host: 'fude', event: 'raid_hit', jp: { text: 'あたり！　シュッ！', kana: 'あたり！　シュッ！', en: 'Got it! Swish!' }, status: 'draft' },
  { id: 'fude.raid_hit.03', host: 'fude', event: 'raid_hit', jp: { text: 'いい こうげき！', kana: 'いい こうげき！', en: 'Nice attack!' }, status: 'draft' },
  { id: 'fude.raid_hit.04', host: 'fude', event: 'raid_hit', jp: { text: 'ようかいに あたりました！', kana: 'ようかいに あたりました！', en: 'You hit the yōkai!' }, status: 'draft' },
  { id: 'fude.raid_hit.05', host: 'fude', event: 'raid_hit', jp: { text: 'きまった！', kana: 'きまった！', en: 'Nailed it!' }, status: 'draft' },
  // raid_combo
  { id: 'fude.raid_combo.01', host: 'fude', event: 'raid_combo', jp: { text: 'コンボ！　すごい チームです！', kana: 'コンボ！　すごい チームです！', en: 'Combo! What a team!' }, status: 'draft' },
  { id: 'fude.raid_combo.02', host: 'fude', event: 'raid_combo', jp: { text: 'れんぞく ヒット！　ズバッ、ズバッ！', kana: 'れんぞく ヒット！　ズバッ、ズバッ！', en: 'Hit after hit! Slash, slash!' }, status: 'draft' },
  { id: 'fude.raid_combo.03', host: 'fude', event: 'raid_combo', jp: { text: 'みんなの こえが ひとつに！', kana: 'みんなの こえが ひとつに！', en: "Everyone's voices as one!" }, status: 'draft' },
  { id: 'fude.raid_combo.04', host: 'fude', event: 'raid_combo', jp: { text: 'コンボ、とまりません！', kana: 'コンボ、とまりません！', en: "The combo won't stop!" }, status: 'draft' },
  { id: 'fude.raid_combo.05', host: 'fude', event: 'raid_combo', jp: { text: 'チームワーク、さいこう！　シュッ！', kana: 'チームワーク、さいこう！　シュッ！', en: 'Amazing teamwork! Swish!' }, status: 'draft' },
  // raid_boss
  { id: 'fude.raid_boss.01', host: 'fude', event: 'raid_boss', jp: { text: 'ボスが きました！　おおきい！', kana: 'ボスが きました！　おおきい！', en: "The boss is here! It's huge!" }, status: 'draft' },
  { id: 'fude.raid_boss.02', host: 'fude', event: 'raid_boss', jp: { text: 'ことばの ようかいです！　ひとり ひとつ！', kana: 'ことばの ようかいです！　ひとり ひとつ！', en: 'A word yōkai! One piece each!' }, status: 'draft' },
  { id: 'fude.raid_boss.03', host: 'fude', event: 'raid_boss', jp: { text: 'みんなで こわしましょう！', kana: 'みんなで こわしましょう！', en: "Let's break it together!" }, status: 'draft' },
  { id: 'fude.raid_boss.04', host: 'fude', event: 'raid_boss', jp: { text: 'ボス バトル！　ドキドキします！', kana: 'ボス バトル！　ドキドキします！', en: "Boss battle! My heart's racing!" }, status: 'draft' },
  { id: 'fude.raid_boss.05', host: 'fude', event: 'raid_boss', jp: { text: 'じしょの いちばん ふるい ページです！', kana: 'じしょの いちばん ふるい ページです！', en: "It's the dictionary's oldest page!" }, status: 'draft' },
  // raid_catch
  { id: 'fude.raid_catch.01', host: 'fude', event: 'raid_catch', jp: { text: 'つかまえました！　シュッ！', kana: 'つかまえました！　シュッ！', en: 'Caught it! Swish!' }, status: 'draft' },
  { id: 'fude.raid_catch.02', host: 'fude', event: 'raid_catch', jp: { text: 'ページが じしょに もどりました！', kana: 'ページが じしょに もどりました！', en: 'The page is back in the dictionary!' }, status: 'draft' },
  { id: 'fude.raid_catch.03', host: 'fude', event: 'raid_catch', jp: { text: 'ようかいブックに いれます！', kana: 'ようかいブックに いれます！', en: 'Into the yōkai book it goes!' }, status: 'draft' },
  { id: 'fude.raid_catch.04', host: 'fude', event: 'raid_catch', jp: { text: 'ゲット！　ズバッ！', kana: 'ゲット！　ズバッ！', en: 'Got it! Slash!' }, status: 'draft' },
  { id: 'fude.raid_catch.05', host: 'fude', event: 'raid_catch', jp: { text: 'おかえりなさい、ようかいさん！', kana: 'おかえりなさい、ようかいさん！', en: 'Welcome home, little yōkai!' }, status: 'draft' },
  // raid_escape
  { id: 'fude.raid_escape.01', host: 'fude', event: 'raid_escape', jp: { text: 'あっ、にげました！', kana: 'あっ、にげました！', en: 'Oh, it got away!' }, status: 'draft' },
  { id: 'fude.raid_escape.02', host: 'fude', event: 'raid_escape', jp: { text: 'だいじょうぶ！　また あいましょう！', kana: 'だいじょうぶ！　また あいましょう！', en: "It's fine! We'll meet again!" }, status: 'draft' },
  { id: 'fude.raid_escape.03', host: 'fude', event: 'raid_escape', jp: { text: 'まどから とんで いきました！', kana: 'まどから とんで いきました！', en: 'It flew out the window!' }, status: 'draft' },
  { id: 'fude.raid_escape.04', host: 'fude', event: 'raid_escape', jp: { text: 'つぎは つかまえます！　シュッ！', kana: 'つぎは つかまえます！　シュッ！', en: "Next time we'll catch it! Swish!" }, status: 'draft' },
  { id: 'fude.raid_escape.05', host: 'fude', event: 'raid_escape', jp: { text: 'ようかい、はやい！　でも まけません！', kana: 'ようかい、はやい！　でも まけません！', en: "Fast yōkai! But we won't lose!" }, status: 'draft' },
  // shodo_intro
  { id: 'fude.shodo_intro.01', host: 'fude', event: 'shodo_intro', jp: { text: 'しーっ… しょどうの じかんです。', kana: 'しーっ… しょどうの じかんです。', en: 'Shh… it\'s calligraphy time.' }, status: 'draft' },
  { id: 'fude.shodo_intro.02', host: 'fude', event: 'shodo_intro', jp: { text: 'とめ、はね、はらい。こころを しずかに。', kana: 'とめ、はね、はらい。こころを しずかに。', en: 'Stop, flick, sweep. Calm your heart.' }, status: 'draft' },
  { id: 'fude.shodo_intro.03', host: 'fude', event: 'shodo_intro', jp: { text: 'ふでを もって… ゆっくり いきましょう。', kana: 'ふでを もって… ゆっくり いきましょう。', en: 'Brush in hand… let\'s take it slowly.' }, status: 'draft' },
  { id: 'fude.shodo_intro.04', host: 'fude', event: 'shodo_intro', jp: { text: 'きょうは しょどう たいかいです。おしずかに。', kana: 'きょうは しょどう たいかいです。おしずかに。', en: 'Today is the calligraphy contest. Quiet, please.' }, status: 'draft' },
  { id: 'fude.shodo_intro.05', host: 'fude', event: 'shodo_intro', jp: { text: 'フデの おてほんを よく みて ください。', kana: 'フデの おてほんを よく みて ください。', en: 'Watch Fude\'s model closely.' }, status: 'draft' },
  // shodo_practice
  { id: 'fude.shodo_practice.01', host: 'fude', event: 'shodo_practice', jp: { text: 'まず なぞって… それから じぶんで。', kana: 'まず なぞって… それから じぶんで。', en: 'Trace it first… then on your own.' }, status: 'draft' },
  { id: 'fude.shodo_practice.02', host: 'fude', event: 'shodo_practice', jp: { text: 'いっかくずつ、ていねいに。', kana: 'いっかくずつ、ていねいに。', en: 'One stroke at a time, carefully.' }, status: 'draft' },
  { id: 'fude.shodo_practice.03', host: 'fude', event: 'shodo_practice', jp: { text: 'まちがえたら… フデの せいです。', kana: 'まちがえたら… フデの せいです。', en: 'If you slip… it\'s Fude\'s fault.' }, status: 'draft' },
  { id: 'fude.shodo_practice.04', host: 'fude', event: 'shodo_practice', jp: { text: 'しずかに… いい ふでの おとですね。', kana: 'しずかに… いい ふでの おとですね。', en: 'Quiet… what a lovely brush sound.' }, status: 'draft' },
  { id: 'fude.shodo_practice.05', host: 'fude', event: 'shodo_practice', jp: { text: 'とめ、はね、はらい。わすれないで。', kana: 'とめ、はね、はらい。わすれないで。', en: 'Stop, flick, sweep. Don\'t forget.' }, status: 'draft' },
  // shodo_read
  { id: 'fude.shodo_read.01', host: 'fude', event: 'shodo_read', jp: { text: 'みんなで よみましょう。せーの！', kana: 'みんなで よみましょう。せーの！', en: 'Let\'s read it together. Ready, go!' }, status: 'draft' },
  { id: 'fude.shodo_read.02', host: 'fude', event: 'shodo_read', jp: { text: 'りっぱな まきものです！　せーの！', kana: 'りっぱな まきものです！　せーの！', en: 'A splendid scroll! Ready, go!' }, status: 'draft' },
  { id: 'fude.shodo_read.03', host: 'fude', event: 'shodo_read', jp: { text: 'こえに だして よんで！　せーの！', kana: 'こえに だして よんで！　せーの！', en: 'Read it out loud! Ready, go!' }, status: 'draft' },
  // shodo_dictation
  { id: 'fude.shodo_dictation.01', host: 'fude', event: 'shodo_dictation', jp: { text: 'かきとりです！　よく みて、よく きいて、かいて！', kana: 'かきとりです！　よく みて、よく きいて、かいて！', en: 'Dictation! Look closely, listen closely, write!' }, status: 'draft' },
  { id: 'fude.shodo_dictation.02', host: 'fude', event: 'shodo_dictation', jp: { text: 'ゆっくり… ていねいに… かく！', kana: 'ゆっくり… ていねいに… かく！', en: 'Slowly… carefully… write!' }, status: 'draft' },
  { id: 'fude.shodo_dictation.03', host: 'fude', event: 'shodo_dictation', jp: { text: 'つぎの ことば！　いきますよ！', kana: 'つぎの ことば！　いきますよ！', en: 'Next word! Here it comes!' }, status: 'draft' },
  { id: 'fude.shodo_dictation.04', host: 'fude', event: 'shodo_dictation', jp: { text: 'あわてない、あわてない。フデは まって います。', kana: 'あわてない、あわてない。フデは まって います。', en: 'No rush, no rush. Fude is waiting.' }, status: 'draft' },
  { id: 'fude.shodo_dictation.05', host: 'fude', event: 'shodo_dictation', jp: { text: 'いちまい いちまい、こころを こめて。', kana: 'いちまい いちまい、こころを こめて。', en: 'One sheet at a time, with all your heart.' }, status: 'draft' },
  // shodo_clean
  { id: 'fude.shodo_clean.01', host: 'fude', event: 'shodo_clean', jp: { text: 'うつくしい！　はなまるです！', kana: 'うつくしい！　はなまるです！', en: 'Beautiful! A flower circle!' }, status: 'draft' },
  { id: 'fude.shodo_clean.02', host: 'fude', event: 'shodo_clean', jp: { text: 'とめ、はね、はらい… かんぺきです。', kana: 'とめ、はね、はらい… かんぺきです。', en: 'Stop, flick, sweep… perfect.' }, status: 'draft' },
  { id: 'fude.shodo_clean.03', host: 'fude', event: 'shodo_clean', jp: { text: 'フデ、かんどうして ふるえて います。', kana: 'フデ、かんどうして ふるえて います。', en: 'Fude is trembling with emotion.' }, status: 'draft' },
  // shodo_misread
  { id: 'fude.shodo_misread.01', host: 'fude', event: 'shodo_misread', jp: { text: 'フデには {char}に みえます… {target}は どこ？', kana: 'フデには {char}に みえます… {target}は どこ？', en: 'To Fude it looks like {char}… where did {target} go?' }, slots: ['{char}', '{target}'], status: 'draft' },
  { id: 'fude.shodo_misread.02', host: 'fude', event: 'shodo_misread', jp: { text: 'あれ？　{char}かな？　フデの めが わるい？', kana: 'あれ？　{char}かな？　フデの めが わるい？', en: 'Huh? Is that {char}? Are my eyes going?' }, slots: ['{char}'], status: 'draft' },
  { id: 'fude.shodo_misread.03', host: 'fude', event: 'shodo_misread', jp: { text: '{char}…？　いえいえ、フデが すべりました。', kana: '{char}…？　いえいえ、フデが すべりました。', en: '{char}…? No, no, my brush slipped.' }, slots: ['{char}'], status: 'draft' },
  // shodo_gallery
  { id: 'fude.shodo_gallery.01', host: 'fude', event: 'shodo_gallery', jp: { text: 'さいごは おおきな いちまい。おだいを よく みて！', kana: 'さいごは おおきな いちまい。おだいを よく みて！', en: 'Last, one big sheet. Read your brief closely!' }, status: 'draft' },
  { id: 'fude.shodo_gallery.02', host: 'fude', event: 'shodo_gallery', jp: { text: 'てんらんかいの じかんです。ゆっくり どうぞ。', kana: 'てんらんかいの じかんです。ゆっくり どうぞ。', en: 'Exhibition time. Take your time.' }, status: 'draft' },
  { id: 'fude.shodo_gallery.03', host: 'fude', event: 'shodo_gallery', jp: { text: 'こころを こめて… いちまい。', kana: 'こころを こめて… いちまい。', en: 'With all your heart… one sheet.' }, status: 'draft' },
  // shodo_vote
  { id: 'fude.shodo_vote.01', host: 'fude', event: 'shodo_vote', jp: { text: 'どれが どうぶつに みえますか？　はんこを どうぞ。', kana: 'どれが どうぶつに みえますか？　はんこを どうぞ。', en: 'Which one looks like an animal? Stamps, please.' }, status: 'draft' },
  { id: 'fude.shodo_vote.02', host: 'fude', event: 'shodo_vote', jp: { text: 'どれも いいですね… はんこを どうぞ！', kana: 'どれも いいですね… はんこを どうぞ！', en: 'They are all good… stamps, please!' }, status: 'draft' },
  // shodo_claim
  { id: 'fude.shodo_claim.01', host: 'fude', event: 'shodo_claim', jp: { text: 'じぶんの さくひんですか？　なまえを どうぞ！', kana: 'じぶんの さくひんですか？　なまえを どうぞ！', en: 'Is it yours? Sign your name!' }, status: 'draft' },
  { id: 'fude.shodo_claim.02', host: 'fude', event: 'shodo_claim', jp: { text: 'さいごに みんなで よみましょう！　せーの！', kana: 'さいごに みんなで よみましょう！　せーの！', en: 'Finally, let\'s read them together! Ready, go!' }, status: 'draft' },
  { id: 'fude.shodo_claim.03', host: 'fude', event: 'shodo_claim', jp: { text: 'かいた ひとは… だれかな？', kana: 'かいた ひとは… だれかな？', en: 'And who wrote it…?' }, status: 'draft' },
  // shodo_synchro_break
  { id: 'fude.shodo_synchro_break.01', host: 'fude', event: 'shodo_synchro_break', jp: { text: 'シンクロ！　…あれ？　ひとり ちがう ほうへ。', kana: 'シンクロ！　…あれ？　ひとり ちがう ほうへ。', en: 'Synchro! …huh? One went the other way.' }, status: 'draft' },
  { id: 'fude.shodo_synchro_break.02', host: 'fude', event: 'shodo_synchro_break', jp: { text: 'みんな そろって… あっ、ひとり おさきに！', kana: 'みんな そろって… あっ、ひとり おさきに！', en: 'All together… oh, one ran ahead!' }, status: 'draft' },
  { id: 'fude.shodo_synchro_break.03', host: 'fude', event: 'shodo_synchro_break', jp: { text: 'ひつじゅんの まいごが いますね。', kana: 'ひつじゅんの まいごが いますね。', en: 'Looks like a stroke got lost.' }, status: 'draft' },
  // shodo_gallery_reveal
  { id: 'fude.shodo_gallery_reveal.01', host: 'fude', event: 'shodo_gallery_reveal', jp: { text: 'おお… おお？　おおおお！', kana: 'おお… おお？　おおおお！', en: 'Oh… oh? OHHH!' }, status: 'draft' },
  { id: 'fude.shodo_gallery_reveal.02', host: 'fude', event: 'shodo_gallery_reveal', jp: { text: 'いち… に… さん… これは なんでしょう？', kana: 'いち… に… さん… これは なんでしょう？', en: 'One… two… three… what could this be?' }, status: 'draft' },
  { id: 'fude.shodo_gallery_reveal.03', host: 'fude', event: 'shodo_gallery_reveal', jp: { text: 'フデ、ドキドキして います。', kana: 'フデ、ドキドキして います。', en: 'Fude\'s heart is pounding.' }, status: 'draft' },
  // shodo_callback
  { id: 'fude.shodo_callback.01', host: 'fude', event: 'shodo_callback', jp: { text: 'こんどは {char}じゃ ないですね。', kana: 'こんどは {char}じゃ ないですね。', en: 'Not {char} this time, I see.' }, slots: ['{char}'], status: 'draft' },
  { id: 'fude.shodo_callback.02', host: 'fude', event: 'shodo_callback', jp: { text: '{char}は… もう いませんね？　よかった。', kana: '{char}は… もう いませんね？　よかった。', en: 'No {char} in here… right? Phew.' }, slots: ['{char}'], status: 'draft' },
  // shodo_award
  { id: 'fude.shodo_award.01', host: 'fude', event: 'shodo_award', jp: { text: '{award}は… {n}ばん！', kana: '{award}は… {n}ばん！', en: 'The {award} goes to… number {n}!' }, slots: ['{award}', '{n}'], status: 'draft' },
  { id: 'fude.shodo_award.02', host: 'fude', event: 'shodo_award', jp: { text: 'はんこの けっかです。{award}、{n}ばん！', kana: 'はんこの けっかです。{award}、{n}ばん！', en: 'The stamps are in. {award}: number {n}!' }, slots: ['{award}', '{n}'], status: 'draft' },
  { id: 'fude.shodo_award.03', host: 'fude', event: 'shodo_award', jp: { text: '{n}ばんに {award}！　かいた ひとは… しって いますね。', kana: '{n}ばんに {award}！　かいた ひとは… しって いますね。', en: '{award} for number {n}! The artist knows who they are.' }, slots: ['{award}', '{n}'], status: 'draft' },
  // shodo_claimed
  { id: 'fude.shodo_claimed.01', host: 'fude', event: 'shodo_claimed', jp: { text: '{name}さんの さくひん でした！　はくしゅ！', kana: '{name}さんの さくひん でした！　はくしゅ！', en: 'It was {name}\'s work! Applause!' }, slots: ['{name}'], status: 'draft' },
  { id: 'fude.shodo_claimed.02', host: 'fude', event: 'shodo_claimed', jp: { text: 'おお、{name}さん！　いい ふでですね。', kana: 'おお、{name}さん！　いい ふでですね。', en: 'Oh, {name}! What a brush.' }, slots: ['{name}'], status: 'draft' },
  // shodo_other_hand
  { id: 'fude.shodo_other_hand.01', host: 'fude', event: 'shodo_other_hand', jp: { text: 'こんどは… はんたいの てで かいて ください！', kana: 'こんどは… はんたいの てで かいて ください！', en: 'This time… write with your other hand!' }, status: 'draft' },
  { id: 'fude.shodo_other_hand.02', host: 'fude', event: 'shodo_other_hand', jp: { text: 'ふでを もちかえて！　はんたいの てです！', kana: 'ふでを もちかえて！　はんたいの てです！', en: 'Switch hands! Your other hand!' }, status: 'draft' },
];
