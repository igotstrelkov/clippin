import { Card } from "@/components/ui/card";
import { Eye } from "lucide-react";
import { memo } from "react";

export const AnalyticsDashboard = memo(() => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">Performance Analytics</h2>
        <p className="text-muted-foreground mb-6">
          Detailed insights into your campaign performance
        </p>

        <Card className="p-12">
          <div className="text-center text-muted-foreground">
            <div className="mx-auto w-16 h-16 bg-muted rounded-lg flex items-center justify-center mb-4">
              <Eye className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-medium mb-2">
              Campaign Performance Over Time
            </h3>
            <p className="text-sm mb-8">Interactive charts coming soon</p>
          </div>
        </Card>
      </div>
    </div>
  );
});

AnalyticsDashboard.displayName = "AnalyticsDashboard";
