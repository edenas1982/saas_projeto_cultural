# 📋 Roteiro de Governança e Resiliência (Roadmap de Melhorias)

Este documento centraliza as melhorias de resiliência financeira, governança e tratamento de exceções do ecossistema Ecos de Memórias, cruzando os módulos de Suporte (Sofia), SaaS (Créditos) e Core do Backend.

---

## 🚀 Checklist de Evolução

### 1. Humanização e Segurança do Suporte (Sofia)
* **Objetivo:** Blindar o atendente de jargões técnicos e adaptar o suporte à persona do cliente final.
* **Tarefas:**
  - [ ] **Refatorar o prompt do `ingest.ts` (Dupla Persona):** Alterar a geração de documentação do endpoint no commit para separar os campos em: *Descrição Funcional*, *Regras de Negócio*, *Benefício do Usuário* e *Instrução de Resolução*.
  - [ ] **Segurança de Nível de Acesso:** Adicionar a coluna `access_level` na tabela `system_endpoints` no Supabase para controlar quais endpoints são expostos a cada perfil.
  - [ ] **Regra de Ouro (Sofia Cega):** Bloquear contextos técnicos (custos, logs internos, infraestrutura do banco) no prompt da Sofia quando o usuário logado for um cliente final da funerária (`family_client`).

---

### 2. Protocolo de Transação Atômica (Resiliência de Fluxo)
* **Objetivo:** Evitar cobranças indevidas e estados inconsistentes no banco em caso de falha de serviços de terceiros (TTS/Locução).
* **Tarefas:**
  - [ ] **Marcação de Status de Áudio:** Alterar a tabela de narrativas/memoriais para marcar explicitamente como `audio_status: 'failed'` caso a API do TTS falhe no meio da requisição.
  - [ ] **Rollback Financeiro Integrado:** Garantir via código Express (no Saga Executor) que, se o upload ou a síntese do áudio falhar, a carteira de edições da funerária **não seja debitada** (ou sofra estorno automático).
  - [ ] **UX Resiliente (Retry Inteligente):** Criar um botão "Tentar Novamente" na interface do SaaS que reaproveite a biografia e dispare unicamente a locução, sem cobrar créditos extras.
  - [ ] **Debate Futuro sobre Franquia de Edições (IA vs Áudio):** Avaliar se no futuro liberamos de 2 a 3 gerações de texto (LLM) por cada crédito de alteração/edição do plano, visto que o custo do Claude (LLM) é exponencialmente mais barato que a síntese de voz (TTS).

---

### 3. Capa de Chuva de Erros (Tratamento de Exceções)
* **Objetivo:** Substituir falhas críticas que assustam o usuário por mensagens de orientação comercial amigáveis.
* **Tarefas:**
  - [ ] **Tradutor de Erros de Negócio:** Interceptar erros 500 do Express e mapear códigos de negócio (ex: `429` -> `API_RATE_LIMIT`, `Account Exhausted` -> `CREDITS_EXHAUSTED`, `Timeout` -> `SERVICE_TIMEOUT`).
  - [ ] **Mensagens Amigáveis (Display Messages):** Mapear para cada erro uma frase acolhedora (ex: *"Estamos processando muitas solicitações simultâneas, tente novamente em breve."*).
  - [ ] **Alerta de Pânico:** Desenvolver webhook de alerta (WhatsApp/Telegram/Slack) para disparar notificações em tempo real caso ocorra o erro `ACCOUNT_EXHAUSTED` (sem créditos de API do provedor) ou `API_DISCONTINUED`.
