import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDebounce } from "@/hooks/useDebounce";
import { CAMPAIGN_CATEGORIES, SORT_OPTIONS, UI_CONFIG } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import { useQuery } from "convex/react";
import {
  AlertTriangle,
  DollarSign,
  Search,
  SearchX,
  Target,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { CampaignCard } from "./campaign-marketplace/CampaignCard";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { EmptyState } from "./ui/empty-state";
import { LoadingSpinner } from "./ui/loading-spinner";

export function CampaignMarketplace() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"newest" | "budget" | "cpm">("newest");

  const marketplaceStats = useQuery(api.campaigns.getMarketplaceStats);
  const debouncedSearchQuery = useDebounce(
    searchQuery,
    UI_CONFIG.SEARCH_DEBOUNCE_MS
  );

  const sortedCampaigns = useMemo(() => {
    if (!marketplaceStats?.campaigns) return [];

    const filteredCampaigns = marketplaceStats.campaigns.filter(
      (campaign) =>
        (categoryFilter === "all" || campaign.category === categoryFilter) &&
        (debouncedSearchQuery === "" ||
          campaign.title
            .toLowerCase()
            .includes(debouncedSearchQuery.toLowerCase()))
    );

    return filteredCampaigns.sort((a, b) => {
      switch (sortBy) {
        case "budget":
          return b.totalBudget - a.totalBudget;
        case "cpm":
          return b.cpmRate - a.cpmRate;
        case "newest":
        default:
          return b._creationTime - a._creationTime;
      }
    });
  }, [
    marketplaceStats?.campaigns,
    categoryFilter,
    debouncedSearchQuery,
    sortBy,
  ]);

  if (marketplaceStats === undefined) {
    return <LoadingSpinner />;
  }

  if (!marketplaceStats) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error Loading Marketplace</AlertTitle>
        <AlertDescription>
          Could not load marketplace. Please refresh the page.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          Turn Your{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">
            TikTok Into Cash
          </span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Connect with top brands, create amazing content, and get paid for
          every view. Join thousands of creators earning money on Clippin.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Campaigns
            </CardTitle>
            <Target className="w-5 h-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {marketplaceStats.stats.activeCampaignsCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Budget Available
            </CardTitle>
            <DollarSign className="w-5 h-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {formatCurrency(marketplaceStats.stats.totalBudget / 100)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Average CPM Rate
            </CardTitle>
            <TrendingUp className="w-5 h-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {formatCurrency(marketplaceStats.stats.avgCpm / 100)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div className="grid gap-2 md:col-span-1">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  type="search"
                  placeholder="Search by campaign title..."
                  className="pl-8 w-full"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category-filter">Category</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger id="category-filter">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  {CAMPAIGN_CATEGORIES.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sort-by">Sort by</Label>
              <Select
                value={sortBy}
                onValueChange={(value) =>
                  setSortBy(value as "newest" | "budget" | "cpm")
                }
              >
                <SelectTrigger id="sort-by">
                  <SelectValue placeholder="Sort campaigns" />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Campaign Grid */}
      {sortedCampaigns.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedCampaigns.map((campaign) => (
            <CampaignCard
              key={campaign._id}
              campaign={campaign}
              onClick={() => {
                void navigate(`/campaign/${campaign._id}`);
              }}
            />
          ))}
        </div>
      ) : (
        <Card className="text-center py-12">
          <CardContent className="flex flex-col items-center gap-4">
            <SearchX className="w-16 h-16 text-muted-foreground" />
            <h3 className="text-xl font-semibold">No campaigns found</h3>
            <p className="text-muted-foreground">
              {categoryFilter === "all"
                ? "No active campaigns are available right now."
                : `No campaigns were found in the "${
                    CAMPAIGN_CATEGORIES.find((c) => c.value === categoryFilter)
                      ?.label
                  }" category.`}
            </p>
            <EmptyState
              title="No Draft Campaigns"
              description="Draft campaigns will appear here."
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
