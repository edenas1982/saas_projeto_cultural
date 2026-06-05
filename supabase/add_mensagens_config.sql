ALTER TABLE memoriais ADD COLUMN IF NOT EXISTS auto_aprovar_mensagens BOOLEAN DEFAULT true;
ALTER TABLE memoriais ADD COLUMN IF NOT EXISTS permitir_mensagens BOOLEAN DEFAULT true;
