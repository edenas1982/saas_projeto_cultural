import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('respostas').select('*').eq('memorial_id', '30cd3e0c-03c8-4929-a4ae-8d1be17aed0c');
  if (error) {
    console.error("ERROR:", error);
  } else {
    console.log(`Found ${data.length} responses for Maximiliano.`);
  }
}

run();
