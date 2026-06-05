# 📖 DOCUMENTAÇÃO MASTER — ECOS DE MEMÓRIAS

**Arquitetura, Roteamento Semântico, Economia B2B e Rastreabilidade (Audit Trail)**

---

## PARTE 1: FUNDAÇÃO E RASTREABILIDADE (BANCO DE DADOS)

*A base de dados estruturada para suportar múltiplos atores sem perder integridade histórica.*

### 1.1 — A Matriz dos 4 Pilares de Rastreabilidade

Para garantir que o banco escale, o sistema divide os logs em quatro tabelas exclusivas.

* **Pilar 1: `eventos_geracao` (Telemetria Técnica):** Rastreia tokens usados, modelo de IA e custo. (Ativo na Camada 1).
* **Pilar 2: `memorial_audit_logs` (Auditoria de Negócio):** Rastreia ações humanas sobre o memorial (edições, geração, downgrade). (Ativo na Camada 1).
* **Pilar 3: `credit_transactions` (Ledger Financeiro):** Movimentação de créditos e pacotes da funerária. (Camada 2).
* **Pilar 4: `admin_audit_logs` (Governança):** Ações dos Super Admins (bloqueios, ajustes). (Camada 3).

### 1.2 — Diretrizes Técnicas da Tabela de Auditoria

A tabela `memorial_audit_logs` segue três princípios Enterprise:

1. **Padrão Polimórfico (`entity_type`):** Audita qualquer evento (`narrativa`, `audio`, `galeria`) na mesma tabela.
2. **Slowly Changing Dimension (`plano_snapshot`):** Congela o nome e o status do plano no momento da ação via JSON, protegendo o histórico caso o plano mude no futuro.
3. **Append-Only Ledger:** É terminantemente proibido usar `UPDATE` ou `DELETE`. A auditoria é construída apenas via `INSERT`.

### 1.3 — Estrutura SQL (Criação)

```sql
-- 1. Coluna de leitura rápida no estado atual
ALTER TABLE narrativas ADD COLUMN IF NOT EXISTS plano_na_geracao text DEFAULT 'basico';

-- 2. Tabela de Auditoria Polimórfica
CREATE TABLE memorial_audit_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memorial_id     uuid NOT NULL REFERENCES memoriais(id),
  entity_type     text NOT NULL, 
  entity_id       uuid,          
  actor_id        uuid,          
  actor_role      text NOT NULL, 
  action_type     text NOT NULL, 
  plano_snapshot  jsonb,         
  payload         jsonb,         
  created_at      timestamptz DEFAULT now()
);

-- Índices e Segurança
CREATE INDEX idx_memorial_audit_memorial ON memorial_audit_logs(memorial_id);
CREATE INDEX idx_memorial_audit_entity   ON memorial_audit_logs(entity_type, entity_id);
ALTER TABLE memorial_audit_logs ENABLE ROW LEVEL SECURITY;

```

---

## PARTE 2: O MOTOR SEMÂNTICO E CONTROLE DE ESTADO (FRONTEND / IA)

*Como o aplicativo controla o fluxo de dados para não alucinar e não desperdiçar tokens.*

### 2.1 — Captura de Estado e Imutabilidade

Ao carregar a biografia, grave o estado inicial num objeto imutável. Esse snapshot nunca muda até um sucesso confirmado do backend.

```javascript
initialSnapshot = { tone: "rustico", size: "curta", plan: "basic", voice: "feminina", instruction: "" }

```

* **Rebaseamento:** Apenas atualize o `initialSnapshot = { ...currentState }` após resposta 200 do backend. Nunca antes, para evitar "mudanças fantasmas".

### 2.2 — Níveis de Roteamento Semântico

A ordem de verificação é obrigatória.

* **Nível 1 (REBUILD):** Se o tom ou o tamanho mudar. Descarta o texto atual, envia os fatos raiz e a IA reconstrói do zero. Consome 1 edição.
* **Nível 2 (REFINE):** Se houver apenas uma instrução nova. Envia o texto atual + instrução. A IA refina sem voltar aos fatos. Consome 1 edição.
* **Nível 3 (SILENT):** Alterações de dados secundários. Apenas `UPDATE` no banco. **Proibido** tocar no LLM ou TTS. Custo: zero créditos.

### 2.3 — Segregação Absoluta de Mídia e Texto

* **Botão "Gerar Biografia":** Chama *exclusivamente* o LLM para texto. É **proibido** tocar na ElevenLabs aqui.
* **Botão "Gerar Timeline" (Áudio):** Único ponto autorizado a chamar o TTS e lidar com arquivos `.mp3`.
* **Regra de 1 MP3 por Memorial:** O sistema deve remover o arquivo antigo e sobrescrever no mesmo path (`/memorials/{id}/timeline.mp3`). Não crie arquivos paralelos.

### 2.4 — Governança de Áudio: Permissões, Mapeamento e Telemetria (TTS)

Para garantir o controle de acesso financeiro e operacional aos recursos de locução, implementamos as seguintes regras de governança e negócios para o motor de áudio:

1. **Estrutura de Permissão por Plano (`audio_tier`)**:
   Cada plano/inscrição no sistema possui um nível de acesso de áudio configurado através do campo `audio_tier` no objeto de configuração do plano:
   * **Plano Básico**: `audio_tier: 'basic'`
   * **Plano Premium**: `audio_tier: 'premium'`
   * **Plano Enterprise**: `audio_tier: 'enterprise'`

2. **Mapeamento de Modelos Google Cloud TTS por Nível**:
   * **Nível `basic` (Vozes Standard/Wavenet)**:
     * `pt-BR-Standard-A` ou `FEMALE` -> Mapeia para `pt-BR-Wavenet-A` (Feminina)
     * `pt-BR-Standard-B` ou `MALE` -> Mapeia para `pt-BR-Wavenet-B` (Masculina)
   * **Nível `premium` (Vozes Journey/Expressivas)**:
     * `pt-BR-Journey-F` ou `FEMALE_C` -> Mapeia para `pt-BR-Journey-F` (Feminina Expressiva)
     * `pt-BR-Journey-D` ou `MALE_D` -> Mapeia para `pt-BR-Journey-D` (Masculina Profunda)
   * **Nível `enterprise` (Vozes Neural/HD/ElevenLabs)**:
     * `elevenlabs-alice` -> Mapeia para ElevenLabs Alice (ou fallback Journey-F se indisponível)
     * `elevenlabs-marcus` -> Mapeia para ElevenLabs Marcus (ou fallback Journey-D se indisponível)
     * `elevenlabs-sarah` -> Mapeia para ElevenLabs Sarah (ou fallback Journey-F se indisponível)

3. **Endpoint de Consulta de Permissões (O Juiz na Interface)**:
   Criaremos o endpoint `GET /api/memorial/:id/voice-permissions` para que a interface (SaaS e Cliente) consulte a autoridade do backend para renderizar o layout dinamicamente:
   * **Entrada**: ID do memorial no path.
   * **Saída**: Retorna a lista de vozes disponíveis e a flag `locked: boolean` correspondente a cada uma, baseada no `audio_tier` do plano ativo do memorial.
   * **Segurança**: Garante que o layout consuma o estado real calculado no backend, isolando a verificação de segurança.

4. **Tratamento Defensivo e Fallback da ElevenLabs**:
   * A geração de voz ElevenLabs requer chaves pagas (`ELEVENLABS_API_KEY`).
   * **Regra de Fallback Resiliente**: Caso a API Key esteja ausente no `.env`, o serviço de síntese no backend deve automaticamente redirecionar a chamada para a voz correspondente do Google Cloud Journey (`pt-BR-Journey-F`/`D`), registrando um aviso no console e garantindo que o usuário consiga concluir o processo sem falhas de tela.

5. **Telemetria de Consumo de Áudio (UsageLogger no `support_metrics`)**:
   * O pipeline de áudio é integrado ao `UsageLogger` (Fase 0) para registrar o consumo de locução como uma transação auditável.
   * Ao sintetizar um áudio, o sistema grava na tabela `support_metrics` um registro de auditoria contendo:
     * `pergunta`: Identificador da narrativa (`narrativa_id`).
     * `categoria`: `'AudioGeneration'`
     * `tokens_input`: Quantidade de caracteres de texto enviados para síntese.
     * `tokens_output`: Segundos de áudio gerados (ou `1` para indicar evento com sucesso).
     * `latencia_ms`: Latência total da requisição de síntese.
     * `endpoint_retornado`: Modelo/voz final utilizado (ex: `pt-BR-Journey-F`).
     * `fts_rank`: Nível do plano do memorial (1=basic, 2=premium, 3=enterprise).

6. **Diretrizes de Layout e UI (Controle de Visualização e Bloqueios)**:
   * **Sinalização Visual de Bloqueio (Locks)**: O layout do painel de geração ([SaasGerarBiografia.tsx](file:///C:/Users/Edi%20Nascimento/antigravity/Ecos-de-Mem%C3%B3ria/src/pages/saas/SaasGerarBiografia.tsx)) e do cliente ([GestaoMemorial.tsx](file:///C:/Users/Edi%20Nascimento/antigravity/Ecos-de-Mem%C3%B3ria/src/pages/GestaoMemorial.tsx)) deve refletir visualmente as vozes indisponíveis com base no plano ativo.
   * **Comportamento do Botão de Voz**: Vozes com nível superior ao `audio_tier` do memorial devem apresentar um ícone de cadeado (`Lock`) e aparecer desabilitadas ou opacas.
   * **Fluxo de Upgrade (CTA)**: Ao clicar ou passar o cursor sobre uma voz bloqueada, um banner contextual ou modal de "Gerenciar Plano" deve ser oferecido, guiando o atendente ou cliente a realizar o upgrade para liberar aquela qualidade.

7. **Remoção do Desvio de Mock**:
   * O desvio temporário (`mockUrl`) no endpoint `/api/narrativas/audio` deve ser desativado ou encapsulado por flag ambiental para habilitar testes da lógica de mapeamento e consumo real de API.

### 2.5 — Detecção de Estado Incompleto e Trava de Segurança no Dashboard

Para evitar que memoriais fiquem em estado inconsistente (com texto gerado, mas sem áudio ativo), o sistema implementa uma barreira de segurança no SaaS Dashboard e na tela de geração:

1. **Definição de Estado Incompleto**: Um memorial está em estado incompleto se possui uma narrativa com `conteudo_completo` e `status_publicacao = 'rascunho'` (ou se `audio_url` está nula/vazia ou `audio_status` marcado como `'failed'`).
2. **Bloqueio de Ações no Dashboard**: No painel de controle (`SaasDashboard.tsx`), os botões de "QR Code" e "Visualizar Timeline" correspondentes a esse memorial devem ser desabilitados, exibindo um aviso explicativo.
3. **Alerta Visual e Atalho (Sino Vermelho)**: Deve ser renderizado um ícone de sino de notificação vermelho (`Bell`) ao lado da foto do homenageado (à direita do avatar). Clicar neste sino redireciona o operador para a tela de geração do memorial correspondente.
4. **Entrada Direta em Leitura**: Ao acessar a tela de geração vindo de um estado incompleto, o frontend deve carregar diretamente a etapa de aprovação de áudio (`etapa = 'leitura'`), exibindo o texto existente.
5. **Trava de Edição Esgotada**: Na Etapa de Leitura, se o contador `edits_used` for igual ou superior a `edits_limit`, o botão de "Voltar e Re-escrever" deve ser desabilitado/bloqueado via interface, permitindo apenas a geração do áudio ou exigindo upgrade de plano.
6. **Debate Futuro sobre Proporção de Geração de Texto**: Como o custo de processamento de texto (LLM) é significativamente menor que o de áudio (TTS), avalia-se para o futuro a possibilidade de permitir de 2 a 3 gerações de texto para contabilizar apenas 1 crédito de edição consumido. Esta regra está pendente de debate comercial e técnico, mantendo-se a cobrança de 1 para 1 no momento.

---

## PARTE 3: ECONOMIA B2B, CICLO DE CONTRATOS E REGRAS DE NEGÓCIO

*A inteligência financeira e de proteção contra abusos estruturada em Ciclos de Vida e Transações Node.js.*

### 3.1 — Duas Economias Independentes e Ciclo de Contratos

- **Carteira Global (`walletBalance`):** Saldo armazenado no `user_metadata` da autenticação para compra de planos.
- **Franquia de Edições (`edits_used` / Limite):** Limite de gerações por memorial (ex: Básico = 3 edições). Debitar edição *apenas* após sucesso (200 OK) do LLM.
- **Ciclo de Contratos (`ciclo_contrato_plano`):** Cada memorial possui um contador embutido que inicia em `1`. Este número só é incrementado quando o limite de uso do plano atual é totalmente esgotado e o cliente precisa realizar uma **Nova Compra**.

### 3.2 — As 4 Travas de Mudança de Plano

O motor financeiro no backend (Node.js/Express) avalia o estado atual do memorial (`edits_used` vs. Limite do Plano) e classifica a intenção de mudança em quatro caminhos absolutos:

* **A. Downgrade Bloqueado (Prevenção de Fraude):**
  * *Condição:* Usuário tenta ir para um plano menor, mas já consumiu gerações iguais ou superiores ao limite do plano destino.
  * *Ação:* Transação abortada (HTTP 400). Nenhuma alteração financeira ou no banco ocorre.

* **B. Downgrade Dentro do Ciclo (Estorno Justo):**
  * *Condição:* Edições utilizadas são menores que o limite do plano destino.
  * *Ação:* Plano é rebaixado, diferença financeira é devolvida à carteira, contador de edições permanece intacto, arquivo `.mp3` sofre Hard Delete, ciclo permanece o mesmo.

* **C. Upgrade Dentro do Ciclo (A Colher de Chá):**
  * *Condição:* Usuário quer um plano maior e *ainda possui* saldo de gerações no plano atual.
  * *Ação:* Cobra-se apenas a diferença financeira na carteira global. O contador de edições não é zerado (leva o histórico), ciclo permanece o mesmo.

* **D. Upgrade Novo Ciclo (A Nova Compra):**
  * *Condição:* O contrato atual foi esgotado (`edits_used` >= Limite Atual).
  * *Ação:* Cobra-se o preço CHEIO do novo plano. O contador de edições é ZERADO (`0`), e o `ciclo_contrato_plano` sofre auto-incremento (+1). 

### 3.3 — Destruição de Mídia e Arquivamento de Texto (Hard Delete MP3)

Se um plano for alterado e o memorial já possuir biografia:

1. A biografia em texto original é **arquivada** (`status_publicacao: 'arquivado'`).
2. O arquivo de áudio (`.mp3`) **é deletado fisicamente (Hard Delete)** do bucket de storage.
3. A URL do áudio é apagada no banco de dados.
4. O sistema insere o log de `mudanca_plano` no `memorial_audit_logs`, gravando as travas e impactos financeiros.

### 3.4 — Segurança de Dados: Transação no Backend (Node.js)

Para evitar vazamentos de regras de negócios no banco, toda a lógica de alteração de plano, cobrança na carteira Auth (`user_metadata`) e inserção de logs (`AuditService`) ocorre **exclusivamente via transações no Node.js (Express)**, assegurando que o `user_metadata` acompanhe as alterações das tabelas atômicas e não use funções RPC exclusivas de banco, separando a persistência da lógica financeira. Há triggers de segurança no banco de dados para proteção (como `guard_ciclo`), garantindo a anti-regressão do contrato.

---

## PARTE 4: ARQUITETURA DE PRODUÇÃO E VALIDAÇÃO

### 4.1 — Os 3 Endpoints Oficiais

Nenhum endpoint pode invadir a responsabilidade do outro:

1. `POST /api/narrativas/generate`: LLM, Roteador Semântico (Rebuild/Refine/Silent).
2. `POST /api/timeline/generate`: TTS, Google TTS, MP3.
3. `POST /api/memorial/change-plan`: Downgrade, As 4 Travas Financeiras, Ciclo de Contratos, Reembolso, Hard Delete de Mídia.

### 4.2 — O Padrão Saga e Isolamento de Carteira

Nenhuma rota Express tem permissão para acessar o Supabase Auth diretamente para manipulação de saldo. Todas as rotas financeiras (como criação de memorial e mudança de plano) DEVEM passar obrigatoriamente pelo `SagaExecutor.execute()` que coordena a transação e consome o `WalletService`. O `WalletService` atua como uma Facade que isola a dívida técnica atual (carteira residindo no `user_metadata`), e deve conter os comentários explicativos de migração `@camada2` sinalizando que, no futuro, isso migrará para uma tabela transacional própria.

### 4.3 — Checklist Unificado de Validação (Antes do Deploy)

* [x] Coluna `plano_na_geracao` criada na tabela de narrativas.
* [x] Tabela `memorial_audit_logs` criada e testada.
* [x] Serviço `AuditService.ts` implementado com trava `isCritical`.
* [x] Rota de Geração injeta carimbo de auditoria no final do fluxo.
* [x] *Hard Delete* de áudio aplicado na Mudança de Plano (apaga-se o `.mp3`, arquiva-se apenas o texto em `narrativas`).
* [x] *Snapshot* capturado ao abrir a tela e preservado no `sessionStorage`.
* [x] *Snapshot* rebaseia apenas após `200 OK` do backend.
* [x] Roteador Semântico aciona REBUILD, REFINE e SILENT corretamente.
* [x] *Universal Reset:* Alteração manual no texto oculta o áudio antigo e exige nova geração.
* [x] Backend bloqueando o downgrade se o editsUsed for excedido para os limites do plano futuro.
* [x] Motor "As 4 Travas" encapsulado no Express para orquestração da Carteira via `user_metadata`.

---

## PARTE 5: INSTRUMENTAÇÃO DE TELEMETRIA DO SAAS (TEXTO E ÁUDIO)

Esta seção especifica a integração do núcleo SaaS B2B com a telemetria unificada de custos de APIs.

### 5.1 — Geração de Narrativas Biográficas (`memorial_text`)
*   **Serviço:** `NarrativaService.ts`
*   **Modelo de IA:** `claude-sonnet-4-6`
*   **Ações:** Nos fluxos de **REBUILD** (reconstrução do zero a partir de dados brutos) e **REFINE** (ajuste pontual a partir de uma instrução), o backend Express deve herdar ou criar um `operation_id` e invocar a gravação no `TelemetryService` após o retorno do Claude.

#### Exemplo de Integração do Método:
```typescript
async generateNarrativa(params: {
    memorialId: string;
    funeralHomeId: string;
    userId: string;
    routingLevel: 'REBUILD' | 'REFINE' | 'SILENT';
    prompt: string;
}): Promise<{ narrativa: string; operationId: string }> {
    if (params.routingLevel === 'SILENT') {
        return { narrativa: '', operationId: '' }; // Custo zero, sem chamada
    }

    const operationId = createOperationId();
    const startTime   = Date.now();

    try {
        const response = await this.anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 2048,
            messages: [{ role: 'user', content: params.prompt }],
        });

        const latencyMs    = Date.now() - startTime;
        const tokensInput  = response.usage.input_tokens;
        const tokensOutput = response.usage.output_tokens;
        const narrativa    = response.content[0].type === 'text' ? response.content[0].text : '';

        // Registrar custo no TelemetryService
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
            metadata: { routing_level: params.routingLevel }
        });

        return { narrativa, operationId };
    } catch (error: any) {
        const latencyMs = Date.now() - startTime;
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
            errorMessage:  error.message || 'unknown',
            metadata: { routing_level: params.routingLevel }
        }).catch(e => console.error('[NarrativaService] Falha dupla', e));
        throw error;
    }
}
```

---

### 5.2 — Síntese de Voz / Timeline de Áudio (`memorial_audio`)
*   **Serviço:** `TimelineService.ts`
*   **Modelos de Locução:** Google Cloud TTS (Standard/Journey) ou ElevenLabs.
*   **Ações:** Registrar o consumo bruto de caracteres na chamada do TTS, herdando o `operation_id` da geração de texto caso tenham sido disparados em cadeia.

#### Exemplo de Integração do Método:
```typescript
async generateAudio(params: {
    memorialId: string;
    funeralHomeId: string;
    userId: string;
    narrativaText: string;
    modelVoz: string;           -- ex: 'pt-BR-Journey-F', 'elevenlabs-alice'
    operationId?: string;
}): Promise<{ audioUrl: string }> {
    const operationId = params.operationId ?? createOperationId();
    const startTime   = Date.now();
    const provider: 'google' | 'elevenlabs' = params.modelVoz.startsWith('elevenlabs') ? 'elevenlabs' : 'google';

    try {
        const audioBuffer = await this.callTtsProvider(provider, params.modelVoz, params.narrativaText);
        const latencyMs   = Date.now() - startTime;
        const charactersInput = params.narrativaText.length;

        // Registrar consumo no TelemetryService
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
            status:        'success',
            metadata: { audio_tier: provider === 'elevenlabs' ? 'enterprise' : 'standard' }
        });

        const audioUrl = await this.saveAudioToStorage(params.memorialId, audioBuffer);
        return { audioUrl };
    } catch (error: any) {
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
            errorMessage:  error.message || 'unknown'
        }).catch(e => console.error('[TimelineService] Falha dupla', e));
        throw error;
    }
}
```

---

## PARTE 6: LIVRO DE CONDOLÊNCIAS E REFATORAÇÃO DE QR CODES (B2B ISOLADO)

*Estrutura técnica para a implementação do Livro de Condolências Mobile e gerenciamento de QR Codes sem impactar a frente B2C.*

### 6.1 — Isolamento de Rotas e Telas de UI

*   **Página de Condolências (Visitante):** Fica sob o caminho `/saas/m/:id/condolencias` (implementada em `/src/pages/saas/SaasCondolenciasVisitante.tsx`). O design é mobile-first, limpo e voltado a alta conversão no velório.
*   **Moderação de Mensagens (Funerária):** Acessível sob `/saas/memorial/:id/mensagens` (ou como modal em `/src/pages/saas/SaasModeracaoMensagens.tsx`), permitindo aprovar ou ocultar condolências em conformidade com o design corporativo B2B do SaaS.
*   **Regra Inviolável:** Nenhum arquivo das frentes Cultural/B2C (`/src/pages/PublicMemorial.tsx` e `/src/pages/MensagensModeracao.tsx`) pode ser editado.

### 6.2 — Lógica de RLS e Governança de Mensagens

A tabela `mensagens_visitantes` é mantida como a fonte de dados unificada para as mensagens. As políticas de RLS serão atualizadas para suportar multi-tenancy corporativo:

```sql
-- Atualização das políticas de RLS para a tabela mensagens_visitantes
DROP POLICY IF EXISTS "Usuario aprova mensagens dos seus memoriais" ON mensagens_visitantes;

CREATE POLICY "Permissao de moderacao de mensagens (Dono e Funeraria)" ON mensagens_visitantes
FOR ALL TO authenticated
USING (
  auth.uid() = (SELECT user_id FROM memoriais WHERE id = memorial_id)
  OR
  EXISTS (
    SELECT 1 FROM organization_users ou
    JOIN memoriais m ON m.organization_id = ou.organization_id
    WHERE m.id = mensagens_visitantes.memorial_id
      AND ou.auth_user_id = auth.uid()
      AND ou.ativo = true
  )
);
```

### 6.3 — Comportamento de Auto-Geração de QR Codes e Impressão

*   **Geração Silenciosa:** Ao abrir o modal de QR Code ([Saas_QrCodeModal.tsx](file:///c:/Users/Edi%20Nascimento/antigravity/Ecos-de-Mem%C3%B3ria/src/components/saas/Saas_QrCodeModal.tsx)), o sistema verifica se os QR codes do tipo `velorio` e `lapide` já existem. Caso contrário, dispara requisições assíncronas para criá-los automaticamente.
*   **Ação de Impressão:** O botão "Imprimir" ativa o layout de impressão CSS (`@media print`) para renderizar os dois QR codes formatados em uma folha A4 com molduras e títulos prontos para uso físico.

### 6.4 — Resiliência de Erros e UX Confortante

*   Todas as chamadas de envio de mensagens no formulário do visitante devem capturar falhas (rede ou banco de dados) de forma graciosa.
*   Em caso de erro, a tela exibirá uma mensagem de conforto ("Agradecemos sua homenagem. Ela foi salva localmente e será atualizada em breve") em vez de expor mensagens de erro técnicas do banco ou stack traces de rede.

### 6.5 — Controle de Duplicidade, Período de Vida e Visualização Ampliada (Lightbox)

*   **Bloqueio de Multi-envios por Dispositivo:** Para mitigar envios duplicados, a página do visitante gera um identificador único de dispositivo (`ecos_device_id`) salvo em `localStorage` e em cookie persistente. Ao carregar a página, se não houver a trava do `localStorage`, o cliente realiza uma busca via RPC seguro no banco de dados (`check_device_message_exists`) que verifica em tempo de execução se já houve alguma mensagem associada ao par `memorial_id` / `device_id` (ignorando RLS).
*   **Idade e Período de Vida:** A data de nascimento e óbito são exibidas por completo no formato brasileiro (dd/mm/aaaa) no cabeçalho da página de condolências, e o tempo de vida total é apresentado utilizando a lógica de cálculo unificada (`calculateLifespan`).
*   **Lightbox de Foto:** Ao clicar na imagem de perfil do homenageado, um modal overlay é renderizado em tela cheia com desfoque de fundo (`backdrop-blur-sm`), bordas suaves e zoom animado, o qual é fechado com um novo clique.
*   **Diretriz Estética das Mensagens (Avatar & Alternância de Cores):** Para manter a solenidade e evitar desvios visuais inadequados (como expressões de alegria ou fotos fora do contexto), não permitiremos fotos de perfil para os visitantes. Em vez disso, cada mensagem exibe um avatar redondo com as iniciais do autor. O design utiliza um esquema de cores alternado (mensagens ímpares recebem uma tonalidade de fundo e as pares recebem outra) para criar ritmo e clareza visual.


```

---

## PARTE 7: GOVERNANÇA DE ERROS E TRAVA DE INATIVIDADE (ITEM 6)

*Tratamento defensivo para APIs externas e bloqueio rígido de escrita/geração em memoriais suspensos ou excluídos.*

### 7.1 — Trava de Inatividade e Exclusão (Preventiva)

Para evitar consumo de tokens de processamento ou gravação inconsistente em memoriais que não estão ativos, o backend Express valida os status antes de realizar chamadas às APIs de IA (Claude) ou síntese de voz (Google Cloud TTS / ElevenLabs):
1. **Status Verificados:** `deleted_at` (soft-delete), `status` (estado geral) e `status_memorial` (fluxo de etapas).
2. **Regra de Bloqueio:** Se `deleted_at IS NOT NULL` ou `status = 'suspenso'` ou `status_memorial = 'suspenso'`, o backend rejeita a chamada imediatamente com `HTTP 403 Forbidden` e retorna a mensagem amigável: `"Geração bloqueada: Este memorial está inativo, suspenso ou foi excluído."`.
3. **Endpoints Impactados:** 
   * `POST /api/narrativas/generate` (Geração completa de texto via LLM)
   * `POST /api/narrativas/adjust` (Refinamento pontual de texto via LLM)
   * `POST /api/narrativas/audio` (Síntese de voz via TTS)

### 7.2 — Dicionário de Mensagens Amigáveis e Comercialização

Os erros capturados nas conexões de rede ou chamadas de APIs externas são interceptados e mapeados pela classe `ErrorMapper` antes de serem expostos na UX. Isso oculta mensagens técnicas complexas (como stack traces de rede ou erros 400 da Anthropic) e exibe orientações acolhedoras:

| Código de Erro | Categoria Técnica | Status HTTP | Mensagem de UX Exposta |
|---|---|---|---|
| **`NETWORK_ERROR`** | Falha de conexão física, DNS ou timeout | `503` | "Falha de conexão: Não foi possível conectar aos servidores de inteligência artificial. Verifique sua conexão de internet e tente novamente." |
| **`AI_API_OUT_OF_BALANCE`** | Claude out of balance / quota limit | `402` | "O serviço de redação biográfica está temporariamente indisponível devido a limite de cota de processamento da API de IA. Por favor, tente novamente em alguns instantes." |
| **`AI_API_AUTH_ERROR`** | Chave de API Claude inválida/expirada | `500` | "Falha na autenticação do serviço de inteligência artificial (credenciais expiradas). O suporte técnico já foi notificado." |
| **`GEMINI_API_LIMIT`** | Limites / billing excedidos no Gemini | `402` | "O serviço de processamento está temporariamente indisponível por limite de cota da API Gemini. Tente novamente mais tarde." |
| **`GEMINI_API_AUTH_ERROR`** | Credenciais Gemini Vertex inválidas | `500` | "Falha de autenticação no serviço do provedor Gemini. O suporte técnico foi notificado." |
| **`ELEVENLABS_API_LIMIT`** | Limite de cota/saldo na ElevenLabs | `402` | "Limite de locução premium excedido no provedor ElevenLabs. O suporte foi notificado." |
| **`ELEVENLABS_API_AUTH_ERROR`** | Credencial ElevenLabs inválida/expirada | `500` | "Falha de credenciais com o provedor de vozes premium ElevenLabs. O suporte técnico foi notificado." |
| **`VOICE_DEPRECATED`** | Voz do Google TTS/Eleven descontinuada | `400` | "A voz de locução selecionada está desativada, descontinuada ou indisponível. Por favor, selecione outra voz nas configurações e tente gerar o áudio novamente." |
| **`GOOGLE_TTS_LIMIT`** | Limite diário de cota no Google TTS | `402` | "O serviço de locução por áudio atingiu a cota diária permitida de caracteres. O suporte técnico já foi notificado." |
| **`UNKNOWN_API_ERROR`** | Erro genérico/inesperado não mapeado | `500` | "Ocorreu um erro inesperado no processamento: [Mensagem técnica original]" |

### 7.3 — Rastreabilidade e Alertas de Auditoria (Super Admin)

Se a falha técnica classificada for **Crítica** (`isCritical = true`), indicando inoperabilidade operacional do sistema (como exaustão financeira de cotas ou chaves de API expiradas no backend):
1. O backend aciona o `AuditService.logEvent` com `isCritical = false` para registrar silenciosamente o incidente.
2. **Log Gravado:** Inserido na tabela polimórfica `memorial_audit_logs`.
   * `entity_type: 'sistema'`
   * `actor_role: 'system'`
   * `action_type: 'critico_api'`
   * `payload: { error_code, error_message, is_critical: true, endpoint }`
3. Essa infraestrutura append-only permite que painéis de monitoramento internos ou robôs de suporte notifiquem o Super Admin do sistema em tempo real sobre a falta de saldo/saldo baixo ou expiração de credenciais das APIs de terceiros.

---

## PARTE 8: RESET DE MEMORIAL (UNIVERSAL RESET) E REGRAS DE CICLO (ITEM 10)

*Lógica de reinicialização de dados de entrevista, rascunhos e mídias, preservando a integridade das interações sociais e gerenciando cobranças adicionais de ciclos de contrato.*

### 8.1 — Preservação de Condolências vs. Limpeza de Entrevista
Ao realizar o reset de um memorial, a integridade do livro de visitas e interações comunitárias B2B deve ser mantida intocada:
1. **Dados Preservados:** Mensagens recebidas no livro de condolências (`mensagens_visitantes`) e configurações de moderação do memorial (`permitir_mensagens` e `auto_aprovar_mensagens`).
2. **Dados Limpos/Arquivados:**
   - **Respostas:** Deletadas fisicamente (Hard Delete) da tabela `respostas`.
   - **Narrativas:** Arquivadas com `status_publicacao: 'arquivado'` e campos de áudio definidos como `null` (`audio_url = null`, `audio_status = null`).
   - **Locução Física:** O arquivo `.mp3` correspondente no bucket de storage do Supabase é deletado fisicamente (Hard Delete) para evitar custos extras de armazenamento.
3. **Estado Inicial:** O status do memorial (`status`) e seu fluxo de etapas (`status_memorial`) retornam respectivamente para `'rascunho'` e `null` para permitir reiniciar a entrevista de captação de dados do zero.

### 8.2 — Economia de Créditos e Ciclos de Edição
O reset de dados e reinício de entrevista é regido pelo consumo de cota de alterações de texto e áudio (`edits_used` vs. `edits_limit` do plano ativo do memorial):
1. **Caso edições disponíveis no ciclo atual (`edits_used < edits_limit`):**
   - O reset é **gratuito** (custo = 0 créditos).
   - O contador de edições usadas (`edits_used`) e o ciclo (`ciclo_contrato_plano`) permanecem os mesmos.
2. **Caso edições esgotadas no ciclo atual (`edits_used >= edits_limit`):**
   - O reset exige uma **nova compra** do mesmo plano ativo (renovação de ciclo contratual).
   - **Custo:** Preço cheio do plano do memorial (`basico = 2`, `premium = 4`, `enterprise = 6` créditos).
   - O valor correspondente é descontado da carteira global do usuário autenticado no backend Express usando o `SagaExecutor` transacional. Caso não haja saldo, o reset é bloqueado e retorna erro.
   - O contador de edições usadas é zerado (`edits_used = 0`) e o ciclo contratual é incrementado (`ciclo_contrato_plano = ciclo_contrato_plano + 1`).

### 8.3 — Ledger de Auditoria Financeira e Ações
Toda ação de reset deve ser auditada e persistida de forma polimórfica e imutável na tabela `memorial_audit_logs` contendo:
* `entity_type: 'memorial'`
* `action_type: 'reset_memorial'`
* `plano_snapshot: { plano_geracao, ciclo_anterior, novo_ciclo }`
* `payload: { custo_creditos, ciclo_renovado, edits_used_snapshot, edits_limit_snapshot, new_wallet_balance }`

---

# ECO DE MEMÓRIAS
## Camada 1 — Atualização V2
### Novos módulos: Notificações, FotoLink, Respostas Parciais e Auditoria de Biografia

---

> **Contexto**
> Este documento é um adendo à Camada 1 original.
> Todos os itens aqui descritos são implementados na Camada 1.
> Quando a Camada 2 for iniciada este documento serve de referência para ajustes de billing e créditos relacionados.

---

# MÓDULO 1 — CONTROLE DE RESPOSTAS PARCIAIS

## Problema resolvido

Quando um memorial tem múltiplos familiares recebendo links de perguntas o sistema atual marca o status como `respostas_recebidas` assim que o primeiro familiar responde. Isso é incorreto. O memorial só pode avançar para geração de biografia quando todos os familiares convidados tiverem concluído.

---

## Novos campos na tabela `memoriais`

```sql
ALTER TABLE memoriais
  ADD COLUMN IF NOT EXISTS total_invites_criados    integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_invites_concluidos integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS origem_sistema           text DEFAULT 'saas';
  -- projeto_cultural | saas
```

---

## Novo status no fluxo do memorial

O campo `status_memorial` ganha um novo valor intermediário:

```
rascunho
  → aguardando_respostas    (links enviados, ninguém respondeu ainda)
  → respostas_parciais      (pelo menos um respondeu, outros pendentes)
  → respostas_recebidas     (todos os familiares concluíram)
  → gerado
  → publicado
```

---

## Lógica corrigida no backend

Arquivo: `server.ts` — rota `POST /api/public/invite/:token/respostas`

Após salvar as respostas do familiar o sistema deve:

```typescript
// 1. Contar total de invites criados para este memorial
const { count: totalCriados } = await supabase
  .from('question_invites')
  .select('*', { count: 'exact' })
  .eq('memorial_id', invite.memorial_id)
  .not('perguntas_ids', 'cs', '["TRANSFERENCIA_CONTROLE"]')

// 2. Contar total de invites concluídos
const { count: totalConcluidos } = await supabase
  .from('question_invites')
  .select('*', { count: 'exact' })
  .eq('memorial_id', invite.memorial_id)
  .eq('status', 'concluido')
  .not('perguntas_ids', 'cs', '["TRANSFERENCIA_CONTROLE"]')

// 3. Determinar status correto
const novoStatus = totalConcluidos >= totalCriados
  ? 'respostas_recebidas'
  : 'respostas_parciais'

// 4. Atualizar memorial
await supabase.from('memoriais').update({
  status_memorial: novoStatus,
  total_invites_criados: totalCriados,
  total_invites_concluidos: totalConcluidos,
  total_perguntas_respondidas: total_respondidas
}).eq('id', invite.memorial_id)
```

---

## Trava no botão de gerar biografia

O botão de gerar biografia só fica ativo quando `status_memorial = 'respostas_recebidas'`.

```typescript
const podeGerar = memorial.status_memorial === 'respostas_recebidas'

const motivoBloqueio: Record<string, string> = {
  'aguardando_respostas': 'Nenhum familiar respondeu ainda',
  'respostas_parciais': `Aguardando ${memorial.total_invites_criados - memorial.total_invites_concluidos} familiar(es) responder`
}
```

---

## Badge clicável no painel da funerária

Quando o status for `respostas_parciais` o badge na lista de memoriais exibe a fração e é clicável.

**Comportamento visual:**

| Status | Badge | Clicável |
|---|---|---|
| aguardando_respostas | `Enviado / Aguardando` amarelo | Não |
| respostas_parciais | `Respostas: 1/3` laranja | Sim |
| respostas_recebidas | `Respostas: 3/3 ✓` azul | Sim |
| gerado / publicado | `Finalizado / Biografia Criada` verde | Não |

**Popover ao clicar no badge:**

```
┌─────────────────────────────────────────┐
│ Respostas dos Familiares         [X]    │
│ Memorial: [nome_homenageado]            │
├─────────────────────────────────────────┤
│ ✅ Maria Silva (esposa)                 │
│    Respondeu há 2 horas                 │
├─────────────────────────────────────────┤
│ ⏳ Carlos Silva (filho)                 │
│    Acessou o link — não concluiu        │
│    [Reenviar link]                      │
├─────────────────────────────────────────┤
│ 🔴 Ana Silva (filha)                    │
│    Não acessou ainda                    │
│    [Reenviar link]                      │
├─────────────────────────────────────────┤
│ 7 de 20 perguntas respondidas           │
│ ▓▓▓░░░░░░░░░░  35%                     │
└─────────────────────────────────────────┘
```

**Estados de cada familiar baseados no `question_invite.status`:**

| Status do invite | Exibição |
|---|---|
| pendente | 🔴 Não acessou ainda |
| acessado | ⏳ Acessou — não concluiu |
| concluido | ✅ Respondeu |
| expirado | ❌ Link expirado — [Reenviar] |

---

## Migração dos memoriais existentes

```sql
-- Memoriais do projeto cultural recebem origem correta
UPDATE memoriais
SET origem_sistema = 'projeto_cultural'
WHERE organization_id IS NULL
  AND family_account_id IS NULL;

-- Memoriais do SaaS já existentes
UPDATE memoriais
SET origem_sistema = 'saas'
WHERE organization_id IS NOT NULL;
```

---

## Critério de conclusão do Módulo 1

- [ ] Campos adicionados na tabela memoriais
- [ ] Migração de origem_sistema executada
- [ ] Status respostas_parciais funcionando
- [ ] Primeiro familiar que responde não marca como concluído
- [ ] Apenas quando todos concluem marca respostas_recebidas
- [ ] Badge clicável exibe popover com estado de cada familiar
- [ ] Botão gerar biografia bloqueado com mensagem correta
- [ ] Botão reenviar link funciona por familiar individual

---

# MÓDULO 2 — SISTEMA DE NOTIFICAÇÕES EM TEMPO REAL

## Problema resolvido

O agente funerário não sabe em tempo real quando um familiar responde as perguntas. Precisa ficar recarregando o painel manualmente para ver atualizações. O sistema de notificações resolve isso com alertas automáticos via Supabase Realtime.

---

## Dois componentes independentes

**Toast** — aparece e some automaticamente quando um evento ocorre. Feedback imediato.

**Sino** — fica no header do painel, acumula todos os eventos, mostra histórico completo ao clicar.

---

## Tabela `organization_notifications`

```sql
CREATE TABLE organization_notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) NOT NULL,
  memorial_id     uuid REFERENCES memoriais(id),
  invite_id       uuid REFERENCES question_invites(id),
  tipo            text NOT NULL,
  -- resposta_parcial | todos_responderam | link_expirado
  -- foto_enviada | memorial_pronto | link_foto_expirado
  titulo          text NOT NULL,
  mensagem        text NOT NULL,
  lida            boolean DEFAULT false,
  created_at      timestamp DEFAULT now()
);

CREATE INDEX idx_org_notif_organization ON organization_notifications(organization_id);
CREATE INDEX idx_org_notif_memorial     ON organization_notifications(memorial_id);
CREATE INDEX idx_org_notif_lida         ON organization_notifications(lida);
CREATE INDEX idx_org_notif_created      ON organization_notifications(created_at);

ALTER TABLE organization_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_org_isolation ON organization_notifications
  FOR ALL USING (
    organization_id = auth.get_user_organization()
  );
```

---

## Quando notificações são geradas

No backend, após salvar respostas de familiar:

```typescript
// Resposta parcial — ainda tem familiares pendentes
if (pendentes > 0) {
  await supabase.from('organization_notifications').insert({
    organization_id: memorial.organization_id,
    memorial_id: invite.memorial_id,
    invite_id: invite.id,
    tipo: 'resposta_parcial',
    titulo: `${invite.destinatario_nome} respondeu as perguntas`,
    mensagem: `${totalConcluidos} de ${totalCriados} familiar(es) concluiu. Aguardando ${pendentes} resposta(s) para liberar a geração.`
  })
}

// Todos responderam — memorial pronto para geração
if (pendentes === 0) {
  await supabase.from('organization_notifications').insert({
    organization_id: memorial.organization_id,
    memorial_id: invite.memorial_id,
    invite_id: invite.id,
    tipo: 'todos_responderam',
    titulo: 'Todos os familiares responderam',
    mensagem: `O memorial de ${memorial.nome_homenageado} está pronto. A biografia pode ser gerada agora.`
  })
}
```

---

## Realtime via Supabase no frontend

```typescript
// Hook useNotificacoes.ts
useEffect(() => {
  const channel = supabase
    .channel('organization_notifications')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'organization_notifications',
      filter: `organization_id=eq.${organization_id}`
    }, (payload) => {
      // Adiciona na lista do sino
      setNotificacoes(prev => [payload.new, ...prev])
      // Dispara toast
      showToast(payload.new)
    })
    .subscribe()

  return () => supabase.removeChannel(channel)
}, [organization_id])
```

---

## Layout do sino no header

```
Header do painel:
[Logo] [Visão Geral] [Famílias] [Faturamento]    [🔔 3] [Avatar]

Ao clicar no sino:
┌─────────────────────────────────────────────┐
│ Notificações                   Marcar lidas │
├─────────────────────────────────────────────┤
│ 🟢 há 5 min                                 │
│ Maria Silva respondeu as perguntas          │
│ Memorial: Jaime Solene                      │
│ Aguardando: Carlos e Ana                    │
├─────────────────────────────────────────────┤
│ 🟢 há 1 hora                                │
│ Carlos Souza respondeu as perguntas         │
│ Memorial: João Bufalo                       │
│ Aguardando mais 1 familiar                  │
├─────────────────────────────────────────────┤
│ 🔵 há 3 horas                               │
│ Todos responderam — Memorial pronto         │
│ Memorial: Miguel Modesto                    │
│ [Gerar biografia →]                         │
└─────────────────────────────────────────────┘
```

---

## Critério de conclusão do Módulo 2

- [ ] Tabela organization_notifications criada com RLS
- [ ] Notificação gerada quando familiar responde
- [ ] Notificação gerada quando todos concluem
- [ ] Supabase Realtime ouvindo inserções
- [ ] Toast aparece e some ao receber evento
- [ ] Sino acumula histórico com badge numérico
- [ ] Marcar todas como lidas funciona
- [ ] Notificação com todos_responderam tem botão de ação direto

---

# MÓDULO 3 — FOTOLINK (UPLOAD DE FOTOS VIA LINK)

## Problema resolvido

A funerária hoje precisa receber as fotos da família por WhatsApp, baixar no celular e fazer upload no sistema. O FotoLink elimina esse processo — a funerária envia um link, a família faz o upload direto do celular, o sistema aplica os limites do plano automaticamente.

---

## Regras de negócio

- A foto de perfil é sempre 1 independente do plano
- O limite da galeria varia por plano do memorial
- Link ativo por 30 dias com múltiplos acessos
- Família pode abrir o link várias vezes — adiciona fotos progressivamente
- Quando o memorial é publicado o link expira automaticamente
- Ao abrir o link a família vê quantas fotos já enviou e quantas ainda cabem

**Limites por plano:**

| Plano | Foto de perfil | Galeria |
|---|---|---|
| Básico | 1 | 5 |
| Premium | 1 | 10 |
| Enterprise | 1 | 15 |

> Valores a confirmar — estes são os valores iniciais de referência.

---

## Tabela `photo_invites`

```sql
CREATE TABLE photo_invites (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memorial_id     uuid REFERENCES memoriais(id) NOT NULL,
  organization_id uuid REFERENCES organizations(id),
  token           text UNIQUE NOT NULL
                  DEFAULT encode(gen_random_bytes(32), 'hex'),
  status          text DEFAULT 'ativo',
  -- ativo | expirado | concluido
  total_acessos   integer DEFAULT 0,
  expira_em       timestamp NOT NULL,
  -- 30 dias por padrão
  -- expira automaticamente ao publicar o memorial
  created_at      timestamp DEFAULT now()
);

CREATE INDEX idx_photo_invites_memorial ON photo_invites(memorial_id);
CREATE INDEX idx_photo_invites_token    ON photo_invites(token);
CREATE INDEX idx_photo_invites_status   ON photo_invites(status);

ALTER TABLE photo_invites ENABLE ROW LEVEL SECURITY;

-- Organização controla seus photo_invites
CREATE POLICY photo_invites_org_control ON photo_invites
  FOR ALL USING (
    organization_id = auth.get_user_organization()
  );

-- Acesso público por token válido
CREATE POLICY photo_invites_public_token ON photo_invites
  FOR SELECT USING (
    status = 'ativo'
    AND expira_em > now()
  );
```

---

## Fluxo completo do FotoLink

**1. Funerária gera o link**

No painel da funerária o botão "Enviar link de fotos" aparece no card do memorial:

```
[Enviar link de perguntas]    [📷 Enviar link de fotos]
```

Backend cria o `photo_invite` e retorna o link:
```
https://app.ecomemorias.com.br/fotos/{token}
```

A funerária compartilha via WhatsApp diretamente do painel.

**2. Família abre no celular**

Rota pública — sem login necessário.
A tela carrega sabendo:
- Nome do homenageado
- Plano contratado e limites
- Fotos já enviadas
- Quantas ainda cabem

**3. Família faz o upload**

Upload direto para Supabase Storage no path:
```
/org_{uuid}/memorial_{uuid}/perfil/foto.jpg
/org_{uuid}/memorial_{uuid}/galeria/foto_01.jpg
/org_{uuid}/memorial_{uuid}/galeria/foto_02.jpg
```

**4. Sistema valida limites**

Antes de aceitar cada upload o backend verifica:
```typescript
// Rota: POST /api/public/fotos/:token/upload
const limitesPlano = {
  basico:     { perfil: 1, galeria: 5  },
  premium:    { perfil: 1, galeria: 10 },
  enterprise: { perfil: 1, galeria: 15 }
}

const plano = memorial.memorial_type?.nome?.toLowerCase() || 'basico'
const limites = limitesPlano[plano]

const totalGaleria = await contarFotosGaleria(memorial_id)

if (tipo === 'galeria' && totalGaleria >= limites.galeria) {
  return res.status(400).json({
    error: `Limite de ${limites.galeria} fotos da galeria atingido para o plano ${plano}.`
  })
}
```

**5. Notificação para a funerária**

Ao receber fotos o sistema gera notificação:
```typescript
await supabase.from('organization_notifications').insert({
  organization_id: memorial.organization_id,
  memorial_id: memorial_id,
  tipo: 'foto_enviada',
  titulo: 'Fotos recebidas',
  mensagem: `A família enviou fotos para o memorial de ${memorial.nome_homenageado}.`
})
```

---

## Rotas do FotoLink

```
POST /api/memoriais/:id/photo-invite/create    → gera o link (autenticado)
GET  /api/public/fotos/:token                  → carrega dados da tela (público)
POST /api/public/fotos/:token/upload           → faz upload das fotos (público)
GET  /api/memoriais/:id/fotos                  → lista fotos do memorial (autenticado)
```

---

## Tela mobile do FotoLink

Design seguindo as diretrizes do MASTER_AGENT seção 8.2 — afetivo, acolhedor, mobile-first.

```
┌─────────────────────────────────┐
│                                 │
│   [Logo Eco de Memórias]        │
│                                 │
│   Fotos de                      │
│   José da Silva                 │
│   ★ 1945 † 2024                 │
│                                 │
│ ─────────────────────────────── │
│                                 │
│   Foto de Perfil                │
│   ┌─────────────────────┐       │
│   │   [+] Adicionar     │       │
│   │   foto principal    │       │
│   └─────────────────────┘       │
│                                 │
│   Galeria de Fotos              │
│   Plano Premium — até 10 fotos  │
│   3 enviadas · 7 disponíveis    │
│                                 │
│   [foto1] [foto2] [foto3]       │
│   [+]     [+]     [+]           │
│                                 │
│   [📷 Adicionar mais fotos]     │
│                                 │
│   Suas fotos são enviadas       │
│   diretamente para a            │
│   plataforma com segurança.     │
│                                 │
└─────────────────────────────────┘
```

---

## pg_cron para expirar photo_invites

```sql
SELECT cron.schedule(
  'expirar-photo-invites',
  '0 4 * * *',
  $$
    UPDATE photo_invites
    SET status = 'expirado'
    WHERE status = 'ativo'
      AND expira_em < now()
  $$
);

-- Expirar quando memorial for publicado
-- Trigger na tabela memoriais
CREATE OR REPLACE FUNCTION expirar_photo_invite_ao_publicar()
RETURNS trigger AS $$
BEGIN
  IF NEW.status_memorial = 'publicado' AND OLD.status_memorial != 'publicado' THEN
    UPDATE photo_invites
    SET status = 'expirado'
    WHERE memorial_id = NEW.id
      AND status = 'ativo';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_expirar_photo_invite
  AFTER UPDATE ON memoriais
  FOR EACH ROW
  EXECUTE FUNCTION expirar_photo_invite_ao_publicar();
```

---

## Critério de conclusão do Módulo 3

- [ ] Tabela photo_invites criada com RLS
- [ ] Botão no painel gera link e retorna URL para compartilhar
- [ ] Tela mobile carrega sem login com dados do memorial
- [ ] Upload valida limite por plano antes de aceitar
- [ ] Foto de perfil substitui a anterior se já existir
- [ ] Galeria bloqueia ao atingir limite do plano
- [ ] Notificação gerada ao receber fotos
- [ ] Link expira em 30 dias automaticamente
- [ ] Link expira ao publicar o memorial
- [ ] Família pode abrir o link múltiplas vezes e ver o que já enviou

---

# MÓDULO 4 — AUDITORIA DE BIOGRAFIA

## Problema resolvido

A tabela `eventos_geracao` é um log técnico de IA — tokens, modelo, custo. Ações humanas sobre a biografia como quem gerou, quem editou, qual plano estava ativo no momento, precisam de uma tabela própria seguindo o princípio de segregação de responsabilidades definido no MASTER_AGENT.

---

## Tabela `biografia_audit_logs`

```sql
CREATE TABLE biografia_audit_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memorial_id   uuid REFERENCES memoriais(id) NOT NULL,
  narrativa_id  uuid REFERENCES narrativas(id),
  autor_id      uuid NOT NULL,
  autor_perfil  text NOT NULL,
  -- super_admin | agency_owner | agency_staff | family_client
  plano_ativo   text,
  -- basico | premium | enterprise
  -- snapshot do plano no momento exato da ação
  tipo_acao     text NOT NULL,
  -- geracao_ia | ajuste_ia | edicao_manual | aprovacao
  -- publicacao | exclusao_audio | downgrade_plano | upgrade_plano
  -- reset_memorial
  descricao     text,
  payload       jsonb,
  -- snapshot de dados relevantes no momento da ação
  created_at    timestamp DEFAULT now()
);

-- Índices
CREATE INDEX idx_bio_audit_memorial ON biografia_audit_logs(memorial_id);
CREATE INDEX idx_bio_audit_autor    ON biografia_audit_logs(autor_id);
CREATE INDEX idx_bio_audit_tipo     ON biografia_audit_logs(tipo_acao);
CREATE INDEX idx_bio_audit_created  ON biografia_audit_logs(created_at);

-- RLS — append-only, nunca UPDATE ou DELETE
ALTER TABLE biografia_audit_logs ENABLE ROW LEVEL SECURITY;

-- Organização lê seus próprios logs
CREATE POLICY bio_audit_org_read ON biografia_audit_logs
  FOR SELECT USING (
    memorial_id IN (
      SELECT id FROM memoriais
      WHERE organization_id = auth.get_user_organization()
    )
  );

-- Apenas o sistema insere — via service role no backend
CREATE POLICY bio_audit_system_insert ON biografia_audit_logs
  FOR INSERT WITH CHECK (true);
```

---

## Quando registrar

```typescript
// AuditService.ts — método logBiografiaAction
await supabase.from('biografia_audit_logs').insert({
  memorial_id,
  narrativa_id,
  autor_id: user.id,
  autor_perfil: user.perfil,
  plano_ativo: memorial.plano_geracao,
  tipo_acao,
  descricao,
  payload: {
    versao: narrativa.versao,
    tokens_usados: tokensInput + tokensOutput,
    motivo: motivo_geracao
  }
})
```

**Deve registrar em:**
- Geração inicial de biografia
- Ajuste pontual de biografia
- Edição manual do texto
- Aprovação da biografia
- Publicação do memorial
- Mudança de plano
- Reset do memorial
- Exclusão de áudio

---

## Separação clara das tabelas de log

| Tabela | Responsabilidade | Quem insere |
|---|---|---|
| `eventos_geracao` | Telemetria técnica de IA — tokens, modelo, custo | Backend após chamada IA |
| `biografia_audit_logs` | Ações humanas sobre a biografia | AuditService no backend |
| `audit_logs` | Ações operacionais das organizações | Backend nas rotas da org |
| `admin_audit_logs` | Ações dos super admins | Backend nas rotas admin |
| `organization_notifications` | Eventos em tempo real para o painel | Backend ao salvar respostas |

---

## Critério de conclusão do Módulo 4

- [ ] Tabela biografia_audit_logs criada
- [ ] RLS configurado — apenas leitura para org, insert via service role
- [ ] AuditService.ts com método logBiografiaAction
- [ ] Geração de biografia registra log
- [ ] Ajuste de biografia registra log
- [ ] Mudança de plano registra log com snapshot do plano anterior
- [ ] Reset de memorial registra log
- [ ] Nunca executa UPDATE ou DELETE nesta tabela

---

# PARTE 2 — BANCO DE DADOS — SCRIPTS DE EXECUÇÃO

## Ordem de execução

```
Bloco A → Campos novos na tabela memoriais
Bloco B → Tabela organization_notifications
Bloco C → Tabela photo_invites
Bloco D → Tabela biografia_audit_logs
Bloco E → RLS e políticas
Bloco F → Triggers e cron jobs
Bloco G → Migração de dados existentes
```

---

### Bloco A — Campos novos em memoriais

```sql
BEGIN;

ALTER TABLE memoriais
  ADD COLUMN IF NOT EXISTS total_invites_criados    integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_invites_concluidos integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS origem_sistema           text DEFAULT 'saas';

CREATE INDEX IF NOT EXISTS idx_memoriais_origem ON memoriais(origem_sistema);

SELECT column_name FROM information_schema.columns
WHERE table_name = 'memoriais'
  AND column_name IN ('total_invites_criados', 'origem_sistema');
-- deve retornar 2 linhas

COMMIT;
```

---

### Bloco B — Tabela organization_notifications

```sql
BEGIN;

CREATE TABLE organization_notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) NOT NULL,
  memorial_id     uuid REFERENCES memoriais(id),
  invite_id       uuid REFERENCES question_invites(id),
  tipo            text NOT NULL,
  titulo          text NOT NULL,
  mensagem        text NOT NULL,
  lida            boolean DEFAULT false,
  created_at      timestamp DEFAULT now()
);

CREATE INDEX idx_org_notif_organization ON organization_notifications(organization_id);
CREATE INDEX idx_org_notif_memorial     ON organization_notifications(memorial_id);
CREATE INDEX idx_org_notif_lida         ON organization_notifications(lida);
CREATE INDEX idx_org_notif_created      ON organization_notifications(created_at);

SELECT COUNT(*) FROM organization_notifications; -- deve retornar 0

COMMIT;
```

---

### Bloco C — Tabela photo_invites

```sql
BEGIN;

CREATE TABLE photo_invites (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memorial_id     uuid REFERENCES memoriais(id) NOT NULL,
  organization_id uuid REFERENCES organizations(id),
  token           text UNIQUE NOT NULL
                  DEFAULT encode(gen_random_bytes(32), 'hex'),
  status          text DEFAULT 'ativo',
  total_acessos   integer DEFAULT 0,
  expira_em       timestamp NOT NULL,
  created_at      timestamp DEFAULT now()
);

CREATE INDEX idx_photo_invites_memorial ON photo_invites(memorial_id);
CREATE INDEX idx_photo_invites_token    ON photo_invites(token);
CREATE INDEX idx_photo_invites_status   ON photo_invites(status);

SELECT COUNT(*) FROM photo_invites; -- deve retornar 0

COMMIT;
```

---

### Bloco D — Tabela biografia_audit_logs

```sql
BEGIN;

CREATE TABLE biografia_audit_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memorial_id   uuid REFERENCES memoriais(id) NOT NULL,
  narrativa_id  uuid REFERENCES narrativas(id),
  autor_id      uuid NOT NULL,
  autor_perfil  text NOT NULL,
  plano_ativo   text,
  tipo_acao     text NOT NULL,
  descricao     text,
  payload       jsonb,
  created_at    timestamp DEFAULT now()
);

CREATE INDEX idx_bio_audit_memorial ON biografia_audit_logs(memorial_id);
CREATE INDEX idx_bio_audit_autor    ON biografia_audit_logs(autor_id);
CREATE INDEX idx_bio_audit_tipo     ON biografia_audit_logs(tipo_acao);
CREATE INDEX idx_bio_audit_created  ON biografia_audit_logs(created_at);

SELECT COUNT(*) FROM biografia_audit_logs; -- deve retornar 0

COMMIT;
```

---

### Bloco E — RLS e políticas

```sql
BEGIN;

ALTER TABLE organization_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_invites              ENABLE ROW LEVEL SECURITY;
ALTER TABLE biografia_audit_logs       ENABLE ROW LEVEL SECURITY;

-- Notificações: organização vê apenas as suas
CREATE POLICY notifications_org_isolation ON organization_notifications
  FOR ALL USING (
    organization_id = auth.get_user_organization()
  );

-- Photo invites: organização controla os seus
CREATE POLICY photo_invites_org_control ON photo_invites
  FOR ALL USING (
    organization_id = auth.get_user_organization()
  );

-- Photo invites: acesso público por token válido
CREATE POLICY photo_invites_public_token ON photo_invites
  FOR SELECT USING (
    status = 'ativo'
    AND expira_em > now()
  );

-- Biografia audit: organização lê seus logs
CREATE POLICY bio_audit_org_read ON biografia_audit_logs
  FOR SELECT USING (
    memorial_id IN (
      SELECT id FROM memoriais
      WHERE organization_id = auth.get_user_organization()
    )
  );

-- Biografia audit: sistema insere
CREATE POLICY bio_audit_system_insert ON biografia_audit_logs
  FOR INSERT WITH CHECK (true);

COMMIT;
```

---

### Bloco F — Triggers e cron jobs

```sql
BEGIN;

-- Trigger: expirar photo_invite ao publicar memorial
CREATE OR REPLACE FUNCTION expirar_photo_invite_ao_publicar()
RETURNS trigger AS $$
BEGIN
  IF NEW.status_memorial = 'publicado'
     AND OLD.status_memorial != 'publicado' THEN
    UPDATE photo_invites
    SET status = 'expirado'
    WHERE memorial_id = NEW.id
      AND status = 'ativo';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_expirar_photo_invite
  AFTER UPDATE ON memoriais
  FOR EACH ROW
  EXECUTE FUNCTION expirar_photo_invite_ao_publicar();

COMMIT;

-- Cron: expirar photo_invites vencidos (requer pg_cron ativo)
SELECT cron.schedule(
  'expirar-photo-invites',
  '0 4 * * *',
  $$
    UPDATE photo_invites
    SET status = 'expirado'
    WHERE status = 'ativo'
      AND expira_em < now()
  $$
);
```

---

### Bloco G — Migração de dados existentes

```sql
BEGIN;

-- Memoriais do projeto cultural
UPDATE memoriais
SET origem_sistema = 'projeto_cultural'
WHERE organization_id IS NULL
  AND family_account_id IS NULL
  AND origem_sistema IS NULL;

-- Memoriais do SaaS
UPDATE memoriais
SET origem_sistema = 'saas'
WHERE organization_id IS NOT NULL
  AND origem_sistema IS NULL;

-- Validar
SELECT origem_sistema, COUNT(*)
FROM memoriais
GROUP BY origem_sistema;
-- deve mostrar projeto_cultural e saas sem NULL

COMMIT;
```

---

# PARTE 3 — RESUMO EXECUTIVO DA ATUALIZAÇÃO

## O que esta atualização entrega

**Módulo 1 — Respostas Parciais**
Controle preciso de quem respondeu e quem não respondeu. Status intermediário `respostas_parciais`. Badge clicável com popover de progresso. Botão de geração bloqueado até todos concluírem. Botão de reenvio individual por familiar.

**Módulo 2 — Notificações em Tempo Real**
Toast imediato ao receber resposta. Sino no header acumulando histórico. Supabase Realtime sem recarregar página. Notificação especial quando todos respondem com ação direta de gerar biografia.

**Módulo 3 — FotoLink**
Link via WhatsApp para família enviar fotos direto do celular. Sem login. Limites por plano aplicados automaticamente. Tela mobile acolhedora. Expira em 30 dias ou ao publicar. Notificação para funerária ao receber fotos.

**Módulo 4 — Auditoria de Biografia**
Tabela dedicada para ações humanas separada da telemetria de IA. Registro de quem fez o quê e com qual plano ativo. Append-only — nunca UPDATE ou DELETE. Base para relatórios futuros no super admin.

## Brechas corrigidas nesta atualização

- Status incorreto em respostas múltiplas — corrigido no Módulo 1
- Ausência de feedback em tempo real — corrigido no Módulo 2
- Upload de fotos dependia da funerária — corrigido no Módulo 3
- Auditoria de ações humanas misturada com telemetria de IA — corrigido no Módulo 4
- Campo `origem_sistema` faltante para separar projeto cultural do SaaS — corrigido no Bloco A

## O que NÃO está nesta atualização

- Billing de créditos para FotoLink — Camada 2
- Integração de limites de fotos com memorial_types — Camada 2
- Visualização de audit logs no super admin — Camada 3
- Notificações push mobile — Camada 4
