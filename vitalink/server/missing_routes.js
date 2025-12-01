// Add these routes to server.js after the /admin/summary route (around line 154)

// Get patient info for admin
app.get('/admin/patient-info', async (req, res) => {
    const pid = req.query && req.query.patientId
    if (!pid) return res.status(400).json({ error: 'missing patientId' })

    try {
        // Get patient details
        const patientRes = await supabase
            .from('patients')
            .select('patient_id, first_name, last_name, date_of_birth')
            .eq('patient_id', pid)
            .single()

        if (patientRes.error) {
            return res.status(404).json({ error: 'Patient not found' })
        }

        // Get device count
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

        // Get auth info for each patient
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
