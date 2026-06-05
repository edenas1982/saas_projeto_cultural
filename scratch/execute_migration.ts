import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";
dotenv.config();

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sql = fs.readFileSync('migrations/005_create_vw_telemetry_summary.sql', 'utf8');
  
  // Test common names for sql execution RPCs
  const rpcs = ['exec_sql', 'run_sql', 'execute_sql'];
  let success = false;

  for (const rpcName of rpcs) {
    console.log(`Trying RPC: ${rpcName}...`);
    const { data, error } = await supabase.rpc(rpcName, { sql_query: sql, query: sql, sql });
    if (!error) {
      console.log(`✅ Success running migration via RPC: ${rpcName}`);
      success = true;
      break;
    } else {
      console.log(`❌ RPC ${rpcName} failed:`, error.message);
    }
  }

  if (!success) {
    console.log("⚠️ Could not execute SQL remotely via RPC. This is normal if RLS/security is hardened. The view should be applied manually via the Supabase SQL editor or CLI.");
  }
}
run();
