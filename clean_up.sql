-- Script para limpeza
DO $$
DECLARE
    target_user_id UUID;
    mem_id UUID;
BEGIN
    target_user_id := (SELECT id FROM auth.users WHERE email = 'studioinspirar.midia@gmail.com' LIMIT 1);

    -- Limpar tabelas dependentes
    DELETE FROM eventos_geracao 
    WHERE memorial_id IN (
        SELECT id FROM memoriais 
        WHERE (origem_sistema = 'saas' OR user_id = target_user_id)
        AND nome_homenageado NOT ILIKE '%Armando Perigo%'
    );

    DELETE FROM memorial_versions 
    WHERE memorial_id IN (
        SELECT id FROM memoriais 
        WHERE (origem_sistema = 'saas' OR user_id = target_user_id)
        AND nome_homenageado NOT ILIKE '%Armando Perigo%'
    );

    DELETE FROM narrativas 
    WHERE memorial_id IN (
        SELECT id FROM memoriais 
        WHERE (origem_sistema = 'saas' OR user_id = target_user_id)
        AND nome_homenageado NOT ILIKE '%Armando Perigo%'
    );

    DELETE FROM respostas 
    WHERE memorial_id IN (
        SELECT id FROM memoriais 
        WHERE (origem_sistema = 'saas' OR user_id = target_user_id)
        AND nome_homenageado NOT ILIKE '%Armando Perigo%'
    );

    DELETE FROM memorial_qrcodes 
    WHERE memorial_id IN (
        SELECT id FROM memoriais 
        WHERE (origem_sistema = 'saas' OR user_id = target_user_id)
        AND nome_homenageado NOT ILIKE '%Armando Perigo%'
    );

    DELETE FROM question_invites 
    WHERE memorial_id IN (
        SELECT id FROM memoriais 
        WHERE (origem_sistema = 'saas' OR user_id = target_user_id)
        AND nome_homenageado NOT ILIKE '%Armando Perigo%'
    );

    DELETE FROM mensagens_visitantes 
    WHERE memorial_id IN (
        SELECT id FROM memoriais 
        WHERE (origem_sistema = 'saas' OR user_id = target_user_id)
        AND nome_homenageado NOT ILIKE '%Armando Perigo%'
    );

    -- Remover os memoriais
    DELETE FROM memoriais 
    WHERE (origem_sistema = 'saas' OR user_id = target_user_id)
    AND nome_homenageado NOT ILIKE '%Armando Perigo%';

END $$;
