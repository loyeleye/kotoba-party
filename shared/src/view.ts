import { activeMode, inGame, modeContext, type GameContext, type GameState } from './game.js';
import type { ContentLibrary } from './modes/mode.js';
import { MENU } from './modes/registry.js';
import type { ModeId, RoomView, Viewer } from './protocol.js';
import type { GameView } from './modes/views.js';

/** Wishes per game, counts only: nobody is put on the spot. */
function wishCounts(state: GameState): Partial<Record<ModeId, number>> {
  const out: Partial<Record<ModeId, number>> = {};
  for (const p of state.players) if (p.wish) out[p.wish] = (out[p.wish] ?? 0) + 1;
  return out;
}

/**
 * Renders the room for one viewer. The stage and every phone get the same public view;
 * the mode decides what each phone sees privately inside `game`.
 */
export function viewFor(state: GameState, viewer: Viewer, content: ContentLibrary): RoomView {
  const mode = activeMode(state);
  // Views never change state; the context is only there so modes can look things up.
  const ctx: GameContext = { now: 0, content, newId: () => '', random: () => 0 };
  const playing = inGame(state) && mode !== null;
  const progress = playing ? mode.progress(state.modeState) : { round: 0, totalRounds: 0 };
  const inLobby = state.phase === 'lobby';

  return {
    code: state.code,
    phase: state.phase,
    phaseSeq: state.phaseSeq,
    deadline: state.deadline,
    round: progress.round,
    totalRounds: progress.totalRounds,
    mode: state.mode,
    modes: inLobby ? MENU : [],
    packs: inLobby
      ? content.packs.map((p) => ({ id: p.id, title: p.title.en, titleJa: p.title.text, blurb: p.blurb }))
      : [],
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      seat: p.seat,
      level: p.level,
      connected: p.connected,
      isVip: p.id === state.vipId,
      score: p.score,
      total: p.total,
      mic: p.mic,
      soundOff: !!p.soundOff,
    })),
    host: state.host,
    calmMotion: state.calmMotion,
    game: playing ? (mode.view(state.modeState, state.phase, viewer, modeContext(state, ctx)) as GameView) : null,
    recap: state.recap
      ? {
          ...recapWithoutCheck(state.recap),
          phrasebook: viewer.kind === 'player' ? (state.phrasebook[viewer.playerId] ?? []) : [],
          waitCheck: viewer.kind === 'player' && state.recap.mixed?.ask.includes(viewer.playerId) ? { answer: state.recap.mixed.answers[viewer.playerId] ?? null } : null,
        }
      : null,
    me:
      viewer.kind === 'player'
        ? { playerId: viewer.playerId, level: state.players.find((p) => p.id === viewer.playerId)?.level ?? 'n5', wish: state.players.find((p) => p.id === viewer.playerId)?.wish ?? null }
        : null,
    wishes: inLobby ? wishCounts(state) : {},
    remoteControl: state.remoteControl,
    audience: state.audience,
    surprise: state.surprise,
  };
}

/** The recap as every screen sees it: the mixed-room check's answers and phase log stay on the server. */
function recapWithoutCheck(r: NonNullable<GameState['recap']>): Omit<NonNullable<GameState['recap']>, 'mixed'> {
  const { mixed: _mixed, ...rest } = r;
  return rest;
}
