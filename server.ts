import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { IAProviderFactory } from "./src/services/IAProviderFactory.js";
import { AuditService } from "./src/services/AuditService.js";
import { SagaExecutor } from "./src/services/SagaExecutor.js";
import { SupportService } from "./src/services/SupportService.js";
import { TelemetryService } from "./src/services/TelemetryService.js";
import { createOperationId } from "./src/services/operationContext.js";
import { VoiceGovernanceService } from "./src/services/VoiceGovernanceService.js";
import { ErrorMapper } from "./src/services/ErrorMapper.js";
import dotenv from "dotenv";
import fs from "fs";
import util from "util";
import { authenticateToken } from "./src/middleware/auth.js";
import telemetriaRoutes from "./src/routes/startup/telemetria.routes.js";

// Redirecionamento de logs para depuração em tempo real
const logFile = fs.createWriteStream(path.join(process.cwd(), "server_console.log"), { flags: "a" });
const logStdout = process.stdout;
const logStderr = process.stderr;

console.log = function (...args) {
  const msg = util.format(...args) + "\n";
  logFile.write(msg);
  logStdout.write(msg);
};

console.error = function (...args) {
  const msg = util.format(...args) + "\n";
  logFile.write("[ERROR] " + msg);
  logStderr.write(msg);
};

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Middleware de autenticação importado de src/middleware/auth.ts

  // Endpoint público para captar interessados na startup
  app.post("/api/interesse", async (req, res) => {
    try {
      const { nome, empresa, segmento, email, whatsapp, receberNovidades } = req.body;

      if (!nome || !email) {
        return res.status(400).json({ error: "Nome e Email são obrigatórios." });
      }

      // 1. Salvar no Supabase (se a tabela de interessados existir)
      let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (supabaseUrl && supabaseKey) {
        supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        // Tentativa rápida de inserir no supabase caso exista a tabela, sem quebrar se falhar
        const { error: insertError } = await supabase.from('interessados').insert({
          nome,
          empresa,
          segmento,
          email,
          whatsapp,
          receber_novidades: receberNovidades
        });
        if (insertError) {
          console.warn("Erro ao inserir em interessados (a tabela pode não existir):", insertError.message);
        }
      }

      // 2. Enviar email via Nodemailer
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;
      const smtpHost = process.env.SMTP_HOST;
      const smtpPort = parseInt(process.env.SMTP_PORT || '587');

      if (smtpUser && smtpPass && smtpHost) {
        const nodemailer = await import('nodemailer');
        
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
        });

        const mailOptions = {
          from: `"Eco de Memórias" <${smtpUser}>`,
          to: 'contato@ecomemoriasapp.com', // Destino especificado
          subject: 'Novo interessado — Eco de Memórias',
          html: `
            <div style="font-family: sans-serif; color: #1a1a1a;">
              <h2 style="color: #2d5a4e;">Novo Parceiro/Interessado</h2>
              <p>O acompanhamento de evolução da plataforma recebeu um novo cadastro:</p>
              <ul>
                <li><strong>Nome:</strong> ${nome}</li>
                <li><strong>Empresa:</strong> ${empresa || '-'}</li>
                <li><strong>Segmento:</strong> ${segmento || '-'}</li>
                <li><strong>Email:</strong> ${email}</li>
                <li><strong>WhatsApp:</strong> ${whatsapp || '-'}</li>
              </ul>
              <hr style="border: none; border-top: 1px solid #ccc; margin: 20px 0;" />
              <h3>Interesse Adicional:</h3>
              <p>Receber acesso antecipado e novidades exclusivas: <strong>${receberNovidades ? 'Sim' : 'Não'}</strong></p>
              <br/>
              <p style="font-size: 12px; color: #888;">Recebido em ${new Date().toLocaleString('pt-BR')}</p>
            </div>
          `
        };

        await transporter.sendMail(mailOptions);
      } else {
        console.warn("SMTP não configurado no .env. Apenas o salvamento local/supabase (caso ativado) ocorreu.");
      }

      return res.json({ success: true });
    } catch (error) {
      console.error('Erro ao processar interessado:', error);
      return res.status(500).json({ error: 'Erro ao processar sua solicitação.' });
    }
  });

  // ==========================================
  // ROTAS DO SUPORTE VIVO (Catálogo e Assistente)
  // ==========================================

  app.post("/api/suporte/chat", authenticateToken, async (req, res) => {
    try {
      const { pergunta, sessionId } = req.body;
      const user = (req as any).user;

      if (!pergunta) {
        return res.status(400).json({ error: "Pergunta obrigatória." });
      }

      let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        return res.status(500).json({ error: "Configurações do Supabase não encontradas." });
      }

      supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
      const supabaseClient = createClient(supabaseUrl, supabaseKey);

      // Gerar ou mapear sessionId como operationId
      const finalSessionId = sessionId || createOperationId();

      // Buscar a organization_id do usuário logado
      let organizationId: string | null = null;
      
      if (user?.id) {
        // 1. Procurar em organization_users
        const { data: orgUser } = await supabaseClient
          .from('organization_users')
          .select('organization_id')
          .eq('auth_user_id', user.id)
          .eq('ativo', true)
          .limit(1)
          .maybeSingle();

        if (orgUser?.organization_id) {
          organizationId = orgUser.organization_id;
        } else {
          // 2. Fallback para family_accounts
          const { data: familyAcc } = await supabaseClient
            .from('family_accounts')
            .select('organization_id')
            .eq('auth_user_id', user.id)
            .eq('ativo', true)
            .limit(1)
            .maybeSingle();

          if (familyAcc?.organization_id) {
            organizationId = familyAcc.organization_id;
          }
        }
      }

      const telemetryService = new TelemetryService(supabaseClient);
      const supportService = new SupportService(supabaseClient, telemetryService);
      const resposta = await supportService.responderSuporte(pergunta, {
        sessionId: finalSessionId,
        organizationId: organizationId || undefined,
        userId: user?.id
      });
      
      return res.json({ resposta });
    } catch (error: any) {
      console.error('Erro na rota de chat do suporte:', error);
      return res.status(500).json({ error: error.message || "Erro no processamento da IA." });
    }
  });

  // Cockpit de Telemetria — Núcleo Startup
  app.use('/api/startup/telemetria', telemetriaRoutes);

  // ==========================================
  // ROTAS DE CONVITE PARA MEMORIAL (question_invites)
  // ==========================================

  // Rota Privada: Criar um convite (O dono do memorial gera o link para um familiar)
  app.post("/api/invites/create", authenticateToken, async (req, res) => {
    try {
      const { memorial_id, destinatario_nome, destinatario_tel, perguntas_ids } = req.body;
      const user = (req as any).user;

      if (!memorial_id || !destinatario_nome) {
        return res.status(400).json({ error: 'Dados insuficientes para criar convite' });
      }

      let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        return res.status(500).json({ error: "Configurações do Supabase não encontradas" });
      }

      supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
      const supabase = createClient(supabaseUrl, supabaseKey);

      let finalPerguntasIds = perguntas_ids;
      
      if (!perguntas_ids || perguntas_ids.length === 0) {
        // Fase 1.4: Modo compartilhado inteligente
        const { data: allPerguntas } = await supabase.from('perguntas').select('id').order('ordem');
        
        // Verifica quais perguntas já foram respondidas
        const { data: respostasRealizadas } = await supabase.from('respostas').select('pergunta_id').eq('memorial_id', memorial_id);
        const respondidasIds = respostasRealizadas ? respostasRealizadas.map((r: any) => r.pergunta_id) : [];

        // Verifica perguntas já atribuídas a convites pendentes/enviados/acessados
        const { data: convitesAtivos } = await supabase
          .from('question_invites')
          .select('perguntas_ids')
          .eq('memorial_id', memorial_id)
          .in('status', ['pendente', 'enviado', 'acessado']);
          
        let atribuidasIds: string[] = [];
        if (convitesAtivos) {
           convitesAtivos.forEach((c: any) => {
               if (c.perguntas_ids && Array.isArray(c.perguntas_ids)) {
                   atribuidasIds.push(...c.perguntas_ids);
               }
           });
        }
        
        if (allPerguntas && allPerguntas.length > 0) {
          // Filtra out the already answered ones AND already assigned ones
          finalPerguntasIds = allPerguntas
            .map((p: any) => p.id)
            .filter((id: string) => !respondidasIds.includes(id))
            .filter((id: string) => !atribuidasIds.includes(id));
            
          // If all are taken, fallback to just excluding answered (allow overlap) if user forces link generation
          if (finalPerguntasIds.length === 0) {
             finalPerguntasIds = allPerguntas
                .map((p: any) => p.id)
                .filter((id: string) => !respondidasIds.includes(id));
                
             if (finalPerguntasIds.length === 0) {
                // Se tudo já foi respondido, apenas permite o link com todas as perguntas, assim o usuário pode revisar ou reenviar fotos.
                finalPerguntasIds = allPerguntas.map((p: any) => p.id);
             }
          }
        } else {
          return res.status(500).json({ error: 'Nenhuma pergunta encontrada no banco para enviar o convite.' });
        }
      }

      // Valida se usuário tem acesso (Dono do memorial)
      const { data: memorialArray, error: memorialError } = await supabase
        .from('memoriais')
        .select('user_id, family_account_id, organization_id')
        .eq('id', memorial_id)
        .limit(1);
        
      const memorial = memorialArray?.[0];
      if (memorialError || !memorial) {
        return res.status(403).json({ error: 'Acesso negado ao memorial' });
      }

      // Expira em 7 dias
      const expira_em = new Date();
      expira_em.setDate(expira_em.getDate() + 7);

      const { data: inviteArray, error: inviteError } = await supabase
        .from('question_invites')
        .insert({
          memorial_id,
          family_account_id: memorial.family_account_id || user.id,
          destinatario_nome,
          destinatario_tel,
          perguntas_ids: finalPerguntasIds,
          status: 'pendente',
          expira_em: expira_em.toISOString()
        })
        .select('*');
        
      const invite = inviteArray?.[0];

      if (inviteError || !invite) {
        return res.status(500).json({ error: 'Erro ao gerar o convite.', details: inviteError.message });
      }

      return res.json({ success: true, invite });
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({ error: error.message || 'Erro interno' });
    }
  });

  // Rota Privada: Listar convites de um memorial
  app.get("/api/invites/memorial/:memorialId", authenticateToken, async (req, res) => {
    try {
      const { memorialId } = req.params;
      
      let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      supabaseUrl = (supabaseUrl || '').replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
      const supabase = createClient(supabaseUrl, supabaseKey || '');

      const { data, error } = await supabase
        .from('question_invites')
        .select('*')
        .eq('memorial_id', memorialId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return res.json({ invites: data || [] });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Erro' });
    }
  });

  // Rota Privada: Atualizar status de um convite
  app.put("/api/invites/:inviteId/status", authenticateToken, async (req, res) => {
    try {
      const { inviteId } = req.params;
      const { status } = req.body;
      
      let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      supabaseUrl = (supabaseUrl || '').replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
      const supabase = createClient(supabaseUrl, supabaseKey || '');

      const { error } = await supabase
        .from('question_invites')
        .update({ status })
        .eq('id', inviteId);

      if (error) throw error;
      return res.json({ success: true });
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Erro' });
    }
  });

  // Rota Pública: Ler os dados de um convite a partir do token
  app.get("/api/public/invite/:token", async (req, res) => {
    try {
      const { token } = req.params;

      let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: "Setup DB falhou" });

      supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Busca o convite válido
      const { data: inviteArray, error: inviteError } = await supabase
        .from('question_invites')
        .select('*')
        .eq('token', token)
        .limit(1);

      const invite = inviteArray?.[0];
      if (inviteError || !invite) {
        return res.status(404).json({ error: 'Convite não encontrado ou inválido.' });
      }

      if (new Date(invite.expira_em) < new Date() || invite.status === 'concluido' || invite.status === 'expirado') {
        return res.status(410).json({ error: 'Este link expirou ou já foi utilizado.' });
      }

      if (invite.status === 'pendente' || invite.status === 'enviado') {
        await supabase.from('question_invites').update({ status: 'acessado' }).eq('id', invite.id);
      }

      // Busca dados do memorial (apenas o necessário)
      const { data: memorialArray } = await supabase
        .from('memoriais')
        .select('id, nome_homenageado')
        .eq('id', invite.memorial_id)
        .limit(1);
      
      const memorial = memorialArray?.[0];

      // Busca as perguntas passadas no convite
      const { data: perguntas } = await supabase
        .from('perguntas')
        .select('*')
        .in('id', invite.perguntas_ids)
        .order('ordem', { ascending: true });

      return res.json({ success: true, invite, memorial, perguntas });
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({ error: 'Erro interno' });
    }
  });

  // Rota Pública: Salvar as respostas a partir do token
  app.post("/api/public/invite/:token/respostas", async (req, res) => {
    try {
      const { token } = req.params;
      const { respostas } = req.body; // Array: [{ pergunta_id: uuid, resposta: string }]

      if (!respostas || !Array.isArray(respostas)) {
        return res.status(400).json({ error: 'Respostas inválidas.' });
      }

      let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: "Setup DB falhou" });

      supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Validação do token
      const { data: inviteArray, error: inviteError } = await supabase
        .from('question_invites')
        .select('*')
        .eq('token', token)
        .limit(1);

      const invite = inviteArray?.[0];

      if (inviteError || !invite) return res.status(404).json({ error: 'Convite inválido.' });
      if (new Date(invite.expira_em) < new Date() || invite.status === 'concluido' || invite.status === 'expirado') {
        return res.status(410).json({ error: 'O link já expirou ou foi utilizado.' });
      }

      // Busca respostas existentes para este memorial para não duplicar
      const { data: existingRespostas } = await supabase
        .from('respostas')
        .select('id, pergunta_id')
        .eq('memorial_id', invite.memorial_id);
        
      const existingMap: Record<string, string> = {};
      existingRespostas?.forEach((r: any) => {
        existingMap[r.pergunta_id] = r.id;
      });

      const processedAnswers = respostas
        .filter((r: any) => {
           // Se questoes antigas não tinham IDs, permite inserir
           if (!invite.perguntas_ids || invite.perguntas_ids.length === 0) return true;
           return invite.perguntas_ids.includes(r.pergunta_id);
        });
        
      const inserts: any[] = [];
      const updates: any[] = [];
      
      processedAnswers.forEach((r: any) => {
         if (existingMap[r.pergunta_id]) {
           updates.push({
             id: existingMap[r.pergunta_id],
             memorial_id: invite.memorial_id,
             pergunta_id: r.pergunta_id,
             resposta: r.resposta,
             pergunta_texto_snapshot: r.pergunta_texto_snapshot,
             gaveta_snapshot: r.gaveta_snapshot,
             opcional: r.opcional
           });
         } else {
           inserts.push({
             memorial_id: invite.memorial_id,
             pergunta_id: r.pergunta_id,
             resposta: r.resposta,
             pergunta_texto_snapshot: r.pergunta_texto_snapshot,
             gaveta_snapshot: r.gaveta_snapshot,
             opcional: r.opcional
           });
         }
      });

      if (inserts.length > 0) {
        const { error: insertError } = await supabase.from('respostas').insert(inserts);
        if (insertError) {
          console.error("Insert error:", insertError);
          return res.status(500).json({ error: 'Erro ao salvar novas respostas.', details: insertError.message });
        }
      }
      
      if (updates.length > 0) {
        const { error: updateError } = await supabase.from('respostas').upsert(updates, { onConflict: 'id' });
        if (updateError) {
          console.error("Update error:", updateError);
          return res.status(500).json({ error: 'Erro ao atualizar respostas.', details: updateError.message });
        }
      }

      // Atualiza status do convite
      await supabase.from('question_invites').update({ status: 'concluido' }).eq('id', invite.id);

      // Verifica total de questões já respondidas
      const { data: answeredQuestions } = await supabase
        .from('respostas')
        .select('pergunta_id')
        .eq('memorial_id', invite.memorial_id);

      const uniqueAnsweredIds = new Set(answeredQuestions?.map(r => r.pergunta_id) || []);
      const total_respondidas = uniqueAnsweredIds.size;

      // Como o envio público é final, sempre marcamos como recebido
      const { error: memorialUpdateError } = await supabase.from('memoriais').update({ 
        status_memorial: 'respostas_recebidas',
        total_perguntas_respondidas: total_respondidas
      }).eq('id', invite.memorial_id);
      
      if (memorialUpdateError) {
        console.error("Erro ao atualizar memorial:", memorialUpdateError);
      }
      
      // Expira os demais links que não foram concluídos
      await supabase
        .from('question_invites')
        .update({ status: 'expirado' })
        .eq('memorial_id', invite.memorial_id)
        .neq('status', 'concluido');

      return res.json({ success: true });
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({ error: 'Erro interno' });
    }
  });

  // Aplicar em TODAS as rotas sensíveis a custos/dados
  app.use('/api/narrativas', authenticateToken);

  // Iniciar dependências com tratamento de erro no momento de uso
  app.post("/api/narrativas/generate", async (req, res) => {
    let telemetryService: TelemetryService | undefined;
    let operationId: string | undefined;
    const tempoInicioGlobal = Date.now();
    let memorialOwner: any = null;
    let memorial_id: string | undefined;
    let user: any = null;
    let supabase: any;
    
    try {
      let { memorial_id: req_memorial_id, perfil_tom, densidade, motivo_geracao, contexto_adicional, modo_conteudo, texto_manual, ai_provider } = req.body;
      memorial_id = req_memorial_id;
      user = (req as any).user;

      if (!memorial_id) {
        return res.status(400).json({ error: 'Dados insuficientes para geracao' });
      }

      // Regra 2.5 - Limite do Campo de Instrução (Max 500)
      if (contexto_adicional && contexto_adicional.length > 500) {
        contexto_adicional = contexto_adicional.substring(0, 500);
      }

      let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        return res.status(500).json({ error: "SUPABASE URL ou SERVICE ROLE KEY não configurada no .env" });
      }

      supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
      supabase = createClient(supabaseUrl, supabaseKey);
 
      telemetryService = new TelemetryService(supabase);
      operationId = createOperationId();
 
      // --- VALIDAÇÃO DO DONO DO MEMORIAL E VERIFICAÇÃO DE FRANQUIA ---
      const { data: ownerData, error: ownerError } = await supabase
        .from('memoriais')
        .select('user_id, total_perguntas_respondidas, edits_used, edits_limit, plano_geracao, organization_id, status, status_memorial, deleted_at, text_edits_in_cycle')
        .eq('id', memorial_id)
        .single();
        
      memorialOwner = ownerData;
        
      if (ownerError || !memorialOwner) {
        return res.status(404).json({ error: 'Memorial não encontrado.' });
      }
 
      // Trava de memorial inativo ou suspenso (Item 6)
      if (memorialOwner.deleted_at || memorialOwner.status === 'suspenso' || memorialOwner.status_memorial === 'suspenso') {
        return res.status(403).json({ error: 'Geração bloqueada: Este memorial está inativo, suspenso ou foi excluído.' });
      }

      if (memorialOwner.user_id !== user.id) {
        console.error(`generate - Owner mismatch: memorial_user_id=${memorialOwner.user_id}, authenticated_user_id=${user.id}`);
        return res.status(403).json({ 
          error: 'Acesso negado: Você não é o dono deste memorial.',
          details: `Dono do memorial: ${memorialOwner.user_id} | Seu ID autenticado: ${user.id}`
        });
      }

      const currentEditsUsed = typeof memorialOwner.edits_used === 'number' ? memorialOwner.edits_used : 0;
      const currentEditsLimit = typeof memorialOwner.edits_limit === 'number' ? memorialOwner.edits_limit : 2;
      const currentTextEditsInCycle = typeof memorialOwner.text_edits_in_cycle === 'number' ? memorialOwner.text_edits_in_cycle : 0;
      
      if (modo_conteudo !== 'manual') {
        if (currentTextEditsInCycle >= 2 && currentEditsUsed >= currentEditsLimit) {
          return res.status(400).json({ 
            error: `Sua franquia de edições está esgotada no ciclo atual. Por favor, faça um upgrade para obter mais edições.` 
          });
        }
      }

      // Buscar respostas no lado do servidor
      const { data: respostas, error: respostasError } = await supabase
        .from('respostas')
        .select('*')
        .eq('memorial_id', memorial_id);

      if (modo_conteudo !== 'manual' && (respostasError || !respostas || respostas.length === 0)) {
        return res.status(400).json({ error: 'Dados insuficientes para geracao (sem respostas)' });
      }

      const total_perguntas = respostas ? respostas.length : 0;

      let conteudoCompleto = '';
      let identidadeRenderizada = '';
      let jornadaRenderizada = '';
      let essenciaRenderizada = '';
      let legadoRenderizado = '';
      let conteudoLimpo = '';
      let tokensInput = 0;
      let tokensOutput = 0;
      let tempoGeracaoMs = 0;
      let custoEstimado = 0;
      let modelName = 'manual';

      if (modo_conteudo === 'manual') {
        conteudoCompleto = texto_manual || '';
        conteudoLimpo = texto_manual || '';
      } else {
        const systemPrompt = `Você é o motor narrativo do sistema Ecos de Memória, especializado em transformar respostas de formulário em biografias com presença humana real. Você não é um gerador de texto genérico. Você é um biógrafo digital treinado para organizar sentimento, não apenas informação.
VOCABULÁRIO OFICIAL DO SISTEMA
Uma memória é qualquer dado que gera presença sensorial ou emocional. Pode ser física como um cheiro ou hábito, relacional como uma frase dita sempre para os filhos, ou atmosférica como o ritual do domingo. Uma memória nunca é apenas factual. Um fato é qualquer dado verificável, datável e objetivo. Nascimento, profissão, casamento, cidade. Fatos são as coordenadas da vida. Memórias são a atmosfera. Densidade é a riqueza do material disponível. Não é quantidade de respostas mas profundidade das memórias coletadas. Uma narrativa é a renderização final. É o produto, não o dado.
REGRAS OBRIGATÓRIAS DE GERAÇÃO
Nunca invente detalhes que não estejam nas respostas fornecidas. Nunca dramatize a morte ou o falecimento de forma excessiva. Não transforme automaticamente a narrativa em homenagem religiosa mesmo quando a pessoa tinha fé, a menos que a religiosidade seja um dado central e recorrente nas respostas. Não use linguagem excessivamente poética ou dramática quando o perfil do biografado for simples e cotidiano. Priorize memórias sensoriais e hábitos concretos em vez de qualidades abstratas como era bondoso ou era trabalhador. Nunca use as palavras guerreiro, lutou bravamente, deixou saudades, exemplo de vida ou sempre em nossos corações. Preserve contradições e imperfeições humanas com dignidade porque são elas que autenticam a narrativa. Não crie hierarquia entre relacionamentos quando a pessoa teve mais de um cônjuge ao longo da vida. Quando a densidade for mínima seja conciso e preciso em vez de preencher o vácuo com ornamentos. Adapte vocabulário e ritmo ao perfil de tom informado.
PERFIS DE TOM
Tom rustico: vocabulário simples, frases curtas, imagens concretas do cotidiano, sem linguagem elevada. Tom urbano: vocabulário mais dinâmico, ritmo mais acelerado, referências ao mundo moderno. Tom erudito: linguagem mais elaborada, construções mais complexas, maior densidade poética. Tom popular: linguagem acessível, afetiva, próxima da fala cotidiana brasileira.
REGRAS DE DENSIDADE
Se o memorial tiver menos de 13 respostas seja conciso e preciso, zero ornamentos, apoie-se nos fatos concretos. Se tiver entre 13 e 17 respostas escolha um eixo sensorial principal e desenvolva com profundidade. Se tiver 18 ou mais respostas crie arco narrativo completo com tensão e resolução, expanda as memórias sensoriais.
ESTRUTURA DE SAIDA OBRIGATORIA
Gere a biografia em quatro blocos claramente separados usando exatamente estes marcadores. IDENTIDADE_INICIO e IDENTIDADE_FIM para o bloco da gaveta Identidade. JORNADA_INICIO e JORNADA_FIM para o bloco da gaveta Jornada. ESSENCIA_INICIO e ESSENCIA_FIM para o bloco da gaveta Essencia. LEGADO_INICIO e LEGADO_FIM para o bloco da gaveta Legado.`;

        // Buscar histórico de instruções
        const { data: eventosHistoryGenerate } = await supabase
          .from('eventos_geracao')
          .select('instrucao_ajuste, motivo_geracao')
          .eq('memorial_id', memorial_id)
          .order('gerado_em', { ascending: true });
          
        let historicoInstrucoesGenerate = '';
        if (eventosHistoryGenerate) {
           const instrucoesSalvas = eventosHistoryGenerate
               .map(e => e.instrucao_ajuste ? e.instrucao_ajuste.trim() : '')
               .filter(i => i !== '' && i !== (contexto_adicional || '').trim());
               
           if (instrucoesSalvas.length > 0) {
               historicoInstrucoesGenerate = Array.from(new Set(instrucoesSalvas)).map((inst, i) => `Instrução prévia ${i + 1}: ${inst}`).join('\n');
           }
        }

        const respostasOrganizadas = (respostas || []).map((r: any) => {
          return `[${(r.gaveta_snapshot || '').toUpperCase()}] ${r.pergunta_texto_snapshot}: ${r.resposta}`;
        }).join('\n');

        let instrucaoTamanho = '';
        if (densidade === 'minimo' || densidade === '200') instrucaoTamanho = 'Gere uma biografia com cerca de 150 palavras (aproximadamente 1 minuto de narração). Como o espaço é curto, priorize a emoção ou memória central. Não invente detalhes e não omita os fatos vitais.';
        else if (densidade === 'medio' || densidade === '300') instrucaoTamanho = 'Gere uma biografia com cerca de 250 palavras (aproximadamente 2 minutos de narração). Distribua bem os detalhes da vida e as características pessoais.';
        else if (densidade === 'documental' || densidade === '400') instrucaoTamanho = 'Gere uma biografia profunda com no máximo 350 a 400 palavras (aproximadamente 3 minutos de narração). Explore todas as memórias fornecidas com riqueza, nunca inventando fatos extras para preencher espaço.';

        let instrucaoEstilo = '';
        if (perfil_tom === 'rustico') instrucaoEstilo = 'use vocabulário simples, frases curtas, imagens concretas do cotidiano, sem linguagem elevada.';
        else if (perfil_tom === 'popular') instrucaoEstilo = 'use linguagem acessível, afetiva, próxima da fala cotidiana brasileira.';
        else if (perfil_tom === 'erudito') instrucaoEstilo = 'use linguagem formal, respeitosa, mais elaborada, com construções mais complexas e maior densidade poética adequada para homenagens.';
        else if (perfil_tom === 'urbano') instrucaoEstilo = 'use vocabulário mais dinâmico, ritmo mais acelerado, referências ao mundo moderno, construindo uma narrativa imersiva.';

        const userPrompt = `
Gere a biografia completa baseada nas seguintes respostas do formulario.
${instrucaoTamanho ? `INSTRUÇÃO DE TAMANHO: ${instrucaoTamanho}\n` : ''}${instrucaoEstilo ? `INSTRUÇÃO DE ESTILO: ${instrucaoEstilo}\n` : ''}TOTAL DE RESPOSTAS: ${total_perguntas} de 20
${historicoInstrucoesGenerate ? `HISTÓRICO DE INSTRUÇÕES PRÉVIAS (Mantenha esses ajustes na nova geração):\n${historicoInstrucoesGenerate}\n` : ''}
${contexto_adicional ? `NOVA INSTRUÇÃO DO FAMILIAR: ${contexto_adicional}\n` : ''}
RESPOSTAS DO FORMULARIO:
${respostasOrganizadas || 'Nenhuma resposta fornecida (baseie-se apenas no texto atual e nas instruções).'}
Gere a biografia respeitando todos os marcadores de bloco definidos no system prompt.
`;

        const provider = IAProviderFactory.createProvider(ai_provider);
        const tempoInicio = Date.now();
        const response = await provider.generateText(userPrompt, 2000, systemPrompt);
        const tempoFim = Date.now();

        tempoGeracaoMs = tempoFim - tempoInicio;
        conteudoCompleto = response.text;
        tokensInput = response.inputTokens;
        tokensOutput = response.outputTokens;
        modelName = response.model;
        custoEstimado = (tokensInput * 0.000003) + (tokensOutput * 0.000015);

        const extrairBloco = (texto: string, inicio: string, fim: string): string => {
          const regex = new RegExp(`${inicio}([\\s\\S]*?)${fim}`);
          const match = texto.match(regex);
          return match ? match[1].trim() : '';
        };

        identidadeRenderizada = extrairBloco(conteudoCompleto, 'IDENTIDADE_INICIO', 'IDENTIDADE_FIM');
        jornadaRenderizada = extrairBloco(conteudoCompleto, 'JORNADA_INICIO', 'JORNADA_FIM');
        essenciaRenderizada = extrairBloco(conteudoCompleto, 'ESSENCIA_INICIO', 'ESSENCIA_FIM');
        legadoRenderizado = extrairBloco(conteudoCompleto, 'LEGADO_INICIO', 'LEGADO_FIM');

        conteudoLimpo = [identidadeRenderizada, jornadaRenderizada, essenciaRenderizada, legadoRenderizado]
          .filter(texto => texto.length > 0)
          .join('\n\n');

        if (!conteudoLimpo) {
          conteudoLimpo = conteudoCompleto.replace(/(IDENTIDADE_INICIO|IDENTIDADE_FIM|JORNADA_INICIO|JORNADA_FIM|ESSENCIA_INICIO|ESSENCIA_FIM|LEGADO_INICIO|LEGADO_FIM)/g, '').replace(/\n{3,}/g, '\n\n').trim();
        }
      }

      // Obter última versão
      const { data: latestNarrativa } = await supabase
        .from('narrativas')
        .select('versao')
        .eq('memorial_id', memorial_id)
        .order('versao', { ascending: false })
        .limit(1)
        .single();
      
      const newVersion = (latestNarrativa?.versao || 0) + 1;

      // Arquivar rascunhos anteriores
      await supabase
        .from('narrativas')
        .update({ status_publicacao: 'arquivado' })
        .eq('memorial_id', memorial_id)
        .eq('status_publicacao', 'rascunho');

      const { data: narrativa, error: narrativaError } = await supabase
        .from('narrativas')
        .insert({
          memorial_id,
          template: 'visual',
          conteudo_completo: conteudoLimpo || conteudoCompleto,
          conteudo_original: conteudoCompleto,
          identidade_renderizada: identidadeRenderizada,
          jornada_renderizada: jornadaRenderizada,
          essencia_renderizada: essenciaRenderizada,
          legado_renderizado: legadoRenderizado,
          modo_conteudo: modo_conteudo === 'manual' ? 'manual' : 'gerado_ia',
          status_publicacao: 'rascunho',
          versao: newVersion,
          modelo_llm: modelName,
          plano_na_geracao: memorialOwner.plano_geracao || 'basico',
          prompt_version: '1.0',
          narrativa_engine_version: '1.0',
          perguntas_usadas_na_geracao: modo_conteudo === 'manual' ? 0 : total_perguntas,
        })
        .select()
        .single();

      if (narrativaError) {
        console.error('Erro ao salvar narrativa:', narrativaError);
        return res.status(500).json({ error: `Erro ao salvar narrativa: ${narrativaError.message || JSON.stringify(narrativaError)}` });
      }

      // Fase 1.5 - Gravar snapshot em memorial_versions
      await supabase.from('memorial_versions').insert({
        memorial_id,
        narrativa_id: narrativa.id,
        version_number: newVersion,
        conteudo: narrativa.conteudo_completo,
        origem: modo_conteudo === 'manual' ? 'saas_manual' : 'saas_generation',
        criado_por_id: user.id,
        resumo_mudanca: modo_conteudo === 'manual' ? 'Biografia inserida manualmente' : 'Biografia gerada via IA (completa)'
      });

      const { error: eventosError } = await supabase
        .from('eventos_geracao')
        .insert({
          memorial_id,
          narrativa_id: narrativa.id,
          densidade_usada: densidade || 'medio',
          tom_usado: perfil_tom || 'popular',
          modelo_llm: modelName,
          prompt_version: '1.0',
          motivo_geracao: modo_conteudo === 'manual' ? 'insercao manual' : (motivo_geracao || 'primeira geracao'),
          total_perguntas: modo_conteudo === 'manual' ? 0 : total_perguntas,
          instrucao_ajuste: contexto_adicional || undefined,
        });

      if (eventosError) {
        console.error('Erro ao salvar evento:', eventosError);
        return res.status(500).json({ error: `Erro ao salvar evento: ${eventosError.message || JSON.stringify(eventosError)}` });
      }

      // Calcular limites de edições sob a Regra de Autonomia 2 para 1
      let nextEditsUsed = currentEditsUsed;
      let nextTextEditsInCycle = currentTextEditsInCycle;

      if (modo_conteudo !== 'manual') {
        nextTextEditsInCycle += 1;
        if (nextTextEditsInCycle > 2) {
          nextEditsUsed += 1;
        }
      }

      await supabase
        .from('memoriais')
        .update({ 
          status: 'gerado',
          edits_used: nextEditsUsed,
          text_edits_in_cycle: nextTextEditsInCycle
        })
        .eq('id', memorial_id);

      await AuditService.logEvent(supabase, {
        memorial_id: memorial_id,
        entity_type: 'narrativa',
        entity_id: narrativa.id,
        actor_id: user.id,
        actor_role: modo_conteudo === 'manual' ? 'user' : 'system',
        action_type: modo_conteudo === 'manual' ? 'insercao_manual' : 'geracao_ia',
        plano_snapshot: { nome: memorialOwner.plano_geracao || 'basico' },
        payload: {
           modo_conteudo: modo_conteudo === 'manual' ? 'manual' : 'gerado_ia',
           densidade: densidade,
           tom: perfil_tom,
           instrucao_ajuste: contexto_adicional
        }
      }, true);

      // Registrar telemetria se gerado via IA
      if (modo_conteudo !== 'manual') {
        await telemetryService.registerApiUsage({
          provider: ai_provider || 'anthropic',
          model: modelName,
          feature: 'memorial_text',
          operationId,
          organizationId: memorialOwner.organization_id || undefined,
          memorialId: memorial_id,
          userId: user.id,
          tokensInput,
          tokensOutput,
          latencyMs: tempoGeracaoMs,
          status: 'success'
        }).catch(err => console.error('[Telemetry generate] erro ao registrar sucesso:', err));
      }

      return res.json({
        success: true,
        narrativa_id: narrativa.id,
        conteudo_completo: narrativa.conteudo_completo,
        blocos: {
          identidade: identidadeRenderizada,
          jornada: jornadaRenderizada,
          essencia: essenciaRenderizada,
          legado: legadoRenderizado,
        },
        operation_id: operationId
      });

    } catch (error: any) {
      console.error('Erro na geracao:', error);
 
      const friendlyError = ErrorMapper.mapError(error);
 
      if (friendlyError.isCritical && supabase && memorial_id) {
        try {
          await AuditService.logEvent(supabase, {
            memorial_id: memorial_id,
            entity_type: 'sistema',
            actor_id: user?.id,
            actor_role: 'system',
            action_type: 'critico_api',
            plano_snapshot: { nome: memorialOwner?.plano_geracao || 'basico' },
            payload: {
              error_code: friendlyError.code,
              error_message: error.message || String(error),
              is_critical: true,
              endpoint: '/api/narrativas/generate'
            }
          }, false);
        } catch (auditErr) {
          console.error('Falha ao registrar auditoria de erro crítico:', auditErr);
        }
      }
 
      if (typeof telemetryService !== 'undefined' && typeof operationId !== 'undefined') {
        const tempoGeracaoMs = Date.now() - tempoInicioGlobal;
        await telemetryService.registerApiUsage({
          provider: 'anthropic',
          model: 'claude-sonnet-4-6',
          feature: 'memorial_text',
          operationId,
          organizationId: memorialOwner?.organization_id || undefined,
          memorialId: memorial_id,
          userId: user?.id,
          latencyMs: tempoGeracaoMs,
          status: 'error',
          errorMessage: error.message || 'unknown'
        }).catch(err => console.error('[Telemetry generate] erro ao registrar falha:', err));
      }
 
      return res.status(friendlyError.status).json({ error: friendlyError.message, code: friendlyError.code });
    }
  });

  // Rota para ajustar biografia pontualmente
  app.post("/api/narrativas/adjust", async (req, res) => {
    let telemetryService: TelemetryService | undefined;
    let operationId: string | undefined;
    let startTime = Date.now();
    let memorialOwner: any = null;
    let memorial_id: string | undefined;
    let user: any = null;
    let supabase: any;

    try {
      let { memorial_id: req_memorial_id, narrativa_id, instrucao, versao_atual, ai_provider } = req.body;
      memorial_id = req_memorial_id;
      user = (req as any).user;

      if (!memorial_id || !narrativa_id || !instrucao) {
        return res.status(400).json({ error: 'Dados insuficientes para ajuste' });
      }

      // Regra 2.5 - Limite do Campo de Instrução (Max 500)
      if (instrucao && instrucao.length > 500) {
        instrucao = instrucao.substring(0, 500);
      }
      
      let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        return res.status(500).json({ error: "SUPABASE URL ou SERVICE ROLE KEY não configurada no .env" });
      }

      supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
      supabase = createClient(supabaseUrl, supabaseKey);

      telemetryService = new TelemetryService(supabase);
      operationId = createOperationId();

      // --- VALIDAÇÃO DO DONO DO MEMORIAL E VERIFICAÇÃO DE FRANQUIA ---
      const { data: ownerData, error: ownerError } = await supabase
        .from('memoriais')
        .select('user_id, edits_used, edits_limit, plano_geracao, organization_id, status, status_memorial, deleted_at, text_edits_in_cycle')
        .eq('id', memorial_id)
        .single();
        
      memorialOwner = ownerData;
        
      if (ownerError || !memorialOwner) {
        console.error(`adjust - Memorial not found or select error:`, ownerError);
        return res.status(404).json({ error: 'Memorial não encontrado ou erro de acesso.', details: ownerError?.message });
      }

      // Trava de memorial inativo ou suspenso (Item 6)
      if (memorialOwner.deleted_at || memorialOwner.status === 'suspenso' || memorialOwner.status_memorial === 'suspenso') {
        return res.status(403).json({ error: 'Geração bloqueada: Este memorial está inativo, suspenso ou foi excluído.' });
      }

      if (memorialOwner.user_id !== user.id) {
        console.error(`adjust - Owner mismatch: memorial_user_id=${memorialOwner.user_id}, authenticated_user_id=${user.id}`);
        return res.status(403).json({ 
          error: 'Acesso negado: Você não é o dono deste memorial.',
          details: `Dono do memorial: ${memorialOwner.user_id} | Seu ID autenticado: ${user.id}`
        });
      }

      const currentEditsUsed = typeof memorialOwner.edits_used === 'number' ? memorialOwner.edits_used : 0;
      const currentEditsLimit = typeof memorialOwner.edits_limit === 'number' ? memorialOwner.edits_limit : 2;
      const currentTextEditsInCycle = typeof memorialOwner.text_edits_in_cycle === 'number' ? memorialOwner.text_edits_in_cycle : 0;
      
      if (currentTextEditsInCycle >= 2 && currentEditsUsed >= currentEditsLimit) {
        return res.status(400).json({ 
          error: `Sua franquia de edições está esgotada no ciclo atual. Por favor, faça um upgrade para obter mais edições.` 
        });
      }
      // -------------------------------------

      // Busca a narrativa atual do banco de dados (seguro contra manipulação do cliente)
      const { data: dbNarrativa, error: navError } = await supabase
        .from('narrativas')
        .select('conteudo_completo, modo_conteudo')
        .eq('id', narrativa_id)
        .single();
        
      if (navError || !dbNarrativa) {
         return res.status(404).json({ error: 'Narrativa atual não encontrada no banco de dados' });
      }

      const narrativa_atual = dbNarrativa.conteudo_completo;

      // Busca dados de densidade e tom do memorial
      const { data: dbMemorial } = await supabase
        .from('memoriais')
        .select('densidade, perfil_tom_manual')
        .eq('id', memorial_id)
        .single();

      const paramDensidade = dbMemorial?.densidade || 'medio';
      const paramTom = dbMemorial?.perfil_tom_manual || 'popular';

      // Verificação de tentativas
      const { count: attemptCount, error: countError } = await supabase
        .from('eventos_geracao')
        .select('*', { count: 'exact', head: true })
        .eq('memorial_id', memorial_id)
        .eq('motivo_geracao', 'regeneracao parcial');

      if (countError) {
        console.error('Erro ao buscar contador de ajustes:', countError);
        return res.status(500).json({ error: 'Erro ao verificar limite de tentativas' });
      }

      if ((attemptCount || 0) >= 999) {
        return res.status(429).json({ error: 'Limite de ajustes pontuais atingido.' });
      }

      // Buscar histórico de instruções
      const { data: eventosHistoryAdjust } = await supabase
        .from('eventos_geracao')
        .select('instrucao_ajuste, motivo_geracao')
        .eq('memorial_id', memorial_id)
        .order('gerado_em', { ascending: true });
        
      let historicoInstrucoesAdjust = '';
      if (eventosHistoryAdjust) {
         const instrucoesSalvas = eventosHistoryAdjust
             .map(e => e.instrucao_ajuste ? e.instrucao_ajuste.trim() : '')
             .filter(i => i !== '' && i !== (instrucao || '').trim());
             
         if (instrucoesSalvas.length > 0) {
             historicoInstrucoesAdjust = Array.from(new Set(instrucoesSalvas)).map((inst, i) => `Instrução prévia ${i + 1}: ${inst}`).join('\n');
         }
      }

      const systemPrompt = `Você é um editor de biografias. Sua única função é fazer o novo ajuste solicitado mantendo todo o restante da biografia (e o seu estilo) intacto. Não invente novos detalhes. Não altere o tom geral. Não altere partes que não foram mencionadas na instrução de ajuste. Não adicione informações que não estavam na biografia original. Retorne apenas o texto completo da biografia com o ajuste aplicado sem nenhuma explicação adicional.`;
      
      let userMessage = `Aqui está a biografia atual:\n${narrativa_atual}\n\n`;
      if (historicoInstrucoesAdjust) {
          userMessage += `HISTÓRICO DE INSTRUÇÕES PRÉVIAS (Mantenha esses ajustes na biografia, eles já estão integrados mas não devem ser perdidos):\n${historicoInstrucoesAdjust}\n\n`;
      }
      userMessage += `Aqui está a NOVA instrução de ajuste:\n${instrucao}\n\nFaça apenas este novo ajuste e retorne a biografia completa corrigida.`;

      const provider = IAProviderFactory.createProvider(ai_provider);
      startTime = Date.now();
      const response = await provider.generateText(userMessage, 2000, systemPrompt);
      const tempo_geracao_ms = Date.now() - startTime;
      const conteudoAjustado = response.text;
      
      const tokens_input = response.inputTokens;
      const tokens_output = response.outputTokens;
      const modelName = response.model;

      // Update any previous rascunhos to arquivado
      await supabase
        .from('narrativas')
        .update({ status_publicacao: 'arquivado' })
        .eq('memorial_id', memorial_id)
        .eq('status_publicacao', 'rascunho');

      // Increment version and save a new narrative
      const { data: narrativa, error: narrativaError } = await supabase
        .from('narrativas')
        .insert({
          memorial_id,
          template: 'visual',
          conteudo_completo: conteudoAjustado,
          conteudo_original: conteudoAjustado,
          modo_conteudo: 'editado_pelo_usuario',
          status_publicacao: 'rascunho',
          versao: (versao_atual || 1) + 1,
          modelo_llm: modelName,
          plano_na_geracao: memorialOwner.plano_geracao || 'basico',
          prompt_version: '1.0',
          narrativa_engine_version: '1.0',
        })
        .select()
        .single();

      if (narrativaError) {
        console.error('Erro ao salvar narrativa ajustada:', narrativaError);
        return res.status(500).json({ error: 'Erro ao salvar narrativa' });
      }

      // Fase 1.5 - Gravar snapshot em memorial_versions
      await supabase.from('memorial_versions').insert({
        memorial_id,
        narrativa_id: narrativa.id,
        version_number: (versao_atual || 1) + 1,
        conteudo: narrativa.conteudo_completo,
        origem: 'saas_adjust',
        criado_por_id: user.id,
        resumo_mudanca: 'Biografia ajustada (Fino/IA)'
      });

      await supabase
        .from('eventos_geracao')
        .insert({
          memorial_id,
          narrativa_id: narrativa.id,
          modelo_llm: modelName,
          prompt_version: '1.0',
          motivo_geracao: 'regeneracao parcial',
          instrucao_ajuste: instrucao,
        });

      // Calcular limites de edições sob a Regra de Autonomia 2 para 1
      let nextEditsUsed = currentEditsUsed;
      let nextTextEditsInCycle = currentTextEditsInCycle + 1;
      if (nextTextEditsInCycle > 2) {
        nextEditsUsed += 1;
      }

      await supabase
        .from('memoriais')
        .update({ 
          edits_used: nextEditsUsed,
          text_edits_in_cycle: nextTextEditsInCycle
        })
        .eq('id', memorial_id);

      // Registrar telemetria financeira
      await telemetryService.registerApiUsage({
        provider: ai_provider || 'anthropic',
        model: modelName,
        feature: 'memorial_text',
        operationId,
        organizationId: memorialOwner.organization_id || undefined,
        memorialId: memorial_id,
        userId: user.id,
        tokensInput: tokens_input,
        tokensOutput: tokens_output,
        latencyMs: tempo_geracao_ms,
        status: 'success'
      }).catch(err => console.error('[Telemetry adjust] erro ao registrar sucesso:', err));

      return res.json({
        success: true,
        narrativa_id: narrativa.id,
        conteudo_completo: conteudoAjustado,
        operation_id: operationId
      });

    } catch (error: any) {
      console.error('Erro no ajuste:', error);
 
      const friendlyError = ErrorMapper.mapError(error);
 
      if (friendlyError.isCritical && supabase && memorial_id) {
        try {
          await AuditService.logEvent(supabase, {
            memorial_id: memorial_id,
            entity_type: 'sistema',
            actor_id: user?.id,
            actor_role: 'system',
            action_type: 'critico_api',
            plano_snapshot: { nome: memorialOwner?.plano_geracao || 'basico' },
            payload: {
              error_code: friendlyError.code,
              error_message: error.message || String(error),
              is_critical: true,
              endpoint: '/api/narrativas/adjust'
            }
          }, false);
        } catch (auditErr) {
          console.error('Falha ao registrar auditoria de erro crítico:', auditErr);
        }
      }
 
      if (typeof telemetryService !== 'undefined' && typeof operationId !== 'undefined') {
        const tempoGeracaoMs = Date.now() - startTime;
        await telemetryService.registerApiUsage({
          provider: 'anthropic',
          model: 'claude-sonnet-4-6',
          feature: 'memorial_text',
          operationId,
          organizationId: memorialOwner?.organization_id || undefined,
          memorialId: memorial_id,
          userId: user?.id,
          latencyMs: tempoGeracaoMs,
          status: 'error',
          errorMessage: error.message || 'unknown'
        }).catch(err => console.error('[Telemetry adjust] erro ao registrar falha:', err));
      }
 
      return res.status(friendlyError.status).json({ error: friendlyError.message, code: friendlyError.code });
    }
  });

  /**
   * @endpoint GET /api/memorial/:id/voice-permissions
   * @description Consulta as permissões e bloqueios de vozes de síntese de acordo com o plano do memorial.
   * @entity memorial
   * @rules O plano do memorial (basico/premium/enterprise) determina quais vozes estão liberadas (locked: false).
   * @audit false
   */
  app.get("/api/memorial/:id/voice-permissions", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const user = (req as any).user;

      if (!id) {
        return res.status(400).json({ error: 'ID do memorial é obrigatório' });
      }

      let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        return res.status(500).json({ error: "Configurações do Supabase não encontradas" });
      }

      supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: memorial, error: fetchError } = await supabase
        .from('memoriais')
        .select('user_id, plano_geracao')
        .eq('id', id)
        .single();

      if (fetchError || !memorial) {
        return res.status(404).json({ error: 'Memorial não encontrado' });
      }

      if (memorial.user_id !== user.id) {
        return res.status(403).json({ error: 'Acesso negado: Você não é o dono deste memorial.' });
      }

      const plano = memorial.plano_geracao || 'basico';
      const governanceService = new VoiceGovernanceService(supabase);
      const audioTier = governanceService.getAudioTier(plano);
      const voicesPermissions = governanceService.getVoicesPermissions(plano);

      return res.json({
        success: true,
        audio_tier: audioTier,
        voices: voicesPermissions
      });

    } catch (error: any) {
      console.error('Erro ao consultar permissões de vozes:', error);
      return res.status(500).json({ error: error?.message || 'Erro interno ao consultar permissões de vozes' });
    }
  });

  /**
   * @endpoint POST /api/narrativas/audio
   * @description Gera áudio da narrativa via Google Cloud Text-to-Speech com governança de planos e auditoria em support_metrics.
   * @entity narrativa
   * @rules O plano do memorial deve corresponder à qualidade da voz solicitada. Telemetria persistida em support_metrics.
   * @audit true
   */
  app.post("/api/narrativas/audio", async (req, res) => {
    const startTime = performance.now();
    let telemetryService: TelemetryService | undefined;
    let operationId: string | undefined;
    let voz: string = 'MALE';
    let memorialData: any = null;
    let narrativa: any = null;
    let narrativa_id: string | undefined;
    let user: any = null;
    let supabase: any;

    try {
      const { narrativa_id: req_narrativa_id, voz: req_voz = 'MALE' } = req.body;
      narrativa_id = req_narrativa_id;
      voz = req_voz;
      user = (req as any).user;

      if (!narrativa_id) {
        return res.status(400).json({ error: 'ID da narrativa é obrigatório' });
      }

      let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        return res.status(500).json({ error: "Configurações do Supabase não encontradas" });
      }

      supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
      supabase = createClient(supabaseUrl, supabaseKey);

      // 1. Buscar a narrativa
      const { data: dbNarrativa, error: fetchError } = await supabase
        .from('narrativas')
        .select('*')
        .eq('id', narrativa_id)
        .single();
 
      narrativa = dbNarrativa;
 
      if (fetchError || !narrativa) {
        return res.status(404).json({ error: 'Narrativa não encontrada' });
      }
 
      telemetryService = new TelemetryService(supabase);
      operationId = req.body.operation_id || createOperationId();
 
      // --- VALIDAÇÃO DO DONO DO MEMORIAL E PLANO (O JUIZ) ---
      const { data: ownerData, error: ownerError } = await supabase
        .from('memoriais')
        .select('id, user_id, plano_geracao, organization_id, edits_used, status, status_memorial, deleted_at')
        .eq('id', narrativa.memorial_id)
        .single();
        
      memorialData = ownerData;
        
      console.log(`Server.ts Audio Check: memorial_id=${narrativa.memorial_id}, returned owner=${memorialData?.user_id}, plano=${memorialData?.plano_geracao}`);
        
      if (ownerError || !memorialData) {
        console.error(`audio - Memorial not found or select error:`, ownerError);
        return res.status(404).json({ error: 'Memorial não encontrado ou erro de acesso.', details: ownerError?.message });
      }
 
      // Trava de memorial inativo ou suspenso (Item 6)
      if (memorialData.deleted_at || memorialData.status === 'suspenso' || memorialData.status_memorial === 'suspenso') {
        return res.status(403).json({ error: 'Geração bloqueada: Este memorial está inativo, suspenso ou foi excluído.' });
      }
  
      if (memorialData.user_id !== user.id) {
        console.error(`audio - Owner mismatch: memorial_user_id=${memorialData.user_id}, authenticated_user_id=${user.id}`);
        return res.status(403).json({ 
          error: 'Acesso negado: Você não é o dono deste memorial.',
          details: `Dono do memorial: ${memorialData.user_id} | Seu ID autenticado: ${user.id}`
        });
      }

      // Marcar narrativa como em processo de geração
      await supabase
        .from('narrativas')
        .update({ audio_status: 'generating' })
        .eq('id', narrativa_id);

      // Validação do audio_tier (Juiz de segurança via VoiceGovernanceService)
      const plano = memorialData.plano_geracao || 'basico';
      const governanceService = new VoiceGovernanceService(supabase);
      const { allowed, userTier, voiceTier } = governanceService.checkPermission(plano, voz);

      if (!allowed) {
        return res.status(403).json({ 
          error: `Acesso negado: A voz "${voz}" requer o plano ${voiceTier === 'premium' ? 'Premium' : 'Enterprise'}. Seu plano atual é ${plano}.`
        });
      }
      // -------------------------------------

      // Se já tem áudio e voz solicitada foi a mesma (poderia verificar), 
      // ou se quiser forçar regeração caso nao tenha.
      // O requisito diz que o áudio "é gerado 1 vez e armazenado. E nunca regerado automaticamente."
      if (narrativa.audio_url && !req.body.forcar_regeracao) {
        return res.json({ success: true, audio_url: narrativa.audio_url, cached: true });
      }

      // Limpar texto de tags e excessos (markdown e formatações indesejadas)
      let textToSpeak = narrativa.conteudo_completo
        // Remove structural keywords
        .replace(/\[?(IDENTIDADE_INICIO|IDENTIDADE_FIM|JORNADA_INICIO|JORNADA_FIM|ESSENCIA_INICIO|ESSENCIA_FIM|LEGADO_INICIO|LEGADO_FIM)\]?/g, '')
        // Remove markdown blocks with language identifier like ```xml, ```json, etc.
        .replace(/```[a-zA-Z0-9_-]*\n?/g, '')
        // Remove remaining triple or single backticks
        .replace(/```/g, '')
        .replace(/`/g, '')
        // Remove bold, italic text markers
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/_/g, '')
        // Remove headings markers
        .replace(/^[#]+\s/gm, '')
        // Remove left-over html/xml tags entirely like <xml> or </xml>
        .replace(/<[^>]+>/g, '')
        // Remove the word 'xml' if it bled through at the start or isolated in a line
        .replace(/^(?:xml\s*)+/i, '')
        .trim();

      // Format text as SSML paragraphs and chunk them
      const paragraphs = textToSpeak.split(/\n+/).filter((p: string) => p.trim());
      const chunks: string[] = [];
      let currentChunk = '';
      
      for (const p of paragraphs) {
         // Create SSML paragraph with pauses at the end
         const ssmlP = `<p>${p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>\n<break time="800ms"/>\n`;
         // TTS limit is 5000 chars, so split at < 1000 to avoid any billing or quota errors
         if (currentChunk.length + ssmlP.length > 1000) {
            chunks.push(currentChunk);
            currentChunk = ssmlP;
         } else {
            currentChunk += ssmlP;
         }
      }
      if (currentChunk) chunks.push(currentChunk);

      const audioBuffers: Uint8Array[] = [];

      // Mapeamento final para o Google Cloud TTS
      let voiceName = 'pt-BR-Wavenet-B';
      let ssmlGender = 'MALE';
      let speakingRate = 0.95;
      let pitch = -1.0;

      // Google Standard
      // 1. NÍVEL BÁSICO - Google Wavenet
      if (voz === 'pt-BR-Standard-A' || voz === 'FEMALE') {
         voiceName = 'pt-BR-Wavenet-A'; 
         ssmlGender = 'FEMALE';
         speakingRate = 0.95;
         pitch = -0.5;
      } else if (voz === 'pt-BR-Standard-B' || voz === 'MALE') {
         voiceName = 'pt-BR-Wavenet-B';
         ssmlGender = 'MALE';
         speakingRate = 0.95;
         pitch = -1.0;
      }
      // 2. NÍVEL PREMIUM - Google Journey
      else if (voz === 'pt-BR-Journey-F' || voz === 'FEMALE_C') {
         voiceName = 'pt-BR-Journey-F';
         ssmlGender = 'FEMALE';
         speakingRate = 0.95;
         pitch = -0.5;
      } else if (voz === 'pt-BR-Journey-D' || voz === 'MALE_D') {
         voiceName = 'pt-BR-Journey-D';
         ssmlGender = 'MALE';
         speakingRate = 0.95;
         pitch = -1.0;
      }
      // 3. NÍVEL ENTERPRISE - Google Chirp3 HD / Studio / ElevenLabs
      else if (voz.startsWith('elevenlabs-')) {
         voiceName = voz;
         if (voz === 'elevenlabs-alice' || voz === 'elevenlabs-sarah') {
            ssmlGender = 'FEMALE';
            speakingRate = 0.95;
            pitch = -0.5;
         } else {
            ssmlGender = 'MALE';
            speakingRate = 0.95;
            pitch = -1.0;
         }
      }

      // Nome físico a ser usado na chamada da API Google TTS
      let ttsApiVoiceName = voiceName;
      if (voiceName === 'pt-BR-Journey-F') {
         ttsApiVoiceName = 'pt-BR-Wavenet-C'; // Google TTS female premium fallback (Journey voices do not exist physically in pt-BR yet)
      } else if (voiceName === 'pt-BR-Journey-D') {
         ttsApiVoiceName = 'pt-BR-Wavenet-E'; // Google TTS male premium fallback (Journey voices do not exist physically in pt-BR yet)
      } else if (voiceName.startsWith('elevenlabs-')) {
         // Fallback para Wavenet premium no Google TTS caso ElevenLabs seja selecionado
         ttsApiVoiceName = (voiceName === 'elevenlabs-alice' || voiceName === 'elevenlabs-sarah')
            ? 'pt-BR-Wavenet-C'
            : 'pt-BR-Wavenet-E';
      }

      // DESVIO TEMPORÁRIO PARA TESTES - Não gerar áudio de verdade por padrão
      const disableMock = process.env.DISABLE_MOCK_AUDIO === 'true';
      if (!disableMock) {
        const mockUrl = "https://fogfmuuaxibvgiapihqw.supabase.co/storage/v1/object/public/memoriais/narrativas/8c083776-deff-4073-b0b2-9ad80a4c742d/0fa7b98f-10a0-44f4-afd1-72514b325692_1780022705931.mp3";

        // Mudar a narrativa oficial antiga para 'arquivado'
        await supabase
          .from('narrativas')
          .update({ status_publicacao: 'arquivado' })
          .eq('memorial_id', narrativa.memorial_id)
          .eq('status_publicacao', 'oficial');
        
        const { error: updateMockError } = await supabase
          .from('narrativas')
          .update({ audio_url: mockUrl, status_publicacao: 'oficial', audio_status: 'success' })
          .eq('id', narrativa_id);

        if (updateMockError) {
           console.error('Erro ao atualizar narrativa com mock audio_url:', updateMockError);
        }

        if (typeof memorialData.edits_used === 'number' && memorialData.edits_used === 0) {
          await supabase
            .from('memoriais')
            .update({ edits_used: 1 })
            .eq('id', narrativa.memorial_id);
          console.log(`[Audio Mock Success] edits_used atualizado de 0 para 1 para o memorial ${narrativa.memorial_id}`);
        }

        // Registrar telemetria para o Mock usando o serviço de governança
        const latenciaMs = Math.round(performance.now() - startTime);
        governanceService.logAudioGeneration(
          narrativa_id,
          textToSpeak.length,
          voiceName,
          plano,
          latenciaMs
        ).catch(err => console.error('[Audio telemetry] erro ao registrar mock:', err));

        // Registrar telemetria financeira de áudio (mock)
        const ttsProvider: 'google' | 'elevenlabs' = voiceName.startsWith('elevenlabs') ? 'elevenlabs' : 'google';
        await telemetryService.registerApiUsage({
          provider: ttsProvider,
          model: voiceName,
          feature: 'memorial_audio',
          operationId,
          organizationId: memorialData.organization_id || undefined,
          memorialId: narrativa.memorial_id,
          userId: user.id,
          charactersInput: textToSpeak.length,
          latencyMs: latenciaMs,
          status: 'success'
        }).catch(err => console.error('[Telemetry audio] erro ao registrar mock:', err));

        return res.json({
           success: true,
           audio_url: mockUrl,
           mock: true,
           operation_id: operationId
        });
      }

      // 3. Configurar Google Cloud TTS
      const googleApiKey = process.env.GOOGLE_TTS_API_KEY;
      
      if (!googleApiKey) {
        return res.status(500).json({ error: "Credenciais do Google Cloud não configuradas (GOOGLE_TTS_API_KEY)" });
      }

      for (const chunk of chunks) {
        if (!chunk.trim()) continue;
        
        const requestParams = {
          input: { ssml: `<speak>\n${chunk}</speak>` },
          voice: { 
            languageCode: 'pt-BR', 
            name: ttsApiVoiceName,
            ssmlGender: ssmlGender as "MALE" | "FEMALE" | "NEUTRAL"
          },
          audioConfig: { 
            audioEncoding: 'MP3',
            speakingRate: speakingRate,
            pitch: pitch
          },
        };

        const apiRes = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${googleApiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestParams)
        });
        
        if (!apiRes.ok) {
          const errBody = await apiRes.text();
          console.error('Google TTS REST err:', errBody);
          let errMsg = `Erro na API Google TTS: ${apiRes.status}`;
          try {
             const parsed = JSON.parse(errBody);
             if (parsed.error && parsed.error.message) {
                 errMsg += " - " + parsed.error.message;
             }
          } catch(e) {}
          throw new Error(errMsg);
        }
        
        const json = await apiRes.json() as any;
        if (json.audioContent) {
           audioBuffers.push(Buffer.from(json.audioContent, 'base64'));
        }
      }

      if (audioBuffers.length === 0) {
        throw new Error('Falha ao gerar conteúdo de áudio do TTS');
      }

      const finalAudioBuffer = Buffer.concat(audioBuffers.map(b => Buffer.from(b)));

      // 3.5 Limpar áudios antigos do memorial para não acumular espaço (ex: limite de 50MB)
      const folderPath = `narrativas/${narrativa.memorial_id}`;
      const { data: existingFiles, error: listError } = await supabase.storage
        .from('memoriais')
        .list(folderPath);

      if (!listError && existingFiles && existingFiles.length > 0) {
        const filesToRemove = existingFiles
          .filter(f => f.name.endsWith('.mp3'))
          .map(f => `${folderPath}/${f.name}`);
          
        if (filesToRemove.length > 0) {
          const { error: removeError } = await supabase.storage
            .from('memoriais')
            .remove(filesToRemove);
          if (removeError) {
             console.error('Erro ao remover áudios antigos do Storage:', removeError);
          } else {
             console.log(`Removidos ${filesToRemove.length} áudios antigos do memorial ${narrativa.memorial_id}.`);
          }
        }
      }

      // 4. Upload para o Supabase Storage
      const fileName = `narrativas/${narrativa.memorial_id}/${narrativa_id}_${Date.now()}.mp3`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('memoriais') 
        .upload(fileName, finalAudioBuffer, {
          contentType: 'audio/mpeg',
          upsert: true
        });

      if (uploadError) {
        console.error('Erro no upload para Storage (tentando memoriais):', uploadError);
        throw new Error(`Erro no armazenamento: ${uploadError.message}`);
      }

      // 5. Obter URL pública
      const publicUrl = supabase.storage.from('memoriais').getPublicUrl(fileName).data.publicUrl;

      // 5.5 Mudar a narrativa oficial antiga para arquivado
      await supabase
        .from('narrativas')
        .update({ status_publicacao: 'arquivado' })
        .eq('memorial_id', narrativa.memorial_id)
        .eq('status_publicacao', 'oficial');

      // 6. Atualizar a tabela narrativas
      const { error: updateError } = await supabase
        .from('narrativas')
        .update({ audio_url: publicUrl, status_publicacao: 'oficial', audio_status: 'success' })
        .eq('id', narrativa_id);

      if (updateError) {
         console.error('Erro ao atualizar narrativa com audio_url:', updateError);
      }

      if (typeof memorialData.edits_used === 'number' && memorialData.edits_used === 0) {
        await supabase
          .from('memoriais')
          .update({ edits_used: 1 })
          .eq('id', narrativa.memorial_id);
        console.log(`[Audio Real Success] edits_used atualizado de 0 para 1 para o memorial ${narrativa.memorial_id}`);
      }

      // Registrar telemetria para a síntese real usando o serviço de governança
      const latenciaMs = Math.round(performance.now() - startTime);
      governanceService.logAudioGeneration(
        narrativa_id,
        textToSpeak.length,
        voiceName,
        plano,
        latenciaMs
      ).catch(err => console.error('[Audio telemetry] erro ao registrar real:', err));

      // Registrar telemetria financeira de áudio (real)
      const ttsProvider: 'google' | 'elevenlabs' = voiceName.startsWith('elevenlabs') ? 'elevenlabs' : 'google';
      await telemetryService.registerApiUsage({
        provider: ttsProvider,
        model: voiceName,
        feature: 'memorial_audio',
        operationId,
        organizationId: memorialData.organization_id || undefined,
        memorialId: narrativa.memorial_id,
        userId: user.id,
        charactersInput: textToSpeak.length,
        latencyMs: latenciaMs,
        status: 'success'
      }).catch(err => console.error('[Telemetry audio] erro ao registrar real:', err));

      return res.json({
        success: true,
        audio_url: publicUrl,
        operation_id: operationId
      });

    } catch (error: any) {
      console.error('Erro na geração de áudio:', error);
 
      // Rollback da edição utilizada (estorno)
      if (supabase && memorialData && narrativa?.memorial_id) {
        try {
          const currentEdits = typeof memorialData.edits_used === 'number' ? memorialData.edits_used : 0;
          const rollbackEdits = Math.max(0, currentEdits - 1);
          await supabase
            .from('memoriais')
            .update({ edits_used: rollbackEdits })
            .eq('id', narrativa.memorial_id);
          console.log(`[Audio Rollback] Estorno de edições realizado. edits_used reduzido de ${currentEdits} para ${rollbackEdits} no memorial ${narrativa.memorial_id}`);
        } catch (rollbackError) {
          console.error('[Audio Rollback] Erro crítico ao estornar edits_used:', rollbackError);
        }
      }
 
      // Marcar narrativa como falha
      if (supabase && narrativa_id) {
        const { error: updateErr } = await supabase
          .from('narrativas')
          .update({ audio_status: 'failed' })
          .eq('id', narrativa_id);
        if (updateErr) {
          console.error('[Audio status update failed] Erro ao marcar status falho:', updateErr.message);
        }
      }
 
      const friendlyError = ErrorMapper.mapError(error);
 
      if (friendlyError.isCritical && supabase && narrativa?.memorial_id) {
        try {
          await AuditService.logEvent(supabase, {
            memorial_id: narrativa.memorial_id,
            entity_type: 'sistema',
            actor_id: user?.id,
            actor_role: 'system',
            action_type: 'critico_api',
            plano_snapshot: { nome: memorialData?.plano_geracao || 'basico' },
            payload: {
              error_code: friendlyError.code,
              error_message: error.message || String(error),
              is_critical: true,
              endpoint: '/api/narrativas/audio'
            }
          }, false);
        } catch (auditErr) {
          console.error('Falha ao registrar auditoria de erro crítico:', auditErr);
        }
      }
 
      if (typeof telemetryService !== 'undefined' && typeof operationId !== 'undefined') {
        const latenciaMs = Math.round(performance.now() - startTime);
        const ttsProvider: 'google' | 'elevenlabs' = voz.startsWith('elevenlabs-') ? 'elevenlabs' : 'google';
        await telemetryService.registerApiUsage({
          provider: ttsProvider,
          model: voz,
          feature: 'memorial_audio',
          operationId,
          organizationId: memorialData?.organization_id || undefined,
          memorialId: narrativa_id,
          userId: user?.id,
          latencyMs: latenciaMs,
          status: 'error',
          errorMessage: error.message || 'unknown'
        }).catch(err => console.error('[Telemetry audio] erro ao registrar falha:', err));
      }
 
      return res.status(friendlyError.status).json({ error: friendlyError.message, code: friendlyError.code });
    }
  });

  // Rota para salvar edicao manual
  app.post("/api/narrativas/manual_edit", async (req, res) => {
    try {
      const { memorial_id, conteudo_completo, narrativa_id } = req.body;

      if (!memorial_id || !conteudo_completo || !narrativa_id) {
        return res.status(400).json({ error: 'Dados insuficientes para edição manual' });
      }
      
      let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        return res.status(500).json({ error: "SUPABASE URL ou SERVICE ROLE KEY não configurada no .env" });
      }

      supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Find existing audio
      const { data: previousNarrativa } = await supabase.from('narrativas').select('audio_url').eq('id', narrativa_id).single();
      if (previousNarrativa?.audio_url) {
         const matches = previousNarrativa.audio_url.match(/\/memoriais\/(.*\.mp3)$/);
         if (matches && matches[1]) {
            await supabase.storage.from('memoriais').remove([matches[1]]);
            console.log("Audio deleted due to manual edit:", matches[1]);
         }
      }

      const { data: narrativa, error: narrativaError } = await supabase
        .from('narrativas')
        .update({
          conteudo_completo: conteudo_completo,
          modo_conteudo: 'editado_pelo_usuario',
          audio_url: null // Hide the old audio
          // no version bump here as per original code, but we will store version snapshot
        })
        .eq('id', narrativa_id)
        .select()
        .single();

      if (narrativaError) {
        console.error('Erro ao salvar narrativa editada manualmente:', narrativaError);
        return res.status(500).json({ error: 'Erro ao salvar narrativa' });
      }

      // Fase 1.5 - Gravar snapshot em memorial_versions
      await supabase.from('memorial_versions').insert({
        memorial_id,
        narrativa_id: narrativa.id,
        version_number: (narrativa.versao || 1) + 1, // just fake bump for snapshot if we don't update narrative versao
        conteudo: narrativa.conteudo_completo,
        origem: 'saas_manual_edit',
        criado_por_id: null,
        resumo_mudanca: 'Biografia editada manualmente'
      });

      await supabase
        .from('eventos_geracao')
        .insert({
          memorial_id,
          narrativa_id: narrativa.id,
          motivo_geracao: 'edicao_manual'
        });

      return res.json({
        success: true
      });

    } catch (error: any) {
      console.error('Erro na edicao manual:', error);
      return res.status(500).json({ error: error?.message || 'Erro interno na edicao manual' });
    }
  });

  app.post("/api/wallet/debug", authenticateToken, async (req, res) => {
    try {
      const { type, amount } = req.body;
      const user = (req as any).user;
      
      let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: 'Config err' });
      supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: userData } = await supabase.auth.admin.getUserById(user.id);
      const profile = userData?.user?.user_metadata || {};
      
      let newBalance = 0;
      if (type === 'set') {
        newBalance = amount;
      } else if (type === 'reset') {
        newBalance = 0;
      }
      
      const { error: updateProfileError } = await supabase.auth.admin.updateUserById(user.id, {
        user_metadata: { ...profile, wallet_balance: newBalance }
      });

      if (updateProfileError) throw updateProfileError;
      
      return res.json({ success: true, new_wallet_balance: newBalance });
    } catch (e: any) {
       console.error("Debug wallet err", e);
       return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/memorial/create", authenticateToken, async (req, res) => {
    try {
      const payload = req.body;
      const user = (req as any).user;
      
      const planoGeracao = payload.plano_geracao || 'basico';
      const PLAN_COSTS: Record<string, number> = { basico: 2, premium: 4, enterprise: 6 };
      const cost_difference = -(PLAN_COSTS[planoGeracao] || 2); // Negativo pq é débito.

      let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        return res.status(500).json({ error: 'Configurações do Supabase não encontradas no servidor.' });
      }

      supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Buscar a organization_id do usuário logado
      let organizationId: string | null = null;
      if (user?.id) {
        const { data: orgUser } = await supabase
          .from('organization_users')
          .select('organization_id')
          .eq('auth_user_id', user.id)
          .eq('ativo', true)
          .limit(1)
          .maybeSingle();

        if (orgUser?.organization_id) {
          organizationId = orgUser.organization_id;
        }
      }

      const memorialData = await SagaExecutor.executeWithWalletLedger(
        supabase,
        user.id,
        cost_difference,
        async (originalBalance, newBalance) => {
           const { data, error: insertError } = await supabase
             .from('memoriais')
             .insert([{
               user_id: user.id,
               organization_id: organizationId,
               nome_homenageado: payload.nome_homenageado,
               data_nascimento: payload.data_nascimento || null,
               data_falecimento: payload.data_falecimento || null,
               status: 'rascunho',
               foto_url: payload.foto_url || null,
               permitir_mensagens: payload.permitir_mensagens,
               auto_aprovar_mensagens: payload.auto_aprovar_mensagens,
               origem_sistema: payload.origem_sistema || 'saas',
               nome_responsavel: payload.nome_responsavel, 
               whatsapp_responsavel: payload.whatsapp_responsavel,
               valor_venda: payload.valor_venda ? parseFloat(payload.valor_venda) : null,
               plano_geracao: planoGeracao,
               ciclo_contrato_plano: 1, // Start on cycle 1
               edits_limit: planoGeracao === 'premium' ? 4 : (planoGeracao === 'enterprise' ? 5 : 3),
             }])
             .select()
             .single();
             
           if (insertError) throw insertError;

           await AuditService.logEvent(supabase, {
             memorial_id: data.id,
             entity_type: 'memorial',
             actor_id: user.id,
             actor_role: 'franchisee',
             action_type: 'criacao_memorial_saas',
             ciclo_contrato_plano: 1,
             plano_snapshot: { plano_inicial: planoGeracao, ciclo: 1 },
             payload: { 
               origem_sistema: payload.origem_sistema || 'saas',
               saldo_anterior: originalBalance,
               credits_debited: Math.abs(cost_difference),
               new_wallet_balance: newBalance
             }
           }, false);

           return { memorialData: data, newBalance };
        }
      );

      return res.json({ success: true, memorial: memorialData.memorialData, new_wallet_balance: memorialData.newBalance });
    } catch (error: any) {
      console.error('Erro na criação de memorial:', error);
      if (error?.message?.includes('Saldo insuficiente')) {
         return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: error?.message || 'Erro interno na criação do memorial.' });
    }
  });

  // Rota para upgrade, downgrade, reembolso, gerenciamento de limites e franquia de edições
  app.post("/api/memorial/change-plan", authenticateToken, async (req, res) => {
    try {
      const { memorial_id, new_plan } = req.body;
      const user = (req as any).user;

      if (!memorial_id || !new_plan) {
        return res.status(400).json({ error: 'Dados insuficientes para mudança de plano.' });
      }

      if (!['basico', 'enterprise', 'premium'].includes(new_plan)) {
        return res.status(400).json({ error: 'Plano inválido especificado.' });
      }

      let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        return res.status(500).json({ error: 'Configurações do Supabase não encontradas no servidor.' });
      }

      supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
      const supabase = createClient(supabaseUrl, supabaseKey);

      // 1. Obter detalhes do memorial e seu dono
      const { data: memorial, error: memorialError } = await supabase
        .from('memoriais')
        .select('*')
        .eq('id', memorial_id)
        .single();

      if (memorialError || !memorial) {
        return res.status(404).json({ error: 'Memorial não encontrado.' });
      }

      if (memorial.user_id !== user.id) {
        return res.status(403).json({ error: 'Acesso negado: Você não é o dono deste memorial.' });
      }

      // 2. Obter carteira global / saldo do usuário
      // TODO: No futuro a carteira migrará para uma tabela separada (profiles), por enquanto usamos user_metadata
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(user.id);

      if (userError || !userData?.user) {
        return res.status(404).json({ error: 'Faça login novamente. Usuário não encontrado para obter saldo.' });
      }

      let profile = userData.user.user_metadata || {};
      if (typeof profile.wallet_balance !== 'number') {
        const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
          user_metadata: { ...profile, wallet_balance: 40.00 }
        });
        if (updateError) {
          return res.status(500).json({ error: 'Falha ao inicializar a carteira do usuário.' });
        }
        profile = (updatedUser.user as any).user_metadata || { wallet_balance: 40.00 };
      }
      const current_wallet = typeof profile.wallet_balance === 'number' ? profile.wallet_balance : 40.00;

      // Constantes de Valores e Limites do Roteiro (Fase 4.1)
      const PLAN_COSTS = { basico: 2, premium: 4, enterprise: 6 };
      const EDITS_LIMITS = { basico: 3, premium: 4, enterprise: 5 };
      const PLAN_LEVELS = { basico: 1, premium: 2, enterprise: 3 };

      const old_plan = (memorial.plano_geracao || 'basico') as 'basico' | 'enterprise' | 'premium';
      const old_level = PLAN_LEVELS[old_plan] || 1;
      const new_level = PLAN_LEVELS[new_plan as 'basico' | 'enterprise' | 'premium'];

      const old_plan_cost = PLAN_COSTS[old_plan];
      const new_plan_cost = PLAN_COSTS[new_plan as 'basico' | 'enterprise' | 'premium'];

      const edits_used = typeof memorial.edits_used === 'number' ? memorial.edits_used : 0;

      // 3. Determinar se é Upgrade, Downgrade ou Sem Alteração
      if (new_level === old_level) {
        return res.json({ success: true, message: 'Plano já ativo.', no_change: true });
      }

      let cost_difference = 0;
      let refund_amount = 0;
      let new_balance = current_wallet;
      let actionName = '';
      let reset_edits = false;
      let new_ciclo = memorial.ciclo_contrato_plano || 1;

      if (new_level > old_level) {
        // UPGRADE
        const old_limit = EDITS_LIMITS[old_plan];
        if (edits_used >= old_limit) {
          // Caminho B: Novo Contrato
          cost_difference = new_plan_cost; // Custo CHEIO
          reset_edits = true;
          new_ciclo = new_ciclo + 1; // Avança o ciclo
        } else {
          // Caminho A: Upgrade Justo
          cost_difference = new_plan_cost - old_plan_cost;
          reset_edits = false;
        }

        if (current_wallet < cost_difference) {
          return res.status(400).json({ 
            error: `Saldo insuficiente na carteira global. Este upgrade custa ${cost_difference} créditos, mas você possui apenas ${current_wallet.toFixed(2)} créditos.` 
          });
        }
        new_balance = current_wallet - cost_difference;
        actionName = 'upgrade';
      } else {
        // DOWNGRADE
        const next_limit = EDITS_LIMITS[new_plan as 'basico' | 'enterprise' | 'premium'];
        if (edits_used >= next_limit) {
           return res.status(400).json({
             error: `Não é possível rebaixar o plano. Você já atingiu ou ultrapassou o limite de gerações permitido pelo novo plano. Continue aproveitando os benefícios do seu plano atual.`
           });
        }
        refund_amount = old_plan_cost - new_plan_cost;
        new_balance = current_wallet + refund_amount;
        actionName = 'downgrade';
      }

      const walletAdjustment = actionName === 'upgrade' ? -cost_difference : refund_amount;

      const result = await SagaExecutor.executeWithWalletLedger(
         supabase,
         user.id,
         walletAdjustment,
         async (originalBalance, newBalance) => {
            // Limpar biografia atual se existir e resetar status
            const { data: narrativas } = await supabase.from('narrativas').select('id, audio_url').eq('memorial_id', memorial_id);
            const hasBio = narrativas && narrativas.length > 0;
            
            if (hasBio) {
              // Find existing audio
              for (const n of narrativas) {
                 if (n.audio_url) {
                    const matches = n.audio_url.match(/\/memoriais\/(.*\.mp3)$/);
                    if (matches && matches[1]) {
                       await supabase.storage.from('memoriais').remove([matches[1]]);
                       console.log("Audio deleted:", matches[1]);
                    }
                 }
              }
              await supabase.from('narrativas').update({ status_publicacao: 'arquivado', audio_url: null }).eq('memorial_id', memorial_id);
            }
            
            const next_limit = EDITS_LIMITS[new_plan as 'basico' | 'enterprise' | 'premium'];
            
            const updates: any = {
              plano_geracao: new_plan,
              edits_limit: next_limit,
              ciclo_contrato_plano: new_ciclo
            };
            
            if (reset_edits) {
              updates.edits_used = 0;
              updates.text_edits_in_cycle = 0;
            }
            
            if (hasBio) {
              updates.status_memorial = 'respostas_recebidas';
              updates.status = 'rascunho';
            }
            
            const { error: updateMemError } = await supabase
              .from('memoriais')
              .update(updates)
              .eq('id', memorial_id);
              
            if (updateMemError) {
              throw updateMemError;
            }
            
            await AuditService.logEvent(supabase, {
              memorial_id: memorial_id,
              entity_type: 'memorial',
              actor_id: user.id,
              actor_role: 'system',
              action_type: 'mudanca_plano',
              plano_snapshot: { plano_antigo: old_plan, plano_novo: new_plan, ciclo: new_ciclo },
              ciclo_contrato_plano: new_ciclo,
              payload: {
                 action: actionName,
                 historico_narrativas_afetadas: hasBio,
                 cost_difference,
                 refund_amount,
                 new_wallet_balance: newBalance,
                 ciclo_contrato_plano: new_ciclo
              }
            }, true);
            
            return { hasBio, newBalance };
         }
      );

      return res.json({
        success: true,
        action: actionName,
        old_plan,
        new_plan,
        credits_debited: cost_difference,
        credits_refunded: refund_amount,
        new_wallet_balance: result.newBalance,
        rebuild_forced: result.hasBio,
        new_edits_used: reset_edits ? 0 : edits_used
      });

    } catch (error: any) {
      console.error('Erro ao mudar de plano:', error);
      if (error?.message?.includes('Saldo insuficiente')) {
         return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: error?.message || 'Erro interno ao realizar mudança de plano.' });
    }
  });

  // ==========================================
  // ROTA DE RESET (Zerar Memorial / Respostas)
  // ==========================================
  app.post("/api/memorial/:id/reset", authenticateToken, async (req, res) => {
    try {
      const memorial_id = req.params.id;
      const user = (req as any).user;

      if (!memorial_id) {
        return res.status(400).json({ error: 'ID do memorial não especificado.' });
      }

      let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        return res.status(500).json({ error: 'Configurações do Supabase não encontradas no servidor.' });
      }

      supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
      const supabase = createClient(supabaseUrl, supabaseKey);

      // 1. Obter detalhes do memorial
      const { data: memorial, error: memorialError } = await supabase
        .from('memoriais')
        .select('*')
        .eq('id', memorial_id)
        .single();

      if (memorialError || !memorial) {
        return res.status(404).json({ error: 'Memorial não encontrado.' });
      }

      if (memorial.user_id !== user.id) {
        return res.status(403).json({ error: 'Acesso negado: Você não é o dono deste memorial.' });
      }

      // 2. Trava de Segurança do Item 6 (Inatividade/Suspensão)
      if (memorial.deleted_at || memorial.status === 'suspenso' || memorial.status_memorial === 'suspenso') {
        return res.status(403).json({ error: 'Geração bloqueada: Este memorial está inativo, suspenso ou foi excluído.' });
      }

      // 3. Calcular custos de acordo com as regras de ciclo
      const edits_used = typeof memorial.edits_used === 'number' ? memorial.edits_used : 0;
      const edits_limit = typeof memorial.edits_limit === 'number' ? memorial.edits_limit : 3;
      const plano_geracao = (memorial.plano_geracao || 'basico') as 'basico' | 'premium' | 'enterprise';

      const PLAN_COSTS = { basico: 2, premium: 4, enterprise: 6 };
      
      let cost = 0;
      let new_ciclo = memorial.ciclo_contrato_plano || 1;
      let will_charge = false;

      if (edits_used >= edits_limit) {
        // Ciclo esgotado, exige cobrar o plano cheio para iniciar novo ciclo
        cost = PLAN_COSTS[plano_geracao] || 2;
        new_ciclo = new_ciclo + 1;
        will_charge = true;
      }

      // 4. Executar transação com o SagaExecutor
      const result = await SagaExecutor.executeWithWalletLedger(
        supabase,
        user.id,
        -cost, // Custo negativo para débito
        async (originalBalance, newBalance) => {
          // A. Deletar respostas
          const { error: deleteError } = await supabase
            .from('respostas')
            .delete()
            .eq('memorial_id', memorial_id);

          if (deleteError) throw new Error(`Falha ao limpar respostas: ${deleteError.message}`);

          // B. Buscar narrativas para remover áudios
          const { data: narrativas } = await supabase
            .from('narrativas')
            .select('*')
            .eq('memorial_id', memorial_id);

          if (narrativas && narrativas.length > 0) {
            for (const n of narrativas) {
              if (n.audio_url) {
                const matches = n.audio_url.match(/\/memoriais\/(.*\.mp3)$/);
                if (matches && matches[1]) {
                  try {
                    await supabase.storage.from('memoriais').remove([matches[1]]);
                    console.log("[Reset] Audio deletado no storage:", matches[1]);
                  } catch (storageErr) {
                    console.error("[Reset] Erro ao remover áudio do storage:", storageErr);
                  }
                }
              }
            }

            // Arquivar as narrativas atuais
            const { error: updateNarrativasError } = await supabase
              .from('narrativas')
              .update({ status_publicacao: 'arquivado', audio_url: null, audio_status: null })
              .eq('memorial_id', memorial_id);

            if (updateNarrativasError) throw new Error(`Falha ao arquivar narrativas: ${updateNarrativasError.message}`);
          }

          // C. Atualizar memorial (status, status_memorial, ciclo e edits se cobrado)
          const updates: any = {
            status: 'rascunho',
            status_memorial: null,
            ciclo_contrato_plano: new_ciclo
          };

          if (will_charge) {
            updates.edits_used = 0;
            updates.text_edits_in_cycle = 0;
          }

          const { error: updateMemError } = await supabase
            .from('memoriais')
            .update(updates)
            .eq('id', memorial_id);

          if (updateMemError) throw new Error(`Falha ao atualizar dados do memorial: ${updateMemError.message}`);

          // D. Registrar auditoria (Audit Trail)
          await AuditService.logEvent(supabase, {
            memorial_id,
            entity_type: 'memorial',
            actor_id: user.id,
            actor_role: 'system',
            action_type: 'reset_memorial',
            plano_snapshot: { plano_geracao, ciclo_anterior: memorial.ciclo_contrato_plano || 1, novo_ciclo: new_ciclo },
            ciclo_contrato_plano: new_ciclo,
            payload: {
              custo_creditos: cost,
              ciclo_renovado: will_charge,
              edits_used_snapshot: edits_used,
              edits_limit_snapshot: edits_limit,
              new_wallet_balance: newBalance
            }
          }, true);

          return { newBalance, newEditsUsed: will_charge ? 0 : edits_used, newCiclo: new_ciclo };
        }
      );

      return res.json({
        success: true,
        message: 'Memorial reiniciado com sucesso. Respostas limpas, áudio removido e biografia arquivada.',
        cost,
        new_wallet_balance: result.newBalance,
        new_edits_used: result.newEditsUsed,
        new_ciclo: result.newCiclo
      });

    } catch (error: any) {
      console.error('Erro ao reiniciar memorial:', error);
      if (error?.message?.includes('Saldo insuficiente')) {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: error?.message || 'Erro interno ao reiniciar o memorial.' });
    }
  });

  // ==========================================
  // ROTA PARA ALTERNAR STATUS DA BIOGRAFIA (Inativar / Ativar)
  // ==========================================
  app.post("/api/memorial/:id/toggle-bio-status", authenticateToken, async (req, res) => {
    try {
      const memorial_id = req.params.id;
      const user = (req as any).user;

      if (!memorial_id) {
        return res.status(400).json({ error: 'ID do memorial não especificado.' });
      }

      let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        return res.status(500).json({ error: 'Configurações do Supabase não encontradas no servidor.' });
      }

      supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
      const supabase = createClient(supabaseUrl, supabaseKey);

      // 1. Obter detalhes do memorial e verificar dono
      const { data: memorial, error: memorialError } = await supabase
        .from('memoriais')
        .select('*')
        .eq('id', memorial_id)
        .single();

      if (memorialError || !memorial) {
        return res.status(404).json({ error: 'Memorial não encontrado.' });
      }

      if (memorial.user_id !== user.id) {
        return res.status(403).json({ error: 'Acesso negado: Você não é o dono deste memorial.' });
      }

      // 2. Trava de Segurança
      if (memorial.deleted_at) {
        return res.status(403).json({ error: 'Operação bloqueada: Este memorial foi excluído.' });
      }

      // 3. Verificar se está atualmente inativo/suspenso
      const isCurrentlySuspended = memorial.status_memorial === 'suspenso';
      let newStatusMemorial = 'suspenso';

      if (isCurrentlySuspended) {
        // Reativação: recalcular status ativo correto com base nas respostas/narrativas/convites existentes
        let activeStatus = 'rascunho'; // status padrão
        
        // Verifica se possui narrativa oficial
        const { data: narr } = await supabase
          .from('narrativas')
          .select('id, status_publicacao')
          .eq('memorial_id', memorial_id)
          .in('status_publicacao', ['oficial', 'suspenso'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (narr) {
          activeStatus = 'concluido';
        } else {
          // Verifica se possui respostas
          const { count: respCount } = await supabase
            .from('respostas')
            .select('id', { count: 'exact', head: true })
            .eq('memorial_id', memorial_id);

          if (respCount && respCount > 0) {
            activeStatus = 'respostas_recebidas';
          } else {
            // Verifica se possui convites ativos
            const { count: invCount } = await supabase
              .from('question_invites')
              .select('id', { count: 'exact', head: true })
              .eq('memorial_id', memorial_id)
              .in('status', ['pendente', 'enviado', 'acessado']);

            if (invCount && invCount > 0) {
              activeStatus = 'aguardando';
            }
          }
        }
        
        newStatusMemorial = activeStatus;
      }

      // 4. Atualizar o memorial
      const { error: updateMemError } = await supabase
        .from('memoriais')
        .update({ status_memorial: newStatusMemorial })
        .eq('id', memorial_id);

      if (updateMemError) throw updateMemError;

      // 5. Se houver narrativas oficiais/suspensas, alternar o status_publicacao da mais recente
      const { data: narrativas } = await supabase
        .from('narrativas')
        .select('id, status_publicacao')
        .eq('memorial_id', memorial_id)
        .in('status_publicacao', ['oficial', 'suspenso'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (narrativas && narrativas.length > 0) {
        const targetNarrative = narrativas[0];
        const updatedNarrativeStatus = isCurrentlySuspended ? 'oficial' : 'suspenso';
        
        await supabase
          .from('narrativas')
          .update({ status_publicacao: updatedNarrativeStatus })
          .eq('id', targetNarrative.id);
      }

      // 6. Registrar auditoria (Audit Trail)
      await AuditService.logEvent(supabase, {
        memorial_id: memorial_id,
        entity_type: 'memorial',
        entity_id: memorial_id,
        actor_id: user.id,
        actor_role: 'funeraria',
        action_type: isCurrentlySuspended ? 'ativar_memorial' : 'inativar_memorial',
        ciclo_contrato_plano: memorial.ciclo_contrato_plano || 1,
        payload: {
          previous_status: memorial.status_memorial,
          new_status: newStatusMemorial
        }
      }, false);

      return res.json({ success: true, newStatus: newStatusMemorial });
    } catch (error: any) {
      console.error('Erro ao alternar status do memorial:', error);
      return res.status(500).json({ error: error?.message || 'Erro interno ao alternar status do memorial.' });
    }
  });

  // ==========================================
  // ROTAS DE QR CODE (Velório / Lápide)
  // ==========================================

  app.get("/api/qrcodes/memorial/:id", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      supabaseUrl = supabaseUrl!.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
      const supabase = createClient(supabaseUrl, supabaseKey!);

      const { data, error } = await supabase
        .from('memorial_qrcodes')
        .select('*')
        .eq('memorial_id', id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return res.json({ qrcodes: data || [] });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/memoriais/accept-transfer", authenticateToken, async (req, res) => {
    try {
      const { token } = req.body;
      const user = (req as any).user;
      
      let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      supabaseUrl = supabaseUrl!.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
      const supabase = createClient(supabaseUrl, supabaseKey!);

      // Validate token
      const { data: invite, error: fetchError } = await supabase
        .from('question_invites')
        .select('*')
        .eq('token', token)
        .single();
        
      if (fetchError || !invite) return res.status(404).json({ error: 'Convite não encontrado.' });
      if (invite.status === 'concluido') return res.status(400).json({ error: 'Convite já utilizado.' });
      if (!invite.perguntas_ids?.includes('TRANSFERENCIA_CONTROLE')) return res.status(400).json({ error: 'Convite inválido.' });
      
      // Update memorial
      const { error: updateMemError } = await supabase
        .from('memoriais')
        .update({ family_account_id: user.id })
        .eq('id', invite.memorial_id);
      
      if (updateMemError) throw updateMemError;
      
      // Mark as concluded
      await supabase
        .from('question_invites')
        .update({ status: 'concluido', concluido_em: new Date().toISOString() })
        .eq('id', invite.id);

      return res.json({ success: true });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/qrcodes/create", authenticateToken, async (req, res) => {
    try {
      const { memorial_id, tipo } = req.body;
      const user = (req as any).user;

      if (!memorial_id || !tipo) return res.status(400).json({ error: 'Faltam dados' });

      let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      supabaseUrl = supabaseUrl!.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
      const supabase = createClient(supabaseUrl, supabaseKey!);

      let expira_em = null;
      if (tipo === 'velorio') {
        const d = new Date();
        d.setDate(d.getDate() + 7);
        expira_em = d.toISOString();
      }

      const url_destino = tipo === 'velorio' ? `/saas/m/${memorial_id}/condolencias` : `/m/${memorial_id}`;
      const codigo = Math.random().toString(36).substring(2, 8).toUpperCase();

      const { data, error } = await supabase
        .from('memorial_qrcodes')
        .insert({
          memorial_id,
          codigo,
          tipo,
          url_destino,
          expira_em,
          status: 'ativo'
        })
        .select()
        .single();
      
      if (error) throw error; 

      return res.json({ success: true, qrcode: data });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/qr/:codigo", async (req, res) => {
    try {
      const { codigo } = req.params;
      let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      supabaseUrl = supabaseUrl!.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
      const supabase = createClient(supabaseUrl, supabaseKey!);

      const { data: qr, error } = await supabase
        .from('memorial_qrcodes')
        .select('*')
        .eq('codigo', codigo.toUpperCase())
        .single();

      if (error || !qr) {
        return res.status(404).send('<h1>QR Code não encontrado</h1>');
      }

      if (qr.status !== 'ativo') {
         return res.status(410).send('<h1>Este QR Code foi desativado</h1>');
      }

      if (qr.expira_em && new Date(qr.expira_em) < new Date()) {
         return res.status(410).send('<h1>Este QR Code temporário expirou</h1>');
      }

      await supabase.rpc('incrementar_scan', { qrcode_id: qr.id });

      return res.redirect(qr.url_destino);
    } catch(e) {
      return res.status(500).send('Erro interno');
    }
  });

  app.post("/api/suporte/test", (req, res) => {
    const payload = req.body;
    // Regra: Verifica payload e processa a lógica de suporte
    res.json({ new: true });
  });

  app.get('/api/test-logs', async (req, res) => {
    let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: logs, error } = await supabase.from('memorial_audit_logs').select('*').order('created_at', { ascending: false }).limit(10);
    res.json({ logs, error });
  });

  // Middleware global para tratamento de erros e evitar que o Express retorne HTML em erros não tratados
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Erro interno não tratado no Express:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Erro interno do servidor",
      details: err.stack || String(err)
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
