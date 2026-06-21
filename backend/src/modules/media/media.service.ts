/** MediaService - manage externally hosted media links. */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/database.service.js';
import { AuditService } from '../audit/audit.service.js';
import { BadRequestError, NotFoundError } from '../../lib/errors.js';
import { ErrorCodes } from '../../common/constants/error-codes.js';
import type { RequestUser } from '../../common/decorators/current-user.decorator.js';
import { MediaAuthorityService } from '../../domain/media-authority.service.js';
import type { RegisterMediaAssetInput } from './dto/media.dto.js';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authority: MediaAuthorityService,
    private readonly audit: AuditService,
  ) {}

  async registerAsset(params: RegisterMediaAssetInput & { uploaderId: string }) {
    const purpose = this.authority.assertPurpose(params.purpose);
    const details = this.authority.normalizeExternalAsset({
      purpose,
      url: params.url,
      format: params.format,
      width: params.width,
      height: params.height,
      sizeBytes: params.sizeBytes,
    });

    const existing = await this.prisma.mediaAsset.findFirst({
      where: { secureUrl: details.url },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestError(
        ErrorCodes.DUPLICATE_RESOURCE,
        'Media asset already registered.',
      );
    }

    const policy = this.authority.getPolicy(purpose);
    const asset = await this.prisma.mediaAsset.create({
      data: {
        uploaderId: params.uploaderId,
        purpose,
        accessLevel: policy.accessLevel,
        cloudinaryId: details.url,
        url: details.url,
        secureUrl: details.url,
        format: details.format,
        width: details.width,
        height: details.height,
        sizeBytes: details.sizeBytes,
      },
    });

    await this.audit.log({
      actorId: params.uploaderId,
      actorRole: 'user',
      action: 'media.asset_registered',
      resourceType: 'media_asset',
      resourceId: asset.id,
      newValue: {
        purpose,
        accessLevel: policy.accessLevel,
        url: details.url,
        sizeBytes: details.sizeBytes,
      },
    });

    this.logger.log({ assetId: asset.id, purpose }, 'Media asset registered');
    return asset;
  }

  async getById(assetId: string, user: RequestUser) {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id: assetId },
    });
    if (!asset) {
      throw new NotFoundError(
        ErrorCodes.RESOURCE_NOT_FOUND,
        'Media asset not found.',
      );
    }
    this.authority.assertCanReadAsset(user, asset);
    return asset;
  }

  async delete(assetId: string, user: RequestUser) {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id: assetId },
    });
    if (!asset) {
      throw new NotFoundError(
        ErrorCodes.RESOURCE_NOT_FOUND,
        'Media asset not found.',
      );
    }
    this.authority.assertCanDeleteAsset(user, asset);

    await this.prisma.mediaAsset.delete({ where: { id: assetId } });

    await this.audit.log({
      actorId: user.id,
      actorRole: user.role,
      action: 'media.asset_deleted',
      resourceType: 'media_asset',
      resourceId: asset.id,
      oldValue: {
        purpose: asset.purpose,
        accessLevel: asset.accessLevel,
        uploaderId: asset.uploaderId,
        url: asset.secureUrl,
      },
    });
  }
}
