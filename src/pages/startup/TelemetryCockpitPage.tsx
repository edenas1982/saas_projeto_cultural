import { useState, useEffect, useCallback } from 'react';
import { Activity, Download, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';

// ─── TIPOS ──────────────────────────────────────────────────────

interface Summary {
    custo_total_usd:       number;
    media_7_dias_usd:      number;
    total_chamadas:        number;
    custo_medio_texto_usd: number;
    total_biografias:      number;
    total_audios:          number;
    exchange_rate_brl?:    number;
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

const formatBrl = (usdVal: number, rate: number) => {
    const converted = usdVal * rate;
    return converted === 0 ? 'R$ 0,00' : `R$ ${converted.toFixed(2).replace('.', ',')}`;
};

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
