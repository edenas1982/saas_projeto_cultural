import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('respostas').select('id, user_id').eq('memorial_id', '30cd3e0c-03c8-4929-a4ae-8d1be17aed0c');
  if (data && data.length > 0) {
    console.log(`First response user_id: ${data[0].user_id}`);
  }
}
run();
