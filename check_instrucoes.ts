import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: memoriais } = await supabase.from('memoriais').select('id, nome_homenageado').eq('origem_sistema', 'saas');
  
  if (memoriais && memoriais.length > 0) {
    const memorial = memoriais[0];
    console.log(`Memorial encontrado: ${memorial.nome_homenageado} (ID: ${memorial.id})`);
    
    const { data: eventos, error: eventosError } = await supabase.from('eventos_geracao')
       .select('gerado_em, motivo_geracao, instrucao_ajuste')
       .eq('memorial_id', memorial.id)
       .order('gerado_em', { ascending: true });
       
    if (eventos) {
      console.log(`Encontrados ${eventos.length} eventos de geração/ajuste:`);
      eventos.forEach((ev, idx) => {
        console.log(`${idx + 1}. [${ev.motivo_geracao}] - Instrução: ${ev.instrucao_ajuste || '(vazio)'}`);
      });
    } else {
      console.error('Erro ao buscar eventos:', eventosError);
    }
  } else {
    console.log("Nenhum memorial saas encontrado.");
  }
}
run();
