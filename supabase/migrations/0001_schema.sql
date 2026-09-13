-- CRM Comercial F-Led — migration 0001: schema, triggers, RLS, views
-- Gerado a partir de SPEC.md (seções 3.2, 3.4, 3.5, 3.6). Não editar à mão: alterar a SPEC e regerar.
-- Rodar no SQL Editor do Supabase ou via `supabase db push`.

create extension if not exists pg_trgm;
create extension if not exists unaccent;

-- ---------- 3.2 DDL ----------
-- =========================================================
-- USUÁRIOS (espelho de auth.users)
-- =========================================================
create type perfil_usuario as enum ('diretor','vendedor');

create table usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text not null unique,
  perfil perfil_usuario not null default 'vendedor',
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- cria a linha em usuarios quando um usuário é convidado/criado no Auth
create or replace function handle_new_auth_user() returns trigger language plpgsql security definer as $$
begin
  insert into public.usuarios (id, nome, email, perfil)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)), new.email,
          coalesce((new.raw_user_meta_data->>'perfil')::perfil_usuario, 'vendedor'))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger trg_auth_user after insert on auth.users for each row execute function handle_new_auth_user();

-- =========================================================
-- FUNIS E ETAPAS (parametrizáveis)
-- =========================================================
create table funis (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ordem int not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table etapas (
  id uuid primary key default gen_random_uuid(),
  funil_id uuid not null references funis(id) on delete cascade,
  nome text not null,
  ordem int not null,
  dica text,                                   -- "quando mover para cá"
  conta_como_proposta boolean not null default false,
  ativo boolean not null default true,
  unique (funil_id, ordem)
);

-- =========================================================
-- LISTAS EDITÁVEIS
-- =========================================================
create type tipo_lista as enum ('segmento','linha','origem','motivo_perda');

create table listas (
  id uuid primary key default gen_random_uuid(),
  tipo tipo_lista not null,
  valor text not null,
  ordem int not null default 0,
  ativo boolean not null default true,
  unique (tipo, valor)
);

create table config (
  chave text primary key,
  valor text not null
);

-- =========================================================
-- EMPRESAS E CONTATOS
-- =========================================================
create table empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cidade text,
  uf char(2),
  segmento text,
  cnpj text,
  responsavel_id uuid references usuarios(id),
  observacoes text,
  arquivado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
-- unaccent não é IMMUTABLE; usar wrapper para poder indexar
create or replace function f_unaccent(text) returns text language sql immutable parallel safe as $$ select unaccent($1) $$;
create unique index empresas_nome_unico on empresas (lower(f_unaccent(nome))) where arquivado_em is null;
create index empresas_nome_trgm on empresas using gin (nome gin_trgm_ops);

create table contatos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  nome text not null,
  whatsapp text,               -- só dígitos com DDI, ex: 5531999998888
  email text,
  cargo text,
  decisor boolean not null default false,
  arquivado_em timestamptz,
  criado_em timestamptz not null default now()
);

-- =========================================================
-- NEGOCIAÇÕES
-- =========================================================
create type status_negociacao as enum ('aberta','vendida','perdida');

create table negociacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  contato_id uuid references contatos(id),
  funil_id uuid not null references funis(id),
  etapa_id uuid not null references etapas(id),
  titulo text not null,
  linha text,
  origem text,
  valor_estimado numeric(14,2) not null default 0,
  temperatura smallint not null default 2 check (temperatura in (1,2,3)), -- 1 fria, 2 morna, 3 quente
  previsao_mes date,                       -- sempre dia 1 do mês
  responsavel_id uuid not null references usuarios(id),
  status status_negociacao not null default 'aberta',
  valor_final numeric(14,2),
  motivo_perda text,
  anotacao_fechamento text,
  fechado_em timestamptz,
  etapa_desde timestamptz not null default now(),
  arquivado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index negociacoes_resp on negociacoes (responsavel_id, status);
create index negociacoes_funil_etapa on negociacoes (funil_id, etapa_id) where status = 'aberta';

-- =========================================================
-- INTERAÇÕES (timeline)
-- =========================================================
create type tipo_interacao as enum ('ligacao','whatsapp','visita','reuniao','email','anotacao','sistema');

create table interacoes (
  id uuid primary key default gen_random_uuid(),
  negociacao_id uuid not null references negociacoes(id) on delete cascade,
  tipo tipo_interacao not null,
  texto text,
  usuario_id uuid references usuarios(id),
  origem_agente boolean not null default false,   -- true quando criado via MCP
  criado_em timestamptz not null default now()
);
create index interacoes_neg on interacoes (negociacao_id, criado_em desc);

-- =========================================================
-- AÇÕES (próximas ações / tarefas)
-- =========================================================
create type tipo_acao as enum ('ligar','whatsapp','visita','reuniao','proposta','outro');

create table acoes (
  id uuid primary key default gen_random_uuid(),
  negociacao_id uuid not null references negociacoes(id) on delete cascade,
  descricao text not null,
  tipo tipo_acao not null default 'ligar',
  data date not null,
  hora time,
  responsavel_id uuid not null references usuarios(id),
  concluida_em timestamptz,
  criado_em timestamptz not null default now()
);
create index acoes_pendentes on acoes (responsavel_id, data) where concluida_em is null;

-- =========================================================
-- ORÇAMENTOS
-- =========================================================
create type situacao_orcamento as enum ('enviado','aprovado','recusado','substituido');

create table orcamentos (
  id uuid primary key default gen_random_uuid(),
  negociacao_id uuid not null references negociacoes(id) on delete cascade,
  numero text,
  valor numeric(14,2) not null,
  enviado_em date not null default current_date,
  validade date,
  arquivo_path text,                 -- Supabase Storage bucket "orcamentos"
  situacao situacao_orcamento not null default 'enviado',
  criado_em timestamptz not null default now()
);

-- =========================================================
-- PRODUTOS E ITENS DE ORÇAMENTO — base criada na entrega 1,
-- telas na entrega 3 (ver seção 8)
-- =========================================================
create table produtos (
  id uuid primary key default gen_random_uuid(),
  codigo text unique,                 -- código interno / SKU
  nome text not null,
  descricao text,                     -- texto que sai no orçamento
  linha text,                         -- referencia listas.tipo='linha'
  unidade text not null default 'un', -- un, pç, m, kit, h
  preco_base numeric(14,2) not null default 0,  -- único preço cadastrado; o preço real é editado item a item
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index produtos_nome_trgm on produtos using gin (nome gin_trgm_ops);

create table orcamento_itens (
  id uuid primary key default gen_random_uuid(),
  orcamento_id uuid not null references orcamentos(id) on delete cascade,
  produto_id uuid references produtos(id),     -- nulo permite item livre
  ordem int not null default 0,
  descricao text not null,                     -- copiada do produto, editável
  unidade text not null default 'un',
  quantidade numeric(12,3) not null default 1,
  preco_unitario numeric(14,2) not null,       -- default = produtos.preco_base, sempre editável
  desconto_pct numeric(5,2) not null default 0,
  total numeric(14,2) generated always as (round(quantidade * preco_unitario * (1 - desconto_pct/100), 2)) stored
);
create index orcitens_orc on orcamento_itens (orcamento_id, ordem);

-- Campos extras em orcamentos (adicionar à tabela acima):
alter table orcamentos
  add column origem text not null default 'upload' check (origem in ('upload','gerado')),
  add column titulo text,                           -- "Fornecimento de luminárias LED – Obra X"
  add column condicoes_pagamento text,
  add column prazo_entrega text,
  add column frete text,                            -- CIF / FOB / a combinar
  add column observacoes text,
  add column desconto_geral_pct numeric(5,2) not null default 0,
  add column subtotal numeric(14,2),                -- Σ itens.total, recalculado por trigger
  add column arquivo_pdf_path text,                 -- gerado
  add column arquivo_xlsx_path text;                -- gerado
-- 'numero' passa a ser gerado por sequência quando origem='gerado' (ver 3.4)

-- Dados do emitente (cabeçalho do orçamento), editável em Configurações
create table emitente (
  id int primary key default 1 check (id = 1),
  razao_social text not null,
  cnpj text,
  endereco text,
  telefone text,
  email text,
  site text,
  logo_path text,                                   -- Storage bucket "publico"
  validade_padrao_dias int not null default 15,
  condicoes_pagamento_padrao text,
  prazo_entrega_padrao text,
  rodape text                                       -- texto legal / garantia
);

-- =========================================================
-- API KEYS E LOG (MCP) — entrega 2
-- =========================================================
create table mcp_log (
  id bigint generated always as identity primary key,
  key_id uuid,
  tool text not null,
  args jsonb,
  ok boolean not null,
  erro text,
  ms int,
  criado_em timestamptz not null default now()
);

create table api_keys (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  nome text not null,
  key_hash text not null unique,     -- sha256 da key; a key só é exibida uma vez
  criado_em timestamptz not null default now(),
  revogado_em timestamptz
);

-- ---------- 3.4 Triggers e funções ----------
-- atualizado_em
create or replace function set_atualizado_em() returns trigger language plpgsql as $$
begin new.atualizado_em = now(); return new; end $$;
create trigger trg_emp_upd before update on empresas for each row execute function set_atualizado_em();
create trigger trg_neg_upd before update on negociacoes for each row execute function set_atualizado_em();

-- ao mudar de etapa: reseta etapa_desde e grava interação 'sistema'
create or replace function on_negociacao_etapa_change() returns trigger language plpgsql as $$
declare v_de text; v_para text;
begin
  if new.etapa_id is distinct from old.etapa_id then
    new.etapa_desde = now();
    select nome into v_de from etapas where id = old.etapa_id;
    select nome into v_para from etapas where id = new.etapa_id;
    insert into interacoes (negociacao_id, tipo, texto, usuario_id)
    values (new.id, 'sistema', format('Moveu de "%s" para "%s"', v_de, v_para), auth.uid());
  end if;
  if new.status is distinct from old.status then
    insert into interacoes (negociacao_id, tipo, texto, usuario_id)
    values (new.id, 'sistema',
      case new.status when 'vendida' then format('Marcada como vendida: R$ %s', new.valor_final)
                      when 'perdida' then format('Marcada como perdida: %s', new.motivo_perda)
                      else 'Reaberta' end, auth.uid());
  end if;
  return new;
end $$;
create trigger trg_neg_etapa before update on negociacoes for each row execute function on_negociacao_etapa_change();

-- subtotal e valor do orçamento gerado recalculados a partir dos itens
create or replace function recalc_orcamento(p_id uuid) returns void language plpgsql as $$
declare v_sub numeric(14,2); v_desc numeric(5,2);
begin
  select coalesce(sum(total),0) into v_sub from orcamento_itens where orcamento_id = p_id;
  select desconto_geral_pct into v_desc from orcamentos where id = p_id;
  update orcamentos set subtotal = v_sub, valor = round(v_sub * (1 - coalesce(v_desc,0)/100), 2)
  where id = p_id and origem = 'gerado';
end $$;

create or replace function trg_orcitens_recalc() returns trigger language plpgsql as $$
begin perform recalc_orcamento(coalesce(new.orcamento_id, old.orcamento_id)); return null; end $$;
create trigger trg_orcitens after insert or update or delete on orcamento_itens
  for each row execute function trg_orcitens_recalc();

-- numeração sequencial ORC-2026-0001 para orçamentos gerados
create or replace function proximo_numero_orcamento() returns text language plpgsql as $$
declare n int; p text;
begin
  update config set valor = (valor::int + 1)::text where chave = 'orcamento_proximo_numero' returning (valor::int - 1) into n;
  select valor into p from config where chave = 'orcamento_prefixo';
  return format('%s-%s-%s', p, to_char(now(), 'YYYY'), lpad(n::text, 4, '0'));
end $$;

-- helper: perfil do usuário logado
create or replace function eh_diretor() returns boolean language sql stable as $$
  select exists (select 1 from usuarios where id = auth.uid() and perfil = 'diretor' and ativo);
$$;

-- ---------- 3.5 RLS ----------
alter table usuarios enable row level security;
alter table funis enable row level security;
alter table etapas enable row level security;
alter table listas enable row level security;
alter table config enable row level security;
alter table empresas enable row level security;
alter table contatos enable row level security;
alter table negociacoes enable row level security;
alter table interacoes enable row level security;
alter table acoes enable row level security;
alter table orcamentos enable row level security;
alter table produtos enable row level security;
alter table orcamento_itens enable row level security;
alter table emitente enable row level security;
alter table mcp_log enable row level security;
alter table api_keys enable row level security;

-- usuarios: todos leem (para mostrar nomes); só diretor escreve
create policy usuarios_sel on usuarios for select using (true);
create policy usuarios_mod on usuarios for all using (eh_diretor());

-- funis, etapas, listas, config: todos leem, diretor escreve
create policy funis_sel on funis for select using (true);
create policy funis_mod on funis for all using (eh_diretor());
create policy etapas_sel on etapas for select using (true);
create policy etapas_mod on etapas for all using (eh_diretor());
create policy listas_sel on listas for select using (true);
create policy listas_mod on listas for all using (eh_diretor());
create policy config_sel on config for select using (true);
create policy config_mod on config for all using (eh_diretor());

-- empresas e contatos: todos leem; escreve se diretor, ou responsável, ou sem responsável
create policy empresas_sel on empresas for select using (true);
create policy empresas_ins on empresas for insert with check (true);
create policy empresas_upd on empresas for update
  using (eh_diretor() or responsavel_id = auth.uid() or responsavel_id is null);

create policy contatos_sel on contatos for select using (true);
create policy contatos_ins on contatos for insert with check (true);
create policy contatos_upd on contatos for update using (
  eh_diretor() or exists (select 1 from empresas e where e.id = empresa_id and (e.responsavel_id = auth.uid() or e.responsavel_id is null))
);

-- negociacoes: diretor tudo; vendedor só as suas
create policy neg_all on negociacoes for all
  using (eh_diretor() or responsavel_id = auth.uid())
  with check (eh_diretor() or responsavel_id = auth.uid());

-- interacoes, acoes, orcamentos: seguem a negociação
create policy inter_all on interacoes for all using (
  exists (select 1 from negociacoes n where n.id = negociacao_id and (eh_diretor() or n.responsavel_id = auth.uid()))
);
create policy acoes_all on acoes for all using (
  exists (select 1 from negociacoes n where n.id = negociacao_id and (eh_diretor() or n.responsavel_id = auth.uid()))
);
create policy orc_all on orcamentos for all using (
  exists (select 1 from negociacoes n where n.id = negociacao_id and (eh_diretor() or n.responsavel_id = auth.uid()))
);
create policy mcplog_sel on mcp_log for select using (eh_diretor());
create policy mcplog_ins on mcp_log for insert with check (true);

-- produtos e emitente: todos leem, diretor escreve
create policy produtos_sel on produtos for select using (true);
create policy produtos_mod on produtos for all using (eh_diretor());
create policy emitente_sel on emitente for select using (true);
create policy emitente_mod on emitente for all using (eh_diretor());

-- orcamento_itens: segue o orçamento → negociação
create policy orcitens_all on orcamento_itens for all using (
  exists (select 1 from orcamentos o join negociacoes n on n.id = o.negociacao_id
          where o.id = orcamento_id and (eh_diretor() or n.responsavel_id = auth.uid()))
);

-- api_keys: cada um vê as suas; diretor vê todas
create policy keys_all on api_keys for all using (eh_diretor() or usuario_id = auth.uid());

-- ---------- 3.6 Views ----------
-- Negociações enriquecidas (base do kanban, listas e alertas)
create view v_negociacoes with (security_invoker = true) as
select
  n.*,
  e.nome as empresa_nome, e.cidade as empresa_cidade,
  et.nome as etapa_nome, et.ordem as etapa_ordem, f.nome as funil_nome,
  u.nome as responsavel_nome,
  (current_date - n.etapa_desde::date) as dias_na_etapa,
  (select max(i.criado_em) from interacoes i where i.negociacao_id = n.id and i.tipo <> 'sistema') as ultima_interacao,
  (current_date - coalesce((select max(i.criado_em) from interacoes i where i.negociacao_id = n.id and i.tipo <> 'sistema'), n.criado_em)::date) as dias_sem_interacao,
  ((current_date - coalesce((select max(i.criado_em) from interacoes i where i.negociacao_id = n.id and i.tipo <> 'sistema'), n.criado_em)::date)
     >= (select valor::int from config where chave = 'dias_parada_negociacao')) as parada,
  (select min(a.data) from acoes a where a.negociacao_id = n.id and a.concluida_em is null) as proxima_acao_data,
  (select a.descricao from acoes a where a.negociacao_id = n.id and a.concluida_em is null order by a.data, a.hora nulls last limit 1) as proxima_acao_descricao,
  exists (select 1 from acoes a where a.negociacao_id = n.id and a.concluida_em is null and a.data < current_date) as acao_atrasada,
  not exists (select 1 from acoes a where a.negociacao_id = n.id and a.concluida_em is null) as sem_acao
from negociacoes n
join empresas e on e.id = n.empresa_id
join etapas et on et.id = n.etapa_id
join funis f on f.id = n.funil_id
join usuarios u on u.id = n.responsavel_id
where n.arquivado_em is null;

-- Resultado por mês e responsável
create view v_resultado_mensal with (security_invoker = true) as
select
  date_trunc('month', fechado_em)::date as mes,
  responsavel_id,
  sum(valor_final) filter (where status = 'vendida') as vendido,
  count(*) filter (where status = 'vendida') as qtd_vendida,
  sum(valor_estimado) filter (where status = 'perdida') as perdido,
  count(*) filter (where status = 'perdida') as qtd_perdida,
  avg(valor_final) filter (where status = 'vendida') as ticket_medio,
  avg(extract(day from fechado_em - criado_em)) filter (where status = 'vendida') as ciclo_dias
from negociacoes
where status in ('vendida','perdida') and arquivado_em is null
group by 1, 2;

-- Previsão por mês
create view v_previsao with (security_invoker = true) as
with pesos as (
  select
    (select valor::numeric from config where chave='peso_fria') as fria,
    (select valor::numeric from config where chave='peso_morna') as morna,
    (select valor::numeric from config where chave='peso_quente') as quente
)
select
  coalesce(n.previsao_mes, date_trunc('month', current_date + interval '1 month')::date) as mes,
  n.responsavel_id,
  sum(n.valor_estimado) as aberto,
  sum(n.valor_estimado * case n.temperatura when 1 then p.fria when 2 then p.morna else p.quente end) as realista,
  sum(n.valor_estimado) filter (where n.temperatura >= 2) as otimista,
  count(*) as qtd
from negociacoes n, pesos p
where n.status = 'aberta' and n.arquivado_em is null
group by 1, 2;

-- Funil: valor e quantidade por etapa
create view v_funil with (security_invoker = true) as
select f.id as funil_id, f.nome as funil, et.id as etapa_id, et.nome as etapa, et.ordem,
  count(n.id) as qtd, coalesce(sum(n.valor_estimado),0) as valor
from funis f
join etapas et on et.funil_id = f.id and et.ativo
left join negociacoes n on n.etapa_id = et.id and n.status = 'aberta' and n.arquivado_em is null
where f.ativo
group by 1,2,3,4,5;

-- Motivos de perda
create view v_motivos_perda with (security_invoker = true) as
select date_trunc('month', fechado_em)::date as mes, responsavel_id, linha, motivo_perda,
  count(*) as qtd, sum(valor_estimado) as valor
from negociacoes where status = 'perdida' and arquivado_em is null
group by 1,2,3,4;

-- ---------- 3.6 Função do relatório da presidência ----------
create or replace function relatorio_presidencia(p_mes date default date_trunc('month', current_date)::date)
returns jsonb language sql stable security invoker as $$
with
  atual as (select coalesce(sum(vendido),0) v, coalesce(sum(qtd_vendida),0) q, coalesce(sum(perdido),0) p, coalesce(sum(qtd_perdida),0) pq
            from v_resultado_mensal where mes = p_mes),
  anterior as (select coalesce(sum(vendido),0) v from v_resultado_mensal where mes = p_mes - interval '1 month'),
  prev as (select mes, sum(aberto) aberto, sum(realista) realista, sum(otimista) otimista
           from v_previsao where mes >= p_mes and mes < p_mes + interval '3 month' group by mes order by mes),
  top10 as (select empresa_nome, titulo, valor_estimado, etapa_nome, proxima_acao_descricao, proxima_acao_data, responsavel_nome
            from v_negociacoes where status='aberta' order by valor_estimado desc limit 10),
  perdas as (select motivo_perda, sum(qtd) qtd, sum(valor) valor from v_motivos_perda where mes = p_mes group by 1)
select jsonb_build_object(
  'mes', p_mes,
  'vendido', (select v from atual),
  'qtd_vendida', (select q from atual),
  'ticket_medio', (select case when q>0 then round(v/q, 2) else 0 end from atual),
  'vendido_mes_anterior', (select v from anterior),
  'variacao_pct', (select case when (select v from anterior)>0 then round(((select v from atual)/(select v from anterior)-1)*100,1) else null end),
  'perdido', (select p from atual),
  'qtd_perdida', (select pq from atual),
  'conversao_pct', (select case when q+pq>0 then round(q::numeric/(q+pq)*100,1) else null end from atual),
  'previsao', (select jsonb_agg(row_to_json(prev)) from prev),
  'top_negociacoes', (select jsonb_agg(row_to_json(top10)) from top10),
  'perdas', (select jsonb_agg(row_to_json(perdas)) from perdas)
);
$$;

-- ---------- Storage ----------
insert into storage.buckets (id, name, public) values ('orcamentos','orcamentos', false) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('publico','publico', true) on conflict do nothing;

create policy orc_storage_all on storage.objects for all using (
  bucket_id = 'orcamentos' and exists (
    select 1 from negociacoes n where n.id::text = split_part(name, '/', 1) and (eh_diretor() or n.responsavel_id = auth.uid()))
);
create policy publico_read on storage.objects for select using (bucket_id = 'publico');
create policy publico_write on storage.objects for insert with check (bucket_id = 'publico' and eh_diretor());
