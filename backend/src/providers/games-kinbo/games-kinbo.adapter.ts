/**
 * Games Kinbo Provider Adapter (ARCH-012, PLAYER-006)
 * Interface + mock for Free Fire UID lookup.
 * Swappable without rewriting product logic.
 */

export interface FreeFireAccount {
  uid: string;
  nickname: string;
  region: string;
  level: number;
  rawData: Record<string, unknown>;
}

export interface FreeFireLookupResult {
  success: boolean;
  account?: FreeFireAccount;
  error?: string;
}

/**
 * Adapter interface for Free Fire UID lookup.
 * Implementations: GamesKinboProvider (real), MockFreeFireProvider (dev/test).
 */
export abstract class FreeFireLookupAdapter {
  abstract lookupByUid(uid: string): Promise<FreeFireLookupResult>;
}
