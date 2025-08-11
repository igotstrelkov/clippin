import { vi, beforeEach } from "vitest";

// Mock fetch for TikTok API calls
global.fetch = vi.fn();

// Mock environment variables
process.env.STRIPE_SECRET_KEY = "sk_test_mock_key";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_mock_webhook_secret";
process.env.TIKTOK_RAPIDAPI_KEY = "mock_rapidapi_key";
process.env.RAPID_API_KEY = "mock_rapidapi_key";

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});