import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getPatientProfile, getPatientVitals, PatientProfile, PatientVitals } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Activity, Heart, Footprints, Scale, Droplets } from "lucide-react";
import { toast } from "sonner";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";

export default function PatientDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [profile, setProfile] = useState<PatientProfile | null>(null);
    const [vitals, setVitals] = useState<PatientVitals | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) {
            fetchData(id);
        }
    }, [id]);

    const fetchData = async (patientId: string) => {
        try {
            const [profileData, vitalsData] = await Promise.all([
                getPatientProfile(patientId),
                getPatientVitals(patientId, "monthly"), // Fetch monthly data for charts
            ]);

            if (!profileData) {
                toast.error("Patient not found");
                navigate("/admin/patients");
                return;
            }

            setProfile(profileData);
            setVitals(vitalsData.vitals);
        } catch (error: any) {
            toast.error(error.message || "Failed to fetch patient data");
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin" />
            </div>
        );
    }

    if (!profile) return null;

    return (
        <div className="container mx-auto py-8 space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={() => navigate("/admin/patients")}>
                    <ArrowLeft className="w-4 h-4" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold">{profile.first_name} {profile.last_name}</h1>
                    <p className="text-muted-foreground">{profile.email}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Patient ID</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-lg font-mono truncate" title={profile.patient_id}>{profile.patient_id}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Date of Birth</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {profile.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString() : "N/A"}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Joined</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {profile.created_at ? new Date(profile.created_at).toLocaleDateString() : "N/A"}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <h2 className="text-2xl font-bold mt-8">Health Vitals</h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Heart Rate */}
                <VitalsCard
                    title="Heart Rate"
                    icon={<Heart className="w-5 h-5 text-red-500" />}
                    data={vitals?.hr || []}
                    dataKey="avg"
                    unit="bpm"
                    color="#ef4444"
                />

                {/* SpO2 */}
                <VitalsCard
                    title="SpO2"
                    icon={<Droplets className="w-5 h-5 text-blue-500" />}
                    data={vitals?.spo2 || []}
                    dataKey="avg"
                    unit="%"
                    color="#3b82f6"
                />

                {/* Steps */}
                <VitalsCard
                    title="Steps"
                    icon={<Footprints className="w-5 h-5 text-green-500" />}
                    data={vitals?.steps || []}
                    dataKey="count"
                    unit="steps"
                    color="#22c55e"
                />

                {/* Blood Pressure - Special case for 2 lines if needed, but standard card supports one. 
            We might need a custom one for BP if we want sys/dia. 
            For now, let's just show Systolic as primary or create a custom chart.
        */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-base font-medium">Blood Pressure</CardTitle>
                        <Activity className="w-5 h-5 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="h-[200px] w-full mt-4">
                            {vitals?.bp && vitals.bp.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={vitals.bp}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis
                                            dataKey="time"
                                            tickFormatter={(value) => new Date(value).toLocaleDateString()}
                                            fontSize={12}
                                        />
                                        <YAxis fontSize={12} domain={[40, 200]} />
                                        <Tooltip
                                            labelFormatter={(value) => new Date(value).toLocaleString()}
                                        />
                                        <Line type="monotone" dataKey="systolic" stroke="#8884d8" name="Systolic" strokeWidth={2} dot={false} />
                                        <Line type="monotone" dataKey="diastolic" stroke="#82ca9d" name="Diastolic" strokeWidth={2} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex items-center justify-center h-full text-muted-foreground">
                                    No blood pressure data available
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Weight */}
                <VitalsCard
                    title="Weight"
                    icon={<Scale className="w-5 h-5 text-orange-500" />}
                    data={vitals?.weight || []}
                    dataKey="kg"
                    unit="kg"
                    color="#f97316"
                />
            </div>
        </div>
    );
}

function VitalsCard({ title, icon, data, dataKey, unit, color }: any) {
    const latest = data.length > 0 ? data[data.length - 1][dataKey] : "N/A";

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-medium">{title}</CardTitle>
                {icon}
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold mb-4">
                    {latest} <span className="text-sm font-normal text-muted-foreground">{unit}</span>
                </div>
                <div className="h-[200px] w-full">
                    {data.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis
                                    dataKey="time"
                                    tickFormatter={(value) => new Date(value).toLocaleDateString()}
                                    fontSize={12}
                                />
                                <YAxis fontSize={12} />
                                <Tooltip
                                    labelFormatter={(value) => new Date(value).toLocaleString()}
                                />
                                <Line
                                    type="monotone"
                                    dataKey={dataKey}
                                    stroke={color}
                                    strokeWidth={2}
                                    dot={false}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                            No data available
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
