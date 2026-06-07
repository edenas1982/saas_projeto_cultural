import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
  let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
  const cb = createClient(supabaseUrl, supabaseKey);
  const { data: logs, error } = await cb.from('memorial_audit_logs').select('*').order('created_at', { ascending: false }).limit(20);
  console.log("LOGS: ", JSON.stringify(logs, null, 2));
  if (error) console.error("ERROR: ", error);
}
run();
