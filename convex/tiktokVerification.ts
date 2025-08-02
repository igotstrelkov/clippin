"use node";
import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";

// Mock TikTok API for bio verification
// In production, this would make real API calls to TikTok
export const checkTikTokBioForCode = internalAction({
  args: {
    username: v.string(),
    verificationCode: v.string(),
  },
  handler: async (ctx, args): Promise<{ found: boolean; bio?: string }> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Mock TikTok API response
    // In production, this would:
    // 1. Make authenticated request to TikTok API
    // 2. Fetch user profile by username
    // 3. Check if verification code exists in bio
    // 4. Return the result
    
    const mockBios = [
      `Hey everyone! 🎵 Creating content daily ✨ ${args.verificationCode} #creator`,
      `Music lover 🎶 Dance enthusiast 💃 Follow for daily vibes! ${args.verificationCode}`,
      `Just a regular person making videos 📱 ${args.verificationCode} DM for collabs`,
      `Content creator | Lifestyle | Fashion ${args.verificationCode} ✨`,
      `Living my best life 🌟 ${args.verificationCode} Check out my latest!`
    ];
    
    // Simulate 85% success rate for demo
    const success = Math.random() > 0.15;
    
    if (success) {
      const randomBio = mockBios[Math.floor(Math.random() * mockBios.length)];
      return {
        found: true,
        bio: randomBio
      };
    } else {
      // Simulate bio without verification code
      return {
        found: false,
        bio: "Music lover 🎶 Dance enthusiast 💃 Follow for daily vibes! #creator"
      };
    }
  },
});

// Helper function to validate TikTok username format
export const validateTikTokUsername = internalAction({
  args: {
    username: v.string(),
  },
  handler: async (ctx, args): Promise<{ valid: boolean; error?: string }> => {
    const username = args.username.trim();
    
    // Basic validation rules for TikTok usernames
    if (username.length < 2) {
      return { valid: false, error: "Username must be at least 2 characters long" };
    }
    
    if (username.length > 24) {
      return { valid: false, error: "Username must be 24 characters or less" };
    }
    
    if (!/^[a-zA-Z0-9._]+$/.test(username)) {
      return { valid: false, error: "Username can only contain letters, numbers, periods, and underscores" };
    }
    
    if (username.startsWith('.') || username.endsWith('.')) {
      return { valid: false, error: "Username cannot start or end with a period" };
    }
    
    if (username.includes('..')) {
      return { valid: false, error: "Username cannot contain consecutive periods" };
    }
    
    return { valid: true };
  },
});
