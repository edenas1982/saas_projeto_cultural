-- Migration 008: Atualizar políticas de RLS para a tabela mensagens_visitantes
-- Objetivo: Permitir que operadores da funerária (membros da organização) possam moderar (update/delete) as mensagens de condolências.

-- 1. Remover políticas antigas de UPDATE e DELETE
DROP POLICY IF EXISTS "Usuario aprova mensagens dos seus memoriais" ON mensagens_visitantes;
DROP POLICY IF EXISTS "Usuario gerencia mensagens dos seus memoriais select" ON mensagens_visitantes;
DROP POLICY IF EXISTS "Permissao de visualizacao de mensagens para gestao" ON mensagens_visitantes;
DROP POLICY IF EXISTS "Permissao de moderacao de mensagens update" ON mensagens_visitantes;
DROP POLICY IF EXISTS "Permissao de moderacao de mensagens delete" ON mensagens_visitantes;

-- 2. Recriar a política de SELECT para o gerenciamento (Dono + Funerária)
CREATE POLICY "Permissao de visualizacao de mensagens para gestao" ON mensagens_visitantes
FOR SELECT TO authenticated
USING (
  auth.uid() = (SELECT user_id FROM memoriais WHERE id = memorial_id)
  OR
  EXISTS (
    SELECT 1 FROM organization_users ou
    JOIN memoriais m ON m.organization_id = ou.organization_id
    WHERE m.id = mensagens_visitantes.memorial_id
      AND ou.auth_user_id = auth.uid()
      AND ou.ativo = true
  )
);

-- 3. Criar a nova política abrangente de UPDATE (Dono + Funerária)
CREATE POLICY "Permissao de moderacao de mensagens update" ON mensagens_visitantes
FOR UPDATE TO authenticated
USING (
  auth.uid() = (SELECT user_id FROM memoriais WHERE id = memorial_id)
  OR
  EXISTS (
    SELECT 1 FROM organization_users ou
    JOIN memoriais m ON m.organization_id = ou.organization_id
    WHERE m.id = mensagens_visitantes.memorial_id
      AND ou.auth_user_id = auth.uid()
      AND ou.ativo = true
  )
);

-- 4. Criar a nova política abrangente de DELETE (Dono + Funerária)
CREATE POLICY "Permissao de moderacao de mensagens delete" ON mensagens_visitantes
FOR DELETE TO authenticated
USING (
  auth.uid() = (SELECT user_id FROM memoriais WHERE id = memorial_id)
  OR
  EXISTS (
    SELECT 1 FROM organization_users ou
    JOIN memoriais m ON m.organization_id = ou.organization_id
    WHERE m.id = mensagens_visitantes.memorial_id
      AND ou.auth_user_id = auth.uid()
      AND ou.ativo = true
  )
);

-- 5. Atualizar os QR Codes de velório existentes criados pelo SaaS para apontarem para a nova rota de condolências
UPDATE memorial_qrcodes
SET url_destino = '/saas/m/' || memorial_id || '/condolencias'
WHERE tipo = 'velorio'
  AND memorial_id IN (
    SELECT id FROM memoriais WHERE origem_sistema = 'saas'
  );

