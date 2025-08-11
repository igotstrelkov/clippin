import { describe, expect, test } from "vitest";
import {
  calculateEarnings,
  calculateEarningsDelta,
  validateBudgetConstraints,
  calculateMaxViewsForBudget,
  shouldCompleteCampaign,
} from "../convex/lib/earnings";

describe("Earnings Calculation", () => {
  describe("calculateEarnings", () => {
    test("calculates basic CPM earnings correctly", () => {
      // Test case: 50,000 views at €0.05 CPM = €2.50
      const result = calculateEarnings(50000, 5); // 5 cents CPM
      expect(result).toBe(250); // 250 cents = €2.50
    });

    test("calculates earnings for small view counts", () => {
      const result = calculateEarnings(1000, 10); // 1000 views at €0.10 CPM
      expect(result).toBe(10); // 10 cents = €0.10
    });

    test("calculates earnings for large view counts", () => {
      const result = calculateEarnings(1000000, 5); // 1M views at €0.05 CPM
      expect(result).toBe(5000); // 5000 cents = €50.00
    });

    test("applies maximum payout limit correctly", () => {
      const result = calculateEarnings(100000, 10, 500); // Would be €10.00, but max €5.00
      expect(result).toBe(500); // Limited to 500 cents = €5.00
    });

    test("handles zero views", () => {
      const result = calculateEarnings(0, 5);
      expect(result).toBe(0);
    });

    test("handles fractional earnings correctly", () => {
      const result = calculateEarnings(1500, 3); // 1.5K views at €0.03 CPM = €0.045
      expect(result).toBe(5); // Rounded to 5 cents
    });

    test("handles very small CPM rates", () => {
      const result = calculateEarnings(10000, 1); // 10K views at €0.01 CPM = €0.10
      expect(result).toBe(10); // 10 cents
    });

    test("throws error for negative view count", () => {
      expect(() => calculateEarnings(-1000, 5)).toThrow("View count cannot be negative");
    });

    test("throws error for negative CPM rate", () => {
      expect(() => calculateEarnings(1000, -5)).toThrow("CPM rate cannot be negative");
    });

    test("throws error for negative max payout", () => {
      expect(() => calculateEarnings(1000, 5, -100)).toThrow("Max payout cannot be negative");
    });

    test("handles edge case of exactly max payout", () => {
      const result = calculateEarnings(10000, 5, 25); // Would earn 25 cents, max is 25
      expect(result).toBe(25);
    });
  });

  describe("calculateEarningsDelta", () => {
    test("calculates positive earnings delta", () => {
      const delta = calculateEarningsDelta(5000, 10000, 10); // 5K to 10K views at €0.10 CPM
      expect(delta).toBe(50); // 50 cents increase
    });

    test("calculates zero delta for same view counts", () => {
      const delta = calculateEarningsDelta(5000, 5000, 10);
      expect(delta).toBe(0);
    });

    test("calculates negative delta when views decrease", () => {
      const delta = calculateEarningsDelta(10000, 5000, 10);
      expect(delta).toBe(-50); // 50 cents decrease
    });

    test("respects max payout limits in delta calculation", () => {
      // Both old and new would exceed max payout
      const delta = calculateEarningsDelta(50000, 100000, 10, 200); // Max €2.00
      expect(delta).toBe(0); // Both are limited to max payout, so no delta
    });

    test("handles transition from below to above max payout", () => {
      const delta = calculateEarningsDelta(10000, 50000, 10, 200); // €1.00 to €5.00, max €2.00
      expect(delta).toBe(100); // From €1.00 to €2.00 (limited by max)
    });
  });

  describe("validateBudgetConstraints", () => {
    test("validates correct budget configuration", () => {
      const result = validateBudgetConstraints(10000, 500, 5000); // €100, €5 CPM, €50 max
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("rejects budget below minimum", () => {
      const result = validateBudgetConstraints(4999, 500, 2000); // €49.99
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Minimum campaign budget is €50.00");
    });

    test("rejects CPM below minimum", () => {
      const result = validateBudgetConstraints(10000, 99, 5000); // €0.99 CPM
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Minimum CPM rate is €1.00");
    });

    test("rejects max payout exceeding total budget", () => {
      const result = validateBudgetConstraints(5000, 500, 6000); // Max €60 > Budget €50
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Max payout per submission cannot exceed total budget");
    });

    test("rejects zero or negative max payout", () => {
      const result = validateBudgetConstraints(10000, 500, 0);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Max payout per submission must be greater than zero");
    });

    test("accumulates multiple validation errors", () => {
      const result = validateBudgetConstraints(3000, 50, 4000); // Multiple issues
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe("calculateMaxViewsForBudget", () => {
    test("calculates max views for given budget and CPM", () => {
      const maxViews = calculateMaxViewsForBudget(10000, 500); // €100 budget, €5 CPM
      expect(maxViews).toBe(20000); // €100 / €5 * 1000 views = 20K views
    });

    test("handles small budgets", () => {
      const maxViews = calculateMaxViewsForBudget(500, 500); // €5 budget, €5 CPM
      expect(maxViews).toBe(1000); // 1K views
    });

    test("returns 0 for zero budget", () => {
      const maxViews = calculateMaxViewsForBudget(0, 500);
      expect(maxViews).toBe(0);
    });

    test("returns 0 for zero CPM", () => {
      const maxViews = calculateMaxViewsForBudget(10000, 0);
      expect(maxViews).toBe(0);
    });

    test("handles fractional results correctly", () => {
      const maxViews = calculateMaxViewsForBudget(333, 500); // €3.33 budget, €5 CPM
      expect(maxViews).toBe(666); // Floor of 666.6 views
    });
  });

  describe("shouldCompleteCampaign", () => {
    test("completes campaign when budget is exhausted", () => {
      const shouldComplete = shouldCompleteCampaign(0, 500);
      expect(shouldComplete).toBe(true);
    });

    test("completes campaign when remaining budget is insufficient for threshold", () => {
      const shouldComplete = shouldCompleteCampaign(100, 500); // €1 remaining, €5 CPM
      expect(shouldComplete).toBe(true); // Can only afford 200 views, below 1K threshold
    });

    test("keeps campaign active when budget is sufficient", () => {
      const shouldComplete = shouldCompleteCampaign(5000, 500); // €50 remaining, €5 CPM
      expect(shouldComplete).toBe(false); // Can afford 10K views
    });

    test("uses custom threshold correctly", () => {
      const shouldComplete = shouldCompleteCampaign(250, 500, 500); // €2.50 remaining, threshold 500 views
      expect(shouldComplete).toBe(false); // Can afford 500 views exactly
    });

    test("handles edge case at exact threshold", () => {
      const shouldComplete = shouldCompleteCampaign(500, 500, 1000); // €5 remaining, €5 CPM, 1K threshold
      expect(shouldComplete).toBe(false); // Can afford exactly 1K views
    });

    test("completes when just below threshold", () => {
      const shouldComplete = shouldCompleteCampaign(499, 500, 1000); // Just under €5
      expect(shouldComplete).toBe(true); // Can only afford 998 views, below threshold
    });
  });

  describe("Integration scenarios", () => {
    test("realistic campaign lifecycle - budget exhaustion", () => {
      const totalBudget = 10000; // €100
      const cpmRate = 250; // €2.50 CPM
      const maxPayout = 2500; // €25 max per submission
      
      // Validate initial setup
      const validation = validateBudgetConstraints(totalBudget, cpmRate, maxPayout);
      expect(validation.isValid).toBe(true);
      
      // Calculate max theoretical views
      const maxViews = calculateMaxViewsForBudget(totalBudget, cpmRate);
      expect(maxViews).toBe(40000); // 40K views for €100 at €2.50 CPM
      
      // Simulate submissions earning close to max
      const submission1Earnings = calculateEarnings(10000, cpmRate); // 10K views = €25
      const submission2Earnings = calculateEarnings(10000, cpmRate); // Another 10K views = €25
      
      expect(submission1Earnings).toBe(2500); // €25
      expect(submission2Earnings).toBe(2500); // €25
      
      // Check remaining budget
      const remainingBudget = totalBudget - submission1Earnings - submission2Earnings;
      expect(remainingBudget).toBe(5000); // €50 remaining
      
      // Should campaign complete?
      expect(shouldCompleteCampaign(remainingBudget, cpmRate)).toBe(false); // Can still afford 20K views
      
      // Add more submissions to exhaust budget
      const submission3Earnings = calculateEarnings(10000, cpmRate); // Another €25
      const finalBudget = remainingBudget - submission3Earnings;
      expect(finalBudget).toBe(2500); // €25 remaining
      
      // Final submission
      const submission4Earnings = calculateEarnings(10000, cpmRate); // Would be €25
      const finalRemainingBudget = finalBudget - submission4Earnings;
      expect(finalRemainingBudget).toBe(0); // Budget exhausted
      
      expect(shouldCompleteCampaign(finalRemainingBudget, cpmRate)).toBe(true);
    });

    test("realistic campaign lifecycle - max payout constraints", () => {
      const totalBudget = 5000; // €50
      const cpmRate = 100; // €1.00 CPM 
      const maxPayout = 1000; // €10 max per submission
      
      // This setup allows for exactly 5 submissions at max payout
      const submission1Views = 50000; // 50K views would earn €50, limited to €10
      const actualEarnings = calculateEarnings(submission1Views, cpmRate, maxPayout);
      expect(actualEarnings).toBe(1000); // Limited to €10
      
      // Calculate theoretical vs actual earnings delta
      const unlimitedEarnings = calculateEarnings(submission1Views, cpmRate); // €50
      const actualLimitedEarnings = calculateEarnings(submission1Views, cpmRate, maxPayout); // €10
      expect(unlimitedEarnings).toBe(5000);
      expect(actualLimitedEarnings).toBe(1000);
    });
  });
});