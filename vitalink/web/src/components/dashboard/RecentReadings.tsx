import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getPatientVitals } from "@/lib/api"
import { formatTimeHM } from "@/lib/utils"

type Props = { patientId?: string }

const RecentReadings: React.FC<Props> = ({ patientId }) => {
  const { data, isLoading } = useQuery({ queryKey: ["patient-vitals", patientId], queryFn: () => getPatientVitals(patientId), refetchOnWindowFocus: false, enabled: !!patientId })
  const vitals = data?.vitals || {}

  const allReadings = [
    ...(vitals.hr || []).map((r) => ({ type: "Heart Rate", time: r.time, value: `${r.avg} bpm` })),
    ...(vitals.spo2 || []).map((r) => ({ type: "SpO2", time: r.time, value: `${r.avg}%` })),
    ...(vitals.steps || []).map((r) => ({ type: "Steps", time: r.time, value: `${r.count} steps` })),
    // TODO: When BP/weight data available, include:
    // ...(vitals.bp || []).map((r) => ({ type: "Blood Pressure", time: r.time, value: `${r.systolic}/${r.diastolic}` })),
    // ...(vitals.weight || []).map((r) => ({ type: "Weight", time: r.time, value: `${r.kg} kg` })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

  const readings = allReadings.reduce((acc, reading) => {
    const existing = acc.find((r) => r.type === reading.type)
    if (!existing) acc.push(reading)
    return acc
  }, [] as typeof allReadings)

  return (
    <Card className="p-6">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-foreground">Recent Readings</h2>
        <p className="text-sm text-muted-foreground">Most recent reading per vital type</p>
      </div>
      <div className="overflow-x-auto">
        {isLoading ? (
          <div className="text-muted-foreground">Loading…</div>
        ) : readings.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {readings.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{r.type}</TableCell>
                  <TableCell className="font-medium">{formatTimeHM(r.time)}</TableCell>
                  <TableCell className="font-semibold">{r.value}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-muted-foreground">No recent readings</div>
        )}
      </div>
    </Card>
  )
}

export default RecentReadings
