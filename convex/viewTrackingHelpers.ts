import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { calculateEarnings, shouldCompleteCampaign } from "./lib/earnings";
import { logger } from "./logger";

// Get all active submissions that need view tracking
export const getActiveSubmissions = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("submissions")
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "pending"),
          q.eq(q.field("status"), "approved")
        )
      )
      .collect();
  },
});

// Update submission view count and log tracking entry

// Helper function to process earnings updates and related database changes
async function processEarningsUpdate(
  ctx: { db: { query: any; patch: any } },
  submission: Doc<"submissions">,
  campaign: Doc<"campaigns">,
  newViewCount: number
) {
  const newEarnings = calculateEarnings(
    newViewCount,
    campaign.cpmRate,
    campaign.maxPayoutPerSubmission
  );

  const currentEarnings = submission.earnings || 0;
  const earningsDelta = newEarnings - currentEarnings;

  // Only proceed if earnings actually changed
  if (earningsDelta === 0) {
    return null;
  }

  // Calculate new campaign budget
  const newRemainingBudget = Math.max(
    0,
    campaign.remainingBudget - earningsDelta
  );

  // Prepare updates
  const submissionUpdates = { earnings: newEarnings };
  const campaignUpdates: Partial<Doc<"campaigns">> = {
    remainingBudget: newRemainingBudget,
  };

  // Mark campaign as completed if budget is exhausted or too low for meaningful earnings
  if (campaign.status === "active" && shouldCompleteCampaign(newRemainingBudget, campaign.cpmRate)) {
    campaignUpdates.status = "completed";
  }

  // Update creator's total earnings in their profile
  const creatorProfile = await ctx.db
    .query("profiles")
    .withIndex("by_user_id", (q: any) => q.eq("userId", submission.creatorId))
    .unique();

  if (creatorProfile) {
    const newTotalEarnings =
      (creatorProfile.totalEarnings || 0) + earningsDelta;
    await ctx.db.patch(creatorProfile._id, {
      totalEarnings: Math.max(0, newTotalEarnings), // Ensure non-negative
    });
  }

  return { submissionUpdates, campaignUpdates };
}

export const updateSubmissionViews = internalMutation({
  args: {
    submissionId: v.id("submissions"),
    viewCount: v.number(),
    previousViews: v.number(),
    source: v.string(),
    updateLastApiCall: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Fetch required entities
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) {
      throw new Error("Submission not found");
    }

    const campaign = await ctx.db.get(submission.campaignId);
    if (!campaign) {
      throw new Error("Campaign not found");
    }

    const now = Date.now();

    // Prepare submission updates
    const submissionUpdates: Partial<Doc<"submissions">> = {
      viewCount: args.viewCount,
      lastViewUpdate: now,
    };

    if (args.updateLastApiCall) {
      submissionUpdates.lastApiCall = now;
    }

    // Prepare campaign updates
    const viewDelta = args.viewCount - args.previousViews;
    const campaignUpdates: Partial<Doc<"campaigns">> = {
      totalViews: (campaign.totalViews || 0) + viewDelta,
    };

    // Handle earnings and budget updates for approved submissions
    if (args.viewCount !== (submission.viewCount || 0)) {
      const earningsUpdate = await processEarningsUpdate(
        ctx,
        submission,
        campaign,
        args.viewCount
      );

      if (earningsUpdate) {
        Object.assign(submissionUpdates, earningsUpdate.submissionUpdates);
        Object.assign(campaignUpdates, earningsUpdate.campaignUpdates);
      }
    }

    // Perform atomic database updates
    await Promise.all([
      ctx.db.patch(submission.campaignId, campaignUpdates),
      ctx.db.patch(args.submissionId, submissionUpdates),
    ]);

    // Log view tracking entry
    await ctx.db.insert("viewTracking", {
      submissionId: args.submissionId,
      viewCount: args.viewCount,
      timestamp: now,
      source: args.source,
    });

    // Add to view history for smart monitoring (async to avoid blocking)
    ctx.runMutation(internal.smartMonitoring.addViewHistoryPoint, {
      submissionId: args.submissionId,
      viewCount: args.viewCount,
      timestamp: now,
    }).catch((error) => {
      logger.error("Failed to update view history for smart monitoring", {
        submissionId: args.submissionId,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    });

    // Handle threshold crossing for pending submissions
    if (
      submission.status === "pending" &&
      args.previousViews < 1000 &&
      args.viewCount >= 1000
    ) {
      await ctx.runMutation(internal.viewTrackingHelpers.markThresholdMet, {
        submissionId: args.submissionId,
      });
    }
  },
});

// Update last API call timestamp for rate limiting
export const updateLastApiCall = internalMutation({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.submissionId, {
      lastApiCall: Date.now(),
    });
  },
});

// Mark submission as having reached 1K view threshold
export const markThresholdMet = internalMutation({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) return;

    // Add a flag to indicate threshold was met (for UI purposes)
    await ctx.db.patch(args.submissionId, {
      thresholdMetAt: Date.now(),
    });

    // Send notification to brand about threshold being met
    const campaign = await ctx.db.get(submission.campaignId);
    if (campaign) {
      // Could trigger email notification here
      logger.info("Submission reached 1K views threshold", {
        submissionId: args.submissionId,
        campaignId: campaign._id,
      });
    }
  },
});

// SECURE: Validate submission access before returning view history
export const validateSubmissionAccess = internalQuery({
  args: {
    submissionId: v.id("submissions"),
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) return false;

    // Creator can access their own submissions
    if (submission.creatorId === args.userId) {
      return true;
    }

    // Brand can access submissions to their campaigns
    const campaign = await ctx.db.get(submission.campaignId);
    if (campaign && campaign.brandId === args.userId) {
      return true;
    }

    return false;
  },
});

// SECURE: Get submission with proper authorization check
export const getSubmissionWithAuth = internalQuery({
  args: {
    submissionId: v.id("submissions"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) return null;

    // Check if user is the creator of the submission
    if (submission.creatorId === args.userId) {
      return submission;
    }

    // Check if user is the brand owner of the campaign
    const campaign = await ctx.db.get(submission.campaignId);
    if (campaign && campaign.brandId === args.userId) {
      return submission;
    }

    return null;
  },
});

// Get view history for a submission (internal)
export const getViewHistory = internalQuery({
  args: {
    submissionId: v.id("submissions"),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("viewTracking")
      .withIndex("by_submission_id", (q) =>
        q.eq("submissionId", args.submissionId)
      )
      .order("desc")
      .take(args.limit);
  },
});

// Get old view records for cleanup
export const getOldViewRecords = internalQuery({
  args: { beforeTimestamp: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("viewTracking")
      .withIndex("by_timestamp", (q) => q.lt("timestamp", args.beforeTimestamp))
      .collect();
  },
});

// Delete a view tracking record
export const deleteViewRecord = internalMutation({
  args: { recordId: v.id("viewTracking") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.recordId);
  },
});

// SECURE: Get submission stats with proper validation
export const getSubmissionStats = query({
  args: { submissionId: v.id("submissions") },
  handler: async (
    ctx,
    args
  ): Promise<{
    submission: Doc<"submissions">;
    campaign: Doc<"campaigns"> | null;
    recentHistory: Doc<"viewTracking">[];
    hasReachedThreshold: boolean;
  } | null> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required");
    }

    // Validate access to this submission
    const hasAccess: boolean = await ctx.runQuery(
      internal.viewTrackingHelpers.validateSubmissionAccess,
      {
        submissionId: args.submissionId,
        userId,
      }
    );

    if (!hasAccess) {
      throw new Error("Unauthorized access to submission data");
    }

    const submission = await ctx.db.get(args.submissionId);
    if (!submission) {
      throw new Error("Submission not found");
    }

    // Get recent view history (last 7 days)
    const recentHistory: Doc<"viewTracking">[] = await ctx.runQuery(
      internal.viewTrackingHelpers.getViewHistory,
      {
        submissionId: args.submissionId,
        limit: 168, // 7 days * 24 hours
      }
    );

    const campaign = await ctx.db.get(submission.campaignId);

    return {
      submission,
      campaign,
      recentHistory,
      hasReachedThreshold: (submission.viewCount || 0) >= 1000,
    };
  },
});

// SECURE: Get view history with proper validation
export const getViewHistoryForUser = query({
  args: {
    submissionId: v.id("submissions"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Doc<"viewTracking">[]> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required");
    }

    // Validate access to this submission
    const hasAccess: boolean = await ctx.runQuery(
      internal.viewTrackingHelpers.validateSubmissionAccess,
      {
        submissionId: args.submissionId,
        userId,
      }
    );

    if (!hasAccess) {
      throw new Error("Unauthorized access to submission data");
    }

    const result: Doc<"viewTracking">[] = await ctx.runQuery(
      internal.viewTrackingHelpers.getViewHistory,
      {
        submissionId: args.submissionId,
        limit: args.limit || 24,
      }
    );

    return result;
  },
});

// SECURE: Rate-limited view refresh
export const canRefreshViews = internalQuery({
  args: {
    submissionId: v.id("submissions"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) return false;

    // Check access
    const hasAccess: boolean = await ctx.runQuery(
      internal.viewTrackingHelpers.validateSubmissionAccess,
      {
        submissionId: args.submissionId,
        userId: args.userId,
      }
    );

    if (!hasAccess) return false;

    // Rate limiting: Allow refresh every 5 minutes
    const lastRefresh = submission.lastApiCall || 0;
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

    return lastRefresh < fiveMinutesAgo;
  },
});
