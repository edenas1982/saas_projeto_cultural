ALTER TABLE memoriais 
ADD COLUMN IF NOT EXISTS origem_sistema text DEFAULT 'projeto_cultural';

-- Atualiza os registros existentes para evitar nulos e garantir
-- que memórias do passado recebam a etiqueta corretamente.
UPDATE memoriais 
SET origem_sistema = 'projeto_cultural' 
WHERE origem_sistema IS NULL;

-- (Opcional) Se quiser criar um índice para a busca no portal mais rápida
CREATE INDEX IF NOT EXISTS idx_memoriais_origem_sistema ON memoriais(origem_sistema);
