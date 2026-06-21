-- Align tournaments with the organizer-first product flow.
-- Old approval/review statuses are collapsed into the closest active status.

ALTER TYPE "FundingType" ADD VALUE IF NOT EXISTS 'free';
ALTER TYPE "FundingType" ADD VALUE IF NOT EXISTS 'organizer_funded';

ALTER TABLE "tournaments" ALTER COLUMN "status" DROP DEFAULT;

CREATE TYPE "TournamentStatus_new" AS ENUM (
  'draft',
  'published',
  'registration_open',
  'registration_closed',
  'check_in',
  'live',
  'provisional_results',
  'dispute_window',
  'results_final',
  'completed',
  'canceled',
  'voided',
  'archived'
);

ALTER TABLE "tournaments"
  ALTER COLUMN "status" TYPE "TournamentStatus_new"
  USING (
    CASE "status"::text
      WHEN 'submitted' THEN 'published'
      WHEN 'changes_required' THEN 'draft'
      WHEN 'approved' THEN 'published'
      WHEN 'results_pending' THEN 'provisional_results'
      WHEN 'settlement' THEN 'completed'
      ELSE "status"::text
    END
  )::"TournamentStatus_new";

DROP TYPE "TournamentStatus";
ALTER TYPE "TournamentStatus_new" RENAME TO "TournamentStatus";

ALTER TABLE "tournaments"
  ALTER COLUMN "status" SET DEFAULT 'draft';
