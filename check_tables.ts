import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

supabaseUrl = supabaseUrl!.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function run() {
  const { data, error } = await supabase.from('perfis').select('*').limit(1);
  console.log("perfis: ", error ? error.message : data);
  
  const { data: d2, error: e2 } = await supabase.from('profiles').select('*').limit(1);
  console.log("profiles: ", e2 ? e2.message : d2);
}
run();
