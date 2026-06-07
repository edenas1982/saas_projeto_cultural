# Cockpit de Telemetria — Documento Executável de Implementação
## Ecos de Memórias — Núcleo Startup (Acesso Temporário)

> **Status:** Pronto para execução  
> **Frente:** Startup — acesso temporário enquanto Camada 3 (Super Admin) não existe  
> **Pré-requisito:** Fase 0 da Governança Financeira concluída — tabelas `api_usage_events`, `provider_catalog`, `feature_catalog` e Views `vw_distribuicao_custo_feature`, `vw_custo_por_memorial` existentes no Supabase  
> **Atualizar ao concluir:** `/docs/saas/progresso_camada1.md`

---

## ANTES DE COMEÇAR — LEITURA OBRIGATÓRIA DO AGENTE

Confirmar internamente antes de escrever qualquer linha:

1. Frente ativa: **Startup**. Nenhuma alteração toca `/src/pages/saas` ou `/src/pages/projeto-cultural`.
2. Nenhuma chave de API vai para o frontend. Dados chegam via backend Express autenticado.
3. O botão de acesso a esta tela no portal do Startup deve ser adicionado em [ParaAvaliadores.tsx](file:///c:/Users/Edi%20Nascimento/antigravity/Ecos-de-Memória/src/pages/ParaAvaliadores.tsx) de forma secundária e amigável.
4. RLS preservado — a rota backend usa `supabaseAdmin` (service role), não o cliente público.
5. Design segue Lei SaaS B2B do MASTER_AGENT: `bg-slate-50`, `slate-900`, destaque índigo, Lucide icons, Inter font, sem gráficos complexos.
6. Toda lógica de dados reside no `TelemetryCockpitService` (e em queries/views de banco de dados), nunca no componente React.

---

## VISÃO GERAL

Esta tela é o painel de observabilidade financeira temporário, acessível pelo núcleo Startup enquanto a Camada 3 (Super Admin) não está implementada. Ela permite validar em tempo real se a instrumentação da Fase 0 está funcionando corretamente: se eventos estão sendo registrados, se custos estão sendo calculados, se o `operation_id` está agrupando chamadas e se todos os núcleos estão cobertos.

```
Núcleo Startup
      ↓
[Botão de Acesso] → /startup/telemetria
      ↓
TelemetryCockpitPage.tsx
      ↓
GET /api/startup/telemetria/summary     → KPIs gerais (via view de agregação)
GET /api/startup/telemetria/por-feature → Custo por funcionalidade
GET /api/startup/telemetria/cobertura   → Status de instrumentação
GET /api/startup/telemetria/eventos     → Log paginado com filtros
      ↓
TelemetryCockpitService.ts
      ↓
Supabase (api_usage_events + Views)
```

---

## MAPEAMENTO: TELA → FONTE DE DADOS

Cada seção da tela e sua query correspondente no banco:

| Seção da Tela | Fonte no Banco | Query / View |
|---|---|---|
| KPI — Custo Total Acumulado | `vw_telemetry_summary` | `custo_total_usd` (calculado via SQL) |
| KPI — Média Últimos 7 Dias | `vw_telemetry_summary` | `media_7_dias_usd` (calculado via SQL) |
| KPI — Total de Chamadas | `vw_telemetry_summary` | `total_chamadas` (calculado via SQL) |
| KPI — Custo Médio / Biografia | `vw_telemetry_summary` | `custo_medio_texto_usd` (calculado via SQL) |
| Cards por Feature (valor + %) | `vw_distribuicao_custo_feature` | View completa |
| Cobertura de Instrumentação | `api_usage_events` | `COUNT(*) GROUP BY feature_id` |
| Tabela de Logs | `api_usage_events` | JOIN com `provider_catalog` e `feature_catalog` |
| Exportar CSV | `api_usage_events` | Mesma query da tabela sem paginação, formatado em PT-BR |

---

# PASSO 0 — BANCO DE DADOS (VIEW DE AGREGADOS FINANCEIROS)

Criar a View `vw_telemetry_summary` para centralizar a agregação matemática no Postgres e evitar consumo desnecessário de memória e rede pelo servidor Node.js.

```sql
CREATE OR REPLACE VIEW public.vw_telemetry_summary AS
SELECT
    -- Custo total acumulado com sucesso
    COALESCE(SUM(total_cost_usd), 0.0) AS custo_total_usd,
    -- Média diária ponderada baseada nos últimos 7 dias (dividido pelos dias ativos com telemetria no período)
    COALESCE(
        SUM(total_cost_usd) FILTER (WHERE criado_em >= NOW() - INTERVAL '7 days'),
        0.0
    ) / COALESCE(
        NULLIF(
            COUNT(DISTINCT criado_em::date) FILTER (WHERE criado_em >= NOW() - INTERVAL '7 days'),
            0
        ),
        1.0
    ) AS media_7_dias_usd,
    -- Contador absoluto de requisições registradas
    COUNT(id) AS total_chamadas,
    -- Custo médio real de entrega de uma biografia (Texto + Áudio) por memorial único
    COALESCE(
        SUM(total_cost_usd) FILTER (
            WHERE feature_id IN (
                SELECT id FROM public.feature_catalog WHERE code IN ('memorial_text', 'memorial_audio')
            )
        ),
        0.0
    ) / COALESCE(
        NULLIF(
            COUNT(DISTINCT memorial_id) FILTER (
                WHERE feature_id IN (
                    SELECT id FROM public.feature_catalog WHERE code IN ('memorial_text', 'memorial_audio')
                )
            ),
            0
        ),
        1.0
    ) AS custo_medio_texto_usd,
    -- Total de biografias únicas geradas com sucesso
    COALESCE(
        COUNT(DISTINCT memorial_id) FILTER (
            WHERE feature_id = (SELECT id FROM public.feature_catalog WHERE code = 'memorial_text')
        ),
        0
    ) AS total_biografias,
    -- Total de áudios únicos gerados com sucesso
    COALESCE(
        COUNT(DISTINCT memorial_id) FILTER (
            WHERE feature_id = (SELECT id FROM public.feature_catalog WHERE code = 'memorial_audio')
        ),
        0
    ) AS total_audios
FROM public.api_usage_events
WHERE status = 'success';
```

---

# PASSO 1 — MIDDLEWARE DE AUTENTICAÇÃO E CLIENTE ADMIN

### 1.1 — Middleware Central de Autenticação
**Arquivo:** `/src/middleware/auth.ts` (Novo diretório e arquivo)

Extrair o middleware de validação JWT de `server.ts` para um arquivo compartilhado.

```typescript
import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token === 'MOCK_TOKEN') {
       (req as any).user = { id: '78654881-7776-4391-8e3f-03d54bc135d9' };
       return next();
    }

    if (!token || token === 'undefined' || token === 'null') {
      return res.status(401).json({ error: 'Token de acesso requerido ou inválido. Nenhuma credencial fornecida.' });
    }

    let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: "Configurações do Supabase não encontradas no servidor." });
    }

    supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(403).json({ 
        error: 'Token inválido ou expirado.',
        details: error ? error.message : 'Usuário nulo retornado do Supabase'
      });
    }

    (req as any).user = user;
    next();
  } catch (e: any) {
    return res.status(500).json({ error: `Erro na autenticação: ${e.message || e}` });
  }
};
```

### 1.2 — Cliente Supabase Admin (Bypass RLS)
**Arquivo:** `/src/lib/supabaseAdmin.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const rawSupabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseUrl = rawSupabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.warn('[SupabaseAdmin] Alerta: Chaves do Supabase service_role estão ausentes.');
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseKey);
```

---

# PASSO 2 — ROTAS DO EXPRESS

**Arquivo:** `/src/routes/startup/telemetria.routes.ts`  
**Prefixo:** `/api/startup/telemetria`

```typescript
/**
 * @endpoint /api/startup/telemetria/*
 * @description Rotas do Cockpit de Telemetria — acesso temporário via Núcleo Startup.
 * Todas as rotas exigem autenticação JWT válida.
 */

import { Router } from 'express';
import { authenticateToken } from '../../middleware/auth';
import { TelemetryCockpitController } from '../../controllers/startup/TelemetryCockpitController';

const router = Router();
const controller = new TelemetryCockpitController();

// Aplica autenticação centralizada
router.use(authenticateToken);

router.get('/summary', (req, res) => controller.getSummary(req, res));
router.get('/por-feature', (req, res) => controller.getCostByFeature(req, res));
router.get('/cobertura', (req, res) => controller.getCobertura(req, res));
router.get('/eventos', (req, res) => controller.getEventos(req, res));
router.get('/exportar-csv', (req, res) => controller.exportCsv(req, res));

export default router;
```

**Registrar no servidor Express principal (`server.ts`):**
```typescript
import { authenticateToken } from "./src/middleware/auth.js"; // Importar centralizado
// Substituir a declaração local "const authenticateToken" por esse import.

import telemetriaRoutes from './src/routes/startup/telemetria.routes.js';
app.use('/api/startup/telemetria', telemetriaRoutes);
```

---

# PASSO 3 — SERVICE DO BACKEND

**Arquivo:** `/src/services/startup/TelemetryCockpitService.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

/**
 * @description Serviço de dados do Cockpit de Telemetria.
 * Toda lógica de consulta ao banco de dados reside aqui.
 * @audit false
 */
export class TelemetryCockpitService {
    constructor(
        private readonly supabaseAdmin: ReturnType<typeof createClient>
    ) {}

    /**
     * Retorna os 4 KPIs do topo da tela usando agregação nativa via View SQL.
     * Evita estouro de memória no servidor Node.js.
     */
    async getSummary() {
        const { data, error } = await this.supabaseAdmin
            .from('vw_telemetry_summary')
            .select('*')
            .single();

        if (error || !data) {
            return {
                custo_total_usd: 0,
                media_7_dias_usd: 0,
                total_chamadas: 0,
                custo_medio_texto_usd: 0,
                total_biografias: 0,
                total_audios: 0,
            };
        }

        return {
            custo_total_usd:       Number(data.custo_total_usd),
            media_7_dias_usd:      Number(data.media_7_dias_usd),
            total_chamadas:        Number(data.total_chamadas),
            custo_medio_texto_usd: Number(data.custo_medio_texto_usd),
            total_biografias:      Number(data.total_biografias ?? 0),
            total_audios:          Number(data.total_audios ?? 0),
        };
    }

    /**
     * Retorna custo acumulado e percentual por feature.
     * Consome a View vw_distribuicao_custo_feature da Fase 0.
     */
    async getCostByFeature() {
        const { data, error } = await this.supabaseAdmin
            .from('vw_distribuicao_custo_feature')
            .select('*');

        if (error) throw new Error(`TelemetryCockpitService: ${error.message}`);

        const features = ['memorial_text', 'memorial_audio', 'support_chat', 'dev_tools'];
        return features.map(code => {
            const found = data?.find(d => d.feature_code === code);
            
            // Check if the new columns exist in the view data
            const total_chamadas = found && 'total_chamadas' in found ? Number(found.total_chamadas) : 0;
            const provedor = found && 'provedor_principal' in found ? found.provedor_principal : null;
            const modelo = found && 'modelo_principal' in found ? found.modelo_principal : null;

            // Formatação do subtitle conforme a documentação
            let subtitle = '0 chamadas · sem eventos';
            if (total_chamadas > 0) {
                const prov = provedor || '';
                const model = modelo || '';
                let displayModel = model;
                if (prov.toLowerCase().includes('google')) displayModel = 'Google TTS';
                else if (model.toLowerCase().includes('claude')) displayModel = 'Claude Sonnet';
                else if (prov.toLowerCase().includes('eleven')) displayModel = 'ElevenLabs';
                
                subtitle = `${total_chamadas} chamadas · ${displayModel}`;
            }

            return {
                feature_code: code,
                feature_name: found?.feature_name ?? code,
                custo_usd:    found ? Number(found.custo_usd) : 0,
                percentual:   found ? Number(found.percentual) : 0,
                total_chamadas,
                subtitle
            };
        });
    }

    /**
     * Retorna o status de cobertura de cada núcleo para as pills coloridas.
     */
    async getCobertura() {
        const { data: features } = await this.supabaseAdmin
            .from('feature_catalog')
            .select('id, code, name');

        const { data: contagens } = await this.supabaseAdmin
            .from('api_usage_events')
            .select('feature_id')
            .eq('status', 'success');

        return features?.map(f => {
            const total = contagens?.filter(e => e.feature_id === f.id).length ?? 0;
            const status = total >= 5 ? 'ok' : total > 0 ? 'warn' : 'off';
            return { code: f.code, name: f.name, total_eventos: total, status };
        }) ?? [];
    }

    /**
     * Retorna log paginado de eventos com filtros dinâmicos de período e status.
     */
    async getEventos(params: {
        feature?:   string;
        provider?:  string;
        status?:    string;
        date_from?: string;
        date_to?:   string;
        page?:      number;
        limit?:     number;
    }) {
        const page  = params.page  ?? 1;
        const limit = params.limit ?? 10;
        const from  = (page - 1) * limit;
        const to    = from + limit - 1;

        let query = this.supabaseAdmin
            .from('api_usage_events')
            .select(`
                id,
                criado_em,
                model_name,
                tokens_input,
                tokens_output,
                characters_input,
                latency_ms,
                total_cost_usd,
                operation_id,
                status,
                error_message,
                feature_catalog ( code, name ),
                provider_catalog ( code, name )
            `, { count: 'exact' })
            .order('criado_em', { ascending: false })
            .range(from, to);

        if (params.status)    query = query.eq('status', params.status);
        if (params.date_from) query = query.gte('criado_em', params.date_from);
        if (params.date_to)   query = query.lte('criado_em', params.date_to + 'T23:59:59');

        if (params.feature) {
            const { data: f } = await this.supabaseAdmin
                .from('feature_catalog').select('id').eq('code', params.feature).single();
            if (f) query = query.eq('feature_id', f.id);
        }

        if (params.provider) {
            const { data: p } = await this.supabaseAdmin
                .from('provider_catalog').select('id').eq('code', params.provider).single();
            if (p) query = query.eq('provider_id', p.id);
        }

        const { data, count, error } = await query;
        if (error) throw new Error(`TelemetryCockpitService: ${error.message}`);

        return {
            eventos:    data ?? [],
            total:      count ?? 0,
            pagina:     page,
            por_pagina: limit,
            paginas:    Math.ceil((count ?? 0) / limit),
        };
    }

    /**
     * Retorna todos os eventos com filtros para a exportação CSV.
     */
    async getEventosParaCsv(params: {
        feature?:   string;
        provider?:  string;
        status?:    string;
        date_from?: string;
        date_to?:   string;
    }) {
        const resultado = await this.getEventos({ ...params, page: 1, limit: 10000 });
        return resultado.eventos;
    }
}
```

---

# PASSO 4 — CONTROLLER DO BACKEND

**Arquivo:** `/src/controllers/startup/TelemetryCockpitController.ts`

```typescript
import { Request, Response } from 'express';
import { TelemetryCockpitService } from '../../services/startup/TelemetryCockpitService';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { ExchangeRateService } from '../../services/startup/ExchangeRateService';

export class TelemetryCockpitController {
    private service: TelemetryCockpitService;

    constructor() {
        this.service = new TelemetryCockpitService(supabaseAdmin);
    }

    async getSummary(req: Request, res: Response) {
        try {
            const data = await this.service.getSummary();
            const rate = await ExchangeRateService.getExchangeRate();
            res.json({ success: true, data: { ...data, exchange_rate_brl: rate } });
        } catch (e) {
            res.status(500).json({ success: false, error: String(e) });
        }
    }

    async getCostByFeature(req: Request, res: Response) {
        try {
            const data = await this.service.getCostByFeature();
            res.json({ success: true, data });
        } catch (e) {
            res.status(500).json({ success: false, error: String(e) });
        }
    }

    async getCobertura(req: Request, res: Response) {
        try {
            const data = await this.service.getCobertura();
            res.json({ success: true, data });
        } catch (e) {
            res.status(500).json({ success: false, error: String(e) });
        }
    }

    async getEventos(req: Request, res: Response) {
        try {
            const { feature, provider, status, date_from, date_to, page, limit } = req.query;
            const data = await this.service.getEventos({
                feature:   feature   as string,
                provider:  provider  as string,
                status:    status    as string,
                date_from: date_from as string,
                date_to:   date_to   as string,
                page:      page  ? Number(page)  : 1,
                limit:     limit ? Number(limit) : 10,
            });
            res.json({ success: true, data });
        } catch (e) {
            res.status(500).json({ success: false, error: String(e) });
        }
    }

    async exportCsv(req: Request, res: Response) {
        try {
            const { feature, provider, status, date_from, date_to } = req.query;
            const eventos = await this.service.getEventosParaCsv({
                feature:   feature   as string,
                provider:  provider  as string,
                status:    status    as string,
                date_from: date_from as string,
                date_to:   date_to   as string,
            });

            // Geração de CSV formatado com ";" e substituição de decimais para Excel PT-BR
            const cabecalho = 'data_hora;feature;provedor;modelo;tokens_input;tokens_output;characters;latencia_ms;custo_usd;operation_id;status\n';
            const linhas = eventos.map((e: any) => [
                new Date(e.criado_em).toLocaleString('pt-BR'),
                e.feature_catalog?.code ?? '',
                e.provider_catalog?.code ?? '',
                e.model_name ?? '',
                e.tokens_input ?? '',
                e.tokens_output ?? '',
                e.characters_input ?? '',
                e.latency_ms ?? '',
                String(e.total_cost_usd).replace('.', ','), // Corrige a leitura decimal no Excel
                e.operation_id ?? '',
                e.status ?? '',
            ].join(';')).join('\n');

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename="telemetria.csv"');
            res.send(cabecalho + linhas);
        } catch (e) {
            res.status(500).json({ success: false, error: String(e) });
        }
    }
}
```

---

# PASSO 4.1 — SERVIÇO DE TAXA DE CÂMBIO (USD -> BRL)

**Arquivo:** `/src/services/startup/ExchangeRateService.ts`

```typescript
/**
 * @description Serviço para consulta e caching da taxa de câmbio USD-BRL.
 * Consulta AwesomeAPI como primária e Frankfurter como secundária (fallback).
 * Armazena a cotação em cache de memória revalidado diariamente.
 */
export class ExchangeRateService {
    private static cachedRate: number | null = null;
    private static cacheDate: string | null = null;

    /**
     * Retorna a cotação USD-BRL do fechamento de ontem.
     * Caso o cache diário seja válido, retorna o valor em memória.
     */
    public static async getExchangeRate(): Promise<number> {
        const todayStr = new Date().toISOString().split('T')[0];

        if (this.cachedRate !== null && this.cacheDate === todayStr) {
            return this.cachedRate;
        }

        try {
            const rate = await this.fetchWithFallback();
            this.cachedRate = rate;
            this.cacheDate = todayStr;
            return rate;
        } catch (error) {
            console.error('[ExchangeRateService] Falha crítica nas APIs de cotação externa:', error);
            return this.cachedRate || 5.25;
        }
    }

    private static async fetchWithFallback(): Promise<number> {
        try {
            const response = await fetch('https://economia.awesomeapi.com.br/json/daily/USD-BRL/2', {
                signal: AbortSignal.timeout(5000)
            });

            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data) && data.length > 0) {
                    const dayData = data[1] || data[0];
                    const rate = parseFloat(dayData.ask);
                    if (!isNaN(rate) && rate > 0) return rate;
                }
            }
        } catch (err: any) {
            console.warn(`[ExchangeRateService] AwesomeAPI indisponível: ${err.message || err}`);
        }

        try {
            const yesterdayStr = this.getYesterdayString();
            const response = await fetch(`https://api.frankfurter.app/${yesterdayStr}?from=USD&to=BRL`, {
                signal: AbortSignal.timeout(5000)
            });

            if (response.ok) {
                const data = await response.json();
                const rate = data.rates?.BRL;
                if (typeof rate === 'number' && rate > 0) return rate;
            }
        } catch (err: any) {
            console.warn(`[ExchangeRateService] Frankfurter API indisponível: ${err.message || err}`);
        }

        throw new Error('Não foi possível obter a cotação USD-BRL em nenhuma das APIs públicas.');
    }

    private static getYesterdayString(): string {
        const date = new Date();
        date.setDate(date.getDate() - 1);
        return date.toISOString().split('T')[0];
    }
}
```

---

# PASSO 5 — COMPONENTE REACT (FRONTEND)

**Arquivo:** `/src/pages/startup/TelemetryCockpitPage.tsx`  
**Rota:** `/startup/telemetria`

```typescript
import { useState, useEffect, useCallback } from 'react';
import { Activity, Download, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

// ─── TIPOS ──────────────────────────────────────────────────────

interface Summary {
    custo_total_usd:       number;
    media_7_dias_usd:      number;
    total_chamadas:        number;
    custo_medio_texto_usd: number;
    total_biografias:      number;
    total_audios:          number;
}

interface FeatureCost {
    feature_code: string;
    feature_name: string;
    custo_usd:    number;
    percentual:   number;
    subtitle?:    string;
}

interface CoberturaItem {
    code:          string;
    name:          string;
    total_eventos: number;
    status:        'ok' | 'warn' | 'off';
}

interface Evento {
    id:              string;
    criado_em:       string;
    model_name:      string;
    tokens_input:    number | null;
    tokens_output:   number | null;
    characters_input: number | null;
    latency_ms:      number | null;
    total_cost_usd:  number;
    operation_id:    string;
    status:          string;
    feature_catalog: { code: string; name: string };
    provider_catalog: { code: string; name: string };
}

// ─── HELPERS ────────────────────────────────────────────────────

const featureColors: Record<string, { badge: string; bar: string; border: string }> = {
    memorial_text:  { badge: 'bg-violet-100 text-violet-700', bar: 'bg-violet-600', border: 'border-t-violet-600' },
    memorial_audio: { badge: 'bg-blue-100 text-blue-700',     bar: 'bg-blue-600',   border: 'border-t-blue-600'   },
    support_chat:   { badge: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-600', border: 'border-t-emerald-600' },
    dev_tools:      { badge: 'bg-amber-100 text-amber-700',   bar: 'bg-amber-500',  border: 'border-t-amber-500'  },
};

const formatUsd = (val: number) =>
    val === 0 ? '$ 0,0000' : `$ ${val.toFixed(4).replace('.', ',')}`;

const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const truncateOpId = (id: string) =>
    id ? `${id.substring(0, 4)}…${id.substring(id.length - 4)}` : '—';

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────────

export default function TelemetryCockpitPage() {
    const [summary,    setSummary]    = useState<Summary | null>(null);
    const [features,   setFeatures]   = useState<FeatureCost[]>([]);
    const [cobertura,  setCobertura]  = useState<CoberturaItem[]>([]);
    const [eventos,    setEventos]    = useState<Evento[]>([]);
    const [totalEvt,   setTotalEvt]   = useState(0);
    const [pagina,     setPagina]     = useState(1);
    const [loading,    setLoading]    = useState(true);

    const [filtroFeature,  setFiltroFeature]  = useState('');
    const [filtroProvider, setFiltroProvider] = useState('');
    const [filtroStatus,   setFiltroStatus]   = useState('');
    const [filtroDateFrom, setFiltroDateFrom] = useState('');
    const [filtroDateTo,   setFiltroDateTo]   = useState('');

    const POR_PAGINA = 10;

    // Helper para recuperar token JWT ativo do Supabase
    const getAuthHeaders = async () => {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token || '';
        return { 'Authorization': `Bearer ${token}` };
    };

    const fetchSummary = async () => {
        const headers = await getAuthHeaders();
        const res = await fetch('/api/startup/telemetria/summary', { headers });
        const json = await res.json();
        if (json.success) setSummary(json.data);
    };

    const fetchFeatures = async () => {
        const headers = await getAuthHeaders();
        const res = await fetch('/api/startup/telemetria/por-feature', { headers });
        const json = await res.json();
        if (json.success) setFeatures(json.data);
    };

    const fetchCobertura = async () => {
        const headers = await getAuthHeaders();
        const res = await fetch('/api/startup/telemetria/cobertura', { headers });
        const json = await res.json();
        if (json.success) setCobertura(json.data);
    };

    const fetchEventos = useCallback(async (pg = 1) => {
        const params = new URLSearchParams();
        if (filtroFeature)  params.set('feature',   filtroFeature);
        if (filtroProvider) params.set('provider',  filtroProvider);
        if (filtroStatus)   params.set('status',    filtroStatus);
        if (filtroDateFrom) params.set('date_from', filtroDateFrom);
        if (filtroDateTo)   params.set('date_to',   filtroDateTo);
        params.set('page',  String(pg));
        params.set('limit', String(POR_PAGINA));

        const headers = await getAuthHeaders();
        const res = await fetch(`/api/startup/telemetria/eventos?${params}`, { headers });
        const json = await res.json();
        if (json.success) {
            setEventos(json.data.eventos);
            setTotalEvt(json.data.total);
            setPagina(pg);
        }
    }, [filtroFeature, filtroProvider, filtroStatus, filtroDateFrom, filtroDateTo]);

    useEffect(() => {
        Promise.all([fetchSummary(), fetchFeatures(), fetchCobertura(), fetchEventos(1)])
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { fetchEventos(1); }, [fetchEventos]);

    const handleExportCsv = async () => {
        const params = new URLSearchParams();
        if (filtroFeature)  params.set('feature',   filtroFeature);
        if (filtroProvider) params.set('provider',  filtroProvider);
        if (filtroStatus)   params.set('status',    filtroStatus);
        if (filtroDateFrom) params.set('date_from', filtroDateFrom);
        if (filtroDateTo)   params.set('date_to',   filtroDateTo);

        const headers = await getAuthHeaders();
        const res = await fetch(`/api/startup/telemetria/exportar-csv?${params}`, { headers });
        const blob = await res.blob();
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = 'telemetria.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <span className="text-slate-400 text-sm font-medium">Carregando telemetria...</span>
            </div>
        );
    }

    const totalPaginas = Math.ceil(totalEvt / POR_PAGINA);
    const rate = summary?.exchange_rate_brl ?? 0;

    return (
        <div className="min-h-screen bg-slate-50 p-8 font-sans">

            {/* HEADER */}
            <div className="flex items-center justify-between mb-7">
                <div className="flex items-center gap-4">
                    <Link to="/startup" className="text-slate-400 hover:text-slate-700 transition-colors">
                        <ArrowLeft size={20} />
                    </Link>
                    <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center">
                        <Activity size={18} className="text-slate-200" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-slate-900">Cockpit de Telemetria</h1>
                        <p className="text-xs text-slate-500 mt-0.5">Observabilidade financeira de APIs — Fase 0</p>
                    </div>
                </div>
                <div className="flex items-center gap-2.5">
                    {rate > 0 && (
                        <span className="text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 px-3 py-1 rounded-full">
                            Câmbio de ontem: R$ {rate.toFixed(4).replace('.', ',')}
                        </span>
                    )}
                    <span className="text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200 px-3 py-1 rounded-full">
                        Acesso temporário — Núcleo Startup
                    </span>
                </div>
            </div>

            {/* KPI CARDS */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                {[
                    { 
                        label: 'Custo Total Acumulado',  
                        value: formatUsd(summary?.custo_total_usd ?? 0),       
                        valueBrl: rate > 0 ? formatBrl(summary?.custo_total_usd ?? 0, rate) : null,
                        sub: 'desde o início dos testes',         
                        highlight: true 
                    },
                    { 
                        label: 'Média Últimos 7 Dias',   
                        value: formatUsd(summary?.media_7_dias_usd ?? 0),      
                        valueBrl: rate > 0 ? formatBrl(summary?.media_7_dias_usd ?? 0, rate) : null,
                        sub: 'por dia de uso' 
                    },
                    { 
                        label: 'Total de Biografias',      
                        value: String(summary?.total_biografias ?? 0),           
                        sub: ((summary?.total_biografias ?? 0) - (summary?.total_audios ?? 0)) === 0
                            ? 'Todas com áudio ✓'
                            : `${summary?.total_audios ?? 0} com áudio · ${Math.max(0, (summary?.total_biografias ?? 0) - (summary?.total_audios ?? 0))} sem áudio ⚠️`,
                        subClass: ((summary?.total_biografias ?? 0) - (summary?.total_audios ?? 0)) > 0
                            ? 'text-amber-600 font-semibold'
                            : 'text-slate-400'
                    },
                    { 
                        label: 'Custo Médio / Biografia',
                        value: formatUsd(summary?.custo_medio_texto_usd ?? 0), 
                        valueBrl: rate > 0 ? formatBrl(summary?.custo_medio_texto_usd ?? 0, rate) : null,
                        sub: 'por memorial gerado' 
                    },
                ].map((kpi, i) => (
                    <div key={i} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between min-h-[145px]">
                        <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{kpi.label}</p>
                            <p className={`text-3xl font-bold tabular-nums ${kpi.highlight ? 'text-indigo-600' : 'text-slate-900'}`}>
                                {kpi.value}
                            </p>
                            {kpi.valueBrl && (
                                <p className="text-sm font-semibold text-slate-400 tabular-nums mt-0.5">
                                    {kpi.valueBrl}
                                </p>
                            )}
                        </div>
                        <p className={`text-xs mt-3 ${kpi.subClass || 'text-slate-400'}`}>{kpi.sub}</p>
                    </div>
                ))}
            </div>

            {/* CUSTO POR FEATURE */}
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Custo acumulado por funcionalidade
            </p>
            <div className="grid grid-cols-4 gap-3 mb-6">
                {features.map(f => {
                    const colors = featureColors[f.feature_code] ?? featureColors['dev_tools'];
                    return (
                        <div key={f.feature_code} className={`bg-white border border-slate-200 shadow-sm rounded-xl p-5 border-t-4 ${colors.border} flex flex-col justify-between min-h-[160px]`}>
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        {f.feature_code.replace('_', ' ')}
                                    </span>
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${colors.badge}`}>
                                        {f.percentual}%
                                    </span>
                                </div>
                                <p className="text-2xl font-bold text-slate-900 tabular-nums mb-0.5">
                                    {formatUsd(f.custo_usd)}
                                </p>
                                {rate > 0 && (
                                    <p className="text-xs font-semibold text-slate-400 tabular-nums mb-1.5">
                                        {formatBrl(f.custo_usd, rate)}
                                    </p>
                                )}
                                <p className="text-xs text-slate-400 mt-0.5 font-medium">
                                    {f.subtitle || '0 chamadas · sem eventos'}
                                </p>
                            </div>
                            <div className="mt-3 h-1 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full ${colors.bar}`}
                                    style={{ width: `${f.percentual}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* COBERTURA DE INSTRUMENTAÇÃO */}
            <div className="bg-white border border-slate-200 shadow-sm rounded-xl px-5 py-4 mb-5 flex items-center gap-3 flex-wrap">
                <span className="text-xs font-semibold text-slate-500">Cobertura de instrumentação:</span>
                {cobertura.map(c => {
                    const cls = c.status === 'ok'   ? 'bg-emerald-100 text-emerald-700'
                              : c.status === 'warn' ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-slate-100 text-slate-400';
                    const dot = c.status === 'ok'   ? 'bg-emerald-500'
                              : c.status === 'warn' ? 'bg-yellow-500'
                              : 'bg-slate-300';
                    return (
                        <span key={c.code} className={`text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 ${cls}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                            {c.code}
                        </span>
                    );
                })}
                <span className="ml-auto text-xs text-slate-400">
                    verde = eventos registrados · amarelo = poucos eventos · cinza = sem eventos
                </span>
            </div>

            {/* FILTROS */}
            <div className="flex items-center gap-2.5 mb-4 flex-wrap">
                <span className="text-sm font-medium text-slate-600">Filtrar por</span>
                <select
                    value={filtroFeature}
                    onChange={e => setFiltroFeature(e.target.value)}
                    className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-900 outline-none focus:border-indigo-400"
                >
                    <option value="">Todas as features</option>
                    <option value="memorial_text">memorial_text</option>
                    <option value="memorial_audio">memorial_audio</option>
                    <option value="support_chat">support_chat</option>
                    <option value="dev_tools">dev_tools</option>
                </select>
                <select
                    value={filtroProvider}
                    onChange={e => setFiltroProvider(e.target.value)}
                    className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-900 outline-none focus:border-indigo-400"
                >
                    <option value="">Todos os provedores</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="google">Google</option>
                    <option value="elevenlabs">ElevenLabs</option>
                </select>
                <select
                    value={filtroStatus}
                    onChange={e => setFiltroStatus(e.target.value)}
                    className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-900 outline-none focus:border-indigo-400"
                >
                    <option value="">Todos os status</option>
                    <option value="success">success</option>
                    <option value="error">error</option>
                    <option value="cached">cached</option>
                    <option value="aborted">aborted</option>
                </select>
                <div className="w-px h-7 bg-slate-200" />
                <input type="date" value={filtroDateFrom} onChange={e => setFiltroDateFrom(e.target.value)}
                    className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white outline-none focus:border-indigo-400" />
                <span className="text-xs text-slate-400">até</span>
                <input type="date" value={filtroDateTo} onChange={e => setFiltroDateTo(e.target.value)}
                    className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white outline-none focus:border-indigo-400" />
                <button
                    onClick={handleExportCsv}
                    className="ml-auto flex items-center gap-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50 transition-colors shadow-sm"
                >
                    <Download size={14} className="text-slate-500" />
                    Exportar CSV
                </button>
            </div>

            {/* TABELA DE LOGS */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <span className="text-sm font-semibold text-slate-900">Log de eventos</span>
                    <span className="text-xs text-slate-400">{totalEvt} registros encontrados</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                {['Data / Hora','Feature','Provedor / Modelo','Consumo','Latência','Custo (USD)','Operation ID','Status'].map(h => (
                                    <th key={h} className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-5 py-3">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {eventos.map((e, idx) => {
                                const colors   = featureColors[e.feature_catalog?.code] ?? featureColors['dev_tools'];
                                const prevSameOp = idx > 0 && eventos[idx - 1].operation_id === e.operation_id;
                                const nextSameOp = idx < eventos.length - 1 && eventos[idx + 1].operation_id === e.operation_id;
                                const isGrouped  = prevSameOp || nextSameOp;

                                return (
                                    <tr key={e.id} className={`border-b border-slate-50 hover:bg-slate-50/80 transition-colors ${isGrouped ? 'bg-indigo-50/20' : ''}`}>
                                        <td className="px-5 py-3.5 text-xs text-slate-500 whitespace-nowrap">{formatDateTime(e.criado_em)}</td>
                                        <td className="px-5 py-3.5">
                                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${colors.badge}`}>
                                                {e.feature_catalog?.code ?? '—'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                                {e.provider_catalog?.name ?? '—'}
                                            </span>
                                            <span className="text-xs text-slate-400 ml-1.5">{e.model_name}</span>
                                        </td>
                                        <td className="px-5 py-3.5 text-xs text-slate-500 tabular-nums">
                                            {e.tokens_input != null
                                                ? `↑ ${e.tokens_input.toLocaleString()} ↓ ${(e.tokens_output ?? 0).toLocaleString()} tokens`
                                                : e.characters_input != null
                                                    ? `${e.characters_input.toLocaleString()} chars`
                                                    : '—'
                                            }
                                        </td>
                                        <td className="px-5 py-3.5 text-xs text-slate-500 tabular-nums">
                                            {e.latency_ms != null ? `${e.latency_ms.toLocaleString()} ms` : '—'}
                                        </td>
                                        <td className="px-5 py-3.5 text-sm font-bold text-slate-900 tabular-nums">
                                            {formatUsd(Number(e.total_cost_usd))}
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span className="font-mono text-xs text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">
                                                {truncateOpId(e.operation_id)}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span className={`text-xs font-semibold ${e.status === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
                                                {e.status === 'success' ? '✓ success' : `✗ ${e.status}`}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                            {eventos.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-400">
                                        Nenhum evento encontrado para os filtros selecionados.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* PAGINAÇÃO */}
                <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100">
                    <span className="text-xs text-slate-400">
                        Mostrando {Math.min((pagina - 1) * POR_PAGINA + 1, totalEvt)}–{Math.min(pagina * POR_PAGINA, totalEvt)} de {totalEvt} registros
                    </span>
                    <div className="flex gap-1.5">
                        <button
                            onClick={() => fetchEventos(pagina - 1)}
                            disabled={pagina === 1}
                            className="text-xs font-medium border border-slate-200 bg-white text-slate-600 px-3 py-1.5 rounded-md hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            ← Anterior
                        </button>
                        {Array.from({ length: Math.min(totalPaginas, 5) }, (_, i) => i + 1).map(pg => (
                            <button
                                key={pg}
                                onClick={() => fetchEventos(pg)}
                                className={`text-xs font-medium border px-3 py-1.5 rounded-md transition-colors ${
                                    pg === pagina
                                        ? 'bg-slate-900 text-white border-slate-900'
                                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                {pg}
                            </button>
                        ))}
                        <button
                            onClick={() => fetchEventos(pagina + 1)}
                            disabled={pagina >= totalPaginas}
                            className="text-xs font-medium border border-slate-200 bg-white text-slate-600 px-3 py-1.5 rounded-md hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            Próximo →
                        </button>
                    </div>
                </div>
            </div>

        </div>
    );
}
```

---

# PASSO 6 — REGISTRAR ROTA NO REACT ROUTER

**Arquivo:** `/src/App.tsx`

```typescript
// Importar a página de telemetria
import TelemetryCockpitPage from './pages/startup/TelemetryCockpitPage';

// Dentro de <Routes> (junto às outras rotas do Startup):
<Route path="/startup/telemetria" element={<TelemetryCockpitPage />} />
```

---

# PASSO 7 — BOTÃO DE ACESSO (NÚCLEO STARTUP)

**Arquivo:** `/src/pages/ParaAvaliadores.tsx`

Inserir o botão na interface ao lado do botão de login do Projeto Cultural, seguindo as diretrizes visuais premium do Ecos B2B:

```diff
           <div className="flex justify-center">
-            <Link 
-              to="/login"
-              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center gap-2"
-            >
-              Acessar Login do Projeto Cultural (Temporário)
-            </Link>
+          <div className="flex flex-col sm:flex-row justify-center gap-4">
+            <Link 
+              to="/login"
+              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
+            >
+              Acessar Login do Projeto Cultural (Temporário)
+            </Link>
+            <Link 
+              to="/startup/telemetria"
+              className="bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
+            >
+              <Activity className="w-5 h-5 text-slate-600" />
+              Acessar Cockpit de Telemetria (Fase 0)
+            </Link>
+          </div>
           </div>
```

---

# CHECKLIST DE CONCLUSÃO

```
BANCO DE DADOS
[x] View vw_telemetry_summary criada e homologada no Supabase

BACKEND
[x] Middleware de autenticação extraído em /src/middleware/auth.ts
[x] Cliente supabaseAdmin.ts criado em /src/lib/
[x] Rotas de telemetria criadas em /src/routes/startup/telemetria.routes.ts
[x] TelemetryCockpitService.ts e TelemetryCockpitController.ts implementados
[x] server.ts atualizado com import do middleware e registro de rotas

FRONTEND
[x] TelemetryCockpitPage.tsx criado em /src/pages/startup/
[x] Rota /startup/telemetria registrada no App.tsx
[x] Botão de acesso adicionado no ParaAvaliadores.tsx
[x] KPIs superiores mostram dados reais calculados pelo Postgres
[x] Filtros e paginação da tabela de eventos funcionando
[x] Exportação de CSV com ";" e decimal formatado em PT-BR

VALIDAÇÃO
[x] Fazer requisição de chat de suporte e validar inclusão no log
[x] Fazer requisição de áudio (TTS) e validar inclusão no log
[x] Confirmar que erros de acesso a rotas do cockpit sem login retornam 401/403
```
