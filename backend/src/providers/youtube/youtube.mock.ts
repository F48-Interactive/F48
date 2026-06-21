import { Injectable, Logger } from '@nestjs/common';
import {
  YouTubeLookupAdapter,
  type YouTubeResolveResult,
} from './youtube.adapter.js';

/**
 * Mock YouTube channel provider for development and testing.
 * Used when YOUTUBE_API_KEY is not configured.
 */
@Injectable()
export class MockYouTubeProvider extends YouTubeLookupAdapter {
  private readonly logger = new Logger(MockYouTubeProvider.name);

  async resolveChannelUrl(url: string): Promise<YouTubeResolveResult> {
    this.logger.debug(`Mock YouTube resolve for URL: ${url}`);

    // Simulate invalid URL
    if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
      return {
        success: false,
        error: 'Invalid YouTube URL format.',
      };
    }

    // Extract a mock channel ID from the URL
    const parts = url.split('/');
    const lastPart = parts[parts.length - 1] ?? 'mock-channel';

    return {
      success: true,
      channel: {
        channelId: `UC${lastPart.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)}`,
        channelName: `Mock Channel (${lastPart})`,
        handle: `@mock_${lastPart.slice(0, 10)}`,
        url,
        imageUrl: undefined,
        subscriberCount: 5000,
        videoCount: 50,
        rawData: { mock: true, originalUrl: url },
      },
    };
  }
}
