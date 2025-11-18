import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AdminOtp() {
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [info, setInfo] = useState('')
  const [error, setError] = useState('')

  async function generateOtp() {
    setError('')
    setInfo('')
    try {
      const r = await fetch(`http://localhost:3001/admin/auth-generate-link?email=${encodeURIComponent(email)}&type=recovery`)
      const j = await r.json()
      const code = j?.data?.properties?.email_otp || ''
      setOtp(code)
      setInfo(code ? `OTP generated` : `No OTP available`)
    } catch (e) {
      setError(String(e))
    }
  }

  async function verifyOtp(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    const { error } = await supabase.auth.verifyOtp({ type: 'email', email, token: otp })
    if (error) setError(error.message)
    else {
      setInfo('Signed in')
      window.location.href = '/admin'
    }
  }

  return (
    <div>
      <h1>Admin OTP Login</h1>
      <input placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} />
      <div>
        <button type="button" onClick={generateOtp}>Generate OTP</button>
      </div>
      <form onSubmit={verifyOtp}>
        <input placeholder="otp code" value={otp} onChange={e=>setOtp(e.target.value)} />
        <button type="submit">Verify</button>
      </form>
      {info ? <div>{info}</div> : null}
      {error ? <div>{error}</div> : null}
    </div>
  )
}