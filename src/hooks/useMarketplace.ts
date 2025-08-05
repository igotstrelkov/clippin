import { useQuery } from "convex/react";
import { useMemo } from "react";
import { useDebounce } from "./useDebounce";
import { api } from "../../convex/_generated/api";
import { UI_CONFIG } from "../lib/constants";

export function useMarketplace(
  searchQuery: string,
  categoryFilter: string,
  sortBy: "newest" | "budget" | "cpm"
) {
  const marketplaceData = useQuery(api.campaigns.getMarketplaceStats);
  const debouncedSearchQuery = useDebounce(
    searchQuery,
    UI_CONFIG.SEARCH_DEBOUNCE_MS
  );

  const sortedCampaigns = useMemo(() => {
    if (!marketplaceData?.campaigns) return [];

    const filteredCampaigns = marketplaceData.campaigns.filter(
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
  }, [marketplaceData?.campaigns, categoryFilter, debouncedSearchQuery, sortBy]);

  const isLoading = marketplaceData === undefined;
  const hasError = marketplaceData === null;

  return {
    campaigns: sortedCampaigns,
    stats: marketplaceData?.stats || {
      totalBudget: 0,
      avgCpm: 0,
      activeCampaignsCount: 0,
    },
    isLoading,
    hasError,
  };
}
