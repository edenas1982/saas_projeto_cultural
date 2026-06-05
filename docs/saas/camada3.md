# ECO DE MEMÓRIAS
## Camada 3 — Super Admin, RBAC e Circuit Breaker
### Documento completo de execução

---

> **Pré-requisito**
> Camadas 1 e 2 completamente implementadas e validadas.
> Especialmente: organizations, organization_users, family_accounts, RLS ativo e sistema de créditos funcionando.

---

# VISÃO GERAL

## O que a Camada 3 entrega

**Para vocês (os donos da plataforma):**
Painel administrativo completo com visão de todas as organizações, receita, margem, custo de IA, inadimplência, consumo por tenant e circuit breaker para proteção contra abuso.

**Para a plataforma:**
Login unificado com RBAC — uma única tela que identifica o perfil e redireciona para o ambiente correto. Super admin, funerária e família entram pelo mesmo lugar.

**Para a operação:**
Circuit breaker que detecta uso anômalo, protege a margem operacional e alerta automaticamente.

---

## Decisões de produto desta camada

**Login único com RBAC**
Uma tela de login só. O sistema identifica o perfil pelo JWT e redireciona automaticamente. Sem URLs separadas para cada tipo de usuário.

**Super admin completamente isolado**
O painel de vocês não é um painel de funerária com mais permissões. É um ambiente separado, com MFA obrigatório, logs completos de cada ação e acesso a dados de todas as organizações.

**Circuit breaker automático**
O sistema detecta comportamento anômalo e age sozinho — pausa requisições, alerta admins, protege margem. Não depende de revisão manual para agir.

---

## Fases desta camada

```
FASE 3.1 — Login unificado com RBAC                (2–3 dias)
FASE 3.2 — Estrutura do super admin no banco       (1–2 dias)
FASE 3.3 — Dashboard administrativo                (3–4 dias)
FASE 3.4 — Gestão de organizações                  (2–3 dias)
FASE 3.5 — Observabilidade financeira e de IA      (2–3 dias)
FASE 3.6 — Circuit breaker                         (2–3 dias)
FASE 3.7 — Gestão de planos e pacotes              (1–2 dias)
─────────────────────────────────────────────────────────────
TOTAL ESTIMADO                                     13–20 dias
```

---

# PARTE 1 — ROTEIRO DE EXECUÇÃO

---

## FASE 3.1 — LOGIN UNIFICADO COM RBAC
**Objetivo:** Uma única tela de login que identifica o perfil e redireciona para o ambiente correto.
**Pré-requisito:** Camadas 1 e 2 validadas.

---

### Os quatro perfis do sistema

| Perfil | Ambiente | Acesso |
|---|---|---|
| super_admin | /admin | Tudo — todas as organizações |
| agency_owner | /agency | Sua organização completa |
| agency_staff | /agency | Sua organização — limitado ao cargo |
| family_client | /memorial | Apenas seus memoriais |

---

### Tarefas

**T1 — Adicionar campo role na tabela users unificada**

O sistema hoje tem `organization_users` e `family_accounts` separados. Para RBAC unificado precisamos de um campo de role que o JWT carrega.

```sql
-- Adicionar role no organization_users
ALTER TABLE organization_users
  ADD COLUMN IF NOT EXISTS role text DEFAULT 'agency_staff';
  -- super_admin | agency_owner | agency_staff

-- Adicionar role no family_accounts
ALTER TABLE family_accounts
  ADD COLUMN IF NOT EXISTS role text DEFAULT 'family_client';
  -- family_client
```

---

**T2 — Criar tabela platform_admins**
Super admins são completamente separados das organizações.
```sql
CREATE TABLE platform_admins (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id  uuid UNIQUE NOT NULL,
  nome          text NOT NULL,
  email         text NOT NULL UNIQUE,
  nivel         text DEFAULT 'admin',
  -- admin | super_admin
  mfa_ativo     boolean DEFAULT false,
  ultimo_acesso timestamp,
  ativo         boolean DEFAULT true,
  created_at    timestamp DEFAULT now()
);

CREATE INDEX idx_platform_admins_auth  ON platform_admins(auth_user_id);
CREATE INDEX idx_platform_admins_email ON platform_admins(email);

-- RLS: apenas super admins acessam esta tabela
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY platform_admins_isolation ON platform_admins
  FOR ALL USING (
    auth.uid() IN (
      SELECT auth_user_id FROM platform_admins WHERE ativo = true
    )
  );
```

---

**T3 — Atualizar função JWT para carregar role e contexto**
```sql
-- Função que retorna o perfil completo do usuário autenticado
CREATE OR REPLACE FUNCTION auth.get_user_context()
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_context jsonb;
BEGIN
  -- Verificar se é super admin
  IF EXISTS (
    SELECT 1 FROM platform_admins
    WHERE auth_user_id = v_user_id AND ativo = true
  ) THEN
    SELECT jsonb_build_object(
      'role', nivel,
      'perfil', 'platform_admin',
      'admin_id', id
    ) INTO v_context
    FROM platform_admins WHERE auth_user_id = v_user_id;

  -- Verificar se é usuário de organização
  ELSIF EXISTS (
    SELECT 1 FROM organization_users
    WHERE auth_user_id = v_user_id AND ativo = true
  ) THEN
    SELECT jsonb_build_object(
      'role', role,
      'perfil', 'organization_user',
      'organization_id', organization_id,
      'cargo', cargo
    ) INTO v_context
    FROM organization_users WHERE auth_user_id = v_user_id;

  -- Verificar se é familiar
  ELSIF EXISTS (
    SELECT 1 FROM family_accounts
    WHERE auth_user_id = v_user_id AND ativo = true
  ) THEN
    SELECT jsonb_build_object(
      'role', 'family_client',
      'perfil', 'family_account',
      'family_account_id', id
    ) INTO v_context
    FROM family_accounts WHERE auth_user_id = v_user_id;

  ELSE
    RETURN NULL;
  END IF;

  RETURN v_context;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
```

---

**T4 — Middleware de RBAC no Express.js**
```javascript
// middleware/rbac.js

const getContext = async (token) => {
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return null

  const { data } = await supabase.rpc('auth.get_user_context')
  return data
}

const requireRole = (...rolesPermitidos) => async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'Sem autenticação' })

  const context = await getContext(token)
  if (!context) return res.status(401).json({ error: 'Usuário não encontrado' })

  if (!rolesPermitidos.includes(context.role)) {
    return res.status(403).json({ error: 'Sem permissão para esta operação' })
  }

  req.userContext = context
  next()
}

module.exports = { requireRole, getContext }
```

---

**T5 — Roteamento por perfil no frontend**
```javascript
// hooks/useAuthRedirect.js

const useAuthRedirect = () => {
  const { userContext } = useAuth()

  useEffect(() => {
    if (!userContext) return

    const rotas = {
      super_admin:   '/admin',
      admin:         '/admin',
      agency_owner:  '/agency',
      agency_staff:  '/agency',
      family_client: '/memorial'
    }

    const destino = rotas[userContext.role]
    if (destino) navigate(destino)

  }, [userContext])
}
```

---

**T6 — Tela única de login**
```
/login

[ Logo Eco de Memórias ]

Email
[ campo ]

Senha
[ campo ]

[ Entrar ]

Esqueci minha senha
```

Sem mencionar perfis ou tipos de usuário.
O sistema identifica e redireciona automaticamente.
Se for super_admin e MFA estiver ativo — solicitar código antes de redirecionar.

---

### Critério de conclusão da Fase 3.1
- [ ] Super admin loga e vai para /admin
- [ ] Atendente da funerária loga e vai para /agency
- [ ] Familiar loga e vai para /memorial
- [ ] Tentativa de acessar rota errada retorna 403
- [ ] agency_id nunca vem do frontend — sempre do JWT

---

## FASE 3.2 — ESTRUTURA DO SUPER ADMIN NO BANCO
**Objetivo:** Criar as tabelas de suporte ao painel administrativo.
**Pré-requisito:** Fase 3.1 concluída.

---

### Tarefas

**T1 — Criar tabela admin_audit_logs**
Logs específicos de ações administrativas — separados dos logs operacionais.
```sql
CREATE TABLE admin_audit_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id      uuid REFERENCES platform_admins(id) NOT NULL,
  acao          text NOT NULL,
  -- login | logout | org_bloqueada | org_desbloqueada
  -- plano_alterado | credito_manual | admin_criado | config_alterada
  entidade      text,
  entidade_id   uuid,
  ip_address    text,
  user_agent    text,
  payload       jsonb,
  created_at    timestamp DEFAULT now()
);

CREATE INDEX idx_admin_audit_admin   ON admin_audit_logs(admin_id);
CREATE INDEX idx_admin_audit_acao    ON admin_audit_logs(acao);
CREATE INDEX idx_admin_audit_created ON admin_audit_logs(created_at);

ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_audit_isolation ON admin_audit_logs
  FOR ALL USING (
    auth.uid() IN (
      SELECT auth_user_id FROM platform_admins WHERE ativo = true
    )
  );
```

---

**T2 — Criar tabela platform_configs**
Configurações globais da plataforma editáveis pelo admin.
```sql
CREATE TABLE platform_configs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave       text UNIQUE NOT NULL,
  valor       text NOT NULL,
  descricao   text,
  editavel    boolean DEFAULT true,
  updated_by  uuid REFERENCES platform_admins(id),
  updated_at  timestamp DEFAULT now()
);

-- Inserir configurações iniciais
INSERT INTO platform_configs (chave, valor, descricao) VALUES
  ('credito_custo_basico',       '1',    'Créditos consumidos por memorial básico'),
  ('credito_custo_intermediario','2',    'Créditos consumidos por memorial intermediário'),
  ('credito_custo_premium',      '3',    'Créditos consumidos por memorial premium'),
  ('mensalidade_padrao',         '190',  'Valor padrão da mensalidade em reais'),
  ('creditos_mensalidade_padrao','10',   'Créditos inclusos na mensalidade padrão'),
  ('circuit_breaker_threshold',  '10',   'Regenerações por memorial que ativa o circuit breaker'),
  ('circuit_breaker_janela',     '60',   'Janela em minutos do circuit breaker'),
  ('trial_dias',                 '14',   'Dias de trial para novas organizações');

ALTER TABLE platform_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY configs_admin_only ON platform_configs
  FOR ALL USING (
    auth.uid() IN (
      SELECT auth_user_id FROM platform_admins WHERE ativo = true
    )
  );
```

---

**T3 — Criar tabela platform_notifications**
Alertas e notificações gerados automaticamente para os admins.
```sql
CREATE TABLE platform_notifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo          text NOT NULL,
  -- circuit_breaker | inadimplencia | consumo_alto | erro_ia | novo_tenant
  titulo        text NOT NULL,
  mensagem      text NOT NULL,
  organization_id uuid REFERENCES organizations(id),
  severity      text DEFAULT 'info',
  -- info | warning | critical
  lida          boolean DEFAULT false,
  lida_por      uuid REFERENCES platform_admins(id),
  lida_em       timestamp,
  created_at    timestamp DEFAULT now()
);

CREATE INDEX idx_notifications_tipo     ON platform_notifications(tipo);
CREATE INDEX idx_notifications_lida     ON platform_notifications(lida);
CREATE INDEX idx_notifications_severity ON platform_notifications(severity);
CREATE INDEX idx_notifications_created  ON platform_notifications(created_at);

ALTER TABLE platform_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_admin_only ON platform_notifications
  FOR ALL USING (
    auth.uid() IN (
      SELECT auth_user_id FROM platform_admins WHERE ativo = true
    )
  );
```

---

### Critério de conclusão da Fase 3.2
- [ ] Tabelas criadas sem erro
- [ ] Configurações iniciais inseridas
- [ ] RLS bloqueando acesso de não admins
- [ ] `SELECT * FROM platform_configs` retorna 8 configurações

---

## FASE 3.3 — DASHBOARD ADMINISTRATIVO
**Objetivo:** Painel principal do super admin com visão completa da plataforma.
**Pré-requisito:** Fase 3.2 concluída.

---

### O que o dashboard exibe

**Bloco 1 — Receita e margem**
```sql
-- Receita mensal de mensalidades
SELECT
  SUM(mensalidade_valor) as receita_mensalidades,
  COUNT(*) as total_organizacoes_ativas
FROM organizations
WHERE mensalidade_status = 'ativa';

-- Receita de créditos adicionais no mês
SELECT SUM(ABS(quantidade) * 27) as receita_creditos_estimada
-- 27 = preço médio por crédito no Pacote M
FROM credit_transactions
WHERE tipo_movimento = 'credito_pacote'
  AND created_at >= date_trunc('month', now());
```

**Bloco 2 — Custo de IA no mês**
```sql
SELECT
  modelo,
  COUNT(*) as total_operacoes,
  SUM(tokens_entrada + tokens_saida) as total_tokens,
  SUM(custo_estimado) as custo_total,
  AVG(custo_estimado) as custo_medio
FROM ai_usage_logs
WHERE created_at >= date_trunc('month', now())
GROUP BY modelo
ORDER BY custo_total DESC;
```

**Bloco 3 — Memoriais e organizações**
```sql
SELECT
  COUNT(DISTINCT o.id) as total_organizacoes,
  COUNT(DISTINCT m.id) as total_memoriais,
  COUNT(DISTINCT CASE WHEN m.created_at >= date_trunc('month', now())
    THEN m.id END) as memoriais_mes,
  COUNT(DISTINCT CASE WHEN o.mensalidade_status = 'inadimplente'
    THEN o.id END) as inadimplentes
FROM organizations o
LEFT JOIN memoriais m ON m.organization_id = o.id
WHERE o.ativo = true;
```

**Bloco 4 — Notificações não lidas**
Alertas críticos do circuit breaker e inadimplência aparecem no topo.

---

### Tarefas

**T1 — Rota de métricas do dashboard**
```javascript
// routes/admin/dashboard.js

app.get('/admin/dashboard',
  requireRole('super_admin', 'admin'),
  async (req, res) => {

  const [receita, custoIA, metricas, notificacoes] = await Promise.all([
    calcularReceita(),
    calcularCustoIA(),
    calcularMetricas(),
    buscarNotificacoes()
  ])

  // Registrar acesso no audit log
  await supabase.from('admin_audit_logs').insert({
    admin_id: req.userContext.admin_id,
    acao: 'dashboard_acessado',
    ip_address: req.ip
  })

  res.json({ receita, custoIA, metricas, notificacoes })
})
```

---

**T2 — Layout do dashboard admin**

```
┌─────────────────────────────────────────────────────┐
│ ECO DE MEMÓRIAS — Painel Administrativo             │
├──────────┬──────────┬──────────┬────────────────────┤
│ Receita  │ Custo IA │Memoriais │ Inadimplentes       │
│ R$174k   │ R$9k     │ 5.234    │ 12 organizações     │
│ /mês     │ /mês     │ ativos   │                     │
├──────────┴──────────┴──────────┴────────────────────┤
│ Margem bruta: R$165k (94,8%)                        │
├─────────────────────────────────────────────────────┤
│ ⚠ 3 alertas críticos          [Ver todos]           │
│ 🔴 Funerária São Paulo — Circuit breaker ativado    │
│ 🟡 Funerária Curitiba — Inadimplente há 5 dias      │
│ 🟡 Consumo de IA 40% acima da média hoje            │
├─────────────────────────────────────────────────────┤
│ Custo IA por modelo (este mês)                      │
│ Claude Sonnet   R$4.200  (47%)  ████████░░          │
│ Google TTS      R$3.100  (34%)  ██████░░░░          │
│ Gemini          R$1.700  (19%)  ███░░░░░░░          │
└─────────────────────────────────────────────────────┘
```

---

### Critério de conclusão da Fase 3.3
- [ ] Dashboard carrega em menos de 2 segundos
- [ ] Receita e custo calculados corretamente
- [ ] Notificações críticas aparecem no topo
- [ ] Acesso registrado no admin_audit_log

---

## FASE 3.4 — GESTÃO DE ORGANIZAÇÕES
**Objetivo:** Admin visualiza, gerencia e opera sobre todas as organizações.
**Pré-requisito:** Fase 3.3 concluída.

---

### Tarefas

**T1 — Listagem de organizações com filtros**
```sql
SELECT
  o.id,
  o.nome,
  o.tipo,
  o.cidade,
  o.estado,
  o.plano,
  o.mensalidade_status,
  o.mensalidade_vencimento,
  COUNT(m.id) as total_memoriais,
  SUM(oc.quantidade - oc.quantidade_usada) as creditos_disponiveis,
  MAX(m.created_at) as ultimo_memorial
FROM organizations o
LEFT JOIN memoriais m ON m.organization_id = o.id
  AND m.deleted_at IS NULL
LEFT JOIN organization_credits oc ON oc.organization_id = o.id
  AND oc.ativo = true
WHERE o.ativo = true
GROUP BY o.id
ORDER BY o.created_at DESC;
```

Filtros disponíveis:
- Status da mensalidade
- Tipo de organização
- Estado
- Plano
- Período de cadastro

---

**T2 — Tela de detalhe da organização**

O que o admin vê ao entrar numa organização:

```
Funerária São Paulo
CNPJ: 12.345.678/0001-90
Plano: Profissional — R$ 397/mês
Status: Ativa — vence em 15 dias

Créditos mensalidade:  8 restantes
Créditos pacote:      45 disponíveis

Memoriais: 234 total / 18 este mês
Custo IA gerado: R$ 234,50 este mês
Receita estimada: R$ 5.400,00 este mês
Margem gerada para plataforma: R$ 163,00

Usuários: 3 atendentes

[Bloquear]  [Alterar plano]  [Crédito manual]  [Ver logs]
```

---

**T3 — Ações administrativas sobre organizações**

```javascript
// Bloquear organização
app.post('/admin/organizations/:id/bloquear',
  requireRole('super_admin'),
  async (req, res) => {

  await supabase
    .from('organizations')
    .update({ mensalidade_status: 'inadimplente' })
    .eq('id', req.params.id)

  await supabase.from('admin_audit_logs').insert({
    admin_id: req.userContext.admin_id,
    acao: 'org_bloqueada',
    entidade: 'organizations',
    entidade_id: req.params.id,
    payload: { motivo: req.body.motivo },
    ip_address: req.ip
  })

  res.json({ sucesso: true })
})

// Crédito manual — para casos de suporte
app.post('/admin/organizations/:id/credito-manual',
  requireRole('super_admin'),
  async (req, res) => {
  const { quantidade, motivo } = req.body

  await supabase.from('organization_credits').insert({
    organization_id: req.params.id,
    tipo: 'pacote',
    quantidade,
    expira_em: null
  })

  // Registrar transação
  const saldo = await calcularSaldo(req.params.id)
  await supabase.from('credit_transactions').insert({
    organization_id: req.params.id,
    tipo_movimento: 'credito_pacote',
    quantidade,
    saldo_apos: saldo.total,
    descricao: `Crédito manual por admin — ${motivo}`
  })

  await supabase.from('admin_audit_logs').insert({
    admin_id: req.userContext.admin_id,
    acao: 'credito_manual',
    entidade: 'organizations',
    entidade_id: req.params.id,
    payload: { quantidade, motivo },
    ip_address: req.ip
  })

  res.json({ sucesso: true, saldo })
})
```

---

### Critério de conclusão da Fase 3.4
- [ ] Listagem mostra todas as organizações com métricas
- [ ] Filtros funcionam corretamente
- [ ] Bloquear organização impede criação de memoriais
- [ ] Crédito manual funciona e registra no audit log
- [ ] Todas as ações administrativas registradas

---

## FASE 3.5 — OBSERVABILIDADE FINANCEIRA E DE IA
**Objetivo:** Admin enxerga custo real de IA, margem por organização e consumo total da plataforma.
**Pré-requisito:** Fase 3.4 concluída.

---

### Tarefas

**T1 — Custo de IA por organização**
```sql
SELECT
  o.nome,
  o.plano,
  COUNT(al.id) as total_operacoes,
  SUM(al.custo_estimado) as custo_total_ia,
  o.mensalidade_valor as receita_mensalidade,
  o.mensalidade_valor - SUM(al.custo_estimado) as margem_real
FROM organizations o
JOIN ai_usage_logs al ON al.organization_id = o.id
WHERE al.created_at >= date_trunc('month', now())
GROUP BY o.id
ORDER BY custo_total_ia DESC;
```

---

**T2 — Alertas de margem negativa**

Se custo de IA de uma organização superar a mensalidade — gerar notificação crítica.
```javascript
const verificarMargemOrganizacoes = async () => {
  const { data: orgs } = await supabase.rpc('calcular_margem_organizacoes')

  for (const org of orgs) {
    if (org.margem_real < 0) {
      await supabase.from('platform_notifications').insert({
        tipo: 'margem_negativa',
        titulo: `Margem negativa — ${org.nome}`,
        mensagem: `Custo de IA R$${org.custo_total_ia} supera mensalidade R$${org.mensalidade_valor}`,
        organization_id: org.id,
        severity: 'critical'
      })
    }
  }
}
```

---

**T3 — Tela de observabilidade de IA**

```
Consumo de IA — Este mês
──────────────────────────────────────────────────────
Modelo          Operações   Tokens      Custo
Claude Sonnet   1.234       4.2M        R$ 4.200
Google TTS      892         —           R$ 3.100
Gemini          445         1.1M        R$ 1.700
──────────────────────────────────────────────────────
Total                                   R$ 9.000

Custo médio por memorial: R$ 3,20
Margem média por memorial: R$ 186,80

Top 5 organizações por consumo de IA:
1. Funerária SP       R$ 1.234  ████████
2. Memorial RJ        R$ 987    ██████
3. Funerária BH       R$ 756    █████
4. Plano Curitiba     R$ 543    ████
5. Funerária Recife   R$ 321    ██
```

---

### Critério de conclusão da Fase 3.5
- [ ] Custo de IA por organização calculado corretamente
- [ ] Margem negativa gera notificação crítica automática
- [ ] Tela de observabilidade exibe dados em tempo real

---

## FASE 3.6 — CIRCUIT BREAKER
**Objetivo:** Detectar uso anômalo, proteger margem e alertar admins automaticamente.
**Pré-requisito:** Fase 3.5 concluída.

---

### O que o circuit breaker detecta

| Anomalia | Threshold | Ação |
|---|---|---|
| Regenerações por memorial | > 10 em 60 min | Pausar memorial + alertar admin |
| Tokens por operação | > 3x a média | Alertar admin |
| Gerações por organização | > 50 em 1h | Pausar organização + alertar |
| Erros consecutivos de IA | > 5 seguidos | Alertar admin |
| Custo diário acima do esperado | > 200% da média | Alertar admin |

---

### Tarefas

**T1 — Criar tabela circuit_breaker_events**
```sql
CREATE TABLE circuit_breaker_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id),
  memorial_id     uuid REFERENCES memoriais(id),
  tipo            text NOT NULL,
  -- regeneracoes_excessivas | tokens_alto | geracao_excessiva
  -- erro_consecutivo | custo_anomalo
  valor_detectado numeric,
  threshold       numeric,
  status          text DEFAULT 'ativo',
  -- ativo | resolvido | ignorado
  resolvido_por   uuid REFERENCES platform_admins(id),
  resolvido_em    timestamp,
  created_at      timestamp DEFAULT now()
);

CREATE INDEX idx_cb_events_organization ON circuit_breaker_events(organization_id);
CREATE INDEX idx_cb_events_status       ON circuit_breaker_events(status);
CREATE INDEX idx_cb_events_tipo         ON circuit_breaker_events(tipo);
CREATE INDEX idx_cb_events_created      ON circuit_breaker_events(created_at);

ALTER TABLE circuit_breaker_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY cb_events_admin_only ON circuit_breaker_events
  FOR ALL USING (
    auth.uid() IN (
      SELECT auth_user_id FROM platform_admins WHERE ativo = true
    )
  );
```

---

**T2 — Criar tabela circuit_breaker_status**
Estado atual do circuit breaker por memorial e por organização.
```sql
CREATE TABLE circuit_breaker_status (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id),
  memorial_id     uuid REFERENCES memoriais(id),
  -- NULL = circuit breaker da organização inteira
  status          text DEFAULT 'fechado',
  -- fechado: operando normalmente
  -- aberto: bloqueado por anomalia
  -- semi_aberto: testando recuperação
  motivo          text,
  abre_em         timestamp,
  -- quando o circuit breaker fecha automaticamente
  created_at      timestamp DEFAULT now(),
  updated_at      timestamp DEFAULT now()
);

CREATE INDEX idx_cb_status_organization ON circuit_breaker_status(organization_id);
CREATE INDEX idx_cb_status_memorial     ON circuit_breaker_status(memorial_id);
CREATE INDEX idx_cb_status_status       ON circuit_breaker_status(status);
```

---

**T3 — Lógica do circuit breaker no Express.js**
```javascript
// utils/circuitBreaker.js

const verificarCircuitBreaker = async (organization_id, memorial_id) => {

  // Verificar se organização está bloqueada
  const { data: cbOrg } = await supabase
    .from('circuit_breaker_status')
    .select('status, motivo, abre_em')
    .eq('organization_id', organization_id)
    .is('memorial_id', null)
    .single()

  if (cbOrg?.status === 'aberto') {
    if (cbOrg.abre_em && new Date(cbOrg.abre_em) < new Date()) {
      // Tempo expirou — colocar em semi_aberto
      await supabase
        .from('circuit_breaker_status')
        .update({ status: 'semi_aberto', updated_at: new Date() })
        .eq('organization_id', organization_id)
        .is('memorial_id', null)
    } else {
      return {
        bloqueado: true,
        motivo: cbOrg.motivo,
        tipo: 'organizacao'
      }
    }
  }

  // Verificar se memorial específico está bloqueado
  if (memorial_id) {
    const { data: cbMem } = await supabase
      .from('circuit_breaker_status')
      .select('status, motivo')
      .eq('organization_id', organization_id)
      .eq('memorial_id', memorial_id)
      .single()

    if (cbMem?.status === 'aberto') {
      return {
        bloqueado: true,
        motivo: cbMem.motivo,
        tipo: 'memorial'
      }
    }
  }

  return { bloqueado: false }
}

const ativarCircuitBreaker = async (organization_id, memorial_id, tipo, valor, threshold) => {
  const motivo = `${tipo} — detectado ${valor} (limite: ${threshold})`

  // Registrar evento
  await supabase.from('circuit_breaker_events').insert({
    organization_id,
    memorial_id,
    tipo,
    valor_detectado: valor,
    threshold
  })

  // Ativar bloqueio
  await supabase.from('circuit_breaker_status').upsert({
    organization_id,
    memorial_id: memorial_id || null,
    status: 'aberto',
    motivo,
    abre_em: new Date(Date.now() + 60 * 60 * 1000), // 1 hora
    updated_at: new Date()
  })

  // Gerar notificação para admins
  await supabase.from('platform_notifications').insert({
    tipo: 'circuit_breaker',
    titulo: `Circuit Breaker ativado`,
    mensagem: motivo,
    organization_id,
    severity: 'critical'
  })
}

// Verificar regenerações excessivas por memorial
const verificarRegeneracoesExcessivas = async (organization_id, memorial_id) => {
  const janela = new Date(Date.now() - 60 * 60 * 1000) // última hora

  const { count } = await supabase
    .from('eventos_geracao')
    .select('*', { count: 'exact' })
    .eq('memorial_id', memorial_id)
    .gte('gerado_em', janela.toISOString())

  const threshold = 10 // configurável via platform_configs

  if (count > threshold) {
    await ativarCircuitBreaker(
      organization_id, memorial_id,
      'regeneracoes_excessivas', count, threshold
    )
    return true
  }
  return false
}

module.exports = {
  verificarCircuitBreaker,
  ativarCircuitBreaker,
  verificarRegeneracoesExcessivas
}
```

---

**T4 — Integrar circuit breaker nas rotas de geração**
```javascript
// routes/geracao.js

app.post('/org/memoriais/:memorial_id/gerar',
  requireRole('agency_owner', 'agency_staff'),
  async (req, res) => {

  const { memorial_id } = req.params
  const { organization_id } = req.userContext

  // Verificar circuit breaker antes de qualquer operação
  const cb = await verificarCircuitBreaker(organization_id, memorial_id)
  if (cb.bloqueado) {
    return res.status(429).json({
      error: 'Operação temporariamente bloqueada.',
      motivo: cb.motivo,
      tipo: cb.tipo
    })
  }

  // Verificar regenerações excessivas
  const excessivo = await verificarRegeneracoesExcessivas(organization_id, memorial_id)
  if (excessivo) {
    return res.status(429).json({
      error: 'Limite de regenerações atingido para este memorial. Um administrador foi notificado.'
    })
  }

  // Continuar com a geração normalmente...
})
```

---

**T5 — Tela de circuit breaker no painel admin**

```
Circuit Breaker — Status atual
──────────────────────────────────────────────────────
🔴 2 bloqueios ativos

Memorial #1234 — Funerária SP
Motivo: 14 regenerações em 60 minutos (limite: 10)
Ativado: há 23 minutos
Libera automaticamente em: 37 minutos
[Resolver agora]  [Ignorar]  [Ver histórico]

Organização: Funerária Curitiba
Motivo: 67 gerações em 1 hora (limite: 50)
Ativado: há 5 minutos
Libera automaticamente em: 55 minutos
[Resolver agora]  [Ignorar]  [Ver histórico]
──────────────────────────────────────────────────────
Histórico (últimos 30 dias): 8 eventos
```

---

**T6 — pg_cron para resolver circuit breakers expirados**
```sql
SELECT cron.schedule(
  'resolver-circuit-breakers',
  '*/15 * * * *', -- a cada 15 minutos
  $$
    UPDATE circuit_breaker_status
    SET status = 'semi_aberto', updated_at = now()
    WHERE status = 'aberto'
      AND abre_em < now()
  $$
);
```

---

### Critério de conclusão da Fase 3.6
- [ ] 11 regenerações em 1h bloqueiam o memorial
- [ ] Admin recebe notificação crítica imediatamente
- [ ] Circuit breaker abre automaticamente após 1h
- [ ] Admin pode resolver manualmente antes do prazo
- [ ] Tela de circuit breaker exibe status em tempo real

---

## FASE 3.7 — GESTÃO DE PLANOS E PACOTES
**Objetivo:** Admin gerencia planos, preços e pacotes de crédito sem precisar de código.
**Pré-requisito:** Fase 3.4 concluída.

---

### Tarefas

**T1 — CRUD de planos no painel admin**

Admin pode criar, editar e desativar planos:
```javascript
app.put('/admin/plans/:id',
  requireRole('super_admin'),
  async (req, res) => {
  const { nome, mensalidade_valor, mensalidade_creditos } = req.body

  await supabase
    .from('platform_configs')
    .update({ valor: mensalidade_valor, updated_by: req.userContext.admin_id })
    .eq('chave', 'mensalidade_padrao')

  await supabase.from('admin_audit_logs').insert({
    admin_id: req.userContext.admin_id,
    acao: 'plano_alterado',
    payload: req.body,
    ip_address: req.ip
  })

  res.json({ sucesso: true })
})
```

---

**T2 — CRUD de pacotes de crédito**

Admin pode adicionar novos pacotes ou alterar preços existentes:
```sql
-- Admin adiciona pacote promocional
INSERT INTO credit_packages (nome, quantidade, preco, ativo, destaque)
VALUES ('Promo Black Friday', 30, 599.00, true, true);

-- Admin desativa pacote
UPDATE credit_packages SET ativo = false WHERE id = $1;
```

---

**T3 — Alterar thresholds do circuit breaker via painel**

Admin ajusta os limites sem precisar de código:
```javascript
app.put('/admin/configs/:chave',
  requireRole('super_admin'),
  async (req, res) => {
  const { valor } = req.body

  await supabase
    .from('platform_configs')
    .update({
      valor,
      updated_by: req.userContext.admin_id,
      updated_at: new Date()
    })
    .eq('chave', req.params.chave)
    .eq('editavel', true)

  await supabase.from('admin_audit_logs').insert({
    admin_id: req.userContext.admin_id,
    acao: 'config_alterada',
    payload: { chave: req.params.chave, valor },
    ip_address: req.ip
  })

  res.json({ sucesso: true })
})
```

---

### Critério de conclusão da Fase 3.7
- [ ] Admin altera preço de plano sem código
- [ ] Admin adiciona pacote de crédito sem código
- [ ] Admin ajusta threshold do circuit breaker sem código
- [ ] Todas as alterações registradas no admin_audit_log

---

# PARTE 2 — BANCO DE DADOS COMPLETO DA CAMADA 3

## Ordem de execução dos blocos

```
Bloco 3A → Estrutura do super admin
Bloco 3B → Circuit breaker
Bloco 3C → Alterações nas tabelas existentes
Bloco 3D → RLS e políticas
Bloco 3E → Cron jobs
```

---

### Bloco 3A — Estrutura do super admin
```sql
BEGIN;

CREATE TABLE platform_admins (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id  uuid UNIQUE NOT NULL,
  nome          text NOT NULL,
  email         text NOT NULL UNIQUE,
  nivel         text DEFAULT 'admin',
  mfa_ativo     boolean DEFAULT false,
  ultimo_acesso timestamp,
  ativo         boolean DEFAULT true,
  created_at    timestamp DEFAULT now()
);
CREATE INDEX idx_platform_admins_auth  ON platform_admins(auth_user_id);
CREATE INDEX idx_platform_admins_email ON platform_admins(email);

CREATE TABLE admin_audit_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id      uuid REFERENCES platform_admins(id) NOT NULL,
  acao          text NOT NULL,
  entidade      text,
  entidade_id   uuid,
  ip_address    text,
  user_agent    text,
  payload       jsonb,
  created_at    timestamp DEFAULT now()
);
CREATE INDEX idx_admin_audit_admin   ON admin_audit_logs(admin_id);
CREATE INDEX idx_admin_audit_acao    ON admin_audit_logs(acao);
CREATE INDEX idx_admin_audit_created ON admin_audit_logs(created_at);

CREATE TABLE platform_configs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave       text UNIQUE NOT NULL,
  valor       text NOT NULL,
  descricao   text,
  editavel    boolean DEFAULT true,
  updated_by  uuid REFERENCES platform_admins(id),
  updated_at  timestamp DEFAULT now()
);

INSERT INTO platform_configs (chave, valor, descricao) VALUES
  ('credito_custo_basico',        '1',   'Créditos consumidos por memorial básico'),
  ('credito_custo_intermediario', '2',   'Créditos consumidos por memorial intermediário'),
  ('credito_custo_premium',       '3',   'Créditos consumidos por memorial premium'),
  ('mensalidade_padrao',          '190', 'Valor padrão da mensalidade em reais'),
  ('creditos_mensalidade_padrao', '10',  'Créditos inclusos na mensalidade padrão'),
  ('circuit_breaker_threshold',   '10',  'Regenerações por memorial que ativa o circuit breaker'),
  ('circuit_breaker_janela',      '60',  'Janela em minutos do circuit breaker'),
  ('trial_dias',                  '14',  'Dias de trial para novas organizações');

CREATE TABLE platform_notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo            text NOT NULL,
  titulo          text NOT NULL,
  mensagem        text NOT NULL,
  organization_id uuid REFERENCES organizations(id),
  severity        text DEFAULT 'info',
  lida            boolean DEFAULT false,
  lida_por        uuid REFERENCES platform_admins(id),
  lida_em         timestamp,
  created_at      timestamp DEFAULT now()
);
CREATE INDEX idx_notifications_tipo     ON platform_notifications(tipo);
CREATE INDEX idx_notifications_lida     ON platform_notifications(lida);
CREATE INDEX idx_notifications_severity ON platform_notifications(severity);
CREATE INDEX idx_notifications_created  ON platform_notifications(created_at);

SELECT COUNT(*) FROM platform_configs; -- deve retornar 8

COMMIT;
```

---

### Bloco 3B — Circuit breaker
```sql
BEGIN;

CREATE TABLE circuit_breaker_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id),
  memorial_id     uuid REFERENCES memoriais(id),
  tipo            text NOT NULL,
  valor_detectado numeric,
  threshold       numeric,
  status          text DEFAULT 'ativo',
  resolvido_por   uuid REFERENCES platform_admins(id),
  resolvido_em    timestamp,
  created_at      timestamp DEFAULT now()
);
CREATE INDEX idx_cb_events_organization ON circuit_breaker_events(organization_id);
CREATE INDEX idx_cb_events_status       ON circuit_breaker_events(status);
CREATE INDEX idx_cb_events_tipo         ON circuit_breaker_events(tipo);
CREATE INDEX idx_cb_events_created      ON circuit_breaker_events(created_at);

CREATE TABLE circuit_breaker_status (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id),
  memorial_id     uuid REFERENCES memoriais(id),
  status          text DEFAULT 'fechado',
  motivo          text,
  abre_em         timestamp,
  created_at      timestamp DEFAULT now(),
  updated_at      timestamp DEFAULT now()
);
CREATE INDEX idx_cb_status_organization ON circuit_breaker_status(organization_id);
CREATE INDEX idx_cb_status_memorial     ON circuit_breaker_status(memorial_id);
CREATE INDEX idx_cb_status_status       ON circuit_breaker_status(status);

COMMIT;
```

---

### Bloco 3C — Alterações nas tabelas existentes
```sql
BEGIN;

-- Role nos usuários de organização
ALTER TABLE organization_users
  ADD COLUMN IF NOT EXISTS role text DEFAULT 'agency_staff';

-- Role nos familiares
ALTER TABLE family_accounts
  ADD COLUMN IF NOT EXISTS role text DEFAULT 'family_client';

-- Atualizar roles existentes
UPDATE organization_users
SET role = 'agency_owner'
WHERE cargo = 'admin';

UPDATE organization_users
SET role = 'agency_staff'
WHERE cargo IN ('atendente', 'gerente', 'visualizador');

COMMIT;
```

---

### Bloco 3D — RLS e políticas
```sql
BEGIN;

ALTER TABLE platform_admins        ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_configs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE circuit_breaker_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE circuit_breaker_status ENABLE ROW LEVEL SECURITY;

-- Todas as tabelas admin: apenas platform_admins acessam
CREATE POLICY admins_only_platform_admins ON platform_admins
  FOR ALL USING (
    auth.uid() IN (SELECT auth_user_id FROM platform_admins WHERE ativo = true)
  );

CREATE POLICY admins_only_audit ON admin_audit_logs
  FOR ALL USING (
    auth.uid() IN (SELECT auth_user_id FROM platform_admins WHERE ativo = true)
  );

CREATE POLICY admins_only_configs ON platform_configs
  FOR ALL USING (
    auth.uid() IN (SELECT auth_user_id FROM platform_admins WHERE ativo = true)
  );

CREATE POLICY admins_only_notifications ON platform_notifications
  FOR ALL USING (
    auth.uid() IN (SELECT auth_user_id FROM platform_admins WHERE ativo = true)
  );

CREATE POLICY admins_only_cb_events ON circuit_breaker_events
  FOR ALL USING (
    auth.uid() IN (SELECT auth_user_id FROM platform_admins WHERE ativo = true)
  );

CREATE POLICY admins_only_cb_status ON circuit_breaker_status
  FOR ALL USING (
    auth.uid() IN (SELECT auth_user_id FROM platform_admins WHERE ativo = true)
  );

COMMIT;
```

---

### Bloco 3E — Cron jobs da Camada 3
```sql
-- Resolver circuit breakers expirados a cada 15 minutos
SELECT cron.schedule(
  'resolver-circuit-breakers',
  '*/15 * * * *',
  $$
    UPDATE circuit_breaker_status
    SET status = 'semi_aberto', updated_at = now()
    WHERE status = 'aberto'
      AND abre_em < now()
  $$
);

-- Verificar margens negativas todo dia às 7h
SELECT cron.schedule(
  'verificar-margens',
  '0 7 * * *',
  $$
    INSERT INTO platform_notifications (tipo, titulo, mensagem, organization_id, severity)
    SELECT
      'margem_negativa',
      'Margem negativa — ' || o.nome,
      'Custo de IA supera receita da mensalidade este mês',
      o.id,
      'critical'
    FROM organizations o
    JOIN (
      SELECT organization_id, SUM(custo_estimado) as custo_total
      FROM ai_usage_logs
      WHERE created_at >= date_trunc('month', now())
      GROUP BY organization_id
    ) ai ON ai.organization_id = o.id
    WHERE ai.custo_total > o.mensalidade_valor
      AND o.mensalidade_status = 'ativa'
  $$
);
```

---

# PARTE 3 — RESUMO EXECUTIVO DA CAMADA 3

## O que entra nesta camada

**Login unificado com RBAC:**
Uma tela de login. Quatro perfis. Redirecionamento automático. JWT nunca confia em dados do frontend.

**Super admin isolado:**
Ambiente completamente separado das organizações. MFA obrigatório. Audit log de cada ação. Acesso a dados de toda a plataforma.

**Dashboard administrativo:**
Receita, margem, custo de IA, inadimplência, memoriais ativos — tudo em tempo real.

**Gestão de organizações:**
Listar, detalhar, bloquear, creditar manualmente, alterar plano — tudo com registro de auditoria.

**Observabilidade de IA:**
Custo por modelo, custo por organização, margem real, alertas de margem negativa.

**Circuit breaker:**
Detecção automática de uso anômalo, bloqueio imediato, notificação para admins, resolução automática por tempo ou manual pelo admin.

**Gestão de planos e pacotes:**
Admin altera preços, cria pacotes e ajusta thresholds sem precisar de código.

## O que NÃO está nesta camada
- Gateway de pagamento real → Camada 4
- Canal família direta sem funerária → Camada 4
- Renovação anual e Dia de Finados → Camada 4
- Transferência geracional → Camada 4
- Sistema de comissões para atendentes → Camada 4