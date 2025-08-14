import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { logger } from "./logger";

// Constants for tier classification
const TIER_THRESHOLDS = {
  HOT_GROWTH_RATE: 100, // >100 views/hour = hot
  WARM_GROWTH_RATE: 20, // 20-100 views/hour = warm
  COLD_GROWTH_RATE: 5, // 5-20 views/hour = cold
  // <5 views/hour = archived
};

const MONITORING_INTERVALS = {
  hot: 15 * 60 * 1000, // 15 minutes
  warm: 60 * 60 * 1000, // 1 hour
  cold: 6 * 60 * 60 * 1000, // 6 hours
  archived: 24 * 60 * 60 * 1000, // 24 hours
};

export type MonitoringTier = "hot" | "warm" | "cold" | "archived";

// Calculate growth rate from view history (views per hour over last 24h)
function calculateGrowthRate(
  viewHistory: Array<{ timestamp: number; viewCount: number }>
): number {
  if (viewHistory.length < 2) return 0;

  // Sort by timestamp (newest first)
  const sortedHistory = [...viewHistory].sort(
    (a, b) => b.timestamp - a.timestamp
  );

  // Find views 24 hours ago
  const now = Date.now();
  const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

  const currentViews = sortedHistory[0].viewCount;
  let pastViews = currentViews;

  // Find the closest data point to 24 hours ago
  for (let i = sortedHistory.length - 1; i >= 0; i--) {
    if (sortedHistory[i].timestamp >= twentyFourHoursAgo) {
      pastViews = sortedHistory[i].viewCount;
      break;
    }
  }

  const viewsDelta = Math.max(0, currentViews - pastViews);
  const hoursElapsed = Math.min(
    24,
    (now - twentyFourHoursAgo) / (60 * 60 * 1000)
  );

  return hoursElapsed > 0 ? viewsDelta / hoursElapsed : 0;
}

// Classify submission into monitoring tier based on growth rate
function classifyTier(
  growthRate: number,
  currentTier?: MonitoringTier
): MonitoringTier {
  // Add hysteresis to prevent tier flapping
  const hysteresisBonus =
    currentTier === "hot" ? 10 : currentTier === "warm" ? 5 : 0;
  const adjustedGrowthRate = growthRate + hysteresisBonus;

  if (adjustedGrowthRate >= TIER_THRESHOLDS.HOT_GROWTH_RATE) return "hot";
  if (adjustedGrowthRate >= TIER_THRESHOLDS.WARM_GROWTH_RATE) return "warm";
  if (adjustedGrowthRate >= TIER_THRESHOLDS.COLD_GROWTH_RATE) return "cold";
  return "archived";
}

// Get submissions that need monitoring based on their tier and last update time
export const getSubmissionsDueForUpdate = internalQuery({
  args: {
    tier: v.union(
      v.literal("hot"),
      v.literal("warm"),
      v.literal("cold"),
      v.literal("archived")
    ),
  },
  returns: v.array(
    v.object({
      _id: v.id("submissions"),
      contentUrl: v.string(),
      viewCount: v.optional(v.number()),
      lastViewUpdate: v.optional(v.number()),
      monitoringTier: v.optional(v.string()),
      growthRate: v.optional(v.number()),
      viewHistory: v.optional(
        v.array(
          v.object({
            timestamp: v.number(),
            viewCount: v.number(),
          })
        )
      ),
    })
  ),
  handler: async (ctx, args) => {
    const now = Date.now();
    const interval = MONITORING_INTERVALS[args.tier];
    const cutoffTime = now - interval;

    return await ctx.db
      .query("submissions")
      .withIndex("by_tier_and_update", (q) =>
        q.eq("monitoringTier", args.tier).lt("lastViewUpdate", cutoffTime)
      )
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "pending"),
          q.eq(q.field("status"), "approved")
        )
      )
      .collect();
  },
});

// Get all submissions that need tier classification (new submissions or periodic reclassification)
export const getSubmissionsForTierUpdate = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const sixHoursAgo = now - 6 * 60 * 60 * 1000; // Reclassify every 6 hours

    return await ctx.db
      .query("submissions")
      .filter((q) =>
        q.and(
          q.or(
            q.eq(q.field("status"), "pending"),
            q.eq(q.field("status"), "approved")
          ),
          q.or(
            q.eq(q.field("monitoringTier"), undefined),
            q.lt(q.field("lastTierUpdate"), sixHoursAgo)
          )
        )
      )
      .collect();
  },
});

// Update submission's monitoring tier and growth metrics
export const updateSubmissionTier = internalMutation({
  args: {
    submissionId: v.id("submissions"),
    newTier: v.union(
      v.literal("hot"),
      v.literal("warm"),
      v.literal("cold"),
      v.literal("archived")
    ),
    growthRate: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.submissionId, {
      monitoringTier: args.newTier,
      growthRate: args.growthRate,
      lastTierUpdate: Date.now(),
    });

    logger.info("Updated submission monitoring tier", {
      submissionId: args.submissionId,
      newTier: args.newTier,
      growthRate: args.growthRate,
    });
  },
});

// Add view data point to submission's history (keep last 7 days)
export const addViewHistoryPoint = internalMutation({
  args: {
    submissionId: v.id("submissions"),
    viewCount: v.number(),
    timestamp: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) return;

    const currentHistory = submission.viewHistory || [];
    const sevenDaysAgo = args.timestamp - 7 * 24 * 60 * 60 * 1000;

    // Add new point and filter out old data (keep last 7 days)
    const updatedHistory = [
      ...currentHistory.filter((point) => point.timestamp > sevenDaysAgo),
      { timestamp: args.timestamp, viewCount: args.viewCount },
    ].slice(-168); // Max 168 points (7 days * 24 hours)

    await ctx.db.patch(args.submissionId, {
      viewHistory: updatedHistory,
    });
  },
});

// Smart tier classification action that processes all submissions needing updates
export const updateAllTierClassifications = internalAction({
  args: {},
  returns: v.object({
    processedCount: v.number(),
    tierChanges: v.object({
      hot: v.number(),
      warm: v.number(),
      cold: v.number(),
      archived: v.number(),
    }),
  }),
  handler: async (ctx) => {
    const submissions = await ctx.runQuery(
      internal.smartMonitoring.getSubmissionsForTierUpdate
    );

    let processedCount = 0;
    const tierChanges = { hot: 0, warm: 0, cold: 0, archived: 0 };

    for (const submission of submissions) {
      try {
        const growthRate = calculateGrowthRate(submission.viewHistory || []);
        const currentTier = submission.monitoringTier as MonitoringTier;
        const newTier = classifyTier(growthRate, currentTier);

        // Only update if tier changed or it's a new submission
        if (newTier !== currentTier) {
          await ctx.runMutation(internal.smartMonitoring.updateSubmissionTier, {
            submissionId: submission._id,
            newTier,
            growthRate,
          });

          tierChanges[newTier]++;
        }

        processedCount++;
      } catch (error) {
        logger.error("Failed to update tier classification", {
          submissionId: submission._id,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }

    logger.info("Tier classification completed", {
      processedCount: processedCount,
      totalChanges: Object.values(tierChanges).reduce(
        (sum, count) => sum + count,
        0
      ),
    });

    return { processedCount, tierChanges };
  },
});

// Smart monitoring action for a specific tier
export const updateTierSubmissions = internalAction({
  args: {
    tier: v.union(
      v.literal("hot"),
      v.literal("warm"),
      v.literal("cold"),
      v.literal("archived")
    ),
  },
  returns: v.object({
    updatedCount: v.number(),
    errorCount: v.number(),
    totalProcessed: v.number(),
    apiCallsSaved: v.number(),
  }),
  handler: async (
    ctx,
    args
  ): Promise<{
    updatedCount: number;
    errorCount: number;
    totalProcessed: number;
    apiCallsSaved: number;
  }> => {
    const submissions = await ctx.runQuery(
      internal.smartMonitoring.getSubmissionsDueForUpdate,
      { tier: args.tier }
    );

    let updatedCount = 0;
    let errorCount = 0;
    const totalSubmissions = await ctx.runQuery(
      internal.submissions.getActiveSubmissions
    );

    // Calculate API calls saved by smart monitoring vs checking all submissions
    const apiCallsSaved = Math.max(
      0,
      totalSubmissions.length - submissions.length
    );

    for (const submission of submissions) {
      try {
        // Get fresh view count from TikTok API (rate-limited)
        const result = await ctx.runAction(internal.viewTracking.getViewCount, {
          contentUrl: submission.contentUrl,
          submissionId: submission._id,
          platform: submission.platform,
        });

        // Add to view history for growth rate calculation
        await ctx.runMutation(internal.smartMonitoring.addViewHistoryPoint, {
          submissionId: submission._id,
          viewCount: result.viewCount,
          timestamp: Date.now(),
        });

        updatedCount++;
      } catch (error) {
        logger.error("Failed to update tier submission views", {
          submissionId: submission._id,
          error: error instanceof Error ? error : new Error(String(error)),
        });
        errorCount++;
      }
    }

    logger.info(`Tier monitoring completed`, {
      tier: args.tier,
      updatedCount,
      errorCount,
      totalProcessed: submissions.length,
      apiCallsSaved,
    });

    return {
      updatedCount,
      errorCount,
      totalProcessed: submissions.length,
      apiCallsSaved,
    };
  },
});

// Get monitoring statistics for analytics
export const getMonitoringStats = internalQuery({
  args: {},
  returns: v.object({
    tierCounts: v.object({
      hot: v.number(),
      warm: v.number(),
      cold: v.number(),
      archived: v.number(),
      unclassified: v.number(),
    }),
    totalApiCallsPerHour: v.number(),
    estimatedSavings: v.number(),
  }),
  handler: async (ctx) => {
    const allSubmissions = await ctx.db
      .query("submissions")
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "pending"),
          q.eq(q.field("status"), "approved")
        )
      )
      .collect();

    const tierCounts = {
      hot: 0,
      warm: 0,
      cold: 0,
      archived: 0,
      unclassified: 0,
    };

    for (const submission of allSubmissions) {
      if (!submission.monitoringTier) {
        tierCounts.unclassified++;
      } else {
        tierCounts[submission.monitoringTier]++;
      }
    }

    // Calculate API calls per hour with smart monitoring
    const smartApiCallsPerHour =
      tierCounts.hot * (60 / 15) + // Hot: every 15min = 4 calls/hour
      tierCounts.warm * 1 + // Warm: every hour = 1 call/hour
      tierCounts.cold * (1 / 6) + // Cold: every 6 hours = 0.167 calls/hour
      tierCounts.archived * (1 / 24); // Archived: daily = 0.042 calls/hour

    // Calculate API calls per hour with old system (every 30min for all)
    const oldApiCallsPerHour = allSubmissions.length * 2; // Every 30min = 2 calls/hour

    const estimatedSavings =
      ((oldApiCallsPerHour - smartApiCallsPerHour) / oldApiCallsPerHour) * 100;

    return {
      tierCounts,
      totalApiCallsPerHour: Math.round(smartApiCallsPerHour * 100) / 100,
      estimatedSavings: Math.round(estimatedSavings * 100) / 100,
    };
  },
});

// Public query for monitoring stats (brand users only)
export const getMonitoringStatsForUser = query({
  args: {},
  returns: v.object({
    tierCounts: v.object({
      hot: v.number(),
      warm: v.number(),
      cold: v.number(),
      archived: v.number(),
      unclassified: v.number(),
    }),
    totalApiCallsPerHour: v.number(),
    estimatedSavings: v.number(),
    rateLimitStatus: v.object({
      requestsLastMinute: v.number(),
      utilizationPercent: v.number(),
      canMakeRequest: v.boolean(),
    }),
  }),
  handler: async (
    ctx
  ): Promise<{
    tierCounts: {
      hot: number;
      warm: number;
      cold: number;
      archived: number;
      unclassified: number;
    };
    totalApiCallsPerHour: number;
    estimatedSavings: number;
    rateLimitStatus: {
      requestsLastMinute: number;
      utilizationPercent: number;
      canMakeRequest: boolean;
    };
  }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Authentication required");
    }

    // Check if user is an admin
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!profile || profile.userType !== "admin") {
      throw new Error("Only administrators can access monitoring statistics");
    }

    // Get monitoring stats and rate limiter status
    const stats = await ctx.runQuery(
      internal.smartMonitoring.getMonitoringStats
    );
    const rateLimitStatus = await ctx.runQuery(
      internal.rateLimiter.getRateLimiterStatus
    );

    return {
      ...stats,
      rateLimitStatus: {
        requestsLastMinute: rateLimitStatus.requestsLastMinute,
        utilizationPercent: rateLimitStatus.utilizationPercent,
        canMakeRequest: rateLimitStatus.canMakeRequest,
      },
    };
  },
});
