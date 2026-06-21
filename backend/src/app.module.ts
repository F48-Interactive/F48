import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

// Config
import { ConfigModule } from './config/config.module.js';
import { DatabaseModule } from './config/database.module.js';
import { RuntimeModule } from './config/runtime.module.js';
import { EnvService } from './config/env.service.js';

// Common
import { AppExceptionFilter } from './common/filters/app-exception.filter.js';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter.js';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor.js';
import { CorrelationIdInterceptor } from './common/interceptors/correlation-id.interceptor.js';
import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor.js';
import { FirebaseAuthGuard } from './common/guards/firebase-auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { ElevatedActionGuard } from './common/guards/elevated-action.guard.js';
import { FeatureGateGuard } from './modules/feature-flag/feature-flag.guard.js';

// Modules
import { HealthModule } from './modules/health/health.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { FeatureFlagModule } from './modules/feature-flag/feature-flag.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { DomainModule } from './domain/domain.module.js';

// Phase 1: Identity & Auth
import { AuthModule } from './modules/auth/auth.module.js';
import { PlayerModule } from './modules/player/player.module.js';
import { OrganizerModule } from './modules/organizer/organizer.module.js';

// Phase 2: Tournament & Funding
import { TournamentModule } from './modules/tournament/tournament.module.js';
import { FundingModule } from './modules/funding/funding.module.js';
import { BannerModule } from './modules/banner/banner.module.js';
import { MediaModule } from './modules/media/media.module.js';

// Phase 3: Registration & Check-in
import { RegistrationModule } from './modules/registration/registration.module.js';

// Phase 4: Match Lifecycle
import { MatchModule } from './modules/match/match.module.js';

// Phase 5: Scoring & Leaderboard
import { ScoringModule } from './modules/scoring/scoring.module.js';

// Phase 6: Disputes
import { DisputeModule } from './modules/dispute/dispute.module.js';

// Phase 7: Admin Moderation
import { AdminModule } from './modules/admin/admin.module.js';

// Providers
import { ProviderModule } from './providers/provider.module.js';

@Module({
  imports: [
    // ── Pino Structured Logging (SEC-005) ──
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [EnvService],
      useFactory: (env: EnvService) => ({
        pinoHttp: {
          level: env.logLevel,
          transport: env.isDevelopment
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
          // SEC-005: Redact sensitive fields from logs
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.headers["x-csrf-token"]',
              'res.headers["set-cookie"]',
              'body.password',
              'body.roomId',
              'body.roomPass',
              'body.roomPassword',
              'body.customCode',
              'body.roomCode',
              'body.apiKey',
              'body.privateKey',
              'body.token',
              'body.idToken',
              'body.sessionCookie',
            ],
            censor: '[REDACTED]',
          },
          // Custom serializers for safe logging
          serializers: {
            req: (req: Record<string, unknown>) => ({
              method: req['method'],
              url: req['url'],
              correlationId: (req['headers'] as Record<string, string>)?.[
                'x-correlation-id'
              ],
            }),
            res: (res: Record<string, unknown>) => ({
              statusCode: res['statusCode'],
            }),
          },
        },
      }),
    }),

    // ── Rate Limiting (SEC-002) ──
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [EnvService],
      useFactory: (env: EnvService) => ({
        throttlers: [
          {
            ttl: env.throttleTtlSeconds * 1000,
            limit: env.throttleLimit,
          },
        ],
      }),
    }),

    // ── Core Infrastructure ──
    ConfigModule,
    DatabaseModule,
    RuntimeModule,
    AuditModule,
    FeatureFlagModule,
    DomainModule,
    RealtimeModule,
    ProviderModule.register(),
    HealthModule,

    // Phase 1: Identity & Auth
    AuthModule,
    PlayerModule,
    OrganizerModule,

    // Phase 2: Tournament & Funding
    TournamentModule,
    FundingModule,
    BannerModule,
    MediaModule,

    // Phase 3: Registration & Check-in
    RegistrationModule,

    // Phase 4: Match Lifecycle
    MatchModule,

    // Phase 5: Scoring & Leaderboard
    ScoringModule,

    // Phase 6: Disputes
    DisputeModule,

    // Phase 7: Admin Moderation
    AdminModule,
  ],

  providers: [
    // ── Global Interceptors (order matters) ──
    {
      provide: APP_INTERCEPTOR,
      useClass: CorrelationIdInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseEnvelopeInterceptor,
    },

    // ── Global Exception Filters (most specific first) ──
    {
      provide: APP_FILTER,
      useClass: PrismaExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: AppExceptionFilter,
    },

    // ── Global Guards (order: auth → roles → elevated → throttle) ──
    {
      provide: APP_GUARD,
      useClass: FirebaseAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ElevatedActionGuard,
    },
    {
      provide: APP_GUARD,
      useClass: FeatureGateGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],

  exports: [RuntimeModule],
})
export class AppModule {}
