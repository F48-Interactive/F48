import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { UserRole } from '../../types/enums.js';
import { UnauthorizedError } from '../../lib/errors.js';
import { ErrorCodes } from '../constants/error-codes.js';

/**
 * Shape of the authenticated user attached to the request by AuthGuard.
 */
export interface RequestUser {
  id: string;
  firebaseUid: string;
  email: string;
  role: UserRole;
  status: string;
  isNewUser?: boolean;
}

/**
 * Param decorator to extract the authenticated user from the request.
 * @example
 * @Get('me')
 * getMe(@CurrentUser() user: RequestUser) { ... }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>();
    const user = (request as FastifyRequest & { user?: RequestUser }).user;

    if (!user) {
      throw new UnauthorizedError(
        ErrorCodes.AUTH_TOKEN_INVALID,
        'Authentication required.',
      );
    }

    return user;
  },
);
