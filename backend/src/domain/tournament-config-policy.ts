import { ErrorCodes } from '../common/constants/error-codes.js';
import { BadRequestError } from '../lib/errors.js';
import type {
  PrizeConfigInput,
  ScoringConfigInput,
  TiebreakConfigInput,
} from '../modules/tournament/dto/tournament.dto.js';
import { requiresPrizePool } from './tournament-funding-policy.js';

const REQUIRED_TIEBREAK_ORDER = [
  'total_booyahs',
  'total_kills',
  'final_match_placement',
] as const;

interface TournamentShape {
  mode: string;
  maxUnits: number;
}

interface PrizeTournamentShape {
  fundingType?: string;
  prizePoolPaise: bigint;
  maxUnits: number;
}

interface PublishedConfigShape {
  placementPoints: unknown[];
  prizeRules: Array<{ amountPaise: bigint }>;
  tiebreakRules: Array<{ priority: number; field: string }>;
}

export function assertScoringConfig(
  tournament: TournamentShape,
  data: ScoringConfigInput,
): void {
  const killValue = decimalToNumber(data.killMultiplier);
  const placementValues = data.placementPoints.map((entry) =>
    decimalToNumber(entry.points),
  );

  if (data.scoringModel === 'placement_only' && killValue !== 0) {
    throw new BadRequestError(
      ErrorCodes.VALIDATION_FAILED,
      'Placement-only scoring must use a 0.00 kill multiplier.',
    );
  }

  if (data.scoringModel !== 'placement_only' && killValue <= 0) {
    throw new BadRequestError(
      ErrorCodes.VALIDATION_FAILED,
      'Kill multiplier must be greater than zero.',
    );
  }

  if (data.scoringModel === 'kills_only' && placementValues.some((p) => p !== 0)) {
    throw new BadRequestError(
      ErrorCodes.VALIDATION_FAILED,
      'Kill-only scoring must set every placement position to 0 points.',
    );
  }

  if (
    data.scoringModel !== 'kills_only' &&
    !placementValues.some((points) => points > 0)
  ) {
    throw new BadRequestError(
      ErrorCodes.VALIDATION_FAILED,
      'Scoring config must award placement points to at least one position.',
    );
  }

  assertCompletePlacementTable(tournament.maxUnits, data.placementPoints);
}

export function assertPrizeConfig(
  tournament: PrizeTournamentShape,
  data: PrizeConfigInput,
): void {
  if (tournament.prizePoolPaise <= 0n) {
    throw new BadRequestError(
      ErrorCodes.PRIZE_POOL_MISMATCH,
      'Prize pool must be funded before prize rules are configured.',
    );
  }

  const seenRanks = new Set<number>();
  let sum = 0n;

  for (const rule of data.rules) {
    if (rule.rankStart !== rule.rankEnd) {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        'Prize rules must target exact final ranks; ranges are not allowed.',
      );
    }
    if (rule.rankStart > tournament.maxUnits) {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        'Prize rank exceeds tournament capacity.',
      );
    }
    if (rule.amountPaise <= 0) {
      throw new BadRequestError(
        ErrorCodes.INVALID_AMOUNT,
        'Prize amounts must be positive.',
      );
    }
    if (seenRanks.has(rule.rankStart)) {
      throw new BadRequestError(
        ErrorCodes.DUPLICATE_RESOURCE,
        'Duplicate prize rank.',
      );
    }

    seenRanks.add(rule.rankStart);
    sum += BigInt(rule.amountPaise);
  }

  assertPrizePoolTotal(tournament.prizePoolPaise, sum);
}

export function assertTiebreakConfig(data: TiebreakConfigInput): void {
  assertTiebreakRules(data.rules);
}

export function assertPublishableConfig(
  tournament: PrizeTournamentShape,
  config: PublishedConfigShape | null,
): void {
  if (!config) {
    throw new BadRequestError(
      ErrorCodes.VALIDATION_FAILED,
      'Active scoring config is required before publishing.',
    );
  }

  if (config.placementPoints.length !== tournament.maxUnits) {
    throw new BadRequestError(
      ErrorCodes.INVALID_PLACEMENT,
      'Active scoring config must include a complete placement table.',
    );
  }

  assertTiebreakRules(config.tiebreakRules);

  if (requiresPrizePool(tournament.fundingType ?? '')) {
    if (tournament.prizePoolPaise <= 0n || config.prizeRules.length === 0) {
      throw new BadRequestError(
        ErrorCodes.PRIZE_POOL_MISMATCH,
        'Prize distribution is required before publishing.',
      );
    }

    const sum = config.prizeRules.reduce(
      (total, rule) => total + rule.amountPaise,
      0n,
    );
    assertPrizePoolTotal(tournament.prizePoolPaise, sum);
  }
}

function assertCompletePlacementTable(
  maxUnits: number,
  placementPoints: ScoringConfigInput['placementPoints'],
): void {
  const expectedPositions = new Set<number>();
  for (let position = 1; position <= maxUnits; position += 1) {
    expectedPositions.add(position);
  }

  const seen = new Set<number>();
  for (const entry of placementPoints) {
    if (seen.has(entry.position)) {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        'Duplicate placement position.',
      );
    }
    seen.add(entry.position);
    expectedPositions.delete(entry.position);
  }

  if (expectedPositions.size > 0 || seen.size !== maxUnits) {
    throw new BadRequestError(
      ErrorCodes.INVALID_PLACEMENT,
      `Placement table must include every position from 1 to ${maxUnits}.`,
    );
  }

  const sorted = [...placementPoints].sort((a, b) => a.position - b.position);
  let previousPoints = Number.POSITIVE_INFINITY;
  for (const entry of sorted) {
    const points = decimalToNumber(entry.points);
    if (points > previousPoints) {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        'Placement points must be non-increasing by position.',
      );
    }
    previousPoints = points;
  }

  const finalRow = sorted[sorted.length - 1];
  if (!finalRow || decimalToNumber(finalRow.points) !== 0) {
    throw new BadRequestError(
      ErrorCodes.VALIDATION_FAILED,
      `Position ${maxUnits} must be locked to 0 placement points.`,
    );
  }
}

function assertTiebreakRules(
  rules: Array<{ priority: number; field: string }>,
): void {
  const priorities = new Set<number>();
  const fields = new Set<string>();

  for (const rule of rules) {
    if (priorities.has(rule.priority)) {
      throw new BadRequestError(
        ErrorCodes.DUPLICATE_RESOURCE,
        'Duplicate tiebreak priority.',
      );
    }
    if (fields.has(rule.field)) {
      throw new BadRequestError(
        ErrorCodes.DUPLICATE_RESOURCE,
        'Duplicate tiebreak field.',
      );
    }
    priorities.add(rule.priority);
    fields.add(rule.field);
  }

  for (let priority = 1; priority <= rules.length; priority += 1) {
    if (!priorities.has(priority)) {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        'Tiebreak priorities must be contiguous from 1.',
      );
    }
  }

  for (const field of REQUIRED_TIEBREAK_ORDER) {
    if (!fields.has(field)) {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        `Tiebreak config must include ${field}.`,
      );
    }
  }
}

function assertPrizePoolTotal(expected: bigint, actual: bigint): void {
  if (actual !== expected) {
    throw new BadRequestError(
      ErrorCodes.PRIZE_POOL_MISMATCH,
      'Prize rules must sum exactly to the tournament prize pool.',
      {
        expectedPaise: expected.toString(),
        actualPaise: actual.toString(),
      },
    );
  }
}

function decimalToNumber(value: string): number {
  return Number.parseFloat(value);
}
