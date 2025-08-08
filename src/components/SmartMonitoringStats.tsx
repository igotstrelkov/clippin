import { useQuery } from "convex/react";
import { Activity, BarChart3, Clock, TrendingUp, Zap } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Badge } from "./ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Progress } from "./ui/progress";

export function SmartMonitoringStats() {
  const stats = useQuery(api.smartMonitoring.getMonitoringStatsForUser);

  if (!stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Smart Monitoring System
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-24">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const {
    tierCounts,
    totalApiCallsPerHour,
    estimatedSavings,
    rateLimitStatus,
  } = stats;
  const totalVideos = Object.values(tierCounts).reduce(
    (sum: number, count: number) => sum + count,
    0
  );

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case "hot":
        return <Zap className="h-4 w-4 text-red-500" />;
      case "warm":
        return <TrendingUp className="h-4 w-4 text-orange-500" />;
      case "cold":
        return <BarChart3 className="h-4 w-4 text-blue-500" />;
      case "archived":
        return <Clock className="h-4 w-4 text-gray-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-400" />;
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case "hot":
        return "bg-red-500";
      case "warm":
        return "bg-orange-500";
      case "cold":
        return "bg-blue-500";
      case "archived":
        return "bg-gray-500";
      default:
        return "bg-gray-400";
    }
  };

  const getTierDescription = (tier: string) => {
    switch (tier) {
      case "hot":
        return "Checked every 15 minutes - rapid growth";
      case "warm":
        return "Checked hourly - moderate growth";
      case "cold":
        return "Checked every 6 hours - slow growth";
      case "archived":
        return "Checked daily - minimal activity";
      default:
        return "Awaiting classification";
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Smart Monitoring System
          </CardTitle>
          <CardDescription>
            Video monitoring with dynamic tier classification
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {estimatedSavings.toFixed(1)}%
              </div>
              <div className="text-sm text-muted-foreground">
                API Call Savings
              </div>
            </div>
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {totalApiCallsPerHour}
              </div>
              <div className="text-sm text-muted-foreground">
                API Calls/Hour
              </div>
            </div>
            <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {totalVideos}
              </div>
              <div className="text-sm text-muted-foreground">
                Videos Monitored
              </div>
            </div>
            <div
              className={`text-center p-4 rounded-lg ${
                rateLimitStatus.utilizationPercent > 90
                  ? "bg-red-50 dark:bg-red-900/20"
                  : rateLimitStatus.utilizationPercent > 75
                    ? "bg-yellow-50 dark:bg-yellow-900/20"
                    : "bg-green-50 dark:bg-green-900/20"
              }`}
            >
              <div
                className={`text-2xl font-bold ${
                  rateLimitStatus.utilizationPercent > 90
                    ? "text-red-600 dark:text-red-400"
                    : rateLimitStatus.utilizationPercent > 75
                      ? "text-yellow-600 dark:text-yellow-400"
                      : "text-green-600 dark:text-green-400"
                }`}
              >
                {rateLimitStatus.utilizationPercent.toFixed(1)}%
              </div>
              <div className="text-sm text-muted-foreground">
                Rate Limit Usage
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {rateLimitStatus.requestsLastMinute}/120 per min
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-medium mb-3">Monitoring Tiers Distribution</h4>

            {Object.entries(tierCounts).map(([tier, count]) => {
              if (count === 0 && tier !== "unclassified") return null;

              const percentage =
                totalVideos > 0 ? (count / totalVideos) * 100 : 0;

              return (
                <div key={tier} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getTierIcon(tier)}
                      <span className="font-medium capitalize">{tier}</span>
                      <Badge variant="secondary" className="text-xs">
                        {count}
                      </Badge>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {percentage.toFixed(1)}%
                    </span>
                  </div>

                  <div className="space-y-1">
                    <Progress value={percentage} className="h-2" />
                    <div className="text-xs text-muted-foreground">
                      {getTierDescription(tier)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <div className="text-sm text-muted-foreground space-y-2">
              <h5 className="font-medium text-foreground">How it works:</h5>
              <ul className="space-y-1 text-xs">
                <li>• Videos are automatically classified by growth rate</li>
                <li>• High-growth videos get frequent monitoring (15min)</li>
                <li>• Stable videos get less frequent checks (6h-24h)</li>
                <li>
                  • Smart system reduces API calls by{" "}
                  {estimatedSavings.toFixed(0)}%
                </li>
                <li>• Rate limiting respects 120 requests/minute API limit</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
