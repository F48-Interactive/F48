import { Module, type DynamicModule, Logger } from '@nestjs/common';
import { EnvService } from '../config/env.service.js';

// Games Kinbo / Free Fire
import { FreeFireLookupAdapter } from './games-kinbo/games-kinbo.adapter.js';
import { GamesKinboProvider } from './games-kinbo/games-kinbo.provider.js';
import { MockFreeFireProvider } from './games-kinbo/games-kinbo.mock.js';

// YouTube
import { YouTubeLookupAdapter } from './youtube/youtube.adapter.js';
import { MockYouTubeProvider } from './youtube/youtube.mock.js';

// Cloudinary
import { CloudinaryAdapter } from './cloudinary/cloudinary.adapter.js';
import { CloudinaryProvider } from './cloudinary/cloudinary.provider.js';
import { MockCloudinaryProvider } from './cloudinary/cloudinary.mock.js';

/**
 * Provider Module (ARCH-012).
 * Wires real vs mock adapters based on environment.
 * Product code depends only on the abstract adapter — never on a concrete provider.
 */
@Module({})
export class ProviderModule {
  private static readonly logger = new Logger(ProviderModule.name);

  static register(): DynamicModule {
    return {
      module: ProviderModule,
      global: true,
      providers: [
        // ── Free Fire / Games Kinbo ──
        {
          provide: FreeFireLookupAdapter,
          useFactory: (env: EnvService) => {
            if (env.isDevelopment || env.isTest) {
              ProviderModule.logger.log('Using MockFreeFireProvider');
              return new MockFreeFireProvider();
            }
            ProviderModule.logger.log('Using GamesKinboProvider');
            return new GamesKinboProvider(env);
          },
          inject: [EnvService],
        },

        // ── YouTube ──
        {
          provide: YouTubeLookupAdapter,
          useFactory: (env: EnvService) => {
            // Always mock until YouTube API key is configured
            if (!env.youtubeApiKey) {
              ProviderModule.logger.log(
                'Using MockYouTubeProvider (YOUTUBE_API_KEY not set)',
              );
              return new MockYouTubeProvider();
            }
            // TODO: Real YouTube provider when API key is available
            ProviderModule.logger.log('Using MockYouTubeProvider');
            return new MockYouTubeProvider();
          },
          inject: [EnvService],
        },

        // ── Cloudinary ──
        {
          provide: CloudinaryAdapter,
          useFactory: (env: EnvService) => {
            if (env.isDevelopment || env.isTest) {
              ProviderModule.logger.log('Using MockCloudinaryProvider');
              return new MockCloudinaryProvider();
            }
            ProviderModule.logger.log('Using CloudinaryProvider');
            return new CloudinaryProvider(env);
          },
          inject: [EnvService],
        },
      ],
      exports: [
        FreeFireLookupAdapter,
        YouTubeLookupAdapter,
        CloudinaryAdapter,
      ],
    };
  }
}
