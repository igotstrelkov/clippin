/**
 * Atomic Budget Operations
 *
 * These functions handle all budget state changes with atomic operations
 * ensuring consistency across the simplified budget architecture.
 *
 * RACE CONDITION PREVENTION:
 * Convex provides built-in ACID transactions that automatically prevent race conditions:
 *
 * 1. ATOMICITY: Each mutation runs as a single atomic transaction
 *    - All reads and writes within a mutation are isolated
 *    - Either all changes commit or none do
 *
 * 2. CONSISTENCY: Budget invariants are always maintained
 *    - totalBudget = spentBudget + reservedBudget + remainingBudget
 *    - No negative values allowed
 *    - Validation checks prevent invalid states
 *
 * 3. ISOLATION: Concurrent mutations are serialized
 *    - If two users approve submissions simultaneously, Convex serializes the operations
 *    - Each mutation sees a consistent snapshot of the database
 *    - No dirty reads, phantom reads, or lost updates
 *
 * 4. DURABILITY: All committed changes are persistent
 *    - Once a mutation completes, the changes are durable
 *    - No risk of lost budget updates
 *
 * EXAMPLE RACE CONDITION SCENARIO (automatically prevented):
 * - Campaign has €50 remaining budget
 * - User A approves submission worth €30
 * - User B approves submission worth €40 simultaneously
 * - Convex serializes these operations:
 *   - First mutation reserves €30 (success, €20 remaining)
 *   - Second mutation tries to reserve €40 (fails, insufficient budget)
 * - Result: No over-spending, budget integrity maintained
 */

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import {
  budgetStateToUpdate,
  calculateRefundAmount,
  extractBudgetState,
  releaseReservedBudget,
  reserveBudget,
  shouldAutoComplete,
  spendReservedBudget,
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
    // ATOMIC TRANSACTION: All operations below execute in single atomic unit
    // Convex ensures no other mutations can modify this campaign until completion
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

    // Extract current budget state and validate reservation atomically
    const currentState = extractBudgetState(campaign);
    const result = reserveBudget(currentState, earningsAmount, submissionId);

    if (!result.isValid) {
      return { success: false, error: result.error };
    }

    // ATOMICALLY update campaign with new budget state
    // This single patch operation ensures budget consistency across all fields
    await ctx.db.patch(campaignId, budgetStateToUpdate(result.newState!));

    // Check if campaign should be completed (budget exhausted) or paused (budget low)
    if (shouldAutoComplete(result.newState!, campaign.maxPayoutPerSubmission)) {
      await ctx.db.patch(campaignId, { status: "completed" });
    }

    return {
      success: true,
      reservedAmount: earningsAmount,
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
    // ATOMIC TRANSACTION: Convert reserved budget to spent budget
    // Prevents double-spending and ensures budget integrity
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
// export const releaseBudgetForSubmission = internalMutation({
//   args: {
//     campaignId: v.id("campaigns"),
//     submissionId: v.id("submissions"),
//     amount: v.number(),
//   },
//   returns: v.object({
//     success: v.boolean(),
//     error: v.optional(v.string()),
//   }),
//   handler: async (ctx, { campaignId, submissionId, amount }) => {
//     // ATOMIC TRANSACTION: Release reserved budget back to remaining
//     // Ensures no budget is lost when submissions are rejected
//     const campaign = await ctx.db.get(campaignId);
//     if (!campaign) {
//       return { success: false, error: "Campaign not found" };
//     }

//     const currentState = extractBudgetState(campaign);
//     const result = releaseReservedBudget(currentState, amount, submissionId);

//     if (!result.isValid) {
//       return { success: false, error: result.error };
//     }

//     // Update campaign with new budget state
//     await ctx.db.patch(campaignId, budgetStateToUpdate(result.newState!));

//     // If campaign was paused due to budget, check if it can be reactivated
//     if (
//       campaign.status === "paused" &&
//       result.newState!.remainingBudget >= campaign.maxPayoutPerSubmission
//     ) {
//       await ctx.db.patch(campaignId, { status: "active" });
//     }

//     return { success: true };
//   },
// });

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
  handler: async (
    ctx,
    { campaignId, submissionId, oldViewCount, newViewCount }
  ) => {
    // ATOMIC TRANSACTION: Update budget when view count increases
    // Prevents race conditions during concurrent view updates
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

    // CRITICAL SECTION: Handle budget update based on old earnings
    // If oldEarnings is 0, just reserve the new amount directly
    // Otherwise, release old amount then reserve new amount
    let finalState;

    if (oldEarnings === 0) {
      // First time earnings - just reserve the new amount
      const reserveResult = reserveBudget(
        currentState,
        newEarnings,
        submissionId
      );
      if (!reserveResult.isValid) {
        return { success: false, error: reserveResult.error };
      }
      finalState = reserveResult.newState!;
    } else {
      // Update existing earnings - release old then reserve new
      const releaseResult = releaseReservedBudget(
        currentState,
        oldEarnings,
        submissionId
      );
      if (!releaseResult.isValid) {
        return { success: false, error: releaseResult.error };
      }

      const reserveResult = reserveBudget(
        releaseResult.newState!,
        newEarnings,
        submissionId
      );
      if (!reserveResult.isValid) {
        return { success: false, error: reserveResult.error };
      }
      finalState = reserveResult.newState!;
    }

    // Update campaign with new budget state
    await ctx.db.patch(campaignId, budgetStateToUpdate(finalState));

    // Check if campaign should be completed (budget exhausted) or paused (budget low)
    if (shouldAutoComplete(finalState, campaign.maxPayoutPerSubmission)) {
      await ctx.db.patch(campaignId, { status: "completed" });
    }

    return {
      success: true,
      budgetChange: earningsDelta,
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
      refundAmount,
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

    const spentPercentage =
      campaign.totalBudget > 0
        ? (budgetState.spentBudget / campaign.totalBudget) * 100
        : 0;
    const reservedPercentage =
      campaign.totalBudget > 0
        ? (budgetState.reservedBudget / campaign.totalBudget) * 100
        : 0;
    const remainingPercentage =
      campaign.totalBudget > 0
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
export const checkCampaignAutoComplete = internalMutation({
  args: {
    campaignId: v.id("campaigns"),
  },
  returns: v.object({
    shouldComplete: v.boolean(),
    reason: v.optional(v.string()),
  }),
  handler: async (ctx, { campaignId }) => {
    const campaign = await ctx.db.get(campaignId);
    if (!campaign) {
      return { shouldComplete: false, reason: "Campaign not found" };
    }

    if (campaign.status !== "active") {
      return { shouldComplete: false, reason: "Campaign not active" };
    }

    const currentState = extractBudgetState(campaign);
    const shouldComplete = shouldAutoComplete(
      currentState,
      campaign.maxPayoutPerSubmission
    );

    if (shouldComplete) {
      await ctx.db.patch(campaignId, { status: "completed" });
      return {
        shouldComplete: true,
        reason: "Insufficient budget for new submissions",
      };
    }

    return { shouldComplete: false };
  },
});
