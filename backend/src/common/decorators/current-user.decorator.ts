import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { UserRole } from '../../types/enums.js';

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
    return (request as FastifyRequest & { user: RequestUser }).user;
  },
);
