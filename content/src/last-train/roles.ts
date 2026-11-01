// Last Train hard roles (N4): harder scripts inside stops the whole room already plays. One N4 player a
// stop is offered one, in turn, and may say "not this time" (docs/modes/last-train.md, Hard roles).

import type { HardRole } from '../types.js';

export const ANNOUNCER: HardRole = {
  id: 'announcer',
  name: { text: 'アナウンス係', kana: 'アナウンスがかり', en: 'The announcer', furigana: [['アナウンス', ''], ['係', 'がかり']] },
  pitch: 'Chōchin-san lends you his megaphone: make the platform announcement, in station keigo.',
};

export const PASSENGER: HardRole = {
  id: 'passenger',
  name: { text: '忘れ物をした客', kana: 'わすれものをしたきゃく', en: 'The forgetful passenger', furigana: [['忘', 'わす'], ['れ', ''], ['物', 'もの'], ['をした', ''], ['客', 'きゃく']] },
  pitch: 'You lost something, and you are not sure where. Say where it might be.',
};

export const STAFF: HardRole = {
  id: 'lost-property-staff',
  name: { text: '忘れ物係', kana: 'わすれものがかり', en: 'Lost property staff', furigana: [['忘', 'わす'], ['れ', ''], ['物', 'もの'], ['係', 'がかり']] },
  pitch: 'You run the lost property counter. Check the thing by how it looks.',
};

export const GUEST: HardRole = {
  id: 'front-desk-guest',
  name: { text: 'フロントのお客さま', kana: 'フロントのおきゃくさま', en: 'The guest at the front desk', furigana: [['フロントのお', ''], ['客', 'きゃく'], ['さま', '']] },
  pitch: 'Ask the inn for favours, politely, and read the inn’s signs.',
};
