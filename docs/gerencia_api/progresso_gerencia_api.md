# 📈 Roadmap e Progresso: Gerência de APIs, Custos e Telemetria

> Este documento acompanha o avanço das tarefas de telemetria de consumo, monitoramento financeiro de APIs e precificação.

---

## ⏳ HISTÓRICO DE CONCLUSÃO (Migrado do Núcleo de Suporte)

### Fase 0 — Instrumentação de Telemetria
* [x] Criar a tabela `support_metrics` no Supabase para armazenar os logs de telemetria (Migration `003_create_support_metrics.sql`).
* [x] Adicionar logging de tokens consumidos por requisição (entrada + saída) no chat de suporte inteligente ([TelemetryService.ts](file:///c:/Users/Edi%20Nascimento/antigravity/Ecos-de-Mem%C3%B3ria/src/services/TelemetryService.ts)).
* [x] Registrar a latência total de cada chamada no [SupportService.ts](file:///c:/Users/Edi%20Nascimento/antigravity/Ecos-de-Mem%C3%B3ria/src/services/SupportService.ts).
* [x] Registrar qual endpoint foi retornado pelo FTS (e qual foi o rank do match).
* [x] Integrar a geração de áudio (TTS) no logging do `support_metrics` para registrar o consumo transacional ([VoiceGovernanceService.ts](file:///c:/Users/Edi%20Nascimento/antigravity/Ecos-de-Mem%C3%B3ria/src/services/VoiceGovernanceService.ts)).

---

## 🚀 NOVAS TAREFAS DE EXECUÇÃO (Fase 0 - Precificação de Consumos)

### 🔲 PASSO 1: A Estrutura de Precificação no Banco de Dados
*   [x] Criar migration para cadastrar a tabela `api_pricing_catalog` no Supabase ([004_create_api_pricing_catalog.sql](file:///c:/Users/Edi%20Nascimento/antigravity/Ecos-de-Mem%C3%B3ria/migrations/004_create_api_pricing_catalog.sql)).
*   [x] Inserir os registros com os preços unitários das APIs vigentes (Claude 3.5 Sonnet, Claude 3 Haiku, Gemini 1.5 Flash, Google Cloud TTS Standard/Journey, ElevenLabs).

### 🔲 PASSO 2: A View SQL de Custos e Médias (Cockpit Financeiro)
*   [x] Desenvolver a View SQL `view_support_metrics_costs` para computar automaticamente o custo individual de cada transação de texto e voz.
*   [x] Criar view ou query SQL que calcule o custo médio das consultas dos últimos 7 dias (`view_api_costs_summary`).
*   [x] Calcular custo médio atual por consulta técnica de suporte.

### 🔲 PASSO 3: Validação da Fase 0
*   [x] Validar que novos registros inseridos em `support_metrics` se traduzem corretamente em dólares ($) na view (testado via script local).
*   [x] Homologar relatório financeiro do baseline de custos.

---

## 🚀 NOVAS TAREFAS DE EXECUÇÃO (Fase 1 - Painel Administrativo de Consumo)

### 🔲 PASSO 4: Backend & Segurança (Engenharia Core)
*   [ ] Validar estrutura da role de `super_admin` no metadata do Supabase Auth ou tabela de perfis.
*   [ ] Criar interfaces TypeScript para os filtros de busca (`MetricFiltersDTO`) em `/src/types/metrics.ts`.
*   [ ] Implementar a classe `MetricsDashboardService.ts` em `/src/services/` com métodos de consolidação de custos (`getSummaryData`) e listagem paginada (`getDetailedLogs`).
*   [ ] Criar as rotas HTTP `/api/admin/metrics/summary` e `/api/admin/metrics/logs` no Express.
*   [ ] Vincular o middleware `requireSuperAdmin` nas rotas criadas no backend para proteger contra acessos não autorizados.

### 🔲 PASSO 5: Frontend Administrativo (React/Tailwind)
*   [ ] Registrar a nova rota do painel nas configurações do React Router do SaaS B2B.
*   [ ] Desenvolver a página administrativa `/src/pages/saas/admin/MetricsDashboard.tsx`.
*   [ ] Desenvolver os Widgets superiores (Custo Total, Custo Médio 7 dias, Custo Médio Suporte, Total de Transações) usando Lucide Icons.
*   [ ] Implementar os componentes de filtros de período (datas), categoria e provedor de API.
*   [ ] Desenvolver a tabela de listagem de consumo paginada com badges coloridos de categoria.

### 🔲 PASSO 6: UX, Integração & Exportação
*   [ ] Conectar o frontend às APIs do backend passando o cabeçalho com token JWT do Supabase.
*   [ ] Implementar skeletons elegantes para representar os estados de loading na tabela e nos widgets.
*   [ ] Adicionar função client-side para exportar dados para formato CSV.
*   [ ] Validar fluxo completo de segurança com testes de invasão e homologar interface com a Lei de Design.

---

## 🚀 ROADMAP DE IMPLEMENTAÇÃO: MOTOR DE GOVERNANÇA FINANCEIRA (Fase 0 Redefinida)

### 🔲 PASSO 7: Catálogos de Referência (Banco de Dados)
*   [x] Criar e popular a tabela `provider_catalog` (com provedores Anthropic, Google, ElevenLabs).
*   [x] Criar e popular a tabela `feature_catalog` (com features `memorial_text`, `memorial_audio`, `support_chat`, `dev_tools`).
*   [x] Criar a tabela `api_pricing_catalog` com políticas RLS restritas para o `service_role`.
*   [x] Inserir os registros com os preços unitários iniciais das APIs vigentes.
*   [x] Criar índice de busca ativa de preços `idx_pricing_active`.

### 🔲 PASSO 8: Centralização de Logs e Telemetria
*   [x] Criar a tabela principal `api_usage_events` com chaves estrangeiras para os catálogos e suporte a RLS por `organization_id`.
*   [x] Criar índices para relatórios financeiros (`idx_usage_memorial`, `idx_usage_org`, `idx_usage_operation`, etc.).
*   [x] Implementar a classe de serviço central `TelemetryService.ts` em `/src/services/telemetry/` contendo o método central de precificação e gravação `registerApiUsage()`.
*   [x] Criar o utilitário `operationContext.ts` para geração do `operation_id` das transações do sistema.


### 🔲 PASSO 9: Relatórios e Diagnósticos Financeiros
*   [x] Criar a View SQL `vw_custo_por_memorial` (agregação de custo por memorial).
*   [x] Criar a View SQL `vw_custo_por_funeraria_mes` (faturamento mensal de infraestrutura B2B).
*   [x] Criar a View SQL `vw_distribuicao_custo_feature` (distribuição percentual de consumo de APIs).
*   [x] Criar a View SQL `vw_custo_por_operacao` (agrupador de ações do usuário).
*   [x] Homologar o motor de custos com dados simulados e queries de validação de negócios.



