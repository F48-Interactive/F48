/**
 * MediaService — Manage media assets (Cloudinary signed upload flow).
 * MEDIA-001/002: Client uploads to Cloudinary with signed signature,
 * then registers the asset here.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/database.service.js';
import { CloudinaryAdapter } from '../../providers/cloudinary/cloudinary.adapter.js';
import { AuditService } from '../audit/audit.service.js';
import { BadRequestError, NotFoundError } from '../../lib/errors.js';
import { ErrorCodes } from '../../common/constants/error-codes.js';
import type { RequestUser } from '../../common/decorators/current-user.decorator.js';
import { MediaAuthorityService } from '../../domain/media-authority.service.js';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryAdapter,
    private readonly authority: MediaAuthorityService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Generate a signed upload signature for client-side Cloudinary upload.
   * The client uses this to upload directly to Cloudinary (MEDIA-002).
   */
  async getUploadSignature(purpose: string) {
    const mediaPurpose = this.authority.assertPurpose(purpose);
    const policy = this.authority.getPolicy(mediaPurpose);
    const folder = this.authority.folderForPurpose(mediaPurpose);
    const signature = await this.cloudinary.generateUploadSignature(folder, [
      ...policy.allowedFormats,
    ]);
    return signature;
  }

  /**
   * Register an uploaded asset after client completes Cloudinary upload.
   * Client sends the publicId back and we verify + store metadata.
   */
  async registerAsset(params: {
    uploaderId: string;
    purpose: string;
    publicId: string;
  }) {
    const purpose = this.authority.assertPurpose(params.purpose);
    this.authority.assertPublicIdMatchesPurpose(params.publicId, purpose);

    const existing = await this.prisma.mediaAsset.findFirst({
      where: { cloudinaryId: params.publicId },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestError(
        ErrorCodes.DUPLICATE_RESOURCE,
        'Media asset already registered.',
      );
    }

    const details = await this.cloudinary.getAssetDetails(params.publicId);

    if (!details) {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        'Cloudinary asset not found. Upload may have failed.',
      );
    }
    this.authority.assertAssetMatchesPolicy(purpose, details);

    const policy = this.authority.getPolicy(purpose);

    const asset = await this.prisma.mediaAsset.create({
      data: {
        uploaderId: params.uploaderId,
        purpose,
        accessLevel: policy.accessLevel,
        cloudinaryId: details.publicId,
        url: details.url,
        secureUrl: details.secureUrl,
        format: details.format,
        width: details.width,
        height: details.height,
        sizeBytes: details.bytes,
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
        sizeBytes: details.bytes,
      },
    });

    this.logger.log({ assetId: asset.id, purpose }, 'Media asset registered');
    return asset;
  }

  /** Get media asset by ID. */
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

    if (asset.accessLevel === 'restricted') {
      const signedUrl = this.cloudinary.generateSignedUrl(
        asset.cloudinaryId,
        300,
      );
      return { ...asset, url: signedUrl, secureUrl: signedUrl, signedUrl };
    }

    return asset;
  }

  /** Delete media asset. */
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

    await this.cloudinary.deleteAsset(asset.cloudinaryId);
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
      },
    });
  }
}
