import { Injectable, Logger } from '@nestjs/common';
import { EnvService } from '../../config/env.service.js';
import {
  YouTubeLookupAdapter,
  type YouTubeChannelData,
  type YouTubeResolveResult,
} from './youtube.adapter.js';

type ChannelLookup =
  | { kind: 'id'; value: string }
  | { kind: 'handle'; value: string }
  | { kind: 'username'; value: string }
  | { kind: 'search'; value: string };

interface YouTubeChannelResponse {
  items?: Array<{
    id: string;
    snippet?: {
      title?: string;
      customUrl?: string;
      thumbnails?: {
        default?: { url?: string };
        medium?: { url?: string };
        high?: { url?: string };
      };
    };
    statistics?: {
      subscriberCount?: string;
      videoCount?: string;
    };
  }>;
}

interface YouTubeSearchResponse {
  items?: Array<{
    id?: { channelId?: string };
  }>;
}

@Injectable()
export class YouTubeDataProvider extends YouTubeLookupAdapter {
  private readonly logger = new Logger(YouTubeDataProvider.name);
  private readonly baseUrl = 'https://www.googleapis.com/youtube/v3';

  constructor(private readonly env: EnvService) {
    super();
  }

  async resolveChannelUrl(url: string): Promise<YouTubeResolveResult> {
    const lookup = this.parseChannelUrl(url);
    if (!lookup) {
      return {
        success: false,
        error: 'Unsupported YouTube channel URL.',
      };
    }

    try {
      const channel = await this.fetchChannel(lookup, url);
      if (!channel) {
        return {
          success: false,
          error: 'YouTube channel not found.',
        };
      }

      return { success: true, channel };
    } catch (error) {
      this.logger.warn(
        { error: error instanceof Error ? error.message : 'Unknown' },
        'YouTube channel lookup failed',
      );
      return {
        success: false,
        error: 'Failed to fetch YouTube channel details.',
      };
    }
  }

  private parseChannelUrl(input: string): ChannelLookup | null {
    let parsed: URL;
    try {
      parsed = new URL(input);
    } catch {
      return null;
    }

    const segments = parsed.pathname.split('/').filter(Boolean);
    const [type, value] = segments;
    if (!type) return null;

    if (type === 'channel' && value) {
      return { kind: 'id', value };
    }

    if (type.startsWith('@')) {
      return { kind: 'handle', value: type };
    }

    if (type === 'user' && value) {
      return { kind: 'username', value };
    }

    if (type === 'c' && value) {
      return { kind: 'search', value };
    }

    return null;
  }

  private async fetchChannel(
    lookup: ChannelLookup,
    originalUrl: string,
  ): Promise<YouTubeChannelData | null> {
    if (lookup.kind === 'search') {
      const channelId = await this.searchChannelId(lookup.value);
      if (!channelId) return null;
      return this.getChannelById(channelId, originalUrl);
    }

    const params = new URLSearchParams({
      part: 'snippet,statistics',
      key: this.env.youtubeApiKey ?? '',
    });

    if (lookup.kind === 'id') params.set('id', lookup.value);
    if (lookup.kind === 'handle') params.set('forHandle', lookup.value);
    if (lookup.kind === 'username') params.set('forUsername', lookup.value);

    return this.requestChannel(params, originalUrl);
  }

  private async getChannelById(
    channelId: string,
    originalUrl: string,
  ): Promise<YouTubeChannelData | null> {
    const params = new URLSearchParams({
      part: 'snippet,statistics',
      id: channelId,
      key: this.env.youtubeApiKey ?? '',
    });
    return this.requestChannel(params, originalUrl);
  }

  private async requestChannel(
    params: URLSearchParams,
    originalUrl: string,
  ): Promise<YouTubeChannelData | null> {
    const response = await fetch(`${this.baseUrl}/channels?${params}`);
    if (!response.ok) {
      throw new Error(`YouTube channels API returned ${response.status}`);
    }

    const data = (await response.json()) as YouTubeChannelResponse;
    const item = data.items?.[0];
    if (!item) return null;

    const snippet = item.snippet ?? {};
    const statistics = item.statistics ?? {};

    return {
      channelId: item.id,
      channelName: snippet.title ?? item.id,
      handle: snippet.customUrl,
      url: originalUrl,
      imageUrl:
        snippet.thumbnails?.high?.url ??
        snippet.thumbnails?.medium?.url ??
        snippet.thumbnails?.default?.url,
      subscriberCount: Number(statistics.subscriberCount ?? 0),
      videoCount: Number(statistics.videoCount ?? 0),
      rawData: item as unknown as Record<string, unknown>,
    };
  }

  private async searchChannelId(query: string): Promise<string | null> {
    const params = new URLSearchParams({
      part: 'snippet',
      type: 'channel',
      maxResults: '1',
      q: query,
      key: this.env.youtubeApiKey ?? '',
    });

    const response = await fetch(`${this.baseUrl}/search?${params}`);
    if (!response.ok) {
      throw new Error(`YouTube search API returned ${response.status}`);
    }

    const data = (await response.json()) as YouTubeSearchResponse;
    return data.items?.[0]?.id?.channelId ?? null;
  }
}
