-- Script para adicionar a coluna edits_limit e inicializar os valores padrão (se necessário)

-- 1. Adicionar a coluna à tabela (usa IF NOT EXISTS para prevenir erros caso a coluna conste lá por vestígio)
ALTER TABLE public.memoriais
ADD COLUMN IF NOT EXISTS edits_limit INTEGER DEFAULT 3;

-- 2. Atualizar os limites dos memoriais já cadastrados de acordo com a nova regra de negócio:
-- Básico = 3
-- Enterprise = 4
-- Premium = 5
UPDATE public.memoriais
SET edits_limit = 
  CASE 
    WHEN plano_geracao = 'enterprise' THEN 4
    WHEN plano_geracao = 'premium' THEN 5
    ELSE 3 -- basico 
  END
WHERE edits_limit IS NULL OR edits_limit != 
  CASE 
    WHEN plano_geracao = 'enterprise' THEN 4
    WHEN plano_geracao = 'premium' THEN 5
    ELSE 3 
  END;
