-- Migração: Adiciona franquia de edições, limites e carteira global
ALTER TABLE memoriais 
ADD COLUMN IF NOT EXISTS edits_used integer default 0,
ADD COLUMN IF NOT EXISTS edits_limit integer default 2,
ADD COLUMN IF NOT EXISTS plano_geracao text default 'basico' check (plano_geracao in ('basico', 'enterprise', 'premium'));

-- Adiciona saldo de carteira (wallet_balance) ao perfil do usuário
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS wallet_balance numeric(10,2) default 10.00;
