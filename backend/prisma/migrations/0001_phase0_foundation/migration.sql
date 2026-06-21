-- Phase 0: Engineering Foundation
-- F48 Backend initial schema migration
-- Generated from prisma/schema.prisma

-- ─────────────────────────────────────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE "UserRole" AS ENUM ('player', 'organizer', 'admin', 'super_admin');
CREATE TYPE "UserStatus" AS ENUM ('active', 'suspended', 'banned');
CREATE TYPE "PlayerStatus" AS ENUM ('onboarding', 'active', 'suspended', 'banned');
CREATE TYPE "FfBindingStatus" AS ENUM ('active', 'replaced', 'removed');
CREATE TYPE "OrgVerificationStatus" AS ENUM ('profile_incomplete', 'verification_pending', 'verified', 'restricted', 'suspended');
CREATE TYPE "FundingEligibility" AS ENUM ('not_eligible', 'eligible', 'suspended');
CREATE TYPE "VerificationDecision" AS ENUM ('approved', 'rejected', 'restricted', 'suspended', 'reinstated');

-- ─────────────────────────────────────────────────────────────────────────────
-- IDENTITY & AUTH
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "firebase_uid" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'player',
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "players" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "platform_id" VARCHAR(9) NOT NULL,
    "username" VARCHAR(20) NOT NULL,
    "username_lower" VARCHAR(20) NOT NULL,
    "display_name" TEXT,
    "avatar_asset_id" UUID,
    "status" "PlayerStatus" NOT NULL DEFAULT 'onboarding',
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "player_ff_bindings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "player_id" UUID NOT NULL,
    "ff_uid" TEXT NOT NULL,
    "ff_nickname" TEXT,
    "ff_region" TEXT,
    "ff_level" INTEGER,
    "ff_account_data" JSONB,
    "status" "FfBindingStatus" NOT NULL DEFAULT 'active',
    "bound_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unbound_at" TIMESTAMPTZ,
    "unbound_reason" TEXT,
    CONSTRAINT "player_ff_bindings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "organizers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "display_name" TEXT,
    "description" TEXT,
    "avatar_asset_id" UUID,
    "verification_status" "OrgVerificationStatus" NOT NULL DEFAULT 'profile_incomplete',
    "funding_eligibility" "FundingEligibility" NOT NULL DEFAULT 'not_eligible',
    "verified_at" TIMESTAMPTZ,
    "verified_by" UUID,
    "total_tournaments_completed" INTEGER NOT NULL DEFAULT 0,
    "total_prizes_distributed_paise" BIGINT NOT NULL DEFAULT 0,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "organizers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "organizer_youtube_channels" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizer_id" UUID NOT NULL,
    "channel_id" TEXT NOT NULL,
    "channel_name" TEXT,
    "handle" TEXT,
    "url" TEXT,
    "image_url" TEXT,
    "subscriber_count" INTEGER,
    "video_count" INTEGER,
    "raw_channel_data" JSONB,
    "status" TEXT NOT NULL DEFAULT 'active',
    "fetched_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "organizer_youtube_channels_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "organizer_verification_decisions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizer_id" UUID NOT NULL,
    "decision" "VerificationDecision" NOT NULL,
    "reason" TEXT NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "organizer_verification_decisions_pkey" PRIMARY KEY ("id")
);

-- ─────────────────────────────────────────────────────────────────────────────
-- PLATFORM & AUDIT
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_id" UUID NOT NULL,
    "actor_role" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB,
    "reason" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "correlation_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "status_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "previous_status" TEXT NOT NULL,
    "new_status" TEXT NOT NULL,
    "reason" TEXT,
    "actor_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "status_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "feature_flags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "value" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "idempotency_keys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT,
    "response_status" INTEGER NOT NULL,
    "response_body" JSONB,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- ─────────────────────────────────────────────────────────────────────────────
-- UNIQUE CONSTRAINTS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX "users_firebase_uid_key" ON "users"("firebase_uid");
CREATE UNIQUE INDEX "players_user_id_key" ON "players"("user_id");
CREATE UNIQUE INDEX "players_platform_id_key" ON "players"("platform_id");
CREATE UNIQUE INDEX "players_username_key" ON "players"("username");
CREATE UNIQUE INDEX "players_username_lower_key" ON "players"("username_lower");
CREATE UNIQUE INDEX "organizers_user_id_key" ON "organizers"("user_id");
CREATE UNIQUE INDEX "feature_flags_key_key" ON "feature_flags"("key");
CREATE UNIQUE INDEX "idempotency_keys_key_key" ON "idempotency_keys"("key");

-- ─────────────────────────────────────────────────────────────────────────────
-- PARTIAL UNIQUE INDEX (DATA-007)
-- Prisma cannot express WHERE conditions — this is the real partial unique.
-- Only one active FF UID binding per UID globally at any time.
-- Multiple historical (replaced/removed) rows for the same UID are allowed.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX "unique_active_ff_uid"
    ON "player_ff_bindings" ("ff_uid")
    WHERE "status" = 'active';

-- Also enforce: one active binding per player at a time
CREATE UNIQUE INDEX "unique_active_player_binding"
    ON "player_ff_bindings" ("player_id")
    WHERE "status" = 'active';

-- ─────────────────────────────────────────────────────────────────────────────
-- REGULAR INDEXES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX "idx_ff_binding_player_status" ON "player_ff_bindings"("player_id", "status");
CREATE INDEX "idx_ff_binding_uid" ON "player_ff_bindings"("ff_uid");
CREATE INDEX "audit_logs_resource_type_resource_id_idx" ON "audit_logs"("resource_type", "resource_id");
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");
CREATE INDEX "status_history_resource_type_resource_id_idx" ON "status_history"("resource_type", "resource_id");
CREATE INDEX "status_history_created_at_idx" ON "status_history"("created_at");
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys"("expires_at");

-- ─────────────────────────────────────────────────────────────────────────────
-- FOREIGN KEYS
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "players" ADD CONSTRAINT "players_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "player_ff_bindings" ADD CONSTRAINT "player_ff_bindings_player_id_fkey"
    FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "organizers" ADD CONSTRAINT "organizers_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "organizer_youtube_channels" ADD CONSTRAINT "organizer_youtube_channels_organizer_id_fkey"
    FOREIGN KEY ("organizer_id") REFERENCES "organizers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "organizer_verification_decisions" ADD CONSTRAINT "organizer_verification_decisions_organizer_id_fkey"
    FOREIGN KEY ("organizer_id") REFERENCES "organizers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey"
    FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
