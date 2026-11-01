// Turns host cues from the game rules into lines on the stage.
//
// The default director picks a written line from the content's line bank (no network, no
// wait). The host voice thread's LLM + TTS pipeline plugs in through the same HostVoice
// interface: it gets the cue as the phase starts and answers when its line is ready.
// Lines arrive through room.say(), which drops any line whose phase has already passed,
// so a slow voice can never show a stale line or hold up a round.

import type { HostLine, Level } from '../../content/src/types.js';
import { capitalizeAtStart } from '../ai/lineBank.js';
import { HOST_EVENTS, fitsAudience, type HostEvent as AiEvent, type HostVoice as AiHostVoice, type PendingLine } from '../ai/index.js';
import type { ContentLibrary, HostCue } from '../../shared/src/modes/mode.js';
import type { HostMood, HostSay } from '../../shared/src/protocol.js';
import type { Room } from './room.js';

/** Audio that wasn't ready when its line was: sent to the stage as an update to the same line. */
export interface LateAudio {
  audioUrl: string;
  mouth?: HostSay['mouth'];
}

export type SpokenLine = Omit<HostSay, 'phaseSeq'> & { later?: Promise<LateAudio | undefined> };

export interface HostVoice {
  /** Returns the line for a cue, or null to stay quiet. May be slow; may fail. */
  speak(roomCode: string, cue: HostCue): Promise<SpokenLine | null>;
  /** A cue the game expects to raise soon (cue.ahead): start on its line now. Optional; nothing is said. */
  ahead?(roomCode: string, cue: HostCue): void;
}

/** Fills {slot} placeholders. A `{key}_kana` or `{key}_en` slot, when given, fills that field instead of `{key}`. */
function fill(text: string, slots: Record<string, string> | undefined, field: 'text' | 'kana' | 'en' = 'text'): string {
  return text.replace(/\{(\w+)\}/g, (m, key: string, at: number) => {
    const sibling = field !== 'text' ? slots?.[`${key}_${field}`] : undefined;
    if (sibling !== undefined) return field === 'en' ? capitalizeAtStart(sibling, text, at) : sibling;
    return slots?.[key] ?? m;
  });
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
        (l: HostLine) => l.host === cue.host && l.event === cue.event && (!cue.tier || !l.tier || l.tier === cue.tier) && fitsAudience(l, cue.audience),
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

const CHEER = new Set(['ippon', 'encore_cheer', 'raid_combo', 'raid_catch', 'train_revive', 'train_announcer_react', 'vote_landslide', 'kakegoe_call', 'recap_award', 'mic_check_ok', 'concentration_keep', 'concentration_bonus', 'concentration_picture', 'concentration_clear', 'narabete_perfect', 'bento_perfect', 'bento_bake', 'hajime_known', 'hajime_pon_win', 'happyokai_great', 'happyokai_stall', 'happyokai_vote', 'late_alibi_match', 'late_booth', 'court_guilty', 'court_not_guilty', 'court_tie', 'court_booth']);
const OOPS = new Set(['miss_kind', 'raid_escape', 'train_ghost', 'fooled', 'vote_zero', 'room_overrule', 'answer_hurry', 'concentration_mismatch', 'concentration_missed', 'narabete_knot', 'bento_leave', 'bento_static', 'hajime_truth', 'happyokai_mishap_blackout', 'happyokai_mishap_wrong', 'happyokai_mishap_graph', 'happyokai_mishap_upside', 'happyokai_mishap_message', 'late_alibi_miss', 'late_stand_in', 'late_misread', 'court_stand_in']);

/** Twists: a steal, an upset, a reveal nobody saw coming. Bigger than a flinch. */
const SHOCK = new Set(['cushion_steal', 'concentration_stolen', 'concentration_yokai', 'train_last_stop_twist', 'tourist_escaped', 'onsen_reveal', 'hajime_top_lie', 'shodo_synchro_break', 'late_curveball', 'late_truth', 'court_curveball']);
/** The host mulls it over with the players as they start to answer or vote. */
const THINK = new Set(['hajime_write', 'hajime_rank', 'tourist_vote', 'shodo_vote', 'onsen_accuse', 'happyokai_question', 'concentration_steal_open', 'late_vote', 'court_plan', 'court_check', 'court_vote']);

/** Nobiko-san cranes her neck out to look as players answer and as their answers are revealed. */
const PEEK = new Set(['say_it_first', 'reveal_react', 'rumour_intro', 'rumour_relay', 'rumour_react', 'rumour_tease']);

/**
 * The host's reaction to a cue: a cheer for a win, a flinch for a miss, a gasp at a twist, a
 * think as players answer, Nobiko-san's nosy peek, otherwise just the idle loop.
 */
export function moodFor(cue: Pick<HostCue, 'host' | 'event' | 'tier'>): HostMood | undefined {
  // Late Again!'s scripted reaction follows the leaves: a cheer for IPPON, a flinch for a flop.
  if (cue.event === 'late_line' && cue.tier) return cue.tier === 'ippon' ? 'cheer' : cue.tier === 'flop' ? 'oops' : undefined;
  if (CHEER.has(cue.event)) return 'cheer';
  if (OOPS.has(cue.event)) return 'oops';
  if (SHOCK.has(cue.event)) return 'shock';
  if (THINK.has(cue.event)) return 'think';
  // Nobiko-san peeks at the answers instead.
  if (cue.host !== 'nobiko') return cue.event === 'say_it_first' ? 'think' : undefined;
  // To the card the stage marks: the winning answer, or the one she's teasing. She idles where there is none.
  if (cue.event === 'encore_invite' || cue.event === 'omiai_tease') return 'reach';
  if (!PEEK.has(cue.event)) return undefined;
  return cue.tier === 'ippon' ? 'cheer' : 'peek'; // a top Karaoke take gets her cheer instead
}

/**
 * Wires a voice to a room: each cue is spoken and lands only if its phase is still current. Cues pick up the
 * room's Audience setting here, so the host follows it in every mode.
 */
export function hostDirector(voice: HostVoice) {
  return (room: Room, raised: HostCue[], phaseSeq: number): void => {
    const cues = raised.map((c) => ({ ...c, audience: room.state.audience }));
    for (const c of cues) if (c.ahead) voice.ahead?.(room.code, c);
    const start = Date.now();
    const say = (cue: HostCue, atMs: number): void => {
      voice
        .speak(room.code, cue)
        .then((line) => {
          if (!line) return;
          const { later, ...rest } = line;
          const out: HostSay = { ...rest, mood: rest.mood ?? moodFor(cue), phaseSeq };
          const land = () => {
            room.say(out);
            // Late audio joins the line it belongs to, if the stage is still showing it.
            void later
              ?.then((a) => {
                if (a && room.state.host === out) room.say({ ...out, audioPending: undefined, audioUrl: a.audioUrl, mouth: a.mouth });
              })
              .catch(() => {});
          };
          const wait = atMs - (Date.now() - start);
          if (wait > 0) setTimeout(land, wait);
          else land();
        })
        .catch(() => {
          // The host just stays quiet this phase.
        });
    };
    // One line per phase: the last cue raised is the most specific. A cue timed for later in the phase gets its own then.
    for (const c of cues) if (!c.ahead && c.atMs !== undefined) say(c, c.atMs);
    const cue = cues.filter((c) => !c.ahead && c.atMs === undefined).at(-1);
    if (cue) say(cue, 0);
  };
}

/** Lines started early and not yet asked for, per room. A few rounds' worth; the oldest go first. */
const AHEAD_MAX = 12;

const cueKey = (c: HostCue): string =>
  JSON.stringify([c.host, c.event, c.tier ?? '', c.prompt?.text ?? '', c.answer ?? '', c.answerEn ?? '', c.slots ?? {}, c.audience ?? '']);

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
      audience: cue.audience,
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
      const line = await pending.ready(cue.waitMs ?? opts.waitMs ?? 1500);
      if (!line) return fallback.speak(roomCode, cue);
      const later = voice.audioLater(line);
      return {
        host: line.host,
        text: line.text,
        kana: line.kana,
        en: line.en,
        audioUrl: line.audio ? `/audio/${encodeURIComponent(line.audio.id)}` : undefined,
        mouth: line.audio?.mouth,
        audioPending: later ? true : undefined,
        later: later?.then((a) => (a ? { audioUrl: `/audio/${encodeURIComponent(a.id)}`, mouth: a.mouth } : undefined)),
      };
    },
  };
}
