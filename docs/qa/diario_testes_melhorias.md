# 📓 Diário de Testes, QA e Melhorias Identificadas

Este diário é o local central para registrar memórias de testes manuais, comportamentos inesperados (bugs) encontrados nas homologações e ideias de melhorias para o sistema **Ecos de Memórias**.

---

## 📋 Como Preencher Este Diário

Sempre que realizar um teste ou identificar uma melhoria, crie um bloco seguindo o padrão abaixo:

```markdown
### 🗓️ [DD/MM/AAAA] — [Breve Título do Teste/Melhoria]
* **Módulo:** (SaaS / Suporte / Ingestão / Banco de Dados)
* **Status:** (Pendente / Em Investigação / Resolvido / Ideia de Evolução)
* **O que foi feito/Comportamento observado:**
  - (Descreva o passo a passo do teste realizado ou o comportamento anormal)
* **Erros / Logs Capturados:**
  - (Cole os prints de erros, mensagens de exceção ou queries do banco de dados)
* **Ações Sugeridas / Ideia de Melhoria:**
  - (Como podemos corrigir ou aprimorar o comportamento do sistema)
```

---

## 📈 Histórico de Registros

### 🗓️ 03/06/2026 — Homologação da Telemetria Sofia (Exemplo)
* **Módulo:** Suporte / Telemetria
* **Status:** Resolvido
* **O que foi feito/Comportamento observado:**
  - Ao fazer uma pergunta no suporte, o servidor retornava o erro `organizationId é obrigatório para a feature "support_chat"`.
* **Erros / Logs Capturados:**
  - `[TelemetryService] ERRO DE GOVERNANÇA: organizationId (funeralHomeId) é obrigatório para a feature "support_chat"`
* **Ações Sugeridas / Ideia de Melhoria:**
  - A associação de B2B do usuário estava pendente no banco de dados local. Criamos e associamos o usuário `78654881-7776-4391-8e3f-03d54bc135d9` à funerária de testes no Supabase e o erro de governança foi resolvido.
