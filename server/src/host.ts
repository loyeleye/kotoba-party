// Turns host cues from the game rules into lines on the stage.
//
// The default director picks a written line from the content's line bank (no network, no
// wait). The host voice thread's LLM + TTS pipeline plugs in through the same HostVoice
// interface: it gets the cue as the phase starts and answers when its line is ready.
// Lines arrive through room.say(), which drops any line whose phase has already passed,
// so a slow voice can never show a stale line or hold up a round.

import type { HostLine } from '../../content/src/types.js';
import type { ContentLibrary, HostCue } from '../../shared/src/modes/mode.js';
import type { HostSay } from '../../shared/src/protocol.js';
import type { Room } from './room.js';

export interface HostVoice {
  /** Returns the line for a cue, or null to stay quiet. May be slow; may fail. */
  speak(roomCode: string, cue: HostCue): Promise<Omit<HostSay, 'phaseSeq'> | null>;
}

/** Fills {slot} placeholders. */
function fill(text: string, slots: Record<string, string> | undefined): string {
  return text.replace(/\{(\w+)\}/g, (m, key: string) => slots?.[key] ?? m);
}

/** Picks a fluent-checked (or, until packs are checked, any) bank line for the cue. */
export function bankVoice(content: ContentLibrary, random: () => number = Math.random): HostVoice {
  return {
    async speak(_room, cue) {
      const candidates = content.hostLines.filter(
        (l: HostLine) => l.host === cue.host && l.event === cue.event && (!cue.tier || !l.tier || l.tier === cue.tier),
      );
      // A line with slots we can't fill would show a raw {name}; skip those.
      const usable = candidates.filter((l) => (l.slots ?? []).every((s) => cue.slots?.[s.replace(/[{}]/g, '')] !== undefined));
      const line = usable[Math.floor(random() * usable.length)];
      if (!line) return null;
      return {
        host: cue.host,
        text: fill(line.jp.text, cue.slots),
        kana: fill(line.jp.kana, cue.slots),
        en: fill(line.jp.en, cue.slots),
      };
    },
  };
}

/** Wires a voice to a room: each cue is spoken and lands only if its phase is still current. */
export function hostDirector(voice: HostVoice) {
  return (room: Room, cues: HostCue[], phaseSeq: number): void => {
    // One line per phase: the last cue raised is the most specific.
    const cue = cues.at(-1);
    if (!cue) return;
    voice
      .speak(room.code, cue)
      .then((line) => line && room.say({ ...line, phaseSeq }))
      .catch(() => {
        // The host just stays quiet this phase.
      });
  };
}
