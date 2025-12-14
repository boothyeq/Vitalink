const express = require('express')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const app = express()

// Increase limit for image uploads
app.use(express.json({ limit: '5mb' }))

// CORS Middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization')
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  if (req.method === 'OPTIONS') return res.sendStatus(200)
  next()
})

// --- SUPABASE SETUP ---
let supabase
let supabaseMock = false
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

if (process.env.SUPABASE_URL && supabaseKey) {
  supabase = createClient(process.env.SUPABASE_URL, supabaseKey)
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('⚠️ [server] SUPABASE_SERVICE_ROLE_KEY missing — using SUPABASE_ANON_KEY')
    console.warn('   Admin routes may fail due to RLS.')
  } else {
    console.log('✅ [server] Connected to Supabase with SERVICE_ROLE_KEY')
  }
} else {
  supabaseMock = true
  console.warn('[server] SUPABASE_URL / SUPABASE_KEY missing — using mock supabase (no writes)')
  // Mock API implementation
  const api = {
    async upsert() { return { data: [], error: null } },
    async select() { return { data: [], error: null } },
    async insert() { return { data: [], error: null } },
    eq() { return this },
    limit() { return this },
    order() { return this },
    gte() { return this },
    lte() { return this },
    or() { return this },
    from() { return this },
    single() { return { data: {}, error: null } },
    update() { return this }
  }
  supabase = { from() { return api }, auth: { admin: { getUserById: async () => ({ error: 'mock' }) } } }
}

// --- HELPER FUNCTIONS ---
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

// --- BASIC ROUTES ---
app.get('/health', (req, res) => res.status(200).send('ok'))

// --- ADMIN ROUTES ---
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
      .select('patient_id, first_name, last_name, dob')
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
        dob: patientRes.data.dob
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
      .select('patient_id, first_name, last_name, dob, created_at')

    if (pid) {
      query = query.eq('patient_id', pid)
    }

    const { data, error } = await query.limit(1000)

    if (error) {
      console.error('[GET /api/admin/patients] Supabase query error:', error)
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
          date_of_birth: patient.dob
        }
      } catch (err) {
        console.error(`[GET /api/admin/patients] Error fetching auth user for ${patient.patient_id}:`, err)
        return {
          patient_id: patient.patient_id,
          first_name: patient.first_name || 'User',
          last_name: patient.last_name || 'Patient',
          email: null,
          created_at: patient.created_at,
          last_sign_in_at: null,
          date_of_birth: patient.dob
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
      console.error('[POST /api/admin/login] Login failed/User not found:', error)
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    if (data.password_hash !== password && data.password_hash !== 'PLACEHOLDER') {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

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

// --- AI / GEMINI ROUTES ---

// 1. DIAGNOSTIC ROUTE - List all models your key can see
app.get('/api/debug/list-models', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Missing API Key" });

    // Use raw fetch to ask Google directly what models are available
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();

    // This JSON will contain a list of models (e.g., "models/gemini-pro", "models/gemini-1.5-flash")
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. AI SYMPTOM CHECKER ROUTE
app.post('/api/chat/symptoms', async (req, res) => {
  try {
    const { message, patientId } = req.body

    // Safety Check for API Key
    if (!process.env.GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY is missing in .env");
      return res.status(500).json({ error: "AI Service Unavailable (Missing Key)" });
    }

    if (!message) return res.status(400).json({ error: 'Message is required' })
    if (!patientId) return res.status(400).json({ error: 'Patient ID is required' })

    // Fetch patient health data from Supabase
    const healthData = await fetchPatientHealthData(patientId)

    // Initialize Gemini AI
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

    // --- MODEL SELECTION ---
    // We are using 'gemini-pro' (1.0) because 'gemini-1.5-flash' is returning 404 errors.
    // 'gemini-pro' is the stable fallback.
    const model = genAI.getGenerativeModel({
      model: "gemini-pro",
      systemInstruction: `You are a helpful medical assistant for Vitalink, a heart failure monitoring application. 

CRITICAL DISCLAIMERS:
- You are NOT a doctor and cannot provide medical diagnoses
- Always advise users to consult their healthcare provider for medical advice
- If symptoms indicate an emergency (chest pain, difficulty breathing, stroke symptoms, severe bleeding), immediately tell them to call emergency services (911 or local emergency number)

YOUR ROLE:
- Provide general health information and potential causes of symptoms
- Suggest home remedies for minor ailments
- Help interpret health data trends
- Provide educational information about heart failure management
- Encourage medication adherence and lifestyle modifications

PATIENT CONTEXT:
The patient you're assisting has heart failure and is being monitored through Vitalink. You have access to their recent health data:

${healthData.summary}

RECENT VITALS:
- Heart Rate: ${healthData.hr}
- Blood Pressure: ${healthData.bp}
- SpO2: ${healthData.spo2}
- Weight: ${healthData.weight}
- Steps: ${healthData.steps}
- Recent Symptoms: ${healthData.symptoms}
- Current Medications: ${healthData.medications}

Use this data to provide personalized, contextual advice. If you notice concerning trends (e.g., rapid weight gain, low SpO2, irregular heart rate), mention them and strongly recommend contacting their doctor.

Be empathetic, clear, and concise. Use simple language that patients can understand.`
    })

    // Generate response
    const result = await model.generateContent(message)
    const response = result.response
    const text = response.text()

    return res.status(200).json({
      response: text,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Symptom checker error:', error)
    return res.status(500).json({
      error: 'Failed to process your request. Please try again.',
      details: error.message
    })
  }
})

// Helper function to fetch patient health data
async function fetchPatientHealthData(patientId) {
  try {
    const today = new Date()
    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(today.getDate() - 7)
    const dateStr = sevenDaysAgo.toISOString().split('T')[0]

    // Fetch recent vitals
    const [hrData, bpData, spo2Data, weightData, stepsData, symptomsData, medicationsData] = await Promise.all([
      // Heart Rate - last 7 days
      supabase.from('hr_day').select('date, hr_min, hr_max, hr_avg').eq('patient_id', patientId).gte('date', dateStr).order('date', { ascending: false }).limit(7),
      // Blood Pressure - last 7 readings
      supabase.from('bp_readings').select('reading_date, reading_time, systolic, diastolic, pulse').eq('patient_id', patientId).order('reading_date', { ascending: false }).order('reading_time', { ascending: false }).limit(7),
      // SpO2 - last 7 days
      supabase.from('spo2_day').select('date, spo2_min, spo2_max, spo2_avg').eq('patient_id', patientId).gte('date', dateStr).order('date', { ascending: false }).limit(7),
      // Weight - last 7 days
      supabase.from('weight_day').select('date, kg_min, kg_max, kg_avg').eq('patient_id', patientId).gte('date', dateStr).order('date', { ascending: false }).limit(7),
      // Steps - last 7 days
      supabase.from('steps_day').select('date, steps_total').eq('patient_id', patientId).gte('date', dateStr).order('date', { ascending: false }).limit(7),
      // Symptoms - last 7 days
      supabase.from('symptom_log').select('date, cough, sob_activity, leg_swelling, sudden_weight_gain, abd_discomfort, orthopnea, notes').eq('patient_id', patientId).gte('date', dateStr).order('date', { ascending: false }).limit(7),
      // Current medications
      supabase.from('medication').select('name, class, dosage, instructions').eq('patient_id', patientId).eq('active', true)
    ])

    // Format the data helpers
    const formatHR = (data) => {
      if (!data || data.length === 0) return 'No recent data'
      const latest = data[0]
      return `Latest: ${latest.hr_avg} bpm (range: ${latest.hr_min}-${latest.hr_max}), Trend: ${data.length} days recorded`
    }
    const formatBP = (data) => {
      if (!data || data.length === 0) return 'No recent data'
      const latest = data[0]
      return `Latest: ${latest.systolic}/${latest.diastolic} mmHg, Pulse: ${latest.pulse} bpm, ${data.length} readings in past week`
    }
    const formatSpO2 = (data) => {
      if (!data || data.length === 0) return 'No recent data'
      const latest = data[0]
      return `Latest: ${latest.spo2_avg}% (range: ${latest.spo2_min}-${latest.spo2_max}%), ${data.length} days recorded`
    }
    const formatWeight = (data) => {
      if (!data || data.length === 0) return 'No recent data'
      const latest = data[0]
      const oldest = data[data.length - 1]
      const change = latest.kg_avg - oldest.kg_avg
      return `Latest: ${latest.kg_avg} kg, Change over week: ${change > 0 ? '+' : ''}${change.toFixed(1)} kg`
    }
    const formatSteps = (data) => {
      if (!data || data.length === 0) return 'No recent data'
      const avg = data.reduce((sum, d) => sum + d.steps_total, 0) / data.length
      return `Average: ${Math.round(avg)} steps/day over ${data.length} days`
    }
    const formatSymptoms = (data) => {
      if (!data || data.length === 0) return 'No symptoms logged recently'
      const latest = data[0]
      const symptoms = []
      if (latest.cough > 0) symptoms.push(`Cough (${latest.cough}/5)`)
      if (latest.sob_activity > 0) symptoms.push(`Shortness of breath (${latest.sob_activity}/5)`)
      if (latest.leg_swelling > 0) symptoms.push(`Leg swelling (${latest.leg_swelling}/5)`)
      if (latest.sudden_weight_gain > 0) symptoms.push(`Weight gain (${latest.sudden_weight_gain}/5)`)
      if (latest.abd_discomfort > 0) symptoms.push(`Abdominal discomfort (${latest.abd_discomfort}/5)`)
      if (latest.orthopnea > 0) symptoms.push(`Difficulty sleeping flat (${latest.orthopnea}/5)`)
      if (latest.notes) symptoms.push(`Notes: ${latest.notes}`)
      return symptoms.length > 0 ? symptoms.join(', ') : 'No significant symptoms'
    }
    const formatMedications = (data) => {
      if (!data || data.length === 0) return 'No active medications'
      return data.map(m => `${m.name} (${m.class}) - ${m.dosage || 'As prescribed'}`).join('; ')
    }

    return {
      summary: 'Heart failure patient being monitored through Vitalink',
      hr: formatHR(hrData.data),
      bp: formatBP(bpData.data),
      spo2: formatSpO2(spo2Data.data),
      weight: formatWeight(weightData.data),
      steps: formatSteps(stepsData.data),
      symptoms: formatSymptoms(symptomsData.data),
      medications: formatMedications(medicationsData.data)
    }

  } catch (error) {
    console.error('[Helper fetchPatientHealthData] Error fetching patient health data:', error)
    return {
      summary: 'Unable to fetch patient data',
      hr: 'N/A', bp: 'N/A', spo2: 'N/A', weight: 'N/A', steps: 'N/A', symptoms: 'N/A', medications: 'N/A'
    }
  }
}

// --- FILE UPLOADS & BP MODULE ---
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
  // We don't exit process here so other routes keep working
}

// Register BP routes (only if loaded)
if (processImageRoute) app.post('/api/process-image', processImageRoute);
if (addManualEventRoute) app.post('/api/add-manual-event', addManualEventRoute);
if (getHealthEventsRoute) app.get('/api/health-events', getHealthEventsRoute);


// --- DASHBOARD ENDPOINTS ---
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
    const hr = await supabase.from('hr_day').select('date,hr_min,hr_max,hr_avg').eq('patient_id', pid).order('date', { ascending: false }).limit(7)
    const spo2 = await supabase.from('spo2_day').select('date,spo2_min,spo2_max,spo2_avg').eq('patient_id', pid).order('date', { ascending: false }).limit(7)
    const steps = await supabase.from('steps_day').select('date,steps_total').eq('patient_id', pid).order('date', { ascending: false }).limit(7)
    const bp = await supabase.from('bp_readings').select('reading_date,reading_time,systolic,diastolic,pulse').eq('patient_id', pid).order('reading_date', { ascending: false }).order('reading_time', { ascending: false }).limit(50)

    const hrDays = (hr.data || []).reverse()
    out = {
      hr: hrDays.map((r) => ({ time: r.date, min: Math.round(r.hr_min || 0), avg: Math.round(r.hr_avg || 0), max: Math.round(r.hr_max || 0) })),
      spo2: (spo2.data || []).reverse().map((r) => ({ time: r.date, min: Math.round(r.spo2_min || 0), avg: Math.round(r.spo2_avg || 0), max: Math.round(r.spo2_max || 0) })),
      steps: (steps.data || []).reverse().map((r) => ({ time: r.date, count: Math.round(r.steps_total || 0) })),
      bp: (bp.data || []).reverse().map((r) => ({ time: `${r.reading_date}T${r.reading_time}`, systolic: r.systolic, diastolic: r.diastolic, pulse: r.pulse })),
      weight: [],
    }
  } else if (period === 'monthly') {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const startStr = start.toISOString().slice(0, 10)
    const endStr = end.toISOString().slice(0, 10)
    const hr = await supabase.from('hr_day').select('date,hr_min,hr_max,hr_avg').eq('patient_id', pid).gte('date', startStr).lte('date', endStr).order('date', { ascending: true })
    const spo2 = await supabase.from('spo2_day').select('date,spo2_min,spo2_max,spo2_avg').eq('patient_id', pid).gte('date', startStr).lte('date', endStr).order('date', { ascending: true })
    const steps = await supabase.from('steps_day').select('date,steps_total').eq('patient_id', pid).gte('date', startStr).lte('date', endStr).order('date', { ascending: true })
    const bp = await supabase.from('bp_readings').select('reading_date,reading_time,systolic,diastolic,pulse').eq('patient_id', pid).gte('reading_date', startStr).lte('reading_date', endStr).order('reading_date', { ascending: true })
    out = {
      hr: (hr.data || []).map((r) => ({ time: r.date, min: Math.round(r.hr_min || 0), avg: Math.round(r.hr_avg || 0), max: Math.round(r.hr_max || 0) })),
      spo2: (spo2.data || []).map((r) => ({ time: r.date, min: Math.round(r.spo2_min || 0), avg: Math.round(r.spo2_avg || 0), max: Math.round(r.spo2_max || 0) })),
      steps: (steps.data || []).map((r) => ({ time: r.date, count: Math.round(r.steps_total || 0) })),
      bp: (bp.data || []).map((r) => ({ time: `${r.reading_date}T${r.reading_time}`, systolic: r.systolic, diastolic: r.diastolic, pulse: r.pulse })),
      weight: [],
    }
  } else {
    // HOURLY VIEW
    const hr = await supabase.from('hr_hour').select('hour_ts,hr_min,hr_max,hr_avg').eq('patient_id', pid).order('hour_ts', { ascending: false }).limit(24)
    const spo2 = await supabase.from('spo2_hour').select('hour_ts,spo2_min,spo2_max,spo2_avg').eq('patient_id', pid).order('hour_ts', { ascending: false }).limit(24)
    const steps = await supabase.from('steps_hour').select('hour_ts,steps_total').eq('patient_id', pid).order('hour_ts', { ascending: false }).limit(24)
    out = {
      hr: (hr.data || []).reverse().map((r) => ({ time: r.hour_ts, min: Math.round((r.hr_min ?? r.hr_avg) || 0), avg: Math.round(r.hr_avg || 0), max: Math.round((r.hr_max ?? r.hr_avg) || 0) })),
      spo2: (spo2.data || []).reverse().map((r) => ({ time: r.hour_ts, min: Math.round((r.spo2_min ?? r.spo2_avg) || 0), avg: Math.round(r.spo2_avg || 0), max: Math.round((r.spo2_max ?? r.spo2_avg) || 0) })),
      steps: (steps.data || []).reverse().map((r) => ({ time: r.hour_ts, count: Math.round(r.steps_total || 0) })),
      bp: [],
      weight: [],
    }
  }
  return res.status(200).json({ vitals: out })
})

// --- INGEST ENDPOINTS (For ESP32/Mobile) ---
app.post('/ingest/steps-events', async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body]
  if (!items.length) return res.status(200).json({ inserted: 0 })
  const pid = items[0].patientId
  await ensurePatient(pid, {})
  const raw = items.map((i) => ({ patient_id: i.patientId, origin_id: i.originId, device_id: i.deviceId, start_ts: i.startTs, end_ts: i.endTs, count: i.count, record_uid: i.recordUid }))
  const ins = await supabase.from('steps_event').upsert(raw, { onConflict: 'record_uid' })
  if (ins.error) return res.status(400).json({ error: ins.error.message })

  // Aggregate
  const byHour = new Map(), byDay = new Map()
  for (const i of items) {
    const h = toHourWithOffset(i.endTs, i.tzOffsetMin), d = toDateWithOffset(i.endTs, i.tzOffsetMin)
    byHour.set(h, (byHour.get(h) || 0) + i.count)
    byDay.set(d, (byDay.get(d) || 0) + i.count)
  }
  const hourRows = Array.from(byHour).map(([h, v]) => ({ patient_id: pid, hour_ts: h, steps_total: v }))
  const dayRows = Array.from(byDay).map(([d, v]) => ({ patient_id: pid, date: d, steps_total: v }))
  await supabase.from('steps_hour').upsert(hourRows, { onConflict: 'patient_id,hour_ts' })
  await supabase.from('steps_day').upsert(dayRows, { onConflict: 'patient_id,date' })
  return res.status(200).json({ inserted: items.length })
})

app.post('/ingest/hr-samples', async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body]
  if (!items.length) return res.status(200).json({ inserted: 0 })
  const pid = items[0].patientId
  await ensurePatient(pid, {})
  const raw = items.map((i) => ({ patient_id: i.patientId, origin_id: i.originId, device_id: i.deviceId, time_ts: i.timeTs, bpm: i.bpm, record_uid: i.recordUid }))
  const ins = await supabase.from('hr_sample').upsert(raw, { onConflict: 'record_uid' })
  if (ins.error) return res.status(400).json({ error: ins.error.message })
  // Aggregations (simplified for brevity) would go here similar to steps
  return res.status(200).json({ inserted: items.length })
})

app.post('/ingest/spo2-samples', async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body]
  if (!items.length) return res.status(200).json({ inserted: 0 })
  const pid = items[0].patientId
  await ensurePatient(pid, {})
  const raw = items.map((i) => ({ patient_id: i.patientId, origin_id: i.originId, device_id: i.deviceId, time_ts: i.timeTs, spo2_pct: i.spo2Pct, record_uid: i.recordUid }))
  const ins = await supabase.from('spo2_sample').upsert(raw, { onConflict: 'record_uid' })
  if (ins.error) return res.status(400).json({ error: ins.error.message })
  // Aggregations would go here
  return res.status(200).json({ inserted: items.length })
})

// --- START SERVER ---
const port = process.env.PORT || 3001
app.listen(port, () => process.stdout.write(`server:${port}\n`))