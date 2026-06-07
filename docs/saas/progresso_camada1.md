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
- [x] Criar colunas `total_invites_criados`, `total_invites_concluidos` e `origem_sistema` na tabela `memoriais` (Script Bloco A).
- [x] Executar script de migração de `origem_sistema` para registros existentes (Script Bloco G).
- [x] Adaptar a rota `/api/public/invite/:token/respostas` para recalcular dinamicamente os invites concluídos e atualizar o `status_memorial`.
- [x] Implementar o status intermediário `'respostas_parciais'` no fluxo.
- [x] Criar `Saas_RespostasParciaisModal` para exibição detalhada por familiar.
- [x] Travar a geração de biografia no frontend para quando o memorial estiver em `'respostas_parciais'`.
- [x] Travar botão de geração de biografia caso o status seja `'aguardando_respostas'` ou `'respostas_parciais'`.
- [x] Criar o badge clicável com popover listando o status individual de cada familiar (pendente, acessado, concluído, expirado).
- [x] Habilitar funcionalidade de reenviar link individual diretamente do popover por familiar.

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
- [x] Criar tabela `photo_invites` com índices e RLS (Script `supabase/migrations/foto_link_migration.sql` — executar no Supabase).
- [x] Implementar backend da geração de link `POST /api/memoriais/:id/photo-invite/create` com reutilização de link ativo (classe `PhotoInviteService.ts`).
- [x] Criar página pública mobile-first `/fotos/:token` (`src/pages/PublicFotoLink.tsx`) sem login contendo:
  - Nome do homenageado e datas de nascimento/óbito (formato `★ AAAA † AAAA`).
  - Carregamento de fotos já enviadas (perfil e galeria).
  - Indicador visual de progresso (fotos enviadas vs limite do plano).
- [x] Configurar endpoint de upload `POST /api/public/fotos/:token/upload` com validação de limites de fotos por plano (Básico: 5, Premium: 10, Enterprise: 15).
- [x] Gravar notificação do tipo `'foto_enviada'` quando novos uploads forem concluídos (`POST /api/public/fotos/:token/notify`).
- [x] Criar trigger PostgreSQL para expirar o `photo_invite` imediatamente ao publicar o memorial (Script SQL).
- [x] Habilitar o cron job diário `expirar-photo-invites` (Script SQL — pg_cron).
- [x] Adicionar botão `📷 FotoLink` na linha de cada memorial no painel B2B (`SaasDashboard.tsx`) com modal de cópia e envio via WhatsApp.
- [x] Rota pública `/fotos/:token` registrada no `src/App.tsx`.
- [x] Design afetivo B2C (`bg-stone-50`, botões teal, fonte Playfair Display) seguindo seção 8.2 do AGENTS.md.

### 🛠️ Módulo 5 — Gestão Inteligente de Participantes (Tela: Enviar Link)
*Controle de envios, reabilitação de links, exclusões, rateio de perguntas órfãs e validações em tempo real.*
- [x] Primeira abertura envia links um a um com carimbo visual.
- [ ] Carimbo "Enviado" não bloqueia reenvio de links de entrevista.
- [x] Permissão para alterar nome de familiar em qualquer estado do link.
- [ ] Bloqueio de alteração de telefone para status `CONCLUIDO` e `PENDENTE_REABILITADO`.
- [x] Excluir familiar em `PENDENTE` ou `ACESSADO` realiza o rateio automático imediato.
- [x] Excluir familiar em `CONCLUIDO` gera as "perguntas órfãs".
- [x] Excluir familiar em `PENDENTE_REABILITADO` verifica as respostas ativas no banco de dados primeiro.
- [x] Bloquear botão "Concluir" caso existam perguntas órfãs pendentes.
- [x] Implementar atribuição de perguntas órfãs para familiar já existente (mescla no link se `PENDENTE`/`ACESSADO` / cria link novo se `CONCLUIDO`).
- [x] Implementar atribuição de perguntas órfãs para familiar novo.
- [x] Permitir reabilitar o link (status -> `PENDENTE_REABILITADO`) somente para casos `CONCLUIDO` pela funerária.
- [x] Permitir exclusão/revogação manual da reabilitação pela funerária (estado volta a `CONCLUIDO` mantendo resposta anterior).
- [ ] Manter o link do responsável principal imune à expiração individual (expira apenas se *todos* concluírem).
- [ ] Exibir botão "Encaminhar link" para o responsável principal distribuir para os demais com status pendente.
- [ ] Status contínuo: O sistema só libera `respostas_recebidas` quando *todos* os membros (incluindo reposições órfãs) estiverem no status `CONCLUIDO`.
- [ ] Travar bloqueio e avisos corretos de geração de biografia antes do encerramento das respostas.
- [ ] Realtime Supabase emitindo atualização em tempo real para os status de cada familiar (Toast + State Sync).
- [ ] Bloquear exclusão conflitante com estado Realtime (ex: familiar conclui enquato o agente tenta exclui-lo).
- [ ] Bloqueio protetivo para o rateio se um familiar se encontra acessado online respondendo agora.
- [ ] Backend como "Fonte da Verdade": Validar o estado do question_invites via banco na hora de salvar e não confiar cegamente no frontend.
- [ ] Restrições duras de inputs (nome vazio = erro, validação de celular para o formato local/nacional).
- [ ] Proteção anti-exclusão para o familiar Principal e limites arquiteturais (min: 1 participante, max: 4 participantes).


---

## 3. Lógica Pendente da Fase 1
- [ ] **Filtro de Inativos (SaaS B2B)**: Adicionar o checkbox "Mostrar Inativos" ou botão equivalente de alternância no painel principal do SaaS para possibilitar de forma simples e rápida a reativação de memoriais suspensos/inativados (atualmente ocultados da listagem padrão de status).
