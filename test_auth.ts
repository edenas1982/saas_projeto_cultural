import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const rawSupabaseUrl = process.env.VITE_SUPABASE_URL || ''
const rawAnonKey = process.env.VITE_SUPABASE_ANON_KEY || ''
const supabaseUrl = rawSupabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabase = createClient(supabaseUrl, rawAnonKey)

async function test() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'nascimentopalotina@gmail.com',
    password: 'password123' // Is this the password? Or I can just check the DB using Service key? WAIT, I don't have service key.
  });
  console.log('auth:', error ? error.message : data.user?.id)

  const { data: mems, error: memsErr } = await supabase.from('memoriais').select('*').limit(5)
  console.log('memoriais after auth:', memsErr, mems?.length)
}

test()
