-- Multi-empresa (empresa vendedora / emitente):
--   1. emitentes: várias empresas do grupo vendendo (evolução da tabela emitente singleton)
--   2. usuario_emitentes: perfil (diretor/gerente/vendedor) e gerente POR empresa
--   3. emitente_id em negociacoes, produtos e metas (com default = emitente padrão,
--      para o código atual continuar funcionando até o deploy)
--   4. categorias_produto + link/catálogo em produtos
--   5. helpers de RLS por empresa (security definer, evita recursão) e policies novas
--   6. views com emitente_id e relatorio_presidencia(p_mes, p_emitente)
--
-- A tabela `emitente` (id=1), `usuarios.gerente_id` e as chaves config.orcamento_*
-- são mantidas nesta migration e removidas em 0009 (após o deploy do código).
-- Idempotente: pode ser reaplicada.

-- =========================================================
-- 1. EMITENTES
-- =========================================================
create table if not exists emitentes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,                              -- nome curto (seletor, badges)
  razao_social text not null,
  cnpj text,
  endereco text,
  telefone text,
  email text,
  site text,
  logo_path text,                                  -- Storage bucket "publico"
  validade_padrao_dias int not null default 15,
  condicoes_pagamento_padrao text,
  prazo_entrega_padrao text,
  rodape text,
  orcamento_prefixo text not null default 'ORC',
  orcamento_proximo_numero int not null default 1,
  ordem int not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index if not exists emitentes_nome_unico on emitentes (lower(f_unaccent(nome)));
drop trigger if exists trg_emitentes_upd on emitentes;
create trigger trg_emitentes_upd before update on emitentes for each row execute function set_atualizado_em();

-- Emitente padrão: migra a linha única de `emitente` (ou cria "F-Led").
do $$
declare
  v_id uuid;
  v_prefixo text;
  v_proximo int;
begin
  select valor::uuid into v_id from config where chave = 'emitente_padrao_id';
  if v_id is not null and exists (select 1 from emitentes where id = v_id) then
    return;
  end if;

  select valor into v_prefixo from config where chave = 'orcamento_prefixo';
  select valor::int into v_proximo from config where chave = 'orcamento_proximo_numero';

  if exists (select 1 from emitente where id = 1) then
    insert into emitentes (nome, razao_social, cnpj, endereco, telefone, email, site, logo_path,
      validade_padrao_dias, condicoes_pagamento_padrao, prazo_entrega_padrao, rodape,
      orcamento_prefixo, orcamento_proximo_numero)
    select razao_social, razao_social, cnpj, endereco, telefone, email, site, logo_path,
      validade_padrao_dias, condicoes_pagamento_padrao, prazo_entrega_padrao, rodape,
      coalesce(v_prefixo, 'ORC'), coalesce(v_proximo, 1)
    from emitente where id = 1
    returning id into v_id;
  else
    insert into emitentes (nome, razao_social, orcamento_prefixo, orcamento_proximo_numero)
    values ('F-Led', 'F-Led', coalesce(v_prefixo, 'ORC'), coalesce(v_proximo, 1))
    returning id into v_id;
  end if;

  insert into config (chave, valor) values ('emitente_padrao_id', v_id::text)
  on conflict (chave) do update set valor = excluded.valor;
end $$;

-- =========================================================
-- 2. VÍNCULO USUÁRIO × EMPRESA (perfil por empresa)
-- =========================================================
create table if not exists usuario_emitentes (
  usuario_id uuid not null references usuarios(id) on delete cascade,
  emitente_id uuid not null references emitentes(id) on delete cascade,
  perfil perfil_usuario not null default 'vendedor',
  gerente_id uuid references usuarios(id) on delete set null,
  criado_em timestamptz not null default now(),
  primary key (usuario_id, emitente_id)
);
create index if not exists usuario_emitentes_emitente on usuario_emitentes (emitente_id, perfil);

-- gerente precisa ser membro do mesmo emitente
create or replace function chk_gerente_membro() returns trigger language plpgsql as $$
begin
  if new.gerente_id is not null then
    if new.gerente_id = new.usuario_id then
      raise exception 'Usuário não pode ser gerente de si mesmo';
    end if;
    if not exists (
      select 1 from usuario_emitentes ue
      where ue.usuario_id = new.gerente_id and ue.emitente_id = new.emitente_id
    ) then
      raise exception 'Gerente precisa ser membro da mesma empresa vendedora';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_usuario_emitentes_gerente on usuario_emitentes;
create trigger trg_usuario_emitentes_gerente before insert or update on usuario_emitentes
  for each row execute function chk_gerente_membro();

-- backfill: todo usuário entra no emitente padrão com o perfil/gerente atuais
-- (primeiro sem gerente, depois o gerente, para o trigger aceitar)
insert into usuario_emitentes (usuario_id, emitente_id, perfil)
select u.id, (select valor::uuid from config where chave = 'emitente_padrao_id'), u.perfil
from usuarios u
on conflict (usuario_id, emitente_id) do nothing;

update usuario_emitentes ue
set gerente_id = u.gerente_id
from usuarios u
where u.id = ue.usuario_id
  and ue.emitente_id = (select valor::uuid from config where chave = 'emitente_padrao_id')
  and ue.gerente_id is null
  and u.gerente_id is not null
  and exists (select 1 from usuario_emitentes g where g.usuario_id = u.gerente_id and g.emitente_id = ue.emitente_id);

-- =========================================================
-- 3. HELPERS DE RLS (security definer: evita recursão nas policies)
-- =========================================================
create or replace function minhas_empresas() returns setof uuid
language sql stable security definer set search_path = public as $$
  select ue.emitente_id from usuario_emitentes ue
  join usuarios u on u.id = ue.usuario_id
  where ue.usuario_id = auth.uid() and u.ativo;
$$;

create or replace function eh_membro_de(p_emitente uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from usuario_emitentes ue
    join usuarios u on u.id = ue.usuario_id
    where ue.usuario_id = auth.uid() and ue.emitente_id = p_emitente and u.ativo);
$$;

create or replace function eh_diretor_de(p_emitente uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from usuario_emitentes ue
    join usuarios u on u.id = ue.usuario_id
    where ue.usuario_id = auth.uid() and ue.emitente_id = p_emitente
      and ue.perfil = 'diretor' and u.ativo);
$$;

-- diretor em alguma empresa (recursos globais: funis, listas, config, usuários, clientes)
create or replace function eh_diretor() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from usuario_emitentes ue
    join usuarios u on u.id = ue.usuario_id
    where ue.usuario_id = auth.uid() and ue.perfil = 'diretor' and u.ativo);
$$;

-- membro de alguma empresa onde o usuário logado é diretor
create or replace function eh_diretor_de_usuario(p_usuario uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from usuario_emitentes d
    join usuarios u on u.id = d.usuario_id
    join usuario_emitentes m on m.emitente_id = d.emitente_id
    where d.usuario_id = auth.uid() and d.perfil = 'diretor' and u.ativo
      and m.usuario_id = p_usuario);
$$;

-- eh_gerente_de muda de assinatura: derrubar policies que a usam antes.
drop policy if exists neg_all on negociacoes;
drop policy if exists inter_all on interacoes;
drop policy if exists acoes_all on acoes;
drop policy if exists orc_all on orcamentos;
drop policy if exists orcitens_all on orcamento_itens;
drop function if exists eh_gerente_de(uuid);

create or replace function eh_gerente_de(p_usuario uuid, p_emitente uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from usuario_emitentes g
    join usuarios ug on ug.id = g.usuario_id
    join usuario_emitentes v on v.emitente_id = g.emitente_id and v.gerente_id = g.usuario_id
    where g.usuario_id = auth.uid() and g.emitente_id = p_emitente
      and g.perfil = 'gerente' and ug.ativo and v.usuario_id = p_usuario);
$$;

-- =========================================================
-- 4. COLUNAS emitente_id (default = emitente padrão até 0009)
-- =========================================================
do $$
declare v uuid;
begin
  select valor::uuid into v from config where chave = 'emitente_padrao_id';

  execute format('alter table negociacoes add column if not exists emitente_id uuid references emitentes(id) default %L', v);
  execute format('alter table negociacoes alter column emitente_id set default %L', v);
  update negociacoes set emitente_id = v where emitente_id is null;
  alter table negociacoes alter column emitente_id set not null;

  execute format('alter table produtos add column if not exists emitente_id uuid references emitentes(id) default %L', v);
  execute format('alter table produtos alter column emitente_id set default %L', v);
  update produtos set emitente_id = v where emitente_id is null;
  alter table produtos alter column emitente_id set not null;

  execute format('alter table metas add column if not exists emitente_id uuid references emitentes(id) default %L', v);
  execute format('alter table metas alter column emitente_id set default %L', v);
  update metas set emitente_id = v where emitente_id is null;
  alter table metas alter column emitente_id set not null;
end $$;

create index if not exists negociacoes_emitente on negociacoes (emitente_id, status);
create index if not exists produtos_emitente on produtos (emitente_id);

-- código do produto único por empresa (não mais global)
alter table produtos drop constraint if exists produtos_codigo_key;
create unique index if not exists produtos_codigo_emitente on produtos (emitente_id, codigo) where codigo is not null;

-- metas por empresa
alter table metas drop constraint if exists metas_responsavel_id_mes_key;
alter table metas drop constraint if exists metas_resp_emitente_mes_key;
alter table metas add constraint metas_resp_emitente_mes_key unique (responsavel_id, emitente_id, mes);

-- =========================================================
-- 5. CATEGORIAS E CAMPOS NOVOS DE PRODUTO
-- =========================================================
create table if not exists categorias_produto (
  id uuid primary key default gen_random_uuid(),
  emitente_id uuid not null references emitentes(id) on delete cascade,
  nome text not null,
  descricao text,
  catalogo_path text,                              -- Storage bucket "publico"
  catalogo_url text,                               -- alternativa: catálogo hospedado fora
  ordem int not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index if not exists categorias_produto_nome_unico on categorias_produto (emitente_id, lower(f_unaccent(nome)));
drop trigger if exists trg_categorias_upd on categorias_produto;
create trigger trg_categorias_upd before update on categorias_produto for each row execute function set_atualizado_em();

alter table produtos
  add column if not exists categoria_id uuid references categorias_produto(id) on delete set null,
  add column if not exists link text,              -- página do produto no site da empresa
  add column if not exists catalogo_path text,     -- Storage bucket "publico"
  add column if not exists catalogo_url text;
create index if not exists produtos_categoria on produtos (categoria_id);

-- categoria precisa ser da mesma empresa do produto
create or replace function chk_produto_categoria() returns trigger language plpgsql as $$
begin
  if new.categoria_id is not null and not exists (
    select 1 from categorias_produto c where c.id = new.categoria_id and c.emitente_id = new.emitente_id
  ) then
    raise exception 'Categoria pertence a outra empresa vendedora';
  end if;
  return new;
end $$;
drop trigger if exists trg_produto_categoria on produtos;
create trigger trg_produto_categoria before insert or update on produtos
  for each row execute function chk_produto_categoria();

-- =========================================================
-- 6. NUMERAÇÃO DE ORÇAMENTO POR EMPRESA
-- =========================================================
drop function if exists proximo_numero_orcamento();
create or replace function proximo_numero_orcamento(p_emitente uuid) returns text language plpgsql as $$
declare n int; p text;
begin
  update emitentes set orcamento_proximo_numero = orcamento_proximo_numero + 1
  where id = p_emitente
  returning (orcamento_proximo_numero - 1), orcamento_prefixo into n, p;
  if n is null then
    raise exception 'Empresa vendedora não encontrada';
  end if;
  return format('%s-%s-%s', p, to_char(now(), 'YYYY'), lpad(n::text, 4, '0'));
end $$;

-- criador de uma empresa vira diretor dela
create or replace function on_emitente_insert() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then
    insert into usuario_emitentes (usuario_id, emitente_id, perfil)
    values (auth.uid(), new.id, 'diretor')
    on conflict (usuario_id, emitente_id) do update set perfil = 'diretor';
  end if;
  return new;
end $$;
drop trigger if exists trg_emitente_insert on emitentes;
create trigger trg_emitente_insert after insert on emitentes for each row execute function on_emitente_insert();

-- =========================================================
-- 7. RLS
-- =========================================================
alter table emitentes enable row level security;
alter table usuario_emitentes enable row level security;
alter table categorias_produto enable row level security;

drop policy if exists emitentes_sel on emitentes;
drop policy if exists emitentes_ins on emitentes;
drop policy if exists emitentes_upd on emitentes;
drop policy if exists emitentes_del on emitentes;
create policy emitentes_sel on emitentes for select using (eh_membro_de(id));
create policy emitentes_ins on emitentes for insert with check (eh_diretor());
create policy emitentes_upd on emitentes for update using (eh_diretor_de(id)) with check (eh_diretor_de(id));
create policy emitentes_del on emitentes for delete using (eh_diretor_de(id));

drop policy if exists ue_sel on usuario_emitentes;
drop policy if exists ue_mod on usuario_emitentes;
create policy ue_sel on usuario_emitentes for select
  using (usuario_id = auth.uid() or eh_membro_de(emitente_id));
create policy ue_mod on usuario_emitentes for all
  using (eh_diretor_de(emitente_id)) with check (eh_diretor_de(emitente_id));

-- negociações e dependentes: diretor da empresa; gerente da equipe na empresa; responsável
create policy neg_all on negociacoes for all
  using (eh_diretor_de(emitente_id) or responsavel_id = auth.uid() or eh_gerente_de(responsavel_id, emitente_id))
  with check (
    eh_membro_de(emitente_id)
    and (eh_diretor_de(emitente_id) or responsavel_id = auth.uid() or eh_gerente_de(responsavel_id, emitente_id))
    and exists (select 1 from usuario_emitentes ue where ue.usuario_id = responsavel_id and ue.emitente_id = negociacoes.emitente_id)
  );

create policy inter_all on interacoes for all using (
  exists (select 1 from negociacoes n where n.id = negociacao_id
          and (eh_diretor_de(n.emitente_id) or n.responsavel_id = auth.uid() or eh_gerente_de(n.responsavel_id, n.emitente_id)))
);
create policy acoes_all on acoes for all using (
  exists (select 1 from negociacoes n where n.id = negociacao_id
          and (eh_diretor_de(n.emitente_id) or n.responsavel_id = auth.uid() or eh_gerente_de(n.responsavel_id, n.emitente_id)))
);
create policy orc_all on orcamentos for all using (
  exists (select 1 from negociacoes n where n.id = negociacao_id
          and (eh_diretor_de(n.emitente_id) or n.responsavel_id = auth.uid() or eh_gerente_de(n.responsavel_id, n.emitente_id)))
);
create policy orcitens_all on orcamento_itens for all using (
  exists (select 1 from orcamentos o join negociacoes n on n.id = o.negociacao_id
          where o.id = orcamento_id
          and (eh_diretor_de(n.emitente_id) or n.responsavel_id = auth.uid() or eh_gerente_de(n.responsavel_id, n.emitente_id)))
);

-- produtos e categorias: membros leem; diretor da empresa escreve
drop policy if exists produtos_sel on produtos;
drop policy if exists produtos_mod on produtos;
create policy produtos_sel on produtos for select using (eh_membro_de(emitente_id));
create policy produtos_mod on produtos for all
  using (eh_diretor_de(emitente_id)) with check (eh_diretor_de(emitente_id));

drop policy if exists categorias_sel on categorias_produto;
drop policy if exists categorias_mod on categorias_produto;
create policy categorias_sel on categorias_produto for select using (eh_membro_de(emitente_id));
create policy categorias_mod on categorias_produto for all
  using (eh_diretor_de(emitente_id)) with check (eh_diretor_de(emitente_id));

-- metas por empresa
drop policy if exists metas_sel on metas;
drop policy if exists metas_mod on metas;
create policy metas_sel on metas for select using (eh_membro_de(emitente_id));
create policy metas_mod on metas for all
  using (eh_diretor_de(emitente_id)) with check (eh_diretor_de(emitente_id));

-- api keys e log: diretor vê só das pessoas das empresas que dirige
drop policy if exists keys_all on api_keys;
create policy keys_all on api_keys for all
  using (usuario_id = auth.uid() or eh_diretor_de_usuario(usuario_id))
  with check (usuario_id = auth.uid() or eh_diretor_de_usuario(usuario_id));

drop policy if exists mcplog_sel on mcp_log;
create policy mcplog_sel on mcp_log for select using (
  exists (select 1 from api_keys k where k.id = key_id and eh_diretor_de_usuario(k.usuario_id))
);

-- storage: bucket orcamentos segue a negociação; bucket publico por empresa (emitentes/<uuid>/...)
create or replace function emitente_do_path(p_name text) returns uuid
language sql immutable as $$
  select case
    when split_part(p_name, '/', 1) = 'emitentes'
     and split_part(p_name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(p_name, '/', 2)::uuid
    else null end;
$$;

drop policy if exists orc_storage_all on storage.objects;
create policy orc_storage_all on storage.objects for all using (
  bucket_id = 'orcamentos' and exists (
    select 1 from negociacoes n where n.id::text = split_part(name, '/', 1)
      and (eh_diretor_de(n.emitente_id) or n.responsavel_id = auth.uid() or eh_gerente_de(n.responsavel_id, n.emitente_id)))
);

drop policy if exists publico_write on storage.objects;
create policy publico_write on storage.objects for insert with check (
  bucket_id = 'publico' and (
    (emitente_do_path(name) is not null and eh_diretor_de(emitente_do_path(name)))
    or (emitente_do_path(name) is null and eh_diretor())
  )
);
drop policy if exists publico_update on storage.objects;
create policy publico_update on storage.objects for update
  using (bucket_id = 'publico' and (
    (emitente_do_path(name) is not null and eh_diretor_de(emitente_do_path(name)))
    or (emitente_do_path(name) is null and eh_diretor())))
  with check (bucket_id = 'publico' and (
    (emitente_do_path(name) is not null and eh_diretor_de(emitente_do_path(name)))
    or (emitente_do_path(name) is null and eh_diretor())));
drop policy if exists publico_delete on storage.objects;
create policy publico_delete on storage.objects for delete
  using (bucket_id = 'publico' and (
    (emitente_do_path(name) is not null and eh_diretor_de(emitente_do_path(name)))
    or (emitente_do_path(name) is null and eh_diretor())));

-- =========================================================
-- 8. VIEWS (recriadas com emitente_id)
-- =========================================================
drop view if exists v_negociacoes;
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
  not exists (select 1 from acoes a where a.negociacao_id = n.id and a.concluida_em is null) as sem_acao,
  e.uf as empresa_uf,
  e.tipo_segmento as empresa_tipo_segmento,
  et.probabilidade as etapa_probabilidade,
  em.nome as emitente_nome
from negociacoes n
join empresas e on e.id = n.empresa_id
join etapas et on et.id = n.etapa_id
join funis f on f.id = n.funil_id
join usuarios u on u.id = n.responsavel_id
join emitentes em on em.id = n.emitente_id
where n.arquivado_em is null;

drop view if exists v_resultado_mensal;
create view v_resultado_mensal with (security_invoker = true) as
select
  date_trunc('month', fechado_em)::date as mes,
  responsavel_id,
  emitente_id,
  sum(valor_final) filter (where status = 'vendida') as vendido,
  count(*) filter (where status = 'vendida') as qtd_vendida,
  sum(valor_estimado) filter (where status = 'perdida') as perdido,
  count(*) filter (where status = 'perdida') as qtd_perdida,
  avg(valor_final) filter (where status = 'vendida') as ticket_medio,
  avg(extract(day from fechado_em - criado_em)) filter (where status = 'vendida') as ciclo_dias
from negociacoes
where status in ('vendida','perdida') and arquivado_em is null
group by 1, 2, 3;

drop view if exists v_previsao;
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
  n.emitente_id,
  sum(n.valor_estimado) as aberto,
  sum(n.valor_estimado * case n.temperatura when 1 then p.fria when 2 then p.morna else p.quente end) as realista,
  sum(n.valor_estimado) filter (where n.temperatura >= 2) as otimista,
  count(*) as qtd
from negociacoes n, pesos p
where n.status = 'aberta' and n.arquivado_em is null
group by 1, 2, 3;

drop view if exists v_funil;
create view v_funil with (security_invoker = true) as
select f.id as funil_id, f.nome as funil, et.id as etapa_id, et.nome as etapa, et.ordem,
  n.emitente_id,
  count(n.id) as qtd, coalesce(sum(n.valor_estimado),0) as valor
from funis f
join etapas et on et.funil_id = f.id and et.ativo
left join negociacoes n on n.etapa_id = et.id and n.status = 'aberta' and n.arquivado_em is null
where f.ativo
group by 1,2,3,4,5,6;

drop view if exists v_motivos_perda;
create view v_motivos_perda with (security_invoker = true) as
select date_trunc('month', fechado_em)::date as mes, responsavel_id, emitente_id, linha, motivo_perda,
  count(*) as qtd, sum(valor_estimado) as valor
from negociacoes where status = 'perdida' and arquivado_em is null
group by 1,2,3,4,5;

-- =========================================================
-- 9. RELATÓRIO DA PRESIDÊNCIA (por empresa ou todas)
-- =========================================================
drop function if exists relatorio_presidencia(date);
create or replace function relatorio_presidencia(
  p_mes date default date_trunc('month', current_date)::date,
  p_emitente uuid default null
)
returns jsonb language sql stable security invoker as $$
with
  atual as (select coalesce(sum(vendido),0) v, coalesce(sum(qtd_vendida),0) q, coalesce(sum(perdido),0) p, coalesce(sum(qtd_perdida),0) pq
            from v_resultado_mensal where mes = p_mes and (p_emitente is null or emitente_id = p_emitente)),
  anterior as (select coalesce(sum(vendido),0) v from v_resultado_mensal
               where mes = p_mes - interval '1 month' and (p_emitente is null or emitente_id = p_emitente)),
  prev as (select mes, sum(aberto) aberto, sum(realista) realista, sum(otimista) otimista
           from v_previsao where mes >= p_mes and mes < p_mes + interval '3 month'
             and (p_emitente is null or emitente_id = p_emitente)
           group by mes order by mes),
  top10 as (select empresa_nome, titulo, valor_estimado, etapa_nome, proxima_acao_descricao, proxima_acao_data, responsavel_nome, emitente_nome
            from v_negociacoes where status='aberta' and (p_emitente is null or emitente_id = p_emitente)
            order by valor_estimado desc limit 10),
  perdas as (select motivo_perda, sum(qtd) qtd, sum(valor) valor from v_motivos_perda
             where mes = p_mes and (p_emitente is null or emitente_id = p_emitente) group by 1)
select jsonb_build_object(
  'mes', p_mes,
  'emitente_id', p_emitente,
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
