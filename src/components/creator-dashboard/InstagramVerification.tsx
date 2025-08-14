import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowRight,
  AtSign,
  CheckCircle,
  Copy,
  Info,
  KeyRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { LoadingSpinner } from "../ui/loading-spinner";

function InstagramVerification() {
  const [instagramUsername, setInstagramUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const profile = useQuery(api.profiles.getCurrentProfile);

  const generateCode = useMutation(
    api.profiles.generateInstagramVerificationCode
  );
  const verifyBio = useMutation(api.profiles.verifyInstagramBio);

  // Determine current step from database state
  const getStep = () => {
    if (profile?.instagramVerified) return "success";
    if (profile?.verificationCode) return "bio";
    if (profile?.instagramUsername) return "generate";
    return "username";
  };

  const step = getStep();

  // Show error toast when verification fails
  useEffect(() => {
    if (profile?.verificationError) {
      toast.error(profile.verificationError);
    }
    setIsLoading(false);
  }, [profile?.verificationError]);

  if (step === "success" && profile?.instagramVerified) {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto bg-green-100 dark:bg-green-900/20 rounded-full h-16 w-16 flex items-center justify-center mb-4">
            <CheckCircle className="h-10 w-10 text-green-500" />
          </div>
          <CardTitle className="text-green-500">
            Instagram account verified!
          </CardTitle>
          <CardDescription>@{profile.instagramUsername}</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground">
            Your Instagram account has been successfully verified. You can now
            submit to campaigns.
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Automatically generate code after setting username
    setIsLoading(true);
    try {
      await generateCode({
        instagramUsername:
          profile?.instagramUsername || instagramUsername.trim(),
      });
      toast.success("Verification code generated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to generate code."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateCode = async () => {
    setIsLoading(true);
    try {
      await generateCode({
        instagramUsername:
          profile?.instagramUsername || instagramUsername.trim(),
      });
      toast.success("Verification code generated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to generate code."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyBio = async () => {
    setIsLoading(true);
    try {
      await verifyBio({
        instagramUsername:
          profile?.instagramUsername || instagramUsername.trim(),
      });
      //toast.success(result.message);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Verification failed."
      );
    }
  };

  const renderContent = () => {
    switch (step) {
      case "username":
        return (
          <form
            onSubmit={(e) => void handleUsernameSubmit(e)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="username">Instagram Username</Label>
              <div className="relative">
                <AtSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="username"
                  type="text"
                  value={instagramUsername}
                  onChange={(e) => setInstagramUsername(e.target.value)}
                  placeholder="yourusername"
                  className="pl-9"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Enter your Instagram username without the @ symbol.
              </p>
            </div>
            <Button type="submit" className="w-full">
              Continue <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>
        );

      case "generate":
        return (
          <div className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>
                Ready to verify @
                {profile?.instagramUsername || instagramUsername.trim()}?
              </AlertTitle>
              <AlertDescription>
                We'll generate a unique code for you to add to your Instagram
                bio temporarily.
              </AlertDescription>
            </Alert>
            <Button
              onClick={() => void handleGenerateCode()}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading && <LoadingSpinner size="sm" centered={false} />}
              Generate Code
            </Button>
          </div>
        );

      case "bio":
        return (
          <div className="space-y-4">
            <Alert variant="warning">
              <KeyRound className="h-4 w-4" />
              <AlertTitle>Add this code to your Instagram bio</AlertTitle>
              <AlertDescription>
                <div className="bg-background/50 dark:bg-background/80 rounded-lg p-3 my-3">
                  <div className="flex items-center justify-between">
                    <code className="text-lg font-mono text-foreground tracking-wider">
                      {profile?.verificationCode}
                    </code>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (profile?.verificationCode) {
                          void navigator.clipboard.writeText(
                            profile.verificationCode
                          );
                          toast.success("Code copied to clipboard!");
                        }
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <ol className="list-decimal list-inside space-y-1.5 text-sm">
                  <li>Open Instagram and go to your profile.</li>
                  <li>Tap "Edit profile".</li>
                  <li>Add the code above anywhere in your bio.</li>
                  <li>Save your changes, then return here.</li>
                </ol>
              </AlertDescription>
            </Alert>
            <div className="text-center">
              <a
                href={`https://www.instagram.com/${profile?.instagramUsername}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline"
              >
                Open @{profile?.instagramUsername} on Instagram →
              </a>
            </div>
            <Button
              onClick={() => void handleVerifyBio()}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading && <LoadingSpinner size="sm" centered={false} />}
              Verify Now
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return renderContent();
}

export default InstagramVerification;
