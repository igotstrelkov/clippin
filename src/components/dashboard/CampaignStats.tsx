import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { DollarSign, Eye, Package, TrendingUp } from "lucide-react";
import { memo } from "react";

interface CampaignStatsProps {
  stats: {
    totalSpent: number;
    totalViews: number;
    totalSubmissions: number;
    avgCpm: number;
  };
  activeCampaignsCount: number;
}

export const CampaignStats = memo(
  ({ stats, activeCampaignsCount }: CampaignStatsProps) => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={Package}
          title="Active Campaigns"
          value={activeCampaignsCount.toString()}
        />
        <StatCard
          icon={DollarSign}
          title="Total Spent"
          value={formatCurrency(stats.totalSpent / 100)}
        />
        <StatCard
          icon={Eye}
          title="Total Views"
          value={stats.totalViews.toLocaleString()}
        />
        <StatCard
          icon={TrendingUp}
          title="Avg CPM"
          value={formatCurrency(stats.avgCpm / 100)}
        />
      </div>
    );
  }
);

CampaignStats.displayName = "CampaignStats";

const StatCard = memo(
  ({
    icon: Icon,
    title,
    value,
  }: {
    icon: React.ElementType;
    title: string;
    value: string;
  }) => {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{value}</div>
        </CardContent>
      </Card>
    );
  }
);

StatCard.displayName = "StatCard";
