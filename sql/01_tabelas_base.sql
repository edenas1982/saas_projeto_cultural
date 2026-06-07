BEGIN;

CREATE TABLE organizations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome           text NOT NULL,
  tipo           text NOT NULL,
  documento      text,
  email          text,
  telefone       text,
  cidade         text,
  estado         text,
  logo_url       text,
  cor_primaria   text,
  cor_secundaria text,
  ativo          boolean DEFAULT true,
  plano          text DEFAULT 'basico',
  created_at     timestamp DEFAULT now()
);
CREATE INDEX idx_organizations_tipo  ON organizations(tipo);
CREATE INDEX idx_organizations_ativo ON organizations(ativo);

CREATE TABLE organization_relations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_master   uuid REFERENCES organizations(id),
  organization_unit     uuid REFERENCES organizations(id),
  modelo_operacional    text NOT NULL,
  ativo                 boolean DEFAULT true,
  created_at            timestamp DEFAULT now()
);
CREATE INDEX idx_org_relations_master ON organization_relations(organization_master);
CREATE INDEX idx_org_relations_unit   ON organization_relations(organization_unit);

CREATE TABLE organization_users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) NOT NULL,
  auth_user_id    uuid,
  nome            text NOT NULL,
  email           text NOT NULL UNIQUE,
  cargo           text DEFAULT 'atendente',
  ativo           boolean DEFAULT true,
  ultimo_acesso   timestamp,
  created_at      timestamp DEFAULT now()
);
CREATE INDEX idx_org_users_organization ON organization_users(organization_id);
CREATE INDEX idx_org_users_email        ON organization_users(email);
CREATE INDEX idx_org_users_auth         ON organization_users(auth_user_id);

CREATE TABLE family_accounts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id    uuid, 
  organization_id uuid REFERENCES organizations(id),
  nome            text NOT NULL,
  email           text NOT NULL UNIQUE,
  telefone        text,
  documento       text,
  origem          text DEFAULT 'organizacao',
  ativo           boolean DEFAULT true,
  created_at      timestamp DEFAULT now()
);
CREATE INDEX idx_family_accounts_organization ON family_accounts(organization_id);
CREATE INDEX idx_family_accounts_email        ON family_accounts(email);
CREATE INDEX idx_family_accounts_auth         ON family_accounts(auth_user_id);

CREATE TABLE family_members (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_account_id uuid REFERENCES family_accounts(id) NOT NULL,
  auth_user_id      uuid,
  nome              text NOT NULL,
  email             text NOT NULL UNIQUE,
  relacao           text,
  nivel_acesso      text DEFAULT 'colaborador',
  ativo             boolean DEFAULT true,
  created_at        timestamp DEFAULT now()
);
CREATE INDEX idx_family_members_account ON family_members(family_account_id);
CREATE INDEX idx_family_members_email   ON family_members(email);
CREATE INDEX idx_family_members_auth    ON family_members(auth_user_id);

CREATE TABLE audit_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  memorial_id     uuid,
  actor_id        uuid,
  actor_tipo      text,
  acao            text NOT NULL,
  entidade        text NOT NULL,
  entidade_id     uuid,
  ip_address      text,
  payload         jsonb,
  created_at      timestamp DEFAULT now()
);
CREATE INDEX idx_audit_organization ON audit_logs(organization_id);
CREATE INDEX idx_audit_memorial     ON audit_logs(memorial_id);
CREATE INDEX idx_audit_created      ON audit_logs(created_at);

COMMIT;

-- VALIDAÇÃO (Transação Opcional de confirmação)
-- SELECT COUNT(*) FROM organizations;
-- SELECT COUNT(*) FROM family_accounts;
-- Ambas devem retornar 0 se as tabelas estiverem recém-criadas vazias.
