import {
  generatePlatformId,
  validatePlatformId,
} from '../../../src/lib/platform-id.js';

describe('Platform ID', () => {
  describe('generatePlatformId', () => {
    it('generates a 9-character ID', () => {
      const id = generatePlatformId();
      expect(id).toHaveLength(9);
    });

    it('has 8 digits followed by 1 uppercase letter', () => {
      const id = generatePlatformId();
      expect(id).toMatch(/^[0-9]{8}[A-Z]$/);
    });

    it('generates unique IDs (probabilistic)', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        ids.add(generatePlatformId());
      }
      // With 10^8 * 26 possibilities, 1000 should all be unique
      expect(ids.size).toBe(1000);
    });
  });

  describe('validatePlatformId', () => {
    it('validates correct format', () => {
      expect(validatePlatformId('48271935A')).toBe(true);
      expect(validatePlatformId('00000000Z')).toBe(true);
      expect(validatePlatformId('99999999M')).toBe(true);
    });

    it('rejects lowercase letters', () => {
      expect(validatePlatformId('48271935a')).toBe(false);
    });

    it('rejects wrong length', () => {
      expect(validatePlatformId('4827193A')).toBe(false); // 8 chars
      expect(validatePlatformId('482719350AB')).toBe(false); // 11 chars
    });

    it('rejects non-digit prefix', () => {
      expect(validatePlatformId('A8271935B')).toBe(false);
    });

    it('rejects non-letter suffix', () => {
      expect(validatePlatformId('482719351')).toBe(false);
    });

    it('rejects empty string', () => {
      expect(validatePlatformId('')).toBe(false);
    });

    it('rejects special characters', () => {
      expect(validatePlatformId('4827193!')).toBe(false);
      expect(validatePlatformId('48271935@')).toBe(false);
    });
  });
});
