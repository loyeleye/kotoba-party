// Set-phrase tiles for Oogiri Night round 2 (Photo Caption). The player drops
// a word tile (or a verb in the asked form) into the frame's blank.

import type { SetPhraseTile } from '../types.js';

export const setPhraseTiles: SetPhraseTile[] = [
  {
    id: 'kudasai-noun',
    frame: { text: '＿＿＿をください！', kana: '＿＿＿をください！', en: '___, please!' },
    level: 'kana',
    slot: 'noun',
    pattern: 'N をください: asking for a thing.',
  },
  {
    id: 'tai',
    frame: { text: '＿＿＿たい！', kana: '＿＿＿たい！', en: 'I want to ___!' },
    level: 'n5',
    slot: 'verb-stem',
    pattern: 'Verb stem + たい: "want to". たべます → たべたい.',
  },
  {
    id: 'te-kudasai',
    frame: { text: '＿＿＿ください！', kana: '＿＿＿ください！', en: 'Please ___!' },
    level: 'n5',
    slot: 'verb-te',
    pattern: 'Verb て-form + ください: asking someone to do something.',
  },
  {
    id: 'ga-suki',
    frame: { text: '＿＿＿が大好きです！', kana: '＿＿＿がだいすきです！', en: 'I love ___!', furigana: [['＿＿＿が', ''], ['大好', 'だいす'], ['きです！', '']] },
    level: 'n5',
    slot: 'noun',
    pattern: 'N が すき: the thing you like takes が.',
  },
  {
    id: 'wa-doko',
    frame: { text: '＿＿＿はどこですか？', kana: '＿＿＿はどこですか？', en: 'Where is ___?' },
    level: 'n5',
    slot: 'noun',
    pattern: 'N は どこですか: asking where something is.',
  },
  {
    id: 'mou-iya',
    frame: { text: 'もう＿＿＿はいやだ！', kana: 'もう＿＿＿はいやだ！', en: 'No more ___!' },
    level: 'n5',
    slot: 'noun',
    pattern: 'もう N は いやだ: casual "I’ve had enough of N".',
  },
  {
    id: 'mashou',
    frame: { text: 'いっしょに＿＿＿ましょう！', kana: 'いっしょに＿＿＿ましょう！', en: 'Let’s ___ together!' },
    level: 'n5',
    slot: 'verb-stem',
    pattern: 'Verb stem + ましょう: "let’s".',
  },
  {
    id: 'te-mo-ii',
    frame: { text: '＿＿＿もいいですか？', kana: '＿＿＿もいいですか？', en: 'May I ___?' },
    level: 'n5',
    slot: 'verb-te',
    pattern: 'Verb て-form + もいいですか: asking permission.',
  },
];
