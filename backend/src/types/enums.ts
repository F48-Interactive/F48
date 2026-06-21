/**
 * F48 Domain Enums
 * All enums use `as const` objects for runtime values + type inference.
 * Pattern: const object for values, type alias for the union.
 */

// ── Identity & Auth ──

export const UserRole = {
  PLAYER: 'player',
  ORGANIZER: 'organizer',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const UserStatus = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  BANNED: 'banned',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const PlayerStatus = {
  ONBOARDING: 'onboarding',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  BANNED: 'banned',
} as const;
export type PlayerStatus = (typeof PlayerStatus)[keyof typeof PlayerStatus];

export const OrganizerVerificationStatus = {
  PROFILE_INCOMPLETE: 'profile_incomplete',
  VERIFICATION_PENDING: 'verification_pending',
  VERIFIED: 'verified',
  RESTRICTED: 'restricted',
  SUSPENDED: 'suspended',
} as const;
export type OrganizerVerificationStatus =
  (typeof OrganizerVerificationStatus)[keyof typeof OrganizerVerificationStatus];

export const FundingEligibility = {
  NOT_ELIGIBLE: 'not_eligible',
  ELIGIBLE: 'eligible',
  SUSPENDED: 'suspended',
} as const;
export type FundingEligibility =
  (typeof FundingEligibility)[keyof typeof FundingEligibility];

// ── Tournament ──

export const TournamentStatus = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  CHANGES_REQUIRED: 'changes_required',
  APPROVED: 'approved',
  PUBLISHED: 'published',
  REGISTRATION_OPEN: 'registration_open',
  REGISTRATION_CLOSED: 'registration_closed',
  CHECK_IN: 'check_in',
  LIVE: 'live',
  RESULTS_PENDING: 'results_pending',
  DISPUTE_WINDOW: 'dispute_window',
  RESULTS_FINAL: 'results_final',
  SETTLEMENT: 'settlement',
  COMPLETED: 'completed',
  CANCELED: 'canceled',
  VOIDED: 'voided',
  ARCHIVED: 'archived',
} as const;
export type TournamentStatus =
  (typeof TournamentStatus)[keyof typeof TournamentStatus];

export const TournamentMode = {
  SOLO: 'solo',
  DUO: 'duo',
  SQUAD: 'squad',
} as const;
export type TournamentMode =
  (typeof TournamentMode)[keyof typeof TournamentMode];

/** Maximum competitive units per match by mode (TOUR-001) */
export const MODE_MAX_UNITS: Record<TournamentMode, number> = {
  solo: 48,
  duo: 24,
  squad: 12,
} as const;

/** Players per competitive unit by mode */
export const MODE_PLAYERS_PER_UNIT: Record<TournamentMode, number> = {
  solo: 1,
  duo: 2,
  squad: 4,
} as const;

export const FundingType = {
  F48_SPONSORED: 'f48_sponsored',
  ENTRY_FEE: 'entry_fee',
} as const;
export type FundingType = (typeof FundingType)[keyof typeof FundingType];

export const StructureType = {
  DIRECT_FINAL: 'direct_final',
  QUALIFIERS_TO_FINAL: 'qualifiers_to_final',
} as const;
export type StructureType = (typeof StructureType)[keyof typeof StructureType];

export const ScoringModel = {
  COMBINED: 'combined',
  PLACEMENT_ONLY: 'placement_only',
  KILLS_ONLY: 'kills_only',
} as const;
export type ScoringModel = (typeof ScoringModel)[keyof typeof ScoringModel];

// ── Registration ──

export const RegistrationStatus = {
  PENDING_INVITE: 'pending_invite',
  CONFIRMED: 'confirmed',
  WAITLISTED: 'waitlisted',
  CHECKED_IN: 'checked_in',
  NO_SHOW: 'no_show',
  WITHDRAWN: 'withdrawn',
  DISQUALIFIED: 'disqualified',
  ADVANCED: 'advanced',
  ELIMINATED: 'eliminated',
  CANCELED: 'canceled',
  REFUNDED: 'refunded',
} as const;
export type RegistrationStatus =
  (typeof RegistrationStatus)[keyof typeof RegistrationStatus];

export const InvitationStatus = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  REMOVED: 'removed',
} as const;
export type InvitationStatus =
  (typeof InvitationStatus)[keyof typeof InvitationStatus];

export const TeamRole = {
  CAPTAIN: 'captain',
  MEMBER: 'member',
} as const;
export type TeamRole = (typeof TeamRole)[keyof typeof TeamRole];

// ── Match & Results ──

export const MatchStatus = {
  SCHEDULED: 'scheduled',
  CHECK_IN: 'check_in',
  ROOM_RELEASED: 'room_released',
  LIVE: 'live',
  AWAITING_RESULT: 'awaiting_result',
  RESULT_SUBMITTED: 'result_submitted',
  FINALIZED: 'finalized',
  DELAYED: 'delayed',
  CANCELED: 'canceled',
  VOIDED: 'voided',
} as const;
export type MatchStatus = (typeof MatchStatus)[keyof typeof MatchStatus];

export const ResultStatus = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  NEEDS_CORRECTION: 'needs_correction',
  PROVISIONAL: 'provisional',
  DISPUTED: 'disputed',
  UNDER_REVIEW: 'under_review',
  FINALIZED: 'finalized',
} as const;
export type ResultStatus = (typeof ResultStatus)[keyof typeof ResultStatus];

// ── Disputes ──

export const DisputeStatus = {
  SUBMITTED: 'submitted',
  UNDER_REVIEW: 'under_review',
  INFO_REQUESTED: 'info_requested',
  INVESTIGATING: 'investigating',
  RESOLVED_ACCEPTED: 'resolved_accepted',
  RESOLVED_REJECTED: 'resolved_rejected',
  RESOLVED_PARTIAL: 'resolved_partial',
  WITHDRAWN: 'withdrawn',
} as const;
export type DisputeStatus = (typeof DisputeStatus)[keyof typeof DisputeStatus];

export const DisputeCategory = {
  INCORRECT_SCORE: 'incorrect_score',
  WRONG_PLACEMENT: 'wrong_placement',
  KILL_COUNT_MISMATCH: 'kill_count_mismatch',
  WRONG_PLAYER: 'wrong_player',
  TECHNICAL_ISSUE: 'technical_issue',
  RULE_VIOLATION: 'rule_violation',
  UNFAIR_PLAY: 'unfair_play',
  OTHER: 'other',
} as const;
export type DisputeCategory =
  (typeof DisputeCategory)[keyof typeof DisputeCategory];

// ── Funding Request ──

export const FundingRequestStatus = {
  NOT_REQUESTED: 'not_requested',
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  CHANGES_REQUIRED: 'changes_required',
  PARTIALLY_APPROVED: 'partially_approved',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELED: 'canceled',
  SETTLED: 'settled',
} as const;
export type FundingRequestStatus =
  (typeof FundingRequestStatus)[keyof typeof FundingRequestStatus];

// ── Prize ──

export const PrizePayoutStatus = {
  PENDING_ELIGIBILITY: 'pending_eligibility',
  APPROVED: 'approved',
  PROCESSING: 'processing',
  PAID: 'paid',
  CREDITED: 'credited',
  FAILED: 'failed',
  RECONCILED: 'reconciled',
} as const;
export type PrizePayoutStatus =
  (typeof PrizePayoutStatus)[keyof typeof PrizePayoutStatus];

// ── Scoring ──

export const TiebreakField = {
  TOTAL_BOOYAHS: 'total_booyahs',
  TOTAL_KILLS: 'total_kills',
  FINAL_MATCH_PLACEMENT: 'final_match_placement',
  AVERAGE_PLACEMENT: 'average_placement',
  HIGHER_PLACEMENT_COUNT: 'higher_placement_count',
  FEWER_PENALTIES: 'fewer_penalties',
  DECIDING_MATCH: 'deciding_match',
} as const;
export type TiebreakField = (typeof TiebreakField)[keyof typeof TiebreakField];

// ── Media ──

export const MediaPurpose = {
  TOURNAMENT_BANNER: 'tournament_banner',
  ORGANIZER_AVATAR: 'organizer_avatar',
  PLAYER_AVATAR: 'player_avatar',
  RESULT_EVIDENCE: 'result_evidence',
  DISPUTE_EVIDENCE: 'dispute_evidence',
  SPONSOR_LOGO: 'sponsor_logo',
  BANNER_IMAGE: 'banner_image',
  DEPOSIT_PROOF: 'deposit_proof',
} as const;
export type MediaPurpose = (typeof MediaPurpose)[keyof typeof MediaPurpose];

export const MediaAccessLevel = {
  PUBLIC: 'public_access',
  AUTHENTICATED: 'authenticated',
  RESTRICTED: 'restricted',
} as const;
export type MediaAccessLevel =
  (typeof MediaAccessLevel)[keyof typeof MediaAccessLevel];

// ── Platform ──

export const BannerLinkType = {
  TOURNAMENT: 'tournament',
  ORGANIZER: 'organizer',
  ANNOUNCEMENT: 'announcement',
  EXTERNAL: 'external',
} as const;
export type BannerLinkType =
  (typeof BannerLinkType)[keyof typeof BannerLinkType];
