/**
 * Player module DTOs — Zod validation schemas.
 * PLAYER-001 to PLAYER-010.
 */
import { z } from 'zod';

const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;

// ─────────────────────────────────────────────────────────────────────────────
// Create player profile
// ─────────────────────────────────────────────────────────────────────────────
export const CreatePlayerSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username cannot exceed 20 characters')
    .regex(USERNAME_REGEX, 'Username can only contain letters, numbers, and underscores'),
});

export type CreatePlayerInput = z.infer<typeof CreatePlayerSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Update player profile
// ─────────────────────────────────────────────────────────────────────────────
export const UpdatePlayerSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username cannot exceed 20 characters')
    .regex(USERNAME_REGEX, 'Username can only contain letters, numbers, and underscores')
    .optional(),
  displayName: z
    .string()
    .max(50, 'Display name cannot exceed 50 characters')
    .optional(),
});

export type UpdatePlayerInput = z.infer<typeof UpdatePlayerSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// FF UID lookup
// ─────────────────────────────────────────────────────────────────────────────
export const FfLookupSchema = z.object({
  ffUid: z.string().min(1, 'Free Fire UID is required'),
});

export type FfLookupInput = z.infer<typeof FfLookupSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// FF UID bind confirmation
// ─────────────────────────────────────────────────────────────────────────────
export const FfBindSchema = z.object({
  ffUid: z.string().min(1, 'Free Fire UID is required'),
  ffNickname: z.string().min(1, 'Free Fire nickname is required'),
});

export type FfBindInput = z.infer<typeof FfBindSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Player search
// ─────────────────────────────────────────────────────────────────────────────
export const PlayerSearchSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  type: z.enum(['platform_id', 'username']),
});

export type PlayerSearchInput = z.infer<typeof PlayerSearchSchema>;
