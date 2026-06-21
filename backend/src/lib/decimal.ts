/**
 * F48 Decimal Utilities (ARCH-008)
 * Exact arithmetic for scoring multipliers and placement points.
 * Uses Prisma's Decimal type — never binary floating-point for scores or money.
 */

import { Prisma } from '../generated/prisma/client.js';

type Decimal = Prisma.Decimal;
const Decimal = Prisma.Decimal;

/**
 * Safely convert a string to Prisma Decimal.
 * SCORE-008: Accepts string ONLY — binary floating-point numbers must never
 * enter scoring calculations to prevent drift in rank computations.
 */
export function toDecimal(value: string): Decimal {
  if (typeof value !== 'string') {
    throw new Error('toDecimal requires a string input to prevent floating-point drift');
  }
  return new Decimal(value);
}

/**
 * Convert Decimal to display string.
 */
export function decimalToString(value: Decimal, decimalPlaces?: number): string {
  if (decimalPlaces !== undefined) {
    return value.toFixed(decimalPlaces);
  }
  return value.toString();
}

/**
 * Exact multiplication of two Decimals.
 */
export function multiplyDecimal(a: Decimal, b: Decimal): Decimal {
  return a.mul(b);
}

/**
 * Sum multiple Decimal values.
 */
export function sumDecimals(...values: Decimal[]): Decimal {
  return values.reduce((acc, val) => acc.add(val), new Decimal(0));
}

/**
 * Check if a Decimal is non-negative (>= 0).
 */
export function isNonNegative(value: Decimal): boolean {
  return value.gte(0);
}

/**
 * Check if a Decimal array is non-increasing (each element <= previous).
 * Used for placement point validation (SCORE-002).
 */
export function isNonIncreasing(values: Decimal[]): boolean {
  for (let i = 1; i < values.length; i++) {
    if (values[i]!.gt(values[i - 1]!)) {
      return false;
    }
  }
  return true;
}

/**
 * Check if a Decimal is zero.
 */
export function isZero(value: Decimal): boolean {
  return value.eq(0);
}

/**
 * Calculate adjusted score: placement_pts + kill_pts - penalty_pts (§5.1)
 */
export function calculateAdjustedScore(
  placementPoints: Decimal,
  killPoints: Decimal,
  penaltyPoints: Decimal,
): Decimal {
  return placementPoints.add(killPoints).sub(penaltyPoints);
}

/**
 * Calculate kill points: kills * multiplier
 */
export function calculateKillPoints(
  kills: number,
  multiplier: Decimal,
): Decimal {
  return new Decimal(kills).mul(multiplier);
}
