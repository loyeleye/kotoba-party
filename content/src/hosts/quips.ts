// Host asides for the phone's dead air: waiting for the others, and reconnecting.
//
// Kana-only so kana-level players can read them, like the host bank. Shown as text on the phone
// (never voiced), so they carry no ids or slots. Every line is draft until a fluent check.

import type { HostId, JpText } from '../types.js';

/** One is shown under "Waiting for the others…" in the mode's host's voice. */
export const waitQuips: Record<HostId, JpText[]> = {
  pon: [
    { text: 'まって います… ポンポン。', kana: 'まって います… ポンポン。', en: 'Waiting… pon-pon. (belly drum)' },
    { text: 'ポンは ねて いません。 ほんとうです。', kana: 'ポンは ねて いません。 ほんとうです。', en: "Pon is not asleep. Really." },
    { text: 'ざぶとんを かぞえて います。 いち、に…', kana: 'ざぶとんを かぞえて います。 いち、に…', en: 'Counting cushions. One, two…' },
    { text: 'ポンの しっぽ、でて いませんよね？', kana: 'ポンの しっぽ、でて いませんよね？', en: "Pon's tail isn't showing, is it?" },
  ],
  chochin: [
    { text: 'つぎの でんしゃを まって います。 ゆらゆら。', kana: 'つぎの でんしゃを まって います。 ゆらゆら。', en: 'Waiting for the next train. Flicker.' },
    { text: 'ゆうれいは まつのが とくいです。', kana: 'ゆうれいは まつのが とくいです。', en: 'Ghosts are very good at waiting.' },
    { text: 'しばらく おまちください。 ろうそくを かえて います。', kana: 'しばらく おまちください。 ろうそくを かえて います。', en: 'One moment, please. Changing my candle.' },
  ],
  fude: [
    { text: 'すみを すって います…', kana: 'すみを すって います…', en: 'Grinding ink…' },
    { text: 'フデは けを とかして います。', kana: 'フデは けを とかして います。', en: 'Fude is combing its bristles.' },
    { text: 'シュッ… シュッ… まだかな？', kana: 'シュッ… シュッ… まだかな？', en: 'Swish… swish… not yet?' },
  ],
  nobiko: [
    { text: 'くびを ながく して まって います…', kana: 'くびを ながく して まって います…', en: 'Waiting with my neck stretched out…' },
    { text: 'おちゃを いれて います。', kana: 'おちゃを いれて います。', en: 'Pouring the tea.' },
    { text: 'だんなは まだ こたつで ねて います。', kana: 'だんなは まだ こたつで ねて います。', en: 'My husband is still asleep in the kotatsu.' },
  ],
};

/** The reconnect banner, in the host's voice. The English says the seat is safe. */
export const reconnectQuips: Record<HostId, JpText> = {
  pon: { text: 'ドロン！ ポンが さがして います！', kana: 'ドロン！ ポンが さがして います！', en: 'Poof! Pon is looking for you. Reconnecting, your seat is saved.' },
  chochin: { text: 'ゆうれいに なりかけて います…', kana: 'ゆうれいに なりかけて います…', en: "You're turning into a ghost… Reconnecting, your seat is saved." },
  fude: { text: 'すみが きれました！', kana: 'すみが きれました！', en: 'Out of ink! Reconnecting, your seat is saved.' },
  nobiko: { text: 'にゅーっ！ くびを のばして さがして います！', kana: 'にゅーっ！ くびを のばして さがして います！', en: 'Stretching my neck to find you! Reconnecting, your seat is saved.' },
};

/** Under "Waiting for the VIP to pick a game" in the lobby (Pon hosts the lobby). */
export const vipIdleQuip: JpText = {
  text: 'VIPさん、えらんで ください。 ポンの おなかが なって います。',
  kana: 'ブイアイピーさん、えらんで ください。 ポンの おなかが なって います。',
  en: "VIP, please pick. Pon's belly is rumbling.",
};
