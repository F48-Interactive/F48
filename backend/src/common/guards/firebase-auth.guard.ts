import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { FirebaseService } from '../../config/firebase.service.js';
import { PrismaService } from '../../config/database.service.js';
import { IS_PUBLIC_KEY } from '../decorators/index.js';
import type { RequestUser } from '../decorators/current-user.decorator.js';
import { UnauthorizedError } from '../../lib/errors.js';
import { ErrorCodes } from '../constants/error-codes.js';
import type { UserRole } from '../../types/enums.js';

/**
 * Firebase Authentication Guard (AUTH-003, AUTH-004).
 * Verifies either:
 * 1. Bearer token (Firebase ID token) in Authorization header
 * 2. Session cookie (f48_session) in cookies
 *
 * Attaches the authenticated user to the request as `request.user`.
 */
@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(FirebaseAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly firebase: FirebaseService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Skip public endpoints
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<FastifyRequest>();

    // Try Bearer token first, then session cookie
    const token = this.extractBearerToken(request);
    const sessionCookie = this.extractSessionCookie(request);

    if (!token && !sessionCookie) {
      throw new UnauthorizedError(
        ErrorCodes.AUTH_TOKEN_INVALID,
        'Authentication required. Provide a Bearer token or session cookie.',
      );
    }

    try {
      let firebaseUid: string;
      let email: string | undefined;

      if (token) {
        const decoded = await this.firebase.verifyIdToken(token);
        firebaseUid = decoded.uid;
        email = decoded.email;
      } else {
        const decoded = await this.firebase.verifySessionCookie(
          sessionCookie!,
        );
        firebaseUid = decoded.uid;
        email = decoded.email;
      }

      // Look up the F48 user by Firebase UID
      const user = await this.prisma.user.findUnique({
        where: { firebaseUid },
        select: { id: true, firebaseUid: true, email: true, role: true, status: true },
      });

      if (!user) {
        // User not yet registered in F48 — this is valid for the auth/register flow
        // Attach minimal info for the registration endpoint
        const requestUser: RequestUser = {
          id: '',
          firebaseUid,
          email: email ?? '',
          role: 'player' as UserRole,
          status: 'active',
          isNewUser: true,
        };
        (request as FastifyRequest & { user: RequestUser }).user = requestUser;
        return true;
      }

      // RBAC-004/005: Suspended/banned users CAN authenticate to view
      // account status and contact support. Action-level guards and
      // services block restricted operations (register, check-in, etc.).

      // Attach authenticated user to request
      const requestUser: RequestUser = {
        id: user.id,
        firebaseUid: user.firebaseUid,
        email: user.email,
        role: user.role as UserRole,
        status: user.status,
      };
      (request as FastifyRequest & { user: RequestUser }).user = requestUser;

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedError) throw error;

      this.logger.warn(
        { error: error instanceof Error ? error.message : 'Unknown' },
        'Authentication failed',
      );

      throw new UnauthorizedError(
        ErrorCodes.AUTH_TOKEN_EXPIRED,
        'Authentication token is invalid or expired.',
      );
    }
  }

  private extractBearerToken(request: FastifyRequest): string | null {
    const auth = request.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return null;
    return auth.slice(7);
  }

  private extractSessionCookie(request: FastifyRequest): string | null {
    const cookies = (request as FastifyRequest & { cookies?: Record<string, string> }).cookies;
    return cookies?.['f48_session'] ?? null;
  }
}
