-- =====================================================================
-- gestaovia · 5 · Proprietário do sistema
-- O proprietário é um administrador que não pode ser inativado, rebaixado
-- nem ter a senha redefinida por outro usuário. Há no máximo um.
-- O primeiro e-mail da lista private.bootstrap_admins vira o proprietário.
-- =====================================================================
alter table public.profiles add column if not exists is_owner boolean not null default false;
create unique index if not exists profiles_one_owner on public.profiles ((true)) where is_owner;

-- o proprietário é sempre administrador ativo
alter table public.profiles drop constraint if exists profiles_owner_is_admin;
alter table public.profiles add constraint profiles_owner_is_admin check (not is_owner or (role = 'admin' and active));

create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  m jsonb := coalesce(new.raw_app_meta_data, '{}'::jsonb);
  boot boolean := exists (select 1 from private.bootstrap_admins b where lower(b.email) = lower(new.email));
  owner boolean := boot and not exists (select 1 from public.profiles p where p.is_owner);
  r text;
begin
  r := case when boot then 'admin'
            when m->>'vialink_role' in ('admin','gestor','supervisor','condutor') then m->>'vialink_role'
            else 'condutor' end;
  insert into public.profiles (id, email, name, role, driver_id, active, must_change_password, is_owner)
  values (new.id, lower(new.email),
          coalesce(nullif(m->>'vialink_name',''), nullif(new.raw_user_meta_data->>'name',''), split_part(new.email,'@',1)),
          r, nullif(m->>'vialink_driver_id','')::uuid,
          boot or (m ? 'vialink_role'),
          coalesce((m->>'vialink_must_change')::boolean, false),
          owner)
  on conflict (id) do nothing;
  return new;
end $$;

-- perfis existentes: o administrador da lista inicial vira proprietário
update public.profiles p set is_owner = true
 where p.role = 'admin' and p.active
   and lower(p.email) in (select lower(email) from private.bootstrap_admins)
   and not exists (select 1 from public.profiles o where o.is_owner)
   and p.id = (select p2.id from public.profiles p2
                where p2.role = 'admin' and p2.active and lower(p2.email) in (select lower(email) from private.bootstrap_admins)
                order by p2.created_at limit 1);

