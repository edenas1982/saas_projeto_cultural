-- Script SQL para apagar dados de teste da aplicação SaaS
-- Execute no Editor SQL do Supabase.

BEGIN;

-- 1. Identificar e apagar os registros dependentes de Memoriais da plataforma SaaS
-- Exclua das tabelas-filhas utilizando a verificação da origem (se aplicável)
-- Como a tabela 'memorial_shares' foi removida ou não existe, ignoramos.
-- Usaremos MEMORIAIS que possuem plano de geracao SaaS (basico, premium, enterprise) 
-- ou origem_sistema = 'saas' como filtro seguro.

WITH saas_memoriais AS (
    SELECT id FROM public.memoriais 
    WHERE origem_sistema = 'saas'
       OR plano_geracao IN ('basico', 'premium', 'enterprise')
)
DELETE FROM public.memorial_versions WHERE memorial_id IN (SELECT id FROM saas_memoriais);

WITH saas_memoriais AS (
    SELECT id FROM public.memoriais 
    WHERE origem_sistema = 'saas'
       OR plano_geracao IN ('basico', 'premium', 'enterprise')
)
DELETE FROM public.narrativas WHERE memorial_id IN (SELECT id FROM saas_memoriais);

WITH saas_memoriais AS (
    SELECT id FROM public.memoriais 
    WHERE origem_sistema = 'saas'
       OR plano_geracao IN ('basico', 'premium', 'enterprise')
)
DELETE FROM public.respostas WHERE memorial_id IN (SELECT id FROM saas_memoriais);

WITH saas_memoriais AS (
    SELECT id FROM public.memoriais 
    WHERE origem_sistema = 'saas'
       OR plano_geracao IN ('basico', 'premium', 'enterprise')
)
DELETE FROM public.eventos_geracao WHERE memorial_id IN (SELECT id FROM saas_memoriais);

WITH saas_memoriais AS (
    SELECT id FROM public.memoriais 
    WHERE origem_sistema = 'saas'
       OR plano_geracao IN ('basico', 'premium', 'enterprise')
)
DELETE FROM public.memorial_audit_logs WHERE memorial_id IN (SELECT id FROM saas_memoriais);

WITH saas_memoriais AS (
    SELECT id FROM public.memoriais 
    WHERE origem_sistema = 'saas'
       OR plano_geracao IN ('basico', 'premium', 'enterprise')
)
DELETE FROM public.question_invites WHERE memorial_id IN (SELECT id FROM saas_memoriais);

WITH saas_memoriais AS (
    SELECT id FROM public.memoriais 
    WHERE origem_sistema = 'saas'
       OR plano_geracao IN ('basico', 'premium', 'enterprise')
)
DELETE FROM public.midias WHERE memorial_id IN (SELECT id FROM saas_memoriais);

-- 2. Deletar os próprios memoriais SaaS
DELETE FROM public.memoriais 
WHERE origem_sistema = 'saas' 
   OR plano_geracao IN ('basico', 'premium', 'enterprise');

COMMIT;
