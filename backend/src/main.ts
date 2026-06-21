/**
 * F48 Backend Entry Point
 * NestJS + Fastify adapter with OpenAPI, CORS, CSRF, Helmet, and cookie support.
 */

import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { EnvService } from './config/env.service.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: false, // Use nestjs-pino instead
      trustProxy: true,
    }),
    {
      bufferLogs: true,
    },
  );

  // ── Pino Logger ──
  const logger = app.get(Logger);
  app.useLogger(logger);

  // ── Environment Config ──
  const env = app.get(EnvService);

  // ── Fastify Plugins ──
  const fastifyInstance = app.getHttpAdapter().getInstance();

  // Cookie support (required for session cookies)
  await fastifyInstance.register(
    (await import('@fastify/cookie')).default,
    { secret: env.sessionSecret },
  );

  // Security headers (SEC-004)
  await fastifyInstance.register(
    (await import('@fastify/helmet')).default,
    {
      contentSecurityPolicy: env.isProduction ? undefined : false,
    },
  );

  // CSRF protection for cookie-authenticated web mutations (SEC-004)
  await fastifyInstance.register(
    (await import('@fastify/csrf-protection')).default,
    {
      cookieOpts: {
        signed: true,
        httpOnly: true,
        sameSite: 'strict',
        secure: env.isProduction,
      },
    },
  );

  // ── CORS ──
  app.enableCors({
    origin: env.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Correlation-ID',
      'X-Idempotency-Key',
      'X-Elevated-Confirmation',
      'X-CSRF-Token',
    ],
    exposedHeaders: ['X-Correlation-ID'],
  });

  // ── Global API Prefix ──
  app.setGlobalPrefix(env.get('API_PREFIX'));

  // ── OpenAPI / Swagger (ARCH-009) ──
  const swaggerConfig = new DocumentBuilder()
    .setTitle('F48 API')
    .setDescription(
      'F48 Competition Platform — Backend API. ' +
      'The single source of truth for authentication, tournament lifecycle, ' +
      'scoring, leaderboards, registrations, and money operations.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'Firebase ID Token' },
      'firebase-token',
    )
    .addCookieAuth('f48_session', {
      type: 'apiKey',
      in: 'cookie',
      name: 'f48_session',
    })
    .addTag('Auth', 'Firebase authentication and session management')
    .addTag('Players', 'Player identity, onboarding, and Free Fire binding')
    .addTag('Organizers', 'Organizer profiles, YouTube verification')
    .addTag('Tournaments', 'Tournament CRUD, lifecycle, and configuration')
    .addTag('Registration', 'Tournament registration and team management')
    .addTag('Matches', 'Match operations, credentials, and room management')
    .addTag('Results', 'Result entry, scoring, and leaderboards')
    .addTag('Disputes', 'Dispute submission and resolution')
    .addTag('Prizes', 'Prize eligibility and payout tracking')
    .addTag('Wallet', 'Player wallet, deposits, and withdrawals')
    .addTag('Admin', 'F48 Control administration')
    .addTag('Banners', 'Home hero banner management')
    .addTag('Catalog', 'Map catalog management')
    .addTag('Notifications', 'In-app notifications')
    .addTag('Media', 'File upload and media asset management')
    .addTag('Health', 'Health and readiness checks')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      tagsSorter: 'alpha',
    },
  });

  // ── Start Server ──
  const port = env.port;
  await app.listen(port, '0.0.0.0');
  logger.log(`F48 Backend running on http://0.0.0.0:${port}`);
  logger.log(`Swagger docs: http://0.0.0.0:${port}/api/docs`);
  logger.log(`Environment: ${env.get('NODE_ENV')}`);
}

bootstrap().catch((err) => {
  console.error('Failed to start F48 Backend:', err);
  process.exit(1);
});
