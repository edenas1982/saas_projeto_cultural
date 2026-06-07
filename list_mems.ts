import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

supabaseUrl = supabaseUrl!.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function run() {
  console.log("Searching for Maximiliano Mamado...");
  const { data: memorials, error } = await supabase
    .from('memoriais')
    .select('*')
    .ilike('nome_homenageado', '%Maximiliano%');

  if (error) {
     console.error("error searching memorial: ", error.message);
     return;
  }
  
  if (!memorials || memorials.length === 0) {
    console.log("No memorial found matching Maximiliano.");
    return;
  }

  const m = memorials[0];
  console.log("FOUND MEMORIAL:", {
    id: m.id,
    user_id: m.user_id,
    nome_homenageado: m.nome_homenageado,
    status: m.status,
    status_memorial: m.status_memorial,
    perfil_tom: m.perfil_tom,
    perfil_densidade: m.perfil_densidade,
    total_perguntas_respondidas: m.total_perguntas_respondidas
  });

  const { data: respostas, error: respErr } = await supabase
    .from('respostas')
    .select('*')
    .eq('memorial_id', m.id);

  if (respErr) {
    console.error("error fetching respostas:", respErr);
  } else {
    console.log(`FOUND ${respostas?.length || 0} RESPOSTAS:`);
    respostas?.forEach(r => {
      console.log(`- [${r.gaveta_snapshot}] ${r.pergunta_texto_snapshot}: ${r.resposta}`);
    });
  }

  const { data: narratives, error: narrErr } = await supabase
    .from('narrativas')
    .select('*')
    .eq('memorial_id', m.id)
    .order('versao', { ascending: false });

  if (narrErr) {
    console.error("error fetching narratives:", narrErr);
  } else {
    console.log(`FOUND ${narratives?.length || 0} NARRATIVES:`);
    narratives?.forEach(n => {
      console.log(`- Version: ${n.versao}, ID: ${n.id}, Created At: ${n.criado_em}`);
      console.log(`  Content length: ${n.conteudo_completo?.length || 0}`);
      console.log(`  Content preview: ${n.conteudo_completo?.substring(0, 100)}...`);
    });
  }
}
run();

