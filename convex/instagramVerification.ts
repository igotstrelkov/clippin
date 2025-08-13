"use node";
import axios from "axios";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";

// TikTok Business API integration for bio verification
export const checkInstagramBioForCode = internalAction({
  args: {
    username: v.string(),
    verificationCode: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ found: boolean; bio?: string; error?: string }> => {
    try {
      return await checkBioWithPublicAPI(args.username, args.verificationCode);
    } catch {
      return {
        found: false,
        error:
          "Unable to verify Instagram profile. Please ensure your username is correct and your profile is public.",
      };
    }
  },
});

// Verification using TikTok public profile data
async function checkBioWithPublicAPI(
  username: string,
  verificationCode: string
): Promise<{ found: boolean; bio?: string; error?: string }> {
  const options = {
    method: "GET",
    url: "https://instagram-looter2.p.rapidapi.com/profile",
    params: { username: username },
    headers: {
      "x-rapidapi-key": "3d3fb29ba1msh62edf7989245d00p196f93jsn4348bff721d5",
      "x-rapidapi-host": "instagram-looter2.p.rapidapi.com",
    },
  };

  try {
    const response = await axios.request(options);
    if (!response.data.status) {
      return {
        found: false,
        error:
          "Unable to verify Instagram profile. Please ensure your username is correct and your profile is public.",
      };
    }

    return {
      found: response.data.biography.includes(verificationCode),
      bio: response.data.biography,
    };
  } catch (error) {
    return {
      found: false,
      error: `Unable to verify TikTok profile: ${error instanceof Error ? error.message : "Unknown error"}. Please ensure your profile is public and the username is correct.`,
    };
  }
}

// Helper function to validate TikTok username format
export const validateTikTokUsername = internalAction({
  args: {
    username: v.string(),
  },
  handler: async (_ctx, args): Promise<{ valid: boolean; error?: string }> => {
    const username = args.username.trim();

    // Basic validation rules for TikTok usernames
    if (username.length < 2) {
      return {
        valid: false,
        error: "Username must be at least 2 characters long",
      };
    }

    if (username.length > 24) {
      return { valid: false, error: "Username must be 24 characters or less" };
    }

    if (!/^[a-zA-Z0-9._]+$/.test(username)) {
      return {
        valid: false,
        error:
          "Username can only contain letters, numbers, periods, and underscores",
      };
    }

    if (username.startsWith(".") || username.endsWith(".")) {
      return {
        valid: false,
        error: "Username cannot start or end with a period",
      };
    }

    if (username.includes("..")) {
      return {
        valid: false,
        error: "Username cannot contain consecutive periods",
      };
    }

    return { valid: true };
  },
});
