import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Card } from "@/components/ui/card"
import { Bell } from "lucide-react"
import { getPatientReminders } from "@/lib/api"

type Props = { patientId?: string }

const UpcomingReminders: React.FC<Props> = ({ patientId }) => {
  const { data, isLoading } = useQuery({ queryKey: ["patient-reminders", patientId], queryFn: () => getPatientReminders(patientId), refetchOnWindowFocus: false, enabled: !!patientId })
  const reminders = data?.reminders || []
  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Upcoming</h2>
          <p className="text-sm text-muted-foreground">Reminders & appointments</p>
        </div>
        <Bell className="w-5 h-5 text-muted-foreground" />
      </div>
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-muted-foreground">Loading…</div>
        ) : reminders.length ? (
          reminders.map((r) => (
            <div key={r.id} className="flex gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
              <div className="p-2 rounded-full bg-muted">
                <span className="text-xs text-muted-foreground">{new Date(r.date).toLocaleDateString()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-foreground">{r.title}</p>
                {r.notes ? <p className="text-xs text-muted-foreground line-clamp-1">{r.notes}</p> : null}
              </div>
            </div>
          ))
        ) : (
          <div className="text-muted-foreground">No upcoming reminders</div>
        )}
      </div>
    </Card>
  )
}

export default UpcomingReminders
