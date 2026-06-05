-- Migration: 005_create_vw_telemetry_summary
-- Description: Cria a view de agregação analítica de custos e volume de requisições de telemetria

CREATE OR REPLACE VIEW public.vw_telemetry_summary AS
SELECT
    -- Custo total acumulado com sucesso
    COALESCE(SUM(total_cost_usd), 0.0) AS custo_total_usd,
    -- Média diária ponderada baseada nos últimos 7 dias (dividido pelos dias ativos com telemetria no período)
    COALESCE(
        SUM(total_cost_usd) FILTER (WHERE criado_em >= NOW() - INTERVAL '7 days'),
        0.0
    ) / COALESCE(
        NULLIF(
            COUNT(DISTINCT criado_em::date) FILTER (WHERE criado_em >= NOW() - INTERVAL '7 days'),
            0
        ),
        1.0
    ) AS media_7_dias_usd,
    -- Contador absoluto de requisições registradas
    COUNT(id) AS total_chamadas,
    -- Custo médio real de entrega de uma biografia (Texto + Áudio) por memorial único
    COALESCE(
        SUM(total_cost_usd) FILTER (
            WHERE feature_id IN (
                SELECT id FROM public.feature_catalog WHERE code IN ('memorial_text', 'memorial_audio')
            )
        ),
        0.0
    ) / COALESCE(
        NULLIF(
            COUNT(DISTINCT memorial_id) FILTER (
                WHERE feature_id IN (
                    SELECT id FROM public.feature_catalog WHERE code IN ('memorial_text', 'memorial_audio')
                )
            ),
            0
        ),
        1.0
    ) AS custo_medio_texto_usd,
    -- Total de biografias únicas geradas com sucesso
    COALESCE(
        COUNT(DISTINCT memorial_id) FILTER (
            WHERE feature_id = (SELECT id FROM public.feature_catalog WHERE code = 'memorial_text')
        ),
        0
    ) AS total_biografias,
    -- Total de áudios únicos gerados com sucesso
    COALESCE(
        COUNT(DISTINCT memorial_id) FILTER (
            WHERE feature_id = (SELECT id FROM public.feature_catalog WHERE code = 'memorial_audio')
        ),
        0
    ) AS total_audios
FROM public.api_usage_events
WHERE status = 'success';



