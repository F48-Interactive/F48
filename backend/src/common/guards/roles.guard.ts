import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { ROLES_KEY, IS_PUBLIC_KEY } from '../decorators/index.js';
import type { UserRole } from '../../types/enums.js';
import type { RequestUser } from '../decorators/current-user.decorator.js';
import { ForbiddenError } from '../../lib/errors.js';
import { ErrorCodes } from '../constants/error-codes.js';

/**
 * RBAC Guard (RBAC-001).
 * Checks that the authenticated user has one of the required roles.
 * Skips if @Public() is set or no @Roles() metadata is defined.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Skip public endpoints
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) return true;

    // Get required roles from metadata
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) return true;

    // Check user role
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const user = (request as FastifyRequest & { user?: RequestUser }).user;

    if (!user) {
      throw new ForbiddenError(
        ErrorCodes.FORBIDDEN,
        'Authentication required',
      );
    }

    if (!requiredRoles.includes(user.role)) {
      this.logger.warn(
        `Access denied: user ${user.id} with role '${user.role}' attempted action requiring ${requiredRoles.join(', ')}`,
      );
      throw new ForbiddenError(
        ErrorCodes.INSUFFICIENT_ROLE,
        'You do not have permission to perform this action',
        { requiredRoles },
      );
    }

    return true;
  }
}
