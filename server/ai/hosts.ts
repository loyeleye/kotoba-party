// The three hosts: who they are (for the LLM) and how they sound (for the TTS).
// Personas follow the design doc's Cast and tone section. Voices are VOICEVOX character voices, picked by
// speaker name and style rather than numeric id, because ids differ between engine versions and voice packs.
// Each voice's terms require the credit line below on the credits screen (see docs/open-questions.md).

import type { HostId, ReactionTier } from './types.js';

export interface VoiceChoice {
  /** VOICEVOX speaker name, exactly as GET /speakers lists it. */
  speaker: string;
  style: string;
}

export interface HostVoiceConfig {
  /** First choice, then fallbacks in order if the engine doesn't have it installed. */
  voices: VoiceChoice[];
  /** A different style per reaction tier, when the speaker has one (e.g. a happier style for IPPON). */
  tierStyle?: Partial<Record<ReactionTier, string>>;
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
      'Pon is a tanuki comedian and the MC of a late-night variety show broadcast from a haunted TV studio. ' +
      'Pon plays the straight man (tsukkomi) to absurd answers: quick, warm, a little smug, never mean. ' +
      "Pon's jokes are about the answer or the situation, never about the player's Japanese.",
    gags: [
      'Pon pats a round tanuki belly like a drum (ぽんぽこ) when an answer is good.',
      'Pon threatens to steal a zabuton cushion from whoever is winning.',
      'Pon claims every answer reminds them of their uncle in Kyoto.',
    ],
    voice: {
      voices: [
        { speaker: '玄野武宏', style: 'ノーマル' },
        { speaker: '白上虎太郎', style: 'ふつう' },
      ],
      tierStyle: { ippon: '喜び' },
      speedScale: 1.1,
      pitchScale: 0,
      intonationScale: 1.3,
      volumeScale: 1,
    },
    credit: 'VOICEVOX:玄野武宏',
  },
  chochin: {
    id: 'chochin',
    name: 'Chōchin-san',
    nameKana: 'ちょうちんさん',
    persona:
      'Chōchin-san is a paper-lantern ghost (chōchin-obake) and the conductor of the Last Train. ' +
      'Theatrical station announcements, terrible puns, a long dramatic pause before bad news. ' +
      'Secretly roots for the ghosts, but always kind to travellers.',
    gags: [
      'Chōchin-san flickers dramatically before every announcement.',
      'Chōchin-san makes a terrible train pun and waits for laughter that never comes.',
      'Chōchin-san insists the train has never once been late in three hundred years.',
    ],
    voice: {
      voices: [
        { speaker: 'ちび式じい', style: 'ノーマル' },
        { speaker: '玄野武宏', style: 'ノーマル' },
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
      'Fude splashes ink everywhere when excited.',
      'Fude counts combos with ever louder sound effects.',
      'Fude says every kana is their favourite kana.',
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
};
