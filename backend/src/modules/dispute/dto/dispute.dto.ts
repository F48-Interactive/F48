import { z } from 'zod';

export const DisputeCategorySchema = z.enum([
  'incorrect_score',
  'wrong_placement',
  'kill_count_mismatch',
  'wrong_player',
  'technical_issue',
  'rule_violation',
  'unfair_play',
  'other',
]);

export const DisputeStatusSchema = z.enum([
  'submitted',
  'under_review',
  'info_requested',
  'investigating',
  'resolved_accepted',
  'resolved_rejected',
  'resolved_partial',
  'withdrawn',
]);

export const FileDisputeSchema = z.object({
  matchResultId: z.string().uuid(),
  category: DisputeCategorySchema,
  description: z.string().trim().min(10).max(4000),
  evidenceAssetIds: z.array(z.string().uuid()).max(10).default([]),
});

export const TransitionDisputeSchema = z.object({
  status: DisputeStatusSchema,
  resolution: z.string().trim().min(10).max(4000).optional(),
});

export type FileDisputeInput = z.infer<typeof FileDisputeSchema>;
export type TransitionDisputeInput = z.infer<typeof TransitionDisputeSchema>;
