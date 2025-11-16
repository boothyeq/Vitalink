import React, { useEffect, useState } from 'react'

export default function AdminDashboard({ session }) {
  const [users, setUsers] = useState([])
  const [summary, setSummary] = useState([])
  const [error, setError] = useState('')
  useEffect(() => {
    async function fetchAll() {
      try {
        const u = await fetch('http://localhost:3001/admin/users')
        const ur = await u.json()
        setUsers(ur.users || [])
        const s = await fetch('http://localhost:3001/admin/summary')
        const sr = await s.json()
        setSummary(sr.summary || [])
      } catch (e) {
        setError(String(e))
      }
    }
    fetchAll()
  }, [])
  if (!session) return <div>Login as admin</div>
  return (
    <div>
      <h1>Admin Dashboard</h1>
      {error ? <div>{error}</div> : null}
      <h2>Users</h2>
      <ul>{users.map(u => <li key={u}>{u}</li>)}</ul>
      <h2>Summary</h2>
      <ul>
        {summary.map(item => (
          <li key={item.patientId}>
            {item.patientId}
          </li>
        ))}
      </ul>
    </div>
  )
}