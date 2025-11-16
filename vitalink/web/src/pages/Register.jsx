import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const navigate = useNavigate()
  async function submit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    const { error, data } = await supabase.auth.signUp({ email, password })
    if (error) setError(error.message)
    else {
      setInfo(data.user ? 'Registered' : 'Check email for confirmation')
      navigate('/login')
    }
  }
  return (
    <form onSubmit={submit}>
      <h1>Register</h1>
      <input placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} />
      <input placeholder="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
      <button type="submit">Register</button>
      {error ? <div>{error}</div> : null}
      {info ? <div>{info}</div> : null}
    </form>
  )
}