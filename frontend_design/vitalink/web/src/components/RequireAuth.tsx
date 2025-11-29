import React, { useEffect, useState } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { supabase } from "@/lib/supabase"

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [authed, setAuthed] = useState(false)
  const location = useLocation()

  useEffect(() => {
    let unsub: any
    async function init() {
      const { data } = await supabase.auth.getSession()
      const role = data?.session?.user?.app_metadata?.role
      setAuthed(!!(data && data.session && (role === "patient" || role === "admin")))
      setLoading(false)
      const s = supabase.auth.onAuthStateChange((_event, session) => {
        const r = (session as any)?.user?.app_metadata?.role
        setAuthed(!!session && (r === "patient" || r === "admin"))
      })
      unsub = s && s.data && s.data.subscription && s.data.subscription.unsubscribe
    }
    init()
    return () => { if (typeof unsub === "function") unsub() }
  }, [])

  if (loading) return null
  if (!authed) return <Navigate to="/login" state={{ from: location }} replace />
  return <>{children}</>
}