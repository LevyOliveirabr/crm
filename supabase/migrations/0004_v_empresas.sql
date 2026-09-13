-- Etapa 06: view v_empresas com indicadores + índice em negociacoes(empresa_id).
-- Numerada 0004 porque 0003_fix_auth_trigger.sql já existe.

create index if not exists negociacoes_empresa on negociacoes (empresa_id);

create or replace view v_empresas
with (security_invoker = true)
as
with ultimos as (
  select
    n.empresa_id,
    max(i.criado_em) as ultimo_contato
  from interacoes i
  join negociacoes n
    on n.id = i.negociacao_id
   and n.arquivado_em is null
  where i.tipo <> 'sistema'
  group by n.empresa_id
),
agg as (
  select
    n.empresa_id,
    coalesce(sum(n.valor_estimado) filter (where n.status = 'aberta'), 0) as aberto,
    coalesce(sum(n.valor_final) filter (where n.status = 'vendida'), 0) as vendido,
    coalesce(sum(n.valor_estimado) filter (where n.status = 'perdida'), 0) as perdido,
    count(*)::int as qtd_negociacoes,
    count(*) filter (where n.status = 'aberta')::int as qtd_abertas,
    avg(n.valor_final) filter (where n.status = 'vendida') as ticket_medio,
    avg((n.fechado_em::date - n.criado_em::date))
      filter (where n.status = 'vendida') as ciclo_medio_dias
  from negociacoes n
  where n.arquivado_em is null
  group by n.empresa_id
)
select
  e.id,
  e.nome,
  e.cidade,
  e.uf,
  e.segmento,
  e.cnpj,
  e.responsavel_id,
  u.nome as responsavel_nome,
  e.observacoes,
  e.criado_em,
  e.atualizado_em,
  coalesce(a.aberto, 0)::numeric(14, 2) as aberto,
  coalesce(a.vendido, 0)::numeric(14, 2) as vendido,
  coalesce(a.perdido, 0)::numeric(14, 2) as perdido,
  coalesce(a.qtd_negociacoes, 0) as qtd_negociacoes,
  coalesce(a.qtd_abertas, 0) as qtd_abertas,
  a.ticket_medio,
  a.ciclo_medio_dias,
  ult.ultimo_contato
from empresas e
left join usuarios u on u.id = e.responsavel_id
left join agg a on a.empresa_id = e.id
left join ultimos ult on ult.empresa_id = e.id
where e.arquivado_em is null;
