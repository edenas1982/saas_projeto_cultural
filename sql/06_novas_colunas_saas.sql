ALTER TABLE memoriais 
ADD COLUMN IF NOT EXISTS nome_responsavel text,
ADD COLUMN IF NOT EXISTS whatsapp_responsavel text,
ADD COLUMN IF NOT EXISTS valor_venda numeric(10,2);
