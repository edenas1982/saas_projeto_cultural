import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const memorialId = "8c222064-de54-41bd-8a09-694d8554e0c9";
  
  console.log("Simulando esgotamento de edições no memorial (edits_used = 4)...");
  const { data, error } = await supabase
    .from('memoriais')
    .update({ edits_used: 4, ciclo_contrato_plano: 1 })
    .eq('id', memorialId)
    .select()
    .single();

  if (error) {
    console.error("Erro ao atualizar memorial:", error.message);
  } else {
    console.log("Memorial atualizado para edits_used = 4!", data);
  }
}

run();
