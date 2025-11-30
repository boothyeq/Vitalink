const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

module.exports = async (req, res) => {
  try {
    const requestedUserId = req.query.user_id || process.env.MOCK_USER_ID || null;

    let query = supabase
      .from('health_events')
      .select('*');

    if (requestedUserId) {
      query = query.or(`user_id.eq.${requestedUserId},user_id.is.null`);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch health events.', details: error.message });
    }

    res.json(data || []);
  } catch (e) {
    res.status(500).json({ error: 'Unexpected error fetching health events.' });
  }
};