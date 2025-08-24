/**
 * Pure functions for earnings calculations
 * Extracted for improved testability and reusability
 */

// Minimum payout threshold in cents (€20.00)
export const MINIMUM_PAYOUT_THRESHOLD = 2000;

/**
 * Calculate earnings based on view count and CPM rate
 * @param viewCount - Total number of views
 * @param cpmRate - CPM rate in cents (e.g., 5 = €0.05 per 1000 views)
 * @param maxPayout - Optional maximum payout limit in cents
 * @returns Earnings in cents
 */
export function calculateEarnings(
  viewCount: number,
  cpmRate: number,
  maxPayout?: number
): number {
  // Input validation
  if (viewCount < 0) {
    throw new Error("View count cannot be negative");
  }
  if (cpmRate < 0) {
    throw new Error("CPM rate cannot be negative");
  }
  if (maxPayout !== undefined && maxPayout < 0) {
    throw new Error("Max payout cannot be negative");
  }

  // Convert cpmRate from cents to dollars, calculate earnings, then convert back to cents
  const cpmInDollars = cpmRate / 100;
  const earningsInDollars = (viewCount / 1000) * cpmInDollars;
  const earningsInCents = Math.round(earningsInDollars * 100);
  
  return maxPayout ? Math.min(earningsInCents, maxPayout) : earningsInCents;
}

/**
 * Calculate the change in earnings between two view counts
 * @param oldViewCount - Previous view count
 * @param newViewCount - New view count
 * @param cpmRate - CPM rate in cents
 * @param maxPayout - Optional maximum payout limit in cents
 * @returns Change in earnings (delta) in cents
 */
export function calculateEarningsDelta(
  oldViewCount: number,
  newViewCount: number,
  cpmRate: number,
  maxPayout?: number
): number {
  const oldEarnings = calculateEarnings(oldViewCount, cpmRate, maxPayout);
  const newEarnings = calculateEarnings(newViewCount, cpmRate, maxPayout);
  return newEarnings - oldEarnings;
}

/**
 * Validate campaign budget constraints
 * @param totalBudget - Total campaign budget in cents
 * @param cpmRate - CPM rate in cents
 * @param maxPayoutPerSubmission - Maximum payout per submission in cents
 * @returns Validation result with any errors
 */
export function validateBudgetConstraints(
  totalBudget: number,
  cpmRate: number,
  maxPayoutPerSubmission: number
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (totalBudget < 5000) {
    errors.push("Minimum campaign budget is €50.00");
  }

  if (cpmRate < 100) {
    errors.push("Minimum CPM rate is €1.00");
  }

  if (maxPayoutPerSubmission > totalBudget) {
    errors.push("Max payout per submission cannot exceed total budget");
  }

  if (maxPayoutPerSubmission <= 0) {
    errors.push("Max payout per submission must be greater than zero");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Calculate the maximum possible views for a given budget and CPM
 * @param budget - Available budget in cents
 * @param cpmRate - CPM rate in cents
 * @returns Maximum views possible within budget
 */
export function calculateMaxViewsForBudget(
  budget: number,
  cpmRate: number
): number {
  if (budget <= 0 || cpmRate <= 0) {
    return 0;
  }
  
  const cpmInDollars = cpmRate / 100;
  const budgetInDollars = budget / 100;
  return Math.floor((budgetInDollars / cpmInDollars) * 1000);
}

/**
 * Check if a campaign should be marked as completed based on remaining budget
 * @param remainingBudget - Remaining budget in cents
 * @param cpmRate - CPM rate in cents
 * @param threshold - Minimum views threshold for meaningful earnings (default: 1000)
 * @returns Whether campaign should be completed
 */
export function shouldCompleteCampaign(
  remainingBudget: number,
  cpmRate: number,
  threshold: number = 1000
): boolean {
  if (remainingBudget <= 0) {
    return true;
  }
  
  // If remaining budget can't support meaningful earnings, complete the campaign
  const maxPossibleViews = calculateMaxViewsForBudget(remainingBudget, cpmRate);
  return maxPossibleViews < threshold;
}

/**
 * Check if creator has enough earnings for payout
 * @param availableEarnings - Total available earnings in cents
 * @returns Validation result with eligibility and reason
 */
export function validatePayoutEligibility(
  availableEarnings: number
): { isEligible: boolean; reason?: string; minimumRequired?: number } {
  if (availableEarnings < MINIMUM_PAYOUT_THRESHOLD) {
    return {
      isEligible: false,
      reason: `Minimum payout threshold is €${(MINIMUM_PAYOUT_THRESHOLD / 100).toFixed(2)}. You currently have €${(availableEarnings / 100).toFixed(2)}.`,
      minimumRequired: MINIMUM_PAYOUT_THRESHOLD
    };
  }

  return {
    isEligible: true
  };
}

/**
 * Calculate how much more earnings needed to reach payout threshold
 * @param currentEarnings - Current earnings in cents
 * @returns Amount needed in cents
 */
export function calculateEarningsNeededForPayout(
  currentEarnings: number
): number {
  if (currentEarnings >= MINIMUM_PAYOUT_THRESHOLD) {
    return 0;
  }
  return MINIMUM_PAYOUT_THRESHOLD - currentEarnings;
}