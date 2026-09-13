-- Corrige o trigger de espelho auth.users → public.usuarios.
-- Sem search_path=public, o cast ::perfil_usuario falha no contexto do Auth
-- e o GoTrue responde "Database error saving/creating new user".

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usuarios (id, nome, email, perfil)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    new.email,
    coalesce(
      (new.raw_user_meta_data->>'perfil')::public.perfil_usuario,
      'vendedor'::public.perfil_usuario
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
