import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "";
supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: { session }, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'nascimentopalotina@gmail.com',
    password: 'password123' // hope this is not needed or we can fetch without login?
  });
  
  // if login fails, let's just query anon 
  const { data, error } = await supabase.from('respostas').select('id').eq('memorial_id', '30cd3e0c-03c8-4929-a4ae-8d1be17aed0c');
  console.log("respostas under anon:", data?.length);
}
run();
