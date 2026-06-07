import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "";
supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'nascimentopalotina@gmail.com',
    password: 'password123'
  });
  if (authError) {
     console.log("Auth error:", authError);
     return;
  }
  const { data, error } = await supabase.from('memoriais').select('id, nome_homenageado').eq('id', '2474529f-630d-4d2e-86f6-ea712bda7804');
  console.log("User Read Armando:", data, error);
}
run();
