import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("=== CHECKING VIEWS ===");

  const { data: summary, error: sumErr } = await supabase
    .from('vw_telemetry_summary')
    .select('*');

  console.log("vw_telemetry_summary error:", sumErr ? sumErr.message : "None");
  console.log("vw_telemetry_summary data:", summary);

  const { data: dist, error: distErr } = await supabase
    .from('vw_distribuicao_custo_feature')
    .select('*');

  console.log("vw_distribuicao_custo_feature error:", distErr ? distErr.message : "None");
  console.log("vw_distribuicao_custo_feature data:", dist);
}
run();
