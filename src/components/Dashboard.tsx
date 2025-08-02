import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { ProfileSetup } from "./ProfileSetup";
import { CreatorDashboard } from "./CreatorDashboard";
import { BrandDashboard } from "./BrandDashboard";

export function Dashboard() {
  const profile = useQuery(api.profiles.getCurrentProfile);

  if (profile === undefined) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400"></div>
      </div>
    );
  }

  // Show profile setup only if user hasn't completed it yet
  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Welcome to Clippin!</h1>
          <p className="text-gray-400">Let's set up your profile to get started</p>
        </div>
        <ProfileSetup />
      </div>
    );
  }

  // Once profile is set up, show appropriate dashboard
  if (profile.userType === "creator") {
    return <CreatorDashboard />;
  }

  return <BrandDashboard />;
}
