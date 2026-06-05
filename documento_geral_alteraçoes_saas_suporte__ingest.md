# Fase 0 — Governança Financeira de APIs
## Ecos de Memórias — Documento Executável de Implementação

> **Status:** Pronto para execução  
> **Escopo:** SaaS B2B — `/src/pages/saas` e `/src/services/`  
> **Frente:** SaaS B2B (não toca Projeto Cultural)  
> **Atualizar ao concluir cada fase:** `/docs/saas/progresso_camada1.md`

---

## ANTES DE COMEÇAR — LEITURA OBRIGATÓRIA DO AGENTE

Este documento é o guia completo de implementação da camada de observabilidade financeira. Antes de escrever qualquer linha de código, o agente deve confirmar internamente os sete pontos do MASTER_AGENT:

1. Frente ativa: **SaaS B2B**. Nenhuma alteração toca `/src/pages/projeto-cultural`.
2. Nenhuma chave de API, nenhuma tabela de custos, nenhum cálculo financeiro vai para o frontend.
3. Toda lógica de negócio reside em **Classes de Serviço** com injeção de dependência.
4. RLS ativo em todas as tabelas. Funerária A nunca vê dados de Funerária B.
5. Transações financeiras seguem o padrão **Saga**: Validação → Execução → Auditoria → Rollback.
6. Todo endpoint novo recebe bloco JSDoc com `@description`, `@entity`, `@rules`, `@audit`.
7. Ao finalizar cada fase, atualizar `/docs/saas/progresso_camada1.md`.

---

## VISÃO GERAL DA ARQUITETURA

```
┌─────────────────────────────────────────────────────────────┐
│                    NÚCLEO: GERÊNCIA DE API                   │
│  provider_catalog + feature_catalog + api_pricing_catalog    │
│              + api_usage_events + registerApiUsage()         │
└──────────────────────┬──────────────────────────────────────┘
                       │ chamado por
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  NÚCLEO SAAS │ │   NÚCLEO     │ │   NÚCLEO     │
│  Text+Audio  │ │   SUPORTE    │ │   INGESTÃO   │
│NarrativaServ.│ │SupportService│ │IngestionServ.│
│TimelineServ. │ │SofiaService  │ │DocService    │
└──────────────┘ └──────────────┘ └──────────────┘
```

**Princípio central:** Nenhum serviço toca `api_pricing_catalog` diretamente. Todos chamam `registerApiUsage()`. Essa função é a única responsável por consultar preço, calcular custo e gravar o evento.

---

## ROTEIRO GERAL DE TRABALHO

```
Fase 0.1 — Criar catálogos no Supabase
Fase 0.2 — Criar tabela api_usage_events
Fase 0.3 — Criar função registerApiUsage() no backend
Fase 0.4 — Instrumentar Núcleo SaaS (Texto)
Fase 0.5 — Instrumentar Núcleo SaaS (Áudio)
Fase 0.6 — Instrumentar Núcleo Suporte
Fase 0.7 — Instrumentar Núcleo Ingestão
Fase 0.8 — Criar Views de relatório financeiro
Fase 0.9 — Validação e checklist de cobertura
```

Cada fase tem: contexto, schema/código completo, checklist de conclusão e o que atualizar no `progresso_camada1.md`.

---

---

# FASE 0.1 — CATÁLOGOS DE REFERÊNCIA

**Contexto:** Antes de qualquer tabela de eventos, os catálogos precisam existir. São eles que tornam o sistema extensível: novos provedores, novas features e novos preços são cadastrados aqui sem alterar código.

---

## Tabela: `provider_catalog`

Lista todos os provedores externos que geram custo. Quando um novo provedor for integrado (ex: OpenAI, Deepgram), basta inserir uma linha aqui.

```sql
-- EXECUTAR NO SUPABASE SQL EDITOR
CREATE TABLE IF NOT EXISTS public.provider_catalog (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        TEXT NOT NULL UNIQUE,       -- 'anthropic' | 'google' | 'elevenlabs'
    name        TEXT NOT NULL,              -- Nome de exibição: 'Anthropic', 'Google Cloud'
    ativo       BOOLEAN NOT NULL DEFAULT true,
    descricao   TEXT,
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.provider_catalog ENABLE ROW LEVEL SECURITY;

-- Leitura: backend autenticado pode ler (service role)
CREATE POLICY "provider_catalog_read" ON public.provider_catalog
    FOR SELECT USING (true); -- tabela de configuração, sem dados sensíveis

-- Escrita: apenas service role (nunca o frontend)
CREATE POLICY "provider_catalog_write" ON public.provider_catalog
    FOR ALL USING (auth.role() = 'service_role');

-- Dados iniciais
INSERT INTO public.provider_catalog (code, name, descricao) VALUES
    ('anthropic',  'Anthropic',         'LLM Claude — geração de texto e suporte'),
    ('google',     'Google Cloud',      'TTS Journey/Wavenet + Gemini Flash'),
    ('elevenlabs', 'ElevenLabs',        'TTS HD para plano enterprise')
ON CONFLICT (code) DO NOTHING;
```

---

## Tabela: `feature_catalog`

Lista todas as funcionalidades do sistema que geram consumo. Quando uma nova feature for criada (ex: MemorialVideo, OCR, WhatsAppAssistant), basta inserir aqui.

```sql
CREATE TABLE IF NOT EXISTS public.feature_catalog (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    ativo       BOOLEAN NOT NULL DEFAULT true,
    descricao   TEXT,
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.feature_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feature_catalog_read" ON public.feature_catalog
    FOR SELECT USING (true);

CREATE POLICY "feature_catalog_write" ON public.feature_catalog
    FOR ALL USING (auth.role() = 'service_role');

-- Dados iniciais — os 4 núcleos obrigatórios da Fase 0
INSERT INTO public.feature_catalog (code, name, descricao) VALUES
    ('memorial_text',  'Memorial Text',  'Geração de narrativa biográfica via LLM'),
    ('memorial_audio', 'Memorial Audio', 'Geração de áudio TTS da narrativa'),
    ('support_chat',   'Support Chat',   'Atendimento inteligente Sofia via LLM'),
    ('dev_tools',      'Dev Tools',      'Ingestão técnica, documentação automática, IA interna')
ON CONFLICT (code) DO NOTHING;
```

---

## Tabela: `api_pricing_catalog`

Registra o preço de cada modelo de cada provedor com suporte a histórico. `effective_to = NULL` significa "vigente agora".

```sql
CREATE TABLE IF NOT EXISTS public.api_pricing_catalog (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id         UUID NOT NULL REFERENCES public.provider_catalog(id),
    model_name          TEXT NOT NULL,           -- 'claude-sonnet-4-6', 'pt-BR-Journey-F'
    pricing_type        TEXT NOT NULL,           -- 'tokens' | 'characters' | 'seconds'
    input_unit_cost     NUMERIC(12, 8) NOT NULL, -- custo por unidade de input
    output_unit_cost    NUMERIC(12, 8),          -- NULL para TTS (sem output diferenciado)
    unit_label          TEXT NOT NULL,           -- 'per_1k_tokens' | 'per_character'
    effective_from      DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to        DATE,                    -- NULL = vigente hoje
    ativo               BOOLEAN NOT NULL DEFAULT true,
    criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT pricing_model_unique UNIQUE (provider_id, model_name, effective_from)
);

ALTER TABLE public.api_pricing_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pricing_catalog_read" ON public.api_pricing_catalog
    FOR SELECT USING (true);

CREATE POLICY "pricing_catalog_write" ON public.api_pricing_catalog
    FOR ALL USING (auth.role() = 'service_role');

-- Índice para query de preço vigente
CREATE INDEX idx_pricing_active ON public.api_pricing_catalog
    (provider_id, model_name, effective_from)
    WHERE ativo = true;
```

### Inserir preços iniciais

```sql
-- Primeiro busca os IDs dos provedores
WITH providers AS (
    SELECT id, code FROM public.provider_catalog
)
INSERT INTO public.api_pricing_catalog
    (provider_id, model_name, pricing_type, input_unit_cost, output_unit_cost, unit_label)
VALUES
    -- Anthropic
    ((SELECT id FROM providers WHERE code = 'anthropic'),
     'claude-sonnet-4-6', 'tokens', 0.00000300, 0.00001500, 'per_token'),

    ((SELECT id FROM providers WHERE code = 'anthropic'),
     'claude-haiku-4-5',  'tokens', 0.00000025, 0.00000125, 'per_token'),

    -- Google — Gemini
    ((SELECT id FROM providers WHERE code = 'google'),
     'gemini-1.5-flash',  'tokens', 0.000000075, 0.0000003, 'per_token'),

    -- Google TTS
    ((SELECT id FROM providers WHERE code = 'google'),
     'pt-BR-Wavenet-A',   'characters', 0.000016, NULL, 'per_character'),

    ((SELECT id FROM providers WHERE code = 'google'),
     'pt-BR-Wavenet-B',   'characters', 0.000016, NULL, 'per_character'),

    ((SELECT id FROM providers WHERE code = 'google'),
     'pt-BR-Journey-F',   'characters', 0.000016, NULL, 'per_character'),

    ((SELECT id FROM providers WHERE code = 'google'),
     'pt-BR-Journey-D',   'characters', 0.000016, NULL, 'per_character'),

    -- ElevenLabs
    ((SELECT id FROM providers WHERE code = 'elevenlabs'),
     'elevenlabs-alice',  'characters', 0.00018, NULL, 'per_character'),

    ((SELECT id FROM providers WHERE code = 'elevenlabs'),
     'elevenlabs-marcus', 'characters', 0.00018, NULL, 'per_character'),

    ((SELECT id FROM providers WHERE code = 'elevenlabs'),
     'elevenlabs-sarah',  'characters', 0.00018, NULL, 'per_character')

ON CONFLICT (provider_id, model_name, effective_from) DO NOTHING;
```

### Checklist Fase 0.1

```
[ ] provider_catalog criada e populada (3 provedores)
[ ] feature_catalog criada e populada (4 features)
[ ] api_pricing_catalog criada e populada (10 modelos)
[ ] RLS ativo nas 3 tabelas
[ ] Índice de preço vigente criado
[ ] Testado: SELECT * FROM api_pricing_catalog WHERE effective_to IS NULL retorna todos os preços atuais
[ ] progresso_camada1.md atualizado: "Fase 0.1 — Catálogos criados ✅"
```

---

---

# FASE 0.2 — TABELA api_usage_events

**Contexto:** Esta é a fonte oficial de verdade financeira do sistema. Toda saída de dinheiro — cada chamada ao Claude, cada síntese de áudio, cada consulta ao Gemini — gera exatamente um registro aqui.

```sql
CREATE TABLE IF NOT EXISTS public.api_usage_events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- CLASSIFICAÇÃO FINANCEIRA (obrigatória)
    provider_id         UUID NOT NULL REFERENCES public.provider_catalog(id),
    feature_id          UUID NOT NULL REFERENCES public.feature_catalog(id),
    model_name          TEXT NOT NULL,

    -- RASTREABILIDADE (centro de custo)
    operation_id        UUID NOT NULL,       -- agrupa todas as chamadas de uma ação do usuário
    funeral_home_id     UUID REFERENCES public.funeral_homes(id),  -- NULL para dev_tools
    memorial_id         UUID REFERENCES public.memoriais(id),       -- NULL para suporte/dev
    user_id             UUID REFERENCES auth.users(id),

    -- CONSUMO TÉCNICO
    tokens_input        INTEGER,             -- para LLMs
    tokens_output       INTEGER,             -- para LLMs
    characters_input    INTEGER,             -- para TTS
    latency_ms          INTEGER,

    -- CUSTO FINANCEIRO (congelado no momento da chamada)
    unit_cost_at_time   NUMERIC(12, 8) NOT NULL,  -- preço unitário vigente no momento
    total_cost_usd      NUMERIC(10, 6) NOT NULL,  -- custo total calculado e congelado

    -- STATUS E AUDITORIA
    status              TEXT NOT NULL DEFAULT 'success'
                        CHECK (status IN ('success', 'error', 'cached', 'aborted')),
    error_message       TEXT,               -- preenchido quando status = 'error'
    metadata            JSONB,              -- dados extras sem schema fixo

    criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: funerária só vê seus próprios eventos
ALTER TABLE public.api_usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usage_events_own_funeral_home" ON public.api_usage_events
    FOR SELECT USING (
        funeral_home_id IN (
            SELECT funeral_home_id FROM public.funeral_home_users
            WHERE user_id = auth.uid()
        )
        OR funeral_home_id IS NULL -- dev_tools visível apenas para admins
    );

-- Inserção: apenas service role (backend)
CREATE POLICY "usage_events_insert_service" ON public.api_usage_events
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Índices para relatórios financeiros
CREATE INDEX idx_usage_memorial    ON public.api_usage_events (memorial_id)    WHERE memorial_id IS NOT NULL;
CREATE INDEX idx_usage_funeral     ON public.api_usage_events (funeral_home_id) WHERE funeral_home_id IS NOT NULL;
CREATE INDEX idx_usage_operation   ON public.api_usage_events (operation_id);
CREATE INDEX idx_usage_feature     ON public.api_usage_events (feature_id);
CREATE INDEX idx_usage_criado_em   ON public.api_usage_events (criado_em DESC);
CREATE INDEX idx_usage_status      ON public.api_usage_events (status);
```

### Checklist Fase 0.2

```
[ ] Tabela api_usage_events criada
[ ] RLS ativo com política por funeral_home_id
[ ] Política de INSERT restrita ao service role
[ ] 6 índices criados
[ ] Testado: INSERT manual de evento de teste e SELECT retorna corretamente
[ ] support_metrics mantida intacta como log técnico legado
[ ] progresso_camada1.md atualizado: "Fase 0.2 — Tabela api_usage_events criada ✅"
```

---

---

# FASE 0.3 — FUNÇÃO CENTRAL: registerApiUsage()

**Contexto:** Esta é a única função do sistema que pode gravar em `api_usage_events`. Nenhum service a contorna. Ela é responsável por consultar o preço vigente, calcular o custo total, congelar os valores e gravar o evento. É injetada como dependência via `TelemetryService`.

**Localização:** `/src/services/telemetry/TelemetryService.ts`

---

## Interface de Entrada

```typescript
// /src/services/telemetry/types.ts

export type ApiProvider = 'anthropic' | 'google' | 'elevenlabs';
export type FeatureCategory = 'memorial_text' | 'memorial_audio' | 'support_chat' | 'dev_tools';
export type UsageStatus = 'success' | 'error' | 'cached' | 'aborted';

export interface RegisterApiUsageParams {
    // Classificação obrigatória
    provider: ApiProvider;
    model: string;             // ex: 'claude-sonnet-4-6', 'pt-BR-Journey-F'
    feature: FeatureCategory;

    // Centro de custo
    operationId: string;       // UUID gerado no início da ação do usuário
    funeralHomeId?: string;    // obrigatório exceto para dev_tools
    memorialId?: string;       // obrigatório para memorial_text e memorial_audio
    userId: string;

    // Consumo
    tokensInput?: number;
    tokensOutput?: number;
    charactersInput?: number;
    latencyMs: number;

    // Status
    status: UsageStatus;
    errorMessage?: string;
    metadata?: Record<string, unknown>;
}

export interface RegisterApiUsageResult {
    eventId: string;
    totalCostUsd: number;
}
```

---

## Implementação do TelemetryService

```typescript
// /src/services/telemetry/TelemetryService.ts

import { createClient } from '@supabase/supabase-js';
import { RegisterApiUsageParams, RegisterApiUsageResult } from './types';

/**
 * @description Serviço central de telemetria financeira.
 * Toda chamada externa que gera custo deve passar por este serviço.
 * Nenhum outro service acessa api_pricing_catalog diretamente.
 */
export class TelemetryService {
    constructor(private readonly supabaseAdmin: ReturnType<typeof createClient>) {}

    /**
     * @endpoint POST interno (não é rota HTTP)
     * @description Registra um evento de consumo de API externo.
     * Consulta o preço vigente, calcula o custo total, congela os valores
     * e grava o registro em api_usage_events.
     * @rules
     *   - Lança erro se provider ou feature não encontrados no catálogo
     *   - Se pricing não encontrado, grava evento com custo 0 e status 'error'
     *   - Nunca bloqueia a operação principal em produção (tratar externamente)
     * @audit true
     */
    async registerApiUsage(params: RegisterApiUsageParams): Promise<RegisterApiUsageResult> {
        // 1. Buscar IDs dos catálogos
        const [providerResult, featureResult] = await Promise.all([
            this.supabaseAdmin
                .from('provider_catalog')
                .select('id')
                .eq('code', params.provider)
                .single(),
            this.supabaseAdmin
                .from('feature_catalog')
                .select('id')
                .eq('code', params.feature)
                .single(),
        ]);

        if (providerResult.error || !providerResult.data) {
            throw new Error(`TelemetryService: provider não encontrado: ${params.provider}`);
        }
        if (featureResult.error || !featureResult.data) {
            throw new Error(`TelemetryService: feature não encontrada: ${params.feature}`);
        }

        const providerId = providerResult.data.id;
        const featureId  = featureResult.data.id;

        // 2. Buscar preço vigente (effective_to IS NULL = vigente hoje)
        const { data: pricing, error: pricingError } = await this.supabaseAdmin
            .from('api_pricing_catalog')
            .select('input_unit_cost, output_unit_cost, pricing_type')
            .eq('provider_id', providerId)
            .eq('model_name', params.model)
            .is('effective_to', null)
            .eq('ativo', true)
            .single();

        // 3. Calcular custo total
        let unitCostAtTime = 0;
        let totalCostUsd   = 0;
        let registroStatus = params.status;

        if (pricingError || !pricing) {
            // Preço não encontrado: registra evento com custo 0 e flag de erro
            console.error(`[TelemetryService] ALERTA: preço não encontrado para ${params.provider}/${params.model}`);
            registroStatus = 'error';
        } else {
            unitCostAtTime = pricing.input_unit_cost;

            if (pricing.pricing_type === 'tokens') {
                const custoInput  = (params.tokensInput  ?? 0) * pricing.input_unit_cost;
                const custoOutput = (params.tokensOutput ?? 0) * (pricing.output_unit_cost ?? 0);
                totalCostUsd = custoInput + custoOutput;
            } else if (pricing.pricing_type === 'characters') {
                totalCostUsd = (params.charactersInput ?? 0) * pricing.input_unit_cost;
            }
        }

        // 4. Gravar evento (padrão Saga — gravar é o último passo)
        const { data: event, error: insertError } = await this.supabaseAdmin
            .from('api_usage_events')
            .insert({
                provider_id:      providerId,
                feature_id:       featureId,
                model_name:       params.model,
                operation_id:     params.operationId,
                funeral_home_id:  params.funeralHomeId ?? null,
                memorial_id:      params.memorialId    ?? null,
                user_id:          params.userId,
                tokens_input:     params.tokensInput      ?? null,
                tokens_output:    params.tokensOutput     ?? null,
                characters_input: params.charactersInput  ?? null,
                latency_ms:       params.latencyMs,
                unit_cost_at_time: unitCostAtTime,
                total_cost_usd:   totalCostUsd,
                status:           registroStatus,
                error_message:    params.errorMessage ?? null,
                metadata:         params.metadata     ?? null,
            })
            .select('id, total_cost_usd')
            .single();

        if (insertError || !event) {
            // Log crítico — consumo ocorreu mas não foi registrado
            console.error('[TelemetryService] CRÍTICO: evento de consumo não gravado.', insertError);
            throw new Error('TelemetryService: falha ao gravar api_usage_events');
        }

        return {
            eventId:      event.id,
            totalCostUsd: event.total_cost_usd,
        };
    }
}
```

---

## Utilitário: geração de operationId

```typescript
// /src/services/telemetry/operationContext.ts

import { randomUUID } from 'crypto';

/**
 * Gera um operation_id único para uma ação do usuário.
 * Deve ser chamado UMA VEZ no início de cada ação (ex: início do controller)
 * e passado para todos os services que forem chamados dentro dessa ação.
 *
 * Exemplo:
 *   const operationId = createOperationId();
 *   await narrativaService.generate(data, operationId);
 *   await audioService.generate(narrativaId, operationId);
 */
export function createOperationId(): string {
    return randomUUID();
}
```

---

## Como injetar TelemetryService nos outros serviços

```typescript
// Padrão de injeção — mesmo padrão do MemorialService no MASTER_AGENT

export class NarrativaService {
    constructor(
        private readonly supabaseAdmin: ReturnType<typeof createClient>,
        private readonly telemetry: TelemetryService,   // ← injetado
    ) {}
}

export class SupportService {
    constructor(
        private readonly supabaseAdmin: ReturnType<typeof createClient>,
        private readonly telemetry: TelemetryService,   // ← injetado
    ) {}
}
```

### Checklist Fase 0.3

```
[ ] /src/services/telemetry/types.ts criado
[ ] /src/services/telemetry/TelemetryService.ts criado
[ ] /src/services/telemetry/operationContext.ts criado
[ ] Testado: chamada manual ao registerApiUsage grava corretamente em api_usage_events
[ ] Testado: model inexistente grava evento com status 'error' sem lançar exceção para o usuário
[ ] TelemetryService exportado via /src/services/telemetry/index.ts
[ ] progresso_camada1.md atualizado: "Fase 0.3 — TelemetryService criado ✅"
```

---

---

# FASE 0.4 — INSTRUMENTAR NÚCLEO SAAS: TEXTO (MemorialText)

**Contexto:** O núcleo SaaS de texto é responsável por gerar a narrativa biográfica. Cada geração pode envolver múltiplas chamadas ao Claude (REBUILD, REFINE). Cada chamada deve gerar um evento separado em `api_usage_events`, todas com o mesmo `operation_id`.

**Serviço responsável:** `NarrativaService.ts`  
**Feature:** `memorial_text`  
**Provider:** `anthropic`  
**Modelo primário:** `claude-sonnet-4-6`

---

## Onde entra a instrumentação

O fluxo de geração de texto tem dois pontos de chamada externa ao Claude:

**Ponto 1 — REBUILD:** Descarta texto atual, envia fatos raiz, Claude reconstrói do zero.  
**Ponto 2 — REFINE:** Envia texto atual + instrução, Claude refina.

Em AMBOS os pontos, após receber a resposta do Claude, deve-se chamar `registerApiUsage()`.

---

## Contrato de instrumentação no NarrativaService

```typescript
// /src/services/saas/NarrativaService.ts (adição à estrutura existente)

import { createOperationId } from '../telemetry/operationContext';
import { TelemetryService } from '../telemetry/TelemetryService';

export class NarrativaService {
    constructor(
        private readonly supabaseAdmin: ReturnType<typeof createClient>,
        private readonly telemetry: TelemetryService,
        private readonly anthropic: Anthropic,          // SDK já existente
    ) {}

    /**
     * @description Gera ou refina a narrativa biográfica de um memorial.
     * @entity memoriais
     * @rules
     *   - REBUILD consome 1 edição e chama Claude com fatos raiz
     *   - REFINE consome 1 edição e chama Claude com texto atual + instrução
     *   - SILENT não chama Claude, custo zero
     *   - operation_id gerado aqui e propagado para todas as chamadas internas
     * @audit true
     */
    async generateNarrativa(params: {
        memorialId: string;
        funeralHomeId: string;
        userId: string;
        routingLevel: 'REBUILD' | 'REFINE' | 'SILENT';
        prompt: string;
    }): Promise<{ narrativa: string; operationId: string }> {

        // SILENT: sem chamada externa, sem registro de custo
        if (params.routingLevel === 'SILENT') {
            return { narrativa: '', operationId: '' };
        }

        // Gera operation_id único para esta ação do usuário
        const operationId = createOperationId();
        const startTime   = Date.now();

        try {
            // ── CHAMADA EXTERNA AO CLAUDE ──────────────────────────────────
            const response = await this.anthropic.messages.create({
                model:      'claude-sonnet-4-6',
                max_tokens: 2048,
                messages:   [{ role: 'user', content: params.prompt }],
            });
            // ───────────────────────────────────────────────────────────────

            const latencyMs    = Date.now() - startTime;
            const tokensInput  = response.usage.input_tokens;
            const tokensOutput = response.usage.output_tokens;
            const narrativa    = response.content[0].type === 'text'
                                 ? response.content[0].text : '';

            // ── REGISTRO DE CUSTO ──────────────────────────────────────────
            await this.telemetry.registerApiUsage({
                provider:      'anthropic',
                model:         'claude-sonnet-4-6',
                feature:       'memorial_text',
                operationId,
                funeralHomeId: params.funeralHomeId,
                memorialId:    params.memorialId,
                userId:        params.userId,
                tokensInput,
                tokensOutput,
                latencyMs,
                status:        'success',
                metadata: {
                    routing_level: params.routingLevel,
                },
            });
            // ───────────────────────────────────────────────────────────────

            return { narrativa, operationId };

        } catch (error) {
            const latencyMs = Date.now() - startTime;

            // Registra falha — custo pode ter ocorrido mesmo com erro
            await this.telemetry.registerApiUsage({
                provider:      'anthropic',
                model:         'claude-sonnet-4-6',
                feature:       'memorial_text',
                operationId,
                funeralHomeId: params.funeralHomeId,
                memorialId:    params.memorialId,
                userId:        params.userId,
                latencyMs,
                status:        'error',
                errorMessage:  error instanceof Error ? error.message : 'unknown',
                metadata: {
                    routing_level: params.routingLevel,
                },
            }).catch(telemetryError => {
                // Log crítico: consumo ocorreu, erro E falha de registro
                console.error('[NarrativaService] CRÍTICO: falha dupla — Claude + Telemetria', telemetryError);
            });

            throw error; // propaga o erro original para o controller
        }
    }
}
```

---

## Comportamento esperado no banco após uma geração

```
api_usage_events:
  operation_id  = "abc-123"
  feature       = memorial_text
  provider      = anthropic
  model         = claude-sonnet-4-6
  memorial_id   = "uuid-do-memorial"
  tokens_input  = 1840
  tokens_output = 620
  total_cost_usd = 0.014820    ← congelado no momento
  status        = success
```

### Checklist Fase 0.4

```
[ ] TelemetryService injetado no NarrativaService
[ ] operationId gerado no início de generateNarrativa
[ ] registerApiUsage chamado após resposta do Claude (REBUILD)
[ ] registerApiUsage chamado após resposta do Claude (REFINE)
[ ] Evento de erro registrado quando Claude lança exceção
[ ] SILENT não gera registro (custo zero)
[ ] Testado: geração REBUILD gera 1 evento em api_usage_events
[ ] Testado: geração com erro do Claude gera evento com status 'error'
[ ] progresso_camada1.md atualizado: "Fase 0.4 — MemorialText instrumentado ✅"
```

---

---

# FASE 0.5 — INSTRUMENTAR NÚCLEO SAAS: ÁUDIO (MemorialAudio)

**Contexto:** O núcleo de áudio sintetiza a narrativa via TTS. Pode usar Google TTS (Wavenet/Journey) ou ElevenLabs dependendo do `audio_tier` do plano. A chamada ao TTS é o único ponto que gera custo aqui — medido em **caracteres processados**, não tokens.

**Serviço responsável:** `TimelineService.ts`  
**Feature:** `memorial_audio`  
**Providers:** `google` (Wavenet/Journey) ou `elevenlabs`  
**Unidade:** `characters`

---

## Contrato de instrumentação no TimelineService

```typescript
// /src/services/saas/TimelineService.ts (adição à estrutura existente)

export class TimelineService {
    constructor(
        private readonly supabaseAdmin: ReturnType<typeof createClient>,
        private readonly telemetry: TelemetryService,
        private readonly ttsClient: TextToSpeechClient,   // Google TTS já existente
    ) {}

    /**
     * @description Gera o áudio TTS da narrativa de um memorial.
     * Único ponto autorizado a chamar TTS no sistema.
     * Regra: 1 MP3 por memorial — sobrescreve o path anterior.
     * @entity memoriais
     * @rules
     *   - audio_tier determina o provedor (google | elevenlabs)
     *   - Fallback ElevenLabs → Journey se chave ausente
     *   - operation_id herdado do contexto ou gerado aqui se chamada direta
     * @audit true
     */
    async generateAudio(params: {
        memorialId: string;
        funeralHomeId: string;
        userId: string;
        narrativaText: string;
        modelVoz: string;           // ex: 'pt-BR-Journey-F', 'elevenlabs-alice'
        operationId?: string;       // herda se vier de operação maior, gera se direto
    }): Promise<{ audioUrl: string }> {

        const operationId = params.operationId ?? createOperationId();
        const startTime   = Date.now();
        const provider: 'google' | 'elevenlabs' = params.modelVoz.startsWith('elevenlabs')
                                                   ? 'elevenlabs' : 'google';

        try {
            // ── CHAMADA EXTERNA AO TTS ─────────────────────────────────────
            // (lógica TTS existente no TimelineService)
            const audioBuffer = await this.callTtsProvider(
                provider, params.modelVoz, params.narrativaText
            );
            // ───────────────────────────────────────────────────────────────

            const latencyMs        = Date.now() - startTime;
            const charactersInput  = params.narrativaText.length;

            // ── REGISTRO DE CUSTO ──────────────────────────────────────────
            await this.telemetry.registerApiUsage({
                provider,
                model:         params.modelVoz,
                feature:       'memorial_audio',
                operationId,
                funeralHomeId: params.funeralHomeId,
                memorialId:    params.memorialId,
                userId:        params.userId,
                charactersInput,
                latencyMs,
                status: 'success',
                metadata: {
                    audio_tier: provider === 'elevenlabs' ? 'enterprise' : 'standard',
                },
            });
            // ───────────────────────────────────────────────────────────────

            const audioUrl = await this.saveAudioToStorage(
                params.memorialId, audioBuffer
            );
            return { audioUrl };

        } catch (error) {
            const latencyMs = Date.now() - startTime;

            await this.telemetry.registerApiUsage({
                provider,
                model:         params.modelVoz,
                feature:       'memorial_audio',
                operationId,
                funeralHomeId: params.funeralHomeId,
                memorialId:    params.memorialId,
                userId:        params.userId,
                latencyMs,
                status:        'error',
                errorMessage:  error instanceof Error ? error.message : 'unknown',
            }).catch(e => console.error('[TimelineService] CRÍTICO: falha dupla TTS + Telemetria', e));

            throw error;
        }
    }
}
```

### Checklist Fase 0.5

```
[ ] TelemetryService injetado no TimelineService
[ ] operationId gerado ou herdado corretamente
[ ] provider detectado automaticamente pelo prefixo do modelVoz
[ ] charactersInput = narrativaText.length (antes de qualquer truncamento)
[ ] registerApiUsage chamado após síntese bem-sucedida
[ ] Evento de erro registrado quando TTS lança exceção
[ ] Testado: geração de áudio Journey gera evento com provider 'google'
[ ] Testado: geração ElevenLabs gera evento com provider 'elevenlabs'
[ ] progresso_camada1.md atualizado: "Fase 0.5 — MemorialAudio instrumentado ✅"
```

---

---

# FASE 0.6 — INSTRUMENTAR NÚCLEO SUPORTE (SupportChat)

**Contexto:** O núcleo de suporte usa Claude (ou Gemini como fallback/híbrido) para responder dúvidas dos atendentes via Sofia. O custo aqui é menor porque a Camada 1 (FAQ) e o Intent Router (regex) custam zero. Apenas as chamadas que chegam na Camada 2 (LLM) geram custo real.

**Serviço responsável:** `SupportService.ts`  
**Feature:** `support_chat`  
**Providers:** `anthropic` (primário) | `google` (Gemini fallback)  
**Importante:** Perguntas resolvidas pelo FAQ têm custo zero e **não geram evento** (não há chamada externa).

---

## Contrato de instrumentação no SupportService

```typescript
// /src/services/support/SupportService.ts (adição à estrutura existente)

export class SupportService {
    constructor(
        private readonly supabaseAdmin: ReturnType<typeof createClient>,
        private readonly telemetry: TelemetryService,
        private readonly anthropic: Anthropic,
        private readonly gemini: GoogleGenerativeAI,   // fallback
    ) {}

    /**
     * @description Processa pergunta do atendente via Sofia.
     * Camada 1 (FAQ) = custo zero, sem evento.
     * Camada 2 (LLM) = custo real, com evento registrado.
     * @entity support_sessions
     * @rules
     *   - Intent Router e FAQ não geram api_usage_events
     *   - Apenas chamadas LLM (Claude ou Gemini) geram eventos
     *   - funeralHomeId é obrigatório (suporte sempre vinculado a uma funerária)
     * @audit true
     */
    async processQuestion(params: {
        pergunta: string;
        funeralHomeId: string;
        userId: string;
        sessionId: string;   // ID da sessão de suporte — vira operationId
    }): Promise<{ resposta: string; camadaUsada: 'faq' | 'llm'; confidenceScore: number }> {

        const operationId = params.sessionId; // sessão de suporte = operação

        // ── CAMADA 1: FAQ (custo zero, sem registro de custo) ──────────────
        const faqResult = await this.searchFaq(params.pergunta);
        if (faqResult && faqResult.score >= 0.80) {
            return { resposta: faqResult.resposta, camadaUsada: 'faq', confidenceScore: faqResult.score };
        }

        // ── CAMADA 2: LLM ─────────────────────────────────────────────────
        const startTime    = Date.now();
        const provider     = 'anthropic'; // ou lógica de seleção Claude vs Gemini
        const model        = 'claude-sonnet-4-6';

        try {
            const response = await this.anthropic.messages.create({
                model,
                max_tokens: 1024,
                system:     this.buildSofiaSystemPrompt(),
                messages:   [{ role: 'user', content: params.pergunta }],
            });

            const latencyMs    = Date.now() - startTime;
            const tokensInput  = response.usage.input_tokens;
            const tokensOutput = response.usage.output_tokens;
            const resposta     = response.content[0].type === 'text'
                                 ? response.content[0].text : '';

            // ── REGISTRO DE CUSTO ────────────────────────────────────────
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
                status: 'success',
                metadata: {
                    session_id:       params.sessionId,
                    faq_score_before: faqResult?.score ?? 0,
                },
            });
            // ─────────────────────────────────────────────────────────────

            return { resposta, camadaUsada: 'llm', confidenceScore: 1.0 };

        } catch (error) {
            const latencyMs = Date.now() - startTime;
            await this.telemetry.registerApiUsage({
                provider, model,
                feature:       'support_chat',
                operationId,
                funeralHomeId: params.funeralHomeId,
                userId:        params.userId,
                latencyMs,
                status:        'error',
                errorMessage:  error instanceof Error ? error.message : 'unknown',
            }).catch(e => console.error('[SupportService] CRÍTICO', e));
            throw error;
        }
    }
}
```

### Checklist Fase 0.6

```
[ ] TelemetryService injetado no SupportService
[ ] FAQ (Camada 1) NÃO gera api_usage_events — confirmado
[ ] Intent Router NÃO gera api_usage_events — confirmado
[ ] Chamada LLM (Camada 2) gera evento com feature 'support_chat'
[ ] sessionId propagado como operationId
[ ] funeralHomeId obrigatório em todas as chamadas de suporte
[ ] Testado: pergunta respondida pelo FAQ → 0 eventos gerados
[ ] Testado: pergunta que chega no LLM → 1 evento gerado
[ ] progresso_camada1.md atualizado: "Fase 0.6 — SupportChat instrumentado ✅"
```

---

---

# FASE 0.7 — INSTRUMENTAR NÚCLEO INGESTÃO (DevTools)

**Contexto:** O núcleo de ingestão é o mais invisível ao usuário final mas pode ser o mais custoso em volume de tokens. Ele inclui o pipeline de documentação automática (código → IA → documentação técnica) e o DiagnosticService. Esses eventos têm `funeral_home_id = NULL` porque são custos internos da plataforma, classificados como `dev_tools`.

**Serviços responsáveis:** `IngestionService.ts`, `DocumentationService.ts`, `DiagnosticService.ts`  
**Feature:** `dev_tools`  
**Centro de custo:** interno (sem funeralHomeId)

---

## Contrato de instrumentação no IngestionService

```typescript
// /src/services/ingest/IngestionService.ts (adição à estrutura existente)

export class IngestionService {
    constructor(
        private readonly supabaseAdmin: ReturnType<typeof createClient>,
        private readonly telemetry: TelemetryService,
        private readonly anthropic: Anthropic,
    ) {}

    /**
     * @description Pipeline de documentação automática de endpoints.
     * Camada determinística (AST/regex): custo zero, sem registro.
     * Camada IA (geração de descrição): custo real, com registro.
     * @entity system_endpoints
     * @rules
     *   - funeralHomeId = null (custo interno da plataforma)
     *   - memorial_id = null (não vinculado a memorial)
     *   - Um evento por endpoint processado pela IA
     * @audit true
     */
    async processEndpoint(params: {
        endpointPath: string;
        codeSnippet: string;
        userId: string;
    }): Promise<void> {

        const operationId = createOperationId();
        const startTime   = Date.now();

        // ── CAMADA DETERMINÍSTICA (custo zero, sem registro) ───────────────
        const estrutura = this.extractStructureFromAst(params.codeSnippet);

        // ── CAMADA IA ─────────────────────────────────────────────────────
        try {
            const response = await this.anthropic.messages.create({
                model:      'claude-haiku-4-5',  // Haiku para economizar em dev_tools
                max_tokens: 512,
                messages:   [{
                    role:    'user',
                    content: `Documente este endpoint: ${JSON.stringify(estrutura)}`,
                }],
            });

            const latencyMs    = Date.now() - startTime;
            const tokensInput  = response.usage.input_tokens;
            const tokensOutput = response.usage.output_tokens;

            // ── REGISTRO DE CUSTO ─────────────────────────────────────────
            await this.telemetry.registerApiUsage({
                provider:      'anthropic',
                model:         'claude-haiku-4-5',
                feature:       'dev_tools',
                operationId,
                funeralHomeId: undefined,    // custo interno
                memorialId:    undefined,    // não vinculado
                userId:        params.userId,
                tokensInput,
                tokensOutput,
                latencyMs,
                status: 'success',
                metadata: {
                    endpoint_path: params.endpointPath,
                    pipeline_stage: 'documentation',
                },
            });
            // ─────────────────────────────────────────────────────────────

            await this.persistDocumentation(
                params.endpointPath,
                response.content[0].type === 'text' ? response.content[0].text : ''
            );

        } catch (error) {
            // Ingestão falha silenciosamente para não bloquear commit
            const latencyMs = Date.now() - startTime;
            await this.telemetry.registerApiUsage({
                provider: 'anthropic', model: 'claude-haiku-4-5',
                feature:  'dev_tools', operationId,
                userId:   params.userId, latencyMs,
                status:   'error',
                errorMessage: error instanceof Error ? error.message : 'unknown',
                metadata: { endpoint_path: params.endpointPath },
            }).catch(e => console.error('[IngestionService] CRÍTICO', e));
            // não relança — pipeline não-bloqueante
        }
    }
}
```

### Checklist Fase 0.7

```
[ ] TelemetryService injetado no IngestionService
[ ] TelemetryService injetado no DocumentationService
[ ] TelemetryService injetado no DiagnosticService
[ ] funeralHomeId = undefined em todos os eventos dev_tools
[ ] Haiku usado para dev_tools (economia)
[ ] Falha na IA de ingestão não bloqueia o commit (confirmado)
[ ] Testado: pipeline de ingestão gera evento com feature 'dev_tools'
[ ] Testado: total_cost_usd calculado com preço do Haiku, não do Sonnet
[ ] progresso_camada1.md atualizado: "Fase 0.7 — DevTools instrumentado ✅"
```

---

---

# FASE 0.8 — VIEWS DE RELATÓRIO FINANCEIRO

**Contexto:** Com todos os eventos gravados corretamente, as Views SQL respondem as perguntas de negócio sem alterar nenhum dado. São somente leitura.

---

## View 1: Custo por Memorial

```sql
CREATE OR REPLACE VIEW public.vw_custo_por_memorial AS
SELECT
    e.memorial_id,
    m.nome_homenageado,
    e.funeral_home_id,
    fc.name                          AS feature,
    pc.name                          AS provider,
    COUNT(*)                         AS total_eventos,
    SUM(e.tokens_input)              AS total_tokens_input,
    SUM(e.tokens_output)             AS total_tokens_output,
    SUM(e.characters_input)          AS total_characters,
    SUM(e.total_cost_usd)            AS custo_total_usd,
    MIN(e.criado_em)                 AS primeiro_evento,
    MAX(e.criado_em)                 AS ultimo_evento
FROM public.api_usage_events e
JOIN public.feature_catalog  fc ON fc.id = e.feature_id
JOIN public.provider_catalog pc ON pc.id = e.provider_id
LEFT JOIN public.memoriais    m  ON m.id  = e.memorial_id
WHERE e.status = 'success'
  AND e.memorial_id IS NOT NULL
GROUP BY e.memorial_id, m.nome_homenageado, e.funeral_home_id, fc.name, pc.name;
```

---

## View 2: Custo por Funerária no Mês

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
WHERE e.status = 'success'
  AND e.funeral_home_id IS NOT NULL
GROUP BY e.funeral_home_id, fh.nome, DATE_TRUNC('month', e.criado_em), fc.name
ORDER BY mes DESC, custo_total_usd DESC;
```

---

## View 3: Distribuição de Custo por Feature (% do total)

```sql
CREATE OR REPLACE VIEW public.vw_distribuicao_custo_feature AS
WITH totais AS (
    SELECT SUM(total_cost_usd) AS grand_total
    FROM public.api_usage_events
    WHERE status = 'success'
)
SELECT
    fc.code                                     AS feature_code,
    fc.name                                     AS feature_name,
    SUM(e.total_cost_usd)                       AS custo_usd,
    ROUND(
        (SUM(e.total_cost_usd) / t.grand_total) * 100, 2
    )                                           AS percentual
FROM public.api_usage_events e
JOIN public.feature_catalog fc ON fc.id = e.feature_id
CROSS JOIN totais t
WHERE e.status = 'success'
GROUP BY fc.code, fc.name, t.grand_total
ORDER BY custo_usd DESC;
```

---

## View 4: Custo por Operação (todos os eventos de uma ação)

```sql
CREATE OR REPLACE VIEW public.vw_custo_por_operacao AS
SELECT
    e.operation_id,
    e.memorial_id,
    e.funeral_home_id,
    e.user_id,
    STRING_AGG(DISTINCT fc.name, ' + ')         AS features_usadas,
    STRING_AGG(DISTINCT pc.name, ' + ')         AS providers_usados,
    SUM(e.total_cost_usd)                       AS custo_total_operacao_usd,
    SUM(e.tokens_input)                         AS total_tokens_input,
    SUM(e.tokens_output)                        AS total_tokens_output,
    COUNT(*)                                    AS total_chamadas,
    MIN(e.criado_em)                            AS inicio,
    MAX(e.criado_em)                            AS fim
FROM public.api_usage_events e
JOIN public.feature_catalog  fc ON fc.id = e.feature_id
JOIN public.provider_catalog pc ON pc.id = e.provider_id
WHERE e.status = 'success'
GROUP BY e.operation_id, e.memorial_id, e.funeral_home_id, e.user_id
ORDER BY inicio DESC;
```

### Checklist Fase 0.8

```
[ ] vw_custo_por_memorial criada e testada
[ ] vw_custo_por_funeraria_mes criada e testada
[ ] vw_distribuicao_custo_feature criada e testada
[ ] vw_custo_por_operacao criada e testada
[ ] Testado: SELECT da view retorna custo correto comparado a cálculo manual
[ ] RLS das views herda das tabelas base (confirmado no Supabase)
[ ] progresso_camada1.md atualizado: "Fase 0.8 — Views de relatório criadas ✅"
```

---

---

# FASE 0.9 — VALIDAÇÃO FINAL E CHECKLIST DE COBERTURA

**Contexto:** Antes de declarar a Fase 0 concluída, execute este checklist completo. Cada item deve ser verificado com uma query ou teste real.

---

## Perguntas que o sistema deve conseguir responder

```sql
-- Pergunta 1: Quanto custou o memorial X?
SELECT * FROM vw_custo_por_memorial WHERE memorial_id = 'uuid-do-memorial';

-- Pergunta 2: Quanto custou a Funerária ABC em junho?
SELECT * FROM vw_custo_por_funeraria_mes
WHERE funeraria = 'Funerária ABC'
  AND mes = '2025-06-01';

-- Pergunta 3: Qual feature consome mais dinheiro?
SELECT * FROM vw_distribuicao_custo_feature;

-- Pergunta 4: Quanto custou a operação de gerar esta biografia?
SELECT * FROM vw_custo_por_operacao WHERE operation_id = 'uuid-da-operacao';
```

---

## Checklist de cobertura de instrumentação

```
NÚCLEO SAAS — TEXTO
[ ] REBUILD gera evento em api_usage_events
[ ] REFINE gera evento em api_usage_events
[ ] SILENT não gera evento
[ ] memorial_id presente em todos os eventos de texto
[ ] funeral_home_id presente em todos os eventos de texto

NÚCLEO SAAS — ÁUDIO
[ ] Geração Journey gera evento com provider 'google'
[ ] Geração ElevenLabs gera evento com provider 'elevenlabs'
[ ] characters_input = comprimento real do texto enviado ao TTS
[ ] memorial_id presente em todos os eventos de áudio
[ ] funeral_home_id presente em todos os eventos de áudio

NÚCLEO SUPORTE
[ ] Perguntas respondidas pelo FAQ geram 0 eventos
[ ] Perguntas que chegam ao LLM geram 1 evento
[ ] funeralHomeId obrigatório — nenhum evento de suporte tem NULL
[ ] sessionId propagado como operationId

NÚCLEO INGESTÃO
[ ] Pipeline de documentação gera evento por endpoint processado
[ ] feature = 'dev_tools' em todos os eventos de ingestão
[ ] funeralHomeId = NULL em todos os eventos de ingestão
[ ] Modelo Haiku usado (não Sonnet) para dev_tools

EVENTOS DE ERRO
[ ] Falha no Claude gera evento com status 'error'
[ ] Falha no TTS gera evento com status 'error'
[ ] Evento de erro tem errorMessage preenchido
[ ] Evento de erro tem total_cost_usd = 0

CATÁLOGOS
[ ] Todos os modelos usados existem em api_pricing_catalog
[ ] Nenhuma chamada grava custo 0 por falta de preço no catálogo
[ ] effective_to = NULL em todos os preços vigentes
```

---

## Alerta de custo anômalo (implementar após Fase 0.9)

```sql
-- Query para detectar consumo anômalo em 24h por funerária
-- Executar via cron ou alertar via webhook
SELECT
    funeral_home_id,
    DATE_TRUNC('day', criado_em) AS dia,
    SUM(total_cost_usd)          AS custo_dia_usd,
    COUNT(*)                     AS total_eventos
FROM public.api_usage_events
WHERE criado_em >= NOW() - INTERVAL '24 hours'
  AND status = 'success'
GROUP BY funeral_home_id, DATE_TRUNC('day', criado_em)
HAVING SUM(total_cost_usd) > 5.00   -- threshold: $5/dia por funerária
ORDER BY custo_dia_usd DESC;
```

### Checklist Fase 0.9

```
[ ] As 4 perguntas de negócio retornam dados corretos via Views
[ ] 100% dos checkpoints de cobertura verificados
[ ] Nenhum evento gravado com funeral_home_id incorreto
[ ] Nenhum evento gravado com feature errada
[ ] Query de alerta anômalo testada
[ ] support_metrics mantida como log técnico legado (intacta)
[ ] progresso_camada1.md atualizado: "Fase 0 — Governança Financeira COMPLETA ✅"
```

---

---

## REFERÊNCIA RÁPIDA — MAPEAMENTO COMPLETO

| Núcleo | Serviço | Feature Code | Provider | Modelo | Tem funeralHomeId | Tem memorialId |
|---|---|---|---|---|---|---|
| SaaS Texto | NarrativaService | memorial_text | anthropic | claude-sonnet-4-6 | ✅ obrigatório | ✅ obrigatório |
| SaaS Áudio | TimelineService | memorial_audio | google / elevenlabs | Journey / ElevenLabs | ✅ obrigatório | ✅ obrigatório |
| Suporte | SupportService | support_chat | anthropic / google | claude-sonnet-4-6 / gemini | ✅ obrigatório | ❌ não se aplica |
| Ingestão | IngestionService | dev_tools | anthropic | claude-haiku-4-5 | ❌ NULL (interno) | ❌ NULL (interno) |
| Documentação | DocumentationService | dev_tools | anthropic | claude-haiku-4-5 | ❌ NULL (interno) | ❌ NULL (interno) |
| Diagnóstico | DiagnosticService | dev_tools | anthropic / google | claude-sonnet-4-6 | ✅ obrigatório | opcional |

---

## REFERÊNCIA RÁPIDA — ORDEM DE EXECUÇÃO

```
0.1 → Catálogos (provider, feature, pricing)      — Supabase SQL Editor
0.2 → Tabela api_usage_events                     — Supabase SQL Editor
0.3 → TelemetryService + registerApiUsage()       — /src/services/telemetry/
0.4 → NarrativaService instrumentado              — /src/services/saas/
0.5 → TimelineService instrumentado               — /src/services/saas/
0.6 → SupportService instrumentado                — /src/services/support/
0.7 → IngestionService instrumentado              — /src/services/ingest/
0.8 → Views SQL de relatório                      — Supabase SQL Editor
0.9 → Validação final e checklist de cobertura    — Testes + queries
```

---

*Documento gerado para o projeto Ecos de Memórias — Fase 0 Governança Financeira.*  
*Atualizar `/docs/saas/progresso_camada1.md` ao concluir cada fase.*
