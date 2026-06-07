import { SupabaseClient } from "@supabase/supabase-js";

export interface AuditLogPayload {
  memorial_id: string;
  entity_type: string;
  entity_id?: string;
  actor_id?: string;
  actor_role: string;
  action_type: string;
  plano_snapshot?: Record<string, any>;
  payload?: Record<string, any>;
  ciclo_contrato_plano?: number;
}

export class AuditService {
  /**
   * Registra um evento de auditoria no sistema.
   * @param supabase O cliente Supabase inicializado
   * @param logData Os dados do log de auditoria
   * @param isCritical Se true, falhas no log interrompem a operação lançando um erro.
   */
  static async logEvent(
    supabase: SupabaseClient,
    logData: AuditLogPayload,
    isCritical: boolean = false
  ): Promise<void> {
    try {
      const { error } = await supabase.from('memorial_audit_logs').insert([
        {
          memorial_id: logData.memorial_id,
          entity_type: logData.entity_type,
          entity_id: logData.entity_id,
          actor_id: logData.actor_id,
          actor_role: logData.actor_role,
          action_type: logData.action_type,
          plano_snapshot: logData.plano_snapshot,
          payload: logData.payload,
          ciclo_contrato_plano: logData.ciclo_contrato_plano
        }
      ]);

      if (error) {
        throw error;
      }
    } catch (error: any) {
      if (isCritical) {
        throw new Error(`Critical Audit Log Failure: ${error.message}`);
      } else {
        console.error("Non-critical Audit Log Failure:", error);
      }
    }
  }
}
