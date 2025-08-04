import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useQuery } from "convex/react";
import { Info } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface ViewChartProps {
  submissionId: Id<"submissions">;
  height?: number;
}

export function ViewChart({ submissionId, height = 250 }: ViewChartProps) {
  const viewHistory = useQuery(api.viewTrackingHelpers.getViewHistoryForUser, {
    submissionId,
    limit: 48, // Last 48 data points
  });

  if (!viewHistory || viewHistory.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center h-full">
        <Info className="h-8 w-8 text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">
          Not enough data to display a chart. At least two data points are
          needed.
        </p>
      </div>
    );
  }

  const chartData = [...viewHistory].reverse().map((item) => ({
    date: new Date(item.timestamp).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "numeric",
    }),
    viewCount: item.viewCount,
    source: item.source,
  }));

  const chartConfig = {
    viewCount: {
      label: "Views",
      color: "hsl(var(--primary))",
    },
  };

  return (
    <>
      <div className="flex flex-col">
        <ChartContainer config={chartConfig} style={{ height: `${height}px` }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 20, left: -10, bottom: 5 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={12}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={12}
                tickFormatter={(value) => value.toLocaleString()}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(label) => `On ${label}`}
                    formatter={(value, name, props) => (
                      <div>
                        <div>{`${(value as number).toLocaleString()} views`}</div>
                        <div className="text-xs text-muted-foreground">
                          Source: {props.payload.source.replace("_", " ")}
                        </div>
                      </div>
                    )}
                  />
                }
              />
              <Bar
                dataKey="viewCount"
                fill="var(--color-viewCount)"
                radius={4}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>
    </>
  );
}
