import { Request, Response } from 'express';
import { TelemetryCockpitService } from '../../services/startup/TelemetryCockpitService.js';
import { supabaseAdmin } from '../../lib/supabaseAdmin.js';
import { ExchangeRateService } from '../../services/startup/ExchangeRateService.js';

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

            // Geração de CSV formatado com ";" e decimais em PT-BR para Excel
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
                String(e.total_cost_usd).replace('.', ','),
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
