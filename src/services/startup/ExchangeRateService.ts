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
            // Retorna o câmbio em cache anterior, ou fallback estático padrão (5.25) se for a primeira execução
            return this.cachedRate || 5.25;
        }
    }

    /**
     * Tenta buscar a cotação na API primária e, em caso de erro, recorre à secundária.
     */
    private static async fetchWithFallback(): Promise<number> {
        // 1. Provedor Primário: AwesomeAPI
        try {
            console.log('[ExchangeRateService] Buscando cotação USD-BRL via AwesomeAPI...');
            const response = await fetch('https://economia.awesomeapi.com.br/json/daily/USD-BRL/2', {
                signal: AbortSignal.timeout(5000) // Timeout de 5s
            });

            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data) && data.length > 0) {
                    // Pega o segundo elemento (ontem), ou o primeiro se só houver um
                    const dayData = data[1] || data[0];
                    const rate = parseFloat(dayData.ask);
                    if (!isNaN(rate) && rate > 0) {
                        console.log(`[ExchangeRateService] AwesomeAPI retornou sucesso: R$ ${rate}`);
                        return rate;
                    }
                }
            }
            console.warn('[ExchangeRateService] AwesomeAPI retornou dados inválidos ou status de erro.');
        } catch (err: any) {
            console.warn(`[ExchangeRateService] AwesomeAPI indisponível: ${err.message || err}`);
        }

        // 2. Provedor Secundário (Fallback): Frankfurter API
        try {
            console.log('[ExchangeRateService] Buscando cotação via Frankfurter API (Fallback)...');
            const yesterdayStr = this.getYesterdayString();
            const response = await fetch(`https://api.frankfurter.app/${yesterdayStr}?from=USD&to=BRL`, {
                signal: AbortSignal.timeout(5000) // Timeout de 5s
            });

            if (response.ok) {
                const data = await response.json();
                const rate = data.rates?.BRL;
                if (typeof rate === 'number' && rate > 0) {
                    console.log(`[ExchangeRateService] Frankfurter API retornou sucesso: R$ ${rate}`);
                    return rate;
                }
            }
            console.warn('[ExchangeRateService] Frankfurter API retornou dados inválidos.');
        } catch (err: any) {
            console.warn(`[ExchangeRateService] Frankfurter API indisponível: ${err.message || err}`);
        }

        throw new Error('Não foi possível obter a cotação USD-BRL em nenhuma das APIs públicas.');
    }

    /**
     * Retorna a data de ontem formatada como YYYY-MM-DD.
     */
    private static getYesterdayString(): string {
        const date = new Date();
        date.setDate(date.getDate() - 1);
        return date.toISOString().split('T')[0];
    }
}
