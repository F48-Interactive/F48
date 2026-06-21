/**
 * Organizer module DTOs — Zod validation schemas.
 * ORG-ID-001/002/003.
 */
import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Create organizer profile
// ─────────────────────────────────────────────────────────────────────────────
export const CreateOrganizerSchema = z.object({
  displayName: z
    .string()
    .min(2, 'Display name must be at least 2 characters')
    .max(50, 'Display name cannot exceed 50 characters'),
  description: z
    .string()
    .max(500, 'Description cannot exceed 500 characters')
    .optional(),
});

export type CreateOrganizerInput = z.infer<typeof CreateOrganizerSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Update organizer profile
// ─────────────────────────────────────────────────────────────────────────────
export const UpdateOrganizerSchema = z.object({
  displayName: z
    .string()
    .min(2, 'Display name must be at least 2 characters')
    .max(50, 'Display name cannot exceed 50 characters')
    .optional(),
  description: z
    .string()
    .max(500, 'Description cannot exceed 500 characters')
    .optional(),
  avatarAssetId: z.string().uuid().optional(),
});

export type UpdateOrganizerInput = z.infer<typeof UpdateOrganizerSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Submit YouTube channel URL
// ─────────────────────────────────────────────────────────────────────────────
const YOUTUBE_URL_REGEX =
  /^https?:\/\/(www\.)?youtube\.com\/(channel\/|@|c\/)/i;

export const SubmitYoutubeSchema = z.object({
  channelUrl: z
    .string()
    .url('Must be a valid URL')
    .regex(YOUTUBE_URL_REGEX, 'Must be a valid YouTube channel URL'),
});

export type SubmitYoutubeInput = z.infer<typeof SubmitYoutubeSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Admin verification decision
// ─────────────────────────────────────────────────────────────────────────────
export const VerificationDecisionSchema = z.object({
  decision: z.enum(['approved', 'rejected', 'restricted', 'suspended']),
  reason: z
    .string()
    .min(10, 'Reason must be at least 10 characters')
    .max(500, 'Reason cannot exceed 500 characters'),
  fundingEligibility: z
    .enum(['not_eligible', 'eligible'])
    .optional()
    .default('not_eligible'),
});

export type VerificationDecisionInput = z.infer<
  typeof VerificationDecisionSchema
>;
