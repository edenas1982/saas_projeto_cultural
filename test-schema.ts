import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
  let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
  const cb = createClient(supabaseUrl, supabaseKey);
  const { data, error } = await cb.rpc('reload_schema'); // Not standard but let's try something else
  
  const { data: cols, error: colsErr } = await cb.from('narrativas').select('*').limit(1);
  console.log("Cols in narrativas:", Object.keys(cols?.[0] || {}));
}
run();
