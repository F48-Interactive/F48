import { Injectable, Logger } from '@nestjs/common';
import { EnvService } from '../../config/env.service.js';
import {
  FreeFireLookupAdapter,
  type FreeFireLookupResult,
} from './games-kinbo.adapter.js';

/**
 * Real Games Kinbo provider (PLAYER-006).
 * Calls the Games Kinbo API to look up Free Fire UIDs.
 * Rate-limited at the service layer (PLAYER-009).
 */
@Injectable()
export class GamesKinboProvider extends FreeFireLookupAdapter {
  private readonly logger = new Logger(GamesKinboProvider.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(env: EnvService) {
    super();
    this.apiUrl = env.gamesKinboApiUrl;
    this.apiKey = env.gamesKinboApiKey;
  }

  async lookupByUid(uid: string): Promise<FreeFireLookupResult> {
    try {
      const url = `${this.apiUrl}/v1/free-fire/account/${encodeURIComponent(uid)}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      if (!response.ok) {
        if (response.status === 404) {
          return {
            success: false,
            error: 'Free Fire account not found for this UID.',
          };
        }

        this.logger.error(
          { status: response.status, uid },
          'Games Kinbo API error',
        );
        return {
          success: false,
          error: 'Unable to verify Free Fire account. Please try again later.',
        };
      }

      const data = (await response.json()) as Record<string, unknown>;

      return {
        success: true,
        account: {
          uid,
          nickname: (data['nickname'] as string) ?? 'Unknown',
          region: (data['region'] as string) ?? 'Unknown',
          level: (data['level'] as number) ?? 0,
          rawData: data,
        },
      };
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : 'Unknown', uid },
        'Games Kinbo provider failed',
      );
      return {
        success: false,
        error: 'Free Fire lookup service is temporarily unavailable. Please try again later.',
      };
    }
  }
}
