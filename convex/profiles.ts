import { getAuthUserId } from "@convex-dev/auth/server";
import axios from "axios";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";

// Get current user's profile
export const getCurrentProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) return null;

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    return profile;
  },
});

// Internal helper to get profile by user ID
export const getProfileByUserId = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("profiles")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .unique();
  },
});

// Generate upload URL for company logo
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.storage.generateUploadUrl();
  },
});

// Create or update profile
export const updateProfile = mutation({
  args: {
    userType: v.union(
      v.literal("creator"),
      v.literal("brand"),
      v.literal("admin")
    ),
    // Creator fields
    creatorName: v.optional(v.string()),
    //tiktokUsername: v.optional(v.string()),
    // Brand fields
    companyName: v.optional(v.string()),
    companyLogo: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existingProfile = await ctx.db
      .query("profiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    const profileData = {
      userType: args.userType,
      creatorName: args.creatorName,
      companyName: args.companyName,
      companyLogo: args.companyLogo,
    };

    if (existingProfile) {
      // Don't allow changing user type after initial setup
      if (existingProfile.userType !== args.userType) {
        throw new Error("Cannot change account type after initial setup");
      }
      // Update existing profile (excluding userType)
      const { userType, ...updateData } = profileData;
      await ctx.db.patch(existingProfile._id, updateData);
      return existingProfile._id;
    } else {
      // Create new profile
      const profileId = await ctx.db.insert("profiles", {
        userId,
        ...profileData,
        tiktokVerified: false,
        totalEarnings: 0,
        totalSubmissions: 0,
      });
      return profileId;
    }
  },
});

// Generate verification code for TikTok bio verification
export const generateverificationCode = mutation({
  args: { tiktokUsername: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Validate username format
    if (!isValidTikTokUsername(args.tiktokUsername)) {
      throw new Error(
        "Invalid TikTok username format. Username should only contain letters, numbers, underscores, and periods."
      );
    }

    // Check if user already has a verified TikTok account
    const existingProfile = await ctx.db
      .query("profiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (existingProfile?.tiktokVerified) {
      throw new Error("TikTok account already verified");
    }

    // Check if this TikTok username is already verified by another user
    const existingTikTokProfile = await ctx.db
      .query("profiles")
      .filter((q) => q.eq(q.field("tiktokUsername"), args.tiktokUsername))
      .filter((q) => q.eq(q.field("tiktokVerified"), true))
      .unique();

    if (existingTikTokProfile && existingTikTokProfile.userId !== userId) {
      throw new Error(
        "This TikTok username is already verified by another user"
      );
    }

    // Generate a unique verification code
    const verificationCode = `CLIPPIN${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const now = Date.now();

    // Create or update profile with verification code
    if (existingProfile) {
      await ctx.db.patch(existingProfile._id, {
        tiktokUsername: args.tiktokUsername,
        verificationCode: verificationCode,
        verificationError: undefined, // Clear any previous errors
      });
    } else {
      await ctx.db.insert("profiles", {
        userId,
        userType: "creator", // Default to creator for TikTok verification
        tiktokUsername: args.tiktokUsername,
        verificationCode: verificationCode,
      });
    }

    return { verificationCode };
  },
});

// Generate Instagram verification code
export const generateInstagramVerificationCode = mutation({
  args: { instagramUsername: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get existing profile
    const existingProfile = await ctx.db
      .query("profiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    // Check if Instagram username is already verified by another user
    const existingInstagramProfile = await ctx.db
      .query("profiles")
      .filter((q) => q.eq(q.field("instagramUsername"), args.instagramUsername))
      .filter((q) => q.eq(q.field("instagramVerified"), true))
      .unique();

    if (
      existingInstagramProfile &&
      existingInstagramProfile.userId !== userId
    ) {
      throw new Error(
        "This Instagram username is already verified by another user"
      );
    }

    // Generate a unique verification code
    const verificationCode = `CLIPPIN${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Create or update profile with verification code
    if (existingProfile) {
      await ctx.db.patch(existingProfile._id, {
        instagramUsername: args.instagramUsername,
        verificationCode: verificationCode,
        verificationError: undefined, // Clear any previous errors
      });
    } else {
      await ctx.db.insert("profiles", {
        userId,
        userType: "creator", // Default to creator for Instagram verification
        instagramUsername: args.instagramUsername,
        verificationCode: verificationCode,
      });
    }

    return { verificationCode };
  },
});

// Verify Instagram account by checking bio - triggers the verification process
export const verifyInstagramBio = mutation({
  args: { instagramUsername: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get the user's profile
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) {
      throw new Error("Profile not found");
    }

    if (!profile.verificationCode) {
      return {
        success: false,
        message: "No verification code found. Please generate a code first.",
      };
    }

    if (profile.instagramUsername !== args.instagramUsername) {
      return {
        success: false,
        message:
          "Instagram username doesn't match the one used to generate the code",
      };
    }

    try {
      // Schedule the verification action
      await ctx.scheduler.runAfter(
        0,
        internal.profiles.completeInstagramVerification,
        {
          userId,
          username: args.instagramUsername,
          verificationCode: profile.verificationCode,
          profileId: profile._id,
        }
      );

      return { success: true, message: "Verification started..." };
    } catch {
      return {
        success: false,
        message: "Failed to start verification process",
      };
    }
  },
});

// Verify TikTok account by checking bio - triggers the verification process
export const verifyTikTokBio = mutation({
  args: { tiktokUsername: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get the user's profile
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) {
      throw new Error("Profile not found");
    }

    if (!profile.verificationCode) {
      return {
        success: false,
        message: "No verification code found. Please generate a code first.",
      };
    }

    if (profile.tiktokUsername !== args.tiktokUsername) {
      return {
        success: false,
        message:
          "TikTok username doesn't match the one used to generate the code",
      };
    }

    try {
      // Schedule the verification action
      await ctx.scheduler.runAfter(
        0,
        internal.profiles.completeTikTokVerification,
        {
          userId,
          username: args.tiktokUsername,
          verificationCode: profile.verificationCode,
          profileId: profile._id,
        }
      );

      return { success: true, message: "Verification started..." };
    } catch {
      return {
        success: false,
        message: "Failed to start verification process",
      };
    }
  },
});

// Verification if post username matches the verified username
export const verifyPost = internalQuery({
  args: {
    contentUrl: v.string(),
    platform: v.union(v.literal("tiktok"), v.literal("instagram")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get the user's profile
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) {
      throw new Error("Profile not found");
    }

    let isVerified = false;

    if (args.platform === "tiktok") {
      if (!profile.tiktokUsername || !profile.tiktokVerified) {
        throw new Error(
          "No verified tiktok username found. Please verify your tiktok username first."
        );
      }

      // Validate the post URL format
      const contentUrlPattern =
        /^https:\/\/(www\.)?tiktok\.com\/@([^/]+)\/video\/(\d+)/;

      const urlMatch = args.contentUrl.match(contentUrlPattern);

      if (!urlMatch) {
        return false;
      }

      // URL extraction as final fallback
      const usernameFromUrl = urlMatch[2]; // Extract from URL pattern match
      if (usernameFromUrl) {
        isVerified =
          usernameFromUrl.toLowerCase() ===
          profile.tiktokUsername.toLowerCase();
      }
    } else if (args.platform === "instagram") {
      if (!profile.instagramUsername || !profile.instagramVerified) {
        throw new Error(
          "No verified instagram username found. Please verify your instagram username first."
        );
      }

      const options = {
        method: "GET",
        url: "https://instagram-looter2.p.rapidapi.com/post",
        params: {
          url: args.contentUrl,
        },
        headers: {
          "x-rapidapi-key":
            "3d3fb29ba1msh62edf7989245d00p196f93jsn4348bff721d5",
          "x-rapidapi-host": "instagram-looter2.p.rapidapi.com",
        },
      };

      try {
        const response = await axios.request(options);
        console.log(response.data);
        if (!response.data.status) {
          return false;
        }
        isVerified =
          response.data.data.owner.username.toLowerCase() ===
          profile.instagramUsername.toLowerCase();
      } catch (error) {
        console.error(error);
        return false;
      }
    }
    return isVerified;
  },
});

// Internal action to perform the actual TikTok verification
export const completeTikTokVerification = internalAction({
  args: {
    userId: v.id("users"),
    username: v.string(),
    verificationCode: v.string(),
    profileId: v.id("profiles"),
  },
  handler: async (ctx, args) => {
    try {
      // Call the TikTok verification API
      const verificationResult = await ctx.runAction(
        internal.tiktokVerification.checkTikTokBioForCode,
        {
          username: args.username,
          verificationCode: args.verificationCode,
        }
      );

      // Update the profile with the verification result
      await ctx.runMutation(internal.profiles.updateVerificationResult, {
        profileId: args.profileId,
        verified: verificationResult.found,
        error: verificationResult.error,

        field: "tiktokVerified",
      });
    } catch {
      // Update profile with error
      await ctx.runMutation(internal.profiles.updateVerificationResult, {
        profileId: args.profileId,
        verified: false,
        error:
          "Verification failed due to an unexpected error. Please try again.",
        field: "tiktokVerified",
      });
    }
  },
});

// Internal action to perform the actual TikTok verification
export const completeInstagramVerification = internalAction({
  args: {
    userId: v.id("users"),
    username: v.string(),
    verificationCode: v.string(),
    profileId: v.id("profiles"),
  },
  handler: async (ctx, args) => {
    try {
      // Call the TikTok verification API
      const verificationResult = await ctx.runAction(
        internal.instagramVerification.checkInstagramBioForCode,
        {
          username: args.username,
          verificationCode: args.verificationCode,
        }
      );

      // Update the profile with the verification result
      await ctx.runMutation(internal.profiles.updateVerificationResult, {
        profileId: args.profileId,
        verified: verificationResult.found,
        error: verificationResult.error,

        field: "instagramVerified",
      });
    } catch {
      // Update profile with error
      await ctx.runMutation(internal.profiles.updateVerificationResult, {
        profileId: args.profileId,
        verified: false,
        error:
          "Verification failed due to an unexpected error. Please try again.",
        field: "instagramVerified",
      });
    }
  },
});

// Update profile with verification result
export const updateVerificationResult = internalMutation({
  args: {
    profileId: v.id("profiles"),
    verified: v.boolean(),
    error: v.optional(v.string()),
    field: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.verified) {
      // Mark as verified and clear any previous errors
      await ctx.db.patch(args.profileId, {
        [args.field]: true,
        verificationCode: undefined,
        verificationError: undefined,
      });
    } else {
      // Clear verification code, mark as not verified, and store error message
      await ctx.db.patch(args.profileId, {
        verificationCode: undefined,
        [args.field]: false,
        verificationError: args.error || "Code not found in bio",
      });
    }
  },
});

// Get creator dashboard stats
export const getCreatorStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!profile || profile.userType !== "creator") return null;

    // Get recent submissions for 24h stats
    const recentSubmissions = await ctx.db
      .query("submissions")
      .withIndex("by_creator_id", (q) => q.eq("creatorId", userId))
      .filter((q) =>
        q.gt(q.field("submittedAt"), Date.now() - 24 * 60 * 60 * 1000)
      )
      .collect();

    const recent24hViews = recentSubmissions.reduce(
      (sum, sub) => sum + (sub.viewCount || 0),
      0
    );
    const recent24hEarnings = recentSubmissions.reduce(
      (sum, sub) => sum + (sub.earnings || 0),
      0
    );

    return {
      userId,
      totalEarnings: profile.totalEarnings || 0,
      totalSubmissions: profile.totalSubmissions || 0,
      recent24hViews,
      recent24hEarnings,
      tiktokVerified: profile.tiktokVerified || false,
      tiktokUsername: profile.tiktokUsername,
      creatorName: profile.creatorName,
    };
  },
});

// Get brand dashboard stats
export const getBrandStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!profile || profile.userType !== "brand") return null;

    const campaigns = await ctx.db
      .query("campaigns")
      .withIndex("by_brand_id", (q) => q.eq("brandId", userId))
      .collect();

    const totalViews = campaigns.reduce(
      (sum, campaign) => sum + (campaign.totalViews || 0),
      0
    );
    const totalSpent = campaigns.reduce(
      (sum, campaign) =>
        sum + (campaign.totalBudget - campaign.remainingBudget),
      0
    );
    const totalSubmissions = campaigns.reduce(
      (sum, campaign) => sum + (campaign.totalSubmissions || 0),
      0
    );
    const approvedSubmissions = campaigns.reduce(
      (sum, campaign) => sum + (campaign.approvedSubmissions || 0),
      0
    );

    // const totalViews = campaigns.reduce((sum, campaign) => sum + (campaign.totalViews || 0), 0);
    // const totalSpentCents = campaigns.reduce((sum, campaign) => sum + (campaign.totalBudget - campaign.remainingBudget), 0);
    // const totalSpent = totalSpentCents / 100; // Convert cents to dollars
    // const totalSubmissions = campaigns.reduce((sum, campaign) => sum + (campaign.totalSubmissions || 0), 0);
    // const approvedSubmissions = campaigns.reduce((sum, campaign) => sum + (campaign.approvedSubmissions || 0), 0);

    // const effectiveCPM = totalViews > 0 ? (totalSpent / totalViews) * 1000 : 0;

    const effectiveCPM = totalViews > 0 ? (totalSpent / totalViews) * 1000 : 0;

    return {
      totalCampaigns: campaigns.length,
      totalViews,
      totalSpent,
      effectiveCPM,
      totalSubmissions,
      approvedSubmissions,
    };
  },
});

// Get admin dashboard stats
export const getAdminStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .unique();

    if (!profile || profile.userType !== "admin") return null;

    // Get system-wide statistics
    const totalUsers = await ctx.db.query("profiles").collect();
    const totalCampaigns = await ctx.db.query("campaigns").collect();
    const totalSubmissions = await ctx.db.query("submissions").collect();

    const userTypeCounts = {
      creators: totalUsers.filter((u) => u.userType === "creator").length,
      brands: totalUsers.filter((u) => u.userType === "brand").length,
      admins: totalUsers.filter((u) => u.userType === "admin").length,
    };

    const campaignStatusCounts = {
      active: totalCampaigns.filter((c) => c.status === "active").length,
      completed: totalCampaigns.filter((c) => c.status === "completed").length,
      draft: totalCampaigns.filter((c) => c.status === "draft").length,
      paused: totalCampaigns.filter((c) => c.status === "paused").length,
    };

    const submissionStatusCounts = {
      pending: totalSubmissions.filter((s) => s.status === "pending").length,
      approved: totalSubmissions.filter((s) => s.status === "approved").length,
      rejected: totalSubmissions.filter((s) => s.status === "rejected").length,
    };

    return {
      totalUsers: totalUsers.length,
      userTypeCounts,
      totalCampaigns: totalCampaigns.length,
      campaignStatusCounts,
      totalSubmissions: totalSubmissions.length,
      submissionStatusCounts,
    };
  },
});

// Internal function to update Stripe customer ID
export const updateStripeCustomerId = internalMutation({
  args: {
    userId: v.id("users"),
    stripeCustomerId: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .unique();

    if (profile) {
      await ctx.db.patch(profile._id, {
        stripeCustomerId: args.stripeCustomerId,
      });
    }
  },
});

// Helper function to validate TikTok username format
function isValidTikTokUsername(username: string): boolean {
  // Remove @ if present
  const cleanUsername = username.replace(/^@/, "");

  // Check length (2-24 characters)
  if (cleanUsername.length < 2 || cleanUsername.length > 24) {
    return false;
  }

  // Check for valid characters (letters, numbers, periods, underscores)
  // TikTok usernames can contain letters, numbers, periods, and underscores
  // They cannot start or end with a period
  // They cannot have consecutive periods
  const validPattern = /^[a-zA-Z0-9][a-zA-Z0-9._]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/;
  if (!validPattern.test(cleanUsername)) {
    return false;
  }

  // Check for consecutive periods
  if (cleanUsername.includes("..")) {
    return false;
  }

  return true;
}
