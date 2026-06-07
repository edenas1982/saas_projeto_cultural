# 🛠️ Plano de Execução do Banco de Dados — Fase 1 SaaS B2B

Para garantir segurança na inclusão da arquitetura Multi-Tenant e não corromper integridade referencial ou foreign keys em memoriais criados no legado, os scripts foram divididos em 4 blocos sequenciais isolados.

Todos os scripts encontram-se dentro da pasta `/sql/` neste repositório.

Você deve ir ao painel do **Supabase (SQL Editor)** e executar um por um na ordem exata. Todo bloco inclui um `BEGIN; ... COMMIT;` (Transação Atômica), ou seja: só há gravação real no banco se o script do bloco não contiver erros.

---

## 📦 Bloco 1: Criação das Tabelas Core
**Arquivo:** `/sql/01_tabelas_base.sql`

Este script vai criar as tabelas "em branco" do SaaS que não requerem herança (não dependem de tabelas legadas preexistentes). São elas:
- `organizations`
- `organization_relations`
- `organization_users`
- `family_accounts`
- `family_members`
- `audit_logs`

**Após rodar, valide:**
```sql
SELECT COUNT(*) FROM organizations;
SELECT COUNT(*) FROM family_accounts;
```
👉 *Devem retornar `0` (estão vazias e criadas com sucesso).*

---

## 🔀 Bloco 2: Alteração de Legado e Migração DML
**Arquivo:** `/sql/02_migracao.sql`

Este script modifica a tabela existende de `memoriais` adicionando colunas (ex: `organization_id`, `family_account_id` e colunas de controle). Também instala os campos `deleted_at` para **Soft Delete**.
Após o DDL, será feita a carga via `INSERT INTO ... SELECT ... ON CONFLICT DO NOTHING`, migrando com destreza todos da tabela antiga `users` para `family_accounts`. Em seguida, preenche a lacuna de `family_account_id` da base unificada de memoriais.

**Após rodar, valide:**
```sql
-- Ambos devem ser iguais demonstrando migração perfeitamente paritária
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM family_accounts;

-- Prova definitiva que não ficaram memoriais órfãos (deve ser 0)
SELECT COUNT(*) FROM memoriais WHERE family_account_id IS NULL;
```

---

## 🧩 Bloco 3: Criação de Tabelas Dependentes
**Arquivo:** `/sql/03_tabelas_dependentes.sql`

Aqui criamos as tabelas exclusivas do SaaS atreladas aos Memoriais da Fase de Migração 2. São elas:
- `question_invites` (Magic links)
- `memorial_versions` (Snapshot Versioning de Narrativas)
- `memorial_qrcodes` (QR de Velório e Lápide)

**Validação Visual no Supabase Table Editor:**
👉 Verifique se as 3 tabelas existem e não contêm erros construtivos de constraint. 

---

## 🛡️ Bloco 4: RLS, Triggers e Security Definers
**Arquivo:** `/sql/04_rls_functions.sql`

O núcleo da segurança do sistema Multi-Tenant.
1. Cria função global PostgreSQL `auth.get_user_organization()` recuperando claims do JWT.
2. Habilita RLS forçado em todas as tabelas (SaaS e Cultura Pura).
3. Cria Policies complexas (Ex: Isolamento e restrição baseada em `owner family` VS `owner organization`).

**Após rodar, valide:**
```sql
SELECT auth.get_user_organization();
```
👉 *Rode do painel e espere resultado `null` sem erros (pois sua query do editor console não passa na header de autenticação User JWT).*

---

## ⏰ Ponto Extra: Cron de Expiração de Invites
Você mencionou com razão! O **pg_cron** depende de uma lib instalada.
**Como fazer manualmente:**
1. No seu Painel do Supabase > **Database** > **Extensions**.
2. Busque e ative a extensão: `pg_cron`.
3. Rode o bloco isolado comentado no fim do arquivo `04_rls_functions.sql` sem a tag transacional `BEGIN;` ou `COMMIT;` para assinar o gatilho de injeção automática de status 'expirado'.
