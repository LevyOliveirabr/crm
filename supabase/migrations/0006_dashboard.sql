-- Dashboard inicial: campos novos + views atualizadas.
--
-- 1. empresas.tipo_segmento: natureza do cliente (publico | privado | ppp),
--    usada no filtro "Segmento" e na tabela "Base de dados" do dashboard.
-- 2. negociacoes.data_faturamento: data prevista de faturamento (coluna
--    "Faturamento" da base de dados).
-- 3. v_negociacoes recriada para expor os campos novos e a UF da empresa.
-- 4. v_empresas recriada para expor tipo_segmento.

alter table empresas
  add column if not exists tipo_segmento text
    check (tipo_segmento in ('publico', 'privado', 'ppp'));

alter table negociacoes
  add column if not exists data_faturamento date;

-- v_negociacoes usa `n.*`, então a lista de colunas fica congelada na criação.
-- Precisa recriar para as colunas novas aparecerem na view.
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
  e.tipo_segmento as empresa_tipo_segmento
from negociacoes n
join empresas e on e.id = n.empresa_id
join etapas et on et.id = n.etapa_id
join funis f on f.id = n.funil_id
join usuarios u on u.id = n.responsavel_id
where n.arquivado_em is null;

-- v_empresas lista as colunas explicitamente; a nova entra no final.
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
  ult.ultimo_contato,
  e.tipo_segmento
from empresas e
left join usuarios u on u.id = e.responsavel_id
left join agg a on a.empresa_id = e.id
left join ultimos ult on ult.empresa_id = e.id
where e.arquivado_em is null;
