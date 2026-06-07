ALTER TABLE memoriais 
ADD COLUMN IF NOT EXISTS edits_used integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS edits_limit integer DEFAULT 2,
ADD COLUMN IF NOT EXISTS plano_geracao text DEFAULT 'basico';
