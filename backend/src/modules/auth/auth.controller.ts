import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from './auth.service.js';
import { EnvService } from '../../config/env.service.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { Public, CurrentUser } from '../../common/decorators/index.js';
import type { RequestUser } from '../../common/decorators/current-user.decorator.js';
import { GoogleLoginSchema, type GoogleLoginDto } from './dto/auth.dto.js';
import { CreateSessionSchema, type CreateSessionDto } from './dto/auth.dto.js';
import { UnauthorizedError } from '../../lib/errors.js';
import { ErrorCodes } from '../../common/constants/error-codes.js';

/** Cookie name for the F48 session (AUTH-004). */
const SESSION_COOKIE = 'f48_session';

/** 14 days in seconds for cookie maxAge. */
const SESSION_MAX_AGE_SECONDS = 14 * 24 * 60 * 60;

/**
 * Auth Controller — handles Google login, session management, and user info.
 */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly env: EnvService,
  ) {}

  /**
   * POST /auth/google
   * Public endpoint: verify Google ID token, upsert user, set session cookie.
   */
  @Public()
  @Post('google')
  @ApiOperation({ summary: 'Google sign-in with Firebase ID token' })
  @ApiResponse({ status: 200, description: 'Login successful, session cookie set' })
  @ApiResponse({ status: 401, description: 'Invalid ID token' })
  async googleLogin(
    @Body(new ZodValidationPipe(GoogleLoginSchema)) dto: GoogleLoginDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const { user, isNewUser } = await this.authService.googleLogin(dto.idToken);

    // Create a session cookie from the same ID token
    const sessionCookie = await this.authService.createSessionCookie(dto.idToken);
    this.setSessionCookie(reply, sessionCookie);

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        isNewUser,
        player: user.player ?? null,
        organizer: user.organizer ?? null,
      },
    };
  }

  /**
   * POST /auth/session
   * Authenticated (Bearer token): create a session cookie from an ID token.
   */
  @Post('session')
  @ApiOperation({ summary: 'Create session cookie from ID token' })
  @ApiResponse({ status: 200, description: 'Session cookie set' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createSession(
    @Body(new ZodValidationPipe(CreateSessionSchema)) dto: CreateSessionDto,
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const sessionCookie = await this.authService.createSessionCookie(dto.idToken);
    this.setSessionCookie(reply, sessionCookie);

    return { message: 'Session created successfully' };
  }

  /**
   * POST /auth/logout
   * Authenticated: clear session cookie and revoke refresh tokens.
   */
  @Post('logout')
  @ApiOperation({ summary: 'Logout and revoke session' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async logout(
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    // Extract session cookie from the request (via reply's raw)
    const request = reply.request as FastifyRequest & { cookies?: Record<string, string> };
    const sessionCookie = request.cookies?.[SESSION_COOKIE] ?? '';

    await this.authService.logout(user.id, sessionCookie);
    this.clearSessionCookie(reply);

    return { message: 'Logged out successfully' };
  }

  /**
   * GET /auth/me
   * Authenticated: get current user with player and organizer profiles.
   */
  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiResponse({ status: 200, description: 'User data with profiles' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getMe(@CurrentUser() user: RequestUser) {
    if (user.isNewUser) {
      // User authenticated via Firebase but not yet in F48 DB
      return {
        user: {
          id: null,
          firebaseUid: user.firebaseUid,
          email: user.email,
          role: user.role,
          status: user.status,
          isNewUser: true,
          player: null,
          organizer: null,
        },
      };
    }

    const fullUser = await this.authService.getMe(user.id);

    return {
      user: {
        id: fullUser.id,
        email: fullUser.email,
        role: fullUser.role,
        status: fullUser.status,
        isNewUser: false,
        player: fullUser.player ?? null,
        organizer: fullUser.organizer ?? null,
      },
    };
  }

  // ── Private Helpers ──

  /** Set the f48_session cookie on the Fastify reply. */
  private setSessionCookie(reply: FastifyReply, cookie: string): void {
    reply.setCookie(SESSION_COOKIE, cookie, {
      httpOnly: true,
      secure: !this.env.isDevelopment,
      sameSite: 'strict',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
  }

  /** Clear the f48_session cookie on the Fastify reply. */
  private clearSessionCookie(reply: FastifyReply): void {
    reply.clearCookie(SESSION_COOKIE, {
      httpOnly: true,
      secure: !this.env.isDevelopment,
      sameSite: 'strict',
      path: '/',
    });
  }
}
