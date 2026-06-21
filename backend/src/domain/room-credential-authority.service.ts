import { Injectable } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import { EnvService } from '../config/env.service.js';
import { ErrorCodes } from '../common/constants/error-codes.js';
import { InternalError } from '../lib/errors.js';

const ENCRYPTED_PREFIX = 'enc:v1';

@Injectable()
export class RoomCredentialAuthorityService {
  private readonly key: Buffer;

  constructor(env: EnvService) {
    this.key = createHash('sha256').update(env.roomCredentialsSecret).digest();
  }

  protect(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return `${ENCRYPTED_PREFIX}:${iv.toString('base64url')}:${tag.toString('base64url')}:${ciphertext.toString('base64url')}`;
  }

  reveal(value: string): string {
    if (!value.startsWith(`${ENCRYPTED_PREFIX}:`)) return value;

    const [, , ivText, tagText, ciphertextText] = value.split(':');
    if (!ivText || !tagText || !ciphertextText) {
      throw new InternalError(
        ErrorCodes.INTERNAL_ERROR,
        'Room credential payload is malformed.',
      );
    }

    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.key,
        Buffer.from(ivText, 'base64url'),
      );
      decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(ciphertextText, 'base64url')),
        decipher.final(),
      ]);
      return plaintext.toString('utf8');
    } catch {
      throw new InternalError(
        ErrorCodes.INTERNAL_ERROR,
        'Room credential payload could not be decrypted.',
      );
    }
  }

  protectPayload(payload: {
    roomId: string;
    roomPass: string;
    customCode?: string;
  }) {
    return {
      roomId: this.protect(payload.roomId),
      roomPass: this.protect(payload.roomPass),
      customCode: payload.customCode ? this.protect(payload.customCode) : null,
    };
  }

  revealPayload(payload: {
    id: string;
    matchId: string;
    roomId: string;
    roomPass: string;
    customCode: string | null;
    releasedAt: Date;
  }) {
    return {
      ...payload,
      roomId: this.reveal(payload.roomId),
      roomPass: this.reveal(payload.roomPass),
      customCode: payload.customCode ? this.reveal(payload.customCode) : null,
    };
  }
}
