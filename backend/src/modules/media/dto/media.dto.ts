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

export const RegisterMediaAssetSchema = z.object({
  purpose: MediaPurposeSchema,
  publicId: z.string().min(3).max(500),
});

export type RegisterMediaAssetInput = z.infer<typeof RegisterMediaAssetSchema>;
