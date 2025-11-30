module.exports = (supabase) => async (req, res) => {
    try {
        const requestedUserId = req.query.user_id || process.env.MOCK_USER_ID || null;

        let query = supabase
            .from('bp_readings')
            .select('*');

        if (requestedUserId) {
            query = query.eq('patient_id', requestedUserId);
        }

        const { data, error } = await query
            .order('reading_date', { ascending: false })
            .order('reading_time', { ascending: false });

        if (error) {
            return res.status(500).json({ error: 'Failed to fetch health events.', details: error.message });
        }

        // Transform data to match frontend expectations
        const transformedData = (data || []).map(reading => ({
            id: reading.id,
            type: 'blood_pressure',
            value_1: reading.systolic,
            value_2: reading.diastolic,
            value_3: reading.pulse,
            created_at: `${reading.reading_date}T${reading.reading_time}`,
            reading_date: reading.reading_date,
            reading_time: reading.reading_time
        }));

        res.json(transformedData);
    } catch (error) {
        console.error('Supabase fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch health events.', details: error.message });
    }
};
