import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

supabaseUrl = supabaseUrl!.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function run() {
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) {
     console.error("auth.users error: ", error.message);
  } else {
     console.log("auth.users count: ", data.users.length);
     console.log("auth users meta: ", data.users.map(u => u.user_metadata));
  }
}
run();
