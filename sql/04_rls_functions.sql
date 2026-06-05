BEGIN;

-- 1. FUNÇÕES
CREATE OR REPLACE FUNCTION public.get_user_organization()
RETURNS uuid AS $$
  SELECT (auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION incrementar_scan(qrcode_id uuid)
RETURNS void AS $$
  UPDATE memorial_qrcodes
  SET
    total_scans   = total_scans + 1,
    ultimo_scan   = now(),
    primeiro_scan = COALESCE(primeiro_scan, now())
  WHERE id = qrcode_id;
$$ LANGUAGE sql;

-- 2. HABILITAR RLS
ALTER TABLE organizations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_users     ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_accounts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members         ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_invites       ENABLE ROW LEVEL SECURITY;
ALTER TABLE memorial_versions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE memorial_qrcodes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE memoriais              ENABLE ROW LEVEL SECURITY;

-- 3. POLÍTICAS RLS

-- Org_users: A Organização só lê e altera os usuários de sua organização
CREATE POLICY org_isolation ON organization_users
  FOR ALL USING (
    organization_id = public.get_user_organization()
  );

-- Memoriais: A Organização vê os seus, a família vê os seus vinculados
CREATE POLICY memoriais_isolation ON memoriais
  FOR ALL USING (
    organization_id = public.get_user_organization()
    OR family_account_id IN (
      SELECT id FROM family_accounts WHERE auth_user_id = auth.uid()
    )
  );

-- QR Codes: Público lê ativos
CREATE POLICY qrcode_public_read ON memorial_qrcodes
  FOR SELECT USING (status = 'ativo');

-- QR Codes: Organização controla os seus
CREATE POLICY qrcode_org_control ON memorial_qrcodes
  FOR ALL USING (
    memorial_id IN (
      SELECT id FROM memoriais
      WHERE organization_id = public.get_user_organization()
    )
  );

-- Question Invites: Leituras por convite de tokens
CREATE POLICY invite_token_access ON question_invites
  FOR SELECT USING (
    status IN ('pendente', 'acessado')
    AND expira_em > now()
  );

-- Família acessa apenas seus próprios dados (Faltava este)
CREATE POLICY family_accounts_isolation ON family_accounts
  FOR ALL USING (
    organization_id = public.get_user_organization()
    OR auth_user_id = auth.uid()
  );

-- Versões: família pode escrever, organização só lê (Faltava este)
CREATE POLICY versions_family_write ON memorial_versions
  FOR INSERT WITH CHECK (
    memorial_id IN (
      SELECT id FROM memoriais
      WHERE family_account_id IN (
        SELECT id FROM family_accounts
        WHERE auth_user_id = auth.uid()
      )
    )
  );

COMMIT;

-- 4. CRON (RODAR DEPOIS DE VALIDAR, PRECISA DA EXTENSÃO pg_cron)
-- ATENÇÃO: Habilite pg_cron no Database -> Extensions no Supabase e então rode isto SEM transação BEGIN:
/*
SELECT cron.schedule(
  'expirar-invites',
  '0 2 * * *',
  $$
    UPDATE question_invites
    SET status = 'expirado'
    WHERE expira_em < now()
      AND status IN ('pendente', 'acessado')
  $$
);
*/

-- VALIDAÇÃO (Rodar separadamente)
-- SELECT public.get_user_organization();
-- (Deve retornar nulo se não houver um request JWT autenticado atrelado à uma organização)
