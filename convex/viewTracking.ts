"use node";
import { getAuthUserId } from "@convex-dev/auth/server";
import axios from "axios";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalAction } from "./_generated/server";
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

// Rate-limited TikTok API client respecting 120 requests/minute
class TikTokViewTracker {
  private async waitForRateLimit(ctx: any): Promise<void> {
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

  async getViews(videoUrl: string, ctx?: any): Promise<number> {
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
      const response = await axios.request(options);

      // Record the API request for rate limiting
      if (ctx) {
        await ctx.runMutation(internal.rateLimiter.recordRequest, {
          submissionId: videoId,
        });
      }

      console.log(response.data);
      return response.data.data.play_count;
    } catch (error) {
      // Check if it's a rate limit error
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        logger.warn("RapidAPI rate limit exceeded", {
          error: error instanceof Error ? error : new Error(String(error)),
          retryAfter: error.response?.headers["retry-after"],
        });

        // Wait 1 minute and retry once
        await new Promise((resolve) => setTimeout(resolve, 60000));
        return this.getViews(videoUrl, ctx);
      }

      logger.error("Failed to get view count", {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      return 0;
    }
  }

  private extractVideoId(url: string): string | null {
    // Extract video ID from various TikTok URL formats
    const patterns = [
      /\/video\/(\d+)/,
      /\/v\/(\d+)/,
      /tiktok\.com\/.*\/video\/(\d+)/,
      /vm\.tiktok\.com\/(\w+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }

    return null;
  }
}

// Get initial view count for a new submission
export const getInitialViewCount = internalAction({
  args: {
    tiktokUrl: v.string(),
    submissionId: v.optional(v.id("submissions")),
  },
  handler: async (ctx, args): Promise<{ viewCount: number }> => {
    const tracker = new TikTokViewTracker();
    try {
      const viewCount = await tracker.getViews(args.tiktokUrl, ctx);

      // If submissionId provided, update the submission
      if (args.submissionId) {
        await ctx.runMutation(
          internal.viewTrackingHelpers.updateSubmissionViews,
          {
            submissionId: args.submissionId,
            viewCount,
            previousViews: 0, // Initial fetch always has 0 previous views
            source: "initial_fetch",
          }
        );
      }

      return { viewCount };
    } catch (error) {
      logger.warn("Failed to get initial view count", {
        submissionId: args.submissionId,
        tiktokUrl: args.tiktokUrl,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      return { viewCount: 0 };
    }
  },
});

// Update view counts for all active submissions
export const updateAllViewCounts = internalAction({
  args: {},
  handler: async (
    ctx
  ): Promise<{
    updatedCount: number;
    errorCount: number;
    totalProcessed: number;
  }> => {
    const tracker = new TikTokViewTracker();

    // Get all pending/approved submissions that need view updates
    const submissions: any[] = await ctx.runQuery(
      internal.viewTrackingHelpers.getActiveSubmissions
    );

    let updatedCount = 0;
    let errorCount = 0;

    for (const submission of submissions) {
      try {
        const currentViews = await tracker.getViews(submission.tiktokUrl, ctx);

        // Only update if views have changed significantly (avoid spam updates)
        const lastViews = submission.viewCount || 0;
        // const viewDifference = Math.abs(currentViews - lastViews);

        //if (viewDifference > 10 || lastViews === 0) {
        // Update if >10 view difference or first time
        await ctx.runMutation(
          internal.viewTrackingHelpers.updateSubmissionViews,
          {
            submissionId: submission._id,
            viewCount: currentViews,
            previousViews: lastViews, // Pass the old view count
            source: "tiktok_api",
          }
        );

        // Check if submission now meets threshold for pending submissions
        if (
          currentViews >= 1000 &&
          submission.status === "pending" &&
          lastViews < 1000
        ) {
          await ctx.runMutation(internal.viewTrackingHelpers.markThresholdMet, {
            submissionId: submission._id,
          });
        }

        updatedCount++;
        //}
      } catch (error) {
        logger.error("Failed to update views for submission", {
          submissionId: submission._id,
          error: error instanceof Error ? error : new Error(String(error)),
        });
        errorCount++;
      }
    }

    logger.info("View tracking completed", {
      updatedCount,
      errorCount,
      totalProcessed: submissions.length,
    });
    return { updatedCount, errorCount, totalProcessed: submissions.length };
  },
});

// SECURE: Manual refresh with proper validation and rate limiting
export const refreshSubmissionViews = action({
  args: { submissionId: v.id("submissions") },
  handler: async (
    ctx,
    args
  ): Promise<{ viewCount: number; previousViews: number }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required");
    }

    // Check if user can refresh views (includes access validation and rate limiting)
    const canRefresh = await ctx.runQuery(
      internal.viewTrackingHelpers.canRefreshViews,
      {
        submissionId: args.submissionId,
        userId,
      }
    );

    if (!canRefresh) {
      throw new Error(
        "Cannot refresh views at this time. Please wait 5 minutes between refreshes."
      );
    }

    // Get submission data
    const submission = await ctx.runQuery(
      internal.viewTrackingHelpers.getSubmissionWithAuth,
      {
        submissionId: args.submissionId,
        userId,
      }
    );

    if (!submission) {
      throw new Error("Submission not found or unauthorized");
    }

    const tracker = new TikTokViewTracker();
    const currentViews = await tracker.getViews(submission.tiktokUrl, ctx);

    // Atomically update views and the rate-limiting timestamp
    await ctx.runMutation(internal.viewTrackingHelpers.updateSubmissionViews, {
      submissionId: args.submissionId,
      viewCount: currentViews,
      previousViews: submission.viewCount || 0, // Pass the old view count
      source: "manual_refresh",
      updateLastApiCall: true, // Also update the rate-limiting timestamp
    });

    return {
      viewCount: currentViews,
      previousViews: submission.viewCount || 0,
    };
  },
});

// Cleanup old view tracking records (keep last 30 days)
export const cleanupOldRecords = internalAction({
  args: {},
  handler: async (ctx) => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    const oldRecords = await ctx.runQuery(
      internal.viewTrackingHelpers.getOldViewRecords,
      {
        beforeTimestamp: thirtyDaysAgo,
      }
    );

    let deletedCount = 0;
    for (const record of oldRecords) {
      await ctx.runMutation(internal.viewTrackingHelpers.deleteViewRecord, {
        recordId: record._id,
      });
      deletedCount++;
    }

    logger.info("View tracking cleanup completed", {
      deletedCount,
      beforeTimestamp: thirtyDaysAgo,
    });
    return { deletedCount };
  },
});
