import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { ProfileSetup } from "./ProfileSetup";
import { CreatorDashboard } from "./CreatorDashboard";
import { BrandDashboard } from "./BrandDashboard";
import { Loader2 } from "lucide-react";

export function Dashboard() {
  const profile = useQuery(api.profiles.getCurrentProfile);

  if (profile === undefined) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Welcome to Clippin!</h1>
          <p className="text-muted-foreground">Let's set up your profile to get started</p>
        </div>
        <ProfileSetup />
      </div>
    );
  }

  if (profile.userType === "creator") {
    return <CreatorDashboard />;
  }

  return <BrandDashboard />;
}
