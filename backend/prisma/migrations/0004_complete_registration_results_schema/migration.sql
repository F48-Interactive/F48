-- Complete registration, room credential, match result, dispute, and admin schema.

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('pending_invite', 'confirmed', 'waitlisted', 'checked_in', 'no_show', 'withdrawn', 'disqualified', 'advanced', 'eliminated', 'canceled', 'refunded');

-- CreateEnum
CREATE TYPE "TeamRole" AS ENUM ('captain', 'member');

-- CreateEnum
CREATE TYPE "ResultStatus" AS ENUM ('draft', 'submitted', 'needs_correction', 'provisional', 'disputed', 'under_review', 'finalized');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('submitted', 'under_review', 'info_requested', 'investigating', 'resolved_accepted', 'resolved_rejected', 'resolved_partial', 'withdrawn');

-- CreateEnum
CREATE TYPE "DisputeCategory" AS ENUM ('incorrect_score', 'wrong_placement', 'kill_count_mismatch', 'wrong_player', 'technical_issue', 'rule_violation', 'unfair_play', 'other');

-- CreateTable
CREATE TABLE "registrations" (
    "id" UUID NOT NULL,
    "tournament_id" UUID NOT NULL,
    "captain_player_id" UUID NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'confirmed',
    "team_name" VARCHAR(50),
    "slot_number" INTEGER,
    "checked_in_at" TIMESTAMPTZ,
    "withdrawn_at" TIMESTAMPTZ,
    "withdraw_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registration_members" (
    "id" UUID NOT NULL,
    "registration_id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "role" "TeamRole" NOT NULL DEFAULT 'member',
    "invite_status" TEXT NOT NULL DEFAULT 'accepted',
    "joined_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registration_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_credentials" (
    "id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "room_id" TEXT NOT NULL,
    "room_pass" TEXT NOT NULL,
    "custom_code" TEXT,
    "released_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_results" (
    "id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "submitted_by_id" UUID NOT NULL,
    "status" "ResultStatus" NOT NULL DEFAULT 'draft',
    "evidence_asset_id" UUID,
    "admin_notes" TEXT,
    "submitted_at" TIMESTAMPTZ,
    "finalized_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "match_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_player_results" (
    "id" UUID NOT NULL,
    "match_result_id" UUID NOT NULL,
    "registration_id" UUID NOT NULL,
    "placement" INTEGER NOT NULL,
    "kills" INTEGER NOT NULL DEFAULT 0,
    "placement_points" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "kill_points" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "total_points" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "penalty_points" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "is_booyah" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "match_player_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disputes" (
    "id" UUID NOT NULL,
    "match_result_id" UUID NOT NULL,
    "filed_by_player_id" UUID NOT NULL,
    "category" "DisputeCategory" NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'submitted',
    "description" TEXT NOT NULL,
    "evidence_asset_ids" UUID[],
    "admin_assigned_id" UUID,
    "resolution" TEXT,
    "resolved_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_actions" (
    "id" UUID NOT NULL,
    "admin_id" UUID NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "target_type" VARCHAR(30) NOT NULL,
    "target_id" UUID NOT NULL,
    "reason" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "registrations_tournament_id_status_idx" ON "registrations"("tournament_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "registrations_tournament_id_captain_player_id_key" ON "registrations"("tournament_id", "captain_player_id");

-- CreateIndex
CREATE UNIQUE INDEX "registration_members_registration_id_player_id_key" ON "registration_members"("registration_id", "player_id");

-- CreateIndex
CREATE UNIQUE INDEX "room_credentials_match_id_key" ON "room_credentials"("match_id");

-- CreateIndex
CREATE UNIQUE INDEX "match_results_match_id_key" ON "match_results"("match_id");

-- CreateIndex
CREATE UNIQUE INDEX "match_player_results_match_result_id_registration_id_key" ON "match_player_results"("match_result_id", "registration_id");

-- CreateIndex
CREATE INDEX "disputes_match_result_id_idx" ON "disputes"("match_result_id");

-- CreateIndex
CREATE INDEX "disputes_filed_by_player_id_idx" ON "disputes"("filed_by_player_id");

-- CreateIndex
CREATE INDEX "disputes_status_idx" ON "disputes"("status");

-- CreateIndex
CREATE INDEX "admin_actions_admin_id_idx" ON "admin_actions"("admin_id");

-- CreateIndex
CREATE INDEX "admin_actions_target_type_target_id_idx" ON "admin_actions"("target_type", "target_id");

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_members" ADD CONSTRAINT "registration_members_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_credentials" ADD CONSTRAINT "room_credentials_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "tournament_matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "tournament_matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_player_results" ADD CONSTRAINT "match_player_results_match_result_id_fkey" FOREIGN KEY ("match_result_id") REFERENCES "match_results"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
