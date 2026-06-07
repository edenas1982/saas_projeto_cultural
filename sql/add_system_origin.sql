BEGIN;
ALTER TABLE memoriais ADD COLUMN IF NOT EXISTS system_origin text DEFAULT 'projeto_cultural';
CREATE INDEX IF NOT EXISTS idx_memoriais_system_origin ON memoriais(system_origin);
COMMIT;
