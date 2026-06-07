-- Arquivo Completo de Correções e Diretrizes de RLS (Row Level Security) para o Supabase
-- Guarde este arquivo e rode no SQL Editor do Supabase quando for realizar os ajustes de banco de dados.
-- Esse script restabelece todas as permissões para garantir a segurança da Fase 2.

-- ==========================================
-- 1. TABELA: memoriais
-- ==========================================
DROP POLICY IF EXISTS "Usuários podem ver seus próprios memoriais" ON memoriais;
DROP POLICY IF EXISTS "Usuario gerencia seus memoriais insert" ON memoriais;
DROP POLICY IF EXISTS "Usuario gerencia seus memoriais select" ON memoriais;
DROP POLICY IF EXISTS "Usuario gerencia seus memoriais update" ON memoriais;
DROP POLICY IF EXISTS "Usuario gerencia seus memoriais delete" ON memoriais;

CREATE POLICY "Usuario gerencia seus memoriais insert" ON memoriais FOR INSERT TO public WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Usuario gerencia seus memoriais select" ON memoriais FOR SELECT TO public USING (auth.uid() = user_id OR publico = true);
CREATE POLICY "Usuario gerencia seus memoriais update" ON memoriais FOR UPDATE TO public USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Usuario gerencia seus memoriais delete" ON memoriais FOR DELETE TO public USING (auth.uid() = user_id);

-- ==========================================
-- 2. TABELA: respostas
-- ==========================================
DROP POLICY IF EXISTS "Respostas select" ON respostas;
DROP POLICY IF EXISTS "Respostas insert" ON respostas;
DROP POLICY IF EXISTS "Respostas update" ON respostas;
DROP POLICY IF EXISTS "Respostas delete" ON respostas;

CREATE POLICY "Respostas select" ON respostas FOR SELECT TO public USING ((SELECT user_id FROM memoriais WHERE id = memorial_id) = auth.uid());
CREATE POLICY "Respostas insert" ON respostas FOR INSERT TO public WITH CHECK ((SELECT user_id FROM memoriais WHERE id = memorial_id) = auth.uid());
CREATE POLICY "Respostas update" ON respostas FOR UPDATE TO public USING ((SELECT user_id FROM memoriais WHERE id = memorial_id) = auth.uid());
CREATE POLICY "Respostas delete" ON respostas FOR DELETE TO public USING ((SELECT user_id FROM memoriais WHERE id = memorial_id) = auth.uid());

-- ==========================================
-- 3. TABELA: narrativas
-- ==========================================
DROP POLICY IF EXISTS "Narrativas select" ON narrativas;
DROP POLICY IF EXISTS "Narrativas insert" ON narrativas;
DROP POLICY IF EXISTS "Narrativas update" ON narrativas;

-- Select: Dono pode ver as suas. Público pode ver se o memorial for publico = true.
CREATE POLICY "Narrativas select" ON narrativas FOR SELECT TO public USING (
  (SELECT user_id FROM memoriais WHERE id = memorial_id) = auth.uid() OR
  (SELECT publico FROM memoriais WHERE id = memorial_id) = true
);
CREATE POLICY "Narrativas insert" ON narrativas FOR INSERT TO public WITH CHECK ((SELECT user_id FROM memoriais WHERE id = memorial_id) = auth.uid());
CREATE POLICY "Narrativas update" ON narrativas FOR UPDATE TO public USING ((SELECT user_id FROM memoriais WHERE id = memorial_id) = auth.uid());

-- ==========================================
-- 4. TABELA: mensagens_visitantes
-- ==========================================
DROP POLICY IF EXISTS "Mensagens select" ON mensagens_visitantes;
DROP POLICY IF EXISTS "Mensagens insert" ON mensagens_visitantes;
DROP POLICY IF EXISTS "Mensagens update" ON mensagens_visitantes;
DROP POLICY IF EXISTS "Mensagens delete" ON mensagens_visitantes;

-- Visitantes não logados (anon) ou qualquer pessoa pode inserir uma mensagem (isso é público)
CREATE POLICY "Mensagens insert" ON mensagens_visitantes FOR INSERT TO public WITH CHECK (true);

-- Select: Mensagens aprovadas ficam visíveis publicamente. O dono do memorial pode ver todas (aprovadas e não aprovadas).
CREATE POLICY "Mensagens select" ON mensagens_visitantes FOR SELECT TO public USING (
  (aprovado = true) OR ((SELECT user_id FROM memoriais WHERE id = memorial_id) = auth.uid())
);

-- Update: Só o dono do memorial pode aprovar (dar update).
CREATE POLICY "Mensagens update" ON mensagens_visitantes FOR UPDATE TO public USING ((SELECT user_id FROM memoriais WHERE id = memorial_id) = auth.uid());

-- Delete: Só o dono do memorial pode apagar mensagens indesejadas.
CREATE POLICY "Mensagens delete" ON mensagens_visitantes FOR DELETE TO public USING ((SELECT user_id FROM memoriais WHERE id = memorial_id) = auth.uid());

-- ==========================================
-- 5. TABELA: midias
-- ==========================================
DROP POLICY IF EXISTS "Midias select" ON midias;
DROP POLICY IF EXISTS "Midias insert" ON midias;
DROP POLICY IF EXISTS "Midias update" ON midias;
DROP POLICY IF EXISTS "Midias delete" ON midias;

-- Select: Aprovadas (galeria do memorial) visíveis. Dono vê todas.
CREATE POLICY "Midias select" ON midias FOR SELECT TO public USING (
  (aprovado = true AND (SELECT publico FROM memoriais WHERE id = memorial_id) = true) 
  OR ((SELECT user_id FROM memoriais WHERE id = memorial_id) = auth.uid())
);
CREATE POLICY "Midias insert" ON midias FOR INSERT TO public WITH CHECK ((SELECT user_id FROM memoriais WHERE id = memorial_id) = auth.uid());
CREATE POLICY "Midias update" ON midias FOR UPDATE TO public USING ((SELECT user_id FROM memoriais WHERE id = memorial_id) = auth.uid());
CREATE POLICY "Midias delete" ON midias FOR DELETE TO public USING ((SELECT user_id FROM memoriais WHERE id = memorial_id) = auth.uid());

-- ==========================================
-- 6. TABELA: fatos
-- ==========================================
DROP POLICY IF EXISTS "Fatos select" ON fatos;
DROP POLICY IF EXISTS "Fatos insert" ON fatos;
DROP POLICY IF EXISTS "Fatos update" ON fatos;
DROP POLICY IF EXISTS "Fatos delete" ON fatos;

CREATE POLICY "Fatos select" ON fatos FOR SELECT TO public USING (
  (SELECT user_id FROM memoriais WHERE id = memorial_id) = auth.uid() OR
  (SELECT publico FROM memoriais WHERE id = memorial_id) = true
);
CREATE POLICY "Fatos insert" ON fatos FOR INSERT TO public WITH CHECK ((SELECT user_id FROM memoriais WHERE id = memorial_id) = auth.uid());
CREATE POLICY "Fatos update" ON fatos FOR UPDATE TO public USING ((SELECT user_id FROM memoriais WHERE id = memorial_id) = auth.uid());
CREATE POLICY "Fatos delete" ON fatos FOR DELETE TO public USING ((SELECT user_id FROM memoriais WHERE id = memorial_id) = auth.uid());

-- ==========================================
-- 8. EXTENSÃO E CORREÇÕES EXTERNAS (Propostas pelo cliente)
-- ==========================================

-- Narrativas: garante que memorial_id pertence ao usuário
DROP POLICY IF EXISTS "Usuario acessa narrativas dos seus memoriais insert" ON narrativas;
CREATE POLICY "Usuario acessa narrativas dos seus memoriais insert"
  ON narrativas FOR INSERT
  TO public
  WITH CHECK (
    auth.uid() = (SELECT memoriais.user_id FROM memoriais
                  WHERE memoriais.id = memorial_id)
  );

-- Fatos
DROP POLICY IF EXISTS "Usuario acessa fatos dos seus memoriais insert" ON fatos;
CREATE POLICY "Usuario acessa fatos dos seus memoriais insert"
  ON fatos FOR INSERT
  TO public
  WITH CHECK (
    auth.uid() = (SELECT memoriais.user_id FROM memoriais
                  WHERE memoriais.id = memorial_id)
  );

-- Memorias
DROP POLICY IF EXISTS "Usuario acessa memorias dos seus memoriais insert" ON memorias;
CREATE POLICY "Usuario acessa memorias dos seus memoriais insert"
  ON memorias FOR INSERT
  TO public
  WITH CHECK (
    auth.uid() = (SELECT memoriais.user_id FROM memoriais
                  WHERE memoriais.id = memorial_id)
  );

-- Midias
DROP POLICY IF EXISTS "Usuario gerencia midias dos seus memoriais insert" ON midias;
CREATE POLICY "Usuario gerencia midias dos seus memoriais insert"
  ON midias FOR INSERT
  TO public
  WITH CHECK (
    auth.uid() = (SELECT memoriais.user_id FROM memoriais
                  WHERE memoriais.id = memorial_id)
  );

-- Respostas
DROP POLICY IF EXISTS "Usuario acessa respostas dos seus memoriais insert" ON respostas;
CREATE POLICY "Usuario acessa respostas dos seus memoriais insert"
  ON respostas FOR INSERT
  TO public
  WITH CHECK (
    auth.uid() = (SELECT memoriais.user_id FROM memoriais
                  WHERE memoriais.id = memorial_id)
  );

-- Perfil narrativo
DROP POLICY IF EXISTS "Usuario acessa perfil dos seus memoriais insert" ON perfil_narrativo;
CREATE POLICY "Usuario acessa perfil dos seus memoriais insert"
  ON perfil_narrativo FOR INSERT
  TO public
  WITH CHECK (
    auth.uid() = (SELECT memoriais.user_id FROM memoriais
                  WHERE memoriais.id = memorial_id)
  );

-- Eventos de geração
DROP POLICY IF EXISTS "Usuario insere eventos dos seus memoriais" ON eventos_geracao;
CREATE POLICY "Usuario insere eventos dos seus memoriais"
  ON eventos_geracao FOR INSERT
  TO public
  WITH CHECK (
    auth.uid() = (SELECT memoriais.user_id FROM memoriais
                  WHERE memoriais.id = memorial_id)
  );

-- ==========================================
-- 9. TABELA: profiles (perfil do usuário)
-- ==========================================
DROP POLICY IF EXISTS "Usuario insere seu proprio perfil" ON profiles;
CREATE POLICY "Usuario insere seu proprio perfil"
  ON profiles FOR INSERT
  TO public
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Usuario ve seu proprio perfil" ON profiles;
CREATE POLICY "Usuario ve seu proprio perfil"
  ON profiles FOR SELECT
  TO public
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Usuario atualiza seu proprio perfil" ON profiles;
CREATE POLICY "Usuario atualiza seu proprio perfil"
  ON profiles FOR UPDATE
  TO public
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "QR Code update public" ON qrcodes;
CREATE POLICY "QR Code select public" ON qrcodes FOR SELECT TO public USING (true);
CREATE POLICY "QR Code update public" ON qrcodes FOR UPDATE TO public USING (true);

DROP POLICY IF EXISTS "Usuario cria qrcode dos seus memoriais" ON qrcodes;
CREATE POLICY "Usuario cria qrcode dos seus memoriais"
  ON qrcodes FOR INSERT
  TO public
  WITH CHECK (
    auth.uid() = (SELECT memoriais.user_id FROM memoriais
                  WHERE memoriais.id = memorial_id)
  );

-- ==========================================
-- 10. TABELA: autorizacoes (Documentos Sensíveis)
-- ==========================================
DROP POLICY IF EXISTS "Usuario acessa suas autorizacoes select" ON autorizacoes;
CREATE POLICY "Usuario acessa suas autorizacoes select"
ON autorizacoes
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
);

DROP POLICY IF EXISTS "Usuario envia autorizacao" ON autorizacoes;
CREATE POLICY "Usuario envia autorizacao"
ON autorizacoes
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
);

-- Garantir explicitamente a ausência de update/delete (se houver scripts antigos)
DROP POLICY IF EXISTS "Usuario atualiza sua autorizacao" ON autorizacoes;
DROP POLICY IF EXISTS "Usuario deleta sua autorizacao" ON autorizacoes;
