import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getPatientProfile, PatientProfile } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ArrowLeft, RefreshCw, Calendar as CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@supabase/supabase-js";
import { format, subMonths, subYears, startOfDay, endOfDay, eachDayOfInterval } from "date-fns";
import { DateScrollPicker } from "@/components/ui/date-scroll-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

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

    // Date Range State - Default to last 30 days
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: subMonths(new Date(), 1),
        to: new Date(),
    });

    useEffect(() => {
        console.log("useEffect triggered - dateRange changed:", dateRange);
        if (id && dateRange?.from && dateRange?.to) {
            fetchData(id, dateRange.from, dateRange.to);
        }
    }, [id, dateRange?.from?.getTime(), dateRange?.to?.getTime()]);

    const fetchData = async (patientId: string, startDate: Date, endDate: Date) => {
        setLoading(true);
        try {
            // 1. Fetch Profile
            if (!profile) {
                const profileData = await getPatientProfile(patientId);
                if (!profileData) {
                    toast.error("Patient not found");
                    return;
                }
                setProfile(profileData);
            }

            // Format dates for Supabase (YYYY-MM-DD)
            const startStr = format(startOfDay(startDate), 'yyyy-MM-dd');
            const endStr = format(endOfDay(endDate), 'yyyy-MM-dd');

            console.log("Fetching data for range:", startStr, "to", endStr);

            // 2. FETCH DATA WITH DATE FILTER
            const { data: hrData, error: hrError } = await supabase
                .from('hr_day')
                .select('*')
                .eq('patient_id', patientId)
                .gte('date', startStr)
                .lte('date', endStr)
                .order('date', { ascending: false });

            const { data: spo2Data, error: spo2Error } = await supabase
                .from('spo2_day')
                .select('*')
                .eq('patient_id', patientId)
                .gte('date', startStr)
                .lte('date', endStr)
                .order('date', { ascending: false });

            const { data: stepsData, error: stepsError } = await supabase
                .from('steps_day')
                .select('*')
                .eq('patient_id', patientId)
                .gte('date', startStr)
                .lte('date', endStr)
                .order('date', { ascending: false });

            const { data: bpData, error: bpError } = await supabase
                .from('bp_readings')
                .select('*')
                .eq('patient_id', patientId)
                .gte('reading_date', startStr)
                .lte('reading_date', endStr)
                .order('reading_date', { ascending: false })
                .order('reading_time', { ascending: false });

            if (hrError) console.error("HR Error:", hrError);
            if (spo2Error) console.error("SpO2 Error:", spo2Error);
            if (stepsError) console.error("Steps Error:", stepsError);
            if (bpError) console.error("BP Error:", bpError);

            // Helper function to fill missing dates
            const fillMissingDates = (data: any[], dateField: string) => {
                // Create a map of existing data by date
                const dataMap = new Map();
                data.forEach(item => {
                    dataMap.set(item[dateField], item);
                });

                // Generate all dates in the range
                const allDates = eachDayOfInterval({ start: startDate, end: endDate });

                // Fill in missing dates with null values
                return allDates.map(date => {
                    const dateStr = format(date, 'yyyy-MM-dd');
                    return dataMap.get(dateStr) || { [dateField]: dateStr };
                });
            };

            // Transform data
            const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            // Fill missing dates for daily vitals
            const hrDataFilled = fillMissingDates(hrData || [], 'date');
            const spo2DataFilled = fillMissingDates(spo2Data || [], 'date');
            const stepsDataFilled = fillMissingDates(stepsData || [], 'date');

            const newVitals = {
                hr: hrDataFilled.map(r => ({
                    fullDate: r.date,
                    date: formatDate(r.date),
                    min: r.hr_min || null,
                    avg: r.hr_avg || null,
                    max: r.hr_max || null,
                })),

                spo2: spo2DataFilled.map(r => ({
                    fullDate: r.date,
                    date: formatDate(r.date),
                    min: r.spo2_min || null,
                    avg: r.spo2_avg || null,
                    max: r.spo2_max || null
                })),

                steps: stepsDataFilled.map(r => ({
                    fullDate: r.date,
                    date: formatDate(r.date),
                    count: r.steps_total || null
                })),

                // BP readings are event-based, but we want to show the full timeline
                bp: (() => {
                    // 1. Group existing BP data by date
                    const bpByDate = new Map<string, any[]>();
                    (bpData || []).forEach(r => {
                        const d = r.reading_date;
                        if (!bpByDate.has(d)) bpByDate.set(d, []);
                        bpByDate.get(d)?.push(r);
                    });

                    // 2. Generate full date range
                    const allDates = eachDayOfInterval({ start: startDate, end: endDate });

                    // 3. Flatten into a list for the chart
                    const bpDataFilled: any[] = [];

                    allDates.forEach(dateObj => {
                        const dateStr = format(dateObj, 'yyyy-MM-dd');
                        const readings = bpByDate.get(dateStr);

                        if (readings && readings.length > 0) {
                            // Sort readings by time ascending
                            const sortedReadings = [...readings].sort((a, b) => a.reading_time.localeCompare(b.reading_time));

                            sortedReadings.forEach(r => {
                                bpDataFilled.push({
                                    fullDate: r.reading_date,
                                    time: `${formatDate(r.reading_date)} ${r.reading_time.substring(0, 5)}`,
                                    systolic: r.systolic,
                                    diastolic: r.diastolic,
                                    pulse: r.pulse
                                });
                            });
                        } else {
                            // No readings for this day -> Add a placeholder
                            bpDataFilled.push({
                                fullDate: dateStr,
                                time: formatDate(dateStr), // Just the date label
                                systolic: null,
                                diastolic: null,
                                pulse: null
                            });
                        }
                    });
                    return bpDataFilled;
                })()
            };

            setVitals(newVitals);

        } catch (error: any) {
            console.error("Fetch error:", error);
            toast.error("Failed to fetch data");
        } finally {
            setLoading(false);
        }
    };

    // Preset Handlers
    const setPreset = (months: number) => {
        console.log(`Setting preset: ${months} months`);
        const to = new Date();
        const from = subMonths(to, months);
        setDateRange({ from, to });
    };

    const setYearPreset = (years: number) => {
        console.log(`Setting preset: ${years} years`);
        const to = new Date();
        const from = subYears(to, years);
        setDateRange({ from, to });
    };

    if (loading && !profile) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;
    if (!profile && !loading) return null;

    return (
        <div className="container mx-auto py-8 space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={() => navigate("/admin/patients")}>
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold">{profile?.first_name} {profile?.last_name}</h1>
                        <p className="text-muted-foreground">ID: {profile?.patient_id}</p>
                    </div>
                </div>
                <Button onClick={() => id && dateRange?.from && dateRange?.to && fetchData(id, dateRange.from, dateRange.to)} variant="outline">
                    <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                </Button>
            </div>

            {/* --- FILTER BAR --- */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-muted/30 p-4 rounded-lg border">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Quick Range:</span>
                    <Button variant="outline" size="sm" onClick={() => setPreset(1)}>1M</Button>
                    <Button variant="outline" size="sm" onClick={() => setPreset(3)}>3M</Button>
                    <Button variant="outline" size="sm" onClick={() => setPreset(6)}>6M</Button>
                    <Button variant="outline" size="sm" onClick={() => setYearPreset(1)}>1Y</Button>
                    <Button variant="outline" size="sm" onClick={() => setYearPreset(3)}>3Y</Button>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Custom Range:</span>

                    {/* Start Date Picker */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant={"outline"}
                                className={cn(
                                    "w-[140px] justify-start text-left font-normal",
                                    !dateRange?.from && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateRange?.from ? format(dateRange.from, "MMM dd, yyyy") : <span>Start Date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <DateScrollPicker
                                date={dateRange?.from}
                                setDate={(date) => setDateRange(prev => ({ ...prev, from: date, to: prev?.to }))}
                            />
                        </PopoverContent>
                    </Popover>

                    <span className="text-muted-foreground">-</span>

                    {/* End Date Picker */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant={"outline"}
                                className={cn(
                                    "w-[140px] justify-start text-left font-normal",
                                    !dateRange?.to && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateRange?.to ? format(dateRange.to, "MMM dd, yyyy") : <span>End Date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <DateScrollPicker
                                date={dateRange?.to}
                                setDate={(date) => setDateRange(prev => ({ ...prev, from: prev?.from, to: date }))}
                            />
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            <h2 className="text-2xl font-bold">
                Overview
                {dateRange?.from && dateRange?.to && (
                    <span className="text-muted-foreground font-normal text-lg ml-2">
                        ({format(dateRange.from, "MMM d, yyyy")} - {format(dateRange.to, "MMM d, yyyy")})
                    </span>
                )}
            </h2>

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
                                        contentStyle={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                                        labelStyle={{ color: '#1e293b', fontWeight: 'bold', marginBottom: '4px' }}
                                        cursor={{ fill: '#f4f4f5' }}
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
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                                        labelStyle={{ color: '#1e293b', fontWeight: 'bold', marginBottom: '4px' }}
                                    />
                                    <Legend />
                                    <Line type="monotone" dataKey="max" stroke="#ef4444" strokeWidth={2} dot={false} name="Max" connectNulls />
                                    <Line type="monotone" dataKey="avg" stroke="#f97316" strokeWidth={2} dot={false} name="Avg" connectNulls />
                                    <Line type="monotone" dataKey="min" stroke="#22c55e" strokeWidth={2} dot={false} name="Min" connectNulls />
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
                        {vitals.bp.length === 0 ? (
                            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                                No data available for this period
                            </div>
                        ) : (
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={vitals.bp}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="time" fontSize={10} tickLine={false} axisLine={false} angle={-15} textAnchor="end" height={50} />
                                        <YAxis domain={[40, 200]} fontSize={12} tickLine={false} axisLine={false} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                                            labelStyle={{ color: '#1e293b', fontWeight: 'bold', marginBottom: '4px' }}
                                        />
                                        <Legend verticalAlign="top" />
                                        <ReferenceLine y={120} label="Sys Limit" stroke="red" strokeDasharray="3 3" />
                                        <ReferenceLine y={80} label="Dia Limit" stroke="gray" strokeDasharray="3 3" />
                                        <Line type="monotone" dataKey="systolic" stroke="#8884d8" strokeWidth={3} name="Systolic" />
                                        <Line type="monotone" dataKey="diastolic" stroke="#82ca9d" strokeWidth={3} name="Diastolic" />
                                        <Line type="monotone" dataKey="pulse" stroke="#ffc658" strokeWidth={3} name="Pulse" />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        )}
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
                                    <Tooltip
                                        contentStyle={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                                        labelStyle={{ color: '#1e293b', fontWeight: 'bold', marginBottom: '4px' }}
                                    />
                                    <Line type="monotone" dataKey="avg" stroke="#06b6d4" strokeWidth={3} activeDot={{ r: 8 }} name="Avg %" connectNulls />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* --- RAW DATA TABLES BELOW --- */}
            <h3 className="text-xl font-bold mt-12">Raw Data Logs</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="max-h-[300px] overflow-auto">
                    <CardHeader><CardTitle>Steps Log</CardTitle></CardHeader>
                    <CardContent>
                        {vitals.steps.filter((r: any) => r.count !== null).length === 0 ? (
                            <p className="text-muted-foreground text-center py-4">No data</p>
                        ) : (
                            <Table>
                                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Count</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {[...vitals.steps].filter((r: any) => r.count !== null).reverse().map((r: any, i: number) => (
                                        <TableRow key={i}><TableCell>{r.fullDate}</TableCell><TableCell>{r.count}</TableCell></TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>

                <Card className="max-h-[300px] overflow-auto">
                    <CardHeader><CardTitle>BP Log</CardTitle></CardHeader>
                    <CardContent>
                        {vitals.bp.length === 0 ? (
                            <p className="text-muted-foreground text-center py-4">No data</p>
                        ) : (
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
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}