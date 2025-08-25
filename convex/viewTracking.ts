"use node";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import { logger } from "./logger";
import { rapidApiClient } from "./lib/rapidApiClient";

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

type YoutubeApiResponse = {
  errorId: string;
  type: string;
  id: string;
  title: string;
  description?: string;
  channel: {
    type: string;
    id: string;
    name: string;
    handle?: string; // e.g., "@WorldFareFiles"
    isVerified?: boolean;
    isVerifiedArtist?: boolean;
    subscriberCountText?: string;
  };
  lengthSeconds?: number;
  viewCount: number;
  publishedTime?: string;
  publishedTimeText?: string;
  isLiveStream?: boolean;
  isLiveNow?: boolean;
  isRegionRestricted?: boolean;
  isUnlisted?: boolean;
  isCommentDisabled?: boolean;
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

// Abstract base class for view trackers - now uses unified RapidAPI client
abstract class ViewTracker {
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
    try {
      const result = await rapidApiClient.getViewData("tiktok", videoUrl);
      
      if (result.error) {
        logger.warn("TikTok API error", { error: new Error(result.error) });
        return { views: 0, isOwner: false };
      }

      if (!ctx) {
        return result;
      }

      // Get submission and profile for ownership verification
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

      // For now, return the API result but we need to implement proper ownership verification
      // This requires getting the author info from the API response
      return {
        views: result.views,
        isOwner: result.isOwner, // TODO: Implement proper ownership verification
      };
    } catch (error) {
      logger.error("Failed to get TikTok view count", {
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
      /tiktok\.com\/t\/(\w+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }

    return null;
  }
}

class YoutubeViewTracker extends ViewTracker {
  private submissionId: Id<"submissions">;

  constructor(submissionId: Id<"submissions">) {
    super();
    this.submissionId = submissionId;
  }

  async getVideoData(
    contentUrl: string,
    ctx?: any
  ): Promise<{ views: number; isOwner: boolean }> {
    try {
      const result = await rapidApiClient.getViewData("youtube", contentUrl);
      
      if (result.error) {
        logger.warn("YouTube API error", { error: new Error(result.error) });
        return { views: 0, isOwner: false };
      }

      if (!ctx) {
        return result;
      }

      // Get submission and profile for ownership verification
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

      // For now, return the API result but we need to implement proper ownership verification
      return {
        views: result.views,
        isOwner: result.isOwner, // TODO: Implement proper ownership verification
      };
    } catch (error) {
      logger.error("Failed to get YouTube view count", {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      return { views: 0, isOwner: false };
    }
  }

  extractVideoId(url: string): string | null {
    // Extract post ID from various Instagram URL formats
    const patterns = [/\/shorts\/([A-Za-z0-9_-]+)/];

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
    try {
      const result = await rapidApiClient.getViewData("instagram", contentUrl);
      
      if (result.error) {
        logger.warn("Instagram API error", { error: new Error(result.error) });
        return { views: 0, isOwner: false };
      }

      if (!ctx) {
        return result;
      }

      // Get submission and profile for ownership verification
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

      // For now, return the API result but we need to implement proper ownership verification
      return {
        views: result.views,
        isOwner: result.isOwner, // TODO: Implement proper ownership verification
      };
    } catch (error) {
      logger.error("Failed to get Instagram view count", {
        error: error instanceof Error ? error : new Error(String(error)),
      });
      return { views: 0, isOwner: false };
    }
  }

  extractVideoId(url: string): string | null {
    // Extract post ID from various Instagram URL formats
    const patterns = [/\/p\/([A-Za-z0-9_-]+)/, /\/reel\/([A-Za-z0-9_-]+)/];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }

    return null;
  }
}

// Factory function to create appropriate tracker based on platform
function createViewTracker(
  platform: "tiktok" | "instagram" | "youtube",
  submissionId: Id<"submissions">
): ViewTracker {
  switch (platform.toLowerCase()) {
    case "tiktok":
      return new TikTokViewTracker(submissionId);
    case "instagram":
      return new InstagramViewTracker(submissionId);
    case "youtube":
      return new YoutubeViewTracker(submissionId);
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

// Get view count for a new submission
export const getViewCount = internalAction({
  args: {
    contentUrl: v.string(),
    submissionId: v.id("submissions"),
    platform: v.union(
      v.literal("tiktok"),
      v.literal("instagram"),
      v.literal("youtube")
    ),
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
    platform: v.union(
      v.literal("tiktok"),
      v.literal("instagram"),
      v.literal("youtube")
    ),
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
            recordIds: oldRecords.map((r: any) => r._id),
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
