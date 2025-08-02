import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Update view counts every 30 minutes
crons.interval(
  "update view counts",
  { minutes: 30 },
  internal.viewTracking.updateAllViewCounts,
  {}
);

// Daily cleanup of old view tracking records (keep last 30 days)
crons.interval(
  "cleanup old view records",
  { hours: 24 },
  internal.viewTracking.cleanupOldRecords,
  {}
);

export default crons;
