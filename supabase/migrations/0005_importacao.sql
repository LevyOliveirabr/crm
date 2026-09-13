-- CRM Comercial F-Led — migration 0003: importação CSV + storage logo
-- Funções SQL opcionais (SPEC seção 6). A app também faz importação em lote
-- com rollback compensatório nas Server Actions.

create or replace function importar_empresas(p_linhas jsonb, p_usuario_id uuid)
returns jsonb
language plpgsql
security invoker
as $$
declare
  r jsonb;
  v_nome text;
  v_id uuid;
  v_existente uuid;
  v_resp uuid;
  importadas int := 0;
  reutilizadas int := 0;
  erros jsonb := '[]'::jsonb;
  i int := 0;
  linha_num int;
begin
  if not eh_diretor() then
    raise exception 'apenas diretor';
  end if;

  for r in select * from jsonb_array_elements(p_linhas)
  loop
    i := i + 1;
    linha_num := coalesce((r->>'linha')::int, i + 1);
    v_nome := nullif(trim(r->>'nome'), '');
    if v_nome is null then
      erros := erros || jsonb_build_array(jsonb_build_object('linha', linha_num, 'motivo', 'nome obrigatório', 'nivel', 'erro'));
      continue;
    end if;

    select id into v_existente
    from empresas
    where arquivado_em is null
      and lower(f_unaccent(nome)) = lower(f_unaccent(v_nome))
    limit 1;

    if v_existente is not null then
      reutilizadas := reutilizadas + 1;
      continue;
    end if;

    select id into v_resp from usuarios
    where lower(email) = lower(nullif(trim(r->>'responsavel_email'), ''))
    limit 1;
    v_resp := coalesce(v_resp, p_usuario_id);

    insert into empresas (nome, cidade, uf, segmento, cnpj, responsavel_id, observacoes)
    values (
      v_nome,
      nullif(trim(r->>'cidade'), ''),
      case when length(trim(coalesce(r->>'uf',''))) = 2 then upper(trim(r->>'uf')) else null end,
      nullif(trim(r->>'segmento'), ''),
      nullif(trim(r->>'cnpj'), ''),
      v_resp,
      nullif(trim(r->>'observacoes'), '')
    )
    returning id into v_id;
    importadas := importadas + 1;
  end loop;

  return jsonb_build_object(
    'importadas', importadas,
    'reutilizadas', reutilizadas,
    'erros', erros
  );
end;
$$;

-- Permite substituir logo no bucket publico
drop policy if exists publico_update on storage.objects;
create policy publico_update on storage.objects for update
  using (bucket_id = 'publico' and eh_diretor())
  with check (bucket_id = 'publico' and eh_diretor());

drop policy if exists publico_delete on storage.objects;
create policy publico_delete on storage.objects for delete
  using (bucket_id = 'publico' and eh_diretor());
