// Input validation utilities for better data integrity

export const VALIDATION_PATTERNS = {
  TIKTOK_URL: /^https:\/\/(www\.)?(tiktok\.com|vm\.tiktok\.com)/,
  YOUTUBE_URL: /^https:\/\/(www\.)?(youtube\.com|youtu\.be)/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  USERNAME: /^[a-zA-Z0-9_]{1,30}$/,
} as const;

export const VALIDATION_LIMITS = {
  CAMPAIGN_TITLE: { min: 3, max: 100 },
  CAMPAIGN_DESCRIPTION: { min: 10, max: 1000 },
  COMPANY_NAME: { min: 2, max: 100 },
  CREATOR_NAME: { min: 2, max: 50 },
  BUDGET: { min: 10, max: 100000 }, // $10 to $100k
  CPM: { min: 0.01, max: 100 }, // $0.01 to $100 per 1000 views
} as const;

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validate TikTok URL format and extract video ID
 */
export function validateContentUrl(
  url: string
): ValidationResult & { videoId?: string } {
  if (!url.trim()) {
    return { isValid: false, error: "Content URL is required" };
  }

  if (!VALIDATION_PATTERNS.TIKTOK_URL.test(url)) {
    return {
      isValid: false,
      error:
        "Please enter a valid TikTok URL (e.g., https://tiktok.com/@user/video/123)",
    };
  }

  // Extract video ID from URL
  const videoIdMatch = url.match(/\/video\/(\d+)/);
  const videoId = videoIdMatch?.[1];

  if (!videoId) {
    return {
      isValid: false,
      error: "Could not find video ID in the TikTok URL",
    };
  }

  return { isValid: true, videoId };
}

/**
 * Validate YouTube URL for campaign assets
 */
export function validateYouTubeUrl(url: string): ValidationResult {
  if (!url.trim()) {
    return { isValid: false, error: "YouTube URL is required" };
  }

  if (!VALIDATION_PATTERNS.YOUTUBE_URL.test(url)) {
    return {
      isValid: false,
      error: "Please enter a valid YouTube URL",
    };
  }

  return { isValid: true };
}

/**
 * Validate campaign budget
 */
export function validateBudget(budget: number): ValidationResult {
  if (isNaN(budget) || budget <= 0) {
    return { isValid: false, error: "Budget must be a positive number" };
  }

  if (budget < VALIDATION_LIMITS.BUDGET.min) {
    return {
      isValid: false,
      error: `Minimum budget is $${VALIDATION_LIMITS.BUDGET.min}`,
    };
  }

  if (budget > VALIDATION_LIMITS.BUDGET.max) {
    return {
      isValid: false,
      error: `Maximum budget is $${VALIDATION_LIMITS.BUDGET.max.toLocaleString()}`,
    };
  }

  return { isValid: true };
}

/**
 * Validate CPM rate
 */
export function validateCPM(cpm: number): ValidationResult {
  if (isNaN(cpm) || cpm <= 0) {
    return { isValid: false, error: "CPM must be a positive number" };
  }

  if (cpm < VALIDATION_LIMITS.CPM.min) {
    return {
      isValid: false,
      error: `Minimum CPM is $${VALIDATION_LIMITS.CPM.min}`,
    };
  }

  if (cpm > VALIDATION_LIMITS.CPM.max) {
    return {
      isValid: false,
      error: `Maximum CPM is $${VALIDATION_LIMITS.CPM.max}`,
    };
  }

  return { isValid: true };
}

/**
 * Validate text input with length constraints
 */
export function validateTextInput(
  value: string,
  fieldName: string,
  limits: { min: number; max: number }
): ValidationResult {
  const trimmed = value.trim();

  if (!trimmed) {
    return { isValid: false, error: `${fieldName} is required` };
  }

  if (trimmed.length < limits.min) {
    return {
      isValid: false,
      error: `${fieldName} must be at least ${limits.min} characters long`,
    };
  }

  if (trimmed.length > limits.max) {
    return {
      isValid: false,
      error: `${fieldName} must be less than ${limits.max} characters long`,
    };
  }

  return { isValid: true };
}

/**
 * Validate TikTok username format
 */
export function validateTikTokUsername(username: string): ValidationResult {
  if (!username.trim()) {
    return { isValid: false, error: "TikTok username is required" };
  }

  // Remove @ if present
  const cleanUsername = username.replace(/^@/, "");

  if (!VALIDATION_PATTERNS.USERNAME.test(cleanUsername)) {
    return {
      isValid: false,
      error: "Username can only contain letters, numbers, and underscores",
    };
  }

  if (cleanUsername.length < 1 || cleanUsername.length > 30) {
    return {
      isValid: false,
      error: "Username must be 1-30 characters long",
    };
  }

  return { isValid: true };
}

/**
 * Comprehensive form validation helper
 */
export function validateForm<T extends Record<string, any>>(
  data: T,
  validators: Record<keyof T, (value: any) => ValidationResult>
): { isValid: boolean; errors: Partial<Record<keyof T, string>> } {
  const errors: Partial<Record<keyof T, string>> = {};
  let isValid = true;

  for (const [field, validator] of Object.entries(validators)) {
    const result = validator(data[field]);
    if (!result.isValid) {
      errors[field as keyof T] = result.error;
      isValid = false;
    }
  }

  return { isValid, errors };
}
