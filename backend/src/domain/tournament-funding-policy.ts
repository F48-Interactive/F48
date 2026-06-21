import { ErrorCodes } from '../common/constants/error-codes.js';
import { BadRequestError } from '../lib/errors.js';

const FUNDING_TYPES = [
  'free',
  'organizer_funded',
  'f48_sponsored',
  'entry_fee',
] as const;

export type TournamentFundingType = (typeof FUNDING_TYPES)[number];

export function assertFundingShape(
  fundingType: string,
  entryFeePaise?: number,
  prizePoolPaise?: number,
): void {
  if (!FUNDING_TYPES.includes(fundingType as TournamentFundingType)) {
    throw new BadRequestError(
      ErrorCodes.VALIDATION_FAILED,
      'Invalid tournament funding type.',
    );
  }

  if (fundingType !== 'entry_fee' && entryFeePaise && entryFeePaise > 0) {
    throw new BadRequestError(
      ErrorCodes.INVALID_AMOUNT,
      'Only entry-fee tournaments may define an entry fee.',
    );
  }

  if (fundingType === 'entry_fee' && (!entryFeePaise || entryFeePaise <= 0)) {
    throw new BadRequestError(
      ErrorCodes.INVALID_AMOUNT,
      'Entry-fee tournaments require an entry fee greater than zero.',
    );
  }

  if (fundingType === 'free' && prizePoolPaise && prizePoolPaise > 0) {
    throw new BadRequestError(
      ErrorCodes.INVALID_AMOUNT,
      'Use organizer_funded or f48_sponsored when a prize pool is set.',
    );
  }
}

export function requiresPrizePool(fundingType: string): boolean {
  return fundingType === 'organizer_funded' || fundingType === 'f48_sponsored';
}
