// N4 hard-role offers are saved in account progress for the step 2 gate (docs/n4-hard-roles.md).
import { describe, expect, it } from 'vitest';
import { offerRate } from '../shared/src/modes/hardRoleLog.js';
import { addGame, emptyProgress, roleOfferRate, type GameResult } from '../shared/src/progress.js';
import { bentoHausMode } from '../shared/src/modes/bentoHaus/bentoHaus.js';
import { dubClubMode } from '../shared/src/modes/dubClub/dubClub.js';
import { lastTrainMode } from '../shared/src/modes/lastTrain/lastTrain.js';
import { narabeteMode } from '../shared/src/modes/narabete/narabete.js';
import { omiaiMode } from '../shared/src/modes/omiai/omiai.js';
import { onsenMurderMode } from '../shared/src/modes/onsenMurder/onsenMurder.js';

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

describe('each mode reports its own offers, for one player', () => {
  // Only the logs the offers come from; the rest of each state isn't read.
  const cases: [string, { offers?: (s: never, id: string) => unknown }, unknown, unknown[]][] = [
    ['bento', bentoHausMode, { hard: { offers: [
      { round: 1, playerId: 'a', role: 'manager', answer: 'accepted' },
      { round: 1, playerId: 'a', role: 'omotenashi', answer: null },
      { round: 2, playerId: 'b', role: 'manager', answer: 'declined' },
    ] } }, [{ role: 'bento-haus:manager', answer: 'accepted' }]],
    ['last train', lastTrainMode, { roleLog: [
      { stop: 0, playerId: 'a', roleId: 'announcer', itemId: 'x', answer: 'declined' },
      { stop: 1, playerId: 'a', roleId: 'announcer', itemId: 'y', answer: 'accepted', bot: true },
    ] }, [{ role: 'last-train:announcer', answer: 'declined' }]],
    ['onsen', onsenMurderMode, { deputyLog: [{ turnNo: 1, playerId: 'a', outcome: 'timeout' }, { turnNo: 2, playerId: 'b', outcome: 'accepted' }] }, [{ role: 'onsen-murder:deputy', answer: 'timeout' }]],
    ['omiai', omiaiMode, { nakodoLog: [{ round: 1, playerId: 'a', outcome: 'accepted' }] }, [{ role: 'omiai:nakodo', answer: 'accepted' }]],
    ['narabete', narabeteMode, { hardLog: [{ round: 1, playerId: 'a', answer: 'declined' }] }, [{ role: 'narabete:defence', answer: 'declined' }]],
    ['dub club', dubClubMode, { rounds: [{ actors: [{ playerId: 'a', adlib: 'accepted' }, { playerId: 'a', adlib: 'offered' }, { playerId: 'b', adlib: 'declined' }] }] }, [{ role: 'dub-club:adlib', answer: 'accepted' }]],
  ];
  for (const [name, mode, state, want] of cases) {
    it(name, () => expect(mode.offers!(state as never, 'a')).toEqual(want));
  }
});
