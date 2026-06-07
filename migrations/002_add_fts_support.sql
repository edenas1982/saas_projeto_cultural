-- Migration: 002_add_fts_support.sql
-- Descrição: Habilita busca de texto completo (Full-Text Search) na tabela system_endpoints e cria função RPC para busca ordenada por relevância.

-- 1. Adiciona a coluna search_vector gerada automaticamente com os campos mais relevantes
ALTER TABLE public.system_endpoints
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('portuguese',
      coalesce(path, '') || ' ' ||
      coalesce(method, '') || ' ' ||
      coalesce(descricao, '') || ' ' ||
      coalesce(array_to_string(regras_negocio, ' '), '')
    )
  ) STORED;

-- 2. Cria índice GIN na coluna search_vector para acelerar as buscas textuais
CREATE INDEX IF NOT EXISTS idx_system_endpoints_fts
  ON public.system_endpoints USING GIN(search_vector);

-- 3. Cria a função RPC no Supabase para buscar e ranquear os endpoints de acordo com a pergunta do suporte
CREATE OR REPLACE FUNCTION public.search_endpoints(
  query_text text, match_count int DEFAULT 3)
RETURNS TABLE (
  id uuid, path text, method text, descricao text,
  requer_auth boolean, regras_negocio text[],
  schema_entrada jsonb, schema_saida jsonb, rank real
)
LANGUAGE sql STABLE AS $$
  SELECT 
    id, 
    path, 
    method, 
    descricao, 
    requer_auth, 
    regras_negocio, 
    schema_entrada, 
    schema_saida,
    ts_rank(search_vector, websearch_to_tsquery('portuguese', query_text)) AS rank
  FROM public.system_endpoints
  WHERE search_vector @@ websearch_to_tsquery('portuguese', query_text)
  ORDER BY rank DESC LIMIT match_count;
$$;
