import { createClient } from '@supabase/supabase-js'
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
let supabase
if (url && key) {
  supabase = createClient(url, key)
} else {
  const auth = {
    async getSession() { return { data: { session: null }, error: null } },
    onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } } },
    async signInWithPassword() { return { data: null, error: { message: 'Supabase not configured' } } },
    async signUp() { return { data: null, error: { message: 'Supabase not configured' } } },
    async signOut() { return { error: null } },
  }
  supabase = { auth }
}
export { supabase }