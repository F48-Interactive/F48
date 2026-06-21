import { z } from 'zod';

export const MediaPurposeSchema = z.enum([
  'tournament_banner',
  'organizer_avatar',
  'player_avatar',
  'result_evidence',
  'dispute_evidence',
  'sponsor_logo',
  'banner_image',
  'deposit_proof',
]);

export const ImageFormatSchema = z.enum(['jpg', 'jpeg', 'png', 'webp']);

export const RegisterMediaAssetSchema = z.object({
  purpose: MediaPurposeSchema,
  url: z.string().url().max(2048),
  format: ImageFormatSchema.optional(),
  width: z.number().int().positive().max(10000).optional(),
  height: z.number().int().positive().max(10000).optional(),
  sizeBytes: z.number().int().nonnegative().max(50 * 1024 * 1024).optional(),
});

export type RegisterMediaAssetInput = z.infer<typeof RegisterMediaAssetSchema>;
