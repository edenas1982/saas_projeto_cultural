import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL!.replace('/rest/v1/', '');
const supabaseAdmin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const { data, error } = await supabaseAdmin.from('memorial_qrcodes').select('*');
  if (error) {
    console.error('Error fetching qrcodes:', error);
  } else {
    console.log('All QR Codes in DB:', data);
  }
}
run();
