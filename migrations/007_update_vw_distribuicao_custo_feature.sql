-- Migration: 007_update_vw_distribuicao_custo_feature
-- Description: Re-cria a view vw_distribuicao_custo_feature incluindo contagem de chamadas e provedor principal

CREATE OR REPLACE VIEW public.vw_distribuicao_custo_feature AS
WITH feature_costs AS (
    SELECT 
        fc.code AS feature_code,
        fc.name AS feature_name,
        COALESCE(SUM(aue.total_cost_usd), 0.0) AS custo_usd,
        COUNT(aue.id) FILTER (WHERE aue.status = 'success') AS total_chamadas
    FROM public.feature_catalog fc
    LEFT JOIN public.api_usage_events aue ON aue.feature_id = fc.id AND aue.status = 'success'
    GROUP BY fc.code, fc.name
),
total_costs AS (
    SELECT COALESCE(SUM(custo_usd), 0.0) AS total_usd FROM feature_costs
),
principal_models AS (
    SELECT DISTINCT ON (feature_id)
        feature_id,
        provider_id,
        model_name,
        COUNT(*) as usage_count
    FROM public.api_usage_events
    WHERE status = 'success'
    GROUP BY feature_id, provider_id, model_name
    ORDER BY feature_id, usage_count DESC
)
SELECT 
    fc.feature_code,
    fc.feature_name,
    fc.custo_usd,
    CASE 
        WHEN tc.total_usd = 0 THEN 0.0
        ELSE ROUND((fc.custo_usd / tc.total_usd) * 100, 2)
    END AS percentual,
    fc.total_chamadas,
    pc.name AS provedor_principal,
    pm.model_name AS modelo_principal
FROM feature_costs fc
CROSS JOIN total_costs tc
LEFT JOIN public.feature_catalog fcat ON fcat.code = fc.feature_code
LEFT JOIN principal_models pm ON pm.feature_id = fcat.id
LEFT JOIN public.provider_catalog pc ON pc.id = pm.provider_id;
