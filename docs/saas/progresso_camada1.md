# Controle de Progresso — Camada 1 (SaaS B2B)
> Este arquivo centraliza o progresso das tarefas de desenvolvimento da Camada 1 e seus Adendos (Atualização V2).
> Atualize este arquivo ao final de cada sessão de trabalho.

---

## 1. Visão Geral do que já foi entregue (Fase 1)
Todas as tarefas de fundação, trancamento financeiro e auditoria da Fase 1 foram concluídas com sucesso e validadas:
- [x] **Fundação do Back-End Multi-Tenant e Autenticação B2B**: Tabelas, isolamento de RLS e middleware criados.
- [x] **Painel Operacional da Organização**: Dashboard funcional (`SaasDashboard.tsx`), modal de compartilhamento (`Saas_NewLinkModal.tsx`), modal de ativação/inativação de memorial em qualquer estado (`SaasToggleBioStatusModal.tsx`).
- [x] **Trilha de Auditoria & Mudança de Plano**: `AuditService.ts`, bloqueios de Downgrade/Upgrade e lógica de ciclos de contratos atômicos.
- [x] **Motor de Voz (TTS)**: Mapeamento de vozes (`audio_tier`) e telemetria de consumo.
- [x] **Resiliência & Padrão Saga**: rollback de créditos em caso de falha de upload/síntese de áudio.
- [x] **QR Code & Livro de Condolências**: Geração paralela silenciosa dos QR Codes de Velório/Lápide, moderação de mensagens corporativas, controle de duplicidades por dispositivo.
- [x] **Refinamentos de Interface**: Contadores dinâmicos, ordenação de status, modal antiansiedade premium na geração e autonomia de créditos 2 para 1.

---

## 2. Backlog e Plano de Ação — Atualização V2 (Novos Módulos)
Esta seção mapeia o backlog dos novos módulos descritos na **Atualização V2 da Camada 1**.

### 🛠️ Módulo 1 — Controle de Respostas Parciais
*Lógica para lidar com múltiplos convites, status intermediário de progresso e badges interativos.*
- [ ] Criar colunas `total_invites_criados`, `total_invites_concluidos` e `origem_sistema` na tabela `memoriais` (Script Bloco A).
- [ ] Executar script de migração de `origem_sistema` para registros existentes (Script Bloco G).
- [ ] Adaptar a rota `/api/public/invite/:token/respostas` para recalcular dinamicamente os invites concluídos e atualizar o `status_memorial`.
- [ ] Implementar o status intermediário `'respostas_parciais'` no fluxo.
- [ ] Travar botão de geração de biografia caso o status seja `'aguardando_respostas'` ou `'respostas_parciais'`.
- [ ] Criar o badge clicável com popover listando o status individual de cada familiar (pendente, acessado, concluído, expirado).
- [ ] Habilitar funcionalidade de reenviar link individual diretamente do popover por familiar.

### 🛠️ Módulo 2 — Sistema de Notificações em Tempo Real
*Alertas instantâneos via Supabase Realtime no painel da funerária.*
- [ ] Criar tabela `organization_notifications` com índices e RLS por organização (Script Bloco B & E).
- [ ] Integrar no backend a inserção de notificações para `'resposta_parcial'` (quando um familiar responde e há pendentes) e `'todos_responderam'` (quando o memorial está pronto).
- [ ] Desenvolver hook do frontend `useNotificacoes.ts` para conectar com o Supabase Realtime canal `organization_notifications`.
- [ ] Implementar Toasts animados exibidos na tela ao receber um evento de notificação em tempo real.
- [ ] Implementar no header do painel o componente de Sino (`🔔`) com histórico flutuante de notificações e contagem acumulada de não lidas.
- [ ] Implementar ação "Marcar todas como lidas" no sino.
- [ ] Permitir ação direta de "Gerar biografia" a partir de notificações do tipo `'todos_responderam'` no histórico do sino.

### 🛠️ Módulo 3 — FotoLink (Upload de Fotos via Link)
*Upload direto pela família aplicando limites do plano contratado.*
- [ ] Criar tabela `photo_invites` com índices e RLS (Script Bloco C & E).
- [ ] Implementar backend da geração de link `/api/memoriais/:id/photo-invite/create` gerando token único e validade de 30 dias.
- [ ] Criar página pública mobile-first `/fotos/:token` sem login contendo:
  - Nome do homenageado e datas de nascimento/óbito.
  - Carregamento de fotos já enviadas (perfil e galeria).
  - Indicador visual de progresso (fotos enviadas vs limite do plano).
- [ ] Configurar endpoint de upload `/api/public/fotos/:token/upload` com validação de limites de fotos por plano (Básico: 5, Premium: 10, Enterprise: 15).
- [ ] Gravar notificação do tipo `'foto_enviada'` quando novos uploads forem concluídos.
- [ ] Criar trigger PostgreSQL para expirar o `photo_invite` imediatamente ao publicar o memorial (`status_memorial = 'publicado'`) (Script Bloco F).
- [ ] Habilitar o cron job diário `expirar-photo-invites` para expirar tokens vencidos (Script Bloco F).

### 🛠️ Módulo 4 — Auditoria de Biografia
*Tabela de auditoria dedicada para ações operacionais humanas sobre a narrativa.*
- [ ] Criar tabela `biografia_audit_logs` com índices, RLS (Script Bloco D & E) e sem permissão de UPDATE/DELETE (Append-only).
- [ ] Criar método `logBiografiaAction` no `AuditService.ts` apontando para a nova tabela.
- [ ] Injetar registro de log de auditoria nas seguintes operações de backend:
  - [ ] Geração inicial de biografia (`geracao_ia`)
  - [ ] Ajuste pontual (`ajuste_ia`)
  - [ ] Edição manual de texto (`edicao_manual`)
  - [ ] Aprovação de biografia (`aprovacao`)
  - [ ] Publicação do memorial (`publicacao`)
  - [ ] Alteração de plano (`upgrade_plano`/`downgrade_plano`)
  - [ ] Reset do memorial (`reset_memorial`)
  - [ ] Exclusão física de áudio (`exclusao_audio`)

---

## 3. Lógica Pendente da Fase 1
- [ ] **Filtro de Inativos (SaaS B2B)**: Adicionar o checkbox "Mostrar Inativos" ou botão equivalente de alternância no painel principal do SaaS para possibilitar de forma simples e rápida a reativação de memoriais suspensos/inativados (atualmente ocultados da listagem padrão de status).
