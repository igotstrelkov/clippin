// Simplified optimized query patterns for better performance

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { query } from "./_generated/server";

/**
 * Get campaign summary data without full objects for dashboard metrics
 */
export const getCampaignSummary = query({
  args: {},
  handler: async (ctx) => {
    const campaigns = await ctx.db
      .query("campaigns")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    // Calculate metrics efficiently
    const totalBudget = campaigns.reduce((sum, c) => sum + c.totalBudget, 0);
    const avgCpm = campaigns.length > 0 
      ? campaigns.reduce((sum, c) => sum + c.cpmRate, 0) / campaigns.length 
      : 0;

    // Group by categories
    const categoryMap = new Map<string, number>();
    campaigns.forEach(campaign => {
      categoryMap.set(campaign.category, (categoryMap.get(campaign.category) || 0) + 1);
    });

    const categories = Array.from(categoryMap.entries()).map(([category, count]) => ({
      category,
      count,
    }));

    return {
      totalActiveCampaigns: campaigns.length,
      totalBudget,
      avgCpm,
      categories,
    };
  },
});

/**
 * Get creator dashboard metrics without loading full submission objects
 */
export const getCreatorMetrics = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return {
        totalEarnings: 0,
        totalSubmissions: 0,
        approvedSubmissions: 0,
        totalViews: 0,
        averageViews: 0,
      };
    }

    const [profile, submissions] = await Promise.all([
      ctx.db.query("profiles")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .unique(),
      ctx.db.query("submissions")
        .withIndex("by_creator_id", (q) => q.eq("creatorId", userId))
        .collect(),
    ]);

    // Calculate metrics efficiently
    const totalSubmissions = submissions.length;
    const approvedSubmissions = submissions.filter(s => s.status === "approved").length;
    const totalViews = submissions.reduce((sum, s) => sum + (s.viewCount || 0), 0);
    const averageViews = totalSubmissions > 0 ? totalViews / totalSubmissions : 0;

    return {
      totalEarnings: profile?.totalEarnings || 0,
      totalSubmissions,
      approvedSubmissions,
      totalViews,
      averageViews,
    };
  },
});

/**
 * Get recent submissions with minimal data for performance
 */
export const getRecentSubmissions = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    // Get recent submissions
    const submissions = await ctx.db.query("submissions")
      .withIndex("by_creator_id", (q) => q.eq("creatorId", userId))
      .order("desc")
      .take(args.limit || 10);

    // Get campaign titles in batch
    const campaignIds = submissions.map(s => s.campaignId);
    const campaigns = await Promise.all(
      campaignIds.map(id => ctx.db.get(id))
    );

    const campaignTitleMap = new Map(
      campaigns.filter(Boolean).map(c => [c!._id, c!.title])
    );

    return submissions.map(submission => ({
      _id: submission._id,
      campaignTitle: campaignTitleMap.get(submission.campaignId) || "Unknown Campaign",
      status: submission.status,
      viewCount: submission.viewCount || 0,
      earnings: submission.earnings || 0,
      submittedAt: submission.submittedAt,
      tiktokUrl: submission.tiktokUrl,
    }));
  },
});

/**
 * Get brand campaign metrics efficiently
 */
export const getBrandMetrics = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return {
        totalCampaigns: 0,
        activeCampaigns: 0,
        totalSpent: 0,
        totalViews: 0,
        totalSubmissions: 0,
      };
    }

    const campaigns = await ctx.db.query("campaigns")
      .withIndex("by_brand_id", (q) => q.eq("brandId", userId))
      .collect();

    const totalCampaigns = campaigns.length;
    const activeCampaigns = campaigns.filter(c => c.status === "active").length;
    const totalSpent = campaigns.reduce((sum, c) => sum + (c.totalBudget - c.remainingBudget), 0);
    const totalViews = campaigns.reduce((sum, c) => sum + (c.totalViews || 0), 0);
    const totalSubmissions = campaigns.reduce((sum, c) => sum + (c.totalSubmissions || 0), 0);

    return {
      totalCampaigns,
      activeCampaigns,
      totalSpent,
      totalViews,
      totalSubmissions,
    };
  },
});