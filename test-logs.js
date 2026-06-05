const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const cb = createClient(supabaseUrl, supabaseKey);
  const { data: logs, error } = await cb.from('memorial_audit_logs').select('*').order('created_at', { ascending: false }).limit(20);
  console.log(JSON.stringify(logs, null, 2));
  if (error) console.error(error);
}
run();
