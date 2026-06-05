import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

supabaseUrl = supabaseUrl!.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function run() {
  const { data, error } = await supabase.from('users').select('*').limit(1);
  if (error) {
     console.error("users error: ", error.message);
  } else {
     console.log("users table exists");
  }

  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
  if (authError) {
     console.error("auth.users error: ", authError.message);
  } else {
     console.log("auth.users count: ", authUsers.users.length);
     if (authUsers.users.length > 0) {
        console.log("first auth user: ", authUsers.users[0].id, authUsers.users[0].email, authUsers.users[0].user_metadata?.nome);
     }
  }
}
run();
