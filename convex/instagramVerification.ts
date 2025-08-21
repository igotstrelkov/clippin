"use node";
import axios from "axios";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";

// Instagram API integration for bio verification
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

// Verification using Instagram public profile data
async function checkBioWithPublicAPI(
  username: string,
  verificationCode: string
): Promise<{ found: boolean; bio?: string; error?: string }> {
  const options = {
    method: "GET",
    url: "https://instagram-looter2.p.rapidapi.com/profile",
    params: { username: username },
    headers: {
      "x-rapidapi-key": process.env.RAPID_API_KEY!,
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
      error: `Unable to verify Instagram profile: ${error instanceof Error ? error.message : "Unknown error"}. Please ensure your profile is public and the username is correct.`,
    };
  }
}
