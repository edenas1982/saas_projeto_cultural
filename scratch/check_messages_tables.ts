import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const tables = [
    'mensagens_visitantes',
    'condolence_book',
    'memorial_settings',
    'memoriais',
    'qrcodes',
    'memorial_qrcodes'
  ];

  for (const name of tables) {
    const { data, error } = await supabase.from(name).select('*').limit(1);
    if (error) {
      console.log(`❌ ${name}: ${error.message}`);
    } else {
      console.log(`✅ ${name} exists! Fields:`, data.length > 0 ? Object.keys(data[0]) : 'Empty');
    }
  }
}
run();
