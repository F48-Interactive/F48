/**
 * MediaService — Manage media assets (Cloudinary signed upload flow).
 * MEDIA-001/002: Client uploads to Cloudinary with signed signature,
 * then registers the asset here.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/database.service.js';
import { CloudinaryAdapter } from '../../providers/cloudinary/cloudinary.adapter.js';
import { BadRequestError, NotFoundError } from '../../lib/errors.js';
import { ErrorCodes } from '../../common/constants/error-codes.js';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryAdapter,
  ) {}

  /**
   * Generate a signed upload signature for client-side Cloudinary upload.
   * The client uses this to upload directly to Cloudinary (MEDIA-002).
   */
  async getUploadSignature(purpose: string) {
    const folder = `f48/${purpose}`;
    const signature = await this.cloudinary.generateUploadSignature(
      folder,
      ['jpg', 'jpeg', 'png', 'webp'],
    );
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
    const details = await this.cloudinary.getAssetDetails(params.publicId);

    if (!details) {
      throw new BadRequestError(
        ErrorCodes.VALIDATION_FAILED,
        'Cloudinary asset not found. Upload may have failed.',
      );
    }

    const asset = await this.prisma.mediaAsset.create({
      data: {
        uploaderId: params.uploaderId,
        purpose: params.purpose as any,
        cloudinaryId: details.publicId,
        url: details.url,
        secureUrl: details.secureUrl,
        format: details.format,
        width: details.width,
        height: details.height,
        sizeBytes: details.bytes,
      },
    });

    this.logger.log({ assetId: asset.id, purpose: params.purpose }, 'Media asset registered');
    return asset;
  }

  /** Get media asset by ID. */
  async getById(assetId: string) {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id: assetId } });
    if (!asset) {
      throw new NotFoundError(ErrorCodes.RESOURCE_NOT_FOUND, 'Media asset not found.');
    }
    return asset;
  }

  /** Delete media asset. */
  async delete(assetId: string, userId: string) {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id: assetId } });
    if (!asset) {
      throw new NotFoundError(ErrorCodes.RESOURCE_NOT_FOUND, 'Media asset not found.');
    }
    if (asset.uploaderId !== userId) {
      throw new BadRequestError(ErrorCodes.FORBIDDEN, 'Not your asset.');
    }

    await this.cloudinary.deleteAsset(asset.cloudinaryId);
    await this.prisma.mediaAsset.delete({ where: { id: assetId } });
  }
}
