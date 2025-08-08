import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { logger } from "./logger";

// Rate limiter for RapidAPI (120 requests/minute = 2 requests/second)
const RATE_LIMIT = {
  MAX_REQUESTS_PER_MINUTE: 120, // ← Change to 300 when rate limit is higher
  MAX_REQUESTS_PER_SECOND: 2, // Change to 5 when rate limit is higher
  WINDOW_SIZE_MS: 60 * 1000, // 1 minute
  BURST_WINDOW_MS: 1000, // 1 second
};

// Global rate limiter state (in production, this would be in a dedicated cache/db)
let requestQueue: Array<{ timestamp: number; submissionId: string }> = [];

// Check if we can make an API request without exceeding rate limits
export const canMakeRequest = internalQuery({
  args: {},
  returns: v.object({
    canRequest: v.boolean(),
    waitTimeMs: v.number(),
    queueSize: v.number(),
  }),
  handler: async (ctx) => {
    const now = Date.now();
    const oneMinuteAgo = now - RATE_LIMIT.WINDOW_SIZE_MS;
    const oneSecondAgo = now - RATE_LIMIT.BURST_WINDOW_MS;

    // Clean up old requests from queue
    requestQueue = requestQueue.filter((req) => req.timestamp > oneMinuteAgo);

    // Count requests in last minute and last second
    const requestsLastMinute = requestQueue.length;
    const requestsLastSecond = requestQueue.filter(
      (req) => req.timestamp > oneSecondAgo
    ).length;

    // Check if we can make a request
    const canRequestMinute =
      requestsLastMinute < RATE_LIMIT.MAX_REQUESTS_PER_MINUTE;
    const canRequestSecond =
      requestsLastSecond < RATE_LIMIT.MAX_REQUESTS_PER_SECOND;
    const canRequest = canRequestMinute && canRequestSecond;

    // Calculate wait time if we can't make request
    let waitTimeMs = 0;
    if (!canRequestSecond) {
      // Need to wait until next second window
      waitTimeMs = Math.max(
        1000 -
          (now -
            requestQueue[
              requestQueue.length - RATE_LIMIT.MAX_REQUESTS_PER_SECOND
            ].timestamp),
        0
      );
    } else if (!canRequestMinute) {
      // Need to wait until oldest request in minute window expires
      const oldestRequest = requestQueue[0];
      waitTimeMs = Math.max(
        RATE_LIMIT.WINDOW_SIZE_MS - (now - oldestRequest.timestamp),
        0
      );
    }

    return {
      canRequest,
      waitTimeMs,
      queueSize: requestQueue.length,
    };
  },
});

// Record an API request (call this after making a successful request)
export const recordRequest = internalMutation({
  args: {
    submissionId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();

    // Add request to queue
    requestQueue.push({
      timestamp: now,
      submissionId: args.submissionId,
    });

    // Clean up requests older than 1 minute
    const oneMinuteAgo = now - RATE_LIMIT.WINDOW_SIZE_MS;
    requestQueue = requestQueue.filter((req) => req.timestamp > oneMinuteAgo);

    logger.info("API request recorded", {
      submissionId: args.submissionId,
      queueSize: requestQueue.length,
      timestamp: now,
    });
  },
});

// Get current rate limiter status
export const getRateLimiterStatus = internalQuery({
  args: {},
  returns: v.object({
    requestsLastMinute: v.number(),
    requestsLastSecond: v.number(),
    queueSize: v.number(),
    utilizationPercent: v.number(),
    canMakeRequest: v.boolean(),
  }),
  handler: async (ctx) => {
    const now = Date.now();
    const oneMinuteAgo = now - RATE_LIMIT.WINDOW_SIZE_MS;
    const oneSecondAgo = now - RATE_LIMIT.BURST_WINDOW_MS;

    // Clean up old requests
    requestQueue = requestQueue.filter((req) => req.timestamp > oneMinuteAgo);

    const requestsLastMinute = requestQueue.length;
    const requestsLastSecond = requestQueue.filter(
      (req) => req.timestamp > oneSecondAgo
    ).length;
    const utilizationPercent =
      (requestsLastMinute / RATE_LIMIT.MAX_REQUESTS_PER_MINUTE) * 100;

    const canMakeRequest =
      requestsLastMinute < RATE_LIMIT.MAX_REQUESTS_PER_MINUTE &&
      requestsLastSecond < RATE_LIMIT.MAX_REQUESTS_PER_SECOND;

    return {
      requestsLastMinute,
      requestsLastSecond,
      queueSize: requestQueue.length,
      utilizationPercent,
      canMakeRequest,
    };
  },
});

// Utility function to delay execution
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
