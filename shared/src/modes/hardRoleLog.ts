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

/** One past offer, as a mode logs it (round, turn, scene or stop: whatever the mode counts in). */
export interface PastOffer {
  playerId: string;
  /** The round (turn, stop, scene…) it was made in. */
  at: number;
  answer: OfferAnswer | 'offered' | null;
}

/**
 * Who is offered a hard role now, the same way in every game:
 * - the N4 player offered fewest times so far, then the one offered longest ago;
 * - a player who said no to their last offer sits the next one out (no nagging);
 * - with 4 or more players in the room, nobody holds the spotlight two rounds running: a player who took the
 *   role last round is passed over (a lone N4 player then gets it every other round).
 * Null when nobody should be offered it this time.
 */
export function nextOfferee(n4: readonly string[], log: readonly PastOffer[], now: number, roomSize: number): string | null {
  const mine = (id: string) => log.filter((o) => o.playerId === id);
  const lastOf = (id: string) => mine(id).reduce<PastOffer | null>((a, o) => (!a || o.at >= a.at ? o : a), null);
  const resting = (id: string) => {
    const last = lastOf(id);
    if (!last) return false;
    if (last.answer === 'declined' && last.at === now - 1) return true;
    return roomSize >= 4 && last.answer === 'accepted' && last.at === now - 1;
  };
  const order = [...n4].sort((a, b) => mine(a).length - mine(b).length || (lastOf(a)?.at ?? -1) - (lastOf(b)?.at ?? -1));
  return order.find((id) => !resting(id)) ?? null;
}
