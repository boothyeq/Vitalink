import { Button } from "@/components/ui/button"
import { Activity } from "lucide-react"

export default function VitalsTracker() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Vitals Tracker</h2>
      </div>
      <div className="mt-6">
        <Button type="button" className="gap-2">
          <Activity className="w-4 h-4" />
          Measure Blood Pressure
        </Button>
      </div>
    </main>
  )
}