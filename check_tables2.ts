import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('memorial_versions').select('id').limit(1);
  if (error) {
    console.error("memorial_versions API ERROR:", error.message);
  } else {
    console.log("memorial_versions API SUCCESS");
  }

  const { data: qdata, error: qerror } = await supabase.from('question_invites').select('id').limit(1);
  if (qerror) {
    console.error("question_invites API ERROR:", qerror.message);
  } else {
    console.log("question_invites API SUCCESS");
  }
}

run();
