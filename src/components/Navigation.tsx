import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { SignOutButton } from "../SignOutButton";
import { Authenticated, Unauthenticated } from "convex/react";

interface NavigationProps {
  currentView: "marketplace" | "dashboard";
  onViewChange: (view: "marketplace" | "dashboard") => void;
}

export function Navigation({ currentView, onViewChange }: NavigationProps) {
  const profile = useQuery(api.profiles.getCurrentProfile);

  return (
    <nav className="bg-gray-800 border-b border-gray-700">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center mr-3">
                <span className="text-white font-bold text-sm">C</span>
              </div>
              <span className="text-xl font-bold">ClipCash</span>
            </div>
            
            <div className="flex space-x-1">
              <button
                onClick={() => onViewChange("marketplace")}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  currentView === "marketplace"
                    ? "bg-purple-600 text-white"
                    : "text-gray-300 hover:text-white hover:bg-gray-700"
                }`}
              >
                Marketplace
              </button>
              
              <Authenticated>
                <button
                  onClick={() => onViewChange("dashboard")}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    currentView === "dashboard"
                      ? "bg-purple-600 text-white"
                      : "text-gray-300 hover:text-white hover:bg-gray-700"
                  }`}
                >
                  Dashboard
                </button>
              </Authenticated>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <Authenticated>
              {profile && (
                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {profile.userType === "creator" ? profile.creatorName : profile.companyName}
                    </div>
                    <div className="text-xs text-gray-400 capitalize">
                      {profile.userType}
                    </div>
                  </div>
                  <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-sm">
                      {profile.userType === "creator" 
                        ? (profile.creatorName?.charAt(0) || "C")
                        : (profile.companyName?.charAt(0) || "B")
                      }
                    </span>
                  </div>
                  <SignOutButton />
                </div>
              )}
            </Authenticated>
            
            <Unauthenticated>
              <button
                onClick={() => onViewChange("dashboard")}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Sign In
              </button>
            </Unauthenticated>
          </div>
        </div>
      </div>
    </nav>
  );
}
