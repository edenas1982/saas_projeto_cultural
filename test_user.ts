import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseAnon = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function check() {
  const { data: { user } } = await supabaseAnon.auth.signInWithPassword({
     email: 'nascimentopalotina@gmail.com',
     password: 'password123' // Or wait, I don't know the password.
  });
}
