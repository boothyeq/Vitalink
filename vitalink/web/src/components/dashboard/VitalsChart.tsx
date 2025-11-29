import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, ComposedChart, Cell } from "recharts"
import { Activity, Droplet, Weight, TrendingUp, Heart, ChevronLeft, ChevronRight } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { getPatientVitals } from "@/lib/api"
import { formatTimeHM } from "@/lib/utils"
import { format as formatDate, differenceInCalendarWeeks, differenceInCalendarMonths, isYesterday, startOfWeek, startOfDay, endOfDay, addDays, addWeeks, addMonths } from "date-fns"

type Props = { patientId?: string }

const VitalsChart = ({ patientId }: Props) => {
  const [activeTab, setActiveTab] = useState("heartRate")
  const [timePeriod, setTimePeriod] = useState<"daily" | "weekly" | "monthly">("daily")
  const [currentPeriod, setCurrentPeriod] = useState(new Date())
  const period = timePeriod === "weekly" ? "weekly" : (timePeriod === "monthly" ? "monthly" : "hourly")
  const { data, isLoading } = useQuery({
    queryKey: ["patient-vitals", patientId, period, formatDate(currentPeriod, "yyyy-MM-dd"), (0 - new Date().getTimezoneOffset())],
    queryFn: () => getPatientVitals(
      patientId,
      period,
      timePeriod === "daily" ? formatDate(currentPeriod, "yyyy-MM-dd") : undefined,
      timePeriod === "daily" ? (0 - new Date().getTimezoneOffset()) : undefined,
    ),
    refetchOnWindowFocus: false,
    enabled: !!patientId,
  })
  const vitals = data?.vitals || {}
  const toDayKey = (t: string) => {
    const d = new Date(t)
    return isNaN(d.getTime()) ? String(t) : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  }
  const hrSrc = (vitals.hr || [])
  const spo2Src = (vitals.spo2 || [])
  const stepsSrc = (vitals.steps || [])
  const hr = period !== "hourly"
    ? Object.entries(hrSrc.reduce((acc: Record<string, { min: number[]; avg: number[]; max: number[] }>, r: any) => {
        const k = toDayKey(r.time)
        const o = acc[k] || { min: [], avg: [], max: [] }
        if (typeof r.min === "number") o.min.push(r.min)
        if (typeof r.avg === "number") o.avg.push(r.avg)
        if (typeof r.max === "number") o.max.push(r.max)
        acc[k] = o
        return acc
      }, {})).map(([k, v]) => ({ time: k, min: v.min.length ? Math.min(...v.min) : undefined, avg: v.avg.length ? Math.round(v.avg.reduce((a, b) => a + b, 0) / v.avg.length) : undefined, max: v.max.length ? Math.max(...v.max) : undefined }))
        .sort((a, b) => new Date(a.time as any).getTime() - new Date(b.time as any).getTime())
    : hrSrc
  const spo2 = period !== "hourly"
    ? Object.entries(spo2Src.reduce((acc: Record<string, { min: number[]; avg: number[]; max: number[] }>, r: any) => {
        const k = toDayKey(r.time)
        const o = acc[k] || { min: [], avg: [], max: [] }
        if (typeof r.min === "number") o.min.push(r.min)
        if (typeof r.avg === "number") o.avg.push(r.avg)
        if (typeof r.max === "number") o.max.push(r.max)
        acc[k] = o
        return acc
      }, {})).map(([k, v]) => ({ time: k, min: v.min.length ? Math.min(...v.min) : undefined, avg: v.avg.length ? Math.round(v.avg.reduce((a, b) => a + b, 0) / v.avg.length) : undefined, max: v.max.length ? Math.max(...v.max) : undefined }))
        .sort((a, b) => new Date(a.time as any).getTime() - new Date(b.time as any).getTime())
    : spo2Src
  const hrWeeklyPadded = timePeriod === "weekly"
    ? (() => {
        const baseArr = hr.length ? hr : hrSrc
        const monday = startOfWeek(currentPeriod, { weekStartsOn: 1 })
        const byKey = new Map<string, { min?: number; avg?: number; max?: number }>(baseArr.map((d: any) => [String(d.time), { min: d.min, avg: d.avg, max: d.max }]))
        const out: Array<{ time: string; min?: number; avg?: number; max?: number }> = []
        for (let i = 0; i < 7; i++) {
          const d = new Date(monday)
          d.setDate(monday.getDate() + i)
          const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
          const v = byKey.get(k) || {}
          out.push({ time: k, min: v.min, avg: v.avg, max: v.max })
        }
        return out
      })()
    : hr
  const spo2WeeklyPadded = timePeriod === "weekly"
    ? (() => {
        const baseArr = spo2.length ? spo2 : spo2Src
        const monday = startOfWeek(currentPeriod, { weekStartsOn: 1 })
        const byKey = new Map<string, { min?: number; avg?: number; max?: number }>(baseArr.map((d: any) => [String(d.time), { min: d.min, avg: d.avg, max: d.max }]))
        const out: Array<{ time: string; min?: number; avg?: number; max?: number }> = []
        for (let i = 0; i < 7; i++) {
          const d = new Date(monday)
          d.setDate(monday.getDate() + i)
          const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
          const v = byKey.get(k) || {}
          out.push({ time: k, min: v.min, avg: v.avg, max: v.max })
        }
        return out
      })()
    : spo2
  const hrMonthlyPadded = timePeriod === "monthly"
    ? (() => {
        const baseArr = hr.length ? hr : hrSrc
        const y = currentPeriod.getFullYear(); const m = currentPeriod.getMonth()
        const lastDay = new Date(y, m + 1, 0).getDate()
        const byKey = new Map<string, { min?: number; avg?: number; max?: number }>(baseArr.map((d: any) => [String(d.time), { min: d.min, avg: d.avg, max: d.max }]))
        const out: Array<{ time: string; min?: number; avg?: number; max?: number }> = []
        for (let day = 1; day <= lastDay; day++) {
          const d = new Date(y, m, day)
          const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
          const v = byKey.get(k) || {}
          out.push({ time: k, min: v.min, avg: v.avg, max: v.max })
        }
        return out
      })()
    : hr
  const spo2MonthlyPadded = timePeriod === "monthly"
    ? (() => {
        const baseArr = spo2.length ? spo2 : spo2Src
        const y = currentPeriod.getFullYear(); const m = currentPeriod.getMonth()
        const lastDay = new Date(y, m + 1, 0).getDate()
        const byKey = new Map<string, { min?: number; avg?: number; max?: number }>(baseArr.map((d: any) => [String(d.time), { min: d.min, avg: d.avg, max: d.max }]))
        const out: Array<{ time: string; min?: number; avg?: number; max?: number }> = []
        for (let day = 1; day <= lastDay; day++) {
          const d = new Date(y, m, day)
          const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
          const v = byKey.get(k) || {}
          out.push({ time: k, min: v.min, avg: v.avg, max: v.max })
        }
        return out
      })()
    : spo2
  const stepsDayAgg = timePeriod === "weekly" || timePeriod === "monthly"
    ? Object.entries(stepsSrc.reduce((acc: Record<string, number>, r: any) => {
        const k = toDayKey(r.time)
        acc[k] = (acc[k] || 0) + (typeof r.count === "number" ? r.count : 0)
        return acc
      }, {})).map(([k, v]) => ({ time: k, count: v })).sort((a, b) => new Date(a.time as any).getTime() - new Date(b.time as any).getTime())
      : stepsSrc
  const stepsWeeklyPadded = timePeriod === "weekly"
    ? (() => {
        const monday = startOfWeek(currentPeriod, { weekStartsOn: 1 })
        const byKey = new Map<string, number>(stepsDayAgg.map((d: any) => [String(d.time), d.count]))
        const out: Array<{ time: string; count?: number }> = []
        for (let i = 0; i < 7; i++) {
          const d = new Date(monday)
          d.setDate(monday.getDate() + i)
          const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
          out.push({ time: k, count: byKey.has(k) ? byKey.get(k) : undefined })
        }
        return out
      })()
    : stepsSrc
  const stepsMonthlyPadded = timePeriod === "monthly"
    ? (() => {
        const y = currentPeriod.getFullYear(); const m = currentPeriod.getMonth()
        const first = new Date(y, m, 1)
        const last = new Date(y, m + 1, 0)
        const byKey = new Map<string, number>(stepsDayAgg.map((d: any) => [String(d.time), d.count]))
        const out: Array<{ time: string; count?: number }> = []
        for (let day = 1; day <= last.getDate(); day++) {
          const d = new Date(y, m, day)
          const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
          out.push({ time: k, count: byKey.has(k) ? byKey.get(k) : undefined })
        }
        return out
      })()
    : stepsSrc
  const hrForMerge = timePeriod === "weekly" ? hrWeeklyPadded : (timePeriod === "monthly" ? hrMonthlyPadded : hr)
  const spo2ForMerge = timePeriod === "weekly" ? spo2WeeklyPadded : (timePeriod === "monthly" ? spo2MonthlyPadded : spo2)
  const merged = (hrForMerge.length || spo2ForMerge.length)
    ? (hrForMerge.length >= spo2ForMerge.length
        ? hrForMerge.map((h, i) => ({
            date: h.time,
            heartRate: h.avg,
            heartRateMin: h.min,
            heartRateMax: h.max,
            restingHeartRate: (h as any).resting,
            spo2: spo2ForMerge[i]?.avg,
            spo2Min: spo2ForMerge[i]?.min,
            spo2Max: spo2ForMerge[i]?.max,
          }))
        : spo2ForMerge.map((o, i) => ({
            date: o.time,
            heartRate: hrForMerge[i]?.avg,
            heartRateMin: hrForMerge[i]?.min,
            heartRateMax: hrForMerge[i]?.max,
            restingHeartRate: (hrForMerge[i] as any)?.resting,
            spo2: o.avg,
            spo2Min: o.min,
            spo2Max: o.max,
          })))
    : []

  const getDateRangeLabel = () => {
    const now = new Date()
    if (timePeriod === "daily") {
      if (isYesterday(currentPeriod)) return "Yesterday"
      return formatDate(currentPeriod, "PPPP")
    }
    if (timePeriod === "weekly") {
      const start = startOfWeek(currentPeriod, { weekStartsOn: 1 })
      const end = new Date(start)
      end.setDate(start.getDate() + 6)
      if (differenceInCalendarWeeks(now, end) === 1) return "Last week"
      return `${formatDate(start, "PP")} - ${formatDate(end, "PP")}`
    }
    const y = currentPeriod.getFullYear(); const m = currentPeriod.getMonth()
    const end = new Date(y, m + 1, 0)
    if (differenceInCalendarMonths(now, end) === 1) return "Last month"
    return formatDate(end, "LLLL yyyy")
  }

  const handlePrevious = () => {
    if (timePeriod === "daily") setCurrentPeriod(addDays(currentPeriod, -1))
    else if (timePeriod === "weekly") setCurrentPeriod(addWeeks(currentPeriod, -1))
    else setCurrentPeriod(addMonths(currentPeriod, -1))
  }

  const handleNext = () => {
    if (timePeriod === "daily") setCurrentPeriod(addDays(currentPeriod, 1))
    else if (timePeriod === "weekly") setCurrentPeriod(addWeeks(currentPeriod, 1))
    else setCurrentPeriod(addMonths(currentPeriod, 1))
  }

  function calculateStats(key: keyof typeof merged[number]) {
    const dates = merged
      .map((d) => new Date(d.date as any))
      .filter((dt) => !Number.isNaN(dt.getTime()))
      .sort((a, b) => a.getTime() - b.getTime())
    if (!dates.length) return { min: undefined, max: undefined, avg: undefined }
    let start = startOfDay(currentPeriod)
    let end = endOfDay(start)
    if (timePeriod === "weekly") {
      start = startOfWeek(currentPeriod, { weekStartsOn: 1 })
      end = new Date(start)
      end.setDate(start.getDate() + 6)
    } else if (timePeriod === "monthly") {
      const y = currentPeriod.getFullYear(); const m = currentPeriod.getMonth()
      start = new Date(y, m, 1)
      end = new Date(y, m + 1, 0)
    }
    const nums = merged
      .filter((d) => {
        const dt = new Date(d.date as any)
        return !Number.isNaN(dt.getTime()) && dt.getTime() >= start.getTime() && dt.getTime() <= end.getTime()
      })
      .map((d) => {
        const v = d[key] as any
        return typeof v === "number" ? v : NaN
      })
      .filter((v) => !Number.isNaN(v))
    const min = nums.length ? Math.min(...nums) : undefined
    const max = nums.length ? Math.max(...nums) : undefined
    const avg = nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : undefined
    return { min, max, avg }
  }

  const StatCard: React.FC<{ label: string; value: number | string | undefined; unit?: string }> = ({ label, value, unit }) => (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-lg font-semibold text-foreground">{value ?? "--"}{value !== undefined && unit ? ` ${unit}` : ""}</p>
    </Card>
  )

  return (
    <Card className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-foreground mb-4">Vitals Trend</h2>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Button variant={timePeriod === "daily" ? "default" : "outline"} size="sm" onClick={() => setTimePeriod("daily")}>Daily</Button>
            <Button variant={timePeriod === "weekly" ? "default" : "outline"} size="sm" onClick={() => setTimePeriod("weekly")}>Weekly</Button>
            <Button variant={timePeriod === "monthly" ? "default" : "outline"} size="sm" onClick={() => setTimePeriod("monthly")}>Monthly</Button>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={handlePrevious} aria-label="Previous period">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium text-foreground min-w-[200px] text-center">{getDateRangeLabel()}</span>
            <Button variant="outline" size="icon" onClick={handleNext} aria-label="Next period">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">Track your health metrics over time</p>
      </div>
      <div className="space-y-8">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">Loading…</div>
        ) : merged.length ? (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5 mb-6">
              <TabsTrigger value="heartRate">Heart Rate</TabsTrigger>
              <TabsTrigger value="spo2">SpO2</TabsTrigger>
              <TabsTrigger value="weight">Weight</TabsTrigger>
              <TabsTrigger value="steps">Steps</TabsTrigger>
              <TabsTrigger value="bloodPressure">Blood Pressure</TabsTrigger>
            </TabsList>
            <TabsContent value="heartRate">
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={merged}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" style={{ fontSize: "12px" }} tickFormatter={(v) => (timePeriod === "weekly" ? formatDate(new Date(v), "EEE dd") : (timePeriod === "monthly" ? formatDate(new Date(v), "dd") : formatTimeHM(v)))} />
                  <YAxis stroke="hsl(var(--muted-foreground))" style={{ fontSize: "12px" }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)" }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d: any = payload[0].payload
                        return (
                          <div className="bg-card border border-border rounded-lg p-3">
                            <p className="text-xs text-muted-foreground mb-2">{timePeriod === "weekly" || timePeriod === "monthly" ? formatDate(new Date(d.date), "PP") : formatTimeHM(d.date)}</p>
                            <p className="text-sm"><span className="text-chart-1">●</span> Max: {d.heartRateMax ?? "--"} bpm</p>
                            <p className="text-sm"><span className="text-chart-2">●</span> Avg: {d.heartRate ?? "--"} bpm</p>
                            <p className="text-sm"><span className="text-chart-3">●</span> Min: {d.heartRateMin ?? "--"} bpm</p>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Line type="monotone" dataKey="heartRateMax" stroke="transparent" strokeWidth={0} dot={{ fill: "hsl(var(--chart-1))", r: 4, fillOpacity: 0.5 }} />
                  <Line type="monotone" dataKey="heartRate" stroke="transparent" strokeWidth={0} dot={{ fill: "hsl(var(--chart-2))", r: 6 }} />
                  <Line type="monotone" dataKey="heartRateMin" stroke="transparent" strokeWidth={0} dot={{ fill: "hsl(var(--chart-3))", r: 4, fillOpacity: 0.5 }} />
                </ComposedChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-4 mt-6">
                <StatCard label="Min HR" value={calculateStats("heartRateMin").min} unit="bpm" />
                <StatCard label="Max HR" value={calculateStats("heartRateMax").max} unit="bpm" />
                <StatCard label="Average HR" value={calculateStats("heartRate").avg} unit="bpm" />
                <StatCard label="Resting HR" value={timePeriod === "daily" ? (() => {
                  const hours = (vitals.hr || [])
                  const night = hours
                    .map((r: any) => ({ d: new Date(r.time as any), avg: r.avg, count: r.count }))
                    .filter((x: any) => !Number.isNaN(x.d.getTime()) && x.d.getUTCHours() >= 0 && x.d.getUTCHours() <= 6 && (x.count || 0) >= 10)
                    .sort((a: any,b: any)=>a.d.getTime()-b.d.getTime())
                  if (!night.length) return undefined
                  let best = { score: Infinity, vals: [] as number[] }
                  for (let i = 0; i < night.length; i++) {
                    const w = [night[i], night[i+1], night[i+2]].filter(Boolean)
                    if (w.length) {
                      const score = w.reduce((s, x) => s + (x.avg || 0), 0) / w.length
                      const vals = w.map(x => x.avg || 0).sort((a,b)=>a-b)
                      const mid = Math.floor(vals.length/2)
                      const median = vals.length % 2 ? vals[mid] : (vals[mid-1]+vals[mid])/2
                      if (score < best.score) best = { score, vals: [median] }
                    }
                  }
                  return best.vals.length ? Math.round(best.vals[0]) : undefined
                })() : calculateStats("restingHeartRate").avg} unit="bpm" />
              </div>
            </TabsContent>
            <TabsContent value="spo2">
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={merged}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" style={{ fontSize: "12px" }} tickFormatter={(v) => (timePeriod === "weekly" ? formatDate(new Date(v), "EEE dd") : (timePeriod === "monthly" ? formatDate(new Date(v), "dd") : formatTimeHM(v)))} />
                  <YAxis stroke="hsl(var(--muted-foreground))" style={{ fontSize: "12px" }} domain={[90, 100]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)" }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d: any = payload[0].payload
                        return (
                          <div className="bg-card border border-border rounded-lg p-3">
                            <p className="text-xs text-muted-foreground mb-2">{timePeriod === "weekly" || timePeriod === "monthly" ? formatDate(new Date(d.date), "PP") : formatTimeHM(d.date)}</p>
                            <p className="text-sm"><span className="text-chart-1">●</span> Max: {d.spo2Max ?? "--"}%</p>
                            <p className="text-sm"><span className="text-chart-2">●</span> Avg: {d.spo2 ?? "--"}%</p>
                            <p className="text-sm"><span className="text-chart-3">●</span> Min: {d.spo2Min ?? "--"}%</p>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Line type="monotone" dataKey="spo2Max" stroke="transparent" strokeWidth={0} dot={{ fill: "hsl(var(--chart-1))", r: 4, fillOpacity: 0.5 }} />
                  <Line type="monotone" dataKey="spo2" stroke="transparent" strokeWidth={0} dot={{ fill: "hsl(var(--chart-2))", r: 6 }} />
                  <Line type="monotone" dataKey="spo2Min" stroke="transparent" strokeWidth={0} dot={{ fill: "hsl(var(--chart-3))", r: 4, fillOpacity: 0.5 }} />
                </ComposedChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-4 mt-6">
                <StatCard label="Min SpO2" value={calculateStats("spo2Min").min} unit="%" />
                <StatCard label="Max SpO2" value={calculateStats("spo2Max").max} unit="%" />
                <StatCard label="Average SpO2" value={calculateStats("spo2").avg} unit="%" />
              </div>
            </TabsContent>
            <TabsContent value="weight">
              <div className="flex h-40 items-center justify-center text-muted-foreground">Coming soon</div>
            </TabsContent>
            <TabsContent value="steps">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={(timePeriod === "weekly" ? stepsWeeklyPadded : (timePeriod === "monthly" ? stepsMonthlyPadded : stepsDayAgg)).map((s: any) => ({ date: s.time, steps: s.count }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" style={{ fontSize: "12px" }} tickFormatter={(v) => (timePeriod === "weekly" ? formatDate(new Date(v), "EEE dd") : (timePeriod === "monthly" ? formatDate(new Date(v), "dd") : formatTimeHM(v)))} />
                  <YAxis stroke="hsl(var(--muted-foreground))" style={{ fontSize: "12px" }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)" }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                    formatter={(value: number) => [`${value} steps`, ""]}
                    labelFormatter={(label: string) => (timePeriod === "weekly" || timePeriod === "monthly" ? formatDate(new Date(label), "PP") : formatTimeHM(label))}
                  />
                  <Bar dataKey="steps" fill="hsl(var(--chart-2))" />
                </BarChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-4 mt-6">
                {(() => {
                  const stepsArr = timePeriod === "weekly" ? stepsWeeklyPadded : (timePeriod === "monthly" ? stepsMonthlyPadded : stepsDayAgg)
                  const nums = stepsArr.map((x: any) => x.count).filter((n: any) => typeof n === "number")
                  const min = nums.length ? Math.min(...nums) : undefined
                  const max = nums.length ? Math.max(...nums) : undefined
                  const avg = nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : undefined
                  return (
                    <>
                      <StatCard label="Min Steps" value={min} />
                      <StatCard label="Max Steps" value={max} />
                      <StatCard label="Average Steps" value={avg} />
                    </>
                  )
                })()}
              </div>
            </TabsContent>
            <TabsContent value="bloodPressure">
              <div className="flex h-40 items-center justify-center text-muted-foreground">Coming soon</div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">No record</div>
        )}
      </div>
    </Card>
  )
}

export default VitalsChart
