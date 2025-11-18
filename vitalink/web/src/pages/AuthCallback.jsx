import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AuthCallback() {
  const navigate = useNavigate()
  useEffect(() => {
    const h = window.location.hash.replace(/^#/, '')
    const p = new URLSearchParams(h)
    const at = p.get('access_token')
    const rt = p.get('refresh_token')
    async function run() {
      if (at && rt && supabase.auth && supabase.auth.setSession) {
        await supabase.auth.setSession({ access_token: at, refresh_token: rt })
      }
      navigate('/admin')
    }
    run()
  }, [navigate])
  return (<div>Signing you in...</div>)
}