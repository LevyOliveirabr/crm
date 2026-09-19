-- Melhorias de gestão comercial:
--   1. metas por vendedor e mês
--   2. probabilidade por etapa do funil
--   3. categoria de forecast na negociação (compromisso / provável / possível)
--   4. data prevista de fechamento (previsao_data) sincronizada com previsao_mes
--   5. histórico de etapas (base para conversão etapa a etapa e ciclo médio)
--   6. perfil "gerente" (vê a equipe dele) e usuarios.gerente_id
--   7. v_negociacoes recriada com as colunas novas
--
-- Observação: o valor novo do enum é adicionado aqui, mas NÃO é referenciado
-- como literal nesta migration (limitação do Postgres para enums no mesmo
-- transaction). As funções que o usam são plpgsql e comparam via text.

-- ---------- 1. Metas ----------
create table if not exists metas (
  id uuid primary key default gen_random_uuid(),
  responsavel_id uuid not null references usuarios(id) on delete cascade,
  mes date not null,                            -- sempre dia 1
  valor numeric(14,2) not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (responsavel_id, mes)
);
alter table metas enable row level security;
drop policy if exists metas_sel on metas;
drop policy if exists metas_mod on metas;
create policy metas_sel on metas for select using (true);
create policy metas_mod on metas for all using (eh_diretor()) with check (eh_diretor());
drop trigger if exists trg_metas_upd on metas;
create trigger trg_metas_upd before update on metas for each row execute function set_atualizado_em();

-- ---------- 2. Probabilidade por etapa ----------
alter table etapas
  add column if not exists probabilidade smallint
    check (probabilidade is null or (probabilidade between 0 and 100));

-- ---------- 3. Categoria de forecast ----------
alter table negociacoes
  add column if not exists categoria_forecast text
    check (categoria_forecast is null or categoria_forecast in ('compromisso', 'provavel', 'possivel'));

-- ---------- 4. Data prevista de fechamento ----------
alter table negociacoes
  add column if not exists previsao_data date;

create or replace function sync_previsao_mes() returns trigger language plpgsql as $$
begin
  if new.previsao_data is not null then
    new.previsao_mes = date_trunc('month', new.previsao_data)::date;
  end if;
  return new;
end $$;
drop trigger if exists trg_neg_previsao on negociacoes;
create trigger trg_neg_previsao before insert or update of previsao_data on negociacoes
  for each row execute function sync_previsao_mes();

-- ---------- 5. Histórico de etapas ----------
create table if not exists etapa_historico (
  id bigint generated always as identity primary key,
  negociacao_id uuid not null references negociacoes(id) on delete cascade,
  etapa_id uuid not null references etapas(id),
  entrou_em timestamptz not null default now(),
  saiu_em timestamptz
);
create index if not exists etapa_hist_neg on etapa_historico (negociacao_id, entrou_em);
create index if not exists etapa_hist_etapa on etapa_historico (etapa_id);
alter table etapa_historico enable row level security;
drop policy if exists etapahist_sel on etapa_historico;
create policy etapahist_sel on etapa_historico for select using (
  exists (select 1 from negociacoes n where n.id = negociacao_id)
);

-- abre a linha inicial ao criar a negociação
create or replace function on_negociacao_insert_hist() returns trigger language plpgsql security definer as $$
begin
  insert into etapa_historico (negociacao_id, etapa_id, entrou_em)
  values (new.id, new.etapa_id, coalesce(new.etapa_desde, now()));
  return new;
end $$;
drop trigger if exists trg_neg_hist_ins on negociacoes;
create trigger trg_neg_hist_ins after insert on negociacoes
  for each row execute function on_negociacao_insert_hist();

-- fecha a linha anterior e abre a nova ao mudar de etapa
create or replace function on_negociacao_update_hist() returns trigger language plpgsql security definer as $$
begin
  if new.etapa_id is distinct from old.etapa_id then
    update etapa_historico set saiu_em = now()
    where negociacao_id = new.id and saiu_em is null;
    insert into etapa_historico (negociacao_id, etapa_id, entrou_em)
    values (new.id, new.etapa_id, now());
  end if;
  if new.status is distinct from old.status and new.status <> 'aberta' then
    update etapa_historico set saiu_em = now()
    where negociacao_id = new.id and saiu_em is null;
  end if;
  return new;
end $$;
drop trigger if exists trg_neg_hist_upd on negociacoes;
create trigger trg_neg_hist_upd after update on negociacoes
  for each row execute function on_negociacao_update_hist();

-- carga inicial: uma linha por negociação existente, na etapa atual
insert into etapa_historico (negociacao_id, etapa_id, entrou_em, saiu_em)
select n.id, n.etapa_id, n.etapa_desde,
       case when n.status = 'aberta' then null else n.fechado_em end
from negociacoes n
where not exists (select 1 from etapa_historico h where h.negociacao_id = n.id);

-- ---------- 6. Perfil gerente ----------
alter type perfil_usuario add value if not exists 'gerente';

alter table usuarios
  add column if not exists gerente_id uuid references usuarios(id);

-- true quando o usuário logado é gerente do usuário informado
create or replace function eh_gerente_de(p_usuario uuid) returns boolean language plpgsql stable as $$
declare v boolean;
begin
  select exists (
    select 1 from usuarios g
    join usuarios v on v.gerente_id = g.id
    where g.id = auth.uid() and g.ativo and g.perfil::text = 'gerente' and v.id = p_usuario
  ) into v;
  return coalesce(v, false);
end $$;

-- negociações e dependentes: diretor tudo; gerente a equipe; vendedor as suas
drop policy if exists neg_all on negociacoes;
create policy neg_all on negociacoes for all
  using (eh_diretor() or responsavel_id = auth.uid() or eh_gerente_de(responsavel_id))
  with check (eh_diretor() or responsavel_id = auth.uid() or eh_gerente_de(responsavel_id));

drop policy if exists inter_all on interacoes;
create policy inter_all on interacoes for all using (
  exists (select 1 from negociacoes n where n.id = negociacao_id
          and (eh_diretor() or n.responsavel_id = auth.uid() or eh_gerente_de(n.responsavel_id)))
);

drop policy if exists acoes_all on acoes;
create policy acoes_all on acoes for all using (
  exists (select 1 from negociacoes n where n.id = negociacao_id
          and (eh_diretor() or n.responsavel_id = auth.uid() or eh_gerente_de(n.responsavel_id)))
);

drop policy if exists orc_all on orcamentos;
create policy orc_all on orcamentos for all using (
  exists (select 1 from negociacoes n where n.id = negociacao_id
          and (eh_diretor() or n.responsavel_id = auth.uid() or eh_gerente_de(n.responsavel_id)))
);

drop policy if exists orcitens_all on orcamento_itens;
create policy orcitens_all on orcamento_itens for all using (
  exists (select 1 from orcamentos o join negociacoes n on n.id = o.negociacao_id
          where o.id = orcamento_id
          and (eh_diretor() or n.responsavel_id = auth.uid() or eh_gerente_de(n.responsavel_id)))
);

-- ---------- 7. v_negociacoes com as colunas novas ----------
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
  et.probabilidade as etapa_probabilidade
from negociacoes n
join empresas e on e.id = n.empresa_id
join etapas et on et.id = n.etapa_id
join funis f on f.id = n.funil_id
join usuarios u on u.id = n.responsavel_id
where n.arquivado_em is null;
