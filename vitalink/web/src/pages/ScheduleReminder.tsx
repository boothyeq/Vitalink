import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Calendar as CalendarIcon, Clock, Stethoscope, Plus } from "lucide-react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { getPatientReminders, createPatientReminder, updatePatientReminder, deletePatientReminder } from "@/lib/api"
import { supabase } from "@/lib/supabase"


export default function ScheduleReminder() {
  const queryClient = useQueryClient()
  const [patientId, setPatientId] = React.useState<string | undefined>(
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("patientId") || undefined : undefined
  )
  React.useEffect(() => {
    let mounted = true
    async function init() {
      if (patientId) return
      const { data } = await supabase.auth.getSession()
      const id = data?.session?.user?.id || undefined
      if (mounted) setPatientId(id)
    }
    init()
    return () => { mounted = false }
  }, [patientId])

  const upcomingQuery = useQuery({ queryKey: ["patient-reminders", patientId], queryFn: () => getPatientReminders(patientId), enabled: !!patientId, refetchOnWindowFocus: false })
  const upcoming = upcomingQuery.data?.reminders || []

  

  const [showAdd, setShowAdd] = React.useState(false)
  const [title, setTitle] = React.useState("")
  const [date, setDate] = React.useState("")
  const [time, setTime] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [editId, setEditId] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<{ title?: string; date?: string; time?: string }>({})
  async function handleDeleteReminder(id: string) {
    if (!patientId || !id) return
    setSubmitting(true)
    try {
      const r = await deletePatientReminder(patientId, id)
      if (!(r as any)?.ok) throw new Error('Failed to delete')
      queryClient.invalidateQueries({ queryKey: ["patient-reminders", patientId] })
    } finally {
      setSubmitting(false)
    }
  }

  function validateFields() {
    const errs: { title?: string; date?: string; time?: string } = {}
    const t = title.trim()
    if (!t) errs.title = "Title is required"
    else if (t.length < 2) errs.title = "Title must be at least 2 characters"
    else if (t.length > 100) errs.title = "Title must be ≤ 100 characters"
    if (!date) errs.date = "Date is required"
    if (time) {
      const t24 = parseTimeTo24(time)
      const hh = parseInt((t24.split(":")[0] || "0"), 10)
      if (hh < 8 || hh > 22) errs.time = "Time must be between 08:00–22:00"
    }
    setFieldErrors(errs)
    return errs
  }

  function parseTimeTo24(input: string) {
    const s = (input || "").trim()
    const ampm = /\s?(AM|PM)$/i.exec(s)
    if (ampm) {
      const base = s.replace(/\s?(AM|PM)$/i, "")
      const parts = base.split(":")
      let hh = parseInt(parts[0] || "0", 10)
      const mm = parseInt(parts[1] || "0", 10)
      const isPm = ampm[1].toUpperCase() === "PM"
      if (isPm && hh < 12) hh += 12
      if (!isPm && hh === 12) hh = 0
      return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`
    }
    return s
  }
  function computeDateIso(dStr: string, tStr: string) {
    if (dStr && tStr) {
      const t24 = parseTimeTo24(tStr)
      const d = new Date(`${dStr}T${t24}`)
      return d.toISOString()
    }
    if (dStr) {
      const d = new Date(dStr)
      d.setHours(9, 0, 0, 0)
      return d.toISOString()
    }
    return new Date().toISOString()
  }

  async function handleAddReminder() {
    setError(null)
    const errs = validateFields()
    if (errs.title || errs.date || errs.time) return
    if (!patientId || !title || (!date && !time)) { setError("Missing required fields"); return }
    const dtIso = (() => {
      return computeDateIso(date, time)
    })()
    if (time) {
      const t24 = parseTimeTo24(time)
      const parts = t24.split(":")
      const hh = parseInt(parts[0] || "0", 10)
      if (hh < 8 || hh > 22) { setError("Appointments allowed 08:00–22:00 local time"); return }
    }
    const now = new Date()
    if (new Date(dtIso).getTime() <= now.getTime()) { setError("Date/time must be in the future"); return }
    setSubmitting(true)
    try {
      if (editId) {
        const res = await updatePatientReminder({ patientId, id: editId, title, date: dtIso, notes, tzOffsetMin: 0 - new Date().getTimezoneOffset() })
        if ((res as any)?.error) { setError((res as any).error); return }
      } else {
        const res = await createPatientReminder({ patientId, title, date: dtIso, notes, tzOffsetMin: 0 - new Date().getTimezoneOffset() })
        if ((res as any)?.error) { setError((res as any).error); return }
      }
      setShowAdd(false)
      setTitle("")
      setDate("")
      setTime("")
      setNotes("")
      setEditId(null)
      queryClient.invalidateQueries({ queryKey: ["patient-reminders", patientId] })
    } catch (e: any) {
      const msg = e && e.message ? e.message : "Failed to save reminder"
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Schedule & Reminders</h1>
          <p className="text-muted-foreground">View your health appointments and routines</p>
        </div>

        <div className="mb-6 flex items-center justify-end">
          <Button onClick={() => setShowAdd((v) => !v)} variant="default" className="gap-2">
            <Plus className="w-4 h-4" />
            Add Reminder
          </Button>
        </div>

        {showAdd && (
          <Card className="mb-8">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{editId ? "Edit Reminder" : "New Reminder"}</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm mb-1">Title</label>
                  <Input value={title} onChange={(e) => { setTitle(e.target.value); setFieldErrors((f)=>({ ...f, title: undefined })) }} placeholder="e.g., Cardiology Follow-up" />
                  {fieldErrors.title ? <div className="mt-1 text-xs text-destructive">{fieldErrors.title}</div> : null}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm mb-1">Date (YYYY-MM-DD)</label>
                    <Input type="date" value={date} min={new Date().toISOString().slice(0,10)} onChange={(e) => { setDate(e.target.value); setFieldErrors((f)=>({ ...f, date: undefined })) }} />
                    {fieldErrors.date ? <div className="mt-1 text-xs text-destructive">{fieldErrors.date}</div> : null}
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Time</label>
                    <Input type="time" value={time} min="08:00" max="22:00" onChange={(e) => { setTime(e.target.value); setFieldErrors((f)=>({ ...f, time: undefined })) }} />
                    {fieldErrors.time ? <div className="mt-1 text-xs text-destructive">{fieldErrors.time}</div> : null}
                  </div>
                </div>
                <div>
                  <label className="block text-sm mb-1">Notes</label>
                  <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
                </div>
                {error ? <div className="text-sm text-destructive">{error}</div> : null}
                <div className="flex gap-3">
                  <Button onClick={handleAddReminder} disabled={submitting || !patientId || !title || !date || (fieldErrors.title!=null) || (fieldErrors.date!=null) || (fieldErrors.time!=null)}>
                    {submitting ? "Saving..." : "Save Reminder"}
                  </Button>
                  <Button variant="outline" onClick={() => { setShowAdd(false); setEditId(null) }}>Cancel</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mb-8">
          <h2 className="text-xl font-bold text-foreground mb-4">Upcoming Appointments</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {upcoming.length === 0 ? (
              <div className="text-muted-foreground">No upcoming reminders</div>
            ) : upcoming.map((r) => {
              const dt = new Date(r.date)
              const dateStr = dt.toLocaleDateString()
              const timeStr = dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              const Icon = Stethoscope
              return (
                <Card key={r.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center text-warning`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{r.title}</CardTitle>
                          {r.notes ? <p className="text-sm text-muted-foreground">{r.notes}</p> : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => { setShowAdd(true); setEditId(r.id); setTitle(r.title); const d = new Date(r.date); const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,'0'); const day = String(d.getDate()).padStart(2,'0'); const hh = String(d.getHours()).padStart(2,'0'); const mm = String(d.getMinutes()).padStart(2,'0'); setDate(`${y}-${m}-${day}`); setTime(`${hh}:${mm}`); setNotes(r.notes || "") }}>Edit</Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDeleteReminder(r.id)}>Delete</Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <CalendarIcon className="w-4 h-4" />
                        <span>{dateStr}</span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span>{timeStr}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        
      </div>
    </div>
  )
}
