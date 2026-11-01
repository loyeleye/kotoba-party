// The N4 hard roles' offer log (docs/n4-hard-roles.md). Every game that offers a hard role records each
// offer with one of these answers, so the step's gate (N4 players accept at least 60% of offers) is the
// same number in every game.
//
//   accepted  tapped Take it, or started the role (a first try counts as yes)
//   declined  tapped Not this time
//   timeout   the offer ran out, or the round moved on, with no answer
//   away      the player was disconnected: left out of the rate

export type OfferAnswer = 'accepted' | 'declined' | 'timeout' | 'away';

/** accepted ÷ (accepted + declined + timeout); null when there's nothing to count. */
export function offerRate(answers: readonly OfferAnswer[]): number | null {
  const counted = answers.filter((a) => a !== 'away');
  return counted.length ? counted.filter((a) => a === 'accepted').length / counted.length : null;
}
