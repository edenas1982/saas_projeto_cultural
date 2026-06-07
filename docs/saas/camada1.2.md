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

Upload para o Supabase Storage usando os **mesmos paths e tabelas que o sistema já utiliza**, garantindo que o painel da funerária enxergue as fotos sem nenhuma adaptação.

Bucket: `memoriais` (público)

Foto de perfil:
```
fotos_principal/{user.id}/{timestamp}.{extensão}
```
Após o upload, a URL pública é gravada na coluna `foto_url` da tabela `memoriais`.

> Observação: como o FotoLink é uma rota pública sem login, o `{user.id}` usado no path será o `id` do memorial (`memorial_id`), mantendo o isolamento sem depender de sessão autenticada.

Galeria:
```
galeria/{memorial.id}/{timestamp}_{string_aleatoria}.{extensão}
```
Cada foto da galeria gera um registro na tabela `midias` com:
- `memorial_id`: ID do memorial
- `tipo_midia`: `'foto'`
- `url`: URL pública da foto no Storage
- `ordem`: posição da foto (1, 2, 3...)
- `aprovado`: `true`

**4. Validação de quantidade no frontend (antes do upload)**

A limitação técnica dos navegadores móveis é que não é possível bloquear a galeria do celular para um número exato de fotos durante a seleção. O celular sempre permite que o usuário marque quantas quiser. A solução é interceptar a seleção no momento em que o usuário retorna para a página, antes de qualquer upload acontecer.

**Foto de perfil**

O input é criado sem o atributo `multiple`. O próprio sistema operacional do celular (iOS e Android) já bloqueia a seleção para uma única foto nativamente — sem nenhum código adicional necessário.

**Galeria**

O input é criado com `multiple`. O celular permite marcar qualquer quantidade, mas ao retornar para a página o JavaScript intercepta imediatamente e aplica a seguinte lógica:

```typescript
// vagas_restantes = limite do plano - total já enviado
const vagasRestantes = limites.galeria - totalJaEnviado

if (arquivosSelecionados.length > vagasRestantes) {
  // Aceita apenas as primeiras N fotos dentro do limite
  const arquivosAceitos = arquivosSelecionados.slice(0, vagasRestantes)
  const arquivosIgnorados = arquivosSelecionados.length - vagasRestantes

  // Exibe mensagem amigável para a família
  exibirAviso(
    `Você selecionou ${arquivosSelecionados.length} fotos, mas seu plano permite mais ${vagasRestantes}.
     As primeiras ${vagasRestantes} foram separadas. As demais foram ignoradas.`
  )

  // Prossegue o upload apenas com os arquivos aceitos
  iniciarUpload(arquivosAceitos)
} else {
  iniciarUpload(arquivosSelecionados)
}
```

Se o limite já foi atingido (vagas = 0), o botão de adicionar fotos fica desabilitado e exibe a mensagem "Limite de fotos atingido para o seu plano."

A família sempre vê na tela quantas fotos já enviou e quantas vagas restam, atualizado após cada upload concluído.

**5. Sistema valida limites no backend (segunda barreira)**

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

// Contagem busca na tabela midias — mesma fonte que o painel da funerária usa
const { count: totalGaleria } = await supabase
  .from('midias')
  .select('*', { count: 'exact', head: true })
  .eq('memorial_id', memorial_id)
  .eq('tipo_midia', 'foto')

if (tipo === 'galeria' && totalGaleria >= limites.galeria) {
  return res.status(400).json({
    error: `Limite de ${limites.galeria} fotos da galeria atingido para o plano ${plano}.`
  })
}
```

> **Nota de arquitetura — limites hardcoded (decisão intencional)**
> Os limites por plano estão definidos diretamente no código nesta versão. Isso é uma decisão consciente para simplificar a implementação inicial. A evolução natural será criar uma tabela `plan_configs` no banco com os limites de cada plano, e substituir o objeto acima por uma consulta ao banco. Quando isso acontecer, o restante do código de validação — tanto no frontend quanto no backend — não precisará de nenhuma alteração, pois já recebe o limite como variável. Não alterar esses valores no código sem criar a tela de configuração correspondente.

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

Design seguindo as diretrizes do MASTER_AGENT seção 8.2 — afetivo, acolhedor, mobile-first. A interface B2C para as famílias deve transmitir extrema leveza, serenidade e elegância, afastando-se totalmente de padrões corporativos de software.

### Especificações Visuais (Baseadas no Mockup de Referência)

**1. Fundo e Cores (Paleta Afetiva):**
- Fundo da página: Um tom bege muito suave, quase off-white (ex: `bg-stone-50` ou `bg-[#FDFBF7]`).
- Textos principais: Cinza quente e escuro (`text-stone-800` ou `text-stone-900`), nunca preto puro.
- Cor de Destaque (Ação Secundária/Primária): Um tom verde "sálvia" profundo e calmo (ex: `bg-teal-700`, `bg-emerald-700` desaturado ou `bg-[#5D807B]`). 

**2. Tipografia:**
- Título do Homenageado ("José da Silva"): Fonte Serif clássica e elegante (como Playfair Display ou similar se houver no projeto), transmitindo legado e história.
- Restante dos textos: Sans-serif limpa e legível (Inter, Outfit, etc.).

**3. Estrutura do Cabeçalho:**
- Logo "Eco de Memórias" centralizada no topo com tom suave.
- Título: "Fotos de" (pequeno) seguido do Nome do homenageado (grande, Serif).
- Datas de nascimento e falecimento logo abaixo com ícones delicados: `★ 1945 † 2026` em tom de cinza suave (`text-stone-500`).

**4. Estrutura dos Cards (Brancos):**
Os blocos de "Foto de Perfil" e "Galeria" devem flutuar sobre o fundo bege como cards brancos:
- Estilo do card: `bg-white rounded-3xl p-5 shadow-sm border border-stone-100/50`.

**5. Interações de Upload (Dropzones):**
- As áreas para clicar e fazer upload (o retângulo principal do Perfil e os quadradinhos vazios da Galeria) devem ter um visual "vazado":
- Fundo cinza ultraclaro (`bg-stone-50` ou `bg-slate-50`).
- Borda tracejada (`border-2 border-dashed border-stone-300`).
- Ícone de `[+]` suave ao centro.

**6. Galeria e Botão Principal:**
- A galeria exibe um grid onde as primeiras posições são as fotos já enviadas (miniaturas quadradas com `rounded-xl` e `object-cover`), seguidas pelas posições vazias (dropzones tracejados com `[+]`).
- O texto acima das fotos indica o limite do plano de forma clara: *"Plano Premium — até 10 fotos"* seguido pelo contador dinâmico *"3 enviadas · 7 disponíveis"*.
- Abaixo do grid de fotos, fica o botão principal de chamada para ação:
- Botão longo (full width), fundo verde sálvia, cantos arredondados (`rounded-xl` ou `rounded-full`), com ícone de câmera e o texto "Adicionar mais fotos".

```
┌─────────────────────────────────┐
│                                 │
│   [Logo Eco de Memórias]        │
│                                 │
│   Fotos de                      │
│   José da Silva                 │
│   ★ 1945 † 2026                 │
│                                 │
│ ─────────────────────────────── │
│                                 │
│ [ CARD BRANCO ARREDONDADO ]     │
│   Foto de Perfil                │
│   ┌─────────────────────┐       │
│   │   [+] Adicionar     │       │
│   │   foto principal    │       │
│   └─────────────────────┘       │
│                                 │
│ [ CARD BRANCO ARREDONDADO ]     │
│   Galeria de Fotos              │
│   Plano Premium — até 10 fotos  │
│   3 enviadas · 7 disponíveis    │
│                                 │
│   [foto1] [foto2] [foto3]       │
│   [+]     [+]                   │
│                                 │
│   (Botão Verde Sálvia)          │
│   [📷 Adicionar mais fotos]     │
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
- [ ] Tela exibe para a família quantas fotos já foram enviadas e quantas vagas restam
- [ ] Foto de perfil usa input sem `multiple` — celular bloqueia seleção para 1 foto nativamente
- [ ] Galeria usa input com `multiple` — JavaScript intercepta seleção e aceita apenas as primeiras N fotos dentro do limite, descartando o excesso com mensagem amigável
- [ ] Botão de adicionar fotos fica desabilitado quando limite atingido
- [ ] Upload salva foto de perfil no path `fotos_principal/{memorial_id}/{timestamp}.ext` e atualiza `memoriais.foto_url`
- [ ] Upload salva galeria no path `galeria/{memorial_id}/{timestamp}_{random}.ext` e insere registro na tabela `midias`
- [ ] Backend valida limite consultando tabela `midias` antes de aceitar cada upload (segunda barreira)
- [ ] Foto de perfil substitui a anterior se já existir
- [ ] Galeria bloqueia ao atingir limite do plano
- [ ] Notificação gerada ao receber fotos
- [ ] Link expira em 30 dias automaticamente
- [ ] Link expira ao publicar o memorial
- [ ] Família pode abrir o link múltiplas vezes e ver o que já enviou

---

## Próxima etapa — Realtime no painel da funerária

Após o FotoLink estar funcional, implementar Supabase Realtime nos componentes do painel para que o agente funerário enxergue as fotos assim que a família faz o upload, sem precisar recarregar a página:

- Listagem de memoriais escuta alterações na coluna `foto_url` da tabela `memoriais` para atualizar o avatar do card em tempo real
- Tela de detalhe do memorial escuta inserções na tabela `midias` para exibir as fotos da galeria conforme chegam
