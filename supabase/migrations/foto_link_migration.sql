-- MIGRATION: FOTOLINK (MÓDULO 3)
-- Execute este script no SQL Editor do Supabase para configurar a tabela photo_invites, RLS, triggers e pg_cron.

BEGIN;

-- 1. Criação da Tabela photo_invites
CREATE TABLE IF NOT EXISTS photo_invites (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memorial_id     uuid REFERENCES memoriais(id) NOT NULL,
  organization_id uuid REFERENCES organizations(id),
  token           text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  status          text DEFAULT 'ativo', -- 'ativo' | 'expirado' | 'concluido'
  total_acessos   integer DEFAULT 0,
  expira_em       timestamp NOT NULL, -- padrão de 30 dias
  created_at      timestamp DEFAULT now()
);

-- 2. Índices para Otimização
CREATE INDEX IF NOT EXISTS idx_photo_invites_memorial ON photo_invites(memorial_id);
CREATE INDEX IF NOT EXISTS idx_photo_invites_token    ON photo_invites(token);
CREATE INDEX IF NOT EXISTS idx_photo_invites_status   ON photo_invites(status);

-- 3. Habilitar Row Level Security (RLS)
ALTER TABLE photo_invites ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de Segurança (RLS)
-- Organização gerencia seus próprios links do FotoLink
-- NOTA: A função foi criada como public.get_user_organization() por limitação de permissão do Supabase.
-- O schema auth. não permite criar funções customizadas com permissões suficientes.
DROP POLICY IF EXISTS photo_invites_org_control ON photo_invites;
CREATE POLICY photo_invites_org_control ON photo_invites
  FOR ALL USING (
    organization_id = public.get_user_organization()
  );

-- Acesso público somente para carregar dados do link válido (não expirado e ativo)
DROP POLICY IF EXISTS photo_invites_public_token ON photo_invites;
CREATE POLICY photo_invites_public_token ON photo_invites
  FOR SELECT USING (
    status = 'ativo'
    AND expira_em > now()
  );

-- 5. Trigger para expirar FotoLink automaticamente ao publicar o memorial
CREATE OR REPLACE FUNCTION expirar_photo_invite_ao_publicar()
RETURNS trigger AS $$
BEGIN
  IF NEW.status_memorial = 'publicado' AND OLD.status_memorial != 'publicado' THEN
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

-- 6. Agendador Diário (pg_cron) - Executa às 04:00 da manhã
-- Nota: Caso a extensão pg_cron não esteja ativa ou ocorra erro de permissão,
-- este bloco pode ser ignorado ou executado isoladamente.
DO $$
BEGIN
  -- Tenta remover se já existir antes de agendar
  PERFORM cron.unschedule('expirar-photo-invites');
EXCEPTION
  WHEN OTHERS THEN
    -- Silencia erros caso a extensão cron não esteja ativa ou não possua privilégios
    NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.schedule(
    'expirar-photo-invites',
    '0 4 * * *',
    $cron$
      UPDATE photo_invites
      SET status = 'expirado'
      WHERE status = 'ativo'
        AND expira_em < now()
    $cron$
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Não foi possível configurar o pg_cron automaticamente. Verifique se a extensão está ativa no Supabase.';
END $$;

COMMIT;
