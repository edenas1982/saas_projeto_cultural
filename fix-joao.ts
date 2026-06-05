import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
  let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
  const cb = createClient(supabaseUrl, supabaseKey);

  const { error } = await cb.from('memoriais').update({ status_memorial: 'respostas_recebidas', status: 'rascunho' }).eq('id', '074c0971-f34e-4d94-8d6b-196346c60c61');
  if (error) console.error("Error:", error);
  else console.log("Fixed status");
}
run();
