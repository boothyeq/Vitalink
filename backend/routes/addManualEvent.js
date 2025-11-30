// FILE: backend/routes/addManualEvent.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

module.exports = async (req, res) => {
    const { type, value1, value2, value3, valueBool, valueText } = req.body;

    if (!type) {
        return res.status(400).json({ error: 'Event type is required.' });
    }

    const MOCK_USER_ID = process.env.MOCK_USER_ID || '00000000-0000-0000-0000-000000000001';
    let insertData = {
        type: type,
        value_1: value1 ? parseInt(value1, 10) : null,
        value_2: value2 ? parseInt(value2, 10) : null,
        value_3: value3 ? parseInt(value3, 10) : null,
        value_bool: valueBool,
        value_text: valueText,
        user_id: MOCK_USER_ID
    };

    try {
        let { data, error } = await supabase
            .from('health_events')
            .insert([insertData])
            .select();

        if (error && error.code === '23503') {
            delete insertData.user_id;
            const retry = await supabase
              .from('health_events')
              .insert([insertData])
              .select();
            data = retry.data;
            error = retry.error;
        }

        if (error) {
            throw error;
        }

        res.json({ success: true, data: data[0] });
    } catch (error) {
        console.error('Supabase manual insert error:', error);
        res.status(500).json({ error: 'Failed to save manual event.', details: error.message });
    }
};