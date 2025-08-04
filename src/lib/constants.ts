// Application constants for improved maintainability

export const CAMPAIGN_CATEGORIES = [
  { value: "all", label: "All Categories" },
  { value: "lifestyle", label: "Lifestyle" },
  { value: "fashion", label: "Fashion" },
  { value: "beauty", label: "Beauty" },
  { value: "tech", label: "Tech" },
  { value: "food", label: "Food & Drink" },
  { value: "fitness", label: "Fitness" },
  { value: "travel", label: "Travel" },
  { value: "entertainment", label: "Entertainment" },
  { value: "education", label: "Education" },
  { value: "home", label: "Home & Garden" },
] as const;

export const SORT_OPTIONS = [
  { value: "newest", label: "Newest First" },
  { value: "budget", label: "Highest Budget" },
  { value: "cpm", label: "Highest CPM" },
] as const;

export const VIEW_THRESHOLDS = {
  MINIMUM_FOR_APPROVAL: 1000,
  TRACKING_CLEANUP_DAYS: 30,
  RATE_LIMIT_MINUTES: 5,
} as const;

export const PAYMENT_CONFIG = {
  STRIPE_FEE_RATE: 0.029,
  STRIPE_FIXED_FEE: 0.3,
  MIN_PAYOUT_AMOUNT: 10, // $10 minimum payout
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB for logo uploads
} as const;

export const API_LIMITS = {
  TIKTOK_RATE_LIMIT_MS: 5 * 60 * 1000, // 5 minutes between calls
  MAX_SUBMISSIONS_PER_DAY: 10,
  MAX_CAMPAIGNS_PER_BRAND: 50,
} as const;

export const UI_CONFIG = {
  SKELETON_CAMPAIGN_COUNT: 6,
  ITEMS_PER_PAGE: 20,
  SEARCH_DEBOUNCE_MS: 300,
} as const;