# Ecossistema de Inteligência Operacional — Suporte SaaS
### Roteiro de Evolução Arquitetural + Checklist por Fase
**Versão 1.0 · Junho 2025**
**Autores do debate:** Claude (Anthropic) · GPT (OpenAI) · Gemini (Google)

---

> **Sobre este documento**
> Este roteiro consolida o debate técnico entre três modelos de IA (Claude, GPT e Gemini) sobre a evolução do sistema de suporte do SaaS. Não contém código — o código de cada fase será discutido e validado separadamente antes da implementação. O objetivo é garantir que todas as decisões de arquitetura estejam documentadas, justificadas e sequenciadas antes de qualquer linha ser escrita.

---

## Índice

1. [Contexto e Ponto de Partida](#1-contexto-e-ponto-de-partida)
2. [Visão do Ecossistema](#2-visão-do-ecossistema)
3. [Os 6 Consensos (Claude + GPT + Gemini)](#3-os-6-consensos)
4. [Pilares da Arquitetura](#4-pilares-da-arquitetura)
   - 4.1 Hierarquia de Inteligência
   - 4.2 Diagnóstico com Segurança (LGPD)
   - 4.3 Loop de Melhoria Contínua
   - 4.4 Escalada Humana e SLA
5. [Decisões de Design](#5-decisões-de-design)
6. [Métricas de Sucesso](#6-métricas-de-sucesso)
7. [Roadmap de Fases](#7-roadmap-de-fases)
8. [Checklists por Fase](#8-checklists-por-fase)
9. [Tensões Abertas](#9-tensões-abertas)

---

## 1. Contexto e Ponto de Partida

### O que já existe (base RAG v1)

O sistema atual já implementa:

- **Tabelas versionadas** com documentação dos endpoints (descrições técnicas, regras de negócio, FAQs)
- **Full-Text Search (FTS)** com `tsvector` e índice GIN para recuperação de contexto relevante
- **SupportService.ts** com sanitização de campos técnicos (IDs, tabelas, RLS) antes do envio à IA
- **Persona "Sofia"** com system prompt fixo que impõe tom empático e comercial
- **Redução estimada de 85–95%** no custo de tokens em relação ao envio do JSON completo

### O que está faltando

| Limitação Atual | Impacto |
|---|---|
| Sem camada de FAQ curado | Toda pergunta — mesmo trivial — vai para a IA |
| Sem classificação de intenção | Não há roteamento: suporte técnico, financeiro e onboarding têm o mesmo tratamento |
| Sem diagnóstico por ID de memorial | Atendente precisa vasculhar logs manualmente |
| Sem loop de aprendizado | Perguntas sem resposta são perdidas, o sistema não melhora |
| Sem escalada formal | Quando a IA não sabe, não há fluxo definido para o humano |
| Sem métricas operacionais | Não é possível saber se o sistema está funcionando bem |

---

## 2. Visão do Ecossistema

O objetivo é transformar o sistema de "leitura de código com IA" em um **Ecossistema de Inteligência Operacional** — onde a IA entende contexto de negócio, aprende com interações e protege dados sensíveis.

### Fluxo completo da arquitetura evoluída

```
Pergunta do Atendente
        │
        ▼
┌─────────────────────┐
│   INTENT ROUTER     │  ← Regex + FTS (custo $0, sem LLM)
│  Classifica intenção│
└─────────────────────┘
        │
   ┌────┴────┐
   │         │
   ▼         ▼
Financeiro  Técnico / Onboarding / Diagnóstico
   │         │
   └────┬────┘
        │
        ▼
┌─────────────────────┐
│   CAMADA 1 — FAQ    │  ← FTS + trigram (custo $0)
│   Resposta curada   │
└─────────────────────┘
        │
   Hit? ─── SIM ──► Resposta instantânea ao atendente
        │
       NÃO
        │
        ▼
┌─────────────────────┐
│  CAMADA 2 — FTS     │  ← Motor técnico atual (RAG v1)
│  Busca em código    │
└─────────────────────┘
        │
   Hit? ─── SIM ──► Confidence Score
        │              │
       NÃO             ├── ≥ 80% → Resposta Sofia
        │              └──  < 80% → Escalada Humana
        ▼
┌─────────────────────┐
│ CAMADA 3 — DIAGNÓS- │  ← memorial_id + Data Sanitizer
│ TICO DE LOGS        │    (LGPD obrigatório)
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│  ESCALADA HUMANA    │  ← SLA de notificação no dashboard
│  + APRENDIZADO      │    Pergunta vai para curadoria
└─────────────────────┘
        │
        ▼
┌─────────────────────┐
│  LOOP DE CURADORIA  │  ← Clustering semântico agrupa
│  Dashboard humano   │    variações; curador aprova em lote
└─────────────────────┘
        │
        ▼
     FAQ atualizado (próximo ciclo começa mais inteligente)
```

---

## 3. Os 6 Consensos

Os três modelos (Claude, GPT, Gemini) concordaram em 100% nestes pontos. Eles são **inegociáveis** na arquitetura:

| # | Consenso | Por quê é inegociável |
|---|---|---|
| 1 | **FAQ Curado é a camada mais barata** | Resolver no FAQ custa ~$0. Resolver com LLM custa ~$0.003–0.015. A diferença é de 100x. |
| 2 | **FTS para código é melhor que busca burra** | Enviar o JSON completo (40k tokens) quando só 2k são relevantes é desperdício puro. |
| 3 | **Escalada humana é obrigatória** | Nenhum sistema maduro assume que IA resolve tudo. Pergunta sem confiança = humano. |
| 4 | **Sanitização de dados é inegociável** | LGPD em B2B não é detalhe. CPF/email/valores em logs enviados a LLM externo é risco legal real. |
| 5 | **Custo ponderado precisa ser medido** | A meta de $0.005/consulta só faz sentido com dados reais (% de hits em cada camada). |
| 6 | **Aprendizado contínuo é diferencial** | O sistema deve ficar mais inteligente a cada semana. Perguntas perdidas = conhecimento perdido. |

---

## 4. Pilares da Arquitetura

### 4.1 Hierarquia de Inteligência (Orquestrador)

**Objetivo:** Rotear cada pergunta para a camada mais barata que consegue respondê-la.

#### Intent Router (Classificador de Intenção)

**Decisão consolidada:** O classificador **não será LLM**. Usará **regex + FTS**, custo $0.

> **Por que não LLM?**
> O GPT levantou e o Claude concordou: se o classificador usa IA, trocamos 1 chamada cara por 1 chamada barata de classificação + 1 chamada de resposta. O ganho diminui. Para um domínio fechado com 4–6 categorias fixas, regex + FTS é suficiente, instantâneo e gratuito.

**Categorias iniciais propostas:**

| Categoria | Exemplos de gatilhos |
|---|---|
| Financeiro | "cobrança", "fatura", "reembolso", "plano", "upgrade", "downgrade", "cancelar assinatura" |
| Técnico | "erro", "bug", "não funciona", "endpoint", "integração", "API", "timeout" |
| Onboarding | "como começo", "primeiro acesso", "configurar", "criar conta", "tutorial" |
| Diagnóstico | "memorial_id", "ID do cliente", "log", "rastrear", "o que aconteceu com" |
| Geral | fallback para tudo que não encaixar acima |

#### Camada 1 — FAQ Estruturado

**O que é:** Tabela de pares pergunta/resposta pré-aprovados por humanos.

**Como busca:** FTS + trigram similarity (sem embeddings por enquanto — para 17 endpoints, não é necessário).

**Quando usar embeddings:** Quando a cobertura do FAQ cair abaixo de 65% ou o número de endpoints superar 100.

**Regra de promoção:** Um par pergunta/resposta só entra no FAQ depois de aprovação humana no dashboard de curadoria.

#### Camada 2 — Motor Técnico (RAG v1 atual)

**O que é:** O SupportService.ts já implementado, com busca FTS em `endpoint_docs`.

**Quando é acionado:** Apenas se a Camada 1 não tiver match.

**Saída esperada:** Resposta com Confidence Score associado.

---

### 4.2 Diagnóstico com Segurança — O "Detetive"

**Objetivo:** Permitir que a IA diagnostique problemas de um cliente específico via `memorial_id`, sem expor dados sensíveis a servidores externos.

#### O Problema de Segurança

Logs contêm:
- Dados pessoais: CPF, nome, e-mail, telefone
- Dados financeiros: valores, planos, histórico de pagamento
- Dados técnicos internos: stack traces, nomes de variáveis, IDs de banco

**Enviar qualquer um desses para um LLM externo (Anthropic, Google, OpenAI) sem anonimização é:**
- Violação potencial da LGPD
- Quebra de cláusulas contratuais B2B
- Risco de auditoria e multa

#### Solução: Data Sanitizer (obrigatório, antes da IA)

**Fluxo do DiagnosticService:**

```
Log bruto do memorial_id
        │
        ▼
┌─────────────────────────────┐
│       DATA SANITIZER        │
│                             │
│  CPF "123.456.789-00"       │
│       → "CPF_REF_001"       │
│                             │
│  Email "joao@email.com"     │
│       → "EMAIL_REF_001"     │
│                             │
│  Nome "João Silva"          │
│       → "CLIENTE_REF_001"   │
│                             │
│  Valor "R$ 149,90"          │
│       → "VALOR_REF_001"     │
│                             │
│  Mapa de tokens fica LOCAL  │
│  (nunca sai do servidor)    │
└─────────────────────────────┘
        │
        ▼
   Log anonimizado
        │
        ▼
       LLM
        │
        ▼
  Diagnóstico em texto
  (usando tokens, ex: "CLIENTE_REF_001 teve erro no passo 3")
        │
        ▼
  Atendente recebe o diagnóstico
  (sistema substitui tokens de volta
   localmente, se necessário)
```

**Campos a anonimizar (lista mínima):**

| Tipo | Regex / Pattern |
|---|---|
| CPF | `\d{3}\.?\d{3}\.?\d{3}-?\d{2}` |
| CNPJ | `\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}` |
| E-mail | `[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}` |
| Telefone | `(\(?\d{2}\)?\s?)(\d{4,5}-?\d{4})` |
| Nome próprio | Entidades nomeadas (lista de nomes + NER simples) |
| Valores monetários | `R\$\s?\d+[.,]\d{2}` |

**Política de retenção:** Logs anonimizados não devem ser armazenados além do tempo de resposta da sessão. O mapa de tokens (CPF_REF_001 → CPF real) só existe em memória durante a requisição.

---

### 4.3 Loop de Melhoria Contínua — O "Aprendiz"

**Objetivo:** Fazer o sistema ficar mais inteligente a cada semana, sem depender de engenharia contínua.

#### Tabela `perguntas_nao_frequentes`

Toda vez que o sistema não encontra resposta em nenhuma camada, o par (pergunta + contexto da sessão) é salvo nessa tabela para revisão humana.

**Campos importantes:**
- `pergunta_original` — texto exato do atendente
- `sessao_id` — para rastrear o contexto da conversa
- `categoria_detectada` — qual categoria o Intent Router classificou
- `camadas_tentadas` — quais camadas foram acionadas sem sucesso
- `status` — `pendente`, `em_revisao`, `aprovado`, `descartado`
- `resposta_sugerida_ia` — sugestão automática gerada pela IA (não aprovada)
- `resposta_oficial` — preenchida pelo curador humano
- `criado_em`, `aprovado_em`

#### Clustering Semântico (anti-gargalo de curadoria)

**O problema sem clustering:**
> Em 6 meses, 300 variações de "como cancelo meu plano?" viram 300 itens de curadoria separados.

**A solução:**
> O sistema agrupa automaticamente perguntas semanticamente similares antes de exibir para o curador. O curador vê **1 pergunta canônica** com "50 variações agrupadas". Aprova 1 vez e promove 50 perguntas de uma só vez.

**Como agrupar sem custo:**
- Embeddings locais (modelo leve, roda no servidor, sem API externa)
- Algoritmo K-means ou DBSCAN para agrupamento
- Threshold de similaridade configurável (ex: 0.85 cosine similarity)

**Sugestão automática de resposta:**
- A IA gera uma resposta provisória baseada no contexto técnico disponível
- Curador lê, edita se necessário, e aprova em ~30 segundos
- Muito mais rápido do que escrever do zero

#### Dashboard de Curadoria

**Funcionalidades mínimas:**
- Lista de grupos de perguntas pendentes (por cluster, não por pergunta individual)
- Resposta sugerida pela IA editável inline
- Botão "Aprovar e promover para FAQ"
- Botão "Descartar (não é recorrente)"
- Botão "Escalar para time técnico"
- Filtro por categoria (Financeiro, Técnico, Onboarding...)
- Indicador: "X perguntas pendentes há mais de Y dias" (SLA visual)

---

### 4.4 Escalada Humana e SLA

**Objetivo:** Garantir que nenhuma pergunta fique sem resposta — seja pela IA ou por um humano.

#### Confidence Score

O Confidence Score é um valor entre 0 e 1 que representa o grau de certeza da IA na resposta. Não é fornecido diretamente pela API da Anthropic — precisa ser **calculado ou estimado**.

**Estratégias para estimar confiança:**

| Estratégia | Como funciona | Custo |
|---|---|---|
| Rank do FTS | Se o score de relevância do documento retornado for baixo, confiança é baixa | $0 |
| Auto-avaliação da IA | Pedir à IA que avalie sua própria confiança (0-100) na resposta gerada | +tokens |
| Número de documentos | Se nenhum doc retornou do FTS, confiança = 0 automaticamente | $0 |
| Combinação ponderada | Peso do rank FTS + auto-avaliação + presença de FAQ match | Baixo |

**Regra de escalada:**

```
Confidence Score ≥ 0.80  →  Resposta exibida ao atendente
Confidence Score 0.50–0.79  →  Resposta exibida com aviso "verificar antes de enviar"
Confidence Score < 0.50  →  Escalada automática para atendente sênior / supervisor
```

#### Fluxo de Escalada

```
Confidence < 0.50
        │
        ▼
Pergunta salva em `perguntas_nao_frequentes` (status: escalada)
        │
        ▼
Notificação no dashboard do supervisor (tempo real)
        │
        ▼
SLA: supervisor tem X minutos para responder
        │
        ├── Respondeu dentro do SLA →  Atendente recebe resposta
        │                              Par é candidato ao FAQ
        │
        └── Não respondeu →  Alerta visual de SLA vencido
                             Escala para próximo nível
```

**SLAs sugeridos (ajustar conforme volume real):**

| Prioridade | Trigger | SLA de Notificação | SLA de Resposta |
|---|---|---|---|
| Alta | Confidence = 0 + cliente VIP | Imediato | 5 min |
| Média | Confidence < 0.50 | 2 min | 15 min |
| Baixa | Confidence 0.50–0.79 | 5 min | 30 min |

---

## 5. Decisões de Design

Estas decisões foram debatidas entre os três modelos e têm justificativa explícita. **Não reverter sem reabrir o debate.**

| Decisão | Escolha | Alternativa Descartada | Motivo |
|---|---|---|---|
| Classificador de intenção | Regex + FTS | LLM classificador | Custo zero, suficiente para 4–6 categorias fixas |
| Matching de FAQ | FTS + trigram | Embeddings via API | 17 endpoints não justificam complexidade; revisitar com 100+ |
| Sanitização de logs | Local, antes da IA | Enviar log bruto | LGPD / contratos B2B — inegociável |
| Embeddings de curadoria | Modelo local leve | API de embeddings | Custo zero em produção, dados não saem do servidor |
| Provider de LLM | A definir (debate Claude Haiku vs Gemini Flash) | Multi-provider misturado | Dois SDKs = dois pontos de falha; decidir por um |
| Histórico de conversa | Memória de sessão (front) | Persistência em banco | Evita custo e vazamento de contexto entre atendentes |
| Confiança da IA | Rank FTS + auto-avaliação | Somente auto-avaliação | Auto-avaliação sozinha é instável; rank FTS é objetivo |

### Debate Aberto: Claude Haiku vs Gemini Flash

Este ponto **não foi fechado** pelos três modelos. Os dados para a decisão:

| | Claude Haiku | Gemini Flash |
|---|---|---|
| Custo input | ~$0.00025/1k tokens | ~$0.000075/1k tokens |
| Custo output | ~$0.00125/1k tokens | ~$0.0003/1k tokens |
| Latência média | ~800ms | ~400ms |
| Manutenção | 1 SDK (já usado) | 2 SDKs |
| Qualidade em PT-BR | Muito boa | Muito boa |

**Recomendação:** Decida com dados reais de volume. Calcule o custo ponderado (70% FAQ + 20% FTS + 8% Diagnóstico + 2% LLM pesado) antes de trocar de provider por economia que pode ser menor que o custo de manutenção de dois stacks.

---

## 6. Métricas de Sucesso

Antes de qualquer código, defina o que significa "funcionando bem". Estas são as métricas que os três modelos identificaram como necessárias — e que **nenhum dos três documentou antes**.

### Métricas Operacionais

| Métrica | Meta | Como medir |
|---|---|---|
| Taxa de resolução no FAQ | ≥ 70% das perguntas | hits_faq / total_perguntas |
| Taxa de resolução no FTS | ≥ 20% do restante | hits_fts / total_sem_faq |
| Taxa de escalada humana | ≤ 5% | escaladas / total |
| Custo médio por consulta | ≤ $0.005 | custo_total / total_consultas |
| Latência total (P95) | ≤ 2 segundos | tempo do Intent Router até resposta |
| Cobertura do FAQ | ≥ 80% dos temas recorrentes | auditoria mensal |

### Métricas de Qualidade

| Métrica | Meta | Como medir |
|---|---|---|
| Satisfação do atendente | ≥ 80% positivos | botão 👍/👎 por resposta |
| Respostas com dados técnicos expostos | 0 | auditoria aleatória semanal |
| Perguntas curadas em < 7 dias | ≥ 90% | dashboard de curadoria |
| Confidence score médio | ≥ 0.80 | média rolling de 7 dias |

### Dashboard Mínimo de Monitoramento

Deve exibir em tempo real:
- Tokens consumidos nas últimas 24h (com breakdown por camada)
- Distribuição de perguntas por camada (FAQ / FTS / Diagnóstico / Escalada)
- Confiança média das últimas 100 respostas
- Fila de curadoria pendente (com SLA visual)
- Alertas de SLA vencido

---

## 7. Roadmap de Fases

```
FASE 0 ──────── FASE 1 ──────── FASE 2 ──────── FASE 3 ──────── FASE 4
(Preparação)   (Triagem)       (Segurança)     (Aprendizado)   (Escala)

1–2 semanas    2–3 semanas     2–3 semanas     3–4 semanas     contínuo

M�tricas       Intent Router   Data Sanitizer  Curadoria       A/B tests
baseline       + FAQ Camada 1  + Diagnóstico   + Clustering    Embeddings
               + Confidence    + LGPD          + Dashboard     pgvector
               Score           compliance      Aprendizado     (se necessário)
```

### Dependências entre fases

```
FASE 0 → FASE 1  (não tem baseline = não tem como validar melhoria)
FASE 1 → FASE 2  (não tem Camada 1 funcionando = diagnóstico não sabe quando acionar)
FASE 2 → FASE 3  (não tem segurança = não pode ir para produção real)
FASE 3 → FASE 4  (não tem dados de uso = não sabe o que otimizar)
```

---

## 8. Checklists por Fase

---

### ✅ FASE 0 — Preparação e Baseline
> **Objetivo:** Medir o estado atual antes de qualquer mudança. Sem baseline, não há como provar que as melhorias funcionaram.
> **Duração estimada:** 1–2 semanas

#### Instrumentação
- [ ] Adicionar logging de tokens consumidos por requisição (entrada + saída)
- [ ] Registrar latência total de cada chamada ao SupportService.ts
- [ ] Registrar qual endpoint foi retornado pelo FTS (e qual foi o rank)
- [ ] Criar tabela `support_metrics` no Supabase para armazenar esses dados
- [ ] Criar view ou query que calcule custo médio por consulta nos últimos 7 dias

#### Baseline (medir por 1 semana antes de mudar qualquer coisa)
- [ ] Calcular custo médio atual por consulta
- [ ] Calcular latência média atual (P50 e P95)
- [ ] Listar as 20 perguntas mais frequentes recebidas pelo suporte
- [ ] Identificar quais dessas 20 têm resposta previsível e repetível (candidatos ao FAQ)
- [ ] Documentar a distribuição atual de temas (% técnico / % financeiro / % onboarding)

#### Categorias de Intenção
- [ ] Definir as categorias finais do Intent Router (sugestão: Financeiro, Técnico, Onboarding, Diagnóstico, Geral)
- [ ] Para cada categoria, listar 10–20 termos/frases gatilho em português
- [ ] Validar as listas com a equipe de atendimento (quem usa o sistema no dia a dia)

#### Validação
- [ ] Baseline documentado e armazenado (referência para comparar nas fases seguintes)
- [ ] Lista de termos do Intent Router validada pela equipe de atendimento
- [ ] Primeiros 20–30 pares de FAQ identificados e rascunhados

---

### ✅ FASE 1 — Triagem Inteligente (Intent Router + FAQ + Confidence)
> **Objetivo:** Resolver 70%+ das perguntas sem chamar o LLM.
> **Duração estimada:** 2–3 semanas
> **Pré-requisito:** Fase 0 concluída

#### Intent Router
- [ ] Implementar função de classificação por regex + FTS (sem LLM)
- [ ] Cobrir as 5 categorias definidas na Fase 0
- [ ] Implementar fallback para categoria "Geral" quando nenhuma categoria casar
- [ ] Testar com as 20 perguntas mais frequentes do baseline — meta: ≥ 85% classificadas corretamente
- [ ] Medir latência do Intent Router isolado (meta: < 50ms)

#### Tabela FAQ Estruturado
- [ ] Criar tabela `faq_estruturado` com campos: id, categoria, pergunta_canonica, resposta_oficial, ativo, criado_em, aprovado_por
- [ ] Adicionar índice FTS + trigram similarity na tabela
- [ ] Popular com os 20–30 pares identificados na Fase 0 (aprovados manualmente)
- [ ] Criar função RPC `buscar_faq(query, categoria, threshold)` que retorna match + score

#### Integração no SupportService.ts
- [ ] Adicionar chamada ao Intent Router antes da busca FTS atual
- [ ] Adicionar chamada ao FAQ antes do motor técnico
- [ ] Implementar lógica de fallback (FAQ → FTS → Escala)
- [ ] Garantir que resposta do FAQ não passa pelo LLM (resposta direta ao atendente)

#### Confidence Score
- [ ] Implementar cálculo de confidence baseado no rank FTS + presença de FAQ match
- [ ] Definir thresholds: ≥ 0.80 responde, 0.50–0.79 avisa atendente, < 0.50 escala
- [ ] Adicionar campo `confidence_score` no log de cada requisição
- [ ] Exibir indicador visual de confiança na interface do atendente

#### Escalada Básica
- [ ] Criar tabela `escaladas` com campos: id, pergunta, categoria, confidence, status, criado_em
- [ ] Implementar registro automático quando confidence < 0.50
- [ ] Criar notificação básica (e-mail ou webhook) para o supervisor quando escalada ocorre

#### Validação da Fase 1
- [ ] Taxa de resolução no FAQ ≥ 50% (meta provisória; 70% com FAQ mais populado)
- [ ] Nenhuma resposta do FAQ passando pelo LLM (confirmar no log de tokens)
- [ ] Latência total ≤ 2s para perguntas resolvidas no FAQ
- [ ] Confidence score sendo calculado e registrado em 100% das requisições
- [ ] Comparar custo médio por consulta com baseline da Fase 0

---

### ✅ FASE 2 — Segurança e Diagnóstico (LGPD + Data Sanitizer)
> **Objetivo:** Habilitar diagnóstico por memorial_id com total conformidade com LGPD.
> **Duração estimada:** 2–3 semanas
> **Pré-requisito:** Fase 1 concluída + Validação jurídica do fluxo de anonimização

#### Antes de codar (obrigatório)
- [ ] Mapear quais campos dos logs contêm dados pessoais (CPF, e-mail, nome, telefone, valores)
- [ ] Documentar quais logs são acessados hoje pelo suporte (sem IA)
- [ ] Validar com responsável legal/DPO da empresa que o fluxo de anonimização é suficiente
- [ ] Confirmar que nenhum dado pessoal real será armazenado fora do servidor próprio

#### Data Sanitizer
- [ ] Implementar função `sanitizeLog(log)` que substitui dados sensíveis por tokens (CPF_REF_001, etc.)
- [ ] Implementar mapa de tokens em memória (token → valor real, só durante a requisição)
- [ ] Cobrir todos os tipos mapeados: CPF, CNPJ, e-mail, telefone, nome, valores monetários
- [ ] Garantir que o mapa de tokens NUNCA é enviado para fora do servidor
- [ ] Implementar limpeza do mapa ao final de cada requisição (sem persistência)
- [ ] Criar suite de testes com logs reais anonimizados para validar a sanitização

#### DiagnosticService
- [ ] Implementar função `diagnosticarPorMemorialId(id)` que busca log pelo ID
- [ ] Integrar o Data Sanitizer obrigatoriamente antes de qualquer envio à IA
- [ ] A IA recebe: log anonimizado + pergunta do atendente
- [ ] A IA devolve: diagnóstico em linguagem natural (usando tokens, ex: "CLIENTE_REF_001 teve erro...")
- [ ] Adicionar o DiagnosticService como Camada 3 no fluxo do SupportService.ts
- [ ] Registrar no log de auditoria: quem acessou qual memorial_id, quando

#### Auditoria de Acesso
- [ ] Criar tabela `auditoria_diagnostico` com campos: atendente_id, memorial_id, timestamp, dados_acessados (categorias, não valores)
- [ ] Todo acesso ao DiagnosticService gera registro nessa tabela
- [ ] Criar relatório mensal de acessos por atendente (para compliance)

#### Validação da Fase 2
- [ ] Executar 10 diagnósticos reais e confirmar: nenhum dado pessoal no payload enviado à IA
- [ ] Confirmar que o mapa de tokens não aparece em nenhum log de requisição
- [ ] Confirmar que a tabela de auditoria está sendo populada corretamente
- [ ] Aprovação do DPO/responsável legal no fluxo implementado

---

### ✅ FASE 3 — Loop de Aprendizado (Curadoria + Dashboard)
> **Objetivo:** Fazer o sistema aprender com cada pergunta não respondida.
> **Duração estimada:** 3–4 semanas
> **Pré-requisito:** Fases 1 e 2 concluídas

#### Tabela de Perguntas Não Frequentes
- [ ] Criar tabela `perguntas_nao_frequentes` com todos os campos definidos na seção 4.3
- [ ] Implementar registro automático sempre que: confidence < 0.50 OU nenhuma camada retornou resultado
- [ ] Implementar campo `resposta_sugerida_ia` (IA gera sugestão, não vai ao atendente automaticamente)
- [ ] Implementar campo `cluster_id` para agrupamento semântico (preenchido depois do clustering)

#### Clustering Semântico
- [ ] Escolher modelo de embedding local leve (ex: sentence-transformers/paraphrase-multilingual)
- [ ] Implementar job noturno que gera embeddings das novas perguntas não frequentes
- [ ] Implementar algoritmo de clustering (DBSCAN recomendado para clusters de tamanho variável)
- [ ] Definir threshold de similaridade (sugestão inicial: 0.82 cosine similarity)
- [ ] Implementar eleição de "pergunta canônica" por cluster (a mais central semanticamente)
- [ ] Associar `cluster_id` a cada pergunta na tabela

#### Dashboard de Curadoria
- [ ] Criar interface com lista de clusters pendentes (não de perguntas individuais)
- [ ] Exibir para cada cluster: pergunta canônica + número de variações + resposta sugerida editável
- [ ] Implementar botão "Aprovar e promover para FAQ" (promove a pergunta canônica)
- [ ] Implementar botão "Descartar" (marca cluster como não-recorrente)
- [ ] Implementar botão "Escalar para técnico" (complexidade que o curador não resolve)
- [ ] Exibir SLA visual: destaque vermelho para clusters com mais de 7 dias sem curadoria
- [ ] Filtro por categoria de intenção

#### Promoção Automática para FAQ
- [ ] Implementar função `promoverParaFAQ(cluster_id, resposta_aprovada)` que:
  - Insere par na tabela `faq_estruturado` com status ativo
  - Marca todas as perguntas do cluster como `status: aprovado`
  - Registra quem aprovou e quando
- [ ] Notificar o atendente que fez a pergunta original (se identificável) que a resposta foi adicionada ao FAQ

#### Validação da Fase 3
- [ ] Simular 50 perguntas sem resposta e confirmar que todas foram para `perguntas_nao_frequentes`
- [ ] Confirmar que o job de clustering roda diariamente e agrupa corretamente
- [ ] Fazer curadoria de 10 clusters no dashboard e confirmar promoção para FAQ
- [ ] Medir: tempo médio de curadoria por cluster (meta: < 2 minutos com sugestão da IA)
- [ ] Confirmar que perguntas promovidas estão sendo resolvidas no FAQ nas requisições seguintes

---

### ✅ FASE 4 — Escala, Otimização e Decisão de Provider
> **Objetivo:** Otimizar custos, avaliar pgvector e fechar debate Haiku vs Gemini Flash.
> **Duração estimada:** Contínua (começar após 4 semanas de dados reais das Fases 1–3)
> **Pré-requisito:** Pelo menos 4 semanas de métricas reais das fases anteriores

#### Análise de Custo Ponderado
- [ ] Calcular distribuição real de perguntas: % FAQ / % FTS / % Diagnóstico / % Escalada
- [ ] Calcular custo real ponderado com os dados coletados
- [ ] Comparar com a meta de $0.005 por consulta
- [ ] Decidir: o custo está dentro da meta? Qual camada está consumindo mais do previsto?

#### Decisão de Provider (Haiku vs Gemini Flash)
- [ ] Calcular custo mensal atual com Claude (tokens reais × preço)
- [ ] Calcular custo mensal projetado com Gemini Flash (mesmos tokens × preço Gemini)
- [ ] Estimar custo de manutenção de dois SDKs (horas de desenvolvimento)
- [ ] Se economia > custo de manutenção: migrar para Gemini Flash
- [ ] Se economia < custo de manutenção: manter Claude Haiku / Sonnet e fechar o debate

#### Embeddings e pgvector (condicional)
- [ ] Avaliar: a taxa de resolução do FAQ está abaixo de 65%?
- [ ] Avaliar: há perguntas ambíguas que FTS + trigram não consegue casar corretamente?
- [ ] Se sim a ambas: implementar pgvector como camada de reranking (mantendo FTS como triagem)
- [ ] Se não: documentar decisão e revisar em 3 meses

#### Cache de Respostas (opcional)
- [ ] Avaliar: há perguntas com resposta idêntica sendo processadas repetidamente?
- [ ] Se sim: implementar cache Redis com TTL de 1h para pares pergunta/hash → resposta
- [ ] Definir política de invalidação (quando o FAQ é atualizado, cache da categoria é limpo)

#### A/B Testing
- [ ] Implementar split de tráfego para testar variações de prompt
- [ ] Comparar confidence score médio entre versões diferentes do system prompt
- [ ] Comparar satisfação do atendente (👍/👎) entre variações

---

## 9. Tensões Abertas

Estes pontos **não foram resolvidos** no debate entre os três modelos. Devem ser revisitados antes da Fase 4.

| Tensão | Posição Claude | Posição GPT | O que fazer |
|---|---|---|---|
| Embeddings no FAQ | Preparar cedo para escala futura | FTS + trigram resolve agora, embeddings depois | Decidir na Fase 4 com dados reais de cobertura |
| Provider de LLM | Manter um provider (manutenção simples) | Gemini Flash é mais barato | Calcular custo ponderado real antes de decidir |
| Confidence Score via auto-avaliação | Instável, usar rank FTS como base | Pode complementar o rank | Implementar híbrido, medir qual tem mais correlação com satisfação |
| Volume de curadoria | Precisa de SLA e clustering desde o início | Dashboard simples resolve inicialmente | Implementar clustering desde a Fase 3 (não esperar o problema existir) |

---

## Glossário

| Termo | Definição |
|---|---|
| RAG | Retrieval-Augmented Generation — técnica de buscar documentos relevantes antes de chamar o LLM |
| FTS | Full-Text Search — busca textual nativa do PostgreSQL usando `tsvector` e `tsquery` |
| Intent Router | Componente que classifica a intenção da pergunta e decide para qual camada rotear |
| FAQ Estruturado | Tabela de pares pergunta/resposta pré-aprovados por humanos |
| Data Sanitizer | Componente que anonimiza dados pessoais antes de enviar logs para processamento externo |
| Confidence Score | Estimativa de certeza da IA na resposta gerada (0 a 1) |
| Clustering Semântico | Agrupamento automático de perguntas similares usando embeddings + algoritmo de clusters |
| Pergunta Canônica | A pergunta representativa de um cluster, escolhida para curadoria |
| SLA | Service Level Agreement — prazo máximo acordado para uma ação (ex: responder escalada em 15 min) |
| DPO | Data Protection Officer — responsável por compliance de dados pessoais (LGPD) |

---

*Documento vivo — atualizar ao final de cada fase com resultados reais e decisões tomadas.*
*Próxima revisão planejada: após conclusão da Fase 1.*

