import React, { useEffect, useState } from 'react'
import { Routes, Route, Link, useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Register from './pages/Register'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'

function App() {
  const [session, setSession] = useState(null)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session || null))
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => { data.subscription.unsubscribe() }
  }, [])
  const navigate = useNavigate()
  return (
    <div>
      <nav>
        <Link to="/">Home</Link> | <Link to="/register">Register</Link> | <Link to="/login">Login</Link> | <Link to="/admin/login">Admin Login</Link> | <Link to="/admin">Admin Dashboard</Link>
        {session ? <button onClick={async()=>{ await supabase.auth.signOut(); navigate('/') }}>Logout</button> : null}
      </nav>
      <Routes>
        <Route path="/" element={<div>Home</div>} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminDashboard session={session} />} />
      </Routes>
    </div>
  )
}

export default App