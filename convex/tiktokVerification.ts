"use node";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";

// TikTok Business API integration for bio verification
export const checkTikTokBioForCode = internalAction({
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
        error: "Unable to verify TikTok profile. Please ensure your username is correct and your profile is public.",
      };
    }
  },
});

// Verification using TikTok public profile data
async function checkBioWithPublicAPI(
  username: string,
  verificationCode: string
): Promise<{ found: boolean; bio?: string; error?: string }> {
  try {
    const profileUrl = `https://www.tiktok.com/@${username}`;

    // Use multiple approaches to fetch the profile data
    const approaches: RequestInit[] = [
      // Approach 1: Standard browser request
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
          Connection: "keep-alive",
        },
      },
      // Approach 2: Mobile user agent
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      },
    ];

    let html = "";
    let lastError = null;

    for (const approach of approaches) {
      try {
        const response = await fetch(profileUrl, approach);

        if (!response.ok) {
          lastError = new Error(
            `HTTP ${response.status}: ${response.statusText}`
          );
          continue;
        }

        html = await response.text();
        break;
      } catch (error) {
        lastError = error;
        continue;
      }
    }

    if (!html) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw lastError || new Error("All fetch approaches failed");
    }

    // Enhanced bio extraction with multiple patterns
    const bioPatterns = [
      // JSON-LD structured data
      /"description":"([^"]*?)"/g,
      // Open Graph meta tag
      /<meta[^>]*property="og:description"[^>]*content="([^"]*?)"/g,
      // Standard meta description
      /<meta[^>]*name="description"[^>]*content="([^"]*?)"/g,
      // TikTok's bio in JSON data
      /"bioDescription":\s*{\s*"text":"([^"]*?)"/g,
      // Alternative bio patterns
      /"desc":"([^"]*?)"/g,
      /"signature":"([^"]*?)"/g,
    ];

    let bio = "";
    let found = false;

    for (const pattern of bioPatterns) {
      const matches = [...html.matchAll(pattern)];

      for (const match of matches) {
        if (match[1]) {
          const decodedBio = match[1]
            .replace(/\\u[\dA-F]{4}/gi, (unicodeMatch) =>
              String.fromCharCode(
                parseInt(unicodeMatch.replace(/\\u/g, ""), 16)
              )
            )
            .replace(/\\n/g, " ")
            .replace(/\\"/g, '"')
            .replace(/\\r/g, "")
            .replace(/\\\\/g, "\\")
            .trim();

          if (decodedBio.length > bio.length) {
            bio = decodedBio;
          }

          if (decodedBio.includes(verificationCode)) {
            found = true;
            bio = decodedBio;
            break;
          }
        }
      }

      if (found) break;
    }

    if (!bio) {
      return {
        found: false,
        error:
          "Could not access TikTok profile bio. Please ensure your profile is public and has a bio.",
      };
    }

    return {
      found,
      bio: bio,
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
