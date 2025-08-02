import { useAction, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface ViewTrackerProps {
  submissionId: Id<"submissions">;
  showRefreshButton?: boolean;
  compact?: boolean;
}

export function ViewTracker({
  submissionId,
  showRefreshButton = false,
  compact = false,
}: ViewTrackerProps) {
  const [refreshing, setRefreshing] = useState(false);
  const refreshViews = useAction(api.viewTracking.refreshSubmissionViews);

  const viewHistory = useQuery(api.viewTrackingHelpers.getViewHistoryForUser, {
    submissionId,
    limit: 5,
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const result = await refreshViews({ submissionId });
      const change = result.viewCount - result.previousViews;
      if (change > 0) {
        toast.success(`Views updated: +${change.toLocaleString()} new views!`);
      } else if (change < 0) {
        toast.info(`Views updated: ${change.toLocaleString()} change`);
      } else {
        toast.info("Views updated: No change");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to refresh views"
      );
    } finally {
      setRefreshing(false);
    }
  };

  if (!viewHistory || viewHistory.length === 0) {
    return (
      <div className={`${compact ? "p-2" : "p-4"} bg-gray-800 rounded-lg`}>
        <div className="text-gray-400 text-sm">No view data available</div>
        {showRefreshButton && (
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="mt-2 text-purple-400 hover:text-purple-300 text-sm"
          >
            {refreshing ? "Loading..." : "Load Views"}
          </button>
        )}
      </div>
    );
  }

  const latestViews = viewHistory[0];
  const previousViews = viewHistory[1];
  const viewChange = previousViews
    ? latestViews.viewCount - previousViews.viewCount
    : 0;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="text-lg font-bold text-blue-400">
          {latestViews.viewCount.toLocaleString()}
        </div>
        <div className="text-xs text-gray-400">views</div>
        {viewChange !== 0 && (
          <div
            className={`text-xs ${viewChange > 0 ? "text-green-400" : "text-red-400"}`}
          >
            ({viewChange > 0 ? "+" : ""}
            {viewChange.toLocaleString()})
          </div>
        )}
        {showRefreshButton && (
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-purple-400 hover:text-purple-300 text-xs ml-2"
          >
            {refreshing ? "..." : "↻"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-gray-400 font-medium">Views</span>
        {showRefreshButton && (
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-purple-400 hover:text-purple-300 text-sm flex items-center gap-1"
          >
            <svg
              className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        )}
      </div>

      <div className="text-2xl font-bold text-white mb-1">
        {latestViews.viewCount.toLocaleString()}
      </div>

      {viewChange !== 0 && (
        <div
          className={`text-sm mb-2 ${viewChange > 0 ? "text-green-400" : "text-red-400"}`}
        >
          {viewChange > 0 ? "+" : ""}
          {viewChange.toLocaleString()} since last update
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span>
          Last updated: {new Date(latestViews.timestamp).toLocaleString()}
        </span>
        <span
          className={`px-2 py-1 rounded text-xs ${
            latestViews.source === "tiktok_api"
              ? "bg-blue-900/20 text-blue-400"
              : latestViews.source === "manual_refresh"
                ? "bg-purple-900/20 text-purple-400"
                : "bg-gray-900/20 text-gray-400"
          }`}
        >
          {latestViews.source === "tiktok_api"
            ? "Auto"
            : latestViews.source === "manual_refresh"
              ? "Manual"
              : "System"}
        </span>
      </div>

      {/* Threshold indicator */}
      {latestViews.viewCount >= 1000 && (
        <div className="mt-2 flex items-center gap-1 text-xs text-green-400">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
          Minimum views reached
        </div>
      )}
    </div>
  );
}
