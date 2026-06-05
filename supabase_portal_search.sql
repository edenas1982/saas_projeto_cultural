-- ==============================================================================
-- ECOS DE MEMÓRIA: SCRIPT DE BANCO DE DADOS - PORTAL PÚBLICO
-- Execute este script no SQL Editor do Supabase do seu projeto.
-- Ele garantirá performance nas buscas por memoriais e criará a function
-- segura (RPC) para o portal de visitas.
-- ==============================================================================

-- 1. Habilitando Extensão de Texto (pg_trgm) se não existir
-- Permite busca parcial (LIKE/ILIKE) mais rápida em textos longos
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Índice em `nome_homenageado` usando trigrama
CREATE INDEX IF NOT EXISTS idx_memoriais_nome_trgm 
ON public.memoriais USING gin (nome_homenageado gin_trgm_ops);

-- 3. Índices comuns para filtros rápidos
CREATE INDEX IF NOT EXISTS idx_memoriais_publico_confirmado 
ON public.memoriais (publico, confirmado_pelo_usuario) 
WHERE publico = true AND confirmado_pelo_usuario = true;

CREATE INDEX IF NOT EXISTS idx_memoriais_data_falecimento
ON public.memoriais (data_falecimento);

-- 4. Criando uma Função de Busca (RPC) Otimizada
-- Permite que o Frontend consulte os memoriais de forma paginada e segura,
-- sem precisar fazer lógicas complexas no cliente (evitando data leak).
CREATE OR REPLACE FUNCTION search_public_memorials(
    search_term text DEFAULT '',
    filter_year text DEFAULT '',
    page_limit int DEFAULT 10,
    page_offset int DEFAULT 0
)
RETURNS TABLE (
    id uuid,
    nome_homenageado text,
    data_nascimento date,
    data_falecimento date,
    foto_url text,
    frase_destaque text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.nome_homenageado,
        m.data_nascimento,
        m.data_falecimento,
        m.foto_url,
        m.frase_destaque
    FROM public.memoriais m
    WHERE 
        m.publico = true 
        AND m.confirmado_pelo_usuario = true
        AND COALESCE(m.system_origin, 'projeto_cultural') = 'projeto_cultural'
        AND (
            search_term = '' OR m.nome_homenageado ILIKE '%' || search_term || '%'
        )
        AND (
            filter_year = '' OR EXTRACT(YEAR FROM m.data_falecimento)::text = filter_year
        )
    ORDER BY m.created_at DESC
    LIMIT page_limit
    OFFSET page_offset;
END;
$$;

-- 5. Política de Segurança RLS (Row Level Security) - REFORÇO
-- Garante que qualquer visitante (anônimo ou logado) consiga VER apenas os dados permitidos
-- Verifique se essa política já existe, caso não, ela será criada.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'memoriais' AND policyname = 'Permitir leitura pública de memoriais confirmados e públicos'
    ) THEN
        CREATE POLICY "Permitir leitura pública de memoriais confirmados e públicos" 
        ON public.memoriais 
        FOR SELECT 
        USING (publico = true AND confirmado_pelo_usuario = true);
    END IF;
END
$$;
