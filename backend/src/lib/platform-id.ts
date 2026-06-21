/**
 * F48 Platform ID Generator (PLAYER-001, PLAYER-002)
 * Format: exactly 8 numeric digits + 1 uppercase alphabetic character
 * Example: 48271935A
 * - Globally unique (enforced by DB constraint)
 * - Backend-generated
 * - Immutable and never recycled
 */

import { randomBytes } from 'node:crypto';

const DIGITS = '0123456789';
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const PLATFORM_ID_REGEX = /^[0-9]{8}[A-Z]$/;

/**
 * Generate a random Platform ID.
 * Collision checking is done at the service layer against the database.
 */
export function generatePlatformId(): string {
  const bytes = randomBytes(9);

  let id = '';

  // 8 random digits
  for (let i = 0; i < 8; i++) {
    id += DIGITS[bytes[i]! % 10];
  }

  // 1 random uppercase letter
  id += LETTERS[bytes[8]! % 26];

  return id;
}

/**
 * Validate that a string matches the Platform ID format.
 */
export function validatePlatformId(id: string): boolean {
  return PLATFORM_ID_REGEX.test(id);
}

/**
 * The regex pattern for Platform ID validation (for use in Zod schemas, etc.)
 */
export const PLATFORM_ID_PATTERN = PLATFORM_ID_REGEX;
