-- Teste manual de RLS multi-empresa (migration 0008).
-- Rodar num banco de teste (Supabase local ou Postgres com shim de auth.uid()):
--   psql "$DATABASE_URL" -f supabase/tests/rls_multi_empresa.sql
-- Pré-requisitos: usuários DIR (diretor da empresa padrão), GER (gerente da padrão,
-- gerente de V1), V1 (vendedor da padrão) e V2 (vendedor da padrão) em auth.users/usuarios.
-- O script cria a "Empresa B", torna V2 diretor dela e confere o isolamento.
-- Resultado esperado está comentado em cada bloco; qualquer diferença é falha.

\set dir  '11111111-1111-1111-1111-111111111111'
\set ger  '22222222-2222-2222-2222-222222222222'
\set v1   '33333333-3333-3333-3333-333333333333'
\set v2   '44444444-4444-4444-4444-444444444444'
\set empB 'bbbbbbbb-0000-0000-0000-000000000002'

begin;
insert into emitentes (id, nome, razao_social) values (:'empB', 'Empresa B', 'Empresa B Ltda')
  on conflict (id) do nothing;
insert into usuario_emitentes (usuario_id, emitente_id, perfil) values (:'v2', :'empB', 'diretor')
  on conflict (usuario_id, emitente_id) do update set perfil = 'diretor';
insert into produtos (codigo, nome, preco_base, emitente_id) values ('TESTE-B', 'Produto só da B', 20, :'empB');
insert into negociacoes (empresa_id, funil_id, etapa_id, titulo, valor_estimado, responsavel_id, emitente_id)
  select (select id from empresas where arquivado_em is null limit 1), f.id, e.id, 'RLS: só da B', 777, :'v2', :'empB'
  from funis f join etapas e on e.funil_id = f.id and e.ordem = 1 where f.ativo order by f.ordem limit 1;

\echo '--- DIR (diretor só da padrão): NÃO deve listar "RLS: só da B", "Produto só da B" nem "Empresa B"'
set role authenticated; set local request.jwt.claim.sub = :'dir';
select titulo from v_negociacoes where titulo like 'RLS:%';
select nome from produtos where nome like 'Produto só%';
select nome from emitentes where nome = 'Empresa B';
select count(*) as vinculos_da_b_visiveis_esperado_0 from usuario_emitentes where emitente_id = :'empB';

\echo '--- V1 (vendedor da padrão): insert em B deve FALHAR com violação de RLS'
set local request.jwt.claim.sub = :'v1';
savepoint sp;
insert into negociacoes (empresa_id, funil_id, etapa_id, titulo, valor_estimado, responsavel_id, emitente_id)
  select (select id from empresas where arquivado_em is null limit 1), f.id, e.id, 'RLS: hack', 1, :'v1', :'empB'
  from funis f join etapas e on e.funil_id = f.id and e.ordem = 1 where f.ativo order by f.ordem limit 1;
rollback to savepoint sp;

\echo '--- GER (gerente da padrão): NÃO deve ver "RLS: só da B"'
set local request.jwt.claim.sub = :'ger';
select titulo from v_negociacoes where titulo like 'RLS:%';

\echo '--- V2 (diretor da B): DEVE ver "RLS: só da B" e "Produto só da B"; presidência da B vendido = 0'
set local request.jwt.claim.sub = :'v2';
select titulo, emitente_nome from v_negociacoes where titulo like 'RLS:%';
select nome from produtos where nome like 'Produto só%';
select relatorio_presidencia(date_trunc('month', current_date)::date, :'empB') ->> 'vendido' as vendido_b;

reset role;
rollback;
