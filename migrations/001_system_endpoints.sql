-- Migration: 001_system_endpoints (Atualizada com Automacao)
-- Descrição: Criação da estrutura base para o Catálogo Vivo de endpoints (Documentação Autônoma)

-- Tabela principal: Estado atual da verdade do sistema
CREATE TABLE IF NOT EXISTS public.system_endpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    path TEXT NOT NULL,
    method TEXT NOT NULL,
    descricao TEXT,
    requer_auth BOOLEAN DEFAULT true,
    regras_negocio TEXT[],
    schema_entrada JSONB,
    schema_saida JSONB,
    status TEXT DEFAULT 'ativo', -- 'ativo' ou 'deprecated'
    commit_hash TEXT,
    ultima_atualizacao TIMESTAMPTZ DEFAULT NOW(),
    -- Garante que não tenhamos duplicatas para a mesma rota e verbo HTTP
    UNIQUE(path, method)
);

-- Tabela de histórico (Append-only / Imutável)
-- Nenhuma linha deve ser deletada desta tabela
CREATE TABLE IF NOT EXISTS public.system_endpoint_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint_id UUID REFERENCES public.system_endpoints(id) ON DELETE CASCADE,
    commit_hash TEXT,
    snapshot JSONB, -- Estado completo em formato JSON no momento do commit
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger de Automação: Garante que todo UPDATE em system_endpoints 
-- gere um log imutável em system_endpoint_versions automaticamente.
CREATE OR REPLACE FUNCTION public.save_endpoint_version()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.system_endpoint_versions (endpoint_id, commit_hash, snapshot)
    VALUES (NEW.id, NEW.commit_hash, to_jsonb(NEW));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_save_endpoint_version ON public.system_endpoints;
CREATE TRIGGER trg_save_endpoint_version
AFTER UPDATE ON public.system_endpoints
FOR EACH ROW
EXECUTE FUNCTION public.save_endpoint_version();

-- Habilita o RLS (Row Level Security) para segurança
ALTER TABLE public.system_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_endpoint_versions ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança:
CREATE POLICY "Leitura pública para usuários autenticados" 
ON public.system_endpoints FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Leitura pública para usuários autenticados (versions)" 
ON public.system_endpoint_versions FOR SELECT 
TO authenticated 
USING (true);

-- Teste manual opcional (para validar o UPSERT e gravação):
/*
INSERT INTO system_endpoints (path, method, descricao, status) 
VALUES ('/api/teste', 'POST', 'Endpoint de teste inicial', 'ativo')
ON CONFLICT (path, method) 
DO UPDATE SET descricao = EXCLUDED.descricao, ultima_atualizacao = NOW()
RETURNING id;
*/
