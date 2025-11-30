import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Bell } from "lucide-react"
import { getPatientReminders } from "@/lib/api"
import { useNavigate } from "react-router-dom"

type Props = { patientId?: string }

const UpcomingReminders: React.FC<Props> = ({ patientId }) => {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({ queryKey: ["patient-reminders", patientId], queryFn: () => getPatientReminders(patientId), refetchOnWindowFocus: false, enabled: !!patientId })
  const reminders = data?.reminders || []
  const sorted = [...reminders].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const visible = sorted.slice(0, 3)
  const remaining = Math.max(0, sorted.length - visible.length)
  const goSchedule = () => {
    const qp = patientId ? `?patientId=${encodeURIComponent(patientId)}` : ""
    navigate(`/schedule${qp}`)
  }
  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Upcoming</h2>
          <p className="text-sm text-muted-foreground">Reminders & appointments</p>
        </div>
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-muted-foreground" />
          <Button variant="outline" size="sm" onClick={goSchedule}>View schedule</Button>
        </div>
      </div>
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-muted-foreground">Loading…</div>
        ) : visible.length ? (
          visible.map((r) => (
            <Button key={r.id} className="w-full justify-start" variant="outline" onClick={goSchedule}>
              <span className="mr-2 text-muted-foreground">{new Date(r.date).toLocaleDateString()}</span>
              <span className="font-medium">{r.title}</span>
            </Button>
          ))
        ) : (
          <div className="text-muted-foreground">No upcoming reminders</div>
        )}
        {remaining > 0 ? (
          <div className="text-sm text-muted-foreground">… {remaining} more reminders</div>
        ) : null}
      </div>
    </Card>
  )
}

export default UpcomingReminders
