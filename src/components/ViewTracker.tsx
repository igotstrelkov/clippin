import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAction, useQuery } from "convex/react";
import { ArrowDown, ArrowUp, Eye, Info, RefreshCw } from "lucide-react";
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
      <Card className={compact ? "p-2" : "p-4"}>
        <div className="flex flex-col items-center justify-center text-center text-muted-foreground space-y-2">
          <Info className="h-6 w-6" />
          <p className="text-sm">No view data available yet.</p>
          {showRefreshButton && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                void handleRefresh();
              }}
              disabled={refreshing}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
              {refreshing ? "Loading..." : "Load Initial Views"}
            </Button>
          )}
        </div>
      </Card>
    );
  }

  const latestViews = viewHistory[0];
  const previousViews = viewHistory[1];
  const viewChange = previousViews
    ? latestViews.viewCount - previousViews.viewCount
    : 0;

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Eye className="h-4 w-4 text-muted-foreground" />
        <span className="font-bold">
          {latestViews.viewCount.toLocaleString()}
        </span>
        <span className="text-muted-foreground">views</span>
        {viewChange !== 0 && (
          <span
            className={`flex items-center gap-1 ${viewChange > 0 ? "text-green-500" : "text-red-500"}`}
          >
            (
            {viewChange > 0 ? (
              <ArrowUp className="h-3 w-3" />
            ) : (
              <ArrowDown className="h-3 w-3" />
            )}
            {Math.abs(viewChange).toLocaleString()})
          </span>
        )}
        {showRefreshButton && (
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 ml-1"
            onClick={() => {
              void handleRefresh();
            }}
            disabled={refreshing}
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-medium">View Tracking</CardTitle>
        {showRefreshButton && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void handleRefresh();
            }}
            disabled={refreshing}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">
          {latestViews.viewCount.toLocaleString()}
        </div>
        <p
          className={`text-sm ${viewChange >= 0 ? "text-green-500" : "text-red-500"}`}
        >
          {viewChange >= 0 ? "+" : ""}
          {viewChange.toLocaleString()} views since last update
        </p>
        <div className="text-xs text-muted-foreground mt-4 flex items-center gap-2">
          <span>
            Last updated: {new Date(latestViews.timestamp).toLocaleString()}
          </span>
          <Badge
            variant={
              latestViews.source === "tiktok_api" ? "default" : "secondary"
            }
          >
            {latestViews.source.replace("_", " ")}
          </Badge>
        </div>
      </CardContent>
      {/* {viewHistory.length > 1 && (
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Views</TableHead>
                <TableHead className="text-right">Change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {viewHistory.map((item, index) => {
                const prevItem = viewHistory[index + 1];
                const change = prevItem ? item.viewCount - prevItem.viewCount : 0;
                return (
                  <TableRow key={item.timestamp}>
                    <TableCell>{new Date(item.timestamp).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant={item.source === "tiktok_api" ? "default" : "secondary"}>
                        {item.source.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{item.viewCount.toLocaleString()}</TableCell>
                    <TableCell className={`text-right ${change > 0 ? "text-green-500" : change < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                      {change > 0 ? "+" : ""}{change.toLocaleString()}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      )} */}
    </Card>
  );
}
