import { SupabaseClient } from '@supabase/supabase-js';
import { TelemetryService } from './TelemetryService.js';
import { IAProvider } from './IAProvider.js';
import { IAProviderFactory } from './IAProviderFactory.js';

export class SupportService {
  private ai: IAProvider;

  constructor(
    private readonly supabase: SupabaseClient,
    private readonly telemetryService?: TelemetryService,
    ai?: IAProvider
  ) {
    this.ai = ai || IAProviderFactory.createProvider();
  }

  /**
   * Busca os documentos de endpoint relevantes usando Busca por Texto Completo (FTS) no Supabase.
   * Caso a função RPC não exista (migration não rodada), faz fallback para a busca de todos os ativos.
   */
  private async retrieveRelevantDocs(pergunta: string): Promise<any[]> {
    try {
      console.log(`[SupportService] Tentando busca RAG/FTS para a pergunta: "${pergunta}"`);
      
      // Processamento de palavras-chave com OR para ampliar a flexibilidade do FTS
      const keywords = pergunta
        .replace(/[^\w\sÀ-ÿ]/g, '') // remove pontuações
        .split(/\s+/)
        .filter(word => word.length > 3) // remove stopwords e palavras curtas
        .join(' OR ');

      console.log(`[SupportService] Keywords geradas para FTS: "${keywords}"`);

      const { data: endpoints, error } = await this.supabase
        .rpc('search_endpoints', { 
          query_text: keywords, 
          match_count: 3 
        });

      if (error) {
        // Se der erro de RPC (ex: função não cadastrada), dispara fallback
        if (error.code === 'P0001' || error.message?.includes('does not exist')) {
          console.warn('[SupportService] RPC "search_endpoints" não encontrado. Usando fallback para leitura completa de ativos.');
          return this.fallbackRetrieveAll();
        }
        console.error('[SupportService] Erro na busca RPC FTS:', error);
        throw error;
      }

      console.log(`[SupportService] Busca FTS retornou ${endpoints?.length || 0} endpoints relevantes.`);
      return endpoints || [];
    } catch (err) {
      console.warn('[SupportService] Falha na busca FTS, usando fallback de leitura completa:', err);
      return this.fallbackRetrieveAll();
    }
  }

  /**
   * Busca de fallback que retorna todos os endpoints ativos da tabela (método original).
   */
  private async fallbackRetrieveAll(): Promise<any[]> {
    const { data: endpoints, error } = await this.supabase
      .from('system_endpoints')
      .select('path, method, descricao, requer_auth, regras_negocio, schema_entrada, schema_saida')
      .eq('status', 'ativo');

    if (error) {
      console.error('[SupportService] Erro no fallback de leitura completa:', error);
      throw new Error('Falha ao carregar a documentação de fallback do sistema.');
    }

    return endpoints || [];
  }

  /**
   * Remove campos técnicos sensíveis de um documento de endpoint para segurança e economia de tokens.
   */
  private sanitizeDoc(doc: any): any {
    return {
      path: doc.path,
      method: doc.method,
      descricao: doc.descricao,
      regras_negocio: doc.regras_negocio,
      schema_entrada: doc.schema_entrada,
      schema_saida: doc.schema_saida
    };
  }

  /**
   * Constrói a representação textual estruturada e limpa dos endpoints para injeção no prompt.
   */
  private buildContextBlock(endpoints: any[]): string {
    if (endpoints.length === 0) {
      return 'Nenhum endpoint correspondente encontrado no catálogo.';
    }

    return endpoints
      .map((ep, idx) => {
        const sanitized = this.sanitizeDoc(ep);
        const rules = sanitized.regras_negocio && Array.isArray(sanitized.regras_negocio)
          ? sanitized.regras_negocio.map((r: string) => `  * ${r}`).join('\n')
          : '  * Nenhuma regra de negócio cadastrada.';

        return `--- DOCUMENTO DE APOIO #${idx + 1} ---
Rota do Sistema: ${sanitized.path} (Ação: ${sanitized.method})
Descrição da Funcionalidade: ${sanitized.descricao || 'Sem descrição cadastrada.'}
Regras de Negócio Associadas:
${rules}
Dados Requeridos na Entrada (Requisitos): ${sanitized.schema_entrada ? JSON.stringify(sanitized.schema_entrada) : 'Nenhum dado de entrada exigido.'}
Dados Retornados na Saída (Resposta): ${sanitized.schema_saida ? JSON.stringify(sanitized.schema_saida) : 'Nenhum dado de retorno.'}`;
      })
      .join('\n\n');
  }

  /**
   * @endpoint
   * @description Responde a uma pergunta do time de suporte com base no catálogo vivo usando RAG/FTS.
   * @entity Support
   * @rules Apenas usa contexto documentado no banco. Não inventa informações.
   * @audit false
   */
  public async responderSuporte(
    pergunta: string,
    options?: { sessionId?: string; organizationId?: string; userId?: string }
  ): Promise<string> {
    const startTime = performance.now();
    let endpointRetornado = 'Nenhum';
    let ftsRank = 0;

    try {
      // 1. Recupera apenas os documentos relevantes baseados no FTS (com fallback integrado)
      const relevantDocs = await this.retrieveRelevantDocs(pergunta);
      if (relevantDocs.length > 0) {
        const primaryDoc = relevantDocs[0];
        endpointRetornado = `${primaryDoc.method || ''} ${primaryDoc.path || ''}`.trim() || 'Nenhum';
        ftsRank = primaryDoc.rank || 0;
      }

      // 2. Constrói o bloco de contexto estruturado e sanitizado
      const contextBlock = this.buildContextBlock(relevantDocs);

      // 3. Monta o prompt enxuto para a persona "Sofia"
      const prompt = `Você é a Sofia, a Assistente Técnica Especialista de Suporte do sistema "Eco de Memórias".
Sua missão é ajudar o time de atendimento/suporte (com não-técnicos) a entender as regras reais de funcionamento do software de forma didática, acolhedora e polida.

=== BASE DE CONHECIMENTO DISPONÍVEL ===
Abaixo estão os documentos de especificação de endpoints recuperados que descrevem o comportamento real do código do sistema:

${contextBlock}
======================================

=== DIRETRIZES DE PERSONA E COMUNICAÇÃO ===
1. Responda de forma extremamente empática, didática e clara. Evite tom frio ou puramente robótico.
2. Traduza termos técnicos para a linguagem do suporte comercial:
   - Não mencione métodos HTTP (como GET, POST, PUT, DELETE). Diga "ação de ler", "ação de salvar/enviar" ou "ação de atualizar/remover".
   - Explique "schemas" de entrada/saída como "dados requeridos para preenchimento" ou "informações fornecidas pelo sistema".
3. SEGURANÇA E PRIVACIDADE:
   - Nunca mostre nomes de tabelas do banco de dados (ex: 'system_endpoints', 'narrativas', etc.).
   - Nunca mencione IDs internos de banco (como UUIDs), comandos SQL ou menções à estrutura técnica interna do Supabase.
4. LIMITAÇÕES DE CONTEXTO:
   - Responda ESTRITAMENTE com base no contexto disponibilizado acima.
   - Se o contexto não cobrir a dúvida ou se a base de conhecimento retornar "Nenhum endpoint correspondente encontrado", diga educadamente: "Não encontrei essa informação no Catálogo Vivo do sistema no momento." e oriente a acionar a equipe de desenvolvimento para registrar as regras correspondentes.
5. FORMATO DA RESPOSTA:
   - Limite a resposta a no máximo 4 parágrafos curtos ou uma lista de até 5 tópicos.
   - Sempre termine com uma ação clara ou uma pergunta de acompanhamento para o atendente.

PERGUNTA DO ATENDENTE:
"${pergunta}"
`;

      // 4. Executa a requisição usando o provedor de IA configurado
      const response = await this.ai.generateText(prompt, 600);

      const tokensInput = response.inputTokens;
      const tokensOutput = response.outputTokens;
      const latenciaMs = Math.round(performance.now() - startTime);

      // Despacha gravação de telemetria (fire-and-forget)
      if (this.telemetryService) {
        const provider = response.model.startsWith('claude') ? 'anthropic' : 'google';
        this.telemetryService.registerApiUsage({
          provider,
          model: response.model,
          feature: 'support_chat',
          operationId: options?.sessionId || '00000000-0000-0000-0000-000000000000',
          organizationId: options?.organizationId,
          userId: options?.userId || '00000000-0000-0000-0000-000000000000',
          tokensInput,
          tokensOutput,
          latencyMs: latenciaMs,
          status: 'success',
          metadata: {
            pergunta,
            endpointRetornado,
            ftsRank
          }
        }).catch(err => console.error('[SupportService] Falha ao despachar telemetria de suporte:', err));
      }

      return response.text || 'Ocorreu um erro ao elaborar a resposta.';
      
    } catch (e: any) {
      console.error('[SupportService] Erro ao processar chat do suporte com RAG:', e);
      const latenciaMs = Math.round(performance.now() - startTime);
      
      if (this.telemetryService) {
        const provider = process.env.AI_PROVIDER === 'gemini' ? 'google' : 'anthropic';
        const model = process.env.AI_PROVIDER === 'gemini' ? 'gemini-2.5-flash' : 'claude-sonnet-4-6';
        this.telemetryService.registerApiUsage({
          provider,
          model,
          feature: 'support_chat',
          operationId: options?.sessionId || '00000000-0000-0000-0000-000000000000',
          organizationId: options?.organizationId,
          userId: options?.userId || '00000000-0000-0000-0000-000000000000',
          tokensInput: 0,
          tokensOutput: 0,
          latencyMs: latenciaMs,
          status: 'error',
          errorMessage: e.message || 'Erro Desconhecido',
          metadata: {
            pergunta,
            endpointRetornado: 'Erro'
          }
        }).catch(err => console.error('[SupportService] Falha ao despachar telemetria de erro no suporte:', err));
      }

      let msg = e?.message || 'Erro Desconhecido';
      if (e?.status === 401) msg = "Credenciais da IA inválidas ou expiradas.";
      return `Desculpe, ocorreu uma falha técnica ao consultar o suporte inteligente: ${msg}`;
    }
  }
}
