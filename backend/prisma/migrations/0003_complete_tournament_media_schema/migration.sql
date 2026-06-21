-- Complete tournament, funding, banner, map, and media schema.

-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('draft', 'submitted', 'changes_required', 'approved', 'published', 'registration_open', 'registration_closed', 'check_in', 'live', 'results_pending', 'dispute_window', 'results_final', 'settlement', 'completed', 'canceled', 'voided', 'archived');

-- CreateEnum
CREATE TYPE "TournamentMode" AS ENUM ('solo', 'duo', 'squad');

-- CreateEnum
CREATE TYPE "FundingType" AS ENUM ('f48_sponsored', 'entry_fee');

-- CreateEnum
CREATE TYPE "StructureType" AS ENUM ('direct_final', 'qualifiers_to_final');

-- CreateEnum
CREATE TYPE "ScoringModel" AS ENUM ('combined', 'placement_only', 'kills_only');

-- CreateEnum
CREATE TYPE "StageType" AS ENUM ('qualifier', 'final');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('scheduled', 'check_in', 'room_released', 'live', 'awaiting_result', 'result_submitted', 'finalized', 'delayed', 'canceled', 'voided');

-- CreateEnum
CREATE TYPE "FundingRequestStatus" AS ENUM ('not_requested', 'draft', 'submitted', 'changes_required', 'partially_approved', 'approved', 'rejected', 'canceled', 'settled');

-- CreateEnum
CREATE TYPE "BannerLinkType" AS ENUM ('tournament', 'organizer', 'announcement', 'external');

-- CreateEnum
CREATE TYPE "MediaPurpose" AS ENUM ('tournament_banner', 'organizer_avatar', 'player_avatar', 'result_evidence', 'dispute_evidence', 'sponsor_logo', 'banner_image', 'deposit_proof');

-- CreateEnum
CREATE TYPE "MediaAccessLevel" AS ENUM ('public_access', 'authenticated', 'restricted');

-- CreateTable
CREATE TABLE "tournaments" (
    "id" UUID NOT NULL,
    "organizer_id" UUID NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "mode" "TournamentMode" NOT NULL,
    "funding_type" "FundingType" NOT NULL,
    "structure_type" "StructureType" NOT NULL,
    "scoring_model" "ScoringModel" NOT NULL,
    "status" "TournamentStatus" NOT NULL DEFAULT 'draft',
    "game_map_id" UUID,
    "banner_asset_id" UUID,
    "max_units" INTEGER NOT NULL,
    "entry_fee_paise" BIGINT,
    "prize_pool_paise" BIGINT NOT NULL DEFAULT 0,
    "scheduled_start_at" TIMESTAMPTZ,
    "registration_open_at" TIMESTAMPTZ,
    "registration_close_at" TIMESTAMPTZ,
    "check_in_duration_min" INTEGER,
    "dispute_window_hours" INTEGER NOT NULL DEFAULT 24,
    "rules_text" TEXT,
    "active_config_version_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_stages" (
    "id" UUID NOT NULL,
    "tournament_id" UUID NOT NULL,
    "type" "StageType" NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "stage_order" INTEGER NOT NULL,
    "advancement_count" INTEGER,
    "points_carry_forward" BOOLEAN NOT NULL DEFAULT false,
    "check_in_duration_min" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournament_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_rooms" (
    "id" UUID NOT NULL,
    "tournament_id" UUID NOT NULL,
    "stage_id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "max_units" INTEGER NOT NULL,
    "room_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournament_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_matches" (
    "id" UUID NOT NULL,
    "tournament_id" UUID NOT NULL,
    "stage_id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "match_number" INTEGER NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'scheduled',
    "scheduled_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ,
    "ended_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tournament_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_config_versions" (
    "id" UUID NOT NULL,
    "tournament_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "scoring_model" "ScoringModel" NOT NULL,
    "kill_multiplier" DECIMAL(5,2) NOT NULL DEFAULT 1,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "locked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournament_config_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "placement_points" (
    "id" UUID NOT NULL,
    "config_version_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "points" DECIMAL(8,2) NOT NULL,

    CONSTRAINT "placement_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prize_rules" (
    "id" UUID NOT NULL,
    "config_version_id" UUID NOT NULL,
    "rank_start" INTEGER NOT NULL,
    "rank_end" INTEGER NOT NULL,
    "amount_paise" BIGINT NOT NULL,

    CONSTRAINT "prize_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tiebreak_rules" (
    "id" UUID NOT NULL,
    "config_version_id" UUID NOT NULL,
    "priority" INTEGER NOT NULL,
    "field" VARCHAR(50) NOT NULL,

    CONSTRAINT "tiebreak_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funding_requests" (
    "id" UUID NOT NULL,
    "tournament_id" UUID NOT NULL,
    "requested_paise" BIGINT NOT NULL,
    "approved_paise" BIGINT,
    "status" "FundingRequestStatus" NOT NULL DEFAULT 'not_requested',
    "reason" TEXT,
    "admin_notes" TEXT,
    "deposit_proof_id" UUID,
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "funding_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banners" (
    "id" UUID NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "subtitle" VARCHAR(200),
    "image_asset_id" UUID NOT NULL,
    "link_type" "BannerLinkType" NOT NULL,
    "link_id" TEXT,
    "link_url" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "starts_at" TIMESTAMPTZ,
    "ends_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "banners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "map_catalog" (
    "id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "game_code" VARCHAR(20) NOT NULL,
    "image_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "map_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "uploader_id" UUID NOT NULL,
    "purpose" "MediaPurpose" NOT NULL,
    "access_level" "MediaAccessLevel" NOT NULL DEFAULT 'public_access',
    "cloudinary_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secure_url" TEXT NOT NULL,
    "format" VARCHAR(10) NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tournaments_organizer_id_idx" ON "tournaments"("organizer_id");

-- CreateIndex
CREATE INDEX "tournaments_status_idx" ON "tournaments"("status");

-- CreateIndex
CREATE INDEX "tournaments_scheduled_start_at_idx" ON "tournaments"("scheduled_start_at");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_stages_tournament_id_stage_order_key" ON "tournament_stages"("tournament_id", "stage_order");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_rooms_tournament_id_stage_id_room_order_key" ON "tournament_rooms"("tournament_id", "stage_id", "room_order");

-- CreateIndex
CREATE INDEX "tournament_matches_status_idx" ON "tournament_matches"("status");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_matches_tournament_id_match_number_key" ON "tournament_matches"("tournament_id", "match_number");

-- CreateIndex
CREATE UNIQUE INDEX "tournament_config_versions_tournament_id_version_number_key" ON "tournament_config_versions"("tournament_id", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "placement_points_config_version_id_position_key" ON "placement_points"("config_version_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "prize_rules_config_version_id_rank_start_key" ON "prize_rules"("config_version_id", "rank_start");

-- CreateIndex
CREATE UNIQUE INDEX "tiebreak_rules_config_version_id_priority_key" ON "tiebreak_rules"("config_version_id", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "funding_requests_tournament_id_key" ON "funding_requests"("tournament_id");

-- CreateIndex
CREATE INDEX "funding_requests_status_idx" ON "funding_requests"("status");

-- CreateIndex
CREATE INDEX "banners_is_active_priority_idx" ON "banners"("is_active", "priority");

-- CreateIndex
CREATE INDEX "media_assets_uploader_id_idx" ON "media_assets"("uploader_id");

-- CreateIndex
CREATE INDEX "media_assets_purpose_idx" ON "media_assets"("purpose");

-- AddForeignKey
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "organizers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_game_map_id_fkey" FOREIGN KEY ("game_map_id") REFERENCES "map_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_stages" ADD CONSTRAINT "tournament_stages_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_rooms" ADD CONSTRAINT "tournament_rooms_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_rooms" ADD CONSTRAINT "tournament_rooms_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "tournament_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "tournament_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "tournament_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_config_versions" ADD CONSTRAINT "tournament_config_versions_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "placement_points" ADD CONSTRAINT "placement_points_config_version_id_fkey" FOREIGN KEY ("config_version_id") REFERENCES "tournament_config_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prize_rules" ADD CONSTRAINT "prize_rules_config_version_id_fkey" FOREIGN KEY ("config_version_id") REFERENCES "tournament_config_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiebreak_rules" ADD CONSTRAINT "tiebreak_rules_config_version_id_fkey" FOREIGN KEY ("config_version_id") REFERENCES "tournament_config_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funding_requests" ADD CONSTRAINT "funding_requests_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
