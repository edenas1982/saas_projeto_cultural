import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Testing run_sql RPC...");
  try {
    const { data, error } = await supabase.rpc('run_sql', { sql: 'SELECT 1 as val;' });
    if (error) {
      console.error("Error executing run_sql:", error);
    } else {
      console.log("Success! Data:", data);
    }
  } catch (err) {
    console.error("Catch error:", err);
  }
}
run();
