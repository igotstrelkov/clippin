"use node";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import Stripe from "stripe";
import { internal } from "./_generated/api";
import { action, internalAction } from "./_generated/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-06-30.basil",
});

// Fee calculation function
const calculateFees = (amount: number) => {
  const stripeFee = Math.round(amount * 0.029 + 30); // 2.9% + 30¢
  const platformFee = Math.round(amount * 0.03); // 3% platform fee
  const totalFees = stripeFee + platformFee;
  const netAmount = amount - totalFees;

  return { stripeFee, platformFee, totalFees, netAmount };
};

// Create Stripe Connect account for creator
export const createStripeConnectAccount = action({
  args: {
    email: v.string(),
    country: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    try {
      // Create Stripe Connect account
      const account = await stripe.accounts.create({
        type: "express",
        country: args.country || "US",
        email: args.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: "individual",
        metadata: {
          userId: userId,
        },
      });

      // Update user profile with Stripe Connect account ID
      await ctx.runMutation(internal.payoutHelpers.updateStripeConnectAccount, {
        userId,
        stripeConnectAccountId: account.id,
      });

      return { accountId: account.id };
    } catch (error) {
      console.error("Failed to create Stripe Connect account:", error);
      throw new Error("Failed to create payment account. Please try again.");
    }
  },
});

// Create Stripe Connect onboarding link
export const createConnectOnboardingLink = action({
  args: {},
  handler: async (ctx, _args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const profile = await ctx.runQuery(
      internal.payoutHelpers.getCreatorStripeAccount,
      {
        creatorId: userId,
      }
    );

    if (!profile?.stripeConnectAccountId) {
      throw new Error(
        "No Stripe Connect account found. Please create one first."
      );
    }

    try {
      const accountLink = await stripe.accountLinks.create({
        account: profile.stripeConnectAccountId,
        refresh_url: `${process.env.SITE_URL || "http://localhost:5173"}/dashboard?refresh=true`,
        return_url: `${process.env.SITE_URL || "http://localhost:5173"}/dashboard?connected=true`,
        type: "account_onboarding",
      });

      return { url: accountLink.url };
    } catch (error) {
      console.error("Failed to create onboarding link:", error);
      throw new Error("Failed to create onboarding link. Please try again.");
    }
  },
});

// Check Stripe Connect account status
export const getConnectAccountStatus = action({
  args: {},
  handler: async (
    ctx,
    _args
  ): Promise<{
    hasAccount: boolean;
    isComplete: boolean;
    requiresAction?: boolean;
    chargesEnabled?: boolean;
    payoutsEnabled?: boolean;
  }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const profile = await ctx.runQuery(
      internal.payoutHelpers.getCreatorStripeAccount,
      {
        creatorId: userId,
      }
    );

    if (!profile?.stripeConnectAccountId) {
      return { hasAccount: false, isComplete: false };
    }

    try {
      const account = await stripe.accounts.retrieve(
        profile.stripeConnectAccountId
      );

      return {
        hasAccount: true,
        isComplete:
          account.details_submitted &&
          account.charges_enabled &&
          account.payouts_enabled,
        requiresAction: !account.details_submitted,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
      };
    } catch (error) {
      console.error("Failed to retrieve account status:", error);
      return { hasAccount: false, isComplete: false };
    }
  },
});

// Process payout for creator using Stripe Connect
export const processPayout = action({
  args: {
    creatorId: v.id("users"),
    amount: v.number(),
    submissionIds: v.array(v.id("submissions")),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ success: boolean; payoutId: any; transferId: string }> => {
    // Get creator profile with Stripe Connect account
    const creatorProfile = await ctx.runQuery(
      internal.payoutHelpers.getCreatorStripeAccount,
      {
        creatorId: args.creatorId,
      }
    );

    if (!creatorProfile?.stripeConnectAccountId) {
      throw new Error("Creator must complete Stripe Connect onboarding first");
    }

    if (args.amount <= 0) {
      throw new Error("Payout amount must be positive");
    }

    // Calculate fees (platform takes 3% + Stripe fees)
    const fees = calculateFees(args.amount);
    const transferAmount = Math.round(args.amount - fees.platformFee); // Creator gets amount minus platform fee

    try {
      // Create Stripe transfer to creator's Connect account
      const transfer = await stripe.transfers.create({
        amount: transferAmount,
        currency: "usd",
        destination: creatorProfile.stripeConnectAccountId,
        description: `Payout for ${args.submissionIds.length} submissions`,
        metadata: {
          creatorId: args.creatorId,
          submissionIds: args.submissionIds.join(","),
        },
      });

      // Create payout record in database
      const payoutId = await ctx.runMutation(
        internal.payoutHelpers.createPaymentRecord,
        {
          userId: args.creatorId,
          type: "creator_payout",
          amount: args.amount,
          stripeTransferId: transfer.id,
          status: "completed",
          metadata: {
            transferAmount,
            platformFee: fees.platformFee,
            stripeFee: fees.stripeFee,
            submissionIds: args.submissionIds,
          },
        }
      );

      // Update paidOutAmount for each submission
      await ctx.runMutation(
        internal.payoutHelpers.updateSubmissionsPaidAmount,
        {
          submissionIds: args.submissionIds,
        }
      );

      // Send payout confirmation email
      await ctx.runAction(internal.payouts.sendPayoutNotification, {
        creatorId: args.creatorId,
        amount: args.amount,
        transferAmount,
        submissionIds: args.submissionIds,
      });

      return { success: true, payoutId, transferId: transfer.id };
    } catch (error) {
      console.error("Stripe transfer failed:", error);

      // Create failed payout record
      await ctx.runMutation(internal.payoutHelpers.createPaymentRecord, {
        userId: args.creatorId,
        type: "creator_payout",
        amount: args.amount,
        status: "failed",
        metadata: {
          error: error instanceof Error ? error.message : "Unknown error",
          submissionIds: args.submissionIds,
        },
      });

      throw new Error("Payout failed. Please try again or contact support.");
    }
  },
});

// Internal action to send payout notification
export const sendPayoutNotification = internalAction({
  args: {
    creatorId: v.id("users"),
    amount: v.number(),
    transferAmount: v.number(),
    submissionIds: v.array(v.id("submissions")),
  },
  handler: async (ctx, args) => {
    // Get creator info
    const creator = await ctx.runQuery(internal.payoutHelpers.getCreatorInfo, {
      creatorId: args.creatorId,
    });

    if (!creator?.email) return;

    // Get campaign titles for the submissions
    const campaignTitles: string[] = [];
    for (const submissionId of args.submissionIds) {
      const submission = await ctx.runQuery(
        internal.payoutHelpers.getSubmissionInfo,
        {
          submissionId,
        }
      );
      if (
        submission?.campaignTitle &&
        !campaignTitles.includes(submission.campaignTitle)
      ) {
        campaignTitles.push(submission.campaignTitle);
      }
    }

    // Send payout confirmation email
    try {
      await ctx.runAction(internal.emails.sendPayoutConfirmation, {
        creatorEmail: creator.email,
        creatorName: creator.name,
        amount: args.amount,
        transferAmount: args.transferAmount,
        campaignTitles,
        totalSubmissions: args.submissionIds.length,
      });
    } catch (error) {
      console.error("Failed to send payout confirmation email:", error);
    }
  },
});

// Create payment intent for campaign funding
export const createCampaignPaymentIntent = action({
  args: {
    campaignId: v.id("campaigns"),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: args.amount,
        currency: "usd",
        metadata: {
          campaignId: args.campaignId,
          userId: userId,
        },
        description: "Campaign funding",
      });

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      };
    } catch (error) {
      console.error("Failed to create payment intent:", error);
      throw new Error("Failed to create payment intent");
    }
  },
});

// Handle Stripe webhooks
export const handleWebhook = internalAction({
  args: {
    body: v.string(),
    signature: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const event = stripe.webhooks.constructEvent(
        args.body,
        args.signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      );

      switch (event.type) {
        case "payment_intent.succeeded": {
          const paymentIntent = event.data.object;
          if (paymentIntent.metadata.campaignId) {
            // Activate the campaign
            await ctx.runMutation(internal.campaigns.activateCampaign, {
              campaignId: paymentIntent.metadata.campaignId as any,
              paymentIntentId: paymentIntent.id,
            });

            // Update campaign payment status
            await ctx.runMutation(
              internal.payoutHelpers.updateCampaignPaymentStatus,
              {
                campaignId: paymentIntent.metadata.campaignId as any,
                paymentIntentId: paymentIntent.id,
                status: "paid",
              }
            );
          }
          break;
        }

        case "payment_intent.payment_failed": {
          const failedPayment = event.data.object;
          if (failedPayment.metadata.campaignId) {
            await ctx.runMutation(
              internal.payoutHelpers.updateCampaignPaymentStatus,
              {
                campaignId: failedPayment.metadata.campaignId as any,
                paymentIntentId: failedPayment.id,
                status: "failed",
              }
            );
          }
          break;
        }

        case "account.updated": {
          // Handle Connect account updates
          const account = event.data.object;
          if (account.metadata?.userId) {
            // Could update account status in database if needed
            console.log(
              `Connect account ${account.id} updated for user ${account.metadata.userId}`
            );
          }
          break;
        }

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      return { success: true };
    } catch (error) {
      console.error("Webhook error:", error);
      throw new Error("Webhook processing failed");
    }
  },
});
