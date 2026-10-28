// The show's cast: one host per segment (see the GDD, "Cast and tone").
//
// Voice notes are casting hints for a VOICEVOX-style character voice engine.
// The named speakers are candidates to audition, not decisions: each one's
// terms of use and credit line must be checked before we ship audio.

import type { HostProfile } from '../types.js';

export const hostProfiles: HostProfile[] = [
  {
    id: 'pon',
    name: { text: 'ポン', kana: 'ポン', en: 'Pon' },
    role:
      'A vain tanuki comedian and the MC of the show. Plays tsukkomi (the straight man) to the absurd answers, never to anyone’s Japanese.',
    segments: ['Oogiri Night', 'Word Gauntlet'],
    voice:
      'Bright, mid-high male comic voice; quick, bouncy pace with big pauses before reveals. ' +
      'Snappy and loud on tsukkomi lines, warm and slower on miss_kind and retry_clue. ' +
      'The "ポン！" tag is a short, punchy pop. Audition: 白上虎太郎 (energetic), 玄野武宏 (fallback).',
    runningGags: [
      'Steals one cushion (座布団) from the leader once a game, Shōten-style, with an apology that fools no one.',
      'Vain shapeshifter: calls himself the handsome host, but when he laughs or is shocked, his disguise slips ("ドロン！") and his tail pops out.',
      'Ends lines with "ポン！" and drums his belly ("ポンポン") when an answer lands.',
    ],
  },
  {
    id: 'chochin',
    name: { text: 'ちょうちんさん', kana: 'ちょうちんさん', en: 'Chōchin-san' },
    role:
      'A paper-lantern ghost (chōchin-obake) who conducts the Last Train. Theatrical, politely formal in simple keigo, and secretly rooting for the ghosts.',
    segments: ['Last Train'],
    voice:
      'Low-to-mid, slightly breathy voice with a theatrical, slow pace, like a late-night station announcement. ' +
      'Rises into dramatic emphasis on "まもなく" and drops to a whisper for secrets. "ゆらゆら" is sung softly, with a flicker. ' +
      'Audition: 青山龍星 (deep, dramatic), 冥鳴ひまり (calm, eerie) as an alternative casting.',
    runningGags: [
      'Terrible dajare puns (ふとんが ふっとんだ, いかがですか？　いかです！), delivered with total pride.',
      'Secretly rooting for the ghosts: whispers encouragement to knocked-out players, then pretends he said nothing.',
      'Gives grand, train-announcement keigo ("まもなく…", "ごじょうしゃ ください") to tiny things, and flickers "ゆらゆら" when moved.',
    ],
  },
  {
    id: 'fude',
    name: { text: 'フデ', kana: 'フデ', en: 'Fude' },
    role:
      'A living calligraphy brush (tsukumogami) and the battle caller of the Kana Yōkai Raid. Calls every round like an excitable sports announcer.',
    segments: ['Kana Yōkai Raid', 'Kotoba Concentration'],
    voice:
      'High, fast, sporty voice with big energy and crisp consonants; shouts are short so the room can shout back. ' +
      'Sound effects "シュッ！" (swish) and "ズバッ！" (slash) are sharp and percussive. ' +
      'Audition: 春日部つむぎ (bright), ずんだもん (comic) as an alternative casting.',
    runningGags: [
      'Writes each kana in the air with a "シュッ！" or "ズバッ！" before the room can see it.',
      'Treats escaped kana yōkai as runaway dictionary pages and welcomes each caught one home ("おかえりなさい").',
      'Blames every flop on the brush: slipping, running out of ink, or bristles standing on end when the team combos.',
    ],
  },
  {
    id: 'nobiko',
    name: { text: 'のびこさん', kana: 'のびこさん', en: 'Nobiko-san' },
    role:
      'A rokurokubi (long-necked yōkai) and the nosy matchmaking auntie (お見合いおばさん) of the show. Warm, gossipy and delighted by everyone; sizes up every answer as marriage material, never anyone’s Japanese.',
    segments: ['Omiai Matchmaker', 'Karaoke Duel'],
    voice:
      'Warm, mature female voice with a chatty おばちゃん lilt; quick when gossiping, slow and fond on praise. ' +
      '"あらまあ" rises in delight, "にゅーっ" (her neck stretching) is drawn out and sing-song. ' +
      'Audition: No.7 (アナウンス for intros, 読み聞かせ for kind lines), 九州そら (あまあま) as an alternative casting.',
    runningGags: [
      'Her neck stretches across the stage (にゅーっ！) to eavesdrop on answers, and shrinks or tangles when one flops.',
      'Her husband is a living kotatsu who hasn’t come out since 1987 (うちの だんなは… ねてる); in Cheeky he is the butt of useless-husband jokes and tiny おこづかい.',
      'Matchmakes everyone and everything ("おにあいね！"), and keeps a matchmaking photo album she threatens to put good answers in.',
    ],
  },
];
