# Diretrizes do CRM de Vendas Diárias (Startup)

Este documento define a estrutura e o objetivo do sistema comercial interno para a equipe de vendas da Ecos de Memória.

## PRINCÍPIOS
- Priorizar simplicidade acima de tudo.
- Evitar funcionalidades desnecessárias.
- Tudo deve funcionar bem no celular (mobile-first).
- Interface rápida, limpa e fácil de usar.
- Foco em ação, não em análise.

## OBJETIVO DO SISTEMA
Ajudar o usuário a conseguir clientes (organizações, funerárias, prefeituras) todos os dias, organizando leads e tarefas de forma clara.

## FUNCIONAMENTO ESPERADO
- O usuário deve abrir o sistema e saber exatamente o que fazer.
- O sistema deve destacar:
  1. Leads novos
  2. Tarefas do dia
  3. Follow-ups pendentes

## ESTRUTURA PRINCIPAL
1. **Leads**
   - Cadastro simples (nome, WhatsApp, tipo de negócio).
   - Status: novo, contato, proposta, fechado.

2. **Tarefas**
   - Criar tarefas rápidas.
   - Marcar como concluído.
   - Ligação com leads.

3. **Follow-up**
   - Identificar leads sem contato recente.
   - Sugerir ação (chamar, enviar mensagem).

4. **Ação rápida**
   - Botão para abrir WhatsApp direto com mensagem pronta.

## REGRAS IMPORTANTES PARA DESENVOLVIMENTO
- Evitar dashboards complexos.
- Evitar excesso de dados e automações complicadas neste momento.
- Sempre priorizar usabilidade no celular e design minimalista.
- Poucos botões, texto claro e direto, navegação simples.
- Utilização estrita do Supabase (`public`) para as tabelas (ex: `crm_leads`, `crm_tasks`).
- A IA/Gemini deve sempre sugerir soluções simples sem sobrecarregar a estrutura.
