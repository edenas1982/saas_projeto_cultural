--==========================================
--PROJETO ECOS DE MEMORIA
--Script Completo de Todas as Fases
--Compativel com Supabase
--==========================================
create extension if not exists "uuid-ossp";
--==========================================
--1. TABELA: PROFILES
--==========================================
create table profiles (
id uuid references auth.users(id) on delete cascade primary key,
email text,
nome text,
plano text default 'free' check (plano in ('free', 'premium')),
created_at timestamptz default now()
);
alter table profiles enable row level security;
create policy "Usuario acessa seu proprio perfil select" on profiles
for select using (auth.uid() = id);
create policy "Usuario atualiza seu proprio perfil" on profiles
for update using (auth.uid() = id);
create policy "Usuario insere seu proprio perfil" on profiles
for insert with check (auth.uid() = id);
--==========================================
--2. TABELA: MEMORIAIS
--==========================================
create table memoriais (
id uuid primary key default uuid_generate_v4(),
user_id uuid references auth.users(id) on delete cascade not null,
nome_homenageado text not null,
data_nascimento date,
data_falecimento date,
foto_url text,
densidade text default 'minimo' check (densidade in ('minimo', 'medio', 'documental')),
status text default 'rascunho' check (status in ('rascunho', 'gerado', 'publicado')),
perfil_tom_manual text check (perfil_tom_manual in ('rustico', 'urbano', 'erudito', 'popular')),
perfil_tom_inferido text,
consentimento_uso boolean default false,
publico boolean default false,
confirmado_pelo_usuario boolean default false,
total_perguntas_respondidas integer default 0,
aviso_imprecisao boolean default false,
frase_destaque text,
created_at timestamptz default now(),
updated_at timestamptz default now()
);
create index idx_memoriais_user_id on memoriais(user_id);
alter table memoriais enable row level security;
create policy "Usuario gerencia seus memoriais select" on memoriais
for select using (auth.uid() = user_id);
create policy "Usuario gerencia seus memoriais insert" on memoriais
for insert with check (auth.uid() = user_id);
create policy "Usuario gerencia seus memoriais update" on memoriais
for update using (auth.uid() = user_id);
create policy "Usuario gerencia seus memoriais delete" on memoriais
for delete using (auth.uid() = user_id);
create policy "Acesso publico memoriais confirmados" on memoriais
for select using (confirmado_pelo_usuario = true and publico = true);
--==========================================
--3. TRIGGER UPDATED_AT
--==========================================
create or replace function update_modified_column()
returns trigger as $$
begin
new.updated_at = now();
return new;
end;
$$ language plpgsql;
create trigger update_memoriais_modtime
before update on memoriais
for each row execute procedure update_modified_column();
--==========================================
--4. TABELA: PERGUNTAS
--==========================================
create table perguntas (
id text primary key,
gaveta text not null check (gaveta in ('identidade', 'jornada', 'essencia', 'legado')),
ordem integer not null,
texto_pergunta text not null,
placeholder text,
obrigatoria boolean default true,
tipo_saida text not null check (tipo_saida in ('fato', 'memoria', 'perfil_narrativo')),
created_at timestamptz default now()
);
create index idx_perguntas_gaveta on perguntas(gaveta);
alter table perguntas enable row level security;
create policy "Perguntas publicas para leitura" on perguntas
for select using (true);
--==========================================
--5. INSERCAO DAS 20 PERGUNTAS
--==========================================
insert into perguntas (id, gaveta, ordem, texto_pergunta, placeholder, obrigatoria, tipo_saida) values
('ide_01', 'identidade', 1, 'Qual o nome completo e onde nasceu?', 'Nome completo, cidade e estado de nascimento.', true, 'fato'),
('ide_02', 'identidade', 2, 'Em que ano nasceu e como era o lugar onde cresceu?', 'Ano de nascimento e uma descricao breve do lugar, se era cidade grande, interior, zona rural.', true, 'fato'),
('ide_03', 'identidade', 3, 'Quem foram os pais e de onde vieram?', 'Nome dos pais e origem da familia se souber, cidade, estado ou ate outro pais.', true, 'fato'),
('ide_04', 'identidade', 4, 'Como era a casa da infancia?', 'Qualquer detalhe que venha a memoria, um cheiro, uma imagem, algo que marcou aquele lugar.', false, 'memoria'),
('ide_05', 'identidade', 5, 'Tinha algum apelido ou algo que as pessoas sempre diziam sobre ele quando crianca?', 'Apelido de infancia, uma caracteristica marcante que a familia sempre comentava.', false, 'memoria'),
('jor_01', 'jornada', 6, 'Qual foi a principal profissao ou ocupacao da vida?', 'O trabalho principal, por quanto tempo exerceu e onde.', true, 'fato'),
('jor_02', 'jornada', 7, 'Com quem se casou ou construiu familia?', 'Nome do conjuge ou companheiro, ha quanto tempo juntos, filhos e netos se houver.', true, 'fato'),
('jor_03', 'jornada', 8, 'Quais foram as cidades ou lugares onde viveu ao longo da vida?', 'Lugares onde morou, mesmo que brevemente, em ordem se possivel.', true, 'fato'),
('jor_04', 'jornada', 9, 'Houve alguma mudanca grande ou virada na vida dele?', 'Uma mudanca de cidade, de profissao, uma perda, uma conquista que mudou o rumo da historia.', false, 'fato'),
('jor_05', 'jornada', 10, 'Como ele se relacionava com a familia no dia a dia?', 'Como era como pai, mae, avo, conjuge. Um gesto, uma cena, um habito com a familia.', false, 'memoria'),
('ess_01', 'essencia', 11, 'Tinha algum cheiro que lembra ele imediatamente?', 'Perfume, comida que fazia, cheiro de roupa, de trabalho, qualquer coisa que traga ele de volta.', true, 'memoria'),
('ess_02', 'essencia', 12, 'Qual era o maior prazer simples do dia a dia dele?', 'O cafe da manha, o programa de televisao favorito, a horta, a pesca, o chimarrao, qualquer coisa pequena e constante.', true, 'memoria'),
('ess_03', 'essencia', 13, 'Tinha alguma mania, habito ou jeito proprio de fazer as coisas?', 'Algo que ele sempre fazia do mesmo jeito, que era so dele, que todo mundo lembra com carinho ou com humor.', true, 'memoria'),
('ess_04', 'essencia', 14, 'Como eram os domingos ou os momentos de descanso dele?', 'O que ele fazia quando nao estava trabalhando, como ele descansava, com quem, onde.', false, 'memoria'),
('ess_05', 'essencia', 15, 'Como voce descreveria o jeito dele em uma palavra ou frase curta?', 'Nao precisa ser perfeito. Pode ser simples: era calmo, era agitado, era engracado, era teimoso do jeito certo.', false, 'perfil_narrativo'),
('leg_01', 'legado', 16, 'Tinha alguma frase que ele repetia sempre?', 'Um ditado, um conselho, uma expressao que era so dele e que quem conviveu nunca esquece.', true, 'memoria'),
('leg_02', 'legado', 17, 'O que ele ensinou que ficou para sempre?', 'Um ensinamento concreto, algo que ele fez ou disse que mudou quem estava ao redor.', true, 'memoria'),
('leg_03', 'legado', 18, 'Como as pessoas que conviveram com ele se sentiam na presenca dele?', 'Como era estar com ele, o que ele transmitia, o que mudava no ambiente quando ele estava.', true, 'memoria'),
('leg_04', 'legado', 19, 'Tem alguma historia que a familia sempre conta sobre ele?', 'Uma historia engracada, emocionante ou que resume bem quem ele era. Pode ser curta.', false, 'memoria'),
('leg_05', 'legado', 20, 'Se ele pudesse deixar uma ultima mensagem, o que voce acha que ele diria?', 'Nao precisa ser literal. Pode ser o que voce sente que ele transmitiria se pudesse.', false, 'memoria');
--==========================================
--6. TABELA: RESPOSTAS
--==========================================
create table respostas (
id uuid primary key default uuid_generate_v4(),
memorial_id uuid references memoriais(id) on delete cascade not null,
pergunta_id text references perguntas(id) not null,
pergunta_texto_snapshot text not null,
gaveta_snapshot text not null,
resposta text not null,
opcional boolean default false,
created_at timestamptz default now()
);
create index idx_respostas_memorial_id on respostas(memorial_id);
create index idx_respostas_pergunta_id on respostas(pergunta_id);
alter table respostas enable row level security;
create policy "Usuario acessa respostas dos seus memoriais select" on respostas
for select using (auth.uid() = (select user_id from memoriais where id = memorial_id));
create policy "Usuario acessa respostas dos seus memoriais insert" on respostas
for insert with check (auth.uid() = (select user_id from memoriais where id = memorial_id));
create policy "Usuario acessa respostas dos seus memoriais update" on respostas
for update using (auth.uid() = (select user_id from memoriais where id = memorial_id));
create policy "Usuario acessa respostas dos seus memoriais delete" on respostas
for delete using (auth.uid() = (select user_id from memoriais where id = memorial_id));
--==========================================
--7. TABELA: NARRATIVAS
--==========================================
create table narrativas (
id uuid primary key default uuid_generate_v4(),
memorial_id uuid references memoriais(id) on delete cascade not null,
template text not null check (template in ('visual', 'audio_first')),
conteudo_completo text,
conteudo_original text,
identidade_renderizada text,
jornada_renderizada text,
essencia_renderizada text,
legado_renderizado text,
modo_conteudo text default 'gerado_ia' check (modo_conteudo in ('gerado_ia', 'editado_pelo_usuario', 'escrito_pelo_usuario')),
versao integer default 1,
modelo_llm text,
prompt_version text,
narrativa_engine_version text,
audio_url text,
perguntas_usadas_na_geracao integer,
editado_em timestamptz,
gerado_em timestamptz default now()
);
create index idx_narrativas_memorial_id on narrativas(memorial_id);
create index idx_narrativas_gerado_em on narrativas(gerado_em);
alter table narrativas enable row level security;
create policy "Usuario acessa narrativas dos seus memoriais select" on narrativas
for select using (auth.uid() = (select user_id from memoriais where id = memorial_id));
create policy "Usuario acessa narrativas dos seus memoriais insert" on narrativas
for insert with check (auth.uid() = (select user_id from memoriais where id = memorial_id));
create policy "Usuario acessa narrativas dos seus memoriais update" on narrativas
for update using (auth.uid() = (select user_id from memoriais where id = memorial_id));
create policy "Acesso publico narrativas memoriais confirmados" on narrativas
for select using (exists (select 1 from memoriais where id = memorial_id and confirmado_pelo_usuario = true and publico = true));
--==========================================
--8. TABELA: EVENTOS DE GERACAO
--==========================================
create table eventos_geracao (
id uuid primary key default uuid_generate_v4(),
memorial_id uuid references memoriais(id) on delete cascade not null,
narrativa_id uuid references narrativas(id) on delete set null,
densidade_usada text,
tom_usado text,
modelo_llm text,
prompt_version text,
motivo_geracao text check (motivo_geracao in ('primeira geracao', 'regeneracao parcial', 'regeneracao completa', 'mudanca de tom')),
instrucao_ajuste text,
total_perguntas integer,
gerado_em timestamptz default now()
);
create index idx_eventos_memorial_id on eventos_geracao(memorial_id);
create index idx_eventos_gerado_em on eventos_geracao(gerado_em);
alter table eventos_geracao enable row level security;
create policy "Usuario acessa eventos dos seus memoriais select" on eventos_geracao
for select using (auth.uid() = (select user_id from memoriais where id = memorial_id));
create policy "Usuario insere eventos dos seus memoriais" on eventos_geracao
for insert with check (auth.uid() = (select user_id from memoriais where id = memorial_id));
--==========================================
--9. TABELA: QRCODES
--==========================================
create table qrcodes (
id uuid primary key default uuid_generate_v4(),
memorial_id uuid references memoriais(id) on delete cascade not null unique,
codigo text not null unique,
url_destino text not null,
ativo boolean default true,
total_acessos integer default 0,
ultimo_acesso timestamptz,
created_at timestamptz default now()
);
create index idx_qrcodes_memorial_id on qrcodes(memorial_id);
create index idx_qrcodes_codigo on qrcodes(codigo);
alter table qrcodes enable row level security;
create policy "Usuario acessa qrcode dos seus memoriais" on qrcodes
for select using (auth.uid() = (select user_id from memoriais where id = memorial_id));
create policy "Usuario cria qrcode dos seus memoriais" on qrcodes
for insert with check (auth.uid() = (select user_id from memoriais where id = memorial_id));
create policy "Acesso publico qrcode ativo" on qrcodes
for select using (ativo = true);
--==========================================
--10. TABELA: FATOS
--==========================================
create table fatos (
id uuid primary key default uuid_generate_v4(),
memorial_id uuid references memoriais(id) on delete cascade not null,
tipo_fato text not null check (tipo_fato in ('nascimento', 'cidade', 'profissao', 'casamento', 'formacao', 'outros')),
conteudo text not null,
ano_referencia integer,
metadados jsonb,
created_at timestamptz default now()
);
create index idx_fatos_memorial_id on fatos(memorial_id);
create index idx_fatos_tipo_fato on fatos(tipo_fato);
create index idx_fatos_metadados on fatos using gin(metadados);
alter table fatos enable row level security;
create policy "Usuario acessa fatos dos seus memoriais select" on fatos
for select using (auth.uid() = (select user_id from memoriais where id = memorial_id));
create policy "Usuario acessa fatos dos seus memoriais insert" on fatos
for insert with check (auth.uid() = (select user_id from memoriais where id = memorial_id));
create policy "Usuario acessa fatos dos seus memoriais update" on fatos
for update using (auth.uid() = (select user_id from memoriais where id = memorial_id));
create policy "Usuario acessa fatos dos seus memoriais delete" on fatos
for delete using (auth.uid() = (select user_id from memoriais where id = memorial_id));
--==========================================
--11. TABELA: MEMORIAS
--==========================================
create table memorias (
id uuid primary key default uuid_generate_v4(),
memorial_id uuid references memoriais(id) on delete cascade not null,
tipo_memoria text not null check (tipo_memoria in ('cheiro', 'habito', 'frase', 'ensinamento', 'historia', 'ritual')),
conteudo text not null,
intensidade_emocional integer check (intensidade_emocional between 1 and 5),
sensorial boolean default false,
origem text,
contexto_temporal text check (contexto_temporal in ('infancia', 'juventude', 'fase adulta', 'ultimos anos')),
relacionado_a text check (relacionado_a in ('profissao', 'casamento', 'lugar', 'familia', 'outros')),
relevancia_narrativa integer check (relevancia_narrativa between 1 and 5),
created_at timestamptz default now()
);
create index idx_memorias_memorial_id on memorias(memorial_id);
create index idx_memorias_tipo_memoria on memorias(tipo_memoria);
alter table memorias enable row level security;
create policy "Usuario acessa memorias dos seus memoriais select" on memorias
for select using (auth.uid() = (select user_id from memoriais where id = memorial_id));
create policy "Usuario acessa memorias dos seus memoriais insert" on memorias
for insert with check (auth.uid() = (select user_id from memoriais where id = memorial_id));
create policy "Usuario acessa memorias dos seus memoriais update" on memorias
for update using (auth.uid() = (select user_id from memoriais where id = memorial_id));
create policy "Usuario acessa memorias dos seus memoriais delete" on memorias
for delete using (auth.uid() = (select user_id from memoriais where id = memorial_id));
--==========================================
--12. TABELA: TAGS SEMANTICAS
--==========================================
create table tags_semanticas (
id uuid primary key default uuid_generate_v4(),
entity_type text not null check (entity_type in ('resposta', 'memoria', 'contribuicao', 'narrativa')),
entity_id uuid not null,
categoria text not null check (categoria in ('contemplacao', 'disciplina', 'humor', 'delicadeza', 'resistencia', 'afeto', 'silencio', 'lideranca', 'outros')),
intensidade integer check (intensidade between 1 and 5),
origem_ia boolean default true,
created_at timestamptz default now()
);
create index idx_tags_entity_id on tags_semanticas(entity_id);
create index idx_tags_entity_type on tags_semanticas(entity_type);
create index idx_tags_categoria on tags_semanticas(categoria);
alter table tags_semanticas enable row level security;
create policy "Tags acessiveis para leitura" on tags_semanticas
for select using (true);
create policy "Tags inseridas pelo sistema" on tags_semanticas
for insert with check (true);
--==========================================
--13. TABELA: PERFIL NARRATIVO
--==========================================
create table perfil_narrativo (
id uuid primary key default uuid_generate_v4(),
memorial_id uuid references memoriais(id) on delete cascade not null unique,
ritmo text check (ritmo in ('lento', 'medio', 'acelerado')),
temperatura text check (temperatura in ('fria', 'neutra', 'quente')),
formalidade text check (formalidade in ('coloquial', 'neutro', 'formal')),
expansividade text check (expansividade in ('conciso', 'equilibrado', 'expansivo')),
sensorialidade text check (sensorialidade in ('baixa', 'media', 'alta')),
eixos jsonb,
inferido_pela_ia boolean default true,
created_at timestamptz default now()
);
create index idx_perfil_memorial_id on perfil_narrativo(memorial_id);
create index idx_perfil_eixos on perfil_narrativo using gin(eixos);
alter table perfil_narrativo enable row level security;
create policy "Usuario acessa perfil dos seus memoriais select" on perfil_narrativo
for select using (auth.uid() = (select user_id from memoriais where id = memorial_id));
create policy "Usuario acessa perfil dos seus memoriais insert" on perfil_narrativo
for insert with check (auth.uid() = (select user_id from memoriais where id = memorial_id));
create policy "Usuario acessa perfil dos seus memoriais update" on perfil_narrativo
for update using (auth.uid() = (select user_id from memoriais where id = memorial_id));
--==========================================
--14. TABELA: TRANSICOES DE BLOCO
--==========================================
create table transicoes_bloco (
id uuid primary key default uuid_generate_v4(),
gaveta_origem text not null,
gaveta_destino text not null,
tom text not null,
texto_transicao text not null
);
alter table transicoes_bloco enable row level security;
create policy "Transicoes publicas para leitura" on transicoes_bloco
for select using (true);
--==========================================
--15. TABELA: MIDIAS
--==========================================
create table midias (
id uuid primary key default uuid_generate_v4(),
memorial_id uuid references memoriais(id) on delete cascade not null,
tipo_midia text not null check (tipo_midia in ('foto', 'audio', 'video', 'documento', 'carta', 'receita')),
url text not null,
descricao text,
ordem integer default 0,
aprovado boolean default false,
created_at timestamptz default now()
);
create index idx_midias_memorial_id on midias(memorial_id);
alter table midias enable row level security;
create policy "Usuario gerencia midias dos seus memoriais select" on midias
for select using (auth.uid() = (select user_id from memoriais where id = memorial_id));
create policy "Usuario gerencia midias dos seus memoriais insert" on midias
for insert with check (auth.uid() = (select user_id from memoriais where id = memorial_id));
create policy "Usuario gerencia midias dos seus memoriais update" on midias
for update using (auth.uid() = (select user_id from memoriais where id = memorial_id));
create policy "Usuario gerencia midias dos seus memoriais delete" on midias
for delete using (auth.uid() = (select user_id from memoriais where id = memorial_id));
create policy "Acesso publico midias memoriais confirmados" on midias
for select using (exists (select 1 from memoriais where id = memorial_id and confirmado_pelo_usuario = true and publico = true));
--==========================================
--16. TABELA: CONTRIBUICOES
--==========================================
create table contribuicoes (
id uuid primary key default uuid_generate_v4(),
memorial_id uuid references memoriais(id) on delete cascade not null,
autor_nome text not null,
autor_relacao text check (autor_relacao in ('filho', 'conjuge', 'amigo', 'outros')),
conteudo text not null,
tipo text check (tipo in ('memoria', 'frase', 'historia', 'ensinamento')),
aprovado boolean default false,
created_at timestamptz default now()
);
create index idx_contribuicoes_memorial_id on contribuicoes(memorial_id);
alter table contribuicoes enable row level security;
create policy "Usuario gerencia contribuicoes dos seus memoriais" on contribuicoes
for select using (auth.uid() = (select user_id from memoriais where id = memorial_id));
create policy "Qualquer pessoa pode enviar contribuicao" on contribuicoes
for insert with check (true);
create policy "Usuario aprova contribuicoes dos seus memoriais" on contribuicoes
for update using (auth.uid() = (select user_id from memoriais where id = memorial_id));
--==========================================
--17. TABELA: AUTORIZACOES
--==========================================
create table autorizacoes (
id uuid primary key default uuid_generate_v4(),
memorial_id uuid references memoriais(id) on delete cascade not null,
user_id uuid references auth.users(id) not null,
tipo_autorizacao text not null check (tipo_autorizacao in ('certidao_obito', 'video_declaracao', 'manual')),
arquivo_url text,
dados_extraidos jsonb,
status text default 'pendente' check (status in ('pendente', 'aprovado', 'reprovado', 'revisao_manual')),
resultado_ia text,
aprovado_por text,
created_at timestamptz default now(),
updated_at timestamptz default now()
);
create index idx_autorizacoes_memorial_id on autorizacoes(memorial_id);
create index idx_autorizacoes_user_id on autorizacoes(user_id);
create index idx_autorizacoes_status on autorizacoes(status);
alter table autorizacoes enable row level security;
create policy "Usuario acessa suas autorizacoes select" on autorizacoes
for select using (auth.uid() = user_id);
create policy "Usuario envia autorizacao" on autorizacoes
for insert with check (auth.uid() = user_id);
create trigger update_autorizacoes_modtime
before update on autorizacoes
for each row execute procedure update_modified_column();
--==========================================
--18. TABELA: MENSAGENS DE VISITANTES
--==========================================
create table mensagens_visitantes (
id uuid primary key default uuid_generate_v4(),
memorial_id uuid references memoriais(id) on delete cascade not null,
autor_nome text not null,
conteudo text not null,
aprovado boolean default false,
created_at timestamptz default now()
);
create index idx_mensagens_memorial_id on mensagens_visitantes(memorial_id);
alter table mensagens_visitantes enable row level security;
create policy "Qualquer pessoa pode enviar mensagem" on mensagens_visitantes
for insert with check (true);
create policy "Usuario gerencia mensagens dos seus memoriais select" on mensagens_visitantes
for select using (auth.uid() = (select user_id from memoriais where id = memorial_id));
create policy "Usuario aprova mensagens dos seus memoriais" on mensagens_visitantes
for update using (auth.uid() = (select user_id from memoriais where id = memorial_id));
create policy "Acesso publico mensagens aprovadas" on mensagens_visitantes
for select using (aprovado = true and exists (select 1 from memoriais where id = memorial_id and confirmado_pelo_usuario = true and publico = true));
--==========================================
--FIM DO SCRIPT
--Observacao: A integridade referencial
--polimorfica da tabela tags_semanticas
--e garantida pela aplicacao, nao pelo banco.
--==========================================
