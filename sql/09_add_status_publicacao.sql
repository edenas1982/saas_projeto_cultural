-- Script de Migração: Adicionar status_publicacao na tabela narrativas

-- 1. Adicionar a coluna com valor padrão 'rascunho'
ALTER TABLE narrativas 
ADD COLUMN IF NOT EXISTS status_publicacao text DEFAULT 'rascunho';

-- 2. Atualizar o histórico abrangente com base na existência do áudio
UPDATE narrativas
SET status_publicacao = CASE 
    WHEN audio_url IS NULL OR audio_url = '' THEN 'rascunho'
    ELSE 'oficial'
END;

-- 3. Correção Cirúrgica para o Teste SaaS (Estado Fantasma que reaproveitou o audio_url)
-- Como o memorial "Armando Perigo" (ID: 2474529f-630d-4d2e-86f6-ea712bda7804) teve 
-- o texto atualizado mas o audio_url não foi limpo, forçamos a versão mais recente
-- a voltar para 'rascunho'.
UPDATE narrativas
SET status_publicacao = 'rascunho'
WHERE id = (
    SELECT id 
    FROM narrativas 
    WHERE memorial_id = '2474529f-630d-4d2e-86f6-ea712bda7804' 
    ORDER BY gerado_em DESC 
    LIMIT 1
);
