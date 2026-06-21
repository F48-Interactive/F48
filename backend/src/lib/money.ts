/**
 * F48 Integer Paise Money Utilities
 * PRIZE-003, ARCH-008: All currency is integer paise. No floating-point.
 * Input is ALWAYS string — JS `number` is NEVER accepted at a financial boundary.
 */

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyError';
  }
}

// Regex: optional digits, optional decimal with up to 2 places
const RUPEE_PATTERN = /^\d+(\.\d{1,2})?$/;

/**
 * Convert a string rupee amount to integer paise.
 * @param rupees - String representation of rupees (e.g., "100", "99.50", "0.01")
 * @returns bigint paise value
 * @throws MoneyError if input is invalid
 *
 * @example
 * toPaise("100")    // 10000n
 * toPaise("99.50")  // 9950n
 * toPaise("0.01")   // 1n
 */
export function toPaise(rupees: string): bigint {
  if (typeof rupees !== 'string') {
    throw new MoneyError(
      'Amount must be a string. JS number is not accepted at financial boundaries.',
    );
  }

  const trimmed = rupees.trim();

  if (trimmed === '' || trimmed === '-') {
    throw new MoneyError('Amount cannot be empty');
  }

  if (trimmed.startsWith('-')) {
    throw new MoneyError('Amount cannot be negative');
  }

  if (!RUPEE_PATTERN.test(trimmed)) {
    throw new MoneyError(
      'Invalid amount format. Use up to 2 decimal places (e.g., "100", "99.50")',
    );
  }

  // Split into whole and fractional parts using string operations only
  const parts = trimmed.split('.');
  const wholePart = parts[0] ?? '0';
  let fractionalPart = parts[1] ?? '00';

  // Pad fractional part to exactly 2 digits
  if (fractionalPart.length === 1) {
    fractionalPart = fractionalPart + '0';
  }

  // Combine as integer string and convert to bigint
  const paiseString = wholePart + fractionalPart;

  // Remove leading zeros but keep at least "0"
  const normalized = paiseString.replace(/^0+/, '') || '0';

  const paise = BigInt(normalized);

  // Sanity check — reject unreasonable amounts (> 1 crore = 10,000,000 rupees)
  const MAX_PAISE = BigInt(10_000_000_00); // 1 crore in paise
  if (paise > MAX_PAISE) {
    throw new MoneyError('Amount exceeds maximum allowed value');
  }

  return paise;
}

/**
 * Format paise to a display string with rupee symbol.
 * @param paise - Integer paise value
 * @returns Formatted string like "₹100.00"
 */
export function formatRupees(paise: bigint): string {
  if (paise < 0n) {
    const abs = -paise;
    const whole = abs / 100n;
    const frac = abs % 100n;
    return `-₹${whole}.${frac.toString().padStart(2, '0')}`;
  }

  const whole = paise / 100n;
  const frac = paise % 100n;
  return `₹${whole}.${frac.toString().padStart(2, '0')}`;
}

/**
 * Sum multiple paise amounts.
 */
export function sumPaise(...amounts: bigint[]): bigint {
  return amounts.reduce((acc, val) => acc + val, 0n);
}

/**
 * Validate that prize rows sum to exactly the guaranteed prize pool (PRIZE-002).
 * @param prizes - Array of prize rows with amount_paise
 * @param pool - The guaranteed prize pool in paise
 * @returns true if sum matches exactly
 */
export function validatePrizePool(
  prizes: { amount_paise: bigint }[],
  pool: bigint,
): boolean {
  const total = prizes.reduce(
    (acc, prize) => acc + prize.amount_paise,
    0n,
  );
  return total === pool;
}

/**
 * Validate that a paise amount is positive (for prize rows per PRIZE-001).
 */
export function isPositivePaise(paise: bigint): boolean {
  return paise > 0n;
}

/**
 * Convert paise to a plain number string (without symbol) for API responses.
 * Paise are transmitted as strings in JSON since BigInt isn't natively serializable.
 */
export function paiseToString(paise: bigint): string {
  return paise.toString();
}

/**
 * Parse a paise string from API input back to bigint.
 */
export function parsePaiseString(value: string): bigint {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new MoneyError('Paise value must be a non-negative integer string');
  }
  return BigInt(trimmed);
}
