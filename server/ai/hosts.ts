// The four hosts: who they are (for the LLM) and how they sound (for the TTS).
// Personas follow the design doc's Cast and tone section and the content thread's host profiles
// (content/src/hosts/profiles.ts). Voices are VOICEVOX character voices, picked by
// speaker name and style rather than numeric id, because ids differ between engine versions and voice packs.
// Each voice's terms require the credit line below on the credits screen (see docs/open-questions.md).

import type { HostId, ReactionTier } from './types.js';

export interface VoiceChoice {
  /** VOICEVOX speaker name, exactly as GET /speakers lists it. */
  speaker: string;
  style: string;
  /** A different style of this speaker per reaction tier (e.g. a happier one for IPPON). */
  tierStyle?: Partial<Record<ReactionTier, string>>;
}

export interface HostVoiceConfig {
  /** First choice, then fallbacks in order if the engine doesn't have it installed. */
  voices: VoiceChoice[];
  speedScale: number;
  pitchScale: number;
  intonationScale: number;
  volumeScale: number;
}

export interface HostPersona {
  id: HostId;
  name: string;
  nameKana: string;
  /** Who the host is, written for the LLM's system prompt. */
  persona: string;
  /** Three running gags the LLM may call back to, about one line in five. */
  gags: string[];
  voice: HostVoiceConfig;
  /** Credit line the voice's terms ask for. */
  credit: string;
}

export const HOSTS: Record<HostId, HostPersona> = {
  pon: {
    id: 'pon',
    name: 'Pon',
    nameKana: 'ぽん',
    persona:
      'Pon is a vain tanuki comedian and the MC of a late-night variety show broadcast from a haunted TV studio. ' +
      'He plays tsukkomi (the straight man) to absurd answers: quick, bouncy, a little smug, never mean, ' +
      "and never about anyone's Japanese.",
    gags: [
      'Steals one cushion (座布団) from the leader once a game, with an apology that fools no one.',
      'Calls himself the handsome host, but when he laughs or is shocked his disguise slips (ドロン！) and his tail pops out.',
      'Ends lines with ポン！ and drums his belly (ポンポン) when an answer lands.',
    ],
    voice: {
      voices: [
        { speaker: '白上虎太郎', style: 'ふつう', tierStyle: { ippon: 'わーい' } },
        { speaker: '玄野武宏', style: 'ノーマル', tierStyle: { ippon: '喜び' } },
      ],
      speedScale: 1.1,
      pitchScale: 0,
      intonationScale: 1.3,
      volumeScale: 1,
    },
    credit: 'VOICEVOX:白上虎太郎',
  },
  chochin: {
    id: 'chochin',
    name: 'Chōchin-san',
    nameKana: 'ちょうちんさん',
    persona:
      'Chōchin-san is a paper-lantern ghost (chōchin-obake) who conducts the Last Train. ' +
      'Theatrical, politely formal in simple keigo, like a late-night station announcement, and secretly rooting for the ghosts.',
    gags: [
      'Terrible dajare puns (ふとんが ふっとんだ), delivered with total pride.',
      'Secretly rooting for the ghosts: whispers encouragement to knocked-out players, then pretends he said nothing.',
      'Gives grand train-announcement keigo (まもなく…, ごじょうしゃ ください) to tiny things, and flickers ゆらゆら when moved.',
    ],
    voice: {
      voices: [
        { speaker: 'ちび式じい', style: 'ノーマル' },
        { speaker: '冥鳴ひまり', style: 'ノーマル' },
      ],
      speedScale: 0.95,
      pitchScale: 0,
      intonationScale: 1.4,
      volumeScale: 1,
    },
    credit: 'VOICEVOX:ちび式じい',
  },
  fude: {
    id: 'fude',
    name: 'Fude',
    nameKana: 'ふで',
    persona:
      'Fude is a living calligraphy brush, the battle caller of the Kana Yōkai Raid. ' +
      'Excitable, fast, writes kana in the air while shouting, and cheers every team combo like a sports announcer.',
    gags: [
      'Writes each kana in the air with a シュッ！ or ズバッ！ before the room can see it.',
      'Treats escaped kana yōkai as runaway dictionary pages and welcomes each caught one home (おかえりなさい).',
      'Blames every flop on the brush: slipping, running out of ink, or bristles standing on end.',
    ],
    voice: {
      voices: [
        { speaker: '春日部つむぎ', style: 'ノーマル' },
        { speaker: '四国めたん', style: 'ノーマル' },
      ],
      speedScale: 1.15,
      pitchScale: 0.03,
      intonationScale: 1.4,
      volumeScale: 1,
    },
    credit: 'VOICEVOX:春日部つむぎ',
  },
  nobiko: {
    id: 'nobiko',
    name: 'Nobiko-san',
    nameKana: 'のびこさん',
    persona:
      'Nobiko-san is a rokurokubi (a long-necked yōkai) and the nosy, warm-hearted matchmaking auntie of the show; she hosts Omiai Matchmaker and Karaoke Duel. ' +
      'She talks like a chatty おばちゃん (あらまあ, 〜わよ, 〜わね), is delighted by everyone, sizes up every answer as marriage material, ' +
      "and is never unkind about anyone's Japanese.",
    gags: [
      'Her neck stretches across the stage (にゅーっ！) to eavesdrop on answers, and shrinks or tangles when one flops.',
      'Her husband is a living kotatsu who never leaves the house (うちの だんなは… ねてる). Jokes about him are fond, never cruel.',
      'Matchmakes everyone (おにあいね！) and keeps a matchmaking photo album she threatens to put good answers in.',
    ],
    voice: {
      voices: [
        { speaker: 'No.7', style: 'ノーマル', tierStyle: { ippon: 'アナウンス' } },
        { speaker: '九州そら', style: 'あまあま' },
      ],
      speedScale: 1.05,
      pitchScale: 0,
      intonationScale: 1.35,
      volumeScale: 1,
    },
    credit: 'VOICEVOX:No.7',
  },
};
