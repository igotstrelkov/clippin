"use client";
import { Button, ButtonProps } from "@/components/ui/button";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { LogOut } from "lucide-react";

export function SignOutButton(props: ButtonProps) {
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Button
      variant="ghost"
      onClick={() => void signOut()}
      className="justify-end ml-7"
      {...props}
    >
      <LogOut />
    </Button>
  );
}
