module.exports = function (app, supabase, ensurePatient, supabaseMock) {
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
    const p1 = await supabase.from('patients').select('id').eq('id', pid).range(0, 0)
    out.patients_select = { count: (p1.data || []).length, error: p1.error ? p1.error.message : null }
    const p2 = await supabase.from('patient').select('id').eq('id', pid).range(0, 0)
    out.patient_select = { count: (p2.data || []).length, error: p2.error ? p2.error.message : null }
    const d1 = await supabase.from('devices').select('device_id,patient_id').eq('patient_id', pid).range(0, 0)
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
}