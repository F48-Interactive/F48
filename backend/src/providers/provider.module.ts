import { Module, type DynamicModule, Logger } from '@nestjs/common';
import { EnvService } from '../config/env.service.js';

// Games Kinbo / Free Fire
import { FreeFireLookupAdapter } from './games-kinbo/games-kinbo.adapter.js';
import { GamesKinboProvider } from './games-kinbo/games-kinbo.provider.js';
import { MockFreeFireProvider } from './games-kinbo/games-kinbo.mock.js';

// YouTube
import { YouTubeLookupAdapter } from './youtube/youtube.adapter.js';
import { MockYouTubeProvider } from './youtube/youtube.mock.js';

/**
 * Provider Module (ARCH-012).
 * Wires real vs mock adapters based on environment.
 * Product code depends only on abstract adapters.
 */
@Module({})
export class ProviderModule {
  private static readonly logger = new Logger(ProviderModule.name);

  static register(): DynamicModule {
    return {
      module: ProviderModule,
      global: true,
      providers: [
        {
          provide: FreeFireLookupAdapter,
          useFactory: (env: EnvService) => {
            if (env.isDevelopment || env.isTest || !env.gamesKinboApiKey) {
              ProviderModule.logger.log(
                'Using MockFreeFireProvider (GAMES_KINBO_API_KEY not set)',
              );
              return new MockFreeFireProvider();
            }
            ProviderModule.logger.log('Using GamesKinboProvider');
            return new GamesKinboProvider(env);
          },
          inject: [EnvService],
        },
        {
          provide: YouTubeLookupAdapter,
          useFactory: (env: EnvService) => {
            if (!env.youtubeApiKey) {
              ProviderModule.logger.log(
                'Using MockYouTubeProvider (YOUTUBE_API_KEY not set)',
              );
              return new MockYouTubeProvider();
            }
            ProviderModule.logger.log('Using MockYouTubeProvider');
            return new MockYouTubeProvider();
          },
          inject: [EnvService],
        },
      ],
      exports: [FreeFireLookupAdapter, YouTubeLookupAdapter],
    };
  }
}
