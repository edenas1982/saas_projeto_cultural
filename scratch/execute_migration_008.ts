import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";
dotenv.config();

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sql = fs.readFileSync('migrations/008_update_rls_mensagens_visitantes.sql', 'utf8');
  
  const rpcs = ['exec_sql', 'run_sql', 'execute_sql'];
  let success = false;

  for (const rpcName of rpcs) {
    console.log(`Trying RPC: ${rpcName}...`);
    const { data, error } = await supabase.rpc(rpcName, { sql_query: sql, query: sql, sql });
    if (!error) {
      console.log(`✅ Success running migration 008 via RPC: ${rpcName}`);
      success = true;
      break;
    } else {
      console.log(`❌ RPC ${rpcName} failed:`, error.message);
    }
  }

  if (!success) {
    console.log("⚠️ Could not execute SQL remotely via RPC. Please run it manually in Supabase Dashboard SQL Editor:");
    console.log(sql);
  }
}
run();
