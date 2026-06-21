import { z } from 'zod';

/**
 * Auth DTO Schemas (Zod).
 * Validation schemas and inferred types for auth endpoints.
 */

/** POST /auth/google — Google sign-in with Firebase ID token. */
export const GoogleLoginSchema = z.object({
  idToken: z.string().min(1, 'idToken is required'),
});
export type GoogleLoginDto = z.infer<typeof GoogleLoginSchema>;

/** POST /auth/session — Create a session cookie from a Firebase ID token. */
export const CreateSessionSchema = z.object({
  idToken: z.string().min(1, 'idToken is required'),
});
export type CreateSessionDto = z.infer<typeof CreateSessionSchema>;
