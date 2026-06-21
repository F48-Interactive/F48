import { Injectable, Logger } from '@nestjs/common';
import { FirebaseService } from '../../config/firebase.service.js';
import { PrismaService } from '../../config/database.service.js';
import { AuditService } from '../audit/audit.service.js';
import { EnvService } from '../../config/env.service.js';
import { UnauthorizedError, NotFoundError, InternalError } from '../../lib/errors.js';
import { ErrorCodes } from '../../common/constants/error-codes.js';

/** 14 days in milliseconds. */
const SESSION_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Auth Service — handles Google login, session cookies, and user lookup.
 * AUTH-003: Firebase ID token verification.
 * AUTH-004: Session cookie management.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly firebase: FirebaseService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly env: EnvService,
  ) {}

  /**
   * Verify a Google ID token and upsert the user in the database.
   * Returns the user record and whether it was newly created.
   */
  async googleLogin(idToken: string) {
    // 1. Verify the Firebase ID token
    let decoded;
    try {
      decoded = await this.firebase.verifyIdToken(idToken);
    } catch (error) {
      this.logger.warn(
        { error: error instanceof Error ? error.message : 'Unknown' },
        'Google login: ID token verification failed',
      );
      throw new UnauthorizedError(
        ErrorCodes.AUTH_TOKEN_INVALID,
        'Invalid or expired Google ID token.',
      );
    }

    const { uid: firebaseUid, email } = decoded;

    if (!email) {
      throw new UnauthorizedError(
        ErrorCodes.AUTH_TOKEN_INVALID,
        'Google account does not have an email address.',
      );
    }

    // 2. Upsert user: find by firebase_uid, create if not exists
    let isNewUser = false;
    let user = await this.prisma.user.findUnique({
      where: { firebaseUid },
      include: { player: true, organizer: true },
    });

    if (!user) {
      isNewUser = true;
      user = await this.prisma.user.create({
        data: {
          firebaseUid,
          email,
        },
        include: { player: true, organizer: true },
      });
      this.logger.log(`New user created: ${user.id} (${email})`);
    } else if (user.email !== email) {
      // Sync email if it changed on Google's side
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { email },
        include: { player: true, organizer: true },
      });
    }

    // 3. Audit log
    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'AUTH_LOGIN_GOOGLE',
      resourceType: 'User',
      resourceId: user.id,
      newValue: { isNewUser, email },
    });

    return { user, isNewUser };
  }

  /**
   * Create a 14-day session cookie from a Firebase ID token (AUTH-004).
   */
  async createSessionCookie(idToken: string): Promise<string> {
    try {
      return await this.firebase.createSessionCookie(idToken, SESSION_MAX_AGE_MS);
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : 'Unknown' },
        'Failed to create session cookie',
      );
      throw new InternalError(
        ErrorCodes.INTERNAL_ERROR,
        'Failed to create session cookie.',
      );
    }
  }

  /**
   * Logout: revoke Firebase refresh tokens and audit the action.
   */
  async logout(userId: string, sessionCookie: string): Promise<void> {
    try {
      // Verify session to get the Firebase UID
      const decoded = await this.firebase.verifySessionCookie(sessionCookie);
      await this.firebase.revokeRefreshTokens(decoded.uid);
    } catch (error) {
      // Even if revocation fails, we still clear the cookie on the client
      this.logger.warn(
        { error: error instanceof Error ? error.message : 'Unknown', userId },
        'Token revocation failed during logout (continuing)',
      );
    }

    // Audit log
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    await this.audit.log({
      actorId: userId,
      actorRole: user?.role ?? 'player',
      action: 'AUTH_LOGOUT',
      resourceType: 'User',
      resourceId: userId,
    });
  }

  /**
   * Get the current user with player and organizer profiles included.
   */
  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { player: true, organizer: true },
    });

    if (!user) {
      throw new NotFoundError(
        ErrorCodes.RESOURCE_NOT_FOUND,
        'User not found.',
      );
    }

    return user;
  }

  /**
   * Get the session cookie max-age in milliseconds.
   */
  get sessionMaxAgeMs(): number {
    return SESSION_MAX_AGE_MS;
  }
}
