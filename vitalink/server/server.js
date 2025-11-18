const express = require('express')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()
const app = express()
app.use(express.json())
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization')
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  if (req.method === 'OPTIONS') return res.sendStatus(200)
  next()
})

let supabase
let supabaseMock = false
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
} else {
  supabaseMock = true
  console.warn('[server] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing — using mock supabase (no writes)')
  const api = {
    async upsert() { return { data: [], error: null } },
    async select() { return { data: [], error: null } },
    eq() { return this },
    limit() { return this },
  }
  supabase = { from() { return api } }
}
function toHourWithOffset(ts, offsetMin) {
  const d = new Date(Date.parse(ts) + (offsetMin || 0) * 60000)
  d.setUTCMinutes(0, 0, 0)
  return d.toISOString()
}
function toDateWithOffset(ts, offsetMin) {
  const d = new Date(Date.parse(ts) + (offsetMin || 0) * 60000)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
async function ensurePatient(patientId) {
  if (!patientId) return { ok: false, error: 'missing patientId' }
  const row = { patient_id: patientId, first_name: 'Dev', last_name: 'Tester', dob: '1970-01-01' }
  const res = await supabase.from('patients').upsert([row], { onConflict: 'patient_id' })
  if (res.error) {
    console.error('ensurePatient error', res.error)
    return { ok: false, error: res.error.message }
  }
  return { ok: true }
}
async function ensureOrigins(origins) {
  if (!origins.length) return { ok: true }
  const rows = origins.map((o) => ({ origin_id: o }))
  const res = await supabase.from('data_origin').upsert(rows, { onConflict: 'origin_id' })
  if (res.error) {
    console.error('ensureOrigins error', res.error)
    return { ok: false, error: res.error.message }
  }
  return { ok: true }
}
async function ensureDevices(devices, patientId) {
  if (!devices.length) return { ok: true }
  const rows = devices.map((d) => ({ device_id: d, patient_id: patientId }))
  const res = await supabase.from('devices').upsert(rows, { onConflict: 'device_id' })
  if (res.error) {
    console.error('ensureDevices error', res.error)
    return { ok: false, error: res.error.message }
  }
  return { ok: true }
}
app.get('/health', (req, res) => res.status(200).send('ok'))
app.post('/admin/ensure-patient', async (req, res) => {
  const pid = req.body && req.body.patientId
  if (!pid) return res.status(400).json({ error: 'missing patientId' })
  const r = await ensurePatient(pid)
  if (!r.ok) return res.status(400).json({ ok: false, error: r.error })
  return res.status(200).json({ ok: true })
})

if (process.env.ENABLE_DEV_ROUTES === 'true') {
  try {
    require('./dev/devRoutes')(app, supabase, ensurePatient, supabaseMock)
  } catch (e) {
    console.warn('dev routes not loaded', e && e.message ? e.message : e)
  }
}

app.get('/admin/users', async (req, res) => {
  const out = { users: [] }
  const rows = await supabase.from('patients').select('patient_id').limit(1000)
  if (rows.error) return res.status(400).json({ error: rows.error.message })
  out.users = (rows.data || []).map((r) => r.patient_id)
  return res.status(200).json(out)
})
app.get('/admin/summary', async (req, res) => {
  const users = await supabase.from('patients').select('patient_id').limit(1000)
  if (users.error) return res.status(400).json({ error: users.error.message })
  const ids = (users.data || []).map((r) => r.patient_id)
  const out = []
  for (const pid of ids) {
    const s = await supabase.from('steps_day').select('date,steps_total').eq('patient_id', pid).order('date', { ascending: false }).limit(1)
    const h = await supabase.from('hr_day').select('date,hr_min,hr_max,hr_avg,hr_count').eq('patient_id', pid).order('date', { ascending: false }).limit(1)
    const o = await supabase.from('spo2_day').select('date,spo2_min,spo2_max,spo2_avg,spo2_count').eq('patient_id', pid).order('date', { ascending: false }).limit(1)
    out.push({
      patientId: pid,
      steps: (s.data && s.data[0]) || null,
      hr: (h.data && h.data[0]) || null,
      spo2: (o.data && o.data[0]) || null,
    })
  }
  return res.status(200).json({ summary: out })
})
app.get('/admin/auth-users', async (req, res) => {
  const r = await supabase.auth.admin.listUsers({ page: 1, perPage: 100 })
  if (r.error) return res.status(400).json({ error: r.error.message })
  const users = (r.data && r.data.users) || []
  const out = users.map((u) => ({ id: u.id, email: u.email, created_at: u.created_at, role: (u.app_metadata && u.app_metadata.role) || null }))
  return res.status(200).json({ users: out })
})
app.post('/admin/auth-generate-link', async (req, res) => {
  const email = req.body && req.body.email
  if (!email) return res.status(400).json({ error: 'missing email' })
  const redirect = (req.body && req.body.redirect) || undefined
  const r = await supabase.auth.admin.generateLink({ type: 'magiclink', email, redirectTo: redirect })
  if (r.error) return res.status(400).json({ error: r.error.message })
  const data = r.data || {}
  const actionLink = (data.action_link || (data.properties && data.properties.action_link) || '')
  const fragment = actionLink.split('#')[1]
  const base = redirect || 'http://localhost:5173/auth/callback'
  const callback_link = fragment ? `${base}#${fragment}` : null
  let verify_link = null
  if (!callback_link && actionLink.includes('redirect_to=')) {
    const u = new URL(actionLink)
    u.searchParams.set('redirect_to', base)
    verify_link = u.toString()
  }
  return res.status(200).json({ data, callback_link, verify_link })
})
app.get('/admin/auth-generate-link', async (req, res) => {
  const email = req.query && req.query.email
  if (!email) return res.status(400).json({ error: 'missing email' })
  const type = (req.query && req.query.type) || 'magiclink'
  const redirect = (req.query && req.query.redirect) || undefined
  const r = await supabase.auth.admin.generateLink({ type, email, redirectTo: redirect })
  if (r.error) return res.status(400).json({ error: r.error.message })
  const data = r.data || {}
  if (!data.action_link && type === 'magiclink') {
    const r2 = await supabase.auth.admin.generateLink({ type: 'recovery', email, redirectTo: redirect })
    const d2 = r2.data || {}
    const frag2 = (d2.action_link || '').split('#')[1]
    const base2 = redirect || 'http://localhost:5173/auth/callback'
    const callback_link2 = frag2 ? `${base2}#${frag2}` : null
    return res.status(200).json({ data: d2, callback_link: callback_link2 })
  }
  const actionLink = (data.action_link || (data.properties && data.properties.action_link) || '')
  const fragment = actionLink.split('#')[1]
  const base = redirect || 'http://localhost:5173/auth/callback'
  const callback_link = fragment ? `${base}#${fragment}` : null
  let verify_link = null
  if (!callback_link && actionLink.includes('redirect_to=')) {
    const u = new URL(actionLink)
    u.searchParams.set('redirect_to', base)
    verify_link = u.toString()
  }
  return res.status(200).json({ data, callback_link, verify_link })
})
app.post('/admin/create-user', async (req, res) => {
  const email = req.body && req.body.email
  const password = req.body && req.body.password
  const role = (req.body && req.body.role) || 'patient'
  if (!email || !password) return res.status(400).json({ error: 'missing email or password' })
  const r = await supabase.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { role } })
  if (r.error) return res.status(400).json({ error: r.error.message })
  const user = r.data && r.data.user
  if (role === 'patient' && user && user.id) {
    await ensurePatient(user.id)
  }
  return res.status(200).json({ user: { id: user.id, email: user.email }, role })
})
app.post('/admin/promote', async (req, res) => {
  const email = req.body && req.body.email
  const role = (req.body && req.body.role) || 'admin'
  if (!email) return res.status(400).json({ error: 'missing email' })
  const list = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (list.error) return res.status(400).json({ error: list.error.message })
  const users = (list.data && list.data.users) || []
  const u = users.find((x) => x.email === email)
  if (!u) return res.status(404).json({ error: 'user not found' })
  const upd = await supabase.auth.admin.updateUserById(u.id, { app_metadata: { role } })
  if (upd.error) return res.status(400).json({ error: upd.error.message })
  return res.status(200).json({ ok: true, id: u.id, email: u.email, role })
})

async function deletePatientCascade(pid) {
  const out = {}
  const tables = [
    'steps_event', 'steps_hour', 'steps_day',
    'hr_sample', 'hr_hour', 'hr_day',
    'spo2_sample', 'spo2_hour', 'spo2_day',
    'devices'
  ]
  for (const t of tables) {
    const del = await supabase.from(t).delete().eq('patient_id', pid)
    out[t] = { count: (del.data || []).length, error: del.error ? del.error.message : null }
  }
  const delp = await supabase.from('patients').delete().eq('patient_id', pid)
  out.patients_delete = { count: (delp.data || []).length, error: delp.error ? delp.error.message : null }
  return out
}

app.post('/admin/delete-user', async (req, res) => {
  const id = req.body && req.body.id
  const email = req.body && req.body.email
  const cascade = !!(req.body && req.body.cascade)
  if (!id && !email) return res.status(400).json({ error: 'missing id or email' })
  let uid = id
  if (!uid && email) {
    const list = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 })
    if (list.error) return res.status(400).json({ error: list.error.message })
    const users = (list.data && list.data.users) || []
    const u = users.find((x) => x.email === email)
    if (!u) return res.status(404).json({ error: 'user not found' })
    uid = u.id
  }
  const del = await supabase.auth.admin.deleteUser(uid)
  if (del.error) return res.status(400).json({ error: del.error.message })
  let cascade_result = null
  if (cascade) {
    cascade_result = await deletePatientCascade(uid)
  }
  return res.status(200).json({ ok: true, id: uid, cascade: cascade_result })
})

app.post('/admin/ban-user', async (req, res) => {
  const id = req.body && req.body.id
  const email = req.body && req.body.email
  const duration = (req.body && req.body.duration) || 'forever'
  if (!id && !email) return res.status(400).json({ error: 'missing id or email' })
  let uid = id
  if (!uid && email) {
    const list = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 })
    if (list.error) return res.status(400).json({ error: list.error.message })
    const users = (list.data && list.data.users) || []
    const u = users.find((x) => x.email === email)
    if (!u) return res.status(404).json({ error: 'user not found' })
    uid = u.id
  }
  const upd = await supabase.auth.admin.updateUserById(uid, { ban_duration: duration, app_metadata: { deleted: true } })
  if (upd.error) return res.status(400).json({ error: upd.error.message })
  return res.status(200).json({ ok: true, id: uid, ban_duration: duration })
})

app.post('/admin/anonymize-user', async (req, res) => {
  const id = req.body && req.body.id
  const email = req.body && req.body.email
  if (!id && !email) return res.status(400).json({ error: 'missing id or email' })
  let uid = id
  let currentEmail = email
  if (!uid || !currentEmail) {
    const list = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 })
    if (list.error) return res.status(400).json({ error: list.error.message })
    const users = (list.data && list.data.users) || []
    const u = uid ? users.find((x) => x.id === uid) : users.find((x) => x.email === email)
    if (!u) return res.status(404).json({ error: 'user not found' })
    uid = u.id
    currentEmail = u.email
  }
  const ts = Date.now()
  const anonym = `deleted+${uid}+${ts}@example.invalid`
  const upd = await supabase.auth.admin.updateUserById(uid, { email: anonym, app_metadata: { deleted: true, role: null } })
  if (upd.error) return res.status(400).json({ error: upd.error.message })
  return res.status(200).json({ ok: true, id: uid, old_email: currentEmail, new_email: anonym })
})

app.post('/admin/delete-patient', async (req, res) => {
  const pid = req.body && req.body.patientId
  if (!pid) return res.status(400).json({ error: 'missing patientId' })
  const result = await deletePatientCascade(pid)
  return res.status(200).json({ ok: true, patientId: pid, result })
})

app.post('/admin/update-email', async (req, res) => {
  const id = req.body && req.body.id
  const email = req.body && req.body.email
  if (!id || !email) return res.status(400).json({ error: 'missing id or email' })
  const upd = await supabase.auth.admin.updateUserById(id, { email, email_confirm: true })
  if (upd.error) return res.status(400).json({ error: upd.error.message })
  return res.status(200).json({ ok: true, id, email })
})
app.post('/ingest/steps-events', async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body]
  // console.log('POST /ingest/steps-events', { count: items.length })
  if (!items.length) return res.status(200).json({ inserted: 0, upserted_hour: 0, upserted_day: 0 })
  const patientId = items[0].patientId
  const origins = [...new Set(items.map((i) => i.originId).filter(Boolean))]
  const devices = [...new Set(items.map((i) => i.deviceId).filter(Boolean))]
  const ep = await ensurePatient(patientId)
  if (!ep.ok) return res.status(400).json({ error: `patient upsert failed: ${ep.error}` })
  const eo = await ensureOrigins(origins)
  if (!eo.ok) return res.status(400).json({ error: `origin upsert failed: ${eo.error}` })
  const ed = await ensureDevices(devices, patientId)
  if (!ed.ok) return res.status(400).json({ error: `device upsert failed: ${ed.error}` })
  const raw = items.map((i) => ({
    patient_id: i.patientId,
    origin_id: i.originId,
    device_id: i.deviceId,
    start_ts: i.startTs,
    end_ts: i.endTs,
    count: i.count,
    record_uid: i.recordUid,
  }))
  const ins = await supabase.from('steps_event').upsert(raw, { onConflict: 'record_uid', ignoreDuplicates: true })
  if (ins.error) {
    console.error('steps_event upsert error', ins.error)
    return res.status(400).json({ error: ins.error.message })
  }
  const byHour = new Map()
  const byDay = new Map()
  for (const i of items) {
    const offset = i.tzOffsetMin || 0
    const h = toHourWithOffset(i.endTs, offset)
    const d = toDateWithOffset(i.endTs, offset)
    const hk = `${i.patientId}|${h}`
    const dk = `${i.patientId}|${d}`
    byHour.set(hk, (byHour.get(hk) || 0) + (i.count || 0))
    byDay.set(dk, (byDay.get(dk) || 0) + (i.count || 0))
  }
  const hourRows = []
  for (const [k, v] of byHour) {
    const [pid, h] = k.split('|')
    hourRows.push({ patient_id: pid, hour_ts: h, steps_total: v })
  }
  const dayRows = []
  for (const [k, v] of byDay) {
    const [pid, d] = k.split('|')
    dayRows.push({ patient_id: pid, date: d, steps_total: v })
  }
  const uph = await supabase.from('steps_hour').upsert(hourRows, { onConflict: 'patient_id,hour_ts' })
  if (uph.error) {
    console.error('steps_hour upsert error', uph.error)
    return res.status(400).json({ error: uph.error.message })
  }
  const upd = await supabase.from('steps_day').upsert(dayRows, { onConflict: 'patient_id,date' })
  if (upd.error) {
    console.error('steps_day upsert error', upd.error)
    return res.status(400).json({ error: upd.error.message })
  }
  return res.status(200).json({ inserted: (ins.data || []).length, upserted_hour: hourRows.length, upserted_day: dayRows.length })
})
app.post('/ingest/hr-samples', async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body]
  // console.log('POST /ingest/hr-samples', { count: items.length })
  if (!items.length) return res.status(200).json({ inserted: 0, upserted_hour: 0, upserted_day: 0 })
  const patientId = items[0].patientId
  const origins = [...new Set(items.map((i) => i.originId).filter(Boolean))]
  const devices = [...new Set(items.map((i) => i.deviceId).filter(Boolean))]
  const ep = await ensurePatient(patientId)
  if (!ep.ok) return res.status(400).json({ error: `patient upsert failed: ${ep.error}` })
  const eo = await ensureOrigins(origins)
  if (!eo.ok) return res.status(400).json({ error: `origin upsert failed: ${eo.error}` })
  const ed = await ensureDevices(devices, patientId)
  if (!ed.ok) return res.status(400).json({ error: `device upsert failed: ${ed.error}` })
  const raw = items.map((i) => ({
    patient_id: i.patientId,
    origin_id: i.originId,
    device_id: i.deviceId,
    time_ts: i.timeTs,
    bpm: i.bpm,
    record_uid: i.recordUid,
  }))
  const ins = await supabase.from('hr_sample').upsert(raw, { onConflict: 'record_uid', ignoreDuplicates: true })
  if (ins.error) {
    console.error('hr_sample upsert error', ins.error)
    return res.status(400).json({ error: ins.error.message })
  }
  const hourAgg = new Map()
  const dayAgg = new Map()
  for (const i of items) {
    const offset = i.tzOffsetMin || 0
    const h = toHourWithOffset(i.timeTs, offset)
    const d = toDateWithOffset(i.timeTs, offset)
    const hk = `${i.patientId}|${h}`
    const dk = `${i.patientId}|${d}`
    const ha = hourAgg.get(hk) || { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY, sum: 0, count: 0 }
    ha.min = Math.min(ha.min, i.bpm)
    ha.max = Math.max(ha.max, i.bpm)
    ha.sum += i.bpm
    ha.count += 1
    hourAgg.set(hk, ha)
    const da = dayAgg.get(dk) || { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY, sum: 0, count: 0 }
    da.min = Math.min(da.min, i.bpm)
    da.max = Math.max(da.max, i.bpm)
    da.sum += i.bpm
    da.count += 1
    dayAgg.set(dk, da)
  }
  const hourRows = []
  for (const [k, a] of hourAgg) {
    const [pid, h] = k.split('|')
    const avg = a.count ? a.sum / a.count : 0
    hourRows.push({ patient_id: pid, hour_ts: h, hr_min: Math.round(a.min), hr_max: Math.round(a.max), hr_avg: avg, hr_count: a.count })
  }
  const dayRows = []
  for (const [k, a] of dayAgg) {
    const [pid, d] = k.split('|')
    const avg = a.count ? a.sum / a.count : 0
    dayRows.push({ patient_id: pid, date: d, hr_min: Math.round(a.min), hr_max: Math.round(a.max), hr_avg: avg, hr_count: a.count })
  }
  const uph = await supabase.from('hr_hour').upsert(hourRows, { onConflict: 'patient_id,hour_ts' })
  if (uph.error) {
    console.error('hr_hour upsert error', uph.error)
    return res.status(400).json({ error: uph.error.message })
  }
  const upd = await supabase.from('hr_day').upsert(dayRows, { onConflict: 'patient_id,date' })
  if (upd.error) {
    console.error('hr_day upsert error', upd.error)
    return res.status(400).json({ error: upd.error.message })
  }
  return res.status(200).json({ inserted: (ins.data || []).length, upserted_hour: hourRows.length, upserted_day: dayRows.length })
})
app.post('/ingest/spo2-samples', async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body]
  // console.log('POST /ingest/spo2-samples', { count: items.length })
  if (!items.length) return res.status(200).json({ inserted: 0, upserted_hour: 0, upserted_day: 0 })
  const patientId = items[0].patientId
  const origins = [...new Set(items.map((i) => i.originId).filter(Boolean))]
  const devices = [...new Set(items.map((i) => i.deviceId).filter(Boolean))]
  const ep = await ensurePatient(patientId)
  if (!ep.ok) return res.status(400).json({ error: `patient upsert failed: ${ep.error}` })
  const eo = await ensureOrigins(origins)
  if (!eo.ok) return res.status(400).json({ error: `origin upsert failed: ${eo.error}` })
  const ed = await ensureDevices(devices, patientId)
  if (!ed.ok) return res.status(400).json({ error: `device upsert failed: ${ed.error}` })
  const raw = items.map((i) => ({
    patient_id: i.patientId,
    origin_id: i.originId,
    device_id: i.deviceId,
    time_ts: i.timeTs,
    spo2_pct: i.spo2Pct,
    record_uid: i.recordUid,
  }))
  const ins = await supabase.from('spo2_sample').upsert(raw, { onConflict: 'record_uid', ignoreDuplicates: true })
  if (ins.error) {
    console.error('spo2_sample upsert error', ins.error)
    return res.status(400).json({ error: ins.error.message })
  }
  const hourAgg = new Map()
  const dayAgg = new Map()
  for (const i of items) {
    const offset = i.tzOffsetMin || 0
    const h = toHourWithOffset(i.timeTs, offset)
    const d = toDateWithOffset(i.timeTs, offset)
    const hk = `${i.patientId}|${h}`
    const dk = `${i.patientId}|${d}`
    const ha = hourAgg.get(hk) || { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY, sum: 0, count: 0 }
    ha.min = Math.min(ha.min, i.spo2Pct)
    ha.max = Math.max(ha.max, i.spo2Pct)
    ha.sum += i.spo2Pct
    ha.count += 1
    hourAgg.set(hk, ha)
    const da = dayAgg.get(dk) || { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY, sum: 0, count: 0 }
    da.min = Math.min(da.min, i.spo2Pct)
    da.max = Math.max(da.max, i.spo2Pct)
    da.sum += i.spo2Pct
    da.count += 1
    dayAgg.set(dk, da)
  }
  const hourRows = []
  for (const [k, a] of hourAgg) {
    const [pid, h] = k.split('|')
    const avg = a.count ? a.sum / a.count : 0
    hourRows.push({ patient_id: pid, hour_ts: h, spo2_min: a.min, spo2_max: a.max, spo2_avg: avg, spo2_count: a.count })
  }
  const dayRows = []
  for (const [k, a] of dayAgg) {
    const [pid, d] = k.split('|')
    const avg = a.count ? a.sum / a.count : 0
    dayRows.push({ patient_id: pid, date: d, spo2_min: a.min, spo2_max: a.max, spo2_avg: avg, spo2_count: a.count })
  }
  const uph = await supabase.from('spo2_hour').upsert(hourRows, { onConflict: 'patient_id,hour_ts' })
  if (uph.error) {
    console.error('spo2_hour upsert error', uph.error)
    return res.status(400).json({ error: uph.error.message })
  }
  const upd = await supabase.from('spo2_day').upsert(dayRows, { onConflict: 'patient_id,date' })
  if (upd.error) {
    console.error('spo2_day upsert error', upd.error)
    return res.status(400).json({ error: upd.error.message })
  }
  return res.status(200).json({ inserted: (ins.data || []).length, upserted_hour: hourRows.length, upserted_day: dayRows.length })
})
const port = process.env.PORT || 3001
app.listen(port, () => process.stdout.write(`server:${port}\n`))