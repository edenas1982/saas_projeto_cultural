# 📈 Progresso e Checklist: Cockpit de Telemetria (Fase 1)

> Este documento acompanha o andamento das tarefas de desenvolvimento da tela e da API de observabilidade de consumo do Núcleo Startup (Acesso Temporário).

---

## 🚀 CHECKLIST DE EXECUÇÃO

### 1. Banco de Dados (Supabase)
- [/] Criar a View SQL `vw_telemetry_summary` para agregação de custos e requisições no Postgres. (Pendente Execução SQL via console)

### 2. Backend & Segurança (Express)
- [x] Criar `/src/middleware/auth.ts` extraindo a lógica `authenticateToken` do `server.ts`.
- [x] Criar `/src/lib/supabaseAdmin.ts` exportando o cliente Supabase com a role administrativa.
- [x] Criar o Service `/src/services/startup/TelemetryCockpitService.ts` com as consultas otimizadas.
- [x] Criar o Controller `/src/controllers/startup/TelemetryCockpitController.ts` para tratar as requisições.
- [x] Criar o arquivo de rotas `/src/routes/startup/telemetria.routes.ts` com os 5 endpoints.
- [x] Atualizar `server.ts` para importar o middleware central e registrar o novo roteador de rotas.

### 3. Frontend & UI (React/Vite)
- [x] Criar a página de visualização `/src/pages/startup/TelemetryCockpitPage.tsx`.
- [x] Registrar a rota `/startup/telemetria` no arquivo principal de roteamento `/src/App.tsx`.
- [x] Inserir o botão secundário de acesso em `/src/pages/ParaAvaliadores.tsx` ao lado do botão de login existente.

### 4. Validação & Homologação
- [/] Testar se o cálculo matemático dos KPIs bate com os registros reais.
- [/] Validar a segurança dos endpoints (acesso sem token deve retornar `401 Unauthorized` ou `403 Forbidden`).
- [/] Testar a exportação de CSV e a abertura correta de decimais e delimitadores no Excel.
