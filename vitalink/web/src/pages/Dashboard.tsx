import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, Heart, TrendingUp, Footprints, Smartphone, Camera, Clock, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getPatientSummary, getPatientVitals, getPatientInfo, serverUrl } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import VitalsChart from "@/components/dashboard/VitalsChart";
import RecentReadings from "@/components/dashboard/RecentReadings";
import QuickActions from "@/components/dashboard/QuickActions";
import UpcomingReminders from "@/components/dashboard/UpcomingReminders";
import ThemeToggle from "@/components/ThemeToggle";
import { supabase } from "@/lib/supabase";
import { formatDistanceToNow } from "date-fns";

const Dashboard = () => {
  const navigate = useNavigate();
  const [patientId, setPatientId] = useState<string | undefined>(
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("patientId") || undefined : undefined
  );
  const [showSyncNotice, setShowSyncNotice] = useState(true);
  useEffect(() => {
    let mounted = true;
    async function init() {
      if (patientId) return;
      const { data } = await supabase.auth.getSession();
      const id = data?.session?.user?.id || undefined;
      if (mounted) setPatientId(id);
    }
    init();
    return () => { mounted = false };
  }, [patientId]);
  const { data, isLoading } = useQuery({ queryKey: ["patient-summary", patientId], queryFn: () => getPatientSummary(patientId), refetchOnWindowFocus: false, enabled: !!patientId });
  const infoQuery = useQuery({ queryKey: ["patient-info", patientId], queryFn: () => getPatientInfo(patientId), refetchOnWindowFocus: false, enabled: !!patientId });

  useEffect(() => {
    async function syncIfDefault() {
      if (!patientId) return
      const pr = infoQuery.data?.patient
      const isDefault = !pr || (pr.first_name === "User" && pr.last_name === "Patient")
      if (!isDefault) return
      const { data } = await supabase.auth.getSession()
      const meta: any = data?.session?.user?.user_metadata || {}
      const firstName = meta.firstName
      const lastName = meta.lastName
      const dateOfBirth = meta.dateOfBirth
      if (!firstName && !lastName && !dateOfBirth) return
      try {
        await fetch(`${serverUrl()}/admin/ensure-patient`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ patientId, firstName, lastName, dateOfBirth }) })
        infoQuery.refetch()
      } catch (_) {}
    }
    syncIfDefault()
  }, [patientId, infoQuery.data])
  const vitalsQuery = useQuery({ queryKey: ["patient-vitals", patientId, "weekly"], queryFn: () => getPatientVitals(patientId, "weekly"), refetchOnWindowFocus: false, enabled: !!patientId });
  const summary = data?.summary || {};
  const hr = summary.heartRate ?? "--";
  const bpS = summary.bpSystolic ?? "--";
  const bpD = summary.bpDiastolic ?? "--";
  const weight = summary.weightKg ?? "--";
  const stepsToday = summary.stepsToday ?? "--";
  const distanceToday = summary.distanceToday ?? "--";
  const vitals = vitalsQuery.data?.vitals || {};
  const latestTime = (arr?: Array<{ time: string }>) => {
    const t = arr && arr.length ? arr[arr.length - 1]?.time : undefined;
    const dt = t ? new Date(t) : undefined;
    return dt && !Number.isNaN(dt.getTime()) ? dt : undefined;
  };
  const lastHr = latestTime(vitals.hr as any);
  const lastBp = latestTime(vitals.bp as any);
  const lastWeight = latestTime(vitals.weight as any);
  const lastSteps = latestTime(vitals.steps as any);
  const lastAny = [lastHr, lastBp, lastWeight, lastSteps].filter(Boolean).sort((a: any, b: any) => (b as Date).getTime() - (a as Date).getTime())[0] as Date | undefined;
  
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Welcome Back, {infoQuery.data?.patient?.first_name || "Patient"}</h1>
          <p className="text-muted-foreground">Here's your health overview for today</p>
        </div>

        {showSyncNotice && (
          <Alert className="mb-6 border-primary/50 bg-primary/5">
            <Smartphone className="h-4 w-4 text-primary" />
            <AlertDescription className="flex items-center justify-between">
              <span>
                <strong>Sync Required:</strong> Last synced {lastAny ? formatDistanceToNow(lastAny, { addSuffix: true }) : "unknown"}. Open the MyHFGuard app to synch your latest data.
              </span>
              <Button variant="ghost" size="sm" onClick={() => setShowSyncNotice(false)} className="ml-4">
                Dismiss
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-10 gap-4 mb-8">
          <div className="md:col-span-7 mb-0">
            <UpcomingReminders patientId={patientId} />
          </div>
          <div className="md:col-span-3 flex flex-col gap-4">
            <Button size="lg" className="w-full h-20 text-lg gap-3" onClick={() => navigate(patientId ? `/self-check?patientId=${encodeURIComponent(patientId)}` : "/self-check")}>
              <Plus className="w-6 h-6" />
              Collect Data
            </Button>
            <Button size="lg" className="w-full h-20 text-lg gap-3" variant="secondary" onClick={() => navigate(patientId ? `/self-check?patientId=${encodeURIComponent(patientId)}` : "/self-check")}>
              <Camera className="w-6 h-6" />
              Capture Blood Pressure
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Heart Rate</p>
                {isLoading ? (
                  <Skeleton className="h-6 w-24" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">{hr} {hr !== "--" && "bpm"}</p>
                )}
                <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>Last: {lastHr ? formatDistanceToNow(lastHr, { addSuffix: true }) : "--"}</span>
                </div>
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
                <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>Last: {lastBp ? formatDistanceToNow(lastBp, { addSuffix: true }) : "--"}</span>
                </div>
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
                <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>Last: {lastWeight ? formatDistanceToNow(lastWeight, { addSuffix: true }) : "--"}</span>
                </div>
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
                <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>Last: {lastSteps ? formatDistanceToNow(lastSteps, { addSuffix: true }) : "--"}</span>
                </div>
              </div>
              <div className="p-3 bg-accent/10 rounded-full">
                <Footprints className="w-6 h-6 text-accent" />
              </div>
            </div>
          </Card>

          <Card className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Distance Walked Today</p>
                {isLoading ? (
                  <Skeleton className="h-6 w-24" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">{distanceToday} {distanceToday !== "--" && "m"}</p>
                )}
              </div>
              <div className="p-3 bg-secondary/10 rounded-full">
                <Activity className="w-6 h-6 text-secondary" />
              </div>
            </div>
          </Card>
        </div>

        {/* Vital Trends - Full Width */}
        <div className="mb-8">
          <VitalsChart patientId={patientId} />
        </div>
      </div>
      <ThemeToggle />
    </div>
  );
};

export default Dashboard;
