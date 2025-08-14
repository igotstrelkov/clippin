import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { Menu } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { SignOutButton } from "./auth/SignOutButton";
import { ThemeToggle } from "./ThemeToggle";

// Logo component with responsive sizing and theme awareness
export function Logo({ className = "" }: { className?: string }) {
  const { resolvedTheme } = useTheme();
  const [logoSrc, setLogoSrc] = useState("/logo-white.png");

  useEffect(() => {
    if (resolvedTheme) {
      setLogoSrc(
        resolvedTheme === "dark" ? "/logo-white.png" : "/logo-black.png"
      );
    }
  }, [resolvedTheme]);

  return (
    <img
      src={logoSrc}
      alt="Clippin"
      className={`h-8 w-auto sm:h-10 ${className}`}
    />
  );
}

// Reusable Profile Menu for both mobile and desktop
function ProfileMenu({
  profile,
  showLogout = true,
}: {
  profile: any;
  showLogout?: boolean;
}) {
  const profileName = profile
    ? profile.userType === "creator"
      ? profile.creatorName
      : profile.companyName
    : "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-10 w-10 rounded-full focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Avatar className="h-10 w-10">
            <AvatarImage src="" alt={profileName ?? ""} />
            <AvatarFallback className="text-sm">
              {profileName?.charAt(0).toUpperCase() ?? "?"}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div
            className={`flex items-center ${showLogout ? "justify-between" : "justify-start"}`}
          >
            <div className="flex flex-col space-y-1">
              {profile.userType !== "admin" && (
                <p className="text-sm font-medium leading-none">
                  {profileName}
                </p>
              )}
              <p className="text-xs leading-none text-muted-foreground capitalize">
                {profile.userType}
              </p>
            </div>
            {showLogout && <SignOutButton />}
          </div>
        </DropdownMenuLabel>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Navigation items component for reuse
function NavigationItems({
  profile,
  currentView,
  onNavigate,
  isMobile = false,
}: {
  profile: any;
  currentView: string;
  onNavigate?: () => void;
  isMobile?: boolean;
}) {
  return (
    <>
      <Authenticated>
        <Button
          variant={currentView === "dashboard" ? "secondary" : "ghost"}
          asChild
          className={`${isMobile ? "w-full justify-start h-12 text-base" : "w-auto justify-center"}`}
          onClick={onNavigate}
        >
          <Link to="/dashboard">Dashboard</Link>
        </Button>
        {profile?.userType === "creator" && (
          <Button
            variant={currentView === "marketplace" ? "secondary" : "ghost"}
            asChild
            className={`${isMobile ? "w-full justify-start h-12 text-base" : "w-auto justify-center"}`}
            onClick={onNavigate}
          >
            <Link to="/marketplace">Marketplace</Link>
          </Button>
        )}
      </Authenticated>
    </>
  );
}

// Mobile Navigation Component
function MobileNavigation({
  profile,
  currentView,
}: {
  profile: any;
  currentView: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Drawer open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex items-center justify-between h-16 px-4">
        {/* Left: Logo */}
        <div className="flex-shrink-0">
          <Logo />
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <ThemeToggle />

          <Unauthenticated>
            <Button asChild size="sm">
              <Link to="/dashboard">Sign In</Link>
            </Button>
          </Unauthenticated>

          {/* Mobile Menu Trigger */}
          <Authenticated>
            <DrawerTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="ml-1 focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Open navigation menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </DrawerTrigger>
          </Authenticated>
        </div>
      </div>

      <DrawerContent className="max-h-[85vh]">
        {/* <DrawerHeader className="text-left">
          <DrawerTitle className="flex items-center gap-3">
            <Logo />
            <span className="text-lg font-semibold">Menu</span>
          </DrawerTitle>
        </DrawerHeader> */}

        <div className="flex flex-col gap-6 px-4 pb-6">
          {/* Navigation section - easily accessible at top */}
          <nav className="flex flex-col gap-3">
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">
              Navigation
            </div>
            <NavigationItems
              profile={profile}
              currentView={currentView}
              onNavigate={() => setIsOpen(false)}
              isMobile={true}
            />
          </nav>

          {/* Profile info section - naturally at bottom for thumb access */}
          <Authenticated>
            {profile && (
              <div className="border-t pt-6">
                <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3">
                  Account
                </div>
                <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 border">
                  <Avatar className="h-12 w-12">
                    <AvatarImage
                      src=""
                      alt={
                        profile.userType === "creator"
                          ? profile.creatorName
                          : profile.companyName
                      }
                    />
                    <AvatarFallback className="text-sm">
                      {(profile.userType === "creator"
                        ? profile.creatorName
                        : profile.companyName
                      )
                        ?.charAt(0)
                        .toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col space-y-1 flex-1">
                    {profile.userType !== "admin" && (
                      <p className="text-sm font-medium leading-none">
                        {profile.userType === "creator"
                          ? profile.creatorName
                          : profile.companyName}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground capitalize">
                      {profile.userType}
                    </p>
                  </div>
                  <div className="">
                    <SignOutButton
                      className="w-full h-12 text-base justify-center ml-0"
                      variant="outline"
                    />
                  </div>
                </div>
              </div>
            )}
          </Authenticated>

          {/* Sign in for unauthenticated users */}
          <Unauthenticated>
            <div className="border-t pt-6">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3">
                Get Started
              </div>
              <Button
                asChild
                className="w-full h-12 text-base"
                onClick={() => setIsOpen(false)}
              >
                <Link to="/dashboard">Sign In</Link>
              </Button>
            </div>
          </Unauthenticated>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

// Desktop Navigation Component
function DesktopNavigation({
  profile,
  currentView,
}: {
  profile: any;
  currentView: string;
}) {
  return (
    <div className="container mx-auto px-6">
      <div className="flex items-center justify-between h-16">
        {/* Left: Logo and Navigation */}
        <div className="flex items-center gap-8">
          <Logo />
          <nav className="flex items-center gap-2">
            <NavigationItems profile={profile} currentView={currentView} />
          </nav>
        </div>

        {/* Right: Theme Toggle and Profile */}
        <div className="flex items-center gap-4">
          <ThemeToggle />

          <Authenticated>
            {profile && <ProfileMenu profile={profile} />}
          </Authenticated>

          <Unauthenticated>
            <Button asChild>
              <Link to="/dashboard">Sign In</Link>
            </Button>
          </Unauthenticated>
        </div>
      </div>
    </div>
  );
}

// Main Navigation Component
export function Navigation() {
  const isMobile = useIsMobile();
  const profile = useQuery(api.profiles.getCurrentProfile);
  const location = useLocation();

  const currentView = location.pathname.startsWith("/dashboard")
    ? "dashboard"
    : "marketplace";

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {isMobile ? (
        <MobileNavigation profile={profile} currentView={currentView} />
      ) : (
        <DesktopNavigation profile={profile} currentView={currentView} />
      )}
    </header>
  );
}
