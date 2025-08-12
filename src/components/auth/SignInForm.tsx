"use client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { toast } from "sonner";
import { Logo } from "../Navigation";
import { LoadingSpinner } from "../ui/loading-spinner";

interface SignInFormProps {
  onSuccess?: () => void;
}

export function SignInForm({ onSuccess }: SignInFormProps) {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="flex flex-col items-center">
      <Logo className="mb-4" />
      <Card className="w-full max-w-md mx-auto">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitting(true);
            const formData = new FormData(e.target as HTMLFormElement);
            formData.set("flow", flow);
            signIn("password", formData)
              .then(() => {
                onSuccess?.();
              })
              .catch((error) => {
                const toastTitle = error.message.includes("Invalid password")
                  ? "Invalid password. Please try again."
                  : flow === "signIn"
                    ? "Could not sign in, did you mean to sign up?"
                    : "Could not sign up, did you mean to sign in?";
                toast.error(toastTitle);
              })
              .finally(() => {
                setSubmitting(false);
              });
          }}
        >
          <CardHeader>
            <CardTitle className="text-2xl">
              {flow === "signIn" ? "Sign In" : "Sign Up"}
            </CardTitle>
            <CardDescription>
              Enter your credentials to access your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                name="email"
                placeholder="example@gmail.com"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                name="password"
                placeholder="********"
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button className="w-full" type="submit" disabled={submitting}>
              {submitting && <LoadingSpinner size="sm" centered={false} />}
              {flow === "signIn" ? "Sign In" : "Sign Up"}
            </Button>
            <div className="text-center text-sm">
              {flow === "signIn"
                ? "Don't have an account?"
                : "Already have an account?"}{" "}
              <Button
                variant="link"
                type="button"
                className="p-0 h-auto font-semibold"
                onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
              >
                {flow === "signIn" ? "Sign Up" : "Sign In"}
              </Button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
