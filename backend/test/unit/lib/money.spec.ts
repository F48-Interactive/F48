import {
  toPaise,
  formatRupees,
  sumPaise,
  validatePrizePool,
  isPositivePaise,
  parsePaiseString,
  MoneyError,
} from '../../../src/lib/money.js';

describe('Money Utilities', () => {
  describe('toPaise', () => {
    it('converts whole rupees to paise', () => {
      expect(toPaise('100')).toBe(10000n);
      expect(toPaise('1')).toBe(100n);
      expect(toPaise('0')).toBe(0n);
    });

    it('converts rupees with decimals to paise', () => {
      expect(toPaise('99.50')).toBe(9950n);
      expect(toPaise('0.01')).toBe(1n);
      expect(toPaise('0.10')).toBe(10n);
      expect(toPaise('123.45')).toBe(12345n);
    });

    it('handles single decimal digit', () => {
      expect(toPaise('5.5')).toBe(550n);
      expect(toPaise('0.1')).toBe(10n);
    });

    it('handles leading zeros in input', () => {
      expect(toPaise('007')).toBe(700n);
      expect(toPaise('00.50')).toBe(50n);
    });

    it('rejects negative amounts', () => {
      expect(() => toPaise('-100')).toThrow(MoneyError);
      expect(() => toPaise('-0.01')).toThrow(MoneyError);
    });

    it('rejects more than 2 decimal places', () => {
      expect(() => toPaise('10.123')).toThrow(MoneyError);
      expect(() => toPaise('0.001')).toThrow(MoneyError);
    });

    it('rejects empty strings', () => {
      expect(() => toPaise('')).toThrow(MoneyError);
      expect(() => toPaise('  ')).toThrow(MoneyError);
    });

    it('rejects non-numeric strings', () => {
      expect(() => toPaise('abc')).toThrow(MoneyError);
      expect(() => toPaise('12.34.56')).toThrow(MoneyError);
      expect(() => toPaise('$100')).toThrow(MoneyError);
    });

    it('rejects amounts exceeding 1 crore', () => {
      expect(() => toPaise('10000001')).toThrow(MoneyError);
    });

    it('accepts exactly 1 crore', () => {
      expect(toPaise('10000000')).toBe(1000000000n);
    });

    it('rejects non-string input at type level', () => {
      // Runtime check even if TypeScript is bypassed
      expect(() => toPaise(100 as unknown as string)).toThrow(MoneyError);
    });
  });

  describe('formatRupees', () => {
    it('formats paise to rupee string', () => {
      expect(formatRupees(10000n)).toBe('₹100.00');
      expect(formatRupees(9950n)).toBe('₹99.50');
      expect(formatRupees(1n)).toBe('₹0.01');
      expect(formatRupees(0n)).toBe('₹0.00');
    });

    it('formats large amounts', () => {
      expect(formatRupees(1000000000n)).toBe('₹10000000.00');
    });

    it('formats negative amounts', () => {
      expect(formatRupees(-500n)).toBe('-₹5.00');
    });
  });

  describe('sumPaise', () => {
    it('sums multiple amounts', () => {
      expect(sumPaise(100n, 200n, 300n)).toBe(600n);
    });

    it('returns 0 for empty input', () => {
      expect(sumPaise()).toBe(0n);
    });

    it('handles single amount', () => {
      expect(sumPaise(42n)).toBe(42n);
    });
  });

  describe('validatePrizePool', () => {
    it('validates when prizes sum to pool', () => {
      const prizes = [
        { amount_paise: 5000n },
        { amount_paise: 3000n },
        { amount_paise: 2000n },
      ];
      expect(validatePrizePool(prizes, 10000n)).toBe(true);
    });

    it('fails when prizes do not sum to pool', () => {
      const prizes = [
        { amount_paise: 5000n },
        { amount_paise: 3000n },
      ];
      expect(validatePrizePool(prizes, 10000n)).toBe(false);
    });

    it('handles empty prize array', () => {
      expect(validatePrizePool([], 0n)).toBe(true);
      expect(validatePrizePool([], 100n)).toBe(false);
    });
  });

  describe('isPositivePaise', () => {
    it('returns true for positive amounts', () => {
      expect(isPositivePaise(1n)).toBe(true);
      expect(isPositivePaise(100n)).toBe(true);
    });

    it('returns false for zero', () => {
      expect(isPositivePaise(0n)).toBe(false);
    });

    it('returns false for negative', () => {
      expect(isPositivePaise(-1n)).toBe(false);
    });
  });

  describe('parsePaiseString', () => {
    it('parses valid paise strings', () => {
      expect(parsePaiseString('10000')).toBe(10000n);
      expect(parsePaiseString('0')).toBe(0n);
    });

    it('rejects non-integer strings', () => {
      expect(() => parsePaiseString('100.5')).toThrow(MoneyError);
      expect(() => parsePaiseString('-100')).toThrow(MoneyError);
      expect(() => parsePaiseString('abc')).toThrow(MoneyError);
    });
  });
});
