const DEFAULT_URL = 'http://localhost:3001'

export function serverUrl() {
  const fromEnv = import.meta.env.VITE_SERVER_URL as string | undefined
  return (fromEnv && fromEnv.length > 0) ? fromEnv : DEFAULT_URL
}

export async function getAdminSummary() {
  const res = await fetch(serverUrl() + '/admin/summary')
  if (!res.ok) throw new Error('failed to fetch summary: ' + res.status)
  return res.json() as Promise<{ summary: Array<{ patientId: string, steps: any, hr: any, spo2: any }> }>
}

export type PatientSummary = {
  heartRate?: number
  bpSystolic?: number
  bpDiastolic?: number
  weightKg?: number
  nextAppointmentDate?: string
  stepsToday?: number
}

// removed implicit session-based patient id; caller must provide patientId explicitly

export async function getPatientSummary(patientId?: string) {
  const pid = patientId
  const url = pid ? `${serverUrl()}/patient/summary?patientId=${encodeURIComponent(pid)}` : `${serverUrl()}/patient/summary`
  const res = await fetch(url)
  if (!res.ok) return { summary: {} as PatientSummary }
  return res.json() as Promise<{ summary: PatientSummary }>
}

export type PatientVitals = {
  hr?: Array<{ time: string; min: number; avg: number; max: number }>
  spo2?: Array<{ time: string; min: number; avg: number; max: number }>
  steps?: Array<{ time: string; count: number }>
  bp?: Array<{ time: string; systolic: number; diastolic: number }>
  weight?: Array<{ time: string; kg: number }>
}

export async function getPatientVitals(patientId?: string, period?: "hourly" | "weekly" | "monthly") {
  const pid = patientId
  const qp = [] as string[]
  if (pid) qp.push(`patientId=${encodeURIComponent(pid)}`)
  if (period) qp.push(`period=${encodeURIComponent(period)}`)
  const url = qp.length ? `${serverUrl()}/patient/vitals?${qp.join("&")}` : `${serverUrl()}/patient/vitals`
  const res = await fetch(url)
  if (!res.ok) return { vitals: {} as PatientVitals }
  return res.json() as Promise<{ vitals: PatientVitals }>
}

export type PatientReminders = Array<{ id: string; date: string; title: string; notes?: string }>

export async function getPatientReminders(patientId?: string) {
  const pid = patientId
  const url = pid ? `${serverUrl()}/patient/reminders?patientId=${encodeURIComponent(pid)}` : `${serverUrl()}/patient/reminders`
  const res = await fetch(url)
  if (!res.ok) return { reminders: [] as PatientReminders }
  return res.json() as Promise<{ reminders: PatientReminders }>
}

// --- New Integration Functions ---

export async function processImage(file: File, patientId: string) {
  const formData = new FormData();
  formData.append('image', file);
  formData.append('patientId', patientId);

  const res = await fetch(`${serverUrl()}/api/process-image`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to process image');
  }

  return res.json();
}

export async function addManualEvent(data: any, patientId: string) {
  const res = await fetch(`${serverUrl()}/api/add-manual-event`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...data, patientId }),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to add event');
  }

  return res.json();
}

export async function getHealthEvents(userId?: string) {
  const url = userId
    ? `${serverUrl()}/api/health-events?user_id=${encodeURIComponent(userId)}`
    : `${serverUrl()}/api/health-events`;

  const res = await fetch(url);

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to fetch events');
  }

  return res.json();
}

export type PatientProfile = {
  patient_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  date_of_birth?: string;
}

export async function getPatients() {
  const res = await fetch(`${serverUrl()}/api/admin/patients`);
  if (!res.ok) throw new Error('Failed to fetch patients');
  return res.json() as Promise<{ patients: PatientProfile[] }>;
}

export async function getPatientProfile(patientId: string) {
  const res = await fetch(`${serverUrl()}/api/admin/patients?patientId=${encodeURIComponent(patientId)}`);
  if (!res.ok) throw new Error('Failed to fetch patient profile');
  const data = await res.json();
  return data.patients[0] as PatientProfile | undefined;
}