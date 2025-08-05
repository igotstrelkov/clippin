import { Card, CardContent } from "@/components/ui/card";
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

export const CampaignStats = memo(({ stats, activeCampaignsCount }: CampaignStatsProps) => {
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
});

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
  }) => (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center">
          <Icon className="h-8 w-8 text-muted-foreground" />
          <div className="ml-4">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
);

StatCard.displayName = "StatCard";
