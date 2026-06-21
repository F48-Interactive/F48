import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FEATURE_GATE_KEY } from '../../common/decorators/index.js';
import { ForbiddenError } from '../../lib/errors.js';
import { ErrorCodes } from '../../common/constants/error-codes.js';
import { FeatureFlagService } from './feature-flag.service.js';

/**
 * Feature Gate Guard (ADMIN-012).
 * Checks @FeatureGate('flagKey') metadata and rejects if the flag is disabled.
 */
@Injectable()
export class FeatureGateGuard implements CanActivate {
  private readonly logger = new Logger(FeatureGateGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly featureFlagService: FeatureFlagService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const flagKey = this.reflector.getAllAndOverride<string>(
      FEATURE_GATE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!flagKey) return true;

    const isEnabled = await this.featureFlagService.isEnabled(flagKey);

    if (!isEnabled) {
      this.logger.debug(`Feature '${flagKey}' is disabled — blocking request`);
      throw new ForbiddenError(
        ErrorCodes.FEATURE_DISABLED,
        'This feature is not currently available.',
        { feature: flagKey },
      );
    }

    return true;
  }
}
