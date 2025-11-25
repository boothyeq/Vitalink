async function checkDuplicateReading(supabase, patientId, sys, dia, pulse) {
    try {
        const tenSecondsAgo = new Date(Date.now() - 10000);
        const { data, error } = await supabase
            .from('bp_readings')
            .select('*')
            .eq('patient_id', patientId)
            .gte('created_at', tenSecondsAgo.toISOString())
            .limit(1);

        if (error) {
            console.error('Error checking duplicates:', error);
            return false;
        }

        if (data && data.length > 0) {
            const lastReading = data[0];
            // Check if values are similar (within 5 units)
            if (
                Math.abs(lastReading.systolic - sys) <= 5 &&
                Math.abs(lastReading.diastolic - dia) <= 5 &&
                Math.abs(lastReading.pulse - pulse) <= 5
            ) {
                return true; // Duplicate found
            }
        }
        return false;
    } catch (err) {
        console.error('Error in duplicate check:', err);
        return false;
    }
}

module.exports = (supabase) => async (req, res) => {
    const { type, value1, value2, value3 } = req.body;

    // Only handle blood_pressure type for bp_readings table
    if (type !== 'blood_pressure') {
        return res.status(400).json({ error: 'Only blood_pressure type is supported.' });
    }

    const MOCK_USER_ID = process.env.MOCK_USER_ID || '00000000-0000-0000-0000-000000000001';

    const sys = value1 ? parseInt(value1, 10) : null;
    const dia = value2 ? parseInt(value2, 10) : null;
    const pulse = value3 ? parseInt(value3, 10) : null;

    if (!sys || !dia || !pulse) {
        return res.status(400).json({ error: 'All three values (systolic, diastolic, pulse) are required.' });
    }

    // Check for duplicate
    const isDuplicate = await checkDuplicateReading(supabase, MOCK_USER_ID, sys, dia, pulse);
    if (isDuplicate) {
        return res.status(400).json({
            error: 'Duplicate reading detected. Please wait at least 10 seconds before recording another similar reading.'
        });
    }

    const now = new Date();
    const readingDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const readingTime = now.toTimeString().split(' ')[0]; // HH:MM:SS

    let insertData = {
        patient_id: MOCK_USER_ID,
        reading_date: readingDate,
        reading_time: readingTime,
        systolic: sys,
        diastolic: dia,
        pulse: pulse
    };

    try {
        let { data, error } = await supabase
            .from('bp_readings')
            .insert([insertData])
            .select();

        if (error) {
            throw error;
        }

        res.json({ success: true, data: data ? data[0] : null });
    } catch (error) {
        console.error('Supabase manual insert error:', error);
        res.status(500).json({ error: 'Failed to save manual event.', details: error.message });
    }
};
