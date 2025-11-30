import React, { useEffect, useState } from 'react'
import { serverUrl } from '@/lib/api'

export default function AdminDashboard() {
  const [users, setUsers] = useState([])
  const [summary, setSummary] = useState([])
  const [error, setError] = useState('')
  const API = serverUrl()
  useEffect(() => {
    async function fetchAll() {
      try {
        const au = await fetch(`${API}/admin/auth-users`)
        if (!au.ok) {
          const t = await au.text()
          throw new Error(`auth-users ${au.status} ${au.statusText} ${t}`)
        }
        const aur = await au.json()
        const patientIds = new Set((aur.users || []).filter(x => x.role === 'patient').map(x => x.id))
        const u = await fetch(`${API}/admin/users`)
        if (!u.ok) {
          const t = await u.text()
          throw new Error(`users ${u.status} ${u.statusText} ${t}`)
        }
        const ur = await u.json()
        const onlyPatients = (ur.users || []).filter(id => patientIds.has(id))
        setUsers(onlyPatients)
        const s = await fetch(`${API}/admin/summary`)
        if (!s.ok) {
          const t = await s.text()
          throw new Error(`summary ${s.status} ${s.statusText} ${t}`)
        }
        const sr = await s.json()
        const onlyPatientSummary = (sr.summary || []).filter(item => patientIds.has(item.patientId))
        setSummary(onlyPatientSummary)
      } catch (e) {
        setError(String(e))
      }
    }
    fetchAll()
  }, [])
  return (
    <div>
      <h1>Admin Dashboard</h1>
      {import.meta.env.DEV ? <div>API: {API}</div> : null}
      {error ? <div>{error}</div> : null}
      <h2>Users</h2>
      <ul>{users.map(u => <li key={u}>{u}</li>)}</ul>
      <h2>Summary</h2>
      <table border="1" cellPadding="6" cellSpacing="0">
        <thead>
          <tr>
            <th>Patient</th>
            <th>Steps Date</th>
            <th>Steps Total</th>
            <th>HR Date</th>
            <th>HR Min</th>
            <th>HR Max</th>
            <th>HR Avg</th>
            <th>HR Count</th>
            <th>SpO2 Date</th>
            <th>SpO2 Min</th>
            <th>SpO2 Max</th>
            <th>SpO2 Avg</th>
            <th>SpO2 Count</th>
          </tr>
        </thead>
        <tbody>
          {summary.map(item => {
            const s = item.steps || {}
            const h = item.hr || {}
            const o = item.spo2 || {}
            return (
              <tr key={item.patientId}>
                <td>{item.patientId}</td>
                <td>{s.date || '-'}</td>
                <td>{s.steps_total ?? '-'}</td>
                <td>{h.date || '-'}</td>
                <td>{h.hr_min ?? '-'}</td>
                <td>{h.hr_max ?? '-'}</td>
                <td>{h.hr_avg != null ? Math.round(h.hr_avg) : '-'}</td>
                <td>{h.hr_count ?? '-'}</td>
                <td>{o.date || '-'}</td>
                <td>{o.spo2_min ?? '-'}</td>
                <td>{o.spo2_max ?? '-'}</td>
                <td>{o.spo2_avg != null ? Math.round(o.spo2_avg) : '-'}</td>
                <td>{o.spo2_count ?? '-'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}