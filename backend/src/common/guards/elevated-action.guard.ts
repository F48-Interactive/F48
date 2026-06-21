import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { ELEVATED_ACTION_KEY } from '../decorators/index.js';
import type { RequestUser } from '../decorators/current-user.decorator.js';
import { ForbiddenError } from '../../lib/errors.js';
import { ErrorCodes } from '../constants/error-codes.js';

/**
 * Elevated Action Guard (SEC-009).
 * Admin actions involving money, bans, final results, or credentials
 * require an X-Elevated-Confirmation header.
 */
@Injectable()
export class ElevatedActionGuard implements CanActivate {
  private readonly logger = new Logger(ElevatedActionGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isElevated = this.reflector.getAllAndOverride<boolean>(
      ELEVATED_ACTION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!isElevated) return true;

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const user = (request as FastifyRequest & { user?: RequestUser }).user;

    if (!user) return true; // Auth guard handles this

    // Only admin roles require elevated confirmation
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      return true;
    }

    const confirmation = request.headers['x-elevated-confirmation'];
    if (confirmation !== 'true') {
      this.logger.warn(
        `Elevated action attempted without confirmation by admin ${user.id}`,
      );
      throw new ForbiddenError(
        ErrorCodes.ELEVATED_CONFIRMATION_REQUIRED,
        'This action requires elevated confirmation. Set X-Elevated-Confirmation: true header.',
      );
    }

    return true;
  }
}
