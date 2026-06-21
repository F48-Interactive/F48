import { Injectable, Logger } from '@nestjs/common';
import {
  CloudinaryAdapter,
  type CloudinaryUploadSignature,
  type CloudinaryAssetResult,
  type CloudinaryDeleteResult,
} from './cloudinary.adapter.js';

/**
 * Mock Cloudinary provider for development and testing.
 */
@Injectable()
export class MockCloudinaryProvider extends CloudinaryAdapter {
  private readonly logger = new Logger(MockCloudinaryProvider.name);

  async generateUploadSignature(
    folder: string,
  ): Promise<CloudinaryUploadSignature> {
    this.logger.debug(`Mock upload signature for folder: ${folder}`);
    return {
      timestamp: Math.round(Date.now() / 1000),
      signature: 'mock_signature_' + Date.now(),
      apiKey: 'mock_api_key',
      cloudName: 'mock_cloud',
      folder: `f48/${folder}`,
    };
  }

  async getAssetDetails(publicId: string): Promise<CloudinaryAssetResult> {
    return {
      publicId,
      version: '1',
      resourceType: 'image',
      format: 'jpg',
      bytes: 12345,
      width: 800,
      height: 600,
      url: `http://res.cloudinary.com/mock/image/upload/${publicId}.jpg`,
      secureUrl: `https://res.cloudinary.com/mock/image/upload/${publicId}.jpg`,
    };
  }

  async deleteAsset(_publicId: string): Promise<CloudinaryDeleteResult> {
    return { success: true };
  }

  generateSignedUrl(publicId: string, _expiresInSeconds: number): string {
    return `https://res.cloudinary.com/mock/image/authenticated/${publicId}.jpg`;
  }
}
