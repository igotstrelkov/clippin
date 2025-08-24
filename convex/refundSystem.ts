/**
 * Automatic Refund System
 * 
 * Handles automatic refunds of unused budget when campaigns complete
 * ensuring brands are only charged for actual creator payouts.
 */

import { v } from "convex/values";
import { internalMutation, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { extractBudgetState, calculateRefundAmount } from "./lib/budgetService";
import { logger } from "./logger";

/**
 * Calculate refund amount for a completed campaign
 */
export const calculateCampaignRefund = mutation({
  args: {
    campaignId: v.id("campaigns"),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
    refundAmount: v.optional(v.number()),
    breakdown: v.optional(v.object({
      totalBudget: v.number(),
      spentBudget: v.number(),
      reservedBudget: v.number(),
      refundableAmount: v.number(),
    })),
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

    const currentState = extractBudgetState(campaign);
    const { refundAmount } = calculateRefundAmount(currentState);

    return {
      success: true,
      refundAmount,
      breakdown: {
        totalBudget: currentState.totalBudget,
        spentBudget: currentState.spentBudget,
        reservedBudget: currentState.reservedBudget,
        refundableAmount: refundAmount,
      },
    };
  },
});

/**
 * Process automatic refund when campaign is completed
 */
export const processAutomaticRefund = internalMutation({
  args: {
    campaignId: v.id("campaigns"),
    reason: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
    refundAmount: v.optional(v.number()),
    stripeRefundId: v.optional(v.string()),
  }),
  handler: async (ctx, { campaignId, reason }) => {
    const campaign = await ctx.db.get(campaignId);
    if (!campaign) {
      return { success: false, error: "Campaign not found" };
    }

    // Only process refunds for campaigns with payment
    if (campaign.paymentStatus !== "paid" || !campaign.stripePaymentIntentId) {
      return { success: false, error: "No payment to refund" };
    }

    const currentState = extractBudgetState(campaign);
    const { refundAmount, finalState } = calculateRefundAmount(currentState);

    // If no refund needed, just update the final state
    if (refundAmount <= 0) {
      await ctx.db.patch(campaignId, {
        status: "completed",
        spentBudget: finalState.spentBudget,
        reservedBudget: finalState.reservedBudget,
        remainingBudget: finalState.remainingBudget,
      });

      return { success: true, refundAmount: 0 };
    }

    try {
      // Process Stripe refund
      // Note: This would integrate with Stripe API in production
      // For now, we'll simulate the refund process
      const stripeRefundId = `refund_${Date.now()}`;

      // Create refund payment record
      await ctx.db.insert("payments", {
        userId: campaign.brandId,
        type: "campaign_payment",
        amount: -refundAmount, // Negative amount indicates refund
        status: "completed",
        campaignId: campaign._id,
        createdAt: Date.now(),
        metadata: {
          transferAmount: refundAmount,
          platformFee: 0,
          stripeFee: 0,
        },
      });

      // Update campaign to completed state with final budget allocation
      await ctx.db.patch(campaignId, {
        status: "completed",
        totalBudget: finalState.totalBudget, // Adjust total to actual spent amount
        spentBudget: finalState.spentBudget,
        reservedBudget: finalState.reservedBudget,
        remainingBudget: finalState.remainingBudget,
      });

      logger.info("Automatic refund processed", {
        campaignId,
        metadata: {
          refundAmount,
          stripeRefundId,
          reason: reason || "Campaign completion",
          originalTotal: currentState.totalBudget,
          finalTotal: finalState.totalBudget,
        },
      });

      return {
        success: true,
        refundAmount,
        stripeRefundId,
      };
    } catch (error) {
      logger.error("Failed to process automatic refund", {
        campaignId,
        metadata: {
          refundAmount,
        },
        error: error instanceof Error ? error : new Error(String(error)),
      });

      return {
        success: false,
        error: "Failed to process refund",
      };
    }
  },
});

/**
 * Check and process refunds for all completed campaigns
 */
export const processAllPendingRefunds = internalMutation({
  args: {},
  returns: v.object({
    processed: v.number(),
    refunded: v.number(),
    totalRefundAmount: v.number(),
  }),
  handler: async (ctx) => {
    // Find completed campaigns that haven't been processed for refunds
    const completedCampaigns = await ctx.db
      .query("campaigns")
      .withIndex("by_status", (q) => q.eq("status", "completed"))
      .filter((q) => 
        q.and(
          q.eq(q.field("paymentStatus"), "paid"),
          q.neq(q.field("remainingBudget"), 0) // Has unused budget
        )
      )
      .collect();

    let processedCount = 0;
    let refundedCount = 0;
    let totalRefundAmount = 0;

    logger.info("Processing pending refunds", {
      metadata: {
        campaignsToProcess: completedCampaigns.length,
      },
    });

    for (const campaign of completedCampaigns) {
      try {
        const refundResult = await ctx.runMutation(
          internal.refundSystem.processAutomaticRefund,
          {
            campaignId: campaign._id,
            reason: "Bulk refund processing",
          }
        );

        processedCount++;

        if (refundResult.success && refundResult.refundAmount && refundResult.refundAmount > 0) {
          refundedCount++;
          totalRefundAmount += refundResult.refundAmount;
        }
      } catch (error) {
        logger.error("Failed to process refund for campaign", {
          campaignId: campaign._id,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }

    logger.info("Completed refund processing", {
      metadata: {
        processed: processedCount,
        refunded: refundedCount,
        totalRefundAmount,
      },
    });

    return {
      processed: processedCount,
      refunded: refundedCount,
      totalRefundAmount,
    };
  },
});

/**
 * Manual refund processing for brand dashboard
 */
export const requestCampaignRefund = mutation({
  args: {
    campaignId: v.id("campaigns"),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
    refundAmount: v.optional(v.number()),
  }),
  handler: async (ctx, { campaignId }): Promise<{
    success: boolean;
    error?: string;
    refundAmount?: number;
  }> => {
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

    // Can only request refunds for completed campaigns
    if (campaign.status !== "completed") {
      return { success: false, error: "Campaign must be completed to request refund" };
    }

    // Process the refund
    const refundResult = await ctx.runMutation(
      internal.refundSystem.processAutomaticRefund,
      {
        campaignId,
        reason: "Manual refund request",
      }
    );

    return {
      success: refundResult.success,
      error: refundResult.error,
      refundAmount: refundResult.refundAmount,
    };
  },
});