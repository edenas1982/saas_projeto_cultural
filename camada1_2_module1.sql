BEGIN;

ALTER TABLE memoriais
  ADD COLUMN IF NOT EXISTS total_invites_criados    integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_invites_concluidos integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS origem_sistema           text DEFAULT 'saas';

CREATE INDEX IF NOT EXISTS idx_memoriais_origem ON memoriais(origem_sistema);

-- Memoriais do projeto cultural
UPDATE memoriais
SET origem_sistema = 'projeto_cultural'
WHERE organization_id IS NULL
  AND family_account_id IS NULL
  AND origem_sistema IS NULL;

-- Memoriais do SaaS
UPDATE memoriais
SET origem_sistema = 'saas'
WHERE organization_id IS NOT NULL
  AND origem_sistema IS NULL;

COMMIT;
