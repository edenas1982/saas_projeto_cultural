# 📖 Arquitetura de Suporte Inteligente (Bíblia do Sistema)

> **Filosofia Central:** Código faz o trabalho mecânico. IA faz o trabalho intelectual. Banco guarda a verdade.

---

## 1. Contexto e Filosofia de Desenvolvimento

O sistema de documentação e suporte do projeto **Ecos de Memória** foi projetado seguindo princípios Enterprise de baixo custo, alta eficiência e segurança de dados. A documentação técnica é gerada dinamicamente através do pipeline de ingestão e consumida de maneira inteligente pelo serviço de atendimento ao suporte.

### O Fluxo Original de Ingestão de Código
```text
server.ts muda
      ↓
Git Hook (pre-commit)
      ↓
─────────────────────────────────────
CAMADA DETERMINÍSTICA (zero custo)
─────────────────────────────────────
      ↓
git diff → isola só linhas alteradas
      ↓
Regex/AST → extrai estrutura técnica
      ↓
{
  path: "/api/memorial/create",
  method: "POST",
  operacao: "adicionado" | "removido" | "alterado",
  trecho_codigo: "..."
}
      ↓
─────────────────────────────────────
CAMADA IA (custo mínimo e cirúrgico)
─────────────────────────────────────
      ↓
Recebe APENAS o trecho do endpoint
      ↓
Produz descrição + regras de negócio
      ↓
{
  descricao: "Cria memorial debitando créditos",
  requer_auth: true,
  regras_negocio: [
    "valida saldo antes de debitar",
    "ciclo nasce em 1",
    "rollback se banco falhar"
  ],
  schema_entrada: { plano: "string", nome: "string" },
  schema_saida: { memorial_id: "uuid", saldo: "number" }
}
      ↓
─────────────────────────────────────
CAMADA VALIDAÇÃO (zero custo)
─────────────────────────────────────
      ↓
Valida schema do JSON gerado pela IA
Se inválido → rejeita + loga + não bloqueia commit
      ↓
─────────────────────────────────────
CAMADA PERSISTÊNCIA (zero custo)
─────────────────────────────────────
      ↓
      ├── system_endpoints (upsert)
      └── system_endpoint_versions (insert)
```

### O Argumento Central
> *"A IA é cara e falha. Tudo que é mecânico — detectar, extrair, validar, persistir — deve ser código puro. A IA entra em um único momento: quando precisamos transformar código em linguagem humana. Isso reduz o custo operacional em aproximadamente 80% e aumenta a confiabilidade do sistema inteiro."*

### O que Cada um Contribuiu no Baseline
| Contribuição | Origem |
|---|---|
| Camada determinística antes da IA | **Seu insight** |
| Validador entre IA e banco | **GPT** |
| Tabela de versões históricas | **GPT** |
| Estrutura do fluxo em camadas | **GPT + Claude** |
| Política não-bloqueante vs bloqueante | **Claude** |
| IA recebe só o trecho, não o diff inteiro | **Refinamento conjunto** |
| Módulo de suporte consumindo o banco | **GPT** |

---

## 2. Arquitetura RAG com Busca Inteligente (FTS) — Baseline (RAG v1)

Para evitar os custos elevados de enviar toda a base de endpoints em todas as consultas (aproximadamente 40k tokens por chamada), implementamos uma estratégia de **Retrieval-Augmented Generation (RAG)** baseada em **Full-Text Search (FTS)** nativo do PostgreSQL.

### Comparativo: FTS vs. pgvector (Busca Semântica)
Adotamos o **FTS (tsvector)** por sua simplicidade operacional (sem necessidade de API externa de embeddings), custo zero adicional, excelente performance para termos de código específicos e latência de busca inferior a 15ms. A transição para busca híbrida com `pgvector` é uma evolução planejada caso a volumetria supere 100 documentos ou a taxa de fallback ultrapasse 10%.

### Diagrama do Fluxo RAG Atual
```text
[Atendente pergunta] 
       ↓
[SupportService extrai termos técnicos chave]
       ↓
[Executa busca FTS via RPC 'search_endpoints' no Supabase]
       ↓
[Retorna os top 2-3 endpoints mais relevantes]
       ↓
[Sanitiza os documentos (remove IDs, RLS, Tabelas)]
       ↓
[Envia prompt enxuto e sanitizado com a persona 'Sofia' ao Claude]
       ↓
[Resposta didática, acolhedora e comercial enviada ao Atendente]
```

### Diretrizes da Persona 'Sofia'
* **Linguagem:** Clara, empática e comercial. Nunca fria ou excessivamente técnica.
* **Segurança:** Jamais expor nomes de tabelas, IDs internos, comandos SQL ou estrutura do Supabase.
* **Termos técnicos traduzidos:**
  * `GET` -> "Ação de consultar ou visualizar"
  * `POST`/`PUT`/`PATCH` -> "Ação de salvar, enviar ou atualizar"
  * `DELETE` -> "Ação de remover ou excluir"
  * `Schemas` -> "Pré-requisitos e dados necessários"

---

## 3. Visão do Ecossistema Evoluído

O objetivo é transformar o sistema de "leitura de código com IA" em um **Ecossistema de Inteligência Operacional** — onde a IA entende contexto de negócio, aprende com interações e protege dados sensíveis.

### Fluxo Completo da Arquitetura Evoluída
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

## 4. Os 6 Consensos Inegociáveis

Os três modelos (Claude, GPT, Gemini) concordaram em 100% nestes pontos da arquitetura de suporte:

| # | Consenso | Por que é inegociável |
|---|---|---|
| **1** | **FAQ Curado é a camada mais barata** | Resolver no FAQ custa ~$0. Resolver com LLM custa ~$0.003–0.015. A diferença de custo é de 100x. |
| **2** | **FTS para código é melhor que busca burra** | Enviar o JSON completo (40k tokens) quando apenas 2k são relevantes é desperdício de recurso. |
| **3** | **Escalada humana é obrigatória** | Nenhuma IA resolve tudo. Perguntas com baixo score de confiança devem ir para revisão humana. |
| **4** | **Sanitização de dados é inegociável** | LGPD em ambiente B2B é mandatória. Enviar CPFs, e-mails ou logs sem anonimização é um risco legal severo. |
| **5** | **Custo ponderado precisa ser medido** | A meta de $0.005/consulta só é atingida equilibrando as camadas com base no percentual real de hits. |
| **6** | **Aprendizado contínuo é o diferencial** | Perguntas não respondidas devem ser agrupadas e catalogadas para que o sistema evolua semanalmente. |

---

## 5. Pilares da Arquitetura

### 5.1 Hierarquia de Inteligência (Orquestrador)
O objetivo do Orquestrador é rotear cada pergunta para a camada mais econômica capaz de respondê-la de forma correta e segura.

#### Intent Router (Classificador de Intenção)
O classificador **não utiliza LLM**. Funciona por **regex + FTS** a custo zero. Se utilizasse LLM, faríamos duas chamadas de IA desnecessariamente. 
Ele classifica em:
* **Financeiro:** "cobrança", "fatura", "reembolso", "plano", "upgrade", "downgrade".
* **Técnico:** "erro", "bug", "não funciona", "endpoint", "integração".
* **Onboarding:** "como começo", "primeiro acesso", "configurar", "tutorial".
* **Diagnóstico:** "memorial_id", "ID do cliente", "log", "rastrear".
* **Geral:** Categoria de fallback (padrão).

#### Camada 1 — FAQ Estruturado
* **Busca:** Utiliza FTS + similaridade por trigrama (pg_trgm) na tabela `faq_estruturado`.
* **Fluxo:** Se houver match com score acima do threshold estabelecido, retorna a resposta curada instantaneamente, sem passar pela IA.
* **Promoção:** Os registros entram no FAQ apenas após aprovação humana no Dashboard de Curadoria.

#### Camada 2 — Motor Técnico (RAG v1)
* **Busca:** Busca FTS atualizada no `system_endpoints` através do `SupportService.ts`.
* **Fluxo:** Acionado apenas se a Camada 1 não obtiver match confiável.
* **Resultado:** Responde e calcula um *Confidence Score* associado.

---

### 5.2 Diagnóstico com Segurança — O "Detetive"
Permite que o atendente consulte o comportamento de um memorial específico usando `memorial_id` sem expor logs sensíveis à IA externa (cumprimento da LGPD).

#### Data Sanitizer
Antes de qualquer log de auditoria ser enviado ao LLM, ele passa obrigatoriamente por uma limpeza local baseada em Regex. As informações pessoais são convertidas em tokens de referência:

| Tipo | Regex / Pattern | Tokenizado como |
|---|---|---|
| **CPF** | `\d{3}\.?\d{3}\.?\d{3}-?\d{2}` | `CPF_REF_001` |
| **CNPJ** | `\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}` | `CNPJ_REF_001` |
| **E-mail** | `[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}` | `EMAIL_REF_001` |
| **Telefone** | `(\(?\d{2}\)?\s?)(\d{4,5}-?\d{4})` | `TELEFONE_REF_001` |
| **Valores** | `R\$\s?\d+[.,]\d{2}` | `VALOR_REF_001` |
| **Nome** | Entidades nominativas comuns | `CLIENTE_REF_001` |

* O mapa de mapeamento local (ex: `CLIENTE_REF_001` -> "João Silva") é mantido apenas em memória durante o ciclo da requisição, sendo destruído logo em seguida.

#### DiagnosticService (Camada 3)
Busca logs atômicos filtrados por `memorial_id`, executa o `Data Sanitizer` localmente, envia o log limpo para a IA e devolve o diagnóstico técnico traduzido de forma simples ao atendente.

---

### 5.3 Loop de Melhoria Contínua — O "Aprendiz"
Garante que o ecossistema fique mais inteligente de forma autônoma sem necessitar de contínuas alterações de código.

#### Tabela `perguntas_nao_frequentes`
Registra de forma automática toda pergunta onde o *Confidence Score* foi menor que 0.50 ou quando nenhuma camada conseguiu responder.

#### Clustering Semântico
Para evitar que o time humano sofra com gargalos na curadoria revisando variações da mesma pergunta, o sistema executa um agrupamento utilizando embeddings locais leves (ex: Cosine Similarity > 0.82). 
* O curador humano visualiza o cluster através de uma **pergunta canônica** (a mais central do grupo) e aprova a resposta para todas as variações agrupadas simultaneamente.

---

### 5.4 Escalada Humana e SLA
Controla o redirecionamento de fluxos inconclusivos para supervisores técnicos em tempo real.

#### Confidence Score (Híbrido)
Calculado com base em:
1. Relevância (`rank` do FTS).
2. Presença ou ausência de match no FAQ.
3. Auto-avaliação da própria IA (avaliação de consistência).

#### Regra de Direcionamento
* **Confidence ≥ 0.80:** Responde diretamente ao atendente.
* **Confidence 0.50–0.79:** Responde exibindo um alerta ("Verificar dados antes de repassar").
* **Confidence < 0.50:** Registra na tabela `escaladas` e notifica o supervisor.

#### Níveis de SLA de Escalada
| Prioridade | Condição | Tempo para Alerta | Tempo Limite para Resposta |
|---|---|---|---|
| **Alta** | Confiança = 0 + cliente VIP | Imediato | 5 minutos |
| **Média** | Confiança < 0.50 | 2 minutos | 15 minutos |
| **Baixa** | Confiança 0.50–0.79 | 5 minutos | 30 minutos |

---

## 6. Decisões de Design e Tensões

| Decisão | Escolha | Alternativa Descartada | Motivo |
|---|---|---|---|
| **Classificador de Intenção** | Regex + FTS | LLM Classificador | Custo zero, suficiente para 4-6 categorias fixas. |
| **Matching de FAQ** | FTS + Trigram | Embeddings via API | Menor complexidade operacional para a volumetria atual. |
| **Sanitização de Logs** | Local (Regex) antes da IA | Enviar logs brutos | LGPD / Contratos de confidencialidade B2B. |
| **Embeddings de Curadoria** | Modelo local leve | API externa (OpenAI/Anthropic) | Custo zero em produção, dados sensíveis não saem da máquina. |
| **Confiança da IA** | Rank FTS + Auto-avaliação | Apenas auto-avaliação | Auto-avaliação isolada é instável; o FTS fornece base sólida. |

### Debate Aberto: Claude Haiku vs. Gemini Flash
* **Claude Haiku:** Custos de ~$0.00025 (input) / ~$0.00125 (output) por 1k tokens. Utiliza o mesmo SDK já instalado, facilitando a manutenção e reduzindo pontos de falha.
* **Gemini Flash:** Custos mais baixos de ~$0.000075 (input) / ~$0.0003 (output) por 1k tokens. Exige a instalação e suporte a um segundo SDK na stack.
* **Recomendação:** Avaliar o custo ponderado real com o FAQ implementado (onde 70% das chamadas são FAQ custo zero) antes de fragmentar a stack de desenvolvimento.

---

## 7. Métricas de Sucesso e Monitoramento

### Métricas Operacionais
* **FAQ Resolution Rate:** ≥ 70% das perguntas resolvidas sem custo de LLM.
* **FTS Code Resolution Rate:** ≥ 20% das perguntas resolvidas na camada técnica.
* **Taxa de Escalada:** ≤ 5% de transbordo para humanos.
* **Custo Médio por Consulta:** ≤ $0.005 de gastos com IA.
* **Latência P95:** ≤ 2 segundos.

### Dashboard de Monitoramento
Deve expor em tempo real:
1. Tokens consumidos por camada (últimas 24h).
2. Distribuição percentual das chamadas nas 4 camadas.
3. Indicador de SLA de curadoria pendente.
4. Média de satisfação (feedback 👍/👎) do time de suporte.

---

## 8. Estrutura do Banco de Dados e Automação (Schema SQL)

```sql
-- ==============================================================================
-- 1. TABELAS BASE (MÓDULO DE DOCUMENTAÇÃO DE ENDPOINTS)
-- ==============================================================================

-- Tabela principal: Estado atual da verdade técnica do sistema
CREATE TABLE IF NOT EXISTS public.system_endpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    path TEXT NOT NULL,
    method TEXT NOT NULL,
    descricao TEXT,
    requer_auth BOOLEAN DEFAULT true,
    regras_negocio TEXT[],
    schema_entrada JSONB,
    schema_saida JSONB,
    status TEXT DEFAULT 'ativo', -- 'ativo' ou 'deprecated'
    commit_hash TEXT,
    ultima_atualizacao TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(path, method)
);

-- Tabela de histórico (Append-only / Imutável)
CREATE TABLE IF NOT EXISTS public.system_endpoint_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint_id UUID REFERENCES public.system_endpoints(id) ON DELETE CASCADE,
    commit_hash TEXT,
    snapshot JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar Busca por FTS
ALTER TABLE public.system_endpoints ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Trigger para computar tsvector automaticamente
CREATE OR REPLACE FUNCTION public.system_endpoints_update_search_vector()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector := 
    to_tsvector('portuguese',
      coalesce(NEW.path, '') || ' ' ||
      coalesce(NEW.method, '') || ' ' ||
      coalesce(NEW.descricao, '') || ' ' ||
      coalesce(array_to_string(NEW.regras_negocio, ' '), '')
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_system_endpoints_search_vector ON public.system_endpoints;
CREATE TRIGGER trg_system_endpoints_search_vector
BEFORE INSERT OR UPDATE ON public.system_endpoints
FOR EACH ROW EXECUTE FUNCTION public.system_endpoints_update_search_vector();

-- RPC de busca por similaridade ordenada
CREATE OR REPLACE FUNCTION public.search_endpoints(query_text text, match_count int DEFAULT 3)
RETURNS TABLE (
  id uuid, path text, method text, descricao text,
  requer_auth boolean, regras_negocio text[],
  schema_entrada jsonb, schema_saida jsonb, rank real
)
LANGUAGE sql STABLE AS $$
  SELECT 
    id, path, method, descricao, requer_auth, regras_negocio, schema_entrada, schema_saida,
    ts_rank(search_vector, websearch_to_tsquery('portuguese', query_text)) AS rank
  FROM public.system_endpoints
  WHERE search_vector @@ websearch_to_tsquery('portuguese', query_text)
  ORDER BY rank DESC LIMIT match_count;
$$;

-- ==============================================================================
-- 2. NOVAS TABELAS DE EVOLUÇÃO (FAQ E MELHORIA CONTÍNUA)
-- ==============================================================================

-- Camada 1: FAQ Estruturado
CREATE TABLE IF NOT EXISTS public.faq_estruturado (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    categoria TEXT NOT NULL,
    pergunta_canonica TEXT NOT NULL,
    resposta_oficial TEXT NOT NULL,
    ativo BOOLEAN DEFAULT true,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    aprovado_por TEXT
);

CREATE INDEX IF NOT EXISTS idx_faq_categoria ON public.faq_estruturado(categoria);

-- Camada 3: Diagnóstico de Acesso (Auditoria de LGPD)
CREATE TABLE IF NOT EXISTS public.auditoria_diagnostico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    atendente_id UUID NOT NULL,
    memorial_id UUID NOT NULL,
    dados_acessados TEXT[] NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Perguntas Não Frequentes (Fila de Curadoria / Aprendiz)
CREATE TABLE IF NOT EXISTS public.perguntas_nao_frequentes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pergunta_original TEXT NOT NULL,
    sessao_id TEXT,
    categoria_detectada TEXT,
    camadas_tentadas TEXT[],
    status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_revisao', 'aprovado', 'descartado')),
    resposta_sugerida_ia TEXT,
    resposta_oficial TEXT,
    cluster_id UUID,
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    aprovado_em TIMESTAMPTZ
);

-- Tabela de Escaladas (SLA Fila de Atendimento)
CREATE TABLE IF NOT EXISTS public.escaladas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pergunta TEXT NOT NULL,
    categoria TEXT NOT NULL,
    confidence REAL NOT NULL,
    status TEXT DEFAULT 'aberto' CHECK (status IN ('aberto', 'em_atendimento', 'resolvido')),
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 9. GERÊNCIA DE APIS, CUSTOS E TELEMETRIA
-- ==============================================================================
-- As especificações técnicas sobre a tabela `support_metrics`, custos de APIs (Google TTS, ElevenLabs, Claude, Gemini) e
-- validações do backend foram movidas para o núcleo específico em docs/gerencia_api/documento_gerencia_api.md.

---

## 9. Telemetria e Custos de Atendimento (Suporte & Ingestão)

Esta seção especifica como o núcleo de Suporte e Ingestão de Código (Sofia & DevTools) se integra ao motor de custos unificado.

### 9.1 — Chat Sofia (`support_chat`)
*   **Serviço:** `SupportService.ts`
*   **Modelo de IA:** `claude-sonnet-4-6` (primário) | `gemini-1.5-flash` (fallback)
*   **Ações:** Apenas as chamadas que caírem na **Camada 2 (LLM)** registram custos. Consultas respondidas diretamente pelo Intent Router ou FAQ Curado (Camada 1) custam zero e **não geram** registros na telemetria.
*   **Identificadores:** `sessionId` de atendimento deve ser herdado e mapeado como o `operation_id` do log.

#### Exemplo de Integração do Método:
```typescript
async processQuestion(params: {
    pergunta: string;
    funeralHomeId: string;
    userId: string;
    sessionId: string;
}): Promise<{ resposta: string; camadaUsada: 'faq' | 'llm'; confidenceScore: number }> {
    const operationId = params.sessionId;

    // Camada 1: FAQ (custo zero, sem telemetria)
    const faqResult = await this.searchFaq(params.pergunta);
    if (faqResult && faqResult.score >= 0.80) {
        return { resposta: faqResult.resposta, camadaUsada: 'faq', confidenceScore: faqResult.score };
    }

    // Camada 2: LLM (custo real, registra telemetria)
    const startTime = Date.now();
    const provider  = 'anthropic';
    const model     = 'claude-sonnet-4-6';

    try {
        const response = await this.anthropic.messages.create({
            model,
            max_tokens: 1024,
            system: this.buildSofiaSystemPrompt(),
            messages: [{ role: 'user', content: params.pergunta }],
        });

        const latencyMs    = Date.now() - startTime;
        const tokensInput  = response.usage.input_tokens;
        const tokensOutput = response.usage.output_tokens;
        const resposta     = response.content[0].type === 'text' ? response.content[0].text : '';

        // Registrar consumo no TelemetryService
        await this.telemetry.registerApiUsage({
            provider,
            model,
            feature:       'support_chat',
            operationId,
            funeralHomeId: params.funeralHomeId,
            userId:        params.userId,
            tokensInput,
            tokensOutput,
            latencyMs,
            status:        'success',
            metadata: {
                session_id:       params.sessionId,
                faq_score_before: faqResult?.score ?? 0
            }
        });

        return { resposta, camadaUsada: 'llm', confidenceScore: 1.0 };
    } catch (error: any) {
        const latencyMs = Date.now() - startTime;
        await this.telemetry.registerApiUsage({
            provider,
            model,
            feature:       'support_chat',
            operationId,
            funeralHomeId: params.funeralHomeId,
            userId:        params.userId,
            latencyMs,
            status:        'error',
            errorMessage:  error.message || 'unknown'
        }).catch(e => console.error('[SupportService] Falha de telemetria', e));
        throw error;
    }
}
```

---

### 9.2 — Pipeline de Autodocumentação (`dev_tools`)
*   **Serviço:** `IngestionService.ts` / `DocumentationService.ts`
*   **Modelo de IA:** `claude-haiku-4-5` (para economia em dev_tools)
*   **Ações:** Registrar o processamento do Claude a cada endpoint analisado e documentado pelo pipeline local.
*   **Identificadores:** `funeralHomeId` e `memorialId` devem ser preenchidos como `null` / `undefined`, pois configuram despesa interna operacional do sistema (desenvolvimento).

#### Exemplo de Integração do Método:
```typescript
async processEndpoint(params: {
    endpointPath: string;
    codeSnippet: string;
    userId: string;
}): Promise<void> {
    const operationId = createOperationId();
    const startTime   = Date.now();
    const estrutura   = this.extractStructureFromAst(params.codeSnippet); // AST local (custo zero)

    try {
        const response = await this.anthropic.messages.create({
            model:      'claude-haiku-4-5',
            max_tokens: 512,
            messages:   [{ role: 'user', content: `Documente este endpoint: ${JSON.stringify(estrutura)}` }],
        });

        const latencyMs    = Date.now() - startTime;
        const tokensInput  = response.usage.input_tokens;
        const tokensOutput = response.usage.output_tokens;

        // Registrar consumo no TelemetryService
        await this.telemetry.registerApiUsage({
            provider:      'anthropic',
            model:         'claude-haiku-4-5',
            feature:       'dev_tools',
            operationId,
            userId:        params.userId,
            tokensInput,
            tokensOutput,
            latencyMs,
            status:        'success',
            metadata: {
                endpoint_path: params.endpointPath,
                pipeline_stage: 'documentation'
            }
        });

        await this.persistDocumentation(params.endpointPath, response.content[0].text);
    } catch (error: any) {
        const latencyMs = Date.now() - startTime;
        await this.telemetry.registerApiUsage({
            provider:      'anthropic',
            model:         'claude-haiku-4-5',
            feature:       'dev_tools',
            operationId,
            userId:        params.userId,
            latencyMs,
            status:        'error',
            errorMessage:  error.message || 'unknown',
            metadata: { endpoint_path: params.endpointPath }
        }).catch(e => console.error('[IngestionService] Falha de telemetria', e));
        // Pipeline de documentação falha silenciosamente (não bloqueante)
    }
}
```


```