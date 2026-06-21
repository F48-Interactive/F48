/**
 * YouTube Provider Adapter (ARCH-012, ORG-ID-002)
 * Interface + mock for YouTube channel data lookup.
 */

export interface YouTubeChannelData {
  channelId: string;
  channelName: string;
  handle?: string;
  url: string;
  imageUrl?: string;
  subscriberCount: number;
  videoCount: number;
  rawData: Record<string, unknown>;
}

export interface YouTubeResolveResult {
  success: boolean;
  channel?: YouTubeChannelData;
  error?: string;
}

/**
 * Adapter interface for YouTube channel resolution.
 */
export abstract class YouTubeLookupAdapter {
  abstract resolveChannelUrl(url: string): Promise<YouTubeResolveResult>;
}
