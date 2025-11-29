module.exports = (supabase) => async (req, res) => {
    try {
        const patientId = req.query.patientId;

        // Query the patients table directly
        let query = supabase.from('patients').select('*');
        if (patientId) {
            query = query.eq('patient_id', patientId);
        }

        const { data: patients, error: profileError } = await query;

        if (profileError) {
            console.error('Error fetching patients:', profileError);
            return res.status(400).json({ error: profileError.message });
        }

        // Transform to match expected format
        const transformedPatients = (patients || []).map(patient => ({
            patient_id: patient.patient_id,
            first_name: patient.first_name,
            last_name: patient.last_name,
            date_of_birth: patient.date_of_birth || patient.dob,
            created_at: patient.created_at,
            email: null, // Email not stored in patients table
            last_sign_in_at: null
        }));

        res.status(200).json({ patients: transformedPatients });

    } catch (err) {
        console.error('Unexpected error in getPatients:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};
