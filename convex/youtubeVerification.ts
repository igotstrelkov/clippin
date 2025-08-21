"use node";
import axios from "axios";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";

// YouTube API integration for bio verification
export const checkYoutubeBioForCode = internalAction({
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
          "Unable to verify YouTube profile. Please ensure your username is correct and your profile is public.",
      };
    }
  },
});

// Verification using YouTube public profile data
async function checkBioWithPublicAPI(
  username: string,
  verificationCode: string
): Promise<{ found: boolean; bio?: string; error?: string }> {
  const options = {
    method: "GET",
    url: "https://youtube138.p.rapidapi.com/channel/details/",
    params: {
      id: `https://www.youtube.com/@${username}`,
      hl: "en",
      gl: "US",
    },
    headers: {
      "x-rapidapi-key": process.env.RAPID_API_KEY!,
      "x-rapidapi-host": "youtube138.p.rapidapi.com",
    },
  };

  try {
    const response = await axios.request(options);
    if (!response.data) {
      return {
        found: false,
        error:
          "Unable to verify YouTube profile. Please ensure your username is correct and your profile is public.",
      };
    }

    console.log(response.data);
    console.log(response.data.description);

    return {
      found: response.data.description.includes(verificationCode),
      bio: response.data.description,
    };
  } catch (error) {
    return {
      found: false,
      error: `Unable to verify YouTube profile: ${error instanceof Error ? error.message : "Unknown error"}. Please ensure your profile is public and the username is correct.`,
    };
  }
}
