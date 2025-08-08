import { useQuery } from "convex/react";
import { AlertTriangle, FileText, Users, Video } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { SmartMonitoringStats } from "./SmartMonitoringStats";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { LoadingSpinner } from "./ui/loading-spinner";
import { Tabs, TabsContent } from "./ui/tabs";

function AdminStatsCard({
  title,
  value,
  description,
  icon: Icon,
  className = "",
}: {
  title: string;
  value: number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value.toLocaleString()}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function UserTypeBreakdown({ userTypeCounts }: { userTypeCounts: any }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>User Distribution</CardTitle>
        <CardDescription>
          Breakdown of user types in the platform
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span>Creators</span>
            <span className="font-semibold">{userTypeCounts.creators}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Brands</span>
            <span className="font-semibold">{userTypeCounts.brands}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Admins</span>
            <span className="font-semibold">{userTypeCounts.admins}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CampaignStatusBreakdown({
  campaignStatusCounts,
}: {
  campaignStatusCounts: any;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaign Status</CardTitle>
        <CardDescription>Current status of all campaigns</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span>Active</span>
            <span className="font-semibold text-green-600">
              {campaignStatusCounts.active}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Completed</span>
            <span className="font-semibold text-blue-600">
              {campaignStatusCounts.completed}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Draft</span>
            <span className="font-semibold text-yellow-600">
              {campaignStatusCounts.draft}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Paused</span>
            <span className="font-semibold text-gray-600">
              {campaignStatusCounts.paused}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SubmissionStatusBreakdown({
  submissionStatusCounts,
}: {
  submissionStatusCounts: any;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Submission Status</CardTitle>
        <CardDescription>Current status of all submissions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span>Pending</span>
            <span className="font-semibold text-yellow-600">
              {submissionStatusCounts.pending}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Approved</span>
            <span className="font-semibold text-green-600">
              {submissionStatusCounts.approved}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Rejected</span>
            <span className="font-semibold text-red-600">
              {submissionStatusCounts.rejected}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AdminDashboard() {
  const adminStats = useQuery(api.profiles.getAdminStats);

  if (adminStats === undefined) {
    return <LoadingSpinner />;
  }

  if (!adminStats) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Access Denied</AlertTitle>
        <AlertDescription>
          You don't have permission to access the admin dashboard.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          Admin Dashboard
        </h1>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <AdminStatsCard
          title="Total Users"
          value={adminStats.totalUsers}
          description="All registered users"
          icon={Users}
        />
        <AdminStatsCard
          title="Total Campaigns"
          value={adminStats.totalCampaigns}
          description="All created campaigns"
          icon={FileText}
        />
        <AdminStatsCard
          title="Total Submissions"
          value={adminStats.totalSubmissions}
          description="All video submissions"
          icon={Video}
        />
      </div>

      {/* Detailed Breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <UserTypeBreakdown userTypeCounts={adminStats.userTypeCounts} />
        <CampaignStatusBreakdown
          campaignStatusCounts={adminStats.campaignStatusCounts}
        />
        <SubmissionStatusBreakdown
          submissionStatusCounts={adminStats.submissionStatusCounts}
        />
      </div>

      {/* Tabs for different admin sections */}
      <Tabs defaultValue="monitoring">
        {/* <TabsList>
          <TabsTrigger value="monitoring">Smart Monitoring</TabsTrigger>
        </TabsList> */}

        <TabsContent value="monitoring">
          <SmartMonitoringStats />
        </TabsContent>
      </Tabs>
    </div>
  );
}
