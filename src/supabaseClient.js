
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://iinexncfociikkxcdisk.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpbmV4bmNmb2NpaWtreGNkaXNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3MTEyODAsImV4cCI6MjA4NTI4NzI4MH0.75mp3bdu1MwQq5qyKTzRI8CIbank9c8ItJnvyvoKl4E'

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase credentials missing! Check .env.local')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
