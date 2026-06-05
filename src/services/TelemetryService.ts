import { SupabaseClient } from '@supabase/supabase-js';

// ==========================================
// DTOs e Tipos do TelemetryService (Fase 0.3)
// ==========================================

export interface TelemetryLogDTO {
  pergunta: string;
  categoria?: string;
  tokensInput?: number;
  tokensOutput?: number;
  latenciaMs: number;
  endpointRetornado?: string;
  ftsRank?: number;
}

export type ApiProvider = 'anthropic' | 'google' | 'elevenlabs';
export type FeatureCategory = 'memorial_text' | 'memorial_audio' | 'support_chat' | 'dev_tools';
export type UsageStatus = 'success' | 'error' | 'cached' | 'aborted';

export interface RegisterApiUsageParams {
  provider: ApiProvider;
  model: string;             // ex: 'claude-sonnet-4-6', 'pt-BR-Journey-F'
  feature: FeatureCategory;

  operationId: string;       // UUID gerado no início da ação do usuário
  organizationId?: string;   // obrigatório exceto para dev_tools (tabela real: public.organizations)
  memorialId?: string;       // obrigatório para memorial_text e memorial_audio
  userId?: string;

  tokensInput?: number;
  tokensOutput?: number;
  charactersInput?: number;
  latencyMs: number;

  status: UsageStatus;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export interface RegisterApiUsageResult {
  eventId: string;
  totalCostUsd: number;
}

// ==========================================
// Classe Principal: TelemetryService
// ==========================================

export class TelemetryService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * @deprecated Utilizar registerApiUsage() para o motor de governança financeira.
   * Mantido para compatibilidade temporária com as rotas de suporte e áudio legadas.
   */
  public async logMetrics(data: TelemetryLogDTO): Promise<void> {
    try {
      const tokensTotal = (data.tokensInput || 0) + (data.tokensOutput || 0);

      const { error } = await this.supabase
        .from('support_metrics')
        .insert({
          pergunta: data.pergunta,
          categoria: data.categoria || 'Geral',
          tokens_input: data.tokensInput,
          tokens_output: data.tokensOutput,
          tokens_total: tokensTotal,
          latencia_ms: data.latenciaMs,
          endpoint_retornado: data.endpointRetornado,
          fts_rank: data.ftsRank
        });

      if (error) {
        console.error('[TelemetryService] Erro ao salvar log de telemetria legado no Supabase:', error.message);
      }
    } catch (err: any) {
      console.error('[TelemetryService] Falha crítica e não bloqueante no salvamento legado:', err);
    }
  }

  /**
   * @description Registra um evento de consumo de API externo de forma granular.
   * Consulta o preço vigente no catálogo, calcula o custo total em dólares,
   * congela os valores e grava o registro em api_usage_events.
   * @rules
   *   - Lança erro se provider ou feature não forem encontrados no catálogo.
   *   - Se pricing não for encontrado, grava evento com custo 0 e status 'error'.
   *   - Nunca bloqueia a operação principal do usuário final.
   * @audit true
   */
  public async registerApiUsage(params: RegisterApiUsageParams): Promise<RegisterApiUsageResult> {
    try {
      // 1. Buscar IDs dos catálogos
      const [providerResult, featureResult] = await Promise.all([
        this.supabase
          .from('provider_catalog')
          .select('id')
          .eq('code', params.provider)
          .single(),
        this.supabase
          .from('feature_catalog')
          .select('id')
          .eq('code', params.feature)
          .single(),
      ]);

      if (providerResult.error || !providerResult.data) {
        throw new Error(`TelemetryService: provider não encontrado: ${params.provider}`);
      }
      if (featureResult.error || !featureResult.data) {
        throw new Error(`TelemetryService: feature não encontrada: ${params.feature}`);
      }

      const providerId = providerResult.data.id;
      const featureId  = featureResult.data.id;

      // 2. Buscar preço vigente (effective_to IS NULL = vigente hoje)
      const { data: pricing, error: pricingError } = await this.supabase
        .from('api_pricing_catalog')
        .select('input_unit_cost, output_unit_cost, pricing_type')
        .eq('provider_id', providerId)
        .eq('model_name', params.model)
        .is('effective_to', null)
        .eq('ativo', true)
        .single();

      // 3. Calcular custo total
      let unitCostAtTime = 0;
      let totalCostUsd   = 0;
      let registroStatus = params.status;

      // Validação de obrigatoriedade do organizationId para features que não sejam dev_tools
      if (params.feature !== 'dev_tools' && !params.organizationId) {
        console.error(`[TelemetryService] ERRO DE GOVERNANÇA: organizationId (funeralHomeId) é obrigatório para a feature "${params.feature}"`);
        registroStatus = 'error';
      }

      if (pricingError || !pricing) {
        console.error(`[TelemetryService] ALERTA: Preço não encontrado para ${params.provider}/${params.model} - usando custo 0`);
        registroStatus = 'error';
      } else {
        unitCostAtTime = Number(pricing.input_unit_cost);

        if (pricing.pricing_type === 'tokens') {
          const custoInput  = (params.tokensInput  || 0) * unitCostAtTime;
          const custoOutput = (params.tokensOutput || 0) * Number(pricing.output_unit_cost || 0);
          totalCostUsd = custoInput + custoOutput;
        } else if (pricing.pricing_type === 'characters') {
          totalCostUsd = (params.charactersInput || 0) * unitCostAtTime;
        }
      }

      // 4. Gravar evento de uso de API
      const { data: event, error: insertError } = await this.supabase
        .from('api_usage_events')
        .insert({
          provider_id:       providerId,
          feature_id:        featureId,
          model_name:        params.model,
          operation_id:      params.operationId,
          organization_id:   params.organizationId || null,
          memorial_id:       params.memorialId     || null,
          user_id:           params.userId,
          tokens_input:      params.tokensInput      || null,
          tokens_output:     params.tokensOutput     || null,
          characters_input:  params.charactersInput  || null,
          latency_ms:        params.latencyMs,
          unit_cost_at_time: unitCostAtTime,
          total_cost_usd:    totalCostUsd,
          status:            registroStatus,
          error_message:     params.errorMessage || null,
          metadata:          params.metadata     || null,
        })
        .select('id, total_cost_usd')
        .single();

      if (insertError || !event) {
        console.error('[TelemetryService] CRÍTICO: Evento de consumo de API não pôde ser gravado.', insertError);
        throw new Error(`TelemetryService: falha ao gravar log em api_usage_events: ${insertError?.message}`);
      }

      return {
        eventId:      event.id,
        totalCostUsd: Number(event.total_cost_usd),
      };

    } catch (err: any) {
      console.error('[TelemetryService] Falha ao processar telemetria de custos:', err.message || err);
      // Não trava a requisição principal do usuário se a falha for apenas no log do servidor
      return {
        eventId: '',
        totalCostUsd: 0
      };
    }
  }
}
