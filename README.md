# Ecos de Memória

Sistema de criação de biografias e homenagens, focando em transformar histórias de vida em experiências significativas.

## Repositório e Deploy no Vercel

Este projeto já está configurado para publicação (deploy) rápido na plataforma **Vercel**, bastando importar o repositório e configurar as variáveis de ambiente.

## Configuração Local

### Pré-requisitos
- Node.js versão 18 ou superior

### Variáveis de Ambiente
Crie um arquivo `.env` (ou `.env.local`) copiando do `.env.example` e preencha as seguintes chaves:

- `VITE_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`: Sua URL pública do projeto Supabase.
- `VITE_SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Sua chave anônima (anon) do Supabase.
- `SUPABASE_SERVICE_ROLE_KEY`: A chave administrativa (Service Role) do Supabase - **Essencial para a API do Backend**.
- `ANTHROPIC_API_KEY`: Sua chave de API da Anthropic, para geração das narrativas com o modelo Claude.

### Iniciando

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Inicie o servidor em ambiente de desenvolvimento:
   ```bash
   npm run dev
   ```

O frontend abrirá automaticamente no seu navegador. O servidor backend (Express) e o frontend (Vite) rodarão em conjunto pelo `tsx server.ts`.

## Arquitetura
- Frontend: React 18, Vite e TailwindCSS.
- Backend/Serverless: Express (com integração Vercel Functions).
- IA de Geração: API Claude (Anthropic).
- Banco de Dados / Auth: Supabase.
