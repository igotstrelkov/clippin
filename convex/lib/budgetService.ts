/**
 * Budget Service - Atomic budget operations for the simplified budget architecture
 * 
 * Three Budget States:
 * 1. Total Budget - What brand paid
 * 2. Spent Budget - Paid to creators 
 * 3. Reserved Budget - Held for approved submissions
 * 
 * Remaining Budget = Total - Spent - Reserved
 */

import { Doc, Id } from "../_generated/dataModel";

export interface BudgetState {
  totalBudget: number;    // What brand paid
  spentBudget: number;    // Paid to creators
  reservedBudget: number; // Held for approved submissions
  remainingBudget: number; // Available for new submissions
}

export interface BudgetOperation {
  type: 'reserve' | 'spend' | 'release' | 'refund';
  amount: number;
  submissionId?: Id<"submissions">;
  reason?: string;
}

export interface BudgetValidationResult {
  isValid: boolean;
  error?: string;
  newState?: BudgetState;
}

/**
 * Calculate remaining budget from the three core states
 */
export function calculateRemainingBudget(
  totalBudget: number,
  spentBudget: number,
  reservedBudget: number
): number {
  return totalBudget - spentBudget - reservedBudget;
}

/**
 * Validate budget state consistency
 */
export function validateBudgetState(state: BudgetState): BudgetValidationResult {
  const calculatedRemaining = calculateRemainingBudget(
    state.totalBudget,
    state.spentBudget,
    state.reservedBudget
  );

  // Check if the remaining budget matches calculation
  if (Math.abs(state.remainingBudget - calculatedRemaining) > 0.01) {
    return {
      isValid: false,
      error: `Budget state inconsistent. Expected remaining: ${calculatedRemaining}, actual: ${state.remainingBudget}`
    };
  }

  // Check for negative values
  if (state.spentBudget < 0 || state.reservedBudget < 0 || state.remainingBudget < 0) {
    return {
      isValid: false,
      error: "Budget values cannot be negative"
    };
  }

  // Check if spent + reserved + remaining equals total
  const sum = state.spentBudget + state.reservedBudget + state.remainingBudget;
  if (Math.abs(sum - state.totalBudget) > 0.01) {
    return {
      isValid: false,
      error: `Budget allocation mismatch. Total: ${state.totalBudget}, Sum: ${sum}`
    };
  }

  return { isValid: true, newState: state };
}

/**
 * Reserve budget for approved submission
 */
export function reserveBudget(
  currentState: BudgetState,
  amount: number,
  submissionId: Id<"submissions">
): BudgetValidationResult {
  if (amount <= 0) {
    return {
      isValid: false,
      error: "Reserve amount must be positive"
    };
  }

  if (amount > currentState.remainingBudget) {
    return {
      isValid: false,
      error: `Insufficient budget. Required: ${amount}, available: ${currentState.remainingBudget}`
    };
  }

  const newState: BudgetState = {
    totalBudget: currentState.totalBudget,
    spentBudget: currentState.spentBudget,
    reservedBudget: currentState.reservedBudget + amount,
    remainingBudget: currentState.remainingBudget - amount,
  };

  return validateBudgetState(newState);
}

/**
 * Convert reserved budget to spent (when paying creators)
 */
export function spendReservedBudget(
  currentState: BudgetState,
  amount: number,
  submissionId: Id<"submissions">
): BudgetValidationResult {
  if (amount <= 0) {
    return {
      isValid: false,
      error: "Spend amount must be positive"
    };
  }

  if (amount > currentState.reservedBudget) {
    return {
      isValid: false,
      error: `Insufficient reserved budget. Required: ${amount}, reserved: ${currentState.reservedBudget}`
    };
  }

  const newState: BudgetState = {
    totalBudget: currentState.totalBudget,
    spentBudget: currentState.spentBudget + amount,
    reservedBudget: currentState.reservedBudget - amount,
    remainingBudget: currentState.remainingBudget, // Unchanged
  };

  return validateBudgetState(newState);
}

/**
 * Release reserved budget back to remaining (when submission rejected/removed)
 */
export function releaseReservedBudget(
  currentState: BudgetState,
  amount: number,
  submissionId: Id<"submissions">
): BudgetValidationResult {
  if (amount <= 0) {
    return {
      isValid: false,
      error: "Release amount must be positive"
    };
  }

  if (amount > currentState.reservedBudget) {
    return {
      isValid: false,
      error: `Cannot release more than reserved. Amount: ${amount}, reserved: ${currentState.reservedBudget}`
    };
  }

  const newState: BudgetState = {
    totalBudget: currentState.totalBudget,
    spentBudget: currentState.spentBudget,
    reservedBudget: currentState.reservedBudget - amount,
    remainingBudget: currentState.remainingBudget + amount,
  };

  return validateBudgetState(newState);
}

/**
 * Handle refund of unused budget when campaign completes
 */
export function calculateRefundAmount(
  currentState: BudgetState
): { refundAmount: number; finalState: BudgetState } {
  const refundAmount = currentState.remainingBudget + currentState.reservedBudget;

  const finalState: BudgetState = {
    totalBudget: currentState.spentBudget, // Adjust total to match spent
    spentBudget: currentState.spentBudget,
    reservedBudget: 0,
    remainingBudget: 0,
  };

  return { refundAmount, finalState };
}

/**
 * Check if campaign should auto-pause due to insufficient budget
 */
export function shouldAutoPause(
  currentState: BudgetState,
  minimumReserveAmount: number
): boolean {
  return currentState.remainingBudget < minimumReserveAmount;
}

/**
 * Get budget utilization percentage
 */
export function getBudgetUtilization(currentState: BudgetState): {
  spentPercentage: number;
  reservedPercentage: number;
  remainingPercentage: number;
} {
  if (currentState.totalBudget === 0) {
    return { spentPercentage: 0, reservedPercentage: 0, remainingPercentage: 0 };
  }

  return {
    spentPercentage: (currentState.spentBudget / currentState.totalBudget) * 100,
    reservedPercentage: (currentState.reservedBudget / currentState.totalBudget) * 100,
    remainingPercentage: (currentState.remainingBudget / currentState.totalBudget) * 100,
  };
}

/**
 * Initialize budget state for new campaign
 */
export function initializeCampaignBudget(totalBudget: number): BudgetState {
  return {
    totalBudget,
    spentBudget: 0,
    reservedBudget: 0,
    remainingBudget: totalBudget,
  };
}

/**
 * Extract budget state from campaign document
 */
export function extractBudgetState(campaign: Doc<"campaigns">): BudgetState {
  return {
    totalBudget: campaign.totalBudget,
    spentBudget: campaign.spentBudget ?? 0,
    reservedBudget: campaign.reservedBudget ?? 0,
    remainingBudget: campaign.remainingBudget,
  };
}

/**
 * Convert budget state to campaign update object
 */
export function budgetStateToUpdate(state: BudgetState): Partial<Doc<"campaigns">> {
  return {
    spentBudget: state.spentBudget,
    reservedBudget: state.reservedBudget,
    remainingBudget: state.remainingBudget,
  };
}