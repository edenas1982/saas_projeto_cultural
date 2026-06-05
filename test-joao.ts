import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
  let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
  const cb = createClient(supabaseUrl, supabaseKey);

  // Ache o id do Joao
  const { data: mems } = await cb.from('memoriais').select('id, nome_homenageado, status, status_memorial, total_perguntas_respondidas').ilike('nome_homenageado', '%joao maia%').limit(1);
  if (!mems || mems.length === 0) {
     console.log("No memorial found");
     return;
  }
  
  console.log("Memorial:", mems[0]);
  const memorial_id = mems[0].id;
  
  // Pegar as narrativas
  const { data: narrativas } = await cb.from('narrativas').select('id, plano_na_geracao, gerado_em, status_publicacao, conteudo_completo').eq('memorial_id', memorial_id).order('gerado_em', { ascending: false });
  
  console.log("NARRATIVAS:");
  console.log(JSON.stringify(narrativas, null, 2));

}
run();
