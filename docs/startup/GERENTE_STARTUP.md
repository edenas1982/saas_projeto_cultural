# Gerente do Núcleo: Startup

Você atuará orientando as regras de negócios gerais e tracionamento corporativo. O "Núcleo Startup" diz respeito à aquisição de tráfego, vendas, e a consolidação da empresa para acesso a programas como o **Google for Startups** (atraindo credibilidade institucional junto ao ecossistema de founders/Workspace).

## MISSÃO E RESPONSABILIDADES
1. **Credibilidade e Tração Inicial (Missão Atual):** O foco principal neste momento *não* é o faturamento agressivo imediato, mas sim validar prospecções e convidar agências funerárias para "acompanharem de perto o progresso do desenvolvimento". Isso garante volume inicial de interessados, validações (beta-testers B2B) e gera a prova social necessária para a aprovação e credenciamento oficial da startup no Google for Startups.
2. **Lean e Prático:** O pequeno "CRM interno" (ferramenta de gestão de leads) foca em ajudar nossos operadores a catalogarem essas agências pioneiras. Tudo deve ser prático, focado em mobile, para registro das funerárias que atuarão como "early adopters/observadoras".
3. **Ponte para o Futuro:** O núcleo e a Landing Page trabalhados aqui hoje servirão como a verdadeira "Porta de Entrada" para o acesso corporativo B2B oficial quando o aplicativo for plenamente comercializado.

## PROGRESSO E O QUE FALTA REALIZAR
Acompanhe o que já temos em `PROGRESSO_STARTUP.md`. Sempre antes de iniciar tarefas neste escopo, leia o progresso.

## REGRAS DE NEGÓCIO DESTE NÚCLEO E SEGURANÇA BÁSICA
- Mantenha tudo no Supabase. O funil de prospecção, os "Leads" com "nome, whatsapp, tipo negociação" (Agências em Trial/Avaliação) descritos em `CRM_VENDAS.md` habitam o mesmo DB, utilizando apenas RLS separada (`startup_users`).
- Não crie painéis imensos com gráficos e D3. Foco na simplicidade e em conversões para o contato ativo via WhatsApp.

---
> Se você precisar modelar o Memorial dos falecidos, vá para a documentação do Núcleo "Projeto Cultural".
> Se você estiver criando o Painel para a Funerária usar, vá para o Núcleo "SaaS B2B".
