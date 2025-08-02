"use node";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalAction } from "./_generated/server";

// Mock TikTok API for development (replace with real API in production)
class TikTokViewTracker {
  async getVideoViews(videoUrl: string): Promise<number> {
    // Extract video ID from URL for validation
    const videoId = this.extractVideoId(videoUrl);
    if (!videoId) {
      throw new Error("Invalid TikTok URL");
    }

    // For development: simulate realistic view growth
    const baseViews = Math.floor(Math.random() * 5000) + 1000; // 1K-6K base views
    const growthFactor = Math.random() * 0.2 + 0.9; // 90%-110% of base
    const currentViews = Math.floor(baseViews * growthFactor);

    // Add some randomness to simulate real growth
    const timeBasedGrowth = Math.floor(Math.random() * 500);
    return currentViews + timeBasedGrowth;
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
      const viewCount = await tracker.getVideoViews(args.tiktokUrl);

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
      console.warn("Failed to get initial view count:", error);
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
        const currentViews = await tracker.getVideoViews(submission.tiktokUrl);

        // Only update if views have changed significantly (avoid spam updates)
        const lastViews = submission.viewCount || 0;
        const viewDifference = Math.abs(currentViews - lastViews);

        if (viewDifference > 10 || lastViews === 0) {
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
            await ctx.runMutation(
              internal.viewTrackingHelpers.markThresholdMet,
              {
                submissionId: submission._id,
              }
            );
          }

          updatedCount++;
        }
      } catch (error) {
        console.error(`Failed to update views for ${submission._id}:`, error);
        errorCount++;
      }
    }

    console.log(
      `View tracking completed: ${updatedCount} updated, ${errorCount} errors`
    );
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
    const currentViews = await tracker.getVideoViews(submission.tiktokUrl);

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

    console.log(`Cleaned up ${deletedCount} old view tracking records`);
    return { deletedCount };
  },
});
