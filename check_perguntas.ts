import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('perguntas').select('*').order('ordem', { ascending: true });
  if (data) {
      data.forEach(p => console.log(`${p.ordem}. [Gaveta: ${p.gaveta}] ${p.texto_pergunta}`));
  } else {
      console.error(error);
  }
}
run();
