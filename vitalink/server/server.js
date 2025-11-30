const express = require('express')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()
const app = express()
app.use(express.json({ limit: '5mb' }))
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization')
  res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS')
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
    data: [],
    error: null,
    select() { return this },
    eq() { return this },
    order() { return this },
    limit() { return this },
    range() { return this },
    gte() { return this },
    lte() { return this },
    in() { return this },
    async upsert() { return { data: [], error: null } },
    async delete() { return { data: [], error: null } },
  }
  supabase = { from() { return api }, auth: { admin: { async getUserById() { return { data: { user: { id: 'mock', app_metadata: { role: 'patient' } } }, error: null } }, async listUsers() { return { data: { users: [] }, error: null } }, async createUser() { return { data: { user: { id: 'mock', email: 'mock@example.invalid' } }, error: null } }, async updateUserById() { return { data: {}, error: null } }, async deleteUser() { return { data: {}, error: null } }, async generateLink() { return { data: { action_link: '' }, error: null } } } } }
}

async function validatePatientId(patientId) {
  if (!patientId) return { ok: false, error: 'missing patientId' }
  if (supabaseMock) return { ok: true }
  try {
    const r = await supabase.auth.admin.getUserById(patientId)
    if (r.error) return { ok: false, error: r.error.message }
    const u = r.data && r.data.user
    if (!u) return { ok: false, error: 'user not found' }
    const role = (u.app_metadata && u.app_metadata.role) || null
    if (role !== 'patient') return { ok: false, error: 'user is not patient' }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) }
  }
}
function toHourWithOffset(ts, offsetMin) {
  const d = new Date(Date.parse(ts) + (offsetMin || 0) * 60000)
  d.setUTCMinutes(0, 0, 0)
  return d.toISOString()
}
function toMinuteWithOffset(ts, offsetMin) {
  const d = new Date(Date.parse(ts) + (offsetMin || 0) * 60000)
  d.setUTCSeconds(0, 0)
  return d.toISOString()
}
function toDateWithOffset(ts, offsetMin) {
  const d = new Date(Date.parse(ts) + (offsetMin || 0) * 60000)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function toInt(v) {
  const n = typeof v === 'number' ? v : parseInt(String(v || '0'), 10)
  return Number.isFinite(n) ? n : 0
}
async function ensurePatient(patientId, info) {
  if (!patientId) return { ok: false, error: 'missing patientId' }
  const existing = await supabase.from('patients').select('patient_id,first_name,last_name,dob').eq('patient_id', patientId).range(0, 0)
  if (existing.error) {
    console.error('ensurePatient select error', existing.error)
  }
  const pr = (existing.data && existing.data[0]) || null
  const first = (info && info.firstName) ? info.firstName : (pr && pr.first_name ? pr.first_name : 'User')
  const last = (info && info.lastName) ? info.lastName : (pr && pr.last_name ? pr.last_name : 'Patient')
  const dob = (info && info.dateOfBirth) ? info.dateOfBirth : (pr && pr.dob ? pr.dob : '1970-01-01')
  const row = {
    patient_id: patientId,
    first_name: first,
    last_name: last,
    dob,
  }
  const clean = Object.fromEntries(Object.entries(row).filter(([_, v]) => v !== undefined))
  const res = await supabase.from('patients').upsert([clean], { onConflict: 'patient_id' })
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
  const info = {
    firstName: req.body && req.body.firstName,
    lastName: req.body && req.body.lastName,
    dateOfBirth: req.body && req.body.dateOfBirth,
  }
  const r = await ensurePatient(pid, info)
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
  const rows = await supabase.from('patients').select('patient_id').range(0, 999)
  if (rows.error) return res.status(400).json({ error: rows.error.message })
  out.users = (rows.data || []).map((r) => r.patient_id)
  return res.status(200).json(out)
})
app.get('/admin/patient-info', async (req, res) => {
  const pid = (req.query && req.query.patientId)
  if (!pid) return res.status(400).json({ error: 'missing patientId' })
  let p = await supabase.from('patients').select('patient_id,first_name,last_name,dob').eq('patient_id', pid).range(0, 0)
  if (p.error) return res.status(400).json({ error: p.error.message })
  let pr = (p.data && p.data[0]) || null
  if (!pr || (pr.first_name === 'User' && pr.last_name === 'Patient')) {
    const admin = await supabase.auth.admin.getUserById(pid)
    const user = admin && admin.data && admin.data.user
    const meta = (user && user.user_metadata) || {}
    const info = { firstName: meta.firstName, lastName: meta.lastName, dateOfBirth: meta.dateOfBirth }
    if (info.firstName || info.lastName || info.dateOfBirth) {
      const r = await ensurePatient(pid, info)
      if (r && r.ok) {
        p = await supabase.from('patients').select('patient_id,first_name,last_name,dob').eq('patient_id', pid).range(0, 0)
        pr = (p.data && p.data[0]) || null
      }
    }
  }
  const d = await supabase.from('devices').select('device_id').eq('patient_id', pid).range(0, 99)
  const warnings = []
  if (!pr) warnings.push('missing patient record')
  if (pr && !pr.dob) warnings.push('missing dob')
  if (pr && pr.first_name === 'User' && pr.last_name === 'Patient') warnings.push('default name used')
  if (d.error) warnings.push('devices query error: ' + d.error.message)
  else if ((d.data || []).length === 0) warnings.push('no linked devices')
  return res.status(200).json({ patient: pr, devicesCount: (d.data || []).length, warnings })
})
app.get('/admin/check-data', async (req, res) => {
  const pid = (req.query && req.query.patientId)
  if (!pid) return res.status(400).json({ error: 'missing patientId' })
  const weight = await supabase.from('weight_sample').select('time_ts,kg').eq('patient_id', pid).order('time_ts', { ascending: false }).range(0, 9)
  const symptoms = await supabase.from('symptom_log').select('logged_at,cough,sob_activity,leg_swelling,sudden_weight_gain,abd_discomfort,orthopnea,notes').eq('patient_id', pid).order('logged_at', { ascending: false }).range(0, 9)
  const out = {
    weightCount: weight.error ? 0 : (weight.data || []).length,
    latestWeight: weight.error ? null : ((weight.data || [])[0] || null),
    symptomsCount: symptoms.error ? 0 : (symptoms.data || []).length,
    latestSymptoms: symptoms.error ? null : ((symptoms.data || [])[0] || null),
    symptomsError: symptoms.error ? symptoms.error.message : null,
    weightError: weight.error ? weight.error.message : null,
  }
  return res.status(200).json(out)
})
app.get('/admin/hr-dates', async (req, res) => {
  const pid = (req.query && req.query.patientId)
  if (!pid) return res.status(400).json({ error: 'missing patientId' })
  const rows = await supabase
    .from('hr_day')
    .select('date,hr_min,hr_max,hr_avg,hr_count')
    .eq('patient_id', pid)
    .order('date', { ascending: true })
  if (rows.error) return res.status(400).json({ error: rows.error.message })
  return res.status(200).json({ count: (rows.data || []).length, dates: (rows.data || []).map(r => r.date) })
})
app.post('/admin/wipe-hr', async (req, res) => {
  const pid = req.body && req.body.patientId
  const sinceDate = req.body && req.body.sinceDate
  if (!pid) return res.status(400).json({ error: 'missing patientId' })
  const vp = await validatePatientId(pid)
  if (!vp.ok && !supabaseMock) return res.status(400).json({ error: `invalid patient: ${vp.error}` })
  const out = {}
  if (sinceDate) {
    const startTs = `${sinceDate}T00:00:00.000Z`
    const ddel = await supabase.from('hr_day').delete().eq('patient_id', pid).gte('date', sinceDate)
    const hdel = await supabase.from('hr_hour').delete().eq('patient_id', pid).gte('hour_ts', startTs)
    const sdel = await supabase.from('hr_sample').delete().eq('patient_id', pid).gte('time_ts', startTs)
    out.hr_day = { count: (ddel.data || []).length, error: ddel.error ? ddel.error.message : null }
    out.hr_hour = { count: (hdel.data || []).length, error: hdel.error ? hdel.error.message : null }
    out.hr_sample = { count: (sdel.data || []).length, error: sdel.error ? sdel.error.message : null }
  } else {
    const ddel = await supabase.from('hr_day').delete().eq('patient_id', pid)
    const hdel = await supabase.from('hr_hour').delete().eq('patient_id', pid)
    const sdel = await supabase.from('hr_sample').delete().eq('patient_id', pid)
    out.hr_day = { count: (ddel.data || []).length, error: ddel.error ? ddel.error.message : null }
    out.hr_hour = { count: (hdel.data || []).length, error: hdel.error ? hdel.error.message : null }
    out.hr_sample = { count: (sdel.data || []).length, error: sdel.error ? sdel.error.message : null }
  }
  return res.status(200).json(out)
})
app.get('/admin/summary', async (req, res) => {
  const users = await supabase.from('patients').select('patient_id').range(0, 999)
  if (users.error) return res.status(400).json({ error: users.error.message })
  const ids = (users.data || []).map((r) => r.patient_id)
  const out = []
  for (const pid of ids) {
    const s = await supabase.from('steps_day').select('date,steps_total').eq('patient_id', pid).order('date', { ascending: false }).range(0, 0)
    const h = await supabase.from('hr_day').select('date,hr_min,hr_max,hr_avg,hr_count').eq('patient_id', pid).order('date', { ascending: false }).range(0, 0)
    const o = await supabase.from('spo2_day').select('date,spo2_min,spo2_max,spo2_avg,spo2_count').eq('patient_id', pid).order('date', { ascending: false }).range(0, 0)
    out.push({
      patientId: pid,
      steps: (s.data && s.data[0]) || null,
      hr: (h.data && h.data[0]) || null,
      spo2: (o.data && o.data[0]) || null,
    })
  }
  return res.status(200).json({ summary: out })
})

// Patient endpoints for dashboard
app.get('/patient/summary', async (req, res) => {
  const pid = (req.query && req.query.patientId)
  if (!pid) return res.status(400).json({ error: 'missing patientId' })
  const hr = await supabase.from('hr_day').select('date,hr_avg').eq('patient_id', pid).order('date', { ascending: false }).range(0, 0)
  if (hr.error) return res.status(400).json({ error: hr.error.message })
  const row = (hr.data && hr.data[0]) || null
  const st = await supabase.from('steps_day').select('date,steps_total').eq('patient_id', pid).order('date', { ascending: false }).range(0, 0)
  if (st.error) return res.status(400).json({ error: st.error.message })
  const srow = (st.data && st.data[0]) || null
  const bp = await supabase.from('bp_sample').select('time_ts,systolic_mmhg,diastolic_mmhg').eq('patient_id', pid).order('time_ts', { ascending: false }).range(0, 0)
  if (bp.error) return res.status(400).json({ error: bp.error.message })
  const brow = (bp.data && bp.data[0]) || null
  const wt = await supabase.from('weight_sample').select('time_ts,kg').eq('patient_id', pid).order('time_ts', { ascending: false }).range(0, 0)
  if (wt.error) return res.status(400).json({ error: wt.error.message })
  const wrow = (wt.data && wt.data[0]) || null
  const summary = {
    heartRate: row ? Math.round(row.hr_avg || 0) : null,
    bpSystolic: brow ? brow.systolic_mmhg || null : null,
    bpDiastolic: brow ? brow.diastolic_mmhg || null : null,
    weightKg: wrow ? wrow.kg || null : null,
    nextAppointmentDate: null,
    stepsToday: srow ? Math.round(srow.steps_total || 0) : null,
  }
  return res.status(200).json({ summary })
})

app.get('/patient/vitals', async (req, res) => {
  const pid = (req.query && req.query.patientId)
  const period = (req.query && req.query.period) || 'hourly'
  const date = (req.query && req.query.date)
  const tzOffsetMinRaw = (req.query && req.query.tzOffsetMin)
  const tzOffsetMin = typeof tzOffsetMinRaw === 'string' ? parseInt(tzOffsetMinRaw, 10) : undefined
  if (!pid) return res.status(400).json({ error: 'missing patientId' })
  let out = { hr: [], spo2: [], steps: [], bp: [], weight: [] }
  if (period === 'weekly') {
    const hr = await supabase
      .from('hr_day')
      .select('date,hr_min,hr_max,hr_avg')
      .eq('patient_id', pid)
      .order('date', { ascending: false })
      .range(0, 6)
    if (hr.error) return res.status(400).json({ error: hr.error.message })
    const spo2 = await supabase
      .from('spo2_day')
      .select('date,spo2_min,spo2_max,spo2_avg')
      .eq('patient_id', pid)
      .order('date', { ascending: false })
      .range(0, 6)
    if (spo2.error) return res.status(400).json({ error: spo2.error.message })
    const steps = await supabase
      .from('steps_day')
      .select('date,steps_total')
      .eq('patient_id', pid)
      .order('date', { ascending: false })
      .range(0, 6)
    if (steps.error) return res.status(400).json({ error: steps.error.message })
    const hrDays = (hr.data || []).reverse()
    const dayKeys = hrDays.map((r) => r.date)
    const startKey = dayKeys[0]
    const endKey = dayKeys[dayKeys.length - 1]
    let restingMap = new Map()
    if (startKey && endKey) {
      const startTs = `${startKey}T00:00:00.000Z`
      const endTs = `${endKey}T23:59:59.999Z`
      const hrs = await supabase
        .from('hr_hour')
        .select('hour_ts,hr_avg,hr_count')
        .eq('patient_id', pid)
        .gte('hour_ts', startTs)
        .lte('hour_ts', endTs)
        .order('hour_ts', { ascending: true })
      if (!hrs.error) {
        const byDay = new Map()
        for (const row of (hrs.data || [])) {
          const d = new Date(row.hour_ts)
          const y = d.getUTCFullYear()
          const m = String(d.getUTCMonth() + 1).padStart(2, '0')
          const day = String(d.getUTCDate()).padStart(2, '0')
          const key = `${y}-${m}-${day}`
          const h = d.getUTCHours()
          const arr = byDay.get(key) || []
          arr.push({ h, avg: row.hr_avg, count: row.hr_count })
          byDay.set(key, arr)
        }
        for (const [dk, arr] of byDay) {
          const night = arr.filter(x => x.h >= 0 && x.h <= 6 && (x.count || 0) >= 10).sort((a,b)=>a.h-b.h)
          let val
          if (night.length >= 1) {
            let best = { score: Infinity, vals: [] }
            for (let i = 0; i < night.length; i++) {
              const w = [night[i], night[i+1], night[i+2]].filter(Boolean)
              if (w.length) {
                const score = w.reduce((s, x) => s + (x.avg || 0), 0) / w.length
                const vals = w.map(x => x.avg || 0).sort((a,b)=>a-b)
                const mid = Math.floor(vals.length/2)
                const median = vals.length % 2 ? vals[mid] : (vals[mid-1]+vals[mid])/2
                if (score < best.score) best = { score, vals: [median] }
              }
            }
            val = best.vals[0]
          } else {
            const dayAgg = hrDays.find(r => r.date === dk)
            val = dayAgg ? dayAgg.hr_min || null : null
          }
          if (val != null) restingMap.set(dk, Math.round(val))
        }
      }
    }
    const bp = await supabase
      .from('bp_day')
      .select('date,sbp_min,sbp_max,sbp_avg,dbp_min,dbp_max,dbp_avg,pulse_avg')
      .eq('patient_id', pid)
      .order('date', { ascending: false })
      .range(0, 6)
    if (bp.error) return res.status(400).json({ error: bp.error.message })
    const weight = await supabase
      .from('weight_day')
      .select('date,kg_min,kg_max,kg_avg')
      .eq('patient_id', pid)
      .order('date', { ascending: false })
      .range(0, 6)
    if (weight.error) return res.status(400).json({ error: weight.error.message })
    out = {
      hr: hrDays.map((r) => ({ time: r.date, min: Math.round(r.hr_min || 0), avg: Math.round(r.hr_avg || 0), max: Math.round(r.hr_max || 0), resting: restingMap.get(r.date) })),
      spo2: (spo2.data || []).reverse().map((r) => ({ time: r.date, min: Math.round(r.spo2_min || 0), avg: Math.round(r.spo2_avg || 0), max: Math.round(r.spo2_max || 0) })),
      steps: (steps.data || []).reverse().map((r) => ({ time: r.date, count: Math.round(r.steps_total || 0) })),
      bp: (bp.data || []).reverse().map((r) => ({ time: r.date, sbp_min: r.sbp_min, sbp_avg: r.sbp_avg, sbp_max: r.sbp_max, dbp_min: r.dbp_min, dbp_avg: r.dbp_avg, dbp_max: r.dbp_max, pulse_avg: r.pulse_avg })),
      weight: (weight.data || []).reverse().map((r) => ({ time: r.date, kg_min: r.kg_min, kg_avg: r.kg_avg, kg_max: r.kg_max })),
    }
  } else if (period === 'monthly') {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const startStr = start.toISOString().slice(0, 10)
    const endStr = end.toISOString().slice(0, 10)
    const hr = await supabase
      .from('hr_day')
      .select('date,hr_min,hr_max,hr_avg')
      .eq('patient_id', pid)
      .gte('date', startStr)
      .lte('date', endStr)
      .order('date', { ascending: true })
    if (hr.error) return res.status(400).json({ error: hr.error.message })
    const spo2 = await supabase
      .from('spo2_day')
      .select('date,spo2_min,spo2_max,spo2_avg')
      .eq('patient_id', pid)
      .gte('date', startStr)
      .lte('date', endStr)
      .order('date', { ascending: true })
    if (spo2.error) return res.status(400).json({ error: spo2.error.message })
    const steps = await supabase
      .from('steps_day')
      .select('date,steps_total')
      .eq('patient_id', pid)
      .gte('date', startStr)
      .lte('date', endStr)
      .order('date', { ascending: true })
    if (steps.error) return res.status(400).json({ error: steps.error.message })
    const hrDays = (hr.data || [])
    let restingMap = new Map()
    if (startStr && endStr) {
      const startTs = `${startStr}T00:00:00.000Z`
      const endTs = `${endStr}T23:59:59.999Z`
      const hrs = await supabase
        .from('hr_hour')
        .select('hour_ts,hr_avg,hr_count')
        .eq('patient_id', pid)
        .gte('hour_ts', startTs)
        .lte('hour_ts', endTs)
        .order('hour_ts', { ascending: true })
      if (!hrs.error) {
        const byDay = new Map()
        for (const row of (hrs.data || [])) {
          const d = new Date(row.hour_ts)
          const y = d.getUTCFullYear()
          const m = String(d.getUTCMonth() + 1).padStart(2, '0')
          const day = String(d.getUTCDate()).padStart(2, '0')
          const key = `${y}-${m}-${day}`
          const h = d.getUTCHours()
          const arr = byDay.get(key) || []
          arr.push({ h, avg: row.hr_avg, count: row.hr_count })
          byDay.set(key, arr)
        }
        for (const [dk, arr] of byDay) {
          const night = arr.filter(x => x.h >= 0 && x.h <= 6 && (x.count || 0) >= 10).sort((a,b)=>a.h-b.h)
          let val
          if (night.length >= 1) {
            let best = { score: Infinity, vals: [] }
            for (let i = 0; i < night.length; i++) {
              const w = [night[i], night[i+1], night[i+2]].filter(Boolean)
              if (w.length) {
                const score = w.reduce((s, x) => s + (x.avg || 0), 0) / w.length
                const vals = w.map(x => x.avg || 0).sort((a,b)=>a-b)
                const mid = Math.floor(vals.length/2)
                const median = vals.length % 2 ? vals[mid] : (vals[mid-1]+vals[mid])/2
                if (score < best.score) best = { score, vals: [median] }
              }
            }
            val = best.vals[0]
          } else {
            const dayAgg = hrDays.find(r => r.date === dk)
            val = dayAgg ? dayAgg.hr_min || null : null
          }
          if (val != null) restingMap.set(dk, Math.round(val))
        }
      }
    }
    const bp = await supabase
      .from('bp_day')
      .select('date,sbp_min,sbp_max,sbp_avg,dbp_min,dbp_max,dbp_avg,pulse_avg')
      .eq('patient_id', pid)
      .gte('date', startStr)
      .lte('date', endStr)
      .order('date', { ascending: true })
    if (bp.error) return res.status(400).json({ error: bp.error.message })
    const weight = await supabase
      .from('weight_day')
      .select('date,kg_min,kg_max,kg_avg')
      .eq('patient_id', pid)
      .gte('date', startStr)
      .lte('date', endStr)
      .order('date', { ascending: true })
    if (weight.error) return res.status(400).json({ error: weight.error.message })
    out = {
      hr: hrDays.map((r) => ({ time: r.date, min: Math.round(r.hr_min || 0), avg: Math.round(r.hr_avg || 0), max: Math.round(r.hr_max || 0), resting: restingMap.get(r.date) })),
      spo2: (spo2.data || []).map((r) => ({ time: r.date, min: Math.round(r.spo2_min || 0), avg: Math.round(r.spo2_avg || 0), max: Math.round(r.spo2_max || 0) })),
      steps: (steps.data || []).map((r) => ({ time: r.date, count: Math.round(r.steps_total || 0) })),
      bp: (bp.data || []).map((r) => ({ time: r.date, sbp_min: r.sbp_min, sbp_avg: r.sbp_avg, sbp_max: r.sbp_max, dbp_min: r.dbp_min, dbp_avg: r.dbp_avg, dbp_max: r.dbp_max, pulse_avg: r.pulse_avg })),
      weight: (weight.data || []).map((r) => ({ time: r.date, kg_min: r.kg_min, kg_avg: r.kg_avg, kg_max: r.kg_max })),
    }
  } else {
    const qHr = supabase.from('hr_hour').select('hour_ts,hr_min,hr_max,hr_avg').eq('patient_id', pid)
    const qSp = supabase.from('spo2_hour').select('hour_ts,spo2_min,spo2_max,spo2_avg').eq('patient_id', pid)
    const qSt = supabase.from('steps_hour').select('hour_ts,steps_total').eq('patient_id', pid)
    let hr, spo2, steps
    if (date) {
      const baseStart = new Date(`${date}T00:00:00.000Z`)
      const startTs = tzOffsetMin ? new Date(baseStart.getTime() - tzOffsetMin * 60000).toISOString() : `${date}T00:00:00.000Z`
      const endTs = tzOffsetMin ? new Date(new Date(startTs).getTime() + 24 * 60 * 60000 - 1).toISOString() : `${date}T23:59:59.999Z`
      hr = await qHr.gte('hour_ts', startTs).lte('hour_ts', endTs).order('hour_ts', { ascending: true })
      if (hr.error) return res.status(400).json({ error: hr.error.message })
      spo2 = await qSp.gte('hour_ts', startTs).lte('hour_ts', endTs).order('hour_ts', { ascending: true })
      if (spo2.error) return res.status(400).json({ error: spo2.error.message })
      steps = await qSt.gte('hour_ts', startTs).lte('hour_ts', endTs).order('hour_ts', { ascending: true })
      if (steps.error) return res.status(400).json({ error: steps.error.message })
    } else {
      hr = await qHr.order('hour_ts', { ascending: false }).range(0, 23)
      if (hr.error) return res.status(400).json({ error: hr.error.message })
      spo2 = await qSp.order('hour_ts', { ascending: false }).range(0, 23)
      if (spo2.error) return res.status(400).json({ error: spo2.error.message })
      steps = await qSt.order('hour_ts', { ascending: false }).range(0, 23)
      if (steps.error) return res.status(400).json({ error: steps.error.message })
    }
    const bp = { data: [] }
    let weight = await supabase
      .from('weight_sample')
      .select('time_ts,kg')
      .eq('patient_id', pid)
      .order('time_ts', { ascending: false })
      .range(0, 29)
    if (weight.error) weight = { data: [] }
    out = {
      hr: (date ? (hr.data || []) : (hr.data || []).reverse()).map((r) => ({ time: r.hour_ts, min: Math.round((r.hr_min ?? r.hr_avg) || 0), avg: Math.round(r.hr_avg || 0), max: Math.round((r.hr_max ?? r.hr_avg) || 0), count: r.hr_count })),
      spo2: (date ? (spo2.data || []) : (spo2.data || []).reverse()).map((r) => ({ time: r.hour_ts, min: Math.round((r.spo2_min ?? r.spo2_avg) || 0), avg: Math.round(r.spo2_avg || 0), max: Math.round((r.spo2_max ?? r.spo2_avg) || 0) })),
      steps: (date ? (steps.data || []) : (steps.data || []).reverse()).map((r) => ({ time: r.hour_ts, count: Math.round(r.steps_total || 0) })),
      bp: [],
      weight: (weight.data || []).reverse().map((r) => ({ time: r.time_ts, kg: r.kg })),
    }
  }
  return res.status(200).json({ vitals: out })
})

app.get('/patient/reminders', async (req, res) => {
  const pid = (req.query && req.query.patientId)
  if (!pid) return res.status(400).json({ error: 'missing patientId' })
  const nowIso = new Date().toISOString()
  const r = await supabase
    .from('patient_reminder')
    .select('id,patient_id,date,title,notes')
    .eq('patient_id', pid)
    .gte('date', nowIso)
    .order('date', { ascending: true })
    .limit(20)
  if (r.error) return res.status(400).json({ error: r.error.message })
  const reminders = (r.data || []).map((x) => ({ id: x.id, date: x.date, title: x.title, notes: x.notes || '' }))
  return res.status(200).json({ reminders })
})

app.post('/patient/reminders', async (req, res) => {
  const pid = req.body && req.body.patientId
  const title = req.body && req.body.title
  const date = req.body && req.body.date
  const notes = (req.body && req.body.notes) || null
  const tzOffsetMinRaw = req.body && req.body.tzOffsetMin
  const tzOffsetMin = typeof tzOffsetMinRaw === 'number' ? tzOffsetMinRaw : (typeof tzOffsetMinRaw === 'string' ? parseInt(tzOffsetMinRaw, 10) : null)
  if (!pid || !title || !date) return res.status(400).json({ error: 'missing patientId, title or date' })
  try {
    const d = new Date(date)
    const local = typeof tzOffsetMin === 'number' ? new Date(d.getTime() + tzOffsetMin * 60000) : d
    const hour = typeof tzOffsetMin === 'number' ? local.getUTCHours() : local.getHours()
    if (hour < 8 || hour > 22) return res.status(400).json({ error: 'appointment time must be between 08:00 and 22:00 local time' })
  } catch (e) {}
  const ins = await supabase.from('patient_reminder').insert([{ patient_id: pid, title, notes, date, tz_offset_min: tzOffsetMin }]).select('id,date,title,notes').single()
  if (ins.error) return res.status(400).json({ error: ins.error.message })
  return res.status(200).json({ reminder: ins.data })
})

app.patch('/patient/reminders/:id', async (req, res) => {
  const pid = req.body && req.body.patientId
  const id = req.params && req.params.id
  const title = req.body && req.body.title
  const date = req.body && req.body.date
  const notes = (req.body && req.body.notes) || null
  const tzOffsetMinRaw = req.body && req.body.tzOffsetMin
  const tzOffsetMin = typeof tzOffsetMinRaw === 'number' ? tzOffsetMinRaw : (typeof tzOffsetMinRaw === 'string' ? parseInt(tzOffsetMinRaw, 10) : null)
  if (!pid || !id) return res.status(400).json({ error: 'missing patientId or id' })
  if (typeof date === 'string') {
    try {
      const d = new Date(date)
      const local = typeof tzOffsetMin === 'number' ? new Date(d.getTime() + tzOffsetMin * 60000) : d
      const hour = typeof tzOffsetMin === 'number' ? local.getUTCHours() : local.getHours()
      if (hour < 8 || hour > 22) return res.status(400).json({ error: 'appointment time must be between 08:00 and 22:00 local time' })
    } catch (e) {}
  }
  const fields = {}
  if (typeof title === 'string') fields.title = title
  if (typeof date === 'string') fields.date = date
  if (typeof notes === 'string' || notes === null) fields.notes = notes
  if (typeof tzOffsetMin === 'number') fields.tz_offset_min = tzOffsetMin
  const upd = await supabase.from('patient_reminder').update(fields).eq('id', id).eq('patient_id', pid).select('id,date,title,notes').single()
  if (upd.error) return res.status(400).json({ error: upd.error.message })
  return res.status(200).json({ reminder: upd.data })
})
// Fallback for environments with CORS issues on PATCH: allow POST to update
app.post('/patient/reminders/:id', async (req, res) => {
  const pid = req.body && req.body.patientId
  const id = req.params && req.params.id
  const title = req.body && req.body.title
  const date = req.body && req.body.date
  const notes = (req.body && req.body.notes) || null
  const tzOffsetMinRaw = req.body && req.body.tzOffsetMin
  const tzOffsetMin = typeof tzOffsetMinRaw === 'number' ? tzOffsetMinRaw : (typeof tzOffsetMinRaw === 'string' ? parseInt(tzOffsetMinRaw, 10) : null)
  if (!pid || !id) return res.status(400).json({ error: 'missing patientId or id' })
  if (typeof date === 'string') {
    try {
      const d = new Date(date)
      const local = typeof tzOffsetMin === 'number' ? new Date(d.getTime() + tzOffsetMin * 60000) : d
      const hour = typeof tzOffsetMin === 'number' ? local.getUTCHours() : local.getHours()
      if (hour < 8 || hour > 22) return res.status(400).json({ error: 'appointment time must be between 08:00 and 22:00 local time' })
    } catch (e) {}
  }
  const fields = {}
  if (typeof title === 'string') fields.title = title
  if (typeof date === 'string') fields.date = date
  if (typeof notes === 'string' || notes === null) fields.notes = notes
  if (typeof tzOffsetMin === 'number') fields.tz_offset_min = tzOffsetMin
  const upd = await supabase.from('patient_reminder').update(fields).eq('id', id).eq('patient_id', pid).select('id,date,title,notes').single()
  if (upd.error) return res.status(400).json({ error: upd.error.message })
  return res.status(200).json({ reminder: upd.data })
})

app.delete('/patient/reminders/:id', async (req, res) => {
  const pid = (req.query && req.query.patientId)
  const id = req.params && req.params.id
  if (!pid || !id) return res.status(400).json({ error: 'missing patientId or id' })
  const del = await supabase.from('patient_reminder').delete().eq('id', id).eq('patient_id', pid)
  if (del.error) return res.status(400).json({ error: del.error.message })
  return res.status(200).json({ ok: true, id })
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
  const base = redirect || (process.env.WEB_URL ? `${process.env.WEB_URL.replace(/\/$/, '')}/auth/callback` : 'http://localhost:5173/auth/callback')
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
    const base2 = redirect || (process.env.WEB_URL ? `${process.env.WEB_URL.replace(/\/$/, '')}/auth/callback` : 'http://localhost:5173/auth/callback')
    const callback_link2 = frag2 ? `${base2}#${frag2}` : null
    return res.status(200).json({ data: d2, callback_link: callback_link2 })
  }
  const actionLink = (data.action_link || (data.properties && data.properties.action_link) || '')
  const fragment = actionLink.split('#')[1]
  const base = redirect || (process.env.WEB_URL ? `${process.env.WEB_URL.replace(/\/$/, '')}/auth/callback` : 'http://localhost:5173/auth/callback')
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
  const id = req.body && req.body.id
  const role = (req.body && req.body.role) || 'admin'
  if (id) {
    const cur = await supabase.auth.admin.getUserById(id)
    if (cur.error) return res.status(400).json({ error: cur.error.message })
    const existing = (cur.data && cur.data.user && cur.data.user.app_metadata) || {}
    const upd = await supabase.auth.admin.updateUserById(id, { app_metadata: { ...existing, role } })
    if (upd.error) return res.status(400).json({ error: upd.error.message })
    return res.status(200).json({ ok: true, id, role })
  }
  if (!email) return res.status(400).json({ error: 'missing id or email' })
  const list = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (list.error) return res.status(400).json({ error: list.error.message })
  const users = (list.data && list.data.users) || []
  const u = users.find((x) => x.email === email)
  if (!u) return res.status(404).json({ error: 'user not found' })
  const cur = await supabase.auth.admin.getUserById(u.id)
  if (cur.error) return res.status(400).json({ error: cur.error.message })
  const existing = (cur.data && cur.data.user && cur.data.user.app_metadata) || {}
  const upd = await supabase.auth.admin.updateUserById(u.id, { app_metadata: { ...existing, role } })
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
  const vp = await validatePatientId(patientId)
  if (!vp.ok) return res.status(400).json({ error: `invalid patient: ${vp.error}` })
  const origins = [...new Set(items.map((i) => i.originId).filter(Boolean))]
  const devices = [...new Set(items.map((i) => i.deviceId).filter(Boolean))]
  const info = { firstName: items[0] && items[0].firstName, lastName: items[0] && items[0].lastName, dateOfBirth: items[0] && items[0].dateOfBirth }
  const ep = await ensurePatient(patientId, info)
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
  const vp = await validatePatientId(patientId)
  if (!vp.ok) return res.status(400).json({ error: `invalid patient: ${vp.error}` })
  const origins = [...new Set(items.map((i) => i.originId).filter(Boolean))]
  const devices = [...new Set(items.map((i) => i.deviceId).filter(Boolean))]
  const info = { firstName: items[0] && items[0].firstName, lastName: items[0] && items[0].lastName, dateOfBirth: items[0] && items[0].dateOfBirth }
  const ep = await ensurePatient(patientId, info)
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
    // TODO(hr_hour): ensure hourly buckets are aligned exactly on the hour (00:00 minutes, seconds, ms)
    // Use toHourWithOffset to floor to the top of the hour; later verify hr_hour.hour_ts never has odd minutes/seconds
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
    // TODO(hr_hour): hour_ts must be at :00 on the dot; min/max/avg are per-hour aggregates
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
  const vp = await validatePatientId(patientId)
  if (!vp.ok) return res.status(400).json({ error: `invalid patient: ${vp.error}` })
  const origins = [...new Set(items.map((i) => i.originId).filter(Boolean))]
  const devices = [...new Set(items.map((i) => i.deviceId).filter(Boolean))]
  const info = { firstName: items[0] && items[0].firstName, lastName: items[0] && items[0].lastName, dateOfBirth: items[0] && items[0].dateOfBirth }
  const ep = await ensurePatient(patientId, info)
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
app.post('/ingest/weight-samples', async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body]
  if (!items.length) return res.status(200).json({ inserted: 0, upserted_day: 0 })
  const patientId = items[0].patientId
  const vp = await validatePatientId(patientId)
  if (!vp.ok) return res.status(400).json({ error: `invalid patient: ${vp.error}` })
  const origins = [...new Set(items.map((i) => i.originId).filter(Boolean))]
  const devices = [...new Set(items.map((i) => i.deviceId).filter(Boolean))]
  const info = { firstName: items[0] && items[0].firstName, lastName: items[0] && items[0].lastName, dateOfBirth: items[0] && items[0].dateOfBirth }
  const ep = await ensurePatient(patientId, info)
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
    kg: i.kg,
    record_uid: (i.originId === 'manual') ? `${i.patientId}|${toDateWithOffset(i.timeTs, i.tzOffsetMin || 0)}|manual` : i.recordUid,
  }))
  const ins = await supabase.from('weight_sample').upsert(raw, { onConflict: 'record_uid' })
  if (ins.error) return res.status(400).json({ error: ins.error.message })
  const dayAgg = new Map()
  for (const i of items) {
    const offset = i.tzOffsetMin || 0
    const d = toDateWithOffset(i.timeTs, offset)
    const dk = `${i.patientId}|${d}`
    const da = dayAgg.get(dk) || { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY, sum: 0, count: 0 }
    da.min = Math.min(da.min, i.kg)
    da.max = Math.max(da.max, i.kg)
    da.sum += i.kg
    da.count += 1
    dayAgg.set(dk, da)
  }
  const dayRows = []
  for (const [k, a] of dayAgg) {
    const [pid, d] = k.split('|')
    const avg = a.count ? a.sum / a.count : 0
    dayRows.push({ patient_id: pid, date: d, kg_min: a.min, kg_max: a.max, kg_avg: avg })
  }
  const upd = await supabase.from('weight_day').upsert(dayRows, { onConflict: 'patient_id,date' })
  if (upd.error) return res.status(400).json({ error: upd.error.message })
  return res.status(200).json({ inserted: (ins.data || []).length, upserted_day: dayRows.length })
})
app.post('/ingest/bp-sample', async (req, res) => {
  const item = req.body
  if (!item || !item.patientId) return res.status(400).json({ error: 'missing patientId' })
  const vp = await validatePatientId(item.patientId)
  if (!vp.ok) return res.status(400).json({ error: `invalid patient: ${vp.error}` })
  const info = { firstName: item.firstName, lastName: item.lastName, dateOfBirth: item.dateOfBirth }
  const ep = await ensurePatient(item.patientId, info)
  if (!ep.ok) return res.status(400).json({ error: `patient upsert failed: ${ep.error}` })
  const eo = await ensureOrigins(item.originId ? [item.originId] : [])
  if (!eo.ok) return res.status(400).json({ error: `origin upsert failed: ${eo.error}` })
  const ed = await ensureDevices(item.deviceId ? [item.deviceId] : [], item.patientId)
  if (!ed.ok) return res.status(400).json({ error: `device upsert failed: ${ed.error}` })
  const raw = {
    patient_id: item.patientId,
    origin_id: item.originId,
    device_id: item.deviceId,
    time_ts: item.timeTs,
    recorded_at: item.recordedAt,
    source: item.source,
    systolic_mmHg: item.systolicMmHg,
    diastolic_mmHg: item.diastolicMmHg,
    pulse_bpm: item.pulseBpm,
    time_inferred: item.timeInferred || false,
    record_uid: item.recordUid,
  }
  const ins = await supabase.from('bp_sample').upsert([raw], { onConflict: 'record_uid', ignoreDuplicates: true })
  if (ins.error) return res.status(400).json({ error: ins.error.message })
  const d = toDateWithOffset(item.timeTs, item.tzOffsetMin || 0)
  const dayRow = {
    patient_id: item.patientId,
    date: d,
    sbp_min: item.systolicMmHg,
    sbp_max: item.systolicMmHg,
    sbp_avg: item.systolicMmHg,
    dbp_min: item.diastolicMmHg,
    dbp_max: item.diastolicMmHg,
    dbp_avg: item.diastolicMmHg,
    pulse_avg: item.pulseBpm || null,
  }
  const upd = await supabase.from('bp_day').upsert([dayRow], { onConflict: 'patient_id,date' })
  if (upd.error) return res.status(400).json({ error: upd.error.message })
  return res.status(200).json({ inserted: (ins.data || []).length, upserted_day: 1 })
})
app.post('/ingest/symptom-log', async (req, res) => {
  const item = req.body
  console.log('[ingest/symptom-log] payload', {
    patientId: item && item.patientId,
    cough: item && item.cough,
    breathlessness: item && item.breathlessness,
    swelling: item && item.swelling,
    weightGain: item && item.weightGain,
    abdomen: item && item.abdomen,
    sleeping: item && item.sleeping,
    notes: item && item.notes,
  })
  if (!item || !item.patientId) return res.status(400).json({ error: 'missing patientId' })
  const vp = await validatePatientId(item.patientId)
  if (!vp.ok) return res.status(400).json({ error: `invalid patient: ${vp.error}` })
  const ts = item.timeTs || new Date().toISOString()
  const tsIso = new Date(ts).toISOString()
  const offset = item.tzOffsetMin || 0
  const d = toDateWithOffset(ts, offset)
  let parsed = {}
  if (typeof item.notes === 'string' && item.notes.trim().startsWith('{')) {
    try { parsed = JSON.parse(item.notes) } catch (_) { parsed = {} }
  }
  const row = {
    patient_id: item.patientId,
    logged_at: tsIso,
    date: d,
    recorded_at: item.recordedAt ? new Date(item.recordedAt).toISOString() : tsIso,
    cough: toInt((parsed && parsed.cough) ?? item.cough),
    sob_activity: toInt((parsed && parsed.breathlessness) ?? item.breathlessness),
    leg_swelling: toInt((parsed && parsed.swelling) ?? item.swelling),
    sudden_weight_gain: toInt((parsed && parsed.weightGain) ?? item.weightGain),
    abd_discomfort: toInt((parsed && parsed.abdomen) ?? item.abdomen),
    orthopnea: toInt((parsed && parsed.sleeping) ?? item.sleeping),
    notes: item.notes || '',
    origin_id: item.originId || 'manual',
    record_uid: item.recordUid || `${item.patientId}|${Date.now()}|${Math.random().toString(36).slice(2)}`,
  }
  console.log('[ingest/symptom-log] row', row)
  const existing = await supabase
    .from('symptom_log')
    .select('patient_id')
    .eq('patient_id', item.patientId)
    .eq('date', d)
    .range(0, 0)
  if (existing.error) return res.status(400).json({ error: existing.error.message })
  if ((existing.data || []).length > 0) {
    const upd = await supabase
      .from('symptom_log')
      .update({
        logged_at: row.logged_at,
        recorded_at: row.recorded_at,
        cough: row.cough,
        sob_activity: row.sob_activity,
        leg_swelling: row.leg_swelling,
        sudden_weight_gain: row.sudden_weight_gain,
        abd_discomfort: row.abd_discomfort,
        orthopnea: row.orthopnea,
        notes: row.notes,
        origin_id: row.origin_id,
      })
      .eq('patient_id', item.patientId)
      .eq('date', d)
    if (upd.error) return res.status(400).json({ error: upd.error.message })
    return res.status(200).json({ updated: (upd.data || []).length })
  } else {
    const ins = await supabase.from('symptom_log').insert([row])
    if (ins.error) return res.status(400).json({ error: ins.error.message })
    return res.status(200).json({ inserted: (ins.data || []).length })
  }
})
const port = process.env.PORT || 3001
app.listen(port, () => process.stdout.write(`server:${port}\n`))
