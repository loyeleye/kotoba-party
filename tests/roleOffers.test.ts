// N4 hard-role offers are saved in account progress for the step 2 gate (docs/n4-hard-roles.md).
import { describe, expect, it } from 'vitest';
import { offerRate } from '../shared/src/modes/hardRoleLog.js';
import { addGame, emptyProgress, roleOfferRate, type GameResult } from '../shared/src/progress.js';

const game = (offers: GameResult['offers']): GameResult => ({
  mode: 'bento-haus', at: Date.UTC(2026, 10, 1), score: 0, place: 0, players: 3, coop: true, awards: [], cards: [], phrases: [], offers,
});

describe('hard-role offers', () => {
  it('rates accepted over accepted, declined and timed out, leaving away out', () => {
    expect(offerRate(['accepted', 'declined', 'timeout', 'away'])).toBeCloseTo(1 / 3);
    expect(offerRate(['away'])).toBeNull();
    expect(offerRate([])).toBeNull();
  });

  it('adds each game’s offers to the saved tallies, by role', () => {
    const p = emptyProgress();
    addGame(p, game([{ role: 'bento-haus:manager', answer: 'accepted' }, { role: 'bento-haus:manager', answer: 'declined' }, { role: 'bento-haus:omotenashi', answer: 'away' }]), 0);
    addGame(p, game([{ role: 'bento-haus:manager', answer: 'accepted' }, { role: 'last-train:announcer', answer: 'timeout' }]), 0);
    expect(p.roleOffers).toEqual({
      'bento-haus:manager': { accepted: 2, declined: 1, timeout: 0 },
      'last-train:announcer': { accepted: 0, declined: 0, timeout: 1 },
    });
    expect(roleOfferRate(p)).toBeCloseTo(2 / 4);
    expect(roleOfferRate(p, 'bento-haus:manager')).toBeCloseTo(2 / 3);
    expect(roleOfferRate(p, 'dub-club:adlib')).toBeNull();
    // The game history doesn't keep them.
    expect(p.games.every((g) => !('offers' in g))).toBe(true);
  });

  it('leaves old saves and games without offers alone', () => {
    const p = emptyProgress();
    addGame(p, game(undefined), 0);
    expect(p.roleOffers).toBeUndefined();
    expect(roleOfferRate(p)).toBeNull();
  });
});
