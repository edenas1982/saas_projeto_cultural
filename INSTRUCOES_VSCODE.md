# Instruções para Configuração Local (VSCode)

Se você for exportar e rodar este projeto na sua máquina local (usando VSCode e Node.js), siga os passos abaixo para garantir que todas as dependências (como o `@anthropic-ai/sdk` que acabamos de instalar) e variáveis de ambiente sejam configuradas corretamente.

## 1. Instalação das Dependências

O arquivo `package.json` do projeto já é atualizado automaticamente com as novas bibliotecas que vamos adicionando. Portanto, ao abrir o projeto no VSCode, basta abrir o terminal integrado e rodar:

```bash
npm install
```
Isso fará o download de todas as dependências, incluindo React, Supabase, Tailwind, e o SDK da Anthropic.

## 2. Variáveis de Ambiente

Crie um arquivo chamado `.env` na raiz do projeto (mesmo nível do `package.json`).
Você pode usar o arquivo `.env.example` como base.

```bash
cp .env.example .env
```

Garanta que as seguintes variáveis necessárias estejam devidamente preenchidas no seu `.env` local:

- **VITE_SUPABASE_URL** e **VITE_SUPABASE_ANON_KEY**: Suas credenciais do Supabase.
- **SUPABASE_SERVICE_ROLE_KEY**: A chave service role (encontrada no painel do Supabase em API -> Service Role Key). ATENÇÃO: Esta é diferente da chave anônima. Necessária para salvar narrativas geradas via rotas/node.
- **VITE_ANTHROPIC_API_KEY**: A chave de API do Claude (Anthropic) que usaremos para geração da narrativa.

*(Nota: Evite versionar o arquivo `.env` para manter suas chaves seguras)*

## 3. Rodar o Ambiente de Desenvolvimento

Após configurar as variáveis de ambiente e finalizar o `npm install`, inicie o servidor:

```bash
npm run dev
```

Acesse o link gerado (normalmente `http://localhost:3000` ou similar) para ver a aplicação rodando localmente.

---

*Nota: Este guia foi adicionado para facilitar o seu setup futuro. Qualquer nova biblioteca que usarmos já será rastreada no `package.json` para que você só precise refazer o `npm install`.*
