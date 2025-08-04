import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { SignOutButton } from "../SignOutButton";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "./ui/button";

export function Navigation() {
  const { resolvedTheme } = useTheme();
  const [logoSrc, setLogoSrc] = useState("/logo-white.png"); // Default logo
  const profile = useQuery(api.profiles.getCurrentProfile);
  const location = useLocation();
  
  const currentView = location.pathname.startsWith('/dashboard') ? 'dashboard' : 'marketplace';

  useEffect(() => {
    if (resolvedTheme) {
      setLogoSrc(resolvedTheme === "dark" ? "/logo-white.png" : "/logo-black.png");
    }
  }, [resolvedTheme]);

  const profileName = profile
    ? profile.userType === "creator"
      ? profile.creatorName
      : profile.companyName
    : "";

  return (
    <nav className="border-b">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <img src={logoSrc} alt="Clippin" width={130} />
            <div className="flex space-x-2">
              <Button
                variant={currentView === "marketplace" ? "secondary" : "ghost"}
                asChild
              >
                <Link to="/marketplace">Marketplace</Link>
              </Button>
              <Authenticated>
                <Button
                  variant={currentView === "dashboard" ? "secondary" : "ghost"}
                  asChild
                >
                  <Link to="/dashboard">Dashboard</Link>
                </Button>
              </Authenticated>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Authenticated>
              {profile && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="relative h-8 w-8 rounded-full"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src="" alt={profileName ?? ""} />
                        <AvatarFallback>
                          {profileName?.charAt(0).toUpperCase() ?? "?"}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex items-center justify-end">
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium leading-none">
                            {profileName}
                          </p>
                          <p className="text-xs leading-none text-muted-foreground capitalize">
                            {profile.userType}
                          </p>
                        </div>
                        <SignOutButton />
                      </div>
                    </DropdownMenuLabel>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </Authenticated>

            <Unauthenticated>
              <Button asChild>
                <Link to="/dashboard">Sign In</Link>
              </Button>
            </Unauthenticated>
          </div>
        </div>
      </div>
    </nav>
  );
}
