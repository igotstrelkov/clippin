"use node";
import axios from "axios";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import { logger } from "./logger";

type TikTokMusicInfo = {
  id: string;
  title: string;
  play: string;
  cover: string;
  author: string;
  original: boolean;
  duration: number;
  album: string;
};

type TikTokAuthor = {
  id: string;
  unique_id: string;
  nickname: string;
  avatar: string;
};

type TikTokCommerceInfo = {
  ad_source: number;
  adv_promotable: boolean;
  auction_ad_invited: boolean;
  branded_content_type: number;
  organic_log_extra: string;
  with_comment_filter_words: boolean;
};

type TikTokVideoData = {
  aweme_id: string;
  id: string;
  region: string;
  title: string;
  cover: string;
  ai_dynamic_cover: string;
  origin_cover: string;
  duration: number;
  play: string;
  wmplay: string;
  hdplay: string;
  size: number;
  wm_size: number;
  hd_size: number;
  music: string;
  music_info: TikTokMusicInfo;
  play_count: number;
  digg_count: number;
  comment_count: number;
  share_count: number;
  download_count: number;
  collect_count: number;
  create_time: number;
  anchors: any;
  anchors_extras: string;
  is_ad: boolean;
  commerce_info: TikTokCommerceInfo;
  commercial_video_info: string;
  item_comment_settings: number;
  mentioned_users: string;
  author: TikTokAuthor;
};

type TikTokApiResponse = {
  code: number;
  msg: string;
  data: TikTokVideoData;
};

// Instagram types
type InstagramOwner = {
  id: string;
  username: string;
  is_verified: boolean;
  profile_pic_url: string;
  blocked_by_viewer: boolean;
  restricted_by_viewer: boolean | null;
  followed_by_viewer: boolean;
  full_name: string;
  has_blocked_viewer: boolean;
  is_embeds_disabled: boolean;
  is_private: boolean;
  is_unpublished: boolean;
  requested_by_viewer: boolean;
  pass_tiering_recommendation: boolean;
  edge_owner_to_timeline_media: {
    count: number;
  };
  edge_followed_by: {
    count: number;
  };
};

type InstagramApiResponse = {
  status: boolean;
  __typename: string;
  id: string;
  shortcode: string;
  thumbnail_src: string;
  dimensions: {
    height: number;
    width: number;
  };
  display_url: string;
  is_video: boolean;
  video_url?: string;
  video_view_count?: number;
  video_play_count?: number;
  video_duration?: number;
  edge_media_preview_like: {
    count: number;
  };
  edge_media_to_comment?: {
    count: number;
  };
  taken_at_timestamp: number;
  owner: InstagramOwner;
  edge_media_to_caption: {
    edges: Array<{
      node: {
        created_at: string;
        text: string;
        id: string;
      };
    }>;
  };
};

// Rate-limited TikTok API client respecting 120 requests/minute
// Abstract base class for view trackers
abstract class ViewTracker {
  protected async waitForRateLimit(ctx: any): Promise<void> {
    const rateLimitStatus = await ctx.runQuery(
      internal.rateLimiter.canMakeRequest
    );

    if (!rateLimitStatus.canRequest && rateLimitStatus.waitTimeMs > 0) {
      logger.info("Rate limit reached, waiting", {
        waitTimeMs: rateLimitStatus.waitTimeMs,
        queueSize: rateLimitStatus.queueSize,
      });

      // Wait for the required time
      await new Promise((resolve) =>
        setTimeout(resolve, rateLimitStatus.waitTimeMs)
      );
    }
  }

  abstract getVideoData(
    contentUrl: string,
    ctx?: any
  ): Promise<{ views: number; isOwner: boolean }>;
  abstract extractVideoId(url: string): string | null;
}

class TikTokViewTracker extends ViewTracker {
  private submissionId: Id<"submissions">;

  constructor(submissionId: Id<"submissions">) {
    super();
    this.submissionId = submissionId;
  }
  async getVideoData(
    videoUrl: string,
    ctx?: any
  ): Promise<{ views: number; isOwner: boolean }> {
    // Extract video ID from URL for validation
    const videoId = this.extractVideoId(videoUrl);
    if (!videoId) {
      throw new Error("Invalid TikTok URL");
    }

    // Check rate limits if context provided
    if (ctx) {
      await this.waitForRateLimit(ctx);
    }

    const options = {
      method: "GET",
      url: "https://tiktok-scraper7.p.rapidapi.com/",
      params: {
        url: videoUrl,
        hd: "1",
      },
      headers: {
        "x-rapidapi-key": process.env.RAPID_API_KEY!,
        "x-rapidapi-host": "tiktok-scraper7.p.rapidapi.com",
      },
    };

    try {
      const response: TikTokApiResponse = await axios
        .request(options)
        .then((res) => res.data);

      // Record the API request for rate limiting
      if (response.msg !== "success") {
        return {
          views: 0,
          isOwner: false,
        };
      }

      await ctx.runMutation(internal.rateLimiter.recordRequest, {
        submissionId: videoId,
      });

      const submission = await ctx.runQuery(
        internal.submissions.getSubmissionById,
        { submissionId: this.submissionId }
      );
      if (!submission) {
        return { views: 0, isOwner: false };
      }

      const profile = await ctx.runQuery(api.profiles.getProfileByUserId, {
        userId: submission.creatorId,
      });

      // Check if the profile's TikTok username matches the video author
      const isOwner =
        profile?.tiktokUsername?.toLowerCase() ===
        response.data.author.unique_id.toLowerCase();

      return {
        views: response.data.play_count,
        isOwner,
      };
    } catch (error) {
      // Check if it's a rate limit error
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        logger.warn("RapidAPI rate limit exceeded", {
          error: error instanceof Error ? error : new Error(String(error)),
          retryAfter: error.response?.headers["retry-after"],
        });

        // Wait according to retry-after header or default to 1 minute
        const retryAfter = parseInt(
          error.response?.headers["retry-after"] || "60"
        );
        const waitTime = retryAfter * 1000; // Convert to milliseconds
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        return this.getVideoData(videoUrl, ctx);
      }

      logger.error("Failed to get view count", {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      return { views: 0, isOwner: false };
    }
  }

  extractVideoId(url: string): string | null {
    // Extract video ID from various TikTok URL formats
    const patterns = [
      /\/video\/(\d+)/,
      /\/v\/(\d+)/,
      /tiktok\.com\/.*\/video\/(\d+)/,
      /vm\.tiktok\.com\/(\w+)/,
      /tiktok\.com\/t\/(\w+)/, // Add support for /t/ URLs
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }

    return null;
  }
}

class InstagramViewTracker extends ViewTracker {
  private submissionId: Id<"submissions">;

  constructor(submissionId: Id<"submissions">) {
    super();
    this.submissionId = submissionId;
  }

  async getVideoData(
    contentUrl: string,
    ctx?: any
  ): Promise<{ views: number; isOwner: boolean }> {
    // Extract post ID from URL for validation
    const videoId = this.extractVideoId(contentUrl);
    if (!videoId) {
      throw new Error("Invalid Instagram URL");
    }

    // Check rate limits if context provided
    if (ctx) {
      await this.waitForRateLimit(ctx);
    }

    const options = {
      method: "GET",
      url: "https://instagram-looter2.p.rapidapi.com/post",
      params: {
        link: contentUrl,
      },
      headers: {
        "x-rapidapi-key": process.env.RAPID_API_KEY!,
        "x-rapidapi-host": "instagram-looter2.p.rapidapi.com",
      },
    };

    try {
      const response: InstagramApiResponse = await axios
        .request(options)
        .then((res) => res.data);

      // Record the API request for rate limiting
      if (response.status == false) {
        return { views: 0, isOwner: false };
      }

      await ctx.runMutation(internal.rateLimiter.recordRequest, {
        submissionId: videoId,
      });
      console.log("submissionId", this.submissionId);
      const submission = await ctx.runQuery(
        internal.submissions.getSubmissionById,
        { submissionId: this.submissionId }
      );
      console.log("submission", submission);

      if (!submission) {
        return { views: 0, isOwner: false };
      }

      const profile = await ctx.runQuery(api.profiles.getProfileByUserId, {
        userId: submission.creatorId,
      });

      // For Instagram, video_view_count might not exist for non-video posts
      // Use video_play_count as fallback, or edge_media_preview_like count for images
      const views = response.video_play_count || 0;

      // Check if the profile's Instagram username matches the post owner
      const isOwner =
        profile?.instagramUsername?.toLowerCase() ===
        response.owner.username.toLowerCase();

      return {
        views,
        isOwner,
      };
    } catch (error) {
      console.log(error);
      // Check if it's a rate limit error
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        logger.warn("RapidAPI rate limit exceeded", {
          error: error instanceof Error ? error : new Error(String(error)),
          retryAfter: error.response?.headers["retry-after"],
        });

        // Wait according to retry-after header or default to 1 minute
        const retryAfter = parseInt(
          error.response?.headers["retry-after"] || "60"
        );
        const waitTime = retryAfter * 1000; // Convert to milliseconds
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        return this.getVideoData(contentUrl, ctx);
      }

      logger.error("Failed to get Instagram post data", {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      return { views: 0, isOwner: false };
    }
  }

  extractVideoId(url: string): string | null {
    // Extract post ID from various Instagram URL formats
    const patterns = [
      /\/p\/([A-Za-z0-9_-]+)/, // /p/POST_ID
      /\/reel\/([A-Za-z0-9_-]+)/, // /reel/POST_ID
      /\/tv\/([A-Za-z0-9_-]+)/, // /tv/POST_ID (IGTV)
      /instagram\.com\/.*\/p\/([A-Za-z0-9_-]+)/,
      /instagram\.com\/.*\/reel\/([A-Za-z0-9_-]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }

    return null;
  }
}

// Factory function to create appropriate tracker based on platform
function createViewTracker(
  platform: string,
  submissionId: Id<"submissions">
): ViewTracker {
  switch (platform.toLowerCase()) {
    case "tiktok":
      return new TikTokViewTracker(submissionId);
    case "instagram":
      return new InstagramViewTracker(submissionId);
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

// Get view count for a new submission
export const getViewCount = internalAction({
  args: {
    contentUrl: v.string(),
    submissionId: v.id("submissions"),
    platform: v.string(),
  },
  handler: async (ctx, args): Promise<{ viewCount: number }> => {
    try {
      const tracker = createViewTracker(args.platform, args.submissionId);
      const { views, isOwner } = await tracker.getVideoData(
        args.contentUrl,
        ctx
      );

      if (!isOwner) {
        return { viewCount: 0 };
      }

      // Get current view count to use as previousViews
      const submission = await ctx.runQuery(
        internal.submissions.getSubmissionById,
        {
          submissionId: args.submissionId,
        }
      );

      if (!submission) {
        return { viewCount: 0 };
      }

      const previousViews = submission?.viewCount || 0;

      // Then update views (now submission is in "pending" status)
      await ctx.runMutation(
        internal.viewTrackingHelpers.updateSubmissionViewsAndEarnings,
        {
          submissionId: args.submissionId,
          viewCount: views,
          previousViews,
        }
      );

      return { viewCount: views };
    } catch (error) {
      logger.warn(`Failed to get view count for ${args.platform}`, {
        submissionId: args.submissionId,
        contentUrl: args.contentUrl,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      return { viewCount: 0 };
    }
  },
});

// Get initial view count for a new submission
export const verifyContentOwner = internalAction({
  args: {
    contentUrl: v.string(),
    submissionId: v.id("submissions"),
    platform: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const tracker = createViewTracker(args.platform, args.submissionId);
      const { isOwner } = await tracker.getVideoData(args.contentUrl, ctx);

      if (args.submissionId && isOwner) {
        await ctx.runMutation(
          internal.submissions.updateStatsAfterVerification,
          {
            submissionId: args.submissionId,
          }
        );
      } else {
        await ctx.runMutation(internal.submissions.rejectSubmission, {
          submissionId: args.submissionId,
          rejectionReason: "Not the owner of the account",
        });
      }
    } catch (error) {
      logger.warn(`Failed to verify content owner for ${args.platform}`, {
        submissionId: args.submissionId,
        contentUrl: args.contentUrl,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      return { viewCount: 0 };
    }
  },
});

// Cleanup old view tracking records (keep last 30 days)
export const cleanupOldRecords = internalAction({
  args: {},
  handler: async (ctx) => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const BATCH_SIZE = 100; // Process in batches to avoid timeouts
    let totalDeleted = 0;
    let hasMore = true;

    logger.info("Starting view tracking cleanup", {
      beforeTimestamp: thirtyDaysAgo,
    });

    while (hasMore) {
      try {
        // Get a batch of old records
        const oldRecords = await ctx.runQuery(
          internal.viewTrackingHelpers.getOldViewRecordsBatch,
          {
            beforeTimestamp: thirtyDaysAgo,
            limit: BATCH_SIZE,
          }
        );

        if (oldRecords.length === 0) {
          hasMore = false;
          break;
        }

        // Delete batch using a single mutation
        const deletedCount = await ctx.runMutation(
          internal.viewTrackingHelpers.deleteViewRecordsBatch,
          {
            recordIds: oldRecords.map((r) => r._id),
          }
        );

        totalDeleted += deletedCount;

        logger.info(
          `Deleted batch of ${deletedCount} view records (batch size: ${oldRecords.length})`
        );

        // If we got fewer records than batch size, we're done
        if (oldRecords.length < BATCH_SIZE) {
          hasMore = false;
        }
      } catch (error) {
        logger.error("Error during view tracking cleanup batch", {
          error: error instanceof Error ? error : new Error(String(error)),
        });
        // Continue with next batch instead of failing completely
      }
    }

    logger.info("View tracking cleanup completed", {
      beforeTimestamp: thirtyDaysAgo,
    });

    return { deletedCount: totalDeleted };
  },
});
