BEGIN;

-- Recuperar acesso do owner original
DROP POLICY IF EXISTS memoriais_isolation ON memoriais;
CREATE POLICY memoriais_isolation ON memoriais
  FOR ALL USING (
    user_id = auth.uid()
    OR organization_id = public.get_user_organization()
    OR family_account_id IN (
      SELECT id FROM family_accounts WHERE auth_user_id = auth.uid() OR id = auth.uid()
    )
  );

-- Garantir acesso as respostas
DROP POLICY IF EXISTS respostas_isolation ON respostas;
CREATE POLICY respostas_isolation ON respostas
  FOR ALL USING (
    memorial_id IN (
      SELECT id FROM memoriais WHERE 
        user_id = auth.uid()
        OR organization_id = public.get_user_organization()
        OR family_account_id IN (
          SELECT id FROM family_accounts WHERE auth_user_id = auth.uid() OR id = auth.uid()
        )
    )
  );

COMMIT;
