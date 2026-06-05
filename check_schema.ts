import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: mem, error: memErr } = await supabase.from('memoriais').select('*').limit(1);
  if (mem) console.log('memoriais:', Object.keys(mem[0]));
  
  const { data: nar, error: narErr } = await supabase.from('narrativas').select('*').limit(1);
  if (nar) console.log('narrativas:', Object.keys(nar[0]));
}
run();
