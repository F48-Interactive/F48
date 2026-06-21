/**
 * Cloudinary Provider Adapter (ARCH-012, MEDIA-001/002)
 * Interface + config for media uploads via signed flows.
 */

export interface CloudinaryUploadSignature {
  timestamp: number;
  signature: string;
  apiKey: string;
  cloudName: string;
  folder: string;
  uploadPreset?: string;
}

export interface CloudinaryAssetResult {
  publicId: string;
  version: string;
  resourceType: string;
  format: string;
  bytes: number;
  width?: number;
  height?: number;
  url: string;
  secureUrl: string;
}

export interface CloudinaryDeleteResult {
  success: boolean;
  error?: string;
}

/**
 * Adapter interface for Cloudinary operations.
 * Implementations: CloudinaryProvider (real), MockCloudinaryProvider (dev/test).
 */
export abstract class CloudinaryAdapter {
  /**
   * Generate a signed upload signature for client-side upload (MEDIA-002).
   */
  abstract generateUploadSignature(
    folder: string,
    allowedFormats?: string[],
  ): Promise<CloudinaryUploadSignature>;

  /**
   * Register an uploaded asset's metadata in the system.
   */
  abstract getAssetDetails(publicId: string): Promise<CloudinaryAssetResult | null>;

  /**
   * Delete an asset from Cloudinary.
   */
  abstract deleteAsset(publicId: string): Promise<CloudinaryDeleteResult>;

  /**
   * Generate a signed URL for restricted access (MEDIA-005).
   */
  abstract generateSignedUrl(
    publicId: string,
    expiresInSeconds: number,
  ): string;
}
