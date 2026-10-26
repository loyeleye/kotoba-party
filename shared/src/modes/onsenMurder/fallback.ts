// PLACEHOLDER case for Murder at the Onsen, used only when the content library has no cases
// (tests, a broken content build). The real cases live in content/src/onsen. Keep it tiny.

import type { JpText, OnsenCase } from '../../../../content/src/types.js';

const k = (text: string, en: string): JpText => ({ text, kana: text, en });

export const FALLBACK_CASE: OnsenCase = {
  id: 'fallback',
  status: 'draft',
  title: k('タオル じけん', 'The Towel Case'),
  setting: k('りょかんの よる。', 'Night at the inn.'),
  victim: { name: k('タオルさん', 'Mr. Towel'), emoji: '🧺', found: k('おふろで びしょびしょでした。', 'He was found soaking wet in the bath.') },
  item: { name: k('くつ', 'shoe'), emoji: '👟', keys: ['くつ'] },
  culpritId: 'b',
  suspects: [
    {
      id: 'a',
      name: k('あおき', 'Aoki'),
      role: k('おきゃくさん', 'a guest'),
      emoji: '🧑',
      voice: { pitch: 1, rate: 1 },
      persona: 'A calm guest.',
      answers: {
        where: { jp: k('へやに いました。', 'I was in my room.') },
        who: { jp: k('いけださんを みました。 おふろに いきました。', 'I saw Ikeda. He went to the bath.'), clueId: 'b-bath' },
      },
    },
    {
      id: 'b',
      name: k('いけだ', 'Ikeda'),
      role: k('おきゃくさん', 'a guest'),
      emoji: '🧔',
      voice: { pitch: 0.8, rate: 0.9 },
      persona: 'A nervous guest.',
      answers: {
        where: { jp: k('ずっと へやに いました。', 'I was in my room the whole time.'), clueId: 'b-room' },
        item: { jp: k('わたしの くつです。', "It's my shoe."), clueId: 'shoe' },
      },
    },
    {
      id: 'c',
      name: k('うえの', 'Ueno'),
      role: k('りょかんの ひと', 'inn staff'),
      emoji: '👩',
      voice: { pitch: 1.3, rate: 1 },
      persona: 'A busy staff member.',
      answers: {
        where: { jp: k('ロビーに いました。', 'I was in the lobby.') },
        item: { jp: k('その くつは おふろに ありました。', 'That shoe was in the bath.'), clueId: 'shoe-bath' },
      },
    },
  ],
  clues: [
    { id: 'b-bath', jp: k('いけださんは おふろに いった。', 'Ikeda went to the bath.'), key: true },
    { id: 'b-room', jp: k('いけださん：「ずっと へやに いました」', 'Ikeda: "I was in my room the whole time."'), key: true },
    { id: 'shoe', jp: k('くつは いけださんの。', "The shoe is Ikeda's."), key: true },
    { id: 'shoe-bath', jp: k('くつは おふろに あった。', 'The shoe was in the bath.') },
  ],
  confession: [k('はい、わたしです。 ごめんなさい！', 'Yes, it was me. Sorry!')],
  solution: 'Ikeda said he stayed in his room, but Aoki saw him go to the bath, and his shoe was there. (Placeholder case: no content loaded.)',
  shrug: k('すみません、わかりません。', "Sorry, I don't know."),
};
