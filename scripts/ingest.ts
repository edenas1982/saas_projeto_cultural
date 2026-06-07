import { execSync } from 'child_process';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { TelemetryService } from '../src/services/TelemetryService.js';

// Injeta variáveis do .env
dotenv.config();

// ==========================================
// DTOs & Mapeamentos
// ==========================================

export interface EndpointDoc {
  descricao: string;
  requer_auth: boolean;
  regras_negocio: string[];
  schema_entrada: any;
  schema_saida: any;
}

export interface EndpointInfo {
  method: string;
  path: string;
  operacao: 'adicionado' | 'alterado' | 'removido' | 'detectado';
  trecho_codigo: string;
}

// ==========================================
// 1. Camada Determinística (Extrator Git)
// ==========================================

export class CodeDiffExtractor {
  public static extractModifiedEndpoints(): EndpointInfo[] {
    // ⚡ MODO VARREDURA COMPLETA (Real/Sem Git)
    if (process.env.FULL_SCAN === 'true') {
       console.log('⚡ [Ingestão] Modo Varredura Completa ativo: Analisando todas as rotas reais de server.ts...');
       let serverTsContent = '';
       try {
         serverTsContent = fs.readFileSync('server.ts', 'utf8');
       } catch {
         console.error('❌ Erro: Não foi possível ler o arquivo server.ts');
         return [];
       }
       
       const regex = /app\.(get|post|put|delete|patch)\(['"]([^'"]+)['"]/g;
       const endpoints = new Map<string, EndpointInfo>();
       let match;
       
       while ((match = regex.exec(serverTsContent)) !== null) {
         const method = match[1].toUpperCase();
         const path = match[2];
         const key = `${method} ${path}`;
         
         // Ingerir rotas relevantes de API do sistema e pular rotas de debug/suporte de teste
         if (path.startsWith('/api/') && !path.includes('/test') && !path.includes('/suporte/test')) {
            endpoints.set(key, {
              method,
              path,
              operacao: 'detectado',
              trecho_codigo: this.extrairTrechoDoEndpoint(serverTsContent, method.toLowerCase(), path)
            });
         }
       }
       return Array.from(endpoints.values());
    }

    let diff = '';
    try {
      diff = execSync('git diff --cached -- server.ts', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    } catch (e) {
      // Fallback pra Dev / Testes Locais
      console.warn('⚠️ Aviso: git diff não disponível. Usando MOCK para teste da FASE 3.');
      diff = `
diff --git a/server.ts b/server.ts
--- a/server.ts
+++ b/server.ts
@@ -10,6 +10,12 @@
+// Teste: Endpoint Adicionado
+app.post("/api/suporte/test", (req, res) => {
+  const payload = req.body;
+  // Regra: Verifica payload e processa a lógica de suporte
+  res.json({ new: true });
+});
+
      `;
    }

    if (!diff || diff.trim() === '') return [];

    const regex = /app\.(get|post|put|delete|patch)\(['"]([^'"]+)['"]/g;
    const endpoints = new Map<string, EndpointInfo>();

    let match;
    while ((match = regex.exec(diff)) !== null) {
      const fullMatch = match[0];
      const method = match[1].toUpperCase();
      const path = match[2];
      const key = `${method} ${path}`;

      const lines = diff.split('\n').filter(line => line.includes(fullMatch));
      
      let adicionado = false;
      let removido = false;

      for (const line of lines) {
        if (line.startsWith('+') && !line.startsWith('+++')) adicionado = true;
        if (line.startsWith('-') && !line.startsWith('---')) removido = true;
      }

      let operacao: EndpointInfo['operacao'] = 'detectado';
      if (adicionado && removido) operacao = 'alterado';
      else if (adicionado) operacao = 'adicionado';
      else if (removido) operacao = 'removido';

      if (!endpoints.has(key) || operacao !== 'detectado') {
         endpoints.set(key, { method, path, operacao, trecho_codigo: '' });
      }
    }

    // Preenche o trecho de código para não-removidos
    const resultados: EndpointInfo[] = [];
    let serverTsContent = '';
    try {
      serverTsContent = fs.readFileSync('server.ts', 'utf8');
    } catch {
       serverTsContent = `app.post("/api/suporte/test", (req, res) => { const payload = req.body; res.json({ new: true }); });`;
    }

    for (const info of endpoints.values()) {
      if (info.operacao !== 'removido') {
         info.trecho_codigo = this.extrairTrechoDoEndpoint(serverTsContent, info.method.toLowerCase(), info.path);
      }
      resultados.push(info);
    }

    return resultados;
  }

  private static extrairTrechoDoEndpoint(conteudoFile: string, method: string, path: string): string {
    const dec1 = `app.${method}('${path}'`;
    const dec2 = `app.${method}("${path}"`;
    const dec3 = `app.${method}(\`${path}\``;
    
    let idx = conteudoFile.indexOf(dec1);
    if (idx === -1) idx = conteudoFile.indexOf(dec2);
    if (idx === -1) idx = conteudoFile.indexOf(dec3);
    
    if (idx === -1) return conteudoFile; // Fallback

    let openBraces = 0;
    let started = false;
    let endIdx = idx;

    for (let i = idx; i < conteudoFile.length; i++) {
       if (conteudoFile[i] === '{') {
          openBraces++;
          started = true;
       } else if (conteudoFile[i] === '}') {
          openBraces--;
       }

       endIdx = i;

       if (started && openBraces === 0) {
          if (i + 1 < conteudoFile.length && conteudoFile[i+1] === ')') endIdx = i + 1;
          if (i + 2 < conteudoFile.length && conteudoFile[i+2] === ';') endIdx = i + 2;
          break;
       }
    }

    return conteudoFile.substring(idx, endIdx + 1);
  }
}

// ==========================================
// 2. Camada Serviço IA (Síntese)
// ==========================================

export class AIAnalysisService {
  private ai: Anthropic;
  private telemetryService?: TelemetryService;

  constructor() {
    this.ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

    let url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    url = url.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

    if (url && key) {
      const supabase = createClient(url, key);
      this.telemetryService = new TelemetryService(supabase);
    }
  }

  public async analyzeEndpoint(trecho: string): Promise<EndpointDoc | null> {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn('⚠️ ANTHROPIC_API_KEY ausente. Simulando resposta da IA (Fallback Local).');
      return {
         descricao: "Endpoint auto-documentado via mock (API Key ausente).",
         requer_auth: true,
         regras_negocio: ["Validar autenticação global", "Processamento isolado"],
         schema_entrada: { "body": "unknown" },
         schema_saida: { "sucesso": "boolean" }
      };
    }

    const startTime = performance.now();

    try {
      const prompt = `Atue como um experiente Arquiteto de Software e Engenheiro de Requisitos Sênior.
Analise com extrema atenção este trecho de código de um endpoint Express.js.
Sua missão é extrair um dossiê analítico e didático de como este endpoint está codificado sob o capô.

Identifique minuciosamente todas as regras ocultas no código:
- Restrições, travas e limites numéricos ou de caracteres.
- Segurança, autenticação, controle de propriedade (ex: "apenas o dono do memorial pode modificar") e regras de RLS implicadas.
- Triggers ou impactos no banco de dados Supabase (Saga pattern, rollback em caso de falha, tabelas alteradas).
- Tratamento de exceções e códigos de status HTTP (o que faz a rota retornar 400, 403, 404, 429 ou 500).

RETORNE EXCLUSIVAMENTE UM OBJETO JSON VÁLIDO. Sem formatação Markdown (como \`\`\`json).
Siga RIGOROSAMENTE a seguinte estrutura em formato JSON:
{
  "descricao": "Explique em português claro, em até duas frases, o propósito exato de negócio desta rota para alguém não-técnico.",
  "requer_auth": booleano,
  "regras_negocio": [
    "Identifique e descreva cada validação de campos obrigatórios, formatos e limites observada.",
    "Descreva a regra exata de controle de acesso, propriedade e RLS observada no código.",
    "Descreva os impactos no banco de dados, transações críticas e mecanismos de rollback mapeados.",
    "Liste as condições exatas que causam erros de validação, limites excedidos ou falha de acesso (com códigos HTTP correspondentes se visíveis)."
  ],
  "schema_entrada": {
    "campo": "tipo esperado (ex: 'UUID obrigatório no body', 'String opcional no params')"
  },
  "schema_saida": {
    "campo_retorno": "tipo e significado (ex: 'Boolean indicando sucesso', 'Array de objetos de auditoria')"
  }
}

CÓDIGO A SER ANALISADO:
${trecho}
`;
      const response = await this.ai.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      });

      const latencyMs = Math.round(performance.now() - startTime);

      // Despacha gravação de telemetria (fire-and-forget, sem bloquear)
      if (this.telemetryService) {
        import('crypto').then(({ randomUUID }) => {
          const operationId = randomUUID();
          this.telemetryService!.registerApiUsage({
            provider: 'anthropic',
            model: 'claude-haiku-4-5',
            feature: 'dev_tools',
            operationId,
            organizationId: undefined,
            memorialId: undefined,
            userId: undefined,
            tokensInput: response.usage?.input_tokens || 0,
            tokensOutput: response.usage?.output_tokens || 0,
            latencyMs,
            status: 'success'
          }).catch(() => {});
        }).catch(() => {});
      }

      let text = (response.content[0] as any).text || '';
      // Limpeza robusta contra markdown wrappers (```json ... ```)
      text = text.replace(/```json/gi, '').replace(/```/gi, '').trim();
      
      const firstBrace = text.indexOf('{');
      const lastBrace = text.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
         text = text.substring(firstBrace, lastBrace + 1);
      }

      try {
         return JSON.parse(text) as EndpointDoc;
      } catch (parseError) {
         console.error('Erro ao fazer parse do JSON retornado pelo Claude. Conteúdo cru retornado:', text);
         throw parseError;
      }

    } catch (error: any) {
      console.error('Erro de Processamento da IA:', error);
      
      if (this.telemetryService) {
        const latencyMs = Math.round(performance.now() - startTime);
        import('crypto').then(({ randomUUID }) => {
          const operationId = randomUUID();
          this.telemetryService!.registerApiUsage({
            provider: 'anthropic',
            model: 'claude-haiku-4-5',
            feature: 'dev_tools',
            operationId,
            organizationId: undefined,
            memorialId: undefined,
            userId: undefined,
            tokensInput: 0,
            tokensOutput: 0,
            latencyMs,
            status: 'error',
            errorMessage: error?.message || String(error)
          }).catch(() => {});
        }).catch(() => {});
      }

      return null;
    }
  }
}

// ==========================================
// 3. Camada de Validação
// ==========================================

export class ValidatorService {
  public static validar(json: any): boolean {
    if (!json || typeof json !== 'object') return false;
    if (typeof json.descricao !== 'string') return false;
    if (typeof json.requer_auth !== 'boolean') return false;
    if (!Array.isArray(json.regras_negocio)) return false;
    return true;
  }
}

// ==========================================
// 4. Camada de Repositório (Base Supabase)
// ==========================================

export class CatalogRepository {
  private supabase: SupabaseClient;

  constructor() {
    let url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    url = url.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
    // Tenta pegar a Service Role Key, se não houver cai pra Anon apenas para mock visual no console
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
    
    this.supabase = createClient(url, key);
  }

  public async saveActiveEndpoint(info: EndpointInfo, doc: EndpointDoc, commitHash: string = 'pre-commit-hash') {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
       console.log(`[SIMULAÇÃO BANCO - UPSERT IGNORADO LOCALMENTE] Rota: ${info.method} ${info.path} | Desc: ${doc.descricao}`);
       return;
    }

    const { error } = await this.supabase
      .from('system_endpoints')
      .upsert({
        path: info.path,
        method: info.method,
        descricao: doc.descricao,
        requer_auth: doc.requer_auth,
        regras_negocio: doc.regras_negocio,
        schema_entrada: doc.schema_entrada,
        schema_saida: doc.schema_saida,
        status: 'ativo',
        commit_hash: commitHash,
        ultima_atualizacao: new Date().toISOString()
      }, { onConflict: 'path,method' });

    if (error) throw error;
  }

  public async deprecateEndpoint(info: EndpointInfo, commitHash: string = 'pre-commit-hash') {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.log(`[SIMULAÇÃO BANCO - DEPRECATE IGNORADO LOCALMENTE] Rota: ${info.method} ${info.path}`);
      return;
    }

    const { error } = await this.supabase
      .from('system_endpoints')
      .update({
        status: 'deprecated',
        commit_hash: commitHash,
        ultima_atualizacao: new Date().toISOString()
      })
      .eq('path', info.path)
      .eq('method', info.method);

    if (error) throw error;
  }
}

// ==========================================
// 5. Orquestrador Pipeline Principal
// ==========================================

export class IngestionPipeline {
  constructor(
    private aiService: AIAnalysisService,
    private repository: CatalogRepository
  ) {}

  public async run() {
    try {
      console.log('🔍 [Suporte Inteligente] Analisando arquivo server.ts via Git...');
      const endpoints = CodeDiffExtractor.extractModifiedEndpoints();
      
      if (endpoints.length === 0) {
        console.log('✅ Nenhuma rota express foi modificada. Pulando documentação autônoma.');
        return;
      }

      console.log(`🚀 [Ingestão] ${endpoints.length} rotas afetadas. Iniciando Análise e Gravação...`);

      for (const info of endpoints) {
        if (info.operacao === 'removido') {
          await this.repository.deprecateEndpoint(info);
          console.log(`⚠️   -> [STATUS DEPRECATED] ${info.method} ${info.path}`);
          continue;
        }

        const doc = await this.aiService.analyzeEndpoint(info.trecho_codigo);
        
        if (doc && ValidatorService.validar(doc)) {
          await this.repository.saveActiveEndpoint(info, doc);
          console.log(`✅  -> [ROTA DOCUMENTADA E SALVA] ${info.method} ${info.path}`);
          console.log(`         Resumo: ${doc.descricao}`);
        } else {
          console.warn(`❌  -> Falha na validação do schema gerado pela IA (ou erro de análise) para: ${info.method} ${info.path}`);
        }

        // ⏱️ Polidez Técnica: Intervalo de 1.5 segundos entre chamadas para proteger limites de cota/taxa
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      console.log('\n🔒 Processo Seguro Finalizado. O histórico no `system_endpoint_versions` ocorrerá nativamente pelas Triggers do Banco.');

    } catch (e) {
      // Regra: "Comportamento do Sistema: O código deve ser defensivo."
      console.error('\n⚠️ FALHA CRÍTICA NÃO BLOQUEANTE: Ocorreu um erro raiz no pipeline de ingestão.');
      console.error(e);
      // "Nunca bloquear o workflow do desenvolvedor localmente"
      process.exit(0); 
    }
  }
}

// ==========================================
// Execução (Bootstrap do Script)
// ==========================================

const pipeline = new IngestionPipeline(new AIAnalysisService(), new CatalogRepository());
pipeline.run();
