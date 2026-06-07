# ECO DE MEMÓRIAS
## Camada 2 — Créditos, Billing e Segurança Avançada
### Documento completo de execução — versão atualizada

---

> **Pré-requisito**
> A Camada 1 precisa estar completamente implementada e validada antes de iniciar esta camada.
> Especialmente: organizations, organization_users, family_accounts e memoriais com RLS ativo.

---

> **Atualizações incorporadas nesta versão**
> 1. Tipos de memorial — básico, intermediário e premium com custo em créditos diferente
> 2. Hospedagem gratuita para família — família nunca paga para manter a timeline no ar

---

# VISÃO GERAL

## O que a Camada 2 entrega

**Para a funerária:**
Saldo de créditos visível no dashboard, dois tipos de crédito com comportamentos diferentes, bloqueio automático por inadimplência, preservação de créditos de pacote em atraso, menu de tipos de memorial com preços diferentes, relatório de valor gerado por memoriais vendidos.

**Para a família:**
Créditos de alteração e evolução no painel próprio, compra direta de upgrades opcionais, hospedagem gratuita e permanente da timeline sem custo mensal.

**Para a plataforma:**
Controle total de consumo de IA, rate limiting, storage privado com signed URLs, proteção contra abuso.

---

## Decisões de produto desta camada

**Hospedagem gratuita para família**
A família nunca paga para manter a timeline no ar.
O custo real de hospedagem é entre R$ 0,30 e R$ 1,00 por ano por memorial — irrelevante.
A promessa de permanência é absoluta e sem asterisco.
A funerária vende com mais confiança: "este memorial fica no ar para sempre."
A família pode pagar para evoluir o memorial — nunca para mantê-lo existindo.

**Tipos de memorial com custo em créditos diferente**
Cada tipo consome uma quantidade diferente de créditos.
A funerária vende cada tipo por um preço diferente.
O sistema se adapta a todos os níveis socioeconômicos do mercado funerário.

---

## Fases desta camada

```
FASE 2.1 — Tipos de memorial                       (1–2 dias)
FASE 2.2 — Estrutura de créditos no banco          (2–3 dias)
FASE 2.3 — Lógica de consumo e bloqueio            (2–3 dias)
FASE 2.4 — Dashboard de créditos da funerária      (2–3 dias)
FASE 2.5 — Créditos de evolução da família         (2–3 dias)
FASE 2.6 — Relatório de valor gerado               (1–2 dias)
FASE 2.7 — Storage privado e signed URLs           (2–3 dias)
FASE 2.8 — Rate limiting e proteção de IA          (2–3 dias)
─────────────────────────────────────────────────────────────
TOTAL ESTIMADO                                     14–22 dias
```

---

# PARTE 1 — ROTEIRO DE EXECUÇÃO

---

## FASE 2.1 — TIPOS DE MEMORIAL
**Objetivo:** Criar o menu de tipos de memorial com custo em créditos e limite de funcionalidades por tipo.
**Pré-requisito:** Camada 1 validada.

---

### Regras de negócio

**Tipo básico — 1 crédito**
A funerária vende por volta de R$ 300.
Entrega o produto essencial completo.

**Tipo intermediário — 2 créditos**
A funerária vende por volta de R$ 600.
Entrega experiência expandida com voz premium e plaquinha.

**Tipo premium — 3 créditos**
A funerária vende por volta de R$ 1.000 ou mais.
Entrega experiência completa sem limites.
Mercado funerário tem todos os níveis sociais — premium tem demanda real.

---

### Tarefas

**T1 — Criar tabela memorial_types**
```sql
CREATE TABLE memorial_types (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome              text NOT NULL,
  -- basico | intermediario | premium
  descricao         text,
  custo_creditos    integer NOT NULL DEFAULT 1,
  limite_fotos      integer DEFAULT 5,
  voz_premium       boolean DEFAULT false,
  multiplos_qr      boolean DEFAULT false,
  plaquinha_inclusa boolean DEFAULT false,
  galeria_ilimitada boolean DEFAULT false,
  ativo             boolean DEFAULT true,
  ordem_exibicao    integer DEFAULT 1,
  created_at        timestamp DEFAULT now()
);

-- Inserir tipos iniciais
INSERT INTO memorial_types
  (nome, descricao, custo_creditos, limite_fotos, voz_premium, multiplos_qr, plaquinha_inclusa, galeria_ilimitada, ordem_exibicao)
VALUES
  ('Básico',
   'Memorial completo essencial com biografia, áudio e QR Code',
   1, 5, false, false, false, false, 1),
  ('Intermediário',
   'Memorial expandido com voz premium, galeria ampliada e plaquinha',
   2, 10, true, false, true, false, 2),
  ('Premium',
   'Memorial completo sem limites com múltiplos QR Codes e plaquinha premium',
   3, 999, true, true, true, true, 3);
```

---

**T2 — Adicionar tipo no memorial**
```sql
ALTER TABLE memoriais
  ADD COLUMN IF NOT EXISTS memorial_type_id uuid REFERENCES memorial_types(id);

-- Popular memoriais existentes com tipo básico
UPDATE memoriais
SET memorial_type_id = (
  SELECT id FROM memorial_types WHERE nome = 'Básico' LIMIT 1
)
WHERE memorial_type_id IS NULL;
```

---

**T3 — Exibir tipos no modal de criar memorial**

O primeiro passo do modal de criação na funerária deve mostrar os três tipos com:
- Nome e descrição
- O que está incluso em cada um
- Custo em créditos
- Preço sugerido de venda (editável pela funerária)

A funerária seleciona o tipo antes de começar o cadastro.
O sistema já sabe quantos créditos vai consumir.

---

### Critério de conclusão da Fase 2.1
- [ ] Tabela memorial_types criada com 3 tipos
- [ ] Memoriais existentes migrados para tipo básico
- [ ] Modal de criação exibe os três tipos
- [ ] Sistema registra o tipo escolhido no memorial

---

## FASE 2.2 — ESTRUTURA DE CRÉDITOS NO BANCO
**Objetivo:** Criar as tabelas que controlam créditos, pacotes e transações.
**Pré-requisito:** Fase 2.1 concluída.

---

### Regras de negócio definidas

**Crédito de mensalidade**
- Incluído automaticamente todo mês no plano
- Expira no fim do ciclo mensal independente de uso
- Não acumula — se não usou perdeu
- Incentiva uso mensal e criação do hábito de vender

**Crédito de pacote**
- Comprado separadamente pela funerária
- Não expira nunca
- Acumula mês a mês
- É um ativo permanente da funerária

**Ordem de consumo**
O sistema sempre consome créditos de mensalidade primeiro porque expiram.
Créditos de pacote são consumidos apenas quando mensalidade estiver zerada.
Isso é automático e invisível para a funerária.

**Custo em créditos por tipo de memorial**
Básico = 1 crédito. Intermediário = 2 créditos. Premium = 3 créditos.
O sistema debita o valor correto baseado no tipo escolhido.

**Regra de bloqueio por inadimplência**
Mensalidade em atraso bloqueia a plataforma completamente.
Créditos de pacote ficam preservados — não são consumidos e não expiram.
Ao regularizar a mensalidade tudo volta exatamente como estava.

---

### Tarefas

**T1 — Criar tabela organization_credits**
```sql
CREATE TABLE organization_credits (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid REFERENCES organizations(id) NOT NULL,
  tipo             text NOT NULL,
  -- mensalidade | pacote
  quantidade       integer NOT NULL,
  quantidade_usada integer DEFAULT 0,
  expira_em        timestamp,
  -- NULL para pacote (não expira nunca)
  -- data do fim do ciclo para mensalidade
  ativo            boolean DEFAULT true,
  created_at       timestamp DEFAULT now()
);

CREATE INDEX idx_credits_organization ON organization_credits(organization_id);
CREATE INDEX idx_credits_tipo         ON organization_credits(tipo);
CREATE INDEX idx_credits_expira       ON organization_credits(expira_em);
CREATE INDEX idx_credits_ativo        ON organization_credits(ativo);
```

---

**T2 — Criar tabela credit_transactions**
Histórico imutável de cada movimentação de crédito.
```sql
CREATE TABLE credit_transactions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid REFERENCES organizations(id) NOT NULL,
  credit_id        uuid REFERENCES organization_credits(id),
  memorial_id      uuid REFERENCES memoriais(id),
  tipo_movimento   text NOT NULL,
  -- credito_mensalidade | credito_pacote | debito | estorno | expiracao
  quantidade       integer NOT NULL,
  -- positivo para crédito, negativo para débito
  saldo_apos       integer NOT NULL,
  descricao        text,
  created_at       timestamp DEFAULT now()
);

CREATE INDEX idx_transactions_organization ON credit_transactions(organization_id);
CREATE INDEX idx_transactions_memorial     ON credit_transactions(memorial_id);
CREATE INDEX idx_transactions_tipo         ON credit_transactions(tipo_movimento);
CREATE INDEX idx_transactions_created      ON credit_transactions(created_at);
```

---

**T3 — Criar tabela credit_packages**
Catálogo de pacotes disponíveis para compra.
```sql
CREATE TABLE credit_packages (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome           text NOT NULL,
  quantidade     integer NOT NULL,
  preco          numeric(10,2) NOT NULL,
  preco_unitario numeric(10,2) GENERATED ALWAYS AS (preco / quantidade) STORED,
  ativo          boolean DEFAULT true,
  destaque       boolean DEFAULT false,
  created_at     timestamp DEFAULT now()
);

INSERT INTO credit_packages (nome, quantidade, preco, ativo, destaque) VALUES
  ('Avulso',    1,   35.00,   true, false),
  ('Pacote P',  5,   150.00,  true, false),
  ('Pacote M',  10,  270.00,  true, true),
  ('Pacote G',  20,  480.00,  true, false),
  ('Pacote XG', 50,  1050.00, true, false);
```

---

**T4 — Adicionar campos de billing na tabela organizations**
```sql
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS mensalidade_valor      numeric(10,2) DEFAULT 190.00,
  ADD COLUMN IF NOT EXISTS mensalidade_creditos   integer DEFAULT 10,
  ADD COLUMN IF NOT EXISTS mensalidade_vencimento date,
  ADD COLUMN IF NOT EXISTS mensalidade_status     text DEFAULT 'ativa',
  -- ativa | inadimplente | cancelada | trial
  ADD COLUMN IF NOT EXISTS proximo_ciclo          date;
```

---

**T5 — Adicionar campos de valor e tipo no memorial**
```sql
ALTER TABLE memoriais
  ADD COLUMN IF NOT EXISTS valor_vendido   numeric(10,2),
  ADD COLUMN IF NOT EXISTS vendido_por     uuid REFERENCES organization_users(id),
  ADD COLUMN IF NOT EXISTS credit_usado_id uuid REFERENCES organization_credits(id);
  -- registra qual crédito foi consumido para este memorial
```

---

### Critério de conclusão da Fase 2.2
- [ ] Tabelas criadas sem erro
- [ ] Pacotes inseridos corretamente
- [ ] Campos adicionados em organizations e memoriais
- [ ] `SELECT * FROM credit_packages` retorna 5 pacotes

---

## FASE 2.3 — LÓGICA DE CONSUMO E BLOQUEIO
**Objetivo:** Implementar as regras de negócio de créditos no backend Express.js.
**Pré-requisito:** Fase 2.2 concluída.

---

### Tarefas

**T1 — Função de cálculo de saldo**
```javascript
// utils/credits.js

const calcularSaldo = async (organization_id) => {
  const agora = new Date().toISOString()

  const { data: mensalidade } = await supabase
    .from('organization_credits')
    .select('quantidade, quantidade_usada')
    .eq('organization_id', organization_id)
    .eq('tipo', 'mensalidade')
    .eq('ativo', true)
    .gt('expira_em', agora)

  const { data: pacote } = await supabase
    .from('organization_credits')
    .select('quantidade, quantidade_usada')
    .eq('organization_id', organization_id)
    .eq('tipo', 'pacote')
    .eq('ativo', true)

  const saldoMensalidade = mensalidade?.reduce((acc, c) =>
    acc + (c.quantidade - c.quantidade_usada), 0) || 0

  const saldoPacote = pacote?.reduce((acc, c) =>
    acc + (c.quantidade - c.quantidade_usada), 0) || 0

  return {
    mensalidade: saldoMensalidade,
    pacote: saldoPacote,
    total: saldoMensalidade + saldoPacote
  }
}
```

---

**T2 — Função de verificação antes de criar memorial**
Agora considera o custo em créditos do tipo escolhido.
```javascript
// utils/credits.js

const podeCriarMemorial = async (organization_id, memorial_type_id) => {

  // Buscar custo do tipo escolhido
  const { data: tipo } = await supabase
    .from('memorial_types')
    .select('custo_creditos, nome')
    .eq('id', memorial_type_id)
    .single()

  const custoCreditos = tipo?.custo_creditos || 1

  // Verificar mensalidade ativa
  const { data: org } = await supabase
    .from('organizations')
    .select('mensalidade_status')
    .eq('id', organization_id)
    .single()

  if (org.mensalidade_status === 'inadimplente') {
    return {
      pode: false,
      motivo: 'inadimplente',
      mensagem: 'Mensalidade em atraso. Regularize para continuar. Seus créditos de pacote estão preservados.'
    }
  }

  if (org.mensalidade_status === 'cancelada') {
    return {
      pode: false,
      motivo: 'cancelado',
      mensagem: 'Plano cancelado. Entre em contato para reativar.'
    }
  }

  // Verificar saldo suficiente para o tipo escolhido
  const saldo = await calcularSaldo(organization_id)

  if (saldo.total < custoCreditos) {
    return {
      pode: false,
      motivo: 'sem_creditos',
      mensagem: `Memorial ${tipo.nome} requer ${custoCreditos} créditos. Saldo disponível: ${saldo.total}.`,
      saldo,
      custo_necessario: custoCreditos
    }
  }

  return { pode: true, saldo, custo_necessario: custoCreditos }
}
```

---

**T3 — Função de consumo de crédito**
Consome mensalidade primeiro, pacote depois.
Debita o valor correto baseado no tipo do memorial.
```javascript
// utils/credits.js

const consumirCreditos = async (organization_id, memorial_id, memorial_type_id, actor_id) => {
  const agora = new Date().toISOString()

  const { data: tipo } = await supabase
    .from('memorial_types')
    .select('custo_creditos, nome')
    .eq('id', memorial_type_id)
    .single()

  let creditosRestantes = tipo.custo_creditos

  // Consumir créditos de mensalidade primeiro
  while (creditosRestantes > 0) {
    const { data: credito } = await supabase
      .from('organization_credits')
      .select('*')
      .eq('organization_id', organization_id)
      .eq('tipo', 'mensalidade')
      .eq('ativo', true)
      .gt('expira_em', agora)
      .filter('quantidade', 'gt', 'quantidade_usada')
      .order('expira_em', { ascending: true })
      .limit(1)
      .single()

    if (!credito) break

    const disponivel = credito.quantidade - credito.quantidade_usada
    const consumir = Math.min(disponivel, creditosRestantes)

    await supabase
      .from('organization_credits')
      .update({ quantidade_usada: credito.quantidade_usada + consumir })
      .eq('id', credito.id)

    creditosRestantes -= consumir
  }

  // Se ainda há créditos a consumir usar pacote
  while (creditosRestantes > 0) {
    const { data: credito } = await supabase
      .from('organization_credits')
      .select('*')
      .eq('organization_id', organization_id)
      .eq('tipo', 'pacote')
      .eq('ativo', true)
      .filter('quantidade', 'gt', 'quantidade_usada')
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (!credito) throw new Error('Sem créditos suficientes')

    const disponivel = credito.quantidade - credito.quantidade_usada
    const consumir = Math.min(disponivel, creditosRestantes)

    await supabase
      .from('organization_credits')
      .update({ quantidade_usada: credito.quantidade_usada + consumir })
      .eq('id', credito.id)

    creditosRestantes -= consumir
  }

  // Registrar transação
  const saldo = await calcularSaldo(organization_id)
  await supabase.from('credit_transactions').insert({
    organization_id,
    memorial_id,
    tipo_movimento: 'debito',
    quantidade: -tipo.custo_creditos,
    saldo_apos: saldo.total,
    descricao: `Memorial ${tipo.nome} criado — ${tipo.custo_creditos} crédito(s) consumido(s)`
  })

  // Registrar no audit_log
  await supabase.from('audit_logs').insert({
    organization_id,
    memorial_id,
    actor_id,
    actor_tipo: 'organization_user',
    acao: 'creditos_consumidos',
    entidade: 'organization_credits',
    payload: { tipo_memorial: tipo.nome, creditos: tipo.custo_creditos }
  })

  return { creditos_consumidos: tipo.custo_creditos, saldo_restante: saldo.total }
}
```

---

**T4 — Função de crédito mensal automático**
```javascript
const creditarMensalidade = async (organization_id) => {
  const { data: org } = await supabase
    .from('organizations')
    .select('mensalidade_creditos, proximo_ciclo')
    .eq('id', organization_id)
    .single()

  // Expirar créditos de mensalidade anteriores não usados
  await supabase
    .from('organization_credits')
    .update({ ativo: false })
    .eq('organization_id', organization_id)
    .eq('tipo', 'mensalidade')
    .eq('ativo', true)

  const proximoCiclo = new Date(org.proximo_ciclo)
  proximoCiclo.setMonth(proximoCiclo.getMonth() + 1)

  await supabase.from('organization_credits').insert({
    organization_id,
    tipo: 'mensalidade',
    quantidade: org.mensalidade_creditos,
    expira_em: proximoCiclo.toISOString()
  })

  const saldo = await calcularSaldo(organization_id)
  await supabase.from('credit_transactions').insert({
    organization_id,
    tipo_movimento: 'credito_mensalidade',
    quantidade: org.mensalidade_creditos,
    saldo_apos: saldo.total,
    descricao: `Créditos mensais renovados — ciclo ${proximoCiclo.toLocaleDateString('pt-BR')}`
  })
}
```

---

**T5 — pg_cron para expirar créditos de mensalidade**
```sql
SELECT cron.schedule(
  'expirar-creditos-mensalidade',
  '0 3 * * *',
  $$
    UPDATE organization_credits
    SET ativo = false
    WHERE tipo = 'mensalidade'
      AND ativo = true
      AND expira_em < now()
  $$
);
```

---

### Critério de conclusão da Fase 2.3
- [ ] Memorial básico consome 1 crédito
- [ ] Memorial intermediário consome 2 créditos
- [ ] Memorial premium consome 3 créditos
- [ ] Mensalidade esgotada cai automaticamente para pacote
- [ ] Inadimplência bloqueia e preserva créditos de pacote
- [ ] Regularização restaura tudo intacto

---

## FASE 2.4 — DASHBOARD DE CRÉDITOS DA FUNERÁRIA
**Objetivo:** Funerária visualiza saldo, histórico e compra pacotes adicionais.
**Pré-requisito:** Fase 2.3 concluída.

---

### Tarefas

**T1 — Widget de saldo no dashboard**

O que exibir:
```
Créditos do plano:    3 restantes  (expiram em 15 dias)
Créditos de pacote:  12 disponíveis (não expiram)
──────────────────────────────────────────────────────
Total disponível:    15 créditos

Equivale a:
  15 memoriais Básico
   7 memoriais Intermediário
   5 memoriais Premium
```

Query do saldo:
```sql
SELECT
  tipo,
  SUM(quantidade - quantidade_usada) as saldo_disponivel,
  MIN(expira_em) as proxima_expiracao
FROM organization_credits
WHERE organization_id = $1
  AND ativo = true
  AND (expira_em IS NULL OR expira_em > now())
GROUP BY tipo
```

---

**T2 — Alerta de créditos e mensalidade**

- Créditos totais ≤ 2 → alerta amarelo
- Créditos totais = 0 → alerta vermelho
- Mensalidade vence em ≤ 5 dias → alerta amarelo
- Mensalidade em atraso → banner vermelho no topo

---

**T3 — Tela de compra de pacotes**

| Pacote | Créditos | Preço | Por crédito |
|---|---|---|---|
| Avulso | 1 | R$ 35,00 | R$ 35,00 |
| Pacote P | 5 | R$ 150,00 | R$ 30,00 |
| Pacote M ⭐ | 10 | R$ 270,00 | R$ 27,00 |
| Pacote G | 20 | R$ 480,00 | R$ 24,00 |
| Pacote XG | 50 | R$ 1.050,00 | R$ 21,00 |

---

**T4 — Histórico de transações**

Listar `credit_transactions` com data, tipo, quantidade, saldo após e memorial vinculado.

---

### Critério de conclusão da Fase 2.4
- [ ] Saldo exibe os dois tipos separados com equivalência por tipo de memorial
- [ ] Alertas funcionam nas condições corretas
- [ ] Tela de pacotes exibe preços e destaque
- [ ] Histórico lista todas as transações

---

## FASE 2.5 — CRÉDITOS DE EVOLUÇÃO DA FAMÍLIA
**Objetivo:** Família pode evoluir o memorial pagando por funcionalidades opcionais. Nunca paga para manter.
**Pré-requisito:** Fase 2.4 concluída.

---

### Regras de negócio

**A família nunca paga para manter a timeline no ar.**
Hospedagem é gratuita e permanente. Isso é uma promessa do produto.

**A família pode pagar para evoluir o memorial quando quiser.**
Atualizar a biografia com novas histórias.
Gerar novo áudio com voz diferente.
Expandir a galeria além do limite do pacote base.
Fazer upgrade do tipo básico para intermediário ou premium.

Tudo opcional. Tudo por iniciativa da família. Nunca por obrigação.

---

### Tarefas

**T1 — Criar tabela family_credits**
```sql
CREATE TABLE family_credits (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_account_id uuid REFERENCES family_accounts(id) NOT NULL,
  memorial_id       uuid REFERENCES memoriais(id) NOT NULL,
  tipo              text NOT NULL,
  -- alteracao_biografia | geracao_audio | expansao_galeria | upgrade_tipo
  quantidade        integer NOT NULL,
  quantidade_usada  integer DEFAULT 0,
  expira_em         timestamp,
  ativo             boolean DEFAULT true,
  created_at        timestamp DEFAULT now()
);

CREATE TABLE family_credit_transactions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_account_id uuid REFERENCES family_accounts(id) NOT NULL,
  memorial_id       uuid REFERENCES memoriais(id) NOT NULL,
  credit_id         uuid REFERENCES family_credits(id),
  tipo_movimento    text NOT NULL,
  quantidade        integer NOT NULL,
  saldo_apos        integer NOT NULL,
  descricao         text,
  created_at        timestamp DEFAULT now()
);

CREATE INDEX idx_family_credits_account  ON family_credits(family_account_id);
CREATE INDEX idx_family_credits_memorial ON family_credits(memorial_id);
```

---

**T2 — Pacotes de evolução para família**

Exibir no painel familiar como opções voluntárias:

| O que faz | Preço |
|---|---|
| 1 atualização de biografia | R$ 19,90 |
| 1 novo áudio | R$ 14,90 |
| Expandir galeria (+10 fotos) | R$ 9,90 |
| Upgrade básico → intermediário | R$ 89,90 |
| Upgrade intermediário → premium | R$ 149,90 |
| Pacote evolução (3 atualizações + 2 áudios) | R$ 69,90 |

---

**T3 — Widget no painel familiar**

```
Este memorial pode crescer com você.

Créditos de atualização:  2 disponíveis
Créditos de áudio:        1 disponível

[Comprar mais]  [Ver histórico]
```

Nota importante: nunca usar linguagem de cobrança obrigatória.
Tom correto: "mantenha o memorial sempre atualizado."

---

### Critério de conclusão da Fase 2.5
- [ ] Família vê opções de evolução no painel
- [ ] Compra de crédito funciona
- [ ] Débito ao usar funcionalidade paga
- [ ] Sem nenhuma cobrança automática de hospedagem

---

## FASE 2.6 — RELATÓRIO DE VALOR GERADO
**Objetivo:** Mostrar para a funerária o retorno financeiro gerado pelos memoriais.
**Pré-requisito:** Fase 2.4 concluída.

---

### Tarefas

**T1 — Query de valor gerado no mês**
```sql
SELECT
  COUNT(id) as total_memoriais,
  SUM(valor_vendido) as receita_gerada,
  AVG(valor_vendido) as ticket_medio,
  SUM(valor_vendido) - (
    SELECT mensalidade_valor FROM organizations WHERE id = $1
  ) as lucro_sobre_mensalidade,
  COUNT(CASE WHEN mt.nome = 'Básico' THEN 1 END) as total_basico,
  COUNT(CASE WHEN mt.nome = 'Intermediário' THEN 1 END) as total_intermediario,
  COUNT(CASE WHEN mt.nome = 'Premium' THEN 1 END) as total_premium
FROM memoriais m
JOIN memorial_types mt ON mt.id = m.memorial_type_id
WHERE m.organization_id = $1
  AND m.origem_sistema = 'saas'
  AND m.deleted_at IS NULL
  AND m.created_at >= date_trunc('month', now())
```

---

**T2 — Widget de ROI no dashboard**

```
Este mês você gerou:
──────────────────────────────────────────
Memoriais vendidos:    8
  Básico:       5 × R$ 300   = R$ 1.500
  Intermediário: 2 × R$ 600  = R$ 1.200
  Premium:       1 × R$ 900  = R$ 900
──────────────────────────────────────────
Receita gerada:        R$ 3.600,00
Custo do plano:        R$ 190,00
──────────────────────────────────────────
Retorno:               R$ 3.410,00 (1.794% de ROI)
```

---

**T3 — Campo valor_vendido no modal de criação**

No modal de criar memorial — após escolher o tipo — exibir:
"Valor cobrado da família (opcional)"
Com sugestão baseada no tipo: Básico R$ 300 / Intermediário R$ 600 / Premium R$ 1.000.

---

### Critério de conclusão da Fase 2.6
- [ ] Widget de ROI exibe por tipo de memorial
- [ ] Campo valor_vendido salva no memorial
- [ ] Relatório mensal soma corretamente

---

## FASE 2.7 — STORAGE PRIVADO E SIGNED URLS
**Objetivo:** Fotos e áudios em bucket privado com acesso via URLs temporárias.
**Pré-requisito:** Fase 2.2 concluída.

---

### Estrutura de pastas no Supabase Storage

```
/org_{uuid}/
  /memorial_{uuid}/
    /perfil/        → foto principal
    /galeria/       → fotos adicionais
    /audio/         → arquivo de áudio gerado
    /documentos/    → documentos de autorização
```

---

### Política de acesso por conteúdo

| Conteúdo | Acesso |
|---|---|
| Foto de perfil (timeline pública) | Signed URL 24h — renovada a cada acesso |
| Fotos da galeria (timeline pública) | Signed URL 24h |
| Áudio (timeline pública) | Signed URL 24h |
| Fotos em revisão | Signed URL 1h — apenas autenticado |
| Documentos de autorização | Signed URL 15min — apenas super admin |

---

### Tarefas

**T1 — Configurar bucket privado**
```javascript
await supabase.storage.createBucket('memoriais', {
  public: false,
  fileSizeLimit: 10485760, // 10MB
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'audio/mpeg', 'audio/wav']
})
```

**T2 — Upload com path estruturado**
```javascript
const uploadMidia = async (file, organization_id, memorial_id, tipo) => {
  const extensao = file.name.split('.').pop()
  const path = `org_${organization_id}/memorial_${memorial_id}/${tipo}/${Date.now()}.${extensao}`

  const { data, error } = await supabase.storage
    .from('memoriais')
    .upload(path, file, { cacheControl: '3600', upsert: false })

  if (error) throw error
  return path // salvar path no banco, nunca a URL
}
```

**T3 — Signed URL sob demanda**
```javascript
const getSignedUrl = async (path, expiresIn = 86400) => {
  const { data, error } = await supabase.storage
    .from('memoriais')
    .createSignedUrl(path, expiresIn)

  if (error) throw error
  return data.signedUrl
}
```

**T4 — Atualizar tabela midias**
```sql
ALTER TABLE midias
  ADD COLUMN IF NOT EXISTS storage_path   text,
  ADD COLUMN IF NOT EXISTS storage_bucket text DEFAULT 'memoriais';
```

---

### Critério de conclusão da Fase 2.7
- [ ] Upload salva path estruturado no bucket privado
- [ ] Timeline pública recebe signed URLs
- [ ] Acesso direto ao bucket sem auth retorna erro

---

## FASE 2.8 — RATE LIMITING E PROTEÇÃO DE IA
**Objetivo:** Proteger endpoints de IA contra abuso e controlar custos.
**Pré-requisito:** Fase 2.3 concluída.

---

### Limites definidos

| Endpoint | Limite | Janela |
|---|---|---|
| Geração de biografia | 3 por memorial | Por hora |
| Geração de áudio | 1 por memorial | Após biografia aprovada |
| Magic links | 10 por memorial | Por dia |
| Condolências | 1 por dispositivo | Por memorial |
| Login com erro | 5 tentativas | Por hora |

---

### Tarefas

**T1 — Rate limiting por endpoint**
```javascript
const rateLimit = require('express-rate-limit')

const iaLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => `${req.organization_id}_${req.params.memorial_id}`,
  message: { error: 'Limite de gerações atingido. Tente novamente em 1 hora.' }
})

const condolenciaLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 1,
  keyGenerator: (req) => `${req.ip}_${req.params.memorial_id}`,
  message: { error: 'Você já enviou uma mensagem para este memorial.' }
})
```

**T2 — Sanitização de prompts**
```javascript
const sanitizePrompt = (req, res, next) => {
  if (req.body.instrucao_ajuste) {
    req.body.instrucao_ajuste = req.body.instrucao_ajuste
      .substring(0, 140)
      .replace(/[<>{}]/g, '')
  }
  if (req.body.resposta) {
    req.body.resposta = req.body.resposta.substring(0, 2000)
  }
  next()
}
```

**T3 — Log de uso de IA (Concluído na Fase 0)**
> [!NOTE]
> A tabela proposta inicialmente `ai_usage_logs` foi unificada e otimizada durante a **Fase 0 (Governança Financeira de APIs)** na tabela **`public.api_usage_events`**, que possui catálogos dinâmicos (`provider_catalog`, `feature_catalog` e `api_pricing_catalog`). O log de consumo de IA já está totalmente implementado e ativo no backend Express.js através do `TelemetryService.registerApiUsage()`.

**T4 — Validação de sequência**
Áudio só gerado após biografia aprovada.
```javascript
const gerarAudio = async (req, res) => {
  const { data: memorial } = await supabase
    .from('memoriais')
    .select('status_memorial')
    .eq('id', req.params.memorial_id)
    .single()

  if (!['aprovado', 'publicado'].includes(memorial.status_memorial)) {
    return res.status(400).json({
      error: 'Biografia precisa ser aprovada antes de gerar o áudio.'
    })
  }
}
```

---

### Critério de conclusão da Fase 2.8
- [ ] Terceira tentativa de geração em 1h retorna erro claro
- [ ] Segunda condolência bloqueada
- [ ] instrucao_ajuste limitado a 140 caracteres
- [ ] Áudio bloqueado sem biografia aprovada
- [x] Registro centralizado em `api_usage_events` para todas as chamadas de IA (Concluído na Fase 0)

---

# PARTE 2 — BANCO DE DADOS COMPLETO DA CAMADA 2

## Ordem de execução dos blocos

```
Bloco 2A → Tipos de memorial
Bloco 2B → Tabelas de créditos
Bloco 2C → Alterações nas tabelas existentes
Bloco 2D → RLS nas novas tabelas
Bloco 2E → Cron jobs
```

---

### Bloco 2A — Tipos de memorial
```sql
BEGIN;

CREATE TABLE memorial_types (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome              text NOT NULL,
  descricao         text,
  custo_creditos    integer NOT NULL DEFAULT 1,
  limite_fotos      integer DEFAULT 5,
  voz_premium       boolean DEFAULT false,
  multiplos_qr      boolean DEFAULT false,
  plaquinha_inclusa boolean DEFAULT false,
  galeria_ilimitada boolean DEFAULT false,
  ativo             boolean DEFAULT true,
  ordem_exibicao    integer DEFAULT 1,
  created_at        timestamp DEFAULT now()
);

INSERT INTO memorial_types
  (nome, descricao, custo_creditos, limite_fotos, voz_premium, multiplos_qr, plaquinha_inclusa, galeria_ilimitada, ordem_exibicao)
VALUES
  ('Básico',
   'Memorial completo essencial com biografia, áudio e QR Code',
   1, 5, false, false, false, false, 1),
  ('Intermediário',
   'Memorial expandido com voz premium, galeria ampliada e plaquinha',
   2, 10, true, false, true, false, 2),
  ('Premium',
   'Memorial completo sem limites com múltiplos QR Codes e plaquinha premium',
   3, 999, true, true, true, true, 3);

ALTER TABLE memoriais
  ADD COLUMN IF NOT EXISTS memorial_type_id uuid REFERENCES memorial_types(id);

UPDATE memoriais
SET memorial_type_id = (SELECT id FROM memorial_types WHERE nome = 'Básico' LIMIT 1)
WHERE memorial_type_id IS NULL;

SELECT COUNT(*) FROM memorial_types; -- deve retornar 3

COMMIT;
```

---

### Bloco 2B — Tabelas de créditos
```sql
BEGIN;

CREATE TABLE organization_credits (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid REFERENCES organizations(id) NOT NULL,
  tipo             text NOT NULL,
  quantidade       integer NOT NULL,
  quantidade_usada integer DEFAULT 0,
  expira_em        timestamp,
  ativo            boolean DEFAULT true,
  created_at       timestamp DEFAULT now()
);
CREATE INDEX idx_credits_organization ON organization_credits(organization_id);
CREATE INDEX idx_credits_tipo         ON organization_credits(tipo);
CREATE INDEX idx_credits_expira       ON organization_credits(expira_em);
CREATE INDEX idx_credits_ativo        ON organization_credits(ativo);

CREATE TABLE credit_transactions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid REFERENCES organizations(id) NOT NULL,
  credit_id        uuid REFERENCES organization_credits(id),
  memorial_id      uuid REFERENCES memoriais(id),
  tipo_movimento   text NOT NULL,
  quantidade       integer NOT NULL,
  saldo_apos       integer NOT NULL,
  descricao        text,
  created_at       timestamp DEFAULT now()
);
CREATE INDEX idx_transactions_organization ON credit_transactions(organization_id);
CREATE INDEX idx_transactions_memorial     ON credit_transactions(memorial_id);
CREATE INDEX idx_transactions_tipo         ON credit_transactions(tipo_movimento);
CREATE INDEX idx_transactions_created      ON credit_transactions(created_at);

CREATE TABLE credit_packages (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome           text NOT NULL,
  quantidade     integer NOT NULL,
  preco          numeric(10,2) NOT NULL,
  preco_unitario numeric(10,2) GENERATED ALWAYS AS (preco / quantidade) STORED,
  ativo          boolean DEFAULT true,
  destaque       boolean DEFAULT false,
  created_at     timestamp DEFAULT now()
);

INSERT INTO credit_packages (nome, quantidade, preco, ativo, destaque) VALUES
  ('Avulso',    1,   35.00,   true, false),
  ('Pacote P',  5,   150.00,  true, false),
  ('Pacote M',  10,  270.00,  true, true),
  ('Pacote G',  20,  480.00,  true, false),
  ('Pacote XG', 50,  1050.00, true, false);

CREATE TABLE family_credits (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_account_id uuid REFERENCES family_accounts(id) NOT NULL,
  memorial_id       uuid REFERENCES memoriais(id) NOT NULL,
  tipo              text NOT NULL,
  quantidade        integer NOT NULL,
  quantidade_usada  integer DEFAULT 0,
  expira_em         timestamp,
  ativo             boolean DEFAULT true,
  created_at        timestamp DEFAULT now()
);
CREATE INDEX idx_family_credits_account  ON family_credits(family_account_id);
CREATE INDEX idx_family_credits_memorial ON family_credits(memorial_id);

CREATE TABLE family_credit_transactions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_account_id uuid REFERENCES family_accounts(id) NOT NULL,
  memorial_id       uuid REFERENCES memoriais(id) NOT NULL,
  credit_id         uuid REFERENCES family_credits(id),
  tipo_movimento    text NOT NULL,
  quantidade        integer NOT NULL,
  saldo_apos        integer NOT NULL,
  descricao         text,
  created_at        timestamp DEFAULT now()
);

-- Nota: A tabela de log de IA (ai_usage_logs) foi substituída por api_usage_events (já implementada na Fase 0)

SELECT COUNT(*) FROM credit_packages; -- deve retornar 5

COMMIT;
```

---

### Bloco 2C — Alterações nas tabelas existentes
```sql
BEGIN;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS mensalidade_valor      numeric(10,2) DEFAULT 190.00,
  ADD COLUMN IF NOT EXISTS mensalidade_creditos   integer DEFAULT 10,
  ADD COLUMN IF NOT EXISTS mensalidade_vencimento date,
  ADD COLUMN IF NOT EXISTS mensalidade_status     text DEFAULT 'ativa',
  ADD COLUMN IF NOT EXISTS proximo_ciclo          date;

ALTER TABLE memoriais
  ADD COLUMN IF NOT EXISTS valor_vendido   numeric(10,2),
  ADD COLUMN IF NOT EXISTS vendido_por     uuid REFERENCES organization_users(id),
  ADD COLUMN IF NOT EXISTS credit_usado_id uuid REFERENCES organization_credits(id);

ALTER TABLE midias
  ADD COLUMN IF NOT EXISTS storage_path   text,
  ADD COLUMN IF NOT EXISTS storage_bucket text DEFAULT 'memoriais';

SELECT column_name FROM information_schema.columns
WHERE table_name = 'organizations'
  AND column_name IN ('mensalidade_valor', 'mensalidade_status');
-- deve retornar 2 linhas

COMMIT;
```

---

### Bloco 2D — RLS nas novas tabelas
```sql
BEGIN;

ALTER TABLE memorial_types             ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_credits       ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_packages            ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_credits             ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_credit_transactions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE api_usage_events ENABLE ROW LEVEL SECURITY; -- Já habilitado na Fase 0

-- Tipos de memorial: todos podem ler (catálogo público)
CREATE POLICY memorial_types_public_read ON memorial_types
  FOR SELECT USING (ativo = true);

-- Créditos da organização: vê apenas os seus
CREATE POLICY credits_isolation ON organization_credits
  FOR ALL USING (
    organization_id = auth.get_user_organization()
  );

-- Transações: organização vê apenas as suas
CREATE POLICY transactions_isolation ON credit_transactions
  FOR ALL USING (
    organization_id = auth.get_user_organization()
  );

-- Pacotes: catálogo público
CREATE POLICY packages_public_read ON credit_packages
  FOR SELECT USING (ativo = true);

-- Créditos família: família vê apenas os seus
CREATE POLICY family_credits_isolation ON family_credits
  FOR ALL USING (
    family_account_id IN (
      SELECT id FROM family_accounts WHERE auth_user_id = auth.uid()
    )
  );

COMMIT;
```

---

### Bloco 2E — Cron jobs da Camada 2
Habilitar pg_cron antes de executar.
```sql
SELECT cron.schedule(
  'expirar-creditos-mensalidade',
  '0 3 * * *',
  $$
    UPDATE organization_credits
    SET ativo = false
    WHERE tipo = 'mensalidade'
      AND ativo = true
      AND expira_em < now()
  $$
);
```

---

# PARTE 3 — RESUMO EXECUTIVO DA CAMADA 2

## Decisões de produto incorporadas

**Tipos de memorial com custo em créditos**
Básico = 1 crédito / Intermediário = 2 / Premium = 3.
Funerária vende por preços diferentes cobrindo todos os perfis de cliente.
Mercado funerário tem todos os níveis sociais — o produto também.

**Hospedagem gratuita e permanente para família**
A família nunca paga para manter a timeline no ar.
Custo real é irrelevante — menos de R$ 1,00 por memorial por ano.
A promessa de permanência é absoluta e sem asterisco.
Receita da família vem de evoluções opcionais — nunca de obrigação.

## O que entra nesta camada

**Créditos:**
Dois tipos com comportamentos distintos, custo variável por tipo de memorial, ordem de consumo automática, bloqueio por inadimplência com preservação de pacotes, créditos de evolução opcionais para família.

**Billing:**
Catálogo de tipos de memorial, catálogo de pacotes de crédito, campo valor_vendido, widget de ROI detalhado por tipo, histórico de transações.

**Storage:**
Bucket privado estruturado por organização, signed URLs temporárias, path estruturado para todos os uploads.

**Proteção:**
Rate limiting por endpoint, sanitização de prompts, limite de 140 caracteres para instrução de ajuste, validação de sequência, logs de uso de IA.

## O que NÃO está nesta camada
- Integração com gateway de pagamento → Camada 3
- Super admin da plataforma → Camada 3
- Canal direto família sem funerária → Camada 4
- Transferência geracional → Camada 4
- Sistema de comissões para atendentes → Camada 4
