# PROGRESSO — Projeto Cultural
> Atualize este arquivo ao final de cada sessão de trabalho.
> Leia este arquivo ANTES de iniciar qualquer tarefa neste núcleo.

---

## ✅ ENTREGUE E FUNCIONAL (não refazer)

### Autenticação e Dashboard
- Login, cadastro e recuperação de senha via Supabase Auth.
- Painel principal com listagem de memoriais do usuário.
- Suporte a múltiplos memoriais por conta.
- MemorialCard com ações: alterar foto/datas, excluir, baixar QR Code, acessar biografia, ver progresso.

### Criação e Quiz
- Painel de criação com dados básicos e upload de foto principal.
- Upload de até 10 fotos adicionais para galeria.
- 4 gavetas implementadas e interativas (20 perguntas).
- Salvamento incremental — usuário pode retornar e continuar.

### Geração de Narrativa
- Tela de configuração: tamanho (150/250/350+ palavras), tom narrativo, escolha de voz.
- Aviso de imprecisão com opt-in obrigatório.
- Modal de progresso durante geração.
- Integração com Claude API (`claude-sonnet-4-6`).
- Curadoria afetiva: edição livre, ajuste focal por IA, opção de escrever do próprio punho.

### Áudio e Portal Público
- Geração de áudio via Google Cloud TTS, gravado no Supabase Storage.
- QR Code em alta resolução para download/impressão.
- Portal público: foto, datas, player de áudio, texto biográfico, carrossel de fotos.
- Diário de condolências com moderação manual.

### Infraestrutura
- Backend Express com rotas protegidas por JWT.
- Supabase com 18 tabelas, RLS ativo, schema `public`.

---

## 🔲 BACKLOG — O QUE FALTA (Fase 3 e otimizações)

### Prioridade Alta
- [ ] **Autorização Inteligente (OCR)**: Upload de certidão de óbito + análise via Google Vision / Tesseract. Enfileirar para aprovação manual ou automática antes de liberar QR Code definitivo.
- [ ] **Fallback Gemini no backend**: Integrar SDK do Gemini no Express como alternativa ao Claude para geração narrativa.

### Prioridade Média
- [ ] **Busca pública global**: Tela em `ProjetoCultural.tsx` com busca de memoriais públicos por nome, cidade ou ano.
- [ ] **QR Code temporário vs permanente**: Lógica de expiração para QR de velório vs QR definitivo de lápide.

### Prioridade Baixa / Futuro
- [ ] **Validação por vídeo**: Fluxo alternativo à certidão — gravação/transcrição de intenção de parentesco.
- [ ] **Painel de revisão manual**: Interface admin para aprovar/rejeitar autorizações com resultado do OCR.
- [ ] **Multilogin familiar**: Múltiplos familiares contribuindo para o mesmo memorial (pertence à integração com SaaS).
