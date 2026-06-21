# F48 Backend — Dependency Registry

> DEV-006: Before adding a dependency, document its purpose, maintenance status,
> security impact, alternatives, and removal cost.

## Production Dependencies

| Package | Version | Purpose | Maintenance | Security Impact | Alternatives | Removal Cost |
|---|---|---|---|---|---|---|
| `@nestjs/core` | ^11.0.1 | NestJS framework core | Active (Trilon) | Foundation — high | Raw Fastify | Total rewrite |
| `@nestjs/common` | ^11.0.1 | NestJS common utilities | Active | Foundation — high | N/A | Total rewrite |
| `@nestjs/platform-fastify` | ^11.1.27 | Fastify HTTP adapter (PRD §14.1) | Active | HTTP layer | — | Moderate (adapter swap) |
| `@nestjs/swagger` | ^11.4.4 | OpenAPI/Swagger docs (ARCH-009) | Active | Low (docs only) | Manual OpenAPI spec | Moderate |
| `@nestjs/throttler` | ^6.5.0 | Rate limiting (SEC-002) | Active | Security | Custom rate limiter | Low |
| `@nestjs/websockets` | ^11.1.27 | Socket.IO gateway | Active | Realtime infra | Raw socket.io | Moderate |
| `@nestjs/platform-socket.io` | ^11.1.27 | Socket.IO adapter | Active | Realtime infra | Raw socket.io | Moderate |
| `@prisma/adapter-pg` | ^7.8.0 | Prisma 7 PostgreSQL driver adapter | Active (Prisma Inc.) | DB access — high | `@prisma/adapter-neon` | Low |
| `@fastify/helmet` | ^13.0.2 | Security headers (SEC-004) | Active (Fastify team) | Security | Custom headers | Low |
| `@fastify/cookie` | ^11.0.2 | Cookie parsing for sessions | Active | Session — moderate | Custom parsing | Low |
| `@fastify/csrf-protection` | ^8.0.0 | CSRF protection (SEC-004) | Active | Security | Custom CSRF | Low |
| `cloudinary` | ^2.10.0 | Media uploads (MEDIA-001) | Active (Cloudinary Inc.) | Media — moderate | S3, custom | Moderate |
| `dotenv` | ^17.4.2 | Env loading for Prisma CLI | Active | Low | None needed | Trivial |
| `eventemitter2` | ^6.4.9 | Internal typed event bus | Active | Low | Node EventEmitter | Low |
| `firebase-admin` | ^14.0.0 | Firebase Admin SDK (AUTH-003) | Active (Google) | Auth — high | Custom JWT | High |
| `ioredis` | ^5.11.1 | Redis client (ARCH-003) | Active | Cache/pub-sub — moderate | `redis` package | Moderate |
| `nestjs-pino` | ^4.6.1 | Structured logging (SEC-005) | Active | Observability | Winston | Low |
| `pg` | ^8.22.0 | PostgreSQL driver for Prisma adapter | Active | DB access — high | N/A (required) | N/A |
| `pino` | ^10.3.1 | JSON logger | Active | Observability | Winston | Low |
| `pino-pretty` | ^13.1.3 | Dev log formatting | Active | Dev only | None | Trivial |
| `reflect-metadata` | ^0.2.2 | Decorator metadata (NestJS requirement) | Stable | Low | None (required) | N/A |
| `rxjs` | ^7.8.1 | Reactive streams (NestJS requirement) | Active | Low | None (required) | N/A |
| `socket.io` | ^4.8.3 | Realtime communication | Active | Realtime — moderate | ws, SSE | High |
| `uuid` | ^14.0.1 | UUID generation | Active | Low | `crypto.randomUUID` | Low |
| `zod` | ^4.4.3 | Schema validation | Active | Validation — low | Joi, class-validator | Moderate |

## Dev Dependencies

| Package | Version | Purpose |
|---|---|---|
| `prisma` | ^7.8.0 | Prisma CLI (migrations, generate) |
| `@nestjs/cli` | ^11.0.0 | NestJS CLI (build, generate) |
| `@nestjs/schematics` | ^11.0.0 | NestJS code generation |
| `@nestjs/testing` | ^11.0.1 | Test utilities |
| `@types/pg` | latest | PostgreSQL type definitions |
| `@types/uuid` | latest | UUID type definitions |
| `@types/node` | ^24.0.0 | Node.js type definitions |
| `@types/jest` | ^30.0.0 | Jest type definitions |
| `@types/supertest` | ^7.0.0 | Supertest type definitions |
| `jest` | ^30.0.0 | Test runner |
| `ts-jest` | ^29.2.5 | TypeScript Jest transformer |
| `supertest` | ^7.0.0 | HTTP assertion library |
| `typescript` | ^5.7.3 | TypeScript compiler |
| `eslint` | ^9.18.0 | Linter |
| `prettier` | ^3.4.2 | Code formatter |

## Removed Packages (Decision Log)

| Package | Reason for Removal |
|---|---|
| `@nestjs/platform-express` | PRD §14.1 mandates Fastify, not Express |
| `@types/express` | Not needed — Fastify types used instead |
