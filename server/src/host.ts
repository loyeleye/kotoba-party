// Turns host cues from the game rules into lines on the stage.
//
// The default director picks a written line from the content's line bank (no network, no
// wait). The host voice thread's LLM + TTS pipeline plugs in through the same HostVoice
// interface: it gets the cue as the phase starts and answers when its line is ready.
// Lines arrive through room.say(), which drops any line whose phase has already passed,
// so a slow voice can never show a stale line or hold up a round.

import type { HostLine, Level } from '../../content/src/types.js';
import { HOST_EVENTS, type HostEvent as AiEvent, type HostVoice as AiHostVoice, type PendingLine } from '../ai/index.js';
import type { ContentLibrary, HostCue } from '../../shared/src/modes/mode.js';
import type { HostMood, HostSay } from '../../shared/src/protocol.js';
import type { Room } from './room.js';

export interface HostVoice {
  /** Returns the line for a cue, or null to stay quiet. May be slow; may fail. */
  speak(roomCode: string, cue: HostCue): Promise<Omit<HostSay, 'phaseSeq'> | null>;
  /** A cue the game expects to raise soon (cue.ahead): start on its line now. Optional; nothing is said. */
  ahead?(roomCode: string, cue: HostCue): void;
}

/** Fills {slot} placeholders. A `{key}_kana` or `{key}_en` slot, when given, fills that field instead of `{key}`. */
function fill(text: string, slots: Record<string, string> | undefined, field: 'text' | 'kana' | 'en' = 'text'): string {
  return text.replace(/\{(\w+)\}/g, (m, key: string) => (field !== 'text' ? slots?.[`${key}_${field}`] : undefined) ?? slots?.[key] ?? m);
}

/** When a cue names the answer ({tile}), the lines that react to it beat the ones that could follow anything. */
export function preferAnswerLines<T extends { slots?: string[] }>(lines: T[], slots: Record<string, unknown> | undefined): T[] {
  if (slots?.tile === undefined) return lines;
  const named = lines.filter((l) => (l.slots ?? []).some((s) => s.replace(/[{}]/g, '') === 'tile'));
  return named.length ? named : lines;
}

/** Picks a fluent-checked (or, until packs are checked, any) bank line for the cue. */
export function bankVoice(content: ContentLibrary, random: () => number = Math.random): HostVoice {
  return {
    async speak(_room, cue) {
      const candidates = content.hostLines.filter(
        (l: HostLine) => l.host === cue.host && l.event === cue.event && (!cue.tier || !l.tier || l.tier === cue.tier),
      );
      // A line with slots we can't fill would show a raw {name}; skip those.
      const usable = preferAnswerLines(
        candidates.filter((l) => (l.slots ?? []).every((s) => cue.slots?.[s.replace(/[{}]/g, '')] !== undefined)),
        cue.slots,
      );
      const line = usable[Math.floor(random() * usable.length)];
      if (!line) return null;
      return {
        host: cue.host,
        text: fill(line.jp.text, cue.slots),
        kana: fill(line.jp.kana, cue.slots, 'kana'),
        en: fill(line.jp.en, cue.slots, 'en'),
      };
    },
  };
}

const CHEER = new Set(['ippon', 'encore_cheer', 'raid_combo', 'raid_catch', 'train_revive', 'vote_landslide', 'kakegoe_call', 'recap_award', 'mic_check_ok']);
const OOPS = new Set(['miss_kind', 'raid_escape', 'train_ghost', 'fooled', 'vote_zero', 'room_overrule', 'answer_hurry']);

/** The host's reaction to a cue: a cheer for a win, a flinch for a miss, otherwise just the idle loop. */
export function moodFor(event: string): HostMood | undefined {
  return CHEER.has(event) ? 'cheer' : OOPS.has(event) ? 'oops' : undefined;
}

/** Wires a voice to a room: each cue is spoken and lands only if its phase is still current. */
export function hostDirector(voice: HostVoice) {
  return (room: Room, cues: HostCue[], phaseSeq: number): void => {
    for (const c of cues) if (c.ahead) voice.ahead?.(room.code, c);
    // One line per phase: the last cue raised is the most specific.
    const cue = cues.filter((c) => !c.ahead).at(-1);
    if (!cue) return;
    voice
      .speak(room.code, cue)
      .then((line) => line && room.say({ ...line, mood: line.mood ?? moodFor(cue.event), phaseSeq }))
      .catch(() => {
        // The host just stays quiet this phase.
      });
  };
}

/** Lines started early and not yet asked for, per room. A few rounds' worth; the oldest go first. */
const AHEAD_MAX = 12;

const cueKey = (c: HostCue): string =>
  JSON.stringify([c.host, c.event, c.tier ?? '', c.prompt?.text ?? '', c.answer ?? '', c.answerEn ?? '', c.slots ?? {}]);

/**
 * The host voice thread's LLM + TTS pipeline (server/ai) behind the HostVoice interface.
 * Events the pipeline doesn't know fall back to the plain bank voice. A line is awaited for
 * at most `waitMs`; the pipeline itself falls back to a voiced bank line when the LLM is slow.
 * An LLM line takes longer than that (2 to 6 s on Opus), so cues sent ahead start the line early
 * and the real cue picks it up.
 */
export function aiVoice(
  voice: AiHostVoice,
  fallback: HostVoice,
  opts: { waitMs?: number; levelOf?: (roomCode: string) => Level } = {},
): HostVoice {
  const known = new Set<string>(HOST_EVENTS);
  const early = new Map<string, Map<string, PendingLine>>();

  const prepare = (roomCode: string, cue: HostCue): PendingLine =>
    voice.prepare(roomCode, {
      host: cue.host,
      event: cue.event as AiEvent,
      tier: cue.tier,
      prompt: cue.prompt,
      answer: cue.answer,
      answerEn: cue.answerEn,
      slots: cue.slots,
      level: opts.levelOf?.(roomCode),
    });

  return {
    ahead(roomCode, cue) {
      if (!known.has(cue.event)) return;
      let room = early.get(roomCode);
      if (!room) early.set(roomCode, (room = new Map()));
      const key = cueKey(cue);
      if (room.has(key)) return;
      room.set(key, prepare(roomCode, cue));
      for (const [k, p] of room) {
        if (room.size <= AHEAD_MAX) break;
        p.cancel();
        room.delete(k);
      }
    },
    async speak(roomCode, cue) {
      if (!known.has(cue.event)) return fallback.speak(roomCode, cue);
      const room = early.get(roomCode);
      const key = cueKey(cue);
      const pending = room?.get(key) ?? prepare(roomCode, cue);
      if (room?.delete(key) && !room.size) early.delete(roomCode);
      const line = await pending.ready(opts.waitMs ?? 1500);
      if (!line) return fallback.speak(roomCode, cue);
      return {
        host: line.host,
        text: line.text,
        kana: line.kana,
        en: line.en,
        audioUrl: line.audio ? `/audio/${encodeURIComponent(line.audio.id)}` : undefined,
        mouth: line.audio?.mouth,
      };
    },
  };
}
