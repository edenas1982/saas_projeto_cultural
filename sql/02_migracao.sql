BEGIN;

ALTER TABLE memoriais
  ADD COLUMN IF NOT EXISTS organization_id        uuid REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS family_account_id      uuid REFERENCES family_accounts(id),
  ADD COLUMN IF NOT EXISTS owner_family_member_id uuid REFERENCES family_members(id),
  ADD COLUMN IF NOT EXISTS criado_por_tipo        text DEFAULT 'organizacao',
  ADD COLUMN IF NOT EXISTS funeraria_acesso       text DEFAULT 'escrita',
  ADD COLUMN IF NOT EXISTS status_memorial        text DEFAULT 'rascunho',
  ADD COLUMN IF NOT EXISTS deleted_at             timestamp;

ALTER TABLE midias                ADD COLUMN IF NOT EXISTS deleted_at timestamp;
ALTER TABLE mensagens_visitantes  ADD COLUMN IF NOT EXISTS deleted_at timestamp;

CREATE INDEX IF NOT EXISTS idx_memoriais_organization   ON memoriais(organization_id);
CREATE INDEX IF NOT EXISTS idx_memoriais_family_account ON memoriais(family_account_id);
CREATE INDEX IF NOT EXISTS idx_memoriais_status         ON memoriais(status_memorial);

INSERT INTO family_accounts (id, nome, email, created_at)
SELECT id, COALESCE(raw_user_meta_data->>'name', raw_user_meta_data->>'nome', email), email, created_at
FROM auth.users
ON CONFLICT (email) DO NOTHING;

UPDATE memoriais SET family_account_id = user_id WHERE family_account_id IS NULL;

COMMIT;

-- VALIDAÇÃO (Rodar separadamente após o COMMIT)
-- SELECT COUNT(*) FROM auth.users;
-- SELECT COUNT(*) FROM family_accounts;
-- Devem ser iguais (se não houver duplicação)

-- SELECT COUNT(*) FROM memoriais WHERE family_account_id IS NULL;
-- Deve retornar 0
