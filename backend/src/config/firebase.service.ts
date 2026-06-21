import {
  Injectable,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import {
  initializeApp,
  getApps,
  cert,
  type App,
} from 'firebase-admin/app';
import { getAuth, type Auth, type DecodedIdToken } from 'firebase-admin/auth';
import { EnvService } from './env.service.js';

/**
 * Firebase Admin SDK service.
 * Provides token verification and session cookie management (AUTH-003/004).
 * ARCH-011: Private key comes from env vars, never from committed source.
 */
@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private _app: App | null = null;

  constructor(private readonly env: EnvService) {}

  get app(): App {
    if (!this._app) {
      throw new Error('Firebase Admin SDK not initialized');
    }
    return this._app;
  }

  get auth(): Auth {
    return getAuth(this.app);
  }

  onModuleInit(): void {
    const existingApps = getApps();
    if (existingApps.length > 0) {
      this._app = existingApps[0]!;
      this.logger.log('Firebase Admin SDK: using existing app');
      return;
    }

    this._app = initializeApp({
      credential: cert({
        projectId: this.env.firebaseProjectId,
        clientEmail: this.env.firebaseClientEmail,
        privateKey: this.env.firebasePrivateKey.replace(/\\n/g, '\n'),
      }),
      projectId: this.env.firebaseProjectId,
    });

    this.logger.log(
      `Firebase Admin SDK initialized for project: ${this.env.firebaseProjectId}`,
    );
  }

  /**
   * Verify a Firebase ID token (AUTH-003).
   */
  async verifyIdToken(idToken: string): Promise<DecodedIdToken> {
    return this.auth.verifyIdToken(idToken, true);
  }

  /**
   * Create a session cookie from an ID token (AUTH-004).
   */
  async createSessionCookie(
    idToken: string,
    maxAgeMs: number,
  ): Promise<string> {
    return this.auth.createSessionCookie(idToken, {
      expiresIn: maxAgeMs,
    });
  }

  /**
   * Verify a session cookie (AUTH-004).
   */
  async verifySessionCookie(sessionCookie: string): Promise<DecodedIdToken> {
    return this.auth.verifySessionCookie(sessionCookie, true);
  }

  /**
   * Revoke refresh tokens for a user (logout/security).
   */
  async revokeRefreshTokens(uid: string): Promise<void> {
    await this.auth.revokeRefreshTokens(uid);
  }
}
