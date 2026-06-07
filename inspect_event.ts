import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('api_usage_events')
    .select('*')
    .eq('id', 'abfe9ce8-cbf2-4799-8c95-7a4e73b1f498')
    .single();

  if (error) {
    console.error("Error fetching event:", error.message);
  } else {
    console.log("Full Event Details:");
    console.log(JSON.stringify(data, null, 2));
  }
}
run();
