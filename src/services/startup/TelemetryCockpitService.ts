import { SupabaseClient } from '@supabase/supabase-js';

/**
 * @description Serviço de dados do Cockpit de Telemetria.
 * Toda lógica de consulta ao banco de dados reside aqui.
 * @audit false
 */
export class TelemetryCockpitService {
    constructor(
        private readonly supabaseAdmin: any
    ) {}

    /**
     * Retorna os 4 KPIs do topo da tela usando agregação nativa via View SQL.
     * Evita estouro de memória no servidor Node.js.
     */
    async getSummary() {
        const { data, error } = await this.supabaseAdmin
            .from('vw_telemetry_summary')
            .select('*')
            .single();

        if (error || !data) {
            return {
                custo_total_usd: 0,
                media_7_dias_usd: 0,
                total_chamadas: 0,
                custo_medio_texto_usd: 0,
                total_biografias: 0,
                total_audios: 0,
            };
        }

        return {
            custo_total_usd:       Number(data.custo_total_usd),
            media_7_dias_usd:      Number(data.media_7_dias_usd),
            total_chamadas:        Number(data.total_chamadas),
            custo_medio_texto_usd: Number(data.custo_medio_texto_usd),
            total_biografias:      Number(data.total_biografias ?? 0),
            total_audios:          Number(data.total_audios ?? 0),
        };
    }

    /**
     * Retorna custo acumulado e percentual por feature.
     * Consome a View vw_distribuicao_custo_feature da Fase 0.
     */
    async getCostByFeature() {
        const { data, error } = await this.supabaseAdmin
            .from('vw_distribuicao_custo_feature')
            .select('*');

        if (error) throw new Error(`TelemetryCockpitService: ${error.message}`);

        const features = ['memorial_text', 'memorial_audio', 'support_chat', 'dev_tools'];
        return features.map(code => {
            const found = data?.find(d => d.feature_code === code);
            
            // Check if the new columns exist in the view data
            const total_chamadas = found && 'total_chamadas' in found ? Number(found.total_chamadas) : 0;
            const provedor = found && 'provedor_principal' in found ? found.provedor_principal : null;
            const modelo = found && 'modelo_principal' in found ? found.modelo_principal : null;

            // Formatação do subtitle conforme a documentação
            let subtitle = '0 chamadas · sem eventos';
            if (total_chamadas > 0) {
                const prov = provedor || '';
                const model = modelo || '';
                let displayModel = model;
                if (prov.toLowerCase().includes('google')) displayModel = 'Google TTS';
                else if (model.toLowerCase().includes('claude')) displayModel = 'Claude Sonnet';
                else if (prov.toLowerCase().includes('eleven')) displayModel = 'ElevenLabs';
                
                subtitle = `${total_chamadas} chamadas · ${displayModel}`;
            }

            return {
                feature_code: code,
                feature_name: found?.feature_name ?? code,
                custo_usd:    found ? Number(found.custo_usd) : 0,
                percentual:   found ? Number(found.percentual) : 0,
                total_chamadas,
                subtitle
            };
        });
    }

    /**
     * Retorna o status de cobertura de cada núcleo para as pills coloridas.
     */
    async getCobertura() {
        const { data: features } = await this.supabaseAdmin
            .from('feature_catalog')
            .select('id, code, name');

        const { data: contagens } = await this.supabaseAdmin
            .from('api_usage_events')
            .select('feature_id')
            .eq('status', 'success');

        return features?.map(f => {
            const total = contagens?.filter(e => e.feature_id === f.id).length ?? 0;
            const status = total >= 5 ? 'ok' : total > 0 ? 'warn' : 'off';
            return { code: f.code, name: f.name, total_eventos: total, status };
        }) ?? [];
    }

    /**
     * Retorna log paginado de eventos com filtros dinâmicos de período e status.
     */
    async getEventos(params: {
        feature?:   string;
        provider?:  string;
        status?:    string;
        date_from?: string;
        date_to?:   string;
        page?:      number;
        limit?:     number;
    }) {
        const page  = params.page  ?? 1;
        const limit = params.limit ?? 10;
        const from  = (page - 1) * limit;
        const to    = from + limit - 1;

        let query = this.supabaseAdmin
            .from('api_usage_events')
            .select(`
                id,
                criado_em,
                model_name,
                tokens_input,
                tokens_output,
                characters_input,
                latency_ms,
                total_cost_usd,
                operation_id,
                status,
                error_message,
                feature_catalog ( code, name ),
                provider_catalog ( code, name )
            `, { count: 'exact' })
            .order('criado_em', { ascending: false })
            .range(from, to);

        if (params.status)    query = query.eq('status', params.status);
        if (params.date_from) query = query.gte('criado_em', params.date_from);
        if (params.date_to)   query = query.lte('criado_em', params.date_to + 'T23:59:59');

        if (params.feature) {
            const { data: f } = await this.supabaseAdmin
                .from('feature_catalog').select('id').eq('code', params.feature).single();
            if (f) query = query.eq('feature_id', f.id);
        }

        if (params.provider) {
            const { data: p } = await this.supabaseAdmin
                .from('provider_catalog').select('id').eq('code', params.provider).single();
            if (p) query = query.eq('provider_id', p.id);
        }

        const { data, count, error } = await query;
        if (error) throw new Error(`TelemetryCockpitService: ${error.message}`);

        return {
            eventos:    data ?? [],
            total:      count ?? 0,
            pagina:     page,
            por_pagina: limit,
            paginas:    Math.ceil((count ?? 0) / limit),
        };
    }

    /**
     * Retorna todos os eventos com filtros para a exportação CSV.
     */
    async getEventosParaCsv(params: {
        feature?:   string;
        provider?:  string;
        status?:    string;
        date_from?: string;
        date_to?:   string;
    }) {
        const resultado = await this.getEventos({ ...params, page: 1, limit: 10000 });
        return resultado.eventos;
    }
}
