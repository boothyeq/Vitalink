import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { serverUrl } from '@/lib/api'
import { useNavigate } from 'react-router-dom'

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('patient')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const navigate = useNavigate()
  async function submit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    const emailClean = email.trim().toLowerCase()
    const passwordClean = password.trim()
    const { error, data } = await supabase.auth.signUp({ email: emailClean, password: passwordClean })
    if (error) setError(error.message)
    else {
      const API = serverUrl()
      if (role === 'admin') {
        try {
          await fetch(`${API}/admin/promote`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: emailClean, role: 'admin' }) })
        } catch (e) {}
      } else if (role === 'patient') {
        try {
          const id = data && data.user && data.user.id
          if (id) {
            await fetch(`${API}/admin/ensure-patient`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ patientId: id }) })
            await fetch(`${API}/admin/promote`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: emailClean, role: 'patient' }) })
          } else {
            const au = await fetch(`${API}/admin/auth-users`)
            const ar = await au.json()
            const u = (ar.users || []).find((x) => x.email === emailClean)
            if (u && u.id) {
              await fetch(`${API}/admin/ensure-patient`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ patientId: u.id }) })
              // await fetch(`${API}/admin/promote`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: emailClean, role: 'patient' }) })
            }
          }
        } catch (e) {}
      }
      setInfo(data.user ? 'Registered' : 'Check email for confirmation')
      navigate('/login')
    }
  }
  return (
    <form onSubmit={submit}>
      <h1>Register</h1>
      <input placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} />
      <input placeholder="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
      <select value={role} onChange={e=>setRole(e.target.value)}>
        <option value="patient">Patient</option>
        <option value="admin">Admin</option>
      </select>
      <button type="submit">Register</button>
      {error ? <div>{error}</div> : null}
      {info ? <div>{info}</div> : null}
    </form>
  )
}