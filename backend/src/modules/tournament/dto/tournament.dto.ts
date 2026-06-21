/**
 * Tournament module DTOs — Zod validation schemas.
 * TOUR-001 to TOUR-004, SCORE-001/002, PRIZE-001/002/003.
 */
import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Create tournament (draft)
// ─────────────────────────────────────────────────────────────────────────────
const FundingTypeSchema = z.enum([
  'free',
  'organizer_funded',
  'f48_sponsored',
  'entry_fee',
]);

const StageConfigSchema = z.object({
  roomCount: z.number().int().min(1).max(4),
  matchesPerRoom: z.number().int().min(1).max(12),
  matchSchedule: z
    .array(
      z.object({
        roomOrder: z.number().int().min(1).max(4),
        matchOrder: z.number().int().min(1).max(12),
        scheduledAt: z.string().datetime().optional(),
        map: z.string().max(40).optional(),
      }),
    )
    .max(60)
    .default([]),
});

export const CreateTournamentSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().max(2000).optional(),
  mode: z.enum(['solo', 'duo', 'squad']),
  fundingType: FundingTypeSchema,
  structureType: z.literal('direct_final').default('direct_final'),
  scoringModel: z.enum(['combined', 'placement_only', 'kills_only']),
  maxUnits: z.number().int().min(2).max(192),
  entryFeePaise: z.number().int().min(0).optional(),
  prizePoolPaise: z.number().int().min(0).optional(),
  scheduledStartAt: z.string().datetime().optional(),
  registrationOpenAt: z.string().datetime().optional(),
  registrationCloseAt: z.string().datetime().optional(),
  checkInDurationMin: z.number().int().min(5).max(60).optional(),
  disputeWindowHours: z.number().int().min(1).max(72).optional(),
  gameMapId: z.string().uuid().optional(),
  rulesText: z.string().max(12000).optional(),
  stageConfig: StageConfigSchema.optional(),
});

export type CreateTournamentInput = z.infer<typeof CreateTournamentSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Update tournament (draft only)
// ─────────────────────────────────────────────────────────────────────────────
export const UpdateTournamentSchema = z.object({
  title: z.string().min(3).max(100).optional(),
  description: z.string().max(2000).optional(),
  mode: z.enum(['solo', 'duo', 'squad']).optional(),
  fundingType: FundingTypeSchema.optional(),
  structureType: z.literal('direct_final').optional(),
  maxUnits: z.number().int().min(2).max(192).optional(),
  entryFeePaise: z.number().int().min(0).optional(),
  prizePoolPaise: z.number().int().min(0).optional(),
  scheduledStartAt: z.string().datetime().optional(),
  registrationOpenAt: z.string().datetime().optional(),
  registrationCloseAt: z.string().datetime().optional(),
  checkInDurationMin: z.number().int().min(5).max(60).optional(),
  disputeWindowHours: z.number().int().min(1).max(72).optional(),
  gameMapId: z.string().uuid().optional(),
  rulesText: z.string().max(12000).optional(),
  bannerAssetId: z.string().uuid().optional(),
});

export type UpdateTournamentInput = z.infer<typeof UpdateTournamentSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Tournament status transition
// ─────────────────────────────────────────────────────────────────────────────
export const TransitionTournamentSchema = z.object({
  action: z.string().min(1),
  reason: z.string().max(500).optional(),
});

export type TransitionTournamentInput = z.infer<typeof TransitionTournamentSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Scoring config (placement points + kill multiplier)
// ─────────────────────────────────────────────────────────────────────────────
export const PlacementPointEntrySchema = z.object({
  position: z.number().int().min(1),
  points: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Points must be a decimal string'),
});

export const ScoringConfigSchema = z.object({
  scoringModel: z.enum(['combined', 'placement_only', 'kills_only']),
  killMultiplier: z.string().regex(/^\d+(\.\d{1,2})?$/).default('1.00'),
  placementPoints: z.array(PlacementPointEntrySchema).min(1),
});

export type ScoringConfigInput = z.infer<typeof ScoringConfigSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Prize rules
// ─────────────────────────────────────────────────────────────────────────────
export const PrizeRuleEntrySchema = z.object({
  rankStart: z.number().int().min(1),
  rankEnd: z.number().int().min(1),
  amountPaise: z.number().int().min(0),
});

export const PrizeConfigSchema = z.object({
  rules: z.array(PrizeRuleEntrySchema).min(1),
});

export type PrizeConfigInput = z.infer<typeof PrizeConfigSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Tiebreak rules
// ─────────────────────────────────────────────────────────────────────────────
export const TiebreakRuleEntrySchema = z.object({
  priority: z.number().int().min(1),
  field: z.enum([
    'total_booyahs', 'total_kills', 'final_match_placement',
    'average_placement', 'higher_placement_count', 'fewer_penalties',
    'deciding_match',
  ]),
});

export const TiebreakConfigSchema = z.object({
  rules: z.array(TiebreakRuleEntrySchema).min(1),
});

export type TiebreakConfigInput = z.infer<typeof TiebreakConfigSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Tournament list query
// ─────────────────────────────────────────────────────────────────────────────
export const TournamentListSchema = z.object({
  status: z.string().optional(),
  mode: z.enum(['solo', 'duo', 'squad']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type TournamentListInput = z.infer<typeof TournamentListSchema>;
