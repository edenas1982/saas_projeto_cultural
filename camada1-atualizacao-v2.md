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
