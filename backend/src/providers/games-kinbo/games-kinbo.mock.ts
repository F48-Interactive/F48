import { Injectable, Logger } from '@nestjs/common';
import {
  FreeFireLookupAdapter,
  type FreeFireLookupResult,
} from './games-kinbo.adapter.js';

/**
 * Mock Free Fire lookup provider for development and testing.
 * Returns predictable data based on UID patterns.
 */
@Injectable()
export class MockFreeFireProvider extends FreeFireLookupAdapter {
  private readonly logger = new Logger(MockFreeFireProvider.name);

  async lookupByUid(uid: string): Promise<FreeFireLookupResult> {
    this.logger.debug(`Mock FF lookup for UID: ${uid}`);

    // Simulate not found
    if (uid === '000000000' || uid.startsWith('invalid')) {
      return {
        success: false,
        error: 'Free Fire account not found for this UID.',
      };
    }

    // Simulate provider error
    if (uid === '999999999') {
      return {
        success: false,
        error: 'Free Fire lookup service is temporarily unavailable.',
      };
    }

    // Return mock success data
    return {
      success: true,
      account: {
        uid,
        nickname: `Player_${uid.slice(-4)}`,
        region: 'IND',
        level: 50 + (parseInt(uid.slice(-2), 10) || 0),
        rawData: {
          uid,
          nickname: `Player_${uid.slice(-4)}`,
          region: 'IND',
          level: 50,
          mock: true,
        },
      },
    };
  }
}
