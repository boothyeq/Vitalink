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
function toHour(ts) {
  const d = new Date(ts)
  d.setUTCMinutes(0, 0, 0)
  return d.toISOString()
}
function toDate(ts) {
  const d = new Date(ts)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
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
app.post('/dev/ensure-patient', async (req, res) => {
  const pid = req.body && req.body.patientId
  if (!pid) return res.status(400).json({ error: 'missing patientId' })
  const r = await ensurePatient(pid)
  if (!r.ok) return res.status(400).json({ ok: false, error: r.error })
  return res.status(200).json({ ok: true })
})

app.post('/dev/db-check', async (req, res) => {
  const pid = (req.body && req.body.patientId) || '00000000-0000-0000-0000-000000000001'
  const out = { patientId: pid }
  const en = await ensurePatient(pid)
  out.ensurePatient = en
  const p1 = await supabase.from('patients').select('id').eq('id', pid).limit(1)
  out.patients_select = { count: (p1.data || []).length, error: p1.error ? p1.error.message : null }
  const p2 = await supabase.from('patient').select('id').eq('id', pid).limit(1)
  out.patient_select = { count: (p2.data || []).length, error: p2.error ? p2.error.message : null }
  const d1 = await supabase.from('devices').select('device_id,patient_id').eq('patient_id', pid).limit(1)
  out.devices_select = { count: (d1.data || []).length, error: d1.error ? d1.error.message : null }
  return res.status(200).json(out)
})
app.post('/dev/reset-two-users', async (req, res) => {
  const users = (req.body && req.body.users) || ['Mi-User-01', 'Fitbit-User-01']
  const out = { users }
  if (supabaseMock) {
    out.mock = true
    return res.status(200).json(out)
  }
  const tables = [
    'steps_event', 'steps_hour', 'steps_day',
    'hr_sample', 'hr_hour', 'hr_day',
    'spo2_sample', 'spo2_hour', 'spo2_day',
    'devices'
  ]
  for (const t of tables) {
    const del = await supabase.from(t).delete().in('patient_id', users)
    out[t] = { count: (del.data || []).length, error: del.error ? del.error.message : null }
  }
  const delp = await supabase.from('patients').delete().in('patient_id', users)
  out.patients_delete = { count: (delp.data || []).length, error: delp.error ? delp.error.message : null }
  const rows = users.map((u, i) => ({ patient_id: u, first_name: u.split('-')[0], last_name: String(i + 1), dob: '1970-01-01' }))
  const ins = await supabase.from('patients').upsert(rows, { onConflict: 'patient_id' })
  out.patients_upsert = { count: (ins.data || []).length, error: ins.error ? ins.error.message : null }
  return res.status(200).json(out)
})
app.get('/dev/reset-two-users', async (req, res) => {
  const users = ['Mi-User-01', 'Fitbit-User-01']
  const out = { users }
  if (supabaseMock) {
    out.mock = true
    return res.status(200).json(out)
  }
  const tables = [
    'steps_event', 'steps_hour', 'steps_day',
    'hr_sample', 'hr_hour', 'hr_day',
    'spo2_sample', 'spo2_hour', 'spo2_day',
    'devices'
  ]
  for (const t of tables) {
    const del = await supabase.from(t).delete().in('patient_id', users)
    out[t] = { count: (del.data || []).length, error: del.error ? del.error.message : null }
  }
  const delp = await supabase.from('patients').delete().in('patient_id', users)
  out.patients_delete = { count: (delp.data || []).length, error: delp.error ? delp.error.message : null }
  const rows = users.map((u, i) => ({ patient_id: u, first_name: u.split('-')[0], last_name: String(i + 1), dob: '1970-01-01' }))
  const ins = await supabase.from('patients').upsert(rows, { onConflict: 'patient_id' })
  out.patients_upsert = { count: (ins.data || []).length, error: ins.error ? ins.error.message : null }
  return res.status(200).json(out)
})
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
app.post('/ingest/steps-events', async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body]
  console.log('POST /ingest/steps-events', { count: items.length })
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
  console.log('POST /ingest/hr-samples', { count: items.length })
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
  console.log('POST /ingest/spo2-samples', { count: items.length })
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