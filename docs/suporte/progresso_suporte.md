# 📈 Roadmap e Progresso: Suporte Inteligente (Diário de Bordo)

> Este documento acompanha o avanço da implementação do sistema de documentação e suporte operacional.

---

## ⏳ HISTÓRICO DE CONCLUSÃO: IMPLEMENTAÇÃO BASELINE (RAG v1)
*Esta seção consolida a fundação técnica que já está ativa em produção.*

### Fase 1 — Fundação (Banco de dados e estrutura)
* [x] Criar a tabela `system_endpoints` no Supabase com os campos de especificação técnica.
* [x] Criar a tabela `system_endpoint_versions` (histórico imutável de snapshots).
* [x] Adicionar constraint `UNIQUE(path, method)` na tabela principal.
* [x] **Entregável:** Estrutura SQL em `migrations/001_system_endpoints.sql` testada e homologada.

### Fase 2 — Detector determinístico (git hook)
* [x] Criar script de pre-commit para o Husky.
* [x] Isolar apenas o diff do `server.ts` para otimizar tempo e custo de processamento.
* [x] Criar a rotina regex para categorizar endpoints adicionados, alterados ou removidos.
* [x] **Entregável:** Script `scripts/ingest.ts` isolando trechos em vez do diff completo.

### Fase 3 — Analisador IA + validador + persistência
* [x] Conectar SDK da Anthropic no pipeline de ingestão.
* [x] Criar o prompt estruturado obrigatório (descrição, auth, regras, schemas entrada/saída).
* [x] Desenvolver o validador do JSON gerado antes do commit.
* [x] **Entregável:** Pipeline autônomo. Commits no core registram documentações automaticamente.

### Fase 4 — Módulo de suporte vivo
* [x] Desenvolver o método de leitura e contexto de suporte no core do backend.
* [x] Implementar persona "Sofia" limitando a respostas comerciais e empáticas.
* [x] **Entregável:** Chat de suporte funcional consumindo especificações direto do banco.

### Fase 5 — Otimização RAG com FTS (Redução de Custo)
* [x] Migration SQL para FTS (`search_vector`, trigger incremental e RPC `search_endpoints`).
* [x] Integração da busca via similaridade FTS no `SupportService.ts`.
* [x] Sanitização automática do payload enviado ao Claude (remoção de IDs e RLS).
* [x] **Entregável:** Redução de consumo de 40k para ~1.5k tokens por consulta, e latência sob FTS inferior a 2s.

---

## 🚀 NOVO PLANO DE EVOLUÇÃO: ECOSSISTEMA DE INTELIGÊNCIA OPERACIONAL
*Roadmap evolutivo de inteligência, segurança e aprendizado com o atendente.*

### 🛠️ FASE 0 — Preparação e Baseline
> **Objetivo:** Medir o estado atual e coletar dados de latência e comportamento antes de implementar as novas camadas de inteligência de suporte.
> **Duração estimada:** 1–2 semanas | **Status:** PENDENTE

#### Baseline de Performance e Temas
- [ ] Calcular latência média atual (P50 e P95) do serviço de suporte.
- [ ] Catalogar as 20 perguntas mais frequentes recebidas pelo suporte humano.
- [ ] Identificar quais dessas 20 perguntas possuem respostas previsíveis/repetitivas (candidatas ao FAQ).
- [ ] Documentar a distribuição atual de temas de suporte (% técnico / % financeiro / % onboarding).

#### Categorias de Intenção
- [ ] Definir as categorias finais do Intent Router (sugestão: Financeiro, Técnico, Onboarding, Diagnóstico, Geral).
- [ ] Para cada categoria, mapear de 10 a 20 termos e frases gatilho em português.
- [ ] Validar as listas com a equipe de atendimento humano.

#### Validação da Fase 0
- [ ] Relatório de baseline de latência homologado.
- [ ] Lista de termos do Intent Router validada pelo time de suporte.
- [ ] Primeiros 20-30 pares de perguntas e respostas de FAQ identificados e rascunhados.

---

### 🔍 FASE 1 — Triagem Inteligente (Intent Router + FAQ + Confidence)
> **Objetivo:** Resolver mais de 70% das chamadas comuns sem acionar custos com LLM, utilizando orquestração de camadas de relevância.
> **Duração estimada:** 2–3 semanas | **Status:** PENDENTE

#### Intent Router
- [ ] Implementar a função de classificação por Regex + FTS no backend (sem custo de LLM).
- [ ] Mapear as 5 categorias de intenções definidas na Fase 0.
- [ ] Criar fluxo de fallback para a categoria "Geral" caso nenhuma regra case.
- [ ] Validar o Router contra as 20 perguntas comuns (meta: ≥ 85% de acertos).
- [ ] Garantir latência no roteamento isolado de < 50ms.

#### FAQ Estruturado (Camada 1)
- [ ] Criar a tabela `faq_estruturado` (conforme schema da Bíblia).
- [ ] Criar índice de busca FTS + trigram (pg_trgm) na tabela.
- [ ] Inserir os 20-30 pares iniciais aprovados na Fase 0.
- [ ] Desenvolver a RPC `buscar_faq(query, categoria, threshold)` no Supabase.

#### Orquestração de Camadas
- [ ] Integrar o Intent Router antes da busca FTS no [SupportService.ts](file:///C:/Users/Edi%20Nascimento/antigravity/Ecos-de-Mem%C3%B3ria/src/services/SupportService.ts).
- [ ] Integrar a busca no FAQ (Camada 1) antes do motor técnico (Camada 2).
- [ ] Garantir que o match no FAQ retorne diretamente a resposta ao atendente, cortando custos com IA.
- [ ] Tratar fluxo de fallback robusto (FAQ -> Código RAG -> Escalada).

#### Confidence Score e Escalada
- [ ] Implementar algoritmo híbrido de confiança (rank FTS + presença de FAQ).
- [ ] Mapear os thresholds: ≥ 0.80 responde; 0.50–0.79 exibe alerta; < 0.50 escala para humano.
- [ ] Adicionar campo `confidence_score` no log de consultas.
- [ ] Criar tabela `escaladas` no Supabase e registrar automaticamente as falhas de confiança.
- [ ] Implementar notificação de escalada em tempo real (webhook).

#### Validação da Fase 1
- [ ] Taxa de resolução no FAQ ≥ 50% nos primeiros testes.
- [ ] Verificação em log: nenhuma resposta de FAQ chamando a API do Claude.
- [ ] Latência total sob FAQ ≤ 2s.
- [ ] Log de confiança registrado em 100% das consultas.

---

### 🛡️ FASE 2 — Segurança e Diagnóstico (LGPD + Data Sanitizer)
> **Objetivo:** Habilitar diagnóstico técnico por `memorial_id` garantindo total conformidade legal à LGPD.
> **Duração estimada:** 2–3 semanas | **Status:** PENDENTE

#### Data Sanitizer
- [ ] Implementar função local de Regex para higienização de CPF, CNPJ, e-mail, nomes e valores.
- [ ] Desenvolver o mapa de tokens em memória (limpo ao término da sessão).
- [ ] Validar que nenhum dado sensível real é exposto ao payload final da IA.
- [ ] Criar suíte de testes unitários para o Sanitizer com logs simulados.

#### DiagnosticService (Camada 3)
- [ ] Implementar a lógica de busca de logs de auditoria por `memorial_id`.
- [ ] Aplicar o Data Sanitizer sobre os logs recuperados antes da formatação do prompt.
- [ ] Implementar a persona da IA para tradução simples do erro (usando os tokens higienizados).
- [ ] Criar a tabela `auditoria_diagnostico` para manter rastro de quem acessou qual log de cliente.

#### Validação da Fase 2
- [ ] Auditoria de payloads: 0% de dados reais vazados nos prompts.
- [ ] Rastro na tabela de auditoria ativo e gerando logs a cada busca.
- [ ] Homologação jurídica do fluxo de sanitização.

---

### 🔄 FASE 3 — Loop de Aprendizado (Curadoria + Dashboard)
> **Objetivo:** Garantir a evolução orgânica do ecossistema a partir de interações com o suporte.
> **Duração estimada:** 3–4 semanas | **Status:** PENDENTE

#### Perguntas Não Frequentes
- [ ] Criar tabela `perguntas_nao_frequentes` no Supabase.
- [ ] Automatizar o insert de perguntas que caíram na Escalada Humana ou sob baixa confiança.
- [ ] Implementar sugestão automática de resposta gerada pela IA (inativa até curadoria).

#### Agrupamento por Clusters (Clustering Semântico)
- [ ] Configurar job diário de embeddings locais leves para as perguntas sem resposta.
- [ ] Implementar algoritmo de agrupamento DBSCAN com similaridade de cosseno de 0.82.
- [ ] Eleger a pergunta canônica de cada grupo para exibir ao curador.

#### Dashboard de Curadoria
- [ ] Desenvolver interface web para a moderação dos clusters pendentes.
- [ ] Implementar botões de curadoria: "Promover para FAQ", "Descartar", "Escalar Técnico".
- [ ] Integrar alertas visuais baseados no SLA de curadoria pendente (> 7 dias).
- [ ] Automatizar a inserção em `faq_estruturado` com status ativo ao aprovar no dashboard.

#### Validação da Fase 3
- [ ] Confirmação de que 100% dos transbordos salvam em `perguntas_nao_frequentes`.
- [ ] Job de clustering rodando diariamente e agrupando sinônimos com precisão.
- [ ] Tempo de aprovação inline de resposta inferior a 2 minutos por cluster.

---

### 📊 FASE 4 — Escala, Otimização e Decisão de Provider
> **Objetivo:** Otimizar custos operacionais de longo prazo e consolidar o ecossistema.
> **Duração estimada:** Contínua (após 4 semanas de métricas acumuladas) | **Status:** EM ANDAMENTO

#### Auditoria de Custos e Provedores
- [ ] Coletar a distribuição real de consultas por camada (% FAQ / % FTS / % Diagnóstico / % Escalada).
- [ ] Calcular o custo ponderado médio por consulta e comparar com a meta de $0.005.
- [ ] Executar o cálculo comparativo financeiro entre Claude Haiku e Gemini Flash.
- [x] Se vantajoso, migrar a infraestrutura do RAG para o SDK do Gemini Flash.


#### pgvector e Embeddings
- [ ] Avaliar a cobertura de matching da Camada 1 (se FAQ Resolution < 65%).
- [ ] Se necessário, implementar o `pgvector` no Supabase para busca semântica em FAQ amplo.

#### Cache de Respostas
- [ ] Implementar cache em memória com TTL de 1 hora para perguntas repetidas com respostas idênticas.

#### Validação da Fase 4
- [ ] Relatório financeiro comprovando custo médio por consulta inferior a $0.005.
- [ ] Decisão final de provider documentada.

---

### 🚀 NOVAS TAREFAS DE EXECUÇÃO: INSTRUMENTAÇÃO DE TELEMETRIA DE ATENDIMENTO (Fases 0.6 e 0.7)

#### 🔲 PASSO 5: Telemetria Sofia Chat (Suporte)
- [x] Injetar o `TelemetryService` no `SupportService.ts`.
- [x] Mapear o `sessionId` do suporte como o `operation_id` da telemetria.
- [x] Garantir que o classificador (Intent Router) e FAQ (Camada 1) **não registrem** eventos em `api_usage_events` (custo zero).
- [x] Chamar `registerApiUsage` no `SupportService` quando a consulta cair no LLM (Claude/Gemini) na Camada 2, sob a feature `'support_chat'`.
- [x] Registrar logs de erro de execução no suporte com status `'error'`.
- [x] Garantir obrigatoriedade do campo `funeralHomeId` nos logs de suporte.

#### 🔲 PASSO 6: Telemetria Ingestão de Código (DevTools)
- [x] Injetar o `TelemetryService` no `IngestionService.ts`. (Injetado em AIAnalysisService no ingest.ts)
- [x] Chamar `registerApiUsage` no `IngestionService` para cada endpoint analisado pelo Claude sob a feature `'dev_tools'`.
- [x] Utilizar o modelo `'claude-haiku-4-5'` nos logs para o pipeline de documentação.
- [x] Configurar `funeralHomeId` como `null` / `undefined` nos logs do pipeline, representando consumo de despesa interna.
- [x] Garantir que erros de telemetria no pipeline falhem silenciosamente (sem bloquear commits locais).
