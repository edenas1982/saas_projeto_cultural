-- Criação de uma tabela de teste simples
CREATE TABLE teste_sistema (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  descricao TEXT,
  user_id UUID REFERENCES auth.users(id) NOT NULL, -- Obrigatório referenciar o usuário para o RLS
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Segurança: Ativando RLS (Row Level Security) - CAMADA 2
ALTER TABLE teste_sistema ENABLE ROW LEVEL SECURITY;

-- Política de leitura: O usuário só pode ver as linhas de teste criadas por ele mesmo
CREATE POLICY "Usuário pode ver seus próprios testes" 
ON teste_sistema FOR SELECT
USING (auth.uid() = user_id);

-- Política de inserção: O usuário só pode inserir testes no seu próprio ID
CREATE POLICY "Usuário pode inserir seus próprios testes" 
ON teste_sistema FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Política de atualização: O usuário só pode atualizar seus próprios testes
CREATE POLICY "Usuário pode atualizar seus próprios testes" 
ON teste_sistema FOR UPDATE
USING (auth.uid() = user_id);

-- Política de exclusão: O usuário só pode deletar seus próprios testes
CREATE POLICY "Usuário pode deletar seus próprios testes" 
ON teste_sistema FOR DELETE
USING (auth.uid() = user_id);
