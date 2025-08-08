import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { AdminDashboard } from "./AdminDashboard";
import { BrandDashboard } from "./BrandDashboard";
import { CreatorDashboard } from "./CreatorDashboard";
import { ProfileSetup } from "./ProfileSetup";
import { LoadingSpinner } from "./ui/loading-spinner";

export function Dashboard() {
  const profile = useQuery(api.profiles.getCurrentProfile);

  if (profile === undefined) {
    return <LoadingSpinner />;
  }

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto">
        <ProfileSetup />
      </div>
    );
  }

  if (profile.userType === "creator") {
    return <CreatorDashboard />;
  }

  if (profile.userType === "admin") {
    return <AdminDashboard />;
  }

  return <BrandDashboard />;
}
