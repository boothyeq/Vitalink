import { useEffect, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { supabase } from "@/lib/supabase"
import { getPatientMedications, savePatientMedications } from "@/lib/api"

const Medication = () => {
  const [patientId, setPatientId] = useState<string | undefined>(
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("patientId") || undefined : undefined
  )
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

  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: ["patient-medications", patientId],
    queryFn: () => getPatientMedications(patientId),
    enabled: !!patientId,
    refetchOnWindowFocus: false,
  })

  const [prefs, setPrefs] = useState({
    beta_blockers: false,
    raas_inhibitors: false,
    mras: false,
    sglt2_inhibitors: false,
    statin: false,
    notify_hour: 9,
  })
  useEffect(() => {
    const p = data?.preferences
    if (p) setPrefs(p)
  }, [data])

  const mutation = useMutation({
    mutationFn: async () => {
      if (!patientId) return { ok: false }
      return savePatientMedications({ patientId, ...prefs })
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["patient-medications", patientId] }) },
  })

  const Item = ({ label, keyName }: { label: string; keyName: keyof typeof prefs }) => (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-foreground">{label}</span>
      <Switch checked={!!(prefs as any)[keyName]} onCheckedChange={(v) => setPrefs((x)=>({ ...x, [keyName]: !!v }))} />
    </div>
  )

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Medication Checklist</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Item label="Beta blockers" keyName="beta_blockers" />
              <Item label="RAAS inhibitors" keyName="raas_inhibitors" />
              <Item label="MRAs" keyName="mras" />
              <Item label="SGLT2 inhibitors" keyName="sglt2_inhibitors" />
              <Item label="Statin" keyName="statin" />
            </div>
            <div className="mt-6 flex gap-2">
              <Button disabled={!patientId || mutation.isPending} onClick={() => mutation.mutate()}>Save</Button>
              <div className="text-sm text-muted-foreground flex items-center">Daily notification at {String(prefs.notify_hour).padStart(2, "0")}:00</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default Medication

