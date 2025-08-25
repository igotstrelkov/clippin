/**
 * Unified RapidAPI client with in-memory rate limiting and exponential backoff
 * Handles Instagram, YouTube, and TikTok API calls with consistent interface
 */

import axios from "axios";

// Platform-specific API configurations
const API_CONFIGS = {
  instagram: {
    verification: {
      url: "https://instagram-looter2.p.rapidapi.com/profile",
      host: "instagram-looter2.p.rapidapi.com",
    },
    viewTracking: {
      url: "https://instagram-looter2.p.rapidapi.com/post",
      host: "instagram-looter2.p.rapidapi.com",
    },
  },
  youtube: {
    verification: {
      url: "https://youtube138.p.rapidapi.com/channel/details/",
      host: "youtube138.p.rapidapi.com",
    },
    viewTracking: {
      url: "https://youtube-media-downloader.p.rapidapi.com/v2/video/details",
      host: "youtube-media-downloader.p.rapidapi.com",
    },
  },
  tiktok: {
    verification: null, // Uses web scraping fallback
    viewTracking: {
      url: "https://tiktok-scraper7.p.rapidapi.com/",
      host: "tiktok-scraper7.p.rapidapi.com",
    },
  },
} as const;

// In-memory rate limiting
class InMemoryRateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly windowMs = 60 * 1000; // 1 minute
  private readonly maxRequests = 120; // RapidAPI limit

  canMakeRequest(key: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(key) || [];

    // Clean old requests outside the window
    const validRequests = requests.filter((time) => now - time < this.windowMs);
    this.requests.set(key, validRequests);

    return validRequests.length < this.maxRequests;
  }

  recordRequest(key: string): void {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    requests.push(now);
    this.requests.set(key, requests);
  }

  getNextAvailableTime(key: string): number {
    const requests = this.requests.get(key) || [];
    if (requests.length < this.maxRequests) return 0;

    const oldestRequest = Math.min(...requests);
    return oldestRequest + this.windowMs - Date.now();
  }
}

// Exponential backoff configuration
class ExponentialBackoff {
  private attempts: Map<string, number> = new Map();
  private readonly baseDelayMs = 1000;
  private readonly maxDelayMs = 30000;
  private readonly maxAttempts = 5;

  async executeWithBackoff<T>(
    key: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const attempts = this.attempts.get(key) || 0;

    if (attempts >= this.maxAttempts) {
      this.attempts.delete(key);
      throw new Error(`Max attempts (${this.maxAttempts}) exceeded for ${key}`);
    }

    try {
      const result = await operation();
      this.attempts.delete(key); // Reset on success
      return result;
    } catch (error) {
      if (this.isRateLimitError(error)) {
        const newAttempts = attempts + 1;
        this.attempts.set(key, newAttempts);

        const delay = Math.min(
          this.baseDelayMs * Math.pow(2, attempts),
          this.maxDelayMs
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.executeWithBackoff(key, operation);
      }

      this.attempts.delete(key);
      throw error;
    }
  }

  private isRateLimitError(error: unknown): boolean {
    if (axios.isAxiosError(error)) {
      return error.response?.status === 429;
    }
    return false;
  }
}

// Unified response interface
export interface PlatformApiResponse {
  success: boolean;
  data?: any;
  error?: string;
  rateLimited?: boolean;
}

export interface VerificationResult {
  found: boolean;
  bio?: string;
  error?: string;
}

export interface ViewTrackingResult {
  views: number;
  isOwner: boolean;
  error?: string;
}

// Main RapidAPI client
export class RapidApiClient {
  private rateLimiter = new InMemoryRateLimiter();
  private backoff = new ExponentialBackoff();
  private readonly apiKey: string;

  constructor() {
    this.apiKey = process.env.RAPID_API_KEY!;
    if (!this.apiKey) {
      throw new Error("RAPID_API_KEY environment variable is required");
    }
  }

  // Bio verification for Instagram and YouTube
  async verifyBio(
    platform: "instagram" | "youtube" | "tiktok",
    username: string,
    verificationCode: string
  ): Promise<VerificationResult> {
    const config = API_CONFIGS[platform].verification;
    if (!config) {
      return {
        found: false,
        error: `${platform} verification not supported via API`,
      };
    }

    const rateLimitKey = `${platform}-verification`;

    // Check rate limit
    if (!this.rateLimiter.canMakeRequest(rateLimitKey)) {
      const waitTime = this.rateLimiter.getNextAvailableTime(rateLimitKey);
      return {
        found: false,
        error: `Rate limit exceeded. Try again in ${Math.ceil(waitTime / 1000)}s`,
      };
    }

    const operationKey = `${platform}-verify-${username}`;

    try {
      const result = await this.backoff.executeWithBackoff(
        operationKey,
        async () => {
          this.rateLimiter.recordRequest(rateLimitKey);
          return this.makeVerificationRequest(
            platform,
            username,
            verificationCode,
            config
          );
        }
      );

      return result;
    } catch (error) {
      return {
        found: false,
        error: `Unable to verify ${platform} profile: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  // View tracking for all platforms
  async getViewData(
    platform: "instagram" | "youtube" | "tiktok",
    contentUrl: string,
    submissionId?: string
  ): Promise<ViewTrackingResult> {
    const config = API_CONFIGS[platform].viewTracking;
    if (!config) {
      return {
        views: 0,
        isOwner: false,
        error: `${platform} view tracking not supported`,
      };
    }

    const rateLimitKey = `${platform}-tracking`;

    // Check rate limit
    if (!this.rateLimiter.canMakeRequest(rateLimitKey)) {
      const waitTime = this.rateLimiter.getNextAvailableTime(rateLimitKey);
      return {
        views: 0,
        isOwner: false,
        error: `Rate limit exceeded. Try again in ${Math.ceil(waitTime / 1000)}s`,
      };
    }

    const operationKey = `${platform}-track-${contentUrl}`;

    try {
      const result = await this.backoff.executeWithBackoff(
        operationKey,
        async () => {
          this.rateLimiter.recordRequest(rateLimitKey);
          return this.makeViewTrackingRequest(platform, contentUrl, config);
        }
      );

      return result;
    } catch (error) {
      return {
        views: 0,
        isOwner: false,
        error: `Unable to get ${platform} view data: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  private async makeVerificationRequest(
    platform: "instagram" | "youtube" | "tiktok",
    username: string,
    verificationCode: string,
    config: { url: string; host: string }
  ): Promise<VerificationResult> {
    const params =
      platform === "instagram"
        ? { username }
        : { id: `https://www.youtube.com/@${username}`, hl: "en", gl: "US" };

    const response = await axios.request({
      method: "GET",
      url: config.url,
      params,
      headers: {
        "x-rapidapi-key": this.apiKey,
        "x-rapidapi-host": config.host,
      },
    });

    if (platform === "instagram") {
      if (!response.data.status) {
        return { found: false, error: "Profile not accessible or private" };
      }
      return {
        found: response.data.biography.includes(verificationCode),
        bio: response.data.biography,
      };
    } else if (platform === "youtube") {
      // YouTube
      if (!response.data) {
        return { found: false, error: "Profile not accessible" };
      }
      return {
        found: response.data.description?.includes(verificationCode) || false,
        bio: response.data.description,
      };
    } else {
      return await this.checkBioWithPublicAPI(username, verificationCode);
    }
  }

  // TikTok verification using web scraping (no RapidAPI available)
  private async checkBioWithPublicAPI(
    username: string,
    verificationCode: string
  ): Promise<{ found: boolean; bio?: string; error?: string }> {
    try {
      const profileUrl = `https://www.tiktok.com/@${username}`;

      // Simple rate limiting for TikTok scraping
      const rateLimitKey = "tiktok-scraping";
      const requests = (globalThis as any).__tiktokRequests || [];
      const now = Date.now();
      const windowMs = 60 * 1000; // 1 minute
      const maxRequests = 30; // Conservative limit for web scraping

      // Clean old requests
      const validRequests = requests.filter(
        (time: number) => now - time < windowMs
      );
      (globalThis as any).__tiktokRequests = validRequests;

      if (validRequests.length >= maxRequests) {
        const oldestRequest = Math.min(...validRequests);
        const waitTime = Math.ceil((oldestRequest + windowMs - now) / 1000);
        return {
          found: false,
          error: `Rate limit exceeded for TikTok verification. Please wait ${waitTime}s and try again.`,
        };
      }

      // Record this request
      validRequests.push(now);
      (globalThis as any).__tiktokRequests = validRequests;

      // Use multiple approaches to fetch the profile data
      const approaches: RequestInit[] = [
        // Approach 1: Standard browser request
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            Connection: "keep-alive",
          },
        },
        // Approach 2: Mobile user agent
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1",
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
        },
      ];

      let html = "";

      for (const approach of approaches) {
        try {
          const response = await fetch(profileUrl, approach);

          if (!response.ok) {
            continue;
          }

          html = await response.text();
          break;
        } catch (error) {
          console.log(error);
          continue;
        }
      }

      if (!html) {
        throw new Error("All fetch approaches failed");
      }

      // Enhanced bio extraction with multiple patterns
      const bioPatterns = [
        // JSON-LD structured data
        /"description":"([^"]*?)"/g,
        // Open Graph meta tag
        /<meta[^>]*property="og:description"[^>]*content="([^"]*?)"/g,
        // Standard meta description
        /<meta[^>]*name="description"[^>]*content="([^"]*?)"/g,
        // TikTok's bio in JSON data
        /"bioDescription":\s*{\s*"text":"([^"]*?)"/g,
        // Alternative bio patterns
        /"desc":"([^"]*?)"/g,
        /"signature":"([^"]*?)"/g,
      ];

      let bio = "";
      let found = false;

      for (const pattern of bioPatterns) {
        const matches = [...html.matchAll(pattern)];

        for (const match of matches) {
          if (match[1]) {
            const decodedBio = match[1]
              .replace(/\\u[\dA-F]{4}/gi, (unicodeMatch) =>
                String.fromCharCode(
                  parseInt(unicodeMatch.replace(/\\u/g, ""), 16)
                )
              )
              .replace(/\\n/g, " ")
              .replace(/\\"/g, '"')
              .replace(/\\r/g, "")
              .replace(/\\\\/g, "\\")
              .trim();

            if (decodedBio.length > bio.length) {
              bio = decodedBio;
            }

            if (decodedBio.includes(verificationCode)) {
              found = true;
              bio = decodedBio;
              break;
            }
          }
        }

        if (found) break;
      }

      if (!bio) {
        return {
          found: false,
          error:
            "Could not access TikTok profile bio. Please ensure your profile is public and has a bio.",
        };
      }

      return {
        found,
        bio: bio,
      };
    } catch (error) {
      return {
        found: false,
        error: `Unable to verify TikTok profile: ${error instanceof Error ? error.message : "Unknown error"}. Please ensure your profile is public and the username is correct.`,
      };
    }
  }

  private async makeViewTrackingRequest(
    platform: "instagram" | "youtube" | "tiktok",
    contentUrl: string,
    config: { url: string; host: string }
  ): Promise<ViewTrackingResult> {
    let params: Record<string, any>;

    switch (platform) {
      case "instagram":
        params = { link: contentUrl };
        break;
      case "youtube": {
        const videoId = this.extractYouTubeVideoId(contentUrl);
        if (!videoId) {
          throw new Error("Invalid YouTube URL");
        }
        params = {
          videoId,
          urlAccess: "normal",
          videos: "auto",
          audios: "auto",
        };
        break;
      }
      case "tiktok":
        params = { url: contentUrl, hd: "1" };
        break;
      default:
        throw new Error(`Unsupported platform`);
    }

    const response = await axios.request({
      method: "GET",
      url: config.url,
      params,
      headers: {
        "x-rapidapi-key": this.apiKey,
        "x-rapidapi-host": config.host,
      },
    });

    return this.parseViewTrackingResponse(platform, response.data);
  }

  private parseViewTrackingResponse(
    platform: "instagram" | "youtube" | "tiktok",
    data: any
  ): ViewTrackingResult {
    switch (platform) {
      case "instagram":
        if (!data.status) {
          return { views: 0, isOwner: false };
        }
        return {
          views: data.video_play_count || 0,
          isOwner: true, // Owner verification needs to be handled separately
        };

      case "youtube":
        if (data.errorId !== "Success") {
          return { views: 0, isOwner: false };
        }
        return {
          views: data.viewCount || 0,
          isOwner: true, // Owner verification needs to be handled separately
        };

      case "tiktok":
        if (data.msg !== "success") {
          return { views: 0, isOwner: false };
        }
        return {
          views: data.data?.play_count || 0,
          isOwner: true, // Owner verification needs to be handled separately
        };

      default:
        return { views: 0, isOwner: false };
    }
  }

  private extractYouTubeVideoId(url: string): string | null {
    const patterns = [/\/shorts\/([A-Za-z0-9_-]+)/];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  // Get rate limiting stats for monitoring
  getRateLimitStats(): Record<
    string,
    { remaining: number; resetTime: number }
  > {
    const stats: Record<string, { remaining: number; resetTime: number }> = {};

    // Use the public canMakeRequest method to get stats
    const keys = [
      "instagram-verification",
      "youtube-verification",
      "instagram-tracking",
      "youtube-tracking",
      "tiktok-tracking",
    ];

    for (const key of keys) {
      const canRequest = this.rateLimiter.canMakeRequest(key);
      const waitTime = this.rateLimiter.getNextAvailableTime(key);
      const resetTime = waitTime > 0 ? Date.now() + waitTime : Date.now();

      stats[key] = {
        remaining: canRequest ? 120 : 0, // Approximate
        resetTime,
      };
    }

    return stats;
  }
}

// Export singleton instance
export const rapidApiClient = new RapidApiClient();
