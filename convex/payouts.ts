"use node";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { createHash } from "crypto";
import Stripe from "stripe";
import { internal } from "./_generated/api";
import { action, internalAction } from "./_generated/server";
import { logger } from "./logger";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-06-30.basil",
});

// Simple platform fee calculation (5% total)
// const PLATFORM_FEE_PERCENTAGE = 0.05;

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
      logger.error("Failed to create Stripe Connect account", {
        userId,
        error: error instanceof Error ? error : new Error(String(error)),
      });
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
        refresh_url: `${process.env.PUBLIC_BASE_URL}/dashboard?refresh=true`,
        return_url: `${process.env.PUBLIC_BASE_URL}/dashboard?connected=true`,
        type: "account_onboarding",
      });

      return { url: accountLink.url };
    } catch (error) {
      logger.error("Failed to create onboarding link", {
        userId,
        error: error instanceof Error ? error : new Error(String(error)),
      });
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
      logger.error("Failed to retrieve account status", {
        userId,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      return { hasAccount: false, isComplete: false };
    }
  },
});

// Process payout for creator using Stripe transfers
export const processPayout = action({
  args: {
    creatorId: v.id("users"),
    amount: v.number(), // Creator's earnings amount (already calculated)
    submissionIds: v.array(v.id("submissions")),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ success: boolean; message: string }> => {
    // Get creator profile with Stripe Connect account
    const creatorProfile = await ctx.runQuery(
      internal.payoutHelpers.getCreatorStripeAccount,
      {
        creatorId: args.creatorId,
      }
    );

    if (!creatorProfile?.stripeConnectAccountId) {
      return {
        success: false,
        message: "Creator must complete Stripe Connect onboarding first",
      };
    }

    if (args.amount <= 0) {
      return {
        success: false,
        message: "Payout amount must be positive",
      };
    }

    try {
      // Get the campaign and transfer group for the first submission
      const firstSubmission = await ctx.runQuery(
        internal.payoutHelpers.getSubmissionWithCampaign,
        { submissionId: args.submissionIds[0] }
      );

      if (!firstSubmission?.campaign?.stripeTransferGroup) {
        return {
          success: false,
          message: "Campaign transfer group not found. Contact support.",
        };
      }

      // Create transfer from platform account to creator
      const roundedAmount = Math.round(args.amount);
      const idempotencyKey = createHash("sha256")
        .update(
          `creator:${args.creatorId}|amount:${roundedAmount}|subs:${args.submissionIds
            .slice()
            .sort()
            .join(",")}|group:${firstSubmission.campaign.stripeTransferGroup}`
        )
        .digest("hex");

      const transfer = await stripe.transfers.create(
        {
          amount: roundedAmount, // Ensure integer amount in cents
          currency: "EUR",
          destination: creatorProfile.stripeConnectAccountId,
          transfer_group: firstSubmission.campaign.stripeTransferGroup, // Link to original charge
          description: `Payout for ${args.submissionIds.length} submissions`,
          metadata: {
            creatorId: args.creatorId,
            submissionIds: args.submissionIds.join(","),
            type: "creator_payout",
          },
        },
        { idempotencyKey }
      );

      console.log("Payout created:", JSON.stringify(transfer));

      // Create completed payout record (transfer succeeded)
      await ctx.runMutation(internal.payoutHelpers.createPaymentRecord, {
        userId: args.creatorId,
        type: "creator_payout",
        amount: args.amount,
        stripeTransferId: transfer.id,
        status: "completed",
        metadata: {
          submissionIds: args.submissionIds,
          transferAmount: args.amount,
        },
      });

      // Update submissions paidOutAmount immediately
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
        transferAmount: args.amount,
        submissionIds: args.submissionIds,
      });

      return {
        success: true,
        message: "Payout processed successfully.",
      };
    } catch (error) {
      console.error(error);
      logger.error("Stripe transfer failed", {
        creatorId: args.creatorId,
        amount: args.amount,
        error: error instanceof Error ? error : new Error(String(error)),
      });

      // Create failed payout record
      await ctx.runMutation(internal.payoutHelpers.createPaymentRecord, {
        userId: args.creatorId,
        type: "creator_payout",
        amount: args.amount,
        status: "failed",
        metadata: {
          submissionIds: args.submissionIds,
        },
      });

      return {
        success: false,
        message: "Payout failed. Please try again or contact support.",
      };
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
      logger.error("Failed to send payout confirmation email", {
        creatorId: args.creatorId,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  },
});

// Create payment intent for campaign funding (charged to platform account)
export const createCampaignPaymentIntent = action({
  args: {
    campaignId: v.id("campaigns"),
    amount: v.number(), // Total amount including platform fee
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    try {
      // Generate unique transfer group to link this charge with future transfers
      const transferGroup = `campaign_${args.campaignId}_${Date.now()}`;

      // Create payment intent charged to platform account
      const paymentIntent = await stripe.paymentIntents.create({
        amount: args.amount,
        currency: "EUR",
        transfer_group: transferGroup, // Link charges and transfers
        metadata: {
          campaignId: args.campaignId,
          userId: userId,
          type: "campaign_funding",
        },
        description: "Campaign funding",
      });

      // Store transfer group in campaign for later transfers
      await ctx.runMutation(
        internal.payoutHelpers.updateCampaignTransferGroup,
        {
          campaignId: args.campaignId,
          transferGroup,
        }
      );

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      };
    } catch (error) {
      logger.error("Failed to create payment intent", {
        campaignId: args.campaignId,
        amount: args.amount,
        error: error instanceof Error ? error : new Error(String(error)),
      });
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

      console.log("Event received:", JSON.stringify(event));

      // Cast to any to handle additional event types like transfers
      const eventType = event.type as string;

      switch (eventType) {
        case "payment_intent.succeeded": {
          const paymentIntent = event.data.object as any;
          if (
            paymentIntent.metadata?.campaignId &&
            paymentIntent.metadata?.type === "campaign_funding"
          ) {
            logger.info("Campaign funding successful", {
              campaignId: paymentIntent.metadata.campaignId,
              amount: paymentIntent.amount,
            });

            // Activate the campaign
            await ctx.runMutation(internal.campaigns.activateCampaign, {
              campaignId: paymentIntent.metadata.campaignId,
              paymentIntentId: paymentIntent.id,
            });

            // Update campaign payment status
            await ctx.runMutation(
              internal.payoutHelpers.updateCampaignPaymentStatus,
              {
                campaignId: paymentIntent.metadata.campaignId,
                paymentIntentId: paymentIntent.id,
                status: "paid",
              }
            );

            // Create campaign payment record
            await ctx.runMutation(internal.payoutHelpers.createPaymentRecord, {
              userId: paymentIntent.metadata.userId,
              type: "campaign_payment",
              amount: paymentIntent.amount,
              stripePaymentIntentId: paymentIntent.id,
              status: "completed",
              campaignId: paymentIntent.metadata.campaignId,
            });
          }
          break;
        }

        case "payment_intent.payment_failed": {
          const failedPayment = event.data.object as any;
          if (
            failedPayment.metadata?.campaignId &&
            failedPayment.metadata?.type === "campaign_funding"
          ) {
            logger.error("Campaign funding failed", {
              campaignId: failedPayment.metadata.campaignId,
              amount: failedPayment.amount,
            });

            await ctx.runMutation(
              internal.payoutHelpers.updateCampaignPaymentStatus,
              {
                campaignId: failedPayment.metadata.campaignId,
                paymentIntentId: failedPayment.id,
                status: "failed",
              }
            );
          }
          break;
        }

        case "transfer.created": {
          const transfer = event.data.object as any;
          if (transfer.metadata?.type === "creator_payout") {
            logger.info("Creator payout transfer initiated", {
              creatorId: transfer.metadata.creatorId,
              amount: transfer.amount,
            });
          }
          break;
        }

        case "transfer.updated": {
          const transfer = event.data.object as any;
          if (transfer.metadata?.type === "creator_payout") {
            logger.info("Creator payout transfer updated", {
              amount: transfer.amount,
              eventId: event.id,
              metadata: { transferId: transfer.id },
            });
          }
          break;
        }

        case "transfer.reversed": {
          const transfer = event.data.object as any;
          if (transfer.metadata?.type === "creator_payout") {
            logger.error("Creator payout transfer reversed", {
              creatorId: transfer.metadata.creatorId,
              amount: transfer.amount,
              eventId: event.id,
              metadata: { transferId: transfer.id },
            });

            // Mark payment as failed for reconciliation
            await ctx.runMutation(internal.payoutHelpers.updatePaymentStatus, {
              stripeTransferId: transfer.id,
              status: "failed",
            });
          }
          break;
        }

        case "account.updated": {
          // Handle Connect account updates
          const account = event.data.object as any;
          if (account.metadata?.userId) {
            logger.info("Connect account updated", {
              accountId: account.id,
              userId: account.metadata.userId,
            });
          }
          break;
        }

        case "balance.available": {
          const balance = event.data.object as any;
          logger.info("Balance available updated", {
            amount: balance.available,
          });

          // Optional: Trigger automatic payout processing for pending payouts
          // when sufficient balance becomes available
          const availableAmount = balance.available?.[0]?.amount || 0;
          if (availableAmount > 0) {
            logger.info("Funds available for payouts", {
              amount: availableAmount,
            });

            // You could add logic here to process pending payouts
            // await ctx.runAction(internal.payouts.processPendingPayouts, {
            //   availableAmount
            // });
          }
          break;
        }

        default:
          logger.warn("Unhandled Stripe webhook event", {
            eventType: event.type,
            eventId: event.id,
          });
      }

      return { success: true };
    } catch (error) {
      console.log("Error processing webhook", error);
      return { success: false };
    }
  },
});
