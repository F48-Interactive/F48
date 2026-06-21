import { Global, Module } from '@nestjs/common';
import { FeatureFlagService } from './feature-flag.service.js';
import { FeatureGateGuard } from './feature-flag.guard.js';

@Global()
@Module({
  providers: [FeatureFlagService, FeatureGateGuard],
  exports: [FeatureFlagService, FeatureGateGuard],
})
export class FeatureFlagModule {}
