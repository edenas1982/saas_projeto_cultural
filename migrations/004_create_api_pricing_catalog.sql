-- Migration: 004_create_api_pricing_catalog
-- Descrição: Cria a tabela de catálogo de precificação de APIs e a view de custos consolidados (Fase 0)

-- 1. Criação do Catálogo de Preços
CREATE TABLE IF NOT EXISTS public.api_pricing_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint_ou_modelo TEXT UNIQUE NOT NULL, -- ex: 'claude-sonnet-4-6', 'pt-BR-Journey-F'
    provedor TEXT NOT NULL,                  -- ex: 'Anthropic', 'Google', 'ElevenLabs'
    tipo_consumo TEXT NOT NULL,              -- ex: 'token', 'caractere'
    preco_unitario_input DECIMAL(15, 10) NOT NULL DEFAULT 0.0,
    preco_unitario_output DECIMAL(15, 10) NOT NULL DEFAULT 0.0,
    ativo BOOLEAN DEFAULT true,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.api_pricing_catalog ENABLE ROW LEVEL SECURITY;

-- Política de Leitura/Escrita para o service_role
DROP POLICY IF EXISTS "Acesso completo ao service role" ON public.api_pricing_catalog;
CREATE POLICY "Acesso completo ao service role" 
ON public.api_pricing_catalog 
FOR ALL 
TO service_role 
USING (true);

-- 2. Inserção dos Preços de Referência (em Dólar)
INSERT INTO public.api_pricing_catalog 
  (endpoint_ou_modelo, provedor, tipo_consumo, preco_unitario_input, preco_unitario_output)
VALUES
  -- LLMs (Preço por Token)
  ('claude-sonnet-4-6', 'Anthropic', 'token', 0.0000030000, 0.0000150000),  -- Input: $3/M, Output: $15/M
  ('claude-3-haiku', 'Anthropic', 'token', 0.0000002500, 0.0000012500),     -- Input: $0.25/M, Output: $1.25/M
  ('gemini-2.5-flash', 'Google', 'token', 0.0000000750, 0.0000003000),      -- Input: $0.075/M, Output: $0.30/M
  
  -- Google Cloud TTS (Preço por Caractere)
  ('pt-BR-Standard-A', 'Google', 'caractere', 0.0000040000, 0.0000000000),   -- $4.00 / Milhão
  ('pt-BR-Standard-B', 'Google', 'caractere', 0.0000040000, 0.0000000000),
  ('FEMALE', 'Google', 'caractere', 0.0000040000, 0.0000000000),
  ('MALE', 'Google', 'caractere', 0.0000040000, 0.0000000000),
  ('pt-BR-Journey-F', 'Google', 'caractere', 0.0000160000, 0.0000000000),    -- $16.00 / Milhão (Journey/Wavenet)
  ('pt-BR-Journey-D', 'Google', 'caractere', 0.0000160000, 0.0000000000),
  ('FEMALE_C', 'Google', 'caractere', 0.0000160000, 0.0000000000),
  ('MALE_D', 'Google', 'caractere', 0.0000160000, 0.0000000000),
  ('pt-BR-Wavenet-C', 'Google', 'caractere', 0.0000160000, 0.0000000000),    -- $16.00 / Milhão
  ('pt-BR-Wavenet-E', 'Google', 'caractere', 0.0000160000, 0.0000000000),
  ('pt-BR-Chirp3-HD-Aoede', 'Google', 'caractere', 0.0000160000, 0.0000000000), -- $16.00 / Milhão (Chirp HD)
  ('pt-BR-Chirp3-HD-Algenib', 'Google', 'caractere', 0.0000160000, 0.0000000000),
  
  -- ElevenLabs (Preço médio por caractere sob plano padrão)
  ('elevenlabs-alice', 'ElevenLabs', 'caractere', 0.0001800000, 0.0000000000), -- $0.18 / 1.000 caracteres
  ('elevenlabs-marcus', 'ElevenLabs', 'caractere', 0.0001800000, 0.0000000000),
  ('elevenlabs-sarah', 'ElevenLabs', 'caractere', 0.0001800000, 0.0000000000)
ON CONFLICT (endpoint_ou_modelo) DO UPDATE SET 
  preco_unitario_input = EXCLUDED.preco_unitario_input,
  preco_unitario_output = EXCLUDED.preco_unitario_output;

-- 3. Criação da View de Custos Detalhados
CREATE OR REPLACE VIEW public.view_support_metrics_costs AS
SELECT 
    m.id,
    m.pergunta,
    m.categoria,
    m.tokens_input,
    m.tokens_output,
    m.tokens_total,
    m.latencia_ms,
    m.endpoint_retornado,
    m.fts_rank,
    m.criado_em,
    -- Resolve o modelo correspondente para join de precificação
    CASE 
      WHEN m.categoria = 'AudioGeneration' THEN m.endpoint_retornado
      ELSE 'claude-sonnet-4-6' -- Modelo LLM padrão ativo para suporte de texto
    END AS model_or_voice,
    -- Cálculo do custo total da transação
    COALESCE(
      (m.tokens_input * p.preco_unitario_input) + (m.tokens_output * p.preco_unitario_output),
      0.0
    ) AS custo_dolar
FROM public.support_metrics m
LEFT JOIN public.api_pricing_catalog p ON 
  p.endpoint_ou_modelo = (
    CASE 
      WHEN m.categoria = 'AudioGeneration' THEN m.endpoint_retornado
      ELSE 'claude-sonnet-4-6'
    END
  );

-- 4. Criação da View de Resumo e Médias Financeiras (Cockpit Financeiro)
CREATE OR REPLACE VIEW public.view_api_costs_summary AS
SELECT 
    -- Custo médio global de todas as transações dos últimos 7 dias
    COALESCE(
      (SELECT AVG(custo_dolar) FROM public.view_support_metrics_costs WHERE criado_em >= NOW() - INTERVAL '7 days' AND pergunta NOT LIKE 'TEST_MOCK_%'), 
      0.0
    ) AS custo_medio_7_dias,
    -- Custo médio específico para consultas de suporte (texto - categoria != AudioGeneration)
    COALESCE(
      (SELECT AVG(custo_dolar) FROM public.view_support_metrics_costs WHERE categoria != 'AudioGeneration' AND pergunta NOT LIKE 'TEST_MOCK_%'),
      0.0
    ) AS custo_medio_suporte_texto,
    -- Custo médio específico para gerações de áudio (TTS - categoria = AudioGeneration)
    COALESCE(
      (SELECT AVG(custo_dolar) FROM public.view_support_metrics_costs WHERE categoria = 'AudioGeneration' AND pergunta NOT LIKE 'TEST_MOCK_%'),
      0.0
    ) AS custo_medio_audio_tts,
    -- Custo acumulado total das APIs (excluindo mocks de teste)
    COALESCE(
      (SELECT SUM(custo_dolar) FROM public.view_support_metrics_costs WHERE pergunta NOT LIKE 'TEST_MOCK_%'),
      0.0
    ) AS custo_total_acumulado;

