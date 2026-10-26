// Hidden pictures: emoji scenes behind the board. Each cleared card uncovers one clue
// tile of the scene; players buzz in to guess what the whole scene is (4 choices).
// The view only ever carries the tiles already uncovered, so nothing leaks early.
// Draft content: a fluent check should confirm the Japanese names.

import type { JpText } from '../../../../content/src/types.js';

export interface Scene {
  id: string;
  name: JpText;
  /** Clue tiles. The board repeats them to fill every cell. */
  clues: string[];
}

export const SCENES: readonly Scene[] = [
  { id: 'matsuri', name: { text: 'なつまつり', kana: 'なつまつり', en: 'a summer festival' }, clues: ['🏮', '🎆', '👘', '🍧', '🎐', '🥁', '🍢', '🎇', '🐟'] },
  { id: 'shougatsu', name: { text: 'お正月', kana: 'おしょうがつ', en: 'New Year' }, clues: ['🎍', '🌅', '⛩️', '🍡', '🎴', '🍶', '🐉', '🪁', '🍊'] },
  { id: 'hanami', name: { text: 'お花見', kana: 'おはなみ', en: 'cherry-blossom viewing' }, clues: ['🌸', '🍡', '🍱', '🧺', '🍶', '🌳', '📸', '🎶', '☀️'] },
  { id: 'umi', name: { text: '海', kana: 'うみ', en: 'the beach' }, clues: ['🌊', '🏖️', '🐚', '🦀', '🐠', '⛱️', '🍉', '☀️', '🩴'] },
  { id: 'fuyu', name: { text: 'ゆきの日', kana: 'ゆきのひ', en: 'a snow day' }, clues: ['⛄', '❄️', '🧤', '🧣', '🛷', '🏔️', '🍲', '☃️', '🌨️'] },
  { id: 'gakkou', name: { text: '学校', kana: 'がっこう', en: 'school' }, clues: ['🏫', '🎒', '✏️', '📚', '🔔', '📝', '🍱', '⏰', '🧑‍🏫'] },
  { id: 'onsen', name: { text: '温泉', kana: 'おんせん', en: 'a hot spring' }, clues: ['♨️', '🐒', '🏔️', '🧖', '🌙', '🍶', '🧴', '👘', '🪵'] },
  { id: 'eki', name: { text: '駅', kana: 'えき', en: 'a train station' }, clues: ['🚉', '🚃', '🎫', '🕐', '🧳', '🍱', '🚄', '🛤️', '📢'] },
  { id: 'tanjoubi', name: { text: 'たんじょうび', kana: 'たんじょうび', en: 'a birthday party' }, clues: ['🎂', '🎁', '🎈', '🎉', '🕯️', '🎊', '🍰', '🥳', '🎵'] },
  { id: 'doubutsuen', name: { text: 'どうぶつえん', kana: 'どうぶつえん', en: 'the zoo' }, clues: ['🦁', '🐼', '🐘', '🦒', '🐒', '🐧', '🦓', '🎟️', '🌳'] },
  { id: 'kyanpu', name: { text: 'キャンプ', kana: 'キャンプ', en: 'camping' }, clues: ['⛺', '🔥', '🌲', '🎒', '🌙', '🔦', '🍢', '🏕️', '⭐'] },
  { id: 'ramenya', name: { text: 'ラーメンや', kana: 'ラーメンや', en: 'a ramen shop' }, clues: ['🍜', '🥢', '🏮', '🥚', '🍥', '🧑‍🍳', '🍺', '🎏', '💴'] },
];
