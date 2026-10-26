import { revealOrder, type GameState } from './game.js';
import type { RoomView, Viewer } from './protocol.js';

/**
 * Renders the room for one viewer. The stage and every phone get the same public view;
 * a phone also gets `me`. Answer authors stay hidden until the encore.
 */
export function viewFor(state: GameState, viewer: Viewer): RoomView {
  const showAnswers = state.phase === 'reveal' || state.phase === 'encore' || state.phase === 'score';
  const showResults = state.phase === 'encore' || state.phase === 'score';
  const inRound = state.phase !== 'lobby' && state.phase !== 'recap' && state.phase !== 'intro';

  let me: RoomView['me'] = null;
  if (viewer.kind === 'player') {
    const mine = inRound ? state.answers.find((a) => a.authorId === viewer.playerId) : undefined;
    me = {
      playerId: viewer.playerId,
      answerId: mine?.id ?? null,
      answerText: mine?.text ?? null,
      votedFor: (inRound && state.votes[viewer.playerId]) || null,
    };
  }

  return {
    code: state.code,
    phase: state.phase,
    phaseSeq: state.phaseSeq,
    round: state.round,
    totalRounds: state.totalRounds,
    deadline: state.deadline,
    players: state.players.map((p) => ({
      id: p.id,
      name: p.name,
      seat: p.seat,
      connected: p.connected,
      isVip: p.id === state.vipId,
      score: p.score,
      answered: inRound && state.answers.some((a) => a.authorId === p.id),
      voted: inRound && state.votes[p.id] !== undefined,
    })),
    prompt: inRound ? state.prompt : null,
    reveal: showAnswers ? revealOrder(state.answers).map((a) => ({ id: a.id, text: a.text })) : [],
    results: showResults ? state.results : null,
    standings:
      state.phase === 'recap'
        ? [...state.players]
            .sort((a, b) => b.score - a.score || a.seat - b.seat)
            .map((p) => ({ playerId: p.id, name: p.name, score: p.score }))
        : [],
    me,
  };
}
