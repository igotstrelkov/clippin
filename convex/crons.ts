import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Smart monitoring cron jobs - staggered intervals for different tiers

// HOT tier: Check every 15 minutes for rapidly growing videos
crons.interval(
  "smart monitoring - hot tier",
  { minutes: 15 },
  internal.smartMonitoring.updateTierSubmissions,
  { tier: "hot" }
);

// WARM tier: Check every hour for moderately growing videos
crons.interval(
  "smart monitoring - warm tier",
  { minutes: 60 },
  internal.smartMonitoring.updateTierSubmissions,
  { tier: "warm" }
);

// COLD tier: Check every 6 hours for slowly growing videos
crons.interval(
  "smart monitoring - cold tier",
  { hours: 6 },
  internal.smartMonitoring.updateTierSubmissions,
  { tier: "cold" }
);

// ARCHIVED tier: Check daily for stable/declining videos
crons.interval(
  "smart monitoring - archived tier",
  { hours: 24 },
  internal.smartMonitoring.updateTierSubmissions,
  { tier: "archived" }
);

// Update tier classifications every 6 hours based on growth patterns
crons.interval(
  "update tier classifications",
  { hours: 6 },
  internal.smartMonitoring.updateAllTierClassifications,
  {}
);

// Auto-approve submissions that have been pending for over 48 hours
crons.interval(
  "auto approve expired submissions",
  { hours: 6 }, // Run every 6 hours
  internal.submissions.autoApproveExpiredSubmissions,
  {}
);

// Daily cleanup of old view tracking records (keep last 30 days)
crons.interval(
  "cleanup old view records",
  { hours: 24 },
  internal.viewTracking.cleanupOldRecords,
  {}
);

// Auto-complete campaigns that have passed their end date
crons.interval(
  "auto complete expired campaigns",
  { hours: 24 }, // Check hourly for expired campaigns
  internal.campaigns.autoCompleteExpiredCampaigns,
  {}
);

export default crons;
