import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getPatientProfile, PatientProfile } from "@/lib/api"; 
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ArrowLeft, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@supabase/supabase-js";
// Import Recharts
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine 
} from 'recharts';

// --- SETUP SUPABASE DIRECTLY ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function PatientDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [profile, setProfile] = useState<PatientProfile | null>(null);
    
    const [vitals, setVitals] = useState<any>({ hr: [], spo2: [], steps: [], bp: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) {
            fetchData(id);
        }
    }, [id]);

    const fetchData = async (patientId: string) => {
        setLoading(true);
        try {
            // 1. Fetch Profile
            const profileData = await getPatientProfile(patientId);
            if (!profileData) {
                toast.error("Patient not found");
                return;
            }
            setProfile(profileData);

            // 2. FETCH LAST 30 DAYS (MONTHLY VIEW)
            
            // Heart Rate
            const { data: hrData } = await supabase
                .from('hr_day')
                .select('*')
                .eq('patient_id', patientId)
                .order('date', { ascending: false }) // Get newest first from DB
                .limit(30);

            // SpO2
            const { data: spo2Data } = await supabase
                .from('spo2_day')
                .select('*')
                .eq('patient_id', patientId)
                .order('date', { ascending: false })
                .limit(30);

            // Steps
            const { data: stepsData } = await supabase
                .from('steps_day')
                .select('*')
                .eq('patient_id', patientId)
                .order('date', { ascending: false })
                .limit(30);

            // BP Readings
            const { data: bpData } = await supabase
                .from('bp_readings')
                .select('*')
                .eq('patient_id', patientId)
                .order('reading_date', { ascending: false })
                .order('reading_time', { ascending: false })
                .limit(30);

            // Transform & Reverse for Charts (Charts need Oldest -> Newest)
            // formatting date to "MM-DD" for cleaner X-Axis
            const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            const newVitals = {
                hr: (hrData || []).map(r => ({
                    fullDate: r.date,
                    date: formatDate(r.date),
                    min: r.hr_min,
                    avg: r.hr_avg,
                    max: r.hr_max,
                })).reverse(), // Reverse so chart goes left-to-right

                spo2: (spo2Data || []).map(r => ({
                    fullDate: r.date,
                    date: formatDate(r.date),
                    min: r.spo2_min,
                    avg: r.spo2_avg,
                    max: r.spo2_max
                })).reverse(),

                steps: (stepsData || []).map(r => ({
                    fullDate: r.date,
                    date: formatDate(r.date),
                    count: r.steps_total
                })).reverse(),

                bp: (bpData || []).map(r => ({
                    fullDate: r.reading_date,
                    time: `${formatDate(r.reading_date)} ${r.reading_time.substring(0,5)}`,
                    systolic: r.systolic,
                    diastolic: r.diastolic,
                    pulse: r.pulse
                })).reverse()
            };

            setVitals(newVitals);

        } catch (error: any) {
            console.error("Fetch error:", error);
            toast.error("Failed to fetch data");
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;
    if (!profile) return null;

    return (
        <div className="container mx-auto py-8 space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={() => navigate("/admin/patients")}>
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold">{profile.first_name} {profile.last_name}</h1>
                        <p className="text-muted-foreground">ID: {profile.patient_id}</p>
                    </div>
                </div>
                <Button onClick={() => fetchData(id!)} variant="outline">
                    <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                </Button>
            </div>

            <h2 className="text-2xl font-bold">Monthly Overview (Last 30 Days)</h2>

            {/* --- CHARTS SECTION --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* 1. Steps Chart */}
                <Card>
                    <CardHeader>
                        <CardTitle>Daily Steps</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={vitals.steps}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: 'white', borderRadius: '8px' }}
                                        cursor={{fill: '#f4f4f5'}}
                                    />
                                    <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Steps" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* 2. Heart Rate Chart */}
                <Card>
                    <CardHeader>
                        <CardTitle>Heart Rate (BPM)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={vitals.hr}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis domain={[40, 180]} fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip contentStyle={{ backgroundColor: 'white', borderRadius: '8px' }} />
                                    <Legend />
                                    <Line type="monotone" dataKey="max" stroke="#ef4444" strokeWidth={2} dot={false} name="Max" />
                                    <Line type="monotone" dataKey="avg" stroke="#f97316" strokeWidth={2} dot={false} name="Avg" />
                                    <Line type="monotone" dataKey="min" stroke="#22c55e" strokeWidth={2} dot={false} name="Min" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* 3. Blood Pressure Chart */}
                <Card>
                    <CardHeader>
                        <CardTitle>Blood Pressure</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={vitals.bp}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="time" fontSize={10} tickLine={false} axisLine={false} angle={-15} textAnchor="end" height={50} />
                                    <YAxis domain={[40, 200]} fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip contentStyle={{ backgroundColor: 'white', borderRadius: '8px' }} />
                                    <Legend verticalAlign="top"/>
                                    <ReferenceLine y={120} label="Sys Limit" stroke="red" strokeDasharray="3 3" />
                                    <ReferenceLine y={80} label="Dia Limit" stroke="gray" strokeDasharray="3 3" />
                                    <Line type="monotone" dataKey="systolic" stroke="#8884d8" strokeWidth={3} name="Systolic" />
                                    <Line type="monotone" dataKey="diastolic" stroke="#82ca9d" strokeWidth={3} name="Diastolic" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* 4. SpO2 Chart */}
                <Card>
                    <CardHeader>
                        <CardTitle>SpO2 (%)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={vitals.spo2}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis domain={[80, 100]} fontSize={12} tickLine={false} axisLine={false} />
                                    <Tooltip contentStyle={{ backgroundColor: 'white', borderRadius: '8px' }} />
                                    <Line type="monotone" dataKey="avg" stroke="#06b6d4" strokeWidth={3} activeDot={{ r: 8 }} name="Avg %" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* --- RAW DATA TABLES BELOW --- */}
            <h3 className="text-xl font-bold mt-12">Raw Data Logs</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {/* Reusing your table logic here, but listing newest first again */}
                 <Card className="max-h-[300px] overflow-auto">
                    <CardHeader><CardTitle>Steps Log</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Count</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {[...vitals.steps].reverse().map((r: any, i: number) => (
                                    <TableRow key={i}><TableCell>{r.fullDate}</TableCell><TableCell>{r.count}</TableCell></TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                 </Card>

                 <Card className="max-h-[300px] overflow-auto">
                    <CardHeader><CardTitle>BP Log</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Sys/Dia</TableHead><TableHead>Pulse</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {[...vitals.bp].reverse().map((r: any, i: number) => (
                                    <TableRow key={i}>
                                        <TableCell>{r.time}</TableCell>
                                        <TableCell>{r.systolic}/{r.diastolic}</TableCell>
                                        <TableCell>{r.pulse}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                 </Card>
            </div>
        </div>
    );
}