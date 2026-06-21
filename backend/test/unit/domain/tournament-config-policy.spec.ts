import {
  assertPublishableConfig,
  assertScoringConfig,
} from '../../../src/domain/tournament-config-policy.js';

const squadTournament = { placementSlots: 12 };

function placement(points: number[]) {
  return points.map((value, index) => ({
    position: index + 1,
    points: value.toFixed(2),
  }));
}

describe('tournament config policy', () => {
  it('rejects kill-only scoring with placement points', () => {
    expect(() =>
      assertScoringConfig(squadTournament, {
        scoringModel: 'kills_only',
        killMultiplier: '1.00',
        placementPoints: placement([12, 9, 8, 7, 6, 5, 4, 3, 2, 1, 1, 0]),
      }),
    ).toThrow('Kill-only scoring must set every placement position to 0 points.');
  });

  it('rejects placement scoring without placement points', () => {
    expect(() =>
      assertScoringConfig(squadTournament, {
        scoringModel: 'placement_only',
        killMultiplier: '0.00',
        placementPoints: placement(Array(12).fill(0)),
      }),
    ).toThrow('must award placement points');
  });

  it('rejects publish without tie-breakers', () => {
    expect(() =>
      assertPublishableConfig(
        { fundingType: 'free', prizePoolPaise: 0n, placementSlots: 12 },
        {
          placementPoints: Array(12).fill({}),
          prizeRules: [],
          tiebreakRules: [],
        },
      ),
    ).toThrow('Tiebreak config must include total_booyahs');
  });

  it('rejects funded publish without complete prize distribution', () => {
    expect(() =>
      assertPublishableConfig(
        {
          fundingType: 'organizer_funded',
          prizePoolPaise: 10_000n,
          placementSlots: 12,
          prizeSlots: 12,
        },
        {
          placementPoints: Array(12).fill({}),
          prizeRules: [{ amountPaise: 9_000n }],
          tiebreakRules: [
            { priority: 1, field: 'total_booyahs' },
            { priority: 2, field: 'total_kills' },
            { priority: 3, field: 'final_match_placement' },
          ],
        },
      ),
    ).toThrow('Prize rules must sum exactly');
  });
});
