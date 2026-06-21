import { Injectable } from '@nestjs/common';
import type { RequestUser } from '../common/decorators/current-user.decorator.js';
import { ErrorCodes } from '../common/constants/error-codes.js';
import { BadRequestError, ForbiddenError } from '../lib/errors.js';
import { AccessAuthorityService } from './access-authority.service.js';

export const MEDIA_PURPOSES = [
  'tournament_banner',
  'organizer_avatar',
  'player_avatar',
  'result_evidence',
  'dispute_evidence',
  'sponsor_logo',
  'banner_image',
  'deposit_proof',
] as const;

export type MediaPurpose = (typeof MEDIA_PURPOSES)[number];
export type MediaAccessLevel = 'public_access' | 'authenticated' | 'restricted';

interface MediaPolicy {
  accessLevel: MediaAccessLevel;
  allowedFormats: readonly string[];
  maxBytes: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

interface ExternalAssetInput {
  purpose: MediaPurpose;
  url: string;
  format?: string;
  width?: number;
  height?: number;
  sizeBytes?: number;
}

interface NormalizedExternalAsset {
  url: string;
  format: string;
  width?: number;
  height?: number;
  sizeBytes: number;
}

const IMAGE_FORMATS = ['jpg', 'jpeg', 'png', 'webp'] as const;

const PURPOSE_POLICY: Record<MediaPurpose, MediaPolicy> = {
  tournament_banner: {
    accessLevel: 'public_access',
    allowedFormats: IMAGE_FORMATS,
    maxBytes: 5 * 1024 * 1024,
    minWidth: 1200,
    minHeight: 400,
    maxWidth: 4096,
    maxHeight: 2160,
  },
  organizer_avatar: {
    accessLevel: 'public_access',
    allowedFormats: IMAGE_FORMATS,
    maxBytes: 2 * 1024 * 1024,
    minWidth: 128,
    minHeight: 128,
    maxWidth: 2048,
    maxHeight: 2048,
  },
  player_avatar: {
    accessLevel: 'public_access',
    allowedFormats: IMAGE_FORMATS,
    maxBytes: 2 * 1024 * 1024,
    minWidth: 128,
    minHeight: 128,
    maxWidth: 2048,
    maxHeight: 2048,
  },
  result_evidence: {
    accessLevel: 'restricted',
    allowedFormats: IMAGE_FORMATS,
    maxBytes: 8 * 1024 * 1024,
    maxWidth: 4096,
    maxHeight: 4096,
  },
  dispute_evidence: {
    accessLevel: 'restricted',
    allowedFormats: IMAGE_FORMATS,
    maxBytes: 8 * 1024 * 1024,
    maxWidth: 4096,
    maxHeight: 4096,
  },
  sponsor_logo: {
    accessLevel: 'public_access',
    allowedFormats: IMAGE_FORMATS,
    maxBytes: 2 * 1024 * 1024,
    minWidth: 128,
    minHeight: 128,
    maxWidth: 2048,
    maxHeight: 2048,
  },
  banner_image: {
    accessLevel: 'public_access',
    allowedFormats: IMAGE_FORMATS,
    maxBytes: 5 * 1024 * 1024,
    minWidth: 1200,
    minHeight: 400,
    maxWidth: 4096,
    maxHeight: 2160,
  },
  deposit_proof: {
    accessLevel: 'restricted',
    allowedFormats: IMAGE_FORMATS,
    maxBytes: 8 * 1024 * 1024,
    maxWidth: 4096,
    maxHeight: 4096,
  },
};

@Injectable()
export class MediaAuthorityService {
  constructor(private readonly access: AccessAuthorityService) {}

  assertPurpose(value: string): MediaPurpose {
    if (!MEDIA_PURPOSES.includes(value as MediaPurpose)) {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        'Unsupported media purpose.',
      );
    }
    return value as MediaPurpose;
  }

  getPolicy(purpose: MediaPurpose): MediaPolicy {
    return PURPOSE_POLICY[purpose];
  }

  normalizeExternalAsset(input: ExternalAssetInput): NormalizedExternalAsset {
    const url = this.normalizeUrl(input.url);
    const format = (input.format ?? this.inferFormat(url)).toLowerCase();
    const details = {
      url,
      format,
      width: input.width,
      height: input.height,
      sizeBytes: input.sizeBytes ?? 0,
    };

    this.assertAssetMatchesPolicy(input.purpose, details);
    return details;
  }

  assertCanReadAsset(
    user: RequestUser,
    asset: { uploaderId: string; accessLevel: string },
  ): void {
    if (
      asset.accessLevel === 'public_access' ||
      asset.accessLevel === 'authenticated'
    ) {
      return;
    }

    if (this.access.isAdmin(user) || asset.uploaderId === user.id) {
      return;
    }

    throw new ForbiddenError(
      ErrorCodes.FORBIDDEN,
      'Not authorized for this asset.',
    );
  }

  assertCanDeleteAsset(user: RequestUser, asset: { uploaderId: string }): void {
    if (this.access.isAdmin(user) || asset.uploaderId === user.id) return;
    throw new ForbiddenError(
      ErrorCodes.FORBIDDEN,
      'Not authorized for this asset.',
    );
  }

  private normalizeUrl(value: string): string {
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        'Media URL is invalid.',
      );
    }

    if (parsed.protocol !== 'https:') {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        'Media URL must use HTTPS.',
      );
    }

    parsed.hash = '';
    return parsed.toString();
  }

  private inferFormat(url: string): string {
    const pathname = new URL(url).pathname.toLowerCase();
    const match = pathname.match(/\.([a-z0-9]+)$/);
    return match?.[1] ?? '';
  }

  private assertAssetMatchesPolicy(
    purpose: MediaPurpose,
    details: NormalizedExternalAsset,
  ): void {
    const policy = this.getPolicy(purpose);
    const format = details.format.toLowerCase();

    if (!policy.allowedFormats.includes(format)) {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        'Unsupported media format.',
      );
    }

    if (details.sizeBytes > policy.maxBytes) {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        'Media asset exceeds the allowed size.',
      );
    }

    if (policy.minWidth && details.width && details.width < policy.minWidth) {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        'Media asset is too narrow for this purpose.',
      );
    }
    if (
      policy.minHeight &&
      details.height &&
      details.height < policy.minHeight
    ) {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        'Media asset is too short for this purpose.',
      );
    }
    if (policy.maxWidth && details.width && details.width > policy.maxWidth) {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        'Media asset is too wide for this purpose.',
      );
    }
    if (
      policy.maxHeight &&
      details.height &&
      details.height > policy.maxHeight
    ) {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        'Media asset is too tall for this purpose.',
      );
    }
  }
}
