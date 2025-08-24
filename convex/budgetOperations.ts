/**
 * Atomic Budget Operations
 * 
 * These functions handle all budget state changes with atomic operations
 * ensuring consistency across the simplified budget architecture.
 */

import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { 
  extractBudgetState, 
  reserveBudget, 
  spendReservedBudget, 
  releaseReservedBudget, 
  calculateRefundAmount,
  shouldAutoPause,
  budgetStateToUpdate,
  BudgetValidationResult 
} from "./lib/budgetService";
import { calculateEarnings } from "./lib/earnings";

/**
 * Reserve budget when submission is approved
 */
export const reserveBudgetForSubmission = internalMutation({
  args: {
    campaignId: v.id("campaigns"),
    submissionId: v.id("submissions"),
    viewCount: v.number(),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
    reservedAmount: v.optional(v.number()),
  }),
  handler: async (ctx, { campaignId, submissionId, viewCount }) => {
    const campaign = await ctx.db.get(campaignId);
    if (!campaign) {
      return { success: false, error: "Campaign not found" };
    }

    // Calculate earnings for this submission
    const earningsAmount = calculateEarnings(
      viewCount,
      campaign.cpmRate,
      campaign.maxPayoutPerSubmission
    );

    const currentState = extractBudgetState(campaign);
    const result = reserveBudget(currentState, earningsAmount, submissionId);

    if (!result.isValid) {
      return { success: false, error: result.error };
    }

    // Update campaign with new budget state
    await ctx.db.patch(campaignId, budgetStateToUpdate(result.newState!));

    // Check if campaign should auto-pause
    if (shouldAutoPause(result.newState!, campaign.maxPayoutPerSubmission)) {
      await ctx.db.patch(campaignId, { status: "paused" });
    }

    return { 
      success: true, 
      reservedAmount: earningsAmount 
    };
  },
});

/**
 * Convert reserved budget to spent when paying creator
 */
export const spendBudgetForPayout = internalMutation({
  args: {
    campaignId: v.id("campaigns"),
    submissionId: v.id("submissions"),
    amount: v.number(),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, { campaignId, submissionId, amount }) => {
    const campaign = await ctx.db.get(campaignId);
    if (!campaign) {
      return { success: false, error: "Campaign not found" };
    }

    const currentState = extractBudgetState(campaign);
    const result = spendReservedBudget(currentState, amount, submissionId);

    if (!result.isValid) {
      return { success: false, error: result.error };
    }

    // Update campaign with new budget state
    await ctx.db.patch(campaignId, budgetStateToUpdate(result.newState!));

    return { success: true };
  },
});

/**
 * Release reserved budget when submission is rejected or removed
 */
export const releaseBudgetForSubmission = internalMutation({
  args: {
    campaignId: v.id("campaigns"),
    submissionId: v.id("submissions"),
    amount: v.number(),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, { campaignId, submissionId, amount }) => {
    const campaign = await ctx.db.get(campaignId);
    if (!campaign) {
      return { success: false, error: "Campaign not found" };
    }

    const currentState = extractBudgetState(campaign);
    const result = releaseReservedBudget(currentState, amount, submissionId);

    if (!result.isValid) {
      return { success: false, error: result.error };
    }

    // Update campaign with new budget state
    await ctx.db.patch(campaignId, budgetStateToUpdate(result.newState!));

    // If campaign was paused due to budget, check if it can be reactivated
    if (campaign.status === "paused" && result.newState!.remainingBudget >= campaign.maxPayoutPerSubmission) {
      await ctx.db.patch(campaignId, { status: "active" });
    }

    return { success: true };
  },
});

/**
 * Update budget when submission view count increases
 */
export const updateBudgetForViewIncrease = internalMutation({
  args: {
    campaignId: v.id("campaigns"),
    submissionId: v.id("submissions"),
    oldViewCount: v.number(),
    newViewCount: v.number(),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
    budgetChange: v.optional(v.number()),
  }),
  handler: async (ctx, { campaignId, submissionId, oldViewCount, newViewCount }) => {
    const campaign = await ctx.db.get(campaignId);
    if (!campaign) {
      return { success: false, error: "Campaign not found" };
    }

    // Calculate the difference in earnings
    const oldEarnings = calculateEarnings(
      oldViewCount,
      campaign.cpmRate,
      campaign.maxPayoutPerSubmission
    );

    const newEarnings = calculateEarnings(
      newViewCount,
      campaign.cpmRate,
      campaign.maxPayoutPerSubmission
    );

    const earningsDelta = newEarnings - oldEarnings;

    // If no change in earnings, nothing to do
    if (earningsDelta <= 0) {
      return { success: true, budgetChange: 0 };
    }

    const currentState = extractBudgetState(campaign);

    // First release the old reserved amount
    const releaseResult = releaseReservedBudget(currentState, oldEarnings, submissionId);
    if (!releaseResult.isValid) {
      return { success: false, error: releaseResult.error };
    }

    // Then reserve the new amount
    const reserveResult = reserveBudget(releaseResult.newState!, newEarnings, submissionId);
    if (!reserveResult.isValid) {
      return { success: false, error: reserveResult.error };
    }

    // Update campaign with new budget state
    await ctx.db.patch(campaignId, budgetStateToUpdate(reserveResult.newState!));

    // Check if campaign should auto-pause
    if (shouldAutoPause(reserveResult.newState!, campaign.maxPayoutPerSubmission)) {
      await ctx.db.patch(campaignId, { status: "paused" });
    }

    return { 
      success: true, 
      budgetChange: earningsDelta 
    };
  },
});

/**
 * Complete campaign and calculate refund amount
 */
export const completeCampaignWithRefund = mutation({
  args: {
    campaignId: v.id("campaigns"),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
    refundAmount: v.optional(v.number()),
  }),
  handler: async (ctx, { campaignId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { success: false, error: "Unauthorized" };
    }

    const campaign = await ctx.db.get(campaignId);
    if (!campaign) {
      return { success: false, error: "Campaign not found" };
    }

    // Verify user owns the campaign
    if (campaign.brandId !== userId) {
      return { success: false, error: "Unauthorized" };
    }

    // Only allow completion of active or paused campaigns
    if (!["active", "paused"].includes(campaign.status)) {
      return { success: false, error: "Campaign cannot be completed" };
    }

    const currentState = extractBudgetState(campaign);
    const { refundAmount, finalState } = calculateRefundAmount(currentState);

    // Update campaign to completed state with final budget allocation
    await ctx.db.patch(campaignId, {
      status: "completed",
      ...budgetStateToUpdate(finalState),
    });

    return { 
      success: true, 
      refundAmount 
    };
  },
});

/**
 * Get campaign budget breakdown
 */
export const getCampaignBudgetBreakdown = query({
  args: {
    campaignId: v.id("campaigns"),
  },
  returns: v.union(
    v.null(),
    v.object({
      totalBudget: v.number(),
      spentBudget: v.number(),
      reservedBudget: v.number(),
      remainingBudget: v.number(),
      spentPercentage: v.number(),
      reservedPercentage: v.number(),
      remainingPercentage: v.number(),
    })
  ),
  handler: async (ctx, { campaignId }) => {
    const campaign = await ctx.db.get(campaignId);
    if (!campaign) {
      return null;
    }

    const budgetState = extractBudgetState(campaign);
    
    const spentPercentage = campaign.totalBudget > 0 
      ? (budgetState.spentBudget / campaign.totalBudget) * 100 
      : 0;
    const reservedPercentage = campaign.totalBudget > 0 
      ? (budgetState.reservedBudget / campaign.totalBudget) * 100 
      : 0;
    const remainingPercentage = campaign.totalBudget > 0 
      ? (budgetState.remainingBudget / campaign.totalBudget) * 100 
      : 0;

    return {
      ...budgetState,
      spentPercentage,
      reservedPercentage,
      remainingPercentage,
    };
  },
});

/**
 * Check if campaign should be auto-paused due to insufficient budget
 */
export const checkCampaignAutoPause = internalMutation({
  args: {
    campaignId: v.id("campaigns"),
  },
  returns: v.object({
    shouldPause: v.boolean(),
    reason: v.optional(v.string()),
  }),
  handler: async (ctx, { campaignId }) => {
    const campaign = await ctx.db.get(campaignId);
    if (!campaign) {
      return { shouldPause: false, reason: "Campaign not found" };
    }

    if (campaign.status !== "active") {
      return { shouldPause: false, reason: "Campaign not active" };
    }

    const currentState = extractBudgetState(campaign);
    const shouldPause = shouldAutoPause(currentState, campaign.maxPayoutPerSubmission);

    if (shouldPause) {
      await ctx.db.patch(campaignId, { status: "paused" });
      return { 
        shouldPause: true, 
        reason: "Insufficient budget for new submissions" 
      };
    }

    return { shouldPause: false };
  },
});