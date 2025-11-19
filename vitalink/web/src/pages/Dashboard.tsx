import { Card } from "@/components/ui/card";
import { Activity, Heart, TrendingUp, Footprints } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getPatientSummary } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import VitalsChart from "@/components/dashboard/VitalsChart";
import RecentReadings from "@/components/dashboard/RecentReadings";
import QuickActions from "@/components/dashboard/QuickActions";
import UpcomingReminders from "@/components/dashboard/UpcomingReminders";
import ThemeToggle from "@/components/ThemeToggle";

const Dashboard = () => {
  const patientId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("patientId") || undefined : undefined;
  const { data, isLoading } = useQuery({ queryKey: ["patient-summary", patientId], queryFn: () => getPatientSummary(patientId), refetchOnWindowFocus: false });
  const summary = data?.summary || {};
  const hr = summary.heartRate ?? "--";
  const bpS = summary.bpSystolic ?? "--";
  const bpD = summary.bpDiastolic ?? "--";
  const weight = summary.weightKg ?? "--";
  const stepsToday = summary.stepsToday ?? "--";
  
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Welcome Back, Patient</h1>
          <p className="text-muted-foreground">Here's your health overview for today</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Heart Rate</p>
                {isLoading ? (
                  <Skeleton className="h-6 w-24" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">{hr} {hr !== "--" && "bpm"}</p>
                )}
              </div>
              <div className="p-3 bg-primary/10 rounded-full">
                <Heart className="w-6 h-6 text-primary" />
              </div>
            </div>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Blood Pressure</p>
                {isLoading ? (
                  <Skeleton className="h-6 w-28" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">{bpS}/{bpD}</p>
                )}
              </div>
              <div className="p-3 bg-secondary/10 rounded-full">
                <Activity className="w-6 h-6 text-secondary" />
              </div>
            </div>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Weight</p>
                {isLoading ? (
                  <Skeleton className="h-6 w-24" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">{weight} {weight !== "--" && "kg"}</p>
                )}
              </div>
              <div className="p-3 bg-warning/10 rounded-full">
                <TrendingUp className="w-6 h-6 text-warning" />
              </div>
            </div>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Steps Today</p>
                {isLoading ? (
                  <Skeleton className="h-6 w-24" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">{stepsToday} {stepsToday !== "--" && "steps"}</p>
                )}
              </div>
              <div className="p-3 bg-accent/10 rounded-full">
                <Footprints className="w-6 h-6 text-accent" />
              </div>
            </div>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Charts and Readings */}
          <div className="lg:col-span-2 space-y-6">
            <VitalsChart patientId={patientId} />
            <RecentReadings patientId={patientId} />
          </div>

          {/* Right Column - Actions and Reminders */}
          <div className="space-y-6">
            <QuickActions />
            <UpcomingReminders patientId={patientId} />
          </div>
        </div>
      </div>
      <ThemeToggle />
    </div>
  );
};

export default Dashboard;
