-- Cadastro completo de empresa pelo MCP:
--   1. Ficha fiscal e de contato em empresas
--   2. CNPJ único entre empresas ativas (só dígitos)
--   3. Contato: telefone e principal (um por empresa)
--   4. Timeline da empresa (interação sem negociação), para o prefixo [agente]

-- =========================================================
-- 1. EMPRESAS
-- =========================================================
alter table empresas
  add column if not exists razao_social text,
  add column if not exists nome_fantasia text,
  add column if not exists inscricao_estadual text,
  add column if not exists telefone text,
  add column if not exists email text,
  add column if not exists site text,
  add column if not exists atividade_principal text;

alter table empresas
  add column if not exists cnpj_digitos text
  generated always as (
    nullif(regexp_replace(coalesce(cnpj, ''), '\D', '', 'g'), '')
  ) stored;

do $$
declare
  dup text;
begin
  select cnpj_digitos into dup
  from empresas
  where arquivado_em is null
    and cnpj_digitos is not null
  group by cnpj_digitos
  having count(*) > 1
  limit 1;
  if dup is not null then
    raise exception
      'CNPJ duplicado entre empresas ativas (%). Una os cadastros antes de aplicar a unicidade.',
      dup;
  end if;
end $$;

create unique index if not exists empresas_cnpj_digitos_unico
  on empresas (cnpj_digitos)
  where arquivado_em is null and cnpj_digitos is not null;

create index if not exists empresas_cnpj_digitos on empresas (cnpj_digitos)
  where cnpj_digitos is not null;

-- Nome normalizado (mesmo critério do índice empresas_nome_unico).
create or replace function empresa_ativa_por_nome(p_nome text)
returns table (id uuid, nome text)
language sql
stable
security invoker
set search_path = public
as $$
  select e.id, e.nome
  from empresas e
  where e.arquivado_em is null
    and lower(f_unaccent(e.nome)) = lower(f_unaccent(btrim(p_nome)))
  limit 2;
$$;

revoke all on function empresa_ativa_por_nome(text) from public, anon;
grant execute on function empresa_ativa_por_nome(text) to authenticated;

-- =========================================================
-- 2. CONTATOS
-- =========================================================
alter table contatos
  add column if not exists telefone text,
  add column if not exists principal boolean not null default false;

create unique index if not exists contatos_principal_unico
  on contatos (empresa_id)
  where principal = true and arquivado_em is null;

-- =========================================================
-- 3. TIMELINE DA EMPRESA
-- =========================================================
alter table interacoes
  add column if not exists empresa_id uuid references empresas(id) on delete cascade;

alter table interacoes
  alter column negociacao_id drop not null;

alter table interacoes
  drop constraint if exists interacoes_alvo_chk;

alter table interacoes
  add constraint interacoes_alvo_chk
  check (negociacao_id is not null or empresa_id is not null);

create index if not exists interacoes_empresa
  on interacoes (empresa_id, criado_em desc)
  where empresa_id is not null;

-- Leitura da ficha: qualquer autenticado vê anotações da empresa
-- (empresas já são legíveis por todos). Escrita segue a regra de empresas.
drop policy if exists inter_all on interacoes;
drop policy if exists inter_sel on interacoes;
drop policy if exists inter_ins on interacoes;
drop policy if exists inter_upd on interacoes;
drop policy if exists inter_del on interacoes;

create policy inter_sel on interacoes for select using (
  (
    negociacao_id is not null
    and exists (
      select 1 from negociacoes n
      where n.id = negociacao_id
        and (
          eh_diretor_de(n.emitente_id)
          or n.responsavel_id = auth.uid()
          or eh_gerente_de(n.responsavel_id, n.emitente_id)
        )
    )
  )
  or (empresa_id is not null and negociacao_id is null)
);

create policy inter_ins on interacoes for insert with check (
  (
    negociacao_id is not null
    and exists (
      select 1 from negociacoes n
      where n.id = negociacao_id
        and (
          eh_diretor_de(n.emitente_id)
          or n.responsavel_id = auth.uid()
          or eh_gerente_de(n.responsavel_id, n.emitente_id)
        )
    )
  )
  or (
    empresa_id is not null
    and negociacao_id is null
    and exists (
      select 1 from empresas e
      where e.id = empresa_id
        and (
          eh_diretor()
          or e.responsavel_id = auth.uid()
          or e.responsavel_id is null
        )
    )
  )
);

create policy inter_upd on interacoes for update
  using (
    (
      negociacao_id is not null
      and exists (
        select 1 from negociacoes n
        where n.id = negociacao_id
          and (
            eh_diretor_de(n.emitente_id)
            or n.responsavel_id = auth.uid()
            or eh_gerente_de(n.responsavel_id, n.emitente_id)
          )
      )
    )
    or (
      empresa_id is not null
      and negociacao_id is null
      and exists (
        select 1 from empresas e
        where e.id = empresa_id
          and (
            eh_diretor()
            or e.responsavel_id = auth.uid()
            or e.responsavel_id is null
          )
      )
    )
  )
  with check (
    (
      negociacao_id is not null
      and exists (
        select 1 from negociacoes n
        where n.id = negociacao_id
          and (
            eh_diretor_de(n.emitente_id)
            or n.responsavel_id = auth.uid()
            or eh_gerente_de(n.responsavel_id, n.emitente_id)
          )
      )
    )
    or (
      empresa_id is not null
      and negociacao_id is null
      and exists (
        select 1 from empresas e
        where e.id = empresa_id
          and (
            eh_diretor()
            or e.responsavel_id = auth.uid()
            or e.responsavel_id is null
          )
      )
    )
  );

create policy inter_del on interacoes for delete using (
  (
    negociacao_id is not null
    and exists (
      select 1 from negociacoes n
      where n.id = negociacao_id
        and (
          eh_diretor_de(n.emitente_id)
          or n.responsavel_id = auth.uid()
          or eh_gerente_de(n.responsavel_id, n.emitente_id)
        )
    )
  )
  or (
    empresa_id is not null
    and negociacao_id is null
    and exists (
      select 1 from empresas e
      where e.id = empresa_id
        and (
          eh_diretor()
          or e.responsavel_id = auth.uid()
          or e.responsavel_id is null
        )
    )
  )
);
