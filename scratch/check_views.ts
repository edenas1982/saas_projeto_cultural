import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  // Verificando tabelas/views no information_schema ou tentando dar select simples
  const viewsToCheck = [
    'vw_distribuicao_custo_feature',
    'vw_custo_por_memorial',
    'vw_custo_por_funeraria_mes',
    'view_support_metrics_costs',
    'view_api_costs_summary',
    'api_usage_events',
    'feature_catalog',
    'provider_catalog',
    'api_pricing_catalog'
  ];

  for (const name of viewsToCheck) {
    const { data, error } = await supabase.from(name).select('*').limit(1);
    if (error) {
      console.log(`❌ ${name}: ${error.message}`);
    } else {
      console.log(`✅ ${name} exists! Fields:`, data.length > 0 ? Object.keys(data[0]) : 'Empty');
    }
  }
}
run();
