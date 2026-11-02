// Last Train · the Green Car lines (グリーン車). A room whose players are all N4 or N3 rides one of these
// (shared/src/greenCar.ts; chooseScenario in shared/src/modes/lastTrain/lastTrain.ts), and no other room does.
// Every stop carries N4 and N3 work: the announcer, Lost and Found and the front desk are always on, the sign
// boards are the N3 sign kanji (goal 3.12), and the announcer has its N3 service lines (goal 3.8).
// Same stop order on all three, so every frame is reachable in every audience: announcement, signs, lost and
// found, the inn, signs, and a last announcement. Kids: a school trip and a lost lunchbox. Cheeky: the last
// train after a party. Draft until the fluent check. Ids are stable once shipped.

import type { LastTrainScenario, MinigameItem, TrainStop } from '../types.js';
import { ruby } from './ruby.js';

const stop = (line: string, id: string, name: [string, string], minigameId: string, announcement: [string, string]): TrainStop => ({
  id: `${line}.${id}`,
  name: ruby(name[0], name[1]),
  minigameId,
  announcement: ruby(announcement[0], announcement[1]),
});

const dash = (id: string, level: 'n4' | 'n3', frames: string[], prompt: [string, string], model: [string, string], accepted: string[], hint: string): MinigameItem => ({
  id: `green-car.dash.${id}`,
  level,
  frames,
  prompt: ruby(prompt[0], prompt[1]),
  accepted,
  model: ruby(model[0], model[1]),
  hint,
  timeLimit: 8,
});

/** The Platform Dash on every Green Car line: N4 and N3 service Japanese, all ages. */
const GREEN_DASH: MinigameItem[] = [
  dash('01-shoushou', 'n4', ['o-kudasai'], ['お{客|きゃく}さんに、「ちょっと{待|ま}って」をていねいに。', 'Ask a passenger to wait a moment, politely.'], ['{少々|しょうしょう}お{待|ま}ちください。', 'Please wait a moment.'], ['しょうしょうおまちください', 'おまちください', 'すこしおまちください', 'しょうしょうおまちくださいませ'], 'お, the verb stem, then ください: おまち ください.'),
  dash('02-shuuden-gozaimasu', 'n3', ['de-gozaimasu'], ['「これは{終電|しゅうでん}です」を、{駅員|えきいん}のことばで。', '"This is the last train", as the station staff say it.'], ['これは{終電|しゅうでん}でございます。', 'This is the last train.'], ['これはしゅうでんでございます', 'こちらはしゅうでんでございます', 'しゅうでんでございます'], 'The staff say です as でございます.'),
  dash('03-michi', 'n4', ['te-itadakemasen'], ['{駅員|えきいん}さんに{道|みち}を{聞|き}きます。とてもていねいに。', 'Ask the station staff the way, very politely.'], ['{道|みち}を{教|おし}えていただけますか。', 'Could you tell me the way?'], ['みちをおしえていただけますか', 'みちをおしえていただけませんか', 'すみませんみちをおしえていただけますか', 'すみませんみちをおしえていただけませんか'], 'The て form of おしえる, then いただけますか.'),
  dash('04-okurete', 'n3', ['te-orimasu'], ['「{電車|でんしゃ}がおくれています」を、{駅員|えきいん}のことばで。', '"The train is running late", as the station staff say it.'], ['{電車|でんしゃ}がおくれております。', 'The train is running late.'], ['でんしゃがおくれております', 'ただいまでんしゃがおくれております'], 'Staff say 〜て います as 〜て おります.'),
  dash('05-haiken', 'n3', ['sasete-itadaku'], ['きっぷを{見|み}ます。{車掌|しゃしょう}のことばで。', 'You check a ticket. Say it as the conductor does.'], ['きっぷを{拝見|はいけん}させていただきます。', 'May I see your ticket?'], ['きっぷをはいけんさせていただきます', 'はいけんさせていただきます', 'しつれいしますきっぷをはいけんさせていただきます'], 'Look, humbly: はいけんする, then させて いただきます.'),
  dash('06-mairimasu', 'n4', ['keigo'], ['「{電車|でんしゃ}が{来|き}ます」を、{駅|えき}のことばで。', '"The train is coming", as the platform says it.'], ['{電車|でんしゃ}がまいります。', 'The train is coming.'], ['でんしゃがまいります', 'まもなくでんしゃがまいります', 'でんしゃがまいりますおさがりください'], 'Stations say くる as まいります.'),
];

const GREEN = 'green-car-line';
const TRIP = 'green-car-school-trip';
const PARTY = 'green-car-afterparty';

export const greenCarScenarios: LastTrainScenario[] = [
  {
    id: GREEN,
    greenCar: true,
    title: ruby('グリーン{車|しゃ}の{最終電車|さいしゅうでんしゃ}', 'The Last Train, Green Car'),
    departure: ruby('{皆|みな}さん、グリーン{車|しゃ}へようこそ。{今夜|こんや}は、{皆|みな}さんが{駅員|えきいん}です。', 'Welcome to the Green Car, everyone. Tonight, you are the station staff.'),
    stops: [
      stop(GREEN, 'tsukimidai', ['{月見台|つきみだい}', 'Tsukimidai'], 'station-announcement', ['{次|つぎ}は{月見台|つきみだい}。{今夜|こんや}は、ていねいにまいりましょう。', 'Next: Tsukimidai (moon-viewing hill). Tonight, let’s go politely.']),
      stop(GREEN, 'annai-doori', ['{案内通|あんないどお}り', 'Annai-dōri'], 'read-the-signs', ['{次|つぎ}は{案内通|あんないどお}り。{看板|かんばん}を、よく{見|み}てくださいね。', 'Next: Annai-dōri (Signpost Street). Take a good look at the boards.']),
      stop(GREEN, 'wasuremono-bashi', ['{忘|わす}れ{物|もの}{橋|ばし}', 'Wasuremono-bashi'], 'lost-and-found', ['{次|つぎ}は{忘|わす}れ{物|もの}{橋|ばし}。{何|なに}か、{忘|わす}れていませんか。', 'Next: Wasuremono-bashi (Lost Property Bridge). Haven’t you forgotten something?']),
      stop(GREEN, 'yuzu-onsen', ['ゆず{温泉|おんせん}', 'Yuzu Onsen'], 'meet-the-innkeeper', ['{次|つぎ}はゆず{温泉|おんせん}。フロントでは、ていねいにどうぞ。', 'Next: Yuzu Onsen. At the front desk, politely, please.']),
      stop(GREEN, 'clover-guchi', ['クローバー{口|ぐち}', 'Clover-guchi'], 'read-the-signs', ['{次|つぎ}はクローバー{口|ぐち}。{四|よ}つ{葉|ば}より、{看板|かんばん}を{探|さが}してください。', 'Next: Clover-guchi. Look for the signs, not the four-leaf clovers.']),
      stop(GREEN, 'yoake', ['{夜明|よあ}け{駅|えき}', 'Yoake Station'], 'station-announcement', ['{終点|しゅうてん}、{夜明|よあ}け{駅|えき}でございます。', 'Last stop: Yoake (Daybreak) Station.']),
    ],
    twist: ruby('{実|じつ}は……この{電車|でんしゃ}の{車掌|しゃしょう}は、ずっと{皆|みな}さんでした！', 'The truth is... the conductors of this train were you, all along!'),
    platformDash: GREEN_DASH,
    status: 'draft',
  },
  {
    id: TRIP,
    greenCar: true,
    audience: 'kids',
    title: ruby('{修学旅行|しゅうがくりょこう}のグリーン{車|しゃ}', 'The School Trip in the Green Car'),
    departure: ruby('{修学旅行|しゅうがくりょこう}の{皆|みな}さん、グリーン{車|しゃ}へようこそ。{先生|せんせい}より、ていねいにね。', 'School trip, welcome to the Green Car. Be more polite than your teacher!'),
    stops: [
      stop(TRIP, 'suizokukan-mae', ['{水族館前|すいぞくかんまえ}', 'Suizokukan-mae'], 'station-announcement', ['{次|つぎ}は{水族館前|すいぞくかんまえ}。イルカも、おじぎしております。', 'Next: Suizokukan-mae (the aquarium). Even the dolphins are bowing.']),
      stop(TRIP, 'doubutsuen-guchi', ['{動物園口|どうぶつえんぐち}', 'Dōbutsuen-guchi'], 'read-the-signs', ['{次|つぎ}は{動物園口|どうぶつえんぐち}。パンダも、{看板|かんばん}を{読|よ}んでいます。', 'Next: Dōbutsuen-guchi (the zoo). Even the pandas are reading the signs.']),
      stop(TRIP, 'obentou-bashi', ['お{弁当|べんとう}{橋|ばし}', 'Obentō-bashi'], 'lost-and-found', ['{次|つぎ}はお{弁当|べんとう}{橋|ばし}。お{弁当|べんとう}、ちゃんとありますか。', 'Next: Obentō-bashi (Lunchbox Bridge). Have you all still got your lunchboxes?']),
      stop(TRIP, 'makuranage-onsen', ['まくら{投|な}げ{温泉|おんせん}', 'Makuranage Onsen'], 'meet-the-innkeeper', ['{次|つぎ}はまくら{投|な}げ{温泉|おんせん}。{先生|せんせい}には、ないしょですよ。', 'Next: Makuranage Onsen (pillow-fight hot spring). Don’t tell the teacher.']),
      stop(TRIP, 'kagakukan-mae', ['{科学館前|かがくかんまえ}', 'Kagakukan-mae'], 'read-the-signs', ['{次|つぎ}は{科学館前|かがくかんまえ}。{漢字|かんじ}の{実験|じっけん}を、はじめます。', 'Next: Kagakukan-mae (the science museum). Our kanji experiment begins.']),
      stop(TRIP, 'gakkou-mae', ['{学校前|がっこうまえ}', 'Gakkō-mae'], 'station-announcement', ['{終点|しゅうてん}、{学校前|がっこうまえ}です。おうちに{帰|かえ}るまでが、{修学旅行|しゅうがくりょこう}ですよ。', 'Last stop: Gakkō-mae (the school). The trip isn’t over until you’re home!']),
    ],
    twist: ruby('{実|じつ}は……{先生|せんせい}も、お{弁当|べんとう}を{忘|わす}れていました！', 'The truth is... the teacher forgot their lunchbox too!'),
    platformDash: GREEN_DASH,
    status: 'draft',
  },
  {
    id: PARTY,
    greenCar: true,
    audience: 'cheeky',
    title: ruby('{二次会|にじかい}のあとの{終電|しゅうでん}', 'The Last Train after the After-Party'),
    departure: ruby('{皆|みな}さん、{二次会|にじかい}、お{疲|つか}れさまでした。{終電|しゅうでん}は、グリーン{車|しゃ}でございます。', 'Well partied, everyone. Your last train is the Green Car.'),
    stops: [
      stop(PARTY, 'nijikai-mae', ['{二次会前|にじかいまえ}', 'Nijikai-mae'], 'station-announcement', ['{次|つぎ}は{二次会前|にじかいまえ}。カラオケの{声|こえ}は、{小|ちい}さめにお{願|ねが}いします。', 'Next: Nijikai-mae (the after-party). Karaoke voices down, please.']),
      stop(PARTY, 'neon-doori', ['ネオン{通|どお}り', 'Neon-dōri'], 'read-the-signs', ['{次|つぎ}はネオン{通|どお}り。{看板|かんばん}が、ちょっとまぶしいですね。', 'Next: Neon-dōri. The signs are a little bright tonight.']),
      stop(PARTY, 'otoshimono-yokochou', ['{落|お}とし{物|もの}{横丁|よこちょう}', 'Otoshimono Yokochō'], 'lost-and-found', ['{次|つぎ}は{落|お}とし{物|もの}{横丁|よこちょう}。スマホ、かさ、{記憶|きおく}……{何|なに}を{落|お}としましたか。', 'Next: Otoshimono Yokochō (Lost Property Alley). Phone, umbrella, memory... what did you drop?']),
      stop(PARTY, 'yoizame-onsen', ['{酔|よ}いざめ{温泉|おんせん}', 'Yoizame Onsen'], 'meet-the-innkeeper', ['{次|つぎ}は{酔|よ}いざめ{温泉|おんせん}。お{水|みず}は、フロントでどうぞ。', 'Next: Yoizame Onsen (sober-up hot spring). Water at the front desk.']),
      stop(PARTY, 'shime-ramen-mae', ['しめのラーメン{前|まえ}', 'Shime-no-Rāmen-mae'], 'read-the-signs', ['{次|つぎ}はしめのラーメン{前|まえ}。ラーメンの{看板|かんばん}だけは、{読|よ}めますね。', 'Next: Shime-no-Rāmen-mae (the end-of-night ramen). The ramen sign, at least, you can read.']),
      stop(PARTY, 'shihatsu-eki', ['{始発駅|しはつえき}', 'Shihatsu Station'], 'station-announcement', ['{終点|しゅうてん}、{始発駅|しはつえき}でございます。……あれ？もう{朝|あさ}ですか。', 'Last stop: Shihatsu (First Train) Station. ...Huh? Is it morning already?']),
    ],
    twist: ruby('{実|じつ}は……{皆|みな}さん、{終電|しゅうでん}じゃなくて、{始発|しはつ}に{乗|の}っていました！', 'The truth is... you didn’t catch the last train. You caught the first one!'),
    platformDash: GREEN_DASH,
    status: 'draft',
  },
];
