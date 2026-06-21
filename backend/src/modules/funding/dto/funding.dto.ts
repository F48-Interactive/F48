/**
 * Funding DTOs.
 */
import { z } from 'zod';

export const CreateFundingRequestSchema = z.object({
  tournamentId: z.string().uuid(),
  requestedPaise: z.number().int().min(1),
});

export type CreateFundingRequestInput = z.infer<
  typeof CreateFundingRequestSchema
>;

export const ReviewFundingRequestSchema = z.object({
  decision: z.enum([
    'approved',
    'partially_approved',
    'rejected',
    'changes_required',
  ]),
  approvedPaise: z.number().int().min(1).optional(),
  notes: z.string().max(500).optional(),
});

export type ReviewFundingRequestInput = z.infer<
  typeof ReviewFundingRequestSchema
>;
