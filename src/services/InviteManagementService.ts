import { AuditService } from "./AuditService.js";
import { SupabaseClient } from "@supabase/supabase-js";
import { ErrorMapper } from "./ErrorMapper.js";

interface UpdateInviteDto {
  nome?: string;
  telefone?: string;
}

export class InviteManagementService {
  constructor(private readonly audit: AuditService) {}

  /**
   * @description Edita o nome ou telefone de um familiar dado o ID do invite
   * @rules Telefone não pode ser alterado se o status estiver CONCLUIDO ou PENDENTE_REABILITADO.
   * @audit true
   */
  public async updateInvite(supabase: SupabaseClient, inviteId: string, data: UpdateInviteDto, operatorId: string) {
    try {
      // Verifica o invite existente
      const { data: invite, error: fetchError } = await supabase
        .from("question_invites")
        .select("*")
        .eq("id", inviteId)
        .single();
      
      if (fetchError || !invite) throw new Error("Invite não encontrado");

      const updatePayload: Record<string, any> = {};
      
      if (data.nome !== undefined) {
        updatePayload.destinatario_nome = data.nome;
      }

      if (data.telefone !== undefined) {
        if (invite.status === "concluido" || invite.status === "pendente_reabilitado") {
          throw new Error(`Telefone não pode ser alterado no status ${invite.status}`);
        }
        updatePayload.destinatario_tel = data.telefone;
      }

      if (Object.keys(updatePayload).length === 0) return invite;

      const { data: updatedInvite, error: updateError } = await supabase
        .from("question_invites")
        .update(updatePayload)
        .eq("id", inviteId)
        .select()
        .single();

      if (updateError) throw updateError;

      await AuditService.logEvent(supabase, {
        action_type: "edite_invite",
        entity_type: "question_invites",
        entity_id: inviteId,
        memorial_id: invite.memorial_id,
        actor_id: operatorId,
        actor_role: "agent",
        payload: { changes: updatePayload, invite: inviteId, description: `Invite ${inviteId} editado pelo operador` }
      });

      return updatedInvite;
    } catch (error) {
      throw ErrorMapper.mapError(error);
    }
  }

  /**
   * @description Reabilita um link concluído pelo agente funerário.
   * @rules Só pode ser feito de 'concluido' para 'pendente_reabilitado'.
   * @audit true
   */
  public async reenableInvite(supabase: SupabaseClient, inviteId: string, operatorId: string) {
    try {
      const { data: invite, error: fetchError } = await supabase
        .from("question_invites")
        .select("*")
        .eq("id", inviteId)
        .single();
        
      if (fetchError || !invite) throw new Error("Invite não encontrado");
      if (invite.status !== "concluido") throw new Error("O link precisa estar concluído para ser reabilitado");

      const expira = new Date();
      expira.setDate(expira.getDate() + 7);

      const { data: updatedInvite, error: updateError } = await supabase
        .from("question_invites")
        .update({
          status: "pendente_reabilitado",
          concluido_em: null,
          reabilitado_por: operatorId,
          reabilitado_em: new Date().toISOString(),
          expira_em: expira.toISOString(),
          total_reabilitacoes: (invite.total_reabilitacoes || 0) + 1
        })
        .eq("id", inviteId)
        .select()
        .single();

      if (updateError) throw updateError;

      await AuditService.logEvent(supabase, {
        action_type: "reenable_invite",
        entity_type: "question_invites",
        entity_id: inviteId,
        memorial_id: invite.memorial_id,
        actor_id: operatorId,
        actor_role: "agent",
        payload: { invite: inviteId, description: `Invite ${inviteId} reabilitado pelo operador` }
      });

      return updatedInvite;
    } catch (error) {
      throw ErrorMapper.mapError(error);
    }
  }

  /**
   * @description Revoga a reabilitação de um link. Retorna para concluido mantendo dados antigos.
   * @rules Só pode ser revogado de 'pendente_reabilitado'.
   * @audit true
   */
  public async revokeReenabled(supabase: SupabaseClient, inviteId: string, operatorId: string) {
     try {
      const { data: invite, error: fetchError } = await supabase
        .from("question_invites")
        .select("*")
        .eq("id", inviteId)
        .single();
        
      if (fetchError || !invite) throw new Error("Invite não encontrado");
      if (invite.status !== "pendente_reabilitado") throw new Error("Invite não está em estado de reabilitação para ser revogado");

      const { data: updatedInvite, error: updateError } = await supabase
        .from("question_invites")
        .update({
          status: "concluido",
          reabilitado_em: null
        })
        .eq("id", inviteId)
        .select()
        .single();

      if (updateError) throw updateError;

      await AuditService.logEvent(supabase, {
        action_type: "revoke_reenable_invite",
        entity_type: "question_invites",
        entity_id: inviteId,
        memorial_id: invite.memorial_id,
        actor_id: operatorId,
        actor_role: "agent",
        payload: { invite: inviteId, description: `Reabilitação do Invite ${inviteId} foi revogada manualmente` }
      });

      return updatedInvite;
    } catch (error) {
      throw ErrorMapper.mapError(error);
    }
  }

  /**
   * @description Recalcula e persiste os contadores de invites no memorial.
   * Deve ser chamado após qualquer operação que altere o número de invites ativos.
   */
  private async recalcInviteCounters(supabase: SupabaseClient, memorialId: string): Promise<void> {
    try {
      const { count: totalCriados } = await supabase
        .from('question_invites')
        .select('id', { count: 'exact', head: true })
        .eq('memorial_id', memorialId)
        .not('perguntas_ids', 'cs', '{"TRANSFERENCIA_CONTROLE"}');

      const { count: totalConcluidos } = await supabase
        .from('question_invites')
        .select('id', { count: 'exact', head: true })
        .eq('memorial_id', memorialId)
        .eq('status', 'concluido')
        .not('perguntas_ids', 'cs', '{"TRANSFERENCIA_CONTROLE"}');

      await supabase.from('memoriais').update({
        total_invites_criados: totalCriados || 0,
        total_invites_concluidos: totalConcluidos || 0
      }).eq('id', memorialId);
    } catch (e) {
      console.error('[InviteManagementService] Erro ao recalcular contadores de invites:', e);
    }
  }

  /**
   * @description Exclui o familiar/invite, efetuando o rateio se aplicável ou convertendo perguntas em órfãs.
   * @audit true
   */
  public async deleteInvite(supabase: SupabaseClient, inviteId: string, operatorId: string) {
    // 1 - Ler invite
    try {
      const { data: invite, error: fetchError } = await supabase
        .from("question_invites")
        .select("*")
        .eq("id", inviteId)
        .single();
        
      if (fetchError || !invite) throw new Error("Invite não encontrado");
      
      // Bloqueio do responsavel principal
      if (invite.tipo === "responsavel") {
          throw new Error("O responsável principal não pode ser excluído.");
      }

      // Validar Realtime Lock ou Estado de "está online": não tem como eu verificar sessão WebSocket daqui,
      // Mas podemos checar o status. Se for "acessado", podemos permitir porque o front tem aviso.
      
      // Cenário de `concluido` ou com respostas
      let isConcluidoOrHasAnswers = (invite.status === "concluido");
      
      if (invite.status === "pendente_reabilitado") {
         // Validação física de respostas ativas no banco de dados primeiro
         const { count: countRes, error: countErr } = await supabase
             .from("respostas")
             .select('*', { count: 'exact', head: true })
             .eq('memorial_id', invite.memorial_id)
             .in('pergunta_id', invite.perguntas_ids || []);
             
         if ((countRes && countRes > 0) || countErr) {
             isConcluidoOrHasAnswers = true;
         }
      }

      const questionsToHandle = invite.perguntas_ids || [];

      if (isConcluidoOrHasAnswers && questionsToHandle.length > 0) {
          // Cenário C - Tratar como "Perguntas Órfãs" (Apenas remover o invite, as perguntas ficam flutuando aguardando novo dono).
          // Para gerenciar perguntas orfas, o sistema de envio sabe identificar lendo "perguntas que nao estao num invite".
          // Ao simplesmente deletar, elas viram orfãs ativas (não afeta as table de `respostas`).
          const { error: delErr } = await supabase.from("question_invites").delete().eq("id", inviteId);
          if (delErr) throw delErr;

          await AuditService.logEvent(supabase, {
                action_type: "delete_invite_orphaned",
                entity_type: "question_invites",
                entity_id: inviteId,
                memorial_id: invite.memorial_id,
                actor_id: operatorId,
                actor_role: "agent",
                payload: { invite: inviteId, orphaned_questions: questionsToHandle, description: `Invite ${inviteId} excluído gerando perguntas órfãs para base` }
          });
          await this.recalcInviteCounters(supabase, invite.memorial_id);
          return { success: true, orphasGenerated: questionsToHandle.length };
          
      } else {
          // Cenário A/B - Rateio das perguntas (não respondidas) para os ativos remanescentes
          const { data: allInvites } = await supabase
            .from("question_invites")
            .select("*")
            .eq("memorial_id", invite.memorial_id)
            .neq("id", inviteId);

          const actives = allInvites || [];
          if (actives.length === 0) {
              // Se não há outros familiares, as perguntas ficam todas órfãs.
              await supabase.from("question_invites").delete().eq("id", inviteId);
              
              await AuditService.logEvent(supabase, {
                    action_type: "delete_invite_orphaned",
                    entity_type: "question_invites",
                    entity_id: inviteId,
                    memorial_id: invite.memorial_id,
                    actor_id: operatorId,
                    actor_role: "agent",
                    payload: { invite: inviteId, orphaned_questions: questionsToHandle, description: `Último Invite ${inviteId} excluído gerando perguntas órfãs para base` }
              });
              await this.recalcInviteCounters(supabase, invite.memorial_id);
              return { success: true, orphasGenerated: questionsToHandle.length };
          }

          // Achar perguntas pendentes! Se alguem ja respondeu essas, nao estao no rateio,
          // Mas nesse caso, estas eram as perguntas de quem estamos excluindo, que não respondeu. 
          
          await supabase.from("question_invites").delete().eq("id", inviteId);

          // Ratear `questionsToHandle` nos actives.
          // Dividir as questoes igualmente pelas quantidades de actives.
          
          actives.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()); // Garantir ordem
          const totalToSpread = questionsToHandle.length;
          const numActive = actives.length;
          const base = Math.floor(totalToSpread / numActive);
          const remainder = totalToSpread % numActive;
          
          let startIndex = 0;
          for (let i = 0; i < numActive; i++) {
              const countForThis = base + (i < remainder ? 1 : 0);
              const assignThese = questionsToHandle.slice(startIndex, startIndex + countForThis);
              startIndex += countForThis;

              if (assignThese.length > 0) {
                  const updatedIds = [...(actives[i].perguntas_ids || []), ...assignThese];
                  const updatePayload: any = { perguntas_ids: updatedIds };
                  
                  if (actives[i].status === "concluido" || actives[i].status === "expirado") {
                      const exp = new Date();
                      exp.setDate(exp.getDate() + 7);

                      updatePayload.status = "pendente_reabilitado";
                      updatePayload.concluido_em = null;
                      updatePayload.reabilitado_por = null; // Evitar restrição de FK em rateios automáticos
                      updatePayload.reabilitado_em = new Date().toISOString();
                      updatePayload.expira_em = exp.toISOString();
                      updatePayload.total_reabilitacoes = (actives[i].total_reabilitacoes || 0) + 1;
                  }
                  
                  const { error: updErr } = await supabase.from("question_invites").update(updatePayload).eq("id", actives[i].id);
                  if (updErr) {
                      console.error("Erro ao ratear perguntas para invite", actives[i].id, ":", updErr);
                      throw updErr;
                  }
              }
          }

          await AuditService.logEvent(supabase, {
                action_type: "delete_invite_distributed",
                entity_type: "question_invites",
                entity_id: inviteId,
                memorial_id: invite.memorial_id,
                actor_id: operatorId,
                actor_role: "agent",
                payload: { invite: inviteId, distributed_questions: questionsToHandle, description: `Invite ${inviteId} excluído com rateio das perguntas aos demais ${numActive} contatos` }
          });
          await this.recalcInviteCounters(supabase, invite.memorial_id);
          return { success: true, rateadosPara: numActive };
      }
    } catch (error) {
       throw ErrorMapper.mapError(error);
    }
  }

  /**
   * Adiciona perguntas a um invite existente (repassando perguntas órfãs).
   */
  public async appendQuestionsToInvite(supabase: SupabaseClient, inviteId: string, additionalQuestions: string[], operatorId: string) {
    try {
      const { data: invite, error: fetchError } = await supabase
        .from("question_invites")
        .select("*")
        .eq("id", inviteId)
        .single();

      if (fetchError || !invite) {
        throw { status: 404, message: "Convite não encontrado." };
      }

      const currentQuestions = invite.perguntas_ids || [];
      const newQuestions = [...new Set([...currentQuestions, ...additionalQuestions])];

      const updatePayload: any = { perguntas_ids: newQuestions };
      
      if (invite.status === "concluido" || invite.status === "expirado") {
          const exp = new Date();
          exp.setDate(exp.getDate() + 7);

          updatePayload.status = "pendente_reabilitado";
          updatePayload.concluido_em = null;
          updatePayload.reabilitado_por = null; // Auto reabilitacao (evita erro FK se for operator de fora da org)
          updatePayload.reabilitado_em = new Date().toISOString();
          updatePayload.expira_em = exp.toISOString();
          updatePayload.total_reabilitacoes = (invite.total_reabilitacoes || 0) + 1;
      }

      const { data: updatedInvite, error: updateError } = await supabase
        .from("question_invites")
        .update(updatePayload)
        .eq("id", inviteId)
        .select()
        .single();

      if (updateError) throw updateError;

      await AuditService.logEvent(supabase, {
        action_type: "append_questions",
        entity_type: "question_invites",
        entity_id: inviteId,
        memorial_id: invite.memorial_id,
        actor_id: operatorId,
        actor_role: "agent",
        payload: { added_questions: additionalQuestions, new_total: newQuestions.length, description: `Repasse de perguntas órfãs para invite ${inviteId}` }
      });

      return updatedInvite;
    } catch (error) {
      console.error("Erro no appendQuestionsToInvite:", error);
      throw error;
    }
  }

}
