-- Acompanhamento pós-venda: entrega e pagamento depois de marcar a venda.
-- A view usa n.*, então precisa ser recriada para expor as colunas novas.
-- Idempotente.

alter table negociacoes
  add column if not exists entregue boolean not null default false,
  add column if not exists entregue_em date,
  add column if not exists pago boolean not null default false,
  add column if not exists pago_em date;

comment on column negociacoes.entregue is 'true depois de marcar a entrega de uma venda.';
comment on column negociacoes.entregue_em is 'Data real da entrega.';
comment on column negociacoes.pago is 'true depois de marcar o pagamento do cliente de uma venda.';
comment on column negociacoes.pago_em is 'Data real do pagamento do cliente.';

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

grant select, insert, update, delete, truncate, references, trigger
  on v_negociacoes to anon, authenticated, service_role;
