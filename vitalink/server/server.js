const express = require('express')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const app = express()
app.use(express.json({ limit: '5mb' }))
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization')
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  if (req.method === 'OPTIONS') return res.sendStatus(200)
  next()
})

let supabase
let supabaseMock = false
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

if (process.env.SUPABASE_URL && supabaseKey) {
  supabase = createClient(process.env.SUPABASE_URL, supabaseKey)
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('[server] SUPABASE_SERVICE_ROLE_KEY missing — using SUPABASE_ANON_KEY (admin routes may fail)')
  }
} else {
  supabaseMock = true
  console.warn('[server] SUPABASE_URL / SUPABASE_KEY missing — using mock supabase (no writes)')
  const api = {
    async upsert() { return { data: [], error: null } },
    async select() { return { data: [], error: null } },
    async insert() { return { data: [], error: null } },
    eq() { return this },
    limit() { return this },
    order() { return this },
    or() { return this },
    from() { return this }
  }
  supabase = { from() { return api }, auth: { admin: { getUserById: async () => ({ error: 'mock' }) } } }
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
function toDateWithOffset(ts, offsetMin) {
  const d = new Date(Date.parse(ts) + (offsetMin || 0) * 60000)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
async function ensurePatient(patientId, info) {
  if (!patientId) return { ok: false, error: 'missing patientId' }
  const first = (info && info.firstName) ? info.firstName : 'User'
  const last = (info && info.lastName) ? info.lastName : 'Patient'
  const row = {
    patient_id: patientId,
    first_name: first,
    last_name: last,
    date_of_birth: info && info.dateOfBirth ? info.dateOfBirth : undefined,
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

// Get patient info for admin
app.get('/admin/patient-info', async (req, res) => {
  const pid = req.query && req.query.patientId
  if (!pid) return res.status(400).json({ error: 'missing patientId' })
  
  try {
    const patientRes = await supabase
      .from('patients')
      .select('patient_id, first_name, last_name, date_of_birth')
      .eq('patient_id', pid)
      .single()
    
    if (patientRes.error) {
      return res.status(404).json({ error: 'Patient not found' })
    }
    
    const devicesRes = await supabase
      .from('devices')
      .select('device_id')
      .eq('patient_id', pid)
    
    const devicesCount = devicesRes.data ? devicesRes.data.length : 0
    
    return res.status(200).json({
      patient: {
        patient_id: patientRes.data.patient_id,
        first_name: patientRes.data.first_name,
        last_name: patientRes.data.last_name,
        dob: patientRes.data.date_of_birth
      },
      devicesCount,
      warnings: []
    })
  } catch (error) {
    console.error('Error fetching patient info:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// Get all patients for admin
app.get('/api/admin/patients', async (req, res) => {
  try {
    const pid = req.query && req.query.patientId
    
    let query = supabase
      .from('patients')
      .select('patient_id, first_name, last_name, date_of_birth, created_at')
    
    if (pid) {
      query = query.eq('patient_id', pid)
    }
    
    const { data, error } = await query.limit(1000)
    
    if (error) {
      return res.status(400).json({ error: error.message })
    }
    
    const patientsWithAuth = await Promise.all((data || []).map(async (patient) => {
      try {
        const authRes = await supabase.auth.admin.getUserById(patient.patient_id)
        return {
          patient_id: patient.patient_id,
          first_name: patient.first_name || 'User',
          last_name: patient.last_name || 'Patient',
          email: authRes.data?.user?.email || null,
          created_at: authRes.data?.user?.created_at || patient.created_at,
          last_sign_in_at: authRes.data?.user?.last_sign_in_at || null,
          date_of_birth: patient.date_of_birth
        }
      } catch (err) {
        return {
          patient_id: patient.patient_id,
          first_name: patient.first_name || 'User',
          last_name: patient.last_name || 'Patient',
          email: null,
          created_at: patient.created_at,
          last_sign_in_at: null,
          date_of_birth: patient.date_of_birth
        }
      }
    }))
    
    return res.status(200).json({ patients: patientsWithAuth })
  } catch (error) {
    console.error('Error fetching patients:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// Admin login endpoint
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }
    
    // Query the admins table
    const { data, error } = await supabase
      .from('admins')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('is_active', true)
      .single()
    
    if (error || !data) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }
    
    // Simple password check (in production, use bcrypt)
    // For now, we'll check if password matches the stored hash
    // You should replace this with proper bcrypt comparison
    if (data.password_hash !== password && data.password_hash !== 'PLACEHOLDER') {
      return res.status(401).json({ error: 'Invalid email or password' })
    }
    
    // If password is PLACEHOLDER, accept any password (for initial setup)
    // In production, you should hash the password properly
    
    // Update last login time
    await supabase
      .from('admins')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', data.id)
    
    // Return admin data (without password hash)
    return res.status(200).json({
      admin: {
        id: data.id,
        email: data.email,
        first_name: data.first_name,
        last_name: data.last_name,
        created_at: data.created_at,
        last_login_at: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('Admin login error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
})


// --- Blood Pressure Module Routes ---

// multer setup
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) { fs.mkdirSync(uploadDir); }
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage: storage });
const uploadMiddleware = upload.single('image');

// Import BP module routes
let processImageRoute, addManualEventRoute, getHealthEventsRoute;
try {
  processImageRoute = require('./routes/bp/processImage')(supabase, uploadMiddleware);
  addManualEventRoute = require('./routes/bp/addManualEvent')(supabase);
  getHealthEventsRoute = require('./routes/bp/getHealthEvents')(supabase);
  console.log('[server] BP routes loaded successfully');
} catch (err) {
  console.error('[server] Error loading BP routes:', err);
  process.exit(1);
}

// Register BP routes
app.post('/api/process-image', processImageRoute);
app.post('/api/add-manual-event', addManualEventRoute);
app.get('/api/health-events', getHealthEventsRoute);

// Patient endpoints for dashboard
app.get('/patient/summary', async (req, res) => {
  const pid = (req.query && req.query.patientId)
  if (!pid) return res.status(400).json({ error: 'missing patientId' })
  const hr = await supabase.from('hr_day').select('date,hr_avg').eq('patient_id', pid).order('date', { ascending: false }).limit(1)
  if (hr.error) return res.status(400).json({ error: hr.error.message })
  const row = (hr.data && hr.data[0]) || null
  const st = await supabase.from('steps_day').select('date,steps_total').eq('patient_id', pid).order('date', { ascending: false }).limit(1)
  if (st.error) return res.status(400).json({ error: st.error.message })
  const srow = (st.data && st.data[0]) || null
  const summary = {
    heartRate: row ? Math.round(row.hr_avg || 0) : null,
    bpSystolic: null,
    bpDiastolic: null,
    weightKg: null,
    nextAppointmentDate: null,
    stepsToday: srow ? Math.round(srow.steps_total || 0) : null,
  }
  return res.status(200).json({ summary })
})

app.get('/patient/vitals', async (req, res) => {
  const pid = (req.query && req.query.patientId)
  const period = (req.query && req.query.period) || 'hourly'
  if (!pid) return res.status(400).json({ error: 'missing patientId' })
  let out = { hr: [], spo2: [], steps: [], bp: [], weight: [] }
  if (period === 'weekly') {
    const hr = await supabase
      .from('hr_day')
      .select('date,hr_min,hr_max,hr_avg')
      .eq('patient_id', pid)
      .order('date', { ascending: false })
      .limit(7)
    if (hr.error) return res.status(400).json({ error: hr.error.message })
    const spo2 = await supabase
      .from('spo2_day')
      .select('date,spo2_min,spo2_max,spo2_avg')
      .eq('patient_id', pid)
      .order('date', { ascending: false })
      .limit(7)
    if (spo2.error) return res.status(400).json({ error: spo2.error.message })
    const steps = await supabase
      .from('steps_day')
      .select('date,steps_total')
      .eq('patient_id', pid)
      .order('date', { ascending: false })
      .limit(7)
    if (steps.error) return res.status(400).json({ error: steps.error.message })

    // Fetch BP readings for the week
    const bp = await supabase
      .from('bp_readings')
      .select('reading_date,reading_time,systolic,diastolic,pulse')
      .eq('patient_id', pid)
      .order('reading_date', { ascending: false })
      .order('reading_time', { ascending: false })
      .limit(50)
    if (bp.error) return res.status(400).json({ error: bp.error.message })

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
          const night = arr.filter(x => x.h >= 0 && x.h <= 6 && (x.count || 0) >= 10).sort((a, b) => a.h - b.h)
          let val
          if (night.length >= 1) {
            let best = { score: Infinity, vals: [] }
            for (let i = 0; i < night.length; i++) {
              const w = [night[i], night[i + 1], night[i + 2]].filter(Boolean)
              if (w.length) {
                const score = w.reduce((s, x) => s + (x.avg || 0), 0) / w.length
                const vals = w.map(x => x.avg || 0).sort((a, b) => a - b)
                const mid = Math.floor(vals.length / 2)
                const median = vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2
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
    out = {
      hr: hrDays.map((r) => ({ time: r.date, min: Math.round(r.hr_min || 0), avg: Math.round(r.hr_avg || 0), max: Math.round(r.hr_max || 0), resting: restingMap.get(r.date) })),
      spo2: (spo2.data || []).reverse().map((r) => ({ time: r.date, min: Math.round(r.spo2_min || 0), avg: Math.round(r.spo2_avg || 0), max: Math.round(r.spo2_max || 0) })),
      steps: (steps.data || []).reverse().map((r) => ({ time: r.date, count: Math.round(r.steps_total || 0) })),
      bp: (bp.data || []).reverse().map((r) => ({
        time: `${r.reading_date}T${r.reading_time}`,
        systolic: r.systolic,
        diastolic: r.diastolic,
        pulse: r.pulse
      })),
      weight: [],
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

    // Fetch BP readings for the month
    const bp = await supabase
      .from('bp_readings')
      .select('reading_date,reading_time,systolic,diastolic,pulse')
      .eq('patient_id', pid)
      .gte('reading_date', startStr)
      .lte('reading_date', endStr)
      .order('reading_date', { ascending: true })
      .order('reading_time', { ascending: true })
    if (bp.error) return res.status(400).json({ error: bp.error.message })

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
          const night = arr.filter(x => x.h >= 0 && x.h <= 6 && (x.count || 0) >= 10).sort((a, b) => a.h - b.h)
          let val
          if (night.length >= 1) {
            let best = { score: Infinity, vals: [] }
            for (let i = 0; i < night.length; i++) {
              const w = [night[i], night[i + 1], night[i + 2]].filter(Boolean)
              if (w.length) {
                const score = w.reduce((s, x) => s + (x.avg || 0), 0) / w.length
                const vals = w.map(x => x.avg || 0).sort((a, b) => a - b)
                const mid = Math.floor(vals.length / 2)
                const median = vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2
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
    out = {
      hr: hrDays.map((r) => ({ time: r.date, min: Math.round(r.hr_min || 0), avg: Math.round(r.hr_avg || 0), max: Math.round(r.hr_max || 0), resting: restingMap.get(r.date) })),
      spo2: (spo2.data || []).map((r) => ({ time: r.date, min: Math.round(r.spo2_min || 0), avg: Math.round(r.spo2_avg || 0), max: Math.round(r.spo2_max || 0) })),
      steps: (steps.data || []).map((r) => ({ time: r.date, count: Math.round(r.steps_total || 0) })),
      bp: (bp.data || []).map((r) => ({
        time: `${r.reading_date}T${r.reading_time}`,
        systolic: r.systolic,
        diastolic: r.diastolic,
        pulse: r.pulse
      })),
      weight: [],
    }
  } else {
    const hr = await supabase
      .from('hr_hour')
      .select('hour_ts,hr_min,hr_max,hr_avg')
      .eq('patient_id', pid)
      .order('hour_ts', { ascending: false })
      .limit(24)
    if (hr.error) return res.status(400).json({ error: hr.error.message })
    const spo2 = await supabase
      .from('spo2_hour')
      .select('hour_ts,spo2_min,spo2_max,spo2_avg')
      .eq('patient_id', pid)
      .order('hour_ts', { ascending: false })
      .limit(24)
    if (spo2.error) return res.status(400).json({ error: spo2.error.message })
    const steps = await supabase
      .from('steps_hour')
      .select('hour_ts,steps_total')
      .eq('patient_id', pid)
      .order('hour_ts', { ascending: false })
      .limit(24)
    if (steps.error) return res.status(400).json({ error: steps.error.message })
    out = {
      hr: (hr.data || []).reverse().map((r) => ({ time: r.hour_ts, min: Math.round((r.hr_min ?? r.hr_avg) || 0), avg: Math.round(r.hr_avg || 0), max: Math.round((r.hr_max ?? r.hr_avg) || 0), count: r.hr_count })),
      spo2: (spo2.data || []).reverse().map((r) => ({ time: r.hour_ts, min: Math.round((r.spo2_min ?? r.spo2_avg) || 0), avg: Math.round(r.spo2_avg || 0), max: Math.round((r.spo2_max ?? r.spo2_avg) || 0) })),
      steps: (steps.data || []).reverse().map((r) => ({ time: r.hour_ts, count: Math.round(r.steps_total || 0) })),
      bp: [],
      weight: [],
    }
  }
  return res.status(200).json(out)
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
const port = process.env.PORT || 3001
app.listen(port, () => process.stdout.write(`server:${port}\n`))