-- Migration 009: Adicionar suporte a controle de duplicidade por dispositivo móvel
-- Objetivo: Evitar duplicidade de envio de mensagens do mesmo dispositivo móvel.

ALTER TABLE mensagens_visitantes ADD COLUMN IF NOT EXISTS device_id VARCHAR(255);

-- Criar índice composto para velocidade de busca
CREATE INDEX IF NOT EXISTS idx_mensagens_visitantes_device_id ON mensagens_visitantes(memorial_id, device_id);

-- Criar função RPC segura para verificar se o dispositivo já enviou mensagem
CREATE OR REPLACE FUNCTION check_device_message_exists(p_memorial_id UUID, p_device_id VARCHAR)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM mensagens_visitantes
    WHERE memorial_id = p_memorial_id AND device_id = p_device_id
  );
END;
$$;
