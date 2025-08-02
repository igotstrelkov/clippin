import { query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Get creator's payout history
export const getCreatorPayouts = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const payouts = await ctx.db
      .query("payments")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("type"), "creator_payout"))
      .order("desc")
      .collect();

    return payouts;
  },
});

// Get pending earnings for creator
export const getPendingEarnings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { totalPending: 0, submissions: [] };

    // Get approved submissions that haven't been paid out yet
    const approvedSubmissions = await ctx.db
      .query("submissions")
      .withIndex("by_creator_id", (q) => q.eq("creatorId", userId))
      .filter((q) => q.eq(q.field("status"), "approved"))
      .collect();

    // Calculate pending earnings: total earnings minus what's already been paid out
    const totalPending = approvedSubmissions.reduce((sum, sub) => {
      const earnings = sub.earnings || 0;
      const paidOut = sub.paidOutAmount || 0;
      const pending = Math.max(0, earnings - paidOut); // Ensure non-negative
      return sum + pending;
    }, 0);

    const submissionsWithCampaigns = await Promise.all(
      approvedSubmissions.map(async (submission) => {
        const campaign = await ctx.db.get(submission.campaignId);
        const earnings = submission.earnings || 0;
        const paidOut = submission.paidOutAmount || 0;
        const pending = Math.max(0, earnings - paidOut);
        
        return {
          ...submission,
          campaignTitle: campaign?.title || "Unknown Campaign",
          pendingAmount: pending, // Amount pending payout for this submission
          totalEarnings: earnings, // Total lifetime earnings
          paidOutAmount: paidOut, // Amount already paid out
        };
      })
    );

    return {
      totalPending,
      submissions: submissionsWithCampaigns,
    };
  },
});

// Update paidOutAmount for submissions after successful payout
export const updateSubmissionsPaidAmount = internalMutation({
  args: {
    submissionIds: v.array(v.id("submissions")),
  },
  handler: async (ctx, args) => {
    // Update each submission to mark current earnings as paid out
    for (const submissionId of args.submissionIds) {
      const submission = await ctx.db.get(submissionId);
      if (submission) {
        const currentEarnings = submission.earnings || 0;
        await ctx.db.patch(submissionId, {
          paidOutAmount: currentEarnings, // Set paid amount to current earnings
        });
      }
    }
  },
});

// Internal function to get creator's Stripe account info
export const getCreatorStripeAccount = internalQuery({
  args: { creatorId: v.id("users") },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user_id", (q) => q.eq("userId", args.creatorId))
      .unique();

    return profile;
  },
});

// Internal function to update Stripe Connect account ID
export const updateStripeConnectAccount = internalMutation({
  args: {
    userId: v.id("users"),
    stripeConnectAccountId: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .unique();

    if (!profile) {
      throw new Error("Profile not found");
    }

    await ctx.db.patch(profile._id, {
      stripeConnectAccountId: args.stripeConnectAccountId,
    });
  },
});

// Internal function to create payment record
export const createPaymentRecord = internalMutation({
  args: {
    userId: v.id("users"),
    type: v.union(v.literal("campaign_payment"), v.literal("creator_payout")),
    amount: v.number(),
    stripePaymentIntentId: v.optional(v.string()),
    stripeTransferId: v.optional(v.string()),
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("failed")),
    campaignId: v.optional(v.id("campaigns")),
    metadata: v.optional(v.object({})),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("payments", {
      userId: args.userId,
      type: args.type,
      amount: args.amount,
      stripePaymentIntentId: args.stripePaymentIntentId,
      stripeTransferId: args.stripeTransferId,
      status: args.status,
      campaignId: args.campaignId,
      metadata: args.metadata,
      createdAt: Date.now(),
    });
  },
});

// Internal query to get creator info
export const getCreatorInfo = internalQuery({
  args: { creatorId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.creatorId);
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user_id", (q) => q.eq("userId", args.creatorId))
      .unique();

    if (!user) return null;

    return {
      email: user.email,
      name: profile?.creatorName || user.name || "Creator",
    };
  },
});

// Internal query to get submission info
export const getSubmissionInfo = internalQuery({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) return null;

    const campaign = await ctx.db.get(submission.campaignId);
    return {
      campaignTitle: campaign?.title || "Unknown Campaign",
    };
  },
});

// Internal mutation to update campaign payment status
export const updateCampaignPaymentStatus = internalMutation({
  args: {
    campaignId: v.id("campaigns"),
    paymentIntentId: v.string(),
    status: v.union(v.literal("pending"), v.literal("paid"), v.literal("failed")),
  },
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) return;

    await ctx.db.patch(args.campaignId, {
      stripePaymentIntentId: args.paymentIntentId,
      paymentStatus: args.status,
    });
  },
});
