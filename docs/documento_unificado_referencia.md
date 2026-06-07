# 📖 Bíblia do Sistema: Arquitetura, SaaS (Camada 1), Suporte Inteligente e Telemetria de APIs

Este documento unifica e consolida o conteúdo técnico de três pilares de referência do projeto **Ecos de Memórias**:
1.  **Suporte Inteligente e Arquitetura de IA (Sofia):** Antes localizado em `docs/suporte/documento_suporte.md`.
2.  **Roteamento Semântico, Economia B2B e Rastreabilidade (SaaS):** Antes localizado em `docs/saas/camada1.md`.
3.  **Gerência de APIs, Custos e Telemetria de Infraestrutura:** Antes localizado em `docs/gerencia_api/documento_gerencia_api.md`.

*Os arquivos originais permanecem intactos nos seus respectivos diretórios.*

---

# PARTE 1: ARQUITETURA DE SUPORTE INTELIGENTE (SOFIA)

> **Filosofia Central:** Código faz o trabalho mecânico. IA faz o trabalho intelectual. Banco guarda a verdade.

## 1.1 — Contexto e Filosofia de Desenvolvimento

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
    "ciclo nasce in 1",
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

## 1.2 — Arquitetura RAG com Busca Inteligente (FTS) — Baseline (RAG v1)

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

## 1.3 — Visão do Ecossistema Evoluído

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

## 1.4 — Os 6 Consensos Inegociáveis

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

## 1.5 — Pilares da Arquitetura

### Hierarquia de Inteligência (Orquestrador)
O objetivo do Orquestrador é rotear cada pergunta para a camada mais econômica capaz de respondê-la de forma correta e segura.

#### Intent Router (Classificador de Intenção)
O classificador **não utiliza LLM**. Funciona por **regex + FTS** a custo zero. Se utilizasse LLM, faríamos duas chamadas de IA desnecessariamente. 
Ele classifica em:
*   **Financeiro:** "cobrança", "fatura", "reembolso", "plano", "upgrade", "downgrade".
*   **Técnico:** "erro", "bug", "não funciona", "endpoint", "integração".
*   **Onboarding:** "como começo", "primeiro acesso", "configurar", "tutorial".
*   **Diagnóstico:** "memorial_id", "ID do cliente", "log", "rastrear".
*   **Geral:** Categoria de fallback (padrão).

#### Camada 1 — FAQ Estruturado
*   **Busca:** Utiliza FTS + similaridade por trigrama (pg_trgm) na tabela `faq_estruturado`.
*   **Fluxo:** Se houver match com score acima do threshold estabelecido, retorna a resposta curada instantaneamente, sem passar pela IA.
*   **Promoção:** Os registros entram no FAQ apenas após aprovação humana no Dashboard de Curadoria.

#### Camada 2 — Motor Técnico (RAG v1)
*   **Busca:** Busca FTS atualizada no `system_endpoints` através do `SupportService.ts`.
*   **Fluxo:** Acionado apenas se a Camada 1 não obtiver match confiável.
*   **Resultado:** Responde e calcula um *Confidence Score* associado.

---

### Diagnóstico com Segurança — O "Detetive"
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

*   O mapa de mapeamento local (ex: `CLIENTE_REF_001` -> "João Silva") é mantido apenas em memória durante o ciclo da requisição, sendo destruído logo em seguida.

#### DiagnosticService (Camada 3)
Busca logs atômicos filtrados por `memorial_id`, executa o `Data Sanitizer` localmente, envia o log limpo para a IA e devolve o diagnóstico técnico traduzido de forma simples ao atendente.

---

### Loop de Melhoria Contínua — O "Aprendiz"
Garante que o ecossistema fique mais inteligente de forma autônoma sem necessitar de contínuas alterações de código.

#### Tabela `perguntas_nao_frequentes`
Registra de forma automática toda pergunta onde o *Confidence Score* foi menor que 0.50 ou quando nenhuma camada conseguiu responder.

#### Clustering Semântico
Para evitar que o time humano sofra com gargalos na curadoria revisando variações da mesma pergunta, o sistema executa um agrupamento utilizando embeddings locais leves (ex: Cosine Similarity > 0.82). 
*   O curador humano visualiza o cluster através de uma **pergunta canônica** (a mais central do grupo) e aprova a resposta para todas as variações agrupadas simultaneamente.

---

### Escalada Humana e SLA
Controla o redirecionamento de fluxos inconclusivos para supervisores técnicos em tempo real.

#### Confidence Score (Híbrido)
Calculado com base em:
1.  Relevância (`rank` do FTS).
2.  Presença ou ausência de match no FAQ.
3.  Auto-avaliação da própria IA (avaliação de consistência).

#### Regra de Direcionamento
*   **Confidence ≥ 0.80:** Responde diretamente ao atendente.
*   **Confidence 0.50–0.79:** Responde exibindo um alerta ("Verificar dados antes de repassar").
*   **Confidence < 0.50:** Registra na tabela `escaladas` e notifica o supervisor.

#### Níveis de SLA de Escalada
| Prioridade | Condição | Tempo para Alerta | Tempo Limite para Resposta |
|---|---|---|---|
| **Alta** | Confiança = 0 + cliente VIP | Imediato | 5 minutos |
| **Média** | Confiança < 0.50 | 2 minutos | 15 minutos |
| **Baixa** | Confiança 0.50–0.79 | 5 minutos | 30 minutos |

---

## 1.6 — Decisões de Design e Tensões

| Decisão | Escolha | Alternativa Descartada | Motivo |
|---|---|---|---|
| **Classificador de Intenção** | Regex + FTS | LLM Classificador | Custo zero, suficiente para 4-6 categorias fixas. |
| **Matching de FAQ** | FTS + Trigram | Embeddings via API | Menor complexidade operacional para a volumetria atual. |
| **Sanitização de Logs** | Local (Regex) antes da IA | Enviar logs brutos | LGPD / Contratos de confidencialidade B2B. |
| **Embeddings de Curadoria** | Modelo local leve | API externa (OpenAI/Anthropic) | Custo zero em produção, dados sensíveis não saem da máquina. |
| **Confiança da IA** | Rank FTS + Auto-avaliação | Apenas auto-avaliação | Auto-avaliação isolada é instável; o FTS fornece base sólida. |

### Debate Aberto: Claude Haiku vs. Gemini Flash
*   **Claude Haiku:** Custos de ~$0.00025 (input) / ~$0.00125 (output) por 1k tokens. Utiliza o mesmo SDK já instalado, facilitando a manutenção e reduzindo pontos de falha.
*   **Gemini Flash:** Custos mais baixos de ~$0.000075 (input) / ~$0.0003 (output) por 1k tokens. Exige a instalação e suporte a um segundo SDK na stack.
*   **Recomendação:** Avaliar o custo ponderado real com o FAQ implementado (onde 70% das chamadas são FAQ custo zero) antes de fragmentar a stack de desenvolvimento.

---

# PARTE 2: ROTEAMENTO SEMÂNTICO, ECONOMIA B2B E RASTREABILIDADE (SAAS CAMADA 1)

## 2.1 — A Matriz dos 4 Pilares de Rastreabilidade

Para garantir que o banco escale, o sistema divide os logs em quatro tabelas exclusivas:
*   **Pilar 1: `eventos_geracao` (Telemetria Técnica):** Rastreia tokens usados, modelo de IA e custo. (Ativo na Camada 1).
*   **Pilar 2: `memorial_audit_logs` (Auditoria de Negócio):** Rastreia ações humanas sobre o memorial (edições, geração, downgrade). (Ativo na Camada 1).
*   **Pilar 3: `credit_transactions` (Ledger Financeiro):** Movimentação de créditos e pacotes da funerária. (Camada 2).
*   **Pilar 4: `admin_audit_logs` (Governança):** Ações dos Super Admins (bloqueios, ajustes). (Camada 3).

### Diretrizes Técnicas da Tabela de Auditoria
A tabela `memorial_audit_logs` segue três princípios Enterprise:
1.  **Padrão Polimórfico (`entity_type`):** Audita qualquer evento (`narrativa`, `audio`, `galeria`) na mesma tabela.
2.  **Slowly Changing Dimension (`plano_snapshot`):** Congela o nome e o status do plano no momento da ação via JSON, protegendo o histórico caso o plano mude no futuro.
3.  **Append-Only Ledger:** É terminantemente proibido usar `UPDATE` ou `DELETE`. A auditoria é construída apenas via `INSERT`.

---

## 2.2 — O Motor Semântico e Controle de Estado (Frontend / IA)

### Captura de Estado e Imutabilidade
Ao carregar a biografia, grave o estado inicial num objeto imutável. Esse snapshot nunca muda até um sucesso confirmado do backend:
```javascript
initialSnapshot = { tone: "rustico", size: "curta", plan: "basic", voice: "feminina", instruction: "" }
```
*   **Rebaseamento:** Apenas atualize o `initialSnapshot = { ...currentState }` após resposta 200 do backend. Nunca antes, para evitar "mudanças fantasmas".

### Níveis de Roteamento Semântico
A ordem de verificação é obrigatória:
*   **Nível 1 (REBUILD):** Se o tom ou o tamanho mudar. Descarta o texto atual, envia os fatos raiz e a IA reconstrói do zero. Consome 1 edição.
*   **Nível 2 (REFINE):** Se houver apenas uma instrução nova. Envia o texto atual + instrução. A IA refina sem voltar aos fatos. Consome 1 edição.
*   **Nível 3 (SILENT):** Alterações de dados secundários. Apenas `UPDATE` no banco. **Proibido** tocar no LLM ou TTS. Custo: zero créditos.

### Segregação Absoluta de Mídia e Texto
*   **Botão "Gerar Biografia":** Chama *exclusivamente* o LLM para texto. É **proibido** tocar na ElevenLabs aqui.
*   **Botão "Gerar Timeline" (Áudio):** Único ponto autorizado a chamar o TTS e lidar com arquivos `.mp3`.
*   **Regra de 1 MP3 por Memorial:** O sistema deve remover o arquivo antigo e sobrescrever no mesmo path (`/memorials/{id}/timeline.mp3`). Não crie arquivos paralelos.

---

## 2.3 — Governança de Áudio: Permissões, Mapeamento e Telemetria (TTS)

Para garantir o controle de acesso financeiro e operacional aos recursos de locução, o motor de áudio segue as seguintes regras de governança:

1.  **Estrutura de Permissão por Plano (`audio_tier`)**:
    *   **Plano Básico**: `audio_tier: 'basic'`
    *   **Plano Premium**: `audio_tier: 'premium'`
    *   **Plano Enterprise**: `audio_tier: 'enterprise'`

2.  **Mapeamento de Modelos Google Cloud TTS por Nível**:
    *   **Nível `basic` (Vozes Standard/Wavenet)**:
        *   `pt-BR-Standard-A` ou `FEMALE` -> Mapeia para `pt-BR-Wavenet-A` (Feminina)
        *   `pt-BR-Standard-B` ou `MALE` -> Mapeia para `pt-BR-Wavenet-B` (Masculina)
    *   **Nível `premium` (Vozes Journey/Expressivas)**:
        *   `pt-BR-Journey-F` ou `FEMALE_C` -> Mapeia para `pt-BR-Journey-F` (Feminina Expressiva)
        *   `pt-BR-Journey-D` ou `MALE_D` -> Mapeia para `pt-BR-Journey-D` (Masculina Profunda)
    *   **Nível `enterprise` (Vozes Neural/HD/ElevenLabs)**:
        *   `elevenlabs-alice` -> Mapeia para ElevenLabs Alice (ou fallback Journey-F se indisponível)
        *   `elevenlabs-marcus` -> Mapeia para ElevenLabs Marcus (ou fallback Journey-D se indisponível)
        *   `elevenlabs-sarah` -> Mapeia para ElevenLabs Sarah (ou fallback Journey-F se indisponível)

3.  **Endpoint de Consulta de Permissões (O Juiz na Interface)**:
    O endpoint `GET /api/memorial/:id/voice-permissions` retorna as vozes liberadas e bloqueadas baseadas no `audio_tier` do memorial, guiando a renderização na UI.

4.  **Tratamento Defensivo e Fallback da ElevenLabs**:
    Caso a chave `ELEVENLABS_API_KEY` esteja ausente no `.env`, o serviço automaticamente redireciona a chamada para o Google Cloud Journey correspondente (`pt-BR-Journey-F`/`D`), emitindo alerta de console sem quebrar a UI.

5.  **Telemetria de Consumo de Áudio**:
    A locução é registrada no `support_metrics` contendo:
    *   `pergunta`: ID da narrativa.
    *   `categoria`: `'AudioGeneration'`
    *   `tokens_input`: Quantidade de caracteres enviados.
    *   `tokens_output`: Segundos de áudio (ou `1` para sucesso).
    *   `latencia_ms`: Latência total da síntese.
    *   `endpoint_retornado`: Modelo final utilizado.
    *   `fts_rank`: Nível do plano (1=basic, 2=premium, 3=enterprise).

---

## 2.4 — Economia B2B, Ciclo de Contratos e Regras de Negócio

*   **Carteira Global (`walletBalance`):** Saldo em créditos armazenado temporariamente no `user_metadata` da autenticação para compra de memoriais e upgrades.
*   **Franquia de Edições (`edits_used` / Limite):** Controla o uso do memorial. O débito ocorre apenas após sucesso da IA.
*   **Ciclo de Contratos (`ciclo_contrato_plano`):** Incrementado quando a franquia esgota e o usuário faz uma nova compra de créditos para reabrir edições.

### As 4 Travas de Mudança de Plano
*   **A. Downgrade Bloqueado (Prevenção de Fraude):** Aborta (HTTP 400) se as gerações consumidas excederem o limite do novo plano menor.
*   **B. Downgrade Dentro do Ciclo (Estorno Justo):** Permite mudança, devolve diferença de créditos à carteira, limpa mídias antigos e mantém o contador de edições.
*   **C. Upgrade Dentro do Ciclo (A Colher de Chá):** Cobra apenas a diferença de preço entre planos. O histórico de edições é levado e o ciclo não muda.
*   **D. Upgrade Novo Ciclo (A Nova Compra):** Se o limite atual estiver esgotado, cobra-se o preço CHEIO do novo plano. O contador de edições é zerado (`0`) e o `ciclo_contrato_plano` incrementa (+1).

---

# PARTE 3: GERÊNCIA DE APIS, CUSTOS E TELEMETRIA (FASE 0)

## 3.1 — Visão Geral da Telemetria de APIs

Para monitorar os custos com Inteligência Artificial (LLMs e TTS), coletamos e persistimos dados de consumo de rede e APIs em uma tabela centralizada no Supabase chamada `support_metrics`. Ela serve como um cockpit financeiro, permitindo que a administração da plataforma analise a margem de cada plano de assinatura B2B frente aos custos de consumo reais.

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

## 3.2 — Governança e Regras de Negócio de Consumo

### O Backend como "Juiz" (Segurança e Autorização)
Toda a lógica de autorização e segurança do consumo de APIs ocorre exclusivamente no backend (Node.js/Express). 

*   **Princípio da Validação Estrita (Zero Confiança no Client)**:
    *   A rota `/api/narrativas/audio` recebe o ID da narrativa e a voz solicitada.
    *   O backend consulta o plano ativo do memorial associado e extrai a permissão `audio_tier`.
    *   O backend valida se a voz solicitada é compatível com o `audio_tier` permitido. Se houver tentativa de burla via chamada direta à API, a transação é abortada com `HTTP 403 Forbidden`, impedindo custos não autorizados.

### Fluxo de Registro de Transação de Áudio
1.  Requisição recebida $\to$ `/api/narrativas/audio`
2.  Validação do `audio_tier` no backend $\to$ Aprovado
3.  Chamada à API TTS (Google Cloud ou ElevenLabs) $\to$ Retorno com sucesso
4.  O `VoiceGovernanceService` invoca o `TelemetryService` para registrar a transação no `support_metrics` com a categoria `'AudioGeneration'`.
5.  Arquivo MP3 salvo e URL gravada no banco $\to$ Retorno HTTP 200 ao cliente.

---

## 3.3 — Estudo de Precificação de APIs (Fase 0)

Para transformar as métricas de quantidade bruta (tokens e caracteres) em dados financeiros reais ($), foi feito o seguinte mapeamento de custos de infraestrutura:

### Tabela de Provedores e Custos Referenciais

| Provedor / API | Modelo ou Voz | Custo de Entrada (Input) | Custo de Saída (Output) | Unidade de Medida |
| :--- | :--- | :--- | :--- | :--- |
| **Anthropic** | Claude 3.5 Sonnet | $\$0.003$ | $\$0.015$ | por $1.000$ tokens |
| **Anthropic** | Claude 3 Haiku | $\$0.00025$ | $\$0.00125$ | por $1.000$ tokens |
| **Google Cloud IA** | Gemini 1.5 Flash | $\$0.000075$ | $\$0.0003$ | por $1.000$ tokens |
| **Google Cloud TTS** | Standard (Vozes A/B) | $\$0.000004$ | — | por caractere ($\$4.00$/M) |
| **Google Cloud TTS** | Wavenet / Journey | $\$0.000016$ | — | por caractere ($\$16.00$/M) |
| **ElevenLabs** | Vozes HD / Alice | $\$0.00018$ | — | por caractere (média) |

### Implementação do Cálculo de Custos (Opção Dinâmica)
Criamos a tabela `api_pricing_catalog` no Supabase e associamos à `support_metrics` através da View SQL `view_support_metrics_costs`.
*   **Fórmula da View:** 
    $$\text{custo} = (\text{tokens\_input} \times \text{preco\_unitario\_input}) + (\text{tokens\_output} \times \text{preco\_unitario\_output})$$
*   **Vantagem:** Permite que qualquer alteração de preços das APIs seja atualizada diretamente na tabela, recalculando todo o histórico financeiro da plataforma automaticamente, sem necessidade de alterações no código-fonte.
