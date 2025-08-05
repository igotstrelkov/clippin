import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const applicationTables = {
  // User profiles extending auth
  profiles: defineTable({
    userId: v.id("users"),
    userType: v.union(v.literal("creator"), v.literal("brand")),
    // Creator fields
    creatorName: v.optional(v.string()),
    tiktokUsername: v.optional(v.string()),
    tiktokVerified: v.optional(v.boolean()),
    // TikTok verification fields
    tiktokVerificationCode: v.optional(v.string()),
    verificationCodeGeneratedAt: v.optional(v.number()),
    verifiedAt: v.optional(v.number()),
    tiktokVerificationError: v.optional(v.string()),
    totalEarnings: v.optional(v.number()),
    totalSubmissions: v.optional(v.number()),
    // Brand fields
    companyName: v.optional(v.string()),
    companyLogo: v.optional(v.id("_storage")),
    // Stripe fields
    stripeCustomerId: v.optional(v.string()),
    stripeConnectAccountId: v.optional(v.string()),
  })
    .index("by_user_id", ["userId"])
    .index("by_user_type", ["userType"]),

  // Campaigns created by brands
  campaigns: defineTable({
    brandId: v.id("users"),
    title: v.string(),
    description: v.string(),
    category: v.string(),
    totalBudget: v.number(),
    remainingBudget: v.number(),
    cpmRate: v.number(), // Cost per 1000 views
    maxPayoutPerSubmission: v.number(),
    endDate: v.optional(v.number()),
    assetLinks: v.array(v.string()),
    requirements: v.array(v.string()),
    status: v.union(
      v.literal("draft"),
      v.literal("active"),
      v.literal("paused"),
      v.literal("completed")
    ),
    totalViews: v.optional(v.number()),
    totalSubmissions: v.optional(v.number()),
    approvedSubmissions: v.optional(v.number()),
    // Stripe payment fields
    stripePaymentIntentId: v.optional(v.string()),
    stripeFeeAmount: v.optional(v.number()),
    paymentStatus: v.optional(
      v.union(v.literal("pending"), v.literal("paid"), v.literal("failed"))
    ),
  })
    .index("by_brand_id", ["brandId"])
    .index("by_status", ["status"])
    .index("by_category", ["category"]),

  // Creator submissions to campaigns
  submissions: defineTable({
    campaignId: v.id("campaigns"),
    creatorId: v.id("users"),
    tiktokUrl: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected")
    ),
    viewCount: v.optional(v.number()),
    lastViewUpdate: v.optional(v.number()),
    initialViewCount: v.optional(v.number()), // Views at submission time
    thresholdMetAt: v.optional(v.number()), // When 1K threshold was reached
    earnings: v.optional(v.number()),
    paidOutAmount: v.optional(v.number()), // Total amount paid out for this submission
    submittedAt: v.number(),
    approvedAt: v.optional(v.number()),
    rejectionReason: v.optional(v.string()),
    // View tracking flags
    viewTrackingEnabled: v.optional(v.boolean()),
    lastApiCall: v.optional(v.number()), // Rate limiting
  })
    .index("by_campaign_id", ["campaignId"])
    .index("by_creator_id", ["creatorId"])
    .index("by_status", ["status"])
    .index("by_last_view_update", ["lastViewUpdate"]),

  // Payment tracking
  payments: defineTable({
    userId: v.id("users"),
    type: v.union(v.literal("campaign_payment"), v.literal("creator_payout")),
    amount: v.number(),
    stripePaymentIntentId: v.optional(v.string()),
    stripePaymentId: v.optional(v.string()), // Legacy field for backward compatibility
    stripeTransferId: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("completed"),
      v.literal("failed")
    ),
    campaignId: v.optional(v.id("campaigns")),
    metadata: v.optional(v.object({})),
    createdAt: v.number(),
  })
    .index("by_user_id", ["userId"])
    .index("by_type", ["type"])
    .index("by_status", ["status"]),

  // View tracking logs
  viewTracking: defineTable({
    submissionId: v.id("submissions"),
    viewCount: v.number(),
    timestamp: v.number(),
    source: v.string(), // "tiktok_api", "manual_refresh", "system"
    metadata: v.optional(v.object({})), // Additional tracking data
  })
    .index("by_submission_id", ["submissionId"])
    .index("by_timestamp", ["timestamp"])
    .index("by_source", ["source"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
