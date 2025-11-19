// FILE: backend/test_supabase.js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

console.log('Attempting to connect to Supabase...');
console.log('URL:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  console.log('\nAttempting to insert a health_events test row...');
  const MOCK_USER_ID = process.env.MOCK_USER_ID || '00000000-0000-0000-0000-000000000001';
  let { data, error } = await supabase
    .from('health_events')
    .insert([{ type: 'blood_pressure', value_1: 120, value_2: 80, value_3: 72, user_id: MOCK_USER_ID }])
    .select();

  if (error && error.code === '23503') {
    const retry = await supabase
      .from('health_events')
      .insert([{ type: 'blood_pressure', value_1: 120, value_2: 80, value_3: 72 }])
      .select();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    console.error('\n--- TEST FAILED ---');
    console.error('Supabase returned an error:', error);
    return;
  }

  console.log('\n--- INSERT SUCCEEDED ---');
  console.log('Inserted row:', data && data[0]);

  console.log('\nFetching latest health_events...');
  const { data: events, error: fetchError } = await supabase
    .from('health_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (fetchError) {
    console.error('Fetch error:', fetchError);
    return;
  }

  console.log('Latest events:', events);
}

testConnection();