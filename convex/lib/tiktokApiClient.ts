// TikTok API client interface and implementations
import axios from "axios";
import { logger } from "../logger";

export interface TikTokApiResponse {
  viewCount: number;
  metadata?: {
    digg_count?: number;
    comment_count?: number;
    share_count?: number;
    author?: {
      unique_id: string;
      nickname: string;
    };
  };
}

export interface TikTokApiClient {
  /**
   * Fetch view count and metadata for a TikTok video
   * @param videoUrl The TikTok video URL
   * @returns Promise resolving to view count and metadata
   */
  getVideoData(videoUrl: string): Promise<TikTokApiResponse>;

  /**
   * Validate if a URL is a valid TikTok video URL
   * @param url The URL to validate
   * @returns true if the URL is a valid TikTok video URL
   */
  isValidTikTokUrl(url: string): boolean;
}

/**
 * Production TikTok API client using RapidAPI TikTok Scraper
 */
export class RapidApiTikTokClient implements TikTokApiClient {
  private readonly apiKey: string;
  private readonly baseUrl = "https://tiktok-scraper7.p.rapidapi.com/";

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.RAPID_API_KEY || "";
    if (!this.apiKey) {
      logger.warn("RapidAPI key not provided - TikTok API client will fail");
    }
  }

  async getVideoData(videoUrl: string): Promise<TikTokApiResponse> {
    if (!this.isValidTikTokUrl(videoUrl)) {
      throw new Error("Invalid TikTok URL format");
    }

    const options = {
      method: "GET" as const,
      url: this.baseUrl,
      params: {
        url: videoUrl,
        hd: "1",
      },
      headers: {
        "x-rapidapi-key": this.apiKey,
        "x-rapidapi-host": "tiktok-scraper7.p.rapidapi.com",
      },
    };

    try {
      const response = await axios.request(options);
      const data = response.data?.data;

      if (!data) {
        logger.warn("No data in TikTok API response");
        return { viewCount: 0 };
      }

      return {
        viewCount: data.play_count || 0,
        metadata: {
          digg_count: data.digg_count,
          comment_count: data.comment_count,
          share_count: data.share_count,
          author: data.author
            ? {
                unique_id: data.author.unique_id,
                nickname: data.author.nickname,
              }
            : undefined,
        },
      };
    } catch (error) {
      // Handle rate limiting
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        const retryAfter = parseInt(
          error.response?.headers["retry-after"] || "60"
        );
        logger.warn("TikTok API rate limit exceeded", {
          error: new Error(error.message),
        });

        // Re-throw with rate limit info for upstream handling
        const rateLimitError = new Error("Rate limit exceeded");
        (rateLimitError as any).retryAfter = retryAfter;
        (rateLimitError as any).isRateLimit = true;
        throw rateLimitError;
      }

      logger.error("Failed to fetch TikTok video data", {
        error: error instanceof Error ? error : new Error(error as string),
      });

      return { viewCount: 0 };
    }
  }

  isValidTikTokUrl(url: string): boolean {
    const patterns = [
      /\/video\/(\d+)/,
      /\/v\/(\d+)/,
      /tiktok\.com\/.*\/video\/(\d+)/,
      /vm\.tiktok\.com\/(\w+)/,
      /tiktok\.com\/t\/(\w+)/, // Support for /t/ URLs
    ];

    return patterns.some((pattern) => pattern.test(url));
  }

  /**
   * Extract video ID from TikTok URL for identification purposes
   * @param url TikTok video URL
   * @returns Video ID or null if not found
   */
  extractVideoId(url: string): string | null {
    const patterns = [
      /\/video\/(\d+)/,
      /\/v\/(\d+)/,
      /tiktok\.com\/.*\/video\/(\d+)/,
      /vm\.tiktok\.com\/(\w+)/,
      /tiktok\.com\/t\/(\w+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }

    return null;
  }
}

/**
 * Mock TikTok API client for testing
 */
export class MockTikTokApiClient implements TikTokApiClient {
  private mockResponses: Map<string, TikTokApiResponse> = new Map();
  private shouldThrowError: boolean = false;
  private errorToThrow: Error | null = null;
  private callCount: number = 0;
  private lastUrl: string | null = null;

  /**
   * Set a mock response for a specific URL
   */
  setMockResponse(url: string, response: TikTokApiResponse): void {
    this.mockResponses.set(url, response);
  }

  /**
   * Set the client to throw an error on the next call
   */
  setError(error: Error): void {
    this.shouldThrowError = true;
    this.errorToThrow = error;
  }

  /**
   * Clear all mock responses and reset state
   */
  reset(): void {
    this.mockResponses.clear();
    this.shouldThrowError = false;
    this.errorToThrow = null;
    this.callCount = 0;
    this.lastUrl = null;
  }

  /**
   * Get the number of API calls made
   */
  getCallCount(): number {
    return this.callCount;
  }

  /**
   * Get the last URL that was requested
   */
  getLastUrl(): string | null {
    return this.lastUrl;
  }

  async getVideoData(videoUrl: string): Promise<TikTokApiResponse> {
    this.callCount++;
    this.lastUrl = videoUrl;

    if (this.shouldThrowError && this.errorToThrow) {
      const error = this.errorToThrow;
      this.shouldThrowError = false; // Reset after throwing
      this.errorToThrow = null;
      throw error;
    }

    if (!this.isValidTikTokUrl(videoUrl)) {
      throw new Error("Invalid TikTok URL format");
    }

    // Return mock response if set, otherwise default response
    const mockResponse = this.mockResponses.get(videoUrl);
    if (mockResponse) {
      return mockResponse;
    }

    // Default mock response based on URL pattern
    const videoId = this.extractVideoId(videoUrl);
    const baseCount = videoId ? parseInt(videoId.slice(-3)) * 100 : 1000;

    return {
      viewCount: baseCount,
      metadata: {
        digg_count: Math.floor(baseCount * 0.1),
        comment_count: Math.floor(baseCount * 0.05),
        share_count: Math.floor(baseCount * 0.02),
        author: {
          unique_id: "test_user",
          nickname: "Test User",
        },
      },
    };
  }

  isValidTikTokUrl(url: string): boolean {
    const patterns = [
      /\/video\/(\d+)/,
      /\/v\/(\d+)/,
      /tiktok\.com\/.*\/video\/(\d+)/,
      /vm\.tiktok\.com\/(\w+)/,
      /tiktok\.com\/t\/(\w+)/,
    ];

    return patterns.some((pattern) => pattern.test(url));
  }

  private extractVideoId(url: string): string | null {
    const patterns = [
      /\/video\/(\d+)/,
      /\/v\/(\d+)/,
      /tiktok\.com\/.*\/video\/(\d+)/,
      /vm\.tiktok\.com\/(\w+)/,
      /tiktok\.com\/t\/(\w+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }

    return null;
  }
}

/**
 * Factory function to create the appropriate TikTok API client
 */
export function createTikTokApiClient(
  type: "production" | "mock" = "production",
  apiKey?: string
): TikTokApiClient {
  switch (type) {
    case "mock":
      return new MockTikTokApiClient();
    case "production":
    default:
      return new RapidApiTikTokClient(apiKey);
  }
}
