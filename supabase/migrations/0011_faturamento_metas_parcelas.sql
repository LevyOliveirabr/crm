-- Faturamento pós-venda, tipo de meta, parcelas e vínculo de renovação.
-- Idempotente.

alter table negociacoes
  add column if not exists faturado boolean not null default false,
  add column if not exists valor_faturado numeric(14,2),
  add column if not exists faturado_em date,
  add column if not exists negociacao_origem_id uuid references negociacoes(id) on delete set null;

comment on column negociacoes.faturado is 'true depois de marcar o faturamento de uma venda.';
comment on column negociacoes.faturado_em is 'Data real do faturamento. data_faturamento continua sendo a previsão.';
comment on column negociacoes.negociacao_origem_id is 'Negociação original quando esta é uma renovação (clone).';

alter table metas
  add column if not exists tipo text not null default 'faturamento';

alter table metas drop constraint if exists metas_tipo_check;
alter table metas
  add constraint metas_tipo_check check (tipo in ('faturamento', 'pipeline'));

alter table metas drop constraint if exists metas_resp_emitente_mes_key;
alter table metas drop constraint if exists metas_resp_emitente_mes_tipo_key;
alter table metas
  add constraint metas_resp_emitente_mes_tipo_key
  unique (responsavel_id, emitente_id, mes, tipo);

create table if not exists negociacao_parcelas (
  id uuid primary key default gen_random_uuid(),
  negociacao_id uuid not null references negociacoes(id) on delete cascade,
  mes date not null,
  valor numeric(14,2) not null default 0,
  ordem smallint not null default 1,
  criado_em timestamptz not null default now()
);

create index if not exists negociacao_parcelas_neg_idx
  on negociacao_parcelas (negociacao_id, mes);

alter table negociacao_parcelas enable row level security;

drop policy if exists parcelas_all on negociacao_parcelas;
create policy parcelas_all on negociacao_parcelas for all using (
  exists (
    select 1 from negociacoes n
    where n.id = negociacao_id
      and (
        eh_diretor_de(n.emitente_id)
        or n.responsavel_id = auth.uid()
        or eh_gerente_de(n.responsavel_id, n.emitente_id)
      )
  )
);

-- Recria a view para n.* incluir as colunas novas.
drop view if exists v_negociacoes;
create view v_negociacoes with (security_invoker = true) as
select
  n.*,
  e.nome as empresa_nome, e.cidade as empresa_cidade,
  e.segmento as empresa_segmento,
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
