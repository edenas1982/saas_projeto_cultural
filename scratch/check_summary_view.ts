import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const url = process.env.VITE_SUPABASE_URL!.replace('/rest/v1/', '');
const supabaseAdmin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const { data: summary, error: sumErr } = await supabaseAdmin.from('vw_telemetry_summary').select('*');
  if (sumErr) {
    console.error('Summary view error:', sumErr.message);
  } else {
    console.log('--- Telemetry Summary View ---');
    console.log(summary);
  }

  const { data: events, error: evtErr } = await supabaseAdmin.from('api_usage_events').select('*');
  if (evtErr) {
     console.error('Events error:', evtErr.message);
  } else {
     console.log('--- API Usage Events ---');
     console.log(events);
  }
}
run();
