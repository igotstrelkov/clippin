import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { calculateEarnings } from "./lib/earnings";
import { logger } from "./logger";
import { calculateGrowthRate } from "./smartMonitoring";

// Update submission view count and log tracking entry

// Helper function to process earnings updates using new budget system
async function processEarningsUpdate(
  ctx: { runMutation: any },
  submission: Doc<"submissions">,
  campaign: Doc<"campaigns">,
  oldViewCount: number,
  newViewCount: number
) {
  // Only process earnings for approved submissions
  if (submission.status !== "approved") {
    return null;
  }

  // Validate campaign is still active or paused (paused campaigns still track earnings)
  if (!["active", "paused"].includes(campaign.status)) {
    return null;
  }

  // Calculate new earnings
  const newEarnings = calculateEarnings(
    newViewCount,
    campaign.cpmRate,
    campaign.maxPayoutPerSubmission
  );

  const currentEarnings = submission.earnings || 0;
  const earningsDelta = newEarnings - currentEarnings;

  // Only proceed if earnings actually increased
  if (earningsDelta <= 0) {
    return null;
  }

  // Use atomic budget operation to update reserved budget
  const budgetResult = await ctx.runMutation(
    internal.budgetOperations.updateBudgetForViewIncrease,
    {
      campaignId: campaign._id,
      submissionId: submission._id,
      oldViewCount,
      newViewCount,
    }
  );

  if (!budgetResult.success) {
    logger.warn("Failed to update budget for view increase", {
      submissionId: submission._id,
      campaignId: campaign._id,
      error: budgetResult.error,
    });
    return null;
  }

  return {
    submissionUpdates: { earnings: newEarnings },
    earningsDelta,
    budgetUpdated: true,
  };
}

export const updateSubmissionViewsAndEarnings = internalMutation({
  args: {
    submissionId: v.id("submissions"),
    viewCount: v.number(),
    previousViews: v.number(),
  },
  handler: async (ctx, args) => {
    // Input validation
    if (args.viewCount < 0) {
      throw new Error("View count cannot be negative");
    }

    if (args.viewCount < args.previousViews) {
      logger.warn("View count decreased, skipping update", {
        submissionId: args.submissionId,
      });
      return;
    }

    // Fetch required entities
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) {
      throw new Error("Submission not found");
    }

    const campaign = await ctx.db.get(submission.campaignId);
    if (!campaign) {
      throw new Error("Campaign not found");
    }

    // Skip update if no actual change
    const viewDelta = args.viewCount - args.previousViews;
    if (viewDelta === 0) {
      return;
    }

    const now = Date.now();

    // Prepare submission updates
    const submissionUpdates: Partial<Doc<"submissions">> = {
      viewCount: args.viewCount,
      lastViewUpdate: now,
    };

    // Prepare campaign updates
    const campaignUpdates: Partial<Doc<"campaigns">> = {
      totalViews: (campaign.totalViews || 0) + viewDelta,
    };

    // Handle earnings and budget updates for approved submissions
    const earningsUpdate = await processEarningsUpdate(
      ctx,
      submission,
      campaign,
      args.previousViews,
      args.viewCount
    );

    if (earningsUpdate) {
      Object.assign(submissionUpdates, earningsUpdate.submissionUpdates);

      // Update creator's total earnings in their profile
      if (earningsUpdate.earningsDelta > 0) {
        const creatorProfile = await ctx.db
          .query("profiles")
          .withIndex("by_user_id", (q) => q.eq("userId", submission.creatorId))
          .unique();

        if (creatorProfile) {
          const newTotalEarnings =
            (creatorProfile.totalEarnings || 0) + earningsUpdate.earningsDelta;
          await ctx.db.patch(creatorProfile._id, {
            totalEarnings: Math.max(0, newTotalEarnings), // Ensure non-negative
          });
        } else {
          logger.warn("Creator profile not found for earnings update", {
            submissionId: args.submissionId,
            creatorId: submission.creatorId,
          });
        }
      }
    }

    // Perform atomic database updates
    await Promise.all([
      ctx.db.patch(submission.campaignId, campaignUpdates),
      ctx.db.patch(args.submissionId, submissionUpdates),
    ]);

    // Add to view history for smart monitoring (async to avoid blocking)
    const viewHistoryPromise = ctx
      .runMutation(internal.smartMonitoring.addViewHistoryPoint, {
        submissionId: args.submissionId,
        viewCount: args.viewCount,
        timestamp: now,
      })
      .catch((error) => {
        logger.error("Failed to update view history for smart monitoring", {
          submissionId: args.submissionId,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      });

    const growthRate = calculateGrowthRate(submission.viewHistory || []);

    // Log view tracking entry
    await ctx.db.insert("viewTracking", {
      submissionId: args.submissionId,
      viewCount: args.viewCount,
      timestamp: now,
      growthRate: growthRate,
    });

    // Wait for view history update to complete
    await viewHistoryPromise;

    logger.info("View count updated successfully", {
      submissionId: args.submissionId,
    });
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

// Get old view records in batches for cleanup
export const getOldViewRecordsBatch = internalQuery({
  args: {
    beforeTimestamp: v.number(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("viewTracking")
      .withIndex("by_timestamp", (q) => q.lt("timestamp", args.beforeTimestamp))
      .take(args.limit);
  },
});

// Delete multiple view tracking records in a single operation
export const deleteViewRecordsBatch = internalMutation({
  args: { recordIds: v.array(v.id("viewTracking")) },
  handler: async (ctx, args) => {
    let deletedCount = 0;

    // Delete records in parallel for better performance
    await Promise.all(
      args.recordIds.map(async (recordId) => {
        try {
          await ctx.db.delete(recordId);
          deletedCount++;
        } catch (error) {
          // Log individual failures but don't stop the batch
          logger.warn("Failed to delete view record", {
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      })
    );

    return deletedCount;
  },
});

// SECURE: Get view history with proper validation
export const getViewHistory = query({
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

    const result: Doc<"viewTracking">[] = await ctx.db
      .query("viewTracking")
      .withIndex("by_submission_id", (q) =>
        q.eq("submissionId", args.submissionId)
      )
      .order("desc")
      .take(args.limit || 24);

    return result;
  },
});
