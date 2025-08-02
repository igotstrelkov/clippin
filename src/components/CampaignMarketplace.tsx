import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { CampaignCard } from "./CampaignCard";
import { CampaignModal } from "./CampaignModal";

export function CampaignMarketplace() {
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"newest" | "budget" | "cpm">("newest");
  const [selectedCampaignId, setSelectedCampaignId] =
    useState<Id<"campaigns"> | null>(null);

  const campaigns = useQuery(api.campaigns.getActiveCampaigns) || [];

  // Filter campaigns by category
  const filteredCampaigns = campaigns.filter(
    (campaign) =>
      categoryFilter === "all" || campaign.category === categoryFilter
  );

  // Sort campaigns
  const sortedCampaigns = [...filteredCampaigns].sort((a, b) => {
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

  const categories = [
    { value: "all", label: "All Categories" },
    { value: "lifestyle", label: "Lifestyle" },
    { value: "fashion", label: "Fashion" },
    { value: "beauty", label: "Beauty" },
    { value: "fitness", label: "Fitness" },
    { value: "food", label: "Food" },
    { value: "travel", label: "Travel" },
    { value: "tech", label: "Technology" },
    { value: "gaming", label: "Gaming" },
    { value: "music", label: "Music" },
    { value: "comedy", label: "Comedy" },
    { value: "education", label: "Education" },
    { value: "business", label: "Business" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">
          Campaign{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">
            Marketplace
          </span>
        </h1>
        <p className="text-gray-300 text-lg max-w-2xl mx-auto">
          Discover exciting brand campaigns and start earning money from your
          TikTok content. Get paid based on your video performance with
          transparent CPM rates.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-800 rounded-lg p-6 text-center">
          <div className="text-3xl font-bold text-purple-400 mb-2">
            {campaigns.length}
          </div>
          <div className="text-gray-300">Active Campaigns</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-6 text-center">
          <div className="text-3xl font-bold text-green-400 mb-2">
            $
            {(
              campaigns.reduce((sum, c) => sum + c.totalBudget, 0) / 100
            ).toLocaleString()}
          </div>
          <div className="text-gray-300">Total Budget Available</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-6 text-center">
          <div className="text-3xl font-bold text-blue-400 mb-2">
            $
            {campaigns.length > 0
              ? (
                  campaigns.reduce((sum, c) => sum + c.cpmRate, 0) /
                  campaigns.length /
                  100
                ).toFixed(2)
              : "0.00"}
          </div>
          <div className="text-gray-300">Average CPM Rate</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-300">Category:</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
          >
            {categories.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-300">Sort by:</label>
          <select
            value={sortBy}
            onChange={(e) =>
              setSortBy(e.target.value as "newest" | "budget" | "cpm")
            }
            className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
          >
            <option value="newest">Newest First</option>
            <option value="budget">Highest Budget</option>
            <option value="cpm">Highest CPM</option>
          </select>
        </div>
      </div>

      {/* Campaign Grid */}
      {sortedCampaigns.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedCampaigns.map((campaign) => (
            <CampaignCard
              key={campaign._id}
              campaign={campaign}
              onClick={() => setSelectedCampaignId(campaign._id)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-300 mb-2">
            No campaigns found
          </h3>
          <p className="text-gray-400">
            {categoryFilter === "all"
              ? "No active campaigns available at the moment."
              : `No campaigns found in the ${categories.find((c) => c.value === categoryFilter)?.label} category.`}
          </p>
        </div>
      )}

      {/* Campaign Modal */}
      {selectedCampaignId && (
        <CampaignModal
          campaignId={selectedCampaignId}
          onClose={() => setSelectedCampaignId(null)}
        />
      )}
    </div>
  );
}
