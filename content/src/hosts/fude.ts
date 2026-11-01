// Fude (brush tsukumogami): Kana Yōkai Raid, Kotoba Concentration, Oekaki, Shodō Taikai, Dub Club, Yōkai Court (presiding judge).
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
  { id: 'fude.shodo_dictation.01', host: 'fude', event: 'shodo_dictation', jp: { text: 'かきとりです！　よく おもいだして、かいて！', kana: 'かきとりです！　よく おもいだして、かいて！', en: 'Dictation! Remember it, then write!' }, status: 'draft' },
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
  // Kotoba Concentration (concentration_*): its own beats, so it no longer borrows Kana Raid lines.
  // concentration_intro
  { id: 'fude.concentration_intro.01', host: 'fude', event: 'concentration_intro', jp: { text: 'カードを めくって、ペアを さがしましょう！', kana: 'カードを めくって、ペアを さがしましょう！', en: "Flip the cards and find the pairs!" }, status: 'draft' },
  { id: 'fude.concentration_intro.02', host: 'fude', event: 'concentration_intro', jp: { text: 'ペアを みつけたら、ことばを いって ください！', kana: 'ペアを みつけたら、ことばを いって ください！', en: "Found a pair? Say the word!" }, status: 'draft' },
  { id: 'fude.concentration_intro.03', host: 'fude', event: 'concentration_intro', jp: { text: 'よく みて、よく おぼえて！　シュッ！', kana: 'よく みて、よく おぼえて！　シュッ！', en: "Look closely, remember well! Swish!" }, status: 'draft' },
  // concentration_say_it
  { id: 'fude.concentration_say_it.01', host: 'fude', event: 'concentration_say_it', jp: { text: '{name}さん、いって ください！', kana: '{name}さん、いって ください！', en: 'Say it, {name}!' }, slots: ['{name}'], status: 'draft' },
  { id: 'fude.concentration_say_it.02', host: 'fude', event: 'concentration_say_it', jp: { text: '{name}さん、おぼえて いますか？', kana: '{name}さん、おぼえて いますか？', en: '{name}, do you remember it?' }, slots: ['{name}'], status: 'draft' },
  { id: 'fude.concentration_say_it.03', host: 'fude', event: 'concentration_say_it', jp: { text: '{name}さんの ばんです！　どうぞ！', kana: '{name}さんの ばんです！　どうぞ！', en: "It's yours, {name}! Go!" }, slots: ['{name}'], status: 'draft' },
  { id: 'fude.concentration_say_it.04', host: 'fude', event: 'concentration_say_it', jp: { text: '{name}さん、ことばを どうぞ！　シュッ！', kana: '{name}さん、ことばを どうぞ！　シュッ！', en: 'The word, {name}! Swish!' }, slots: ['{name}'], status: 'draft' },
  // concentration_keep
  { id: 'fude.concentration_keep.01', host: 'fude', event: 'concentration_keep', jp: { text: '{name}さん、ペア ゲット！　シュッ！', kana: '{name}さん、ペア ゲット！　シュッ！', en: 'A pair for {name}! Swish!' }, slots: ['{name}'], status: 'draft' },
  { id: 'fude.concentration_keep.02', host: 'fude', event: 'concentration_keep', jp: { text: '{name}さん、よく おぼえました！', kana: '{name}さん、よく おぼえました！', en: 'Great memory, {name}!' }, slots: ['{name}'], status: 'draft' },
  { id: 'fude.concentration_keep.03', host: 'fude', event: 'concentration_keep', jp: { text: 'いい こえ！　{name}さんの ペアです！', kana: 'いい こえ！　{name}さんの ペアです！', en: "Nice voice! That pair is {name}'s!" }, slots: ['{name}'], status: 'draft' },
  { id: 'fude.concentration_keep.04', host: 'fude', event: 'concentration_keep', jp: { text: '{name}さん、せいかい！　ズバッ！', kana: '{name}さん、せいかい！　ズバッ！', en: 'Right, {name}! Slash!' }, slots: ['{name}'], status: 'draft' },
  // concentration_steal_open
  { id: 'fude.concentration_steal_open.01', host: 'fude', event: 'concentration_steal_open', jp: { text: 'チャンス！　だれでも どうぞ！', kana: 'チャンス！　だれでも どうぞ！', en: 'Chance! Anyone, go!' }, status: 'draft' },
  { id: 'fude.concentration_steal_open.02', host: 'fude', event: 'concentration_steal_open', jp: { text: 'よこどり タイム！　はやく！', kana: 'よこどり タイム！　はやく！', en: 'Steal time! Quick!' }, status: 'draft' },
  { id: 'fude.concentration_steal_open.03', host: 'fude', event: 'concentration_steal_open', jp: { text: 'みんな、いって ください！', kana: 'みんな、いって ください！', en: 'Everyone, say it!' }, status: 'draft' },
  { id: 'fude.concentration_steal_open.04', host: 'fude', event: 'concentration_steal_open', jp: { text: 'いまなら とれます！　シュッ！', kana: 'いまなら とれます！　シュッ！', en: 'You can grab it now! Swish!' }, status: 'draft' },
  // concentration_stolen
  { id: 'fude.concentration_stolen.01', host: 'fude', event: 'concentration_stolen', jp: { text: '{name}さん、よこどり！　ズバッ！', kana: '{name}さん、よこどり！　ズバッ！', en: '{name} stole it! Slash!' }, slots: ['{name}'], status: 'draft' },
  { id: 'fude.concentration_stolen.02', host: 'fude', event: 'concentration_stolen', jp: { text: 'おっと！　{name}さんが とりました！', kana: 'おっと！　{name}さんが とりました！', en: 'Whoa! {name} took it!' }, slots: ['{name}'], status: 'draft' },
  { id: 'fude.concentration_stolen.03', host: 'fude', event: 'concentration_stolen', jp: { text: '{name}さん、すばやい！', kana: '{name}さん、すばやい！', en: 'So quick, {name}!' }, slots: ['{name}'], status: 'draft' },
  { id: 'fude.concentration_stolen.04', host: 'fude', event: 'concentration_stolen', jp: { text: 'よこどり せいこう！　シュッ！', kana: 'よこどり せいこう！　シュッ！', en: 'Steal successful! Swish!' }, status: 'draft' },
  // concentration_missed
  { id: 'fude.concentration_missed.01', host: 'fude', event: 'concentration_missed', jp: { text: 'あれっ？　だれも いえませんでした。', kana: 'あれっ？　だれも いえませんでした。', en: 'Huh? Nobody said it.' }, status: 'draft' },
  { id: 'fude.concentration_missed.02', host: 'fude', event: 'concentration_missed', jp: { text: 'ドンマイ！　また でて きます！', kana: 'ドンマイ！　また でて きます！', en: "Never mind! It'll come back!" }, status: 'draft' },
  { id: 'fude.concentration_missed.03', host: 'fude', event: 'concentration_missed', jp: { text: 'むずかしい ことばでしたね！', kana: 'むずかしい ことばでしたね！', en: 'That was a hard word!' }, status: 'draft' },
  { id: 'fude.concentration_missed.04', host: 'fude', event: 'concentration_missed', jp: { text: 'フデも わすれました！', kana: 'フデも わすれました！', en: 'Fude forgot it too!' }, status: 'draft' },
  // concentration_mismatch
  { id: 'fude.concentration_mismatch.01', host: 'fude', event: 'concentration_mismatch', jp: { text: 'ざんねん！　ちがう カードです。', kana: 'ざんねん！　ちがう カードです。', en: 'Too bad! Different cards.' }, status: 'draft' },
  { id: 'fude.concentration_mismatch.02', host: 'fude', event: 'concentration_mismatch', jp: { text: 'おしい！　ばしょを おぼえて！', kana: 'おしい！　ばしょを おぼえて！', en: 'So close! Remember where they are!' }, status: 'draft' },
  { id: 'fude.concentration_mismatch.03', host: 'fude', event: 'concentration_mismatch', jp: { text: 'あれっ？　ペアじゃ ありません。', kana: 'あれっ？　ペアじゃ ありません。', en: "Huh? That's not a pair." }, status: 'draft' },
  { id: 'fude.concentration_mismatch.04', host: 'fude', event: 'concentration_mismatch', jp: { text: 'フデも よく まちがえます！', kana: 'フデも よく まちがえます！', en: 'Fude gets things wrong all the time!' }, status: 'draft' },
  { id: 'fude.concentration_mismatch.05', host: 'fude', event: 'concentration_mismatch', jp: { text: 'つぎは きっと あたります！', kana: 'つぎは きっと あたります！', en: "You'll get it next time!" }, status: 'draft' },
  // concentration_yokai
  { id: 'fude.concentration_yokai.01', host: 'fude', event: 'concentration_yokai', jp: { text: 'ようかいだ！　カードが まざります！', kana: 'ようかいだ！　カードが まざります！', en: 'A yōkai! The cards are mixing!' }, status: 'draft' },
  { id: 'fude.concentration_yokai.02', host: 'fude', event: 'concentration_yokai', jp: { text: 'うわっ、カードが うごきました！', kana: 'うわっ、カードが うごきました！', en: 'Whoa, the cards moved!' }, status: 'draft' },
  { id: 'fude.concentration_yokai.03', host: 'fude', event: 'concentration_yokai', jp: { text: 'いたずら ようかい！　シャッフル！', kana: 'いたずら ようかい！　シャッフル！', en: 'A prankster yōkai! Shuffle!' }, status: 'draft' },
  // concentration_bonus
  { id: 'fude.concentration_bonus.01', host: 'fude', event: 'concentration_bonus', jp: { text: 'ボーナス！　{name}さん、もう いっかい！', kana: 'ボーナス！　{name}さん、もう いっかい！', en: 'Bonus! {name}, go again!' }, slots: ['{name}'], status: 'draft' },
  { id: 'fude.concentration_bonus.02', host: 'fude', event: 'concentration_bonus', jp: { text: 'ラッキー！　{name}さんの ばんが つづきます！', kana: 'ラッキー！　{name}さんの ばんが つづきます！', en: "Lucky! {name}'s turn keeps going!" }, slots: ['{name}'], status: 'draft' },
  { id: 'fude.concentration_bonus.03', host: 'fude', event: 'concentration_bonus', jp: { text: 'ほし！　{name}さん、もう いちど どうぞ！', kana: 'ほし！　{name}さん、もう いちど どうぞ！', en: 'A star! {name}, one more turn!' }, slots: ['{name}'], status: 'draft' },
  // concentration_fog
  { id: 'fude.concentration_fog.01', host: 'fude', event: 'concentration_fog', jp: { text: 'きりです！　つぎは みえません！', kana: 'きりです！　つぎは みえません！', en: "Fog! You can't see next turn!" }, status: 'draft' },
  { id: 'fude.concentration_fog.02', host: 'fude', event: 'concentration_fog', jp: { text: 'あっ、きりが でました！', kana: 'あっ、きりが でました！', en: 'Oh, the fog rolled in!' }, status: 'draft' },
  { id: 'fude.concentration_fog.03', host: 'fude', event: 'concentration_fog', jp: { text: 'しろい きり！　ひとつの れつが かくれます！', kana: 'しろい きり！　ひとつの れつが かくれます！', en: 'White fog! A row is hidden!' }, status: 'draft' },
  // concentration_picture
  { id: 'fude.concentration_picture.01', host: 'fude', event: 'concentration_picture', jp: { text: '{name}さん、えを あてました！', kana: '{name}さん、えを あてました！', en: '{name} guessed the picture!' }, slots: ['{name}'], status: 'draft' },
  { id: 'fude.concentration_picture.02', host: 'fude', event: 'concentration_picture', jp: { text: 'せいかい！　{name}さん、めが いい！', kana: 'せいかい！　{name}さん、めが いい！', en: 'Right! Sharp eyes, {name}!' }, slots: ['{name}'], status: 'draft' },
  { id: 'fude.concentration_picture.03', host: 'fude', event: 'concentration_picture', jp: { text: '{name}さん、めいたんてい！　ズバッ！', kana: '{name}さん、めいたんてい！　ズバッ！', en: '{name}, the great detective! Slash!' }, slots: ['{name}'], status: 'draft' },
  // concentration_clear
  { id: 'fude.concentration_clear.01', host: 'fude', event: 'concentration_clear', jp: { text: 'ぜんぶ なくなりました！　おつかれさま！', kana: 'ぜんぶ なくなりました！　おつかれさま！', en: 'The board is clear! Well done!' }, status: 'draft' },
  { id: 'fude.concentration_clear.02', host: 'fude', event: 'concentration_clear', jp: { text: 'カードが ゼロ！　すごい きおくです！', kana: 'カードが ゼロ！　すごい きおくです！', en: 'Zero cards left! Amazing memory!' }, status: 'draft' },
  { id: 'fude.concentration_clear.03', host: 'fude', event: 'concentration_clear', jp: { text: 'ぜんぶの ペア、おわりました！　シュッ！', kana: 'ぜんぶの ペア、おわりました！　シュッ！', en: 'Every pair is done! Swish!' }, status: 'draft' },
  // concentration_time
  { id: 'fude.concentration_time.01', host: 'fude', event: 'concentration_time', jp: { text: 'じかんです！　おつかれさま！', kana: 'じかんです！　おつかれさま！', en: "Time's up! Well done!" }, status: 'draft' },
  { id: 'fude.concentration_time.02', host: 'fude', event: 'concentration_time', jp: { text: 'はい、そこまで！　ズバッ！', kana: 'はい、そこまで！　ズバッ！', en: "That's it, stop! Slash!" }, status: 'draft' },
  { id: 'fude.concentration_time.03', host: 'fude', event: 'concentration_time', jp: { text: 'タイムアップ！　よく がんばりました！', kana: 'タイムアップ！　よく がんばりました！', en: "Time's up! You tried hard!" }, status: 'draft' },
  // Dub Club: Fude-kantoku, a broke but proud anime director (humor and JLPT panels, 2026-10-28)
  // dub_intro
  { id: 'fude.dub_intro.01', host: 'fude', event: 'dub_intro', jp: { text: '{title}、しゅうろく かいし！　かんとくの フデです！', kana: '{title}、しゅうろく かいし！　かんとくの フデです！', en: '{title}: recording starts! I\'m the director, Fude!' }, slots: ['{title}'], status: 'draft' },
  { id: 'fude.dub_intro.02', host: 'fude', event: 'dub_intro', jp: { text: 'よーい、スタート！　こんやの アニメは {title}！', kana: 'よーい、スタート！　こんやの アニメは {title}！', en: 'Ready, action! Tonight\'s anime is {title}!' }, slots: ['{title}'], status: 'draft' },
  { id: 'fude.dub_intro.03', host: 'fude', event: 'dub_intro', jp: { text: 'よさんは ゼロ！　でも こえは あります！', kana: 'よさんは ゼロ！　でも こえは あります！', en: 'The budget is zero! But we have voices!' }, status: 'draft' },
  { id: 'fude.dub_intro.04', host: 'fude', event: 'dub_intro', jp: { text: 'みなさんが せいゆう です！', kana: 'みなさんが せいゆう です！', en: 'You are the voice cast!' }, status: 'draft' },
  // dub_scene
  { id: 'fude.dub_scene.01', host: 'fude', event: 'dub_scene', jp: { text: 'まず、よみあわせ です。「{line}」', kana: 'まず、よみあわせ です。「{line}」', en: 'First, the table read. "{line}"' }, slots: ['{line}'], status: 'draft' },
  { id: 'fude.dub_scene.02', host: 'fude', event: 'dub_scene', jp: { text: 'つぎの シーン！　「{line}」', kana: 'つぎの シーン！　「{line}」', en: 'Next scene! "{line}"' }, slots: ['{line}'], status: 'draft' },
  { id: 'fude.dub_scene.03', host: 'fude', event: 'dub_scene', jp: { text: 'セリフは これ！　「{line}」', kana: 'セリフは これ！　「{line}」', en: 'Here is the line! "{line}"' }, slots: ['{line}'], status: 'draft' },
  // dub_record
  { id: 'fude.dub_record.01', host: 'fude', event: 'dub_record', jp: { text: 'カードの とおりに、どうぞ！', kana: 'カードの とおりに、どうぞ！', en: 'Act it the way your card says!' }, status: 'draft' },
  { id: 'fude.dub_record.02', host: 'fude', event: 'dub_record', jp: { text: 'よーい… スタート！　シュッ！', kana: 'よーい… スタート！　シュッ！', en: 'Ready… action! Swish!' }, status: 'draft' },
  { id: 'fude.dub_record.03', host: 'fude', event: 'dub_record', jp: { text: 'ひみつの カードです。いわないで！', kana: 'ひみつの カードです。いわないで！', en: 'The card is a secret. Don’t say it!' }, status: 'draft' },
  { id: 'fude.dub_record.04', host: 'fude', event: 'dub_record', jp: { text: 'だれが こんな カードを… あ、フデです。', kana: 'だれが こんな カードを… あ、フデです。', en: 'Who wrote these cards… oh, Fude did.' }, status: 'draft' },
  // dub_screening
  { id: 'fude.dub_screening.01', host: 'fude', event: 'dub_screening', jp: { text: 'じょうえい スタート！　おしずかに！', kana: 'じょうえい スタート！　おしずかに！', en: 'The screening starts! Quiet, please!' }, status: 'draft' },
  { id: 'fude.dub_screening.02', host: 'fude', event: 'dub_screening', jp: { text: 'でんきを けして ください！', kana: 'でんきを けして ください！', en: 'Lights off, please!' }, status: 'draft' },
  { id: 'fude.dub_screening.03', host: 'fude', event: 'dub_screening', jp: { text: 'さあ、みましょう！　どんな こえかな？', kana: 'さあ、みましょう！　どんな こえかな？', en: 'Let’s watch! What will the voices be like?' }, status: 'draft' },
  // dub_reveal_all
  { id: 'fude.dub_reveal_all.01', host: 'fude', event: 'dub_reveal_all', jp: { text: 'わかりやすい！　でも、それが いい！', kana: 'わかりやすい！　でも、それが いい！', en: 'Easy to read! But that’s the good part!' }, status: 'draft' },
  { id: 'fude.dub_reveal_all.02', host: 'fude', event: 'dub_reveal_all', jp: { text: '{name}さん、ぜんいんに つたわりました！', kana: '{name}さん、ぜんいんに つたわりました！', en: '{name}, everyone got it!' }, slots: ['{name}'], status: 'draft' },
  { id: 'fude.dub_reveal_all.03', host: 'fude', event: 'dub_reveal_all', jp: { text: 'カット！　…さいこう！', kana: 'カット！　…さいこう！', en: 'Cut! …Perfect!' }, status: 'draft' },
  // dub_reveal_some
  { id: 'fude.dub_reveal_some.01', host: 'fude', event: 'dub_reveal_some', jp: { text: '{name}さん、いい えんぎ！　シュッ！', kana: '{name}さん、いい えんぎ！　シュッ！', en: '{name}, nice acting! Swish!' }, slots: ['{name}'], status: 'draft' },
  { id: 'fude.dub_reveal_some.02', host: 'fude', event: 'dub_reveal_some', jp: { text: 'なるほど！　わかった ひとも いますね。', kana: 'なるほど！　わかった ひとも いますね。', en: 'I see! Some of you got it.' }, status: 'draft' },
  { id: 'fude.dub_reveal_some.03', host: 'fude', event: 'dub_reveal_some', jp: { text: 'カット！　もう いっかい！　…うそです。', kana: 'カット！　もう いっかい！　…うそです。', en: 'Cut! One more time! …Just kidding.' }, status: 'draft' },
  // dub_reveal_none
  { id: 'fude.dub_reveal_none.01', host: 'fude', event: 'dub_reveal_none', jp: { text: 'だれも わからない！　…でも フデは すき！', kana: 'だれも わからない！　…でも フデは すき！', en: 'Nobody got it! …But Fude loves it!' }, status: 'draft' },
  { id: 'fude.dub_reveal_none.02', host: 'fude', event: 'dub_reveal_none', jp: { text: 'え、「{card}」でしたか？', kana: 'え、「{card}」でしたか？', en: 'Wait, that was "{card}"?' }, slots: ['{card}'], status: 'draft' },
  { id: 'fude.dub_reveal_none.03', host: 'fude', event: 'dub_reveal_none', jp: { text: 'げいじゅつ です。むずかしい！', kana: 'げいじゅつ です。むずかしい！', en: 'That’s art. Hard to read!' }, status: 'draft' },
  // dub_spoiler
  { id: 'fude.dub_spoiler.01', host: 'fude', event: 'dub_spoiler', jp: { text: 'ネタバレ きんし！　シュッ！', kana: 'ネタバレ きんし！　シュッ！', en: 'No spoilers! Swish!' }, status: 'draft' },
  { id: 'fude.dub_spoiler.02', host: 'fude', event: 'dub_spoiler', jp: { text: 'あっ、カードを いいました！', kana: 'あっ、カードを いいました！', en: 'Oh, you said the card!' }, status: 'draft' },
  // dub_skip
  { id: 'fude.dub_skip.01', host: 'fude', event: 'dub_skip', jp: { text: 'カット！　つぎに いきましょう。', kana: 'カット！　つぎに いきましょう。', en: 'Cut! Let’s move on.' }, status: 'draft' },
  { id: 'fude.dub_skip.02', host: 'fude', event: 'dub_skip', jp: { text: 'この シーンは… また こんど！', kana: 'この シーンは… また こんど！', en: 'This scene… another time!' }, status: 'draft' },
  // dub_cut: an ad-lib landed, before the booth replays it
  { id: 'fude.dub_cut.01', host: 'fude', event: 'dub_cut', jp: { text: 'カット！　いい アドリブ！　シュッ！', kana: 'カット！　いい アドリブ！　シュッ！', en: 'Cut! Great ad-lib!' }, status: 'draft' },
  { id: 'fude.dub_cut.02', host: 'fude', event: 'dub_cut', jp: { text: 'カット！　{name}さん、さいこう！', kana: 'カット！　{name}さん、さいこう！', en: 'Cut! {name}, brilliant!' }, slots: ['{name}'], status: 'draft' },
  { id: 'fude.dub_cut.03', host: 'fude', event: 'dub_cut', jp: { text: 'カット！　いまの、つかおう！', kana: 'カット！　いまの、つかおう！', en: 'Cut! We’re using that one!' }, status: 'draft' },
  { id: 'fude.dub_cut.04', host: 'fude', event: 'dub_cut', jp: { text: 'カット！　フデ、ないちゃう！', kana: 'カット！　フデ、ないちゃう！', en: "Cut! Fude's gonna cry!" }, status: 'draft' },
  // dub_booth: the commentary booth: he says the scene's model ad-lib line himself, as is (never the player's take)
  { id: 'fude.dub_booth.01', host: 'fude', event: 'dub_booth', jp: { text: '{line}', kana: '{line}', en: '{line}' }, slots: ['{line}'], status: 'draft' },
  // dub_standin: the host stand-in, a small room with no N4 player: he ad-libs the scene's model line himself, as is
  { id: 'fude.dub_standin.01', host: 'fude', event: 'dub_standin', jp: { text: '{line}', kana: '{line}', en: '{line}' }, slots: ['{line}'], status: 'draft' },
  // dub_standin_setup: experiment standInSetup, just before his stand-in ad-lib
  { id: 'fude.dub_standin_setup.01', host: 'fude', event: 'dub_standin_setup', jp: { text: 'アドリブは かんとくが！　シュッ！', kana: 'アドリブは かんとくが！　シュッ！', en: "The ad-lib? The director's got it! Swish!" }, status: 'draft' },
  // dub_notes
  { id: 'fude.dub_notes.01', host: 'fude', event: 'dub_notes', jp: { text: 'こえの しゅつえん！　はくしゅ！', kana: 'こえの しゅつえん！　はくしゅ！', en: 'Our voice cast! A round of applause!' }, status: 'draft' },
  { id: 'fude.dub_notes.02', host: 'fude', event: 'dub_notes', jp: { text: 'きょうの スターは {name}さん！', kana: 'きょうの スターは {name}さん！', en: 'Today’s star is {name}!' }, slots: ['{name}'], status: 'draft' },
  { id: 'fude.dub_notes.03', host: 'fude', event: 'dub_notes', jp: { text: 'いい シーンでした！　つぎも おねがいします！', kana: 'いい シーンでした！　つぎも おねがいします！', en: 'Good scene! Again next time, please!' }, status: 'draft' },
  // dub_episode
  { id: 'fude.dub_episode.01', host: 'fude', event: 'dub_episode', jp: { text: 'かんせい しました！　{title}、どうぞ！', kana: 'かんせい しました！　{title}、どうぞ！', en: 'It’s finished! Here is {title}!' }, slots: ['{title}'], status: 'draft' },
  { id: 'fude.dub_episode.02', host: 'fude', event: 'dub_episode', jp: { text: 'だいいちわ、ほうそう かいし！', kana: 'だいいちわ、ほうそう かいし！', en: 'Episode one, on air!' }, status: 'draft' },
  { id: 'fude.dub_episode.03', host: 'fude', event: 'dub_episode', jp: { text: 'みなさんの こえで、アニメが できました！', kana: 'みなさんの こえで、アニメが できました！', en: 'Your voices made an anime!' }, status: 'draft' },
  // dub_sequel
  { id: 'fude.dub_sequel.01', host: 'fude', event: 'dub_sequel', jp: { text: '「{title}　パート ツー」、つくっても いいですか？　…だめ？', kana: '「{title}　パート ツー」、つくっても いいですか？　…だめ？', en: 'May I make "{title} Part Two"? …No?' }, slots: ['{title}'], status: 'draft' },
  { id: 'fude.dub_sequel.02', host: 'fude', event: 'dub_sequel', jp: { text: 'おつかれさまでした！　また こんど！', kana: 'おつかれさまでした！　また こんど！', en: 'Thank you for your hard work! See you!' }, status: 'draft' },
  { id: 'fude.dub_sequel.03', host: 'fude', event: 'dub_sequel', jp: { text: 'つぎも みてね！　やくそく だよ！', kana: 'つぎも みてね！　やくそく だよ！', en: 'Watch the next one too! Promise!' }, audience: 'kids', status: 'draft' },
  { id: 'fude.dub_sequel.04', host: 'fude', event: 'dub_sequel', jp: { text: 'スポンサーが にげました。だいにわは ありません。', kana: 'スポンサーが にげました。だいにわは ありません。', en: 'The sponsor ran away. There is no episode two.' }, audience: 'cheeky', status: 'draft' },
  // court_intro: Fude-san presides over Yōkai Court (Fude is the judge; everyone who isn't a lawyer judges too)
  { id: 'fude.court_intro.01', host: 'fude', event: 'court_intro', jp: { text: 'ようかい さいばん、かいてい します！　シュッ！', kana: 'ようかい さいばん、かいてい します！　シュッ！', en: 'Yōkai Court is now in session! Swish!' }, status: 'draft' },
  { id: 'fude.court_intro.02', host: 'fude', event: 'court_intro', jp: { text: 'さいばんちょうは フデです。みなさんも さいばんいんですよ！', kana: 'さいばんちょうは フデです。みなさんも さいばんいんですよ！', en: 'I am the presiding judge. And you are all judges too!' }, status: 'draft' },
  { id: 'fude.court_intro.03', host: 'fude', event: 'court_intro', jp: { text: 'しょうにんが ひとり、べんごしが ふたり。あとは みんなで きめます！', kana: 'しょうにんが ひとり、べんごしが ふたり。あとは みんなで きめます！', en: 'One witness, two lawyers. Everyone else decides!' }, status: 'draft' },
  { id: 'fude.court_intro.04', host: 'fude', event: 'court_intro', jp: { text: 'スタジオで じけんです！　ほうていへ どうぞ！', kana: 'スタジオで じけんです！　ほうていへ どうぞ！', en: 'There has been an incident at the studio! To the courtroom!' }, status: 'draft' },
  // court_case: {line} is the case title, {accused} the accused yōkai
  { id: 'fude.court_case.01', host: 'fude', event: 'court_case', jp: { text: 'じけんです！　「{line}」', kana: 'じけんです！　「{line}」', en: 'A case! “{line}”' }, slots: ['{line}'], status: 'draft' },
  { id: 'fude.court_case.02', host: 'fude', event: 'court_case', jp: { text: 'ひこくは {accused}です！', kana: 'ひこくは {accused}です！', en: 'The accused is the {accused}!' }, slots: ['{accused}'], status: 'draft' },
  { id: 'fude.court_case.03', host: 'fude', event: 'court_case', jp: { text: 'きょうの じけん…　「{line}」　ドン！', kana: 'きょうの じけん…　「{line}」　ドン！', en: 'Today’s case… “{line}” Bang!' }, slots: ['{line}'], status: 'draft' },
  { id: 'fude.court_case.04', host: 'fude', event: 'court_case', jp: { text: '{accused}が うたがわれて います！', kana: '{accused}が うたがわれて います！', en: 'The {accused} is under suspicion!' }, slots: ['{accused}'], status: 'draft' },
  // court_ask: Fude-san asks the witness ({name}) one question
  { id: 'fude.court_ask.01', host: 'fude', event: 'court_ask', jp: { text: 'しょうにんの {name}さん、なにか みましたか？', kana: 'しょうにんの {name}さん、なにか みましたか？', en: 'Witness {name}, did you see anything?' }, slots: ['{name}'], status: 'draft' },
  { id: 'fude.court_ask.02', host: 'fude', event: 'court_ask', jp: { text: 'しょうにん、まえへ！　なにか みましたか？', kana: 'しょうにん、まえへ！　なにか みましたか？', en: 'Witness, step forward! Did you see anything?' }, status: 'draft' },
  { id: 'fude.court_ask.03', host: 'fude', event: 'court_ask', jp: { text: '{name}さん、ほんとうの ことを おねがいします。', kana: '{name}さん、ほんとうの ことを おねがいします。', en: '{name}, the truth, please.' }, slots: ['{name}'], status: 'draft' },
  // court_testimony: Fude-san says the witness's tile for them ({line}: the line, as is)
  { id: 'fude.court_testimony.01', host: 'fude', event: 'court_testimony', jp: { text: 'しょうにんは こう いいました。「{line}」', kana: 'しょうにんは こう いいました。「{line}」', en: 'The witness said: “{line}”' }, slots: ['{line}'], status: 'draft' },
  { id: 'fude.court_testimony.02', host: 'fude', event: 'court_testimony', jp: { text: '「{line}」　…なるほど。', kana: '「{line}」　…なるほど。', en: '“{line}” …I see.' }, slots: ['{line}'], status: 'draft' },
  // court_curveball: a second suspect ({suspect}): the court gasps
  { id: 'fude.court_curveball.01', host: 'fude', event: 'court_curveball', jp: { text: 'えっ！？　{suspect}も！？', kana: 'えっ！？　{suspect}も！？', en: 'What?! The {suspect} too?!' }, slots: ['{suspect}'], status: 'draft' },
  { id: 'fude.court_curveball.02', host: 'fude', event: 'court_curveball', jp: { text: 'ようぎしゃが ふたり！？　ほうていが ざわざわ…', kana: 'ようぎしゃが ふたり！？　ほうていが ざわざわ…', en: 'Two suspects?! The court is buzzing…' }, status: 'draft' },
  { id: 'fude.court_curveball.03', host: 'fude', event: 'court_curveball', jp: { text: '{suspect}も いた！？　これは たいへんです！', kana: '{suspect}も いた！？　これは たいへんです！', en: 'The {suspect} was there too?! This is serious!' }, slots: ['{suspect}'], status: 'draft' },
  // court_plan: both lawyers plan in private
  { id: 'fude.court_plan.01', host: 'fude', event: 'court_plan', jp: { text: 'べんごしの おふたり、じゅんびを どうぞ。', kana: 'べんごしの おふたり、じゅんびを どうぞ。', en: 'Lawyers, prepare your arguments.' }, status: 'draft' },
  { id: 'fude.court_plan.02', host: 'fude', event: 'court_plan', jp: { text: 'さいばんいんの みなさん、よそうを どうぞ。', kana: 'さいばんいんの みなさん、よそうを どうぞ。', en: 'Judges, make your guess.' }, status: 'draft' },
  { id: 'fude.court_plan.03', host: 'fude', event: 'court_plan', jp: { text: 'しずかに！　べんごしが かんがえて います。', kana: 'しずかに！　べんごしが かんがえて います。', en: 'Quiet! The lawyers are thinking.' }, status: 'draft' },
  // court_read: Fude-san reads a Kana lawyer's tiles ({line}, as is)
  { id: 'fude.court_read.01', host: 'fude', event: 'court_read', jp: { text: '{line}', kana: '{line}', en: '{line}' }, slots: ['{line}'], status: 'draft' },
  // court_mic_pass: Fude-san says {name}'s argument for them ({line}, as is)
  { id: 'fude.court_mic_pass.01', host: 'fude', event: 'court_mic_pass', jp: { text: 'フデが よみます。{name}さんの べんろん…「{line}」', kana: 'フデが よみます。{name}さんの べんろん…「{line}」', en: 'I’ll read it. {name}’s argument… “{line}”' }, slots: ['{name}', '{line}'], status: 'draft' },
  { id: 'fude.court_mic_pass.02', host: 'fude', event: 'court_mic_pass', jp: { text: 'まかせて ください！　「{line}」', kana: 'まかせて ください！　「{line}」', en: 'Leave it to me! “{line}”' }, slots: ['{line}'], status: 'draft' },
  // court_stand_in: nothing came from {name} in time; Fude-san stands in ({line}, as is). Blames the brush, never the player
  { id: 'fude.court_stand_in.01', host: 'fude', event: 'court_stand_in', jp: { text: 'マイクが ねて いました。フデが いいます。「{line}」', kana: 'マイクが ねて いました。フデが いいます。「{line}」', en: 'The mic fell asleep. I’ll say it: “{line}”' }, slots: ['{line}'], status: 'draft' },
  { id: 'fude.court_stand_in.02', host: 'fude', event: 'court_stand_in', jp: { text: 'インクぎれ！　かわりに よみます。「{line}」', kana: 'インクぎれ！　かわりに よみます。「{line}」', en: 'Out of ink! I’ll read it instead: “{line}”' }, slots: ['{line}'], status: 'draft' },
  // court_check: one question about the arguments
  { id: 'fude.court_check.01', host: 'fude', event: 'court_check', jp: { text: 'さいばんいんに しつもんです！', kana: 'さいばんいんに しつもんです！', en: 'A question for the judges!' }, status: 'draft' },
  { id: 'fude.court_check.02', host: 'fude', event: 'court_check', jp: { text: 'よく きいて いましたか？', kana: 'よく きいて いましたか？', en: 'Were you listening carefully?' }, status: 'draft' },
  { id: 'fude.court_check.03', host: 'fude', event: 'court_check', jp: { text: 'ひとつだけ しつもん。スマホを みて ください。', kana: 'ひとつだけ しつもん。スマホを みて ください。', en: 'Just one question. Look at your phone.' }, status: 'draft' },
  // court_vote: who won you over?
  { id: 'fude.court_vote.01', host: 'fude', event: 'court_vote', jp: { text: 'どちらに なっとく しましたか？', kana: 'どちらに なっとく しましたか？', en: 'Who won you over?' }, status: 'draft' },
  { id: 'fude.court_vote.02', host: 'fude', event: 'court_vote', jp: { text: 'ゆうざいか、むざいか。みなさんが きめます！', kana: 'ゆうざいか、むざいか。みなさんが きめます！', en: 'Guilty or not guilty. You decide!' }, status: 'draft' },
  { id: 'fude.court_vote.03', host: 'fude', event: 'court_vote', jp: { text: 'さあ、とうひょう です！　シュッ！', kana: 'さあ、とうひょう です！　シュッ！', en: 'Now, the vote! Swish!' }, status: 'draft' },
  // court_guilty: 有罪 ({accused})
  { id: 'fude.court_guilty.01', host: 'fude', event: 'court_guilty', jp: { text: 'はんけつ！　ゆうざい！', kana: 'はんけつ！　ゆうざい！', en: 'The verdict: guilty!' }, status: 'draft' },
  { id: 'fude.court_guilty.02', host: 'fude', event: 'court_guilty', jp: { text: '{accused}、ゆうざい です！　ドン！', kana: '{accused}、ゆうざい です！　ドン！', en: 'The {accused} is guilty! Bang!' }, slots: ['{accused}'], status: 'draft' },
  { id: 'fude.court_guilty.03', host: 'fude', event: 'court_guilty', jp: { text: 'ゆうざい！　…あとで ちゃんと あやまりましょうね。', kana: 'ゆうざい！　…あとで ちゃんと あやまりましょうね。', en: 'Guilty! …Let’s apologise properly later.' }, status: 'draft' },
  // court_not_guilty: 無罪 ({accused})
  { id: 'fude.court_not_guilty.01', host: 'fude', event: 'court_not_guilty', jp: { text: 'はんけつ！　むざい！', kana: 'はんけつ！　むざい！', en: 'The verdict: not guilty!' }, status: 'draft' },
  { id: 'fude.court_not_guilty.02', host: 'fude', event: 'court_not_guilty', jp: { text: '{accused}は むざい です！　よかったですね！', kana: '{accused}は むざい です！　よかったですね！', en: 'The {accused} is not guilty! What a relief!' }, slots: ['{accused}'], status: 'draft' },
  { id: 'fude.court_not_guilty.03', host: 'fude', event: 'court_not_guilty', jp: { text: 'むざい！　…では、だれが？', kana: 'むざい！　…では、だれが？', en: 'Not guilty! …Then who did it?' }, status: 'draft' },
  // court_tie: a tie is not guilty
  { id: 'fude.court_tie.01', host: 'fude', event: 'court_tie', jp: { text: 'どうてん！　うたがわしきは ばっせず。むざい です！', kana: 'どうてん！　うたがわしきは ばっせず。むざい です！', en: 'A tie! When in doubt, no punishment. Not guilty!' }, status: 'draft' },
  { id: 'fude.court_tie.02', host: 'fude', event: 'court_tie', jp: { text: 'はんぶん はんぶん…　だから、むざい！', kana: 'はんぶん はんぶん…　だから、むざい！', en: 'Half and half… so, not guilty!' }, status: 'draft' },
  // court_booth: the replay booth opens on the argument that used its chunk ({chunk}, when given)
  { id: 'fude.court_booth.01', host: 'fude', event: 'court_booth', jp: { text: 'ここで もう いちど！　「{chunk}」が でました！', kana: 'ここで もう いちど！　「{chunk}」が でました！', en: 'Once more! There was “{chunk}”!' }, slots: ['{chunk}'], status: 'draft' },
  { id: 'fude.court_booth.02', host: 'fude', event: 'court_booth', jp: { text: 'いい べんろん でした！　もう いちど きいて みましょう。', kana: 'いい べんろん でした！　もう いちど きいて みましょう。', en: 'A fine argument! Let’s hear it again.' }, status: 'draft' },
];
