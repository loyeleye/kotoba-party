// Recap awards, named in character per host. The server's award picker reads
// `criterion`; recap_award lines voice `name.kana` into the {award} slot.
// Ids are stable: never rename or reuse one.

import type { HostAward } from '../types.js';

export const hostAwards: HostAward[] = [
  // Pon (Oogiri Night)
  {
    id: 'pon.award.cushions-stolen',
    host: 'pon',
    name: { text: 'ざぶとん さようならしょう', kana: 'ざぶとん さようならしょう', en: 'Most Cushions Stolen' },
    criterion: 'The player Pon stole a cushion from (ties: the one who led for the most rounds).',
  },
  {
    id: 'pon.award.bravest-japanese',
    host: 'pon',
    name: { text: 'ゆうき ナンバーワン', kana: 'ゆうき ナンバーワン', en: 'Bravest Japanese' },
    criterion: 'Most Encores performed and say-it-first answers attempted, regardless of how they were scored.',
  },
  {
    id: 'pon.award.best-callback',
    host: 'pon',
    name: { text: 'また でたしょう', kana: 'また でたしょう', en: 'Best Callback' },
    criterion: 'Most votes on answers that used a callback tile (a word from earlier tonight or a caught yōkai).',
  },
  {
    id: 'pon.award.ippon-king',
    host: 'pon',
    name: { text: 'イッポン チャンピオン', kana: 'イッポン チャンピオン', en: 'IPPON Champion' },
    criterion: 'Most IPPONs this game (ties: most total votes on IPPON answers).',
  },
  {
    id: 'pon.award.cushion-tower',
    host: 'pon',
    name: { text: 'ざぶとん タワー', kana: 'ざぶとん タワー', en: 'Cushion Tower' },
    criterion: 'Most cushions at the end of the game (the winner).',
  },

  // Fude (Kana Yōkai Raid)
  {
    id: 'fude.award.exorcist',
    host: 'fude',
    name: { text: 'おはらい マスター', kana: 'おはらい マスター', en: 'Exorcist' },
    criterion: 'Cleared the most haunted yōkai (kana due for review) this raid.',
  },
  {
    id: 'fude.award.combo-champion',
    host: 'fude',
    name: { text: 'コンボ チャンピオン', kana: 'コンボ チャンピオン', en: 'Combo Champion' },
    criterion: 'Took part in the longest team combo, or the most combo hits.',
  },
  {
    id: 'fude.award.page-hunter',
    host: 'fude',
    name: { text: 'ページ ハンター', kana: 'ページ ハンター', en: 'Page Hunter' },
    criterion: 'Caught the most new kana yōkai for the yōkai book.',
  },
  {
    id: 'fude.award.boss-breaker',
    host: 'fude',
    name: { text: 'ボス ブレイカー', kana: 'ボス ブレイカー', en: 'Boss Breaker' },
    criterion: 'Broke the most pieces of the boss word.',
  },
  {
    id: 'fude.award.battle-cry',
    host: 'fude',
    name: { text: 'おおごえしょう', kana: 'おおごえしょう', en: 'Battle Cry' },
    criterion: 'Most Shout attacks attempted (attempts, not accuracy).',
  },

  // Chōchin-san (Last Train)
  {
    id: 'chochin.award.first-aboard',
    host: 'chochin',
    name: { text: 'いちばんのり', kana: 'いちばんのり', en: 'First Aboard' },
    criterion: 'Won the Platform Dash (first aboard the last train).',
  },
  {
    id: 'chochin.award.last-aboard',
    host: 'chochin',
    name: { text: 'さいごの ごじょうしゃ', kana: 'さいごの ごじょうしゃ', en: 'Last One Aboard' },
    criterion: 'Made it aboard in the Platform Dash after everyone else, but made it.',
  },
  {
    id: 'chochin.award.best-ghost',
    host: 'chochin',
    name: { text: 'ベスト ゆうれい', kana: 'ベスト ゆうれい', en: 'Best Ghost' },
    criterion: 'The ghost who answered the most questions correctly after being knocked out.',
  },
  {
    id: 'chochin.award.welcome-back',
    host: 'chochin',
    name: { text: 'おかえりなさいしょう', kana: 'おかえりなさいしょう', en: 'Welcome Back' },
    criterion: 'Revived from ghost to passenger (ties: the latest revival).',
  },
  {
    id: 'chochin.award.no-miss',
    host: 'chochin',
    name: { text: 'ノーミス じょうきゃく', kana: 'ノーミス じょうきゃく', en: 'Perfect Passenger' },
    criterion: 'Cleared every stop without a miss.',
  },
];
