import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("=== INICIANDO TESTE DO UNIVERSAL RESET ===");
  
  // 1. Login do usuário
  console.log("Realizando login...");
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: "nascimentopalotina@gmail.com",
    password: "password123", 
  });

  if (authErr) {
    console.error("Falha no login de teste:", authErr.message);
    return;
  }

  const token = authData.session.access_token;
  const userId = authData.user.id;
  console.log(`Logado com sucesso. ID do Usuário: ${userId}`);

  // Obter saldo inicial
  const walletBalance = authData.user.user_metadata?.wallet_balance || 40.00;
  console.log(`Saldo de créditos inicial na carteira: ${walletBalance}`);

  // 2. Obter memorial do usuário
  const { data: memorials, error: memErr } = await supabase
    .from('memoriais')
    .select('*')
    .eq('user_id', userId)
    .limit(1);

  if (memErr || !memorials || memorials.length === 0) {
    console.error("Nenhum memorial encontrado para este usuário.");
    return;
  }

  const memorial = memorials[0];
  console.log(`Memorial encontrado: "${memorial.nome_homenageado}" (ID: ${memorial.id})`);
  console.log(`Status inicial: status=${memorial.status}, status_memorial=${memorial.status_memorial}, edits_used=${memorial.edits_used}/${memorial.edits_limit}, ciclo=${memorial.ciclo_contrato_plano}`);

  // 3. Garantir que existam respostas e narrativas para testar a limpeza
  console.log("Preparando dados fictícios para limpar...");
  
  // Limpar respostas antigas de teste se existirem
  await supabase.from('respostas').delete().eq('memorial_id', memorial.id);

  // Inserir respostas fictícias
  const { error: insRespErr } = await supabase.from('respostas').insert([
    { 
      memorial_id: memorial.id, 
      pergunta_id: "00000000-0000-0000-0000-000000000001", 
      resposta: "Resposta fictícia para testes do reset.",
      pergunta_texto_snapshot: "Pergunta de Teste?",
      gaveta_snapshot: "Sobre ele",
      opcional: false
    }
  ]);
  if (insRespErr) console.log("Erro ao inserir respostas fictícias:", insRespErr.message);

  // Garantir narrativa fictícia oficial com áudio
  await supabase.from('narrativas').delete().eq('memorial_id', memorial.id);
  const { error: insNarrErr } = await supabase.from('narrativas').insert([
    { 
      memorial_id: memorial.id, 
      conteudo_completo: "Esta é uma biografia fictícia oficial para testes de reset de dados.", 
      status_publicacao: "oficial",
      audio_url: `https://test-bucket.supabase.co/storage/v1/object/public/memoriais/memorials/${memorial.id}/timeline.mp3`,
      audio_status: "success",
      template: "visual",
      versao: 1
    }
  ]);
  if (insNarrErr) console.log("Erro ao inserir narrativa fictícia:", insNarrErr.message);

  // Inserir mensagens de condolência fictícias para garantir que NÃO sejam apagadas
  await supabase.from('mensagens_visitantes').delete().eq('memorial_id', memorial.id);
  const { error: insMsgErr } = await supabase.from('mensagens_visitantes').insert([
    { 
      memorial_id: memorial.id, 
      autor_nome: "Visitante de Teste", 
      conteudo: "Esta mensagem de condolência não deve ser apagada no reset.", 
      aprovado: true 
    }
  ]);
  if (insMsgErr) console.log("Erro ao inserir mensagem de condolência fictícia:", insMsgErr.message);

  // 4. Executar o reset via API (Cenário Gratuito)
  // Como edits_used do memorial no banco pode variar, vamos rodar a chamada.
  console.log("Executando chamada à API de reset...");
  const res = await fetch(`http://localhost:3000/api/memorial/${memorial.id}/reset`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    }
  });

  console.log(`API Status: ${res.status} ${res.statusText}`);
  const data: any = await res.json();
  console.log("Resultado da API:", JSON.stringify(data, null, 2));

  // 5. Validar o banco após o reset
  console.log("Validando banco de dados pós-reset...");
  
  // Respostas limpas?
  const { data: respsAfter } = await supabase.from('respostas').select('*').eq('memorial_id', memorial.id);
  console.log(`Respostas após reset: ${respsAfter?.length || 0} (Esperado: 0)`);

  // Narrativas arquivadas?
  const { data: narrsAfter } = await supabase.from('narrativas').select('*').eq('memorial_id', memorial.id);
  console.log(`Narrativas após reset: ${narrsAfter?.length || 0}`);
  if (narrsAfter) {
    narrsAfter.forEach(n => {
      console.log(` - Narrativa: status_publicacao=${n.status_publicacao}, audio_url=${n.audio_url}, audio_status=${n.audio_status}`);
    });
  }

  // Condolências mantidas?
  const { data: msgsAfter } = await supabase.from('mensagens_visitantes').select('*').eq('memorial_id', memorial.id);
  console.log(`Mensagens de condolências após reset: ${msgsAfter?.length || 0} (Esperado: 1)`);

  // Dados do memorial updated?
  const { data: memorialAfter } = await supabase.from('memoriais').select('*').eq('id', memorial.id).single();
  if (memorialAfter) {
    console.log(`Memorial após reset: status=${memorialAfter.status}, status_memorial=${memorialAfter.status_memorial}, edits_used=${memorialAfter.edits_used}, ciclo=${memorialAfter.ciclo_contrato_plano}`);
  }

  // Verificar se auditoria foi gerada
  const { data: audits } = await supabase
    .from('memorial_audit_logs')
    .select('*')
    .eq('memorial_id', memorial.id)
    .eq('action_type', 'reset_memorial')
    .order('created_at', { ascending: false })
    .limit(1);
  
  if (audits && audits.length > 0) {
    console.log(`Auditoria encontrada! action_type=${audits[0].action_type}, ciclo=${audits[0].ciclo_contrato_plano}, payload:`, JSON.stringify(audits[0].payload));
  } else {
    console.log("Aviso: Log de auditoria 'reset_memorial' não encontrado.");
  }

  console.log("=== TESTE DO UNIVERSAL RESET CONCLUÍDO ===");
}

run();
