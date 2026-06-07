-- sql/migracao_modulo5.sql
-- Adicionar as novas colunas e status para o módulo de Gestão Inteligente de Participantes (Entrevista)

BEGIN;

DO $$ 
BEGIN
  -- Adiciona os campos de reabilitação na tabela question_invites
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='question_invites' AND column_name='reabilitado_por') THEN
    ALTER TABLE question_invites ADD COLUMN reabilitado_por uuid REFERENCES organization_users(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='question_invites' AND column_name='reabilitado_em') THEN
    ALTER TABLE question_invites ADD COLUMN reabilitado_em timestamp;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='question_invites' AND column_name='total_reabilitacoes') THEN
    ALTER TABLE question_invites ADD COLUMN total_reabilitacoes integer DEFAULT 0;
  END IF;

  -- Verifica se existe restrição de CHECK no status para adicionar 'pendente_reabilitado'
  -- Obs: Se "status" não usar constraint, mas apenas tipos text, nada precisa ser feito.
  -- Se usar enum nativo ou check nativo, pode ser necessário alterá-lo com:
  -- ALTER TABLE question_invites DROP CONSTRAINT IF EXISTS question_invites_status_check;
  -- ALTER TABLE question_invites ADD CONSTRAINT question_invites_status_check CHECK (status IN ('pendente', 'acessado', 'concluido', 'pendente_reabilitado'));
END $$;

COMMIT;
