# 📖 Documentação de Gerência de APIs, Custos e Telemetria

> **Filosofia Central:** O controle de custos de infraestrutura é vital para a saúde do SaaS B2B. Cada token de texto e caractere de áudio consumido deve ser auditável e precificado.

---

## 1. Visão Geral da Telemetria de APIs

Para monitorar os custos com Inteligência Artificial (LLMs e TTS), o sistema de **Ecos de Memória** coleta e persiste dados de consumo de rede e APIs em uma tabela centralizada no Supabase chamada `support_metrics`.

Esta telemetria serve como um cockpit financeiro, permitindo que a administração da plataforma analise a margem de cada plano de assinatura B2B frente aos custos de consumo reais.

### A Estrutura da Tabela `support_metrics`

```sql
CREATE TABLE IF NOT EXISTS public.support_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pergunta TEXT NOT NULL,                -- Identificador (ex: narrativa_id) ou a pergunta do chat
    categoria TEXT DEFAULT 'Geral',        -- Categoria (ex: 'AudioGeneration', 'Support')
    tokens_input INTEGER,                  -- Quantidade de entrada (tokens ou caracteres)
    tokens_output INTEGER,                 -- Quantidade de saída (tokens ou segundos)
    tokens_total INTEGER,                  -- Soma de input e output
    latencia_ms INTEGER,                   -- Tempo de resposta da requisição em milissegundos
    endpoint_retornado TEXT,               -- Modelo de IA ou voz utilizada
    fts_rank REAL,                         -- Nível de plano (1=básico, 2=premium, 3=enterprise) ou relevância
    criado_em TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 2. Governança e Regras de Negócio de Consumo

### 2.1 — O Backend como "Juiz" (Segurança e Autorização)
Toda a lógica de autorização e segurança do consumo de APIs ocorre exclusivamente no backend (Node.js/Express). 

* **Princípio da Validação Estrita (Zero Confiança no Client)**:
  * A rota `/api/narrativas/audio` recebe o ID da narrativa e a voz solicitada.
  * O backend consulta o plano ativo do memorial associado e extrai a permissão `audio_tier` (`basic` | `premium` | `enterprise`).
  * O backend valida se a voz solicitada é compatível com o `audio_tier` permitido.
  * Se houver tentativa de burla via chamada direta à API (ex: solicitando ElevenLabs em plano básico), a transação é **abortada** imediatamente com `HTTP 403 Forbidden` ou `HTTP 400 Bad Request`, impedindo custos não autorizados.

### 2.2 — Fluxo de Registro de Transação de Áudio
1. Requisição recebida $\to$ `/api/narrativas/audio`
2. Validação do `audio_tier` no backend $\to$ Aprovado
3. Chamada à API TTS (Google Cloud ou ElevenLabs) $\to$ Retorno com sucesso
4. O `VoiceGovernanceService` invoca o `TelemetryService` para registrar a transação no `support_metrics`:
   * `pergunta`: `narrativa_id`
   * `categoria`: `'AudioGeneration'`
   * `tokens_input`: Caracteres de texto enviados para síntese
   * `tokens_output`: `1` (indicando evento gerado com sucesso)
   * `latencia_ms`: Latência total do TTS
   * `endpoint_retornado`: Nome da voz (ex: `pt-BR-Journey-F`)
   * `fts_rank`: Nível numérico do plano (1, 2 ou 3)
5. Arquivo MP3 salvo e URL gravada no banco $\to$ Retorno HTTP 200 ao cliente.

---

## 3. Estudo de Precificação de APIs (Fase 0)

Para transformar as métricas de quantidade bruta (tokens e caracteres) em dados financeiros reais ($), foi feito o seguinte mapeamento de custos de infraestrutura:

### 3.1 — Tabela de Provedores e Custos Referenciais

| Provedor / API | Modelo ou Voz | Custo de Entrada (Input) | Custo de Saída (Output) | Unidade de Medida |
| :--- | :--- | :--- | :--- | :--- |
| **Anthropic** | Claude 3.5 Sonnet | $\$0.003$ | $\$0.015$ | por $1.000$ tokens |
| **Anthropic** | Claude 3 Haiku | $\$0.00025$ | $\$0.00125$ | por $1.000$ tokens |
| **Google Cloud IA** | Gemini 1.5 Flash | $\$0.000075$ | $\$0.0003$ | por $1.000$ tokens |
| **Google Cloud TTS** | Standard (Vozes A/B) | $\$0.000004$ | — | por caractere ($\$4.00$/M) |
| **Google Cloud TTS** | Wavenet / Journey | $\$0.000016$ | — | por caractere ($\$16.00$/M) |
| **ElevenLabs** | Vozes HD / Alice | $\$0.00018$ | — | por caractere (média) |

### 3.2 — Estratégias Técnicas de Implementação do Cálculo de Custos

Para computar o custo ponderado médio nas consultas de suporte e geração de mídia, avalia-se três estratégias:

#### Opção A: Regras Dinâmicas via Banco de Dados (Recomendada)
Criar uma tabela `api_pricing_catalog` no Supabase e associá-la à `support_metrics` através de uma View SQL.
*   **Fórmula da View:** 
    $$\text{custo} = (\text{tokens\_input} \times \text{preco\_unitario\_input}) + (\text{tokens\_output} \times \text{preco\_unitario\_output})$$
*   **Decisão de Design:** Permite que qualquer alteração contratual de preços das APIs seja atualizada diretamente na tabela, recalculando de forma transparente todo o histórico financeiro da plataforma sem alterar código.

#### Opção B: Cálculo Estático via View SQL com `CASE WHEN`
Criar uma View SQL com os preços descritos na tabela acima diretamente injetados em um bloco condicional `CASE WHEN` com base no `endpoint_retornado`.
*   **Decisão de Design:** Mais rápida de implementar na Fase 0, porém rígida (exige nova migration se os preços de mercado mudarem).

#### Opção C: Gravação de Custos no Backend
Calcular o custo estimado diretamente no Node.js durante a execução e persistir na coluna `custo` da tabela de métricas.
*   **Decisão de Design:** Congela o custo real do dia do log, mas dificulta recálculos em lote em caso de ajustes posteriores.

---

## 4. Reestruturação da Governança Financeira de APIs (Fase 0 Evoluída)

Esta seção documenta a arquitetura de banco de dados e os serviços centrais que compõem a fundação do motor de custos do ecossistema, baseando-se na **Opção A (Regras Dinâmicas via Banco de Dados)** de forma extensiva.

### 4.1 — Catálogos de Referência (Extensibilidade)

#### Tabela: `provider_catalog`
Lista todos os provedores externos cadastrados na plataforma:
```sql
CREATE TABLE IF NOT EXISTS public.provider_catalog (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        TEXT NOT NULL UNIQUE,       -- 'anthropic' | 'google' | 'elevenlabs'
    name        TEXT NOT NULL,              -- Nome: 'Anthropic', 'Google Cloud'
    ativo       BOOLEAN NOT NULL DEFAULT true,
    descricao   TEXT,
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.provider_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "provider_catalog_read" ON public.provider_catalog FOR SELECT USING (true);
CREATE POLICY "provider_catalog_write" ON public.provider_catalog FOR ALL USING (auth.role() = 'service_role');
```

#### Tabela: `feature_catalog`
Lista as funcionalidades ativas do sistema que geram consumo:
```sql
CREATE TABLE IF NOT EXISTS public.feature_catalog (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        TEXT NOT NULL UNIQUE,       -- 'memorial_text' | 'memorial_audio' | 'support_chat' | 'dev_tools'
    name        TEXT NOT NULL,
    ativo       BOOLEAN NOT NULL DEFAULT true,
    descricao   TEXT,
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.feature_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feature_catalog_read" ON public.feature_catalog FOR SELECT USING (true);
CREATE POLICY "feature_catalog_write" ON public.feature_catalog FOR ALL USING (auth.role() = 'service_role');
```

#### Tabela: `api_pricing_catalog`
Registra o preço unitário de cada modelo de IA de forma dinâmica e histórica:
```sql
CREATE TABLE IF NOT EXISTS public.api_pricing_catalog (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id         UUID NOT NULL REFERENCES public.provider_catalog(id),
    model_name          TEXT NOT NULL,           -- 'claude-sonnet-4-6', 'pt-BR-Journey-F'
    pricing_type        TEXT NOT NULL,           -- 'tokens' | 'characters' | 'seconds'
    input_unit_cost     NUMERIC(12, 8) NOT NULL, -- custo por unidade de input
    output_unit_cost    NUMERIC(12, 8),          -- custo de output (nulo para TTS)
    unit_label          TEXT NOT NULL,           -- 'per_token' | 'per_character'
    effective_from      DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to        DATE,                    -- NULL = vigente hoje
    ativo               BOOLEAN NOT NULL DEFAULT true,
    criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pricing_model_unique UNIQUE (provider_id, model_name, effective_from)
);

ALTER TABLE public.api_pricing_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pricing_catalog_read" ON public.api_pricing_catalog FOR SELECT USING (true);
CREATE POLICY "pricing_catalog_write" ON public.api_pricing_catalog FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_pricing_active ON public.api_pricing_catalog (provider_id, model_name, effective_from) WHERE ativo = true;
```

---

### 4.2 — Tabela Principal de Eventos: `api_usage_events`

Esta tabela substitui o log técnico legado de `support_metrics`, consolidando a trilha financeira de toda a plataforma:
```sql
CREATE TABLE IF NOT EXISTS public.api_usage_events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id         UUID NOT NULL REFERENCES public.provider_catalog(id),
    feature_id          UUID NOT NULL REFERENCES public.feature_catalog(id),
    model_name          TEXT NOT NULL,
    operation_id        UUID NOT NULL,                                 -- Agrupador da ação do usuário
    funeral_home_id     UUID REFERENCES public.funeral_homes(id),      -- Centro de custo: Funerária (B2B)
    memorial_id         UUID REFERENCES public.memoriais(id),          -- Centro de custo: Memorial
    user_id             UUID REFERENCES auth.users(id),
    tokens_input        INTEGER,
    tokens_output       INTEGER,
    characters_input    INTEGER,
    latency_ms          INTEGER,
    unit_cost_at_time   NUMERIC(12, 8) NOT NULL,                       -- Congelado na inserção
    total_cost_usd      NUMERIC(10, 6) NOT NULL,                       -- Custo calculado congelado
    status              TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error', 'cached', 'aborted')),
    error_message       TEXT,
    metadata            JSONB,
    criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.api_usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usage_events_insert_service" ON public.api_usage_events FOR INSERT WITH CHECK (auth.role() = 'service_role');
-- Funerárias lêem apenas seus logs
CREATE POLICY "usage_events_own_funeral_home" ON public.api_usage_events FOR SELECT USING (
    funeral_home_id IN (SELECT funeral_home_id FROM public.funeral_home_users WHERE user_id = auth.uid()) 
    OR funeral_home_id IS NULL
);
```

---

### 4.3 — Camada de Serviço Central: `TelemetryService`

Localizada em `/src/services/telemetry/TelemetryService.ts`, ela é responsável por consultar os preços vigentes dos catálogos, processar a precificação de entrada e saída (tokens ou caracteres) e gravar com segurança o log financeiro congelado no banco.

#### Contrato de Gravação
```typescript
export interface RegisterApiUsageParams {
    provider: 'anthropic' | 'google' | 'elevenlabs';
    model: string;
    feature: 'memorial_text' | 'memorial_audio' | 'support_chat' | 'dev_tools';
    operationId: string;
    funeralHomeId?: string;
    memorialId?: string;
    userId: string;
    tokensInput?: number;
    tokensOutput?: number;
    charactersInput?: number;
    latencyMs: number;
    status: 'success' | 'error' | 'cached' | 'aborted';
    errorMessage?: string;
    metadata?: Record<string, unknown>;
}
```

---

### 4.4 — Views SQL de Relatório Financeiro (Cockpit Administrativo)

#### Custo Acumulado por Memorial:
```sql
CREATE OR REPLACE VIEW public.vw_custo_por_memorial AS
SELECT
    e.memorial_id,
    m.nome_homenageado,
    e.funeral_home_id,
    fc.name                          AS feature,
    pc.name                          AS provider,
    COUNT(*)                         AS total_eventos,
    SUM(e.total_cost_usd)            AS custo_total_usd,
    MIN(e.criado_em)                 AS primeiro_evento,
    MAX(e.criado_em)                 AS ultimo_evento
FROM public.api_usage_events e
JOIN public.feature_catalog  fc ON fc.id = e.feature_id
JOIN public.provider_catalog pc ON pc.id = e.provider_id
LEFT JOIN public.memoriais    m  ON m.id  = e.memorial_id
WHERE e.status = 'success' AND e.memorial_id IS NOT NULL
GROUP BY e.memorial_id, m.nome_homenageado, e.funeral_home_id, fc.name, pc.name;
```

#### Custo por Funerária por Mês:
```sql
CREATE OR REPLACE VIEW public.vw_custo_por_funeraria_mes AS
SELECT
    e.funeral_home_id,
    fh.nome                          AS funeraria,
    DATE_TRUNC('month', e.criado_em) AS mes,
    fc.name                          AS feature,
    SUM(e.total_cost_usd)            AS custo_total_usd,
    COUNT(DISTINCT e.memorial_id)    AS memoriais_ativos,
    COUNT(*)                         AS total_chamadas
FROM public.api_usage_events e
JOIN public.feature_catalog  fc ON fc.id  = e.feature_id
LEFT JOIN public.funeral_homes fh ON fh.id = e.funeral_home_id
WHERE e.status = 'success' AND e.funeral_home_id IS NOT NULL
GROUP BY e.funeral_home_id, fh.nome, DATE_TRUNC('month', e.criado_em), fc.name;
```

