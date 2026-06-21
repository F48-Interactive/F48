/**
 * Registration DTOs — Zod validation schemas.
 * REG-001 to REG-011.
 */
import { z } from 'zod';

export const RegisterSoloSchema = z.object({
  tournamentId: z.string().uuid(),
});

export type RegisterSoloInput = z.infer<typeof RegisterSoloSchema>;

export const RegisterTeamSchema = z.object({
  tournamentId: z.string().uuid(),
  memberPlayerIds: z.array(z.string().uuid()).min(1),
  teamName: z.string().min(2).max(50).optional(),
});

export type RegisterTeamInput = z.infer<typeof RegisterTeamSchema>;

export const TeamInviteResponseSchema = z.object({
  response: z.enum(['accepted', 'declined']),
});

export type TeamInviteResponseInput = z.infer<typeof TeamInviteResponseSchema>;

export const CheckInSchema = z.object({
  registrationId: z.string().uuid(),
});

export type CheckInInput = z.infer<typeof CheckInSchema>;
