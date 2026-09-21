-- Melhorias CRM (PDF + Painel Comercial):
--   1. Endereço estruturado em empresas e emitentes
--   2. Instagram/LinkedIn em contatos
--   3. Cargo/telefone/whatsapp/linkedin em usuarios
--   4. valor_previsao + negocio_unico em negociacoes
--   5. Views atualizadas (v_negociacoes, v_empresas)
-- Idempotente: pode ser reaplicada.

-- =========================================================
-- 1. EMPRESAS — endereço estruturado
-- =========================================================
alter table empresas
  add column if not exists logradouro text,
  add column if not exists numero text,
  add column if not exists complemento text,
  add column if not exists bairro text,
  add column if not exists cep text,
  add column if not exists municipio text;

-- municipio espelha cidade quando só cidade existe
update empresas
set municipio = cidade
where municipio is null and cidade is not null;

-- =========================================================
-- 2. EMITENTES — endereço estruturado (mantém endereco concatenado)
-- =========================================================
alter table emitentes
  add column if not exists logradouro text,
  add column if not exists numero text,
  add column if not exists complemento text,
  add column if not exists bairro text,
  add column if not exists cep text,
  add column if not exists municipio text;

-- =========================================================
-- 3. CONTATOS — redes sociais
-- =========================================================
alter table contatos
  add column if not exists instagram text,
  add column if not exists linkedin text;

-- =========================================================
-- 4. USUARIOS — dados de contato do vendedor (orçamento / e-mail)
-- =========================================================
alter table usuarios
  add column if not exists cargo text,
  add column if not exists telefone text,
  add column if not exists whatsapp text,
  add column if not exists linkedin text;

-- =========================================================
-- 5. NEGOCIACOES — potencial vs previsão + negócio único
-- =========================================================
alter table negociacoes
  add column if not exists valor_previsao numeric(14,2),
  add column if not exists negocio_unico boolean not null default true;

comment on column negociacoes.valor_estimado is
  'Valor potencial (cheio) do projeto — pipeline.';
comment on column negociacoes.valor_previsao is
  'Valor de previsão de faturamento (o que se espera faturar). Null = usa valor_estimado.';
comment on column negociacoes.negocio_unico is
  'true = negócio único; false = recorrente (base para melhorias futuras).';

-- =========================================================
-- 6. v_negociacoes — n.* já traz colunas novas; recria para empresa_segmento
-- =========================================================
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

-- =========================================================
-- 7. v_empresas — endereço + tipo_segmento
-- =========================================================
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
  e.tipo_segmento,
  e.logradouro,
  e.numero,
  e.complemento,
  e.bairro,
  e.cep,
  e.municipio
from empresas e
left join usuarios u on u.id = e.responsavel_id
left join agg a on a.empresa_id = e.id
left join ultimos ult on ult.empresa_id = e.id
where e.arquivado_em is null;
