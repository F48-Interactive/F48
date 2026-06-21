# F48 Backend — Decision Log

> DEV-002: Record every meaningful architectural and design decision here.
> Decisions are numbered and immutable once logged. Amendments create new entries.

---

## D-001: NestJS with Fastify adapter over Express

**Date:** 2026-06-20
**Decision:** Use NestJS with `@nestjs/platform-fastify` as the HTTP adapter.
**Rationale:** PRD §14.1 explicitly mandates this stack. Fastify offers better performance benchmarks, native TypeScript support, and first-class plugin system for security (helmet, CSRF, cookies).
**Alternatives rejected:** Express (PRD explicitly says no).

---

## D-002: Integer paise (bigint) for all monetary values

**Date:** 2026-06-20
**Decision:** Store and compute all financial values in integer paise (1 rupee = 100 paise) using PostgreSQL `BIGINT` and TypeScript `bigint`.
**Rationale:** PRD PRIZE-003, ARCH-008. Binary floating-point introduces rounding errors in prize pools and entry fee calculations. Integer paise guarantees exact arithmetic.
**Consequences:** API serializes paise as strings (JSON can't represent bigint natively).

---

## D-003: Prisma Decimal for scoring, not float

**Date:** 2026-06-20
**Decision:** Use Prisma's `Decimal` type (backed by PostgreSQL `NUMERIC`) for placement points, kill multipliers, and all scoring values.
**Rationale:** PRD ARCH-008. Scoring calculations must be exact to prevent placement disputes from floating-point drift.

---

## D-004: Abstract adapter pattern for external providers

**Date:** 2026-06-20
**Decision:** All external API integrations (Games Kinbo, YouTube, Cloudinary) use abstract adapter classes with real and mock implementations, swapped via NestJS DI factories.
**Rationale:** PRD ARCH-012. Mock adapters enable development without credentials and reliable testing. Swapping a provider never touches product code.

---

## D-005: Event bus architecture for realtime

**Date:** 2026-06-20
**Decision:** Internal `EventBusService` (EventEmitter2) emits typed domain events. A separate `EventPublisherService` subscribes and broadcasts to Socket.IO rooms.
**Rationale:** PRD RT-001/002. Decouples event production (domain logic) from event consumption (realtime delivery). Clients use events to invalidate/refetch, never as a second database.

---

## D-006: Global exception filter with consistent error envelope

**Date:** 2026-06-20
**Decision:** All errors — AppError, HttpException, Prisma errors, and unknown errors — pass through global exception filters that output a consistent `{ success: false, error: { code, message, details, correlationId } }` envelope.
**Rationale:** PRD API-002. Frontend teams can write a single error handler. Error codes are machine-readable for programmatic responses.

---

## D-007: Feature flags stored in DB with Redis cache

**Date:** 2026-06-20
**Decision:** Feature flags are stored in PostgreSQL, cached in Redis (5 min TTL), and checked via `@FeatureGate()` decorator/guard.
**Rationale:** PRD ADMIN-012. Wallet and entry-fee features need to be gated for pilot launch. DB storage allows admin dashboard control; Redis cache prevents DB hits on every gated request.
