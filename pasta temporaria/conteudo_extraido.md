ARQUITETURA RAG

Busca Inteligente para Suporte SaaS

Documento Técnico + Roteiro de Implantação

Versão 1.0  •  Junho 2025

~85%

Redução de tokens

FTS

Postgres nativo

< 200ms

Latência total

17+

Endpoints indexados

1. Visão Geral do Problema

O sistema de suporte atual envia o JSON completo da base de documentação de endpoints a cada pergunta feita pelo atendente. Com 17 endpoints detalhados — cada um contendo descrições técnicas, regras de negócio (Sagas, RLS, validações) e FAQs — esse comportamento gera dois problemas críticos:

Alto custo de tokens: toda a base (~15.000–40.000 tokens) é enviada mesmo quando a pergunta envolve apenas 1 ou 2 endpoints.

Respostas excessivamente técnicas: sem filtragem, a IA recebe e pode repetir IDs internos, nomes de tabelas, políticas de RLS e logs, expondo a 'cozinha' técnica ao cliente final.

Objetivo: implementar uma estratégia de Retrieval-Augmented Generation (RAG) usando Full-Text Search nativo do PostgreSQL/Supabase para selecionar apenas o contexto necessário antes de chamar a API da Anthropic.

2. Estratégia de Indexação: Por Que FTS?

Para o volume atual de 17 endpoints, a solução recomendada é Full-Text Search (FTS) nativo do PostgreSQL, com possibilidade de migrar para busca híbrida com pgvector futuramente.

Critério

FTS (tsvector)

pgvector (embeddings)

Recomendação

Complexidade de setup

Baixa — nativo no Postgres

Média-alta — requer pipeline

FTS ✓

Custo operacional

Zero adicional

Custo de embedding API por doc

FTS ✓

Qualidade semântica

Ótima para termos técnicos

Excelente para linguagem natural

Empate

Latência de busca

~5–15 ms

~50–150 ms

FTS ✓

Volume ideal

Até ~500 documentos

Qualquer escala

FTS ✓ agora

Escalabilidade futura

Limitada

Alta

pgvector depois

Decisão arquitetural: implemente FTS agora. Quando o número de endpoints superar 100 ou surgirem perguntas muito ambíguas que errem o retrieval, adicione pgvector como camada de reranking — sem mudar a arquitetura base.

3. Arquitetura do Fluxo RAG

O fluxo completo possui 5 etapas sequenciais, substituindo o envio de toda a base por um ciclo enxuto de recuperação e geração:

Etapa

Descrição

01 — Pergunta do Atendente

O atendente digita uma dúvida em linguagem natural no painel de suporte.

02 — Keyword Extractor

O SupportService extrai os termos técnicos relevantes da pergunta (nomes de endpoints, entidades, ações).

03 — FTS no Supabase

A função RPC search_endpoints executa websearch_to_tsquery e retorna os top 2–3 endpoints mais relevantes com score de relevância.

04 — Context Builder

Os documentos retornados são sanitizados: IDs, nomes de tabelas, políticas RLS e logs internos são removidos. Apenas regras de negócio e FAQs voltadas ao usuário final são mantidas.

05 — API Anthropic

Um prompt enxuto (~800–2.000 tokens de contexto) é enviado com a persona 'Sofia' e o contexto filtrado. A resposta é empática e comercial.

3.1 Estrutura de Componentes

O SupportService.ts é dividido em quatro responsabilidades independentes:

Função

Responsabilidade

retrieveRelevantDocs()

Chama supabase.rpc('search_endpoints') e retorna os documentos rankeados.

sanitizeDoc()

Remove campos técnicos sensíveis (IDs, rls_notes, tabelas) antes de enviar à IA.

buildContextBlock()

Serializa os documentos sanitizados em texto estruturado para o prompt.

answerSupportQuestion()

Orquestra o fluxo completo: busca → sanitização → prompt → resposta.

4. Sistema de Persona e Tom de Voz

Um dos pontos mais críticos da implementação é garantir que a IA mantenha precisão técnica sem expor detalhes internos. Isso é resolvido com um system prompt de persona fixa.

Regras da persona 'Sofia':

• Linguagem clara, empática e profissional — nunca técnica ou fria.

• Nunca mencionar nomes de tabelas, IDs internos, logs ou estrutura de banco.

• Se a documentação cobrir a dúvida: responder com confiança e objetividade.

• Se não cobrir: 'Não tenho essa informação agora, mas posso escalar para o time técnico.'

• Máximo de 4 parágrafos curtos ou lista de até 5 itens por resposta.

• Sempre encerrar com uma ação clara para o atendente.

A separação entre system prompt (persona estática) e mensagem do usuário (contexto dinâmico) é intencional. O contexto vai como mensagem user — não no system — para facilitar debug e manter a persona isolada de atualizações na documentação.

5. Impacto no Custo de Tokens

Cenário

Tokens de Entrada

Tokens de Saída

Custo Relativo

Antes (JSON completo)

15.000 – 40.000

800 – 2.000

100% (baseline)

Depois (RAG com FTS)

800 – 2.000

300 – 600

~5–12%

Redução estimada

85 – 95%

50 – 70%

Economia real

A economia na saída é consequência do system prompt restritivo (max_tokens: 600) que força respostas curtas e objetivas, adequadas para um painel de suporte.

6. Roteiro de Implantação

O roteiro está dividido em 4 fases independentes. Cada fase pode ser validada antes de avançar para a próxima.

01

Preparação do Banco de Dados (Supabase)

Duração estimada: 30–60 minutos

6.1.1 Verificar estrutura da tabela

Confirme que a tabela endpoint_docs possui os campos name, description, business_rules (JSONB) e faqs (JSONB). Se necessário, ajuste os nomes no script SQL abaixo.

6.1.2 Executar a migration SQL

No SQL Editor do Supabase, execute:

-- Habilita FTS com índice GIN

ALTER TABLE endpoint_docs

  ADD COLUMN IF NOT EXISTS search_vector tsvector

  GENERATED ALWAYS AS (

    to_tsvector('portuguese',

      coalesce(name, '') || ' ' ||

      coalesce(description, '') || ' ' ||

      coalesce(business_rules::text, '') || ' ' ||

      coalesce(faqs::text, '')

    )

  ) STORED;

CREATE INDEX IF NOT EXISTS idx_endpoint_docs_fts

  ON endpoint_docs USING GIN(search_vector);

-- Função RPC para busca rankeada

CREATE OR REPLACE FUNCTION search_endpoints(

  query_text text, match_count int DEFAULT 3)

RETURNS TABLE (id uuid, name text, description text,

               business_rules jsonb, faqs jsonb, rank real)

LANGUAGE sql STABLE AS $$

  SELECT id, name, description, business_rules, faqs,

    ts_rank(search_vector,

      websearch_to_tsquery('portuguese', query_text)) AS rank

  FROM endpoint_docs

  WHERE search_vector @@

    websearch_to_tsquery('portuguese', query_text)

  ORDER BY rank DESC LIMIT match_count;

$$;

Validação da Fase 1: Execute no SQL Editor: SELECT * FROM search_endpoints('autenticação', 3); — deve retornar os endpoints mais relevantes para o termo buscado.

02

Configuração do Projeto TypeScript

Duração estimada: 20–30 minutos

6.2.1 Instalar dependências

npm install @supabase/supabase-js @anthropic-ai/sdk

npm install -D typescript @types/node

6.2.2 Configurar variáveis de ambiente

Adicione ao arquivo .env (nunca commitar no repositório):

SUPABASE_URL=https://seu-projeto.supabase.co

SUPABASE_SERVICE_KEY=eyJ...   # Service Role Key

ANTHROPIC_API_KEY=sk-ant-...

6.2.3 Criar o arquivo SupportService.ts

Crie o arquivo em src/services/SupportService.ts com o código completo fornecido na seção anterior. O arquivo possui quatro funções principais:

retrieveRelevantDocs(question) — busca FTS no Supabase

sanitizeDoc(doc) — filtra campos técnicos sensíveis

buildContextBlock(docs) — monta o bloco de contexto para o prompt

answerSupportQuestion(question, history) — função exportada principal

Atenção: use SUPABASE_SERVICE_KEY (Service Role), não a chave anon. A Service Role ignora RLS e garante que o serviço de suporte acesse todos os endpoints independente de políticas de usuário.

03

Integração com o Controller de Suporte

Duração estimada: 30–45 minutos

6.3.1 Criar o endpoint de suporte

No seu controller (Express, Fastify, NestJS ou equivalente):

import { answerSupportQuestion } from

  '../services/SupportService';

app.post('/support/ask', async (req, res) => {

  const { question, history } = req.body;

  const answer = await answerSupportQuestion(

    question, history ?? []

  );

  res.json({ answer });

});

6.3.2 Formato do payload

Campo

Descrição

question (string, obrigatório)

Pergunta do atendente em linguagem natural.

history (array, opcional)

Array de { role, content } com o histórico da conversa atual. Não inclui documentação — apenas as trocas de mensagens.

6.3.3 Gestão do histórico de conversa

O histórico deve ser mantido no front-end ou em memória de sessão. A cada resposta recebida, adicione o par pergunta/resposta ao array history antes de enviar a próxima mensagem. Não persista o histórico em banco de dados por padrão — isso evita custos desnecessários e vazamentos de contexto entre atendentes.

04

Testes, Validação e Monitoramento

Duração estimada: 1–2 horas

6.4.1 Testes funcionais obrigatórios

Cenário de Teste

Resultado Esperado

Pergunta diretamente relacionada a 1 endpoint

Retorna apenas aquele endpoint no contexto; resposta objetiva e correta.

Pergunta ambígua envolvendo 2 endpoints

Retorna os 2 endpoints mais relevantes; resposta cobre ambos sem contradição.

Pergunta sem relação com nenhum endpoint

Retorna 'Nenhuma documentação relevante'; Sofia oferece escalar para o time técnico.

Pergunta que menciona IDs ou nomes de tabela

A resposta da IA NÃO deve conter nenhum ID, nome de tabela ou detalhe de RLS.

Conversa com histórico de 5+ turnos

O contexto é mantido; a resposta é coerente com as mensagens anteriores.

6.4.2 Métricas de monitoramento

Instrumente as seguintes métricas a partir do primeiro dia em produção:

Tokens de entrada por requisição — meta: < 2.500 tokens

Tokens de saída por requisição — meta: < 600 tokens

Latência total (FTS + API) — meta: < 3 segundos

Taxa de 'fallback' (nenhum doc encontrado) — meta: < 5% das perguntas

Avaliação de satisfação do atendente (thumbs up/down) — meta: > 80% positivos

Dica de logging: grave no banco o número de documentos retornados pelo FTS, o rank do primeiro resultado e os tokens consumidos. Com 2 semanas de dados, você terá evidência suficiente para decidir se vale adicionar pgvector.

7. Próximos Passos e Evolução

Quando considerar

Evolução recomendada

Taxa de fallback > 10%

Adicionar pgvector para busca semântica em perguntas ambíguas.

Número de endpoints > 100

Implementar busca híbrida: FTS para triagem + embeddings para reranking.

Atendentes pedem respostas em múltiplos idiomas

Adicionar parâmetro locale na função RPC e ajustar o to_tsvector para o idioma correto.

Volume de perguntas > 10.000/mês

Adicionar cache Redis para perguntas frequentes (TTL de 1h).

Necessidade de feedback estruturado

Implementar pipeline de fine-tuning com os pares pergunta/resposta avaliados pelos atendentes.

8. Checklist de Implantação

Marque cada item conforme avançar na implantação:

#

Item

☐  1

Migration SQL executada com sucesso no Supabase (coluna search_vector + índice GIN + função RPC).

☐  2

Função search_endpoints testada manualmente no SQL Editor com pelo menos 5 termos diferentes.

☐  3

Arquivo .env configurado com SUPABASE_URL, SUPABASE_SERVICE_KEY e ANTHROPIC_API_KEY.

☐  4

SupportService.ts criado e compilando sem erros de TypeScript.

☐  5

Endpoint POST /support/ask criado e retornando resposta em ambiente local.

☐  6

Todos os 5 cenários de teste da Fase 4 validados e aprovados.

☐  7

Nenhuma resposta da IA contendo IDs internos, nomes de tabelas ou detalhes de RLS.

☐  8

Métricas de tokens e latência instrumentadas e visíveis no painel de monitoramento.

☐  9

Deploy em produção realizado com variáveis de ambiente configuradas corretamente.

☐ 10

Baseline de tokens coletado na primeira semana para comparação de custo.

Resultado esperado após implantação completa: 

Redução de 85–95% no custo de tokens de entrada, respostas empáticas e comerciais sem exposição de detalhes técnicos internos, e uma arquitetura preparada para escalar com pgvector quando necessário.