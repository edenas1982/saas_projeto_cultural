-- Migration: 003_create_support_metrics
-- Descrição: Cria a tabela de telemetria e monitoramento de tokens para o suporte inteligente (Fase 0)

CREATE TABLE IF NOT EXISTS public.support_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pergunta TEXT NOT NULL,
    categoria TEXT DEFAULT 'Geral',
    tokens_input INTEGER,
    tokens_output INTEGER,
    tokens_total INTEGER,
    latencia_ms INTEGER,
    endpoint_retornado TEXT,
    fts_rank REAL,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Habilita o RLS (Row Level Security)
ALTER TABLE public.support_metrics ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança: Acesso restrito ao backend autenticado (service_role)
DROP POLICY IF EXISTS "Leitura e inserção restrita ao service role" ON public.support_metrics;
CREATE POLICY "Leitura e inserção restrita ao service role" 
ON public.support_metrics 
FOR ALL 
TO service_role 
USING (true);
