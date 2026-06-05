import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const userId = "78654881-7776-4391-8e3f-03d54bc135d9"; // nascimentopalotina@gmail.com
  
  console.log("Inserindo memorial de teste para nascimentopalotina@gmail.com...");
  const { data, error } = await supabase
    .from('memoriais')
    .insert([{
      user_id: userId,
      nome_homenageado: "Homenageado de Teste Reset",
      status: 'rascunho',
      plano_geracao: 'premium',
      ciclo_contrato_plano: 1,
      edits_used: 1, // Simular 1 edição realizada
      edits_limit: 4, // Premium
      origem_sistema: 'saas'
    }])
    .select()
    .single();

  if (error) {
    console.error("Erro ao criar memorial de teste:", error.message);
  } else {
    console.log("Memorial de teste criado com sucesso!", data);
  }
}

run();
