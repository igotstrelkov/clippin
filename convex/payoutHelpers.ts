import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";

// Get creator's payout history with enhanced details
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

    // Enhance payouts with submission details
    const enhancedPayouts = await Promise.all(
      payouts.map(async (payout) => {
        const submissionIds = payout.metadata?.submissionIds || [];
        const campaigns: string[] = [];

        for (const submissionId of submissionIds) {
          const submission = await ctx.db.get(submissionId);
          if (submission) {
            const campaign = await ctx.db.get(submission.campaignId);
            if (campaign && !campaigns.includes(campaign.title)) {
              campaigns.push(campaign.title);
            }
          }
        }

        return {
          ...payout,
          campaignTitles: campaigns,
          submissionCount: submissionIds.length,
        };
      })
    );

    return enhancedPayouts;
  },
});

// Get pending payout requests (initiated but not yet completed)
// export const getPendingPayouts = query({
//   args: {},
//   handler: async (ctx) => {
//     const userId = await getAuthUserId(ctx);
//     if (!userId) return [];

//     const pendingPayouts = await ctx.db
//       .query("payments")
//       .withIndex("by_user_id", (q) => q.eq("userId", userId))
//       .filter((q) =>
//         q.and(
//           q.eq(q.field("type"), "creator_payout"),
//           q.eq(q.field("status"), "pending")
//         )
//       )
//       .order("desc")
//       .collect();

//     // Enhance with submission details
//     const enhancedPending = await Promise.all(
//       pendingPayouts.map(async (payout) => {
//         const submissionIds = payout.metadata?.submissionIds || [];
//         const campaigns: string[] = [];

//         for (const submissionId of submissionIds) {
//           const submission = await ctx.db.get(submissionId);
//           if (submission) {
//             const campaign = await ctx.db.get(submission.campaignId);
//             if (campaign && !campaigns.includes(campaign.title)) {
//               campaigns.push(campaign.title);
//             }
//           }
//         }

//         return {
//           ...payout,
//           campaignTitles: campaigns,
//           submissionCount: submissionIds.length,
//         };
//       })
//     );

//     return enhancedPending;
//   },
// });

// Get pending earnings for creator (excluding submissions in pending payouts)
export const getPendingEarnings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { 
      totalPending: 0, 
      submissions: [],
      isEligibleForPayout: false,
      minimumThreshold: 2000, // €20.00
      amountNeededForPayout: 2000
    };

    // Get approved submissions that haven't been paid out yet
    const approvedSubmissions = await ctx.db
      .query("submissions")
      .withIndex("by_creator_id", (q) => q.eq("creatorId", userId))
      .filter((q) => q.eq(q.field("status"), "approved"))
      .collect();

    // Get submission IDs that are in pending payouts
    const pendingPayouts = await ctx.db
      .query("payments")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .filter((q) =>
        q.and(
          q.eq(q.field("type"), "creator_payout"),
          q.eq(q.field("status"), "pending")
        )
      )
      .collect();

    const submissionsInPendingPayouts = new Set(
      pendingPayouts.flatMap((p) => p.metadata?.submissionIds || [])
    );

    // Calculate pending earnings: total earnings minus what's already been paid out
    // Exclude submissions that are in pending payouts
    const availableSubmissions = approvedSubmissions.filter((sub) => {
      const earnings = sub.earnings || 0;
      const paidOut = sub.paidOutAmount || 0;
      const pending = Math.max(0, earnings - paidOut);
      return pending > 0 && !submissionsInPendingPayouts.has(sub._id);
    });

    const totalPending = availableSubmissions.reduce((sum, sub) => {
      const earnings = sub.earnings || 0;
      const paidOut = sub.paidOutAmount || 0;
      const pending = Math.max(0, earnings - paidOut);
      return sum + pending;
    }, 0);

    const submissionsWithCampaigns = await Promise.all(
      availableSubmissions.map(async (submission) => {
        const campaign = await ctx.db.get(submission.campaignId);
        const earnings = submission.earnings || 0;
        const paidOut = submission.paidOutAmount || 0;
        const pending = Math.max(0, earnings - paidOut);

        return {
          ...submission,
          campaignTitle: campaign?.title || "",
          pendingAmount: pending, // Amount pending payout for this submission
          totalEarnings: earnings, // Total lifetime earnings
          paidOutAmount: paidOut, // Amount already paid out
        };
      })
    );

    // Import earnings functions for threshold validation
    const MINIMUM_PAYOUT_THRESHOLD = 2000; // €20.00 in cents
    const isEligibleForPayout = totalPending >= MINIMUM_PAYOUT_THRESHOLD;
    const amountNeededForPayout = isEligibleForPayout 
      ? 0 
      : MINIMUM_PAYOUT_THRESHOLD - totalPending;

    return {
      totalPending,
      submissions: submissionsWithCampaigns,
      isEligibleForPayout,
      minimumThreshold: MINIMUM_PAYOUT_THRESHOLD,
      amountNeededForPayout,
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
    status: v.union(
      v.literal("pending"),
      v.literal("completed"),
      v.literal("failed")
    ),
    campaignId: v.optional(v.id("campaigns")),
    metadata: v.optional(
      v.object({
        submissionIds: v.optional(v.array(v.id("submissions"))),
        transferAmount: v.optional(v.number()),
        platformFee: v.optional(v.number()),
        stripeFee: v.optional(v.number()),
      })
    ),
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
    status: v.union(
      v.literal("pending"),
      v.literal("paid"),
      v.literal("failed")
    ),
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

// Internal mutation to update campaign transfer group
export const updateCampaignTransferGroup = internalMutation({
  args: {
    campaignId: v.id("campaigns"),
    transferGroup: v.string(),
  },
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) return;

    await ctx.db.patch(args.campaignId, {
      stripeTransferGroup: args.transferGroup,
    });
  },
});

// Internal query to get submission with campaign data
export const getSubmissionWithCampaign = internalQuery({
  args: { submissionId: v.id("submissions") },
  handler: async (ctx, args) => {
    const submission = await ctx.db.get(args.submissionId);
    if (!submission) return null;

    const campaign = await ctx.db.get(submission.campaignId);
    return {
      submission,
      campaign,
    };
  },
});

// Internal mutation to update payment status by stripe transfer ID
export const updatePaymentStatus = internalMutation({
  args: {
    stripeTransferId: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("completed"),
      v.literal("failed")
    ),
  },
  handler: async (ctx, args) => {
    const payment = await ctx.db
      .query("payments")
      .filter((q) => q.eq(q.field("stripeTransferId"), args.stripeTransferId))
      .unique();

    if (payment) {
      await ctx.db.patch(payment._id, {
        status: args.status,
      });
    }
  },
});
