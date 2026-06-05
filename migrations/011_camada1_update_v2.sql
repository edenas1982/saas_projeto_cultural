-- ECO DE MEMÓRIAS
-- Camada 1 — Atualização V2
-- Novos módulos: Notificações, FotoLink, Respostas Parciais e Auditoria de Biografia

BEGIN;

-- Bloco A — Campos novos em memoriais
ALTER TABLE memoriais
  ADD COLUMN IF NOT EXISTS total_invites_criados    integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_invites_concluidos integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS origem_sistema           text DEFAULT 'saas';

CREATE INDEX IF NOT EXISTS idx_memoriais_origem ON memoriais(origem_sistema);

-- Bloco B — Tabela organization_notifications
CREATE TABLE IF NOT EXISTS organization_notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) NOT NULL,
  memorial_id     uuid REFERENCES memoriais(id),
  invite_id       uuid REFERENCES question_invites(id),
  tipo            text NOT NULL,
  titulo          text NOT NULL,
  mensagem        text NOT NULL,
  lida            boolean DEFAULT false,
  created_at      timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_notif_organization ON organization_notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_notif_memorial     ON organization_notifications(memorial_id);
CREATE INDEX IF NOT EXISTS idx_org_notif_lida         ON organization_notifications(lida);
CREATE INDEX IF NOT EXISTS idx_org_notif_created      ON organization_notifications(created_at);

-- Bloco C — Tabela photo_invites
CREATE TABLE IF NOT EXISTS photo_invites (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memorial_id     uuid REFERENCES memoriais(id) NOT NULL,
  organization_id uuid REFERENCES organizations(id),
  token           text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  status          text DEFAULT 'ativo',
  total_acessos   integer DEFAULT 0,
  expira_em       timestamp NOT NULL,
  created_at      timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_photo_invites_memorial ON photo_invites(memorial_id);
CREATE INDEX IF NOT EXISTS idx_photo_invites_token    ON photo_invites(token);
CREATE INDEX IF NOT EXISTS idx_photo_invites_status   ON photo_invites(status);

-- Bloco D — Tabela biografia_audit_logs
CREATE TABLE IF NOT EXISTS biografia_audit_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memorial_id   uuid REFERENCES memoriais(id) NOT NULL,
  narrativa_id  uuid REFERENCES narrativas(id),
  autor_id      uuid NOT NULL,
  autor_perfil  text NOT NULL,
  plano_ativo   text,
  tipo_acao     text NOT NULL,
  descricao     text,
  payload       jsonb,
  created_at    timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bio_audit_memorial ON biografia_audit_logs(memorial_id);
CREATE INDEX IF NOT EXISTS idx_bio_audit_autor    ON biografia_audit_logs(autor_id);
CREATE INDEX IF NOT EXISTS idx_bio_audit_tipo     ON biografia_audit_logs(tipo_acao);
CREATE INDEX IF NOT EXISTS idx_bio_audit_created  ON biografia_audit_logs(created_at);

-- Bloco E — RLS e políticas
ALTER TABLE organization_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_invites              ENABLE ROW LEVEL SECURITY;
ALTER TABLE biografia_audit_logs       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_org_isolation ON organization_notifications;
CREATE POLICY notifications_org_isolation ON organization_notifications
  FOR ALL USING (
    organization_id = auth.get_user_organization()
  );

DROP POLICY IF EXISTS photo_invites_org_control ON photo_invites;
CREATE POLICY photo_invites_org_control ON photo_invites
  FOR ALL USING (
    organization_id = auth.get_user_organization()
  );

DROP POLICY IF EXISTS photo_invites_public_token ON photo_invites;
CREATE POLICY photo_invites_public_token ON photo_invites
  FOR SELECT USING (
    status = 'ativo'
    AND expira_em > now()
  );

DROP POLICY IF EXISTS bio_audit_org_read ON biografia_audit_logs;
CREATE POLICY bio_audit_org_read ON biografia_audit_logs
  FOR SELECT USING (
    memorial_id IN (
      SELECT id FROM memoriais
      WHERE organization_id = auth.get_user_organization()
    )
  );

DROP POLICY IF EXISTS bio_audit_system_insert ON biografia_audit_logs;
CREATE POLICY bio_audit_system_insert ON biografia_audit_logs
  FOR INSERT WITH CHECK (true);

-- Bloco F — Triggers e funções
CREATE OR REPLACE FUNCTION expirar_photo_invite_ao_publicar()
RETURNS trigger AS $$
BEGIN
  IF NEW.status_memorial = 'publicado'
     AND OLD.status_memorial != 'publicado' THEN
    UPDATE photo_invites
    SET status = 'expirado'
    WHERE memorial_id = NEW.id
      AND status = 'ativo';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_expirar_photo_invite ON memoriais;
CREATE TRIGGER trigger_expirar_photo_invite
  AFTER UPDATE ON memoriais
  FOR EACH ROW
  EXECUTE FUNCTION expirar_photo_invite_ao_publicar();

-- Bloco G — Migração de dados existentes
UPDATE memoriais
SET origem_sistema = 'projeto_cultural'
WHERE organization_id IS NULL
  AND family_account_id IS NULL
  AND origem_sistema IS NULL;

UPDATE memoriais
SET origem_sistema = 'saas'
WHERE organization_id IS NOT NULL
  AND origem_sistema IS NULL;

COMMIT;
