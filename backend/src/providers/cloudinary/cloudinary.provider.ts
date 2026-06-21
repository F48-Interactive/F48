import { Injectable, Logger } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { EnvService } from '../../config/env.service.js';
import {
  CloudinaryAdapter,
  type CloudinaryUploadSignature,
  type CloudinaryAssetResult,
  type CloudinaryDeleteResult,
} from './cloudinary.adapter.js';

/**
 * Real Cloudinary provider (MEDIA-001/002/003).
 * Uses signed upload flows — clients upload directly to Cloudinary
 * after receiving a signature from the backend.
 */
@Injectable()
export class CloudinaryProvider extends CloudinaryAdapter {
  private readonly logger = new Logger(CloudinaryProvider.name);

  constructor(private readonly env: EnvService) {
    super();
    cloudinary.config({
      cloud_name: env.cloudinaryCloudName,
      api_key: env.cloudinaryApiKey,
      api_secret: env.cloudinaryApiSecret,
      secure: true,
    });
    this.logger.log(`Cloudinary configured for cloud: ${env.cloudinaryCloudName}`);
  }

  async generateUploadSignature(
    folder: string,
    allowedFormats?: string[],
  ): Promise<CloudinaryUploadSignature> {
    const timestamp = Math.round(Date.now() / 1000);

    const params: Record<string, unknown> = {
      timestamp,
      folder: `f48/${folder}`,
    };

    if (allowedFormats) {
      params['allowed_formats'] = allowedFormats.join(',');
    }

    const signature = cloudinary.utils.api_sign_request(
      params,
      this.env.cloudinaryApiSecret,
    );

    return {
      timestamp,
      signature,
      apiKey: this.env.cloudinaryApiKey,
      cloudName: this.env.cloudinaryCloudName,
      folder: `f48/${folder}`,
    };
  }

  async getAssetDetails(
    publicId: string,
  ): Promise<CloudinaryAssetResult | null> {
    try {
      const result = await cloudinary.api.resource(publicId);
      return {
        publicId: result.public_id as string,
        version: String(result.version),
        resourceType: result.resource_type as string,
        format: result.format as string,
        bytes: result.bytes as number,
        width: result.width as number | undefined,
        height: result.height as number | undefined,
        url: result.url as string,
        secureUrl: result.secure_url as string,
      };
    } catch (error) {
      this.logger.error(
        { publicId, error: error instanceof Error ? error.message : 'Unknown' },
        'Failed to get Cloudinary asset details',
      );
      return null;
    }
  }

  async deleteAsset(publicId: string): Promise<CloudinaryDeleteResult> {
    try {
      await cloudinary.uploader.destroy(publicId);
      return { success: true };
    } catch (error) {
      this.logger.error(
        { publicId, error: error instanceof Error ? error.message : 'Unknown' },
        'Failed to delete Cloudinary asset',
      );
      return {
        success: false,
        error: 'Failed to delete media asset.',
      };
    }
  }

  generateSignedUrl(publicId: string, expiresInSeconds: number): string {
    return cloudinary.url(publicId, {
      sign_url: true,
      type: 'authenticated',
      resource_type: 'image',
      expires_at: Math.round(Date.now() / 1000) + expiresInSeconds,
    });
  }
}
