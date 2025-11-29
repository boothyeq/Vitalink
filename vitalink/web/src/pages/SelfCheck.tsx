import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Weight, AlertCircle, Activity, Camera } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { postWeightSample, postSymptomLog } from "@/lib/api"

const SelfCheck = () => {
  const [patientId, setPatientId] = useState<string | undefined>(
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("patientId") || undefined : undefined
  )
  const [weightKg, setWeightKg] = useState<string>("")
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [symptoms, setSymptoms] = useState<Record<string, number>>({
    cough: 0,
    breathlessness: 0,
    swelling: 0,
    weightGain: 0,
    abdomen: 0,
    sleeping: 0,
  })
  const [weightSubmittedToday, setWeightSubmittedToday] = useState(false)
  const [symptomsSubmittedToday, setSymptomsSubmittedToday] = useState(false)
  const [showPermissionDialog, setShowPermissionDialog] = useState(false)
  const [showSuccessCard, setShowSuccessCard] = useState(false)
  useEffect(() => {
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
  useEffect(() => {
    if (!patientId) return
    const today = new Date().toISOString().slice(0, 10)
    const w = localStorage.getItem(`weight:lastDate:${patientId}`)
    const s = localStorage.getItem(`symptoms:lastDate:${patientId}`)
    setWeightSubmittedToday(w === today)
    setSymptomsSubmittedToday(s === today)
  }, [patientId])
  async function handleLogWeight() {
    if (!patientId || !weightKg) return
    setSubmitting(true)
    try {
      const kg = parseFloat(weightKg)
      const res = await postWeightSample({ patientId, kg })
      setToast({ type: 'success', message: 'Weight saved' })
      setTimeout(() => setToast(null), 3000)
      setWeightKg("")
      const today = new Date().toISOString().slice(0, 10)
      localStorage.setItem(`weight:lastDate:${patientId}`, today)
      setWeightSubmittedToday(true)
    } finally {
      setSubmitting(false)
    }
  }
  async function handleLogSymptoms() {
    if (!patientId) return
    setSubmitting(true)
    try {
      const res = await postSymptomLog({ patientId, ...symptoms, notes: JSON.stringify(symptoms) })
      if ((res as any)?.error) throw new Error((res as any).error)
      setToast({ type: 'success', message: 'Symptoms saved' })
      setTimeout(() => setToast(null), 3000)
      const today = new Date().toISOString().slice(0, 10)
      localStorage.setItem(`symptoms:lastDate:${patientId}`, today)
      setSymptomsSubmittedToday(true)
    } finally {
      setSubmitting(false)
    }
  }
  const handleAllowPermissions = () => {}
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Self Check Toolkits</CardTitle>
          <CardDescription className="text-center">Log your daily measurements and symptoms</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="weight" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="weight">Daily Weight</TabsTrigger>
              <TabsTrigger value="symptoms">Symptoms Rating</TabsTrigger>
            </TabsList>

            <TabsContent value="weight">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Weight className="w-5 h-5 text-primary" />
                    Daily Weight (kg)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="weight">Weight</Label>
                    <div className="flex gap-3">
                      <Input id="weight" type="number" placeholder="68.5" className="flex-1" step="0.1" value={weightKg} onChange={e=>setWeightKg(e.target.value)} />
                    </div>
                    <p className="text-xs text-muted-foreground">Use weighing scale or smart detection</p>
                  </div>
                  {weightSubmittedToday ? (
                    <div className="text-sm text-muted-foreground">You have logged weight today.</div>
                  ) : (
                    <Button className="w-full" onClick={handleLogWeight} disabled={submitting || !patientId || !weightKg}>Log Weight</Button>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="symptoms">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-primary" />
                    Symptoms Rating
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">Rate each symptom: 0 = No symptom, 1 = Mild, 5 = Severe</p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {[
                    { id: "cough", label: "Cough" },
                    { id: "breathlessness", label: "Shortness of breath when active" },
                    { id: "swelling", label: "Swelling of legs" },
                    { id: "weightGain", label: "Sudden weight gain > 2kg in 3 days" },
                    { id: "abdomen", label: "Discomfort/swelling in abdomen" },
                    { id: "sleeping", label: "Breathless when sleeping" },
                  ].map((symptom) => (
                    <div key={symptom.id} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label htmlFor={symptom.id}>{symptom.label}</Label>
                        <span className="text-sm font-semibold text-primary">{symptoms[symptom.id] ?? 0}</span>
                      </div>
                      <Slider id={symptom.id} value={[symptoms[symptom.id] ?? 0]} max={5} step={1} className="w-full" onValueChange={(v)=>{
                        const key = symptom.id
                        setSymptoms((s)=>({ ...s, [key]: v[0] }))
                      }} />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>No symptom</span>
                        <span>Mild</span>
                        <span>Severe</span>
                      </div>
                    </div>
                  ))}

                  {symptomsSubmittedToday ? (
                    <div className="text-sm text-muted-foreground">You have logged symptoms today.</div>
                  ) : (
                    <Button className="w-full" onClick={handleLogSymptoms} disabled={submitting || !patientId}>Log Symptoms</Button>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <Card className={toast.type === 'success' ? 'bg-success/10 border-success/20' : 'bg-destructive/10 border-destructive/20'}>
            <CardContent className="p-3 text-sm">
              {toast.message}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default SelfCheck