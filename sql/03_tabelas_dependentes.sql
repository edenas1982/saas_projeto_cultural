BEGIN;

CREATE TABLE IF NOT EXISTS question_invites (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memorial_id        uuid REFERENCES memoriais(id) NOT NULL,
  family_account_id  uuid REFERENCES family_accounts(id) NOT NULL,
  destinatario_nome  text NOT NULL,
  destinatario_email text,
  destinatario_tel   text,
  token              text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  perguntas_ids      text[],
  status             text DEFAULT 'pendente',
  expira_em          timestamp NOT NULL,
  acessado_em        timestamp,
  concluido_em       timestamp,
  created_at         timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_question_invites_memorial ON question_invites(memorial_id);
CREATE INDEX IF NOT EXISTS idx_question_invites_token    ON question_invites(token);
CREATE INDEX IF NOT EXISTS idx_question_invites_status   ON question_invites(status);

CREATE TABLE IF NOT EXISTS memorial_versions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memorial_id     uuid REFERENCES memoriais(id) NOT NULL,
  -- Certifique-se que a tabela "narrativas" existe no Supabase, 
  -- caso contrário comente a linha abaixo 
  narrativa_id    uuid REFERENCES narrativas(id), 
  version_number  integer NOT NULL,
  conteudo        text NOT NULL,
  audio_url       text,
  origem          text NOT NULL,
  criado_por_id   uuid,
  criado_por_tipo text,
  resumo_mudanca  text,
  deleted_at      timestamp,
  created_at      timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_memorial_versions_memorial ON memorial_versions(memorial_id);
CREATE INDEX IF NOT EXISTS idx_memorial_versions_numero   ON memorial_versions(version_number);

CREATE TABLE IF NOT EXISTS memorial_qrcodes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memorial_id  uuid REFERENCES memoriais(id) NOT NULL,
  codigo       text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  tipo         text NOT NULL,
  url_destino  text NOT NULL,
  status       text DEFAULT 'ativo',
  total_scans  integer DEFAULT 0,
  primeiro_scan timestamp,
  ultimo_scan  timestamp,
  expira_em    timestamp,
  created_at   timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_qrcodes_memorial ON memorial_qrcodes(memorial_id);
CREATE INDEX IF NOT EXISTS idx_qrcodes_codigo   ON memorial_qrcodes(codigo);
CREATE INDEX IF NOT EXISTS idx_qrcodes_tipo     ON memorial_qrcodes(tipo);

COMMIT;

-- VALIDAÇÃO (Rodar separadamente após o COMMIT)
-- SELECT COUNT(*) FROM question_invites;
-- SELECT COUNT(*) FROM memorial_versions;
-- SELECT COUNT(*) FROM memorial_qrcodes;
-- Todas devem retornar 0 (tabelas recém-criadas vazias).
